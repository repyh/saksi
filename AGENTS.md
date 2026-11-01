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
- Angka kunci (snapshot 31 Okt 2026): **1.557 paket jalan · Rp650,18 M · 80 kelurahan · 483 RW ·
  818 ber-anchor RW · 402 tanpa lokus**.
- Snapshot paket: `data/saksi_kota_tangerang_2025_2026.json` (dibaca server-only).
- Batas wilayah: `public/data/rw.geojson` (1.020 poligon RW), `public/data/kel.geojson` (104).
- Lomba: MIA 2026 / Web In Action. **FDS 1 Nov 2026**, penyisihan 11 Nov, final onsite 28 Nov.

## Aturan keras (jangan dilanggar tanpa bertanya)

1. **Fokus jalan & anchor RW.** Produk = jalan; filter yang boleh ada: tahun, kecamatan/kelurahan,
   jenis pekerjaan (permukaan/drainase/jembatan). Lokasi paket **selalu** diturunkan ke **RW** (nomor
   RW di nama paket) atau kelurahan — bukan nama ruas: uji 31 Okt hanya 7% paket menyebut ruas yang
   bisa dicocokkan, sementara 54,8% menyebut RW.
2. **Batas frontend/backend SAKSI.** Route Handlers menjadi BFF; browser tidak mengambil snapshot
   paket langsung. Snapshot dibaca repository server-only dari `data/`. Supabase domain tables dan
   scraper workers adalah tahap terpisah; jangan mengarang skema atau pipeline sebelum provenance,
   presisi lokasi, validasi, dan kebijakan retensi ditentukan.
3. **Tanpa NLP/LLM di pipeline lokasi.** Sudah diuji dan ditolak.
4. **Tanpa computer vision / pengukuran cm².** Ditolak user + dosen. Kerusakan dikategorikan
   **oleh pelapor** (`jenis_kerusakan`, `penyebab`, `ukuran_kasar`). Jangan menambahkan field luas.
5. **Peta tidak boleh berpura-pura presisi.** Tidak ada marker/dot per paket. Peta memakai koroplet
   batas RW (zoom ≥ 12) dan kelurahan (zoom jauh); paket terpilih menyorot batas wilayahnya. Ikon
   agregat tidak boleh berbentuk pin yang terbaca sebagai lokasi pekerjaan. Paket tanpa anchor (402)
   hanya tampil di tabel dengan label `Kota Tangerang (umum)`.
6. **Bahasa indikator "Diduga Tidak Sesuai"**, tidak pernah "korupsi", "fiktif", atau tuduhan.
7. **Penyedia disebut nama asli** (data publik LPSE) tetapi **berimbang**: tanpa skor gabungan,
   selalu dengan penyebut (jumlah paket, kelas jalan, tahun).
8. **Badge wajib**: `SIMULASI PROTOTIPE` (amber) untuk laporan warga, `DATA RESMI (SIRUP / BINA
   MARGA)` untuk data asli, dan badge sumber lokasi (`RW 04` / `Kelurahan` / `Kecamatan`). Belum
   diimplementasikan per 1 Nov — jangan dianggap sudah ada.
9. **Privasi**: blur wajah & plat nomor + hapus EXIF **di browser sebelum** data disimpan/diunggah.
10. **Build harus jalan tanpa database.** `next build` tidak boleh menuntut `DATABASE_URL`; fitur
    database (auth, simpan laporan) hanya aktif bila env itu ada.
11. **Format angka Indonesia**: `1.557`, `74,2%`, `Rp650,18 Miliar`.

## Konvensi repo

- Commit: **satu baris conventional commit, tanpa body** (`feat: …`, `fix: …`, `docs: …`).
- Komentar di file konfigurasi (compose/env/yaml) **tidak ditambahkan** — user menghapusnya sendiri.
- Copy UI: **Bahasa Indonesia**, istilah teknis tetap Inggris (dashboard, layer, koroplet). Untuk Kota
  Tangerang pakai **kelurahan/RW**, bukan "desa".
- Struktur: `src/app` (rute), `src/features/<domain>` (UI + logika klien), `src/server` (server-only),
  `src/contracts` (tipe lintas lapisan), `data/` (snapshot), `public/data/` (GeoJSON batas).
- Jangan mengedit `data/saksi_kota_tangerang_2025_2026.json` manual — bangun ulang dari pipeline
  SIRUP + batas ArcGIS (lihat `docs/STATE.md`); dataset adalah artefak bertanggal.

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
