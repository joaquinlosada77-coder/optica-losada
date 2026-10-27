import { NextResponse, type NextRequest } from "next/server";
import { audit, requireContext } from "@/server/auth";
import { branchesInput, ensureBranches } from "@/server/import/gesvision";

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const parsed = branchesInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const r = await ensureBranches(ctx.orgId, parsed.data);
  await audit(ctx, "import.gesvision.branches", "import", "gesvision", r);
  return NextResponse.json(r);
}
