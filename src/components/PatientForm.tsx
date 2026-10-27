"use client";

import { useState } from "react";
import type { Patient } from "@prisma/client";
import type { FormState } from "@/server/form";
import { PREVISION_LABEL, REGIONES, SEXO_LABEL } from "@/lib/labels";
import { Alert, Field, LinkButton, inputCls } from "@/components/ui";
import { RutInput } from "@/components/RutInput";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PatientForm({
  action,
  patient,
  cancelHref,
  returnTo,
}: {
  action: Action;
  patient?: Patient;
  cancelHref: string;
  returnTo?: string;
}) {
  const { state, pending, formProps } = useServerForm(action);
  const [prevision, setPrevision] = useState(patient?.prevision ?? "");
  const [foreign, setForeign] = useState(!!patient?.documentoExtranjero && !patient?.rut);
  const fe = state.fieldErrors ?? {};
  const birth = patient?.fechaNacimiento?.toISOString().slice(0, 10);

  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-500">Identificación</legend>
        {!foreign ? (
          <Field label="RUT" error={fe.rut}>
            <RutInput name="rut" defaultValue={patient?.rut} invalid={!!fe.rut} />
          </Field>
        ) : (
          <Field label="Pasaporte / documento" error={fe.rut ?? fe.documentoExtranjero}>
            <input name="documentoExtranjero" defaultValue={patient?.documentoExtranjero ?? ""} className={inputCls} />
          </Field>
        )}
        <div className="flex items-end pb-2 lg:col-span-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={foreign} onChange={(e) => setForeign(e.target.checked)} />
            Paciente extranjero sin RUT
          </label>
        </div>
        <Field label="Nombres *" error={fe.nombres}>
          <input name="nombres" required defaultValue={patient?.nombres} className={inputCls} aria-invalid={!!fe.nombres} />
        </Field>
        <Field label="Apellido paterno *" error={fe.apellidoPaterno}>
          <input name="apellidoPaterno" required defaultValue={patient?.apellidoPaterno} className={inputCls} aria-invalid={!!fe.apellidoPaterno} />
        </Field>
        <Field label="Apellido materno" error={fe.apellidoMaterno}>
          <input name="apellidoMaterno" defaultValue={patient?.apellidoMaterno ?? ""} className={inputCls} />
        </Field>
        <Field label="Fecha de nacimiento" error={fe.fechaNacimiento}>
          <input name="fechaNacimiento" type="date" defaultValue={birth} max={new Date().toISOString().slice(0, 10)} className={inputCls} />
        </Field>
        <Field label="Sexo" error={fe.sexo}>
          <select name="sexo" defaultValue={patient?.sexo ?? ""} className={inputCls}>
            <option value="">—</option>
            {Object.entries(SEXO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Ocupación" error={fe.ocupacion} hint="Útil para recomendar lentes (pantallas, conducción…)">
          <input name="ocupacion" defaultValue={patient?.ocupacion ?? ""} className={inputCls} />
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-500">Contacto</legend>
        <Field label="Teléfono / WhatsApp" error={fe.telefono}>
          <input name="telefono" type="tel" placeholder="+56 9 1234 5678" defaultValue={patient?.telefono ?? ""} className={inputCls} aria-invalid={!!fe.telefono} />
        </Field>
        <Field label="Correo" error={fe.email}>
          <input name="email" type="email" defaultValue={patient?.email ?? ""} className={inputCls} aria-invalid={!!fe.email} />
        </Field>
        <div />
        <Field label="Dirección" error={fe.direccion}>
          <input name="direccion" defaultValue={patient?.direccion ?? ""} className={inputCls} />
        </Field>
        <Field label="Comuna" error={fe.comuna}>
          <input name="comuna" defaultValue={patient?.comuna ?? ""} className={inputCls} />
        </Field>
        <Field label="Región" error={fe.region}>
          <select name="region" defaultValue={patient?.region ?? ""} className={inputCls}>
            <option value="">—</option>
            {REGIONES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-2 lg:col-span-3">
          <input type="checkbox" name="aceptaMarketing" defaultChecked={patient?.aceptaMarketing} />
          Acepta recibir recordatorios y comunicaciones comerciales (Ley 19.628)
        </label>
      </fieldset>

      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-500">Previsión y notas</legend>
        <Field label="Previsión de salud" error={fe.prevision}>
          <select name="prevision" value={prevision} onChange={(e) => setPrevision(e.target.value as typeof prevision)} className={inputCls}>
            <option value="">—</option>
            {Object.entries(PREVISION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        {prevision === "ISAPRE" && (
          <Field label="Isapre" error={fe.isapre}>
            <input name="isapre" list="isapres" defaultValue={patient?.isapre ?? ""} className={inputCls} />
            <datalist id="isapres">
              {["Banmédica", "Colmena", "Consalud", "Cruz Blanca", "Nueva Masvida", "Vida Tres", "Esencial"].map((i) => <option key={i} value={i} />)}
            </datalist>
          </Field>
        )}
        <Field label="Notas internas" error={fe.notas} className="sm:col-span-2 lg:col-span-3">
          <textarea name="notas" rows={3} defaultValue={patient?.notas ?? ""} className={inputCls} />
        </Field>
      </fieldset>

      <div className="flex gap-2">
        <SubmitButton pending={pending}>Guardar paciente</SubmitButton>
        <LinkButton href={cancelHref} variant="secondary">Cancelar</LinkButton>
      </div>
    </form>
  );
}
