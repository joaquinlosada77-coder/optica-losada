import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { ROLE_LABEL } from "@/lib/labels";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const ctx = await requireRole("ADMIN");
  const users = await prisma.user.findMany({
    where: { orgId: ctx.orgId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { branches: { include: { branch: { select: { name: true } } } } },
  });
  return (
    <>
      <PageHeader title="Usuarios" actions={<LinkButton href="/configuracion/usuarios/nuevo">+ Nuevo usuario</LinkButton>} />
      <Card>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-4">Nombre</th><th className="py-2 pr-4">Correo</th><th className="py-2 pr-4">Rol</th>
              <th className="py-2 pr-4">Sucursales</th><th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2.5 pr-4">
                  <Link className="font-medium text-brand-700 hover:underline" href={`/configuracion/usuarios/${u.id}`}>{u.name}</Link>
                  {u.isProfessional && <span className="ml-2 text-xs text-slate-500">· atiende</span>}
                </td>
                <td className="py-2.5 pr-4">{u.email}</td>
                <td className="py-2.5 pr-4">{ROLE_LABEL[u.role]}</td>
                <td className="py-2.5 pr-4">{u.role === "ADMIN" ? "Todas" : u.branches.map((b) => b.branch.name).join(", ")}</td>
                <td className="py-2.5">{u.active ? <Badge className="border-emerald-300 bg-emerald-50 text-emerald-800">Activo</Badge> : <Badge className="border-slate-300 text-slate-500">Inactivo</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
