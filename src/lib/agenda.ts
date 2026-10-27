// Lógica pura de agenda (sin acceso a BD), testeable.

export type Interval = { start: Date; end: Date };

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/** Bloques "HH:mm" entre apertura y cierre; el último bloque termina <= cierre. */
export function buildSlots(openTime: string, closeTime: string, slotMinutes: number): string[] {
  if (slotMinutes <= 0) throw new Error("slotMinutes debe ser > 0");
  const slots: string[] = [];
  for (let t = toMinutes(openTime); t + slotMinutes <= toMinutes(closeTime); t += slotMinutes) {
    slots.push(toHHmm(t));
  }
  return slots;
}

/** Cuántas filas de la grilla ocupa una cita (mínimo 1). */
export function slotSpan(start: Date, end: Date, slotMinutes: number): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 60000 / slotMinutes));
}

export const BLOCKING_STATUSES = ["AGENDADA", "CONFIRMADA", "EN_ATENCION", "ATENDIDA"] as const;
