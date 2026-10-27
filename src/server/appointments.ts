"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BLOCKING_STATUSES } from "@/lib/agenda";
import { fmtDateISO, localToUtc } from "@/lib/time";
import { audit, requireContext, type AppContext } from "@/server/auth";
import { branchProfessionals } from "@/server/queries";
import { formToObject, zodToState, type FormState } from "@/server/form";

const apptSchema = z
  .object({
    date: z.iso.date("Fecha inválida"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida"),
    duration: z.coerce.number().int().min(5, "Mínimo 5 min").max(480, "Máximo 8 horas"),
    professionalId: z.string().optional(),
    patientId: z.string().optional(),
    contactName: z.string().max(120).optional(),
    contactPhone: z.string().max(20).optional(),
    type: z.enum(["CONTROL_VISUAL", "ADAPTACION_LC", "ENTREGA_LENTES", "AJUSTE_REPARACION", "OTRO"]),
    notes: z.string().max(1000).optional(),
  })
  .refine((a) => a.patientId || a.contactName, {
    message: "Selecciona un paciente o indica un nombre de contacto",
    path: ["patientId"],
  });

function isOverlapViolation(e: unknown): boolean {
  return e instanceof Error && e.message.includes("appointments_no_overlap");
}

type Built =
  | { state: FormState }
  | {
      ctx: AppContext;
      date: string;
      data: {
        startsAt: Date;
        endsAt: Date;
        professionalId: string | null;
        patientId: string | null;
        contactName: string | null;
        contactPhone: string | null;
        type: z.infer<typeof apptSchema>["type"];
        notes: string | null;
      };
    };

async function validateAndBuild(fd: FormData, excludeId?: string): Promise<Built> {
  const ctx = await requireContext();
  const parsed = apptSchema.safeParse(formToObject(fd));
  if (!parsed.success) return { state: zodToState(parsed.error) };
  const a = parsed.data;

  const startsAt = localToUtc(a.date, a.time);
  const endsAt = new Date(startsAt.getTime() + a.duration * 60_000);

  if (a.professionalId) {
    const pros = await branchProfessionals(ctx.orgId, ctx.branch.id);
    if (!pros.some((p) => p.id === a.professionalId)) {
      return { state: { error: "El profesional no atiende en esta sucursal.", fieldErrors: { professionalId: "No válido" } } };
    }
    const clash = await prisma.appointment.findFirst({
      where: {
        professionalId: a.professionalId,
        status: { in: [...BLOCKING_STATUSES] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      include: { branch: { select: { name: true } } },
    });
    if (clash) {
      return {
        state: { error: `El profesional ya tiene una cita que se traslapa (sucursal ${clash.branch.name}).`, fieldErrors: { time: "Horario ocupado" } },
      };
    }
  }

  if (a.patientId) {
    const p = await prisma.patient.findFirst({ where: { id: a.patientId, orgId: ctx.orgId }, select: { id: true } });
    if (!p) return { state: { error: "Paciente no encontrado." } };
  }

  return {
    ctx,
    data: {
      startsAt,
      endsAt,
      professionalId: a.professionalId ?? null,
      patientId: a.patientId ?? null,
      contactName: a.patientId ? null : (a.contactName ?? null),
      contactPhone: a.contactPhone ?? null,
      type: a.type,
      notes: a.notes ?? null,
    },
    date: a.date,
  };
}

export async function createAppointment(_prev: FormState, fd: FormData): Promise<FormState> {
  const r = await validateAndBuild(fd);
  if ("state" in r) return r.state;
  const { ctx, data, date } = r;

  try {
    const appt = await prisma.appointment.create({
      data: { ...data, orgId: ctx.orgId, branchId: ctx.branch.id, createdById: ctx.user.id },
    });
    await audit(ctx, "appointment.create", "appointment", appt.id);
  } catch (e) {
    if (isOverlapViolation(e)) return { error: "Ese horario acaba de ser tomado. Elige otro.", fieldErrors: { time: "Horario ocupado" } };
    throw e;
  }
  revalidatePath("/agenda");
  redirect(`/agenda?fecha=${date}`);
}

export async function updateAppointment(id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const r = await validateAndBuild(fd, id);
  if ("state" in r) return r.state;
  const { ctx, data, date } = r;

  const existing = await prisma.appointment.findFirst({ where: { id, orgId: ctx.orgId, branchId: ctx.branch.id } });
  if (!existing) return { error: "Cita no encontrada en esta sucursal." };

  try {
    await prisma.appointment.update({ where: { id }, data });
    await audit(ctx, "appointment.update", "appointment", id, {
      from: existing.startsAt.toISOString(),
      to: data.startsAt.toISOString(),
    });
  } catch (e) {
    if (isOverlapViolation(e)) return { error: "Ese horario se traslapa con otra cita.", fieldErrors: { time: "Horario ocupado" } };
    throw e;
  }
  revalidatePath("/agenda");
  redirect(`/agenda?fecha=${date}`);
}

const STATUSES: AppointmentStatus[] = ["AGENDADA", "CONFIRMADA", "EN_ATENCION", "ATENDIDA", "NO_ASISTIO", "CANCELADA"];

export async function setAppointmentStatus(fd: FormData) {
  const ctx = await requireContext();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "") as AppointmentStatus;
  if (!STATUSES.includes(status)) throw new Error("Estado inválido");

  const appt = await prisma.appointment.findFirst({ where: { id, orgId: ctx.orgId, branchId: ctx.branch.id } });
  if (!appt) throw new Error("Cita no encontrada");

  try {
    await prisma.appointment.update({ where: { id }, data: { status } });
  } catch (e) {
    // Reactivar una cita cancelada puede chocar con otra tomada en ese bloque
    if (isOverlapViolation(e)) redirect(`/agenda?fecha=${fmtDateISO(appt.startsAt)}&error=traslape`);
    throw e;
  }
  await audit(ctx, "appointment.status", "appointment", id, { from: appt.status, to: status });
  revalidatePath("/agenda");
  revalidatePath("/");
  const returnTo = String(fd.get("returnTo") ?? "");
  redirect(returnTo.startsWith("/") ? returnTo : `/agenda?fecha=${fmtDateISO(appt.startsAt)}`);
}
