import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const denied = await requireApiAuth();
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize")) || 20));
  try {
    const [logs, total] = await Promise.all([
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, actorId: true, action: true, entityId: true, metadata: true, createdAt: true } }),
      db.auditLog.count(),
    ]);
    return NextResponse.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch { return NextResponse.json({ error: "Audit log belum dapat dimuat." }, { status: 503 }); }
}
