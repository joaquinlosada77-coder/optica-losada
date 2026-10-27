import type { Metadata } from "next";
import { requireRole } from "@/server/auth";
import { ImportGesvision } from "@/components/ImportGesvision";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Importar" };

export default async function ImportPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader title="Importar desde Gesvision" subtitle="Pacientes y graduaciones desde el “Listado de graduaciones”" />
      <ImportGesvision />
    </>
  );
}
