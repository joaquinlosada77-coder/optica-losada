import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Archivos subidos para importar: viven en el disco temporal del servidor hasta confirmar
// (o 2 horas como máximo). Nunca se guardan en la base de datos ni en el repositorio.
const DIR = join(tmpdir(), "optica-importaciones");
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export async function saveUpload(orgId: string, data: ArrayBuffer): Promise<string> {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  await purgeOld();
  const token = randomUUID();
  await writeFile(pathFor(orgId, token), Buffer.from(data), { mode: 0o600 });
  return token;
}

export function pathFor(orgId: string, token: string): string {
  if (!/^[0-9a-f-]{36}$/.test(token) || !/^[a-z0-9]+$/i.test(orgId)) throw new Error("Token inválido");
  return join(DIR, `${orgId}_${token}.xlsx`);
}

export async function removeUpload(orgId: string, token: string) {
  await rm(pathFor(orgId, token), { force: true });
}

async function purgeOld() {
  const now = Date.now();
  for (const f of await readdir(DIR).catch(() => [])) {
    const p = join(DIR, f);
    const s = await stat(p).catch(() => null);
    if (s && now - s.mtimeMs > MAX_AGE_MS) await rm(p, { force: true });
  }
}
