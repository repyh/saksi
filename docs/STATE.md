# STATE — Kondisi Terkini Proyek SAKSI

**Tanggal Pembaruan:** 8 November 2026
**Target Terdekat:** Penyisihan **11 November 2026** (proposal ≤30 halaman, surat orisinalitas, video ≤5 menit)
**Final:** onsite **28 November 2026**
**Kompetisi:** Web In Action (WIA) — MIA 2026 (KSM Multimedia UPN Veteran Jakarta)
**Tema / Subtema:** *Designing Digital Futures – Powering Public Transparency* / **Civic Reporting & Accountability**
**Identitas Produk:** **SAKSI** (*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*)

---

## 1. Ringkasan Eksekutif & Posisi Saat Ini

Fokus dipersempit ke **satu jenis infrastruktur: JALAN** (jalan, jembatan, drainase/saluran,
trotoar, TPT/turap), studi kasus **Kota Tangerang** (`idKldi=D44`, BPS `3671`), TA 2025–2026.
Kabupaten Tangerang (D50) dan Bandung hanya tersisa sebagai arsip pipeline, bukan produk.

Angka snapshot **5 November 2026** (sumber RUP `data.inaproc.id`); detail RUP ditarik ulang
**8 November 2026**; realisasi penyedia dari ekspor CSV **6 November 2026**. Angka 31 Oktober/3
November di dokumen lama adalah riwayat pipeline.

Rebuild 8 November 2026 memperbaiki pengenalan prefiks ruas **`Jl.`/`Jl`** sebagai objek jalan
(`scripts/build-snapshot.mjs`). Sebelumnya 918 paket "Peningkatan Jl. Lingk. ..." tidak masuk karena
tidak memuat kata "jalan"; audit seluruh penambahan memastikan semuanya berbentuk
`Peningkatan Jl. Lingk.` (satu paket supervisi) dan empat kasus positif palsu — gapura, ornamen,
signage, dan wisata kano yang hanya menyebut `Jl.` sebagai alamat — tetap ditolak.

Rebuild lanjutan menangani varian lokasi: **`RW O7` dibaca sebagai RW 7**, dan lima varian ejaan
kelurahan dipetakan eksplisit ke satu kelurahan resmi — `Nusajaya` → Nusa Jaya, `Neroktog` →
Nerogtog, `Karangsari` → Karang Sari, `Batu Jaya` → Batujaya, `Mekasari` → Mekarsari. Tidak ada
pencocokan fuzzy; setiap alias divalidasi saat build. 42 paket mendapat anchor lebih dalam (38 pindah
ke RW, 4 ke kelurahan), sehingga presisi kecamatan turun dari 108 menjadi 83.

- **2.552 paket jalan/jembatan/drainase**, pagu **Rp813,13 Miliar** (TA2025 1.592 · TA2026 960).
- Jenis pekerjaan: **drainase 1.303 · permukaan 1.205 · jembatan 44**.
- Anchor lokasi: **RW 1.609 (63,0%)**, **kelurahan 514 (20,1%)**, **kecamatan 83 (3,3%)**,
  **tanpa lokus 346 (13,6%)** → **2.206 paket (86,4%) punya lokus turunan**.
- Jangkauan: **86 dari 104 kelurahan**, **584 dari 1.020 RW**, **13 kecamatan**.
- Penyedia: **2.334 dari 2.552 paket (91,5%)** punya nama penyedia — **731 dari LPSE/SPSE**,
  **1.603 dari Data INAPROC realisasi**; **218 paket** (Rp132,34 M; 16,3% pagu) tanpa rekam publik;
  **633 penyedia unik**; rasio kontrak/pagu median **0,99**.
- **Tidak ada paket yang punya koordinat pekerjaan.** Peta mewarnai batas wilayah, bukan titik.

Alasan pindah dari Kabupaten: Kabupaten tidak punya GIS publik (hanya TileServer GL OSM), sedangkan
Kota punya ArcGIS dengan batas RW/kelurahan/kecamatan resmi. Alasan anchor RW: uji 31 Oktober
menunjukkan hanya **7%** paket menyebut nama ruas yang bisa dicocokkan, sementara **54,8%** menyebut
nomor RW dan **20,6%** kelurahan.

### Status kesiapan penyisihan (11 November 2026)

1. **Repositori publik** — `github.com/repyh/saksi`.
2. **Dokumen proposal PDF** — belum dibuat (batas 30 halaman).
3. **Surat orisinalitas bermaterai Rp10.000** — belum dibuat.
4. **Video pitching ≤5 menit di YouTube publik** — belum dibuat.
5. **Dua layar hidup** — sudah ada:
   - **Landing + peta audit (`/`, `/project`):** koroplet tiga tingkat lewat segmented control,
     filter tahun → kecamatan → kelurahan, jenis pekerjaan, rekam kontrak LPSE, pencarian, dan
     register paket + panel pelaksana/kontrak.
   - **Alur lapor (`/laporan`, `/laporan/paket/[rup]`):** 4 langkah; submit memakai API dengan
     idempotency key, CORS allowlist, dan bucket privat Supabase.

---

## 2. Inventaris Aset & Keadaan Repositori

### 2.1 Basis Teknologi (Active Stack)

- **Framework:** Next.js 16 (Turbopack, App Router, React 19, TypeScript 5).
- **Styling & UI Kit:** Tailwind CSS v4, `shadcn/ui` (`@base-ui/react`, `class-variance-authority`),
  ikon `lucide-react` + `react-icons`.
- **Peta:** MapLibre GL JS 6.16 dengan vector style **OpenFreeMap Positron**. Peta dasar diatur satu
  variabel `NEXT_PUBLIC_BASEMAP_URL` (berisi URL style JSON; default
  `https://tiles.openfreemap.org/styles/positron`); atribusi OpenStreetMap/OpenFreeMap.
- **Auth & data opsional:** Prisma + Better Auth (menjawab `503` bila `DATABASE_URL` kosong),
  Supabase Storage untuk bukti laporan.
- **Verifikasi terakhir (8 Nov 2026):** `npm run lint` 0 temuan, `npm run build` hijau **tanpa
  `DATABASE_URL`**, dan metrik landing dicocokkan dengan snapshot (lihat `docs/HANDOFF.md`).

### 2.2 Dataset Tersedia (`data/` dan `public/data/`)

- `data/saksi_kota_tangerang_2025_2026.json` — 2.552 paket jalan + anchor (`rw`, `unit_id`,
  `presisi_peta`, `bulan`, `kecamatan_resmi`, `desa_resmi`); dibaca server-only.
- `data/lpse_kota_tangerang_2025_2026.json` — 731 paket dengan nama pelaksana dari SPSE (kolom sumber
  `pemenang`); 1.739 paket RUP punya pengumuman LPSE yang tercocokkan.
- `data/realisasi_kota_tangerang.json` — 50.836 baris realisasi (37.278 TA2025 + 13.558 TA2026,
  snapshot 6 November 2026) untuk seluruh satker D44; sumber penyedia e-purchasing.
- `public/data/rw.geojson` (1.020 poligon), `kel.geojson` (104), `kec.geojson` (13, dari ArcGIS kota,
  dibuat ulang lewat `npm run data:kecamatan`).
- Arsip pipeline lama (Kabupaten/Bandung) hanya untuk referensi, tidak dipakai UI.

Sumber utama: **ekspor RUP `data.inaproc.id`** (28.699 baris D44 2025+2026, ditarik `scripts/rup.mjs`), detail RUP
`data.inaproc.id`, SPSE `spse.inaproc.id/tangerangkota`, Data INAPROC realisasi (ekspor CSV), dan
ArcGIS Kota Tangerang. Pipeline pembangun ada di repo kerja `~/dev/saksi` (`tools/build_kota.py`) dan
`scripts/` di repo ini (`lpse.mjs`, `realisasi.mjs`, `rup.mjs`, `enrich-rup.mjs`, `kecamatan.mjs`).

### 2.3 Implementasi dan Batas Frontend/Backend

- `src/app/page.tsx` — Server Component yang meminta data awal ke use case paket (default hanya
  paket berlokasi: 2.206).
- `src/features/map/map-dashboard.tsx` — filter tahun, kecamatan → kelurahan (checkbox), jenis
  pekerjaan, kontrak, pencarian, mode tampilan (Jumlah paket / Nilai anggaran / Jenis pekerjaan),
  register paket, panel pelaksana & kontrak.
- `src/features/map/map-canvas.tsx` — koroplet tiga tingkat dengan segmented control
  **Kecamatan / Kelurahan / RW** (bukan berdasarkan zoom), legenda mengikuti tingkat, agregasi
  kecamatan memakai kelas kuantil.
- Tautan bukti penyedia: paket dengan rekam LPSE membuka halaman SPSE aslinya; paket tanpa rekam LPSE
  membuka **`https://data.inaproc.id/realisasi?kode=<kode paket>`**. Penting: parameter itu memakai
  **kode paket realisasi** (kode tender / kode e-katalog), **bukan** kode RUP — RUP hanya dipakai untuk
  join. Detail RUP tetap bisa dibuka lewat `https://data.inaproc.id/rup?kode=<kode_rup>`.
  Relasi RUP↔paket dan ketersediaan halaman detail dianalisis di `docs/RELASI-RUP-REALISASI.md`.
- RUP dengan **lebih dari satu paket realisasi** (relasi 1–N, hanya e-purchasing/pengadaan langsung)
  ditampilkan eksplisit: badge "· N paket" di daftar; baris **Penyedia** di panel memuat semua penyedia
  beserta total nilainya (baris pertama dua nama, sisanya di balik "+N penyedia lainnya"); baris
  **Paket realisasi** membuka rincian per penyedia (jumlah paket + total), dan tiap paket menampilkan
  kode paket (tautan ke Data INAPROC) serta nilai realisasinya. Tidak ada baris "Penyedia lain" terpisah
  dan label "Selisih pagu" tetap apa adanya (pembanding = total realisasi RUP). Relasi M–N tidak muncul di cakupan ini
  (0 dari 2.552 paket; 40 kode paket di seluruh D44 memetakan ke lebih dari satu RUP).
- Baris realisasi ber-metode **Swakelola** dan nama "penyedia" yang sebenarnya instansi (Dinas, OPD,
  Pegawai Dinas) **tidak** dihitung sebagai pelaksana — 43 paket swakelola tampil sebagai tanpa rekam
  kontrak, bukan dengan penyedia palsu.
- `src/app/api/packages/route.ts` → `src/server/api/packages/*` → `src/server/packages/service.ts` →
  `snapshot-repository.ts` + `lpse-repository.ts` (server-only + type guard runtime).
- `/penyedia`, `/penyedia/[slug]` — daftar & detail penyedia (731 dari LPSE, 1.603 dari realisasi;
  633 penyedia unik).
- `src/features/reports/components/report-prototype.tsx` — empat langkah laporan; submit memakai API,
  metadata ke Postgres, foto WebP tersanitasi ke bucket privat. Submit lewat route API yang sama
  dengan UI sudah diverifikasi end-to-end **8 November 2026**: receipt, riwayat akun, antrean review,
  baris Postgres, dan objek WebP privat; data uji dihapus.
- `src/lib/prisma.ts` + `src/lib/auth.ts` — **opsional**: klien dibuat saat dipakai, route
  `/api/auth/*` menjawab `503` tanpa `DATABASE_URL`.
- `docs/ARCHITECTURE.md` — batas frontend/backend, kontrak API, rencana worker scraper.

### 2.4 Keadaan Git

- Repo kerja: `~/dev/saksi-web` (remote `repyh/saksi`); worktree aktif P1:
  `.../worktrees/parser-jl-road-prefix`.
- **Branch aktif: `fix/anchor-location-variants`** — varian lokasi (`RW O7`, alias kelurahan) di
  `scripts/build-snapshot.mjs`, rebuild snapshot, dan penyelarasan dokumen. Basis: `master` setelah
  `fix/parser-jl-road-prefix` (`283156c`).
- **Basis peta:** migrasi MapLibre sudah ada di `master` sebelum P0.
- **`feat/map-layer`** — eksperimen pemilih basemap (OSM/Positron/Satelit) yang **tidak dipakai**;
  basemap tunggal produk kini OpenFreeMap Positron.
- Repo arsip FDS: `~/Hermes/wia-webcomp-2026` (HEAD `c88f667`, bersih); repo Vite kanonik FDS:
  `~/dev/saksi` (`fds-poc`, HEAD `010738a`).

---

## 3. Matriks Kesenjangan Implementasi (Gap Analysis)

| Komponen / Fitur | Target | Status di kode | Tindakan yang dibutuhkan |
|---|---|---|---|
| **Penyajian paket** | UI lewat kontrak server | Server Component + `GET /api/packages`; snapshot server-only | Ganti adapter snapshot dengan Prisma setelah katalog domain diimpor |
| **Peta & register** | Koroplet batas resmi + register | Jalan: tiga tingkat (kecamatan/kelurahan/RW) via segmented control, filter lengkap, register + panel kontrak | Paginasi/limit API untuk daftar besar |
| **Metrik header** | Angka diturunkan dari data | Selesai: `src/server/packages/audit-metrics.ts` menghitung 2.552 paket, Rp813,13 M, 1.592/960, 2.206 (86,4%), 346 tanpa lokus, 86/104 kelurahan, 584/1.020 RW, 13 kecamatan, anchor 1.609/514/83, dan tanggal snapshot | Tambahkan asersi/uji bila metrik dipakai di luar landing |
| **Badge provenance** | `DATA RESMI` / `SIMULASI PROTOTIPE` | `DATA RESMI (LPSE/INAPROC)` di panel kontrak & halaman penyedia; `SIMULASI PROTOTIPE` di alur lapor | Badge SIRUP/Bina Marga dan badge presisi lokasi belum |
| **Supabase/PostGIS domain** | Katalog paket, wilayah, laporan | Migration auth, undangan, report sudah diterapkan; tabel katalog paket/wilayah belum diimpor | Impor katalog bersumber sebelum mengganti repository snapshot |
| **Scraper terjadwal** | Worker terpisah | Belum ada (pengambilan data masih manual via `scripts/`) | Tentukan jadwal, idempotensi, log |
| **Lapor jalan** | Submit bermoderasi + opsional akun | API, idempotensi, CORS, model Prisma, bucket privat, antrean review tersedia; submit end-to-end terverifikasi 8 Nov 2026 | Akses bukti, transisi status, retensi (`docs/REPORTS.md`) |
| **Dokumentasi** | Selaras dengan kode | STATE, HANDOFF, README, CONCEPT, PRODUCT, SPEC, DESIGN diperbarui 8 Nov 2026 | Jaga `AGENTS.md` tetap sinkron saat aturan produk berubah |

---

## 4. Kesehatan Teknis & Build

- **Node:** v26.8.1 di mesin pengembangan; `.nvmrc` menunjuk 24. Lockfile belum dilacak git.
- **Build:** `PASS` — `npm run build` sukses tanpa `DATABASE_URL`.
- **Lint/Type:** `PASS` — `eslint .` dan `tsc --noEmit` tanpa temuan.
- **Database:** opsional. Tanpa `DATABASE_URL`, auth menjawab `503` dan data paket tetap penuh dari
  snapshot.
- **Privasi:** kredensial lokal hanya di `.env.local` (diabaikan git). Migrasi liar
  `prisma/migrations/20261105085537_init` (berisi `DROP INDEX`) sudah dihapus 5 Nov 2026.

## 5. Aturan Produk yang Tidak Boleh Dilanggar

1. **Satu jenis infrastruktur: jalan.** Jangan menambah sektor lain.
2. **Tidak ada pin/titik/jitter per paket.** Lokasi hanya ditampilkan sebagai batas wilayah.
3. **Tingkat poligon dipilih manual**, bukan mengikuti zoom.
4. **Filter wilayah bertingkat:** kecamatan dulu, lalu kelurahan (checkbox). Nol kelurahan bukan
   berarti "semua" — tampilkan peringatan merah dan jangan kirim permintaan.
5. **Default hanya paket berlokasi** (2.206 dari 2.552); 346 paket presisi kabupaten muncul hanya bila
   "Hanya paket berlokasi" dimatikan.
6. **Notasi pelaksana:** sebut **"pemenang" hanya untuk `jenis === "tender"`** (lelang/seleksi);
   selain itu (pengadaan langsung, e-purchasing, penunjukan langsung) sebut **"penyedia"**. Field
   internal dan API memakai `penyedia`; kolom sumber SPSE tetap bernama `pemenang`.
7. **Penyedia disajikan berimbang** — selalu dengan penyebut (jumlah paket/kelas/tahun), tanpa skor
   gabungan; istilah tetap "paket dengan laporan kerusakan dalam masa pemeliharaan".
8. **Ditolak dan jangan dihidupkan lagi:** NLP ekstraksi lokasi, CV klasifikasi kerusakan,
   Google Places (larangan cache/store), nama ruas sebagai anchor.
