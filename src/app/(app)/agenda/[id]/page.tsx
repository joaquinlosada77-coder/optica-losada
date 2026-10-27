import Link from "next/link";
import { notFound } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { setAppointmentStatus, updateAppointment } from "@/server/appointments";
import { branchProfessionals, patientFullName } from "@/server/queries";
import { buildSlots } from "@/lib/agenda";
import { formatRut } from "@/lib/rut";
import { fmtDateISO, fmtDateTime, fmtTime } from "@/lib/time";
import { APPT_STATUS_LABEL, APPT_STATUS_STYLE, APPT_TYPE_LABEL } from "@/lib/labels";
import { AppointmentForm } from "@/components/AppointmentForm";
import { Alert, Badge, Button, Card, PageHeader } from "@/components/ui";

// Transiciones habituales del flujo de recepción
const NEXT: Record<AppointmentStatus, AppointmentStatus[]> = {
  AGENDADA: ["CONFIRMADA", "EN_ATENCION", "NO_ASISTIO", "CANCELADA"],
  CONFIRMADA: ["EN_ATENCION", "NO_ASISTIO", "CANCELADA"],
  EN_ATENCION: ["ATENDIDA"],
  ATENDIDA: ["EN_ATENCION"],
  NO_ASISTIO: ["AGENDADA"],
  CANCELADA: ["AGENDADA"],
};

export default async function AppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const a = await prisma.appointment.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      patient: true,
      professional: { select: { name: true } },
      branch: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!a) notFound();

  const title = a.patient ? patientFullName(a.patient) : (a.contactName ?? "Cita");
  const date = fmtDateISO(a.startsAt);
  const editable = a.branchId === ctx.branch.id;

  const header = (
    <PageHeader
      title={title}
      subtitle={`${fmtDateTime(a.startsAt)} – ${fmtTime(a.endsAt)} · ${a.branch.name}`}
      actions={<Badge className={APPT_STATUS_STYLE[a.status]}>{APPT_STATUS_LABEL[a.status]}</Badge>}
    />
  );

  if (!editable) {
    return (
      <>
        {header}
        <Alert tone="info">
          Esta cita pertenece a la sucursal <b>{a.branch.name}</b>. Cámbiate a esa sucursal (selector superior) para modificarla.
        </Alert>
      </>
    );
  }

  const pros = await branchProfessionals(ctx.orgId, ctx.branch.id);
  const slots = buildSlots(ctx.branch.openTime, ctx.branch.closeTime, ctx.branch.slotMinutes);
  const duration = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60000);

  return (
    <>
      {header}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card title="Estado" className="lg:col-span-2">
          <div className="flex flex-wrap gap-2">
            {NEXT[a.status].map((s) => (
              <form key={s} action={setAppointmentStatus}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="status" value={s} />
                <input type="hidden" name="returnTo" value={`/agenda/${a.id}`} />
                <Button variant={s === "CANCELADA" || s === "NO_ASISTIO" ? "danger" : "secondary"}>
                  Marcar {APPT_STATUS_LABEL[s].toLowerCase()}
                </Button>
              </form>
            ))}
          </div>
        </Card>
        <Card title="Detalle">
          <dl className="space-y-1 text-sm">
            <div><dt className="inline text-slate-500">Motivo: </dt><dd className="inline">{APPT_TYPE_LABEL[a.type]}</dd></div>
            <div><dt className="inline text-slate-500">Profesional: </dt><dd className="inline">{a.professional?.name ?? "Sin asignar"}</dd></div>
            <div><dt className="inline text-slate-500">Agendada por: </dt><dd className="inline">{a.createdBy.name}</dd></div>
            {a.patient && (
              <div className="pt-2">
                <Link href={`/pacientes/${a.patient.id}`} className="text-brand-600 hover:underline">Ver ficha del paciente →</Link>
              </div>
            )}
          </dl>
        </Card>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Reagendar / editar</h2>
      <AppointmentForm
        action={updateAppointment.bind(null, a.id)}
        professionals={pros}
        slots={slots}
        cancelHref={`/agenda?fecha=${date}`}
        submitLabel="Guardar cambios"
        defaults={{
          date,
          time: fmtTime(a.startsAt),
          duration,
          professionalId: a.professionalId,
          patient: a.patient
            ? { id: a.patient.id, name: patientFullName(a.patient), doc: a.patient.rut ? formatRut(a.patient.rut) : (a.patient.documentoExtranjero ?? ""), phone: a.patient.telefono }
            : null,
          contactName: a.contactName,
          contactPhone: a.contactPhone,
          type: a.type,
          notes: a.notes,
        }}
      />
    </>
  );
}
