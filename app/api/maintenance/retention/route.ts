import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const connectivityCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const commandCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [heartbeats, connectivity, measurements, commands] = await Promise.all([
      db.heartbeat.deleteMany({ where: { receivedAt: { lt: cutoff } } }),
      db.connectivityCheck.deleteMany({ where: { checkedAt: { lt: connectivityCutoff } } }),
      db.networkMeasurement.deleteMany({ where: { completedAt: { lt: cutoff } } }),
      db.agentCommand.deleteMany({ where: { status: { in: ["completed", "failed", "expired"] }, createdAt: { lt: commandCutoff } } }),
    ]);
    return NextResponse.json({ ok: true, deletedHeartbeats: heartbeats.count, deletedConnectivityChecks: connectivity.count, deletedMeasurements: measurements.count, deletedCommands: commands.count, retainedSince: { speedTests: cutoff.toISOString(), connectivity: connectivityCutoff.toISOString() } });
  } catch { return NextResponse.json({ error: "Retention belum dapat dijalankan." }, { status: 503 }); }
}
