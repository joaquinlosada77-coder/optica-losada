import { describe, expect, it } from "vitest";
import { applyCash, formatCLP, ivaBreakdown, lineTotal, percentOf, saleTotals } from "@/lib/money";

describe("montos CLP", () => {
  it("formatea pesos chilenos", () => {
    expect(formatCLP(1234567).replace(/\s/g, "")).toBe("$1.234.567");
  });

  it("desglosa IVA de un total con IVA incluido", () => {
    expect(ivaBreakdown(119000)).toEqual({ neto: 100000, iva: 19000 });
    const { neto, iva } = ivaBreakdown(59990);
    expect(neto + iva).toBe(59990);
    expect(neto).toBe(50412);
  });

  it("calcula líneas y totales con descuentos", () => {
    expect(lineTotal({ quantity: 2, unitPrice: 15000, discount: 5000 })).toBe(25000);
    expect(lineTotal({ quantity: 1, unitPrice: 1000, discount: 5000 })).toBe(0);
    const t = saleTotals([{ quantity: 1, unitPrice: 89990 }, { quantity: 2, unitPrice: 45000, discount: 10000 }], 9990);
    expect(t).toEqual({ subtotal: 169990, discount: 9990, total: 160000 });
  });

  it("el descuento global no supera el subtotal", () => {
    expect(saleTotals([{ quantity: 1, unitPrice: 1000 }], 5000).total).toBe(0);
  });

  it("porcentaje redondeado", () => {
    expect(percentOf(89990, 10)).toBe(8999);
    expect(percentOf(12345, 15)).toBe(1852);
  });

  it("efectivo con vuelto", () => {
    expect(applyCash(20000, 15990)).toEqual({ applied: 15990, change: 4010 });
    expect(applyCash(10000, 15990)).toEqual({ applied: 10000, change: 0 });
  });
});
