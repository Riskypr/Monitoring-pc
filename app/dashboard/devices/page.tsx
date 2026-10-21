"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, Monitor, RefreshCw, Search } from "lucide-react";
import { DeviceModal } from "@/components/device-modal";
import { StatusBadge } from "@/components/status-badge";

type Device = { id: string; name: string; location: string; lastLocalIp: string | null; lastPublicIp: string | null; lastSeenAt: string | null; isActive: boolean; status: "ONLINE" | "OFFLINE" | "NEVER_ONLINE" | "INACTIVE" };
const time = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Belum pernah";

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]); const [search, setSearch] = useState(""); const [location, setLocation] = useState("all"); const [status, setStatus] = useState("all");
  const [locations, setLocations] = useState<string[]>([]); const [page, setPage] = useState(1); const [pages, setPages] = useState(1); const [total, setTotal] = useState(0); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const params = new URLSearchParams({ page: String(page), pageSize: "10", search, location, status }); const response = await fetch(`/api/devices?${params}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Gagal memuat perangkat."); setDevices(data.devices); setPages(data.pages); setTotal(data.total); setLocations(data.locations); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Terjadi kesalahan."); }
    finally { setLoading(false); }
  }, [page, search, location, status]);
  useEffect(() => { const id = setTimeout(refresh, 180); return () => clearTimeout(id); }, [refresh]);
  function updateFilter(setter: (value: string) => void, value: string) { setter(value); setPage(1); }

  return <div className="dashboard-page"><div className="page-heading"><div><div className="date-kicker">MONITORING PERANGKAT <span>•</span> INVENTARIS</div><h1>Perangkat</h1><p>Daftarkan dan kelola PC yang terhubung ke sistem monitoring.</p></div><DeviceModal onCreated={refresh} /></div>
    <section className="panel inventory-panel"><div className="inventory-title"><div><h2>Semua perangkat <span className="count-pill">{total}</span></h2><p>Daftar perangkat yang terdaftar di workspace ini.</p></div><button className="secondary-button" onClick={refresh} disabled={loading}><RefreshCw size={15} className={loading ? "spin" : ""} />Segarkan</button></div>
      <div className="inventory-filters"><div className="table-search"><Search size={16} /><input value={search} onChange={(e) => updateFilter(setSearch, e.target.value)} placeholder="Cari nama atau alamat IP..." /></div><label className="select-wrap"><span>Lokasi:</span><select value={location} onChange={(e) => updateFilter(setLocation, e.target.value)}><option value="all">Semua lokasi</option>{locations.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label><label className="select-wrap"><span>Status:</span><select value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}><option value="all">Semua status</option><option value="ONLINE">Online</option><option value="OFFLINE">Offline</option><option value="NEVER_ONLINE">Belum online</option><option value="INACTIVE">Nonaktif</option></select><ChevronDown size={14} /></label></div>
      {error && <div className="inline-error">{error}</div>}
      <div className="table-scroll"><table className="device-table inventory-table"><thead><tr><th>NAMA PERANGKAT</th><th>ALAMAT IP TERAKHIR</th><th>LOKASI</th><th>STATUS</th><th>TERAKHIR AKTIF</th><th /></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td><Link className="device-name-link" href={`/dashboard/devices/${device.id}`}><span className={`device-mini-icon ${device.status === "ONLINE" ? "is-online" : ""}`}><Monitor size={15} /></span><span>{device.name}<small>{device.id.slice(-8).toUpperCase()}</small></span></Link></td><td className="ip-cell">{device.lastLocalIp || device.lastPublicIp || "—"}</td><td><span className="location-dot" />{device.location}</td><td><StatusBadge status={device.status} /></td><td className="last-seen">{time(device.lastSeenAt)}</td><td><Link className="row-arrow" href={`/dashboard/devices/${device.id}`} aria-label={`Detail ${device.name}`}><ArrowRight size={15} /></Link></td></tr>)}{!devices.length && <tr><td colSpan={6} className="empty-table">{loading ? "Memuat perangkat..." : "Tidak ada perangkat yang sesuai dengan filter."}</td></tr>}</tbody></table></div>
      <div className="pagination"><span>Menampilkan <b>{total ? (page - 1) * 10 + 1 : 0}–{Math.min(page * 10, total)}</b> dari <b>{total}</b> perangkat</span><div><button className="page-button" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><ArrowLeft size={14} />Sebelumnya</button><span className="page-count">Halaman <b>{page}</b> / {pages}</span><button className="page-button" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Berikutnya<ArrowRight size={14} /></button></div></div>
    </section><div className="agent-hint"><span className="hint-icon"><Monitor size={17} /></span><span><b>Hubungkan PC baru</b><small>Tambahkan perangkat untuk membuat token agent yang unik.</small></span><span className="hint-step">60 detik <i>·</i> interval heartbeat</span></div>
  </div>;
}
