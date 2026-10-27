import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/server/auth";
import { saveUpload, pathFor, removeUpload } from "@/server/import/files";
import { previewImport } from "@/server/import/gesvision";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 80 * 1024 * 1024;

// Paso 1: subir el Excel y obtener el resumen previo (no guarda nada en la base de datos).
export async function POST(req: NextRequest) {
  const ctx = await requireContext();
  if (ctx.user.role !== "ADMIN") return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Adjunta el archivo Excel" }, { status: 400 });
  if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: "El archivo debe ser .xlsx (Excel)" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "El archivo supera 80 MB" }, { status: 400 });

  const token = await saveUpload(ctx.orgId, await file.arrayBuffer());
  try {
    const summary = await previewImport(ctx.orgId, pathFor(ctx.orgId, token));
    return NextResponse.json({ token, summary });
  } catch (e) {
    await removeUpload(ctx.orgId, token);
    console.error("importar/gesvision preview", e);
    return NextResponse.json({ error: "No se pudo leer el archivo. ¿Es el “Listado de graduaciones” exportado desde Gesvision?" }, { status: 400 });
  }
}
