// src/lib/session.ts — sesión firmada HMAC (cookie httpOnly), sin dependencias externas
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { cache } from "react";

const COOKIE = "rst";
const secret = () => process.env.APP_SECRET || process.env.AUTH_SECRET || "restosuite-dev-secret";

export type SessionPayload = { uid: string; email: string; name: string; role: string; displayName?: string; tenantId?: string; slug?: string; exp: number };

function b64url(b: Buffer): string { return b.toString("base64url"); }
function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createToken(p: Omit<SessionPayload, "exp">, days = 7): string {
  const payload: SessionPayload = { ...p, exp: Date.now() + days * 86400000 };
  const data = b64url(Buffer.from(JSON.stringify(payload)));
  return `${data}.${sign(data)}`;
}

export function verifyToken(token?: string): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifyToken(store.get(COOKIE)?.value);
}

// Sesión cacheada por request para Server Components
export const requireUser = cache(async (roles?: string[]) => {
  const s = await getSession();
  if (!s || (roles && !roles.includes(s.role))) return null;
  return s;
});

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

// --- Identidad del CLIENTE (cookie de pedido en curso): evita/restringe doble pedido (Art. IV) ---
export const CLIENT_COOKIE = (tenant: string) => `rst_ord_${tenant}`;

export async function getClientOrderCode(tenantSlug: string): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CLIENT_COOKIE(tenantSlug))?.value;
  if (!value) return null;
  return verifyToken(value)?.slug ?? null; // guardamos el código firmado
}

export async function setClientOrderCode(tenantSlug: string, code: string) {
  const store = await cookies();
  const token = b64url(Buffer.from(JSON.stringify({ slug: code, exp: Date.now() + 86400000 })));
  store.set(CLIENT_COOKIE(tenantSlug), `${token}.${sign(token)}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86400 });
}

export async function clearClientOrderCode(tenantSlug: string) {
  const store = await cookies();
  store.delete(CLIENT_COOKIE(tenantSlug));
}
