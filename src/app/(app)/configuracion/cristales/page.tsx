import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { saveLensDesign, saveLensMaterial, saveLensPrices, saveLensTreatment } from "@/server/lens-admin";
import { FAMILY_LABEL } from "@/lib/lenses";
import { Alert, Button, Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Cristales" };

const cell = "rounded-md border border-slate-300 px-2 py-1.5 text-sm w-full";

export default async function LensConfigPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const ctx = await requireRole("ADMIN");
  const [materials, designs, treatments] = await Promise.all([
    prisma.lensMaterial.findMany({ where: { orgId: ctx.orgId }, orderBy: [{ sortOrder: "asc" }, { refractiveIndex: "asc" }], include: { prices: true } }),
    prisma.lensDesign.findMany({ where: { orgId: ctx.orgId }, orderBy: [{ family: "asc" }, { sortOrder: "asc" }] }),
    prisma.lensTreatment.findMany({ where: { orgId: ctx.orgId }, orderBy: { sortOrder: "asc" } }),
  ]);
  const price = (mid: string, did: string) => materials.find((m) => m.id === mid)?.prices.find((p) => p.designId === did)?.price;

  return (
    <>
      <PageHeader title="Configurador de cristales" subtitle="Lo que el cliente ve en el punto de venta: material → filtros → tipo. El código se arma con los códigos de cada opción." />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {ok && <div className="mb-4"><Alert tone="info">Cambios guardados.</Alert></div>}

      <Card title="1 · Precio base del par (material × tipo)" className="mb-6">
        <form action={saveLensPrices}>
          <div className="overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr><th className="pr-3 text-left text-slate-500">Material</th>{designs.map((d) => <th key={d.id} className="px-2 pb-2 text-left align-bottom"><span className="block text-xs font-normal text-slate-400">{FAMILY_LABEL[d.family]}</span>{d.name}</th>)}</tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td className="py-1 pr-3 font-medium">{m.refractiveIndex} · {m.name}</td>
                    {designs.map((d) => (
                      <td key={d.id} className="px-2 py-1">
                        <input name={`p_${m.id}_${d.id}`} defaultValue={price(m.id, d.id) ?? ""} inputMode="numeric" placeholder="No disponible" className={`${cell} w-32 text-right`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="my-3 text-xs text-slate-500">Precios en pesos con IVA. Deja vacía la celda si esa combinación no se vende.</p>
          <Button>Guardar precios</Button>
        </form>
      </Card>

      <Card title="2 · Materiales / índices" className="mb-6">
        <div className="grid grid-cols-[5rem_1fr_5rem_2fr_4rem_5rem_5rem_4rem_4rem_6rem] gap-2 text-xs font-medium text-slate-500">
          <span>Código</span><span>Nombre</span><span>Índice</span><span>Texto para el cliente</span><span>Delgadez 1-5</span><span>Sugerir desde (D)</span><span>Máx. potencia (D)</span><span>Orden</span><span>Activo</span><span />
        </div>
        {[...materials, null].map((m) => (
          <form key={m?.id ?? "new"} action={saveLensMaterial.bind(null, m?.id ?? null)} className="mt-2 grid grid-cols-[5rem_1fr_5rem_2fr_4rem_5rem_5rem_4rem_4rem_6rem] items-center gap-2">
            <input name="code" defaultValue={m?.code} className={cell} placeholder="167" />
            <input name="name" defaultValue={m?.name} className={cell} placeholder="Alto índice" />
            <input name="refractiveIndex" defaultValue={m?.refractiveIndex} className={cell} placeholder="1.67" />
            <input name="description" defaultValue={m?.description ?? ""} className={cell} />
            <input name="thinness" defaultValue={m?.thinness ?? 1} className={cell} />
            <input name="recommendFromPower" defaultValue={m?.recommendFromPower ?? 0} className={cell} />
            <input name="maxPower" defaultValue={m?.maxPower ?? 10} className={cell} />
            <input name="sortOrder" defaultValue={m?.sortOrder ?? 0} className={cell} />
            {m ? <input type="checkbox" name="active" defaultChecked={m.active} className="h-5 w-5" /> : <span />}
            <Button variant={m ? "secondary" : "primary"}>{m ? "Guardar" : "Agregar"}</Button>
          </form>
        ))}
      </Card>

      <Card title="3 · Filtros y tratamientos" className="mb-6">
        <p className="mb-3 text-xs text-slate-500">Los tratamientos con el mismo <b>grupo</b> se excluyen: al elegir AR TOP se quita AR. Deja el grupo vacío si se puede combinar con todo.</p>
        <div className="grid grid-cols-[5rem_1fr_2fr_5rem_7rem_4rem_4rem_6rem] gap-2 text-xs font-medium text-slate-500">
          <span>Código</span><span>Nombre</span><span>Texto para el cliente</span><span>Grupo</span><span>Recargo par</span><span>Orden</span><span>Activo</span><span />
        </div>
        {[...treatments, null].map((t) => (
          <form key={t?.id ?? "new"} action={saveLensTreatment.bind(null, t?.id ?? null)} className="mt-2 grid grid-cols-[5rem_1fr_2fr_5rem_7rem_4rem_4rem_6rem] items-center gap-2">
            <input name="code" defaultValue={t?.code} className={cell} placeholder="AR" />
            <input name="name" defaultValue={t?.name} className={cell} placeholder="Antirreflejo" />
            <input name="description" defaultValue={t?.description ?? ""} className={cell} />
            <input name="exclusiveGroup" defaultValue={t?.exclusiveGroup ?? ""} className={`${cell} uppercase`} placeholder="AR" />
            <input name="price" defaultValue={t?.price} inputMode="numeric" className={`${cell} text-right`} />
            <input name="sortOrder" defaultValue={t?.sortOrder ?? 0} className={cell} />
            {t ? <input type="checkbox" name="active" defaultChecked={t.active} className="h-5 w-5" /> : <span />}
            <Button variant={t ? "secondary" : "primary"}>{t ? "Guardar" : "Agregar"}</Button>
          </form>
        ))}
      </Card>

      <Card title="4 · Tipos y gamas de cristal">
        <div className="grid grid-cols-[6rem_1fr_2fr_9rem_5rem_4rem_4rem_6rem] gap-2 text-xs font-medium text-slate-500">
          <span>Código</span><span>Nombre (gama)</span><span>Texto para el cliente</span><span>Familia</span><span>Requiere adición</span><span>Orden</span><span>Activo</span><span />
        </div>
        {[...designs, null].map((d) => (
          <form key={d?.id ?? "new"} action={saveLensDesign.bind(null, d?.id ?? null)} className="mt-2 grid grid-cols-[6rem_1fr_2fr_9rem_5rem_4rem_4rem_6rem] items-center gap-2">
            <input name="code" defaultValue={d?.code} className={cell} placeholder="PROGINT" />
            <input name="name" defaultValue={d?.name} className={cell} placeholder="Progresivo Intermedio" />
            <input name="description" defaultValue={d?.description ?? ""} className={cell} />
            <select name="family" defaultValue={d?.family ?? "MONOFOCAL"} className={cell}>
              {Object.entries(FAMILY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="checkbox" name="requiresAdd" defaultChecked={d?.requiresAdd} className="h-5 w-5" />
            <input name="sortOrder" defaultValue={d?.sortOrder ?? 0} className={cell} />
            {d ? <input type="checkbox" name="active" defaultChecked={d.active} className="h-5 w-5" /> : <span />}
            <Button variant={d ? "secondary" : "primary"}>{d ? "Guardar" : "Agregar"}</Button>
          </form>
        ))}
      </Card>
    </>
  );
}
