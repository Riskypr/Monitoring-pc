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
        <p>Unduh paket agent untuk komputer Windows. Setelah diunduh, ekstrak folder ZIP lalu jalankan installer. Anda tidak perlu login untuk mengunduh.</p>
        <div className="download-platform"><Monitor size={15} /> Windows 10 dan 11 <span>•</span> 64-bit</div>
      </div>
      <div className="download-hero-art" aria-hidden="true"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-monitor"><div className="hero-screen"><span className="hero-screen-brand"><Activity size={16} /></span><i /><i /><i /><div className="hero-pulse"><span /><span /><span /><span /><span /><span /><span /></div><small>AGENT AKTIF</small></div><div className="hero-monitor-stand" /></div><div className="hero-status"><span className="live-dot" /> Terhubung</div></div>
    </section>

    <section className="download-section">
      <div className="download-section-heading"><div><div className="date-kicker">PAKET RESMI <span>•</span> WINDOWS</div><h2>Pilih file yang dibutuhkan</h2><p>Unduhan langsung, tanpa akun admin.</p></div><span className="download-version"><ShieldCheck size={14} /> Paket agent Windows</span></div>
      <div className="download-cards">
        <article className="download-card install-card"><div className="download-card-top"><span className="download-file-icon blue"><FileArchive size={20} /></span><span className="download-tag">UNTUK PEMASANGAN BARU</span></div><h3>Installer agent</h3><p>Paket lengkap untuk memasang agent dan menghapusnya nanti jika diperlukan. Termasuk script agent, installer, dan uninstaller.</p><div className="download-includes"><span><Check size={13} /> Installer Windows</span><span><Check size={13} /> Script agent & konfigurasi</span><span><Check size={13} /> Uninstaller</span></div><a className="primary-button download-action" href="/downloads/pc-monitor-agent-windows.zip" download><ArrowDownToLine size={16} />Unduh installer <span>.ZIP</span></a><small className="download-file-note">ZIP · Ekstrak sebelum dijalankan</small></article>
        <article className="download-card uninstall-card"><div className="download-card-top"><span className="download-file-icon orange"><FileArchive size={20} /></span><span className="download-tag">UNTUK MENGHAPUS AGENT</span></div><h3>Uninstaller agent</h3><p>Jika agent sudah terpasang, gunakan paket ringkas ini untuk menghentikan dan menghapus konfigurasi auto-start dari komputer.</p><div className="download-includes"><span><Check size={13} /> Penghapus Task Scheduler</span><span><Check size={13} /> Penghapus Windows Startup</span><span><Check size={13} /> Hapus konfigurasi lokal</span></div><a className="secondary-button download-action" href="/downloads/pc-monitor-agent-uninstaller-windows.zip" download><ArrowDownToLine size={16} />Unduh uninstaller <span>.ZIP</span></a><small className="download-file-note">ZIP · Ekstrak sebelum dijalankan</small></article>
      </div>
    </section>

    <section className="download-steps"><div className="download-steps-title"><span className="download-file-icon violet"><Terminal size={19} /></span><div><h2>Cara memasang agent</h2><p>Siapkan komputer pada dashboard sebelum instalasi.</p></div></div><div className="download-step-list"><div><b>01</b><span><strong>Admin daftarkan perangkat</strong><small>Administrator membuat perangkat di dashboard dan menyalin token agent.</small></span></div><div><b>02</b><span><strong>Ekstrak dan jalankan installer</strong><small>Ekstrak ZIP, lalu klik dua kali <code>install-agent.bat</code>.</small></span></div><div><b>03</b><span><strong>Masukkan URL server dan token</strong><small>Ikuti prompt installer. Agent berjalan otomatis setelah konfigurasi.</small></span></div></div><div className="download-help-note"><LockKeyhole size={15} /><span>Unduhan ini tidak memuat token. Minta URL server dan token perangkat kepada administrator Anda.</span><Link href="/login">Login admin <ArrowRight size={13} /></Link></div></section>

    <footer className="download-footer"><span>© {new Date().getFullYear()} PC Monitor <i>·</i> Monitoring perangkat yang lebih mudah</span><Link href="/login"><CircleHelp size={13} /> Butuh bantuan admin?</Link></footer>
  </main>;
}
