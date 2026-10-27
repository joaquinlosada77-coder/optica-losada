import { requireContext } from "@/server/auth";
import { logout } from "@/server/session-actions";
import { ROLE_LABEL } from "@/lib/labels";
import { Nav } from "@/components/Nav";
import { BranchSwitcher } from "@/components/BranchSwitcher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-slate-900 p-4 md:flex">
        <div className="mb-6 px-3">
          <div className="text-lg font-semibold text-white">◉ {ctx.orgName}</div>
          <div className="text-xs text-slate-400">Gestión de ópticas</div>
        </div>
        <Nav isAdmin={ctx.user.role === "ADMIN"} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <BranchSwitcher branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))} current={ctx.branch.id} />
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <div className="font-medium">{ctx.user.name}</div>
              <div className="text-xs text-slate-500">{ROLE_LABEL[ctx.user.role]}</div>
            </div>
            <form action={logout}>
              <button className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">Salir</button>
            </form>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
