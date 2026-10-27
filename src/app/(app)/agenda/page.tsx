import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/server/auth";
import { branchProfessionals, dayAppointments, patientFullName } from "@/server/queries";
import { buildSlots, slotSpan } from "@/lib/agenda";
import { fmtDateLong, fmtTime, localToUtc, shiftDayISO, todayISO } from "@/lib/time";
import { APPT_STATUS_LABEL, APPT_STATUS_STYLE, APPT_TYPE_LABEL } from "@/lib/labels";
import { Alert, Card, LinkButton, PageHeader, cx, inputCls } from "@/components/ui";

export const metadata: Metadata = { title: "Agenda" };

const UNASSIGNED = "_";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ fecha?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const date = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : todayISO();
  const { branch } = ctx;

  const [pros, appts] = await Promise.all([
    branchProfessionals(ctx.orgId, branch.id),
    dayAppointments(ctx.orgId, branch.id, date),
  ]);

  const slots = buildSlots(branch.openTime, branch.closeTime, branch.slotMinutes);
  const dayOpen = localToUtc(date, branch.openTime);
  const dayClose = localToUtc(date, branch.closeTime);

  const visible = appts.filter((a) => a.status !== "CANCELADA");
  const cancelled = appts.filter((a) => a.status === "CANCELADA");
  const inGrid = visible.filter((a) => a.startsAt >= dayOpen && a.startsAt < dayClose);
  const outside = visible.filter((a) => !inGrid.includes(a));

  const columns = [...pros];
  if (inGrid.some((a) => !a.professionalId || !pros.some((p) => p.id === a.professionalId)) || pros.length === 0) {
    columns.push({ id: UNASSIGNED, name: "Sin asignar" });
  }
  const colOf = (proId: string | null) => {
    const i = columns.findIndex((c) => c.id === proId);
    return (i === -1 ? columns.length - 1 : i) + 2; // col 1 = horas
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={<span className="inline-block first-letter:uppercase">{fmtDateLong(date)} · {branch.name}</span>}
        actions={<LinkButton href={`/agenda/nueva?fecha=${date}`}>+ Nueva cita</LinkButton>}
      />
      {sp.error === "traslape" && <div className="mb-4"><Alert>No se pudo reactivar: el bloque ya está ocupado por otra cita.</Alert></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <LinkButton variant="secondary" href={`/agenda?fecha=${shiftDayISO(date, -1)}`} aria-label="Día anterior">←</LinkButton>
        <LinkButton variant="secondary" href={`/agenda?fecha=${todayISO()}`}>Hoy</LinkButton>
        <LinkButton variant="secondary" href={`/agenda?fecha=${shiftDayISO(date, 1)}`} aria-label="Día siguiente">→</LinkButton>
        <form className="ml-2 flex gap-1">
          <input type="date" name="fecha" defaultValue={date} className={cx(inputCls, "w-auto")} />
          <button className="rounded-lg border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50">Ir</button>
        </form>
        <span className="ml-auto text-sm text-slate-500">{visible.length} citas · bloques de {branch.slotMinutes} min</span>
      </div>

      {outside.length > 0 && (
        <Card title="Fuera del horario de la sucursal" className="mb-4">
          <ul className="space-y-1 text-sm">
            {outside.map((a) => (
              <li key={a.id}>
                <Link className="hover:underline" href={`/agenda/${a.id}`}>
                  {fmtTime(a.startsAt)} · {a.patient ? patientFullName(a.patient) : a.contactName} ({a.professional?.name ?? "sin asignar"})
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          className="relative grid min-w-max"
          style={{
            gridTemplateColumns: `4.5rem repeat(${columns.length}, minmax(12rem, 1fr))`,
            gridTemplateRows: `2.75rem repeat(${slots.length}, 3rem)`,
          }}
        >
          <div className="sticky left-0 z-20 border-b border-slate-200 bg-white" />
          {columns.map((c, i) => (
            <div key={c.id} style={{ gridColumn: i + 2, gridRow: 1 }} className="flex items-center border-b border-l border-slate-200 px-3 text-sm font-semibold">
              {c.name}
            </div>
          ))}

          {slots.map((s, r) => (
            <div key={s} style={{ gridColumn: 1, gridRow: r + 2 }} className="sticky left-0 z-10 border-b border-slate-100 bg-white pr-2 pt-1 text-right font-mono text-xs text-slate-400">
              {s}
            </div>
          ))}
          {columns.map((c, ci) =>
            slots.map((s, r) => (
              <Link
                key={`${c.id}-${s}`}
                href={`/agenda/nueva?fecha=${date}&hora=${s}${c.id !== UNASSIGNED ? `&pro=${c.id}` : ""}`}
                style={{ gridColumn: ci + 2, gridRow: r + 2 }}
                className="group border-b border-l border-slate-100 hover:bg-brand-50"
                aria-label={`Agendar ${s} con ${c.name}`}
              >
                <span className="hidden p-1 text-xs text-brand-600 group-hover:block">+ {s}</span>
              </Link>
            )),
          )}

          {inGrid.map((a) => {
            const startRow = Math.floor((a.startsAt.getTime() - dayOpen.getTime()) / 60000 / branch.slotMinutes) + 2;
            const span = Math.min(slotSpan(a.startsAt, a.endsAt, branch.slotMinutes), slots.length + 2 - startRow);
            return (
              <Link
                key={a.id}
                href={`/agenda/${a.id}`}
                style={{ gridColumn: colOf(a.professionalId), gridRow: `${startRow} / span ${span}` }}
                className={cx("z-10 m-0.5 overflow-hidden rounded-md border-l-4 px-2 py-1 text-xs shadow-sm hover:brightness-95", APPT_STATUS_STYLE[a.status])}
              >
                <div className="font-semibold">
                  {fmtTime(a.startsAt)} {a.patient ? patientFullName(a.patient) : a.contactName}
                </div>
                <div className="opacity-80">{APPT_TYPE_LABEL[a.type]} · {APPT_STATUS_LABEL[a.status]}</div>
              </Link>
            );
          })}
        </div>
      </div>

      {cancelled.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Canceladas hoy:{" "}
          {cancelled.map((a, i) => (
            <span key={a.id}>
              {i > 0 && ", "}
              <Link href={`/agenda/${a.id}`} className="underline">
                {fmtTime(a.startsAt)} {a.patient ? patientFullName(a.patient) : a.contactName}
              </Link>
            </span>
          ))}
        </p>
      )}
    </>
  );
}
