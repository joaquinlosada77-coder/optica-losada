import { describe, expect, it } from "vitest";
import { allowedWidgets, resolveWidgets } from "@/lib/dashboard";

describe("panel personalizable", () => {
  it("sin configuración muestra todo lo permitido", () => {
    expect(resolveWidgets([], true)).toEqual(allowedWidgets(true));
    expect(resolveWidgets([], false)).toEqual(["apptStats", "agenda"]);
  });
  it("respeta orden y oculta lo no permitido o desconocido", () => {
    expect(resolveWidgets(["agenda", "monthGross", "xx", "dayGross"], true)).toEqual(["agenda", "monthGross", "dayGross"]);
    expect(resolveWidgets(["monthGross", "agenda"], false)).toEqual(["agenda"]);
  });
});
