# PRD — PC Monitor: Internet Speed & Connection Quality Monitoring

**Versi:** 2.0  
**Tanggal:** 13 November 2026  
**Jenis:** Feature enhancement  
**Perubahan utama:** Mengganti Ookla Speedtest CLI dengan iPerf2 open-source dan server iPerf2 yang dikelola sendiri.

## 1. Ringkasan

Fitur ini menambahkan pemantauan kualitas koneksi internet setiap PC Windows yang terdaftar pada PC Monitor. Pengukuran throughput dilakukan dari PC target menggunakan **iPerf2** sebagai client menuju **iPerf2 server** yang dikelola sendiri pada VPS/Linux. Windows Agent mengirim hasil pengukuran ke API Next.js di Vercel, kemudian disimpan di Neon PostgreSQL dan ditampilkan pada dashboard admin.

Connectivity check ringan tetap berjalan terpisah agar admin dapat membedakan koneksi normal, lambat/tidak stabil, internet down, agent offline, API PC Monitor tidak terjangkau, dan server pengujian tidak terjangkau.

**Batas interpretasi:** iPerf2 mengukur performa jalur antara PC dan server iPerf2 yang ditentukan. Hasilnya bukan pengukuran universal terhadap seluruh internet atau jaminan kecepatan maksimum paket ISP. Kualitas dan kapasitas VPS, lokasi server, routing, peering, serta beban jaringan memengaruhi hasil.

## 2. Tujuan

1. Mengetahui PC mana yang internetnya normal, lambat, tidak stabil, atau down.
2. Menampilkan download dan upload Mbps serta latency/jitter/packet loss jika metrik tersedia dari metode pengukuran yang digunakan.
3. Menyediakan histori hasil pengukuran per perangkat.
4. Memungkinkan admin meminta pengujian manual dari dashboard.
5. Menjaga penggunaan bandwidth dan resource PC tetap terkendali.
6. Menggunakan tool open-source dan server pengujian yang dapat dikendalikan organisasi.

## 3. Teknologi dan Arsitektur

| Komponen | Teknologi | Tanggung jawab |
|---|---|---|
| Dashboard | Next.js App Router + TypeScript | UI admin |
| Hosting/API | Vercel | Menerima data dan mengelola perintah |
| Database | Neon PostgreSQL | Menyimpan perangkat, hasil tes, status, dan konfigurasi |
| ORM | Prisma | Akses database |
| Agent | Windows background service | Heartbeat, connectivity check, menjalankan iPerf2 client |
| Pengujian throughput | iPerf2 client | Mengukur throughput ke server yang ditentukan |
| Endpoint pengujian | iPerf2 server pada VPS/Linux | Menerima dan mengirim trafik pengujian |

Vercel tidak digunakan untuk menjalankan iPerf2 server. iPerf2 server harus berjalan pada VPS atau server Linux yang memiliki IP publik/DNS stabil dan kapasitas jaringan memadai. iPerf2 client berjalan di masing-masing PC target.

Agent hanya membuat koneksi outbound ke API PC Monitor dan iPerf2 server. Tidak diperlukan koneksi masuk dari Vercel ke PC target untuk heartbeat maupun command polling.

### 3.1 Pilihan versi dan kompatibilitas

- Gunakan **iPerf2**, bukan mengasumsikan iPerf3 kompatibel. iPerf2 dan iPerf3 tidak wire-compatible.
- Validasi binary Windows x64 dari sumber proyek iPerf2 yang tepercaya, versi, checksum, dan lisensinya sebelum distribusi.
- Jangan menganggap semua build iPerf2 memiliki opsi output atau perilaku yang sama. Pada implementasi awal, parsing output teks/CSV yang benar-benar dihasilkan build yang dipilih; jangan mengandalkan JSON output.
- Simpan versi client dan server pada setiap hasil pengukuran.
- Uji opsi reverse mode pada binary yang dipilih menggunakan `iperf -h`; dukungan opsi dapat berbeda antar-build. Pastikan arah upload/download terpetakan dengan benar sebelum rollout.

## 4. Ruang Lingkup

### 4.1 Connectivity Check

Agent melakukan pemeriksaan ringan setiap 60 detik (default):
- Gateway lokal jika dapat diketahui.
- Minimal dua endpoint internet independen melalui HTTPS/TCP.
- API PC Monitor secara terpisah.
- iPerf2 server secara terpisah, agar kegagalan server pengujian tidak dianggap sebagai internet down.
- Catat waktu, latency jika tersedia, hasil, dan error.

Jangan hanya mengandalkan ICMP ping karena dapat diblokir firewall. Kegagalan satu endpoint tidak boleh langsung dianggap internet down.

Status konektivitas:
- `connected`: endpoint internet umum berhasil diakses.
- `degraded`: internet dapat diakses tetapi metrik melewati threshold.
- `internet_down`: beberapa endpoint internet independen gagal dalam jumlah pemeriksaan berturut-turut.
- `unknown`: data tidak cukup atau sudah stale.
- `api_unreachable`: internet umum reachable tetapi API PC Monitor gagal.
- `test_server_unreachable`: internet umum reachable tetapi iPerf2 server gagal diakses.

### 4.2 iPerf2 Throughput Test

Agent menjalankan iPerf2 client menuju host/port server yang dikonfigurasi.

Metrik yang disimpan:
- `downloadMbps` dan `uploadMbps`.
- `latencyMs`, `jitterMs`, dan `packetLossPercent` hanya jika benar-benar diukur oleh metode yang digunakan.
- Server ID/nama/region.
- Protokol (TCP/UDP), durasi, jumlah stream, target bitrate UDP jika digunakan.
- Versi iPerf2 client dan server.
- Waktu mulai/selesai, status, ringkasan output, dan error.

**TCP** menjadi metode throughput default. Pengujian arah PC→server dan server→PC harus dilakukan secara terpisah atau dengan reverse mode yang sudah diverifikasi pada binary terpilih. Jangan menyebut satu arah sebagai download atau upload sebelum pemetaan arah tervalidasi.

**UDP** bersifat opsional untuk mengukur jitter dan packet loss. UDP test nonaktif secara default sampai bitrate aman ditetapkan melalui pilot. Jangan mengirim UDP tanpa batas atau menggunakan bitrate yang dapat membanjiri koneksi. Jika metrik tidak tersedia, simpan `null`, bukan `0`.

Rumus konversi:
- Jika output menyatakan bits/sec: `Mbps = bits_per_second / 1,000,000`.
- Jika output menyatakan bytes/sec: `Mbps = bytes_per_second × 8 / 1,000,000`.
- Parser wajib mengenali unit dari output aktual; jangan mengasumsikan satuan.

Simpan ringkasan output mentah yang sudah dibatasi ukurannya untuk membantu diagnosis, tetapi jangan menyimpan data yang tidak diperlukan.

### 4.3 Batas interpretasi hasil

- Hasil adalah throughput pada jalur PC ↔ iPerf2 VPS saat pengujian.
- Hasil dapat lebih rendah dari paket ISP karena kapasitas VPS, lokasi, routing, peering, CPU, firewall, atau beban bersamaan.
- VPS harus memiliki kapasitas bandwidth nyata yang setidaknya sebanding dengan kecepatan maksimum yang ingin diukur. VPS 100 Mbps tidak dapat memvalidasi koneksi PC 500 Mbps.
- Pilih lokasi VPS yang dekat dengan mayoritas PC. Jika lokasi PC tersebar jauh, pertimbangkan beberapa server regional dan simpan server yang digunakan pada setiap pengukuran.
- Untuk perbandingan antar-PC dan tren waktu, gunakan server, durasi, jumlah stream, protokol, dan jadwal yang konsisten.
- Jangan membandingkan hasil dari server/konfigurasi berbeda seolah-olah setara.

### 4.4 Jadwal dan beban perangkat

| Pemeriksaan | Default |
|---|---:|
| Heartbeat | 60 detik |
| Connectivity check | 60 detik |
| iPerf2 TCP test otomatis | 30 menit |
| Minimum interval test | 15 menit |
| Durasi TCP | sekitar 10 detik per arah |
| UDP test | Nonaktif secara default |
| Tes aktif per PC | Maksimal 1 |

Interval dan durasi dapat dikonfigurasi. Terapkan random jitter agar semua PC tidak menguji bersamaan. Gunakan antrean/limit concurrency di server, timeout, cooldown setelah kegagalan, dan backoff. Hindari tes saat PC sedang menjalankan aktivitas jaringan intensif jika kondisi tersebut dapat dideteksi secara andal.

Pengujian iPerf2 tidak berjalan setiap heartbeat. Agent tetap ringan saat idle; beban CPU dan bandwidth meningkat sementara ketika transfer pengujian berlangsung. Sediakan pengaturan untuk menonaktifkan pengujian otomatis tanpa menghentikan heartbeat.

### 4.5 Manual Network Test

Admin menekan **Test Internet Now** pada detail perangkat:
1. API membuat command/job dengan ID unik, parameter yang diizinkan, dan waktu kedaluwarsa.
2. Agent mengambil command melalui polling outbound.
3. Agent memvalidasi command dan menjalankan iPerf2 sesuai batas konfigurasi lokal/server.
4. Agent mengirim hasil atau error.
5. Dashboard menampilkan `queued`, `running`, `completed`, `failed`, atau `expired`.

Command hanya boleh memilih server dan parameter yang telah diizinkan admin. Jangan menerima executable path, shell command bebas, atau parameter arbitrer dari browser/API.

## 5. Penentuan Status

Threshold awal berikut dapat dikonfigurasi dan bukan standar universal:

| Status | Aturan awal |
|---|---|
| Normal | Internet reachable dan metrik memenuhi threshold |
| Slow | Download di bawah 5 Mbps atau upload di bawah 1 Mbps |
| Unstable | Jitter di atas 30 ms atau packet loss di atas 3% jika UDP metrics tersedia |
| High latency | Latency di atas 150 ms jika tersedia |
| Internet Down | Beberapa endpoint internet independen gagal 3 kali berturut-turut |
| Agent Offline | Tidak ada heartbeat lebih dari 180 detik |
| API Unreachable | Internet umum reachable tetapi API PC Monitor gagal |
| Test Server Unreachable | Internet umum reachable tetapi iPerf2 server gagal |
| Unknown/Stale | Data belum cukup atau terlalu lama |

Penting:
- `Agent Offline` tidak otomatis berarti `Internet Down`.
- iPerf2 gagal tidak otomatis berarti internet down; gunakan connectivity check.
- Jika PC kehilangan seluruh akses internet, agent tidak dapat langsung mengirim alert. Server hanya melihat heartbeat berhenti; agent dapat melaporkan recovery setelah koneksi pulih.
- Untuk membedakan PC mati dari internet lokasi putus secara pasti, dibutuhkan jalur monitoring independen seperti VPN/site gateway atau perangkat monitoring lain di lokasi.

## 6. User Stories

- Admin dapat melihat status internet seluruh PC.
- Admin dapat membandingkan download/upload antarperangkat berdasarkan server pengujian yang sama.
- Admin dapat melihat latency, jitter, dan packet loss jika tersedia.
- Admin dapat membuka histori dan grafik per perangkat.
- Admin dapat meminta pengujian manual.
- Admin dapat mengubah interval, server, concurrency, dan threshold.
- Admin dapat menonaktifkan pengujian otomatis tanpa mematikan heartbeat.
- Admin dapat melihat kondisi iPerf2 server dan status keterjangkauannya.

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
- `serverRegion` String?
- `protocol` String (TCP/UDP)
- `durationSeconds` Int?
- `parallelStreams` Int?
- `udpTargetMbps` Float?
- `clientVersion` String?
- `serverVersion` String?
- `rawSummary` String?
- `status` (success/failed)
- `errorMessage` String?
- `startedAt`
- `completedAt`
- `createdAt`

Index: `(deviceId, completedAt)`, `(status, completedAt)`, `(serverId, completedAt)`.

### ConnectivityCheck
- `id`
- `deviceId`
- `gatewayReachable` Boolean?
- `internetReachable` Boolean
- `apiReachable` Boolean
- `testServerReachable` Boolean?
- `latencyMs` Float?
- `failedChecks` Int
- `status`
- `checkedAt`
- `createdAt`

Index: `(deviceId, checkedAt)`, `(status, checkedAt)`.

### IperfServer
- `id`
- `name`
- `host`
- `port`
- `region` String?
- `enabled` Boolean
- `maxConcurrentTests` Int
- `createdAt`
- `updatedAt`

Jangan menyimpan secret server di browser. Batasi server yang dapat dipilih agent pada daftar yang dikelola admin.

### NetworkSettings
- `id`
- `deviceId` nullable untuk pengaturan global
- `connectivityIntervalSeconds`
- `speedTestIntervalMinutes`
- `speedTestEnabled`
- `testDurationSeconds`
- `parallelStreams`
- `udpTestEnabled`
- `udpTargetMbps` Float?
- `iperfServerId`
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
- `commandType` (RUN_IPERF_TEST, UPDATE_SETTINGS, DISABLE_NETWORK_MONITORING)
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
- `POST /api/agent/network/measurement` — menerima hasil iPerf2.
- `GET /api/agent/commands` — agent mengambil command.
- `POST /api/agent/commands/:id/result` — agent melaporkan hasil command.
- `GET /api/devices/:id/network` — ringkasan jaringan.
- `GET /api/devices/:id/network/history` — histori.
- `POST /api/devices/:id/network/test` — admin meminta tes iPerf2 manual.
- `PATCH /api/devices/:id/network/settings` — mengubah pengaturan.
- `GET /api/network/iperf-servers` — daftar server untuk admin.

Keamanan:
- Token unik per perangkat; server menyimpan hash token.
- Autentikasi admin menggunakan sistem login PC Monitor.
- Cocokkan token dengan device ID; device ID saja bukan bukti identitas.
- Validasi angka, timestamp, ukuran payload, protokol, durasi, bitrate, dan server ID.
- Rate limit per perangkat.
- Gunakan request ID/command ID untuk mencegah duplikasi dan replay.
- Jangan pernah mengirim token agent ke browser.
- Audit log tindakan admin yang sensitif.
- Batasi command ke allowlist; jangan mengeksekusi shell command bebas.

## 9. Dashboard

### Network Overview
Kartu ringkasan:
- Total PC.
- Internet normal.
- Internet lambat.
- Internet down.
- Agent offline.
- iPerf2 test gagal.
- iPerf2 server tidak terjangkau.

### Tabel perangkat
Kolom:
- Nama PC dan lokasi.
- Status agent.
- Status internet.
- Download/upload.
- Latency/jitter/packet loss jika tersedia.
- Server pengujian.
- Waktu tes terakhir.
- Aksi.

Filter berdasarkan lokasi, status, server, dan rentang waktu. Pencarian berdasarkan nama PC, device ID, atau IP.

### Detail perangkat
- Status terkini dan umur data.
- Hasil iPerf2 terakhir, server, protokol, dan parameter tes.
- Grafik histori download/upload.
- Grafik latency/jitter/packet loss jika tersedia.
- Riwayat error.
- Tombol **Test Internet Now**.
- Pengaturan interval dan threshold.

### Server Management
- Daftar iPerf2 server, host/port, region, status enabled.
- Kapasitas/concurrency maksimum yang diizinkan.
- Status keterjangkauan dan versi server jika dapat diperoleh.
- Jangan menampilkan secret atau konfigurasi sensitif.

Status harus berupa teks dan warna; jangan hanya mengandalkan warna.

## 10. Alert

Trigger:
- Internet down setelah 3 pemeriksaan berturut-turut gagal.
- Internet pulih setelah insiden down.
- Kecepatan di bawah threshold dalam beberapa pengukuran valid.
- Jitter/packet loss tinggi secara berulang jika metrik tersedia.
- Agent offline setelah heartbeat timeout.
- iPerf2 server tidak terjangkau.

Buat satu incident saat gangguan dimulai dan satu recovery event saat pulih. Deduplicate alert agar admin tidak menerima pesan setiap interval. Simpan waktu mulai, waktu pulih, durasi, perangkat/server, dan ringkasan metrik.

## 11. Kinerja, Bandwidth, dan Resource

- Connectivity check harus ringan dan tidak menjalankan iPerf2.
- Jangan menjalankan throughput test setiap heartbeat.
- Default test otomatis 30 menit; minimum interval awal 15 menit.
- Durasi awal sekitar 10 detik per arah; validasi lewat pilot.
- Terapkan random jitter, antrean, dan batas concurrency di VPS.
- Maksimal satu tes aktif per perangkat.
- Terapkan timeout proses, cooldown, retry terbatas, dan backoff.
- UDP nonaktif secara default; jika diaktifkan, wajib ada target bitrate dan batas durasi.
- Jangan menjalankan tes bersamaan melebihi kapasitas VPS.
- Tampilkan timestamp dan status stale.
- Sediakan disable otomatis test tanpa menghentikan heartbeat.
- Pilot pada 2–3 PC terlebih dahulu dan amati CPU, RAM, bandwidth, serta dampak pada aktivitas pengguna.

## 12. Instalasi dan Kontrol Agent

- Agent berjalan sebagai Windows Service/background service.
- Otomatis start saat Windows startup.
- Restart jika crash dengan batas restart.
- Log lokal dengan rotasi.
- Laporkan versi agent, iPerf2 client, dan konfigurasi test.
- Distribusikan binary iPerf2 yang sudah diverifikasi bersama agent atau melalui installer yang dikelola.
- Validasi checksum binary saat instalasi/update jika mekanisme distribusi mendukung.
- Terima konfigurasi terbaru dari server.
- Dapat menonaktifkan iPerf2 otomatis atau seluruh network monitoring.
- Uninstall secara terkontrol.
- Perintah server memiliki expiry dan divalidasi sebelum dieksekusi.

Menonaktifkan iPerf2 otomatis tidak boleh menghentikan heartbeat. Menonaktifkan monitoring tidak menghapus histori lama.

## 13. Error Handling

Tangani:
- iPerf2 client belum terpasang, binary rusak, atau versi tidak kompatibel.
- iPerf2 server tidak aktif atau port tidak dapat dijangkau.
- Output teks/CSV tidak sesuai parser atau unit tidak dikenal.
- DNS/koneksi internet gagal.
- API Vercel/database tidak tersedia.
- Token invalid/revoked.
- Timeout, concurrency penuh, dan hasil duplikat.
- Server mencapai batas bandwidth/CPU.

Agent menyimpan data/error sementara secara lokal dan mengirim ulang data yang masih relevan saat koneksi pulih. Batasi ukuran antrean dan jangan tampilkan data lama sebagai kondisi terkini. Jika parser gagal, simpan status failed dan ringkasan diagnostik yang dibatasi; jangan membuat angka throughput perkiraan.

## 14. Privasi, Lisensi, dan Operasional Server

- iPerf2 merupakan proyek open-source; verifikasi lisensi pada rilis/binary yang dipilih dan penuhi kewajiban distribusi, atribusi, serta penyertaan lisensi/source sesuai ketentuan lisensi tersebut.
- Ambil source/binary hanya dari repositori atau distribusi proyek yang tepercaya; pin versi dan verifikasi checksum.
- Beri informasi bahwa agent mengukur kualitas koneksi dan menggunakan sebagian bandwidth saat tes.
- Kumpulkan data minimum yang diperlukan.
- Batasi akses public IP dan data jaringan untuk admin berwenang.
- Gunakan HTTPS untuk API PC Monitor dan lindungi token agent.
- iPerf2 server: buka hanya port/protokol yang dibutuhkan (umumnya port TCP/UDP 5001, dapat dikonfigurasi), gunakan firewall, batasi akses jika memungkinkan, dan pantau CPU/bandwidth/concurrency.
- Jangan mengekspos server publik tanpa pembatasan dan pemantauan. Pertimbangkan allowlist IP, VPN, atau kontrol akses jaringan yang sesuai dengan kondisi PC pengguna yang IP-nya dapat berubah.
- Jangan menganggap iPerf2 server publik otomatis aman hanya karena tool-nya open-source.

Referensi awal:
- https://iperf2.sourceforge.io/
- https://sourceforge.net/projects/iperf2/
- https://iperf.fr/iperf-doc.php

Periksa dokumentasi dan lisensi versi yang benar-benar digunakan sebelum produksi.

## 15. Acceptance Criteria

1. Agent Windows dapat menjalankan iPerf2 client ke server yang dikonfigurasi.
2. Versi client/server dan parameter pengujian tersimpan.
3. Parser membaca output build yang dipilih dan mengenali unit dengan benar.
4. Download/upload dipetakan ke arah transfer yang benar dan telah divalidasi.
5. Hasil disimpan dalam Mbps dengan konversi yang benar.
6. Metrik yang tidak tersedia disimpan `null`, bukan nol.
7. Hasil dikirim ke API dengan autentikasi perangkat.
8. Dashboard menampilkan hasil terbaru, server, parameter, dan timestamp.
9. Connectivity check membedakan internet reachable, API unreachable, dan test server unreachable.
10. Internet down tidak langsung disamakan dengan agent offline.
11. Jadwal mengikuti konfigurasi dan tidak menjalankan tes pada setiap heartbeat.
12. Admin dapat meminta tes manual dan melihat status job.
13. Tidak ada tes paralel pada satu perangkat.
14. Concurrency global tidak melebihi batas server.
15. UDP nonaktif secara default dan, jika diaktifkan, selalu dibatasi bitrate/durasi.
16. Error client/server/API tidak menghentikan agent secara permanen.
17. Admin dapat menonaktifkan iPerf2 otomatis tanpa mematikan heartbeat.
18. Histori dapat difilter perangkat, server, dan rentang waktu.
19. Alert insiden tidak duplikatif.
20. Pilot membuktikan beban resource dan dampak bandwidth dapat diterima.

## 16. Test Plan

**Unit test**
- Parsing output iPerf2 dari versi/build yang dipilih.
- Parsing unit bits/sec dan bytes/sec.
- Pemetaan arah upload/download.
- Validasi metrik dan status threshold.
- Retry/backoff dan command expiry.
- Deduplication incident.
- Token perangkat dan validasi server ID.

**Integration test**
- Agent → iPerf2 VPS → Vercel API → Neon.
- Admin membuat command → agent mengambil → hasil tersimpan.
- Pengaturan global dan per perangkat.
- Batas concurrency server.

**Scenario test**
- Internet normal/lambat/down.
- Latency tinggi atau packet loss tinggi jika UDP diaktifkan.
- Satu endpoint gagal tetapi endpoint lain berhasil.
- API PC Monitor tidak dapat diakses.
- iPerf2 VPS tidak dapat diakses sementara internet umum normal.
- VPS penuh/beban tinggi.
- Internet pulih.
- Binary iPerf2 tidak terpasang/rusak.
- Output parser tidak dikenal.
- Tes timeout dan agent dihentikan.
- Banyak PC memiliki jadwal berbeda.
- Tes dilakukan saat PC sedang digunakan untuk aktivitas jaringan.

## 17. Tahapan Implementasi

### Phase 1 — Validasi iPerf2 dan VPS
- Pilih dan pin rilis iPerf2 serta verifikasi lisensinya.
- Siapkan VPS Linux dengan bandwidth yang sesuai.
- Pasang iPerf2 server dan firewall hanya untuk port yang diperlukan.
- Uji client Windows x64.
- Verifikasi output parser, satuan, arah upload/download, durasi, dan opsi reverse mode.
- Uji kapasitas server dengan beberapa client dan concurrency yang direncanakan.

### Phase 2 — Backend & Database
- Tambahkan model measurement, connectivity, settings, server, dan command.
- Buat API agent dan admin.
- Tambahkan autentikasi, validasi, rate limit, idempotency, dan expiry.

### Phase 3 — Windows Agent
- Integrasikan iPerf2 client dan parser output.
- Implementasikan connectivity check.
- Scheduler, jitter, concurrency-aware queue, cooldown, timeout, retry, local queue.
- Polling command manual.
- Tambahkan kontrol enable/disable dan logging.

### Phase 4 — Dashboard
- Overview dan tabel perangkat.
- Detail dan grafik histori.
- Manual iPerf2 test.
- Pengaturan threshold/interval.
- Manajemen server iPerf2.

### Phase 5 — Alert & Hardening
- Incident/recovery.
- Notifikasi.
- Retensi data.
- Uji beban server dan agent.
- Pilot 2–3 PC, evaluasi, lalu rollout bertahap.

## 18. Retensi Data

Default awal:
- Connectivity check mentah: 14 hari.
- iPerf2 measurement mentah: 90 hari.
- Ringkasan harian: 12 bulan.
- Log error: 30 hari.

Gunakan job pembersihan terjadwal dan query agregat agar dashboard tidak membaca seluruh data mentah.

## 19. Keputusan Default

| Parameter | Nilai |
|---|---|
| Heartbeat | 60 detik |
| Connectivity check | 60 detik |
| iPerf2 test otomatis | 30 menit |
| Minimum interval test | 15 menit |
| Durasi TCP | sekitar 10 detik per arah |
| TCP parallel streams | 1 sebagai baseline; dapat diuji dan dikonfigurasi |
| UDP test | Nonaktif secara default |
| Internet down | 3 kegagalan endpoint berturut-turut |
| Agent offline | 180 detik tanpa heartbeat |
| Manual test | Admin |
| Engine | iPerf2 client + self-managed iPerf2 server |
| Output parsing | Teks/CSV sesuai build tervalidasi; bukan asumsi JSON |
| Unit dashboard | Mbps |
| Retensi measurement | 90 hari |
| Retensi connectivity check | 14 hari |

Nilai ini merupakan konfigurasi awal dan harus divalidasi melalui uji coba.

## 20. Catatan Implementasi

1. Ini adalah enhancement pada PC Monitor; gunakan kembali model Device, autentikasi, heartbeat, dan infrastruktur yang sudah ada.
2. Jangan menggunakan IP sebagai identitas perangkat. Gunakan device ID/token unik; IP hanya metadata yang dapat berubah.
3. Jangan menjalankan iPerf2 server di Vercel. Jalankan di VPS/Linux yang dikelola sendiri.
4. iPerf2 client berjalan di PC target; Vercel menerima hasil dan mengelola command.
5. iPerf2 mengukur jalur ke server yang dipilih, bukan seluruh internet. Catat server dan parameter untuk interpretasi yang benar.
6. Pastikan kapasitas VPS cukup agar tidak menjadi bottleneck.
7. Uji beban resource dan dampak bandwidth pada 2–3 PC sebelum rollout.

**Hasil yang diharapkan:** admin dapat mengetahui PC mana yang internetnya normal, lambat, tidak stabil, atau tidak dapat dihubungi; melihat hasil dan histori iPerf2; serta meminta pengukuran ulang dari dashboard dengan beban perangkat dan server yang terkendali.
