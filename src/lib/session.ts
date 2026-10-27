// Sesión firmada (JWT HS256) en cookie httpOnly. Compatible con el runtime edge del middleware.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "optica_session";
export const BRANCH_COOKIE = "optica_branch";
const MAX_AGE_SECONDS = 60 * 60 * 12; // jornada laboral

export type SessionPayload = { uid: string; org: string };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET debe tener al menos 32 caracteres");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.org !== "string") return null;
    return { uid: payload.uid, org: payload.org };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
