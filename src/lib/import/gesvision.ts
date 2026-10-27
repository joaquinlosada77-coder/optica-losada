// Normalización del "Listado de graduaciones" exportado desde Gesvision.
// Lógica pura (sin BD) para poder probarla con datos sintéticos.
import { cleanRut, isValidRut, normalizeRut } from "@/lib/rut";

export const GV_HEADERS = {
  fecha: "Fecha",
  serie: "Serie",
  local: "Local",
  agente: "Agente",
  tecnologo: "Tecnólogo",
  codigo: "Código Cliente",
  nombre: "Razón social",
  nacimiento: "Fecha de nacimiento",
  rut: "NIE",
  movil: "Teléfono móvil",
  email: "Email",
  motivo: "Motivo de visita",
  esfOd: "Esfera OD",
  cilOd: "Cilindro OD",
  ejeOd: "Eje OD",
  addOd: "Adición OD",
  avOd: "AVCC OD",
  dpOd: "D.N/P.L. OD",
  esfOi: "Esfera OI",
  cilOi: "Cilindro OI",
  ejeOi: "Eje OI",
  addOi: "Adición OI",
  avOi: "AVCC OI",
  dpOi: "D.N/P.L. OI",
} as const;

export type GvRow = Partial<Record<(typeof GV_HEADERS)[keyof typeof GV_HEADERS], unknown>>;

export type Warning =
  | "rut_invalido"
  | "sin_identificacion"
  | "valor_sin_coma"
  | "valor_redondeado"
  | "valor_descartado"
  | "eje_corregido"
  | "eje_descartado"
  | "dp_descartada"
  | "fecha_invalida";

export type NormalizedRow = {
  row: number;
  branch: { serie: string; name: string };
  patient: {
    key: string; // RUT normalizado o "COD:<código>"
    externalCode: string | null;
    rut: string | null;
    documento: string | null; // RUT inválido conservado para revisión
    nombres: string;
    apellidoPaterno: string;
    apellidoMaterno: string | null;
    fechaNacimiento: string | null; // yyyy-MM-dd
    telefono: string | null;
    email: string | null;
  };
  rx: {
    issuedAt: string; // yyyy-MM-dd
    odSph: number | null; odCyl: number; odAxis: number | null; odAdd: number | null;
    oiSph: number | null; oiCyl: number; oiAxis: number | null; oiAdd: number | null;
    dpOd: number | null; dpOi: number | null; dpTotal: number | null;
    avccOd: string | null; avccOi: string | null;
    professionalName: string | null;
    reason: string | null;
    externalRef: string;
  } | null;
  warnings: Warning[];
};

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && (v.trim() === "" || v.trim().toLowerCase() === "null"));

function str(v: unknown): string | null {
  if (blank(v)) return null;
  return String(v).replace(/\s+/g, " ").trim();
}

function toNumber(v: unknown): number | null {
  if (blank(v)) return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Dioptrías: corrige valores tipeados sin coma (125 → 1,25) y redondea al 0,25 más cercano
 * los decimales con ruido de punto flotante (-0,699… → -0,75).
 */
export function fixDiopter(v: unknown, max: number, w: Warning[]): number | null {
  let n = toNumber(v);
  if (n === null) return null;
  if (Math.abs(n) > max) {
    const scaled = n / 100;
    if (Math.abs(scaled) <= max && Math.round(scaled * 100) % 25 === 0) {
      w.push("valor_sin_coma");
      n = scaled;
    } else {
      w.push("valor_descartado");
      return null;
    }
  }
  const q = Math.round(n * 4) / 4;
  if (Math.abs(q - n) > 0.001) w.push("valor_redondeado");
  return q === 0 ? 0 : q; // evita -0
}

/** Eje 0–180°. Corrige 15500 → 155, 9000 → 90, 450 → 45. */
export function fixAxis(v: unknown, w: Warning[]): number | null {
  let n = toNumber(v);
  if (n === null) return null;
  if (n < 0) { w.push("eje_descartado"); return null; }
  if (n > 180) {
    const c = [n / 100, n / 10].find((x) => Number.isInteger(x) && x <= 180);
    if (c === undefined) { w.push("eje_descartado"); return null; }
    w.push("eje_corregido");
    n = c;
  }
  if (!Number.isInteger(n)) n = Math.round(n);
  return n;
}

/**
 * Gesvision guarda fechas sin hora como medianoche de España, que en Chile se ve como
 * las 18:00–21:00 del día anterior. Esas se llevan al día siguiente; los timestamps reales se dejan.
 */
export function excelDate(v: unknown): string | null {
  if (blank(v)) return null;
  const d = v instanceof Date ? v : new Date(String(v).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return null;
  // Los valores llegan como "hora local de pared" (sin zona): se leen en UTC para no moverlos.
  const h = d.getUTCHours(), m = d.getUTCMinutes(), s = d.getUTCSeconds();
  const shifted = m === 0 && s === 0 && h >= 17 && h <= 22 ? new Date(d.getTime() + 24 * 3600_000) : d;
  return shifted.toISOString().slice(0, 10);
}

/** Fechas de nacimiento "por defecto" (época Unix) que en Gesvision significan "sin dato". */
function isPlaceholderBirth(iso: string) {
  return iso >= "1969-12-28" && iso <= "1970-01-01";
}

const PARTICLES = new Set(["DE", "DEL", "LA", "LAS", "LOS", "Y", "SAN", "SANTA", "VAN", "VON", "DA", "DI"]);

export function titleCase(s: string): string {
  return s
    .toLocaleLowerCase("es-CL")
    .split(" ")
    .map((w, i) => (i > 0 && PARTICLES.has(w.toUpperCase()) ? w : w.charAt(0).toLocaleUpperCase("es-CL") + w.slice(1)))
    .join(" ");
}

/**
 * "MARIA JOSE GONZALEZ DE LA FUENTE" → nombres "María José", paterno "González", materno "de la Fuente".
 * Gesvision exporta "NOMBRES APELLIDO_PATERNO APELLIDO_MATERNO" en un solo campo.
 */
export function splitName(full: string): { nombres: string; apellidoPaterno: string; apellidoMaterno: string | null } {
  const t = full.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (t.length === 0) return { nombres: "Sin nombre", apellidoPaterno: "-", apellidoMaterno: null };
  if (t.length === 1) return { nombres: titleCase(t[0]), apellidoPaterno: "-", apellidoMaterno: null };
  // Toma un apellido desde el final, incluyendo partículas que lo anteceden ("DE LA FUENTE")
  const takeSurname = (arr: string[]) => {
    const out = [arr.pop()!];
    while (arr.length > 1 && PARTICLES.has(arr[arr.length - 1].toUpperCase())) out.unshift(arr.pop()!);
    return out.join(" ");
  };
  const rest = [...t];
  if (t.length === 2) return { nombres: titleCase(rest[0]), apellidoPaterno: titleCase(rest[1]), apellidoMaterno: null };
  const materno = takeSurname(rest);
  const paterno = rest.length > 1 ? takeSurname(rest) : null;
  if (!paterno) return { nombres: titleCase(rest.join(" ")), apellidoPaterno: titleCase(materno), apellidoMaterno: null };
  return { nombres: titleCase(rest.join(" ")), apellidoPaterno: titleCase(paterno), apellidoMaterno: titleCase(materno) };
}

export function normalizePhone(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  let d = s.replace(/\D/g, "");
  if (d.startsWith("56") && d.length === 11) d = d.slice(2);
  if (d.length === 9 && d.startsWith("9")) return `+56 9 ${d.slice(1, 5)} ${d.slice(5)}`;
  if (d.length === 9) return `+56 ${d}`; // fijo con código de área
  if (d.length === 8) return `+56 9 ${d.slice(0, 4)} ${d.slice(4)}`; // móvil antiguo sin el 9
  return null;
}

function normalizeEmail(v: unknown): string | null {
  const s = str(v)?.toLowerCase().replace(/\s/g, "");
  return s && /^[^@]+@[^@]+\.[a-z]{2,}$/.test(s) ? s : null;
}

/** DP: valores ≥ 45 mm son DP total; entre 20 y 45, monocular. */
function dps(od: unknown, oi: unknown, w: Warning[]) {
  const a = toNumber(od), b = toNumber(oi);
  let dpTotal: number | null = null, dpOd: number | null = null, dpOi: number | null = null;
  for (const [v, eye] of [[a, "od"], [b, "oi"]] as const) {
    if (v === null || v === 0) continue;
    if (v >= 45 && v <= 80) dpTotal ??= v;
    else if (v >= 20 && v < 45) { if (eye === "od") dpOd = v; else dpOi = v; }
    else w.push("dp_descartada");
  }
  return { dpTotal, dpOd, dpOi };
}

function rawStamp(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v ?? "");
}

export function normalizeRow(r: GvRow, row: number): NormalizedRow | null {
  const w: Warning[] = [];
  const H = GV_HEADERS;
  const codigo = str(r[H.codigo]);
  const rutRaw = str(r[H.rut]);
  const fullName = str(r[H.nombre]);
  if (!codigo && !rutRaw && !fullName) return null; // fila vacía

  let rut: string | null = null, documento: string | null = null;
  if (rutRaw && isValidRut(rutRaw)) rut = normalizeRut(rutRaw);
  else if (rutRaw) { documento = cleanRut(rutRaw) || rutRaw; w.push("rut_invalido"); }
  if (!rut && !codigo) w.push("sin_identificacion");

  let birth = excelDate(r[H.nacimiento]);
  if (birth && isPlaceholderBirth(birth)) birth = null;

  const issuedAt = excelDate(r[H.fecha]);
  if (!issuedAt) w.push("fecha_invalida");

  // Sobre ±20 D casi no existen recetas reales; en el archivo son "25" = 0,25 sin coma
  const odSph = fixDiopter(r[H.esfOd], 20, w), oiSph = fixDiopter(r[H.esfOi], 20, w);
  const odCyl = fixDiopter(r[H.cilOd], 10, w), oiCyl = fixDiopter(r[H.cilOi], 10, w);
  const odAdd = fixDiopter(r[H.addOd], 4, w), oiAdd = fixDiopter(r[H.addOi], 4, w);
  let odAxis = fixAxis(r[H.ejeOd], w), oiAxis = fixAxis(r[H.ejeOi], w);
  if (!odCyl) odAxis = null;
  if (!oiCyl) oiAxis = null;
  const dp = dps(r[H.dpOd], r[H.dpOi], w);
  const avccOd = str(r[H.avOd]), avccOi = str(r[H.avOi]);

  const hasOd = [odSph, odCyl, odAdd].some((x) => x !== null);
  const hasOi = [oiSph, oiCyl, oiAdd].some((x) => x !== null);
  const key = rut ?? `COD:${codigo ?? `FILA${row}`}`;

  let rx: NormalizedRow["rx"] = null;
  if ((hasOd || hasOi) && issuedAt) {
    const values = [odSph, odCyl, odAxis, odAdd, oiSph, oiCyl, oiAxis, oiAdd].map((x) => x ?? "").join("|");
    rx = {
      issuedAt,
      // Con cilindro o adición pero sin esfera, Gesvision deja la esfera vacía = neutro
      odSph: hasOd ? (odSph ?? 0) : null, odCyl: odCyl ?? 0, odAxis, odAdd: odAdd || null,
      oiSph: hasOi ? (oiSph ?? 0) : null, oiCyl: oiCyl ?? 0, oiAxis, oiAdd: oiAdd || null,
      ...dp,
      avccOd, avccOi,
      professionalName: str(r[H.tecnologo]) ? titleCase(str(r[H.tecnologo])!) : null,
      reason: str(r[H.motivo]),
      externalRef: `GV:${codigo ?? key}:${rawStamp(r[H.fecha])}:${values}`,
    };
  }

  const name = splitName(fullName ?? "");
  return {
    row,
    branch: { serie: str(r[H.serie]) ?? "0", name: str(r[H.local]) ?? "Sin local" },
    patient: {
      key,
      externalCode: codigo,
      rut,
      documento,
      ...name,
      fechaNacimiento: birth,
      telefono: normalizePhone(r[H.movil]),
      email: normalizeEmail(r[H.email]),
    },
    rx,
    warnings: w,
  };
}

/** Verifica que el archivo tenga las columnas esperadas. Devuelve las que faltan. */
export function missingHeaders(headers: string[]): string[] {
  const have = new Set(headers.map((h) => h.trim()));
  return H_REQUIRED.filter((h) => !have.has(h));
}
const H_REQUIRED = [GV_HEADERS.fecha, GV_HEADERS.codigo, GV_HEADERS.nombre, GV_HEADERS.rut, GV_HEADERS.esfOd, GV_HEADERS.esfOi];

export const WARNING_LABEL: Record<Warning, string> = {
  rut_invalido: "RUT con dígito verificador inválido (se guarda como documento para revisar)",
  sin_identificacion: "Sin RUT ni código de cliente",
  valor_sin_coma: "Valores escritos sin coma corregidos (125 → 1,25)",
  valor_redondeado: "Valores redondeados al 0,25 más cercano",
  valor_descartado: "Valores de graduación imposibles descartados",
  eje_corregido: "Ejes corregidos (15500 → 155°)",
  eje_descartado: "Ejes inválidos descartados",
  dp_descartada: "Distancias pupilares inválidas descartadas",
  fecha_invalida: "Fecha de graduación inválida (no se importa la receta)",
};
