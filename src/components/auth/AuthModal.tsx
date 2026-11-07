'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Terminal, X } from 'lucide-react';
import { AxisForgeLogoMark } from '@/components/brand/AxisForgeLogo';
import { useAuth } from '@/components/providers/AuthProvider';
import { isDevMockMode } from '@/lib/firebase/client';

export function AuthModal() {
  const {
    isAuthModalOpen,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signInAsDevOperator,
  } = useAuth();

  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('operator@axisforge.no');
  const [password, setPassword] = useState('BambuX1C-2026!');
  const [fullName, setFullName] = useState('Kristoffer Verksted');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isAuthModalOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isAuthModalOpen && dialog.open) {
      dialog.close();
    }
  }, [isAuthModalOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      closeAuthModal();
    };

    dialog.addEventListener('close', handleClose);

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };

      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e)) {
          dialog.close();
        }
      };

      dialog.addEventListener('pointerdown', onPointerDown);
      dialog.addEventListener('pointerup', onPointerUp);

      return () => {
        dialog.removeEventListener('close', handleClose);
        dialog.removeEventListener('pointerdown', onPointerDown);
        dialog.removeEventListener('pointerup', onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [closeAuthModal]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, fullName);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Autentisering feilet');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="auth-dialog-title"
      {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
      className="m-auto w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-nordic-lg backdrop:bg-zinc-950/40 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <AxisForgeLogoMark className="h-7 w-7" decorative />
          <h2
            id="auth-dialog-title"
            className="font-display text-base font-bold tracking-tight text-zinc-900"
          >
            {mode === 'signin' ? 'Logg inn på AxisForge' : 'Opprett AxisForge-konto'}
          </h2>
        </div>
        <button
          type="button"
          onClick={closeAuthModal}
          aria-label="Lukk innloggingsvindu"
          className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5 p-6">
        {isDevMockMode() && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3.5 text-xs text-amber-950">
            <div className="flex items-center gap-2 font-semibold">
              <Terminal className="h-4 w-4 shrink-0 text-amber-700" />
              <span>Lokal Sandkasse-modus aktiv</span>
            </div>
            <p className="mt-1 text-amber-800">
              Du kan logge inn direkte uten eksterne Firebase-nøkler.
            </p>
          </div>
        )}

        {/* Segmented Mode Switcher */}
        <div className="grid grid-cols-2 rounded-xl bg-[#EFEFEB] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              mode === 'signin'
                ? 'bg-white text-zinc-900 shadow-nordic-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Logg inn
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setErrorMsg(null);
            }}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              mode === 'signup'
                ? 'bg-white text-zinc-900 shadow-nordic-sm'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Ny konto
          </button>
        </div>

        <form onSubmit={handleSubmit} method="POST" className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label
                htmlFor="auth-full-name"
                className="mb-1.5 block text-xs font-semibold text-zinc-800"
              >
                Fullt navn
              </label>
              <input
                id="auth-full-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block text-xs font-semibold text-zinc-800"
            >
              E-postadresse
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              required
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrorMsg(null);
              }}
              className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 font-mono text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="auth-password" className="text-xs font-semibold text-zinc-800">
                Passord
              </label>
              <button
                type="button"
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
                onClick={() => setShowPassword((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" /> Skjul
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Vis
                  </>
                )}
              </button>
            </div>
            <input
              id="auth-password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMsg(null);
              }}
              className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 font-mono text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-[#141413] px-5 py-3.5 text-xs font-semibold text-white shadow-nordic-sm transition-colors hover:bg-[#FF4F00] disabled:opacity-50"
          >
            {isSubmitting ? 'Autentiserer...' : mode === 'signin' ? 'Logg inn' : 'Opprett konto'}
          </button>
        </form>

        <div className="relative flex items-center justify-center py-1">
          <div className="w-full border-t border-zinc-200" />
          <span className="bg-white px-3 text-[11px] font-medium text-zinc-400">eller</span>
          <div className="w-full border-t border-zinc-200" />
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs font-semibold text-zinc-800 shadow-nordic-sm transition-colors hover:bg-zinc-50"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Fortsett med Google
          </button>

          {isDevMockMode() && (
            <button
              type="button"
              onClick={() => signInAsDevOperator()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-[#F6F6F3] px-4 py-2.5 font-mono text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-200/70"
            >
              <Terminal className="h-3.5 w-3.5" />
              Hurtiginnlogging (Dev Operator)
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
