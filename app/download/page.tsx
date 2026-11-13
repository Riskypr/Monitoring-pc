import Link from "next/link";
import { Activity, ArrowDownToLine, ArrowRight, Check, CircleHelp, FileArchive, LockKeyhole, Monitor, ShieldCheck, Terminal } from "lucide-react";

export const metadata = {
  title: "Unduh Agent — PC Monitor",
  description: "Unduh installer dan uninstaller agent PC Monitor untuk Windows.",
};

export default function DownloadPage() {
  return <main className="download-page">
    <header className="download-header">
      <Link className="login-brand" href="/download"><span className="brand-mark"><Activity size={20} /></span><span>pc<span className="brand-light">monitor</span></span></Link>
      <Link className="download-admin-link" href="/login">Login administrator<ArrowRight size={14} /></Link>
    </header>

    <section className="download-hero">
      <div className="download-hero-copy">
        <div className="download-eyebrow"><span className="live-dot" /> DISTRIBUSI AGENT WINDOWS</div>
        <h1>Agent PC Monitor,<br /><span>siap dipasang.</span></h1>
        <p>Unduh paket agent untuk komputer Windows. Setelah diunduh, ekstrak folder ZIP lalu jalankan installer. Agent memantau status perangkat dan penggunaan resource sistem.</p>
        <div className="download-platform"><Monitor size={15} /> Windows 10 dan 11 <span>•</span> 64-bit</div>
      </div>
      <div className="download-hero-art" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-monitor"><div className="hero-screen"><span className="hero-screen-brand"><Activity size={16} /></span><i /><i /><i /><div className="hero-pulse"><span /><span /><span /><span /><span /><span /><span /></div><small>AGENT AKTIF</small></div><div className="hero-monitor-stand" /></div><div className="hero-status"><span className="live-dot" /> Terhubung</div></div>
    </section>

    <section className="download-section">
      <div className="download-section-heading"><div><div className="date-kicker">PAKET RESMI <span>•</span> WINDOWS</div><h2>Unduh paket agent</h2><p>Unduhan langsung, tanpa akun admin.</p></div><span className="download-version"><ShieldCheck size={14} /> Paket agent Windows</span></div>
      <div className="download-cards">
        <article className="download-card install-card"><div className="download-card-top"><span className="download-file-icon blue"><FileArchive size={20} /></span><span className="download-tag">INSTALLER & UNINSTALLER DALAM SATU PAKET</span></div><h3>PC Monitor Agent untuk Windows</h3><p>Paket lengkap untuk memasang agent. Jika ingin mencopotnya nanti, file uninstaller sudah tersedia di dalam ZIP yang sama.</p><div className="download-includes"><span><Check size={13} /> Installer Windows</span><span><Check size={13} /> Script agent & konfigurasi</span><span><Check size={13} /> Uninstaller <code>uninstall-agent.bat</code></span></div><a className="primary-button download-action" href="/downloads/pc-monitor-agent-windows.zip" download><ArrowDownToLine size={16} />Unduh paket agent <span>.ZIP</span></a><small className="download-file-note">ZIP · Ekstrak sebelum dijalankan</small></article>
      </div>
    </section>

    <section className="download-steps"><div className="download-steps-title"><span className="download-file-icon violet"><Terminal size={19} /></span><div><h2>Cara memasang agent</h2><p>Siapkan komputer pada dashboard sebelum instalasi.</p></div></div><div className="download-step-list"><div><b>01</b><span><strong>Admin daftarkan perangkat</strong><small>Administrator membuat perangkat di dashboard dan menyalin token agent.</small></span></div><div><b>02</b><span><strong>Ekstrak dan jalankan installer</strong><small>Ekstrak ZIP, lalu klik dua kali <code>install-agent.bat</code>.</small></span></div><div><b>03</b><span><strong>Masukkan URL server dan token</strong><small>Ikuti prompt installer. Agent berjalan otomatis setelah konfigurasi.</small></span></div><div><b>04</b><span><strong>Jika ingin mencopot agent</strong><small>Jalankan <code>uninstall-agent.bat</code> dari folder ZIP yang diekstrak.</small></span></div></div><div className="download-help-note"><LockKeyhole size={15} /><span>Unduhan ini tidak memuat token. Minta URL server dan token perangkat kepada administrator Anda.</span><Link href="/login">Login admin <ArrowRight size={13} /></Link></div></section>

    <footer className="download-footer"><span>© {new Date().getFullYear()} PC Monitor <i>·</i> Monitoring perangkat yang lebih mudah</span><Link href="/login"><CircleHelp size={13} /> Butuh bantuan admin?</Link></footer>
  </main>;
}
