import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { saveUser } from "@/server/admin";
import { UserForm } from "@/components/UserForm";
import { PageHeader } from "@/components/ui";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRole("ADMIN");
  const [user, branches] = await Promise.all([
    prisma.user.findFirst({ where: { id, orgId: ctx.orgId }, include: { branches: true } }),
    prisma.branch.findMany({ where: { orgId: ctx.orgId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!user) notFound();
  return (
    <>
      <PageHeader title={`Usuario: ${user.name}`} />
      <UserForm
        action={saveUser.bind(null, id)}
        branches={branches}
        user={{
          name: user.name,
          email: user.email,
          rut: user.rut,
          role: user.role,
          isProfessional: user.isProfessional,
          registroSis: user.registroSis,
          active: user.active,
          branchIds: user.branches.map((b) => b.branchId),
        }}
      />
    </>
  );
}
