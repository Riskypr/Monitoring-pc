import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashAgentToken } from "@/lib/monitoring";
const schema = z.object({ status: z.enum(["completed", "failed"]), result: z.unknown().optional() }).strict();
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (token.length < 24 || token.length > 200 || !parsed.success) return NextResponse.json({ error: "Request tidak valid." }, { status: 400 });
  const { id } = await context.params;
  try {
    const device = await db.device.findUnique({ where: { tokenHash: hashAgentToken(token) }, select: { id: true, isActive: true } });
    if (!device?.isActive) return NextResponse.json({ error: "Token tidak valid." }, { status: 401 });
    const command = await db.agentCommand.findFirst({ where: { id, deviceId: device.id } });
    if (!command) return NextResponse.json({ error: "Command tidak ditemukan." }, { status: 404 });
    if (command.expiresAt < new Date()) { await db.agentCommand.update({ where: { id }, data: { status: "expired" } }); return NextResponse.json({ error: "Command kedaluwarsa." }, { status: 410 }); }
    await db.agentCommand.update({ where: { id }, data: { status: parsed.data.status, result: parsed.data.result as object | undefined, completedAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Hasil command belum dapat disimpan." }, { status: 503 }); }
}
