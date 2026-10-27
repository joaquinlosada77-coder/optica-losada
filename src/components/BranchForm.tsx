"use client";

import type { Branch } from "@prisma/client";
import type { FormState } from "@/server/form";
import { REGIONES } from "@/lib/labels";
import { Alert, Field, LinkButton, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

export function BranchForm({ action, branch }: { action: (p: FormState, fd: FormData) => Promise<FormState>; branch?: Branch }) {
  const { state, pending, formProps } = useServerForm(action);
  const fe = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-500">Sucursal</legend>
        <Field label="Código *" error={fe.code} hint="Ej: CENTRO, PROV, MALL1">
          <input name="code" required defaultValue={branch?.code} className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Nombre *" error={fe.name} className="lg:col-span-2">
          <input name="name" required defaultValue={branch?.name} className={inputCls} />
        </Field>
        <Field label="Dirección" error={fe.address}>
          <input name="address" defaultValue={branch?.address ?? ""} className={inputCls} />
        </Field>
        <Field label="Comuna" error={fe.comuna}>
          <input name="comuna" defaultValue={branch?.comuna ?? ""} className={inputCls} />
        </Field>
        <Field label="Región" error={fe.region}>
          <select name="region" defaultValue={branch?.region ?? ""} className={inputCls}>
            <option value="">—</option>
            {REGIONES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Teléfono" error={fe.phone}>
          <input name="phone" defaultValue={branch?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Correo" error={fe.email}>
          <input name="email" type="email" defaultValue={branch?.email ?? ""} className={inputCls} />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
        <legend className="px-1 text-sm font-semibold text-slate-500">Agenda</legend>
        <Field label="Apertura" error={fe.openTime}>
          <input name="openTime" type="time" defaultValue={branch?.openTime ?? "10:00"} className={inputCls} />
        </Field>
        <Field label="Cierre" error={fe.closeTime}>
          <input name="closeTime" type="time" defaultValue={branch?.closeTime ?? "19:00"} className={inputCls} />
        </Field>
        <Field label="Bloque (minutos)" error={fe.slotMinutes}>
          <input name="slotMinutes" type="number" min={10} max={120} step={5} defaultValue={branch?.slotMinutes ?? 30} className={inputCls} />
        </Field>
        {branch && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={branch.active} /> Sucursal activa
          </label>
        )}
      </fieldset>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Guardar</SubmitButton>
        <LinkButton href="/configuracion/sucursales" variant="secondary">Cancelar</LinkButton>
      </div>
    </form>
  );
}
