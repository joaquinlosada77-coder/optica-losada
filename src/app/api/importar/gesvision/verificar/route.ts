import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireContext } from "@/server/auth";
import { branchesInput, verify } from "@/server/import/gesvision";

const body = z.object({
  branches: branchesInput.optional(),
  keys: z.array(z.string().max(60)).max(2000).optional(),
  refs: z.array(z.string().max(300)).max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  return NextResponse.json(await verify(ctx.orgId, parsed.data));
}
