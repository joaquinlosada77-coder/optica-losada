"use server";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isValidRut, normalizeRut } from "@/lib/rut";
import { audit, requireRole } from "@/server/auth";
import { formToObject, zodToState, type FormState } from "@/server/form";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:mm");

const branchSchema = z
  .object({
    code: z.string({ error: "Requerido" }).regex(/^[A-Z0-9]{2,8}$/, "2 a 8 letras/números en mayúscula"),
    name: z.string({ error: "Requerido" }).min(2).max(80),
    address: z.string().max(150).optional(),
    comuna: z.string().max(60).optional(),
    region: z.string().max(60).optional(),
    phone: z.string().max(20).optional(),
    email: z.email("Correo inválido").optional(),
    openTime: hhmm,
    closeTime: hhmm,
    slotMinutes: z.coerce.number().int().min(10).max(120),
    active: z.literal("on").optional(),
  })
  .refine((b) => b.openTime < b.closeTime, { message: "El cierre debe ser posterior a la apertura", path: ["closeTime"] });

export async function saveBranch(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireRole("ADMIN");
  const raw = formToObject(fd);
  if (raw.code) raw.code = raw.code.toUpperCase();
  const parsed = branchSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const { active, ...rest } = parsed.data;
  const data = {
    ...rest,
    address: rest.address ?? null,
    comuna: rest.comuna ?? null,
    region: rest.region ?? null,
    phone: rest.phone ?? null,
    email: rest.email ?? null,
    active: id ? active === "on" : true,
  };

  try {
    if (id) {
      const b = await prisma.branch.findFirst({ where: { id, orgId: ctx.orgId } });
      if (!b) return { error: "Sucursal no encontrada." };
      await prisma.branch.update({ where: { id }, data });
      await audit(ctx, "branch.update", "branch", id);
    } else {
      const b = await prisma.branch.create({ data: { ...data, orgId: ctx.orgId } });
      await audit(ctx, "branch.create", "branch", b.id);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe una sucursal con ese código.", fieldErrors: { code: "Código en uso" } };
    }
    throw e;
  }
  revalidatePath("/configuracion/sucursales");
  redirect("/configuracion/sucursales");
}

const userSchema = z.object({
  name: z.string({ error: "Requerido" }).min(2).max(80),
  email: z.email("Correo inválido"),
  rut: z.string().optional().refine((v) => !v || isValidRut(v), "RUT inválido"),
  role: z.enum(["ADMIN", "OPTOMETRA", "VENDEDOR", "RECEPCION"]),
  isProfessional: z.literal("on").optional(),
  registroSis: z.string().max(30).optional(),
  password: z.string().min(8, "Mínimo 8 caracteres").optional(),
  active: z.literal("on").optional(),
});

export async function saveUser(id: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireRole("ADMIN");
  const parsed = userSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodToState(parsed.error);
  const u = parsed.data;
  if (!id && !u.password) return { error: "Define una contraseña inicial.", fieldErrors: { password: "Requerida" } };
  if (id === ctx.user.id && (u.role !== "ADMIN" || u.active !== "on")) {
    return { error: "No puedes quitarte el rol de administrador ni desactivarte a ti mismo." };
  }

  const orgBranches = await prisma.branch.findMany({ where: { orgId: ctx.orgId }, select: { id: true } });
  const branchIds = fd.getAll("branchIds").map(String).filter((b) => orgBranches.some((o) => o.id === b));
  if (u.role !== "ADMIN" && branchIds.length === 0) {
    return { error: "Asigna al menos una sucursal.", fieldErrors: { branchIds: "Requerido" } };
  }

  const data = {
    name: u.name,
    email: u.email.toLowerCase(),
    rut: u.rut ? normalizeRut(u.rut) : null,
    role: u.role,
    isProfessional: u.isProfessional === "on",
    registroSis: u.registroSis ?? null,
    active: id ? u.active === "on" : true,
    ...(u.password ? { passwordHash: await bcrypt.hash(u.password, 10) } : {}),
  };

  try {
    if (id) {
      const existing = await prisma.user.findFirst({ where: { id, orgId: ctx.orgId } });
      if (!existing) return { error: "Usuario no encontrado." };
      await prisma.$transaction([
        prisma.user.update({ where: { id }, data }),
        prisma.userBranch.deleteMany({ where: { userId: id } }),
        prisma.userBranch.createMany({ data: branchIds.map((branchId) => ({ userId: id, branchId })) }),
      ]);
      await audit(ctx, "user.update", "user", id, { role: u.role, branchIds });
    } else {
      const created = await prisma.user.create({
        data: {
          ...data,
          passwordHash: data.passwordHash!,
          orgId: ctx.orgId,
          branches: { create: branchIds.map((branchId) => ({ branchId })) },
        },
      });
      await audit(ctx, "user.create", "user", created.id, { role: u.role, branchIds });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ese correo ya está registrado.", fieldErrors: { email: "En uso" } };
    }
    throw e;
  }
  revalidatePath("/configuracion/usuarios");
  redirect("/configuracion/usuarios");
}
