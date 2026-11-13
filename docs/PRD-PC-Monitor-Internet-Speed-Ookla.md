# PRD — PC Monitor: Internet Speed & Connection Quality Monitoring

**Versi:** 1.0  
**Tanggal:** 12 November 2026  
**Jenis:** Feature enhancement

## 1. Ringkasan

Fitur ini menambahkan pemantauan kualitas internet setiap PC Windows yang terdaftar pada PC Monitor. Pengukuran bandwidth dilakukan langsung di perangkat target menggunakan **Ookla Speedtest CLI**. Windows Agent mengirim hasilnya ke API Next.js di Vercel, kemudian disimpan di Neon PostgreSQL dan ditampilkan pada dashboard admin.

Fitur juga menjalankan connectivity check ringan secara berkala agar admin dapat membedakan internet down, koneksi lambat/tidak stabil, agent offline, dan API PC Monitor yang tidak dapat dijangkau.

## 2. Tujuan

1. Mengetahui PC mana yang internetnya normal, lambat, tidak stabil, atau down.
2. Menampilkan download, upload, latency, jitter, dan packet loss jika tersedia.
3. Menyediakan riwayat hasil pengukuran per perangkat.
4. Memungkinkan admin meminta speed test manual dari dashboard.
5. Menjaga penggunaan bandwidth dan resource PC tetap terkendali.
6. Menyediakan alert saat gangguan dimulai dan saat koneksi pulih.

## 3. Teknologi dan Arsitektur

| Komponen | Teknologi | Tanggung jawab |
|---|---|---|
| Dashboard | Next.js App Router + TypeScript | UI admin |
| Hosting/API | Vercel | Menerima data dan mengelola perintah |
| Database | Neon PostgreSQL | Menyimpan perangkat, hasil tes, status, dan konfigurasi |
| ORM | Prisma | Akses database |
| Agent | Windows Service | Heartbeat, connectivity check, eksekusi CLI |
| Speed test | Ookla Speedtest CLI | Mengukur performa internet di PC target |

Ookla CLI harus dijalankan di PC target, bukan di Vercel. Dengan begitu hasil mencerminkan koneksi internet PC tersebut. Agent memulai koneksi outbound HTTPS ke server; tidak perlu membuka port masuk pada router hanya untuk mengirim heartbeat.

## 4. Ruang Lingkup

### 4.1 Connectivity Check

Agent melakukan pemeriksaan ringan setiap 60 detik (default):
- Gateway lokal jika dapat diketahui.
- Minimal dua endpoint internet independen melalui HTTPS/TCP.
- Endpoint API PC Monitor secara terpisah.
- Catat waktu, latency jika tersedia, hasil, dan error.

Jangan hanya mengandalkan ICMP ping karena dapat diblokir firewall. Kegagalan satu endpoint tidak boleh langsung dianggap internet down.

Status konektivitas:
- `connected`: endpoint internet berhasil diakses.
- `degraded`: internet dapat diakses tetapi metrik melewati threshold.
- `internet_down`: beberapa endpoint independen gagal dalam jumlah pemeriksaan berturut-turut.
- `unknown`: data tidak cukup.
- Status API disimpan terpisah sebagai `api_reachable` / `api_unreachable`.

### 4.2 Ookla Speed Test

Agent menjalankan Ookla Speedtest CLI dan menggunakan output JSON/JSON terstruktur untuk parsing.

Metrik:
- Download Mbps.
- Upload Mbps.
- Latency ms.
- Jitter ms.
- Packet loss persen jika tersedia.
- Server ID/nama server jika tersedia.
- Public IP hasil tes jika tersedia.
- Waktu mulai/selesai dan durasi.
- Status sukses/gagal, error, dan versi CLI.

Validasi unit output CLI sebelum konversi. Untuk output bandwidth dalam byte per detik, konversi:
`Mbps = bytes_per_second × 8 / 1,000,000`

Jika packet loss tidak tersedia, simpan `null`, bukan `0`. Jangan menganggap nilai JSON otomatis sudah Mbps.

### 4.3 Jadwal

| Pemeriksaan | Default |
|---|---:|
| Heartbeat | 60 detik |
| Connectivity check | 60 detik |
| Ookla speed test otomatis | 30 menit |
| Speed test manual | Atas permintaan admin |

Interval speed test dapat dikonfigurasi. Rekomendasi minimum awal 15 menit, default 30 menit. Terapkan random jitter agar semua PC tidak menguji bersamaan. Maksimal satu speed test aktif per PC. Sediakan timeout dan cooldown setelah kegagalan.

### 4.4 Manual Speed Test

Admin menekan **Test Internet Now** pada detail perangkat:
1. API membuat command/job dengan ID unik dan waktu kedaluwarsa.
2. Agent mengambil command melalui polling outbound.
3. Agent memvalidasi command dan menjalankan Ookla CLI.
4. Agent mengirim hasil atau error.
5. Dashboard menampilkan `queued`, `running`, `completed`, atau `failed`.

Jangan mengandalkan koneksi masuk dari Vercel ke PC. Gunakan polling command oleh agent atau kanal outbound yang sudah ada.

## 5. Penentuan Status

Threshold awal berikut dapat dikonfigurasi dan bukan standar universal:

| Status | Aturan awal |
|---|---|
| Normal | Internet reachable dan metrik memenuhi threshold |
| Slow | Download di bawah 5 Mbps atau upload di bawah 1 Mbps |
| Unstable | Jitter di atas 30 ms atau packet loss di atas 3% |
| High latency | Latency di atas 150 ms |
| Internet Down | Beberapa endpoint independen gagal 3 kali berturut-turut |
| Agent Offline | Tidak ada heartbeat lebih dari 180 detik |
| API Unreachable | Internet umum reachable tetapi API PC Monitor gagal |
| Unknown/Stale | Data belum cukup atau terlalu lama |

Penting:
- `Agent Offline` tidak otomatis berarti `Internet Down`.
- Speed test gagal tidak otomatis berarti internet down; gunakan connectivity check.
- Jika PC benar-benar kehilangan internet, agent tidak dapat mengirim alert saat itu juga. Server hanya melihat heartbeat berhenti. Agent dapat melaporkan recovery setelah koneksi pulih.
- Untuk membedakan PC mati dari internet lokasi putus secara pasti, dibutuhkan jalur monitoring independen seperti VPN/site gateway atau perangkat monitoring lain di lokasi.

## 6. User Stories

- Admin dapat melihat status internet seluruh PC.
- Admin dapat membandingkan download/upload antarperangkat.
- Admin dapat melihat latency, jitter, dan packet loss.
- Admin dapat membuka histori dan grafik per perangkat.
- Admin dapat meminta speed test manual.
- Admin dapat mengubah interval dan threshold.
- Admin dapat menonaktifkan speed test otomatis tanpa mematikan heartbeat.
- Admin menerima alert gangguan dan recovery tanpa notifikasi duplikat.

## 7. Rancangan Database Prisma

Sesuaikan rancangan ini dengan schema PC Monitor yang sudah ada. Jangan membuat model Device duplikat.

### NetworkMeasurement
- `id`
- `deviceId`
- `downloadMbps` Float?
- `uploadMbps` Float?
- `latencyMs` Float?
- `jitterMs` Float?
- `packetLossPercent` Float?
- `serverId` String?
- `serverName` String?
- `publicIp` String?
- `ooklaVersion` String?
- `status` (success/failed)
- `errorMessage` String?
- `startedAt`
- `completedAt`
- `createdAt`

Index: `(deviceId, completedAt)`, `(status, completedAt)`.

### ConnectivityCheck
- `id`
- `deviceId`
- `gatewayReachable` Boolean?
- `internetReachable` Boolean
- `apiReachable` Boolean
- `latencyMs` Float?
- `packetLossPercent` Float?
- `failedChecks` Int
- `status`
- `checkedAt`
- `createdAt`

Index: `(deviceId, checkedAt)`, `(status, checkedAt)`.

### NetworkSettings
- `id`
- `deviceId` nullable untuk pengaturan global
- `connectivityIntervalSeconds`
- `speedTestIntervalMinutes`
- `speedTestEnabled`
- `slowDownloadThresholdMbps`
- `slowUploadThresholdMbps`
- `highLatencyThresholdMs`
- `highJitterThresholdMs`
- `highPacketLossThresholdPercent`
- `consecutiveFailuresBeforeDown`
- `updatedAt`

### AgentCommand
- `id`
- `deviceId`
- `commandType` (RUN_SPEEDTEST, UPDATE_SETTINGS, DISABLE_NETWORK_MONITORING)
- `payload` JSON
- `status` (queued/running/completed/failed/expired)
- `requestedBy`
- `createdAt`
- `expiresAt`
- `completedAt`
- `result` JSON?

## 8. API Requirements

Rute berikut merupakan rancangan dan perlu diselaraskan dengan konvensi project:
- `POST /api/agent/network/connectivity` — menerima connectivity check.
- `POST /api/agent/network/speedtest` — menerima hasil Ookla.
- `GET /api/agent/commands` — agent mengambil command.
- `POST /api/agent/commands/:id/result` — agent melaporkan hasil command.
- `GET /api/devices/:id/network` — ringkasan jaringan.
- `GET /api/devices/:id/network/history` — histori.
- `POST /api/devices/:id/network/speedtest` — admin meminta speed test.
- `PATCH /api/devices/:id/network/settings` — mengubah pengaturan.

Keamanan:
- Token unik per perangkat; server menyimpan hash token.
- Autentikasi admin menggunakan sistem login PC Monitor.
- Cocokkan token dengan device ID; device ID saja bukan bukti identitas.
- Validasi angka, timestamp, ukuran payload, dan tipe data.
- Rate limit per perangkat.
- Gunakan request ID/command ID untuk mencegah duplikasi dan replay.
- Jangan pernah mengirim token agent ke browser.
- Audit log tindakan admin yang sensitif.

## 9. Dashboard

### Network Overview
Kartu ringkasan:
- Total PC.
- Internet normal.
- Internet lambat.
- Internet down.
- Agent offline.
- Speed test gagal.

### Tabel perangkat
Kolom:
- Nama PC dan lokasi.
- Status agent.
- Status internet.
- Download/upload.
- Latency/jitter/packet loss.
- Waktu tes terakhir.
- Aksi.

Filter berdasarkan lokasi, status, dan rentang waktu. Pencarian berdasarkan nama PC, device ID, atau IP.

### Detail perangkat
- Status terkini dan umur data.
- Hasil Ookla terakhir dan server yang dipakai.
- Grafik histori download/upload.
- Grafik latency/jitter/packet loss.
- Riwayat error.
- Tombol **Test Internet Now**.
- Pengaturan interval dan threshold.

Status harus berupa teks dan warna; jangan hanya mengandalkan warna.

## 10. Alert

Trigger:
- Internet down setelah 3 pemeriksaan berturut-turut gagal.
- Internet pulih setelah insiden down.
- Kecepatan di bawah threshold dalam beberapa pengukuran valid.
- Jitter/packet loss tinggi secara berulang.
- Agent offline setelah heartbeat timeout.

Buat satu incident saat gangguan dimulai dan satu recovery event saat pulih. Deduplicate alert agar admin tidak menerima pesan setiap interval. Simpan waktu mulai, waktu pulih, durasi, perangkat, dan ringkasan metrik.

## 11. Kinerja dan Bandwidth

- Connectivity check harus ringan.
- Jangan menjalankan speed test setiap heartbeat.
- Default speed test 30 menit.
- Terapkan random jitter dan antrean.
- Maksimal satu tes aktif per perangkat.
- Terapkan timeout proses dan cooldown.
- Nonaktifkan speed test otomatis tanpa mematikan heartbeat.
- Tampilkan timestamp dan status stale.
- Pilot pada 2–3 PC terlebih dahulu sebelum rollout.

## 12. Instalasi dan Kontrol Agent

- Agent berjalan sebagai Windows Service/background service.
- Otomatis start saat Windows startup.
- Restart jika crash dengan batas restart.
- Log lokal dengan rotasi.
- Laporkan versi agent dan versi Ookla CLI.
- Terima konfigurasi terbaru dari server.
- Dapat menonaktifkan speed test otomatis atau seluruh network monitoring.
- Uninstall secara terkontrol.
- Perintah server memiliki expiry dan divalidasi sebelum dieksekusi.

Menonaktifkan speed test otomatis tidak boleh menghentikan heartbeat. Menonaktifkan monitoring tidak menghapus histori lama.

## 13. Error Handling

Tangani:
- Ookla CLI belum terpasang atau versi tidak kompatibel.
- Ketentuan penggunaan belum diterima.
- JSON tidak valid.
- Server Ookla tidak tersedia.
- DNS atau koneksi internet gagal.
- API Vercel/database tidak tersedia.
- Token invalid/revoked.
- Timeout dan hasil duplikat.

Agent menyimpan data/error sementara secara lokal dan mengirim ulang data yang masih relevan saat koneksi pulih. Batasi ukuran antrean dan jangan tampilkan data lama sebagai kondisi terkini.

## 14. Privasi dan Lisensi

- Beri informasi bahwa agent mengukur kualitas koneksi.
- Kumpulkan data minimum yang diperlukan.
- Batasi akses public IP dan data jaringan untuk admin berwenang.
- Gunakan HTTPS dan lindungi token.
- Tinjau Ookla EULA, Terms of Use, dan Privacy Policy sebelum distribusi.
- Pastikan hak penggunaan sesuai konteks organisasi/komersial. Jangan mengasumsikan lisensi personal otomatis mencakup penggunaan komersial atau distribusi massal.
- Unduh CLI hanya dari sumber resmi Ookla.

Referensi:
- https://www.speedtest.net/apps/cli
- https://www.speedtest.net/about/eula
- https://www.speedtest.net/about/terms
- https://www.speedtest.net/about/privacy

## 15. Acceptance Criteria

1. Agent Windows dapat menjalankan Ookla CLI dan mem-parsing output JSON.
2. Hasil download/upload tersimpan dengan konversi Mbps yang benar.
3. Latency/jitter tersimpan dalam ms; packet loss unavailable disimpan null.
4. Hasil dikirim ke API dengan autentikasi perangkat.
5. Dashboard menampilkan hasil terbaru dan timestamp.
6. Connectivity check membedakan internet reachable dan API unreachable.
7. Internet down tidak langsung disamakan dengan agent offline.
8. Jadwal speed test mengikuti konfigurasi.
9. Admin dapat meminta tes manual dan melihat status job.
10. Tidak ada tes paralel pada satu perangkat.
11. Error CLI/API tidak menghentikan agent secara permanen.
12. Admin dapat menonaktifkan speed test otomatis.
13. Histori dapat difilter perangkat dan rentang waktu.
14. Alert insiden tidak duplikatif.
15. Jadwal antar-PC tidak menyebabkan semua tes berjalan serentak.

## 16. Test Plan

**Unit test**
- Parsing JSON Ookla dan konversi unit.
- Validasi metrik.
- Status threshold.
- Retry/backoff.
- Deduplication incident.
- Token dan command expiry.

**Integration test**
- Agent → Vercel API → Neon.
- Admin membuat command → agent mengambil → hasil tersimpan.
- Pengaturan global dan per perangkat.

**Scenario test**
- Internet normal/lambat/down.
- Latency atau packet loss tinggi.
- Satu endpoint gagal tetapi endpoint lain berhasil.
- API PC Monitor tidak dapat diakses.
- Internet pulih.
- Ookla tidak terinstal.
- Speed test timeout.
- Agent dihentikan.
- Banyak PC memiliki jadwal berbeda.

## 17. Tahapan Implementasi

### Phase 1 — Validasi Ookla
- Uji CLI pada Windows x64.
- Verifikasi lisensi/ketentuan penggunaan.
- Verifikasi struktur JSON dan satuan.
- Uji beberapa jaringan dan server.

### Phase 2 — Backend & Database
- Tambahkan model measurement, connectivity, settings, command.
- Buat API agent dan admin.
- Tambahkan autentikasi, validasi, rate limit, idempotency.

### Phase 3 — Windows Agent
- Integrasikan CLI dan parser.
- Implementasikan connectivity check.
- Scheduler, jitter, cooldown, timeout, retry, local queue.
- Polling command manual.

### Phase 4 — Dashboard
- Overview dan tabel perangkat.
- Detail dan grafik histori.
- Manual speed test.
- Pengaturan threshold/interval.

### Phase 5 — Alert & Hardening
- Incident/recovery.
- Notifikasi.
- Retensi data.
- Uji beban, keamanan, dan pilot rollout.

## 18. Retensi Data

Default awal:
- Connectivity check mentah: 14 hari.
- Speed test mentah: 90 hari.
- Ringkasan harian: 12 bulan.
- Log error: 30 hari.

Gunakan job pembersihan terjadwal dan query agregat agar dashboard tidak membaca seluruh data mentah.

## 19. Keputusan Default

| Parameter | Nilai |
|---|---|
| Heartbeat | 60 detik |
| Connectivity check | 60 detik |
| Speed test otomatis | 30 menit |
| Minimum interval speed test | 15 menit |
| Internet down | 3 kegagalan berturut-turut |
| Agent offline | 180 detik tanpa heartbeat |
| Speed test manual | Admin |
| Engine | Ookla Speedtest CLI |
| Output | JSON |
| Unit dashboard | Mbps |
| Retensi speed test | 90 hari |
| Retensi connectivity check | 14 hari |

Nilai ini merupakan konfigurasi awal dan harus divalidasi melalui uji coba.

## 20. Catatan Implementasi

1. Ini adalah enhancement pada PC Monitor; gunakan kembali model Device, autentikasi, heartbeat, dan infrastruktur yang sudah ada.
2. Jangan menggunakan IP sebagai identitas perangkat. Gunakan device ID/token unik; IP hanya metadata yang dapat berubah.
3. Jangan menjalankan Ookla CLI di Vercel. Jalankan di PC target.
4. Vercel menerima hasil dan mengelola command; agent tetap berjalan pada Windows.
5. Lakukan pilot 2–3 perangkat sebelum rollout.
6. Pastikan ketentuan penggunaan Ookla sesuai untuk organisasi sebelum distribusi luas.

**Hasil yang diharapkan:** admin dapat mengetahui PC mana yang internetnya normal, lambat, tidak stabil, atau tidak dapat dihubungi; melihat hasil dan histori Ookla; serta meminta pengukuran ulang dari dashboard.
