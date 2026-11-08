<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — aturan kerja di repo ini

Dibaca otomatis oleh coding agent. **Baca juga `docs/STATE.md`** (status, keputusan, angka snapshot)
dan `docs/ARCHITECTURE.md` (batas frontend/backend) sebelum menyentuh kode.

## Produk

**SAKSI** — platform pelaporan warga + audit silang anggaran untuk **satu jenis infrastruktur:
jalan** (jalan, jembatan, drainase/saluran, trotoar, TPT/turap).

- Studi kasus: **Kota Tangerang** (`idKldi=D44`, BPS `3671`), TA 2025–2026.
- Angka kunci (snapshot **5 Nov 2026**, sumber RUP `data.inaproc.id`): **2.552 paket jalan · Rp813,13 M
  · 1.571 anchor RW · 511 kelurahan · 108 kecamatan · 362 tanpa lokus**.
- Jangkauan wilayah: **85 kelurahan dari 104 · 572 RW dari 1.020 · 13 kecamatan**.
- Rekam penyedia (realisasi 6 Nov 2026): **2.334 dari 2.552 paket (91,5%)** punya nama penyedia — 731
  dari LPSE/SPSE, 1.603 sisanya dari **Data INAPROC realisasi** (ekspor CSV seluruh satker D44,
  **50.836** baris). **218** paket tanpa rekam publik (Rp132,34 M, 16,3% pagu); **633** penyedia unik.
- Snapshot paket: `data/saksi_kota_tangerang_2025_2026.json` (dibaca server-only).
- Snapshot kontrak: `data/lpse_kota_tangerang_2025_2026.json` + `data/realisasi_kota_tangerang.json`.
- Batas wilayah: `public/data/rw.geojson` (1.020 poligon RW), `public/data/kel.geojson` (104),
  `public/data/kec.geojson` (13, dari ArcGIS kota, `npm run data:kecamatan`).
- Lomba: MIA 2026 / Web In Action. **FDS 1 Nov 2026**, penyisihan 11 Nov, final onsite 28 Nov.

## Aturan keras (jangan dilanggar tanpa bertanya)

1. **Fokus jalan & anchor RW.** Produk = jalan; filter yang boleh ada: tahun, kecamatan/kelurahan,
   jenis pekerjaan (permukaan/drainase/jembatan). Lokasi paket **selalu** diturunkan ke **RW** (nomor
   RW di nama paket) atau kelurahan — bukan nama ruas: uji 31 Okt hanya 7% paket menyebut ruas yang
   bisa dicocokkan, sementara 54,8% menyebut RW. **Default peta hanya menampilkan paket berlokus**
   (kecamatan/kelurahan/RW); 362 paket presisi kabupaten baru muncul kalau "Hanya paket berlokasi"
   dimatikan. Filter wilayah bertingkat: **kecamatan** (pilih satu) → **kelurahan** (checkbox, semua
   terpilih saat kecamatan dipilih; **nol kelurahan bukan berarti semua** — tampilkan peringatan merah,
   tetap buka dropdown, dan jangan kirim permintaan). Peta bertingkat lewat **segmented control**
   **Kecamatan / Kelurahan / RW** di atas peta (bukan mengikuti zoom); angka kecamatan menjumlahkan
   seluruh paket di dalamnya, termasuk presisi RW/kelurahan, dengan kelas kuantil.
2. **Batas frontend/backend SAKSI.** Route Handlers menjadi BFF; browser tidak mengambil snapshot
   paket langsung. Snapshot dibaca repository server-only dari `data/`. Supabase domain tables dan
   scraper workers adalah tahap terpisah; jangan mengarang skema atau pipeline sebelum provenance,
   presisi lokasi, validasi, dan kebijakan retensi ditentukan.
3. **Tanpa NLP/LLM di pipeline lokasi.** Sudah diuji dan ditolak.
4. **Tanpa computer vision / pengukuran cm².** Ditolak user + dosen. Kerusakan dikategorikan
   **oleh pelapor** (`jenis_kerusakan`, `penyebab`, `ukuran_kasar`). Jangan menambahkan field luas.
5. **Peta tidak boleh berpura-pura presisi.** Tidak ada marker/dot per paket. Peta memakai koroplet
   batas RW (zoom ≥ 12) dan kelurahan (zoom jauh); paket terpilih menyorot batas wilayahnya. Ikon
   agregat tidak boleh berbentuk pin yang terbaca sebagai lokasi pekerjaan. Paket tanpa anchor (362)
   hanya tampil di tabel dengan label `Kota Tangerang (umum)`.
6. **Bahasa indikator "Diduga Tidak Sesuai"**, tidak pernah "korupsi", "fiktif", atau tuduhan.
7. **Penyedia disebut nama asli** (data publik) tetapi **berimbang**: tanpa skor gabungan, selalu
   dengan penyebut (jumlah paket, kelas jalan, tahun). Sumber kontrak **dua lapis**: LPSE/SPSE untuk
   tender & pengadaan langsung, **Data INAPROC** (`data.inaproc.id/realisasi`) untuk
   e-purchasing/e-katalog. Jangan menyebut satu sumber sebagai satu-satunya.
8. **Jangan scrape sumber yang menolak.** `katalog.inaproc.id` (`Disallow: /api/`, transaksi di balik
   login) dan `sikap.inaproc.id` (`Disallow: /`) hanya boleh jadi **tautan rujukan**, bukan target
   pengambilan data. SIKaP = profil/kinerja penyedia, tidak memuat pemetaan ke RUP.
9. **Badge wajib**: `SIMULASI PROTOTIPE` (amber) untuk laporan warga; `DATA RESMI (LPSE)` atau
   `DATA RESMI (INAPROC)` sesuai sumber kontrak; `DATA RESMI (SIRUP / BINA MARGA)` untuk data asli
   lain; plus badge sumber lokasi (`RW 04` / `Kelurahan` / `Kecamatan`). Badge kontrak dan lokasi
   sudah ada (2 Nov 2026); `SIMULASI PROTOTIPE` terpasang di alur lapor (8 Nov 2026); badge SIRUP/Bina
   Marga belum.
10. **Privasi**: EXIF dihapus di browser dan wajah/plat nomor diperiksa sebelum data disimpan/diunggah.
11. **Build harus jalan tanpa database.** `next build` tidak boleh menuntut `DATABASE_URL`; fitur
    database (auth, simpan laporan) hanya aktif bila env itu ada.
12. **Format angka Indonesia**: `2.552`, `85,8%`, `Rp813,13 Miliar`.

## Konvensi repo

- Commit: **satu baris conventional commit, tanpa body** (`feat: …`, `fix: …`, `docs: …`).
- Komentar di file konfigurasi (compose/env/yaml) **tidak ditambahkan** — user menghapusnya sendiri.
- Copy UI: **Bahasa Indonesia**, istilah teknis tetap Inggris (dashboard, layer, koroplet). Untuk Kota
  Tangerang pakai **kelurahan/RW**, bukan "desa".
- Struktur: `src/app` (rute), `src/features/<domain>` (UI + logika klien), `src/server` (server-only),
  `src/contracts` (tipe lintas lapisan), `data/` (snapshot), `public/data/` (GeoJSON batas).
- Jangan mengedit `data/saksi_kota_tangerang_2025_2026.json` manual — bangun ulang dengan
  `npm run data:snapshot` (`scripts/build-snapshot.mjs`) dari **ekspor RUP `data.inaproc.id`**
  (sumber utama sejak 5 Nov 2026) + batas ArcGIS + detail RUP. Dataset adalah artefak bertanggal.
- Data kontrak/penyedia punya perintah sendiri: `npm run lpse:list` → `lpse:detail` → `lpse:match`
  (SPSE) dan `npm run data:realisasi` (Data INAPROC, ekspor CSV penuh; `--mode table` untuk cadangan
  per satker), plus `npm run data:rup` / `data:rup-detail` / `data:rup-detail-tambal` untuk RUP dan
  `npm run data:snapshot` untuk merakit snapshot. Jalankan
  berurutan, jangan mengarang angka. Detail endpoint, header, dan batasannya ada di
  `docs/LPSE-PEMENANG.md` dan `docs/RUP-DATA-INAPROC.md`.
- **Tautan bukti penyedia:** paket dengan rekam LPSE memakai URL SPSE aslinya; paket lain memakai
  `https://data.inaproc.id/realisasi?kode=<kode paket>`. Parameter itu **kode paket** (kode tender /
  e-katalog), **bukan kode RUP**; detail RUP memakai `https://data.inaproc.id/rup?kode=<kode_rup>`.
  Relasi RUP↔paket: lihat `docs/RELASI-RUP-REALISASI.md`.
- **Swakelola & instansi bukan pelaksana.** Baris realisasi ber-metode Swakelola atau bernama Dinas/OPD/
  Pegawai Dinas tidak boleh tampil sebagai penyedia.
- **Notasi pelaksana:** label **"Pemenang"** hanya untuk kontrak tender/seleksi; selain itu label
  **"Penyedia"**. Field kontrak & API memakai `penyedia` (kolom SPSE tetap `pemenang`).

## Perintah verifikasi (wajib hijau sebelum lapor selesai)

```bash
npm run lint                                  # eslint, harus 0 temuan
npm run build                                 # next build, harus sukses TANPA DATABASE_URL
```

`prebuild`/`predev` menjalankan `prisma generate`, yang tidak butuh database. Jangan menambahkan
pemeriksaan yang menuntut Postgres di jalur build.

## Sumber kebenaran

| Berkas | Isi |
|---|---|
| `docs/STATE.md` | status, keputusan, angka snapshot, kesenjangan implementasi |
| `docs/ARCHITECTURE.md` | batas frontend/backend, API, repository, database, worker, tahapan |
| `docs/PRODUCT.md` | produk, masalah, sasaran, dan batas interpretasi |
| `docs/DESIGN.md` | sistem visual dan aturan antarmuka |
| `docs/HANDOFF.md` | status operasional dan keputusan kerja |
| `docs/LPSE-PEMENANG.md` | pipeline LPSE + Data INAPROC: endpoint, header, angka, batasan etika |
| `docs/SISA-176-PAKET.md` | sebab sisa 140 paket tanpa penyedia + hasil penarikan lima satker `D44` |
| `docs/RUP-DATA-INAPROC.md` | RUP dari `data.inaproc.id` (ekspor CSV + detail) sebagai pengganti SIRUP |
