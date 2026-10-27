"use client";

import { login } from "@/server/session-actions";
import { Alert, Field, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

export function LoginForm({ next }: { next: string }) {
  const { state, pending, formProps } = useServerForm(login);
  return (
    <form {...formProps} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Correo">
        <input name="email" type="email" required autoComplete="username" className={inputCls} />
      </Field>
      <Field label="Contraseña">
        <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
      </Field>
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Ingresando…">Ingresar</SubmitButton>
      </div>
    </form>
  );
}
