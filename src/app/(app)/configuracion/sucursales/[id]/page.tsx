import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { saveBranch } from "@/server/admin";
import { BranchForm } from "@/components/BranchForm";
import { PageHeader } from "@/components/ui";

export default async function EditBranchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRole("ADMIN");
  const branch = await prisma.branch.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!branch) notFound();
  return (
    <>
      <PageHeader title={`Sucursal: ${branch.name}`} />
      <BranchForm action={saveBranch.bind(null, id)} branch={branch} />
    </>
  );
}
