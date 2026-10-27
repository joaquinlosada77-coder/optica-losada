"use client";

import type { FormState } from "@/server/form";
import { Alert, Field, LinkButton, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

const COLS = [
  { key: "Sph", label: "Esfera", ph: "-1,25", step: "0.25" },
  { key: "Cyl", label: "Cilindro", ph: "-0,50", step: "0.25" },
  { key: "Axis", label: "Eje", ph: "180", step: "1" },
  { key: "Add", label: "Adición", ph: "+2,00", step: "0.25" },
] as const;

export function PrescriptionForm({
  action, professionals, today, cancelHref, returnTo, defaultProfessionalId,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  professionals: { id: string; name: string }[];
  today: string;
  cancelHref: string;
  returnTo?: string;
  defaultProfessionalId?: string;
}) {
  const { state, pending, formProps } = useServerForm(action);
  const fe = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-500">Receta</legend>
        <Field label="Fecha" error={fe.issuedAt}>
          <input name="issuedAt" type="date" defaultValue={today} max={today} className={inputCls} />
        </Field>
        <Field label="Profesional" error={fe.professionalId}>
          <select name="professionalId" defaultValue={defaultProfessionalId ?? ""} className={inputCls}>
            <option value="">— Receta externa —</option>
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </fieldset>

      <fieldset className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-500">Graduación (lejos)</legend>
        <table className="w-full min-w-[36rem]">
          <thead>
            <tr className="text-left text-sm text-slate-500">
              <th className="w-16" />
              {COLS.map((c) => <th key={c.key} className="px-2 pb-2 font-medium">{c.label}</th>)}
              <th className="px-2 pb-2 font-medium">DP (mm)</th>
            </tr>
          </thead>
          <tbody>
            {(["od", "oi"] as const).map((eye) => (
              <tr key={eye}>
                <td className="py-2 text-lg font-semibold">{eye.toUpperCase()}</td>
                {COLS.map((c) => {
                  const name = `${eye}${c.key}`;
                  return (
                    <td key={c.key} className="px-2 py-2 align-top">
                      <input
                        name={name}
                        inputMode="decimal"
                        placeholder={c.ph}
                        required={c.key === "Sph"}
                        aria-invalid={!!fe[name]}
                        className={`${inputCls} h-12 text-center font-mono text-lg`}
                      />
                      {fe[name] && <span className="mt-1 block text-xs text-rose-600">{fe[name]}</span>}
                    </td>
                  );
                })}
                <td className="px-2 py-2 align-top">
                  <input name={eye === "od" ? "dpOd" : "dpOi"} inputMode="decimal" placeholder="31,5" className={`${inputCls} h-12 text-center font-mono text-lg`} />
                  {fe[eye === "od" ? "dpOd" : "dpOi"] && <span className="mt-1 block text-xs text-rose-600">{fe[eye === "od" ? "dpOd" : "dpOi"]}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">Esfera en pasos de 0,25 (usa 0 para neutro). Si hay cilindro, el eje es obligatorio. Acepta coma o punto decimal.</p>
      </fieldset>

      <Field label="Observaciones" error={fe.notes}>
        <textarea name="notes" rows={2} className={inputCls} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Guardar receta</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">Cancelar</LinkButton>
      </div>
    </form>
  );
}
