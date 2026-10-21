# PRD — PC Monitor
**Product Requirements Document**  
**Versi:** 1.0  
**Tanggal:** 21 Oktober 2026  
**Platform:** Web Application  
**Stack utama:** Next.js, TypeScript, Vercel, Neon PostgreSQL, Prisma ORM

---

## 1. Ringkasan Produk

PC Monitor adalah aplikasi web untuk memantau ketersediaan PC di berbagai lokasi melalui internet. Sistem mengidentifikasi perangkat menggunakan IP Address, menerima heartbeat dari agent yang berjalan pada setiap PC, dan menampilkan status perangkat pada dashboard terpusat.

### Tujuan utama

- Mengetahui PC yang sedang online atau offline dari satu dashboard.
- Memantau IP Address terakhir yang digunakan perangkat.
- Mengetahui kapan perangkat terakhir berkomunikasi dengan server.
- Menyimpan riwayat heartbeat dan perubahan status.
- Menyediakan fondasi untuk notifikasi ketika perangkat offline terlalu lama.

## 2. Target Pengguna dan Peran

| Peran | Hak akses |
|---|---|
| Admin | Mengelola perangkat, membuat dan mencabut token agent, melihat seluruh data, serta mengelola pengguna. |
| Operator | Melihat dashboard, mencari perangkat, dan melihat status serta riwayat. |
| Agent PC | Mengirim heartbeat dan informasi IP untuk perangkat yang sudah terdaftar. |

Untuk MVP, aplikasi dapat dimulai dengan satu peran Admin. Peran Operator dapat ditambahkan setelah kebutuhan akses bersama ditentukan.

## 3. Ruang Lingkup

### 3.1 Termasuk dalam MVP

- Login admin dan proteksi halaman dashboard.
- Registrasi, edit, dan penonaktifan perangkat.
- Autentikasi agent menggunakan token unik per perangkat.
- Pengiriman heartbeat setiap 60 detik.
- Status online, offline, belum pernah online, dan nonaktif.
- Pencatatan IP lokal dan IP publik terakhir.
- Dashboard statistik dan tabel perangkat.
- Pencarian berdasarkan nama atau IP Address.
- Filter status dan lokasi.
- Riwayat heartbeat dan perubahan status.
- Deployment aplikasi melalui Vercel dan database Neon.

### 3.2 Tidak termasuk dalam MVP

- Remote desktop atau kendali jarak jauh.
- Pengambilan layar atau pemantauan aktivitas pengguna.
- Pemindaian port dan jaringan tanpa izin.
- Pemantauan CPU, RAM, dan proses aplikasi.
- Dukungan agent untuk seluruh sistem operasi sekaligus.

## 4. Arsitektur Sistem

Arsitektur yang direkomendasikan adalah **centralized monitoring server + agent pada setiap PC**.

1. Agent berjalan pada PC yang dipantau.
2. Agent mengirim heartbeat melalui HTTPS setiap 60 detik.
3. Backend Next.js memvalidasi token agent.
4. Backend menyimpan waktu heartbeat dan informasi IP ke Neon PostgreSQL.
5. Status perangkat dihitung berdasarkan waktu heartbeat terakhir.
6. Dashboard mengambil data terbaru secara berkala.

### Komponen teknologi

| Komponen | Teknologi |
|---|---|
| Frontend | Next.js App Router + TypeScript |
| UI | Tailwind CSS |
| API | Next.js Route Handlers |
| ORM | Prisma |
| Database | Neon PostgreSQL |
| Hosting | Vercel |
| Agent awal | Windows PowerShell |
| Komunikasi agent | HTTPS + Bearer Token |
| Pembaruan dashboard | Polling setiap 60 detik |

### Catatan arsitektur

Vercel cocok untuk dashboard dan API heartbeat, tetapi bukan tempat menjalankan agent Windows secara terus-menerus. Agent berjalan di PC yang dipantau. Karena perangkat berada di lokasi berbeda, agent menginisiasi koneksi keluar menuju server sehingga umumnya tidak perlu membuka port masuk ke setiap PC.

Heartbeat membuktikan agent masih berkomunikasi dengan server, bukan menjamin seluruh layanan PC berfungsi normal. Agent dapat melakukan pemeriksaan konektivitas tambahan jika diperlukan.

## 5. Alur Utama

1. Admin login.
2. Admin mendaftarkan PC dan mengisi nama serta lokasi.
3. Sistem membuat token agent unik.
4. Admin memasang agent pada PC.
5. Agent mengirim heartbeat setiap 60 detik.
6. Backend memvalidasi token.
7. Backend menyimpan waktu heartbeat dan IP.
8. Dashboard menghitung dan menampilkan status perangkat.
9. Sistem mencatat transisi status ketika perangkat berubah dari online ke offline atau sebaliknya.

## 6. Aturan Status Perangkat

| Kondisi | Status |
|---|---|
| Belum pernah mengirim heartbeat | `NEVER_ONLINE` |
| Heartbeat terakhir berumur 0–180 detik | `ONLINE` |
| Heartbeat terakhir lebih dari 180 detik | `OFFLINE` |
| Perangkat dinonaktifkan admin | `INACTIVE` |

Interval pengiriman heartbeat adalah 60 detik dengan batas offline 180 detik. Toleransi ini membantu mengurangi false alarm akibat keterlambatan jaringan sementara.

Status online menunjukkan agent masih berkomunikasi dengan server. Status tersebut tidak otomatis membuktikan semua aplikasi atau layanan pada PC berjalan normal.

## 7. Kebutuhan Fungsional

### FR-01 — Autentikasi dan Otorisasi

- Admin harus login sebelum mengakses dashboard.
- Halaman dashboard, pengelolaan perangkat, dan riwayat wajib dilindungi.
- Endpoint heartbeat menggunakan token agent, bukan sesi admin.
- Token agent ditampilkan saat dibuat dan tidak disimpan dalam bentuk teks biasa.
- Pengguna tanpa hak yang sesuai tidak dapat membuat atau mencabut token.

### FR-02 — Manajemen Perangkat

Admin dapat:

- Menambahkan perangkat dengan nama, deskripsi, lokasi, dan IP awal opsional.
- Membuat token agent unik.
- Mengedit nama dan lokasi perangkat.
- Menonaktifkan atau mengaktifkan kembali perangkat.
- Mencabut dan mengganti token yang bocor.
- Melihat IP terakhir, waktu heartbeat terakhir, dan status perangkat.

### FR-03 — Heartbeat Agent

- Agent mengirim heartbeat setiap 60 detik.
- Heartbeat menyertakan informasi IP lokal yang terdeteksi dan informasi konektivitas yang relevan.
- Backend memvalidasi token dan menggunakan waktu penerimaan dari server.
- Token tidak valid menghasilkan HTTP `401`.
- Request tidak valid tidak boleh mengubah data perangkat.
- Kegagalan koneksi dicatat oleh agent dan dicoba kembali pada interval berikutnya.
- Endpoint membatasi ukuran request dan frekuensi request.

### FR-04 — Dashboard

Dashboard menampilkan:

- Total perangkat terdaftar dan aktif.
- Jumlah perangkat online, offline, dan belum pernah online.
- Persentase ketersediaan perangkat.
- Tabel nama perangkat, IP, lokasi, status, dan waktu terakhir aktif.
- Pencarian nama atau IP Address.
- Filter status dan lokasi.
- Halaman detail perangkat.
- Waktu pembaruan data terakhir dan indikator loading/error.

### FR-05 — Riwayat Monitoring

- Menyimpan heartbeat sesuai kebijakan retensi.
- Mencatat transisi status online/offline.
- Menampilkan waktu kejadian dan durasi downtime yang diketahui.
- Mendukung filter rentang tanggal.
- Mencegah event offline berulang untuk perangkat yang sudah offline.

### FR-06 — Notifikasi (Tahap Berikutnya)

Notifikasi email atau integrasi pesan instan dapat ditambahkan pada fase berikutnya. Sistem perlu mendukung aturan seperti perangkat offline lebih dari lima menit, cooldown, dan pencegahan notifikasi berulang.

## 8. Desain Halaman

| Halaman | Rute | Fungsi |
|---|---|---|
| Login | `/login` | Autentikasi admin |
| Dashboard | `/dashboard` | Statistik, tabel perangkat, filter, dan pencarian |
| Daftar perangkat | `/dashboard/devices` | Registrasi dan pengelolaan perangkat |
| Detail perangkat | `/dashboard/devices/[id]` | IP, waktu aktif terakhir, uptime, dan riwayat |
| Audit log | `/dashboard/audit-logs` | Catatan tindakan administratif |

### Prinsip UI/UX

- Desain modern, rapi, responsif, dan berorientasi pada keterbacaan.
- Status online/offline dibedakan dengan label dan ikon, bukan warna saja.
- Tabel mendukung pencarian, filter, pagination, dan tampilan mobile.
- Tampilkan waktu terakhir diperbarui.
- Error koneksi database/API tidak boleh ditampilkan sebagai status offline perangkat.

## 9. Spesifikasi API

Semua endpoint admin harus memerlukan autentikasi dan otorisasi yang sesuai.

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/auth/login` | Login admin |
| `GET` | `/api/dashboard/stats` | Mengambil statistik dashboard |
| `GET` | `/api/devices` | Mengambil daftar perangkat |
| `POST` | `/api/devices` | Mendaftarkan perangkat |
| `GET` | `/api/devices/[id]` | Detail perangkat |
| `PATCH` | `/api/devices/[id]` | Mengubah informasi perangkat |
| `POST` | `/api/devices/[id]/rotate-token` | Mengganti token agent |
| `GET` | `/api/devices/[id]/history` | Mengambil riwayat monitoring |
| `POST` | `/api/agent/heartbeat` | Menerima heartbeat agent |
| `GET` | `/api/health` | Memeriksa kesehatan aplikasi |

Ketentuan API:

- Daftar perangkat mendukung pagination, pencarian, dan filter.
- Heartbeat tidak boleh mempercayai `deviceId` dari body tanpa mencocokkannya dengan token.
- Rate limiting diterapkan per token/perangkat dan endpoint.
- IP publik sebaiknya diverifikasi oleh server dari informasi koneksi atau sumber tepercaya, bukan dipercaya begitu saja dari body agent.
- Semua input divalidasi dengan skema validasi.
- Pesan error tidak membocorkan secret, token, atau detail database.

## 10. Desain Database Neon PostgreSQL

### 10.1 Model inti

#### User

Kolom yang disarankan:

- `id`
- `name`
- `email`
- `passwordHash` atau identitas provider autentikasi
- `role`
- `createdAt`
- `updatedAt`

#### Device

Kolom yang disarankan:

- `id`
- `name`
- `description`
- `location`
- `tokenHash`
- `lastLocalIp`
- `lastPublicIp`
- `lastSeenAt`
- `isActive`
- `createdAt`
- `updatedAt`

#### Heartbeat

Kolom yang disarankan:

- `id`
- `deviceId`
- `localIp`
- `publicIp`
- `receivedAt`

#### StatusEvent

Kolom yang disarankan:

- `id`
- `deviceId`
- `status`
- `occurredAt`
- `reason`

#### AuditLog

Kolom yang disarankan:

- `id`
- `actorId`
- `action`
- `entityId`
- `metadata`
- `createdAt`

### 10.2 Relasi

- Satu `Device` memiliki banyak `Heartbeat`.
- Satu `Device` memiliki banyak `StatusEvent`.
- `AuditLog` menghubungkan tindakan admin dengan entitas yang terdampak.
- `User` mewakili akun admin atau operator.

### 10.3 Aturan database

- `Device.tokenHash` harus unik dan menyimpan hash token berentropi tinggi.
- Buat indeks pada `Heartbeat(deviceId, receivedAt)`.
- `StatusEvent` hanya ditulis ketika status berubah.
- Terapkan retensi heartbeat agar ukuran database terkendali.
- IP Address merupakan data konektivitas, bukan identitas permanen perangkat.
- Gunakan migrasi Prisma yang ditinjau dan dijalankan secara terkontrol.

## 11. Deployment dengan Vercel dan Neon

### Lingkungan

| Lingkungan | Aplikasi | Database |
|---|---|---|
| Development | Lokal dengan Next.js atau Vercel CLI | Branch development |
| Preview | Deployment otomatis dari branch non-production | Branch pengujian terpisah |
| Production | Deployment dari branch utama | Branch production |

### Langkah setup

1. Buat repository GitHub.
2. Impor repository ke Vercel.
3. Tambahkan integrasi Neon melalui Vercel Marketplace.
4. Pilih region database yang sesuai dengan region deployment aplikasi.
5. Konfigurasikan environment variables untuk Development, Preview, dan Production.
6. Jalankan migrasi database pada lingkungan yang sesuai.
7. Deploy aplikasi dan uji heartbeat dari PC di lokasi berbeda.

### Environment variables

Nama variabel dapat disesuaikan dengan library dan strategi autentikasi yang dipilih.

```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
AUTH_SECRET="..."
```

- Gunakan koneksi pooled untuk query aplikasi jika sesuai dengan konfigurasi Neon.
- Gunakan koneksi langsung untuk kebutuhan migrasi yang memerlukannya.
- Jangan memasukkan `.env` ke Git.
- Jangan menggunakan awalan `NEXT_PUBLIC_` untuk secret.
- Pisahkan kredensial Preview dan Production.
- Jangan menjalankan migrasi destruktif otomatis terhadap database produksi saat setiap deployment.

## 12. Persyaratan Nonfungsional

| Kategori | Persyaratan |
|---|---|
| Kinerja | Target respons API p95 di bawah satu detik untuk operasi normal, di luar cold start dan gangguan jaringan. |
| Kesegaran data | Dashboard diperbarui pada polling berikutnya, setiap 60 detik, jika request berhasil. |
| Keamanan | HTTPS, token unik, hash token, validasi input, dan autentikasi admin. |
| Ketersediaan | Gangguan database ditampilkan sebagai error, bukan disamarkan menjadi status offline. |
| Skalabilitas | Pagination, indeks database, dan pengujian beban. |
| Kompatibilitas | Dashboard responsif pada desktop, tablet, dan ponsel. |
| Pemeliharaan | TypeScript, validasi skema, logging, pengujian otomatis, dan dokumentasi API. |
| Privasi | Pengumpulan data minimum, retensi yang terkontrol, dan akses terbatas. |

Target kinerja merupakan sasaran pengujian, bukan jaminan sebelum diuji pada beban nyata.

## 13. Keamanan dan Mitigasi Risiko

### Penyalahgunaan token

- Gunakan token acak dengan entropi tinggi dan unik untuk setiap PC.
- Simpan hash token, bukan token mentah.
- Token hanya ditampilkan saat dibuat atau diganti.
- Sediakan pencabutan dan rotasi token.
- Jangan mencatat token dalam log.

### Perubahan IP

- Perangkat dapat menggunakan DHCP, VPN, atau NAT.
- IP publik dapat sama untuk beberapa PC pada satu lokasi.
- Jangan menggunakan IP sebagai satu-satunya pengenal perangkat.
- Simpan IP lokal dan IP publik sebagai informasi konektivitas terpisah.

### Keterlambatan heartbeat

- Gunakan batas offline 180 detik.
- Terapkan retry dan pencatatan transisi status.
- Bedakan kegagalan komunikasi agent dari gangguan layanan dashboard.

### Pertumbuhan data

- Terapkan retensi heartbeat.
- Buat indeks yang sesuai.
- Gunakan pagination dan agregasi statistik saat diperlukan.
- Pertimbangkan partisi atau strategi arsip jika volume meningkat besar.

### Kebocoran informasi

- Lindungi `DATABASE_URL`, secret autentikasi, dan token agent.
- Terapkan HTTPS.
- Validasi ukuran dan format request.
- Gunakan rate limiting.
- Terapkan otorisasi pada setiap endpoint admin.

## 14. Kriteria Penerimaan

### P0 — Wajib untuk MVP

- [ ] Admin dapat login dan mengakses dashboard.
- [ ] Admin dapat mendaftarkan perangkat dan membuat token unik.
- [ ] Agent dengan token valid mengirim heartbeat dan memperbarui waktu terakhir aktif.
- [ ] Token salah atau dicabut ditolak tanpa mengubah data perangkat.
- [ ] Perangkat tanpa heartbeat lebih dari 180 detik ditampilkan offline.
- [ ] Dashboard menampilkan jumlah perangkat dan IP terakhir dengan benar.

### P1 — Peningkatan MVP

- [ ] Pencarian IP, filter status, dan pagination berfungsi.
- [ ] Detail perangkat menampilkan riwayat heartbeat dan perubahan status.
- [ ] Preview deployment tidak mengubah data produksi.
- [ ] Agent dapat pulih setelah kegagalan koneksi sementara.
- [ ] Audit log mencatat tindakan administratif penting.

## 15. Tahapan Pengembangan

| Tahap | Hasil akhir |
|---|---|
| 1. Foundation | Project Next.js, TypeScript, Tailwind, GitHub, Vercel, Neon, dan skema database. |
| 2. Authentication | Login admin, sesi, proteksi dashboard, dan otorisasi API. |
| 3. Device management | CRUD perangkat dan penerbitan/pencabutan token. |
| 4. Monitoring engine | Agent Windows, endpoint heartbeat, perhitungan status, dan status event. |
| 5. Dashboard | Statistik, tabel perangkat, pencarian, filter, dan detail perangkat. |
| 6. History & hardening | Riwayat, audit log, retensi data, rate limiting, dan pengujian keamanan. |
| 7. Release | Preview deployment, migrasi terkontrol, production deployment, dan dokumentasi agent. |

## 16. Definition of Done

Sebuah fitur dinyatakan selesai jika:

- Kode lolos pemeriksaan TypeScript dan lint.
- Operasi database menggunakan validasi dan otorisasi yang benar.
- Fitur memiliki pengujian yang relevan.
- Error ditangani tanpa membocorkan rahasia.
- Perubahan diuji pada Preview deployment.
- Dokumentasi dan konfigurasi environment diperbarui.
- Fitur berfungsi pada deployment yang dituju.

## 17. Keputusan Teknis Final

| Area | Keputusan |
|---|---|
| Framework | Next.js App Router + TypeScript |
| Styling | Tailwind CSS |
| Hosting aplikasi | Vercel |
| Database | Neon PostgreSQL |
| ORM | Prisma |
| Agent awal | Windows PowerShell |
| Autentikasi agent | Bearer token unik per perangkat |
| Interval heartbeat | 60 detik |
| Batas offline | 180 detik |
| Pembaruan dashboard | Polling setiap 60 detik |
| Riwayat | Heartbeat dan status event dengan kebijakan retensi |

## 18. Dokumentasi Acuan

- [Vercel](https://vercel.com/docs)
- [Vercel + Neon integration](https://vercel.com/marketplace/neon/neon)
- [Neon documentation](https://neon.tech/docs)
- [Next.js documentation](https://nextjs.org/docs)
- [Prisma documentation](https://www.prisma.io/docs)

---

## Rekomendasi Implementasi

Mulai dari fondasi project, autentikasi admin, dan koneksi Neon. Setelah itu, bangun registrasi perangkat dan endpoint heartbeat sebelum mempercantik dashboard. Urutan ini memastikan dashboard menggunakan data monitoring sungguhan, bukan hanya data contoh.
