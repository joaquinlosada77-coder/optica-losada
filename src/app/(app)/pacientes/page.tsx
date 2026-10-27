import Link from "next/link";
import type { Metadata } from "next";
import { requireContext } from "@/server/auth";
import { patientFullName, searchPatients } from "@/server/queries";
import { formatRut } from "@/lib/rut";
import { ageFrom } from "@/lib/time";
import { Card, Empty, LinkButton, PageHeader, inputCls } from "@/components/ui";

export const metadata: Metadata = { title: "Pacientes" };

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const ctx = await requireContext();
  const patients = await searchPatients(ctx.orgId, q, 50);

  return (
    <>
      <PageHeader
        title="Pacientes"
        subtitle="Compartidos entre todas las sucursales de la empresa"
        actions={<LinkButton href="/pacientes/nuevo">+ Nuevo paciente</LinkButton>}
      />
      <Card>
        <form className="mb-4 flex gap-2">
          <input name="q" defaultValue={q} autoFocus placeholder="Buscar por RUT, nombre, apellido, teléfono o correo…" className={inputCls} />
          <button className="rounded-lg border border-slate-300 px-4 text-sm hover:bg-slate-50">Buscar</button>
        </form>
        {patients.length === 0 ? (
          <Empty>
            {q ? <>Sin resultados para “{q}”. <Link className="text-brand-600 underline" href="/pacientes/nuevo">Registrar paciente</Link></> : "Aún no hay pacientes registrados."}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="py-2 pr-4">RUT / Doc.</th>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Edad</th>
                  <th className="py-2 pr-4">Teléfono</th>
                  <th className="py-2">Correo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 font-mono text-slate-600">{p.rut ? formatRut(p.rut) : p.documentoExtranjero}</td>
                    <td className="py-2.5 pr-4">
                      <Link href={`/pacientes/${p.id}`} className="font-medium text-brand-700 hover:underline">{patientFullName(p)}</Link>
                    </td>
                    <td className="py-2.5 pr-4">{p.fechaNacimiento ? ageFrom(p.fechaNacimiento) : "—"}</td>
                    <td className="py-2.5 pr-4">{p.telefono ?? "—"}</td>
                    <td className="py-2.5">{p.email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!q && <p className="mt-3 text-xs text-slate-400">Mostrando los 50 registros más recientes.</p>}
          </div>
        )}
      </Card>
    </>
  );
}
