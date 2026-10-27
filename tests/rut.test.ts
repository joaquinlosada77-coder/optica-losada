import { describe, expect, it } from "vitest";
import { cleanRut, computeDv, formatRut, isValidRut, looksLikeRut, normalizeRut } from "@/lib/rut";

describe("RUT", () => {
  it("calcula el dígito verificador (módulo 11)", () => {
    expect(computeDv("12345678")).toBe("5");
    expect(computeDv("11111111")).toBe("1");
    expect(computeDv("6")).toBe("K");
    expect(computeDv("76086428")).toBe("5");
    expect(computeDv("143")).toBe("0"); // 3·2+4·3+1·4 = 22 ≡ 0 (mod 11)
    expect(computeDv("24965885")).toBe("5");
  });

  it("valida en distintos formatos", () => {
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("123456785")).toBe(true);
    expect(isValidRut("12345678-k")).toBe(false);
    expect(isValidRut("12.345.678-4")).toBe(false);
    expect(isValidRut("")).toBe(false);
    expect(isValidRut("1-9")).toBe(false); // cuerpo demasiado corto
  });

  it("acepta K minúscula", () => {
    const body = "10000013";
    expect(computeDv(body)).toBe("K");
    expect(isValidRut(`${body}-k`)).toBe(true);
    expect(normalizeRut(`10.000.013-k`)).toBe("10000013-K");
  });

  it("normaliza y formatea", () => {
    expect(cleanRut(" 12.345.678-5 ")).toBe("123456785");
    expect(normalizeRut("12.345.678-5")).toBe("12345678-5");
    expect(normalizeRut("012345678-5")).toBe("12345678-5");
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(formatRut("9876543-3")).toBe("9.876.543-3");
  });

  it("distingue búsqueda por RUT de búsqueda por nombre", () => {
    expect(looksLikeRut("12.345")).toBe(true);
    expect(looksLikeRut("12345678-k")).toBe(true);
    expect(looksLikeRut("Kevin")).toBe(false);
    expect(looksLikeRut("maría")).toBe(false);
  });
});
