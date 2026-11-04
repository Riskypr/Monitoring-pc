"use client";

import { useState } from "react";
import { Pencil, X } from "lucide-react";

export function DeviceEditModal({
  device,
  onSaved,
}: {
  device: { id: string; name: string; location: string; description: string | null };
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      name: (form.get("name") as string).trim(),
      location: (form.get("location") as string).trim(),
      description: (form.get("description") as string).trim() || null,
    };
    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Perubahan gagal disimpan.");
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="secondary-button" onClick={() => setOpen(true)}>
        <Pencil size={14} />Edit perangkat
      </button>
      {open && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <section className="modal-card" role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setOpen(false)} aria-label="Tutup"><X size={18} /></button>
            <div className="modal-icon"><Pencil size={18} /></div>
            <div className="form-kicker">INFORMASI PERANGKAT</div>
            <h2>Edit perangkat</h2>
            <p className="modal-description">Perbarui nama, lokasi, atau deskripsi perangkat ini.</p>
            <form className="device-form" onSubmit={submit}>
              <label className="field-label">Nama perangkat
                <input name="name" defaultValue={device.name} minLength={2} maxLength={100} required />
              </label>
              <label className="field-label">Lokasi
                <input name="location" defaultValue={device.location} maxLength={120} required />
              </label>
              <label className="field-label">Deskripsi
                <textarea name="description" defaultValue={device.description || ""} rows={3} maxLength={1000} />
              </label>
              {error && <div className="form-error">{error}</div>}
              <button className="primary-button modal-submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan perubahan"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

