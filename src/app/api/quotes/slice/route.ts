import { NextResponse } from 'next/server';
import { SliceQuoteDocumentSchema, SliceQuoteRequestSchema } from '@/lib/schemas/forge';
import { ForgeServerRepository } from '@/lib/firebase/admin';
import { BambuSlicerService } from '@/lib/services/bambu-slicer.service';
import { calculateModelPrice } from '@/lib/services/pricing.engine';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = SliceQuoteRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Ugyldige slicer-parametere',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const {
      uid,
      jobId,
      targetHeightMm,
      material,
      colorHex,
      layerQuality,
      infillPercent,
      overrideBoundingBoxMm,
      overrideVolumeCm3,
      overrideOverhangRatio,
      overridePrompt,
      parametricTemplateId,
      parametricParams,
    } = parsed.data;

    let job = await ForgeServerRepository.getGenerationJob(jobId);

    // If this is a live parametric model or has updated parametric dimensions, upsert the backing job
    if (!job && overrideBoundingBoxMm && overrideVolumeCm3) {
      const nowIso = new Date().toISOString();
      job = await ForgeServerRepository.saveGenerationJob({
        id: jobId,
        uid,
        prompt: overridePrompt || 'Parametrisk 3D-modell',
        inputImageStoragePath: null,
        tripoTaskId: `parametric_${jobId}`,
        status: 'completed',
        glbStoragePath: `parametric/${jobId}/custom.stl`,
        glbDownloadUrl: null,
        modelFileUrl: null,
        fileFormat: 'stl',
        stlBase64: null,
        proceduralPreset: 'INDUSTRIAL_BRACKET',
        parametricTemplateId: parametricTemplateId ?? null,
        parametricParams: parametricParams ?? null,
        scadSource: null,
        scadParameters: null,
        boundingBoxMm: overrideBoundingBoxMm,
        volumeCm3: overrideVolumeCm3,
        overhangRatio: overrideOverhangRatio ?? 0.12,
        isManifold: true,
        errorMessage: null,
        createdAt: nowIso,
      });
    } else if (job && overrideBoundingBoxMm && overrideVolumeCm3) {
      job = await ForgeServerRepository.saveGenerationJob({
        ...job,
        prompt: overridePrompt || job.prompt,
        parametricTemplateId: parametricTemplateId ?? job.parametricTemplateId ?? null,
        parametricParams: parametricParams ?? job.parametricParams ?? null,
        boundingBoxMm: overrideBoundingBoxMm,
        volumeCm3: overrideVolumeCm3,
        overhangRatio: overrideOverhangRatio ?? job.overhangRatio,
      });
    }

    if (!job) {
      return NextResponse.json(
        { error: 'JOB_NOT_FOUND', message: `Fant ikke 3D-jobb (${jobId}) for slicing.` },
        { status: 404 }
      );
    }

    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Run deterministic Bambu Studio CLI / Volumetric Slicer
    const sliceResult = await BambuSlicerService.sliceAndValidate({
      uid,
      jobId: job.id,
      quoteId,
      baseBoundingBoxMm: job.boundingBoxMm,
      baseVolumeCm3: job.volumeCm3,
      overhangRatio: job.overhangRatio,
      targetHeightMm,
      material,
      layerQuality,
      infillPercent,
      glbStoragePath: job.glbStoragePath,
    });

    if (!sliceResult.isWithinBuildVolume) {
      return NextResponse.json(
        {
          error: 'EXCEEDS_BUILD_VOLUME',
          message: 'Modellen overstiger Bambu Lab X1C byggevolum (256 × 256 × 256 mm).',
        },
        { status: 422 }
      );
    }

    // 2. Run Pay-Per-Model deterministic calculateModelPrice()
    const pricingBreakdown = calculateModelPrice({
      filamentGrams: sliceResult.filamentGrams,
      printTimeSeconds: sliceResult.printTimeSeconds,
      material,
      layerQuality,
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

    const quoteDoc = SliceQuoteDocumentSchema.parse({
      id: quoteId,
      uid,
      jobId: job.id,
      targetDimensionsMm: sliceResult.targetDimensionsMm,
      scaleFactor: sliceResult.scaleFactor,
      material,
      colorHex,
      layerQuality,
      layerHeightMm: sliceResult.layerHeightMm,
      infillPercent,
      filamentGrams: sliceResult.filamentGrams,
      supportGrams: sliceResult.supportGrams,
      printTimeSeconds: sliceResult.printTimeSeconds,
      layerCount: sliceResult.layerCount,
      supportRequired: sliceResult.supportRequired,
      brimEnabled: sliceResult.brimEnabled,
      isWithinBuildVolume: sliceResult.isWithinBuildVolume,
      slicerEngine: sliceResult.slicerEngine,
      calculatedPriceNok: pricingBreakdown.finalPriceNok,
      pricingBreakdown,
      sliced3mfStoragePath: sliceResult.sliced3mfStoragePath,
      expiresAt,
      createdAt: now.toISOString(),
    });

    await ForgeServerRepository.saveSliceQuote(quoteDoc);

    return NextResponse.json({ quote: quoteDoc }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Feil under slicing og prisberegning';
    return NextResponse.json({ error: 'SLICER_FAILED', message }, { status: 500 });
  }
}
