import { NextResponse, type NextRequest } from "next/server";
import { audit, requireContext } from "@/server/auth";
import { importPrescriptions, prescriptionsInput } from "@/server/import/gesvision";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const parsed = prescriptionsInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos en la tanda de recetas" }, { status: 400 });
  const r = await importPrescriptions(ctx.orgId, ctx.user.id, parsed.data);
  await audit(ctx, "import.gesvision.prescriptions", "import", "gesvision", r);
  return NextResponse.json(r);
}
