# PC Monitor

Aplikasi web untuk memantau PC yang online/offline melalui heartbeat HTTPS, dibangun dengan Next.js App Router, TypeScript, Prisma, dan PostgreSQL (Neon).

## Jalankan secara lokal

Prasyarat: Node.js 20.19+ dan database PostgreSQL yang dapat diakses dari komputer Anda.

1. Salin `.env.example` menjadi `.env` dan isi `DATABASE_URL`, `AUTH_SECRET` (minimal 32 karakter), `ADMIN_EMAIL`, dan `ADMIN_PASSWORD`.
2. Instal dependensi: `npm install`.
3. Buat tabel database: `npx prisma migrate dev --name init`.
4. Jalankan aplikasi: `npm run dev`, lalu buka `http://localhost:3000`.

`ADMIN_PASSWORD` dapat berisi kata sandi biasa untuk setup awal, atau bcrypt hash `$2b$...`. Jangan gunakan kata sandi biasa yang lemah pada production. Buat secret dengan `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

## Pasang agent Windows (Background & Auto-Start)

1. Buat perangkat dari menu **Perangkat** di dashboard dan salin token agent.
2. Salin folder `agent/windows` ke PC yang ingin dipantau.
3. Jalankan **`install-agent.bat`** (atau via PowerShell: `.\install-agent-task.ps1`).
4. Masukkan URL server (misal `https://your-domain.vercel.app` atau `http://localhost:3000`) dan token perangkat saat diminta.
5. Selesai! Agent otomatis didaftarkan sebagai Windows Scheduled Task:
   - **Berjalan di background** (tanpa jendela terminal terbuka).
   - **Otomatis berjalan saat komputer dinyalakan / login**.
   - Melakukan monitoring berkala: **IPv4 Lokal, Penggunaan RAM %, Sisa Storage (Drive C:), dan Latency Internet**.
   - Untuk mencopot/menghentikan agent, cukup jalankan **`uninstall-agent.bat`** (atau via PowerShell: `.\uninstall-agent-task.ps1`).
   - Log aktivitas tersimpan otomatis di `agent.log`.

Agent mengirim IPv4 lokal tiap 60 detik. IP publik dicatat dari header koneksi yang diterima server. Status berubah menjadi offline setelah 180 detik tanpa heartbeat. Reboot atau jaringan putus akan ditampilkan offline hingga heartbeat diterima kembali.

### Pemantauan internet dan Ookla

Agent Windows juga menguji dua endpoint HTTPS independen dan API PC Monitor setiap siklus heartbeat, lalu mengirim hasil konektivitas secara terpisah. Speed test otomatis berjalan tiap 30 menit dengan jeda acak; admin dapat mengubah interval (minimum 15 menit), threshold, dan menonaktifkan speed test otomatis dari detail perangkat. Tombol **Test Internet Now** mengantrikan command yang diambil agent melalui polling outbound. Agent harus sedang berjalan dan dapat menjangkau API agar tes manual diterima.

Ookla Speedtest CLI tidak disertakan dalam paket agent. Pasang CLI resmi Ookla pada PC target dan pastikan `speedtest.exe` tersedia di `PATH`; agent menerima lisensi dan ketentuan CLI pada eksekusi pertama. Sebelum memasang atau mendistribusikan CLI, admin harus meninjau [EULA](https://www.speedtest.net/about/eula), [Terms](https://www.speedtest.net/about/terms), dan [Privacy Policy](https://www.speedtest.net/about/privacy) Ookla untuk konteks penggunaan organisasi. Agent mengonversi bandwidth JSON Ookla dari byte/detik menjadi Mbps desimal.

Setelah perubahan schema, jalankan migrasi pada database target dengan `npx prisma migrate deploy`, lalu deploy aplikasi dan perbarui agent Windows. Job retensi harian menghapus connectivity check setelah 14 hari, speed test dan heartbeat setelah 90 hari, serta command terminal setelah 30 hari. Ringkasan harian 12 bulan belum dibuat.

## Deployment Vercel + Neon

1. Push repository ini ke GitHub, kemudian impor di Vercel.
2. Buat database Neon dan isi `DATABASE_URL` pooled PostgreSQL di Vercel Environment Variables. Isi `DIRECT_URL` dengan URL non-pooled untuk migrasi Prisma.
3. Atur `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `APP_URL`, dan `CRON_SECRET` di environment Development/Preview/Production sesuai lingkungan. Jangan menambahkan secret dengan awalan `NEXT_PUBLIC_`.
4. Jalankan migrasi terkontrol terhadap database target: `npx prisma migrate deploy`.
5. Deploy aplikasi. Atur `PCMONITOR_SERVER_URL` pada PC agent ke URL production HTTPS.

Untuk deployment production, gunakan password administrator yang kuat atau bcrypt hash, secret terpisah per environment, dan kredensial Preview yang terpisah dari Production. Simpan log agent secara lokal sesuai kebijakan operasional.

## Fitur MVP

- Login admin dengan sesi HTTP-only yang ditandatangani HMAC.
- Dashboard statistik dan tabel perangkat dengan pencarian, filter lokasi/status, serta pagination.
- Registrasi, pengeditan dasar, aktivasi/nonaktif, dan rotasi token per perangkat.
- Hash token di database, endpoint heartbeat tervalidasi, pencatatan IP dan riwayat.
- Deteksi status dengan interval 60 detik dan ambang offline 180 detik.
- Monitoring konektivitas dan Ookla per perangkat, command speed test manual, threshold dan ringkasan kualitas jaringan.
- Audit log dan pemeriksaan kesehatan aplikasi/database di `/api/health`.

Ketersediaan dihitung dari jumlah perangkat online dibanding seluruh perangkat aktif. Heartbeat berumur lebih dari 90 hari dihapus oleh Vercel Cron harian. Pastikan `CRON_SECRET` tersedia untuk mengizinkan tugas retensi. Agent Windows PowerShell disertakan sebagai implementasi awal.
