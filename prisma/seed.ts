// Datos de demostración: 1 empresa, 2 sucursales, 4 usuarios, pacientes y citas de hoy.
import bcrypt from "bcryptjs";
import { PrismaClient, type Patient } from "@prisma/client";
import { computeDv } from "../src/lib/rut";
import { localToUtc, todayISO } from "../src/lib/time";

const prisma = new PrismaClient();
const rut = (n: number) => `${n}-${computeDv(n)}`;

async function main() {
  const existing = await prisma.organization.findFirst();
  if (existing) {
    await seedSalesCatalog(existing.id);
    console.log("La base ya tenía datos; solo se completó el catálogo de ventas si faltaba.");
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

  await seedSalesCatalog(org.id);
  console.log("Seed OK. Usuarios (clave optica123): admin@optica.cl, tm@optica.cl, tm2@optica.cl, recepcion@optica.cl");
}

// Catálogo de ventas y configurador de cristales (precios referenciales CLP con IVA)
async function seedSalesCatalog(orgId: string) {
  if (!(await prisma.lensMaterial.count({ where: { orgId } }))) await seedLensCatalog(orgId);
  if (!(await prisma.product.count({ where: { orgId } }))) await seedProducts(orgId);
  if (!(await prisma.prescription.count({ where: { orgId } }))) await seedPrescriptions(orgId);
}

async function seedLensCatalog(orgId: string) {

  // Estructura tomada de la configuración real en Gesvision (gamas, tratamientos, índices). Precios de ejemplo.
  const materials = await Promise.all(
    ([
      ["150", "Orgánico CR-39", "1.50", "Excelente calidad óptica a buen precio. Ideal para graduaciones bajas.", 1, 0, 4, 10],
      ["156", "Índice medio 1.56", "1.56", "Algo más delgado que el CR-39, a precio conveniente.", 2, 1.5, 5, 15],
      ["159", "Policarbonato", "1.59", "Resiste impactos: ideal para niños y deporte.", 2, 2, 6, 20],
      ["160", "Alto índice 1.60", "1.60", "Hasta 25% más delgado y liviano.", 3, 3, 8, 30],
      ["167", "Alto índice 1.67", "1.67", "Hasta 35% más delgado. Recomendado desde ±4,50.", 4, 4.5, 10, 40],
      ["174", "Ultra delgado 1.74", "1.74", "El más delgado disponible, para graduaciones altas.", 5, 7, 14, 50],
    ] as const).map(([code, name, refractiveIndex, description, thinness, recommendFromPower, maxPower, sortOrder]) =>
      prisma.lensMaterial.create({ data: { orgId, code, name, refractiveIndex, description, thinness, recommendFromPower, maxPower, sortOrder } }),
    ),
  );
  const designs = await Promise.all(
    ([
      ["MONBAS", "Monofocal Básico", "Una graduación, lejos o cerca.", "MONOFOCAL", false, 10],
      ["MONDIG", "Monofocal Digital", "Tallado digital: más nitidez en los bordes.", "MONOFOCAL", false, 20],
      ["BIF", "Bifocal", "Lejos y cerca, con línea visible.", "BIFOCAL", true, 30],
      ["PROGBAS", "Progresivo Básico", "Lejos, intermedio y cerca sin líneas.", "PROGRESIVO", true, 40],
      ["PROGINT", "Progresivo Intermedio", "Campos de visión más amplios y adaptación más fácil.", "PROGRESIVO", true, 50],
      ["PROGPER", "Progresivo Personalizado", "Diseñado a tu medida: máxima comodidad.", "PROGRESIVO", true, 60],
      ["OCUP", "Ocupacional", "Para computador y oficina: intermedio y cerca.", "OCUPACIONAL", true, 70],
    ] as const).map(([code, name, description, family, requiresAdd, sortOrder]) =>
      prisma.lensDesign.create({ data: { orgId, code, name, description, family, requiresAdd, sortOrder } }),
    ),
  );
  await prisma.lensTreatment.createMany({
    data: ([
      ["AR", "Antirreflejo", "Elimina reflejos y mejora la visión nocturna.", "AR", 20000, 10],
      ["ARTOP", "AR Top", "Antirreflejo premium, más fácil de limpiar.", "AR", 35000, 20],
      ["ARTOPP", "AR Top P", "AR Top con protección extra.", "AR", 45000, 30],
      ["ARTOPPP", "AR Top P+", "La máxima protección y durabilidad.", "AR", 55000, 40],
      ["DURA", "DuraVision", "Antirreflejo Zeiss de alta resistencia.", "AR", 60000, 50],
      ["BLUE", "Blue Protect", "Filtra la luz azul de pantallas y reduce la fatiga.", null, 30000, 60],
      ["HC", "Endurecido (HC)", "Mayor resistencia a rayas.", null, 10000, 70],
      ["DEG", "Degradado", "Color degradado para sol.", "COLOR", 25000, 80],
      ["POLAR", "Polarizado", "Elimina el encandilamiento: ideal para conducir.", "COLOR", 50000, 90],
    ] as const).map(([code, name, description, exclusiveGroup, price, sortOrder]) => ({ orgId, code, name, description, exclusiveGroup, price, sortOrder })),
  });
  // Precio base del par por índice × gama (null = no disponible)
  const matrix: Record<string, (number | null)[]> = {
    //       MONBAS  MONDIG  BIF    PROGBAS PROGINT PROGPER OCUP
    "150": [25000, 45000, 60000, 110000, 160000, null, 90000],
    "156": [32000, 55000, 70000, 125000, 180000, null, 100000],
    "159": [45000, 65000, 80000, 140000, 190000, 260000, 110000],
    "160": [60000, 80000, null, 160000, 210000, 290000, 130000],
    "167": [95000, 120000, null, 210000, 260000, 340000, 170000],
    "174": [160000, 190000, null, null, 330000, 420000, null],
  };
  await prisma.lensPrice.createMany({
    data: materials.flatMap((m) =>
      designs.flatMap((d, i) => (matrix[m.code][i] === null ? [] : [{ materialId: m.id, designId: d.id, price: matrix[m.code][i]! }])),
    ),
  });

}

async function seedProducts(orgId: string) {
  await prisma.product.createMany({
    data: ([
      ["RB5154", "Ray-Ban Clubmaster RB5154", "Ray-Ban", "ARMAZON", 89990, true],
      ["VO5286", "Vogue VO5286", "Vogue", "ARMAZON", 69990, true],
      ["GEN-MET", "Armazón metálico", "Genérico", "ARMAZON", 29990, true],
      ["INF-FLEX", "Armazón infantil flexible", "Genérico", "ARMAZON", 34990, false],
      ["RB3025", "Ray-Ban Aviator RB3025", "Ray-Ban", "LENTE_SOL", 129990, false],
      ["OASIS6", "Acuvue Oasis (caja 6)", "Johnson & Johnson", "LENTE_CONTACTO", 32990, true],
      ["AIROPT6", "Air Optix Aqua (caja 6)", "Alcon", "LENTE_CONTACTO", 29990, false],
      ["OPTIF300", "Opti-Free PureMoist 300 ml", "Alcon", "LIQUIDO", 12990, true],
      ["RENU355", "ReNu MultiPlus 355 ml", "Bausch + Lomb", "LIQUIDO", 9990, false],
      ["ESTUCHE", "Estuche rígido", null, "ACCESORIO", 4990, true],
      ["PANO", "Paño microfibra", null, "ACCESORIO", 1990, false],
      ["CORDON", "Cordón para lentes", null, "ACCESORIO", 2990, false],
      ["EXAMEN", "Examen visual", null, "SERVICIO", 15000, true],
      ["AJUSTE", "Ajuste / reparación", null, "SERVICIO", 5000, false],
    ] as const).map(([sku, name, brand, type, price, favorite]) => ({ orgId, sku, name, brand, type, price, favorite })),
  });

}

async function seedPrescriptions(orgId: string) {
  // Recetas de ejemplo para los pacientes demo
  const pro = await prisma.user.findFirst({ where: { orgId, isProfessional: true } });
  const byRut = async (n: number) => prisma.patient.findFirst({ where: { orgId, rut: rut(n) } });
  const rxs: [number, Partial<Record<string, number>>][] = [
    [15678234, { odSph: -2.25, odCyl: -0.75, odAxis: 180, oiSph: -2, oiCyl: -0.5, oiAxis: 170 }],
    [9876543, { odSph: 1.5, odAdd: 2, oiSph: 1.75, oiAdd: 2 }],
    [20123456, { odSph: -5.5, odCyl: -1, odAxis: 10, oiSph: -5, oiCyl: -0.75, oiAxis: 175 }],
    [12345678, { odSph: -0.75, oiSph: -0.5 }],
  ];
  for (const [n, r] of rxs) {
    const p = await byRut(n);
    if (!p || !pro) continue;
    await prisma.prescription.create({
      data: {
        orgId, patientId: p.id, professionalId: pro.id, createdById: pro.id, issuedAt: new Date(`${todayISO()}T00:00:00Z`),
        odSph: r.odSph!, odCyl: r.odCyl ?? 0, odAxis: r.odAxis ?? null, odAdd: r.odAdd ?? null,
        oiSph: r.oiSph!, oiCyl: r.oiCyl ?? 0, oiAxis: r.oiAxis ?? null, oiAdd: r.oiAdd ?? null, dpOd: 31.5, dpOi: 31,
      },
    });
  }
}

main().finally(() => prisma.$disconnect());
