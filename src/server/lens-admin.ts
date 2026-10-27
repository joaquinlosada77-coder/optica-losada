"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, requireRole } from "@/server/auth";
import { formToObject } from "@/server/form";

const PAGE = "/configuracion/cristales";
const code = z.string({ error: "Falta el código" }).regex(/^[A-Z0-9]{1,8}$/, "Código: 1 a 8 letras/números");
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
const num = z.coerce.number().min(0).max(40);

function fail(msg: string): never {
  redirect(`${PAGE}?error=${encodeURIComponent(msg)}`);
}

function parse<T extends z.ZodTypeAny>(schema: T, fd: FormData): z.infer<T> {
  const raw = formToObject(fd);
  if (raw.code) raw.code = raw.code.toUpperCase();
  if (raw.price) raw.price = raw.price.replace(/[$.\s]/g, "");
  const r = schema.safeParse(raw);
  if (!r.success) fail(r.error.issues[0]?.message ?? "Datos inválidos");
  return r.data;
}

async function save(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") fail("Ese código ya existe");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") fail("Registro no encontrado");
    throw e;
  }
}

const materialSchema = z.object({
  code, name: z.string().min(2, "Falta el nombre").max(60), refractiveIndex: z.string().regex(/^1\.\d{2}$/, "Índice tipo 1.67"),
  description: z.string().max(200).optional(), thinness: int(1, 5), recommendFromPower: num, maxPower: num, sortOrder: int(0, 999),
  active: z.literal("on").optional(),
});

export async function saveLensMaterial(id: string | null, fd: FormData) {
  const ctx = await requireRole("ADMIN");
  const { active, ...m } = parse(materialSchema, fd);
  const data = { ...m, description: m.description ?? null, active: id ? active === "on" : true };
  await save(() =>
    id
      ? prisma.lensMaterial.update({ where: { id, orgId: ctx.orgId }, data })
      : prisma.lensMaterial.create({ data: { ...data, orgId: ctx.orgId } }),
  );
  await audit(ctx, id ? "lens.material.update" : "lens.material.create", "lens_material", id ?? data.code);
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=1`);
}

const designSchema = z.object({
  code, name: z.string().min(2, "Falta el nombre").max(60), description: z.string().max(200).optional(),
  family: z.enum(["MONOFOCAL", "BIFOCAL", "PROGRESIVO", "OCUPACIONAL"]),
  requiresAdd: z.literal("on").optional(), sortOrder: int(0, 999), active: z.literal("on").optional(),
});

export async function saveLensDesign(id: string | null, fd: FormData) {
  const ctx = await requireRole("ADMIN");
  const { active, requiresAdd, ...d } = parse(designSchema, fd);
  const data = { ...d, description: d.description ?? null, requiresAdd: requiresAdd === "on", active: id ? active === "on" : true };
  await save(() =>
    id
      ? prisma.lensDesign.update({ where: { id, orgId: ctx.orgId }, data })
      : prisma.lensDesign.create({ data: { ...data, orgId: ctx.orgId } }),
  );
  await audit(ctx, id ? "lens.design.update" : "lens.design.create", "lens_design", id ?? data.code);
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=1`);
}

const treatmentSchema = z.object({
  code, name: z.string().min(2, "Falta el nombre").max(60), description: z.string().max(200).optional(),
  exclusiveGroup: z.string().max(20).optional(),
  price: int(0, 10_000_000), sortOrder: int(0, 999), active: z.literal("on").optional(),
});

export async function saveLensTreatment(id: string | null, fd: FormData) {
  const ctx = await requireRole("ADMIN");
  const { active, ...t } = parse(treatmentSchema, fd);
  const data = {
    ...t,
    description: t.description ?? null,
    exclusiveGroup: t.exclusiveGroup?.trim().toUpperCase() || null,
    active: id ? active === "on" : true,
  };
  await save(() =>
    id
      ? prisma.lensTreatment.update({ where: { id, orgId: ctx.orgId }, data })
      : prisma.lensTreatment.create({ data: { ...data, orgId: ctx.orgId } }),
  );
  await audit(ctx, id ? "lens.treatment.update" : "lens.treatment.create", "lens_treatment", id ?? data.code);
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=1`);
}

/** Matriz material × tipo. Celda vacía = combinación no disponible. */
export async function saveLensPrices(fd: FormData) {
  const ctx = await requireRole("ADMIN");
  const [materials, designs] = await Promise.all([
    prisma.lensMaterial.findMany({ where: { orgId: ctx.orgId }, select: { id: true } }),
    prisma.lensDesign.findMany({ where: { orgId: ctx.orgId }, select: { id: true } }),
  ]);
  const rows: { materialId: string; designId: string; price: number }[] = [];
  for (const m of materials) {
    for (const d of designs) {
      const raw = String(fd.get(`p_${m.id}_${d.id}`) ?? "").replace(/[$.\s]/g, "");
      if (!raw) continue;
      const price = Number(raw);
      if (!Number.isInteger(price) || price < 0 || price > 10_000_000) fail(`Precio inválido: "${raw}"`);
      rows.push({ materialId: m.id, designId: d.id, price });
    }
  }
  await prisma.$transaction([
    prisma.lensPrice.deleteMany({ where: { materialId: { in: materials.map((m) => m.id) } } }),
    prisma.lensPrice.createMany({ data: rows }),
  ]);
  await audit(ctx, "lens.prices.update", "lens_price", ctx.orgId, { count: rows.length });
  revalidatePath(PAGE);
  redirect(`${PAGE}?ok=1`);
}
