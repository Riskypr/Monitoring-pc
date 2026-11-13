import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashAgentToken } from "@/lib/monitoring";
export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (token.length < 24 || token.length > 200) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
  try {
    const device = await db.device.findUnique({ where: { tokenHash: hashAgentToken(token) }, select: { id: true, isActive: true } });
    if (!device?.isActive) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
    const now = new Date();
    await db.agentCommand.updateMany({ where: { deviceId: device.id, status: { in: ["queued", "running"] }, expiresAt: { lt: now } }, data: { status: "expired" } });
    const command = await db.agentCommand.findFirst({ where: { deviceId: device.id, status: "queued", expiresAt: { gt: now } }, orderBy: { createdAt: "asc" } });
    const settings = await db.networkSettings.findFirst({ where: { deviceId: device.id } });
    const iperfServer = process.env.IPERF2_SERVER_HOST ? { id: process.env.IPERF2_SERVER_ID || "default", name: process.env.IPERF2_SERVER_NAME || "iPerf2 server", host: process.env.IPERF2_SERVER_HOST, port: Number(process.env.IPERF2_SERVER_PORT || 5001), region: process.env.IPERF2_SERVER_REGION || null } : null;
    if (!command) return NextResponse.json({ command: null, settings, iperfServer });
    const claimed = await db.agentCommand.updateMany({ where: { id: command.id, status: "queued" }, data: { status: "running" } });
    return NextResponse.json({ command: claimed.count ? { id: command.id, commandType: command.commandType, payload: command.payload, expiresAt: command.expiresAt } : null, settings, iperfServer });
  } catch { return NextResponse.json({ error: "Command belum dapat diambil." }, { status: 503 }); }
}
