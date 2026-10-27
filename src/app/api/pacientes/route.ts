import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/server/auth";
import { patientFullName, searchPatients } from "@/server/queries";
import { formatRut } from "@/lib/rut";

// Autocompletado de pacientes para formularios (agenda, y luego TPV/ficha).
export async function GET(req: NextRequest) {
  const ctx = await requireContext();
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json([]);
  const rows = await searchPatients(ctx.orgId, q, 10);
  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      name: patientFullName(p),
      doc: p.rut ? formatRut(p.rut) : (p.documentoExtranjero ?? ""),
      phone: p.telefono,
    })),
  );
}
