import { NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, readFile, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOpenSCAD } from 'openscad-wasm';
import { z } from 'zod';

const execFileAsync = promisify(execFile);

const CompileScadRequestSchema = z.object({
  scadSource: z.string().min(5, 'SCAD-kildekode må inneholde minst 5 tegn').max(500_000),
  parameters: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  fastPreview: z.boolean().default(true),
});

const CANDIDATE_OPENSCAD_PATHS = [
  process.env.OPENSCAD_CLI_PATH,
  'C:\\Program Files\\OpenSCAD\\openscad.com',
  'C:\\Program Files\\OpenSCAD\\openscad.exe',
  'C:\\Program Files (x86)\\OpenSCAD\\openscad.com',
  'C:\\Program Files (x86)\\OpenSCAD\\openscad.exe',
  '/usr/bin/openscad',
  '/usr/local/bin/openscad',
].filter((p): p is string => Boolean(p));

async function resolveOpenScadBinary(): Promise<string> {
  for (const candidate of CANDIDATE_OPENSCAD_PATHS) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return 'openscad';
}

interface CachedScadResult {
  stlBase64: string;
  byteLength: number;
  engine: string;
}

const compiledScadCache = new Map<string, CachedScadResult>();
const inFlightCompilations = new Map<string, Promise<CachedScadResult>>();

/**
 * Clamps extreme $fn values (e.g. $fn = 256) to $fn = 36 so interactive previews
 * stay crisp while compiling in ~100-350ms on the WebAssembly Manifold engine.
 */
function optimizeScadSourceForPreview(source: string): string {
  const maxFn = 36;
  const lines = source.split(/\r?\n/);
  const transformed = lines.map((line) => {
    const commentIdx = line.indexOf('//');
    const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
    const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : '';

    const updatedCode = codePart.replace(
      /\$fn\s*=\s*([^;,\)]+)/g,
      (_m, expr: string) => `$fn = min(${maxFn}, (${expr.trim()}))`
    );

    return updatedCode + commentPart;
  });

  return transformed.join('\n');
}

/**
 * Primary production compiler: runs OpenSCAD compiled to WebAssembly (`openscad-wasm`)
 * with the modern `--backend=Manifold` 3D boolean kernel completely in memory.
 * Requires zero OS-level binaries installed (works on Firebase, Vercel, Cloud Run, and localhost).
 */
async function compileWithWasmManifold(
  effectiveSource: string,
  dArgs: string[]
): Promise<CachedScadResult> {
  const stderrLines: string[] = [];
  const scad = await createOpenSCAD({
    print: () => undefined,
    printErr: (text: string) => {
      if (text.toLowerCase().includes('error') || text.toLowerCase().includes('warning')) {
        stderrLines.push(text);
      }
    },
  });

  const instance = scad.getInstance();
  instance.FS.writeFile('/input.scad', effectiveSource);

  const exitCode = instance.callMain([
    '--backend=Manifold',
    '--export-format=binstl',
    ...dArgs,
    '/input.scad',
    '-o',
    '/output.stl',
  ]);

  if (exitCode !== 0) {
    throw new Error(stderrLines.join(' | ') || `OpenSCAD WASM avsluttet med feilkode ${exitCode}`);
  }

  const binaryStl = instance.FS.readFile('/output.stl', { encoding: 'binary' });
  const stlBuffer = Buffer.from(binaryStl.buffer, binaryStl.byteOffset, binaryStl.byteLength);

  return {
    stlBase64: stlBuffer.toString('base64'),
    byteLength: stlBuffer.byteLength,
    engine: 'openscad-wasm-manifold',
  };
}

/**
 * Fallback compiler: uses native OpenSCAD CLI if installed on the host.
 */
async function compileWithNativeCliFallback(
  effectiveSource: string,
  dArgs: string[]
): Promise<CachedScadResult> {
  const jobId = `scad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const tmpDir = os.tmpdir();
  const tempScadPath = path.join(tmpDir, `${jobId}.scad`);
  const tempStlPath = path.join(tmpDir, `${jobId}.stl`);

  try {
    await writeFile(tempScadPath, effectiveSource, 'utf8');
    const binary = await resolveOpenScadBinary();

    await execFileAsync(
      binary,
      ['--export-format', 'binstl', '-o', tempStlPath, ...dArgs, tempScadPath],
      {
        timeout: 60_000,
        maxBuffer: 30 * 1024 * 1024,
        windowsHide: true,
      }
    );

    const stlBuffer = await readFile(tempStlPath);
    return {
      stlBase64: stlBuffer.toString('base64'),
      byteLength: stlBuffer.byteLength,
      engine: 'openscad-cli-binstl',
    };
  } finally {
    await unlink(tempScadPath).catch(() => undefined);
    await unlink(tempStlPath).catch(() => undefined);
  }
}

async function compileScadWithDedup(
  effectiveSource: string,
  dArgs: string[]
): Promise<CachedScadResult> {
  const cacheKey = `${effectiveSource}:::${dArgs.join('|')}`;
  const cached = compiledScadCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const existingInFlight = inFlightCompilations.get(cacheKey);
  if (existingInFlight) {
    return existingInFlight;
  }

  const task = (async (): Promise<CachedScadResult> => {
    let result: CachedScadResult;
    try {
      result = await compileWithWasmManifold(effectiveSource, dArgs);
    } catch (wasmErr) {
      try {
        result = await compileWithNativeCliFallback(effectiveSource, dArgs);
      } catch {
        throw wasmErr;
      }
    }

    if (compiledScadCache.size >= 25) {
      const oldestKey = compiledScadCache.keys().next().value;
      if (oldestKey) compiledScadCache.delete(oldestKey);
    }
    compiledScadCache.set(cacheKey, result);
    return result;
  })();

  inFlightCompilations.set(cacheKey, task);
  try {
    return await task;
  } finally {
    inFlightCompilations.delete(cacheKey);
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = CompileScadRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Ugyldig .scad-forespørsel',
        },
        { status: 400 }
      );
    }

    const { scadSource, parameters, fastPreview } = parsed.data;
    const effectiveSource = fastPreview ? optimizeScadSourceForPreview(scadSource) : scadSource;

    const dArgs: string[] = [];
    for (const [key, val] of Object.entries(parameters)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
      if (typeof val === 'number' && Number.isFinite(val)) {
        dArgs.push('-D', `${key}=${val}`);
      } else if (typeof val === 'boolean') {
        dArgs.push('-D', `${key}=${val ? 'true' : 'false'}`);
      }
    }

    const result = await compileScadWithDedup(effectiveSource, dArgs);

    return NextResponse.json(
      {
        stlBase64: result.stlBase64,
        byteLength: result.byteLength,
        engine: result.engine,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Kunne ikke kompilere .scad-filen med OpenSCAD WASM';
    return NextResponse.json(
      {
        error: 'SCAD_COMPILE_FAILED',
        message,
      },
      { status: 500 }
    );
  }
}
