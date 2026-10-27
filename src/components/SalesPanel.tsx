import { formatCLP } from "@/lib/money";
import type { WidgetKey } from "@/lib/dashboard";
import type { SalesKpis } from "@/server/reports";

const range = (a: string, b: string) => `${a.split("-").reverse().join("-")} – ${b.split("-").reverse().join("-")}`;

export const KPI_KEYS = ["dayGross", "weekGross", "monthGross", "atv", "collected30", "debt30"] as const satisfies readonly WidgetKey[];
export type KpiKey = (typeof KPI_KEYS)[number];

export function isKpiKey(k: WidgetKey): k is KpiKey {
  return (KPI_KEYS as readonly string[]).includes(k);
}

export function Kpi({ k, kind }: { k: SalesKpis; kind: KpiKey }) {
  const atv = k.dayOps ? Math.round(k.dayGross / k.dayOps) : 0;
  const def: Record<KpiKey, { label: string; value: number; period: string; tone?: "good" | "bad" }> = {
    dayGross: { label: "Venta día", value: k.dayGross, period: range(k.today, k.today) },
    weekGross: { label: "Venta semana", value: k.weekGross, period: range(k.weekStart, k.today) },
    monthGross: { label: "Venta mes", value: k.monthGross, period: range(k.monthStart, k.today) },
    atv: { label: "Ticket medio día", value: atv, period: `${k.dayOps} operaciones` },
    collected30: { label: "Cobrado 30 días", value: k.collected30, period: range(k.thirtyStart, k.today), tone: "good" },
    debt30: { label: "Deuda 30 días", value: k.debt30, period: "Saldos de ventas con abono", tone: k.debt30 ? "bad" : undefined },
  };
  const d = def[kind];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold">{d.label}</div>
      <div className="text-xs text-slate-400">{d.period}</div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${d.tone === "bad" ? "text-rose-600" : d.tone === "good" ? "text-emerald-700" : ""}`}>
        {formatCLP(d.value)}
      </div>
    </div>
  );
}

export function BranchSalesTable({ k }: { k: SalesKpis }) {
  const atv = k.dayOps ? Math.round(k.dayGross / k.dayOps) : 0;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr className="border-b border-slate-200">
            <th className="px-4 py-2">Ventas de hoy por local</th>
            <th className="px-4 py-2 text-right">N° operaciones</th>
            <th className="px-4 py-2 text-right">Importe total</th>
            <th className="px-4 py-2 text-right">Ticket medio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {k.byBranch.map((b) => (
            <tr key={b.branchId}>
              <td className="px-4 py-2.5">{b.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{b.ops}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatCLP(b.gross)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatCLP(b.ops ? Math.round(b.gross / b.ops) : 0)}</td>
            </tr>
          ))}
          <tr className="bg-slate-50 font-semibold">
            <td className="px-4 py-2.5">Total</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{k.dayOps}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatCLP(k.dayGross)}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{formatCLP(atv)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
