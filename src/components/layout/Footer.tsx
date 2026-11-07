import React from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { AxisForgeLogoLockup } from '@/components/brand/AxisForgeLogo';

export function Footer() {
  return (
    <footer className="mt-14 border-t border-zinc-200/80 bg-white/80">
      <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-6 px-5 py-6 sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="group">
            <AxisForgeLogoLockup
              markClassName="h-8 w-8"
              subtitle="AI • .STL • .3MF • PARAMETRISK .SCAD"
              compact
            />
          </Link>
          <span className="hidden text-zinc-300 sm:inline">|</span>
          <p className="font-mono text-[11px] text-zinc-500">
            Bambu Lab X1C Print Farm • 256 × 256 × 256 mm • Pay-Per-Model
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Last ned SVG-logo:
          </span>
          <a
            href="/logo-full.svg"
            download="axisforge-logo-full.svg"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-200/60"
          >
            <Download className="h-3 w-3 text-[#FF4F00]" />
            <span>logo-full.svg</span>
          </a>
          <a
            href="/logo-mark.svg"
            download="axisforge-logo-mark.svg"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-200/60"
          >
            <Download className="h-3 w-3 text-[#FF4F00]" />
            <span>logo-mark.svg</span>
          </a>
          <a
            href="/icon.svg"
            download="axisforge-icon.svg"
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-[#F6F6F3] px-2.5 py-1 font-mono text-[11px] font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-200/60"
          >
            <Download className="h-3 w-3 text-[#FF4F00]" />
            <span>icon.svg</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
