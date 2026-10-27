"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { PaymentMethod, ProductType } from "@prisma/client";
import { applyCash, formatCLP, lineTotal, percentOf, saleTotals } from "@/lib/money";
import type { LensCatalog } from "@/lib/lenses";
import type { RxSummary } from "@/server/lenses";
import { createSale, type SaleInput } from "@/server/sales";
import { cx } from "@/components/ui";
import { Keypad } from "./Keypad";
import { LensConfigurator, type ConfiguredLens } from "./LensConfigurator";

export type PosProduct = { id: string; sku: string; name: string; brand: string | null; type: ProductType; price: number; favorite: boolean };
type PatientOpt = { id: string; name: string; doc: string };

type Line =
  | { key: string; kind: "product"; productId: string; description: string; code: string; unitPrice: number; quantity: number; discount: number }
  | { key: string; kind: "free"; description: string; code: null; unitPrice: number; quantity: number; discount: number }
  | ({ key: string; kind: "lens"; unitPrice: number; quantity: 1; discount: number } & Omit<ConfiguredLens, "price">);

type Pay = { method: PaymentMethod; amount: number; reference: string | null };

const TABS: { key: "FAV" | ProductType; label: string }[] = [
  { key: "FAV", label: "Frecuentes" },
  { key: "ARMAZON", label: "Armazones" },
  { key: "LENTE_SOL", label: "Lentes de sol" },
  { key: "LENTE_CONTACTO", label: "Lentes de contacto" },
  { key: "LIQUIDO", label: "Líquidos" },
  { key: "ACCESORIO", label: "Accesorios" },
  { key: "SERVICIO", label: "Servicios" },
];

const METHOD_LABEL: Record<PaymentMethod, string> = {
  EFECTIVO: "Efectivo", DEBITO: "Débito", CREDITO: "Crédito", TRANSFERENCIA: "Transferencia", OTRO: "Otro",
};

let keySeq = 0;
const newKey = () => `l${++keySeq}`;

// Modal táctil para ingresar un monto con teclado numérico
function AmountDialog({ title, initial, onDone, onCancel, children }: {
  title: string; initial?: number; onDone: (n: number) => void; onCancel: () => void; children?: React.ReactNode;
}) {
  const [v, setV] = useState(initial ? String(initial) : "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 text-lg font-semibold">{title}</div>
        {children}
        <div className="mb-3 rounded-xl bg-slate-100 px-4 py-3 text-right text-3xl font-bold tabular-nums">{formatCLP(Number(v || 0))}</div>
        <Keypad value={v} onChange={setV} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={onCancel} className="h-14 rounded-xl border border-slate-300 text-lg active:scale-95">Cancelar</button>
          <button onClick={() => onDone(Number(v || 0))} className="h-14 rounded-xl bg-brand-600 text-lg font-semibold text-white active:scale-95">Aceptar</button>
        </div>
      </div>
    </div>
  );
}

export function PosScreen({
  products, catalog, cashOpen, initialPatient, initialRx,
}: {
  products: PosProduct[];
  catalog: LensCatalog;
  cashOpen: boolean;
  initialPatient: PatientOpt | null;
  initialRx: RxSummary | null;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("FAV");
  const [query, setQuery] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [patient, setPatient] = useState<PatientOpt | null>(initialPatient);
  const [rx, setRx] = useState<RxSummary | null>(initialRx);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [dialog, setDialog] = useState<null | "lens" | "patient" | "discount" | "free" | "pay" | { lineDiscount: string }>(null);
  const [result, setResult] = useState<{ saleId: string; number: number; change: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) return products.filter((p) => `${p.name} ${p.brand ?? ""} ${p.sku}`.toLowerCase().includes(q));
    return products.filter((p) => (tab === "FAV" ? p.favorite : p.type === tab));
  }, [products, tab, query]);

  const totals = saleTotals(lines, discount);

  const addProduct = (p: PosProduct) =>
    setLines((ls) => {
      const existing = ls.find((l) => l.kind === "product" && l.productId === p.id);
      if (existing) return ls.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } as Line : l));
      return [...ls, { key: newKey(), kind: "product", productId: p.id, description: p.name, code: p.sku, unitPrice: p.price, quantity: 1, discount: 0 }];
    });

  const changeQty = (key: string, delta: number) =>
    setLines((ls) =>
      ls.flatMap((l) => {
        if (l.key !== key) return [l];
        const q = l.quantity + delta;
        if (q <= 0) return [];
        if (l.kind === "lens") return [l]; // los cristales van por par
        return [{ ...l, quantity: q } as Line];
      }),
    );

  const selectPatient = async (p: PatientOpt | null) => {
    setPatient(p);
    setRx(null);
    // la receta cambia: los cristales configurados deben rehacerse con la nueva graduación
    setLines((ls) => ls.filter((l) => l.kind !== "lens"));
    if (p) {
      const r = await fetch(`/api/pacientes/${p.id}/receta`).then((x) => x.json());
      setRx(r);
    }
    setDialog(null);
  };

  const reset = () => {
    setLines([]); setDiscount(0); setPatient(null); setRx(null); setDeliveryDate(""); setResult(null); setError(null);
  };

  if (result) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-emerald-700">✓</div>
        <div className="text-2xl font-semibold">Venta N° {result.number} registrada</div>
        {result.change > 0 && <div className="rounded-xl bg-amber-50 px-6 py-3 text-2xl">Vuelto: <b>{formatCLP(result.change)}</b></div>}
        <div className="flex gap-3">
          <Link href={`/ventas/${result.saleId}`} className="flex h-14 items-center rounded-xl border border-slate-300 px-6 text-lg">Ver comprobante</Link>
          <button onClick={reset} className="h-14 rounded-xl bg-brand-600 px-8 text-lg font-semibold text-white active:scale-95">Nueva venta</button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-8.5rem)] lg:grid-cols-[1fr_26rem]">
      {/* Catálogo */}
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <button
          onClick={() => setDialog("lens")}
          className="flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-5 text-left text-white shadow active:scale-[0.99]"
        >
          <span className="text-4xl">◎</span>
          <span className="flex-1">
            <span className="block text-xl font-semibold">Configurar cristales</span>
            <span className="block text-sm text-white/80">
              Material → filtros → tipo{rx ? ` · usando receta del ${rx.issuedAt.split("-").reverse().join("-")}` : patient ? " · paciente sin receta" : ""}
            </span>
          </span>
          <span className="text-2xl">→</span>
        </button>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto o código…"
          className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-base"
        />
        {!query && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cx("h-11 shrink-0 rounded-full px-4 text-sm font-medium", tab === t.key ? "bg-slate-900 text-white" : "bg-white border border-slate-200")}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-3 overflow-auto pb-2 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <button
              key={p.id}
              onClick={() => addProduct(p)}
              className="flex min-h-28 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm active:scale-95 active:bg-brand-50"
            >
              <span className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</span>
              <span className="text-xs text-slate-500">{p.brand ?? p.sku}</span>
              <span className="text-lg font-semibold tabular-nums">{formatCLP(p.price)}</span>
            </button>
          ))}
          <button
            onClick={() => setDialog("free")}
            className="flex min-h-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-500 active:scale-95"
          >
            <span className="text-2xl">+</span>
            <span className="text-sm">Ítem libre</span>
          </button>
          {visible.length === 0 && <p className="col-span-full p-6 text-center text-sm text-slate-500">Sin productos en esta categoría.</p>}
        </div>
      </div>

      {/* Ticket */}
      <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button onClick={() => setDialog("patient")} className="flex items-center gap-3 border-b border-slate-200 p-4 text-left active:bg-slate-50">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">☺</span>
          <span className="flex-1">
            <span className="block font-semibold">{patient?.name ?? "Asignar paciente"}</span>
            <span className="block text-xs text-slate-500">{patient ? `${patient.doc}${rx ? " · con receta" : " · sin receta"}` : "Opcional, necesario para usar su receta"}</span>
          </span>
          <span className="text-slate-400">›</span>
        </button>

        <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-auto">
          {lines.length === 0 && <li className="p-8 text-center text-sm text-slate-400">Toca productos para agregarlos</li>}
          {lines.map((l) => (
            <li key={l.key} className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{l.description}</div>
                  {l.code && <div className="font-mono text-xs text-slate-400">{l.code}</div>}
                  {l.discount > 0 && <div className="text-xs text-emerald-700">Descuento −{formatCLP(l.discount)}</div>}
                </div>
                <div className="text-right font-semibold tabular-nums">{formatCLP(lineTotal(l))}</div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button onClick={() => changeQty(l.key, -1)} className="h-10 w-10 rounded-lg border border-slate-300 text-xl active:scale-95" aria-label="Quitar uno">−</button>
                <span className="w-8 text-center tabular-nums">{l.quantity}</span>
                {l.kind !== "lens" && <button onClick={() => changeQty(l.key, 1)} className="h-10 w-10 rounded-lg border border-slate-300 text-xl active:scale-95" aria-label="Agregar uno">+</button>}
                <button onClick={() => setDialog({ lineDiscount: l.key })} className="ml-auto h-10 rounded-lg px-3 text-sm text-brand-700 active:bg-brand-50">Descuento</button>
              </div>
            </li>
          ))}
        </ul>

        <div className="space-y-2 border-t border-slate-200 p-4">
          <div className="flex justify-between text-sm text-slate-600"><span>Subtotal</span><span className="tabular-nums">{formatCLP(totals.subtotal)}</span></div>
          <button onClick={() => setDialog("discount")} className="flex w-full justify-between text-sm text-emerald-700">
            <span>Descuento general {discount ? "" : "(tocar para agregar)"}</span><span className="tabular-nums">−{formatCLP(totals.discount)}</span>
          </button>
          <label className="flex items-center justify-between gap-2 text-sm text-slate-600">
            <span>Fecha de entrega</span>
            <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-10 rounded-lg border border-slate-300 px-2" />
          </label>
          <div className="flex items-end justify-between pt-1">
            <span className="text-lg font-semibold">Total</span>
            <span className="text-3xl font-bold tabular-nums">{formatCLP(totals.total)}</span>
          </div>
          {error && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
          <button
            disabled={lines.length === 0}
            onClick={() => { setError(null); setDialog("pay"); }}
            className="h-16 w-full rounded-xl bg-emerald-600 text-xl font-semibold text-white shadow active:scale-[0.98] disabled:bg-slate-300"
          >
            Cobrar {formatCLP(totals.total)}
          </button>
        </div>
      </div>

      {dialog === "lens" && (
        <LensConfigurator
          catalog={catalog}
          rx={rx}
          patientName={patient?.name ?? null}
          patientId={patient?.id ?? null}
          onClose={() => setDialog(null)}
          onAdd={(lens) => {
            const { price, ...rest } = lens;
            setLines((ls) => [...ls, { key: newKey(), kind: "lens", ...rest, unitPrice: price, quantity: 1, discount: 0 }]);
            setDialog(null);
          }}
        />
      )}
      {dialog === "patient" && <PatientDialog onPick={selectPatient} onClose={() => setDialog(null)} current={patient} />}
      {dialog === "discount" && (
        <AmountDialog title="Descuento general" initial={discount} onCancel={() => setDialog(null)} onDone={(n) => { setDiscount(Math.min(n, totals.subtotal)); setDialog(null); }}>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((pct) => (
              <button key={pct} onClick={() => { setDiscount(percentOf(totals.subtotal, pct)); setDialog(null); }} className="h-12 rounded-xl bg-emerald-50 font-semibold text-emerald-800 active:scale-95">{pct}%</button>
            ))}
          </div>
        </AmountDialog>
      )}
      {typeof dialog === "object" && dialog && "lineDiscount" in dialog && (() => {
        const l = lines.find((x) => x.key === dialog.lineDiscount);
        if (!l) return null;
        const gross = l.quantity * l.unitPrice;
        const set = (n: number) => { setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, discount: Math.min(n, gross) } as Line : x))); setDialog(null); };
        return (
          <AmountDialog title={`Descuento: ${l.description}`} initial={l.discount} onCancel={() => setDialog(null)} onDone={set}>
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map((pct) => (
                <button key={pct} onClick={() => set(percentOf(gross, pct))} className="h-12 rounded-xl bg-emerald-50 font-semibold text-emerald-800 active:scale-95">{pct}%</button>
              ))}
            </div>
          </AmountDialog>
        );
      })()}
      {dialog === "free" && <FreeItemDialog onCancel={() => setDialog(null)} onAdd={(description, price) => {
        setLines((ls) => [...ls, { key: newKey(), kind: "free", description, code: null, unitPrice: price, quantity: 1, discount: 0 }]);
        setDialog(null);
      }} />}
      {dialog === "pay" && (
        <PaymentDialog
          total={totals.total}
          cashOpen={cashOpen}
          onCancel={() => setDialog(null)}
          onSubmit={async (payments, change) => {
            const input: SaleInput = {
              patientId: patient?.id ?? null,
              deliveryDate: deliveryDate || null,
              notes: null,
              discount: totals.discount,
              items: lines.map((l) =>
                l.kind === "product" ? { kind: "product", productId: l.productId, quantity: l.quantity, discount: l.discount }
                  : l.kind === "free" ? { kind: "free", description: l.description, unitPrice: l.unitPrice, quantity: l.quantity, discount: l.discount }
                  : { kind: "lens", materialId: l.materialId, designId: l.designId, treatmentIds: l.treatmentIds, prescriptionId: l.prescriptionId, quantity: 1, discount: l.discount },
              ),
              payments,
            };
            const r = await createSale(input);
            if (r.ok) setResult({ saleId: r.saleId, number: r.number, change });
            else { setError(r.error); setDialog(null); }
          }}
        />
      )}
    </div>
  );
}

function PatientDialog({ onPick, onClose, current }: { onPick: (p: PatientOpt | null) => void; onClose: () => void; current: PatientOpt | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientOpt[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/pacientes?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then((r) => r.json()).then(setResults).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 pt-[10vh]" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 text-lg font-semibold">Paciente</div>
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="RUT o nombre…" className="h-14 w-full rounded-xl border border-slate-300 px-4 text-lg" />
        <ul className="mt-3 max-h-80 divide-y divide-slate-100 overflow-auto">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => onPick(r)} className="flex w-full justify-between px-2 py-4 text-left active:bg-slate-50">
                <span className="font-medium">{r.name}</span><span className="font-mono text-sm text-slate-500">{r.doc}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-2">
          {current && <button onClick={() => onPick(null)} className="h-12 flex-1 rounded-xl border border-slate-300">Quitar paciente</button>}
          <Link href="/pacientes/nuevo?returnTo=/ventas/nueva" className="flex h-12 flex-1 items-center justify-center rounded-xl border border-slate-300">+ Nuevo paciente</Link>
          <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-slate-100">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function FreeItemDialog({ onAdd, onCancel }: { onAdd: (d: string, price: number) => void; onCancel: () => void }) {
  const [desc, setDesc] = useState("");
  return (
    <AmountDialog title="Ítem libre" onCancel={onCancel} onDone={(n) => desc.trim() && n > 0 && onAdd(desc.trim(), n)}>
      <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción (ej. reparación de bisagra)" className="mb-3 h-12 w-full rounded-xl border border-slate-300 px-3" />
    </AmountDialog>
  );
}

function PaymentDialog({ total, cashOpen, onSubmit, onCancel }: {
  total: number; cashOpen: boolean; onSubmit: (p: Pay[], change: number) => Promise<void>; onCancel: () => void;
}) {
  const [payments, setPayments] = useState<Pay[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("EFECTIVO");
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;
  const [amount, setAmount] = useState(String(balance));
  const [change, setChange] = useState(0);
  const [pending, start] = useTransition();

  const add = () => {
    const n = Number(amount || 0);
    if (n <= 0 || balance <= 0) return;
    const { applied, change: c } = method === "EFECTIVO" ? applyCash(n, balance) : { applied: Math.min(n, balance), change: 0 };
    setPayments((ps) => [...ps, { method, amount: applied, reference: null }]);
    setChange((x) => x + c);
    setAmount(String(Math.max(0, balance - applied)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="grid w-full max-w-3xl gap-5 rounded-2xl bg-white p-5 shadow-xl md:grid-cols-2">
        <div>
          <div className="mb-3 text-lg font-semibold">Cobrar</div>
          {!cashOpen ? (
            <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              La caja está cerrada: puedes guardar la venta sin pago y cobrar después, o <Link className="underline" href="/caja">abrir la caja</Link>.
            </p>
          ) : (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={cx("h-14 rounded-xl text-base font-medium active:scale-95", method === m ? "bg-slate-900 text-white" : "border border-slate-300")}>
                    {METHOD_LABEL[m]}
                  </button>
                ))}
              </div>
              <div className="mb-2 rounded-xl bg-slate-100 px-4 py-3 text-right text-3xl font-bold tabular-nums">{formatCLP(Number(amount || 0))}</div>
              {method === "EFECTIVO" && (
                <div className="mb-2 grid grid-cols-3 gap-2">
                  {[10000, 20000, 50000].map((b) => (
                    <button key={b} onClick={() => setAmount(String(b))} className="h-11 rounded-xl bg-amber-50 font-semibold text-amber-900 active:scale-95">{formatCLP(b)}</button>
                  ))}
                </div>
              )}
              <Keypad value={amount} onChange={setAmount} />
              <button onClick={add} disabled={balance <= 0} className="mt-2 h-14 w-full rounded-xl bg-brand-600 text-lg font-semibold text-white active:scale-95 disabled:bg-slate-300">
                Agregar pago
              </button>
            </>
          )}
        </div>
        <div className="flex flex-col">
          <div className="space-y-1 rounded-xl bg-slate-50 p-4">
            <div className="flex justify-between"><span>Total</span><b className="tabular-nums">{formatCLP(total)}</b></div>
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{METHOD_LABEL[p.method]}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  {formatCLP(p.amount)}
                  <button onClick={() => { setPayments((ps) => ps.filter((_, j) => j !== i)); setChange(0); setAmount(String(balance + p.amount)); }} className="h-8 w-8 rounded text-rose-600" aria-label="Quitar pago">✕</button>
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-lg">
              <span>{balance > 0 ? "Saldo pendiente" : "Pagado"}</span>
              <b className={cx("tabular-nums", balance > 0 ? "text-rose-600" : "text-emerald-700")}>{formatCLP(balance)}</b>
            </div>
            {change > 0 && <div className="flex justify-between text-lg text-amber-800"><span>Vuelto</span><b className="tabular-nums">{formatCLP(change)}</b></div>}
          </div>
          {balance > 0 && payments.length > 0 && (
            <p className="mt-2 text-sm text-slate-600">Se registrará como <b>abono</b>; el saldo se cobra al entregar.</p>
          )}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <button onClick={onCancel} disabled={pending} className="h-16 rounded-xl border border-slate-300 text-lg active:scale-95">Volver</button>
            <button
              disabled={pending}
              onClick={() => start(() => onSubmit(payments, change))}
              className="h-16 rounded-xl bg-emerald-600 text-lg font-semibold text-white active:scale-95 disabled:opacity-60"
            >
              {pending ? "Guardando…" : balance <= 0 ? "Finalizar venta" : payments.length ? "Guardar con abono" : "Guardar sin pago"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
