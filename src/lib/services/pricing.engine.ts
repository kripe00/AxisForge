import {
  LAYER_QUALITY,
  MATERIALS,
  type DimensionsMm,
  type FilamentMaterialCode,
  type LayerQualityKey,
  type PricingBreakdown,
} from '@/lib/schemas/forge';

// ============================================================================
// PAY-PER-MODEL DETERMINISTIC PRICING ENGINE (NO SUBSCRIPTIONS)
// ============================================================================

export const BASE_FORGE_FEE_NOK = 129; // Includes Tripo AI gen, Bambu printer setup, support removal & prep
export const MACHINE_HOUR_RATE_NOK = 35; // Price per print hour
export const SHIPPING_FLAT_NOK = 79; // Free shipping on orders over 1000 kr
export const FREE_SHIPPING_THRESHOLD_NOK = 1000;
export const EXTRA_AI_PACK_PRICE_NOK = 39; // 10 extra AI attempts, deducted on next print order!
export const EXTRA_AI_PACK_GENERATIONS = 10;
export const ORDER_BONUS_GENERATIONS = 5;

export { MATERIALS, LAYER_QUALITY };

export interface CalculateModelPriceInput {
  filamentGrams: number;
  printTimeSeconds: number;
  material: FilamentMaterialCode;
  layerQuality: LayerQualityKey;
  quantity?: number;
  dimensionsMm?: DimensionsMm;
}

/**
 * Deterministic Pay-Per-Model price calculation on the server (with multi-item Bambu plate batching).
 * Formula:
 * 1. Single-item cost = BASE_FORGE_FEE_NOK + materialCost + machineCost
 * 2. When quantity > 1, multiple copies share the same Bambu Lab X1C 256×256mm build plate,
 *    saving the customer repeated setup fees + applying volume efficiency discounts (5+ and 10+ pcs).
 */
export function calculateModelPrice(input: CalculateModelPriceInput): PricingBreakdown {
  const matSpec = MATERIALS[input.material];
  const qualitySpec = LAYER_QUALITY[input.layerQuality];
  const qty = Math.min(25, Math.max(1, Math.round(input.quantity ?? 1)));

  const singleMaterialCost = input.filamentGrams * matSpec.pricePerGram;
  const singleMachineCost =
    (input.printTimeSeconds / 3600) * MACHINE_HOUR_RATE_NOK * qualitySpec.timeMultiplier;
  const singleRawTotal = BASE_FORGE_FEE_NOK + singleMaterialCost + singleMachineCost;
  const singleFinalPriceNok = Math.ceil(singleRawTotal / 10) * 10 - 1;

  // Calculate how many copies fit on one Bambu Lab X1C build plate (256x256mm with 6mm clearance)
  const dimX = input.dimensionsMm?.x ?? 80;
  const dimY = input.dimensionsMm?.y ?? 80;
  const colsPerPlate = Math.max(1, Math.floor(250 / (dimX + 6)));
  const rowsPerPlate = Math.max(1, Math.floor(250 / (dimY + 6)));
  const itemsPerPlate = Math.max(1, colsPerPlate * rowsPerPlate);
  const platesRequired = Math.ceil(qty / itemsPerPlate);

  // Batch discount factor on variable costs for 5+ or 10+ items
  const volumeDiscountFactor = qty >= 10 ? 0.85 : qty >= 5 ? 0.92 : 1.0;

  const baseForgeFeeNok = Math.round(BASE_FORGE_FEE_NOK * (1 + (platesRequired - 1) * 0.45));
  const totalMaterialCost = singleMaterialCost * qty * volumeDiscountFactor;
  const totalMachineCost = singleMachineCost * qty * volumeDiscountFactor;

  const rawTotal = baseForgeFeeNok + totalMaterialCost + totalMachineCost;
  const finalPriceNok = qty === 1 ? singleFinalPriceNok : Math.ceil(rawTotal / 10) * 10 - 1;
  const unitPriceNok = Math.round(finalPriceNok / qty);
  const batchSavingsNok = Math.max(0, singleFinalPriceNok * qty - finalPriceNok);
  const shippingNok = finalPriceNok >= FREE_SHIPPING_THRESHOLD_NOK ? 0 : SHIPPING_FLAT_NOK;

  return {
    baseForgeFeeNok,
    materialCostNok: Math.round(totalMaterialCost),
    machineCostNok: Math.round(totalMachineCost),
    rawTotalNok: Number(rawTotal.toFixed(2)),
    finalPriceNok,
    shippingNok,
    timeMultiplier: qualitySpec.timeMultiplier,
    quantity: qty,
    unitPriceNok,
    batchSavingsNok,
    platesRequired,
  };
}

export class PricingEngine {
  static calculateModelPrice = calculateModelPrice;
}
