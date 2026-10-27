import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { fmtDateTime } from "@/lib/time";
import { SALE_STATUS_LABEL, SALE_STATUS_STYLE, WORK_STATUS_LABEL, WORK_STATUS_STYLE } from "@/lib/labels";
import { requireContext } from "@/server/auth";
import { patientFullName } from "@/server/queries";
import { Badge, Card, Empty, LinkButton, PageHeader, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Ventas" };

const FILTERS = {
  todas: "Todas",
  curso: "Trabajos en curso",
  disponibles: "Disponibles para retiro",
  saldo: "Con saldo pendiente",
  anuladas: "Anuladas",
} as const;

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f = "todas" } = await searchParams;
  const ctx = await requireContext();
  const where: Prisma.SaleWhereInput = { orgId: ctx.orgId, branchId: ctx.branch.id };
  if (f === "saldo") where.status = "ABIERTA";
  if (f === "anuladas") where.status = "ANULADA";
  if (f === "curso") Object.assign(where, { status: { not: "ANULADA" }, workStatus: { in: ["PENDIENTE", "LABORATORIO", "MONTAJE"] } });
  if (f === "disponibles") Object.assign(where, { status: { not: "ANULADA" }, workStatus: "DISPONIBLE" });
  const sales = await prisma.sale.findMany({
    where,
    // Los trabajos se ordenan por fecha comprometida; el resto, por más reciente
    orderBy: f === "curso" || f === "disponibles" ? [{ deliveryDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }] : { createdAt: "desc" },
    take: 100,
    include: { patient: true, seller: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="Ventas" subtitle={ctx.branch.name} actions={<LinkButton href="/ventas/nueva">+ Nueva venta</LinkButton>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([k, v]) => (
          <Link key={k} href={`/ventas?f=${k}`} className={cx("rounded-full px-4 py-2 text-sm", f === k ? "bg-slate-900 text-white" : "border border-slate-300 bg-white")}>{v}</Link>
        ))}
      </div>
      <Card>
        {sales.length === 0 ? <Empty>No hay ventas.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4">N°</th><th className="py-2 pr-4">Fecha</th><th className="py-2 pr-4">Paciente</th><th className="py-2 pr-4">Vendedor</th>
                  <th className="py-2 pr-4">Entrega</th><th className="py-2 pr-4">Trabajo</th>
                  <th className="py-2 pr-4 text-right">Total</th><th className="py-2 pr-4 text-right">Saldo</th><th className="py-2">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4"><Link className="font-semibold text-brand-700 hover:underline" href={`/ventas/${s.id}`}>{s.number}</Link></td>
                    <td className="py-2.5 pr-4">{fmtDateTime(s.createdAt)}</td>
                    <td className="py-2.5 pr-4">{s.patient ? patientFullName(s.patient) : "—"}</td>
                    <td className="py-2.5 pr-4">{s.seller.name}</td>
                    <td className="py-2.5 pr-4">{s.deliveryDate ? s.deliveryDate.toISOString().slice(0, 10).split("-").reverse().join("-") : "—"}</td>
                    <td className="py-2.5 pr-4">{s.status !== "ANULADA" && <Badge className={WORK_STATUS_STYLE[s.workStatus]}>{WORK_STATUS_LABEL[s.workStatus]}</Badge>}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{formatCLP(s.total)}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{s.status === "ABIERTA" ? formatCLP(s.total - s.paid) : "—"}</td>
                    <td className="py-2.5"><Badge className={SALE_STATUS_STYLE[s.status]}>{SALE_STATUS_LABEL[s.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
