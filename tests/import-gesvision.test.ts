import { describe, expect, it } from "vitest";
import { excelDate, fixAxis, fixDiopter, missingHeaders, normalizePhone, normalizeRow, splitName, type Warning } from "@/lib/import/gesvision";

// Datos sintéticos (no corresponden a personas reales)
const base = {
  "Fecha": new Date(Date.UTC(2026, 1, 1, 20, 0, 0)), // medianoche España del 02-02 vista en Chile
  "Serie": "1006",
  "Local": "Optica  Demo  Centro",
  "Tecnólogo": "PEDRO PRUEBA",
  "Código Cliente": "000123",
  "Razón social": "MARIA JOSE PRUEBA DE LA FUENTE",
  "Fecha de nacimiento": "null",
  "NIE": "12345678-5",
  "Teléfono móvil": "987654321",
  "Email": " Persona@Ejemplo.CL ",
  "Esfera OD": -1.5, "Cilindro OD": -75, "Eje OD": 15500, "Adición OD": 275, "AVCC OD": "1,0p", "D.N/P.L. OD": 62,
  "Esfera OI": null, "Cilindro OI": -0.699999988, "Eje OI": 90, "Adición OI": 2.75, "AVCC OI": "1,0", "D.N/P.L. OI": 62,
};

describe("importación Gesvision", () => {
  it("corrige dioptrías sin coma y ruido de decimales", () => {
    const w: Warning[] = [];
    expect(fixDiopter(125, 30, w)).toBe(1.25);
    expect(fixDiopter(-75, 10, w)).toBe(-0.75);
    expect(fixDiopter(-0.699999988, 10, w)).toBe(-0.75);
    expect(fixDiopter(-2.257999, 10, w)).toBe(-2.25);
    expect(fixDiopter(-0.15, 10, w)).toBe(-0.25);
    expect(fixDiopter(-3333, 10, w)).toBeNull();
    expect(fixDiopter(25, 20, w)).toBe(0.25);
    expect(fixDiopter(-18, 20, w)).toBe(-18);
    expect(fixDiopter("", 10, w)).toBeNull();
    expect(w).toContain("valor_sin_coma");
    expect(w).toContain("valor_redondeado");
    expect(w).toContain("valor_descartado");
  });

  it("corrige ejes", () => {
    const w: Warning[] = [];
    expect(fixAxis(15500, w)).toBe(155);
    expect(fixAxis(9000, w)).toBe(90);
    expect(fixAxis(450, w)).toBe(45);
    expect(fixAxis(185, w)).toBeNull();
    expect(fixAxis(-90, w)).toBeNull();
    expect(fixAxis(0, w)).toBe(0);
  });

  it("corrige fechas guardadas como medianoche de España", () => {
    expect(excelDate(new Date(Date.UTC(2026, 1, 1, 20, 0, 0)))).toBe("2026-02-02"); // verano
    expect(excelDate(new Date(Date.UTC(2026, 4, 21, 18, 0, 0)))).toBe("2026-05-22"); // invierno
    expect(excelDate(new Date(Date.UTC(2026, 9, 27, 16, 43, 20)))).toBe("2026-10-27"); // timestamp real
    expect(excelDate(new Date(Date.UTC(1985, 3, 12, 0, 0, 0)))).toBe("1985-04-12");
    expect(excelDate("null")).toBeNull();
  });

  it("separa nombres y apellidos", () => {
    expect(splitName("MARIA JOSE PRUEBA DE LA FUENTE")).toEqual({ nombres: "Maria Jose", apellidoPaterno: "Prueba", apellidoMaterno: "De la Fuente" });
    expect(splitName("JUAN PEREZ SOTO")).toEqual({ nombres: "Juan", apellidoPaterno: "Perez", apellidoMaterno: "Soto" });
    expect(splitName("ANA ROJAS")).toEqual({ nombres: "Ana", apellidoPaterno: "Rojas", apellidoMaterno: null });
    expect(splitName("ÑANDÚ")).toEqual({ nombres: "Ñandú", apellidoPaterno: "-", apellidoMaterno: null });
  });

  it("normaliza teléfonos chilenos", () => {
    expect(normalizePhone("987654321")).toBe("+56 9 8765 4321");
    expect(normalizePhone("56987654321")).toBe("+56 9 8765 4321");
    expect(normalizePhone("87654321")).toBe("+56 9 8765 4321");
    expect(normalizePhone("22")).toBeNull();
  });

  it("normaliza una fila completa", () => {
    const n = normalizeRow(base, 2)!;
    expect(n.branch).toEqual({ serie: "1006", name: "Optica Demo Centro" });
    expect(n.patient).toMatchObject({
      key: "12345678-5", rut: "12345678-5", externalCode: "000123", nombres: "Maria Jose",
      fechaNacimiento: null, telefono: "+56 9 8765 4321", email: "persona@ejemplo.cl",
    });
    expect(n.rx).toMatchObject({
      issuedAt: "2026-02-02",
      odSph: -1.5, odCyl: -0.75, odAxis: 155, odAdd: 2.75,
      oiSph: 0, oiCyl: -0.75, oiAxis: 90, oiAdd: 2.75, // esfera vacía con cilindro = neutro
      dpTotal: 62, dpOd: null, dpOi: null, avccOd: "1,0p", professionalName: "Pedro Prueba",
    });
    expect(n.warnings).toEqual(expect.arrayContaining(["valor_sin_coma", "eje_corregido", "valor_redondeado"]));
  });

  it("RUT inválido se conserva para revisión; fila sin graduación no crea receta", () => {
    const n = normalizeRow({ ...base, "NIE": "12345678-0", "Esfera OD": null, "Cilindro OD": null, "Eje OD": null, "Adición OD": null, "Esfera OI": null, "Cilindro OI": null, "Eje OI": null, "Adición OI": null }, 3)!;
    expect(n.patient.rut).toBeNull();
    expect(n.patient.documento).toBe("123456780");
    expect(n.patient.key).toBe("COD:000123");
    expect(n.warnings).toContain("rut_invalido");
    expect(n.rx).toBeNull();
  });

  it("descarta fechas de nacimiento por defecto y detecta columnas faltantes", () => {
    const n = normalizeRow({ ...base, "Fecha de nacimiento": new Date(Date.UTC(1969, 11, 30, 20, 0, 0)) }, 4)!;
    expect(n.patient.fechaNacimiento).toBeNull();
    expect(missingHeaders(["Fecha", "NIE"])).toContain("Razón social");
    expect(normalizeRow({}, 5)).toBeNull();
  });

  it("recorta textos libres muy largos", () => {
    const n = normalizeRow({ ...base, "Motivo de visita": "x".repeat(5000) }, 6)!;
    expect(n.rx!.reason).toHaveLength(2000);
  });

  it("la huella es estable para reimportar sin duplicar", () => {
    expect(normalizeRow(base, 2)!.rx!.externalRef).toBe(normalizeRow(base, 99)!.rx!.externalRef);
  });
});

describe("agrupación de pacientes", async () => {
  const { groupPatients } = await import("@/lib/import/gesvision");
  it("une filas del mismo RUT, completa datos y no duplica recetas", () => {
    const a = normalizeRow({ ...base, "Email": null }, 2)!;
    const b = normalizeRow({ ...base, "Fecha": new Date(Date.UTC(2026, 5, 1, 12, 0, 0)), "Teléfono móvil": null }, 3)!;
    const dup = normalizeRow(base, 4)!; // misma receta repetida
    const sinId = normalizeRow({ ...base, "NIE": null, "Código Cliente": null }, 5)!;
    const g = groupPatients([a, b, dup, sinId]);
    expect(g.patients).toHaveLength(1);
    expect(g.patients[0].email).toBe("persona@ejemplo.cl");
    expect(g.patients[0].telefono).toBe("+56 9 8765 4321");
    expect(g.prescriptions).toHaveLength(2);
    expect(g.skipped).toBe(1);
  });
});
