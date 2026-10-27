import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCLP, ivaBreakdown } from "@/lib/money";
import { formatRut } from "@/lib/rut";
import { fmtDiopter } from "@/lib/lenses";
import { fmtDateTime } from "@/lib/time";
import { PAYMENT_METHOD_LABEL, SALE_STATUS_LABEL, SALE_STATUS_STYLE } from "@/lib/labels";
import { requireContext } from "@/server/auth";
import { patientFullName } from "@/server/queries";
import { PaymentBox, PrintButton, VoidButton } from "@/components/sales/SaleActions";
import { WorkStatusBar } from "@/components/sales/WorkStatusBar";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";

type LensRx = { odSph: number; odCyl: number; odAxis: number | null; odAdd: number | null; oiSph: number; oiCyl: number; oiAxis: number | null; oiAdd: number | null } | null;

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const sale = await prisma.sale.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "asc" }, include: { branch: { select: { name: true } }, user: { select: { name: true } } } },
      patient: true,
      seller: { select: { name: true } },
      branch: true,
    },
  });
  if (!sale) notFound();
  const cash = await prisma.cashSession.findFirst({ where: { branchId: ctx.branch.id, closedAt: null }, select: { id: true } });
  const balance = sale.total - sale.paid;
  const { neto, iva } = ivaBreakdown(sale.total);

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`Venta N° ${sale.number}`}
          subtitle={`${fmtDateTime(sale.createdAt)} · ${sale.branch.name} · ${sale.seller.name}`}
          actions={<><Badge className={SALE_STATUS_STYLE[sale.status]}>{SALE_STATUS_LABEL[sale.status]}</Badge><PrintButton /></>}
        />
      </div>
      {sale.status === "ANULADA" && <div className="mb-4"><Alert>Venta anulada: {sale.voidReason}</Alert></div>}
      {sale.status !== "ANULADA" && (
        <Card title="Estado del trabajo" className="mb-6 print:hidden">
          <WorkStatusBar saleId={sale.id} status={sale.workStatus} balance={balance} />
          {sale.deliveredAt && <p className="mt-2 text-xs text-slate-500">Entregado el {fmtDateTime(sale.deliveredAt)}</p>}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 print:border-0 print:shadow-none">
          <div className="mb-4 hidden print:block">
            <div className="text-lg font-semibold">{ctx.orgName} · {sale.branch.name}</div>
            <div className="text-sm">Comprobante interno de venta N° {sale.number} · {fmtDateTime(sale.createdAt)}</div>
            <div className="text-xs">Documento no tributario. La boleta o factura electrónica se emite aparte.</div>
          </div>
          {sale.patient && (
            <p className="mb-4 text-sm">
              Paciente: <Link className="font-medium text-brand-700 hover:underline" href={`/pacientes/${sale.patient.id}`}>{patientFullName(sale.patient)}</Link>
              {sale.patient.rut && <span className="text-slate-500"> · {formatRut(sale.patient.rut)}</span>}
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200"><th className="py-2 pr-2">Detalle</th><th className="py-2 pr-2 text-right">Cant.</th><th className="py-2 pr-2 text-right">Precio</th><th className="py-2 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items.map((i) => {
                const rx = (i.lensConfig as { rx?: LensRx } | null)?.rx ?? null;
                return (
                  <tr key={i.id} className="align-top">
                    <td className="py-2.5 pr-2">
                      <div className="font-medium">{i.description}</div>
                      {i.code && <div className="font-mono text-xs text-slate-500">{i.code}</div>}
                      {rx && (
                        <div className="mt-1 font-mono text-xs text-slate-500">
                          OD {fmtDiopter(rx.odSph)} {rx.odCyl ? `${fmtDiopter(rx.odCyl)} x ${rx.odAxis}°` : ""} {rx.odAdd ? `Add ${fmtDiopter(rx.odAdd)}` : ""}<br />
                          OI {fmtDiopter(rx.oiSph)} {rx.oiCyl ? `${fmtDiopter(rx.oiCyl)} x ${rx.oiAxis}°` : ""} {rx.oiAdd ? `Add ${fmtDiopter(rx.oiAdd)}` : ""}
                        </div>
                      )}
                      {i.discount > 0 && <div className="text-xs text-emerald-700">Descuento −{formatCLP(i.discount)}</div>}
                    </td>
                    <td className="py-2.5 pr-2 text-right">{i.quantity}</td>
                    <td className="py-2.5 pr-2 text-right tabular-nums">{formatCLP(i.unitPrice)}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatCLP(i.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <dl className="ml-auto mt-4 w-64 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatCLP(sale.subtotal)}</dd></div>
            {sale.discount > 0 && <div className="flex justify-between text-emerald-700"><dt>Descuento</dt><dd className="tabular-nums">−{formatCLP(sale.discount)}</dd></div>}
            <div className="flex justify-between text-slate-500"><dt>Neto</dt><dd className="tabular-nums">{formatCLP(neto)}</dd></div>
            <div className="flex justify-between text-slate-500"><dt>IVA 19%</dt><dd className="tabular-nums">{formatCLP(iva)}</dd></div>
            <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatCLP(sale.total)}</dd></div>
            <div className="flex justify-between"><dt>Pagado</dt><dd className="tabular-nums">{formatCLP(sale.paid)}</dd></div>
            {sale.status === "ABIERTA" && <div className="flex justify-between font-semibold text-rose-600"><dt>Saldo</dt><dd className="tabular-nums">{formatCLP(balance)}</dd></div>}
          </dl>
          {sale.deliveryDate && <p className="mt-4 text-sm">Fecha de entrega comprometida: <b>{sale.deliveryDate.toISOString().slice(0, 10).split("-").reverse().join("-")}</b></p>}
        </Card>

        <div className="space-y-6 print:hidden">
          <Card title="Pagos">
            {sale.payments.length === 0 ? <p className="text-sm text-slate-500">Sin pagos registrados.</p> : (
              <ul className="space-y-2 text-sm">
                {sale.payments.map((p) => (
                  <li key={p.id} className={p.voided ? "text-slate-400 line-through" : ""}>
                    <div className="flex justify-between"><span>{PAYMENT_METHOD_LABEL[p.method]}</span><b className="tabular-nums">{formatCLP(p.amount)}</b></div>
                    <div className="text-xs text-slate-500">{fmtDateTime(p.createdAt)} · {p.branch.name} · {p.user.name}</div>
                  </li>
                ))}
              </ul>
            )}
            {sale.status === "ABIERTA" && <div className="mt-4"><PaymentBox saleId={sale.id} balance={balance} cashOpen={!!cash} /></div>}
          </Card>
          {ctx.user.role === "ADMIN" && sale.status !== "ANULADA" && <VoidButton saleId={sale.id} />}
        </div>
      </div>
    </>
  );
}
