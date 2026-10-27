"use client";

import { useMemo, useState } from "react";
import { formatCLP } from "@/lib/money";
import {
  FAMILY_LABEL, designAvailable, fmtDiopter, fromPrice, materialAvailable, recommendedMaterialId, resolveLens, toggleTreatment,
  type LensCatalog, type LensFamilyKey, type LensSelection,
} from "@/lib/lenses";
import type { RxSummary } from "@/server/lenses";
import { cx } from "@/components/ui";

export type ConfiguredLens = LensSelection & { prescriptionId: string | null; code: string; description: string; price: number };

const STEPS = ["Material", "Filtros y tratamientos", "Tipo de cristal"] as const;

/** Corte transversal de un cristal: más delgado a mayor índice. */
function LensThickness({ level, active }: { level: number; active: boolean }) {
  const edge = 30 - Math.min(5, Math.max(1, level)) * 4.5; // grosor del borde
  return (
    <svg viewBox="0 0 120 70" className="h-16 w-28" aria-hidden>
      <path
        d={`M10 ${35 - edge / 2 - 14} Q60 ${35 - 8} 110 ${35 - edge / 2 - 14} L110 ${35 + edge / 2 + 14} Q60 ${35 + 8} 10 ${35 + edge / 2 + 14} Z`}
        className={active ? "fill-brand-500/30 stroke-brand-600" : "fill-sky-200/60 stroke-sky-500"}
        strokeWidth="2"
      />
    </svg>
  );
}

export function LensConfigurator({
  catalog,
  rx,
  patientName,
  patientId,
  onAdd,
  onClose,
}: {
  catalog: LensCatalog;
  rx: RxSummary | null;
  patientName: string | null;
  patientId: string | null;
  onAdd: (lens: ConfiguredLens) => void;
  onClose: () => void;
}) {
  const recommended = useMemo(() => recommendedMaterialId(catalog.materials, rx), [catalog, rx]);
  const [step, setStep] = useState(0);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [treatmentIds, setTreatmentIds] = useState<string[]>([]);
  const [designId, setDesignId] = useState<string | null>(null);

  const material = catalog.materials.find((m) => m.id === materialId);
  const resolved = materialId && designId ? resolveLens(catalog, { materialId, designId, treatmentIds }, rx) : null;
  const partialPrice =
    (material && designId ? (catalog.prices[material.id]?.[designId] ?? 0) : material ? (fromPrice(catalog, material.id) ?? 0) : 0) +
    catalog.treatments.filter((t) => treatmentIds.includes(t.id)).reduce((s, t) => s + t.price, 0);

  const toggle = (id: string) => setTreatmentIds((ids) => toggleTreatment(catalog.treatments, ids, id));
  const families = (Object.keys(FAMILY_LABEL) as LensFamilyKey[]).filter((f) => catalog.designs.some((d) => d.family === f));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      {/* Encabezado con receta */}
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-white px-6 py-3">
        <div className="mr-auto">
          <div className="text-xl font-semibold">Elige tus cristales</div>
          <div className="text-sm text-slate-500">{patientName ?? "Cliente sin ficha"}</div>
        </div>
        {rx ? (
          <table className="text-sm">
            <thead className="text-xs text-slate-500">
              <tr><th className="pr-3 text-left" /><th className="px-2">Esfera</th><th className="px-2">Cilindro</th><th className="px-2">Eje</th><th className="px-2">Adición</th></tr>
            </thead>
            <tbody className="font-mono">
              <tr><td className="pr-3 font-sans font-semibold">OD</td><td className="px-2 text-center">{fmtDiopter(rx.odSph)}</td><td className="px-2 text-center">{rx.odCyl ? fmtDiopter(rx.odCyl) : "—"}</td><td className="px-2 text-center">{rx.odAxis ?? "—"}</td><td className="px-2 text-center">{rx.odAdd ? fmtDiopter(rx.odAdd) : "—"}</td></tr>
              <tr><td className="pr-3 font-sans font-semibold">OI</td><td className="px-2 text-center">{fmtDiopter(rx.oiSph)}</td><td className="px-2 text-center">{rx.oiCyl ? fmtDiopter(rx.oiCyl) : "—"}</td><td className="px-2 text-center">{rx.oiAxis ?? "—"}</td><td className="px-2 text-center">{rx.oiAdd ? fmtDiopter(rx.oiAdd) : "—"}</td></tr>
            </tbody>
          </table>
        ) : (
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Sin receta: no se filtran materiales por graduación
            {patientId && (
              <> · <a className="font-semibold underline" href={`/pacientes/${patientId}/receta?returnTo=${encodeURIComponent(`/ventas/nueva?patientId=${patientId}`)}`}>Ingresar receta</a></>
            )}
          </span>
        )}
        <button onClick={onClose} className="h-12 rounded-xl border border-slate-300 px-5 text-base font-medium active:scale-95">Cerrar</button>
      </div>

      {/* Pasos */}
      <div className="flex gap-2 border-b border-slate-200 bg-white px-6 py-3">
        {STEPS.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            disabled={i > 0 && !materialId}
            className={cx(
              "flex h-12 items-center gap-2 rounded-full px-5 text-base font-medium disabled:opacity-40",
              step === i ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700",
            )}
          >
            <span className={cx("flex h-7 w-7 items-center justify-center rounded-full text-sm", step === i ? "bg-white/20" : "bg-white")}>{i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.materials.map((m) => {
              const ok = materialAvailable(m, rx);
              const price = fromPrice(catalog, m.id);
              const selected = materialId === m.id;
              return (
                <button
                  key={m.id}
                  data-code={m.code}
                  disabled={!ok || price === null}
                  onClick={() => { setMaterialId(m.id); setDesignId(null); setStep(1); }}
                  className={cx(
                    "relative flex flex-col items-start gap-2 rounded-2xl border-2 bg-white p-5 text-left shadow-sm transition active:scale-[0.98] disabled:opacity-40",
                    selected ? "border-brand-600 ring-4 ring-brand-100" : "border-slate-200",
                  )}
                >
                  {recommended === m.id && ok && (
                    <span className="absolute right-4 top-4 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">Recomendado</span>
                  )}
                  <div className="text-4xl font-bold tracking-tight text-brand-900">{m.refractiveIndex}</div>
                  <div className="text-lg font-semibold">{m.name}</div>
                  <LensThickness level={m.thinness} active={selected} />
                  {m.description && <p className="text-sm text-slate-600">{m.description}</p>}
                  <div className="mt-auto pt-2 text-base">
                    {!ok ? <span className="text-rose-600">No disponible para esta graduación</span> : price !== null ? <>desde <b className="text-xl">{formatCLP(price)}</b></> : "Sin precio"}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {catalog.treatments.map((t) => {
                const on = treatmentIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    data-code={t.code}
                    onClick={() => toggle(t.id)}
                    aria-pressed={on}
                    className={cx(
                      "flex items-start gap-4 rounded-2xl border-2 bg-white p-5 text-left shadow-sm active:scale-[0.98]",
                      on ? "border-brand-600 ring-4 ring-brand-100" : "border-slate-200",
                    )}
                  >
                    <span className={cx("mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 text-lg", on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300")}>{on ? "✓" : ""}</span>
                    <span className="flex-1">
                      <span className="block text-lg font-semibold">
                        {t.name}
                        {t.exclusiveGroup && <span className="ml-2 align-middle text-xs font-normal text-slate-400">elige uno de este tipo</span>}
                      </span>
                      {t.description && <span className="block text-sm text-slate-600">{t.description}</span>}
                      <span className="mt-2 block text-base font-semibold text-brand-700">+ {formatCLP(t.price)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep(2)} className="h-14 rounded-xl bg-brand-600 px-8 text-lg font-semibold text-white active:scale-95">
                {treatmentIds.length ? "Continuar" : "Sin tratamientos, continuar"} →
              </button>
            </div>
          </div>
        )}

        {step === 2 && material && (
          <div className="space-y-6">
            {families.map((f) => {
              const designs = catalog.designs.filter((d) => d.family === f);
              return (
                <section key={f}>
                  <h3 className="mb-3 text-lg font-semibold text-slate-700">{FAMILY_LABEL[f]}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {designs.map((d) => {
                      const base = catalog.prices[material.id]?.[d.id];
                      const ok = designAvailable(d, rx) && base !== undefined;
                      const selected = designId === d.id;
                      return (
                        <button
                          key={d.id}
                          data-code={d.code}
                          disabled={!ok}
                          onClick={() => setDesignId(d.id)}
                          className={cx(
                            "flex flex-col items-start gap-2 rounded-2xl border-2 bg-white p-5 text-left shadow-sm active:scale-[0.98] disabled:opacity-40",
                            selected ? "border-brand-600 ring-4 ring-brand-100" : "border-slate-200",
                          )}
                        >
                          <div className="text-xl font-semibold">{d.name}</div>
                          {d.description && <p className="text-sm text-slate-600">{d.description}</p>}
                          <div className="mt-auto pt-2 text-base">
                            {base === undefined ? <span className="text-slate-500">No disponible en {material.refractiveIndex}</span>
                              : !designAvailable(d, rx) ? <span className="text-rose-600">La receta no tiene adición</span>
                              : <b className="text-xl">{formatCLP(base)}</b>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumen siempre visible */}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-white px-6 py-4">
        <div className="mr-auto min-w-0">
          <div className="truncate text-base text-slate-600">
            {resolved && !("error" in resolved) ? resolved.description
              : [material?.name, ...catalog.treatments.filter((t) => treatmentIds.includes(t.id)).map((t) => t.name)].filter(Boolean).join(" + ") || "Toca un material para empezar"}
          </div>
          <div className="font-mono text-sm text-slate-400">
            {resolved && !("error" in resolved) ? `Código ${resolved.code}` : resolved && "error" in resolved ? resolved.error : ""}
          </div>
        </div>
        <div className={cx("text-right", !material && "invisible")}>
          <div className="text-xs uppercase tracking-wide text-slate-500">{designId ? "Total del par" : "Desde"}</div>
          <div className="text-3xl font-bold tabular-nums">{formatCLP(partialPrice)}</div>
        </div>
        <button
          disabled={!resolved || "error" in resolved}
          onClick={() => {
            if (resolved && !("error" in resolved) && materialId && designId) {
              onAdd({ materialId, designId, treatmentIds, prescriptionId: rx?.id ?? null, ...resolved });
            }
          }}
          className="h-16 rounded-xl bg-emerald-600 px-8 text-lg font-semibold text-white shadow active:scale-95 disabled:bg-slate-300"
        >
          Agregar a la venta
        </button>
      </div>
    </div>
  );
}
