import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusFor, syncStatusEvents } from "@/lib/monitoring";

export async function GET() {
  const denied = await requireApiAuth();
  if (denied) return denied;
  try {
    const devices = await db.device.findMany({ select: { id: true, isActive: true, lastSeenAt: true } });
    await syncStatusEvents(devices);
    const counts = { total: devices.length, active: 0, online: 0, offline: 0, neverOnline: 0, inactive: 0 };
    for (const device of devices) {
      const status = statusFor(device);
      if (device.isActive) counts.active++;
      if (status === "ONLINE") counts.online++;
      if (status === "OFFLINE") counts.offline++;
      if (status === "NEVER_ONLINE") counts.neverOnline++;
      if (status === "INACTIVE") counts.inactive++;
    }
    const availability = counts.active ? Math.round((counts.online / counts.active) * 100) : 0;
    return NextResponse.json({ ...counts, availability, updatedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "Statistik belum dapat dimuat." }, { status: 503 });
  }
}
