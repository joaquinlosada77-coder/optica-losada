"use server";

import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isValidRut, normalizeRut } from "@/lib/rut";
import { GESVISION_BRANCHES } from "@/lib/setup-branches";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { formToObject, zodToState, type FormState } from "@/server/form";

const schema = z
  .object({
    token: z.string({ error: "Requerido" }).min(1, "Requerido"),
    orgName: z.string({ error: "Requerido" }).min(2, "Requerido").max(80),
    orgRut: z.string({ error: "Requerido" }).refine(isValidRut, "RUT inválido"),
    razonSocial: z.string({ error: "Requerido" }).min(2, "Requerido").max(120),
    giro: z.string().max(120).optional(),
    adminName: z.string({ error: "Requerido" }).min(2, "Requerido").max(80),
    adminEmail: z.email("Correo inválido"),
    password: z.string({ error: "Requerido" }).min(10, "Mínimo 10 caracteres"),
    password2: z.string({ error: "Requerido" }),
    branches: z.literal("on").optional(),
  })
  .refine((d) => d.password === d.password2, { message: "Las contraseñas no coinciden", path: ["password2"] });

function tokenOk(given: string): boolean {
  const expected = process.env.SETUP_TOKEN ?? "";
  if (expected.length < 8) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Primera configuración: solo funciona con la base vacía y la clave SETUP_TOKEN. */
export async function runSetup(_prev: FormState, fd: FormData): Promise<FormState> {
  if (await prisma.organization.count()) return { error: "El sistema ya está configurado. Ingresa con tu usuario." };
  const parsed = schema.safeParse(formToObject(fd));
  if (!parsed.success) return zodToState(parsed.error);
  const d = parsed.data;
  if (!tokenOk(d.token)) return { error: "Clave de configuración incorrecta.", fieldErrors: { token: "Incorrecta" } };

  const user = await prisma.$transaction(async (tx) => {
    // Re-chequeo dentro de la transacción para evitar dos configuraciones simultáneas
    if (await tx.organization.count()) throw new Error("ya configurado");
    const org = await tx.organization.create({
      data: { name: d.orgName, rut: normalizeRut(d.orgRut), razonSocial: d.razonSocial, giro: d.giro ?? null },
    });
    const branchRows = d.branches === "on"
      ? GESVISION_BRANCHES.map((b) => ({ ...b, orgId: org.id }))
      : [{ code: "MATRIZ", name: "Casa matriz", comuna: null, region: null, active: true, orgId: org.id }];
    await tx.branch.createMany({ data: branchRows });
    return tx.user.create({
      data: {
        orgId: org.id,
        email: d.adminEmail.toLowerCase(),
        name: d.adminName,
        role: "ADMIN",
        passwordHash: await bcrypt.hash(d.password, 10),
      },
    });
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: user.id, org: user.orgId }), sessionCookieOptions);
  redirect("/configuracion/importar");
}
