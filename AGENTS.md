<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md — aturan kerja di repo ini

Dibaca otomatis oleh coding agent (OpenCode, Codex, Claude Code via CLAUDE.md). **Baca juga
`HANDOFF.md`** (status & keputusan) dan `BRIEF.md` (kontrak tugas yang sedang berjalan) sebelum
menyentuh kode.

## Produk

**SAKSI** — platform pelaporan warga + audit silang anggaran untuk **satu jenis infrastruktur:
jalan** (jalan, jembatan, drainase/saluran, trotoar, TPT/turap).

- Studi kasus: **Kabupaten Tangerang** (`idKldi=D50`, BPS `3603`), TA 2025–2026.
- Angka kunci: **3.602 paket jalan · Rp848,60 M · 3.331 (92,5%) bertitik · 102 koridor · 251 desa**.
- Lomba: MIA 2026 / Web In Action. **FDS 1 Nov 2026** (wajib: repo publik + README + PDF ≤10 hlm +
  screenshot landing + 1 halaman fitur hidup), penyisihan 11 Nov, final onsite 28 Nov.

## Aturan keras (jangan dilanggar tanpa bertanya)

1. **Fokus jalan.** Jangan menampilkan filter 5 sektor. Dataset memuat 5 sektor, tapi produk =
   jalan; filter yang boleh ada: tahun, kecamatan/desa, jenis pekerjaan (permukaan/drainase/jembatan).
2. **Tanpa backend untuk FDS.** Data disajikan sebagai JSON statis dari `web/public/data/`.
   Backend (FastAPI + Postgres) menyusul setelah 1 Nov — jangan membangunnya sekarang.
3. **Tanpa NLP/LLM di pipeline lokasi.** Sudah diuji dan ditolak; hasil uji ada di `SPEC.md` §2.4.
4. **Tanpa computer vision / pengukuran cm².** Ditolak user + dosen. Kerusakan dikategorikan
   **oleh pelapor** (`jenis_kerusakan`, `penyebab`, `ukuran_kasar`). Jangan menambahkan field luas.
5. **Jangan memaksa titik.** 271 paket tanpa penanda lokasi tidak dipetakan; tampil di tabel dengan
   label `Lokasi: Kab. Tangerang (Umum)`.
6. **Bahasa indikator "Diduga Tidak Sesuai"**, tidak pernah "korupsi", "fiktif", atau tuduhan.
7. **Penyedia disebut nama asli** (data publik LPSE) tetapi **berimbang**: tanpa skor gabungan,
   selalu dengan penyebut (jumlah paket, kelas jalan, tahun).
8. **Badge wajib**: `SIMULASI PROTOTIPE` (amber) untuk laporan warga, `DATA RESMI (SIRUP / BINA
   MARGA)` untuk data asli, dan badge presisi (`Titik Desa` / `Garis Koridor` / `Kecamatan`) melekat
   pada setiap marker.
9. **Privasi**: blur wajah & plat nomor + hapus EXIF **di browser sebelum** data disimpan/diunggah.
10. **Format angka Indonesia**: `3.602`, `92,5%`, `Rp848,60 Miliar`.

## Konvensi repo

- Commit: **satu baris conventional commit, tanpa body** (`feat: …`, `fix: …`, `docs: …`).
- Komentar di file konfigurasi (compose/env/yaml) **tidak ditambahkan** — user menghapusnya sendiri.
- Copy UI: **Bahasa Indonesia**, istilah teknis tetap Inggris (dashboard, layer, koridor).
- `web/` saat ini masih prototipe lama (RUAS: IRI + vendor) yang ditulis untuk brief yang sudah
  dibuang. **Tulis ulang komponennya**, jangan ditambal.
- Jangan menulis ke `data/` kecuali menambah berkas baru; dataset adalah artefak bertanggal.

## Sumber kebenaran

| Berkas | Isi |
|---|---|
| `docs/KONSEP.md` | masalah, klaim inovasi, cakupan, dampak, etika |
| `docs/SPEC.md` | data, pipeline, model data laporan, `MatchScore`, FR, layar |
| `docs/README.md` | ringkasan publik + cara menjalankan |
