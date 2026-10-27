import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatRut } from "@/lib/rut";
import { requireContext } from "@/server/auth";
import { latestPrescription, loadLensCatalog } from "@/server/lenses";
import { patientFullName } from "@/server/queries";
import { PosScreen } from "@/components/pos/PosScreen";

export const metadata: Metadata = { title: "Venta" };

export default async function NewSalePage({ searchParams }: { searchParams: Promise<{ patientId?: string }> }) {
  const { patientId } = await searchParams;
  const ctx = await requireContext();
  const [products, catalog, cash, patient] = await Promise.all([
    prisma.product.findMany({
      where: { orgId: ctx.orgId, active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, sku: true, name: true, brand: true, type: true, price: true, favorite: true },
    }),
    loadLensCatalog(ctx.orgId),
    prisma.cashSession.findFirst({ where: { branchId: ctx.branch.id, closedAt: null }, select: { id: true } }),
    patientId ? prisma.patient.findFirst({ where: { id: patientId, orgId: ctx.orgId } }) : null,
  ]);
  const rx = patient ? await latestPrescription(ctx.orgId, patient.id) : null;

  return (
    <PosScreen
      products={products}
      catalog={catalog}
      cashOpen={!!cash}
      initialPatient={patient ? { id: patient.id, name: patientFullName(patient), doc: patient.rut ? formatRut(patient.rut) : (patient.documentoExtranjero ?? "") } : null}
      initialRx={rx}
    />
  );
}
