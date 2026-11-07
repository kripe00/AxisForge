'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cpu, LogIn, LogOut, PackageCheck, Upload, UserCheck } from 'lucide-react';
import { AxisForgeLogoLockup } from '@/components/brand/AxisForgeLogo';
import { useAuth } from '@/components/providers/AuthProvider';
import { isDevMockMode } from '@/lib/firebase/client';

export function Navbar() {
  const pathname = usePathname();
  const { user, openAuthModal, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#F6F6F3]/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        {/* Left: Minimalist Nordic Hardware Brand Identity */}
        <div className="flex items-center gap-6">
          <Link href="/" className="group flex items-center">
            <AxisForgeLogoLockup />
          </Link>

          <div className="hidden items-center gap-2.5 rounded-full border border-zinc-200/90 bg-white px-3.5 py-1.5 font-mono text-[11px] text-zinc-600 shadow-nordic-sm xl:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Bambu X1C Farm: 12/12 aktive</span>
            <span className="text-zinc-300">•</span>
            <span className="text-zinc-500">Volum 256³ mm</span>
          </div>

          {isDevMockMode() && (
            <div className="hidden items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-50 px-3 py-1 font-mono text-[11px] font-medium text-amber-900 md:flex">
              <Cpu className="h-3.5 w-3.5 text-amber-600" />
              <span>Sandbox Mode</span>
            </div>
          )}
        </div>

        {/* Right: Segmented Navigation & Account */}
        <nav aria-label="Hovednavigasjon" className="flex items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-zinc-200/90 bg-[#EFEFEB] p-1">
            <Link
              href="/"
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                pathname === '/'
                  ? 'bg-white text-zinc-900 shadow-nordic-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Bestill 3D-print
            </Link>

            <Link
              href="/orders"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                pathname === '/orders'
                  ? 'bg-white text-zinc-900 shadow-nordic-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <PackageCheck className="h-3.5 w-3.5" />
              <span>Ordre</span>
            </Link>

            <Link
              href="/admin"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                pathname === '/admin'
                  ? 'bg-white text-zinc-900 shadow-nordic-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Upload className="h-3.5 w-3.5 text-[#FF4F00]" />
              <span>Admin (STL/3MF)</span>
            </Link>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-zinc-200/90 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-nordic-sm sm:flex">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="max-w-[140px] truncate">{user.displayName}</span>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Logg ut"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/90 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-nordic-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logg ut</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#141413] px-4 py-2 text-xs font-semibold text-white shadow-nordic-sm transition-colors hover:bg-[#FF4F00]"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Logg inn</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
