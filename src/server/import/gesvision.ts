import "server-only";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { missingHeaders, normalizeRow, type GvRow, type NormalizedRow, type Warning } from "@/lib/import/gesvision";

/** Valor de celda de ExcelJS a valor plano (texto enriquecido, hipervínculos, fórmulas). */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== "object") return v;
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return typeof v.text === "string" ? v.text : null;
  if ("result" in v) return v.result ?? null;
  return null;
}

export type ParsedFile = { headers: string[]; rows: NormalizedRow[]; emptyRows: number };

/** Lee la primera hoja en modo streaming (sirve para archivos de decenas de MB). */
export async function readGesvisionFile(path: string): Promise<ParsedFile> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(path, { sharedStrings: "cache", hyperlinks: "cache", styles: "cache", worksheets: "emit" });
  let headers: string[] = [];
  const rows: NormalizedRow[] = [];
  let emptyRows = 0;
  for await (const sheet of reader) {
    for await (const row of sheet) {
      const values = (row.values as ExcelJS.CellValue[]).slice(1).map(cellValue);
      if (headers.length === 0) {
        headers = values.map((v) => String(v ?? "").trim());
        continue;
      }
      const obj: GvRow = {};
      headers.forEach((h, i) => ((obj as Record<string, unknown>)[h] = values[i] ?? null));
      const n = normalizeRow(obj, row.number);
      if (n) rows.push(n);
      else emptyRows++;
    }
    break; // solo la primera hoja
  }
  return { headers, rows, emptyRows };
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();

type PatientPlan = {
  key: string;
  data: NormalizedRow["patient"];
  branchKey: string;
  existingId: string | null;
};

export type ImportSummary = {
  rows: number;
  emptyRows: number;
  missingHeaders: string[];
  branches: { serie: string; name: string; rows: number; existing: string | null }[];
  patientsNew: number;
  patientsExisting: number;
  prescriptions: number;
  prescriptionsAlreadyImported: number;
  rowsWithoutRx: number;
  warnings: { type: Warning; count: number; sampleRows: number[] }[];
};

async function plan(orgId: string, parsed: ParsedFile) {
  const { rows } = parsed;

  // Sucursales: por nombre normalizado o por código GV<serie>
  const branches = await prisma.branch.findMany({ where: { orgId } });
  const branchRows = new Map<string, { serie: string; name: string; rows: number }>();
  for (const r of rows) {
    const k = r.branch.serie;
    const b = branchRows.get(k) ?? { ...r.branch, rows: 0 };
    b.rows++;
    branchRows.set(k, b);
  }
  const branchMatch = new Map<string, string | null>();
  for (const [serie, b] of branchRows) {
    const found = branches.find((x) => x.code === `GV${serie}`.slice(0, 8) || norm(x.name) === norm(b.name));
    branchMatch.set(serie, found?.id ?? null);
  }

  // Pacientes: agrupar por RUT (o código); los datos más recientes mandan, se completan vacíos con filas anteriores
  const sorted = [...rows].sort((a, b) => (a.rx?.issuedAt ?? "").localeCompare(b.rx?.issuedAt ?? "") || a.row - b.row);
  const patients = new Map<string, PatientPlan>();
  for (const r of sorted) {
    const prev = patients.get(r.patient.key);
    const merged = { ...(prev?.data ?? r.patient) };
    for (const [k, v] of Object.entries(r.patient)) if (v !== null && v !== "") (merged as Record<string, unknown>)[k] = v;
    patients.set(r.patient.key, { key: r.patient.key, data: merged, branchKey: r.branch.serie, existingId: null });
  }

  // Pacientes que ya existen en el sistema (por RUT o por código Gesvision)
  const ruts = [...patients.values()].flatMap((p) => (p.data.rut ? [p.data.rut] : []));
  const codes = [...patients.values()].flatMap((p) => (p.data.externalCode ? [p.data.externalCode] : []));
  const existing = await prisma.patient.findMany({
    where: { orgId, OR: [{ rut: { in: ruts } }, { externalCode: { in: codes } }] },
    select: { id: true, rut: true, externalCode: true },
  });
  const byRut = new Map(existing.filter((e) => e.rut).map((e) => [e.rut!, e.id]));
  const byCode = new Map(existing.filter((e) => e.externalCode).map((e) => [e.externalCode!, e.id]));
  for (const p of patients.values()) {
    p.existingId = (p.data.rut && byRut.get(p.data.rut)) || (p.data.externalCode && byCode.get(p.data.externalCode)) || null;
  }

  // Recetas ya importadas antes (misma huella)
  const refs = rows.flatMap((r) => (r.rx ? [r.rx.externalRef] : []));
  const already = new Set<string>();
  for (let i = 0; i < refs.length; i += 5000) {
    const found = await prisma.prescription.findMany({ where: { orgId, externalRef: { in: refs.slice(i, i + 5000) } }, select: { externalRef: true } });
    found.forEach((f) => already.add(f.externalRef!));
  }

  const warnMap = new Map<Warning, { count: number; sampleRows: number[] }>();
  for (const r of rows) {
    for (const w of new Set(r.warnings)) {
      const e = warnMap.get(w) ?? { count: 0, sampleRows: [] };
      e.count++;
      if (e.sampleRows.length < 5) e.sampleRows.push(r.row);
      warnMap.set(w, e);
    }
  }

  const uniqueRefs = new Set(refs);
  const summary: ImportSummary = {
    rows: rows.length,
    emptyRows: parsed.emptyRows,
    missingHeaders: missingHeaders(parsed.headers),
    branches: [...branchRows.values()].map((b) => ({
      ...b,
      existing: branches.find((x) => x.id === branchMatch.get(b.serie))?.name ?? null,
    })),
    patientsNew: [...patients.values()].filter((p) => !p.existingId).length,
    patientsExisting: [...patients.values()].filter((p) => p.existingId).length,
    prescriptions: [...uniqueRefs].filter((r) => !already.has(r)).length,
    prescriptionsAlreadyImported: [...uniqueRefs].filter((r) => already.has(r)).length,
    rowsWithoutRx: rows.filter((r) => !r.rx).length,
    warnings: [...warnMap.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.count - a.count),
  };
  return { summary, patients, branchRows, branchMatch, already };
}

export async function previewImport(orgId: string, path: string): Promise<ImportSummary> {
  const parsed = await readGesvisionFile(path);
  return (await plan(orgId, parsed)).summary;
}

export async function runImport(orgId: string, userId: string, path: string) {
  const parsed = await readGesvisionFile(path);
  const p = await plan(orgId, parsed);
  if (p.summary.missingHeaders.length) throw new Error(`Faltan columnas: ${p.summary.missingHeaders.join(", ")}`);

  // 1) Sucursales que faltan
  const branchId = new Map<string, string>();
  for (const [serie, b] of p.branchRows) {
    let id = p.branchMatch.get(serie) ?? null;
    if (!id) {
      const created = await prisma.branch.create({
        data: { orgId, code: `GV${serie}`.slice(0, 8).toUpperCase(), name: b.name, active: true },
      });
      id = created.id;
    }
    branchId.set(serie, id);
  }

  // 2) Pacientes nuevos (ids generados aquí para enlazar las recetas sin consultar)
  const patientId = new Map<string, string>();
  const toCreate = [];
  for (const pl of p.patients.values()) {
    if (pl.existingId) { patientId.set(pl.key, pl.existingId); continue; }
    const id = randomUUID();
    patientId.set(pl.key, id);
    const d = pl.data;
    toCreate.push({
      id,
      orgId,
      homeBranchId: branchId.get(pl.branchKey) ?? null,
      rut: d.rut,
      documentoExtranjero: d.rut ? null : d.documento,
      externalCode: d.externalCode,
      nombres: d.nombres,
      apellidoPaterno: d.apellidoPaterno,
      apellidoMaterno: d.apellidoMaterno,
      fechaNacimiento: d.fechaNacimiento ? new Date(`${d.fechaNacimiento}T00:00:00Z`) : null,
      telefono: d.telefono,
      email: d.email,
      notas: !d.rut && d.documento ? `Importado de Gesvision con RUT inválido: ${d.documento}. Revisar.` : null,
    });
  }
  for (let i = 0; i < toCreate.length; i += 1000) {
    await prisma.patient.createMany({ data: toCreate.slice(i, i + 1000), skipDuplicates: true });
  }

  // Pacientes existentes: solo se completan campos vacíos (no se pisa lo editado en el sistema nuevo)
  let patientsUpdated = 0;
  for (const pl of p.patients.values()) {
    if (!pl.existingId) continue;
    const cur = await prisma.patient.findUnique({ where: { id: pl.existingId } });
    if (!cur) continue;
    const d = pl.data;
    const fill: Record<string, unknown> = {};
    if (!cur.externalCode && d.externalCode) fill.externalCode = d.externalCode;
    if (!cur.telefono && d.telefono) fill.telefono = d.telefono;
    if (!cur.email && d.email) fill.email = d.email;
    if (!cur.fechaNacimiento && d.fechaNacimiento) fill.fechaNacimiento = new Date(`${d.fechaNacimiento}T00:00:00Z`);
    if (Object.keys(fill).length) {
      await prisma.patient.update({ where: { id: cur.id }, data: fill });
      patientsUpdated++;
    }
  }

  // 3) Recetas (la huella única evita duplicados si se vuelve a importar)
  const rxRows = parsed.rows.filter((r) => r.rx && !p.already.has(r.rx.externalRef));
  const rxData = rxRows.map((r) => ({
    orgId,
    patientId: patientId.get(r.patient.key)!,
    createdById: userId,
    issuedAt: new Date(`${r.rx!.issuedAt}T00:00:00Z`),
    odSph: r.rx!.odSph, odCyl: r.rx!.odCyl, odAxis: r.rx!.odAxis, odAdd: r.rx!.odAdd,
    oiSph: r.rx!.oiSph, oiCyl: r.rx!.oiCyl, oiAxis: r.rx!.oiAxis, oiAdd: r.rx!.oiAdd,
    dpOd: r.rx!.dpOd, dpOi: r.rx!.dpOi, dpTotal: r.rx!.dpTotal,
    avccOd: r.rx!.avccOd, avccOi: r.rx!.avccOi,
    professionalName: r.rx!.professionalName,
    reason: r.rx!.reason,
    notes: "Importada desde Gesvision",
    externalRef: r.rx!.externalRef,
  }));
  let prescriptionsCreated = 0;
  for (let i = 0; i < rxData.length; i += 1000) {
    const res = await prisma.prescription.createMany({ data: rxData.slice(i, i + 1000), skipDuplicates: true });
    prescriptionsCreated += res.count;
  }

  return {
    branchesCreated: [...p.branchMatch.values()].filter((v) => !v).length,
    patientsCreated: toCreate.length,
    patientsUpdated,
    prescriptionsCreated,
  };
}
