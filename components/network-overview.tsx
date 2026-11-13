"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
type Row = { id: string; name: string; location: string; agent: string; internet: string; apiReachable: boolean | null; measurement: { downloadMbps: number | null; uploadMbps: number | null; latencyMs: number | null; completedAt: string; status: string } | null };
type Summary = { total: number; normal: number; slow: number; down: number; agentOffline: number; speedTestFailed: number };
const label: Record<string, string> = { normal: "Normal", slow: "Lambat", unstable: "Tidak stabil", high_latency: "Latency tinggi", internet_down: "Internet down", unknown: "Unknown / stale" };
export function NetworkOverview() {
  const [rows, setRows] = useState<Row[]>([]); const [counts, setCounts] = useState<Summary | null>(null);
  useEffect(() => { const load = () => fetch("/api/dashboard/network", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!d.error) { setRows(d.rows); setCounts(d.counts); } }).catch(() => {}); load(); const timer = setInterval(load, 60000); return () => clearInterval(timer); }, []);
  return <section className="panel network-overview"><div className="panel-heading"><div><h2>Kualitas internet</h2><p>Status koneksi, agent, dan hasil Ookla terbaru</p></div><Activity size={17} color="#7391c4" /></div>
    <div className="network-overview-cards">{[["Total PC", counts?.total], ["Normal", counts?.normal], ["Lambat / bermasalah", counts?.slow], ["Internet down", counts?.down], ["Agent offline", counts?.agentOffline], ["Speed test gagal · 24 jam", counts?.speedTestFailed]].map(([name, value]) => <div key={name}><span>{name}</span><b>{value ?? "—"}</b></div>)}</div>
    <div className="table-scroll"><table className="device-table network-overview-table"><thead><tr><th>PERANGKAT / LOKASI</th><th>STATUS AGENT</th><th>STATUS INTERNET</th><th>DOWNLOAD / UPLOAD</th><th>LATENCY</th><th>API</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link className="device-name-link" href={`/dashboard/devices/${row.id}`}><span>{row.name}<small>{row.location}</small></span></Link></td><td>{row.agent === "ONLINE" ? "Online" : "Offline"}</td><td><span className={`network-status-text ${row.internet}`}>{label[row.internet] || row.internet}</span></td><td>{row.measurement?.status === "success" ? `${row.measurement.downloadMbps ?? "—"} / ${row.measurement.uploadMbps ?? "—"} Mbps` : "Belum ada tes valid"}</td><td>{row.measurement?.latencyMs == null ? "—" : `${row.measurement.latencyMs} ms`}</td><td>{row.apiReachable === null ? "Stale" : row.apiReachable ? "Terjangkau" : "Tidak terjangkau"}</td></tr>)}{!rows.length && <tr><td colSpan={6} className="empty-table">Memuat status jaringan...</td></tr>}</tbody></table></div>
  </section>;
}
