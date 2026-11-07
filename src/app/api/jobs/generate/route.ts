import { NextResponse } from 'next/server';
import { GenerateJobRequestSchema, GenerationJobDocumentSchema } from '@/lib/schemas/forge';
import { ForgeServerRepository } from '@/lib/firebase/admin';
import { TripoService } from '@/lib/services/tripo.service';

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();

    // Handle purchasing 10 extra AI attempts (39 kr deductible on next order)
    if (rawBody?.action === 'buy_extra_credits') {
      const uid = typeof rawBody.uid === 'string' && rawBody.uid ? rawBody.uid : 'dev-operator-01';
      const updatedUser = await ForgeServerRepository.purchaseExtraGenerations(uid);
      return NextResponse.json({ userQuota: updatedUser }, { status: 200 });
    }

    const parsed = GenerateJobRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Ugyldig forespørsel',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { uid, prompt, inputImageStoragePath } = parsed.data;

    // 1. Check Anti-Spam Quota (Users start with 3 free generations)
    const userDoc = await ForgeServerRepository.getOrCreateUser(uid);
    if (userDoc.freeGenerationsRemaining <= 0) {
      return NextResponse.json(
        {
          error: 'QUOTA_EXHAUSTED',
          message:
            'Du har brukt opp dine gratis AI-genereringer. Bestill print for å få +5 nye forsøk, eller kjøp 10 ekstra AI-forsøk (39 kr – trekkes fra ved neste printbestilling).',
          userQuota: userDoc,
        },
        { status: 402 }
      );
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 2. Call Tripo 3D API (or deterministic CAD mock when NEXT_PUBLIC_DEV_MOCK_MODE=true)
    const tripoResult = await TripoService.generateModel({
      uid,
      jobId,
      prompt,
      inputImageStoragePath: inputImageStoragePath ?? null,
    });

    const jobDoc = GenerationJobDocumentSchema.parse({
      id: jobId,
      uid,
      prompt,
      inputImageStoragePath: inputImageStoragePath ?? null,
      tripoTaskId: tripoResult.tripoTaskId,
      status: 'completed',
      glbStoragePath: tripoResult.glbStoragePath,
      glbDownloadUrl: tripoResult.glbDownloadUrl,
      proceduralPreset: tripoResult.proceduralPreset,
      boundingBoxMm: tripoResult.boundingBoxMm,
      volumeCm3: tripoResult.volumeCm3,
      overhangRatio: tripoResult.overhangRatio,
      isManifold: tripoResult.isManifold,
      errorMessage: null,
      createdAt: new Date().toISOString(),
    });

    await ForgeServerRepository.saveGenerationJob(jobDoc);

    // 3. Decrement freeGenerationsRemaining by 1
    const updatedUser = await ForgeServerRepository.saveUser({
      ...userDoc,
      freeGenerationsRemaining: Math.max(0, userDoc.freeGenerationsRemaining - 1),
    });

    return NextResponse.json({ job: jobDoc, userQuota: updatedUser }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukjent feil under 3D-generering';
    return NextResponse.json({ error: 'TRIPO_GENERATION_FAILED', message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId') || 'job_seed_bambu_mech_01';
  const uid = searchParams.get('uid') || 'dev-operator-01';

  const [job, userQuota] = await Promise.all([
    ForgeServerRepository.getGenerationJob(jobId),
    ForgeServerRepository.getOrCreateUser(uid),
  ]);

  if (!job) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: `Fant ingen genereringsjobb med ID ${jobId}` },
      { status: 404 }
    );
  }

  return NextResponse.json({ job, userQuota });
}
