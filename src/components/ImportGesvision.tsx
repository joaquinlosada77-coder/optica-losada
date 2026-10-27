"use client";

import { useState } from "react";
import Link from "next/link";
import { WARNING_LABEL } from "@/lib/import/gesvision";
import type { ImportSummary } from "@/server/import/gesvision";
import { Alert, Button, Card } from "@/components/ui";

type Result = { branchesCreated: number; patientsCreated: number; patientsUpdated: number; prescriptionsCreated: number };
const fmt = (n: number) => n.toLocaleString("es-CL");

export function ImportGesvision() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analyzing" | "preview" | "importing" | "done">("idle");
  const [token, setToken] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = () => {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    const fd = new FormData();
    fd.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/importar/gesvision");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.upload.onload = () => setPhase("analyzing");
    xhr.onload = () => {
      const body = JSON.parse(xhr.responseText || "{}");
      if (xhr.status !== 200) { setError(body.error ?? "Error al subir"); setPhase("idle"); return; }
      setToken(body.token);
      setSummary(body.summary);
      setPhase("preview");
    };
    xhr.onerror = () => { setError("Se cortó la conexión al subir el archivo."); setPhase("idle"); };
    xhr.send(fd);
  };

  const confirm = async () => {
    setPhase("importing");
    setError(null);
    const r = await fetch("/api/importar/gesvision/confirmar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) { setError(body.error ?? "Error al importar"); setPhase("preview"); return; }
    setResult(body.result);
    setPhase("done");
  };

  if (phase === "done" && result) {
    return (
      <Card title="Importación terminada">
        <ul className="space-y-1 text-lg">
          <li>✓ <b>{fmt(result.patientsCreated)}</b> pacientes nuevos</li>
          <li>✓ <b>{fmt(result.patientsUpdated)}</b> pacientes existentes completados</li>
          <li>✓ <b>{fmt(result.prescriptionsCreated)}</b> recetas importadas</li>
          {result.branchesCreated > 0 && <li>✓ <b>{result.branchesCreated}</b> sucursales creadas (revisa sus horarios en Sucursales)</li>}
        </ul>
        <div className="mt-4 flex gap-2">
          <Link href="/pacientes" className="text-brand-600 underline">Ver pacientes</Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <Card title="1 · Archivo">
        <p className="mb-3 text-sm text-slate-600">
          En Gesvision: <b>Listado de graduaciones → Descargar</b>. Sube el archivo .xlsx tal como lo entrega Gesvision.
          Primero verás un resumen; <b>nada se guarda hasta que confirmes</b>. Puedes importar el mismo archivo dos veces sin duplicar recetas.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPhase("idle"); setSummary(null); }}
            className="text-sm file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:text-white"
          />
          <Button onClick={upload} disabled={!file || phase === "uploading" || phase === "analyzing"}>Revisar archivo</Button>
        </div>
        {file && <p className="mt-2 text-xs text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
        {phase === "uploading" && <Progress label={`Subiendo… ${progress ?? 0}%`} value={progress ?? 0} />}
        {phase === "analyzing" && <Progress label="Analizando el archivo (puede tardar un minuto)…" />}
      </Card>

      {summary && (phase === "preview" || phase === "importing") && (
        <Card title="2 · Resumen antes de importar">
          {summary.missingHeaders.length > 0 && (
            <div className="mb-4"><Alert>Al archivo le faltan columnas: {summary.missingHeaders.join(", ")}. ¿Es el listado de graduaciones?</Alert></div>
          )}
          <div className="grid gap-3 sm:grid-cols-4">
            <Tile label="Filas leídas" value={summary.rows} />
            <Tile label="Pacientes nuevos" value={summary.patientsNew} sub={`${fmt(summary.patientsExisting)} ya existen (se completan)`} />
            <Tile label="Recetas a importar" value={summary.prescriptions} sub={summary.prescriptionsAlreadyImported ? `${fmt(summary.prescriptionsAlreadyImported)} ya importadas antes` : undefined} />
            <Tile label="Filas sin graduación" value={summary.rowsWithoutRx} sub="se importa solo el paciente" />
          </div>

          <h3 className="mb-2 mt-6 text-sm font-semibold">Sucursales</h3>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {summary.branches.map((b) => (
                <tr key={b.serie}>
                  <td className="py-1.5">{b.name}</td>
                  <td className="py-1.5 text-right tabular-nums">{fmt(b.rows)} filas</td>
                  <td className="py-1.5 pl-4 text-xs">{b.existing ? <span className="text-emerald-700">→ {b.existing}</span> : <span className="text-amber-700">se creará</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {summary.warnings.length > 0 && (
            <>
              <h3 className="mb-2 mt-6 text-sm font-semibold">Correcciones y avisos</h3>
              <ul className="space-y-1 text-sm">
                {summary.warnings.map((w) => (
                  <li key={w.type} className="flex justify-between gap-4">
                    <span>{WARNING_LABEL[w.type]}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{fmt(w.count)} filas (ej. fila {w.sampleRows.join(", ")})</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-6 flex gap-2">
            <Button onClick={confirm} disabled={phase === "importing" || summary.missingHeaders.length > 0}>
              {phase === "importing" ? "Importando… no cierres esta página" : "Confirmar e importar"}
            </Button>
            <Button variant="secondary" onClick={() => { setSummary(null); setPhase("idle"); }} disabled={phase === "importing"}>Cancelar</Button>
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
