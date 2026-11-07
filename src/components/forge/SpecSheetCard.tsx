'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  Lock,
  Scale,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import { MATERIALS, type PrintOrderDocument } from '@/lib/schemas/forge';
import { useForgeStore } from '@/store/useForgeStore';
import { useAuth } from '@/components/providers/AuthProvider';

function formatPrintDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours <= 0) return `${minutes} min`;
  return `${hours}t ${minutes}m`;
}

export function SpecSheetCard() {
  const { user, openAuthModal } = useAuth();
  const {
    activeJob,
    activeQuote,
    aiCreditNok,
    isSlicing,
    lastCreatedOrder,
    setLastCreatedOrder,
    setUserQuota,
  } = useForgeStore();

  const checkoutDialogRef = useRef<HTMLDialogElement | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [fullName, setFullName] = useState(user?.displayName || 'Kristoffer Verksted');
  const [email, setEmail] = useState(user?.email || 'operator@axisforge.no');
  const [streetAddress, setStreetAddress] = useState('Verkstedveien 14B');
  const [postalCode, setPostalCode] = useState('0554');
  const [city, setCity] = useState('Oslo');
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.displayName);
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    const dialog = checkoutDialogRef.current;
    if (!dialog) return;

    if (isCheckoutOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isCheckoutOpen && dialog.open) {
      dialog.close();
    }
  }, [isCheckoutOpen]);

  useEffect(() => {
    const dialog = checkoutDialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      setIsCheckoutOpen(false);
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
  }, []);

  const filamentSpec = MATERIALS[activeQuote.material];
  const colorName = (filamentSpec.colorNames[activeQuote.colorHex] || activeQuote.colorHex).split(
    ' ('
  )[0];
  const durationFormatted = formatPrintDuration(activeQuote.printTimeSeconds);
  const netPriceAfterCredit = Math.max(49, activeQuote.calculatedPriceNok - aiCreditNok);
  const orderQuantity = activeQuote.pricingBreakdown.quantity ?? 1;
  const unitPriceNok = activeQuote.pricingBreakdown.unitPriceNok ?? activeQuote.calculatedPriceNok;
  const batchSavingsNok = activeQuote.pricingBreakdown.batchSavingsNok ?? 0;
  const platesRequired = activeQuote.pricingBreakdown.platesRequired ?? 1;

  const handleConfirmOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOrderError(null);
    setIsSubmittingOrder(true);

    try {
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid || 'dev-operator-01',
          quoteId: activeQuote.id,
          shippingAddress: {
            fullName,
            email,
            streetAddress,
            postalCode,
            city,
            country: 'Norge',
          },
        }),
      });

      const data = (await response.json()) as {
        order?: PrintOrderDocument;
        userQuota?: { freeGenerationsRemaining: number; aiCreditNok: number };
        message?: string;
      };

      if (!response.ok || !data.order) {
        throw new Error(data.message || 'Kunne ikke låse print-bestilling');
      }

      if (data.userQuota) {
        setUserQuota(data.userQuota.freeGenerationsRemaining, data.userQuota.aiCreditNok);
      }

      setLastCreatedOrder(data.order);
      setIsCheckoutOpen(false);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Feil ved bestilling');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  return (
    <>
      <section
        aria-labelledby="spec-sheet-heading"
        className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white p-6 shadow-nordic"
      >
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-4">
          <div>
            <h2
              id="spec-sheet-heading"
              className="font-display text-xl font-bold tracking-tight text-zinc-900"
            >
              Oppsummering og pris
            </h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Vi 3D-printer modellen din på våre Bambu Lab-maskiner, fjerner støttemateriale og
              sender den hjem til deg.
            </p>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 font-mono text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Klar til produksjon
          </span>
        </div>

        {/* Selected Configuration Summary */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-zinc-200/70 bg-[#F6F6F3]/70 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <Cpu className="h-3.5 w-3.5 text-zinc-400" />
                Størrelse (B × D × H)
              </span>
              <span className="mt-1 block font-mono text-base font-bold text-zinc-900">
                {activeQuote.targetDimensionsMm.x} × {activeQuote.targetDimensionsMm.y} ×{' '}
                {activeQuote.targetDimensionsMm.z} mm
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                Ca. {(activeQuote.targetDimensionsMm.z / 10).toFixed(1)} cm høy
              </span>
            </div>

            <div className="rounded-xl border border-zinc-200/70 bg-[#F6F6F3]/70 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <Scale className="h-3.5 w-3.5 text-zinc-400" />
                Materiale & Vekt
              </span>
              <span className="mt-1 flex items-center gap-2 font-mono text-base font-bold text-zinc-900">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-black/15"
                  style={{ backgroundColor: activeQuote.colorHex }}
                />
                {activeQuote.filamentGrams}g {filamentSpec.shortLabel}
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">Farge: {colorName}</span>
            </div>

            <div className="rounded-xl border border-zinc-200/70 bg-[#F6F6F3]/70 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                Printtid i maskin
              </span>
              <span className="mt-1 block font-mono text-base font-bold text-zinc-900">
                {durationFormatted}
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                Inkl. kvalitetskontroll
              </span>
            </div>

            <div className="rounded-xl border border-zinc-200/70 bg-[#F6F6F3]/70 p-3.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
                <Layers className="h-3.5 w-3.5 text-zinc-400" />
                Antall & Presisjon
              </span>
              <span className="mt-1 block font-mono text-base font-bold text-zinc-900">
                {orderQuantity} stk ({unitPriceNok} kr/stk)
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                {activeQuote.layerCount} lag • {activeQuote.layerHeightMm.toFixed(2)} mm laghøyde
              </span>
            </div>
          </div>

          {/* Transparent Price Receipt Box */}
          <div className="rounded-xl border border-zinc-200/90 bg-[#F6F6F3]/60 p-5">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2.5">
              <span className="text-xs font-bold text-zinc-900">
                Slik er prisen regnet ut ({orderQuantity} stk)
              </span>
              <span className="font-mono text-[11px] text-zinc-500">Inkl. mva</span>
            </div>

            <div className="mt-3.5 space-y-2 font-mono text-xs tabular-nums text-zinc-600">
              <div className="flex items-center justify-between">
                <span>
                  Oppstart & byggeplate ({platesRequired} Bambu X1C-plate
                  {platesRequired > 1 ? 'r' : ''})
                </span>
                <span className="font-semibold text-zinc-900">
                  {activeQuote.pricingBreakdown.baseForgeFeeNok} kr
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>
                  Plastforbruk ({activeQuote.filamentGrams}g {filamentSpec.shortLabel} totalt)
                </span>
                <span className="font-semibold text-zinc-900">
                  {activeQuote.pricingBreakdown.materialCostNok} kr
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span>Maskintid ({durationFormatted})</span>
                <span className="font-semibold text-zinc-900">
                  {activeQuote.pricingBreakdown.machineCostNok} kr
                </span>
              </div>

              {batchSavingsNok > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
                  <span>Samtrykksrabatt ({orderQuantity} stk på felles plate)</span>
                  <span>Sparer {batchSavingsNok} kr</span>
                </div>
              )}

              {aiCreditNok > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 font-semibold text-emerald-800">
                  <span>Fradrag for kjøpte AI-forsøk</span>
                  <span>−{aiCreditNok} kr</span>
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-zinc-200 pt-3">
                <div>
                  <span className="font-sans text-sm font-bold text-zinc-900">
                    Totalpris ({orderQuantity} stk)
                  </span>
                  {orderQuantity > 1 && (
                    <span className="ml-2 font-mono text-[11px] text-zinc-500">
                      ({unitPriceNok} kr/stk)
                    </span>
                  )}
                </div>
                <span className="text-2xl font-bold tracking-tight text-zinc-900">
                  {netPriceAfterCredit} kr
                  {isSlicing && (
                    <span className="ml-1.5 text-xs font-normal text-[#FF4F00]">...</span>
                  )}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 pt-3 text-[11px] text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-zinc-400" />
                Frakt {activeQuote.pricingBreakdown.shippingNok} kr (Gratis over 1000 kr)
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <Sparkles className="h-3 w-3" />
                +5 gratis AI-forsøk ved bestilling
              </span>
            </div>
          </div>

          {/* Primary Checkout CTA */}
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF4F00] px-5 py-4 text-sm font-semibold text-white shadow-nordic transition-all hover:bg-[#e04600]"
          >
            <span>Fyll inn leveringsadresse og bestill ({netPriceAfterCredit} kr)</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {lastCreatedOrder && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs text-emerald-950"
            >
              <div className="flex items-center justify-between font-bold">
                <span>Takk! Ordre {lastCreatedOrder.id} er mottatt</span>
                <span className="font-mono text-[11px] text-emerald-700">
                  {lastCreatedOrder.bambuPrinterId}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-emerald-800">
                <span>Du har fått +5 nye gratis AI-forsøk</span>
                <Link
                  href="/orders"
                  className="inline-flex items-center gap-1 font-semibold underline hover:text-emerald-950"
                >
                  Se ordrestatus <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CLEAN NORDIC CHECKOUT DIALOG */}
      <dialog
        ref={checkoutDialogRef}
        aria-labelledby="checkout-dialog-title"
        {...({ closedby: 'any' } as React.DialogHTMLAttributes<HTMLDialogElement>)}
        className="m-auto w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-nordic-lg backdrop:bg-zinc-950/40 backdrop:backdrop-blur-xs"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-[#FF4F00]" />
            <h3
              id="checkout-dialog-title"
              className="font-display text-base font-bold tracking-tight text-zinc-900"
            >
              Hvor skal vi sende 3D-printen din?
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(false)}
            aria-label="Lukk bestillingsvindu"
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleConfirmOrder} method="POST" className="space-y-4 p-6">
          <div className="rounded-xl border border-zinc-200/80 bg-[#F6F6F3] p-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-2 font-semibold text-zinc-900">
              <span>Din bestilling</span>
              <span className="font-mono">
                {netPriceAfterCredit} kr + frakt {activeQuote.pricingBreakdown.shippingNok} kr
              </span>
            </div>
            <p className="mt-2 truncate text-zinc-600">{activeJob.prompt}</p>
            <div className="mt-1.5 flex flex-wrap gap-2.5 font-mono text-[11px] text-zinc-500">
              <span>
                {activeQuote.targetDimensionsMm.x} × {activeQuote.targetDimensionsMm.y} ×{' '}
                {activeQuote.targetDimensionsMm.z} mm
              </span>
              <span>•</span>
              <span>
                {activeQuote.filamentGrams}g {filamentSpec.shortLabel} ({colorName})
              </span>
            </div>
          </div>

          {!user && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              <span>Du handler som gjest. Vil du lagre ordren på kontoen din?</span>
              <button
                type="button"
                onClick={() => {
                  setIsCheckoutOpen(false);
                  openAuthModal();
                }}
                className="rounded-lg bg-white px-2.5 py-1 font-semibold text-zinc-900 shadow-nordic-sm"
              >
                Logg inn
              </button>
            </div>
          )}

          <div>
            <label
              htmlFor="shipping-full-name"
              className="mb-1.5 block text-xs font-semibold text-zinc-800"
            >
              Fullt navn
            </label>
            <input
              id="shipping-full-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              maxLength={100}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="shipping-email"
              className="mb-1.5 block text-xs font-semibold text-zinc-800"
            >
              E-post for ordresporing
            </label>
            <input
              id="shipping-email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 font-mono text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="shipping-street-address"
              className="mb-1.5 block text-xs font-semibold text-zinc-800"
            >
              Gateadresse
            </label>
            <textarea
              id="shipping-street-address"
              name="streetAddress"
              autoComplete="street-address"
              required
              rows={2}
              maxLength={300}
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 p-3.5 text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="shipping-postal-code"
                className="mb-1.5 block text-xs font-semibold text-zinc-800"
              >
                Postnummer
              </label>
              <input
                id="shipping-postal-code"
                name="postalCode"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                required
                maxLength={12}
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 font-mono text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="shipping-city"
                className="mb-1.5 block text-xs font-semibold text-zinc-800"
              >
                Poststed
              </label>
              <input
                id="shipping-city"
                name="city"
                type="text"
                autoComplete="address-level2"
                required
                maxLength={100}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-zinc-200 bg-[#F6F6F3]/60 px-3.5 py-2.5 text-base text-zinc-900 transition-colors focus:border-zinc-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {orderError && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800"
            >
              {orderError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsCheckoutOpen(false)}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isSubmittingOrder}
              className="rounded-xl bg-[#141413] px-6 py-3 text-xs font-semibold text-white shadow-nordic-sm transition-colors hover:bg-[#FF4F00] disabled:opacity-50"
            >
              {isSubmittingOrder
                ? 'Sender bestilling...'
                : `Fullfør bestilling (${netPriceAfterCredit + activeQuote.pricingBreakdown.shippingNok} kr inkl. frakt)`}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
