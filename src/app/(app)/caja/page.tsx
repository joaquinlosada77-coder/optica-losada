import Link from "next/link";
import type { Metadata } from "next";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { fmtDateTime, fmtTime } from "@/lib/time";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { requireContext } from "@/server/auth";
import { CloseCashForm, OpenCashForm } from "@/components/sales/CashActions";
import { Card, Empty, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Caja" };

export default async function CashPage() {
  const ctx = await requireContext();
  const [session, history] = await Promise.all([
    prisma.cashSession.findFirst({
      where: { branchId: ctx.branch.id, closedAt: null },
      include: {
        openedBy: { select: { name: true } },
        payments: { where: { voided: false }, orderBy: { createdAt: "desc" }, include: { sale: { select: { id: true, number: true, branch: { select: { name: true } } } } } },
      },
    }),
    prisma.cashSession.findMany({
      where: { branchId: ctx.branch.id, closedAt: { not: null } },
      orderBy: { closedAt: "desc" },
      take: 10,
      include: { closedBy: { select: { name: true } } },
    }),
  ]);

  const byMethod = new Map<PaymentMethod, number>();
  for (const p of session?.payments ?? []) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
  const expectedCash = (session?.openingAmount ?? 0) + (byMethod.get("EFECTIVO") ?? 0);
  const totalIn = [...byMethod.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader title="Caja" subtitle={ctx.branch.name} />
      {!session ? (
        <Card title="Caja cerrada"><OpenCashForm /></Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title={`Caja abierta · ${fmtDateTime(session.openedAt)} por ${session.openedBy.name}`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Tile label="Fondo inicial" value={session.openingAmount} />
                <Tile label="Total cobrado" value={totalIn} />
                <Tile label="Efectivo esperado" value={expectedCash} strong />
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-5">
                {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                  <div key={m} className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="text-slate-500">{PAYMENT_METHOD_LABEL[m]}</div>
                    <div className="font-semibold tabular-nums">{formatCLP(byMethod.get(m) ?? 0)}</div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Movimientos">
              {session.payments.length === 0 ? <Empty>Aún no hay cobros en esta caja.</Empty> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {session.payments.map((p) => (
                    <li key={p.id} className="flex justify-between py-2">
                      <span>
                        {fmtTime(p.createdAt)} · {PAYMENT_METHOD_LABEL[p.method]} ·{" "}
                        <Link className="text-brand-700 hover:underline" href={`/ventas/${p.sale.id}`}>venta {p.sale.number} ({p.sale.branch.name})</Link>
                      </span>
                      <b className="tabular-nums">{formatCLP(p.amount)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card title="Cierre de caja"><CloseCashForm expectedCash={expectedCash} /></Card>
        </div>
      )}

      {history.length > 0 && (
        <Card title="Cierres anteriores" className="mt-6">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr className="border-b border-slate-200"><th className="py-2">Cierre</th><th>Por</th><th className="text-right">Esperado</th><th className="text-right">Contado</th><th className="text-right">Diferencia</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((h) => {
                const d = (h.countedCash ?? 0) - (h.expectedCash ?? 0);
                return (
                  <tr key={h.id}>
                    <td className="py-2">{fmtDateTime(h.closedAt!)}</td><td>{h.closedBy?.name}</td>
                    <td className="text-right tabular-nums">{formatCLP(h.expectedCash ?? 0)}</td>
                    <td className="text-right tabular-nums">{formatCLP(h.countedCash ?? 0)}</td>
                    <td className={`text-right tabular-nums ${d === 0 ? "" : "font-semibold text-rose-600"}`}>{formatCLP(d)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function Tile({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${strong ? "bg-brand-50" : "bg-slate-50"}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{formatCLP(value)}</div>
    </div>
  );
}
