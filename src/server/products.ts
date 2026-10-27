"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, requireRole } from "@/server/auth";
import { formToObject, zodToState, type FormState } from "@/server/form";

const productSchema = z.object({
  sku: z.string({ error: "Requerido" }).min(1, "Requerido").max(40),
  name: z.string({ error: "Requerido" }).min(2, "Requerido").max(120),
  brand: z.string().max(60).optional(),
  type: z.enum(["ARMAZON", "CRISTAL", "LENTE_CONTACTO", "LIQUIDO", "ACCESORIO", "LENTE_SOL", "SERVICIO"]),
  price: z.coerce.number({ error: "Precio inválido" }).int("Sin decimales").min(0).max(100_000_000),
  favorite: z.literal("on").optional(),
  active: z.literal("on").optional(),
});

export async function saveProduct(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireRole("ADMIN");
  const raw = formToObject(fd);
  if (raw.price) raw.price = raw.price.replace(/[$.\s]/g, "");
  const parsed = productSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const p = parsed.data;
  const data = {
    sku: p.sku.toUpperCase(),
    name: p.name,
    brand: p.brand ?? null,
    type: p.type,
    price: p.price,
    favorite: p.favorite === "on",
    active: id ? p.active === "on" : true,
  };
  try {
    if (id) {
      const existing = await prisma.product.findFirst({ where: { id, orgId: ctx.orgId } });
      if (!existing) return { error: "Producto no encontrado." };
      await prisma.product.update({ where: { id }, data });
      await audit(ctx, "product.update", "product", id, existing.price !== data.price ? { from: existing.price, to: data.price } : undefined);
    } else {
      const created = await prisma.product.create({ data: { ...data, orgId: ctx.orgId } });
      await audit(ctx, "product.create", "product", created.id);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un producto con ese código.", fieldErrors: { sku: "Código en uso" } };
    }
    throw e;
  }
  revalidatePath("/productos");
  revalidatePath("/ventas/nueva");
  redirect("/productos");
}
