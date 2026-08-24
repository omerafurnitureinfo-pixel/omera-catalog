import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { sessions, users } from "../../db/schema";

export type Role = "engineer" | "factory" | "accountant";

export const ROLE_LABELS: Record<Role, string> = {
  engineer: "قسم المهندس",
  factory: "قسم المصنع",
  accountant: "قسم المحاسبة",
};

export const isRole = (value: unknown): value is Role =>
  value === "engineer" || value === "factory" || value === "accountant";

export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: Role;
};

const SESSION_COOKIE = "omera_session";
const SESSION_DAYS = 30;

/* ---------------- تشفير كلمات المرور (Web Crypto — بدون أي حزمة خارجية) ---------------- */

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++) arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password: string, saltHex: string, expectedHashHex: string): Promise<boolean> {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  return diff === 0;
}

function randomToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

/* ---------------- الجلسات ---------------- */

export async function createSession(userId: number): Promise<{ token: string; expiresAt: string }> {
  const db = getDb();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, token));
}

// الكوكيز بلا Expires عمدًا (كوكيز جلسة متصفح): تنتهي تلقائيًا عند إغلاق
// المتصفح فيُطلب تسجيل الدخول من جديد. صلاحية الجلسة في القاعدة (expiresAt)
// تبقى سقفًا أقصى من جهة الخادم فقط.
export function sessionCookieHeader(token: string, _expiresAt: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

async function loadSessionUser(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const db = getDb();
  const [session] = await db.select().from(sessions).where(eq(sessions.id, token)).limit(1);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;
  return { id: user.id, username: user.username, displayName: user.displayName, role: user.role as Role };
}

/** يُستخدم داخل Server Components (يقرأ الكوكيز عبر next/headers). */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  const token = parseCookie(requestHeaders.get("cookie"), SESSION_COOKIE);
  return loadSessionUser(token);
}

/** يُستخدم داخل Route Handlers (يقرأ الكوكيز من الطلب مباشرة). */
export async function getSessionUserFromRequest(request: Request): Promise<SessionUser | null> {
  const token = parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
  return loadSessionUser(token);
}

export function getSessionTokenFromRequest(request: Request): string | null {
  return parseCookie(request.headers.get("cookie"), SESSION_COOKIE);
}
