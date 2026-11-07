'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { AlertCircle, ArrowRight, Check, Sparkles } from 'lucide-react';
import { PromptPanel } from '@/components/forge/PromptPanel';
import { MATERIALS } from '@/lib/schemas/forge';
import { useForgeStore, type WizardStep } from '@/store/useForgeStore';

const ForgeViewer3D = dynamic(
  () => import('@/components/forge/ForgeViewer3D').then((mod) => mod.ForgeViewer3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[450px] flex-col items-center justify-center rounded-2xl border border-zinc-200/90 bg-[#ECEBE6] p-6 font-mono text-xs text-zinc-500 shadow-nordic sm:h-[520px]">
        <div className="rounded-full bg-white/90 px-4 py-2 shadow-nordic-sm">
          Laster interaktiv 3D-byggeplate...
        </div>
      </div>
    ),
  }
);

const WIZARD_STEPS: {
  step: WizardStep;
  title: string;
  subtitle: string;
}[] = [
  {
    step: 1,
    title: '1. Lag 3D-modell',
    subtitle: 'Beskriv med tekst eller bilde',
  },
  {
    step: 2,
    title: '2. Størrelse & farge',
    subtitle: 'Tilpass mål og materiale',
  },
  {
    step: 3,
    title: '3. Se pris & bestill',
    subtitle: 'Vi printer og sender hjem til deg',
  },
];

export default function AxisForgeStudioPage() {
  const {
    currentStep,
    setCurrentStep,
    activeQuote,
    aiCreditNok,
    material,
    targetHeightMm,
    isSlicing,
    errorBanner,
    clearErrorBanner,
  } = useForgeStore();

  const netPrice = Math.max(49, activeQuote.calculatedPriceNok - aiCreditNok);
  const matSpec = MATERIALS[material];

  return (
    <div className="space-y-6">
      {/* =====================================================================
          TOP GUIDED 1-2-3 STEPPER BAR (Makes user journey immediately obvious)
         ===================================================================== */}
      <nav
        aria-label="Steg i bestillingen"
        className="rounded-2xl border border-zinc-200/90 bg-white p-3 shadow-nordic sm:p-4"
      >
        <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
          {WIZARD_STEPS.map((item) => {
            const isCurrent = currentStep === item.step;
            const isCompleted = currentStep > item.step;
            return (
              <li key={item.step}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(item.step)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex w-full items-center gap-3.5 rounded-xl border p-3 text-left transition-all ${
                    isCurrent
                      ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                      : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/60 text-zinc-900 hover:bg-emerald-50'
                        : 'border-zinc-200/70 bg-[#F6F6F3]/60 text-zinc-600 hover:bg-[#F6F6F3]'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold ${
                      isCurrent
                        ? 'bg-[#FF4F00] text-white'
                        : isCompleted
                          ? 'bg-emerald-600 text-white'
                          : 'bg-zinc-200/80 text-zinc-700'
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : item.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{item.title}</span>
                    <span
                      className={`block truncate text-[11px] ${
                        isCurrent ? 'text-zinc-300' : 'text-zinc-500'
                      }`}
                    >
                      {item.subtitle}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Global Error Alert Banner */}
      {errorBanner && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-between rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-xs font-medium text-red-900 shadow-nordic-sm"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-[#FF4F00]" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={clearErrorBanner}
            className="rounded-lg bg-white px-3 py-1 font-semibold text-zinc-800 shadow-nordic-sm"
          >
            Lukk
          </button>
        </div>
      )}

      {/* Main Two-Column Guided Workbench */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* Left Column (5 cols): Active Step Panel (1, 2, or 3) */}
        <div className="lg:col-span-5">
          <PromptPanel />
        </div>

        {/* Right Column (7 cols): Live 3D Build Plate + Persistent Live Price Bar */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-span-7">
          <ForgeViewer3D />

          {/* Live Price & Quick Action Bar under the 3D Viewer */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white px-6 py-4 shadow-nordic">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="block text-[11px] font-medium text-zinc-400">
                  Estimert pris (inkl. mva)
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-bold text-zinc-900">{netPrice} kr</span>
                  {isSlicing && (
                    <span className="font-mono text-xs text-[#FF4F00]">Oppdaterer...</span>
                  )}
                </div>
              </div>

              <div className="hidden h-8 w-px bg-zinc-200 sm:block" />

              <div className="text-xs text-zinc-600">
                <span className="block font-semibold text-zinc-900">
                  Høyde: {(targetHeightMm / 10).toFixed(1)} cm ({targetHeightMm} mm)
                </span>
                <span className="text-zinc-500">
                  {matSpec.shortLabel} • ca. {activeQuote.filamentGrams}g
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((currentStep + 1) as WizardStep)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#141413] px-5 py-3 text-xs font-semibold text-white transition-colors hover:bg-[#FF4F00]"
                >
                  <span>
                    {currentStep === 1 ? 'Tilpass størrelse & farge' : 'Se prislapp & bestill'}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Se bestillingskortet til venstre
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
