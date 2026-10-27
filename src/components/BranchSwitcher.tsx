"use client";

import { usePathname } from "next/navigation";
import { switchBranch } from "@/server/session-actions";

export function BranchSwitcher({ branches, current }: { branches: { id: string; name: string }[]; current: string }) {
  const path = usePathname();
  if (branches.length < 2) {
    return <span className="text-sm font-medium text-slate-700">{branches[0]?.name}</span>;
  }
  return (
    <form action={switchBranch}>
      <input type="hidden" name="returnTo" value={path} />
      <label className="flex items-center gap-2 text-sm">
        <span className="text-slate-500">Sucursal</span>
        <select
          name="branchId"
          defaultValue={current}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-medium"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
