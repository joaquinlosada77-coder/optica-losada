// Montos en pesos chilenos (enteros, sin decimales), IVA incluido.

export const IVA_RATE = 0.19;

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export function formatCLP(n: number): string {
  return clp.format(n);
}

/** Desglose neto/IVA de un total con IVA incluido (como lo calcula el SII: neto redondeado). */
export function ivaBreakdown(total: number): { neto: number; iva: number } {
  const neto = Math.round(total / (1 + IVA_RATE));
  return { neto, iva: total - neto };
}

export type LineInput = { quantity: number; unitPrice: number; discount?: number };

export function lineTotal(l: LineInput): number {
  return Math.max(0, l.quantity * l.unitPrice - (l.discount ?? 0));
}

export function saleTotals(lines: LineInput[], globalDiscount = 0) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discount = Math.min(Math.max(0, globalDiscount), subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

/** Descuento en monto a partir de un porcentaje, redondeado a pesos. */
export function percentOf(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}

/**
 * Pago en efectivo: se registra como pago solo lo que cubre el saldo;
 * el resto es vuelto para el cliente.
 */
export function applyCash(received: number, balance: number): { applied: number; change: number } {
  const applied = Math.min(received, balance);
  return { applied, change: received - applied };
}
