import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "pc-monitor-session";
const SESSION_SECONDS = 60 * 60 * 12;

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET harus diatur dan minimal 32 karakter.");
  return value;
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, exp: Date.now() + SESSION_SECONDS * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token?: string | null) {
  if (!token) return false;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return false;
  const expected = signature(payload);
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as { email: string; exp: number };
    return decoded.email === process.env.ADMIN_EMAIL && decoded.exp > Date.now();
  } catch { return false; }
}

export async function isAuthenticated() {
  return verifySession((await cookies()).get(COOKIE_NAME)?.value);
}

export async function requireApiAuth() {
  if (await isAuthenticated()) return null;
  return NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 });
}

export const sessionCookie = COOKIE_NAME;
export const sessionMaxAge = SESSION_SECONDS;
