import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatCLP } from "@/lib/money";
import { PRODUCT_TYPE_LABEL } from "@/lib/labels";
import { requireContext } from "@/server/auth";
import { Badge, Card, Empty, LinkButton, PageHeader, inputCls } from "@/components/ui";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const ctx = await requireContext();
  const isAdmin = ctx.user.role === "ADMIN";
  const products = await prisma.product.findMany({
    where: {
      orgId: ctx.orgId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ active: "desc" }, { type: "asc" }, { name: "asc" }],
    take: 200,
  });
  return (
    <>
      <PageHeader title="Productos" subtitle="Armazones, lentes de contacto, accesorios y servicios" actions={isAdmin && <LinkButton href="/productos/nuevo">+ Nuevo producto</LinkButton>} />
      <Card>
        <form className="mb-4"><input name="q" defaultValue={q} placeholder="Buscar por nombre, código o marca…" className={inputCls} /></form>
        {products.length === 0 ? <Empty>Sin productos.</Empty> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
              <tr className="border-b border-slate-200"><th className="py-2 pr-4">Código</th><th className="py-2 pr-4">Nombre</th><th className="py-2 pr-4">Categoría</th><th className="py-2 pr-4 text-right">Precio</th><th className="py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className={p.active ? "" : "text-slate-400"}>
                  <td className="py-2.5 pr-4 font-mono">{p.sku}</td>
                  <td className="py-2.5 pr-4">
                    {isAdmin ? <Link className="font-medium text-brand-700 hover:underline" href={`/productos/${p.id}`}>{p.name}</Link> : p.name}
                    {p.brand && <span className="text-slate-500"> · {p.brand}</span>}
                  </td>
                  <td className="py-2.5 pr-4">{PRODUCT_TYPE_LABEL[p.type]}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{formatCLP(p.price)}</td>
                  <td className="py-2.5 text-right">{p.favorite && <Badge className="border-amber-300 bg-amber-50 text-amber-800">Frecuente</Badge>}{!p.active && <Badge className="border-slate-300">Inactivo</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
