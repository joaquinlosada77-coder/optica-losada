"use client";

import { useState } from "react";
import Link from "next/link";
import {
  WARNING_LABEL, branchesOf, groupPatients, missingHeaders, normalizeRow, summarizeWarnings,
  type GvRow, type NormalizedRow, type PatientImport, type RxImport,
} from "@/lib/import/gesvision";
import { Alert, Button, Card } from "@/components/ui";

const fmt = (n: number) => n.toLocaleString("es-CL");
const CHUNK = 1000;

type Parsed = {
  rows: NormalizedRow[];
  missing: string[];
  patients: PatientImport[];
  prescriptions: RxImport[];
  skipped: number;
  branches: { serie: string; name: string; rows: number; existing?: string | null }[];
  warnings: ReturnType<typeof summarizeWarnings>;
  existingPatients: number;
  alreadyImported: number;
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error ?? `Error ${r.status}`);
  return json as T;
}

function chunks<T>(arr: T[], n = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/** Valor de celda de ExcelJS a valor plano. */
function cellValue(v: unknown): unknown {
  if (v === null || v === undefined || v instanceof Date || typeof v !== "object") return v ?? null;
  const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown };
  if (o.richText) return o.richText.map((t) => t.text).join("");
  if (typeof o.text === "string") return o.text;
  if ("result" in o) return o.result ?? null;
  return null;
}

// El archivo se lee en este navegador: al servidor solo viajan los datos ya normalizados, por tandas.
async function readFile(file: File): Promise<{ headers: string[]; rows: NormalizedRow[] }> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("El archivo no tiene hojas.");
  let headers: string[] = [];
  const rows: NormalizedRow[] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const values = (row.values as unknown[]).slice(1).map(cellValue);
    if (headers.length === 0) { headers = values.map((v) => String(v ?? "").trim()); return; }
    const obj: GvRow = {};
    headers.forEach((h, i) => ((obj as Record<string, unknown>)[h] = values[i] ?? null));
    const r = normalizeRow(obj, n);
    if (r) rows.push(r);
  });
  return { headers, rows };
}

export function ImportGesvision() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "reading" | "preview" | "importing" | "done">("idle");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ branches: number; created: number; updated: number; rx: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = async () => {
    if (!file) return;
    setError(null);
    setPhase("reading");
    await new Promise((r) => setTimeout(r, 50)); // deja pintar el aviso antes de leer
    try {
      const { headers, rows } = await readFile(file);
      const missing = missingHeaders(headers);
      const g = groupPatients(rows);
      const branches = branchesOf(rows);
      let existingPatients = 0, alreadyImported = 0;
      const v = await post<{ branches: { serie: string; existing: string | null }[] }>("/api/importar/gesvision/verificar", { branches: branches.map(({ serie, name }) => ({ serie, name })) });
      const keyChunks = chunks(g.patients.map((p) => p.key));
      const refChunks = chunks(g.prescriptions.map((p) => p.externalRef));
      let i = 0;
      for (const keys of keyChunks) {
        setProgress({ label: "Comparando con pacientes existentes…", done: ++i, total: keyChunks.length + refChunks.length });
        existingPatients += (await post<{ existingPatients: number }>("/api/importar/gesvision/verificar", { keys })).existingPatients;
      }
      for (const refs of refChunks) {
        setProgress({ label: "Buscando recetas ya importadas…", done: ++i, total: keyChunks.length + refChunks.length });
        alreadyImported += (await post<{ alreadyImported: number }>("/api/importar/gesvision/verificar", { refs })).alreadyImported;
      }
      setProgress(null);
      setParsed({
        rows, missing, ...g,
        branches: branches.map((b) => ({ ...b, existing: v.branches.find((x) => x.serie === b.serie)?.existing ?? null })),
        warnings: summarizeWarnings(rows),
        existingPatients, alreadyImported,
      });
      setPhase("preview");
    } catch (e) {
      setProgress(null);
      setError(e instanceof Error ? `No se pudo leer el archivo: ${e.message}` : "No se pudo leer el archivo.");
      setPhase("idle");
    }
  };

  const run = async () => {
    if (!parsed) return;
    setPhase("importing");
    setError(null);
    try {
      const b = await post<{ created: number }>("/api/importar/gesvision/sucursales", parsed.branches.map(({ serie, name }) => ({ serie, name })));
      let created = 0, updated = 0, rx = 0;
      const pc = chunks(parsed.patients), rc = chunks(parsed.prescriptions);
      const total = pc.length + rc.length;
      let i = 0;
      for (const c of pc) {
        setProgress({ label: "Importando pacientes…", done: i++, total });
        const r = await post<{ created: number; updated: number }>("/api/importar/gesvision/pacientes", c);
        created += r.created; updated += r.updated;
      }
      for (const c of rc) {
        setProgress({ label: "Importando recetas…", done: i++, total });
        rx += (await post<{ created: number }>("/api/importar/gesvision/recetas", c)).created;
      }
      setProgress(null);
      setResult({ branches: b.created, created, updated, rx });
      setPhase("done");
    } catch (e) {
      setProgress(null);
      // Lo ya importado queda guardado; reintentar no duplica.
      setError(`${e instanceof Error ? e.message : "Error"}. Lo importado hasta ahora quedó guardado: puedes volver a intentarlo sin duplicar.`);
      setPhase("preview");
    }
  };

  if (phase === "done" && result) {
    return (
      <Card title="Importación terminada">
        <ul className="space-y-1 text-lg">
          <li>✓ <b>{fmt(result.created)}</b> pacientes nuevos</li>
          <li>✓ <b>{fmt(result.updated)}</b> pacientes existentes completados</li>
          <li>✓ <b>{fmt(result.rx)}</b> recetas importadas</li>
          {result.branches > 0 && <li>✓ <b>{result.branches}</b> sucursales creadas (revisa sus horarios en Sucursales)</li>}
        </ul>
        <Link href="/pacientes" className="mt-4 inline-block text-brand-600 underline">Ver pacientes</Link>
      </Card>
    );
  }

  const p = parsed;
  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <Card title="1 · Archivo">
        <p className="mb-3 text-sm text-slate-600">
          En Gesvision: <b>Listado de graduaciones → Descargar</b>. Elige el archivo .xlsx tal como lo entrega Gesvision.
          El archivo <b>se lee en este computador</b>; primero verás un resumen y <b>nada se guarda hasta que confirmes</b>.
          Puedes importar el mismo archivo dos veces sin duplicar. Para archivos grandes usa un computador, no la tablet.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPhase("idle"); setParsed(null); }}
            className="text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:text-white"
          />
          <Button onClick={analyze} disabled={!file || phase === "reading" || phase === "importing"}>Revisar archivo</Button>
        </div>
        {file && <p className="mt-2 text-xs text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        {phase === "reading" && !progress && <Progress label="Leyendo el archivo (un archivo de 30 MB puede tardar un minuto)…" />}
      </Card>

      {progress && <Card><Progress label={`${progress.label} ${progress.done}/${progress.total}`} value={(progress.done / Math.max(1, progress.total)) * 100} /></Card>}

      {p && (phase === "preview" || phase === "importing") && (
        <Card title="2 · Resumen antes de importar">
          {p.missing.length > 0 && <div className="mb-4"><Alert>Al archivo le faltan columnas: {p.missing.join(", ")}. ¿Es el listado de graduaciones?</Alert></div>}
          <div className="grid gap-3 sm:grid-cols-4">
            <Tile label="Filas leídas" value={p.rows.length} />
            <Tile label="Pacientes nuevos" value={p.patients.length - p.existingPatients} sub={`${fmt(p.existingPatients)} ya existen (se completan)`} />
            <Tile label="Recetas a importar" value={p.prescriptions.length - p.alreadyImported} sub={p.alreadyImported ? `${fmt(p.alreadyImported)} ya importadas antes` : undefined} />
            <Tile label="Filas sin graduación" value={p.rows.filter((r) => !r.rx).length} sub="se importa solo el paciente" />
          </div>

          <h3 className="mb-2 mt-6 text-sm font-semibold">Sucursales</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {p.branches.map((b) => (
                <tr key={b.serie}>
                  <td className="py-1.5">{b.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(b.rows)} filas</td>
                  <td className="py-1.5 pl-4 text-xs">{b.existing ? <span className="text-emerald-700">→ {b.existing}</span> : <span className="text-amber-700">se creará</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(p.warnings.length > 0 || p.skipped > 0) && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">Correcciones y avisos</h3>
              <ul className="space-y-1 text-sm">
                {p.skipped > 0 && <li>Filas sin RUT ni código de cliente (no se pueden enlazar, se omiten): {fmt(p.skipped)}</li>}
                {p.warnings.map((w) => (
                  <li key={w.type} className="flex justify-between gap-4">
                    <span>{WARNING_LABEL[w.type]}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{fmt(w.count)} filas (ej. fila {w.sampleRows.join(", ")})</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6 flex gap-2">
            <Button onClick={run} disabled={phase === "importing" || p.missing.length > 0}>
              {phase === "importing" ? "Importando… no cierres esta página" : "Confirmar e importar"}
            </Button>
            <Button variant="secondary" onClick={() => { setParsed(null); setPhase("idle"); }} disabled={phase === "importing"}>Cancelar</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{fmt(value)}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Progress({ label, value }: { label: string; value?: number }) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-sm text-slate-600">{label}</div>
      <div className="h-2 overflow-hidden rounded bg-slate-100">
        <div className={value === undefined ? "h-full w-1/3 animate-pulse bg-brand-500" : "h-full bg-brand-500 transition-all"} style={value === undefined ? undefined : { width: `${value}%` }} />
      </div>
    </div>
  );
}
