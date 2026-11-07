'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  Clock,
  Cpu,
  FileCode2,
  Lock,
  Package,
  RefreshCw,
  Truck,
} from 'lucide-react';
import type { OrderStatus, PrintOrderDocument } from '@/lib/schemas/forge';
import { useAuth } from '@/components/providers/AuthProvider';

const STATUS_BADGE_MAP: Record<
  OrderStatus,
  { label: string; style: string; icon: React.ReactNode }
> = {
  pending_review: {
    label: 'Venter på G-code-sjekk',
    style: 'bg-amber-500/10 text-amber-800 border-amber-200',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  slicing_verified: {
    label: 'Slicing verifisert • I kø',
    style: 'bg-emerald-500/10 text-emerald-800 border-emerald-200',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  printing_on_bambu: {
    label: 'Printer nå på Bambu X1C',
    style: 'bg-[#FF4F00]/10 text-[#FF4F00] border-[#FF4F00]/20',
    icon: <Cpu className="h-3.5 w-3.5" />,
  },
  shipped: {
    label: 'Ferdig printet & sendt',
    style: 'bg-zinc-900 text-white border-zinc-900',
    icon: <Truck className="h-3.5 w-3.5" />,
  },
};

export default function OrdersHistoryPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PrintOrderDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const query = user?.uid ? `?uid=${encodeURIComponent(user.uid)}` : '';
      const res = await fetch(`/api/orders/create${query}`);
      const data = (await res.json()) as { orders?: PrintOrderDocument[] };
      if (data.orders) {
        setOrders(data.orders);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200/90 bg-white px-6 py-5 shadow-nordic">
        <div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] font-medium text-zinc-600">
            Produksjonslogg • Immutable Snapshots
          </span>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-zinc-900">
            Ordrehistorikk & Bambu Print-Farm Status
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void fetchOrders()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-[#F6F6F3] px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-white hover:text-zinc-900"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Oppdater</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#141413] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF4F00]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Tilbake til konfigurator</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-12 text-center font-mono text-xs text-zinc-500 shadow-nordic">
          Henter låste print-snapshots...
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-12 text-center shadow-nordic">
          <Package className="mx-auto h-9 w-9 text-zinc-400" />
          <h2 className="mt-3 font-display text-base font-bold text-zinc-900">
            Ingen bestillinger funnet ennå
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Konfigurer en 3D-modell i studioet for å opprette din første print-bestilling.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const badge = STATUS_BADGE_MAP[order.orderStatus];
            const snap = order.quoteSnapshot;
            const hours = Math.floor(snap.printTimeSeconds / 3600);
            const mins = Math.round((snap.printTimeSeconds % 3600) / 60);

            return (
              <article
                key={order.id}
                className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-nordic"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-[#F6F6F3]/60 px-6 py-3.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-lg bg-zinc-900 px-2.5 py-1 font-mono text-xs font-semibold text-white">
                      {order.id}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                      <Lock className="h-3.5 w-3.5 text-zinc-400" />
                      Snapshot: {snap.quoteId}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-mono text-[11px] font-medium text-zinc-600">
                      Celle: {order.bambuPrinterId}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${badge.style}`}
                    >
                      {badge.icon}
                      {badge.label}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 divide-y divide-zinc-100 p-6 md:grid-cols-12 md:divide-x md:divide-y-0">
                  <div className="space-y-2 pr-4 md:col-span-6">
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-400">
                      <Box className="h-3.5 w-3.5 text-[#FF4F00]" />
                      <span>Modell & spesifikasjon</span>
                    </div>
                    <p className="font-display text-base font-bold text-zinc-900">{snap.prompt}</p>
                    <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] text-zinc-600">
                      <span className="rounded-md bg-[#F6F6F3] px-2.5 py-1">
                        {snap.proceduralPreset}
                      </span>
                      <span className="rounded-md bg-[#F6F6F3] px-2.5 py-1">
                        {snap.targetDimensionsMm.x} × {snap.targetDimensionsMm.y} ×{' '}
                        {snap.targetDimensionsMm.z} mm
                      </span>
                      <span className="rounded-md bg-[#F6F6F3] px-2.5 py-1">
                        {snap.layerCount} lag ({snap.layerQuality})
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1 font-mono text-[11px] text-zinc-400">
                      <FileCode2 className="h-3.5 w-3.5" />
                      <span>{snap.sliced3mfStoragePath}</span>
                    </div>
                  </div>

                  <div className="space-y-2 py-4 md:col-span-3 md:px-5 md:py-0">
                    <span className="block text-xs font-medium text-zinc-400">
                      Materiale & leveranse
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-black/15"
                        style={{ backgroundColor: snap.colorHex }}
                      />
                      <span className="text-xs font-semibold text-zinc-900">
                        {snap.materialLabel}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-zinc-600">
                      {snap.filamentGrams}g • {hours}t {mins}m printtid
                    </p>
                    <p className="text-xs text-zinc-500">
                      {order.shippingAddress.fullName}, {order.shippingAddress.postalCode}{' '}
                      {order.shippingAddress.city}
                    </p>
                  </div>

                  <div className="flex flex-col justify-between pt-4 md:col-span-3 md:pl-5 md:pt-0">
                    <div>
                      <span className="block text-xs font-medium text-zinc-400">
                        Låst pris (Pay-Per-Model)
                      </span>
                      <span className="mt-0.5 block font-mono text-2xl font-bold text-zinc-900">
                        {snap.calculatedPriceNok} kr
                      </span>
                      <span className="block font-mono text-[11px] text-zinc-500">
                        Totalt inkl. frakt ({snap.shippingNok} kr): {snap.totalChargedNok} kr
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {new Date(order.createdAt).toLocaleString('nb-NO')}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
