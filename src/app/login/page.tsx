import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-2xl text-white">◉</div>
          <h1 className="text-xl font-semibold">Gestión de Ópticas</h1>
          <p className="text-sm text-slate-500">Ingresa con tu cuenta</p>
        </div>
        {error === "sin-sucursal" && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Tu usuario no tiene sucursales asignadas. Contacta al administrador.</p>
        )}
        <LoginForm next={next ?? "/"} />
      </div>
    </main>
  );
}
