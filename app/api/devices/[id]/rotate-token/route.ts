import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashAgentToken, issueAgentToken } from "@/lib/monitoring";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  const { id } = await context.params;
  const token = issueAgentToken();
  try {
    await db.device.update({ where: { id }, data: { tokenHash: hashAgentToken(token) } });
    await db.auditLog.create({ data: { actorId: process.env.ADMIN_EMAIL || "admin", action: "DEVICE_TOKEN_ROTATED", entityId: id } });
    return NextResponse.json({ token });
  } catch { return NextResponse.json({ error: "Token gagal diganti." }, { status: 404 }); }
}
