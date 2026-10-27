import type { Metadata } from "next";
import { createPatient } from "@/server/patients";
import { PatientForm } from "@/components/PatientForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Nuevo paciente" };

export default async function NewPatientPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  return (
    <>
      <PageHeader title="Nuevo paciente" />
      <PatientForm action={createPatient} cancelHref={returnTo ?? "/pacientes"} returnTo={returnTo} />
    </>
  );
}
