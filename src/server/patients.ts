"use server";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isValidRut, normalizeRut } from "@/lib/rut";
import { audit, requireContext } from "@/server/auth";
import { formToObject, zodToState, type FormState } from "@/server/form";

const patientSchema = z
  .object({
    rut: z
      .string()
      .optional()
      .refine((v) => !v || isValidRut(v), "RUT inválido (revisa el dígito verificador)"),
    documentoExtranjero: z.string().max(30).optional(),
    nombres: z.string({ error: "Requerido" }).min(1, "Requerido").max(80),
    apellidoPaterno: z.string({ error: "Requerido" }).min(1, "Requerido").max(60),
    apellidoMaterno: z.string().max(60).optional(),
    fechaNacimiento: z.iso.date("Fecha inválida").optional(),
    sexo: z.enum(["F", "M", "OTRO", "NO_INFORMA"]).optional(),
    email: z.email("Correo inválido").optional(),
    telefono: z
      .string()
      .regex(/^\+?[\d\s()-]{8,16}$/, "Teléfono inválido (ej: +56 9 1234 5678)")
      .optional(),
    direccion: z.string().max(150).optional(),
    comuna: z.string().max(60).optional(),
    region: z.string().max(60).optional(),
    prevision: z.enum(["FONASA", "ISAPRE", "CAPREDENA", "DIPRECA", "PARTICULAR", "OTRA"]).optional(),
    isapre: z.string().max(60).optional(),
    ocupacion: z.string().max(80).optional(),
    notas: z.string().max(2000).optional(),
    aceptaMarketing: z.literal("on").optional(),
  })
  .refine((p) => p.rut || p.documentoExtranjero, {
    message: "Ingresa RUT o documento de extranjero",
    path: ["rut"],
  });

function toData(p: z.infer<typeof patientSchema>) {
  return {
    rut: p.rut ? normalizeRut(p.rut) : null,
    documentoExtranjero: p.documentoExtranjero ?? null,
    nombres: p.nombres,
    apellidoPaterno: p.apellidoPaterno,
    apellidoMaterno: p.apellidoMaterno ?? null,
    fechaNacimiento: p.fechaNacimiento ? new Date(`${p.fechaNacimiento}T00:00:00Z`) : null,
    sexo: p.sexo ?? null,
    email: p.email?.toLowerCase() ?? null,
    telefono: p.telefono ?? null,
    direccion: p.direccion ?? null,
    comuna: p.comuna ?? null,
    region: p.region ?? null,
    prevision: p.prevision ?? null,
    isapre: p.prevision === "ISAPRE" ? (p.isapre ?? null) : null,
    ocupacion: p.ocupacion ?? null,
    notas: p.notas ?? null,
    aceptaMarketing: p.aceptaMarketing === "on",
  };
}

function duplicateRut(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createPatient(_prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const parsed = patientSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodToState(parsed.error);

  let id: string;
  try {
    const p = await prisma.patient.create({
      data: { ...toData(parsed.data), orgId: ctx.orgId, homeBranchId: ctx.branch.id },
    });
    id = p.id;
  } catch (e) {
    if (duplicateRut(e)) return { error: "Ya existe un paciente con ese RUT.", fieldErrors: { rut: "RUT ya registrado" } };
    throw e;
  }
  await audit(ctx, "patient.create", "patient", id);
  revalidatePath("/pacientes");

  const returnTo = fd.get("returnTo");
  if (typeof returnTo === "string" && (returnTo.startsWith("/agenda/nueva") || returnTo.startsWith("/ventas/nueva"))) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}patientId=${id}`);
  }
  redirect(`/pacientes/${id}`);
}

export async function updatePatient(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const parsed = patientSchema.safeParse(formToObject(fd));
  if (!parsed.success) return zodToState(parsed.error);

  const existing = await prisma.patient.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!existing) return { error: "Paciente no encontrado." };

  try {
    await prisma.patient.update({ where: { id }, data: toData(parsed.data) });
  } catch (e) {
    if (duplicateRut(e)) return { error: "Ya existe un paciente con ese RUT.", fieldErrors: { rut: "RUT ya registrado" } };
    throw e;
  }
  await audit(ctx, "patient.update", "patient", id);
  revalidatePath(`/pacientes/${id}`);
  redirect(`/pacientes/${id}`);
}
