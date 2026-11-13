import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashAgentToken } from "@/lib/monitoring";

const metric = z.number().finite().min(0).max(1_000_000).nullable().optional();
const schema = z.object({
  downloadMbps: metric, uploadMbps: metric, latencyMs: metric, jitterMs: metric,
  packetLossPercent: z.number().min(0).max(100).nullable().optional(),
  serverId: z.string().max(100).nullable().optional(), serverName: z.string().max(200).nullable().optional(),
  serverRegion: z.string().max(100).nullable().optional(), protocol: z.enum(["TCP", "UDP"]).optional(),
  durationSeconds: z.number().int().min(1).max(120).nullable().optional(), parallelStreams: z.number().int().min(1).max(16).nullable().optional(),
  udpTargetMbps: metric, clientVersion: z.string().max(100).nullable().optional(), serverVersion: z.string().max(100).nullable().optional(),
  rawSummary: z.string().max(12000).nullable().optional(),
  publicIp: z.string().max(45).nullable().optional(), ooklaVersion: z.string().max(100).nullable().optional(),
  status: z.enum(["success", "failed"]), errorMessage: z.string().max(2000).nullable().optional(),
  startedAt: z.string().datetime().nullable().optional(), completedAt: z.string().datetime().optional(),
  commandId: z.string().max(100).optional(), requestId: z.string().uuid().optional(),
}).strict();

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token.length < 24 || token.length > 200) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const raw = await request.text().catch(() => "");
  if (Buffer.byteLength(raw, "utf8") > 8192) return NextResponse.json({ error: "Request terlalu besar." }, { status: 413 });
  const parsed = schema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!parsed.success) return NextResponse.json({ error: "Format hasil speed test tidak valid." }, { status: 400 });
  try {
    const device = await db.device.findUnique({ where: { tokenHash: hashAgentToken(token) }, select: { id: true, isActive: true } });
    if (!device?.isActive) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
    const d = parsed.data;
    if (d.requestId) {
      const prior = await db.networkMeasurement.findUnique({ where: { requestId: d.requestId }, select: { id: true, deviceId: true } });
      if (prior?.deviceId === device.id) {
        if (d.commandId) await db.agentCommand.updateMany({ where: { id: d.commandId, deviceId: device.id, status: { in: ["running", "expired"] } }, data: { status: d.status === "success" ? "completed" : "failed", completedAt: new Date(), result: { measurementId: prior.id } } });
        return NextResponse.json({ ok: true, duplicate: true });
      }
      if (prior) return NextResponse.json({ error: "Request ID tidak valid." }, { status: 409 });
    }
    if (d.commandId) {
      const prior = await db.networkMeasurement.findUnique({ where: { commandId: d.commandId }, select: { id: true, deviceId: true } });
      if (prior?.deviceId === device.id) {
        await db.agentCommand.updateMany({ where: { id: d.commandId, deviceId: device.id, status: { in: ["running", "expired"] } }, data: { status: d.status === "success" ? "completed" : "failed", completedAt: new Date(), result: { measurementId: prior.id } } });
        return NextResponse.json({ ok: true, duplicate: true });
      }
      if (prior) return NextResponse.json({ error: "Command ID tidak valid." }, { status: 409 });
      // Accept queued results from agents running the previous iPerf2 build so their local retry queue can drain after upgrade.
      const command = await db.agentCommand.findFirst({ where: { id: d.commandId, deviceId: device.id, commandType: { in: ["RUN_SPEEDTEST", "RUN_IPERF_TEST"] }, status: { in: ["running", "expired"] } }, select: { id: true, expiresAt: true } });
      if (!command) return NextResponse.json({ error: "Command tidak aktif atau kedaluwarsa." }, { status: 409 });
      if (!d.startedAt || new Date(d.startedAt) > command.expiresAt) return NextResponse.json({ error: "Speed test dimulai setelah command kedaluwarsa." }, { status: 409 });
    }
    const measurement = await db.networkMeasurement.create({ data: {
      deviceId: device.id, commandId: d.commandId ?? null, requestId: d.requestId ?? null,
      downloadMbps: d.downloadMbps ?? null, uploadMbps: d.uploadMbps ?? null, latencyMs: d.latencyMs ?? null,
      jitterMs: d.jitterMs ?? null, packetLossPercent: d.packetLossPercent ?? null,
      serverId: d.serverId ?? null, serverName: d.serverName ?? null, publicIp: d.publicIp ?? null,
      ooklaVersion: d.ooklaVersion ?? null, status: d.status,
      errorMessage: d.errorMessage ?? null, startedAt: d.startedAt ? new Date(d.startedAt) : null,
      completedAt: d.completedAt ? new Date(d.completedAt) : new Date(),
    } });
    if (d.status === "success") {
      const settings = await db.networkSettings.findFirst({ where: { deviceId: device.id } });
      const recent = await db.networkMeasurement.findMany({ where: { deviceId: device.id, status: "success" }, orderBy: { completedAt: "desc" }, take: 3 });
      const repeatedlyDegraded = recent.length === 3 && recent.every((item) =>
        (item.downloadMbps !== null && item.downloadMbps < (settings?.slowDownloadThresholdMbps ?? 5)) ||
        (item.uploadMbps !== null && item.uploadMbps < (settings?.slowUploadThresholdMbps ?? 1)) ||
        (item.latencyMs !== null && item.latencyMs > (settings?.highLatencyThresholdMs ?? 150)) ||
        (item.jitterMs !== null && item.jitterMs > (settings?.highJitterThresholdMs ?? 30)) ||
        (item.packetLossPercent !== null && item.packetLossPercent > (settings?.highPacketLossThresholdPercent ?? 3))
      );
      const open = await db.networkIncident.findFirst({ where: { deviceId: device.id, category: "NETWORK_DEGRADED", recoveredAt: null }, orderBy: { startedAt: "desc" } });
      if (repeatedlyDegraded && !open) await db.networkIncident.create({ data: { deviceId: device.id, category: "NETWORK_DEGRADED", summary: "Tiga hasil speed test valid berturut-turut melewati threshold jaringan.", startedAt: measurement.completedAt } });
      if (!repeatedlyDegraded && open) await db.networkIncident.update({ where: { id: open.id }, data: { recoveredAt: measurement.completedAt, durationSeconds: Math.max(0, Math.floor((measurement.completedAt.getTime() - open.startedAt.getTime()) / 1000)) } });
    }
    if (d.commandId) await db.agentCommand.updateMany({ where: { id: d.commandId, deviceId: device.id, status: { in: ["running", "expired"] } }, data: { status: d.status === "success" ? "completed" : "failed", completedAt: new Date(), result: { measurementId: measurement.id } } });
    return NextResponse.json({ ok: true, id: measurement.id });
  } catch { return NextResponse.json({ error: "Hasil speed test belum dapat disimpan." }, { status: 503 }); }
}
