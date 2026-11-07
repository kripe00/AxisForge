'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  Code2,
  Download,
  FileBox,
  FileCode2,
  ImagePlus,
  PlusCircle,
  RefreshCw,
  Ruler,
  Sliders,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  LAYER_QUALITY,
  MATERIALS,
  type FilamentMaterialCode,
  type LayerQualityKey,
  type ParametricTemplateId,
} from '@/lib/schemas/forge';
import { base64ToArrayBuffer } from '@/lib/three/model-loader';
import {
  exportParametricModelToStlBuffer,
  PARAMETRIC_TEMPLATES,
} from '@/lib/three/parametric-engine';
import { SAMPLE_OPENSCAD_FILE_CONTENT } from '@/lib/three/scad-parser';
import { useForgeStore } from '@/store/useForgeStore';
import { useAuth } from '@/components/providers/AuthProvider';
import { SpecSheetCard } from '@/components/forge/SpecSheetCard';

const PROMPT_PRESETS = [
  {
    label: 'Mekanisk Tårn (Turret)',
    prompt: 'Armored industrial hex-mech turret with heavy cooling vents and mounting flange',
  },
  {
    label: 'Tannhjul-gir (Planetary Gear)',
    prompt: 'High-torque planetary gear reducer assembly with spur teeth and hex shaft',
  },
  {
    label: 'Sci-Fi Hjelm (Cyber Helmet)',
    prompt: 'Tactical hard-surface cybernetic helmet bust with angled visor and vents',
  },
  {
    label: 'Motorfeste (Brakett)',
    prompt: 'Reinforced NEMA-23 industrial mounting bracket with gusset ribs and bolt slots',
  },
] as const;

const SCAD_AI_PRESETS = [
  {
    label: 'Vinkelbrakett 80×65 mm (M5)',
    prompt: 'Forsterket vinkelbrakett 80x65x42 mm med avstivningsribber og M5 skruehull',
  },
  {
    label: 'Tannhjul 24T (Ø8 aksel)',
    prompt: 'Parametrisk tannhjul med 24 tenner, 12 mm tykkelse og 8 mm senterhull',
  },
  {
    label: 'Rørklemme Ø32 mm',
    prompt: 'Rørklemme med diameter 32 mm, 24 mm bredde og festeører med M4 hull',
  },
  {
    label: 'Boks 120×80×45 mm',
    prompt: 'Oppbevaringsboks 120x80x45 mm med 3 mm veggtykkelse og skillevegger',
  },
] as const;

const SIZE_PRESETS = [
  {
    id: 'SMALL',
    label: 'Liten (6 cm)',
    desc: 'Bordfigur / nøkkelring',
    heightMm: 60,
    priceHint: '~199 kr',
  },
  {
    id: 'MEDIUM',
    label: 'Middels (12 cm)',
    desc: 'Mest populær størrelse',
    heightMm: 120,
    priceHint: '~349 kr',
  },
  {
    id: 'LARGE',
    label: 'Stor (22 cm)',
    desc: 'Stor modell / utstilling',
    heightMm: 220,
    priceHint: '~749 kr',
  },
] as const;

const MATERIAL_FRIENDLY_DESC: Record<
  FilamentMaterialCode,
  { friendlyTitle: string; friendlySub: string; badge: string }
> = {
  PLA_MATTE: {
    friendlyTitle: 'Standard Matt Plast (PLA)',
    friendlySub: 'Perfekt til figurer, pynt, prototyper og vanlige bruksgjenstander.',
    badge: 'Anbefalt',
  },
  PETG_INDUSTRIAL: {
    friendlyTitle: 'Ekstra Slitesterk (PETG)',
    friendlySub: 'Tåler utendørs bruk, varme og mekanisk belastning uten å knekke.',
    badge: 'Slitesterk',
  },
  PAHT_CF: {
    friendlyTitle: 'Karbonfiber-forsterket (PAHT-CF)',
    friendlySub: 'Industriell styrke og stivhet for krevende tekniske maskindeler.',
    badge: 'Proff',
  },
};

const PARAMETRIC_TEMPLATE_KEYS = Object.keys(PARAMETRIC_TEMPLATES) as ParametricTemplateId[];

export function PromptPanel() {
  const { user } = useAuth();
  const uid = user?.uid || 'dev-operator-01';

  const {
    currentStep,
    setCurrentStep,
    step1Mode,
    setStep1Mode,
    catalogModels,
    isLoadingCatalog,
    fetchCatalogModels,
    selectCatalogModel,
    parametricMode,
    setParametricMode,
    parametricTemplateId,
    parametricParams,
    selectParametricTemplate,
    setParametricParam,
    scadFileName,
    scadSource,
    scadParameters,
    scadValues,
    isCompilingScad,
    scadAiModelTier,
    setScadAiModelTier,
    loadScadFile,
    setScadParamValue,
    compileActiveScad,
    generateScadFromPrompt,
    activeJob,
    activeQuote,
    promptInput,
    referenceImageName,
    freeGenerationsRemaining,
    aiCreditNok,
    targetHeightMm,
    material,
    colorHex,
    layerQuality,
    infillPercent,
    isGenerating,
    isBuyingCredits,
    setPromptInput,
    setReferenceImageName,
    setTargetHeightMm,
    setMaterial,
    setColorHex,
    setLayerQuality,
    setInfillPercent,
    generateModelFromPrompt,
    buyExtraAiGenerations,
    refreshSliceQuote,
    getComputedDimensionsMm,
  } = useForgeStore();

  const [aiOutputFormat, setAiOutputFormat] = useState<'scad' | 'mesh'>('scad');
  const [scadAiPrompt, setScadAiPrompt] = useState(
    'Forsterket vinkelbrakett 85x65x40 mm med avstivningsribber og M5 skruehull'
  );
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scadCompileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentMaterialSpec = MATERIALS[material];
  const liveDims = getComputedDimensionsMm();
  const activeParametricSpec = PARAMETRIC_TEMPLATES[parametricTemplateId];

  useEffect(() => {
    void fetchCatalogModels();
  }, [fetchCatalogModels]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      void refreshSliceQuote(uid);
    }, 180);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [
    targetHeightMm,
    material,
    colorHex,
    layerQuality,
    infillPercent,
    parametricTemplateId,
    parametricParams,
    uid,
    refreshSliceQuote,
  ]);

  const handleScadParamChange = (paramName: string, nextValue: number) => {
    setScadParamValue(paramName, nextValue);
    if (scadCompileTimerRef.current) {
      clearTimeout(scadCompileTimerRef.current);
    }
    scadCompileTimerRef.current = setTimeout(() => {
      void compileActiveScad(uid);
    }, 380);
  };

  const handleScadFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';
    await loadScadFile(file.name, text, uid);
  };

  const handleGenerateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (aiOutputFormat === 'scad') {
      void generateScadFromPrompt(promptInput, uid);
    } else {
      void generateModelFromPrompt(uid);
    }
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (aiOutputFormat === 'scad') {
        void generateScadFromPrompt(promptInput, uid);
      } else {
        void generateModelFromPrompt(uid);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setReferenceImageName(file ? file.name : null);
  };

  const handleDownloadScadSource = () => {
    if (!scadSource) return;

    // Bake current slider values into the exported .scad file so downloaded .scad has updated defaults
    let updatedScad = scadSource;
    for (const param of scadParameters) {
      const val = scadValues[param.name];
      if (val !== undefined && val !== param.defaultValue) {
        const assignRegex = new RegExp(`(^\\s*${param.name}\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)`, 'm');
        updatedScad = updatedScad.replace(assignRegex, `$1${val}`);
      }
    }

    const blob = new Blob([updatedScad], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = scadFileName?.endsWith('.scad')
      ? scadFileName
      : `${scadFileName || 'axisforge_parametric'}.scad`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadParametricStl = () => {
    let stlBuffer: ArrayBuffer;
    let downloadName = `axisforge_${parametricTemplateId.toLowerCase()}.stl`;

    if (parametricMode === 'scad' && activeJob.stlBase64) {
      stlBuffer = base64ToArrayBuffer(activeJob.stlBase64);
      downloadName = (scadFileName || 'openscad_model').replace(/\.scad$/i, '') + '.stl';
    } else {
      stlBuffer = exportParametricModelToStlBuffer(parametricTemplateId, parametricParams);
    }

    const blob = new Blob([stlBuffer], { type: 'model/stl' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* =====================================================================
          STEG 1: VELG FERDIG MODELL, PARAMETRISK (.SCAD / MAL) ELLER AI
         ===================================================================== */}
      {currentStep === 1 && (
        <section
          aria-labelledby="step-1-heading"
          className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-nordic"
        >
          <div className="mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4F00]/10 px-3 py-1 font-mono text-xs font-semibold text-[#FF4F00]">
              Steg 1 av 3
            </span>
            <h2
              id="step-1-heading"
              className="mt-2.5 font-display text-xl font-bold tracking-tight text-zinc-900"
            >
              Velg katalogmodell, parametrisk fil (.SCAD) eller AI
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Velg fra katalogen, last opp eller tilpass en parametrisk OpenSCAD-fil (
              <code className="font-mono">.scad</code>), eller generer med AI.
            </p>
          </div>

          {/* 3-Tab Mode Switcher: Catalog vs Parametric vs AI Generator */}
          <div className="mb-5 grid grid-cols-3 rounded-xl bg-[#EFEFEB] p-1">
            <button
              type="button"
              onClick={() => setStep1Mode('catalog', uid)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                step1Mode === 'catalog'
                  ? 'bg-white text-zinc-900 shadow-nordic-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FileBox className="h-3.5 w-3.5 text-[#FF4F00]" />
              <span>Katalog ({catalogModels.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStep1Mode('parametric', uid)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                step1Mode === 'parametric'
                  ? 'bg-white text-zinc-900 shadow-nordic-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-[#FF4F00]" />
              <span>Parametrisk (.SCAD)</span>
            </button>
            <button
              type="button"
              onClick={() => setStep1Mode('ai', uid)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition-all ${
                step1Mode === 'ai'
                  ? 'bg-white text-zinc-900 shadow-nordic-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-[#FF4F00]" />
              <span>Lag med AI</span>
            </button>
          </div>

          {/* TAB 1: CURATED CATALOG */}
          {step1Mode === 'catalog' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-700">
                  Print-klare .STL, .3MF og parametriske .SCAD-filer
                </span>
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 font-semibold text-[#FF4F00] hover:underline"
                >
                  <Upload className="h-3 w-3" />
                  <span>Last opp STL/3MF/SCAD (Admin)</span>
                </Link>
              </div>

              {isLoadingCatalog ? (
                <div className="rounded-xl border border-zinc-200/80 bg-[#F6F6F3] p-8 text-center font-mono text-xs text-zinc-500">
                  Laster katalogmodeller...
                </div>
              ) : (
                <div className="space-y-2.5">
                  {catalogModels.map((item) => {
                    const isSelected = activeJob.id === `job_${item.id}`;
                    const isScad = item.fileFormat === 'scad' || Boolean(item.scadSource);
                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 transition-all ${
                          isSelected
                            ? 'border-zinc-900 bg-[#F6F6F3] ring-1 ring-zinc-900'
                            : 'border-zinc-200/90 bg-white hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white ${
                                  isScad ? 'bg-[#FF4F00]' : 'bg-zinc-900'
                                }`}
                              >
                                .{item.fileFormat}
                              </span>
                              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                {item.category}
                              </span>
                              {(isScad || item.parametricTemplateId) && (
                                <span className="rounded-md bg-[#FF4F00]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#FF4F00]">
                                  Parametrisk (Justerbare mål)
                                </span>
                              )}
                              {(item.modelFileUrl || item.stlBase64) && (
                                <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                                  Ekte .{item.fileFormat.toUpperCase()} 3D-mesh
                                </span>
                              )}
                            </div>
                            <h3 className="mt-1.5 font-display text-sm font-bold text-zinc-900">
                              {item.title}
                            </h3>
                            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
                              {item.description}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[11px] text-zinc-500">
                              <span className="inline-flex items-center gap-1">
                                <Box className="h-3 w-3 text-zinc-400" />
                                {item.boundingBoxMm.x} × {item.boundingBoxMm.y} ×{' '}
                                {item.boundingBoxMm.z} mm
                              </span>
                              <span>•</span>
                              <span className="truncate">{item.fileName}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => void selectCatalogModel(item, uid)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#141413] px-4 py-2.5 text-xs font-semibold text-white shadow-nordic-sm transition-colors hover:bg-[#FF4F00]"
                          >
                            <span>{isScad ? 'Tilpass mål' : 'Velg'}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PARAMETRIC CAD CUSTOMIZER (.SCAD FILE + BUILT-IN TEMPLATES) */}
          {step1Mode === 'parametric' && (
            <div className="space-y-5">
              {/* Sub-switcher: OpenSCAD (.scad) File vs Built-in Parametric Templates */}
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200/80 bg-[#F6F6F3] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setParametricMode('scad', uid);
                    if (!scadSource) {
                      void loadScadFile(
                        'parametric_flange_mount.scad',
                        SAMPLE_OPENSCAD_FILE_CONTENT,
                        uid,
                        'Parametrisk Rør- og Monteringsflens'
                      );
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                    parametricMode === 'scad'
                      ? 'bg-zinc-900 text-white shadow-nordic-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <FileCode2 className="h-3.5 w-3.5 text-[#FF4F00]" />
                  <span>OpenSCAD-fil (.scad)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setParametricMode('template', uid)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                    parametricMode === 'template'
                      ? 'bg-zinc-900 text-white shadow-nordic-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5 text-[#FF4F00]" />
                  <span>Hurtigmaler (4 stk)</span>
                </button>
              </div>

              {parametricMode === 'scad' ? (
                /* =============================================================
                   OPENSCAD (.SCAD) PARAMETRIC AI GENERATOR + FILE UPLOADER
                   ============================================================= */
                <div className="space-y-4">
                  {/* AI Text-to-OpenSCAD (.scad) Generator Box */}
                  <div className="rounded-xl border border-zinc-200/90 bg-[#F6F6F3]/80 p-3.5 shadow-nordic-sm">
                    <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor="scad-ai-prompt-input"
                        className="flex items-center gap-1.5 text-xs font-bold text-zinc-900"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[#FF4F00]" />
                        <span>Generer parametrisk .SCAD-fil med AI</span>
                      </label>

                      {/* Model Selector: Gemini 3.8 Flash vs Gemini 3.1 Pro */}
                      <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() => setScadAiModelTier('flash')}
                          className={`rounded-md px-2 py-0.5 transition-colors ${
                            scadAiModelTier === 'flash'
                              ? 'bg-zinc-900 text-white'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          3.8 Flash (Rask)
                        </button>
                        <button
                          type="button"
                          onClick={() => setScadAiModelTier('pro')}
                          className={`rounded-md px-2 py-0.5 transition-colors ${
                            scadAiModelTier === 'pro'
                              ? 'bg-[#FF4F00] text-white'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          3.1 Pro (Avansert)
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        id="scad-ai-prompt-input"
                        name="scadAiPrompt"
                        type="text"
                        value={scadAiPrompt}
                        onChange={(e) => setScadAiPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void generateScadFromPrompt(scadAiPrompt, uid);
                          }
                        }}
                        placeholder="F.eks. Vinkelbrakett 80x65 mm med M5 skruehull..."
                        className="min-h-[38px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-900 focus:border-zinc-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isGenerating || isCompilingScad}
                        onClick={() => void generateScadFromPrompt(scadAiPrompt, uid)}
                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#FF4F00] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#e04600] disabled:opacity-50"
                      >
                        {isGenerating ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        <span>{isGenerating ? 'Skriver .SCAD...' : 'Generer .SCAD'}</span>
                      </button>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {SCAD_AI_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setScadAiPrompt(preset.prompt);
                            void generateScadFromPrompt(preset.prompt, uid);
                          }}
                          className="rounded-lg border border-zinc-200/90 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:border-[#FF4F00] hover:text-zinc-900"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload .scad file dropzone */}
                  <div className="rounded-xl border-2 border-dashed border-zinc-300 bg-[#F6F6F3]/60 p-4 text-center transition-colors hover:border-[#FF4F00]">
                    <label htmlFor="user-scad-upload" className="cursor-pointer">
                      <FileCode2 className="mx-auto h-6 w-6 text-[#FF4F00]" />
                      <span className="mt-1.5 block text-xs font-bold text-zinc-900">
                        {scadFileName
                          ? `Aktiv .SCAD-fil: ${scadFileName}`
                          : 'Last opp en parametrisk .SCAD-fil (OpenSCAD / MakerWorld)'}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-zinc-500">
                        Vi leser ut alle variabler fra .scad-filen automatisk og kompilerer ekte
                        3D-mesh med OpenSCAD
                      </span>
                      <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                        <span className="inline-block rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white">
                          Velg .scad-fil fra PC
                        </span>
                      </div>
                    </label>
                    <input
                      id="user-scad-upload"
                      name="scadFile"
                      type="file"
                      accept=".scad"
                      onChange={(e) => void handleScadFileUpload(e)}
                      className="sr-only"
                    />
                  </div>

                  {/* Status header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-[#F6F6F3]/70 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-mono text-xs font-semibold text-zinc-800">
                        {scadParameters.length} tilpassbare parametere funnet i .scad-filen
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isCompilingScad}
                      onClick={() => void compileActiveScad(uid)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#FF4F00] disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${isCompilingScad ? 'animate-spin' : ''}`} />
                      <span>{isCompilingScad ? 'Kompilerer CSG...' : 'Oppdater 3D'}</span>
                    </button>
                  </div>

                  {/* Automatically Extracted .SCAD Sliders */}
                  <div className="space-y-3">
                    {scadParameters.map((param) => {
                      const currentVal = scadValues[param.name] ?? param.defaultValue;
                      const inputId = `scad-param-${param.name}`;
                      return (
                        <div
                          key={param.name}
                          className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-nordic-sm"
                        >
                          <div className="mb-1.5 flex items-center justify-between text-xs">
                            <div>
                              <label htmlFor={inputId} className="font-semibold text-zinc-800">
                                {param.label}
                              </label>
                              <span className="ml-2 font-mono text-[10px] text-zinc-400">
                                ({param.name})
                              </span>
                            </div>
                            <span className="rounded-md bg-zinc-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                              {currentVal} {param.unit}
                            </span>
                          </div>

                          <input
                            id={inputId}
                            name={param.name}
                            type="range"
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            value={currentVal}
                            onChange={(e) =>
                              handleScadParamChange(param.name, Number(e.target.value))
                            }
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200"
                          />

                          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-zinc-400">
                            <span>
                              Min: {param.min} {param.unit}
                            </span>
                            <span>
                              Maks: {param.max} {param.unit}
                            </span>
                          </div>

                          {param.options && param.options.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2">
                              {param.options.map((opt) => {
                                const active = currentVal === opt.value;
                                return (
                                  <button
                                    key={opt.label}
                                    type="button"
                                    onClick={() => handleScadParamChange(param.name, opt.value)}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                      active
                                        ? 'border-[#FF4F00] bg-[#FF4F00]/10 font-semibold text-[#FF4F00]'
                                        : 'border-zinc-200 bg-[#F6F6F3] text-zinc-600 hover:bg-zinc-200/60'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expandable OpenSCAD Source Code Inspector */}
                  {scadSource && (
                    <details className="group rounded-xl border border-zinc-200/80 bg-[#F6F6F3]/60 p-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-zinc-700">
                        <span className="inline-flex items-center gap-1.5">
                          <Code2 className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Vis OpenSCAD-kildekode ({scadFileName})</span>
                        </span>
                        <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
                        {scadSource}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                /* =============================================================
                   BUILT-IN ZERO-LATENCY PARAMETRIC TEMPLATES
                   ============================================================= */
                <>
                  <div>
                    <span className="mb-2 block text-xs font-semibold text-zinc-800">
                      1. Velg parametrisk grunntype:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {PARAMETRIC_TEMPLATE_KEYS.map((tplKey) => {
                        const tpl = PARAMETRIC_TEMPLATES[tplKey];
                        const active = parametricTemplateId === tplKey;
                        return (
                          <button
                            key={tplKey}
                            type="button"
                            onClick={() => selectParametricTemplate(tplKey, uid)}
                            className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                              active
                                ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                                : 'border-zinc-200/90 bg-[#F6F6F3]/70 text-zinc-900 hover:border-zinc-300 hover:bg-white'
                            }`}
                          >
                            <span className="text-xs font-bold">{tpl.shortTitle}</span>
                            <span
                              className={`mt-0.5 text-[11px] ${
                                active ? 'text-zinc-300' : 'text-zinc-500'
                              }`}
                            >
                              {tpl.category}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-zinc-200/80 bg-[#F6F6F3]/60 p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-xs font-bold text-zinc-900">
                        {activeParametricSpec.title}
                      </span>
                      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                        Mål-nøyaktig CAD
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">
                      {activeParametricSpec.description}
                    </p>
                  </div>

                  <div className="space-y-3.5">
                    <span className="block text-xs font-semibold text-zinc-800">
                      2. Tilpass dine eksakte mål (oppdaterer 3D-modell og pris direkte):
                    </span>

                    {activeParametricSpec.parameters.map((param) => {
                      const currentVal = parametricParams[param.key] ?? param.defaultValue;
                      const inputId = `param-slider-${param.key}`;
                      return (
                        <div
                          key={param.key}
                          className="rounded-xl border border-zinc-200/80 bg-white p-3.5 shadow-nordic-sm"
                        >
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <label htmlFor={inputId} className="font-semibold text-zinc-800">
                              {param.label}
                            </label>
                            <span className="rounded-md bg-zinc-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                              {currentVal} {param.unit}
                            </span>
                          </div>

                          <input
                            id={inputId}
                            name={param.key}
                            type="range"
                            min={param.min}
                            max={param.max}
                            step={param.step}
                            value={currentVal}
                            onChange={(e) => setParametricParam(param.key, Number(e.target.value))}
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200"
                          />

                          <div className="mt-1.5 flex items-center justify-between font-mono text-[10px] text-zinc-400">
                            <span>
                              Min: {param.min} {param.unit}
                            </span>
                            <span>
                              Maks: {param.max} {param.unit}
                            </span>
                          </div>

                          {param.quickPresets && param.quickPresets.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-zinc-100 pt-2">
                              {param.quickPresets.map((qp) => {
                                const isPresetActive = currentVal === qp.value;
                                return (
                                  <button
                                    key={qp.label}
                                    type="button"
                                    onClick={() => setParametricParam(param.key, qp.value)}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                      isPresetActive
                                        ? 'border-[#FF4F00] bg-[#FF4F00]/10 font-semibold text-[#FF4F00]'
                                        : 'border-zinc-200 bg-[#F6F6F3] text-zinc-600 hover:bg-zinc-200/60'
                                    }`}
                                  >
                                    {qp.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Live Price & Volume Summary + Actions */}
              <div className="rounded-xl border border-zinc-200 bg-[#F6F6F3] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="block text-[11px] text-zinc-500">
                      Ytre mål • Beregnet plastvolum
                    </span>
                    <span className="font-mono font-bold text-zinc-900">
                      {activeJob.boundingBoxMm.x} × {activeJob.boundingBoxMm.y} ×{' '}
                      {activeJob.boundingBoxMm.z} mm • {activeJob.volumeCm3} cm³
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] text-zinc-500">Estimert printpris</span>
                    <span className="font-mono text-base font-bold text-[#FF4F00]">
                      {activeQuote.calculatedPriceNok} kr
                    </span>
                  </div>
                </div>

                <div className="mt-3.5 flex flex-wrap gap-2">
                  {parametricMode === 'scad' && scadSource && (
                    <button
                      type="button"
                      onClick={handleDownloadScadSource}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                    >
                      <FileCode2 className="h-3.5 w-3.5 text-[#FF4F00]" />
                      <span>Last ned .SCAD</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadParametricStl}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-100"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Last ned .STL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF4F00] px-5 py-3 text-xs font-semibold text-white shadow-nordic transition-all hover:bg-[#e04600]"
                  >
                    <span>Gå videre til Farge & Materiale</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI TEXT/IMAGE TO 3D (.SCAD OR .STL/.3MF) */}
          {step1Mode === 'ai' && (
            <form onSubmit={handleGenerateSubmit} method="POST" className="space-y-5">
              {/* Output Format Toggle: OpenSCAD (.scad) vs 3D Mesh (.stl/.3mf) */}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-zinc-800">
                  Hva slags 3D-fil skal AI-en generere?
                </span>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200/80 bg-[#F6F6F3] p-1">
                  <button
                    type="button"
                    onClick={() => setAiOutputFormat('scad')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                      aiOutputFormat === 'scad'
                        ? 'bg-zinc-900 text-white shadow-nordic-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <FileCode2 className="h-3.5 w-3.5 text-[#FF4F00]" />
                    <span>OpenSCAD (.SCAD + spaker)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiOutputFormat('mesh')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
                      aiOutputFormat === 'mesh'
                        ? 'bg-zinc-900 text-white shadow-nordic-sm'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    <Box className="h-3.5 w-3.5 text-[#FF4F00]" />
                    <span>3D-Mesh (.STL / .3MF)</span>
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label
                    htmlFor="forge-prompt-textarea"
                    className="block text-xs font-semibold text-zinc-800"
                  >
                    {aiOutputFormat === 'scad'
                      ? 'Beskriv delen og målene du vil ha i .SCAD-filen'
                      : 'Beskriv gjenstanden du vil at AI skal bygge'}
                  </label>

                  {aiOutputFormat === 'scad' && (
                    <div className="inline-flex items-center rounded-lg border border-zinc-200 bg-[#F6F6F3] p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setScadAiModelTier('flash')}
                        className={`rounded-md px-2 py-0.5 transition-colors ${
                          scadAiModelTier === 'flash'
                            ? 'bg-zinc-900 text-white'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Gemini 3.8 Flash
                      </button>
                      <button
                        type="button"
                        onClick={() => setScadAiModelTier('pro')}
                        className={`rounded-md px-2 py-0.5 transition-colors ${
                          scadAiModelTier === 'pro'
                            ? 'bg-[#FF4F00] text-white'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        Gemini 3.1 Pro
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  id="forge-prompt-textarea"
                  name="prompt"
                  rows={3}
                  required
                  minLength={3}
                  maxLength={600}
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={handlePromptKeyDown}
                  className="w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/70 p-4 text-sm text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <span className="mb-2 block text-xs font-medium text-zinc-500">
                  {aiOutputFormat === 'scad'
                    ? 'Forslag til parametriske OpenSCAD-deler:'
                    : 'Forslag til AI-beskrivelser:'}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(aiOutputFormat === 'scad' ? SCAD_AI_PRESETS : PROMPT_PRESETS).map((preset) => {
                    const isCurrent = promptInput === preset.prompt;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setPromptInput(preset.prompt)}
                        className={`rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all ${
                          isCurrent
                            ? 'border-zinc-900 bg-zinc-900 text-white'
                            : 'border-zinc-200/90 bg-[#F6F6F3]/70 text-zinc-700 hover:border-zinc-300 hover:bg-white'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {aiOutputFormat === 'mesh' && (
                <div className="rounded-xl border border-dashed border-zinc-300 bg-[#F6F6F3]/40 p-3.5 transition-colors hover:border-zinc-400">
                  <label
                    htmlFor="reference-image-upload"
                    className="flex cursor-pointer items-center justify-between gap-2 text-xs text-zinc-600"
                  >
                    <span className="flex items-center gap-2.5">
                      <ImagePlus className="h-4 w-4 text-zinc-500" />
                      <span className="font-medium">
                        {referenceImageName
                          ? `Valgt bilde: ${referenceImageName}`
                          : 'Last opp en skisse eller et referansebilde (valgfritt)'}
                      </span>
                    </span>
                    <span className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-nordic-sm">
                      Velg bilde
                    </span>
                  </label>
                  <input
                    id="reference-image-upload"
                    name="referenceImage"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </div>
              )}

              <div className="space-y-3 pt-1">
                {freeGenerationsRemaining > 0 ? (
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4F00] px-5 py-4 text-sm font-semibold text-white shadow-nordic transition-all hover:bg-[#e04600] disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>
                          {aiOutputFormat === 'scad'
                            ? 'Skriver OpenSCAD-kode og kompilerer 3D...'
                            : 'Bygger 3D-modell...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>
                          {aiOutputFormat === 'scad'
                            ? 'Generer .SCAD-modell med spaker'
                            : 'Generer 3D-modell og gå til Steg 2'}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isBuyingCredits}
                    onClick={() => void buyExtraAiGenerations(uid)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4F00] px-5 py-4 text-center text-xs font-semibold text-white shadow-nordic transition-all hover:bg-[#e04600]"
                  >
                    <PlusCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {isBuyingCredits
                        ? 'Aktiverer 10 ekstra AI-forsøk...'
                        : 'Kjøp 10 ekstra AI-forsøk (39 kr) – Trekkes fra prisen når du bestiller!'}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                <span>Du har {freeGenerationsRemaining} gratis AI-forsøk igjen</span>
                {aiCreditNok > 0 && (
                  <span className="font-semibold text-emerald-700">
                    −{aiCreditNok} kr rabatt til gode
                  </span>
                )}
              </div>
            </form>
          )}
        </section>
      )}

      {/* =====================================================================
          STEG 2: VELG STØRRELSE, FARGE OG MATERIALE
         ===================================================================== */}
      {currentStep === 2 && (
        <section
          aria-labelledby="step-2-heading"
          className="rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-nordic"
        >
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF4F00]/10 px-3 py-1 font-mono text-xs font-semibold text-[#FF4F00]">
                Steg 2 av 3
              </span>
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Bytt eller juster modell
              </button>
            </div>
            <h2
              id="step-2-heading"
              className="mt-2.5 font-display text-xl font-bold tracking-tight text-zinc-900"
            >
              Velg størrelse, farge og materiale
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Du tilpasser nå: <strong className="text-zinc-800">{activeJob.prompt}</strong>
            </p>
          </div>

          <div className="space-y-6">
            {/* If parametric or .scad model is active, offer quick button to tweak parametric sliders */}
            {activeJob.parametricTemplateId || activeJob.scadSource ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#FF4F00]/30 bg-[#FF4F00]/5 p-4">
                <div>
                  <span className="block text-xs font-bold text-zinc-900">
                    {activeJob.scadSource
                      ? 'OpenSCAD (.scad) parametrisk modell'
                      : 'Parametrisk modell med egendefinerte mål'}
                  </span>
                  <span className="mt-0.5 block font-mono text-[11px] text-zinc-600">
                    Ytre mål: {liveDims.x} × {liveDims.y} × {liveDims.z} mm • Volum:{' '}
                    {activeJob.volumeCm3} cm³
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep1Mode('parametric', uid);
                    setCurrentStep(1);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#FF4F00]"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Endre parametriske mål</span>
                </button>
              </div>
            ) : (
              /* 1. STANDARD SIZE SELECTION FOR NON-PARAMETRIC MODELS */
              <div>
                <span className="mb-2.5 block text-xs font-semibold text-zinc-800">
                  1. Hvor stor skal modellen være?
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  {SIZE_PRESETS.map((preset) => {
                    const isSelected = targetHeightMm === preset.heightMm;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setTargetHeightMm(preset.heightMm)}
                        className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                            : 'border-zinc-200/90 bg-[#F6F6F3]/70 text-zinc-900 hover:border-zinc-300 hover:bg-white'
                        }`}
                      >
                        <div>
                          <span className="block text-xs font-bold">{preset.label}</span>
                          <span
                            className={`mt-0.5 block text-[11px] ${
                              isSelected ? 'text-zinc-300' : 'text-zinc-500'
                            }`}
                          >
                            {preset.desc}
                          </span>
                        </div>
                        <span
                          className={`mt-2.5 inline-block font-mono text-xs font-semibold ${
                            isSelected ? 'text-[#FF4F00]' : 'text-zinc-700'
                          }`}
                        >
                          {preset.priceHint}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-xl border border-zinc-200/80 bg-[#F6F6F3]/60 p-3.5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <label
                      htmlFor="step2-height-slider"
                      className="inline-flex items-center gap-1.5 font-medium text-zinc-700"
                    >
                      <Ruler className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Finjuster høyde i millimeter:</span>
                    </label>
                    <span className="font-mono font-bold text-zinc-900">
                      {targetHeightMm} mm ({(targetHeightMm / 10).toFixed(1)} cm)
                    </span>
                  </div>
                  <input
                    id="step2-height-slider"
                    name="targetHeightMm"
                    type="range"
                    min={20}
                    max={250}
                    step={1}
                    value={targetHeightMm}
                    onChange={(e) => setTargetHeightMm(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-300"
                  />
                  <div className="mt-1.5 flex justify-between font-mono text-[11px] text-zinc-500">
                    <span>Bredde: {liveDims.x} mm</span>
                    <span>Dybde: {liveDims.y} mm</span>
                    <span>Høyde: {liveDims.z} mm</span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. COLOR SELECTION */}
            <fieldset>
              <legend className="mb-2.5 block text-xs font-semibold text-zinc-800">
                2. Hvilken farge ønsker du?
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {currentMaterialSpec.colors.map((hex) => {
                  const active = colorHex.toUpperCase() === hex.toUpperCase();
                  const colorLabel = (currentMaterialSpec.colorNames[hex] || hex).split(' (')[0];
                  return (
                    <label
                      key={hex}
                      htmlFor={`swatch-${hex}`}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all ${
                        active
                          ? 'border-zinc-900 bg-white text-zinc-900 ring-1 ring-zinc-900'
                          : 'border-zinc-200/90 bg-[#F6F6F3]/70 text-zinc-700 hover:border-zinc-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          id={`swatch-${hex}`}
                          type="radio"
                          name="filamentColor"
                          value={hex}
                          checked={active}
                          onChange={() => setColorHex(hex)}
                          className="sr-only"
                        />
                        <span
                          className="h-5 w-5 rounded-full border border-black/15 shadow-inner"
                          style={{ backgroundColor: hex }}
                        />
                        <span>{colorLabel}</span>
                      </div>
                      {active && <Check className="h-3.5 w-3.5 text-[#FF4F00]" />}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* 3. MATERIAL SELECTION */}
            <fieldset>
              <legend className="mb-2.5 block text-xs font-semibold text-zinc-800">
                3. Hvor sterk må plasten være?
              </legend>
              <div className="space-y-2">
                {(Object.keys(MATERIALS) as FilamentMaterialCode[]).map((code) => {
                  const item = MATERIALS[code];
                  const friendly = MATERIAL_FRIENDLY_DESC[code];
                  const isSelected = material === code;
                  return (
                    <label
                      key={code}
                      htmlFor={`material-${code}`}
                      className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                        isSelected
                          ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                          : 'border-zinc-200/90 bg-[#F6F6F3]/70 text-zinc-900 hover:border-zinc-300 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          id={`material-${code}`}
                          type="radio"
                          name="filamentMaterial"
                          value={code}
                          checked={isSelected}
                          onChange={() => setMaterial(code)}
                          className="sr-only"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold">{friendly.friendlyTitle}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                isSelected
                                  ? 'bg-[#FF4F00] text-white'
                                  : 'bg-zinc-200/80 text-zinc-700'
                              }`}
                            >
                              {friendly.badge}
                            </span>
                          </div>
                          <span
                            className={`mt-1 block text-xs leading-relaxed ${
                              isSelected ? 'text-zinc-300' : 'text-zinc-500'
                            }`}
                          >
                            {friendly.friendlySub}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-lg px-2 py-1 font-mono text-[11px] font-medium ${
                          isSelected ? 'bg-white/15 text-white' : 'bg-white text-zinc-600'
                        }`}
                      >
                        {item.pricePerGram.toFixed(2)} kr/g
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* OPTIONAL ADVANCED SETTINGS */}
            <details className="group rounded-xl border border-zinc-200/80 bg-[#F6F6F3]/50 p-3.5">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-zinc-700">
                <span className="flex items-center gap-2">
                  <Sliders className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Avanserte innstillinger (valgfritt)</span>
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-400 transition-transform group-open:rotate-180" />
              </summary>

              <div className="mt-4 space-y-4 border-t border-zinc-200/70 pt-4">
                <fieldset>
                  <legend className="mb-2 block text-xs font-semibold text-zinc-800">
                    Detaljgrad (Laghøyde)
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(LAYER_QUALITY) as LayerQualityKey[]).map((key) => {
                      const q = LAYER_QUALITY[key];
                      const active = layerQuality === key;
                      return (
                        <label
                          key={key}
                          htmlFor={`quality-${key}`}
                          className={`cursor-pointer rounded-xl border p-3 text-xs transition-all ${
                            active
                              ? 'border-zinc-900 bg-zinc-900 text-white'
                              : 'border-zinc-200 bg-white text-zinc-800'
                          }`}
                        >
                          <input
                            id={`quality-${key}`}
                            type="radio"
                            name="layerQuality"
                            value={key}
                            checked={active}
                            onChange={() => setLayerQuality(key)}
                            className="sr-only"
                          />
                          <span className="block font-semibold">{q.label}</span>
                          <span
                            className={`mt-0.5 block text-[11px] ${
                              active ? 'text-zinc-300' : 'text-zinc-500'
                            }`}
                          >
                            {key === '0.20mm'
                              ? 'Normal overflate (Anbefalt)'
                              : 'Ekstra glatt (+15% tid)'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <label htmlFor="infill-slider" className="font-semibold text-zinc-800">
                      Innvendig fylltetthet (Infill)
                    </label>
                    <span className="font-mono font-semibold">{infillPercent}%</span>
                  </div>
                  <input
                    id="infill-slider"
                    name="infillPercent"
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={infillPercent}
                    onChange={(e) => setInfillPercent(Number(e.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-300"
                  />
                </div>
              </div>
            </details>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                ← Tilbake
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF4F00] px-5 py-4 text-sm font-semibold text-white shadow-nordic transition-all hover:bg-[#e04600]"
              >
                <span>Gå til Steg 3: Se pris & bestill</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* =====================================================================
          STEG 3: SE PRIS & BESTILL HJEM PÅ DØREN
         ===================================================================== */}
      {currentStep === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200/90 bg-white px-5 py-3.5 shadow-nordic-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-semibold text-emerald-800">
              Steg 3 av 3 • Klar til bestilling
            </span>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 hover:text-zinc-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Endre størrelse eller farge
            </button>
          </div>

          <SpecSheetCard />
        </div>
      )}
    </div>
  );
}
