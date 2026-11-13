"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Clock3, Copy, Cpu, Gauge, HardDrive, KeyRound, MapPin, Monitor, RefreshCw, RotateCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { DeviceEditModal } from "@/components/device-edit-modal";
import { NetworkPanel } from "@/components/network-panel";

type Device = {
  id: string;
  name: string;
  location: string;
  description: string | null;
  lastLocalIp: string | null;
  lastPublicIp: string | null;
  ramUsagePct: number | null;
  ramUsedGB: number | null;
  ramTotalGB: number | null;
  diskUsagePct: number | null;
  diskFreeGB: number | null;
  diskTotalGB: number | null;
  latencyMs: number | null;
  lastSeenAt: string | null;
  isActive: boolean;
  createdAt: string;
  status: "ONLINE" | "OFFLINE" | "NEVER_ONLINE" | "INACTIVE";
};
type History = {
  heartbeats: {
    id: string;
    localIp: string | null;
    publicIp: string | null;
    ramUsagePct: number | null;
    diskFreeGB: number | null;
    latencyMs: number | null;
    receivedAt: string;
  }[];
  events: { id: string; status: string; reason: string | null; occurredAt: string }[];
};
const time = (value: string | null) => value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)) : "Belum pernah";

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [device, setDevice] = useState<Device | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [dr, hr] = await Promise.all([fetch(`/api/devices/${id}`, { cache: "no-store" }), fetch(`/api/devices/${id}/history`, { cache: "no-store" })]);
      const dd = await dr.json(); const hd = await hr.json();
      if (!dr.ok) throw new Error(dd.error || "Perangkat tidak ditemukan.");
      setDevice(dd); setHistory(hd); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memuat data."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { refresh(); const timer = setInterval(refresh, 60_000); return () => clearInterval(timer); }, [refresh]);

  async function toggleActive() {
    if (!device) return; setBusy(true);
    try {
      const r = await fetch(`/api/devices/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !device.isActive }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Gagal memperbarui perangkat."); }
    finally { setBusy(false); }
  }

  async function rotateToken() {
    setBusy(true);
    try {
      const r = await fetch(`/api/devices/${id}/rotate-token`, { method: "POST" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error); setToken(d.token);
    } catch (e) { setError(e instanceof Error ? e.message : "Token gagal diganti."); }
    finally { setBusy(false); }
  }

  async function deleteDevice() {
    setBusy(true);
    try {
      const r = await fetch(`/api/devices/${id}`, { method: "DELETE" });
      const d = await r.json(); if (!r.ok) throw new Error(d.error);
      router.push("/dashboard/devices");
    } catch (e) { setError(e instanceof Error ? e.message : "Perangkat gagal dihapus."); setConfirmDelete(false); }
    finally { setBusy(false); }
  }
  if (loading && !device) return <div className="loading-panel"><RefreshCw className="spin" size={18} />Memuat detail perangkat...</div>;
  if (error && !device) return <div className="page-error"><WifiOff size={17} />{error}</div>;
  if (!device) return null;
  const events = history?.events || [];
  return <div className="dashboard-page detail-page"><Link className="back-link" href="/dashboard/devices"><ArrowLeft size={15} />Kembali ke perangkat</Link>
    <div className="page-heading detail-heading"><div><div className="date-kicker">INVENTARIS <span>•</span> DETAIL PERANGKAT</div><h1>{device.name}</h1><p><MapPin size={14} />{device.location}<span className="heading-separator">·</span>Terdaftar {time(device.createdAt)}</p></div><div className="detail-actions"><DeviceEditModal device={device} onSaved={refresh} /><button className="secondary-button" onClick={refresh}><RefreshCw size={15} />Segarkan</button><button className="secondary-button" onClick={rotateToken} disabled={busy}><RotateCw size={15} />Ganti token</button><button className={device.isActive ? "danger-button" : "secondary-button"} onClick={toggleActive} disabled={busy}>{device.isActive ? "Nonaktifkan" : "Aktifkan"}</button><button className="danger-button" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={14} />Hapus</button></div></div>
    {error && <div className="page-error"><WifiOff size={17} />{error}<button onClick={() => setError("")}>Tutup</button></div>}
    <div className="detail-cards"><section className="panel device-identity"><div className="identity-symbol"><Monitor size={24} /></div><div className="identity-main"><span>STATUS PERANGKAT</span><StatusBadge status={device.status} /><h2>{device.name}</h2><p>{device.description || "Tidak ada deskripsi untuk perangkat ini."}</p></div><div className="identity-id">ID PERANGKAT<code>{device.id}</code></div></section>
      <div className="detail-info-grid"><section className="panel info-card"><div className="info-icon blue"><Wifi size={17} /></div><span>IP LOKAL TERAKHIR</span><strong className="monospace">{device.lastLocalIp || "Belum tersedia"}</strong><small>Alamat jaringan lokal perangkat</small></section><section className="panel info-card"><div className="info-icon violet"><Wifi size={17} /></div><span>IP PUBLIK TERAKHIR</span><strong className="monospace">{device.lastPublicIp || "Belum tersedia"}</strong><small>Terdeteksi dari koneksi server</small></section><section className="panel info-card"><div className="info-icon green"><Clock3 size={17} /></div><span>TERAKHIR AKTIF</span><strong>{time(device.lastSeenAt)}</strong><small>Ambang offline: 180 detik</small></section></div>
    </div>

    <div className="metrics-section">
      <div className="metric-detail-card">
        <div className="metric-card-top">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Cpu size={15} /> MEMORI RAM</span>
          {device.ramUsagePct !== null && device.ramUsagePct !== undefined && (
            <span className={`metric-pill ${device.ramUsagePct > 90 ? "bad" : device.ramUsagePct > 75 ? "warn" : "good"}`}>
              {device.ramUsagePct > 90 ? "Tinggi" : device.ramUsagePct > 75 ? "Waspada" : "Normal"}
            </span>
          )}
        </div>
        <div className="metric-card-val">
          <strong>{device.ramUsagePct !== null && device.ramUsagePct !== undefined ? `${device.ramUsagePct}%` : "—"}</strong>
          <span>{device.ramUsedGB !== null && device.ramUsedGB !== undefined && device.ramTotalGB ? `${device.ramUsedGB} / ${device.ramTotalGB} GB` : "Belum ada data"}</span>
        </div>
        <div className="metric-progress">
          <div
            className={`metric-progress-fill ${(device.ramUsagePct || 0) > 90 ? "red" : (device.ramUsagePct || 0) > 75 ? "orange" : "green"}`}
            style={{ width: `${Math.min(100, Math.max(0, device.ramUsagePct || 0))}%` }}
          />
        </div>
        <div className="metric-card-sub">Penggunaan kapasitas memori sistem</div>
      </div>

      <div className="metric-detail-card">
        <div className="metric-card-top">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><HardDrive size={15} /> STORAGE (DRIVE SYSTEM)</span>
          {device.diskUsagePct !== null && device.diskUsagePct !== undefined && (
            <span className={`metric-pill ${device.diskUsagePct > 90 ? "bad" : device.diskUsagePct > 80 ? "warn" : "good"}`}>
              {device.diskUsagePct > 90 ? "Hampir Penuh" : device.diskUsagePct > 80 ? "Waspada" : "Cukup"}
            </span>
          )}
        </div>
        <div className="metric-card-val">
          <strong>{device.diskFreeGB !== null && device.diskFreeGB !== undefined ? `${device.diskFreeGB} GB` : "—"}</strong>
          <span>{device.diskTotalGB ? `Sisa dari ${device.diskTotalGB} GB (${device.diskUsagePct ?? "—"}% terpakai)` : "Belum ada data"}</span>
        </div>
        <div className="metric-progress">
          <div
            className={`metric-progress-fill ${(device.diskUsagePct || 0) > 90 ? "red" : (device.diskUsagePct || 0) > 80 ? "orange" : "green"}`}
            style={{ width: `${Math.min(100, Math.max(0, device.diskUsagePct || 0))}%` }}
          />
        </div>
        <div className="metric-card-sub">Ruang kosong hard disk sistem utama</div>
      </div>

      <div className="metric-detail-card">
        <div className="metric-card-top">
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Gauge size={15} /> KUALITAS INTERNET (LATENCY)</span>
          {device.latencyMs !== null && device.latencyMs !== undefined && (
            <span className={`metric-pill ${device.latencyMs > 200 ? "bad" : device.latencyMs > 100 ? "warn" : "good"}`}>
              {device.latencyMs > 200 ? "Lambat" : device.latencyMs > 100 ? "Sedang" : "Cepat & Stabil"}
            </span>
          )}
        </div>
        <div className="metric-card-val">
          <strong>{device.latencyMs !== null && device.latencyMs !== undefined ? `${device.latencyMs} ms` : "—"}</strong>
          <span>{device.latencyMs !== null && device.latencyMs !== undefined ? (device.latencyMs < 50 ? "Sangat Baik" : device.latencyMs < 120 ? "Stabil" : "Tinggi") : "Belum ada data"}</span>
        </div>
        <div className="metric-progress">
          <div
            className={`metric-progress-fill ${(device.latencyMs || 0) > 200 ? "red" : (device.latencyMs || 0) > 100 ? "orange" : "green"}`}
            style={{ width: `${Math.min(100, Math.max(8, ((device.latencyMs || 0) / 250) * 100))}%` }}
          />
        </div>
        <div className="metric-card-sub">Waktu respons koneksi internet (RTT ping)</div>
      </div>
    </div>
    <NetworkPanel deviceId={id} />
    <section className="panel history-panel"><div className="panel-heading"><div><h2>Riwayat monitoring</h2><p>Heartbeat dan transisi status 7 hari terakhir</p></div><span className="history-count">{events.length + (history?.heartbeats.length || 0)} catatan</span></div>
      {events.length ? <div className="timeline">{events.map((event, index) => <div className="timeline-row" key={event.id}><div className={`timeline-marker ${event.status === "ONLINE" ? "marker-green" : event.status === "OFFLINE" ? "marker-orange" : "marker-grey"}`}>{event.status === "ONLINE" ? <Check size={12} /> : <WifiOff size={12} />}</div><div className="timeline-copy"><div><b>{event.status === "ONLINE" ? "Perangkat online" : event.status === "OFFLINE" ? "Perangkat offline" : event.status === "INACTIVE" ? "Perangkat dinonaktifkan" : "Perangkat belum online"}</b><small>{event.reason || "Perubahan status terdeteksi"}</small></div><time>{time(event.occurredAt)}</time></div>{index < events.length - 1 && <span className="timeline-line" />}</div>)}</div> : <div className="empty-history"><Clock3 size={20} /><b>Belum ada perubahan status</b><span>Event akan muncul ketika perangkat mulai mengirim heartbeat.</span></div>}
      <div className="heartbeat-list"><div className="heartbeat-list-head"><b>Heartbeat terbaru</b><span>Terbaru lebih dulu · maksimal 100 catatan</span></div>{history?.heartbeats.slice(0, 8).map((item) => <div className="heartbeat-row" key={item.id}><span className="online-dot" /><span>Heartbeat diterima <small>{item.localIp || "IP lokal tidak tersedia"}</small>{item.ramUsagePct !== null && item.ramUsagePct !== undefined && <small style={{ color: "#456184", fontWeight: 600 }}> · RAM {item.ramUsagePct}%</small>}{item.diskFreeGB !== null && item.diskFreeGB !== undefined && <small style={{ color: "#456184", fontWeight: 600 }}> · Sisa Disk {item.diskFreeGB} GB</small>}{item.latencyMs !== null && item.latencyMs !== undefined && <small style={{ color: "#456184", fontWeight: 600 }}> · Ping {item.latencyMs}ms</small>}</span><time>{time(item.receivedAt)}</time></div>)}{history && history.heartbeats.length === 0 && <div className="heartbeat-empty">Belum ada heartbeat yang diterima.</div>}</div>
    </section>
    {token && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setToken(""); }}><section className="modal-card" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setToken("")} aria-label="Tutup">×</button><div className="modal-icon"><KeyRound size={20} /></div><div className="form-kicker">TOKEN BARU BERHASIL DIBUAT</div><h2>Simpan token agent</h2><p className="modal-description">Token sebelumnya sudah dicabut. Perbarui agent pada PC dengan token baru ini.</p><div className="token-box"><code>{token}</code><button className="copy-token" onClick={async () => { await navigator.clipboard.writeText(token); setCopied(true); }} aria-label="Salin token">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div><button className="primary-button modal-submit" onClick={() => setToken("")}>Selesai</button></section></div>}
    {confirmDelete && (
      <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
        <section className="modal-card" role="dialog" aria-modal="true">
          <button className="modal-close" onClick={() => setConfirmDelete(false)} aria-label="Tutup">×</button>
          <div className="modal-icon" style={{ background: "#ffebee", color: "#c9454f" }}><Trash2 size={20} /></div>
          <div className="form-kicker">KONFIRMASI TINDAKAN BERBAHAYA</div>
          <h2>Hapus perangkat?</h2>
          <p className="modal-description">
            Perangkat <b>{device.name}</b> beserta seluruh riwayat heartbeat dan status akan dihapus permanen dari sistem. Tindakan ini <b>tidak dapat dibatalkan</b>.
          </p>
          {error && <div className="form-error">{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button className="secondary-button" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)} disabled={busy}>Batal</button>
            <button className="danger-button" style={{ flex: 1, justifyContent: "center" }} onClick={deleteDevice} disabled={busy}>
              <Trash2 size={14} />{busy ? "Menghapus..." : "Ya, hapus permanen"}
            </button>
          </div>
        </section>
      </div>
    )}
  </div>;
}
