// Toda la agenda se maneja en hora de Chile continental, con cambio de horario
// (DST) resuelto por la base IANA. Se almacena siempre en UTC (timestamptz).
import { TZDate } from "@date-fns/tz";
import { addDays, format } from "date-fns";

export const TZ = "America/Santiago";

/** "2026-10-27" del día actual en Chile. */
export function todayISO(now: Date = new Date()): string {
  return format(new TZDate(now, TZ), "yyyy-MM-dd");
}

/** Convierte fecha "yyyy-MM-dd" + hora "HH:mm" (hora local Chile) a instante UTC. */
export function localToUtc(dateISO: string, timeHHmm: string): Date {
  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = timeHHmm.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, TZ).getTime());
}

/** Rango UTC [inicio, fin) que cubre el día local completo. */
export function dayRangeUtc(dateISO: string): { start: Date; end: Date } {
  const start = localToUtc(dateISO, "00:00");
  const next = format(addDays(new TZDate(start, TZ), 1), "yyyy-MM-dd");
  return { start, end: localToUtc(next, "00:00") };
}

export function shiftDayISO(dateISO: string, days: number): string {
  return format(addDays(new TZDate(localToUtc(dateISO, "12:00"), TZ), days), "yyyy-MM-dd");
}

export function fmtTime(d: Date): string {
  return format(new TZDate(d, TZ), "HH:mm");
}

export function fmtDateISO(d: Date): string {
  return format(new TZDate(d, TZ), "yyyy-MM-dd");
}

export function fmtDateLong(dateISO: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(localToUtc(dateISO, "12:00"));
}

export function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

/** Edad en años cumplidos a partir de una fecha @db.Date (medianoche UTC). */
export function ageFrom(birth: Date, now: Date = new Date()): number {
  const [ty, tm, td] = todayISO(now).split("-").map(Number);
  const by = birth.getUTCFullYear();
  const bm = birth.getUTCMonth() + 1;
  const bd = birth.getUTCDate();
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Lunes de la semana (Chile) que contiene la fecha dada. */
export function weekStartISO(dateISO: string): string {
  const dow = new TZDate(localToUtc(dateISO, "12:00"), TZ).getDay(); // 0 = domingo
  return shiftDayISO(dateISO, dow === 0 ? -6 : 1 - dow);
}
