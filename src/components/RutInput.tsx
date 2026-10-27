"use client";

import { useState } from "react";
import { formatRut, isValidRut } from "@/lib/rut";
import { cx, inputCls } from "@/components/ui";

/** Campo RUT: formatea al salir (12.345.678-5) y valida el DV en vivo. */
export function RutInput({ name, defaultValue, invalid }: { name: string; defaultValue?: string | null; invalid?: boolean }) {
  const [value, setValue] = useState(defaultValue ? formatRut(defaultValue) : "");
  const bad = value.length > 2 && !isValidRut(value);
  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value && isValidRut(value) && setValue(formatRut(value))}
        placeholder="12.345.678-5"
        inputMode="text"
        autoComplete="off"
        aria-invalid={invalid || bad}
        className={cx(inputCls, "pr-9")}
      />
      {value.length > 2 && (
        <span className={cx("absolute right-3 top-2 text-sm", bad ? "text-rose-500" : "text-emerald-600")} aria-hidden>
          {bad ? "✕" : "✓"}
        </span>
      )}
    </div>
  );
}
