"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Clock3, Monitor, MoreHorizontal, RefreshCw, Search, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";

type Device = {
  id: string;
  name: string;
  location: string;
  lastLocalIp: string | null;
  lastPublicIp: string | null;
  ramUsagePct?: number | null;
  diskFreeGB?: number | null;
  latencyMs?: number | null;
  lastSeenAt: string | null;
  status: "ONLINE" | "OFFLINE" | "NEVER_ONLINE" | "INACTIVE";
};
type Stats = { total: number; active: number; online: number; offline: number; neverOnline: number; inactive: number; availability: number; updatedAt: string };
const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Belum ada data";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updated, setUpdated] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [statRes, deviceRes] = await Promise.all([fetch("/api/dashboard/stats", { cache: "no-store" }), fetch("/api/devices?page=1&pageSize=6", { cache: "no-store" })]);
      if (!statRes.ok || !deviceRes.ok) throw new Error("Data monitoring belum dapat dimuat. Periksa koneksi database.");
      const [statData, deviceData] = await Promise.all([statRes.json(), deviceRes.json()]);
      setStats(statData); setDevices(deviceData.devices); setUpdated(new Date().toISOString()); setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Terjadi kesalahan."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 60_000); return () => clearInterval(timer); }, [refresh]);
  const visible = devices.filter((device) => `${device.name} ${device.lastLocalIp || ""} ${device.lastPublicIp || ""}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="dashboard-page"><div className="page-heading"><div><div className="date-kicker">MONITORING PERANGKAT <span>â€¢</span> OVERVIEW</div><h1>Dashboard</h1><p>Pantau kondisi seluruh PC Anda dalam satu tampilan.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />Perbarui data</button></div>
    {error && <div className="page-error"><WifiOff size={17} /><span>{error}</span><button onClick={refresh}>Coba lagi</button></div>}
    <div className="stats-grid">
      <article className="stat-card"><div className="stat-top"><span>Total perangkat</span><span className="stat-icon blue"><Monitor size={18} /></span></div><div className="stat-number">{loading ? "â€”" : stats?.total ?? "â€”"}<span className="stat-sub"> terdaftar</span></div><div className="stat-bottom"><span className="stat-foot-icon"><ShieldCheck size={13} /></span>{stats?.active ?? 0} perangkat aktif</div></article>
      <article className="stat-card"><div className="stat-top"><span>Online sekarang</span><span className="stat-icon green"><Wifi size={18} /></span></div><div className="stat-number">{loading ? "â€”" : stats?.online ?? "â€”"}<span className="stat-sub"> perangkat</span></div><div className="stat-bottom"><span className="online-dot" />Terhubung ke server</div></article>
      <article className="stat-card"><div className="stat-top"><span>Offline</span><span className="stat-icon orange"><WifiOff size={18} /></span></div><div className="stat-number">{loading ? "â€”" : stats?.offline ?? "â€”"}<span className="stat-sub"> perangkat</span></div><div className="stat-bottom"><span className="orange-foot"><ArrowDownRight size={13} /></span>Melewati batas 180 detik</div></article>
      <article className="stat-card"><div className="stat-top"><span>Ketersediaan</span><span className="stat-icon violet"><Activity size={18} /></span></div><div className="stat-number">{loading ? "â€”" : `${stats?.availability ?? 0}%`}</div><div className="availability-track"><span style={{ width: `${stats?.availability ?? 0}%` }} /></div><div className="stat-bottom">Dari total perangkat aktif</div></article>
    </div>
    <div className="overview-grid"><section className="panel device-panel"><div className="panel-heading"><div><h2>Perangkat terbaru</h2><p>Status monitoring perangkat Anda</p></div><Link className="text-link" href="/dashboard/devices">Lihat semua <ArrowRight size={15} /></Link></div>
      <div className="table-toolbar"><div className="table-search"><Search size={16} /><input placeholder="Cari nama atau alamat IP..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><button className="more-button" aria-label="Opsi tabel"><MoreHorizontal size={19} /></button></div>
      <div className="table-scroll"><table className="device-table"><thead><tr><th>NAMA PERANGKAT</th><th>ALAMAT IP</th><th>RAM & DISK</th><th>PING</th><th>LOKASI</th><th>STATUS</th><th>TERAKHIR AKTIF</th><th /></tr></thead><tbody>{visible.map((device) => <tr key={device.id}><td><Link className="device-name-link" href={`/dashboard/devices/${device.id}`}><span className={`device-mini-icon ${device.status === "ONLINE" ? "is-online" : ""}`}><Monitor size={15} /></span><span>{device.name}<small>{device.id.slice(-8).toUpperCase()}</small></span></Link></td><td className="ip-cell">{device.lastLocalIp || device.lastPublicIp || "â€”"}</td><td><div className="table-metric-cell"><div className="table-metric-row"><small>RAM:</small><b>{device.ramUsagePct !== null && device.ramUsagePct !== undefined ? `${device.ramUsagePct}%` : "â€”"}</b></div><div className="table-metric-row"><small>Disk:</small><b>{device.diskFreeGB !== null && device.diskFreeGB !== undefined ? `${device.diskFreeGB} GB` : "â€”"}</b></div></div></td><td>{device.latencyMs !== null && device.latencyMs !== undefined ? <span className={`metric-pill ${device.latencyMs > 200 ? "bad" : device.latencyMs > 100 ? "warn" : "good"}`}>{device.latencyMs} ms</span> : <span style={{ color: "#a5b0be" }}>-</span>}</td><td><span className="location-dot" />{device.location}</td><td><StatusBadge status={device.status} /></td><td className="last-seen">{formatTime(device.lastSeenAt)}</td><td><Link className="row-arrow" href={`/dashboard/devices/${device.id}`} aria-label={`Detail ${device.name}`}><ArrowRight size={15} /></Link></td></tr>)}{!visible.length && <tr><td colSpan={8} className="empty-table">{loading ? "Memuat perangkat..." : "Belum ada perangkat yang cocok."}</td></tr>}</tbody></table></div>
      <div className="panel-footer"><span>Menampilkan <b>{visible.length}</b> dari <b>{stats?.total ?? 0}</b> perangkat</span><Link href="/dashboard/devices">Kelola perangkat <ArrowRight size={14} /></Link></div>
    </section><aside className="overview-aside"><section className="panel uptime-panel"><div className="panel-heading compact"><div><h2>Status perangkat</h2><p>Ringkasan koneksi saat ini</p></div><span className="live-pill"><i />LIVE</span></div><div className="uptime-total"><strong>{stats?.online ?? 0}</strong><span> dari {stats?.active ?? 0} perangkat aktif online</span></div><div className="stacked-track"><i className="green-segment" style={{ width: `${stats?.active ? (stats.online / stats.active) * 100 : 0}%` }} /><i className="orange-segment" style={{ width: `${stats?.active ? (stats.offline / stats.active) * 100 : 0}%` }} /></div><div className="legend-row"><span><i className="legend-green" />Online <b>{stats?.online ?? 0}</b></span><span><i className="legend-orange" />Offline <b>{stats?.offline ?? 0}</b></span></div><div className="uptime-callout"><div className="callout-icon"><Clock3 size={16} /></div><span>Perangkat dianggap offline setelah tidak mengirim heartbeat selama <b>3 menit.</b></span></div></section>
      <section className="panel activity-panel"><div className="panel-heading compact"><div><h2>Aktivitas sistem</h2><p>Pembaruan dashboard terbaru</p></div><ArrowUpRight size={17} className="subtle-arrow" /></div><div className="activity-row"><span className="activity-icon"><RefreshCw size={14} /></span><span><b>Data diperbarui</b><small>{updated ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(updated)) : "Menunggu pembaruan"}</small></span><span className="activity-live">OK</span></div><div className="activity-row"><span className="activity-icon blue-icon"><Activity size={14} /></span><span><b>Polling aktif</b><small>Pembaruan otomatis tiap 60 detik</small></span><span className="activity-live">AKTIF</span></div></section></aside></div>
    <div className="dashboard-bottom"><span><span className="online-dot" />Monitoring berjalan normal</span><span>Terakhir diperbarui {updated ? formatTime(updated) : "â€”"}</span></div>
  </div>;
}
