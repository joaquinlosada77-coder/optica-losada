import "server-only";
import { prisma } from "@/lib/db";
import { dayRangeUtc, localToUtc, shiftDayISO, todayISO, weekStartISO } from "@/lib/time";

export type SalesKpis = {
  today: string;
  weekStart: string;
  monthStart: string;
  thirtyStart: string;
  dayGross: number;
  dayOps: number;
  weekGross: number;
  monthGross: number;
  collected30: number;
  debt30: number;
  byBranch: { branchId: string; name: string; ops: number; gross: number }[];
};

/**
 * Indicadores de venta como el panel de GesVision. Montos brutos (IVA incluido),
 * sin ventas anuladas. Se calculan sobre las sucursales que el usuario puede ver.
 */
export async function salesKpis(orgId: string, branches: { id: string; name: string }[]): Promise<SalesKpis> {
  const today = todayISO();
  const weekStart = weekStartISO(today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const thirtyStart = shiftDayISO(today, -29);
  const end = dayRangeUtc(today).end;
  const branchIds = branches.map((b) => b.id);
  const base = { orgId, branchId: { in: branchIds }, status: { not: "ANULADA" as const } };
  const since = (iso: string) => ({ gte: localToUtc(iso, "00:00"), lt: end });

  const [day, week, month, collected, open, byBranch] = await Promise.all([
    prisma.sale.aggregate({ where: { ...base, createdAt: since(today) }, _sum: { total: true }, _count: true }),
    prisma.sale.aggregate({ where: { ...base, createdAt: since(weekStart) }, _sum: { total: true } }),
    prisma.sale.aggregate({ where: { ...base, createdAt: since(monthStart) }, _sum: { total: true } }),
    prisma.payment.aggregate({ where: { branchId: { in: branchIds }, voided: false, createdAt: since(thirtyStart) }, _sum: { amount: true } }),
    prisma.sale.aggregate({ where: { ...base, status: "ABIERTA", createdAt: since(thirtyStart) }, _sum: { total: true, paid: true } }),
    prisma.sale.groupBy({ by: ["branchId"], where: { ...base, createdAt: since(today) }, _sum: { total: true }, _count: true }),
  ]);

  return {
    today, weekStart, monthStart, thirtyStart,
    dayGross: day._sum.total ?? 0,
    dayOps: day._count,
    weekGross: week._sum.total ?? 0,
    monthGross: month._sum.total ?? 0,
    collected30: collected._sum.amount ?? 0,
    debt30: (open._sum.total ?? 0) - (open._sum.paid ?? 0),
    byBranch: branches.map((b) => {
      const row = byBranch.find((r) => r.branchId === b.id);
      return { branchId: b.id, name: b.name, ops: row?._count ?? 0, gross: row?._sum.total ?? 0 };
    }),
  };
}
