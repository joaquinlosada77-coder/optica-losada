import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { createAppointment } from "@/server/appointments";
import { branchProfessionals, patientFullName } from "@/server/queries";
import { buildSlots } from "@/lib/agenda";
import { formatRut } from "@/lib/rut";
import { todayISO } from "@/lib/time";
import { AppointmentForm } from "@/components/AppointmentForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Nueva cita" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; hora?: string; pro?: string; patientId?: string }>;
}) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const pros = await branchProfessionals(ctx.orgId, ctx.branch.id);
  const slots = buildSlots(ctx.branch.openTime, ctx.branch.closeTime, ctx.branch.slotMinutes);
  const patient = sp.patientId
    ? await prisma.patient.findFirst({ where: { id: sp.patientId, orgId: ctx.orgId } })
    : null;
  const date = sp.fecha && /^\d{4}-\d{2}-\d{2}$/.test(sp.fecha) ? sp.fecha : todayISO();
  const time = sp.hora && /^\d{2}:\d{2}$/.test(sp.hora) ? sp.hora : slots[0] ?? "10:00";

  return (
    <>
      <PageHeader title="Nueva cita" subtitle={ctx.branch.name} />
      <AppointmentForm
        action={createAppointment}
        professionals={pros}
        slots={slots}
        cancelHref={`/agenda?fecha=${date}`}
        defaults={{
          date,
          time,
          duration: ctx.branch.slotMinutes,
          professionalId: sp.pro ?? (pros.length === 1 ? pros[0].id : null),
          patient: patient
            ? { id: patient.id, name: patientFullName(patient), doc: patient.rut ? formatRut(patient.rut) : (patient.documentoExtranjero ?? ""), phone: patient.telefono }
            : null,
        }}
      />
    </>
  );
}
