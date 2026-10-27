import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { updatePatient } from "@/server/patients";
import { patientFullName } from "@/server/queries";
import { PatientForm } from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const patient = await prisma.patient.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!patient) notFound();
  return (
    <>
      <PageHeader title={`Editar: ${patientFullName(patient)}`} />
      <PatientForm action={updatePatient.bind(null, id)} patient={patient} cancelHref={`/pacientes/${id}`} />
    </>
  );
}
