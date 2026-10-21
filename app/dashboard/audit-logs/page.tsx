"use client";

import { useEffect, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";

type Log = { id: string; actorId: string; action: string; entityId: string | null; metadata: unknown; createdAt: string };
const actionText: Record<string, string> = { DEVICE_CREATED: "Mendaftarkan perangkat", DEVICE_UPDATED: "Memperbarui perangkat", DEVICE_ACTIVATED: "Mengaktifkan perangkat", DEVICE_DEACTIVATED: "Menonaktifkan perangkat", DEVICE_TOKEN_ROTATED: "Mengganti token agent" };
export default function AuditPage() {
  const [logs, setLogs] = useState<Log[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  async function refresh() { setLoading(true); try { const r = await fetch("/api/audit-logs?pageSize=50", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setLogs(d.logs); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat catatan."); } finally { setLoading(false); } }
  useEffect(() => { refresh(); }, []);
  return <div className="dashboard-page"><div className="page-heading"><div><div className="date-kicker">PREFERENSI <span>•</span> AUDIT</div><h1>Audit log</h1><p>Catatan tindakan administratif pada perangkat dan token agent.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />Segarkan</button></div>{error && <div className="page-error">{error}</div>}<section className="panel audit-panel"><div className="panel-heading"><div><h2>Aktivitas admin</h2><p>{logs.length} catatan terbaru</p></div><ClipboardList size={18} className="subtle-arrow" /></div><div className="audit-list">{logs.map((log) => { const meta = log.metadata && typeof log.metadata === "object" ? log.metadata as Record<string, unknown> : {}; return <div className="audit-row" key={log.id}><span className="audit-icon"><ClipboardList size={15} /></span><span className="audit-copy"><b>{actionText[log.action] || log.action}</b><small>{String(meta.name || log.entityId || "Perangkat")}{meta.location ? ` · ${String(meta.location)}` : ""}</small><small>Oleh {log.actorId}</small></span><time>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createdAt))}</time></div>; })}{!logs.length && <div className="empty-table">{loading ? "Memuat audit log..." : "Belum ada tindakan administratif."}</div>}</div></section></div>;
}
