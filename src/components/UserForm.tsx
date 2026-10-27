"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import type { FormState } from "@/server/form";
import { ROLE_LABEL } from "@/lib/labels";
import { Alert, Field, LinkButton, inputCls } from "@/components/ui";
import { RutInput } from "@/components/RutInput";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

type UserData = {
  name: string;
  email: string;
  rut: string | null;
  role: Role;
  isProfessional: boolean;
  registroSis: string | null;
  active: boolean;
  branchIds: string[];
};

export function UserForm({
  action,
  user,
  branches,
}: {
  action: (p: FormState, fd: FormData) => Promise<FormState>;
  user?: UserData;
  branches: { id: string; name: string }[];
}) {
  const { state, pending, formProps } = useServerForm(action);
  const [role, setRole] = useState<Role>(user?.role ?? "RECEPCION");
  const [pro, setPro] = useState(user?.isProfessional ?? false);
  const fe = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-slate-500">Usuario</legend>
        <Field label="Nombre *" error={fe.name}>
          <input name="name" required defaultValue={user?.name} className={inputCls} />
        </Field>
        <Field label="Correo (usuario de acceso) *" error={fe.email}>
          <input name="email" type="email" required defaultValue={user?.email} className={inputCls} />
        </Field>
        <Field label="RUT" error={fe.rut}>
          <RutInput name="rut" defaultValue={user?.rut} invalid={!!fe.rut} />
        </Field>
        <Field label={user ? "Nueva contraseña (opcional)" : "Contraseña inicial *"} error={fe.password}>
          <input name="password" type="password" autoComplete="new-password" minLength={8} className={inputCls} />
        </Field>
        <Field label="Rol" error={fe.role}>
          <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputCls}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="isProfessional" checked={pro} onChange={(e) => setPro(e.target.checked)} />
            Atiende pacientes (aparece en la agenda)
          </label>
          {user && (
            <label className="flex items-center gap-2">
              <input type="checkbox" name="active" defaultChecked={user.active} /> Usuario activo
            </label>
          )}
        </div>
        {pro && (
          <Field label="N° registro Superintendencia de Salud" error={fe.registroSis} hint="Requerido para firmar recetas (Fase 2)">
            <input name="registroSis" defaultValue={user?.registroSis ?? ""} className={inputCls} />
          </Field>
        )}
      </fieldset>
      <fieldset className="rounded-xl border border-slate-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold text-slate-500">Sucursales</legend>
        {role === "ADMIN" && <p className="mb-2 text-sm text-slate-500">Los administradores acceden a todas las sucursales.</p>}
        {fe.branchIds && <p className="mb-2 text-xs text-rose-600">{fe.branchIds}</p>}
        <div className="grid gap-2 sm:grid-cols-3">
          {branches.map((b) => (
            <label key={b.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="branchIds" value={b.id} defaultChecked={user?.branchIds.includes(b.id)} />
              {b.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Guardar</SubmitButton>
        <LinkButton href="/configuracion/usuarios" variant="secondary">Cancelar</LinkButton>
      </div>
    </form>
  );
}
