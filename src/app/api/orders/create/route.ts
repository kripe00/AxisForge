import { NextResponse } from 'next/server';
import { CreateOrderRequestSchema, MATERIALS, PrintOrderDocumentSchema } from '@/lib/schemas/forge';
import { ForgeServerRepository } from '@/lib/firebase/admin';
import { FREE_SHIPPING_THRESHOLD_NOK, SHIPPING_FLAT_NOK } from '@/lib/services/pricing.engine';

const BAMBU_FARM_PRINTERS = [
  'BAMBU-X1C-BAY-01',
  'BAMBU-X1C-BAY-02',
  'BAMBU-X1C-BAY-03',
  'BAMBU-P1S-BAY-04',
] as const;

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const parsed = CreateOrderRequestSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message || 'Ugyldig bestillingsdata',
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    const { uid, quoteId, shippingAddress } = parsed.data;

    // 1. Fetch authoritative server-side SliceQuote
    const quote = await ForgeServerRepository.getSliceQuote(quoteId);
    if (!quote) {
      return NextResponse.json(
        {
          error: 'QUOTE_NOT_FOUND',
          message: 'Fant ikke pristilbudet. Kjør ny slicing før bestilling.',
        },
        { status: 404 }
      );
    }

    // 2. Verify quote has not expired
    if (new Date(quote.expiresAt).getTime() < Date.now()) {
      return NextResponse.json(
        {
          error: 'QUOTE_EXPIRED',
          message: 'Pristilbudet har utløpt. Kalkuler tilbudet på nytt.',
        },
        { status: 410 }
      );
    }

    // 3. Fetch original GenerationJob and User Quota
    const [job, userDoc] = await Promise.all([
      ForgeServerRepository.getGenerationJob(quote.jobId),
      ForgeServerRepository.getOrCreateUser(uid),
    ]);

    if (!job) {
      return NextResponse.json(
        {
          error: 'JOB_NOT_FOUND',
          message: 'Tilhørende 3D-modell ble ikke funnet.',
        },
        { status: 404 }
      );
    }

    const materialSpec = MATERIALS[quote.material];
    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const orderId = `ORD-AXF-${orderNumber}`;
    const assignedPrinter =
      BAMBU_FARM_PRINTERS[orderNumber % BAMBU_FARM_PRINTERS.length] ?? 'BAMBU-X1C-BAY-01';

    // Apply any 39 kr AI-pack credit towards the model order
    const aiCreditAppliedNok = Math.min(userDoc.aiCreditNok, quote.calculatedPriceNok - 49);
    const netModelPriceNok = quote.calculatedPriceNok - aiCreditAppliedNok;
    const shippingNok =
      quote.calculatedPriceNok >= FREE_SHIPPING_THRESHOLD_NOK ? 0 : SHIPPING_FLAT_NOK;
    const totalChargedNok = netModelPriceNok + shippingNok;

    // 4. Construct Immutable Print Order Snapshot
    const immutableOrder = PrintOrderDocumentSchema.parse({
      id: orderId,
      uid,
      quoteSnapshot: {
        quoteId: quote.id,
        jobId: job.id,
        prompt: job.prompt,
        glbStoragePath: job.glbStoragePath,
        glbDownloadUrl: job.glbDownloadUrl,
        proceduralPreset: job.proceduralPreset,
        sliced3mfStoragePath: quote.sliced3mfStoragePath,
        targetDimensionsMm: quote.targetDimensionsMm,
        material: quote.material,
        materialLabel: materialSpec.label,
        colorHex: quote.colorHex,
        layerQuality: quote.layerQuality,
        layerHeightMm: quote.layerHeightMm,
        quantity: quote.quantity ?? 1,
        filamentGrams: quote.filamentGrams,
        supportGrams: quote.supportGrams,
        printTimeSeconds: quote.printTimeSeconds,
        layerCount: quote.layerCount,
        supportRequired: quote.supportRequired,
        calculatedPriceNok: quote.calculatedPriceNok,
        aiCreditAppliedNok,
        shippingNok,
        totalChargedNok,
        pricingBreakdown: quote.pricingBreakdown,
      },
      shippingAddress,
      orderStatus: 'slicing_verified',
      bambuPrinterId: assignedPrinter,
      createdAt: new Date().toISOString(),
    });

    await ForgeServerRepository.createImmutableOrder(immutableOrder);

    // 5. Reward +5 free AI generations upon physical order completion!
    const updatedUser = await ForgeServerRepository.rewardOrderBonusGenerations(uid);

    return NextResponse.json({ order: immutableOrder, userQuota: updatedUser }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Kunne ikke opprette print-ordre';
    return NextResponse.json({ error: 'ORDER_CREATE_FAILED', message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uid = searchParams.get('uid') || undefined;

  const orders = await ForgeServerRepository.listOrdersByUser(uid);
  return NextResponse.json({ orders });
}
