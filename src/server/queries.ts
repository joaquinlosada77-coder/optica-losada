import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { cleanRut, looksLikeRut } from "@/lib/rut";
import { dayRangeUtc } from "@/lib/time";

/** Búsqueda de pacientes por RUT (parcial, sin DV obligatorio), nombre, apellido, teléfono o correo. */
export async function searchPatients(orgId: string, q: string, take = 30) {
  const term = q.trim();
  let where: Prisma.PatientWhereInput = { orgId, active: true };

  if (term) {
    if (looksLikeRut(term)) {
      const clean = cleanRut(term);
      // "12345678" o "12345678-5": buscamos por prefijo del RUT normalizado
      where = { ...where, OR: [{ rut: { startsWith: clean } }, { rut: { startsWith: `${clean.slice(0, -1)}-${clean.slice(-1)}` } }] };
    } else {
      const words = term.split(/\s+/).filter(Boolean);
      where = {
        ...where,
        AND: words.map((w) => ({
          OR: [
            { nombres: { contains: w, mode: "insensitive" as const } },
            { apellidoPaterno: { contains: w, mode: "insensitive" as const } },
            { apellidoMaterno: { contains: w, mode: "insensitive" as const } },
            { email: { contains: w, mode: "insensitive" as const } },
            { telefono: { contains: w } },
            { documentoExtranjero: { contains: w, mode: "insensitive" as const } },
          ],
        })),
      };
    }
  }

  return prisma.patient.findMany({
    where,
    orderBy: term ? [{ apellidoPaterno: "asc" }, { nombres: "asc" }] : { createdAt: "desc" },
    take,
  });
}

/** Profesionales que atienden en una sucursal (columnas de la agenda). */
export async function branchProfessionals(orgId: string, branchId: string) {
  return prisma.user.findMany({
    where: {
      orgId,
      active: true,
      isProfessional: true,
      OR: [{ role: "ADMIN" }, { branches: { some: { branchId } } }],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function dayAppointments(orgId: string, branchId: string, dateISO: string) {
  const { start, end } = dayRangeUtc(dateISO);
  return prisma.appointment.findMany({
    where: { orgId, branchId, startsAt: { gte: start, lt: end } },
    include: { patient: true, professional: { select: { id: true, name: true } } },
    orderBy: { startsAt: "asc" },
  });
}

export function patientFullName(p: { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null }) {
  return [p.nombres, p.apellidoPaterno, p.apellidoMaterno].filter(Boolean).join(" ");
}
