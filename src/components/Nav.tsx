"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

type Item = { href: string; label: string; icon: string; soon?: boolean; adminOnly?: boolean };

const ITEMS: Item[] = [
  { href: "/", label: "Inicio", icon: "⌂" },
  { href: "/agenda", label: "Agenda", icon: "◷" },
  { href: "/pacientes", label: "Pacientes", icon: "☺" },
  { href: "#ficha", label: "Ficha optométrica", icon: "◎", soon: true },
  { href: "#tpv", label: "Ventas / TPV", icon: "$", soon: true },
  { href: "#dte", label: "Boletas y facturas", icon: "▤", soon: true },
  { href: "#lab", label: "Laboratorio", icon: "⚗", soon: true },
  { href: "#stock", label: "Inventario", icon: "▦", soon: true },
  { href: "#crm", label: "CRM", icon: "✉", soon: true },
  { href: "/configuracion/sucursales", label: "Sucursales", icon: "⌖", adminOnly: true },
  { href: "/configuracion/usuarios", label: "Usuarios", icon: "⚇", adminOnly: true },
];

export function Nav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {ITEMS.filter((i) => !i.adminOnly || isAdmin).map((i) => {
        const active = i.href === "/" ? path === "/" : path.startsWith(i.href);
        if (i.soon) {
          return (
            <span key={i.href} className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-slate-400" title="Próxima fase">
              <span className="w-4 text-center">{i.icon}</span>
              {i.label}
              <span className="ml-auto rounded bg-slate-800 px-1.5 text-[10px] uppercase tracking-wide text-slate-400">pronto</span>
            </span>
          );
        }
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition",
              active ? "bg-brand-600 text-white" : "text-slate-200 hover:bg-slate-800",
            )}
          >
            <span className="w-4 text-center">{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
