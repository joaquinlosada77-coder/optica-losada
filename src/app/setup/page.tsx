import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { GESVISION_BRANCHES } from "@/lib/setup-branches";
import { SetupForm } from "./SetupForm";

export const metadata: Metadata = { title: "Primera configuración" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const configured = (await prisma.organization.count()) > 0;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Primera configuración</h1>
      {configured ? (
        <p className="mt-4 text-slate-600">
          El sistema ya está configurado. <Link className="text-brand-600 underline" href="/login">Ingresar</Link>
        </p>
      ) : !process.env.SETUP_TOKEN ? (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-900">
          Falta la variable <b>SETUP_TOKEN</b> en el servidor. Agrégala en Vercel → Settings → Environment Variables y vuelve a desplegar.
        </p>
      ) : (
        <>
          <p className="mb-6 text-slate-600">Crea tu empresa y tu usuario. Esta pantalla deja de funcionar apenas termines.</p>
          <SetupForm branchNames={GESVISION_BRANCHES.filter((b) => b.active).map((b) => b.name)} />
        </>
      )}
    </main>
  );
}
