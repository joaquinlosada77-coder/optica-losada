"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WorkStatus } from "@prisma/client";
import { formatCLP } from "@/lib/money";
import { WORK_STATUS_FLOW, WORK_STATUS_LABEL } from "@/lib/labels";
import { setWorkStatus } from "@/server/sales";
import { cx } from "@/components/ui";

/** Barra táctil del estado del trabajo: se toca la etapa a la que pasa la venta. */
export function WorkStatusBar({ saleId, status, balance }: { saleId: string; status: WorkStatus; balance: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = WORK_STATUS_FLOW.indexOf(status);

  const go = (s: WorkStatus) => {
    if (s === status) return;
    if (s === "ENTREGADO" && balance > 0 && !window.confirm(`Queda un saldo de ${formatCLP(balance)}. ¿Entregar igual?`)) return;
    start(async () => {
      const r = await setWorkStatus(saleId, s);
      if (r.ok) router.refresh(); else setError(r.error);
    });
  };

  return (
    <div>
      <ol className="grid grid-cols-5 gap-1">
        {WORK_STATUS_FLOW.map((s, i) => (
          <li key={s}>
            <button
              disabled={pending}
              onClick={() => go(s)}
              className={cx(
                "flex h-16 w-full flex-col items-center justify-center rounded-lg px-1 text-center text-xs font-medium leading-tight active:scale-95",
                i < current && "bg-brand-100 text-brand-900",
                i === current && "bg-brand-600 text-white shadow",
                i > current && "border border-slate-200 bg-white text-slate-500",
              )}
            >
              <span className="text-base">{i < current ? "✓" : i + 1}</span>
              {WORK_STATUS_LABEL[s]}
            </button>
          </li>
        ))}
      </ol>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
