# STATE — Kondisi Terkini Proyek SAKSI

**Tanggal Pembaruan:** 11 November 2026
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

**10 November 2026 — klasifikasi jenis pekerjaan dan cakupan snapshot diperbaiki.**
`src/contracts/packages/road-work.ts` kini menentukan kategori dari **objek yang disebut paling awal**
pada nama paket, bukan urutan kata kunci. Dua kesalahan lama hilang: `Pembangunan Jembatan Saluran …`
tidak lagi masuk drainase, dan `Pembangunan Jalan Saluran Pembuang Semanan` tidak lagi masuk drainase
hanya karena memuat kata `saluran`; kata `tanggul`, `got`, `selokan`, `riol` ditambahkan, sedangkan
`tanggul` yang bagian nama ruas tetap permukaan karena `Jl.` disebut lebih dulu.
`scripts/lib/road-filter.mjs` juga membuang baris **bukan pekerjaan fisik**: jenis pengadaan RUP
`Barang`, `Jasa Lainnya`, `Jasa Konsultansi` (supervisi, perencanaan, lampu PJU, aspal, BBM) serta
baris swakelola berisi upah/iuran/narasumber/tenaga. Snapshot, manifest, dan pencocokan LPSE dibangun
ulang; register tidak lagi menampilkan paket konsultansi atau pengadaan barang sebagai paket jalan.

- **Angka dataset tidak lagi ditulis di dokumen.** Jumlah paket, pagu, sebaran jenis pekerjaan,
  presisi anchor, cakupan wilayah, dan rekam penyedia dibaca dari
  `data/regions/kota-tangerang/manifest.json` (`metrik`, `dibuat`) atau
  `npm run db:verify -- --region kota-tangerang`.
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

- `data/saksi_kota_tangerang_2025_2026.json` — paket jalan + anchor (`rw`, `unit_id`,
  `presisi_peta`, `bulan`, `kecamatan_resmi`, `desa_resmi`); cadangan server-only.
- `data/lpse_kota_tangerang_2025_2026.json` — paket dengan nama pelaksana dari SPSE (kolom sumber
  `pemenang`); jumlahnya ada di manifest.
- `data/realisasi_kota_tangerang.json` — baris realisasi untuk seluruh satker D44; sumber penyedia
  e-purchasing.
- `public/data/rw.geojson`, `kel.geojson`, `kec.geojson` (dari ArcGIS kota, dibuat ulang lewat
  `npm run data:kecamatan`).
- `data/regions/kota-tangerang/jalan.geojson` (snapshot Overture transportation segment, ODbL-1.0;
  dibuat ulang lewat `npm run data:jalan`) dan `data/regions/kota-tangerang/jalan-tiles/` (tile MVT
  ter-gzip yang disajikan lewat route server). Ini layer referensi peta, bukan lokasi paket.
- `data/regions/kota-tangerang/{region.json,aliases.json}` — konfigurasi daerah untuk snapshot dan
  pipeline penarikan (`rup.mjs`, `realisasi.mjs`, `lpse.mjs`): path sumber, kode instansi, tahun,
  properti batas, token lokasi, host SPSE, dan alias kelurahan. Region lain cukup menambah direktori
  baru lalu menjalankan `--region <id>`; `batas.lingkungan` opsional, dan tanpanya presisi tertinggi
  adalah kelurahan (`rw` selalu `null`).
- Arsip pipeline lama (Kabupaten/Bandung) hanya untuk referensi, tidak dipakai UI.

Sumber utama: **ekspor RUP `data.inaproc.id`** (seluruh baris D44 2025+2026, ditarik `scripts/rup.mjs`), detail RUP
`data.inaproc.id`, SPSE `spse.inaproc.id/tangerangkota`, Data INAPROC realisasi (ekspor CSV), dan
ArcGIS Kota Tangerang. Pipeline pembangun ada di repo kerja `~/dev/saksi` (`tools/build_kota.py`) dan
`scripts/` di repo ini (`lpse.mjs`, `realisasi.mjs`, `rup.mjs`, `enrich-rup.mjs`, `kecamatan.mjs`).

### 2.3 Implementasi dan Batas Frontend/Backend

- `src/app/page.tsx` — Server Component yang meminta data awal ke use case paket (default hanya
  paket berlokasi).
- `src/app/metode/page.tsx` — halaman `/metode` (Server Component) yang menjelaskan sumber dan
  tanggal, pipeline, alasan anchor RW, angka snapshot (dihitung dari manifest), dua lapis penyedia, batas paket tanpa rekam, larangan
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
  (tidak ada paket dalam cakupan; 40 kode paket di seluruh D44 memetakan ke lebih dari satu RUP).
- Baris realisasi ber-metode **Swakelola** dan nama "penyedia" yang sebenarnya instansi (Dinas, OPD,
  Pegawai Dinas) **tidak** dihitung sebagai pelaksana — paket swakelola tampil sebagai tanpa rekam
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
- `/penyedia`, `/penyedia/[slug]` — daftar & detail penyedia; jumlah penyedia per sumber dan entri
  unik dibaca dari manifest (normalisasi nama gabungan tidak mengubah total paket).
- `src/features/reports/components/report-prototype.tsx` — empat langkah laporan; submit memakai API,
  metadata ke Postgres, foto WebP tersanitasi ke bucket privat. Submit lewat route API yang sama
  dengan UI sudah diverifikasi end-to-end **8 November 2026**: receipt, riwayat akun, antrean review,
  baris Postgres, dan objek WebP privat; data uji dihapus.
- `/laporan/publik` + `GET /api/reports/public` — daftar laporan **PUBLISHED** per region/paket/
  kecamatan/kelurahan; hanya jenis kerusakan, ukuran kasar, wilayah, ruas, tanggal, dan tautan paket.
  Tidak memuat identitas pelapor, deskripsi, petunjuk lokasi, lokasi presisi, atau foto. Kartu daftar
  menaut ke `/laporan/publik/[publicCode]`; titik presisi hanya muncul di detail bila pelapor opt-in.
- `/laporan/publik/[publicCode]` — detail `PUBLISHED` dengan peta Overture, ruas terpilih, dan titik
  opsional; `robots: noindex`. `/api/reports/review/[reportId]` mengembalikan titik/ruas hanya untuk
  `reports.read_precise_location` dan mencatat audit akses.
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

### 2.5 Cache Katalog & Performa (10 November 2026)

Model cache sekarang memakai **Data Cache bawaan Next**, bukan `Map` selama proses hidup:

- `src/server/packages/catalog-cache.ts` membungkus baris paket (`catalog-road-package-bases`),
  peta kontrak khusus RUP jalan (`catalog-contracts-per-rup`), register penyedia
  (`catalog-vendors`), dan metadata snapshot dengan `unstable_cache` + revalidasi harian + tag
  `catalog`. Katalog bersumber dari ingestion harian; TTL lima menit memaksa pengunjung menunggu
  pembangunan ulang indeks kontrak jarak jauh berkali-kali sehari. Baris paket dan kontrak dipisah menjadi dua entri karena Next menolak satu entri
  Data Cache di atas 2 MB; keduanya digabung per request.
- `cache()` React mendeduplikasi loader dalam satu request: `generateMetadata` + page pada
  `/paket/[rup]` dan `/penyedia/[slug]`, pasangan `searchRoadPackages` + `aggregateRoadPackages`
  pada `/peta-pekerjaan`, dan dua builder di beranda tidak lagi membaca katalog dua kali.
- Sumber aktif (`database`/`snapshot`) menjadi bagian kunci cache, sehingga entri snapshot yang
  terbentuk saat build tanpa `DATABASE_URL` tidak pernah dipakai proses runtime ber-database.
- `/paket`, `/penyedia`, `/penyedia/[slug]`, `/peta-pekerjaan`, `/metode`, dan `/` mengekspor
  `revalidate = 300`; karena semuanya membaca `searchParams` untuk region/filter, Next tetap
  merender rute secara dinamis. Cache lintas request yang bekerja adalah Data Cache di atas,
  bukan shell halaman ISR. ISR tingkat rute akan menuntut filter query dipindahkan ke klien
  (mengubah perilaku), jadi tidak dipakai.
- `/paket/[rup]` dan `/laporan/publik` **tidak** memakai revalidate rute. Proyeksi laporan publik
  memakai cache bertag 60 detik; perubahan status mematikan cache tersebut agar keputusan moderasi
  terlihat pada request berikutnya.
- `getIndeksKontrak()` masih menyimpan Map per proses untuk kerja CPU, tetapi lapisan lintas
  request yang menentukan adalah Data Cache di atas. Instance baru membangun ulang Map dari entri
  cache atau satu pembacaan database; kebenaran data tidak bergantung pada umur proses.

Audit produksi 11 November 2026 menemukan lonjakan berkala setelah cache katalog kedaluwarsa:
`npm run profile -- --samples 3 --warmup 1 --parallel 1 --cold` mengukur `/paket` pertama 23,3 dtk;
`/penyedia` 8,6 dtk; `/laporan/publik` 11,7 dtk. Request berulang setelah cache hangat 68–80 ms
untuk direktori dan peta. Indeks kontrak selesai diproses dalam 48 ms; PostgreSQL menjalankan query
utamanya dalam 22–40 ms, sedangkan pembacaan Prisma penuh memakan 9,6 dtk (sekali uji lain 18,5 dtk).
TTL katalog dinaikkan ke 24 jam sesuai jadwal ingestion harian; daftar/detail laporan publik kini
di-cache 60 detik dan invalidasi saat status berubah. HTML home mentah sekitar 979 KB (102 KB dengan
gzip), sedangkan HTML peta 288 KB (28 KB gzip), sehingga ukuran HTML bukan penyebab jeda belasan detik.

Angka `next build` + `next start`, `DATABASE_URL` aktif, 3 warm-up + 7 sampel, p50 (mesin ini):

| URL | Sebelum | Sesudah | Target |
|---|---:|---:|---:|
| `/paket` | 1.137 ms | 45 ms | ≤100 ms |
| `/penyedia` | 2.123 ms | 38 ms | ≤100 ms |
| `/api/packages` | 1.923 ms | 16 ms | ≤100 ms |
| `/api/packages/map` | 1.628 ms | 22 ms | ≤100 ms |
| `/api/packages/[rup]` | 1.678 ms | 21 ms | ≤100 ms |
| `/paket/[rup]` | 1.949 ms | 259 ms | ≤300 ms |
| `/penyedia/[slug]` | 3.738 ms | 21 ms | ≤300 ms |
| `/peta-pekerjaan` (isi penuh) | 3.161 ms | 51 ms | ≤300 ms |
| `/laporan/publik` | 1.445 ms | 253 ms | ≤300 ms |
| `/metode` | 1.823 ms | 12 ms | ≤300 ms |
| `/` (isi penuh) | 2.100 ms | 55 ms | ≤300 ms |

8 request paralel: p95 **411 ms** (target ≤1.000 ms). Sisa 253–259 ms pada `/paket/[rup]` dan
`/laporan/publik` adalah query laporan `PUBLISHED` yang segar, bukan biaya katalog. Cold start
diukur terpisah tanpa warm-up: `/paket` 3,398 dtk · `/penyedia` 1,826 dtk · `/paket/[rup]` 419 ms ·
`/peta-pekerjaan` 102 ms · `/laporan/publik` 279 ms · `/metode` 1,894 dtk · `/` 1,948 dtk ·
`/api/packages` 3,116 dtk; cold start bukan gerbang. Mode snapshot tanpa `DATABASE_URL` juga lulus
semua target p50 (17–82 ms halaman, 15–31 ms API, paralel p95 275 ms).

Paritas keluaran: HTML/JSON URL uji dibandingkan dengan build sebelum perubahan. JSON API
(`/api/packages`, `/api/packages/map`, `/api/packages/[rup]`) identik setelah kunci objek diurutkan;
teks `<body>` semua halaman identik, dan `<title>`/`description` pada `/paket/[rup]` identik (hanya
posisi streaming metadata yang bergeser). Uji kesegaran laporan: satu baris `PUBLISHED` uji
disisipkan, muncul pada request `/laporan/publik` dan `/paket/[rup]` berikutnya, lalu menghilang
setelah dihapus; data uji sudah dibersihkan.

Skrip bukti: `npm run profile` → `scripts/profile-pages.mjs` (sekuensial, `--parallel 8`,
`--warmup`, `--cold`, `--json`, `--dump`; menemukan RUP dan slug penyedia dari berkas region,
tidak menuntut `DATABASE_URL`).


---

## 3. Matriks Kesenjangan Implementasi (Gap Analysis)

| Komponen / Fitur | Target | Status di kode | Tindakan yang dibutuhkan |
|---|---|---|---|
| **Penyajian paket** | UI lewat kontrak server | Server Component + `GET /api/packages`; repository Prisma saat `DATABASE_URL` diisi, snapshot sebagai cadangan | Pindahkan filter dan agregat peta ke SQL/PostGIS |
| **Peta & register** | Koroplet batas resmi + register | Jalan: tiga tingkat (kecamatan/kelurahan/RW) via segmented control, filter lengkap, register + panel kontrak; register memakai `page`/`limit`, peta memakai `GET /api/packages/map` dengan `bbox` viewport, dan detail paket dimuat lewat `GET /api/packages/[rup]`. Sejak 10 Nov 2026 pembacaan katalog memakai Next Data Cache (`unstable_cache`, `revalidate: 300`) + dedupe `cache()` per request | Precompute agregat atau pindahkan filter/agregat ke SQL/PostGIS; agregat masih dihitung dari baris ter-cache per request |
| **Metrik header** | Angka diturunkan dari data | Selesai: `src/server/packages/audit-metrics.ts` menghitung seluruh metrik dari manifest, snapshot, dan indeks kontrak (paket, pagu per tahun, presisi, cakupan wilayah, penyedia, tanggal snapshot) | Tambahkan asersi/uji bila metrik dipakai di luar landing |
| **Badge provenance** | `DATA RESMI` / `SIMULASI PROTOTIPE` | `DATA RESMI (LPSE/INAPROC)` di panel kontrak, halaman penyedia, dan halaman detail paket; `SIMULASI PROTOTIPE` di alur lapor dan laporan warga pada detail paket, bawaannya mati (`src/lib/flags.ts`, nyalakan dengan `NEXT_PUBLIC_SIMULATION_BADGE=1`); badge presisi lokasi ada di detail paket | Badge SIRUP/Bina Marga belum |
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
- **Test:** `PASS` — `bun test` 41 lulus, 0 gagal (6 berkas).
- **Profil produksi:** `PASS` — `npm run profile` pada `next start` ber-`DATABASE_URL`; p50 katalog
  dan API berada di bawah target, 8 request paralel p95 411 ms. Rincian angka ada di §2.5.
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
5. **Default hanya paket berlokasi**; paket presisi kabupaten muncul hanya bila "Hanya paket
   berlokasi" dimatikan.
6. **Notasi pelaksana:** sebut **"pemenang" hanya untuk `jenis === "tender"`** (lelang/seleksi);
   selain itu (pengadaan langsung, e-purchasing, penunjukan langsung) sebut **"penyedia"**. Field
   internal dan API memakai `penyedia`; kolom sumber SPSE tetap bernama `pemenang`.
7. **Penyedia disajikan berimbang** — selalu dengan penyebut (jumlah paket/kelas/tahun), tanpa skor
   gabungan; istilah tetap "paket dengan laporan kerusakan dalam masa pemeliharaan".
8. **Ditolak dan jangan dihidupkan lagi:** NLP ekstraksi lokasi, CV klasifikasi kerusakan,
   Google Places (larangan cache/store), nama ruas sebagai anchor.

## 6. Layer Jalan Overture dan Lokasi Laporan (10 November 2026)

- Sumber layer jalan adalah **Overture Maps transportation segment** (rilis dipin di
  `data/regions/kota-tangerang/region.json`), bukan layer ArcGIS jalan. ArcGIS tetap dipakai untuk
  batas administrasi. Lisensi ODbL-1.0 dan atribusi dijelaskan di `docs/DATA-LICENSE.md`.
- Snapshot `data/regions/kota-tangerang/jalan.geojson` dan tile MVT
  `data/regions/kota-tangerang/jalan-tiles/` dihasilkan `npm run data:jalan` (Overture CLI + clip
  Shapely + tiles), lalu diimpor worker sebagai `ROAD_NETWORK` ke `road_segments`. Segmen yang
  hilang dinonaktifkan, bukan dihapus.
- Peta pekerjaan memiliki toggle **Jaringan jalan** yang mati secara bawaan. Garis jalan digambar oleh
  style peta dasar; SAKSI tidak menambah garis atau label ruas sendiri. Toggle hanya menyalakan sorot
  satu ruas (geometri segmen Overture yang segaris dengan jalan peta dasar) plus tooltip dari layer
  Overture tak terlihat. Ruas hanya referensi, bukan tautan atau filter paket.
- Laporan warga memiliki titik presisi (GPS/pin/Photon), consent publik, dan anotasi ruas. Titik
  wajib di dalam region; wilayah diturunkan server via PostGIS. Titik publik hanya tampil di detail
  bila consent; staf dengan `reports.read_precise_location` melihat titik dan setiap akses diaudit.
- Halaman `/laporan/publik/[publicCode]` menampilkan detail `PUBLISHED` dengan peta Overture dan
  titik opsional, tanpa deskripsi/hint/foto/identitas/area id.
- Angka segmen, coverage nama, rilis, dan checksum ada di `manifest.metrik.jalan` /
  `npm run db:verify`; jangan menyalinnya ke dokumen.
- Verifikasi terakhir: `npm run lint`, `npm run build` tanpa `DATABASE_URL`, `bun test`,
  `prisma migrate deploy`, worker `--sources jalan` dua kali, `db:verify`, dan uji titik/consent
  laporan. Rincian ada di `docs/INGESTION.md` dan `docs/REPORTS.md`.
