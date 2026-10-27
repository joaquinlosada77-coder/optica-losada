// Datos de demostración: 1 empresa, 2 sucursales, 4 usuarios, pacientes y citas de hoy.
import bcrypt from "bcryptjs";
import { PrismaClient, type Patient } from "@prisma/client";
import { computeDv } from "../src/lib/rut";
import { localToUtc, todayISO } from "../src/lib/time";

const prisma = new PrismaClient();
const rut = (n: number) => `${n}-${computeDv(n)}`;

async function main() {
  if (await prisma.organization.findFirst()) {
    console.log("La base ya tiene datos; seed omitido.");
    return;
  }
  const org = await prisma.organization.create({
    data: { name: "Óptica Demo", rut: rut(76543210), razonSocial: "Óptica Demo SpA", giro: "Venta al por menor de artículos ópticos" },
  });
  const centro = await prisma.branch.create({
    data: { orgId: org.id, code: "CENTRO", name: "Santiago Centro", address: "Ahumada 123", comuna: "Santiago", region: "Metropolitana de Santiago", openTime: "10:00", closeTime: "19:00", slotMinutes: 30 },
  });
  const provi = await prisma.branch.create({
    data: { orgId: org.id, code: "PROV", name: "Providencia", address: "Av. Providencia 2100", comuna: "Providencia", region: "Metropolitana de Santiago", openTime: "10:30", closeTime: "20:00", slotMinutes: 20 },
  });

  const hash = await bcrypt.hash("optica123", 10);
  const admin = await prisma.user.create({ data: { orgId: org.id, email: "admin@optica.cl", name: "Carolina Muñoz", role: "ADMIN", passwordHash: hash } });
  const tm1 = await prisma.user.create({
    data: { orgId: org.id, email: "tm@optica.cl", name: "Felipe Rojas", role: "OPTOMETRA", isProfessional: true, registroSis: "123456", passwordHash: hash,
      branches: { create: [{ branchId: centro.id }, { branchId: provi.id }] } },
  });
  const tm2 = await prisma.user.create({
    data: { orgId: org.id, email: "tm2@optica.cl", name: "Daniela Soto", role: "OPTOMETRA", isProfessional: true, passwordHash: hash,
      branches: { create: [{ branchId: centro.id }] } },
  });
  await prisma.user.create({
    data: { orgId: org.id, email: "recepcion@optica.cl", name: "Javiera Pérez", role: "RECEPCION", passwordHash: hash,
      branches: { create: [{ branchId: centro.id }] } },
  });

  const people = [
    ["María José", "González", "Fuentes", 15678234, "1985-04-12", "F", "+56 9 8765 4321", "FONASA"],
    ["Juan Pablo", "Muñoz", "Díaz", 9876543, "1962-11-03", "M", "+56 9 1111 2222", "ISAPRE"],
    ["Camila", "Rojas", "Vera", 20123456, "2001-07-25", "F", "+56 9 3333 4444", "FONASA"],
    ["Pedro", "Contreras", null, 12345678, "1978-01-30", "M", "+56 9 5555 6666", "PARTICULAR"],
    ["Valentina", "Silva", "Araya", 22345678, "2012-09-09", "F", "+56 9 7777 8888", "ISAPRE"],
  ] as const;
  const patients: Patient[] = [];
  for (const [nombres, ap, am, n, fn, sexo, tel, prev] of people) {
    patients.push(
      await prisma.patient.create({
        data: {
          orgId: org.id, homeBranchId: centro.id, rut: rut(n), nombres, apellidoPaterno: ap, apellidoMaterno: am,
          fechaNacimiento: new Date(`${fn}T00:00:00Z`), sexo, telefono: tel, prevision: prev,
          isapre: prev === "ISAPRE" ? "Colmena" : null, comuna: "Santiago", region: "Metropolitana de Santiago", aceptaMarketing: true,
        },
      }),
    );
  }

  const d = todayISO();
  const appt = (branchId: string, pro: string | null, i: number, time: string, min: number, status: "AGENDADA" | "CONFIRMADA" | "ATENDIDA" = "AGENDADA", type: "CONTROL_VISUAL" | "ENTREGA_LENTES" | "ADAPTACION_LC" = "CONTROL_VISUAL") => {
    const startsAt = localToUtc(d, time);
    return prisma.appointment.create({
      data: { orgId: org.id, branchId, professionalId: pro, patientId: patients[i].id, startsAt, endsAt: new Date(startsAt.getTime() + min * 60000), status, type, createdById: admin.id },
    });
  };
  await appt(centro.id, tm1.id, 0, "10:00", 30, "ATENDIDA");
  await appt(centro.id, tm1.id, 1, "11:00", 60, "CONFIRMADA");
  await appt(centro.id, tm2.id, 2, "10:30", 30, "AGENDADA", "ADAPTACION_LC");
  await appt(centro.id, null, 3, "12:00", 15, "AGENDADA", "ENTREGA_LENTES");
  await appt(provi.id, tm1.id, 4, "16:00", 40, "CONFIRMADA");

  console.log("Seed OK. Usuarios (clave optica123): admin@optica.cl, tm@optica.cl, tm2@optica.cl, recepcion@optica.cl");
}

main().finally(() => prisma.$disconnect());
