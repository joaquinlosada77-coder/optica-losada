"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isQuarterStep } from "@/lib/lenses";
import { audit, requireContext } from "@/server/auth";
import { formToObject, zodToState, type FormState } from "@/server/form";

const diopter = (min: number, max: number) =>
  z.coerce
    .number({ error: "Número inválido" })
    .min(min, `Mínimo ${min}`)
    .max(max, `Máximo ${max}`)
    .refine(isQuarterStep, "Debe ir en pasos de 0,25");
const optional = <T extends z.ZodTypeAny>(s: T) => s.optional();
const axis = z.coerce.number().int("Entero").min(0, "0 a 180").max(180, "0 a 180");
const dp = z.coerce.number().min(20, "Revisa la DP").max(45, "Revisa la DP");

const rxSchema = z
  .object({
    issuedAt: z.iso.date("Fecha inválida"),
    professionalId: z.string().optional(),
    odSph: diopter(-30, 30),
    odCyl: optional(diopter(-10, 10)),
    odAxis: optional(axis),
    odAdd: optional(diopter(0.25, 4)),
    oiSph: diopter(-30, 30),
    oiCyl: optional(diopter(-10, 10)),
    oiAxis: optional(axis),
    oiAdd: optional(diopter(0.25, 4)),
    dpOd: optional(dp),
    dpOi: optional(dp),
    notes: z.string().max(1000).optional(),
  })
  .refine((r) => !r.odCyl || r.odAxis !== undefined, { message: "Falta el eje", path: ["odAxis"] })
  .refine((r) => !r.oiCyl || r.oiAxis !== undefined, { message: "Falta el eje", path: ["oiAxis"] });

export async function createPrescription(patientId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireContext();
  const raw = formToObject(fd);
  // Aceptar coma decimal (-1,25)
  for (const k of Object.keys(raw)) if (raw[k] && /^[+-]?\d+,\d+$/.test(raw[k]!)) raw[k] = raw[k]!.replace(",", ".");
  const parsed = rxSchema.safeParse(raw);
  if (!parsed.success) return zodToState(parsed.error);
  const r = parsed.data;

  const patient = await prisma.patient.findFirst({ where: { id: patientId, orgId: ctx.orgId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado." };
  if (r.professionalId) {
    const ok = await prisma.user.count({ where: { id: r.professionalId, orgId: ctx.orgId, isProfessional: true } });
    if (!ok) return { error: "Profesional no válido." };
  }

  const p = await prisma.prescription.create({
    data: {
      orgId: ctx.orgId,
      patientId,
      professionalId: r.professionalId ?? (ctx.user.isProfessional ? ctx.user.id : null),
      issuedAt: new Date(`${r.issuedAt}T00:00:00Z`),
      odSph: r.odSph, odCyl: r.odCyl ?? 0, odAxis: r.odCyl ? r.odAxis! : null, odAdd: r.odAdd ?? null,
      oiSph: r.oiSph, oiCyl: r.oiCyl ?? 0, oiAxis: r.oiCyl ? r.oiAxis! : null, oiAdd: r.oiAdd ?? null,
      dpOd: r.dpOd ?? null, dpOi: r.dpOi ?? null,
      notes: r.notes ?? null,
      createdById: ctx.user.id,
    },
  });
  await audit(ctx, "prescription.create", "prescription", p.id, { patientId });
  revalidatePath(`/pacientes/${patientId}`);

  const returnTo = fd.get("returnTo");
  redirect(typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : `/pacientes/${patientId}`);
}
