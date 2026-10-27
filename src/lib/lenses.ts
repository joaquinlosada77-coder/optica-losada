// Configurador de cristales: lógica pura (sin BD) compartida por el TPV y el servidor.

export type Rx = {
  odSph: number;
  odCyl: number;
  odAdd: number | null;
  oiSph: number;
  oiCyl: number;
  oiAdd: number | null;
};

export type CatalogMaterial = {
  id: string;
  code: string;
  name: string;
  refractiveIndex: string;
  description: string | null;
  thinness: number;
  recommendFromPower: number;
  maxPower: number;
};
export type CatalogDesign = { id: string; code: string; name: string; description: string | null; requiresAdd: boolean };
export type CatalogTreatment = { id: string; code: string; name: string; description: string | null; price: number };

export type LensCatalog = {
  materials: CatalogMaterial[];
  designs: CatalogDesign[];
  treatments: CatalogTreatment[];
  /** precio base del par: prices[materialId][designId] */
  prices: Record<string, Record<string, number>>;
};

export type LensSelection = { materialId: string; designId: string; treatmentIds: string[] };

/**
 * Potencia que determina el grosor: el meridiano más fuerte de cualquiera de los dos ojos
 * (|esfera| o |esfera + cilindro|).
 */
export function maxPower(rx: Rx): number {
  return Math.max(
    Math.abs(rx.odSph),
    Math.abs(rx.odSph + rx.odCyl),
    Math.abs(rx.oiSph),
    Math.abs(rx.oiSph + rx.oiCyl),
  );
}

export function hasAdd(rx: Rx): boolean {
  return (rx.odAdd ?? 0) > 0 || (rx.oiAdd ?? 0) > 0;
}

export function materialAvailable(m: CatalogMaterial, rx: Rx | null): boolean {
  return !rx || maxPower(rx) <= m.maxPower;
}

/** El material sugerido es el de mayor umbral `recommendFromPower` que la receta alcanza. */
export function recommendedMaterialId(materials: CatalogMaterial[], rx: Rx | null): string | null {
  if (!rx) return null;
  const p = maxPower(rx);
  const candidates = materials.filter((m) => materialAvailable(m, rx) && p >= m.recommendFromPower);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.recommendFromPower > a.recommendFromPower ? b : a)).id;
}

export function designAvailable(d: CatalogDesign, rx: Rx | null): boolean {
  return !d.requiresAdd || !rx || hasAdd(rx);
}

/** Precio "desde" de un material (el diseño más barato disponible). */
export function fromPrice(catalog: LensCatalog, materialId: string): number | null {
  const row = catalog.prices[materialId];
  if (!row) return null;
  const vals = Object.values(row);
  return vals.length ? Math.min(...vals) : null;
}

export type ResolvedLens = { code: string; description: string; price: number };

/** Valida la combinación y devuelve código, descripción y precio del par. */
export function resolveLens(catalog: LensCatalog, sel: LensSelection, rx: Rx | null): ResolvedLens | { error: string } {
  const m = catalog.materials.find((x) => x.id === sel.materialId);
  const d = catalog.designs.find((x) => x.id === sel.designId);
  if (!m) return { error: "Elige un material" };
  if (!d) return { error: "Elige el tipo de cristal" };
  if (!materialAvailable(m, rx)) return { error: `${m.name} no se fabrica para esta graduación` };
  if (!designAvailable(d, rx)) return { error: `${d.name} requiere adición en la receta` };
  const base = catalog.prices[m.id]?.[d.id];
  if (base === undefined) return { error: `${d.name} no está disponible en ${m.name}` };

  // Orden estable (el del catálogo) para que la misma combinación siempre dé el mismo código
  const treatments = catalog.treatments.filter((t) => sel.treatmentIds.includes(t.id));
  if (treatments.length !== new Set(sel.treatmentIds).size) return { error: "Tratamiento no disponible" };

  const code = [m.code, d.code, ...treatments.map((t) => t.code)].join("-");
  const description = `Cristales ${d.name} ${m.name}${treatments.length ? ` + ${treatments.map((t) => t.name).join(" + ")}` : ""}`;
  const price = base + treatments.reduce((s, t) => s + t.price, 0);
  return { code, description, price };
}

/** "+2,25" / "-1,50" / "Neutro" como se escribe en una receta chilena. */
export function fmtDiopter(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "Neutro";
  return `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")}`;
}

export function isQuarterStep(v: number): boolean {
  return Number.isInteger(Math.round(v * 100)) && Math.round(v * 100) % 25 === 0;
}
