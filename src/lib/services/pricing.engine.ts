import {
  LAYER_QUALITY,
  MATERIALS,
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
}

/**
 * Deterministic Pay-Per-Model price calculation on the server.
 * Formula:
 * 1. materialCost = filamentGrams * material.pricePerGram
 * 2. machineCost = (printTimeSeconds / 3600) * MACHINE_HOUR_RATE_NOK * quality.timeMultiplier
 * 3. rawTotal = BASE_FORGE_FEE_NOK + materialCost + machineCost
 * 4. finalPriceNok = Math.ceil(rawTotal / 10) * 10 - 1 (Always ends in 9, e.g. 219 kr, 349 kr, 689 kr)
 */
export function calculateModelPrice(input: CalculateModelPriceInput): PricingBreakdown {
  const matSpec = MATERIALS[input.material];
  const qualitySpec = LAYER_QUALITY[input.layerQuality];

  const materialCost = input.filamentGrams * matSpec.pricePerGram;
  const machineCost =
    (input.printTimeSeconds / 3600) * MACHINE_HOUR_RATE_NOK * qualitySpec.timeMultiplier;
  const rawTotal = BASE_FORGE_FEE_NOK + materialCost + machineCost;
  const finalPriceNok = Math.ceil(rawTotal / 10) * 10 - 1;
  const shippingNok = finalPriceNok >= FREE_SHIPPING_THRESHOLD_NOK ? 0 : SHIPPING_FLAT_NOK;

  return {
    baseForgeFeeNok: BASE_FORGE_FEE_NOK,
    materialCostNok: Math.round(materialCost),
    machineCostNok: Math.round(machineCost),
    rawTotalNok: Number(rawTotal.toFixed(2)),
    finalPriceNok,
    shippingNok,
    timeMultiplier: qualitySpec.timeMultiplier,
  };
}

export class PricingEngine {
  static calculateModelPrice = calculateModelPrice;
}
