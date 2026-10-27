import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { saveUser } from "@/server/admin";
import { UserForm } from "@/components/UserForm";
import { PageHeader } from "@/components/ui";

export default async function NewUserPage() {
  const ctx = await requireRole("ADMIN");
  const branches = await prisma.branch.findMany({ where: { orgId: ctx.orgId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader title="Nuevo usuario" />
      <UserForm action={saveUser.bind(null, null)} branches={branches} />
    </>
  );
}
