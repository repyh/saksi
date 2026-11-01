# STATE — Kondisi Terkini Proyek SAKSI

**Tanggal Pembaruan:** 1 November 2026
**Target Terdekat:** First Draft Submission (FDS) — **1 November 2026**
**Kompetisi:** Web In Action (WIA) — MIA 2026 (KSM Multimedia UPN Veteran Jakarta)
**Tema / Subtema:** *Designing Digital Futures – Powering Public Transparency* / **Civic Reporting & Accountability**
**Identitas Produk:** **SAKSI** (*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*)

---

## 1. Ringkasan Eksekutif & Posisi Saat Ini

Fokus dipersempit ke **satu jenis infrastruktur: JALAN**, studi kasus **Kota Tangerang**
(`idKldi=D44`, BPS `3671`), TA 2025–2026. Studi kasus Kabupaten Tangerang (D50) dan Bandung tetap
disimpan sebagai arsip pipeline, bukan produk.

Angka snapshot **31 Oktober 2026**:

- **1.557 paket jalan/jembatan/drainase**, pagu **Rp650,18 Miliar** (TA2025 939 · TA2026 618).
- Anchor lokasi: **RW 818 (52,5%)**, **kelurahan 337 (21,6%)**, **tanpa lokus 402 (25,8%)**.
- **80 dari 104 kelurahan** dan **483 dari 1.020 RW** tersentuh, di **13 kecamatan**.
- **Tidak ada paket yang punya koordinat pekerjaan.** Peta mewarnai batas wilayah, bukan titik.

Alasan pindah dari Kabupaten: Kabupaten tidak punya GIS publik (hanya TileServer GL OSM), sedangkan
Kota punya ArcGIS 10.71 dengan batas RW/kelurahan resmi. Alasan anchor RW: uji 31 Oktober menunjukkan
hanya **7%** paket menyebut nama ruas yang bisa dicocokkan, sementara **54,8%** menyebut nomor RW.

### Status Kesiapan FDS (1 November 2026)

1. **Repositori Publik GitHub** — ada (`github.com/repyh/saksi`), README diperbarui ke angka Kota.
2. **Dokumen PDF FDS maks 10 halaman** — belum dibuat.
3. **Dua Layar Hidup** — sudah ada:
   - **Landing + peta audit (`/`, `/project`):** koroplet RW/kelurahan, filter tahun/kecamatan/jenis/
     tampilan, panel register paket.
   - **Alur lapor (`/laporan`, `/laporan/paket/[rup]`):** 4 langkah, kategorisasi kerusakan oleh
     pelapor, draf lokal di IndexedDB, tanpa unggah foto.

---

## 2. Inventaris Aset & Keadaan Repositori

### 2.1 Basis Teknologi (Active Stack)

- **Framework:** Next.js 16.4.3 (Turbopack, App Router, React 19.3.0, TypeScript 5).
- **Styling & UI Kit:** Tailwind CSS v4, `shadcn/ui` (`@base-ui/react`, `class-variance-authority`,
  `tw-animate-css`, ikon `lucide-react` + `react-icons`).
- **Peta:** Leaflet 1.9.4 & `react-leaflet` 5.0.0 dengan tile OpenStreetMap.
- **Package Manager:** Bun 1.4.2 (`bun.lock`); `npm` juga jalan. Node dipin di `.nvmrc` = 24.
- **Verifikasi:** `npm run lint` bersih, `npm run build` sukses **tanpa `DATABASE_URL`**.

### 2.2 Dataset Tersedia (`data/` dan `public/data/`)

- `data/saksi_kota_tangerang_2025_2026.json` (**681 KB**): 1.557 paket jalan + field anchor
  (`rw`, `unit_id`, `presisi_peta`) — dibaca server-only, tidak disalin ke `public/`.
- `public/data/rw.geojson` (**810 KB**): 1.020 poligon RW dari `Batas_Adminsitratif/batas_rw_2021`.
- `public/data/kel.geojson` (**191 KB**): 104 poligon kelurahan.
- Arsip: `saksi_tangerang_2025_2026.json` (Kabupaten), `saksi_bandung_2025_2026.json`,
  `tangerang_desa_coords.json`, `bandung_desa_coords.json`, `jalan.json`, `provinsi.json`,
  `nasional.json`, `manifest.json`, `vendor_jakarta.json`.

Sumber: SIRUP Inaproc (`dataruppenyediakldi?idKldi=D44`, 21.402 baris 2025+2026) dan ArcGIS Kota
Tangerang. Pipeline pembangun ada di repo kerja `~/dev/saksi` (`tools/build_kota.py`).

### 2.3 Implementasi dan Batas Frontend/Backend

- `src/app/page.tsx` — Server Component yang meminta data awal kepada use case paket.
- `src/features/map/map-dashboard.tsx` + `map-canvas.tsx` — filter, mode tampilan (Jumlah paket /
  Nilai anggaran / Jenis pekerjaan), koroplet dua tingkat zoom (RW ≥ 12, kelurahan di bawahnya).
- `src/app/api/packages/route.ts` → `src/server/packages/service.ts` → `snapshot-repository.ts`
  (server-only + type guard runtime).
- `src/features/reports/components/report-prototype.tsx` — alur lapor; draf disimpan di IndexedDB
  (`saksi-local-reports`); belum ada API submit.
- `src/lib/prisma.ts` + `src/lib/auth.ts` — **opsional**: klien Prisma dibuat saat dipakai, route
  `/api/auth/*` menjawab `503` bila `DATABASE_URL` kosong, dan build tidak menuntut database.
- `docs/ARCHITECTURE.md` — batas frontend/backend, kontrak API, rencana worker scraper.

---

## 3. Matriks Kesenjangan Implementasi (Gap Analysis)

| Komponen / Fitur | Target | Status di kode | Tindakan yang dibutuhkan |
|---|---|---|---|
| **Penyajian paket** | UI lewat kontrak server | Server Component + `GET /api/packages`; snapshot server-only | Ganti adapter snapshot dengan Prisma setelah skema domain siap |
| **Peta & register** | Koroplet RW/kelurahan + register | Jalan: koroplet 2 tingkat, filter, register | Paginasi/limit API; mode "Jenis pekerjaan" masih ikon pin di centroid → ganti bentuk agregat |
| **Metrik header** | Angka diturunkan dari data | Konstanta `DEFAULT_KOTA_TANGERANG_METRICS` (benar per 31 Okt) | Turunkan dari data + asersi saat build |
| **Badge provenance** | `DATA RESMI` / `SIMULASI PROTOTIPE` | Belum ada | Tambahkan di header peta dan halaman laporan |
| **Supabase/PostGIS domain** | Model paket, laporan, geometri | PostGIS aktif; Prisma baru memodelkan auth | Definisikan model provenance + geometri |
| **Scraper pemerintah/sosial** | Worker terjadwal terpisah | Belum ada | Tentukan akses, validasi, idempotensi, log |
| **Lapor warga** | Draf lokal + submit bermoderasi | Draf IndexedDB; tanpa submit | Tetapkan privasi, moderasi, abuse control, retensi |
| **Dokumentasi** | Selaras dengan kode | README & STATE diperbarui 1 Nov | `AGENTS.md` masih versi Kabupaten — selaraskan |

---

## 4. Kesehatan Teknis & Build

- **Node/Bun:** Node 24 (`.nvmrc`), Bun 1.4.2.
- **Git:** branch `master`, remote `origin` = `github.com/repyh/saksi`.
- **Build:** `PASS` — `npm run build` sukses tanpa `DATABASE_URL` (11 rute, 10 statis).
- **Lint:** `PASS` — `npm run lint` tanpa temuan.
- **Database:** opsional. Tanpa `DATABASE_URL`, auth menjawab `503` dan data paket tetap penuh dari
  snapshot.
- **Privasi:** kredensial lokal hanya di `.env.local` (diabaikan git).
