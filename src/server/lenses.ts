import "server-only";
import { prisma } from "@/lib/db";
import type { LensCatalog, StoredRx } from "@/lib/lenses";

export async function loadLensCatalog(orgId: string): Promise<LensCatalog> {
  const [materials, designs, treatments] = await Promise.all([
    prisma.lensMaterial.findMany({ where: { orgId, active: true }, orderBy: [{ sortOrder: "asc" }, { refractiveIndex: "asc" }], include: { prices: true } }),
    prisma.lensDesign.findMany({ where: { orgId, active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.lensTreatment.findMany({ where: { orgId, active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const activeDesigns = new Set(designs.map((d) => d.id));
  const prices: LensCatalog["prices"] = {};
  for (const m of materials) {
    prices[m.id] = {};
    for (const p of m.prices) if (activeDesigns.has(p.designId)) prices[m.id][p.designId] = p.price;
  }
  return {
    materials: materials.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      refractiveIndex: m.refractiveIndex,
      description: m.description,
      thinness: m.thinness,
      recommendFromPower: m.recommendFromPower,
      maxPower: m.maxPower,
    })),
    designs: designs.map((d) => ({ id: d.id, code: d.code, name: d.name, description: d.description, family: d.family, requiresAdd: d.requiresAdd })),
    treatments: treatments.map((t) => ({
      id: t.id, code: t.code, name: t.name, description: t.description, exclusiveGroup: t.exclusiveGroup, price: t.price,
    })),
    prices,
  };
}

export type RxSummary = StoredRx & {
  id: string;
  issuedAt: string;
  odAxis: number | null;
  oiAxis: number | null;
  professional: string | null;
};

export async function latestPrescription(orgId: string, patientId: string): Promise<RxSummary | null> {
  const p = await prisma.prescription.findFirst({
    where: { orgId, patientId },
    orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
    include: { professional: { select: { name: true } } },
  });
  if (!p) return null;
  return {
    id: p.id,
    issuedAt: p.issuedAt.toISOString().slice(0, 10),
    odSph: p.odSph, odCyl: p.odCyl, odAxis: p.odAxis, odAdd: p.odAdd,
    oiSph: p.oiSph, oiCyl: p.oiCyl, oiAxis: p.oiAxis, oiAdd: p.oiAdd,
    professional: p.professional?.name ?? null,
  };
}
