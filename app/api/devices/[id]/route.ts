import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusFor } from "@/lib/monitoring";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  location: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const device = await db.device.findUnique({ where: { id }, select: {
      id: true, name: true, location: true, description: true, lastLocalIp: true, lastPublicIp: true, lastSeenAt: true,
      isActive: true, createdAt: true, updatedAt: true,
    } });
    if (!device) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ ...device, status: statusFor(device) });
  } catch { return NextResponse.json({ error: "Detail perangkat belum dapat dimuat." }, { status: 503 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success || Object.keys(parsed.data || {}).length === 0) return NextResponse.json({ error: "Data perubahan tidak valid." }, { status: 400 });
    const before = await db.device.findUnique({ where: { id }, select: { id: true, isActive: true, lastSeenAt: true } });
    if (!before) return NextResponse.json({ error: "Perangkat tidak ditemukan." }, { status: 404 });
    const updated = await db.device.update({ where: { id }, data: parsed.data });
    if (parsed.data.isActive !== undefined && parsed.data.isActive !== before.isActive) {
      await db.statusEvent.create({ data: { deviceId: id, status: statusFor(updated), reason: parsed.data.isActive ? "Perangkat diaktifkan" : "Dinonaktifkan oleh admin" } });
      await db.auditLog.create({ data: { actorId: process.env.ADMIN_EMAIL || "admin", action: parsed.data.isActive ? "DEVICE_ACTIVATED" : "DEVICE_DEACTIVATED", entityId: id } });
    }
    if (parsed.data.name !== undefined || parsed.data.location !== undefined || parsed.data.description !== undefined) {
      await db.auditLog.create({ data: { actorId: process.env.ADMIN_EMAIL || "admin", action: "DEVICE_UPDATED", entityId: id, metadata: { name: updated.name, location: updated.location } } });
    }
    return NextResponse.json({ id: updated.id, ok: true });
  } catch { return NextResponse.json({ error: "Perangkat gagal diperbarui." }, { status: 503 }); }
}
