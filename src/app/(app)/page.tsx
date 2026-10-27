import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { dayAppointments, patientFullName } from "@/server/queries";
import { fmtDateLong, fmtTime, localToUtc, todayISO } from "@/lib/time";
import { APPT_STATUS_LABEL, APPT_STATUS_STYLE, APPT_TYPE_LABEL } from "@/lib/labels";
import { salesKpis } from "@/server/reports";
import { allowedWidgets, resolveWidgets, type WidgetKey } from "@/lib/dashboard";
import { BranchSalesTable, Kpi, isKpiKey, type KpiKey } from "@/components/SalesPanel";
import { EditDashboard } from "@/components/EditDashboardButton";
import { Alert, Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const ctx = await requireContext();
  const today = todayISO();
  const isAdmin = ctx.user.role === "ADMIN";
  const me = await prisma.user.findUniqueOrThrow({ where: { id: ctx.user.id }, select: { dashboardWidgets: true } });
  const widgets = resolveWidgets(me.dashboardWidgets, isAdmin);
  const needsSales = widgets.some((w) => isKpiKey(w) || w === "byBranch");
  const [kpis, appts, patientCount, newThisMonth] = await Promise.all([
    needsSales ? salesKpis(ctx.orgId, ctx.branches) : null,
    dayAppointments(ctx.orgId, ctx.branch.id, today),
    prisma.patient.count({ where: { orgId: ctx.orgId, active: true } }),
    prisma.patient.count({
      where: { orgId: ctx.orgId, homeBranchId: ctx.branch.id, createdAt: { gte: localToUtc(`${today.slice(0, 7)}-01`, "00:00") } },
    }),
  ]);
  const active = appts.filter((a) => a.status !== "CANCELADA");
  const pending = active.filter((a) => a.status === "AGENDADA").length;

  return (
    <>
      <PageHeader
        title={`Hola, ${ctx.user.name.split(" ")[0]}`}
        subtitle={<span className="inline-block first-letter:uppercase">{fmtDateLong(today)} · {ctx.branch.name}</span>}
        actions={
          <>
            <LinkButton href="/pacientes/nuevo" variant="secondary">+ Paciente</LinkButton>
            <LinkButton href={`/agenda/nueva?fecha=${today}`} variant="secondary">+ Cita</LinkButton>
            <LinkButton href="/ventas/nueva">Vender</LinkButton>
            <EditDashboard current={widgets} allowed={allowedWidgets(isAdmin)} />
          </>
        }
      />
      {error === "sin-permiso" && <div className="mb-4"><Alert>No tienes permiso para acceder a esa sección.</Alert></div>}

      {groupWidgets(widgets).map((g) =>
        Array.isArray(g) ? (
          kpis && (
            <div key={g.join()} className="mb-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {g.map((kind) => <Kpi key={kind} k={kpis} kind={kind} />)}
            </div>
          )
        ) : g === "byBranch" ? (
          kpis && <div key={g} className="mb-6"><BranchSalesTable k={kpis} /></div>
        ) : g === "apptStats" ? (
          <div key={g} className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Citas hoy" value={active.length} />
            <Stat label="Por confirmar" value={pending} />
            <Stat label="Pacientes nuevos (mes, sucursal)" value={newThisMonth} sub={`${patientCount} en total`} />
          </div>
        ) : (
          <Card key={g} className="mb-6" title="Agenda de hoy" actions={<Link href="/agenda" className="text-sm text-brand-600 hover:underline">Ver agenda →</Link>}>
            {appts.length === 0 ? (
              <Empty>No hay citas agendadas para hoy.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100">
                {appts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-4 py-3">
                    <span className="w-24 font-mono text-sm text-slate-600">{fmtTime(a.startsAt)}–{fmtTime(a.endsAt)}</span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/agenda/${a.id}`} className="font-medium hover:underline">
                        {a.patient ? patientFullName(a.patient) : a.contactName}
                      </Link>
                      <span className="block text-xs text-slate-500">
                        {APPT_TYPE_LABEL[a.type]}{a.professional ? ` · ${a.professional.name}` : ""}
                      </span>
                    </span>
                    <Badge className={APPT_STATUS_STYLE[a.status]}>{APPT_STATUS_LABEL[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ),
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

/** Agrupa indicadores consecutivos en una misma fila; el resto va como bloque propio. */
function groupWidgets(ws: WidgetKey[]): (KpiKey[] | Exclude<WidgetKey, KpiKey>)[] {
  const out: (KpiKey[] | Exclude<WidgetKey, KpiKey>)[] = [];
  for (const w of ws) {
    if (isKpiKey(w)) {
      const last = out[out.length - 1];
      if (Array.isArray(last)) last.push(w);
      else out.push([w]);
    } else out.push(w);
  }
  return out;
}
