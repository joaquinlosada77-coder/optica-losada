"use client";

import { runSetup } from "@/server/setup";
import { Alert, Field, inputCls } from "@/components/ui";
import { RutInput } from "@/components/RutInput";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

export function SetupForm({ branchNames }: { branchNames: string[] }) {
  const { state, pending, formProps } = useServerForm(runSetup);
  const fe = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-500">Clave de configuración</legend>
        <Field label="SETUP_TOKEN" error={fe.token} hint="La que definiste en Vercel → Settings → Environment Variables" className="sm:col-span-2">
          <input name="token" type="password" required autoComplete="off" className={inputCls} />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-500">Empresa</legend>
        <Field label="Nombre comercial *" error={fe.orgName}>
          <input name="orgName" required defaultValue="Ópticas Losada" className={inputCls} />
        </Field>
        <Field label="RUT empresa *" error={fe.orgRut}>
          <RutInput name="orgRut" invalid={!!fe.orgRut} />
        </Field>
        <Field label="Razón social *" error={fe.razonSocial}>
          <input name="razonSocial" required className={inputCls} />
        </Field>
        <Field label="Giro" error={fe.giro}>
          <input name="giro" defaultValue="Venta al por menor de artículos ópticos" className={inputCls} />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-500">Tu usuario administrador</legend>
        <Field label="Nombre *" error={fe.adminName}>
          <input name="adminName" required className={inputCls} />
        </Field>
        <Field label="Correo *" error={fe.adminEmail}>
          <input name="adminEmail" type="email" required autoComplete="username" className={inputCls} />
        </Field>
        <Field label="Contraseña *" error={fe.password} hint="Mínimo 10 caracteres">
          <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputCls} />
        </Field>
        <Field label="Repite la contraseña *" error={fe.password2}>
          <input name="password2" type="password" required autoComplete="new-password" className={inputCls} />
        </Field>
      </fieldset>
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-500">Sucursales</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="branches" defaultChecked className="mt-1" />
          <span>
            Crear mis sucursales de Gesvision: {branchNames.join(", ")}.
            <span className="block text-xs text-slate-500">Luego ajustas horarios en Configuración → Sucursales.</span>
          </span>
        </label>
      </fieldset>
      <SubmitButton pending={pending} pendingText="Configurando…">Crear y entrar</SubmitButton>
    </form>
  );
}
