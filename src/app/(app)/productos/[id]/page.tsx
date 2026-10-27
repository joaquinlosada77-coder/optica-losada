import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { saveProduct } from "@/server/products";
import { ProductForm } from "@/components/ProductForm";
import { PageHeader } from "@/components/ui";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireRole("ADMIN");
  const product = await prisma.product.findFirst({ where: { id, orgId: ctx.orgId } });
  if (!product) notFound();
  return (<><PageHeader title={`Producto: ${product.name}`} /><ProductForm action={saveProduct.bind(null, id)} product={product} /></>);
}
