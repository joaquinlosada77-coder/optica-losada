import { NextResponse, type NextRequest } from "next/server";
import { access } from "node:fs/promises";
import { audit, requireContext } from "@/server/auth";
import { pathFor, removeUpload } from "@/server/import/files";
import { runImport } from "@/server/import/gesvision";

export const runtime = "nodejs";
export const maxDuration = 300;

// Paso 2: confirmar e importar el archivo ya revisado.
export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  let path: string;
  try {
    path = pathFor(ctx.orgId, String(token ?? ""));
    await access(path);
  } catch {
    return NextResponse.json({ error: "El archivo ya no está disponible. Vuelve a subirlo." }, { status: 400 });
  }
  try {
    const result = await runImport(ctx.orgId, ctx.user.id, path);
    await audit(ctx, "import.gesvision", "import", String(token), result);
    return NextResponse.json({ result });
  } catch (e) {
    console.error("importar/gesvision run", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al importar" }, { status: 500 });
  } finally {
    await removeUpload(ctx.orgId, String(token));
  }
}
