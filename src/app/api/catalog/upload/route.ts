import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { CatalogFileFormat } from '@/lib/schemas/forge';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'MISSING_FILE', message: 'Ingen .stl eller .3mf-fil ble sendt med.' },
        { status: 400 }
      );
    }

    const originalName = file.name || 'model.stl';
    const lower = originalName.toLowerCase();
    if (!lower.endsWith('.stl') && !lower.endsWith('.3mf') && !lower.endsWith('.scad')) {
      return NextResponse.json(
        {
          error: 'INVALID_EXTENSION',
          message: 'Kun .stl, .3mf og .scad (OpenSCAD) 3D-modeller støttes.',
        },
        { status: 400 }
      );
    }

    const fileFormat: CatalogFileFormat = lower.endsWith('.3mf')
      ? '3mf'
      : lower.endsWith('.scad')
        ? 'scad'
        : 'stl';
    const safeBase = originalName
      .replace(/\.(stl|3mf|scad)$/i, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);

    const uniqueName = `${Date.now()}_${safeBase || 'model'}.${fileFormat}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'catalog');
    await mkdir(uploadDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    const filePath = path.join(uploadDir, uniqueName);
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const modelFileUrl = `/uploads/catalog/${uniqueName}`;

    return NextResponse.json(
      {
        modelFileUrl,
        fileName: originalName,
        fileFormat,
        byteLength: arrayBuffer.byteLength,
      },
      { status: 201 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Kunne ikke lagre opplastet 3D-fil på serveren';
    return NextResponse.json({ error: 'UPLOAD_FAILED', message }, { status: 500 });
  }
}
