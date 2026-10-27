import { NextResponse, type NextRequest } from "next/server";
import { audit, requireContext } from "@/server/auth";
import { importPatients, patientsInput } from "@/server/import/gesvision";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const parsed = patientsInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos en la tanda de pacientes" }, { status: 400 });
  const r = await importPatients(ctx.orgId, parsed.data);
  await audit(ctx, "import.gesvision.patients", "import", "gesvision", r);
  return NextResponse.json(r);
}
