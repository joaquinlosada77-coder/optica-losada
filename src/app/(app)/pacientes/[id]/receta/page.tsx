import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { todayISO } from "@/lib/time";
import { requireContext } from "@/server/auth";
import { createPrescription } from "@/server/prescriptions";
import { patientFullName } from "@/server/queries";
import { PrescriptionForm } from "@/components/PrescriptionForm";
import { PageHeader } from "@/components/ui";

export default async function NewPrescriptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const ctx = await requireContext();
  const [patient, professionals] = await Promise.all([
    prisma.patient.findFirst({ where: { id, orgId: ctx.orgId } }),
    prisma.user.findMany({ where: { orgId: ctx.orgId, active: true, isProfessional: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!patient) notFound();
  return (
    <>
      <PageHeader title="Nueva receta" subtitle={patientFullName(patient)} />
      <PrescriptionForm
        action={createPrescription.bind(null, id)}
        professionals={professionals}
        today={todayISO()}
        cancelHref={returnTo ?? `/pacientes/${id}`}
        returnTo={returnTo}
        defaultProfessionalId={ctx.user.isProfessional ? ctx.user.id : undefined}
      />
    </>
  );
}
