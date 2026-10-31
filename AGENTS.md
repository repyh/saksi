# AGENTS.md — aturan kerja di repo ini

Dibaca otomatis oleh coding agent (OpenCode, Codex, Claude Code via CLAUDE.md). **Baca juga
`HANDOFF.md`** (status & keputusan) dan `BRIEF.md` (kontrak tugas yang sedang berjalan) sebelum
menyentuh kode.

## Produk

**SAKSI** — platform pelaporan warga + audit silang anggaran untuk **satu jenis infrastruktur:
jalan** (jalan, jembatan, drainase/saluran, trotoar, TPT/turap).

- Studi kasus: **Kota Tangerang** (`idKldi=D44`, BPS `3671`), TA 2025–2026.
- Angka kunci: **1.557 paket jalan · Rp650,18 M · 80 kelurahan · 818 ber-anchor RW (indikatif)**.
- **Peta tidak menampilkan titik per paket.** Lihat aturan 5.
- Lomba: MIA 2026 / Web In Action. **FDS 1 Nov 2026** (wajib: repo publik + README + PDF ≤10 hlm +
  screenshot landing + 1 halaman fitur hidup), penyisihan 11 Nov, final onsite 28 Nov.

## Aturan keras (jangan dilanggar tanpa bertanya)

1. **Fokus jalan & anchor RW.** Produk = jalan (jalan, jembatan, drainase/saluran, trotoar, turap);
   filter yang boleh ada: tahun, kecamatan/kelurahan, jenis pekerjaan (permukaan/drainase/jembatan).
   Lokasi paket **selalu** diturunkan ke **RW** (nomor RW di nama paket) atau kelurahan — bukan ke
   nama ruas: uji 31 Okt menunjukkan hanya 7% paket menyebut ruas yang bisa dicocokkan.
2. **Tanpa backend untuk FDS.** Data disajikan sebagai JSON statis dari `web/public/data/`.
   Backend (FastAPI + Postgres) menyusul setelah 1 Nov — jangan membangunnya sekarang.
3. **Tanpa NLP/LLM di pipeline lokasi.** Sudah diuji dan ditolak; hasil uji ada di `SPEC.md` §2.4.
4. **Tanpa computer vision / pengukuran cm².** Ditolak user + dosen. Kerusakan dikategorikan
   **oleh pelapor** (`jenis_kerusakan`, `penyebab`, `ukuran_kasar`). Jangan menambahkan field luas.
5. **Peta tidak boleh berpura-pura presisi.** Tidak ada marker/dot per paket — paket tidak punya
   koordinat pekerjaan. Peta memakai **koroplet batas wilayah resmi** dari ArcGIS Kota Tangerang:
   `web/public/data/rw.geojson` (1.020 poligon RW) untuk zoom ≥ 12 dan `kel.geojson` (104 kelurahan)
   untuk zoom jauh. Warna = jumlah paket per wilayah; paket terpilih menyorot **batas wilayahnya**,
   bukan titik. Paket tanpa anchor (402) hanya tampil di tabel dengan label `Kota Tangerang (umum)`.
6. **Bahasa indikator "Diduga Tidak Sesuai"**, tidak pernah "korupsi", "fiktif", atau tuduhan.
7. **Penyedia disebut nama asli** (data publik LPSE) tetapi **berimbang**: tanpa skor gabungan,
   selalu dengan penyebut (jumlah paket, kelas jalan, tahun).
8. **Badge wajib**: `SIMULASI PROTOTIPE` (amber) untuk laporan warga, `DATA RESMI (SIRUP / BINA
   MARGA)` untuk data asli, dan badge sumber lokasi (`RW 04` / `Kelurahan` / `Kecamatan`) — bukan
   "Titik Desa" atau "Pusat Desa".
9. **Privasi**: blur wajah & plat nomor + hapus EXIF **di browser sebelum** data disimpan/diunggah.
10. **Format angka Indonesia**: `1.557`, `74,2%`, `Rp650,18 Miliar`.

## Konvensi repo

- Commit: **satu baris conventional commit, tanpa body** (`feat: …`, `fix: …`, `docs: …`).
- Komentar di file konfigurasi (compose/env/yaml) **tidak ditambahkan** — user menghapusnya sendiri.
- Copy UI: **Bahasa Indonesia**, istilah teknis tetap Inggris (dashboard, layer, koroplet).
- `web/` sudah berisi dua layar FDS (peta audit + alur lapor). Ubah di tempat, jangan tulis ulang dari
  nol tanpa alasan; data yang disajikan ada di `web/public/data/` (`paket.json`, `desa.json`,
  `rw.geojson`, `kel.geojson`).
- Dataset dibangun oleh `tools/build_kota.py` (SIRUP `idKldi=D44` + batas RW/kelurahan ArcGIS). Jangan
  mengedit `paket.json` manual.
- `data/` menyimpan dataset bertanggal dan arsip studi kasus lama (Kab. Tangerang, Bandung). Jangan
  menimpa; tambah berkas baru.

## Perintah verifikasi (wajib hijau sebelum lapor selesai)

```bash
cd web
node tools/typecheck.mjs                      # harus 0 error
node ./node_modules/vite/bin/vite.js build    # harus sukses, output web/dist
node tools/check-data.mjs                     # asersi: 1.557 paket · 1.155 berlokus · 818 anchor RW
```

## Sumber kebenaran

| Berkas | Isi |
|---|---|
| `KONSEP.md` | masalah, klaim inovasi, cakupan, dampak, etika |
| `SPEC.md` | data, pipeline, model data laporan, `MatchScore`, FR, layar |
| `README.md` | ringkasan publik + cara menjalankan |
| `STATE.md` | status kerja, keputusan, catatan bug pipeline |
| `docs/INVENTARIS-ARCGIS-KOTA-TANGERANG.md` | daftar layanan ArcGIS yang dipakai + yang rusak |
| `docs/UJI-MATCHING-KOTA-TANGERANG.md` | uji paket → RW/ruas (kenapa anchor = RW, bukan ruas) |
| `docs/DATA-BATAS-DESA.md` | arsip: batas desa GADM untuk studi kasus Kabupaten (tidak dipakai lagi) |
