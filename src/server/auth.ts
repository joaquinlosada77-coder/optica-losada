import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Branch, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { BRANCH_COOKIE, SESSION_COOKIE, verifySession } from "@/lib/session";

export type AppContext = {
  user: { id: string; name: string; email: string; role: Role; isProfessional: boolean };
  orgId: string;
  orgName: string;
  branches: Branch[]; // sucursales a las que el usuario tiene acceso
  branch: Branch; // sucursal activa
};

/**
 * Contexto de la petición: usuario, empresa y sucursal activa.
 * Toda consulta de negocio debe filtrar por ctx.orgId (y ctx.branch.id cuando aplique).
 */
export const requireContext = cache(async (): Promise<AppContext> => {
  const jar = await cookies();
  const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login");

  const user = await prisma.user.findFirst({
    where: { id: session.uid, orgId: session.org, active: true },
    include: { org: true, branches: { include: { branch: true } } },
  });
  if (!user) redirect("/login");

  const branches =
    user.role === "ADMIN"
      ? await prisma.branch.findMany({ where: { orgId: user.orgId, active: true }, orderBy: { name: "asc" } })
      : user.branches.map((ub) => ub.branch).filter((b) => b.active).sort((a, b) => a.name.localeCompare(b.name));

  if (branches.length === 0) redirect("/login?error=sin-sucursal");

  const wanted = jar.get(BRANCH_COOKIE)?.value;
  const branch = branches.find((b) => b.id === wanted) ?? branches[0];

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, isProfessional: user.isProfessional },
    orgId: user.orgId,
    orgName: user.org.name,
    branches,
    branch,
  };
});

export async function requireRole(...roles: Role[]): Promise<AppContext> {
  const ctx = await requireContext();
  if (!roles.includes(ctx.user.role)) redirect("/?error=sin-permiso");
  return ctx;
}

export async function audit(
  ctx: AppContext,
  action: string,
  entity: string,
  entityId: string,
  data?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: { orgId: ctx.orgId, userId: ctx.user.id, action, entity, entityId, data: data as object | undefined },
  });
}
