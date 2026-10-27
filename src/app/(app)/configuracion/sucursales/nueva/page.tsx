import { requireRole } from "@/server/auth";
import { saveBranch } from "@/server/admin";
import { BranchForm } from "@/components/BranchForm";
import { PageHeader } from "@/components/ui";

export default async function NewBranchPage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader title="Nueva sucursal" />
      <BranchForm action={saveBranch.bind(null, null)} />
    </>
  );
}
