"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Download,
  HardDrive,
  Info,
  Play,
  RotateCcw,
  ShieldCheck,
  Square,
  Terminal,
  Wifi,
} from "lucide-react";

export default function HelpPage() {
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMap((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => {
        setCopiedMap((prev) => ({ ...prev, [key]: false }));
      }, 2000);
    } catch {}
  };

  return (
    <div className="dashboard-page">
      <div className="page-heading">
        <div>
          <div className="date-kicker">DOKUMENTASI & PANDUAN <span>•</span> PUSAT BANTUAN</div>
          <h1>Pusat Bantuan Agent</h1>
          <p>Panduan lengkap instalasi, cara menjalankan di background, memeriksa status, dan menghentikan agent pada PC atau laptop klien.</p>
        </div>
      </div>

      <div className="quick-nav">
        <a href="#instal" className="quick-nav-pill"><Download size={13} /> Cara Instal</a>
        <a href="#run" className="quick-nav-pill"><Play size={13} /> Cara Menjalankan & Cek</a>
        <a href="#stop" className="quick-nav-pill"><Square size={13} /> Cara Menghentikan / Stop</a>
        <a href="#troubleshoot" className="quick-nav-pill"><AlertCircle size={13} /> Pemecahan Masalah</a>
      </div>

      <div className="help-grid">
        {/* TAHAP 1: PERSIAPAN */}
        <section className="help-card" id="persiapan">
          <div className="help-card-header">
            <div className="help-step-badge">1</div>
            <div className="help-card-title">
              <h3>Persiapan: Dapatkan Token & Siapkan Folder Agent</h3>
              <p>Langkah awal sebelum memasang agent di PC atau laptop yang ingin dipantau.</p>
            </div>
          </div>
          <div className="help-body">
            <p>1. Masuk ke menu <b>Perangkat</b> di dashboard ini, lalu klik tombol <b>+ Tambah perangkat</b>.</p>
            <p>2. Beri nama komputer (misal: <code>PC-TU-01</code>) dan pilih lokasi kantor.</p>
            <p>3. <b>Salin Token Agent</b> yang muncul di layar popup. Token ini bersifat rahasia dan hanya ditampilkan sekali saat dibuat.</p>
            <p>4. Salin seluruh isi folder <code>agent/windows</code> dari project ini ke komputer/laptop yang akan dipantau (misalnya disimpan di <code>C:\MonitoringAgent</code> atau <code>D:\pc-monitor-agent</code>).</p>
            <div className="help-alert">
              <Info size={16} />
              <span>
                <b>Tips:</b> Folder <code>agent/windows</code> berisi script <code>pc-monitor-agent.ps1</code>, file instalasi <code>install-agent.bat</code>, dan uninstaller <code>uninstall-agent-task.ps1</code>.
              </span>
            </div>
          </div>
        </section>

        {/* TAHAP 2: CARA INSTAL */}
        <section className="help-card" id="instal">
          <div className="help-card-header">
            <div className="help-step-badge green">2</div>
            <div className="help-card-title">
              <h3>Cara Instal Agent (Background & Auto-Start Saat Komputer Nyala)</h3>
              <p>Agent akan dipasang ke Windows Task Scheduler agar berjalan otomatis tanpa jendela terminal.</p>
            </div>
          </div>
          <div className="help-body">
            <p>Pilih salah satu metode instalasi berikut pada komputer klien:</p>

            <b style={{ color: "#253448" }}>Metode A: Menggunakan File Batch (Paling Praktis)</b>
            <ul>
              <li>Buka folder <code>agent/windows</code> yang sudah Anda salin ke komputer klien.</li>
              <li>Klik dua kali file <b><code>install-agent.bat</code></b> (atau klik kanan ➔ <i>Run as administrator</i> jika ada).</li>
              <li>Jendela CMD akan terbuka dan menanyakan:
                <ul>
                  <li><b>URL Server:</b> Masukkan alamat web dashboard monitoring (contoh: <code>http://localhost:3000</code> atau domain Vercel / server kantor Anda).</li>
                  <li><b>Token Agent:</b> Tempelkan (paste) token perangkat yang disalin pada Langkah 1.</li>
                </ul>
              </li>
              <li>Tekan Enter. Script akan otomatis mengonfigurasi dan mendaftarkan Scheduled Task di Windows.</li>
            </ul>

            <b style={{ color: "#253448", marginTop: 8 }}>Metode B: Menggunakan PowerShell</b>
            <p>Buka PowerShell di folder agent dan jalankan perintah berikut:</p>
            <div className="help-code-box">
              <code>powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\install-agent-task.ps1</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("ps-install", "powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\\install-agent-task.ps1")}
              >
                {copiedMap["ps-install"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["ps-install"] ? "Tersalin" : "Salin"}
              </button>
            </div>

            <div className="help-alert">
              <ShieldCheck size={16} />
              <div>
                <b>Apa yang terjadi setelah instalasi?</b>
                <div style={{ marginTop: 3 }}>
                  • Task Windows bernama <b><code>PCMonitorAgent</code></b> aktif di latar belakang.<br />
                  • Setiap komputer dinyalakan atau user login, agent otomatis bekerja mengirim data metrik setiap 60 detik.<br />
                  • Tidak ada jendela konsol/CMD yang mengganggu aktivitas pengguna komputer.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TAHAP 3: CARA RUN & CEK STATUS */}
        <section className="help-card" id="run">
          <div className="help-card-header">
            <div className="help-step-badge">3</div>
            <div className="help-card-title">
              <h3>Cara Memeriksa Status & Menjalankan Agent</h3>
              <p>Memastikan agent sedang berjalan dengan benar dan memantau log aktivitasnya.</p>
            </div>
          </div>
          <div className="help-body">
            <b style={{ color: "#253448" }}>1. Cek Status Scheduled Task di Windows</b>
            <p>Untuk melihat apakah task sedang aktif atau berjalan di background, jalankan di PowerShell:</p>
            <div className="help-code-box">
              <code>Get-ScheduledTask -TaskName PCMonitorAgent</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("check-task", "Get-ScheduledTask -TaskName PCMonitorAgent")}
              >
                {copiedMap["check-task"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["check-task"] ? "Tersalin" : "Salin"}
              </button>
            </div>

            <b style={{ color: "#253448", marginTop: 6 }}>2. Membaca Log Pengiriman Metrik (Realtime)</b>
            <p>Setiap pengiriman heartbeat dan metrik (RAM, Disk, Ping) dicatat ke <code>agent.log</code>. Pantau log secara langsung dengan:</p>
            <div className="help-code-box">
              <code>Get-Content .\agent.log -Tail 15 -Wait</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("tail-log", "Get-Content .\\agent.log -Tail 15 -Wait")}
              >
                {copiedMap["tail-log"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["tail-log"] ? "Tersalin" : "Salin"}
              </button>
            </div>

            <b style={{ color: "#253448", marginTop: 6 }}>3. Menjalankan Manual untuk Uji Coba (Foreground)</b>
            <p>Jika ingin melihat proses pengiriman langsung di layar terminal saat debugging:</p>
            <div className="help-code-box">
              <code>powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\pc-monitor-agent.ps1</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("run-fg", "powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\\pc-monitor-agent.ps1")}
              >
                {copiedMap["run-fg"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["run-fg"] ? "Tersalin" : "Salin"}
              </button>
            </div>
          </div>
        </section>

        {/* TAHAP 4: CARA STOP & UNINSTALL */}
        <section className="help-card" id="stop">
          <div className="help-card-header">
            <div className="help-step-badge red">4</div>
            <div className="help-card-title">
              <h3>Cara Menghentikan (Stop) & Menghapus Agent</h3>
              <p>Langkah untuk menghentikan proses sementara atau mencopot instalasi agent secara menyeluruh.</p>
            </div>
          </div>
          <div className="help-body">
            <b style={{ color: "#253448" }}>Opsi A: Copot & Hapus Task Secara Total (Uninstall)</b>
            <p>Pilih salah satu cara berikut untuk mencopot agent:</p>
            <ul>
              <li><b>Cara Paling Praktis:</b> Cukup klik dua kali file <b><code>uninstall-agent.bat</code></b> di folder agent.</li>
              <li><b>Lewat PowerShell:</b> Jalankan perintah berikut:</li>
            </ul>
            <div className="help-code-box">
              <code>powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\uninstall-agent-task.ps1</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("uninstall", "powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\\uninstall-agent-task.ps1")}
              >
                {copiedMap["uninstall"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["uninstall"] ? "Tersalin" : "Salin"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#748496" }}>
              Script ini akan langsung mematikan proses background yang aktif, menghapus task di Windows Scheduled Task, serta membersihkan file startup otomatis.
            </p>

            <b style={{ color: "#253448", marginTop: 6 }}>Opsi B: Menghentikan Sementara (Tanpa Hapus Task)</b>
            <p>Jika hanya ingin menghentikan pemantauan untuk sementara waktu:</p>
            <div className="help-code-box">
              <code>Stop-ScheduledTask -TaskName PCMonitorAgent</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("stop-task", "Stop-ScheduledTask -TaskName PCMonitorAgent")}
              >
                {copiedMap["stop-task"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["stop-task"] ? "Tersalin" : "Salin"}
              </button>
            </div>

            <b style={{ color: "#253448", marginTop: 6 }}>Menjalankan Kembali Task yang Dihentikan:</b>
            <div className="help-code-box">
              <code>Start-ScheduledTask -TaskName PCMonitorAgent</code>
              <button
                className="help-copy-btn"
                onClick={() => copyText("start-task", "Start-ScheduledTask -TaskName PCMonitorAgent")}
              >
                {copiedMap["start-task"] ? <Check size={12} /> : <Copy size={12} />}
                {copiedMap["start-task"] ? "Tersalin" : "Salin"}
              </button>
            </div>
          </div>
        </section>

        {/* TAHAP 5: PEMECAHAN MASALAH & SPESIFIKASI METRIK */}
        <section className="help-card" id="troubleshoot">
          <div className="help-card-header">
            <div className="help-step-badge orange">5</div>
            <div className="help-card-title">
              <h3>Pemecahan Masalah (Troubleshooting) & Penjelasan Metrik</h3>
              <p>Solusi untuk kendala umum saat instalasi dan penjelasan angka metrik di dashboard.</p>
            </div>
          </div>
          <div className="help-body">
            <div style={{ display: "grid", gap: 14 }}>
              <article>
                <b style={{ color: "#253448" }}>Kendala: Error "Register-ScheduledTask : Access is denied"</b>
                <p>Pesan ini muncul jika mendaftarkan Task Scheduler tanpa hak Administrator. Script installer versi terbaru <b>sudah otomatis beralih (fallback) ke mode Windows User Startup</b> sehingga agent tetap terpasang dan aktif di background secara otomatis tanpa memerlukan hak Administrator sama sekali. Jika Anda ingin memasangnya ke Task Scheduler sistem, cukup klik kanan <code>install-agent.bat</code> lalu pilih <b>"Run as administrator"</b>.</p>
              </article>

              <article>
                <b style={{ color: "#253448" }}>Kendala: Error "running scripts is disabled on this system"</b>
                <p>Windows PowerShell secara default membatasi eksekusi file script. Pastikan selalu menyertakan flag <code>-ExecutionPolicy Bypass</code> ketika memanggil file script, atau gunakan file <code>install-agent.bat</code> yang sudah otomatis menyertakan parameter tersebut.</p>
              </article>

              <article>
                <b style={{ color: "#253448" }}>Kendala: Status Perangkat Tetap "Belum Online" atau "Offline"</b>
                <ul>
                  <li>Pastikan komputer target terhubung ke jaringan internet/intranet yang bisa menjangkau URL server.</li>
                  <li>Periksa apakah URL Server dapat diakses dari browser komputer klien.</li>
                  <li>Periksa log di <code>agent.log</code>. Jika terdapat error <code>401</code>, berarti token agent salah atau sudah diganti/dirotasi di dashboard.</li>
                </ul>
              </article>

              <article>
                <b style={{ color: "#253448" }}>Arti Angka Metrik di Dashboard:</b>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 8 }}>
                  <div style={{ padding: 12, background: "#f8fafd", border: "1px solid #e3e9f3", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#365ea0", marginBottom: 4 }}>
                      <Cpu size={15} /> Memori RAM
                    </div>
                    <small style={{ color: "#637488", fontSize: 11 }}>
                      Menampilkan persentase RAM yang terpakai serta kapasitas GB (contoh: <code>8.2 / 16.0 GB</code>). Warna kuning/merah muncul jika pemakaian &gt; 75%.
                    </small>
                  </div>
                  <div style={{ padding: 12, background: "#f8fafd", border: "1px solid #e3e9f3", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#365ea0", marginBottom: 4 }}>
                      <HardDrive size={15} /> Storage Drive C:
                    </div>
                    <small style={{ color: "#637488", fontSize: 11 }}>
                      Menampilkan sisa ruang kosong pada hard disk sistem operasi utama. Berwarna merah jika ruang kosong menipis (&gt; 90% terpakai).
                    </small>
                  </div>
                  <div style={{ padding: 12, background: "#f8fafd", border: "1px solid #e3e9f3", borderRadius: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: "#365ea0", marginBottom: 4 }}>
                      <Wifi size={15} /> Ping / Latency
                    </div>
                    <small style={{ color: "#637488", fontSize: 11 }}>
                      Mengukur waktu bolak-balik (RTT) paket data ke DNS 8.8.8.8. <code>&lt; 50 ms</code>: Sangat Baik, <code>50-120 ms</code>: Normal/Stabil, <code>&gt; 200 ms</code>: Jaringan Lambat.
                    </small>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

