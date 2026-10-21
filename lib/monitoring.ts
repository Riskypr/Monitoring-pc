import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import type { DeviceStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const OFFLINE_AFTER_SECONDS = 180;
export const HEARTBEAT_INTERVAL_SECONDS = 60;

export function statusFor(device: { isActive: boolean; lastSeenAt: Date | null }, now = Date.now()): DeviceStatus {
  if (!device.isActive) return "INACTIVE";
  if (!device.lastSeenAt) return "NEVER_ONLINE";
  return now - device.lastSeenAt.getTime() <= OFFLINE_AFTER_SECONDS * 1000 ? "ONLINE" : "OFFLINE";
}

export function issueAgentToken() {
  return `pcmon_${randomBytes(32).toString("base64url")}`;
}

export function hashAgentToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidIp(value: unknown): value is string {
  return typeof value === "string" && value.length <= 45 && isIP(value) !== 0;
}

export function publicIpFromRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = request.headers.get("x-real-ip")?.trim() || forwarded;
  return isValidIp(candidate) ? candidate : null;
}

export function statusLabel(status: DeviceStatus) {
  return ({ ONLINE: "Online", OFFLINE: "Offline", NEVER_ONLINE: "Belum online", INACTIVE: "Nonaktif" })[status];
}

export async function syncStatusEvents(devices: { id: string; isActive: boolean; lastSeenAt: Date | null }[]) {
  const activeDevices = devices.filter((device) => device.isActive);
  if (!activeDevices.length) return;
  const events = await db.statusEvent.findMany({
    where: { deviceId: { in: activeDevices.map((device) => device.id) } },
    orderBy: { occurredAt: "desc" },
    distinct: ["deviceId"],
    select: { deviceId: true, status: true },
  });
  const lastStatus = new Map(events.map((event) => [event.deviceId, event.status]));
  const now = new Date();
  const transitions = activeDevices.filter((device) => {
    const actual = statusFor(device, now.getTime());
    return lastStatus.get(device.id) !== actual;
  });
  if (transitions.length) await db.statusEvent.createMany({
    data: transitions.map((device) => ({ deviceId: device.id, status: statusFor(device, now.getTime()), occurredAt: now, reason: statusFor(device, now.getTime()) === "OFFLINE" ? "Heartbeat melewati batas 180 detik" : "Status perangkat berubah" })),
  });
}
