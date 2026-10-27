"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { allowedWidgets, isWidgetKey } from "@/lib/dashboard";
import { requireContext } from "@/server/auth";

export async function saveDashboard(keys: string[]): Promise<{ ok: boolean }> {
  const ctx = await requireContext();
  const allowed = allowedWidgets(ctx.user.role === "ADMIN");
  const clean = [...new Set(keys)].filter(isWidgetKey).filter((k) => allowed.includes(k));
  await prisma.user.update({ where: { id: ctx.user.id }, data: { dashboardWidgets: clean.length ? clean : ["agenda"] } });
  revalidatePath("/");
  return { ok: true };
}

export async function resetDashboard(): Promise<{ ok: boolean }> {
  const ctx = await requireContext();
  await prisma.user.update({ where: { id: ctx.user.id }, data: { dashboardWidgets: [] } });
  revalidatePath("/");
  return { ok: true };
}
