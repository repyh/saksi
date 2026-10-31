# STATE — Kondisi Terkini Proyek SAKSI

**Tanggal Pembaruan:** 31 Oktober 2026, 14:35 WIB
**Target Terdekat:** First Draft Submission (FDS) — **1 November 2026** (T-1 Hari)
**Kompetisi:** Web In Action (WIA) — MIA 2026 (KSM Multimedia UPN Veteran Jakarta)
**Tema / Subtema:** *Designing Digital Futures – Powering Public Transparency* / **Civic Reporting & Accountability**
**Identitas Produk:** **SAKSI** (*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*)

---

## 1. Ringkasan Eksekutif & Posisi Saat Ini

Proyek telah melakukan pivot strategis dari konsep awal (**RUAS** — pemindaian CV/ONNX dan NLP pada jalan nasional) menuju **SAKSI** (v3, disepakati 29 Oktober 2026 berdasarkan arahan dosen pembimbing dan hasil uji terukur).

Fokus saat ini dipersempit secara ketat ke **satu jenis infrastruktur: JALAN** di **Kabupaten Tangerang** (`idKldi=D50`, BPS `3603`) TA 2025–2026:
- **3.602 paket jalan**, pagu total **Rp848,60 Miliar**.
- **3.331 paket bertitik (92,5%)** terpetakan (3.000 titik desa, 102 garis koridor, 229 sentroid kecamatan).
- **271 paket (7,5%)** tanpa lokus mikro (tidak dipaksakan titik, ditampilkan di tabel dengan label `Lokasi: Kab. Tangerang (Umum)`).
- **251 dari 274 desa/kelurahan** tersentuh di 29 kecamatan.

### Status Kesiapan FDS (1 November 2026)
Wajib dikumpulkan:
1. **Repositori Publik GitHub** + `README.md` mutakhir.
2. **Dokumen PDF FDS maks 10 halaman** (`WIA_FSDMIA2026_<NamaTim>.pdf`): konsep, sitemap, wireframe, penjelasan fitur, dan **screenshot minimal 2 halaman hidup**.
3. **Dua Layar Hidup yang Wajib Ada:**
   - **Layar 1 (`/`):** Peta Audit Jalan Kabupaten Tangerang (3.331 titik/garis, ringkasan Rp848,60 M, filter tahun/kecamatan/pekerjaan, register paket).
   - **Layar 2 (`/lapor`):** Alur Lapor Warga 3 Langkah (Foto + blur privasi/hapus EXIF di browser, kategorisasi kerusakan tanpa CV cm², rekomendasi paket via `MatchScore`).

---

## 2. Inventaris Aset & Keadaan Repositori

### 2.1 Basis Teknologi (Active Stack)
- **Framework:** Next.js 16.4.3 (Turbopack, App Router, React 19.3.0, TypeScript 5).
- **Styling & UI Kit:** Tailwind CSS v4, `shadcn/ui` (preset `base-nova`, `@base-ui/react`, `class-variance-authority`, `tw-animate-css`, ikon `lucide-react`).
- **Peta:** Leaflet 1.9.4 & `react-leaflet` 5.0.0 dengan tile OpenStreetMap.
- **Package Manager:** Bun 1.4.2 (`bun.lock`).
- **Verifikasi Build & Lint:** `bun run build` lolos (sukses render 9 rute statis), `bun run lint` lolos (0 warning, 0 error).

### 2.2 Dataset Tersedia (`data/`)
Semua dataset hasil snapshot per 29 Oktober 2026 telah terkomit di repositori:
- `data/saksi_tangerang_2025_2026.json` (2,9 MB): 5.487 paket fisik (3.602 paket jalan, Rp848,60 M).
- `data/tangerang_desa_coords.json`: 274 desa/kelurahan BPS `3603` di 29 kecamatan dengan koordinat sentroid OSM.
- `data/manifest.json`: Metadata sumber resmi (SIRUP Inaproc, BPS, OSM).
- `data/jalan.json` & `data/provinsi.json`: Data GIS Ditjen Bina Marga (IRI nasional) sebagai pembanding sekunder.
- `data/saksi_bandung_2025_2026.json` & `data/bandung_desa_coords.json`: Arsip bukti generalisasi pipeline multi-wilayah.

Paket jalan sekarang dibaca oleh repository server-only dari `data/saksi_tangerang_2025_2026.json`. Jangan salin snapshot ke `public/` atau memuatnya langsung dari komponen client.

### 2.3 Implementasi dan Batas Frontend/Backend
- `src/app/page.tsx` adalah Server Component yang meminta data awal kepada use case paket.
- `src/features/map/map-dashboard.tsx` mengelola kontrol filter dan interaksi peta; filter lanjutan meminta `GET /api/packages`.
- `src/app/api/packages/route.ts` memvalidasi parameter dan memanggil `src/server/packages/service.ts`.
- `src/server/packages/snapshot-repository.ts` menjadi adapter snapshot server-only; batas repository dapat dipertahankan saat implementasi Prisma menggantikannya.
- `src/features/reports/lib/report-draft-store.ts` menyimpan draf lokal. Halaman `/lapor` dan API submit belum tersedia.
- `src/lib/prisma.ts`, `src/lib/auth.ts`, dan Better Auth API sudah aktif sebagai fondasi autentikasi. Prisma belum memiliki tabel domain paket, laporan, atau ingestion; migrasi PostGIS baru mengaktifkan ekstensi.
- `docs/ARCHITECTURE.md` mendefinisikan keputusan, alur API, batas worker scraper, dan tahapan pengembangan.

---

## 3. Matriks Kesenjangan Implementasi (Gap Analysis)

| Komponen / Fitur | Target | Status di Kode Saat Ini | Tindakan yang Dibutuhkan |
|---|---|---|---|
| **Penyajian paket** | UI mengakses paket melalui server contract | Initial data via Server Component; filter via `GET /api/packages`; snapshot dibaca server-only | Ganti snapshot adapter dengan Prisma setelah domain schema siap |
| **Peta dan register (`/`)** | Peta audit, daftar paket, filter tahun/kecamatan/jenis pekerjaan | Sudah terhubung ke 3.602 paket jalan; list menampilkan maksimal 120 item dan peta memakai hasil filter | Pisahkan halaman register dari compact map features; tambah query viewport saat skala membutuhkannya |
| **Supabase/PostGIS domain** | Paket, lokasi dengan presisi, provenance, dan query spasial | PostGIS aktif; Prisma saat ini hanya memodelkan Better Auth | Definisikan model sumber/provenance dan geometri sebelum migrasi data |
| **Scraper pemerintah dan sosial** | Proses terjadwal, terpisah dari web | Belum diimplementasikan | Tentukan akses sumber, validasi, idempotensi, log, retry, dan kredensial khusus |
| **Lapor warga (`/lapor`)** | Draf privat lokal dan submit dengan status moderasi | IndexedDB draf tersedia; halaman dan API submit belum ada | Tetapkan aturan privasi, moderasi, abuse control, serta retensi sebelum persistensi |
| **Dokumentasi arsitektur** | Menjelaskan boundary dan alur data terkini | `docs/ARCHITECTURE.md` tersedia | Jaga README, handoff, dan status proyek selaras |

---

## 4. Kesehatan Teknis & Build

- **Node/Bun Environment:** Windows x64, Bun 1.4.2, Node 24 kompatibel.
- **Git Branch:** `master`, sinkron dengan `origin/master` (commit terakhir `ec98936`).
- **Build Status:** `PASS` (`bun run build`).
- **Lint Status:** `PASS` (`bun run lint`).
- **Kepatuhan Privasi:** Kredensial lokal terisolasi di `.env.local` (diabaikan git).
