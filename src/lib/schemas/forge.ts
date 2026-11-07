import { z } from 'zod';

// ============================================================================
// CONSTANTS & INDUSTRIAL CATALOG (BAMBU LAB BUILD VOLUME: 256 x 256 x 256 mm)
// ============================================================================

export const BAMBU_BUILD_VOLUME_MM = {
  x: 256,
  y: 256,
  z: 256,
} as const;

export const FilamentMaterialCodeSchema = z.enum(['PLA_MATTE', 'PETG_INDUSTRIAL', 'PAHT_CF']);

export type FilamentMaterialCode = z.infer<typeof FilamentMaterialCodeSchema>;

export const LayerQualityKeySchema = z.enum(['0.20mm', '0.12mm']);
export type LayerQualityKey = z.infer<typeof LayerQualityKeySchema>;

export const LayerHeightMmSchema = z.union([z.literal(0.2), z.literal(0.12)]);
export type LayerHeightMm = z.infer<typeof LayerHeightMmSchema>;

export interface MaterialSpecification {
  code: FilamentMaterialCode;
  label: string;
  shortLabel: string;
  pricePerGram: number;
  colors: readonly string[];
  colorNames: Record<string, string>;
  densityGPerCm3: number;
  nozzleTempC: number;
  bedTempC: number;
  roughness: number;
  metalness: number;
}

export const MATERIALS: Record<FilamentMaterialCode, MaterialSpecification> = {
  PLA_MATTE: {
    code: 'PLA_MATTE',
    label: 'PLA MATTE (STANDARD)',
    shortLabel: 'PLA',
    pricePerGram: 0.9,
    colors: ['#111111', '#FF5500', '#F4F0EA', '#00E575'],
    colorNames: {
      '#111111': 'Kullsort (#111111)',
      '#FF5500': 'Forge Orange (#FF5500)',
      '#F4F0EA': 'Råhvit / Krem (#F4F0EA)',
      '#00E575': 'Bambu Green (#00E575)',
    },
    densityGPerCm3: 1.24,
    nozzleTempC: 220,
    bedTempC: 55,
    roughness: 0.72,
    metalness: 0.08,
  },
  PETG_INDUSTRIAL: {
    code: 'PETG_INDUSTRIAL',
    label: 'PETG (EKSTRA STERK)',
    shortLabel: 'PETG',
    pricePerGram: 1.2,
    colors: ['#111111', '#555555', '#FF5500'],
    colorNames: {
      '#111111': 'Kullsort (#111111)',
      '#555555': 'Industriell Grå (#555555)',
      '#FF5500': 'Sikkerhetsoransje (#FF5500)',
    },
    densityGPerCm3: 1.27,
    nozzleTempC: 245,
    bedTempC: 70,
    roughness: 0.36,
    metalness: 0.16,
  },
  PAHT_CF: {
    code: 'PAHT_CF',
    label: 'CARBON FIBER (PAHT-CF)',
    shortLabel: 'PAHT-CF',
    pricePerGram: 2.5,
    colors: ['#111111'],
    colorNames: {
      '#111111': 'Karbonmatt Sort (#111111)',
    },
    densityGPerCm3: 1.18,
    nozzleTempC: 290,
    bedTempC: 100,
    roughness: 0.88,
    metalness: 0.28,
  },
};

export const LAYER_QUALITY: Record<
  LayerQualityKey,
  { label: string; layerHeightMm: LayerHeightMm; timeMultiplier: number }
> = {
  '0.20mm': {
    label: '0.20mm STANDARD',
    layerHeightMm: 0.2,
    timeMultiplier: 1.0,
  },
  '0.12mm': {
    label: '0.12mm HIGH DETAIL',
    layerHeightMm: 0.12,
    timeMultiplier: 1.15,
  },
};

export const ProceduralPresetSchema = z.enum([
  'MECH_TURRET',
  'PLANETARY_GEAR',
  'CYBER_HELMET',
  'INDUSTRIAL_BRACKET',
]);
export type ProceduralPreset = z.infer<typeof ProceduralPresetSchema>;

export const ParametricTemplateIdSchema = z.enum([
  'ORGANIZER_BOX',
  'L_BRACKET',
  'DESK_CLAMP',
  'PIPE_MOUNT',
]);
export type ParametricTemplateId = z.infer<typeof ParametricTemplateIdSchema>;

export const ParametricParamsSchema = z.record(z.string(), z.number());
export type ParametricParams = z.infer<typeof ParametricParamsSchema>;

// ============================================================================
// GEOMETRY & BOUNDING BOX SCHEMAS
// ============================================================================

export const DimensionsMmSchema = z.object({
  x: z.number().min(1).max(BAMBU_BUILD_VOLUME_MM.x),
  y: z.number().min(1).max(BAMBU_BUILD_VOLUME_MM.y),
  z: z.number().min(1).max(BAMBU_BUILD_VOLUME_MM.z),
});

export type DimensionsMm = z.infer<typeof DimensionsMmSchema>;

// ============================================================================
// 1. FIRESTORE COLLECTION: users/{uid}
// ============================================================================

export const UserRoleSchema = z.enum(['customer', 'admin']);

export const UserDocumentSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: UserRoleSchema.default('customer'),
  freeGenerationsRemaining: z.number().int().nonnegative().default(3),
  aiCreditNok: z.number().nonnegative().default(0),
  createdAt: z.string().datetime(),
});

export type UserDocument = z.infer<typeof UserDocumentSchema>;

// ============================================================================
// 2. FIRESTORE COLLECTION: catalog_models/{modelId} (Admin STL / 3MF / SCAD Library)
// ============================================================================

export const CatalogFileFormatSchema = z.enum(['stl', '3mf', 'scad']);
export type CatalogFileFormat = z.infer<typeof CatalogFileFormatSchema>;

export const ScadParameterOptionSchema = z.object({
  label: z.string(),
  value: z.number(),
});

export const ScadParameterDefSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  group: z.string().default('Parametere'),
  defaultValue: z.number(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  unit: z.string().default('mm'),
  options: z.array(ScadParameterOptionSchema).optional(),
});

export type ScadParameterDef = z.infer<typeof ScadParameterDefSchema>;

export const CatalogModelDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(120),
  description: z.string().min(3).max(400),
  category: z.string().min(2).max(60).default('Eksempelmodell'),
  fileName: z.string().min(1),
  fileFormat: CatalogFileFormatSchema,
  fileStoragePath: z.string().min(1),
  modelFileUrl: z.string().nullable().optional().default(null),
  stlBase64: z.string().nullable().default(null),
  scadSource: z.string().nullable().optional().default(null),
  scadParameters: z.array(ScadParameterDefSchema).nullable().optional().default(null),
  proceduralPreset: ProceduralPresetSchema.default('MECH_TURRET'),
  parametricTemplateId: ParametricTemplateIdSchema.nullable().optional().default(null),
  parametricParams: ParametricParamsSchema.nullable().optional().default(null),
  boundingBoxMm: DimensionsMmSchema,
  volumeCm3: z.number().positive(),
  overhangRatio: z.number().min(0).max(1).default(0.18),
  defaultMaterial: FilamentMaterialCodeSchema.default('PLA_MATTE'),
  defaultColorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#111111'),
  createdAt: z.string().datetime(),
});

export type CatalogModelDocument = z.infer<typeof CatalogModelDocumentSchema>;

export const CreateCatalogModelRequestSchema = z.object({
  title: z.string().min(2, 'Tittel må ha minst 2 tegn').max(120),
  description: z.string().min(3, 'Beskrivelse må ha minst 3 tegn').max(400),
  category: z.string().min(2).max(60).default('Katalog'),
  fileName: z.string().min(1),
  fileFormat: CatalogFileFormatSchema,
  modelFileUrl: z.string().nullable().optional(),
  stlBase64: z.string().nullable().optional(),
  scadSource: z.string().nullable().optional(),
  scadParameters: z.array(ScadParameterDefSchema).nullable().optional(),
  proceduralPreset: ProceduralPresetSchema.optional(),
  parametricTemplateId: ParametricTemplateIdSchema.nullable().optional(),
  parametricParams: ParametricParamsSchema.nullable().optional(),
  boundingBoxMm: DimensionsMmSchema,
  volumeCm3: z.number().positive(),
  overhangRatio: z.number().min(0).max(1).default(0.18),
  defaultMaterial: FilamentMaterialCodeSchema.default('PLA_MATTE'),
  defaultColorHex: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#111111'),
});

export type CreateCatalogModelRequest = z.infer<typeof CreateCatalogModelRequestSchema>;

// ============================================================================
// 3. FIRESTORE COLLECTION: generation_jobs/{jobId}
// ============================================================================

export const GenerationJobStatusSchema = z.enum(['queued', 'generating', 'completed', 'failed']);

export type GenerationJobStatus = z.infer<typeof GenerationJobStatusSchema>;

export const GenerationJobDocumentSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  prompt: z.string().min(2).max(600),
  inputImageStoragePath: z.string().nullable().default(null),
  tripoTaskId: z.string(),
  status: GenerationJobStatusSchema,
  glbStoragePath: z.string().nullable().default(null),
  glbDownloadUrl: z.string().nullable().default(null),
  modelFileUrl: z.string().nullable().optional().default(null),
  fileFormat: CatalogFileFormatSchema.nullable().optional().default(null),
  stlBase64: z.string().nullable().optional().default(null),
  scadSource: z.string().nullable().optional().default(null),
  scadParameters: z.array(ScadParameterDefSchema).nullable().optional().default(null),
  proceduralPreset: ProceduralPresetSchema.default('MECH_TURRET'),
  parametricTemplateId: ParametricTemplateIdSchema.nullable().optional().default(null),
  parametricParams: ParametricParamsSchema.nullable().optional().default(null),
  boundingBoxMm: DimensionsMmSchema,
  volumeCm3: z.number().positive(),
  overhangRatio: z.number().min(0).max(1),
  isManifold: z.boolean().default(true),
  errorMessage: z.string().nullable().default(null),
  createdAt: z.string().datetime(),
});

export type GenerationJobDocument = z.infer<typeof GenerationJobDocumentSchema>;

// ============================================================================
// 4. FIRESTORE COLLECTION: slice_quotes/{quoteId}
// ============================================================================

export const PricingBreakdownSchema = z.object({
  baseForgeFeeNok: z.number().nonnegative(),
  materialCostNok: z.number().nonnegative(),
  machineCostNok: z.number().nonnegative(),
  rawTotalNok: z.number().positive(),
  finalPriceNok: z.number().positive(),
  shippingNok: z.number().nonnegative(),
  timeMultiplier: z.number().positive(),
});

export type PricingBreakdown = z.infer<typeof PricingBreakdownSchema>;

export const SliceQuoteDocumentSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  jobId: z.string().min(1),
  targetDimensionsMm: DimensionsMmSchema,
  scaleFactor: z.number().positive(),
  material: FilamentMaterialCodeSchema,
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  layerQuality: LayerQualityKeySchema,
  layerHeightMm: LayerHeightMmSchema,
  infillPercent: z.number().int().min(10).max(100).default(15),
  filamentGrams: z.number().positive(),
  supportGrams: z.number().nonnegative(),
  printTimeSeconds: z.number().int().positive(),
  layerCount: z.number().int().positive(),
  supportRequired: z.boolean(),
  brimEnabled: z.boolean().default(true),
  isWithinBuildVolume: z.boolean(),
  slicerEngine: z.enum(['bambu-studio-cli', 'deterministic-volume-sim']),
  calculatedPriceNok: z.number().positive(),
  pricingBreakdown: PricingBreakdownSchema,
  sliced3mfStoragePath: z.string(),
  expiresAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});

export type SliceQuoteDocument = z.infer<typeof SliceQuoteDocumentSchema>;

// ============================================================================
// 5. FIRESTORE COLLECTION: print_orders/{orderId} (IMMUTABLE SNAPSHOT)
// ============================================================================

export const OrderStatusSchema = z.enum([
  'pending_review',
  'slicing_verified',
  'printing_on_bambu',
  'shipped',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const ShippingAddressSchema = z.object({
  fullName: z.string().min(2, 'Fullt navn må fylles ut').max(100),
  email: z.string().email('Ugyldig e-postadresse'),
  streetAddress: z.string().min(4, 'Gateadresse må fylles ut').max(300),
  postalCode: z.string().min(4, 'Postnummer må være minst 4 tegn').max(12),
  city: z.string().min(2, 'Poststed må fylles ut').max(100),
  country: z.string().default('Norge'),
});

export type ShippingAddress = z.infer<typeof ShippingAddressSchema>;

export const ImmutableQuoteSnapshotSchema = z.object({
  quoteId: z.string(),
  jobId: z.string(),
  prompt: z.string(),
  glbStoragePath: z.string().nullable(),
  glbDownloadUrl: z.string().nullable(),
  proceduralPreset: ProceduralPresetSchema,
  sliced3mfStoragePath: z.string(),
  targetDimensionsMm: DimensionsMmSchema,
  material: FilamentMaterialCodeSchema,
  materialLabel: z.string(),
  colorHex: z.string(),
  layerQuality: LayerQualityKeySchema,
  layerHeightMm: LayerHeightMmSchema,
  filamentGrams: z.number(),
  supportGrams: z.number(),
  printTimeSeconds: z.number(),
  layerCount: z.number(),
  supportRequired: z.boolean(),
  calculatedPriceNok: z.number(),
  aiCreditAppliedNok: z.number().nonnegative().default(0),
  shippingNok: z.number().nonnegative(),
  totalChargedNok: z.number().positive(),
  pricingBreakdown: PricingBreakdownSchema,
});

export type ImmutableQuoteSnapshot = z.infer<typeof ImmutableQuoteSnapshotSchema>;

export const PrintOrderDocumentSchema = z.object({
  id: z.string().min(1),
  uid: z.string().min(1),
  quoteSnapshot: ImmutableQuoteSnapshotSchema,
  shippingAddress: ShippingAddressSchema,
  orderStatus: OrderStatusSchema,
  bambuPrinterId: z.string(),
  createdAt: z.string().datetime(),
});

export type PrintOrderDocument = z.infer<typeof PrintOrderDocumentSchema>;

// ============================================================================
// API REQUEST & RESPONSE PAYLOAD SCHEMAS
// ============================================================================

export const GenerateJobRequestSchema = z.object({
  uid: z.string().min(1).default('dev-operator-01'),
  prompt: z
    .string()
    .min(3, 'Beskriv 3D-modellen med minst 3 tegn')
    .max(600, 'Prompt kan ikke overstige 600 tegn'),
  inputImageStoragePath: z.string().nullable().optional(),
  action: z.enum(['generate', 'buy_extra_credits']).default('generate'),
});

export type GenerateJobRequest = z.infer<typeof GenerateJobRequestSchema>;

export const SliceQuoteRequestSchema = z.object({
  uid: z.string().min(1).default('dev-operator-01'),
  jobId: z.string().min(1),
  targetHeightMm: z
    .number()
    .min(15, 'Minimum høyde er 15 mm')
    .max(250, 'Maksimum høyde på Bambu X1C er 250 mm (256 mm plate)'),
  material: FilamentMaterialCodeSchema,
  colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  layerQuality: LayerQualityKeySchema,
  infillPercent: z.number().int().min(10).max(100).default(15),
  overrideBoundingBoxMm: DimensionsMmSchema.optional(),
  overrideVolumeCm3: z.number().positive().optional(),
  overrideOverhangRatio: z.number().min(0).max(1).optional(),
  overridePrompt: z.string().min(2).max(600).optional(),
  parametricTemplateId: ParametricTemplateIdSchema.nullable().optional(),
  parametricParams: ParametricParamsSchema.nullable().optional(),
});

export type SliceQuoteRequest = z.infer<typeof SliceQuoteRequestSchema>;

export const CreateOrderRequestSchema = z.object({
  uid: z.string().min(1),
  quoteId: z.string().min(1),
  shippingAddress: ShippingAddressSchema,
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
