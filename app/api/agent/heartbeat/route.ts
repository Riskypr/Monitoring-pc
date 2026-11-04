import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashAgentToken, isValidIp, publicIpFromRequest, statusFor } from "@/lib/monitoring";

const schema = z.object({
  localIp: z.string().max(45).optional().nullable(),
  ramUsagePct: z.number().min(0).max(100).optional().nullable(),
  ramUsedGB: z.number().min(0).optional().nullable(),
  ramTotalGB: z.number().min(0).optional().nullable(),
  diskUsagePct: z.number().min(0).max(100).optional().nullable(),
  diskFreeGB: z.number().min(0).optional().nullable(),
  diskTotalGB: z.number().min(0).optional().nullable(),
  latencyMs: z.number().int().min(0).max(60000).optional().nullable(),
}).strict();
export async function POST(request: Request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (token.length < 24 || token.length > 200) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  const tokenHash = hashAgentToken(token);
  let body: unknown;
  try {
    const length = Number(request.headers.get("content-length") || 0);
    if (length > 2048) return NextResponse.json({ error: "Request terlalu besar." }, { status: 413 });
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2048) return NextResponse.json({ error: "Request terlalu besar." }, { status: 413 });
    body = JSON.parse(raw);
  } catch { return NextResponse.json({ error: "Body JSON tidak valid." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success || (parsed.data.localIp && !isValidIp(parsed.data.localIp))) return NextResponse.json({ error: "Format heartbeat tidak valid." }, { status: 400 });

  try {
    const device = await db.device.findUnique({ where: { tokenHash }, select: { id: true, isActive: true, lastSeenAt: true } });
    if (!device || !device.isActive) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
    if (device.lastSeenAt && Date.now() - device.lastSeenAt.getTime() < 5_000) return NextResponse.json({ error: "Heartbeat terlalu sering." }, { status: 429 });
    const beforeStatus = statusFor(device);
    const receivedAt = new Date();
    const publicIp = publicIpFromRequest(request);
    const { localIp, ramUsagePct, ramUsedGB, ramTotalGB, diskUsagePct, diskFreeGB, diskTotalGB, latencyMs } = parsed.data;
    await db.$transaction([
      db.heartbeat.create({
        data: {
          deviceId: device.id,
          localIp: localIp || null,
          publicIp,
          ramUsagePct: ramUsagePct ?? null,
          diskFreeGB: diskFreeGB ?? null,
          latencyMs: latencyMs ?? null,
          receivedAt,
        },
      }),
      db.device.update({
        where: { id: device.id },
        data: {
          lastLocalIp: localIp || null,
          ...(publicIp ? { lastPublicIp: publicIp } : {}),
          ...(ramUsagePct !== undefined ? { ramUsagePct } : {}),
          ...(ramUsedGB !== undefined ? { ramUsedGB } : {}),
          ...(ramTotalGB !== undefined ? { ramTotalGB } : {}),
          ...(diskUsagePct !== undefined ? { diskUsagePct } : {}),
          ...(diskFreeGB !== undefined ? { diskFreeGB } : {}),
          ...(diskTotalGB !== undefined ? { diskTotalGB } : {}),
          ...(latencyMs !== undefined ? { latencyMs } : {}),
          lastSeenAt: receivedAt,
        },
      }),
      ...(beforeStatus !== "ONLINE" ? [db.statusEvent.create({ data: { deviceId: device.id, status: "ONLINE", occurredAt: receivedAt, reason: "Heartbeat diterima" } })] : []),
    ]);
    return NextResponse.json({ ok: true, receivedAt: receivedAt.toISOString() });
  } catch (error) {
    console.error("Gagal menyimpan heartbeat:", error);
    return NextResponse.json({ error: "Heartbeat belum dapat disimpan." }, { status: 503 });
  }
}
