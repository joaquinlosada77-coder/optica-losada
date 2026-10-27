"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import type { FormState } from "@/server/form";

/**
 * Igual que useActionState, pero evita el reseteo automático de React 19 tras
 * cada envío: si el servidor devuelve errores de validación, el usuario no
 * pierde lo que escribió. Sin JS el formulario sigue funcionando vía `action`.
 */
export function useServerForm(action: (prev: FormState, fd: FormData) => Promise<FormState>) {
  const [state, formAction, pending] = useActionState(action, {});
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return { state, pending, formProps: { action: formAction, onSubmit } };
}
