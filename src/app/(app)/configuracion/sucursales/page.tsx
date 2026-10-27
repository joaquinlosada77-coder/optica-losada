import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Sucursales" };

export default async function BranchesPage() {
  const ctx = await requireRole("ADMIN");
  const branches = await prisma.branch.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { _count: { select: { users: true, homePatients: true } } },
  });
  return (
    <>
      <PageHeader title="Sucursales" actions={<LinkButton href="/configuracion/sucursales/nueva">+ Nueva sucursal</LinkButton>} />
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-4">Código</th><th className="py-2 pr-4">Nombre</th><th className="py-2 pr-4">Comuna</th>
              <th className="py-2 pr-4">Horario</th><th className="py-2 pr-4">Usuarios</th><th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {branches.map((b) => (
              <tr key={b.id}>
                <td className="py-2.5 pr-4 font-mono">{b.code}</td>
                <td className="py-2.5 pr-4"><Link className="font-medium text-brand-700 hover:underline" href={`/configuracion/sucursales/${b.id}`}>{b.name}</Link></td>
                <td className="py-2.5 pr-4">{b.comuna ?? "—"}</td>
                <td className="py-2.5 pr-4">{b.openTime}–{b.closeTime} ({b.slotMinutes} min)</td>
                <td className="py-2.5 pr-4">{b._count.users}</td>
                <td className="py-2.5">{b.active ? <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">Activa</Badge> : <Badge className="border-slate-300 text-slate-500">Inactiva</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
