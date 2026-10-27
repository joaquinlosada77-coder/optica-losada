"use client";

import { useState, useTransition } from "react";
import { WIDGETS, type WidgetKey } from "@/lib/dashboard";
import { resetDashboard, saveDashboard } from "@/server/dashboard";
import { Button, cx } from "@/components/ui";

/** Editor del panel: activar/desactivar bloques y cambiar su orden con botones grandes. */
export function DashboardEditor({ current, allowed, onDone }: { current: WidgetKey[]; allowed: WidgetKey[]; onDone?: () => void }) {
  const [order, setOrder] = useState<WidgetKey[]>([...current, ...allowed.filter((k) => !current.includes(k))]);
  const [on, setOn] = useState<Set<WidgetKey>>(new Set(current));
  const [pending, start] = useTransition();

  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-5 shadow-sm">
      <div className="mb-3 text-sm font-semibold">Personaliza tu panel: marca lo que quieres ver y ordénalo.</div>
      <ul className="space-y-2">
        {order.map((k, i) => (
          <li key={k} className={cx("flex items-center gap-3 rounded-lg border p-2", on.has(k) ? "border-brand-100 bg-brand-50/50" : "border-slate-200 opacity-60")}>
            <label className="flex flex-1 items-center gap-3">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={on.has(k)}
                onChange={(e) => setOn((s) => { const n = new Set(s); if (e.target.checked) n.add(k); else n.delete(k); return n; })}
              />
              {WIDGETS[k].label}
            </label>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="h-10 w-10 rounded-lg border border-slate-300 disabled:opacity-30" aria-label="Subir">▲</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1} className="h-10 w-10 rounded-lg border border-slate-300 disabled:opacity-30" aria-label="Bajar">▼</button>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={pending} onClick={() => start(async () => { await saveDashboard(order.filter((k) => on.has(k))); onDone?.(); })}>
          Guardar panel
        </Button>
        <Button variant="secondary" disabled={pending} onClick={() => start(async () => { await resetDashboard(); onDone?.(); })}>
          Volver al panel original
        </Button>
        <Button variant="ghost" onClick={onDone}>Cancelar</Button>
      </div>
    </div>
  );
}
