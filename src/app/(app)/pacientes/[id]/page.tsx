import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireContext } from "@/server/auth";
import { patientFullName } from "@/server/queries";
import { formatRut } from "@/lib/rut";
import { ageFrom, fmtDateTime, todayISO } from "@/lib/time";
import { APPT_STATUS_LABEL, APPT_STATUS_STYLE, APPT_TYPE_LABEL, PREVISION_LABEL, SALE_STATUS_LABEL, SALE_STATUS_STYLE, SEXO_LABEL } from "@/lib/labels";
import { fmtDiopter } from "@/lib/lenses";
import { formatCLP } from "@/lib/money";
import { Badge, Card, Empty, LinkButton, PageHeader } from "@/components/ui";

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireContext();
  const p = await prisma.patient.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      homeBranch: { select: { name: true } },
      prescriptions: { orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }], take: 10, include: { professional: { select: { name: true } } } },
      sales: { orderBy: { createdAt: "desc" }, take: 20, include: { branch: { select: { name: true } } } },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 30,
        include: { branch: { select: { name: true } }, professional: { select: { name: true } } },
      },
    },
  });
  if (!p) notFound();

  const now = new Date();
  const upcoming = p.appointments.filter((a) => a.startsAt >= now && a.status !== "CANCELADA").reverse();
  const past = p.appointments.filter((a) => a.startsAt < now || a.status === "CANCELADA");

  const rows: [string, React.ReactNode][] = [
    ["RUT", p.rut ? formatRut(p.rut) : null],
    ["Documento", p.documentoExtranjero],
    ["Nacimiento", p.fechaNacimiento ? `${p.fechaNacimiento.toISOString().slice(0, 10).split("-").reverse().join("-")} (${ageFrom(p.fechaNacimiento)} años)` : null],
    ["Sexo", p.sexo ? SEXO_LABEL[p.sexo] : null],
    ["Teléfono", p.telefono && <a className="text-brand-600 hover:underline" href={`https://wa.me/${p.telefono.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{p.telefono}</a>],
    ["Correo", p.email && <a className="text-brand-600 hover:underline" href={`mailto:${p.email}`}>{p.email}</a>],
    ["Dirección", [p.direccion, p.comuna, p.region].filter(Boolean).join(", ") || null],
    ["Previsión", p.prevision ? `${PREVISION_LABEL[p.prevision]}${p.isapre ? ` · ${p.isapre}` : ""}` : null],
    ["Ocupación", p.ocupacion],
    ["Sucursal de registro", p.homeBranch?.name],
    ["Marketing", p.aceptaMarketing ? "Acepta comunicaciones" : "No acepta"],
  ];

  return (
    <>
      <PageHeader
        title={patientFullName(p)}
        subtitle={p.rut ? formatRut(p.rut) : p.documentoExtranjero}
        actions={
          <>
            <LinkButton href={`/pacientes/${p.id}/editar`} variant="secondary">Editar</LinkButton>
            <LinkButton href={`/pacientes/${p.id}/receta`} variant="secondary">+ Receta</LinkButton>
            <LinkButton href={`/agenda/nueva?fecha=${todayISO()}&patientId=${p.id}`} variant="secondary">Agendar cita</LinkButton>
            <LinkButton href={`/ventas/nueva?patientId=${p.id}`}>Nueva venta</LinkButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Datos" className="lg:col-span-1">
          <dl className="space-y-2 text-sm">
            {rows.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="grid grid-cols-[8rem_1fr] gap-2">
                <dt className="text-slate-500">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {p.notas && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{p.notas}</p>}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card title="Próximas citas">
            {upcoming.length === 0 ? <Empty>Sin citas próximas.</Empty> : <ApptList items={upcoming} />}
          </Card>
          <Card title="Historial de citas">
            {past.length === 0 ? <Empty>Sin citas anteriores.</Empty> : <ApptList items={past} />}
          </Card>
          <Card title="Recetas" actions={<Link href={`/pacientes/${p.id}/receta`} className="text-sm text-brand-600 hover:underline">+ Nueva receta</Link>}>
            {p.prescriptions.length === 0 ? <Empty>Sin recetas registradas.</Empty> : (
              <div className="space-y-3">
                {p.prescriptions.map((r, idx) => (
                  <div key={r.id} className={idx === 0 ? "rounded-lg border border-brand-100 bg-brand-50/50 p-3" : "rounded-lg border border-slate-100 p-3"}>
                    <div className="mb-1 text-xs text-slate-500">
                      {r.issuedAt.toISOString().slice(0, 10).split("-").reverse().join("-")} · {r.professional?.name ?? r.professionalName ?? "Receta externa"}{idx === 0 && " · vigente"}
                      {r.dpTotal && ` · DP ${String(r.dpTotal).replace(".", ",")} mm`}
                    </div>
                    <table className="font-mono text-sm">
                      <tbody>
                        {([["OD", r.odSph, r.odCyl, r.odAxis, r.odAdd, r.dpOd, r.avccOd], ["OI", r.oiSph, r.oiCyl, r.oiAxis, r.oiAdd, r.dpOi, r.avccOi]] as const).map(([eye, sph, cyl, ax, add, dp, av]) => (
                          <tr key={eye}>
                            <td className="pr-3 font-sans font-semibold">{eye}</td>
                            <td className="pr-3">{fmtDiopter(sph)}</td>
                            <td className="pr-3">{cyl ? `${fmtDiopter(cyl)} x ${ax}°` : ""}</td>
                            <td className="pr-3">{add ? `Add ${fmtDiopter(add)}` : ""}</td>
                            <td className="pr-3 text-slate-500">{dp ? `DP ${String(dp).replace(".", ",")}` : ""}</td>
                            <td className="text-slate-500">{av ? `AV ${av}` : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.reason && <p className="mt-1 text-xs text-slate-600">Motivo: {r.reason}</p>}
                    {r.notes && <p className="mt-1 text-xs text-slate-600">{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="Compras">
            {p.sales.length === 0 ? <Empty>Sin compras.</Empty> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {p.sales.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <Link href={`/ventas/${s.id}`} className="w-44 font-medium hover:underline">Venta {s.number} · {s.branch.name}</Link>
                    <span className="flex-1 text-slate-600">{fmtDateTime(s.createdAt)}</span>
                    <span className="tabular-nums">{formatCLP(s.total)}</span>
                    <Badge className={SALE_STATUS_STYLE[s.status]}>{s.status === "ABIERTA" ? `Saldo ${formatCLP(s.total - s.paid)}` : SALE_STATUS_LABEL[s.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

type ApptItem = {
  id: string;
  startsAt: Date;
  type: keyof typeof APPT_TYPE_LABEL;
  status: keyof typeof APPT_STATUS_LABEL;
  branch: { name: string };
  professional: { name: string } | null;
};

function ApptList({ items }: { items: ApptItem[] }) {
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {items.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
          <Link href={`/agenda/${a.id}`} className="w-44 font-medium hover:underline">{fmtDateTime(a.startsAt)}</Link>
          <span className="flex-1 text-slate-600">
            {APPT_TYPE_LABEL[a.type]} · {a.branch.name}{a.professional ? ` · ${a.professional.name}` : ""}
          </span>
          <Badge className={APPT_STATUS_STYLE[a.status]}>{APPT_STATUS_LABEL[a.status]}</Badge>
        </li>
      ))}
    </ul>
  );
}
