"use server";

import { PaymentMethod, Prisma, WorkStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { lineTotal, saleTotals } from "@/lib/money";
import { resolveLens, toRx } from "@/lib/lenses";
import { audit, requireContext } from "@/server/auth";
import { loadLensCatalog } from "@/server/lenses";


const money = z.number().int().min(0).max(100_000_000);

const saleInput = z.object({
  patientId: z.string().nullable(),
  deliveryDate: z.iso.date().nullable(),
  notes: z.string().max(500).nullable(),
  discount: money,
  items: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("product"), productId: z.string(), quantity: z.number().int().min(1).max(999), discount: money }),
        z.object({
          kind: z.literal("free"),
          description: z.string().trim().min(1, "Describe el ítem libre").max(200),
          unitPrice: money,
          quantity: z.number().int().min(1).max(999),
          discount: money,
        }),
        z.object({
          kind: z.literal("lens"),
          materialId: z.string(),
          designId: z.string(),
          treatmentIds: z.array(z.string()).max(20),
          prescriptionId: z.string().nullable(),
          quantity: z.literal(1), // un par
          discount: money,
        }),
      ]),
    )
    .min(1, "Agrega al menos un producto"),
  payments: z.array(
    z.object({
      method: z.enum(PaymentMethod),
      amount: money.min(1),
      reference: z.string().max(60).nullable(),
    }),
  ),
});

export type SaleInput = z.infer<typeof saleInput>;
type Result = { ok: true; saleId: string; number: number } | { ok: false; error: string };

async function openCashSession(branchId: string) {
  return prisma.cashSession.findFirst({ where: { branchId, closedAt: null } });
}

export async function createSale(input: SaleInput): Promise<Result> {
  const ctx = await requireContext();
  const parsed = saleInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const s = parsed.data;

  // Precios siempre calculados en el servidor (no se confía en el cliente)
  const productIds = s.items.flatMap((i) => (i.kind === "product" ? [i.productId] : []));
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, orgId: ctx.orgId, active: true } });
  const productById = new Map(products.map((p) => [p.id, p]));
  const hasLens = s.items.some((i) => i.kind === "lens");
  const catalog = hasLens ? await loadLensCatalog(ctx.orgId) : null;

  type Line = {
    productId: string | null;
    code: string | null;
    lensConfig: Prisma.InputJsonValue | undefined;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  };
  const items: Line[] = [];
  for (const i of s.items) {
    if (i.kind === "product") {
      const p = productById.get(i.productId);
      if (!p) return { ok: false, error: "Un producto ya no está disponible. Recarga la página." };
      items.push({ productId: p.id, code: p.sku, lensConfig: undefined, description: p.name, quantity: i.quantity, unitPrice: p.price, discount: i.discount });
    } else if (i.kind === "free") {
      items.push({ productId: null, code: null, lensConfig: undefined, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount });
    } else {
      let rx = null;
      if (i.prescriptionId) {
        rx = await prisma.prescription.findFirst({ where: { id: i.prescriptionId, orgId: ctx.orgId, patientId: s.patientId ?? "-" } });
        if (!rx) return { ok: false, error: "La receta no corresponde al paciente de la venta." };
      }
      const lens = resolveLens(catalog!, i, rx && toRx(rx));
      if ("error" in lens) return { ok: false, error: lens.error };
      items.push({
        productId: null,
        code: lens.code,
        lensConfig: {
          materialId: i.materialId,
          designId: i.designId,
          treatmentIds: i.treatmentIds,
          prescriptionId: i.prescriptionId,
          rx: rx && { odSph: rx.odSph, odCyl: rx.odCyl, odAxis: rx.odAxis, odAdd: rx.odAdd, oiSph: rx.oiSph, oiCyl: rx.oiCyl, oiAxis: rx.oiAxis, oiAdd: rx.oiAdd, dpOd: rx.dpOd, dpOi: rx.dpOi },
        },
        description: lens.description,
        quantity: 1,
        unitPrice: lens.price,
        discount: i.discount,
      });
    }
  }
  if (items.some((i) => i.discount > i.quantity * i.unitPrice)) {
    return { ok: false, error: "Un descuento de línea supera el valor de la línea." };
  }
  const totals = saleTotals(items, s.discount);
  if (s.discount > totals.subtotal) return { ok: false, error: "El descuento supera el subtotal." };

  const paid = s.payments.reduce((a, p) => a + p.amount, 0);
  if (paid > totals.total) return { ok: false, error: "Los pagos superan el total de la venta." };

  if (s.patientId) {
    const ok = await prisma.patient.count({ where: { id: s.patientId, orgId: ctx.orgId } });
    if (!ok) return { ok: false, error: "Paciente no encontrado." };
  }

  const cash = s.payments.length ? await openCashSession(ctx.branch.id) : null;
  if (s.payments.length && !cash) return { ok: false, error: "La caja está cerrada. Ábrela para registrar pagos." };

  const sale = await prisma.$transaction(async (tx) => {
    const { saleSeq } = await tx.branch.update({
      where: { id: ctx.branch.id },
      data: { saleSeq: { increment: 1 } },
      select: { saleSeq: true },
    });
    return tx.sale.create({
      data: {
        orgId: ctx.orgId,
        branchId: ctx.branch.id,
        number: saleSeq,
        patientId: s.patientId,
        sellerId: ctx.user.id,
        status: paid >= totals.total ? "PAGADA" : "ABIERTA",
        // Con cristales hay trabajo de laboratorio; sin ellos la venta se entrega en el acto
        workStatus: items.some((i) => i.lensConfig) ? "PENDIENTE" : "ENTREGADO",
        deliveredAt: items.some((i) => i.lensConfig) ? null : new Date(),
        subtotal: totals.subtotal,
        discount: totals.discount,
        total: totals.total,
        paid,
        deliveryDate: s.deliveryDate ? new Date(`${s.deliveryDate}T00:00:00Z`) : null,
        notes: s.notes,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            code: i.code,
            lensConfig: i.lensConfig,
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            total: lineTotal(i),
          })),
        },
        payments: {
          create: s.payments.map((p) => ({
            method: p.method,
            amount: p.amount,
            reference: p.reference,
            branchId: ctx.branch.id,
            cashSessionId: cash!.id,
            userId: ctx.user.id,
          })),
        },
      },
    });
  });

  await audit(ctx, "sale.create", "sale", sale.id, { number: sale.number, total: sale.total, paid });
  revalidatePath("/ventas");
  revalidatePath("/caja");
  return { ok: true, saleId: sale.id, number: sale.number };
}

const paymentInput = z.object({
  saleId: z.string(),
  method: z.enum(PaymentMethod),
  amount: money.min(1, "Ingresa un monto"),
  reference: z.string().max(60).nullable(),
});

/** Abono o pago de saldo. Se registra en la caja de la sucursal donde se cobra. */
export async function addPayment(input: z.infer<typeof paymentInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireContext();
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const p = parsed.data;

  const sale = await prisma.sale.findFirst({ where: { id: p.saleId, orgId: ctx.orgId } });
  if (!sale) return { ok: false, error: "Venta no encontrada." };
  const cash = await openCashSession(ctx.branch.id);
  if (!cash) return { ok: false, error: "La caja está cerrada. Ábrela para registrar pagos." };

  const ok = await prisma.$transaction(async (tx) => {
    // Actualización condicional: evita sobrepagar si dos personas abonan a la vez
    const updated = await tx.$executeRaw`
      UPDATE sales
         SET paid = paid + ${p.amount},
             status = CASE WHEN paid + ${p.amount} >= total THEN 'PAGADA'::"SaleStatus" ELSE status END,
             updated_at = now()
       WHERE id = ${sale.id} AND status = 'ABIERTA' AND paid + ${p.amount} <= total`;
    if (updated !== 1) return false;
    await tx.payment.create({
      data: { saleId: sale.id, method: p.method, amount: p.amount, reference: p.reference, branchId: ctx.branch.id, cashSessionId: cash.id, userId: ctx.user.id },
    });
    return true;
  });
  if (!ok) return { ok: false, error: "El monto supera el saldo pendiente o la venta ya no está abierta." };

  await audit(ctx, "sale.payment", "sale", sale.id, { amount: p.amount, method: p.method });
  revalidatePath(`/ventas/${sale.id}`);
  revalidatePath("/caja");
  return { ok: true };
}

export async function voidSale(saleId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return { ok: false, error: "Solo un administrador puede anular ventas." };
  if (reason.trim().length < 5) return { ok: false, error: "Indica el motivo de la anulación." };

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, orgId: ctx.orgId },
    include: { payments: { include: { cashSession: true } } },
  });
  if (!sale) return { ok: false, error: "Venta no encontrada." };
  if (sale.status === "ANULADA") return { ok: false, error: "La venta ya está anulada." };
  if (sale.payments.some((p) => !p.voided && p.cashSession.closedAt)) {
    // Con caja cerrada el dinero ya se cuadró: corresponde devolución / nota de crédito (fase DTE)
    return { ok: false, error: "Tiene pagos en una caja ya cerrada. Requiere devolución con nota de crédito." };
  }

  await prisma.$transaction([
    prisma.payment.updateMany({ where: { saleId }, data: { voided: true } }),
    prisma.sale.update({ where: { id: saleId }, data: { status: "ANULADA", voidReason: reason.trim() } }),
  ]);
  await audit(ctx, "sale.void", "sale", saleId, { reason });
  revalidatePath(`/ventas/${saleId}`);
  revalidatePath("/ventas");
  revalidatePath("/caja");
  return { ok: true };
}

// ───────────── Caja ─────────────

export async function openCash(openingAmount: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireContext();
  if (!Number.isInteger(openingAmount) || openingAmount < 0) return { ok: false, error: "Monto inválido." };
  try {
    const s = await prisma.cashSession.create({ data: { branchId: ctx.branch.id, openedById: ctx.user.id, openingAmount } });
    await audit(ctx, "cash.open", "cash_session", s.id, { openingAmount });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, error: "La caja ya está abierta." };
    throw e;
  }
  revalidatePath("/caja");
  return { ok: true };
}

export async function closeCash(countedCash: number, notes: string | null): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireContext();
  if (!Number.isInteger(countedCash) || countedCash < 0) return { ok: false, error: "Monto inválido." };
  const session = await openCashSession(ctx.branch.id);
  if (!session) return { ok: false, error: "No hay caja abierta." };

  const cashIn = await prisma.payment.aggregate({
    where: { cashSessionId: session.id, method: "EFECTIVO", voided: false },
    _sum: { amount: true },
  });
  const expectedCash = session.openingAmount + (cashIn._sum.amount ?? 0);
  const res = await prisma.cashSession.updateMany({
    where: { id: session.id, closedAt: null },
    data: { closedAt: new Date(), closedById: ctx.user.id, countedCash, expectedCash, notes },
  });
  if (res.count !== 1) return { ok: false, error: "La caja ya fue cerrada." };
  await audit(ctx, "cash.close", "cash_session", session.id, { countedCash, expectedCash, diff: countedCash - expectedCash });
  revalidatePath("/caja");
  return { ok: true };
}

// ───────────── Estado del trabajo (OT) ─────────────

export async function setWorkStatus(saleId: string, status: WorkStatus): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireContext();
  if (!Object.values(WorkStatus).includes(status)) return { ok: false, error: "Estado inválido" };
  const sale = await prisma.sale.findFirst({ where: { id: saleId, orgId: ctx.orgId } });
  if (!sale) return { ok: false, error: "Venta no encontrada." };
  if (sale.status === "ANULADA") return { ok: false, error: "La venta está anulada." };

  await prisma.sale.update({
    where: { id: saleId },
    data: { workStatus: status, deliveredAt: status === "ENTREGADO" ? new Date() : null },
  });
  await audit(ctx, "sale.work_status", "sale", saleId, { from: sale.workStatus, to: status });
  revalidatePath(`/ventas/${saleId}`);
  revalidatePath("/ventas");
  return { ok: true };
}
