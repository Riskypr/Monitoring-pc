import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { issueAgentToken, hashAgentToken, statusFor, syncStatusEvents } from "@/lib/monitoring";

const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  location: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  initialIp: z.string().trim().max(45).optional().or(z.literal("")),
});

export async function GET(request: Request) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  try {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize")) || 10));
    const search = params.get("search")?.trim();
    const location = params.get("location");
    const statusFilter = params.get("status");
    const cutoff = new Date(Date.now() - 180_000);
    const statusWhere = statusFilter === "ONLINE" ? { isActive: true, lastSeenAt: { gte: cutoff } }
      : statusFilter === "OFFLINE" ? { isActive: true, lastSeenAt: { lt: cutoff, not: null } }
      : statusFilter === "NEVER_ONLINE" ? { isActive: true, lastSeenAt: null }
      : statusFilter === "INACTIVE" ? { isActive: false } : {};
    const where = {
      ...statusWhere,
      ...(search ? { OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { lastLocalIp: { contains: search, mode: "insensitive" as const } },
        { lastPublicIp: { contains: search, mode: "insensitive" as const } },
      ] } : {}),
      ...(location && location !== "all" ? { location } : {}),
    };
    const [rows, total, locations] = await Promise.all([
      db.device.findMany({ where, orderBy: [{ isActive: "desc" }, { name: "asc" }], skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, name: true, location: true, lastLocalIp: true, lastPublicIp: true, lastSeenAt: true, isActive: true, createdAt: true } }),
      db.device.count({ where }),
      db.device.findMany({ distinct: ["location"], select: { location: true }, orderBy: { location: "asc" } }),
    ]);
    await syncStatusEvents(rows);
    const devices = rows.map((device) => ({ ...device, status: statusFor(device) }));
    return NextResponse.json({ devices, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), locations: locations.map((row) => row.location) });
  } catch {
    return NextResponse.json({ error: "Daftar perangkat belum dapat dimuat." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  try {
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Data perangkat tidak valid.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { name, location, description, initialIp } = parsed.data;
    const token = issueAgentToken();
    const device = await db.device.create({ data: {
      name, location, description: description || null, lastLocalIp: initialIp || null, tokenHash: hashAgentToken(token),
      statusEvents: { create: { status: "NEVER_ONLINE", reason: "Perangkat didaftarkan" } },
    }, select: { id: true, name: true, location: true, createdAt: true } });
    await db.auditLog.create({ data: { actorId: process.env.ADMIN_EMAIL || "admin", action: "DEVICE_CREATED", entityId: device.id, metadata: { name, location } } });
    return NextResponse.json({ device, token }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Perangkat gagal didaftarkan." }, { status: 503 });
  }
}
