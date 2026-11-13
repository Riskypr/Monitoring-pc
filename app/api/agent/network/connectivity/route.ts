import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashAgentToken } from "@/lib/monitoring";

const schema = z.object({
  gatewayReachable: z.boolean().nullable().optional(), internetReachable: z.boolean(), apiReachable: z.boolean(), testServerReachable: z.boolean().nullable().optional(),
  latencyMs: z.number().min(0).max(60000).nullable().optional(), packetLossPercent: z.number().min(0).max(100).nullable().optional(),
  failedChecks: z.number().int().min(0).max(100).optional(), checkedAt: z.string().datetime().optional(),
}).strict();
export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token.length < 24 || token.length > 200) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const raw = await request.text().catch(() => "");
  if (Buffer.byteLength(raw, "utf8") > 4096) return NextResponse.json({ error: "Request terlalu besar." }, { status: 413 });
  const parsed = schema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!parsed.success) return NextResponse.json({ error: "Format connectivity check tidak valid." }, { status: 400 });
  try {
    const device = await db.device.findUnique({ where: { tokenHash: hashAgentToken(token) }, select: { id: true, isActive: true } });
    if (!device?.isActive) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
    const data = parsed.data;
    const [recent, settings] = await Promise.all([
      db.connectivityCheck.findFirst({ where: { deviceId: device.id }, orderBy: { checkedAt: "desc" }, select: { failedChecks: true } }),
      db.networkSettings.findFirst({ where: { deviceId: device.id } }),
    ]);
    const failed = data.internetReachable ? 0 : (recent?.failedChecks || 0) + 1;
    const status = !data.internetReachable
      ? failed >= (settings?.consecutiveFailuresBeforeDown || 3) ? "internet_down" : "unknown"
      : !data.apiReachable ? "api_unreachable"
      : data.testServerReachable === false ? "test_server_unreachable"
      : "connected";
    const check = await db.connectivityCheck.create({ data: { deviceId: device.id, gatewayReachable: data.gatewayReachable ?? null, internetReachable: data.internetReachable, apiReachable: data.apiReachable, testServerReachable: data.testServerReachable ?? null, latencyMs: data.latencyMs ?? null, packetLossPercent: data.packetLossPercent ?? null, failedChecks: data.failedChecks ?? failed, status, checkedAt: data.checkedAt ? new Date(data.checkedAt) : new Date() } });
    const now = check.checkedAt;
    for (const [category, active] of [["INTERNET_DOWN", status === "internet_down"], ["API_UNREACHABLE", data.internetReachable && !data.apiReachable], ["TEST_SERVER_UNREACHABLE", data.internetReachable && data.testServerReachable === false]] as const) {
      const open = await db.networkIncident.findFirst({ where: { deviceId: device.id, category, recoveredAt: null }, orderBy: { startedAt: "desc" } });
      if (active && !open) await db.networkIncident.create({ data: { deviceId: device.id, category, summary: category === "INTERNET_DOWN" ? `${failed} connectivity check berturut-turut gagal.` : category === "API_UNREACHABLE" ? "Internet umum terjangkau tetapi API PC Monitor gagal diakses." : "Internet umum terjangkau tetapi server iPerf2 gagal diakses.", startedAt: now } });
      if (!active && open) await db.networkIncident.update({ where: { id: open.id }, data: { recoveredAt: now, durationSeconds: Math.max(0, Math.floor((now.getTime() - open.startedAt.getTime()) / 1000)) } });
    }
    return NextResponse.json({ ok: true, id: check.id, status });
  } catch { return NextResponse.json({ error: "Connectivity check belum dapat disimpan." }, { status: 503 }); }
}
