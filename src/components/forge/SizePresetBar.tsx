'use client';

import React from 'react';
import { Lock, Ruler } from 'lucide-react';
import { useForgeStore } from '@/store/useForgeStore';

const SIZE_PRESETS = [
  {
    id: 'SMALL',
    label: 'Small',
    heightMm: 60,
    priceHint: '~199 kr',
  },
  {
    id: 'MEDIUM',
    label: 'Medium',
    heightMm: 120,
    priceHint: '~349 kr',
  },
  {
    id: 'LARGE',
    label: 'Large',
    heightMm: 220,
    priceHint: '~749 kr',
  },
] as const;

export function SizePresetBar() {
  const { activeJob, targetHeightMm, setTargetHeightMm, getComputedDimensionsMm } = useForgeStore();
  const liveDims = getComputedDimensionsMm();
  const isParametric = Boolean(activeJob.parametricTemplateId || activeJob.scadSource);

  if (isParametric) {
    return (
      <section
        aria-label="1:1 Eksakte CAD-mål"
        className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-nordic"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-800">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            1:1 Eksakte CAD-mål aktivert
          </span>
          <span className="rounded-lg bg-zinc-900 px-2.5 py-1 font-mono text-xs font-semibold text-white">
            {liveDims.x} × {liveDims.y} × {liveDims.z} mm
          </span>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Størrelse og Millimeter-skalering"
      className="rounded-2xl border border-zinc-200/90 bg-white p-5 shadow-nordic"
    >
      {/* Segmented Hardware Preset Selector */}
      <div className="grid grid-cols-3 gap-2.5">
        {SIZE_PRESETS.map((preset) => {
          const isSelected = targetHeightMm === preset.heightMm;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => setTargetHeightMm(preset.heightMm)}
              className={`flex flex-col items-start justify-between rounded-xl border p-3.5 text-left transition-all ${
                isSelected
                  ? 'border-zinc-900 bg-zinc-900 text-white shadow-nordic-sm'
                  : 'border-zinc-200/80 bg-[#F6F6F3]/70 text-zinc-900 hover:border-zinc-300 hover:bg-white'
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-xs font-semibold">{preset.label}</span>
                <span
                  className={`font-mono text-xs font-semibold ${
                    isSelected ? 'text-[#FF4F00]' : 'text-zinc-500'
                  }`}
                >
                  {preset.heightMm} mm
                </span>
              </div>
              <span
                className={`mt-1 font-mono text-[11px] ${
                  isSelected ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                Fra {preset.priceHint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Exact Millimeter Slider (30mm to 250mm) */}
      <div className="mt-4 border-t border-zinc-100 pt-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="exact-mm-slider"
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800"
          >
            <Ruler className="h-3.5 w-3.5 text-[#FF4F00]" />
            <span>Trinnløs høydeskalering (30 – 250 mm)</span>
          </label>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="rounded-lg bg-[#F6F6F3] px-2.5 py-1 text-zinc-600">
              {liveDims.x} × {liveDims.y} × {liveDims.z} mm
            </span>
            <span className="rounded-lg bg-zinc-900 px-2.5 py-1 font-semibold text-white">
              {targetHeightMm} mm
            </span>
          </div>
        </div>

        <input
          id="exact-mm-slider"
          name="targetHeightMm"
          type="range"
          min={30}
          max={250}
          step={1}
          value={targetHeightMm}
          onChange={(e) => setTargetHeightMm(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200"
        />

        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-zinc-400">
          <span>30 mm</span>
          <span>60 mm</span>
          <span>120 mm</span>
          <span>180 mm</span>
          <span>250 mm (Maks X1C)</span>
        </div>
      </div>
    </section>
  );
}
