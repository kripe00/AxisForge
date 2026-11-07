import { NextResponse } from 'next/server';
import {
  CatalogModelDocumentSchema,
  CreateCatalogModelRequestSchema,
  GenerationJobDocumentSchema,
} from '@/lib/schemas/forge';
import { ForgeServerRepository } from '@/lib/firebase/admin';

export async function GET() {
  try {
    const models = await ForgeServerRepository.listCatalogModels();
    return NextResponse.json({ models }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunne ikke hente katalogmodeller';
    return NextResponse.json({ error: 'CATALOG_FETCH_FAILED', message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = CreateCatalogModelRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Ugyldige modell-data',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const modelId = `cat_${data.fileFormat}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    const now = new Date().toISOString();
    const storagePath = `catalog/${modelId}/${data.fileName}`;

    const catalogDoc = CatalogModelDocumentSchema.parse({
      id: modelId,
      title: data.title,
      description: data.description,
      category: data.category,
      fileName: data.fileName,
      fileFormat: data.fileFormat,
      fileStoragePath: storagePath,
      modelFileUrl: data.modelFileUrl ?? null,
      stlBase64: data.stlBase64 ?? null,
      scadSource: data.scadSource ?? null,
      scadParameters: data.scadParameters ?? null,
      proceduralPreset: data.proceduralPreset ?? 'MECH_TURRET',
      parametricTemplateId: data.parametricTemplateId ?? null,
      parametricParams: data.parametricParams ?? null,
      boundingBoxMm: data.boundingBoxMm,
      volumeCm3: data.volumeCm3,
      overhangRatio: data.overhangRatio,
      defaultMaterial: data.defaultMaterial,
      defaultColorHex: data.defaultColorHex,
      createdAt: now,
    });

    await ForgeServerRepository.saveCatalogModel(catalogDoc);

    // Also register a backing GenerationJobDocument so slicing and immutable ordering work seamlessly
    const backingJob = GenerationJobDocumentSchema.parse({
      id: `job_${modelId}`,
      uid: 'admin-catalog',
      prompt: `${catalogDoc.title} (${catalogDoc.fileName})`,
      inputImageStoragePath: null,
      tripoTaskId: `catalog_${modelId}`,
      status: 'completed',
      glbStoragePath: storagePath,
      glbDownloadUrl: catalogDoc.modelFileUrl,
      modelFileUrl: catalogDoc.modelFileUrl,
      fileFormat: catalogDoc.fileFormat,
      stlBase64: catalogDoc.stlBase64,
      scadSource: catalogDoc.scadSource,
      scadParameters: catalogDoc.scadParameters,
      proceduralPreset: catalogDoc.proceduralPreset,
      parametricTemplateId: catalogDoc.parametricTemplateId,
      parametricParams: catalogDoc.parametricParams,
      boundingBoxMm: catalogDoc.boundingBoxMm,
      volumeCm3: catalogDoc.volumeCm3,
      overhangRatio: catalogDoc.overhangRatio,
      isManifold: true,
      errorMessage: null,
      createdAt: now,
    });

    await ForgeServerRepository.saveGenerationJob(backingJob);

    return NextResponse.json({ model: catalogDoc }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunne ikke lagre katalogmodell';
    return NextResponse.json({ error: 'CATALOG_CREATE_FAILED', message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'MISSING_ID', message: 'Mangler modell-ID' },
      { status: 400 }
    );
  }

  await ForgeServerRepository.deleteCatalogModel(id);
  return NextResponse.json({ deleted: id }, { status: 200 });
}
