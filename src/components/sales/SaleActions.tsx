"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PaymentMethod } from "@prisma/client";
import { formatCLP } from "@/lib/money";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { addPayment, voidSale } from "@/server/sales";
import { Keypad } from "@/components/pos/Keypad";
import { Button, cx } from "@/components/ui";

export function PaymentBox({ saleId, balance, cashOpen }: { saleId: string; balance: number; cashOpen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("EFECTIVO");
  const [amount, setAmount] = useState(String(balance));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="h-14 w-full rounded-xl bg-emerald-600 text-lg font-semibold text-white active:scale-95">
        Registrar abono / pagar saldo ({formatCLP(balance)})
      </button>
    );
  }
  if (!cashOpen) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Abre la caja de esta sucursal para registrar pagos.</p>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={cx("h-12 rounded-xl text-sm font-medium", method === m ? "bg-slate-900 text-white" : "border border-slate-300")}>
            {PAYMENT_METHOD_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="rounded-xl bg-slate-100 px-4 py-3 text-right text-3xl font-bold tabular-nums">{formatCLP(Number(amount || 0))}</div>
      <Keypad value={amount} onChange={setAmount} />
      {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setOpen(false)} className="h-14 rounded-xl border border-slate-300">Cancelar</button>
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addPayment({ saleId, method, amount: Number(amount || 0), reference: null });
              if (r.ok) { setOpen(false); router.refresh(); } else setError(r.error);
            })
          }
          className="h-14 rounded-xl bg-emerald-600 text-lg font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Confirmar pago"}
        </button>
      </div>
    </div>
  );
}

export function VoidButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant="danger"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("Motivo de la anulación:");
          if (!reason) return;
          start(async () => {
            const r = await voidSale(saleId, reason);
            if (r.ok) router.refresh(); else setError(r.error);
          });
        }}
      >
        Anular venta
      </Button>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}

export function PrintButton() {
  return <Button variant="secondary" onClick={() => window.print()}>Imprimir comprobante</Button>;
}
