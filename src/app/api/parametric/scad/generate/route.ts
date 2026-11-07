import { NextResponse } from 'next/server';
import { createOpenSCAD } from 'openscad-wasm';
import { z } from 'zod';
import { ScadAiGeneratorService } from '@/lib/services/scad-ai.service';

const GenerateScadRequestSchema = z.object({
  prompt: z.string().min(3, 'Beskriv hva slags 3D-del du vil generere').max(2000),
  modelTier: z.enum(['flash', 'pro']).default('flash'),
});

async function compileScadToStlBase64(scadSource: string): Promise<{
  stlBase64: string;
  byteLength: number;
}> {
  const stderrLines: string[] = [];
  const scad = await createOpenSCAD({
    print: () => undefined,
    printErr: (text: string) => {
      if (text.toLowerCase().includes('error')) {
        stderrLines.push(text);
      }
    },
  });

  const instance = scad.getInstance();
  instance.FS.writeFile('/input.scad', scadSource);

  const exitCode = instance.callMain([
    '--backend=Manifold',
    '--export-format=binstl',
    '/input.scad',
    '-o',
    '/output.stl',
  ]);

  if (exitCode !== 0) {
    throw new Error(stderrLines.join(' | ') || `OpenSCAD WASM feilkode ${exitCode}`);
  }

  const binaryStl = instance.FS.readFile('/output.stl', { encoding: 'binary' });
  const stlBuffer = Buffer.from(binaryStl.buffer, binaryStl.byteOffset, binaryStl.byteLength);

  return {
    stlBase64: stlBuffer.toString('base64'),
    byteLength: stlBuffer.byteLength,
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = GenerateScadRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Ugyldig beskrivelse',
        },
        { status: 400 }
      );
    }

    const { prompt, modelTier } = parsed.data;
    let generated = await ScadAiGeneratorService.generateScadFromPrompt(prompt, modelTier);
    let compiled: { stlBase64: string; byteLength: number };

    try {
      compiled = await compileScadToStlBase64(generated.scadSource);
    } catch {
      // Self-heal if an external LLM returned invalid OpenSCAD syntax
      generated = ScadAiGeneratorService.synthesizeFallback(prompt);
      compiled = await compileScadToStlBase64(generated.scadSource);
    }

    return NextResponse.json(
      {
        title: generated.title,
        fileName: generated.fileName,
        description: generated.description,
        category: generated.category,
        scadSource: generated.scadSource,
        provider: generated.provider,
        usedModel: generated.usedModel || generated.provider,
        stlBase64: compiled.stlBase64,
        byteLength: compiled.byteLength,
        engine: 'openscad-wasm-manifold',
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Kunne ikke AI-generere OpenSCAD-modellen';
    return NextResponse.json(
      {
        error: 'SCAD_AI_GENERATION_FAILED',
        message,
      },
      { status: 500 }
    );
  }
}
