import { compare } from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSession, sessionCookie, sessionMaxAge } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedEmail || !expectedPassword || !process.env.AUTH_SECRET) {
      return NextResponse.json({ error: "Konfigurasi admin belum lengkap. Periksa environment variables." }, { status: 503 });
    }
    if (process.env.AUTH_SECRET.length < 32) return NextResponse.json({ error: "AUTH_SECRET harus berisi minimal 32 karakter." }, { status: 503 });
    const passwordIsHash = expectedPassword.startsWith("$2");
    const validPassword = passwordIsHash
      ? await compare(password, expectedPassword)
      : password.length === expectedPassword.length && timingSafeEqual(Buffer.from(password), Buffer.from(expectedPassword));
    if (email !== expectedEmail || !validPassword) return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookie, createSession(email), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", maxAge: sessionMaxAge,
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Permintaan login tidak valid." }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
