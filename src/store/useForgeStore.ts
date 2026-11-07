import { create } from 'zustand';
import {
  LAYER_QUALITY,
  MATERIALS,
  type CatalogModelDocument,
  type DimensionsMm,
  type FilamentMaterialCode,
  type GenerationJobDocument,
  type LayerQualityKey,
  type ParametricTemplateId,
  type PrintOrderDocument,
  type ScadParameterDef,
  type SliceQuoteDocument,
} from '@/lib/schemas/forge';
import { base64ToArrayBuffer, parseCadModelBuffer } from '@/lib/three/model-loader';
import {
  buildParametricModel,
  getDefaultParametricValues,
  PARAMETRIC_TEMPLATES,
} from '@/lib/three/parametric-engine';
import { parseScadParameters, SAMPLE_OPENSCAD_FILE_CONTENT } from '@/lib/three/scad-parser';

export type WizardStep = 1 | 2 | 3;

const INITIAL_JOB: GenerationJobDocument = {
  id: 'job_seed_bambu_mech_01',
  uid: 'dev-operator-01',
  prompt: 'Armert Hex-Mech Tårn (hex_mech_turret_v2.stl)',
  inputImageStoragePath: null,
  tripoTaskId: 'catalog_cat_stl_mech_turret',
  status: 'completed',
  glbStoragePath: 'catalog/cat_stl_mech_turret/hex_mech_turret_v2.stl',
  glbDownloadUrl: null,
  modelFileUrl: null,
  fileFormat: 'stl',
  stlBase64: null,
  scadSource: null,
  scadParameters: null,
  proceduralPreset: 'MECH_TURRET',
  parametricTemplateId: null,
  parametricParams: null,
  boundingBoxMm: { x: 92, y: 96, z: 120 },
  volumeCm3: 245.0,
  overhangRatio: 0.26,
  isManifold: true,
  errorMessage: null,
  createdAt: new Date().toISOString(),
};

const INITIAL_QUOTE: SliceQuoteDocument = {
  id: 'quote_seed_x1c_01',
  uid: 'dev-operator-01',
  jobId: INITIAL_JOB.id,
  targetDimensionsMm: { x: 92, y: 96, z: 120 },
  scaleFactor: 1,
  material: 'PLA_MATTE',
  colorHex: '#FF5500',
  layerQuality: '0.20mm',
  layerHeightMm: 0.2,
  infillPercent: 15,
  filamentGrams: 135,
  supportGrams: 16.2,
  printTimeSeconds: 9900,
  layerCount: 600,
  supportRequired: true,
  brimEnabled: true,
  isWithinBuildVolume: true,
  slicerEngine: 'deterministic-volume-sim',
  calculatedPriceNok: 349,
  pricingBreakdown: {
    baseForgeFeeNok: 129,
    materialCostNok: 122,
    machineCostNok: 96,
    rawTotalNok: 346.75,
    finalPriceNok: 349,
    shippingNok: 79,
    timeMultiplier: 1.0,
  },
  sliced3mfStoragePath: 'slices/dev-operator-01/quote_seed_x1c_01/plate_1.3mf',
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
};

interface ForgeState {
  // Guided User Journey Step (1: Create/Choose Model, 2: Size & Material, 3: Price & Order)
  currentStep: WizardStep;
  step1Mode: 'catalog' | 'parametric' | 'ai';

  // Curated STL / 3MF / SCAD Catalog
  catalogModels: CatalogModelDocument[];
  isLoadingCatalog: boolean;

  // Parametric CAD Customizer State (Built-in templates + OpenSCAD .scad files)
  parametricMode: 'scad' | 'template';
  parametricTemplateId: ParametricTemplateId;
  parametricParams: Record<string, number>;

  // OpenSCAD (.scad) File State
  scadFileName: string | null;
  scadSource: string | null;
  scadParameters: ScadParameterDef[];
  scadValues: Record<string, number>;
  isCompilingScad: boolean;
  scadAiModelTier: 'flash' | 'pro';
  lastScadAiModelUsed: string | null;

  // Active generation / catalog / parametric job
  activeJob: GenerationJobDocument;
  promptInput: string;
  referenceImageName: string | null;

  // Anti-spam quota state (Pay-Per-Model, no subscription)
  freeGenerationsRemaining: number;
  aiCreditNok: number;

  // Live 3D print parameters
  targetHeightMm: number;
  material: FilamentMaterialCode;
  colorHex: string;
  layerQuality: LayerQualityKey;
  infillPercent: number;

  // 3D viewport visual toggles
  wireframeMode: boolean;
  showBoundingBox: boolean;
  autoRotate: boolean;

  // Server-authoritative slice quote & order state
  activeQuote: SliceQuoteDocument;
  lastCreatedOrder: PrintOrderDocument | null;

  // Async flags
  isGenerating: boolean;
  isBuyingCredits: boolean;
  isSlicing: boolean;
  errorBanner: string | null;

  // Computed live dimensions in mm before server roundtrip finishes
  getComputedDimensionsMm: () => DimensionsMm;

  // Actions
  setCurrentStep: (step: WizardStep) => void;
  setStep1Mode: (mode: 'catalog' | 'parametric' | 'ai', uid?: string) => void;
  setParametricMode: (mode: 'scad' | 'template', uid?: string) => void;
  selectParametricTemplate: (templateId: ParametricTemplateId, uid: string) => void;
  setParametricParam: (key: string, value: number) => void;
  loadScadFile: (
    fileName: string,
    scadSource: string,
    uid: string,
    title?: string,
    precompiled?: {
      stlBase64?: string | null;
      modelFileUrl?: string | null;
      boundingBoxMm?: DimensionsMm;
      volumeCm3?: number;
      overhangRatio?: number;
    }
  ) => Promise<void>;
  setScadParamValue: (name: string, value: number) => void;
  setScadAiModelTier: (tier: 'flash' | 'pro') => void;
  compileActiveScad: (uid: string) => Promise<void>;
  generateScadFromPrompt: (prompt: string, uid: string) => Promise<void>;
  setPromptInput: (prompt: string) => void;
  setReferenceImageName: (name: string | null) => void;
  setTargetHeightMm: (heightMm: number) => void;
  setMaterial: (material: FilamentMaterialCode) => void;
  setColorHex: (colorHex: string) => void;
  setLayerQuality: (layerQuality: LayerQualityKey) => void;
  setInfillPercent: (infillPercent: number) => void;
  setUserQuota: (freeGenerationsRemaining: number, aiCreditNok: number) => void;
  toggleWireframeMode: () => void;
  toggleBoundingBox: () => void;
  toggleAutoRotate: () => void;
  clearErrorBanner: () => void;

  // Server Pipeline Actions
  fetchCatalogModels: () => Promise<void>;
  selectCatalogModel: (model: CatalogModelDocument, uid: string) => Promise<void>;
  generateModelFromPrompt: (uid: string) => Promise<void>;
  buyExtraAiGenerations: (uid: string) => Promise<void>;
  refreshSliceQuote: (uid: string) => Promise<void>;
  setLastCreatedOrder: (order: PrintOrderDocument | null) => void;
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  currentStep: 1,
  step1Mode: 'catalog',

  catalogModels: [],
  isLoadingCatalog: false,

  parametricMode: 'scad',
  parametricTemplateId: 'ORGANIZER_BOX',
  parametricParams: getDefaultParametricValues('ORGANIZER_BOX'),

  scadFileName: null,
  scadSource: null,
  scadParameters: [],
  scadValues: {},
  isCompilingScad: false,
  scadAiModelTier: 'flash',
  lastScadAiModelUsed: null,

  activeJob: INITIAL_JOB,
  promptInput: 'Armored industrial hex-mech turret with heavy cooling vents and mounting flange',
  referenceImageName: null,

  freeGenerationsRemaining: 3,
  aiCreditNok: 0,

  targetHeightMm: 120,
  material: 'PLA_MATTE',
  colorHex: '#FF5500',
  layerQuality: '0.20mm',
  infillPercent: 15,

  wireframeMode: false,
  showBoundingBox: true,
  autoRotate: true,

  activeQuote: INITIAL_QUOTE,
  lastCreatedOrder: null,

  isGenerating: false,
  isBuyingCredits: false,
  isSlicing: false,
  errorBanner: null,

  getComputedDimensionsMm: () => {
    const { activeJob, targetHeightMm } = get();
    if (
      (activeJob.parametricTemplateId || activeJob.scadSource) &&
      activeJob.boundingBoxMm.z === targetHeightMm
    ) {
      return activeJob.boundingBoxMm;
    }
    const base = activeJob.boundingBoxMm;
    const scale = targetHeightMm / base.z;
    return {
      x: Math.min(256, Math.max(1, Math.round(base.x * scale))),
      y: Math.min(256, Math.max(1, Math.round(base.y * scale))),
      z: Math.min(256, Math.max(1, Math.round(targetHeightMm))),
    };
  },

  setCurrentStep: (currentStep) => set({ currentStep }),

  setStep1Mode: (step1Mode, uid = 'dev-operator-01') => {
    set({ step1Mode });
    if (step1Mode === 'parametric') {
      const { activeJob, parametricMode, parametricTemplateId, scadSource } = get();
      if (parametricMode === 'scad' && !scadSource) {
        void get().loadScadFile(
          'parametric_flange_mount.scad',
          SAMPLE_OPENSCAD_FILE_CONTENT,
          uid,
          'Parametrisk Rør- og Monteringsflens'
        );
      } else if (
        !activeJob.parametricTemplateId &&
        !activeJob.scadSource &&
        parametricMode === 'template'
      ) {
        get().selectParametricTemplate(parametricTemplateId, uid);
      }
    }
  },

  setParametricMode: (parametricMode, uid = 'dev-operator-01') => {
    set({ parametricMode });
    if (parametricMode === 'template') {
      get().selectParametricTemplate(get().parametricTemplateId, uid);
    } else if (parametricMode === 'scad' && !get().scadSource) {
      void get().loadScadFile(
        'parametric_flange_mount.scad',
        SAMPLE_OPENSCAD_FILE_CONTENT,
        uid,
        'Parametrisk Rør- og Monteringsflens'
      );
    }
  },

  selectParametricTemplate: (templateId: ParametricTemplateId, uid: string) => {
    const spec = PARAMETRIC_TEMPLATES[templateId];
    const defaults = getDefaultParametricValues(templateId);
    const built = buildParametricModel(templateId, defaults);

    const job: GenerationJobDocument = {
      id: `job_param_${templateId.toLowerCase()}`,
      uid,
      prompt: `${spec.shortTitle} (${built.summarySpec})`,
      inputImageStoragePath: null,
      tripoTaskId: `parametric_${templateId}`,
      status: 'completed',
      glbStoragePath: `parametric/${templateId.toLowerCase()}/custom.stl`,
      glbDownloadUrl: null,
      modelFileUrl: null,
      fileFormat: 'stl',
      stlBase64: null,
      scadSource: null,
      scadParameters: null,
      proceduralPreset: 'INDUSTRIAL_BRACKET',
      parametricTemplateId: templateId,
      parametricParams: defaults,
      boundingBoxMm: built.boundingBoxMm,
      volumeCm3: built.volumeCm3,
      overhangRatio: built.overhangRatio,
      isManifold: true,
      errorMessage: null,
      createdAt: new Date().toISOString(),
    };

    set({
      parametricMode: 'template',
      parametricTemplateId: templateId,
      parametricParams: defaults,
      activeJob: job,
      targetHeightMm: built.boundingBoxMm.z,
      material: spec.recommendedMaterial,
      colorHex: spec.recommendedColorHex,
      lastCreatedOrder: null,
      errorBanner: null,
    });
  },

  setParametricParam: (key: string, value: number) => {
    const { parametricTemplateId, parametricParams, activeJob } = get();
    const activeTemplate = activeJob.parametricTemplateId || parametricTemplateId;
    const spec = PARAMETRIC_TEMPLATES[activeTemplate];
    const nextParams = { ...parametricParams, [key]: value };
    const built = buildParametricModel(activeTemplate, nextParams);

    set({
      parametricTemplateId: activeTemplate,
      parametricParams: nextParams,
      targetHeightMm: built.boundingBoxMm.z,
      activeJob: {
        ...activeJob,
        prompt: `${spec.shortTitle} (${built.summarySpec})`,
        parametricTemplateId: activeTemplate,
        parametricParams: nextParams,
        boundingBoxMm: built.boundingBoxMm,
        volumeCm3: built.volumeCm3,
        overhangRatio: built.overhangRatio,
      },
    });
  },

  loadScadFile: async (
    fileName: string,
    scadSource: string,
    uid: string,
    title?: string,
    precompiled?: {
      stlBase64?: string | null;
      modelFileUrl?: string | null;
      boundingBoxMm?: DimensionsMm;
      volumeCm3?: number;
      overhangRatio?: number;
    }
  ) => {
    const parsedParams = parseScadParameters(scadSource);
    const initialValues: Record<string, number> = {};
    for (const p of parsedParams) {
      initialValues[p.name] = p.defaultValue;
    }

    const displayTitle =
      title ||
      fileName
        .replace(/\.scad$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const hasPrecompiledMesh = Boolean(
      precompiled?.stlBase64 ||
      (precompiled?.modelFileUrl && !precompiled.modelFileUrl.toLowerCase().endsWith('.scad'))
    );

    const nextBoundingBox = precompiled?.boundingBoxMm ?? get().activeJob.boundingBoxMm;

    set({
      step1Mode: 'parametric',
      parametricMode: 'scad',
      scadFileName: fileName,
      scadSource,
      scadParameters: parsedParams,
      scadValues: initialValues,
      errorBanner: null,
      targetHeightMm: Math.min(250, Math.max(15, Math.round(nextBoundingBox.z))),
      activeJob: {
        ...get().activeJob,
        id: `job_scad_${fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
        uid,
        prompt: `${displayTitle} (${fileName})`,
        fileFormat: 'scad',
        stlBase64: hasPrecompiledMesh ? (precompiled?.stlBase64 ?? null) : null,
        modelFileUrl: hasPrecompiledMesh ? (precompiled?.modelFileUrl ?? null) : null,
        scadSource,
        scadParameters: parsedParams,
        parametricTemplateId: null,
        parametricParams: null,
        boundingBoxMm: nextBoundingBox,
        volumeCm3: precompiled?.volumeCm3 ?? get().activeJob.volumeCm3,
        overhangRatio: precompiled?.overhangRatio ?? get().activeJob.overhangRatio,
      },
    });

    if (hasPrecompiledMesh) {
      await get().refreshSliceQuote(uid);
    } else {
      await get().compileActiveScad(uid);
    }
  },

  setScadParamValue: (name: string, value: number) => {
    set((state) => ({
      scadValues: {
        ...state.scadValues,
        [name]: value,
      },
    }));
  },

  setScadAiModelTier: (scadAiModelTier: 'flash' | 'pro') => set({ scadAiModelTier }),

  compileActiveScad: async (uid: string) => {
    const { scadSource, scadParameters, scadValues, scadFileName, activeJob } = get();
    if (!scadSource) return;

    set({ isCompilingScad: true, errorBanner: null });

    try {
      // Only pass -D overrides for parameters that have been modified from their file default
      const modifiedParams: Record<string, number> = {};
      for (const def of scadParameters) {
        const currentVal = scadValues[def.name];
        if (currentVal !== undefined && currentVal !== def.defaultValue) {
          modifiedParams[def.name] = currentVal;
        }
      }

      const res = await fetch('/api/parametric/scad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scadSource,
          parameters: modifiedParams,
          fastPreview: true,
        }),
      });

      const data = (await res.json()) as {
        stlBase64?: string;
        message?: string;
      };

      if (!res.ok || !data.stlBase64) {
        throw new Error(data.message || 'Kunne ikke kompilere .scad-filen med OpenSCAD');
      }

      const stlBuffer = base64ToArrayBuffer(data.stlBase64);
      const analysis = parseCadModelBuffer(stlBuffer, 'stl');

      const paramSummary = Object.entries(modifiedParams)
        .slice(0, 4)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');

      const clampedHeight = Math.min(250, Math.max(15, Math.round(analysis.boundingBoxMm.z)));

      const updatedJob: GenerationJobDocument = {
        ...activeJob,
        uid,
        prompt: `${scadFileName || 'OpenSCAD'} (${paramSummary || `${analysis.boundingBoxMm.x}×${analysis.boundingBoxMm.y}×${analysis.boundingBoxMm.z}mm`})`,
        fileFormat: 'scad',
        stlBase64: data.stlBase64,
        modelFileUrl: null,
        scadSource,
        parametricTemplateId: null,
        boundingBoxMm: analysis.boundingBoxMm,
        volumeCm3: analysis.volumeCm3,
        overhangRatio: analysis.overhangRatio,
      };

      set({
        activeJob: updatedJob,
        targetHeightMm: clampedHeight,
        isCompilingScad: false,
      });

      await get().refreshSliceQuote(uid);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Feil under kompilering av .scad-fil';
      set({ isCompilingScad: false, errorBanner: message });
    }
  },

  generateScadFromPrompt: async (prompt: string, uid: string) => {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 3) {
      set({ errorBanner: 'Skriv inn en beskrivelse på minst 3 tegn for å generere .SCAD-fil.' });
      return;
    }

    set({ isGenerating: true, isCompilingScad: true, errorBanner: null, lastCreatedOrder: null });

    try {
      const res = await fetch('/api/parametric/scad/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          modelTier: get().scadAiModelTier,
        }),
      });

      const data = (await res.json()) as {
        title?: string;
        fileName?: string;
        scadSource?: string;
        stlBase64?: string;
        usedModel?: string;
        message?: string;
      };

      if (!res.ok || !data.scadSource || !data.stlBase64) {
        throw new Error(data.message || 'Kunne ikke AI-generere OpenSCAD-fil');
      }

      const stlBuffer = base64ToArrayBuffer(data.stlBase64);
      const analysis = parseCadModelBuffer(stlBuffer, 'stl');

      await get().loadScadFile(
        data.fileName || 'ai_generated_model.scad',
        data.scadSource,
        uid,
        data.title || 'AI-generert OpenSCAD-modell',
        {
          stlBase64: data.stlBase64,
          boundingBoxMm: analysis.boundingBoxMm,
          volumeCm3: analysis.volumeCm3,
          overhangRatio: analysis.overhangRatio,
        }
      );

      set({
        isGenerating: false,
        isCompilingScad: false,
        lastScadAiModelUsed: data.usedModel ?? null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Feil under AI-generering av .SCAD-fil';
      set({ isGenerating: false, isCompilingScad: false, errorBanner: message });
    }
  },

  setPromptInput: (promptInput) => set({ promptInput, errorBanner: null }),
  setReferenceImageName: (referenceImageName) => set({ referenceImageName }),
  setTargetHeightMm: (targetHeightMm) => set({ targetHeightMm }),

  setMaterial: (material) =>
    set((state) => {
      const allowedColors = MATERIALS[material].colors;
      const nextColor = allowedColors.includes(state.colorHex)
        ? state.colorHex
        : (allowedColors[0] ?? '#111111');
      return {
        material,
        colorHex: nextColor,
        activeQuote: {
          ...state.activeQuote,
          material,
          colorHex: nextColor,
        },
      };
    }),

  setColorHex: (colorHex) =>
    set((state) => ({
      colorHex,
      activeQuote: {
        ...state.activeQuote,
        colorHex,
      },
    })),

  setLayerQuality: (layerQuality) =>
    set((state) => ({
      layerQuality,
      activeQuote: {
        ...state.activeQuote,
        layerQuality,
        layerHeightMm: LAYER_QUALITY[layerQuality].layerHeightMm,
      },
    })),

  setInfillPercent: (infillPercent) => set({ infillPercent }),

  setUserQuota: (freeGenerationsRemaining, aiCreditNok) =>
    set({ freeGenerationsRemaining, aiCreditNok }),

  toggleWireframeMode: () => set((s) => ({ wireframeMode: !s.wireframeMode })),
  toggleBoundingBox: () => set((s) => ({ showBoundingBox: !s.showBoundingBox })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  clearErrorBanner: () => set({ errorBanner: null }),
  setLastCreatedOrder: (lastCreatedOrder) => set({ lastCreatedOrder }),

  fetchCatalogModels: async () => {
    set({ isLoadingCatalog: true });
    try {
      const res = await fetch('/api/catalog');
      const data = (await res.json()) as { models?: CatalogModelDocument[] };
      if (data.models) {
        set({ catalogModels: data.models });
      }
    } finally {
      set({ isLoadingCatalog: false });
    }
  },

  selectCatalogModel: async (model: CatalogModelDocument, uid: string) => {
    // If the catalog model is an OpenSCAD (.scad) parametric file, open it in the SCAD customizer!
    if (
      model.fileFormat === 'scad' ||
      Boolean(model.scadSource) ||
      Boolean(model.modelFileUrl && model.modelFileUrl.toLowerCase().endsWith('.scad'))
    ) {
      set({
        material: model.defaultMaterial,
        colorHex: model.defaultColorHex,
        step1Mode: 'parametric',
        parametricMode: 'scad',
        currentStep: 1,
      });

      let resolvedSource = model.scadSource;
      if (!resolvedSource && model.modelFileUrl) {
        try {
          const scadRes = await fetch(model.modelFileUrl);
          if (scadRes.ok) {
            resolvedSource = await scadRes.text();
          }
        } catch {
          // ignore fetch error
        }
      }

      if (resolvedSource) {
        await get().loadScadFile(model.fileName, resolvedSource, uid, model.title, {
          stlBase64: model.stlBase64,
          modelFileUrl: model.modelFileUrl,
          boundingBoxMm: model.boundingBoxMm,
          volumeCm3: model.volumeCm3,
          overhangRatio: model.overhangRatio,
        });
        return;
      }
    }

    const hasParametric = Boolean(model.parametricTemplateId);
    const paramTemplate = model.parametricTemplateId ?? null;
    const paramValues =
      paramTemplate && model.parametricParams
        ? model.parametricParams
        : paramTemplate
          ? getDefaultParametricValues(paramTemplate)
          : null;

    const jobFromCatalog: GenerationJobDocument = {
      id: `job_${model.id}`,
      uid,
      prompt: `${model.title} (${model.fileName})`,
      inputImageStoragePath: null,
      tripoTaskId: `catalog_${model.id}`,
      status: 'completed',
      glbStoragePath: model.fileStoragePath,
      glbDownloadUrl: model.modelFileUrl ?? null,
      modelFileUrl: model.modelFileUrl ?? null,
      fileFormat: model.fileFormat,
      stlBase64: model.stlBase64,
      scadSource: model.scadSource ?? null,
      scadParameters: model.scadParameters ?? null,
      proceduralPreset: model.proceduralPreset,
      parametricTemplateId: paramTemplate,
      parametricParams: paramValues,
      boundingBoxMm: model.boundingBoxMm,
      volumeCm3: model.volumeCm3,
      overhangRatio: model.overhangRatio,
      isManifold: true,
      errorMessage: null,
      createdAt: model.createdAt,
    };

    const clampedHeight = Math.min(250, Math.max(15, Math.round(model.boundingBoxMm.z)));

    set({
      activeJob: jobFromCatalog,
      ...(hasParametric && paramTemplate && paramValues
        ? {
            parametricMode: 'template',
            parametricTemplateId: paramTemplate,
            parametricParams: paramValues,
          }
        : {}),
      targetHeightMm: clampedHeight,
      material: model.defaultMaterial,
      colorHex: model.defaultColorHex,
      lastCreatedOrder: null,
      errorBanner: null,
      currentStep: 2,
    });

    await get().refreshSliceQuote(uid);
  },

  generateModelFromPrompt: async (uid: string) => {
    const { promptInput, referenceImageName } = get();
    if (promptInput.trim().length < 3) {
      set({ errorBanner: 'Skriv inn en beskrivelse på minst 3 tegn for å generere 3D-modell.' });
      return;
    }

    set({ isGenerating: true, errorBanner: null, lastCreatedOrder: null });

    try {
      const response = await fetch('/api/jobs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate',
          uid,
          prompt: promptInput.trim(),
          inputImageStoragePath: referenceImageName
            ? `uploads/${uid}/ref_${Date.now()}_${referenceImageName}`
            : null,
        }),
      });

      const data = (await response.json()) as {
        job?: GenerationJobDocument;
        userQuota?: { freeGenerationsRemaining: number; aiCreditNok: number };
        message?: string;
      };

      if (data.userQuota) {
        set({
          freeGenerationsRemaining: data.userQuota.freeGenerationsRemaining,
          aiCreditNok: data.userQuota.aiCreditNok,
        });
      }

      if (!response.ok || !data.job) {
        throw new Error(data.message || 'Kunne ikke generere 3D-modell fra Tripo API');
      }

      set({
        activeJob: data.job,
        isGenerating: false,
        currentStep: 2,
      });

      await get().refreshSliceQuote(uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Feil ved 3D-generering';
      set({ isGenerating: false, errorBanner: message });
    }
  },

  buyExtraAiGenerations: async (uid: string) => {
    set({ isBuyingCredits: true, errorBanner: null });
    try {
      const response = await fetch('/api/jobs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buy_extra_credits',
          uid,
          prompt: 'buy_extra_credits',
        }),
      });

      const data = (await response.json()) as {
        userQuota?: { freeGenerationsRemaining: number; aiCreditNok: number };
        message?: string;
      };

      if (!response.ok || !data.userQuota) {
        throw new Error(data.message || 'Kunne ikke kjøpe ekstra AI-forsøk');
      }

      set({
        freeGenerationsRemaining: data.userQuota.freeGenerationsRemaining,
        aiCreditNok: data.userQuota.aiCreditNok,
        isBuyingCredits: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Feil ved kjøp av AI-forsøk';
      set({ isBuyingCredits: false, errorBanner: message });
    }
  },

  refreshSliceQuote: async (uid: string) => {
    const { activeJob, targetHeightMm, material, colorHex, layerQuality, infillPercent } = get();
    set({ isSlicing: true, errorBanner: null });

    try {
      const response = await fetch('/api/quotes/slice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          jobId: activeJob.id,
          targetHeightMm: Math.min(250, Math.max(15, targetHeightMm)),
          material,
          colorHex,
          layerQuality,
          infillPercent,
          ...(activeJob.parametricTemplateId || activeJob.scadSource
            ? {
                overrideBoundingBoxMm: activeJob.boundingBoxMm,
                overrideVolumeCm3: activeJob.volumeCm3,
                overrideOverhangRatio: activeJob.overhangRatio,
                overridePrompt: activeJob.prompt,
                parametricTemplateId: activeJob.parametricTemplateId,
                parametricParams: activeJob.parametricParams,
              }
            : {}),
        }),
      });

      const data = (await response.json()) as {
        quote?: SliceQuoteDocument;
        message?: string;
      };

      if (!response.ok || !data.quote) {
        throw new Error(data.message || 'Kunne ikke beregne slicing og pris');
      }

      set({ activeQuote: data.quote, isSlicing: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Feil under slicing';
      set({ isSlicing: false, errorBanner: message });
    }
  },
}));
