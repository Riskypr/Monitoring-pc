"use client";

import { useState } from "react";
import { Activity, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Login gagal.");
      router.push("/dashboard"); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Login gagal."); }
    finally { setLoading(false); }
  }

  return <main className="login-page">
    <div className="login-decoration"><div className="decoration-grid" /><div className="glow glow-one" /><div className="glow glow-two" />
      <div className="login-brand"><span className="brand-mark"><Activity size={21} /></span><span>pc<span className="brand-light">monitor</span></span></div>
      <div className="login-pitch"><div className="eyebrow"><span className="live-dot" /> MONITORING INFRASTRUKTUR</div><h1>Semua perangkat,<br /><span>satu kendali.</span></h1><p>Pantau ketersediaan komputer di seluruh lokasi secara real-time. Ketahui perangkat yang aktif, terputus, dan kapan terakhir berkomunikasi.</p>
        <div className="pitch-note"><Activity size={16} /><span>Heartbeat otomatis setiap 60 detik</span></div>
      </div>
      <div className="decoration-footer">DIBUAT UNTUK OPERASIONAL YANG LEBIH ANDAL</div>
    </div>
    <section className="login-form-panel"><form className="login-form" onSubmit={submit}>
      <div className="mobile-login-brand"><span className="brand-mark"><Activity size={19} /></span><span>pc<span className="brand-light">monitor</span></span></div>
      <div className="form-kicker">SELAMAT DATANG KEMBALI</div><h2>Masuk ke akun Anda</h2><p className="form-intro">Gunakan kredensial administrator untuk melanjutkan.</p>
      <label className="field-label" htmlFor="email">Email administrator</label><div className="input-wrap"><Mail size={17} /><input id="email" type="email" autoComplete="username" placeholder="admin@perusahaan.id" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <label className="field-label" htmlFor="password">Kata sandi</label><div className="input-wrap"><LockKeyhole size={17} /><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan kata sandi" value={password} onChange={(e) => setPassword(e.target.value)} required /><button className="icon-button" type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="primary-button login-submit" type="submit" disabled={loading}>{loading ? "Memverifikasi..." : "Masuk ke dashboard"}<ArrowRight size={17} /></button>
      <div className="login-footnote"><span className="lock-mini"><LockKeyhole size={13} /></span>Sesi Anda dilindungi dengan enkripsi aman</div>
    </form><div className="copyright">© {new Date().getFullYear()} PC Monitor <span>·</span> Monitoring perangkat yang lebih mudah</div></section>
  </main>;
}
