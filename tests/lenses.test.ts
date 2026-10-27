import { describe, expect, it } from "vitest";
import {
  designAvailable, fmtDiopter, isQuarterStep, maxPower, recommendedMaterialId, resolveLens,
  type LensCatalog, type Rx,
} from "@/lib/lenses";

const mat = (id: string, from: number, max: number) => ({
  id, code: id, name: `Mat ${id}`, refractiveIndex: id, description: null, thinness: 1, recommendFromPower: from, maxPower: max,
});
const catalog: LensCatalog = {
  materials: [mat("150", 0, 4), mat("159", 2, 6), mat("167", 4.5, 10), mat("174", 7, 14)],
  designs: [
    { id: "MONO", code: "MONO", name: "Monofocal", description: null, requiresAdd: false },
    { id: "PROG", code: "PROG", name: "Progresivo", description: null, requiresAdd: true },
  ],
  treatments: [
    { id: "AR", code: "AR", name: "Antirreflejo", description: null, price: 20000 },
    { id: "BLUE", code: "BLUE", name: "Filtro azul", description: null, price: 25000 },
  ],
  prices: {
    "150": { MONO: 30000 },
    "159": { MONO: 50000, PROG: 120000 },
    "167": { MONO: 90000, PROG: 180000 },
    "174": { MONO: 150000 },
  },
};
const rx = (o: Partial<Rx>): Rx => ({ odSph: 0, odCyl: 0, odAdd: null, oiSph: 0, oiCyl: 0, oiAdd: null, ...o });

describe("configurador de cristales", () => {
  it("usa el meridiano más fuerte de ambos ojos", () => {
    expect(maxPower(rx({ odSph: -2, odCyl: -1.5, oiSph: -1 }))).toBe(3.5);
    expect(maxPower(rx({ odSph: 3, odCyl: -1, oiSph: -4.25 }))).toBe(4.25);
  });

  it("recomienda el índice según la graduación", () => {
    expect(recommendedMaterialId(catalog.materials, rx({ odSph: -1 }))).toBe("150");
    expect(recommendedMaterialId(catalog.materials, rx({ odSph: -3 }))).toBe("159");
    expect(recommendedMaterialId(catalog.materials, rx({ odSph: -5, odCyl: -1 }))).toBe("167");
    expect(recommendedMaterialId(catalog.materials, rx({ oiSph: -9 }))).toBe("174");
    expect(recommendedMaterialId(catalog.materials, null)).toBeNull();
  });

  it("progresivo solo con adición", () => {
    expect(designAvailable(catalog.designs[1], rx({}))).toBe(false);
    expect(designAvailable(catalog.designs[1], rx({ odAdd: 2 }))).toBe(true);
  });

  it("genera código, descripción y precio", () => {
    const r = resolveLens(catalog, { materialId: "167", designId: "PROG", treatmentIds: ["BLUE", "AR"] }, rx({ odSph: -5, odAdd: 2 }));
    expect(r).toEqual({
      code: "167-PROG-AR-BLUE",
      description: "Cristales Progresivo Mat 167 + Antirreflejo + Filtro azul",
      price: 180000 + 20000 + 25000,
    });
  });

  it("rechaza combinaciones imposibles", () => {
    expect(resolveLens(catalog, { materialId: "150", designId: "MONO", treatmentIds: [] }, rx({ odSph: -6 }))).toHaveProperty("error");
    expect(resolveLens(catalog, { materialId: "174", designId: "PROG", treatmentIds: [] }, rx({ odSph: -8, odAdd: 2 }))).toHaveProperty("error");
    expect(resolveLens(catalog, { materialId: "159", designId: "MONO", treatmentIds: ["X"] }, null)).toHaveProperty("error");
  });

  it("formatea dioptrías", () => {
    expect(fmtDiopter(-1.5)).toBe("−1,50");
    expect(fmtDiopter(2.25)).toBe("+2,25");
    expect(fmtDiopter(0)).toBe("Neutro");
    expect(isQuarterStep(-1.75)).toBe(true);
    expect(isQuarterStep(-1.3)).toBe(false);
  });
});
