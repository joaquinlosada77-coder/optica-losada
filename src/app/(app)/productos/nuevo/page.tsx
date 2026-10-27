import { requireRole } from "@/server/auth";
import { saveProduct } from "@/server/products";
import { ProductForm } from "@/components/ProductForm";
import { PageHeader } from "@/components/ui";

export default async function NewProductPage() {
  await requireRole("ADMIN");
  return (<><PageHeader title="Nuevo producto" /><ProductForm action={saveProduct.bind(null, null)} /></>);
}
