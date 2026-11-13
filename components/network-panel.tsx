"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Gauge, Play, RefreshCw, Save, Wifi, WifiOff } from "lucide-react";

type Data = {
  measurement: { downloadMbps: number | null; uploadMbps: number | null; latencyMs: number | null; jitterMs: number | null; packetLossPercent: number | null; serverName: string | null; ooklaVersion: string | null; status: string; errorMessage: string | null; completedAt: string } | null;
  connectivity: { internetReachable: boolean; apiReachable: boolean; status: string; checkedAt: string; failedChecks: number } | null;
  command: { status: string; createdAt: string } | null;
  history: { id: string; downloadMbps: number | null; uploadMbps: number | null; completedAt: string }[];
  incidents: { id: string; category: string; summary: string; startedAt: string; recoveredAt: string | null; durationSeconds: number | null }[];
  settings: { speedTestIntervalMinutes: number; speedTestEnabled: boolean; slowDownloadThresholdMbps: number; slowUploadThresholdMbps: number; highLatencyThresholdMs: number; highJitterThresholdMs: number; highPacketLossThresholdPercent: number };
};
const fmt = (v: number | null | undefined, unit: string) => v === null || v === undefined ? "—" : `${v} ${unit}`;
const stamp = (v: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(v));

export function NetworkPanel({ deviceId }: { deviceId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const refresh = useCallback(async () => {
    try { const r = await fetch(`/api/devices/${deviceId}/network`, { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Data jaringan gagal dimuat."); }
  }, [deviceId]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 20000); return () => clearInterval(timer); }, [refresh]);
  async function requestTest() {
    setBusy(true);
    try { const r = await fetch(`/api/devices/${deviceId}/network`, { method: "POST" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Speed test gagal dijadwalkan."); }
    finally { setBusy(false); }
  }
  async function saveSettings(form: FormData) {
    setSaving(true);
    const settings = { speedTestIntervalMinutes: Number(form.get("interval")), speedTestEnabled: form.get("enabled") === "on", slowDownloadThresholdMbps: Number(form.get("download")), slowUploadThresholdMbps: Number(form.get("upload")), highLatencyThresholdMs: Number(form.get("latency")), highJitterThresholdMs: Number(form.get("jitter")), highPacketLossThresholdPercent: Number(form.get("loss")) };
    try { const r = await fetch(`/api/devices/${deviceId}/network`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Pengaturan gagal disimpan."); }
    finally { setSaving(false); }
  }
  if (!data) return <section className="panel network-panel"><h2>Jaringan & Ookla</h2>{error || "Memuat data jaringan..."}</section>;
  const m = data.measurement;
  const networkState = data.connectivity ? (data.connectivity.internetReachable ? "Terhubung" : data.connectivity.status === "internet_down" ? "Internet down" : "Belum cukup data") : "Belum ada data";
  return <div className="network-panel-wrap">
    <section className="panel network-panel">
      <div className="network-panel-head"><div><h2>Jaringan & Ookla</h2><p>Connectivity check terpisah dari status agent dan heartbeat.</p></div><button className="primary-button" onClick={requestTest} disabled={busy || !!data.command}><Play size={14} />{data.command ? `Tes ${data.command.status === "queued" ? "dalam antrean" : "berjalan"}` : busy ? "Mengantrikan..." : "Test Internet Now"}</button></div>
      {error && <div className="inline-error">{error}</div>}
      <div className="network-state-grid"><div className={`network-state ${data.connectivity?.internetReachable ? "healthy" : "unknown"}`}><Wifi size={17} /><span>Internet</span><b>{networkState}</b><small>{data.connectivity ? `Cek ${stamp(data.connectivity.checkedAt)} · ${data.connectivity.failedChecks} gagal` : "Connectivity check belum diterima"}</small></div><div className={`network-state ${data.connectivity?.apiReachable ? "healthy" : "unknown"}`}><Activity size={17} /><span>API PC Monitor</span><b>{data.connectivity ? data.connectivity.apiReachable ? "Terjangkau" : "Tidak terjangkau" : "Belum ada data"}</b><small>Dicatat terpisah dari koneksi internet umum</small></div><div className={`network-state ${m?.status === "success" ? "healthy" : "unknown"}`}><Gauge size={17} /><span>Speed test terakhir</span><b>{m?.status === "success" ? `${fmt(m.downloadMbps, "Mbps")} ↓ · ${fmt(m.uploadMbps, "Mbps")} ↑` : m?.status === "failed" ? "Gagal" : "Belum ada tes"}</b><small>{m ? `${stamp(m.completedAt)}${m.serverName ? ` · ${m.serverName}` : ""}` : "Menunggu hasil Ookla dari agent"}</small></div></div>
      {m?.status === "success" && <div className="network-metrics"><span>Latency <b>{fmt(m.latencyMs, "ms")}</b></span><span>Jitter <b>{fmt(m.jitterMs, "ms")}</b></span><span>Packet loss <b>{fmt(m.packetLossPercent, "%")}</b></span><span>Versi CLI <b>{m.ooklaVersion || "—"}</b></span></div>}
      {m?.status === "failed" && m.errorMessage && <div className="network-error"><WifiOff size={14} />{m.errorMessage}</div>}
      <div className="network-history"><b>Riwayat speed test · 7 hari terakhir</b>{data.history.length ? <div className="network-history-list">{data.history.slice(-12).reverse().map((item) => <div key={item.id}><time>{stamp(item.completedAt)}</time><span>{fmt(item.downloadMbps, "Mbps")} ↓</span><span>{fmt(item.uploadMbps, "Mbps")} ↑</span></div>)}</div> : <p>Belum ada hasil speed test.</p>}</div>
      <div className="network-incidents"><b>Insiden jaringan terbaru</b>{data.incidents.length ? data.incidents.slice(0, 5).map((incident) => <div key={incident.id}><span className={incident.recoveredAt ? "recovered" : "incident-open"}>{incident.recoveredAt ? "Pulih" : "Aktif"}</span><span><strong>{incident.category.replaceAll("_", " ")}</strong><small>{incident.summary}</small></span><time>{stamp(incident.startedAt)}</time></div>) : <p>Belum ada insiden tercatat.</p>}</div>
    </section>
    <section className="panel network-settings"><div><h3>Pengaturan pengukuran</h3><p>Interval minimum speed test otomatis 15 menit.</p></div><form action={saveSettings}>
      <label className="network-toggle"><input name="enabled" type="checkbox" defaultChecked={data.settings.speedTestEnabled} /> Aktifkan speed test otomatis</label>
      {([["interval", "Interval (menit)", data.settings.speedTestIntervalMinutes], ["download", "Download minimum (Mbps)", data.settings.slowDownloadThresholdMbps], ["upload", "Upload minimum (Mbps)", data.settings.slowUploadThresholdMbps], ["latency", "Latency tinggi (ms)", data.settings.highLatencyThresholdMs], ["jitter", "Jitter tinggi (ms)", data.settings.highJitterThresholdMs], ["loss", "Packet loss tinggi (%)", data.settings.highPacketLossThresholdPercent]] as [string, string, number][]).map(([name, label, value]) => <label className="network-field" key={name}><span>{label}</span><input name={name} type="number" min={name === "interval" ? 15 : 0} step="any" defaultValue={value} required /></label>)}
      <button className="secondary-button" disabled={saving}><Save size={14} />{saving ? "Menyimpan..." : "Simpan pengaturan"}</button>
    </form></section>
  </div>;
}
