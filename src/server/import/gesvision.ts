import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";

// El navegador lee y normaliza el Excel; aquí llegan tandas de datos ya limpios.

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const branchCode = (serie: string) => `GV${serie}`.slice(0, 8).toUpperCase();

const str = (max: number) => z.string().max(max).nullable();
const num = z.number().finite().nullable();

export const branchesInput = z.array(z.object({ serie: z.string().max(20), name: z.string().max(120) })).max(200);

export const patientsInput = z
  .array(
    z.object({
      key: z.string().max(60),
      externalCode: str(40),
      rut: str(12),
      documento: str(40),
      nombres: z.string().max(120),
      apellidoPaterno: z.string().max(80),
      apellidoMaterno: str(80),
      fechaNacimiento: z.iso.date().nullable(),
      telefono: str(30),
      email: str(120),
      branchSerie: z.string().max(20),
    }),
  )
  .max(2000);

export const prescriptionsInput = z
  .array(
    z.object({
      patientKey: z.string().max(60),
      issuedAt: z.iso.date(),
      odSph: num, odCyl: z.number(), odAxis: z.number().int().nullable(), odAdd: num,
      oiSph: num, oiCyl: z.number(), oiAxis: z.number().int().nullable(), oiAdd: num,
      dpOd: num, dpOi: num, dpTotal: num,
      avccOd: str(20), avccOi: str(20),
      professionalName: str(120),
      reason: str(2000),
      externalRef: z.string().max(300),
    }),
  )
  .max(2000);

async function branchMap(orgId: string) {
  return prisma.branch.findMany({ where: { orgId }, select: { id: true, code: true, name: true } });
}

function matchBranch(all: { id: string; code: string; name: string }[], serie: string, name: string) {
  return all.find((b) => b.code === branchCode(serie)) ?? all.find((b) => norm(b.name) === norm(name)) ?? null;
}

/** Resumen previo: sucursales reconocidas, pacientes existentes y recetas ya importadas (por tanda). */
export async function verify(orgId: string, input: { branches?: z.infer<typeof branchesInput>; keys?: string[]; refs?: string[] }) {
  const out: { branches?: { serie: string; existing: string | null }[]; existingPatients?: number; alreadyImported?: number } = {};
  if (input.branches) {
    const all = await branchMap(orgId);
    out.branches = input.branches.map((b) => ({ serie: b.serie, existing: matchBranch(all, b.serie, b.name)?.name ?? null }));
  }
  if (input.keys) out.existingPatients = (await resolvePatients(orgId, input.keys)).size;
  if (input.refs) out.alreadyImported = await prisma.prescription.count({ where: { orgId, externalRef: { in: input.refs } } });
  return out;
}

/** Mapa clave de importación ("RUT" o "COD:<código>") → id de paciente existente. */
async function resolvePatients(orgId: string, keys: string[]) {
  const codes = keys.filter((k) => k.startsWith("COD:")).map((k) => k.slice(4));
  const ruts = keys.filter((k) => !k.startsWith("COD:"));
  const found = await prisma.patient.findMany({
    where: { orgId, OR: [{ rut: { in: ruts } }, { externalCode: { in: codes } }] },
    select: { id: true, rut: true, externalCode: true },
  });
  const map = new Map<string, string>();
  for (const p of found) {
    if (p.rut && ruts.includes(p.rut)) map.set(p.rut, p.id);
    if (p.externalCode && codes.includes(p.externalCode)) map.set(`COD:${p.externalCode}`, p.id);
  }
  return map;
}

export async function ensureBranches(orgId: string, branches: z.infer<typeof branchesInput>) {
  const all = await branchMap(orgId);
  let created = 0;
  for (const b of branches) {
    if (matchBranch(all, b.serie, b.name)) continue;
    const nb = await prisma.branch.create({ data: { orgId, code: branchCode(b.serie), name: b.name } });
    all.push({ id: nb.id, code: nb.code, name: nb.name });
    created++;
  }
  return { created };
}

export async function importPatients(orgId: string, patients: z.infer<typeof patientsInput>) {
  const branches = await branchMap(orgId);
  const existing = await resolvePatients(orgId, patients.map((p) => p.key));
  const toCreate = [];
  let updated = 0;
  for (const p of patients) {
    const homeBranchId = branches.find((b) => b.code === branchCode(p.branchSerie))?.id ?? null;
    const birth = p.fechaNacimiento ? new Date(`${p.fechaNacimiento}T00:00:00Z`) : null;
    const id = existing.get(p.key);
    if (id) {
      // Solo se completan campos vacíos: no se pisa lo editado en el sistema nuevo
      const cur = await prisma.patient.findUnique({ where: { id }, select: { externalCode: true, telefono: true, email: true, fechaNacimiento: true } });
      const fill: Record<string, unknown> = {};
      if (cur && !cur.externalCode && p.externalCode) fill.externalCode = p.externalCode;
      if (cur && !cur.telefono && p.telefono) fill.telefono = p.telefono;
      if (cur && !cur.email && p.email) fill.email = p.email;
      if (cur && !cur.fechaNacimiento && birth) fill.fechaNacimiento = birth;
      if (Object.keys(fill).length) { await prisma.patient.update({ where: { id }, data: fill }); updated++; }
      continue;
    }
    toCreate.push({
      id: randomUUID(),
      orgId,
      homeBranchId,
      rut: p.rut,
      documentoExtranjero: p.rut ? null : p.documento,
      externalCode: p.externalCode,
      nombres: p.nombres,
      apellidoPaterno: p.apellidoPaterno,
      apellidoMaterno: p.apellidoMaterno,
      fechaNacimiento: birth,
      telefono: p.telefono,
      email: p.email,
      notas: !p.rut && p.documento ? `Importado de Gesvision con RUT inválido: ${p.documento}. Revisar.` : null,
    });
  }
  const res = await prisma.patient.createMany({ data: toCreate, skipDuplicates: true });
  return { created: res.count, updated };
}

export async function importPrescriptions(orgId: string, userId: string, rows: z.infer<typeof prescriptionsInput>) {
  const ids = await resolvePatients(orgId, [...new Set(rows.map((r) => r.patientKey))]);
  const data = rows.flatMap((r) => {
    const patientId = ids.get(r.patientKey);
    if (!patientId) return [];
    const { patientKey: _k, issuedAt, ...rx } = r;
    void _k;
    return [{ ...rx, orgId, patientId, createdById: userId, issuedAt: new Date(`${issuedAt}T00:00:00Z`), notes: "Importada desde Gesvision" }];
  });
  const res = await prisma.prescription.createMany({ data, skipDuplicates: true });
  return { created: res.count, unlinked: rows.length - data.length };
}
