import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";

const settingsSchema = z.object({ connectivityIntervalSeconds: z.number().int().min(30).max(3600).optional(), speedTestIntervalMinutes: z.number().int().min(15).max(1440).optional(), speedTestEnabled: z.boolean().optional(), testDurationSeconds: z.number().int().min(5).max(30).optional(), parallelStreams: z.number().int().min(1).max(8).optional(), slowDownloadThresholdMbps: z.number().min(0).max(100000).optional(), slowUploadThresholdMbps: z.number().min(0).max(100000).optional(), highLatencyThresholdMs: z.number().min(1).max(60000).optional(), highJitterThresholdMs: z.number().min(1).max(60000).optional(), highPacketLossThresholdPercent: z.number().min(0).max(100).optional(), consecutiveFailuresBeforeDown: z.number().int().min(2).max(20).optional() }).strict();
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth(); if (denied) return denied;
  const { id } = await context.params;
  try {
    const device = await db.device.findUnique({ where: { id }, select: { id: true } });
    if (!device) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    const [measurement, connectivity, settings, command, history, incidents] = await Promise.all([
      db.networkMeasurement.findFirst({ where: { deviceId: id }, orderBy: { completedAt: "desc" } }),
      db.connectivityCheck.findFirst({ where: { deviceId: id }, orderBy: { checkedAt: "desc" } }),
      db.networkSettings.upsert({ where: { deviceId: id }, create: { deviceId: id }, update: {} }),
      db.agentCommand.findFirst({ where: { deviceId: id, commandType: { in: ["RUN_SPEEDTEST", "RUN_IPERF_TEST"] }, status: { in: ["queued", "running"] }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
      db.networkMeasurement.findMany({ where: { deviceId: id, completedAt: { gte: new Date(Date.now() - 7 * 86400000) } }, orderBy: { completedAt: "desc" }, take: 100 }),
      db.networkIncident.findMany({ where: { deviceId: id }, orderBy: { startedAt: "desc" }, take: 20 }),
    ]);
    const server = process.env.IPERF2_SERVER_HOST ? { id: process.env.IPERF2_SERVER_ID || "default", name: process.env.IPERF2_SERVER_NAME || "iPerf2 server", host: process.env.IPERF2_SERVER_HOST, port: Number(process.env.IPERF2_SERVER_PORT || 5001), region: process.env.IPERF2_SERVER_REGION || null } : null;
    return NextResponse.json({ measurement, connectivity, settings, command, history: history.reverse(), incidents, server });
  } catch { return NextResponse.json({ error: "Data jaringan belum dapat dimuat." }, { status: 503 }); }
}
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth(); if (denied) return denied;
  const { id } = await context.params; const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return NextResponse.json({ error: "Pengaturan jaringan tidak valid." }, { status: 400 });
  try {
    if (!await db.device.findUnique({ where: { id }, select: { id: true } })) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    const settings = await db.networkSettings.upsert({ where: { deviceId: id }, create: { deviceId: id, ...parsed.data }, update: parsed.data });
    await db.agentCommand.create({ data: { deviceId: id, commandType: "UPDATE_SETTINGS", payload: parsed.data, expiresAt: new Date(Date.now() + 10 * 60_000), requestedBy: process.env.ADMIN_EMAIL || "admin" } });
    await db.auditLog.create({ data: { actorId: process.env.ADMIN_EMAIL || "admin", action: "NETWORK_SETTINGS_UPDATED", entityId: id, metadata: parsed.data } });
    return NextResponse.json({ ok: true, settings });
  } catch { return NextResponse.json({ error: "Pengaturan gagal disimpan." }, { status: 503 }); }
}
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth(); if (denied) return denied;
  const { id } = await context.params;
  try {
    const device = await db.device.findUnique({ where: { id }, select: { id: true } });
    if (!device) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    const active = await db.agentCommand.findFirst({ where: { deviceId: id, commandType: { in: ["RUN_SPEEDTEST", "RUN_IPERF_TEST"] }, status: { in: ["queued", "running"] }, expiresAt: { gt: new Date() } } });
    if (active) return NextResponse.json({ command: active, duplicate: true });
    if (!process.env.IPERF2_SERVER_HOST) return NextResponse.json({ error: "Host iPerf2 server belum dikonfigurasi." }, { status: 503 });
    const settings = await db.networkSettings.upsert({ where: { deviceId: id }, create: { deviceId: id }, update: {} });
    const payload = { serverId: process.env.IPERF2_SERVER_ID || "default", serverName: process.env.IPERF2_SERVER_NAME || "iPerf2 server", serverHost: process.env.IPERF2_SERVER_HOST, serverPort: Number(process.env.IPERF2_SERVER_PORT || 5001), serverRegion: process.env.IPERF2_SERVER_REGION || null, durationSeconds: settings.testDurationSeconds, parallelStreams: settings.parallelStreams };
    const command = await db.agentCommand.create({ data: { deviceId: id, commandType: "RUN_IPERF_TEST", payload, expiresAt: new Date(Date.now() + 10 * 60_000), requestedBy: process.env.ADMIN_EMAIL || "admin" } });
    await db.auditLog.create({ data: { actorId: process.env.ADMIN_EMAIL || "admin", action: "NETWORK_IPERF_TEST_REQUESTED", entityId: id, metadata: { commandId: command.id } } });
    return NextResponse.json({ command }, { status: 202 });
  } catch { return NextResponse.json({ error: "Speed test tidak dapat dijadwalkan." }, { status: 503 }); }
}
