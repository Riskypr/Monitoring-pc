import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = await db.heartbeat.deleteMany({ where: { receivedAt: { lt: cutoff } } });
    return NextResponse.json({ ok: true, deletedHeartbeats: result.count, retainedSince: cutoff.toISOString() });
  } catch { return NextResponse.json({ error: "Retention belum dapat dijalankan." }, { status: 503 }); }
}
