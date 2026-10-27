"use client";

import type { Product } from "@prisma/client";
import type { FormState } from "@/server/form";
import { PRODUCT_TYPE_LABEL } from "@/lib/labels";
import { Alert, Field, LinkButton, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { useServerForm } from "@/components/useServerForm";

export function ProductForm({ action, product }: { action: (p: FormState, fd: FormData) => Promise<FormState>; product?: Product }) {
  const { state, pending, formProps } = useServerForm(action);
  const fe = state.fieldErrors ?? {};
  return (
    <form {...formProps} className="space-y-6">
      {state.error && <Alert>{state.error}</Alert>}
      <fieldset className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Código / SKU *" error={fe.sku}>
          <input name="sku" required defaultValue={product?.sku} className={`${inputCls} uppercase`} />
        </Field>
        <Field label="Nombre *" error={fe.name} className="lg:col-span-2">
          <input name="name" required defaultValue={product?.name} className={inputCls} />
        </Field>
        <Field label="Marca" error={fe.brand}>
          <input name="brand" defaultValue={product?.brand ?? ""} className={inputCls} />
        </Field>
        <Field label="Categoría" error={fe.type}>
          <select name="type" defaultValue={product?.type ?? "ARMAZON"} className={inputCls}>
            {Object.entries(PRODUCT_TYPE_LABEL).filter(([k]) => k !== "CRISTAL").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Precio (IVA incluido) *" error={fe.price}>
          <input name="price" required inputMode="numeric" defaultValue={product?.price} className={inputCls} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="favorite" defaultChecked={product?.favorite} /> Mostrar en “Frecuentes” del punto de venta
        </label>
        {product && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={product.active} /> Activo
          </label>
        )}
      </fieldset>
      <p className="text-sm text-slate-500">Los cristales no se crean aquí: se arman en el configurador (Configuración → Cristales).</p>
      <div className="flex gap-2">
        <SubmitButton pending={pending}>Guardar</SubmitButton>
        <LinkButton href="/productos" variant="secondary">Cancelar</LinkButton>
      </div>
    </form>
  );
}
