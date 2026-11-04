import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { syncStatusEvents } from "@/lib/monitoring";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const days = Math.min(90, Math.max(1, Number(params.get("days")) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    const [device, heartbeats, events] = await Promise.all([
      db.device.findUnique({ where: { id }, select: { id: true, isActive: true, lastSeenAt: true } }),
      db.heartbeat.findMany({ where: { deviceId: id, receivedAt: { gte: since } }, orderBy: { receivedAt: "desc" }, take: 100,
        select: { id: true, localIp: true, publicIp: true, ramUsagePct: true, diskFreeGB: true, latencyMs: true, receivedAt: true } }),
      db.statusEvent.findMany({ where: { deviceId: id, occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" }, take: 100,
        select: { id: true, status: true, reason: true, occurredAt: true } }),
    ]);
    if (!device) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    await syncStatusEvents([device]);
    const refreshedEvents = await db.statusEvent.findMany({ where: { deviceId: id, occurredAt: { gte: since } }, orderBy: { occurredAt: "desc" }, take: 100, select: { id: true, status: true, reason: true, occurredAt: true } });
    return NextResponse.json({ heartbeats, events: refreshedEvents, days });
  } catch { return NextResponse.json({ error: "Riwayat belum dapat dimuat." }, { status: 503 }); }
}
