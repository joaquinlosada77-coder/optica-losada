import { NextResponse } from "next/server";
import { requireContext } from "@/server/auth";
import { latestPrescription } from "@/server/lenses";

// Última receta del paciente, para el configurador de cristales del TPV.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  return NextResponse.json(await latestPrescription(ctx.orgId, id));
}
