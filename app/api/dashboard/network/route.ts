import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusFor } from "@/lib/monitoring";
export async function GET() {
  const denied = await requireApiAuth(); if (denied) return denied;
  try {
    const devices = await db.device.findMany({ where: { isActive: true }, select: { id: true, name: true, location: true, lastSeenAt: true } });
    const ids = devices.map((d) => d.id);
    const [checks, measurements, settings, failedTests] = await Promise.all([
      db.connectivityCheck.findMany({ where: { deviceId: { in: ids } }, distinct: ["deviceId"], orderBy: { checkedAt: "desc" } }),
      db.networkMeasurement.findMany({ where: { deviceId: { in: ids } }, distinct: ["deviceId"], orderBy: { completedAt: "desc" }, select: { deviceId: true, downloadMbps: true, uploadMbps: true, latencyMs: true, jitterMs: true, packetLossPercent: true, status: true, completedAt: true } }),
      db.networkSettings.findMany({ where: { deviceId: { in: ids } } }),
      db.networkMeasurement.count({ where: { deviceId: { in: ids }, status: "failed", completedAt: { gte: new Date(Date.now() - 24 * 3600000) } } }),
    ]);
    const checkBy = new Map(checks.map((x) => [x.deviceId, x])); const measureBy = new Map(measurements.map((x) => [x.deviceId, x])); const settingBy = new Map(settings.map((x) => [x.deviceId!, x]));
    const rows = devices.map((device) => {
      const check = checkBy.get(device.id); const measurement = measureBy.get(device.id); const s = settingBy.get(device.id);
      const agent = statusFor({ isActive: true, lastSeenAt: device.lastSeenAt });
      const stale = !check || Date.now() - check.checkedAt.getTime() > 5 * 60000;
      let internet = stale ? "unknown" : check.internetReachable ? "normal" : check.status === "internet_down" ? "internet_down" : "unknown";
      if (internet === "normal" && measurement?.status === "success") {
        if ((measurement.jitterMs ?? 0) > (s?.highJitterThresholdMs ?? 30) || (measurement.packetLossPercent ?? 0) > (s?.highPacketLossThresholdPercent ?? 3)) internet = "unstable";
        else if ((measurement.downloadMbps ?? Infinity) < (s?.slowDownloadThresholdMbps ?? 5) || (measurement.uploadMbps ?? Infinity) < (s?.slowUploadThresholdMbps ?? 1)) internet = "slow";
        else if ((measurement.latencyMs ?? 0) > (s?.highLatencyThresholdMs ?? 150)) internet = "high_latency";
      }
      return { id: device.id, name: device.name, location: device.location, agent, internet, apiReachable: stale ? null : check.apiReachable, measurement };
    });
    return NextResponse.json({ rows, counts: { total: devices.length, normal: rows.filter((x) => x.internet === "normal").length, slow: rows.filter((x) => ["slow", "unstable", "high_latency"].includes(x.internet)).length, down: rows.filter((x) => x.internet === "internet_down").length, agentOffline: rows.filter((x) => x.agent === "OFFLINE").length, speedTestFailed: failedTests } });
  } catch { return NextResponse.json({ error: "Ringkasan jaringan belum dapat dimuat." }, { status: 503 }); }
}
