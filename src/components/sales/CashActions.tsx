"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCLP } from "@/lib/money";
import { closeCash, openCash } from "@/server/sales";
import { Keypad } from "@/components/pos/Keypad";
import { cx } from "@/components/ui";

export function OpenCashForm() {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto max-w-sm space-y-3">
      <p className="text-sm text-slate-600">Ingresa el fondo de caja (efectivo inicial):</p>
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-right text-3xl font-bold tabular-nums">{formatCLP(Number(amount || 0))}</div>
      <Keypad value={amount} onChange={setAmount} />
      {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      <button
        disabled={pending}
        onClick={() => start(async () => { const r = await openCash(Number(amount || 0)); if (r.ok) router.refresh(); else setError(r.error); })}
        className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white active:scale-95 disabled:opacity-60"
      >
        Abrir caja
      </button>
    </div>
  );
}

export function CloseCashForm({ expectedCash }: { expectedCash: number }) {
  const router = useRouter();
  const [counted, setCounted] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const diff = Number(counted || 0) - expectedCash;
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">Cuenta el efectivo y digítalo:</p>
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-right text-3xl font-bold tabular-nums">{formatCLP(Number(counted || 0))}</div>
      <Keypad value={counted} onChange={setCounted} />
      {counted !== "" && (
        <p className={cx("rounded-lg p-3 text-center font-semibold", diff === 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700")}>
          {diff === 0 ? "Caja cuadrada" : diff > 0 ? `Sobrante ${formatCLP(diff)}` : `Faltante ${formatCLP(-diff)}`}
        </p>
      )}
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones (opcional)" className="h-12 w-full rounded-xl border border-slate-300 px-3" />
      {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      <button
        disabled={pending || counted === ""}
        onClick={() => {
          if (diff !== 0 && !window.confirm(`Hay una diferencia de ${formatCLP(diff)}. ¿Cerrar igual?`)) return;
          start(async () => { const r = await closeCash(Number(counted), notes || null); if (r.ok) router.refresh(); else setError(r.error); });
        }}
        className="h-14 w-full rounded-xl bg-slate-900 text-lg font-semibold text-white active:scale-95 disabled:opacity-50"
      >
        Cerrar caja
      </button>
    </div>
  );
}
