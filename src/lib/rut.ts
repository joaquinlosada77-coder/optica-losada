// Utilidades RUT chileno (Rol Único Tributario) — dígito verificador módulo 11.

/** Quita puntos, guiones y espacios; deja dígitos + K mayúscula. */
export function cleanRut(input: string): string {
  return input.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Calcula el dígito verificador para el cuerpo numérico del RUT. */
export function computeDv(body: string | number): string {
  const digits = String(body);
  let sum = 0;
  let factor = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

export function isValidRut(input: string): boolean {
  const clean = cleanRut(input);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d{1,8}$/.test(body) || Number(body) < 1000) return false;
  return computeDv(body) === dv;
}

/** Forma canónica para almacenar y comparar: "12345678-5" (sin puntos, DV mayúscula). */
export function normalizeRut(input: string): string {
  const clean = cleanRut(input);
  const body = clean.slice(0, -1).replace(/^0+/, "");
  return `${body}-${clean.slice(-1)}`;
}

/** Formato de presentación: "12.345.678-5". */
export function formatRut(input: string): string {
  const clean = cleanRut(input);
  if (clean.length < 2) return input;
  const body = clean.slice(0, -1).replace(/^0+/, "");
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${clean.slice(-1)}`;
}

/** ¿Parece que el usuario está buscando por RUT y no por nombre? */
export function looksLikeRut(input: string): boolean {
  return /^[\d.\s-]+[\dkK]?$/.test(input.trim()) && cleanRut(input).length >= 2;
}
