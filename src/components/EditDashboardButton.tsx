"use client";

import { useState } from "react";
import type { WidgetKey } from "@/lib/dashboard";
import { DashboardEditor } from "@/components/DashboardEditor";
import { Button } from "@/components/ui";

export function EditDashboard({ current, allowed }: { current: WidgetKey[]; allowed: WidgetKey[] }) {
  const [open, setOpen] = useState(false);
  if (!open) return <Button variant="ghost" onClick={() => setOpen(true)}>⚙ Editar panel</Button>;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/40 p-4 pt-[8vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <DashboardEditor current={current} allowed={allowed} onDone={() => setOpen(false)} />
      </div>
    </div>
  );
}
