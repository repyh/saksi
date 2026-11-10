<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — aturan kerja di repo ini

Dibaca otomatis oleh coding agent. **Baca juga `docs/STATE.md`** (status, keputusan, rujukan angka)
dan `docs/ARCHITECTURE.md` (batas frontend/backend) sebelum menyentuh kode.

## Produk

**SAKSI** — platform pelaporan warga + audit silang anggaran untuk **satu jenis infrastruktur:
jalan** (jalan, jembatan, drainase/saluran, trotoar, TPT/turap).

- Studi kasus: **Kota Tangerang** (`idKldi=D44`, BPS `3671`), TA 2025–2026.
- **Jangan menulis angka dataset di dokumen.** Paket, pagu, presisi, cakupan wilayah, dan penyedia
  selalu diambil saat dibutuhkan dari `data/regions/<id>/manifest.json` (`metrik`) atau
  `npm run db:verify -- --region <id>`; angka ikut berubah setiap ingest.
- Rekam penyedia: gabungan **LPSE/SPSE** dan **Data INAPROC realisasi** (ekspor CSV seluruh satker
  D44); sebagian paket tetap tanpa rekam publik. Rincian ada di manifest, bukan di dokumen.
- Snapshot paket: `data/saksi_kota_tangerang_2025_2026.json` (dibaca server-only).
- Snapshot kontrak: `data/lpse_kota_tangerang_2025_2026.json` + `data/realisasi_kota_tangerang.json`.
- Batas wilayah: `public/data/rw.geojson` (poligon RW), `public/data/kel.geojson` (kelurahan),
  `public/data/kec.geojson` (kecamatan, dari ArcGIS kota, `npm run data:kecamatan`).
- Konfigurasi daerah: `data/regions/<id>/{region.json,aliases.json}`. Skrip snapshot dan penarikan
  (`rup.mjs`, `realisasi.mjs`, `lpse.mjs`) menerima `--region <id>` (bawaan `kota-tangerang`); path
  sumber, instansi, properti batas, token lokasi, host SPSE, dan alias tidak boleh ditanam di skrip.
  `batas.lingkungan` opsional; tanpanya presisi tertinggi kelurahan.
- Lomba: MIA 2026 / Web In Action. **FDS 1 Nov 2026**, penyisihan 11 Nov, final onsite 28 Nov.

## Aturan keras (jangan dilanggar tanpa bertanya)

1. **Fokus jalan & anchor RW.** Produk = jalan; filter yang boleh ada: tahun, kecamatan/kelurahan,
   jenis pekerjaan (permukaan/drainase/jembatan). Lokasi paket **selalu** diturunkan ke **RW** (nomor
   RW di nama paket) atau kelurahan — bukan nama ruas: uji 31 Okt menunjukkan hanya sebagian kecil
   paket menyebut ruas yang bisa dicocokkan, sementara mayoritas menyebut RW. **Default peta hanya
   menampilkan paket berlokus** (kecamatan/kelurahan/RW); paket presisi kabupaten baru muncul kalau
   "Hanya paket berlokasi" dimatikan. Filter wilayah bertingkat: **kecamatan** (pilih satu) → **kelurahan** (checkbox, semua
   terpilih saat kecamatan dipilih; **nol kelurahan bukan berarti semua** — tampilkan peringatan merah,
   tetap buka dropdown, dan jangan kirim permintaan). Peta bertingkat lewat **segmented control**
   **Kecamatan / Kelurahan / RW** di atas peta (bukan mengikuti zoom); angka kecamatan menjumlahkan
   seluruh paket di dalamnya, termasuk presisi RW/kelurahan, dengan kelas kuantil.
2. **Batas frontend/backend SAKSI.** Route Handlers menjadi BFF; browser tidak mengambil data paket
   langsung. Repository server-only membaca katalog Prisma/Supabase bila `DATABASE_URL` diisi, dan
   memakai snapshot `data/` hanya sebagai cadangan tanpa database. Jangan mengarang skema atau
   pipeline sebelum provenance, presisi lokasi, validasi, dan kebijakan retensi ditentukan.
3. **Tanpa NLP/LLM di pipeline lokasi.** Sudah diuji dan ditolak.
4. **Tanpa computer vision / pengukuran cm².** Ditolak user + dosen. Kerusakan dikategorikan
   **oleh pelapor** (`jenis_kerusakan`, `penyebab`, `ukuran_kasar`). Jangan menambahkan field luas.
5. **Peta tidak boleh berpura-pura presisi.** Tidak ada marker/dot per paket. Peta memakai koroplet
   batas RW (zoom ≥ 12) dan kelurahan (zoom jauh); paket terpilih menyorot batas wilayahnya. Ikon
   agregat tidak boleh berbentuk pin yang terbaca sebagai lokasi pekerjaan. Paket tanpa anchor hanya
   tampil di tabel dengan label `Kota Tangerang (umum)`.
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
   sudah ada (2 Nov 2026); `SIMULASI PROTOTIPE` terpasang di alur lapor (8 Nov 2026) dan **bawaannya
   mati** sejak 10 Nov 2026 — nyalakan lagi dengan `NEXT_PUBLIC_SIMULATION_BADGE=1` lalu build ulang;
   badge SIRUP/Bina Marga belum.
10. **Privasi**: EXIF dihapus di browser dan wajah/plat nomor diperiksa sebelum data disimpan/diunggah.
11. **Build harus jalan tanpa database.** `next build` tidak boleh menuntut `DATABASE_URL`; fitur
    database (auth, simpan laporan) hanya aktif bila env itu ada.
12. **Format angka Indonesia**: ribuan bertitik, desimal berkoma, mis. `1.234`, `86,5%`, `Rp1,23 Miliar`.
    Nilai angkanya sendiri tidak ditulis di dokumen; lihat manifest region.
13. **Titik laporan ≠ pin paket.** Laporan warga boleh punya titik koordinat presisi (GPS/pin/alamat)
    dan ruas Overture sebagai anotasi. Paket pekerjaan tetap tidak punya titik/pin; peta paket tetap
    koroplet batas wilayah. Jangan menautkan klik ruas ke paket atau filter paket.
14. **Consent titik publik.** Titik presisi disimpan untuk staf, tetapi hanya tampil di halaman publik
    bila pelapor memilih **Tampilkan titik ini di halaman publik** (pre-checked, dapat opt-out).
    Opt-out tidak menghapus titik dari database; staf berizin tetap melihatnya.
15. **Akses presisi.** Titik presisi dan geometri ruas laporan hanya dikembalikan ke aktor dengan
    `reports.read_precise_location`; setiap akses titik dicatat di `AuthorizationAuditEvent`.
16. **Lisensi layer jalan ODbL.** Layer jalan bersumber Overture/OSM dengan lisensi **ODbL-1.0**.
    Atribusi `© OpenStreetMap contributors, Overture Maps Foundation (ODbL)` wajib di peta dan
    dokumentasi; lihat `docs/DATA-LICENSE.md`. Jangan memakai layer ArcGIS jalan sebagai sumber.

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
  `npm run data:snapshot` untuk merakit snapshot, `npm run region:check` untuk gerbang kualitas, dan
  `npm run region:ingest -- --region <id>` untuk satu job penarikan penuh. Jalankan
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
| `docs/DATABASE.md` | ERD ingestion multi-region, kunci unik, FK, index, provenance, retensi |
| `docs/INGESTION.md` | worker, lock/retry/log, riwayat run, penjadwal Next/systemd/GitHub Actions, runbook |
| `docs/DATA-LICENSE.md` | lisensi ODbL layer Overture/OSM, atribusi, kewajiban distribusi |
| `docs/PRODUCT.md` | produk, masalah, sasaran, dan batas interpretasi |
| `docs/DESIGN.md` | sistem visual dan aturan antarmuka |
| `docs/HANDOFF.md` | status operasional dan keputusan kerja |
| `docs/LPSE-PEMENANG.md` | pipeline LPSE + Data INAPROC: endpoint, header, angka, batasan etika |
| `docs/SISA-176-PAKET.md` | sebab sisa 140 paket tanpa penyedia + hasil penarikan lima satker `D44` |
| `docs/RUP-DATA-INAPROC.md` | RUP dari `data.inaproc.id` (ekspor CSV + detail) sebagai pengganti SIRUP |
