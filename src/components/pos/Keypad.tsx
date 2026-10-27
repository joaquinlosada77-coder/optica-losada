"use client";

import { cx } from "@/components/ui";

/** Teclado numérico táctil para montos en pesos (enteros). */
export function Keypad({ value, onChange, maxLength = 9 }: { value: string; onChange: (v: string) => void; maxLength?: number }) {
  const press = (k: string) => {
    if (k === "⌫") return onChange(value.slice(0, -1));
    if (k === "C") return onChange("");
    const next = (value + k).replace(/^0+(?=\d)/, "");
    if (next.length <= maxLength) onChange(next);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      {["7", "8", "9", "4", "5", "6", "1", "2", "3", "000", "0", "⌫"].map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className={cx(
            "h-16 rounded-xl text-2xl font-semibold shadow-sm active:scale-95 active:bg-slate-200 select-none",
            k === "⌫" ? "bg-slate-200 text-slate-700" : "bg-white border border-slate-200",
          )}
        >
          {k}
        </button>
      ))}
      <button type="button" onClick={() => press("C")} className="col-span-3 h-12 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 active:scale-95">
        Borrar todo
      </button>
    </div>
  );
}
