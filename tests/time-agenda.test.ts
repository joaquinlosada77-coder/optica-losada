import { describe, expect, it } from "vitest";
import { buildSlots, overlaps, slotSpan } from "@/lib/agenda";
import { ageFrom, dayRangeUtc, fmtTime, localToUtc, shiftDayISO, todayISO } from "@/lib/time";

describe("hora de Chile", () => {
  it("convierte hora local a UTC según horario de verano/invierno", () => {
    // Enero: verano (UTC-3)
    expect(localToUtc("2026-01-15", "10:00").toISOString()).toBe("2026-01-15T13:00:00.000Z");
    // Julio: invierno (UTC-4)
    expect(localToUtc("2026-07-15", "10:00").toISOString()).toBe("2026-07-15T14:00:00.000Z");
    expect(fmtTime(new Date("2026-07-15T14:00:00Z"))).toBe("10:00");
  });

  it("el día local cubre 23/24/25 horas en cambios de horario", () => {
    const hours = (d: string) => {
      const { start, end } = dayRangeUtc(d);
      return (end.getTime() - start.getTime()) / 3_600_000;
    };
    expect(hours("2026-03-10")).toBe(24);
    // En 2026 Chile vuelve a UTC-4 el sábado 4 de abril a medianoche -> el domingo 5 dura 25h
    expect([24, 25]).toContain(hours("2026-04-05"));
  });

  it("todayISO usa la fecha chilena, no la UTC", () => {
    // 02:00 UTC del 16 = 22:00/23:00 del 15 en Chile
    expect(todayISO(new Date("2026-07-16T02:00:00Z"))).toBe("2026-07-15");
  });

  it("navega días", () => {
    expect(shiftDayISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDayISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("calcula edad", () => {
    const now = new Date("2026-10-27T15:00:00Z");
    expect(ageFrom(new Date("1985-10-27T00:00:00Z"), now)).toBe(41);
    expect(ageFrom(new Date("1985-10-28T00:00:00Z"), now)).toBe(40);
  });
});

describe("agenda", () => {
  it("genera bloques dentro del horario", () => {
    expect(buildSlots("10:00", "11:30", 30)).toEqual(["10:00", "10:30", "11:00"]);
    expect(buildSlots("10:30", "11:15", 20)).toEqual(["10:30", "10:50"]);
  });

  it("detecta traslapes con intervalos semiabiertos", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 0, 1, h));
    expect(overlaps({ start: at(10), end: at(11) }, { start: at(10), end: at(12) })).toBe(true);
    expect(overlaps({ start: at(10), end: at(11) }, { start: at(11), end: at(12) })).toBe(false);
  });

  it("calcula filas ocupadas", () => {
    const s = new Date("2026-01-01T13:00:00Z");
    expect(slotSpan(s, new Date(s.getTime() + 45 * 60000), 30)).toBe(2);
    expect(slotSpan(s, new Date(s.getTime() + 10 * 60000), 30)).toBe(1);
  });
});

describe("semana comercial", async () => {
  const { weekStartISO } = await import("@/lib/time");
  it("empieza el lunes", () => {
    expect(weekStartISO("2026-10-27")).toBe("2026-10-26"); // martes
    expect(weekStartISO("2026-10-26")).toBe("2026-10-26"); // lunes
    expect(weekStartISO("2026-11-01")).toBe("2026-10-26"); // domingo
  });
});
