"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { BRANCH_COOKIE, SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { requireContext } from "@/server/auth";
import type { FormState } from "@/server/form";

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "/");

  const user = await prisma.user.findUnique({ where: { email } });
  // Comparamos siempre para no filtrar por tiempo si el correo existe
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!user || !user.active || !ok) return { error: "Correo o contraseña incorrectos." };

  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession({ uid: user.id, org: user.orgId }), sessionCookieOptions);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function switchBranch(fd: FormData) {
  const ctx = await requireContext();
  const id = String(fd.get("branchId") ?? "");
  if (ctx.branches.some((b) => b.id === id)) {
    const jar = await cookies();
    jar.set(BRANCH_COOKIE, id, { ...sessionCookieOptions, maxAge: 60 * 60 * 24 * 365 });
  }
  redirect(String(fd.get("returnTo") ?? "/"));
}
