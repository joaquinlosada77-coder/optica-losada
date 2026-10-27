// Bloques del panel de Inicio que cada usuario puede mostrar, ocultar y ordenar.

export const WIDGETS = {
  dayGross: { label: "Venta del día", admin: true },
  weekGross: { label: "Venta de la semana", admin: true },
  monthGross: { label: "Venta del mes", admin: true },
  atv: { label: "Ticket medio del día", admin: true },
  collected30: { label: "Cobrado últimos 30 días", admin: true },
  debt30: { label: "Deuda últimos 30 días", admin: true },
  byBranch: { label: "Ventas de hoy por local", admin: true },
  apptStats: { label: "Citas de hoy y pacientes nuevos", admin: false },
  agenda: { label: "Agenda de hoy", admin: false },
} as const;

export type WidgetKey = keyof typeof WIDGETS;

export const DEFAULT_WIDGETS: WidgetKey[] = Object.keys(WIDGETS) as WidgetKey[];

export function isWidgetKey(k: string): k is WidgetKey {
  return k in WIDGETS;
}

/** Bloques disponibles para el rol (los de ventas son solo para administradores). */
export function allowedWidgets(isAdmin: boolean): WidgetKey[] {
  return DEFAULT_WIDGETS.filter((k) => isAdmin || !WIDGETS[k].admin);
}

/** Selección guardada filtrada a lo permitido; si no hay nada guardado, todos los permitidos. */
export function resolveWidgets(saved: string[], isAdmin: boolean): WidgetKey[] {
  const allowed = allowedWidgets(isAdmin);
  if (saved.length === 0) return allowed;
  return saved.filter(isWidgetKey).filter((k) => allowed.includes(k));
}
