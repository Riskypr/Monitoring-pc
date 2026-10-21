"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Plus, X } from "lucide-react";

export function DeviceModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/devices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Perangkat gagal disimpan.");
      setToken(result.token); onCreated();
    } catch (err) { setError(err instanceof Error ? err.message : "Terjadi kesalahan."); }
    finally { setBusy(false); }
  }
  function close() { setOpen(false); setToken(""); setCopied(false); setError(""); }
  return <><button className="primary-button" onClick={() => setOpen(true)}><Plus size={17} />Tambah perangkat</button>{open && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !token) close(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="device-modal-title">
    <button className="modal-close" onClick={close} aria-label="Tutup"><X size={19} /></button>
    {!token ? <><div className="modal-icon"><KeyRound size={20} /></div><div className="form-kicker">REGISTRASI PERANGKAT</div><h2 id="device-modal-title">Tambah PC baru</h2><p className="modal-description">Isi informasi perangkat. Token agent akan dibuat setelah perangkat tersimpan.</p>
      <form className="device-form" onSubmit={submit}><label className="field-label">Nama perangkat<input name="name" placeholder="Contoh: PC Front Office 01" minLength={2} maxLength={100} required /></label><label className="field-label">Lokasi<input name="location" placeholder="Contoh: Kantor Pusat · Lantai 2" maxLength={120} required /></label><label className="field-label">IP lokal awal <span className="optional">OPSIONAL</span><input name="initialIp" placeholder="Contoh: 192.168.1.24" maxLength={45} /></label><label className="field-label">Deskripsi <span className="optional">OPSIONAL</span><textarea name="description" placeholder="Catatan tambahan untuk perangkat ini" rows={2} maxLength={1000} /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button modal-submit" disabled={busy}>{busy ? "Menyimpan..." : "Daftarkan perangkat"}<Plus size={16} /></button></form>
    </> : <><div className="modal-icon success"><Check size={21} /></div><div className="form-kicker">PERANGKAT SIAP</div><h2 id="device-modal-title">Salin token agent</h2><p className="modal-description">Simpan token ini sekarang. Demi keamanan, token hanya ditampilkan sekali dan tidak bisa dilihat kembali.</p><div className="token-box"><code>{token}</code><button className="copy-token" onClick={async () => { await navigator.clipboard.writeText(token); setCopied(true); }} aria-label="Salin token">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div><div className="token-warning">Pasang token ini pada agent di perangkat yang baru didaftarkan.</div><button className="primary-button modal-submit" onClick={close}>Selesai</button></>}
  </section></div>}</>;
}
