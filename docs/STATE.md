# STATE — Kondisi Terkini Proyek SAKSI

**Tanggal Pembaruan:** 9 November 2026
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

Rebuild lanjutan menangani varian lokasi: **`RW O7` dibaca sebagai RW 7**, dan sepuluh varian ejaan
kelurahan dipetakan eksplisit ke satu kelurahan resmi — `Nusajaya` → Nusa Jaya, `Neroktog` →
Nerogtog, `Karangsari` → Karang Sari, `Batu Jaya` → Batujaya, `Mekasari` → Mekarsari, `Priuk Jaya` →
Periuk Jaya, `Parug Serab` → Parung Serab, `Batu Ceper` → Batuceper, `Suka Asih` → Sukaasih,
`Larangan Utra` → Larangan Utara. Tidak ada pencocokan fuzzy; setiap alias divalidasi saat build.
48 paket mendapat anchor lebih dalam (41 pindah ke RW, 7 ke kelurahan), sehingga presisi kecamatan
turun dari 108 menjadi 79.

- **2.552 paket jalan/jembatan/drainase**, pagu **Rp813,13 Miliar** (TA2025 1.592 · TA2026 960).
- Jenis pekerjaan: **drainase 1.303 · permukaan 1.205 · jembatan 44**.
- Anchor lokasi: **RW 1.612 (63,2%)**, **kelurahan 517 (20,3%)**, **kecamatan 79 (3,1%)**,
  **tanpa lokus 344 (13,5%)** → **2.208 paket (86,5%) punya lokus turunan**.
- Jangkauan: **87 dari 104 kelurahan**, **585 dari 1.020 RW**, **13 kecamatan**.
- Penyedia: **2.334 dari 2.552 paket (91,5%)** punya nama penyedia — **731 dari LPSE/SPSE**,
  **1.603 dari Data INAPROC realisasi**; **218 paket** (Rp132,34 M; 16,3% pagu) tanpa rekam publik;
  **633 entri penyedia unik** pada manifest (630 setelah normalisasi nama gabungan); rasio kontrak/pagu median **0,99**.
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
   - **Landing + peta audit (`/`, `/peta-pekerjaan`):** koroplet tiga tingkat lewat segmented control,
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

Berkas berikut tetap menjadi artefak provenance dan **fallback** repository. Bila `DATABASE_URL`
diisi, tampilan membaca katalog Supabase; tanpa database, repository kembali ke berkas ini.

- `data/saksi_kota_tangerang_2025_2026.json` — 2.552 paket jalan + anchor (`rw`, `unit_id`,
  `presisi_peta`, `bulan`, `kecamatan_resmi`, `desa_resmi`); cadangan server-only.
- `data/lpse_kota_tangerang_2025_2026.json` — 731 paket dengan nama pelaksana dari SPSE (kolom sumber
  `pemenang`); 1.739 paket RUP punya pengumuman LPSE yang tercocokkan.
- `data/realisasi_kota_tangerang.json` — 50.836 baris realisasi (37.278 TA2025 + 13.558 TA2026,
  snapshot 6 November 2026) untuk seluruh satker D44; sumber penyedia e-purchasing.
- `public/data/rw.geojson` (1.020 poligon), `kel.geojson` (104), `kec.geojson` (13, dari ArcGIS kota,
  dibuat ulang lewat `npm run data:kecamatan`).
- `data/regions/kota-tangerang/{region.json,aliases.json}` — konfigurasi daerah untuk snapshot dan
  pipeline penarikan (`rup.mjs`, `realisasi.mjs`, `lpse.mjs`): path sumber, kode instansi, tahun,
  properti batas, token lokasi, host SPSE, dan alias kelurahan. Region lain cukup menambah direktori
  baru lalu menjalankan `--region <id>`; `batas.lingkungan` opsional, dan tanpanya presisi tertinggi
  adalah kelurahan (`rw` selalu `null`).
- Arsip pipeline lama (Kabupaten/Bandung) hanya untuk referensi, tidak dipakai UI.

Sumber utama: **ekspor RUP `data.inaproc.id`** (28.699 baris D44 2025+2026, ditarik `scripts/rup.mjs`), detail RUP
`data.inaproc.id`, SPSE `spse.inaproc.id/tangerangkota`, Data INAPROC realisasi (ekspor CSV), dan
ArcGIS Kota Tangerang. Pipeline pembangun ada di repo kerja `~/dev/saksi` (`tools/build_kota.py`) dan
`scripts/` di repo ini (`lpse.mjs`, `realisasi.mjs`, `rup.mjs`, `enrich-rup.mjs`, `kecamatan.mjs`).

### 2.3 Implementasi dan Batas Frontend/Backend

- `src/app/page.tsx` — Server Component yang meminta data awal ke use case paket (default hanya
  paket berlokasi: 2.208).
- `src/app/metode/page.tsx` — halaman `/metode` (Server Component) yang menjelaskan sumber dan
  tanggal, pipeline, alasan anchor RW, angka snapshot, dua lapis penyedia, batas 218 paket, larangan
  klaim koordinat, apa yang tidak diklaim, dan mekanisme pembaruan worker. Angka dibangun oleh
  `src/server/packages/methodology.ts` dari manifest, snapshot, dan indeks kontrak.
- `src/features/map/map-dashboard.tsx` — filter tahun, kecamatan → kelurahan (checkbox), jenis
  pekerjaan, kontrak, pencarian, mode tampilan (Jumlah paket / Nilai anggaran / Jenis pekerjaan),
  register paket berpaginasi (`page`/`limit`, 50 baris pertama, tombol muat berikutnya), panel
  pelaksana & kontrak.
- `src/features/map/map-canvas.tsx` — koroplet tiga tingkat dengan segmented control
  **Kecamatan / Kelurahan / RW** (bukan berdasarkan zoom), legenda mengikuti tingkat, agregasi
  kecamatan memakai kelas kuantil. Peta menerima agregat ringkas dari `GET /api/packages/map` yang
  dibatasi `bbox` viewport, bukan seluruh baris paket; klik wilayah memuat detail paket contoh lewat
  `GET /api/packages/[rup]`.
- Tautan bukti penyedia: paket dengan rekam LPSE membuka halaman SPSE aslinya; paket tanpa rekam LPSE
  membuka **`https://data.inaproc.id/realisasi?kode=<kode paket>`**. Penting: parameter itu memakai
  **kode paket realisasi** (kode tender / kode e-katalog), **bukan** kode RUP — RUP hanya dipakai untuk
  join. Detail RUP tetap bisa dibuka lewat `https://data.inaproc.id/rup?kode=<kode_rup>`.
  Relasi RUP↔paket dan ketersediaan halaman detail dianalisis di `docs/RELASI-RUP-REALISASI.md`.
- RUP dengan **lebih dari satu paket realisasi** (relasi 1–N, hanya e-purchasing/pengadaan langsung)
  ditampilkan eksplisit: badge "· N paket" di daftar; baris **Penyedia** di panel memuat semua penyedia
  beserta total nilainya (baris pertama dua nama, sisanya di balik "+N penyedia lainnya"); penyedia
  yang berbagi transaksi bertanda **nilai bersama** dan tidak diberi nilai hasil pembagian. Baris
  **Paket realisasi** membuka rincian per penyedia (jumlah paket + total), dan tiap paket menampilkan
  kode paket (tautan ke Data INAPROC) serta nilai realisasinya. Tidak ada baris "Penyedia lain" terpisah
  dan label "Selisih pagu" tetap apa adanya (pembanding = total realisasi RUP). Relasi M–N tidak muncul di cakupan ini
  (0 dari 2.552 paket; 40 kode paket di seluruh D44 memetakan ke lebih dari satu RUP).
- Baris realisasi ber-metode **Swakelola** dan nama "penyedia" yang sebenarnya instansi (Dinas, OPD,
  Pegawai Dinas) **tidak** dihitung sebagai pelaksana — 43 paket swakelola tampil sebagai tanpa rekam
  kontrak, bukan dengan penyedia palsu.
- `src/app/api/packages/route.ts` → `src/server/api/packages/*` → `src/server/packages/service.ts` →
  `source.ts` → `database-repository.ts` (Prisma) atau `snapshot-repository.ts` (cadangan) +
  `lpse-repository.ts` (server-only + type guard runtime).
- **Region:** `src/server/regions/region-registry.ts` membaca `data/regions/*/region.json`; endpoint
  `GET /api/packages?region=<id>` memilih snapshot, kontrak, batas, dan label. Halaman `/`,
  `/peta-pekerjaan`, `/paket`, `/paket/[rup]`, `/penyedia`, `/penyedia/[slug]`, dan
  `/laporan/paket/[rup]` meneruskan `?region=`. Pemilih wilayah
  hanya muncul bila ada lebih dari satu region; peta membaca URL batas + nama properti dari region.
- **Gerbang & ingest:** `npm run region:check -- --region <id>` memvalidasi snapshot; `--manifest`
  menulis `data/regions/<id>/manifest.json`. `npm run region:ingest -- --region <id>` menjalankan
  RUP → detail → realisasi → LPSE → snapshot → gate dengan jeda antar-perintah; `--semua` untuk
  seluruh region, `--dry-run` untuk melihat rencana.
- `/penyedia`, `/penyedia/[slug]` — daftar & detail penyedia (731 dari LPSE, 1.603 dari realisasi;
  manifest mencatat 633 entri penyedia unik; normalisasi nama gabungan yang valid menghasilkan 630
  nama di register tanpa mengubah total paket).
- `src/features/reports/components/report-prototype.tsx` — empat langkah laporan; submit memakai API,
  metadata ke Postgres, foto WebP tersanitasi ke bucket privat. Submit lewat route API yang sama
  dengan UI sudah diverifikasi end-to-end **8 November 2026**: receipt, riwayat akun, antrean review,
  baris Postgres, dan objek WebP privat; data uji dihapus.
- `/laporan/publik` + `GET /api/reports/public` — daftar laporan **PUBLISHED** per region/paket/
  kecamatan/kelurahan; hanya jenis kerusakan, ukuran kasar, wilayah, tanggal, dan tautan paket.
  Tidak memuat identitas pelapor, deskripsi, petunjuk lokasi, lokasi presisi, atau foto.
- `/` — eksplorasi anggaran: `buildBudgetExplorer()` (`src/server/packages/budget-explorer.ts`)
  membagi paket per tahun → dekade pagu (D1–D10) → jenis pekerjaan, dengan tautan peta yang membawa
  `tahun`, `kelompok`, `jenis`, dan `lokasi`; `BudgetExplorer` menampilkan chart konsentrasi, median,
  dan rentang pagu tiap dekade. Endpoint peta menerima `kelompok` lewat
  `selectBudgetDecile()` (`src/contracts/packages/budget-decile.ts`).
- `/kebijakan-privasi` dan `/syarat-ketentuan` — halaman legal dari Markdown di
  `src/content/legal/*.md` lewat `src/components/markdown/markdown-renderer.tsx`.
- `/paket` — direktori paket jalan (Server Component, `?region=`): pencarian teks, filter tahun
  dan jenis pekerjaan, pengurutan, dan paginasi 50 baris; setiap baris menaut ke detail paket.
  `/paket/[rup]` — halaman bacaan detail paket (Server Component, `?region=`). Memuat ringkasan,
  rencana pengadaan dari `data/rup_detail_*.json` (jadwal pemilihan & kontrak, uraian, volume,
  spesifikasi, MAK), lokasi sebagai batas wilayah + badge presisi, realisasi/kontrak dari
  `buildPenyediaPanel`, dan maksimal 20 laporan `PUBLISHED` paket itu. Rincian RUP dibaca repository
  server-only `src/server/packages/rup-detail-repository.ts`; 918 paket tanpa entri tetap dirender
  dengan label "Belum tersedia dari RUP". `lokasi_raw` tidak pernah ditampilkan. Tanpa peta/titik;
  tombol "Lihat di peta" memakai `routeForPackage()`. Panel peta diringkas dan menaut ke halaman ini.
- `PATCH /api/reports/review/[reportId]` — aksi staf **Publikasikan** / **Tolak** dengan
  `reports.change_status`, alasan wajib, dan `ReportStatusEvent` append-only. Antrean review di
  Dashboard menampilkan tombol aksi dan formulir alasan. Diuji end-to-end 9 November 2026 dengan
  satu laporan uji; baris uji, sesi, dan event dibersihkan setelahnya.
- `src/lib/prisma.ts` + `src/lib/auth.ts` — **opsional**: klien dibuat saat dipakai, route
  `/api/auth/*` menjawab `503` tanpa `DATABASE_URL`.
- `docs/ARCHITECTURE.md` — batas frontend/backend, kontrak API, rencana worker scraper.

### 2.4 Keadaan Git

**Branch kanonik: `master`.** Seluruh pekerjaan P1 (poin 10–15) di-merge ke `master` dengan
fast-forward setelah rebase, lalu di-push ke `origin/master`.

| Poin | Branch | Commit |
|---|---|---|
| 10 | `feat/methodology-page` | `ddb9d04` — halaman `/metode` dan tautan navigasi |
| 11 | `feat/public-report-list` | `21b4024` — laporan publik dan aksi moderasi status |
| 12 | `feat/paginated-package-api` | `b806bfa` — paginasi register dan agregat peta |
| 13 | `fix/vendor-name-normalization` | `1b5a955` — normalisasi nama penyedia gabungan |
| 14 | `fix/report-copy-terminology` | `55256c9` — copy kelurahan/RW di alur lapor |
| 15 | `chore/branch-archive-canonical` | commit dokumentasi ini — kanonik branch dan arsip |
| — | `feat/retire-removed-permissions-and-dashboard-fixes` | merge ke `master` 10 Nov 2026: izin lama diarsipkan lewat migrasi `20261109170000_retire_removed_permissions`, dashboard/analitik anggaran, direktori `/paket`, detail `/paket/[rup]`, halaman legal, dan sitemap |

Setelah pengarsipan, branch yang dipertahankan:

- `fds` / `origin/fds` — arsip First Draft Submission dengan commit unik.
- `origin/fds-poc` — arsip Vite/FDS dengan commit unik.
- `feat/map-layer` / `origin/feat/map-layer` — eksperimen pemilih basemap yang tidak dipakai,
  commit unik.
- `test/report-e2e-supabase` / `origin/test/report-e2e-supabase` — riwayat uji E2E laporan, commit
  unik.
- `openchamber/logo-saksi` — pekerjaan logo dengan commit unik; worktree masih kotor.
- Branch yang sudah merged tetapi tetap ada karena masing-masing di-checkout di worktree terpisah:
  `feat/auth-db-permissions`, `feat/ingestion-worker-db`, `feat/migrate-maplibre`,
  `feat/region-config`, `fix/p0-review-fixes`, `gentle-aardvark`, `review`.

Branch lokal dan remote yang sudah fully merged dan worktree-nya bersih dihapus: branch P0
(`docs/snapshot-status-alignment`, `feat/data-pipeline`, `feat/lpse-pemenang`,
`feat/map-improvement`, `feat/report-prototype-badge`, `fix/anchor-location-variants`,
`fix/audit-metrics-snapshot`, `fix/parser-jl-road-prefix`), lima branch P1 di atas, serta remote
`feat/auth-db-permissions`, `feat/ingestion-worker-db`, `feat/migrate-maplibre`, dan
`fix/p0-review-fixes`. Tidak ada branch dengan commit unik atau worktree kotor yang dihapus.

- Repo kerja: `~/dev/saksi-web` (remote `repyh/saksi`); worktree P1 sementara `saksi-wt-*` sudah
  dibersihkan setelah merge.
- Repo arsip FDS: `~/Hermes/wia-webcomp-2026` (HEAD `c88f667`, bersih); repo Vite kanonik FDS:
  `~/dev/saksi` (`fds-poc`, HEAD `010738a`).

---

## 3. Matriks Kesenjangan Implementasi (Gap Analysis)

| Komponen / Fitur | Target | Status di kode | Tindakan yang dibutuhkan |
|---|---|---|---|
| **Penyajian paket** | UI lewat kontrak server | Server Component + `GET /api/packages`; repository Prisma saat `DATABASE_URL` diisi, snapshot sebagai cadangan | Pindahkan filter dan agregat peta ke SQL/PostGIS |
| **Peta & register** | Koroplet batas resmi + register | Jalan: tiga tingkat (kecamatan/kelurahan/RW) via segmented control, filter lengkap, register + panel kontrak; register memakai `page`/`limit`, peta memakai `GET /api/packages/map` dengan `bbox` viewport, dan detail paket dimuat lewat `GET /api/packages/[rup]` | Cache/precompute agregat; saat ini dihitung per permintaan |
| **Metrik header** | Angka diturunkan dari data | Selesai: `src/server/packages/audit-metrics.ts` menghitung 2.552 paket, Rp813,13 M, 1.592/960, 2.208 (86,5%), 344 tanpa lokus, 87/104 kelurahan, 585/1.020 RW, 13 kecamatan, anchor 1.612/517/79, dan tanggal snapshot | Tambahkan asersi/uji bila metrik dipakai di luar landing |
| **Badge provenance** | `DATA RESMI` / `SIMULASI PROTOTIPE` | `DATA RESMI (LPSE/INAPROC)` di panel kontrak, halaman penyedia, dan halaman detail paket; `SIMULASI PROTOTIPE` di alur lapor dan laporan warga pada detail paket; badge presisi lokasi ada di detail paket | Badge SIRUP/Bina Marga belum |
| **Halaman detail paket** | Rencana, lokasi, kontrak, laporan | Selesai: `/paket/[rup]` membaca item dari repository aktif (Prisma/Supabase atau snapshot) dan rincian RUP dari `data/rup_detail_*.json` server-only, memakai `routeForPackage()`, dan menampilkan kontrak lengkap serta laporan `PUBLISHED` | Penambalan detail untuk 918 paket tanpa entri RUP di luar cakupan |
| **Direktori paket** | Daftar paket yang bisa ditelusuri tanpa peta | Selesai: `/paket` membaca `listRoadPackages()` dari repository aktif, memfilter tahun/jenis/teks di server, dan berpaginasi 50 baris | Pindahkan filter ke SQL bila jumlah region bertambah |
| **Supabase/PostGIS domain** | Katalog paket, wilayah, laporan | Migrasi ingestion multi-region diterapkan; katalog Kota Tangerang (RUP, detail, kontrak, realisasi, batas) sudah diimpor lewat `workers/ingest.mjs`; repository aplikasi membaca katalog itu lewat Prisma, dengan snapshot sebagai cadangan | Jalankan `npm run db:verify` setiap selesai ingest; pertahankan kontrak API |
| **Scraper terjadwal** | Worker terpisah | `workers/ingest.mjs` + lock/retry/log/riwayat run; penjadwal di dalam Next (`src/instrumentation.ts`), artefak systemd timer, dan GitHub Actions tersedia | Deployment cron dan approval merge |
| **Lapor jalan** | Submit bermoderasi + opsional akun | API, idempotensi, CORS, model Prisma, bucket privat, antrean review, daftar publik `PUBLISHED`, dan aksi Publikasikan/Tolak dengan alasan + `ReportStatusEvent` tersedia; submit dan moderasi terverifikasi end-to-end 8–9 Nov 2026 | Akses bukti, kebijakan media publik, dan retensi (`docs/REPORTS.md`) |
| **Dokumentasi** | Selaras dengan kode | STATE, HANDOFF, README, CONCEPT, PRODUCT, SPEC, DESIGN diperbarui 9 Nov 2026; `/metode` menjelaskan sumber dan batas angka | Jaga `AGENTS.md` tetap sinkron saat aturan produk berubah |

---

## 4. Kesehatan Teknis & Build

- **Node:** v26.8.1 di mesin pengembangan; `.nvmrc` menunjuk 24. Lockfile belum dilacak git.
- **Build:** `PASS` — `npm run build` sukses tanpa `DATABASE_URL`.
- **Lint/Type:** `PASS` — `eslint .` dan `tsc --noEmit` tanpa temuan.
- **Database:** opsional untuk build. Tanpa `DATABASE_URL`, auth menjawab `503` dan data paket
  dibaca dari snapshot; dengan `DATABASE_URL`, paket, kontrak, penyedia, dan metrik dibaca dari
  katalog Supabase.
- **Privasi:** kredensial lokal hanya di `.env.local` (diabaikan git). Migrasi liar
  `prisma/migrations/20261105085537_init` (berisi `DROP INDEX`) sudah dihapus 5 Nov 2026.

## 5. Aturan Produk yang Tidak Boleh Dilanggar

1. **Satu jenis infrastruktur: jalan.** Jangan menambah sektor lain.
2. **Tidak ada pin/titik/jitter per paket.** Lokasi hanya ditampilkan sebagai batas wilayah.
3. **Tingkat poligon dipilih manual**, bukan mengikuti zoom.
4. **Filter wilayah bertingkat:** kecamatan dulu, lalu kelurahan (checkbox). Nol kelurahan bukan
   berarti "semua" — tampilkan peringatan merah dan jangan kirim permintaan.
5. **Default hanya paket berlokasi** (2.208 dari 2.552); 344 paket presisi kabupaten muncul hanya bila
   "Hanya paket berlokasi" dimatikan.
6. **Notasi pelaksana:** sebut **"pemenang" hanya untuk `jenis === "tender"`** (lelang/seleksi);
   selain itu (pengadaan langsung, e-purchasing, penunjukan langsung) sebut **"penyedia"**. Field
   internal dan API memakai `penyedia`; kolom sumber SPSE tetap bernama `pemenang`.
7. **Penyedia disajikan berimbang** — selalu dengan penyebut (jumlah paket/kelas/tahun), tanpa skor
   gabungan; istilah tetap "paket dengan laporan kerusakan dalam masa pemeliharaan".
8. **Ditolak dan jangan dihidupkan lagi:** NLP ekstraksi lokasi, CV klasifikasi kerusakan,
   Google Places (larangan cache/store), nama ruas sebagai anchor.
