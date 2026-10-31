# BRIEF — Dua layar FDS (target: 1 November 2026)

Kontrak kerja. Baca `AGENTS.md` (aturan) dan `HANDOFF.md` (status) lebih dulu. Bangun **sampai
selesai**, jalankan quality gate, lapor dengan bukti perintah.

## Tujuan

Dua halaman **hidup** di `web/` untuk di-screenshot ke PDF FDS:

1. **`#/` — Peta audit jalan** (halaman beranda).
2. **`#/lapor` — Alur lapor 3 langkah.**

Tanpa backend, tanpa login, tanpa database. Semua data statis dari JSON.

## Data

Salin dataset ke aset publik (jangan diimpor ke bundle):

```bash
mkdir -p web/public/data
cp data/saksi_tangerang_2025_2026.json web/public/data/paket.json
cp data/tangerang_desa_coords.json     web/public/data/desa.json
```

Ambil saat runtime dengan `fetch('/data/paket.json')`. **Filter wajib di klien:**
`paket.filter(p => p.sektor === 'Jalan, Jembatan & Drainase')` → **3.602** paket.

Field yang dipakai (jangan mengarang field baru):

```
kode_rup, tahun, satker, nama, pagu, metode, sumber, bulan,
sektor, desa_resmi, kecamatan_resmi, lat, lon, presisi_peta,
koridor?: { dari, ke, kecamatan, lat_dari, lon_dari, lat_ke, lon_ke },
lokasi_mikro
```

`presisi_peta` ∈ `Desa/Kelurahan` (3.000) · `Garis Koridor` (102) · `Kecamatan` (229) ·
`Kabupaten` (271 — tidak tampil di peta). Nilai ini adalah **provenans** (dari mana lokasinya
diturunkan), bukan akurasi: jangan ditampilkan sebagai tingkat presisi dan jangan dipakai untuk
menggeser titik (lihat Layar 1 angka 2).

## Layar 1 — Peta audit jalan (`#/`)

**Header metrik** (angka diambil dari data, jangan hardcode kecuali label):
`3.602 paket jalan · Rp848,60 M · 251 desa · 29 kecamatan · 102 koridor indikatif`

**Peta** (Leaflet + tile OSM, tinggi ≥ 60vh) — **agregat per desa, bukan titik per paket**:

1. **Satu lingkaran per desa** (251 lingkaran). Radius `6 + 10*sqrt(jumlah_paket_desa / max)`,
   `fillOpacity 0.35`, `weight 1`. Tooltip: `Desa X · 12 paket · Rp1,42 M` (pagu dijumlah dari paket
   desa itu). Klik → panel berisi tabel paket desa tersebut.
2. **Jangan** membuat marker per paket, dan **jangan** memakai offset/jitter apa pun. Koordinat desa
   dipakai apa adanya sebagai pusat, tidak digeser.
3. **Paket terpilih** (dari tabel) → tampilkan `L.circle` radius **1.500 m**, `dashArray 6 6`, tanpa
   isi, ditambah label `Lokasi indikatif · ±1,5 km` di popup. Tidak ada dot, tidak ada crosshair.
4. **Koridor** → busur putus-putus antara dua pusat desa (hitung titik tengah lalu lengkungkan dengan
   `quadraticBezier` agar terbaca skematis, bukan rute): `dashArray 4 6`, `opacity 0.6`, tooltip
   `Koridor indikatif: Kresek ↔ Cempaka — bukan geometri ruas`.
5. **Legenda wajib** di pojok peta, teks persis:
   `1 lingkaran = 1 desa · ukuran = jumlah paket` dan `Busur = koridor indikatif antar desa`.
6. **Banner tetap di atas peta** (bukan tooltip, tidak bisa ditutup):
   `Tidak ada paket yang punya koordinat resmi. Peta menunjukkan desa, bukan lokasi pekerjaan.`
   dengan tautan ke `#/metode`.

**Filter** (satu baris, sticky): tahun (2025/2026/semua) · kecamatan (dropdown dari data) · jenis
pekerjaan (semua / permukaan / drainase / jembatan — klasifikasi kata kunci dari `nama`).
Tampilkan jumlah hasil filter secara langsung.

**Panel/tabel**: daftar paket hasil filter (kolom: nama, desa, kecamatan, pagu, tahun, badge presisi),
klik baris → peta `flyTo` + panel detail berisi: kode RUP, pagu, satker, metode, sumber dana, bulan,
badge `DATA RESMI (SIRUP / BINA MARGA)`, dan tombol `Laporkan kerusakan` yang membuka `#/lapor`
dengan `kode_rup` terisi.

## Layar 2 — Lapor (`#/lapor`)

Tiga langkah dalam satu halaman (stepper jelas, bisa mundur):

**Langkah 1 — Foto**
- `<input type="file" accept="image/*" capture="environment">`.
- Kanvas pratinjau: gambar diskalakan maks 1024 px, **blur manual** dengan `pointer` (drag area
  untuk memburamkan wajah/plat) — cukup satu kuas blur; tidak perlu deteksi otomatis.
- Ekspor ulang ke `canvas.toBlob()` **tanpa EXIF** (gambar yang digambar ulang di kanvas otomatis
  kehilangan EXIF) dan tampilkan ukuran hasil.

**Langkah 2 — Kategori kerusakan** (wajib, sesuai `SPEC.md` §2.5)
- `jenis_kerusakan` (pilih satu): `lubang`, `retak`, `amblas`, `genangan`, `drainase_mampet`,
  `jembatan_rusak`, `lainnya`.
- `penyebab` (multi, opsional): `dilalui_kendaraan_berat`, `drainase_tidak_ada`, `genangan_berulang`,
  `kepadatan_lalu_lintas`, `bahan_tidak_sesuai`, `tidak_tahu`.
- `ukuran_kasar` (opsional): `setelapak`, `sebesar_ban`, `lebih_1_m2`.
- **Jangan** menambahkan input luas cm² atau apa pun berbau CV.

**Langkah 3 — Lokasi & paket**
- Pilih desa (dropdown 274 desa) atau `Gunakan lokasi saya` (Geolocation API; kalau ditolak, tetap
  bisa lanjut dengan desa).
- Hitung 3 kandidat paket terdekat dengan rumus `MatchScore` di `SPEC.md` §3 (Haversine + desa sama +
  jendela pelaksanaan + kemiripan teks), tampilkan skor apa adanya (bilangan bulat 0–100).
- Kalau tidak ada kandidat di desa yang sama → tampilkan status **"Tidak Dapat Ditautkan"** dan tetap
  izinkan kirim.
- Simpan ke `localStorage` (`saksi.laporan`), tampilkan konfirmasi dengan kode laporan acak dan badge
  `SIMULASI PROTOTIPE`.

**State demo**: `#/lapor?contoh=1` memuat 3 laporan contoh (satu di antaranya "Diduga Tidak Sesuai"
dalam masa pemeliharaan) supaya screenshot tidak kosong.

## Identitas visual

Pakai token yang sudah ada di `web/src/index.css` (`--color-paper`, `--color-ink`, `--color-accent`,
dst.). Tambahkan hanya yang perlu: `--color-badge-asli` (hijau/biru), `--color-badge-simulasi`
(amber), `--color-badge-presisi` (netral). Tanpa font baru, tanpa 3D, tanpa animasi berat.

Badge text **persis**: `DATA RESMI (SIRUP / BINA MARGA)`, `SIMULASI PROTOTIPE`, `Pusat Desa`,
`Koridor Indikatif`, `Kecamatan`. Jangan memakai kata "Titik Desa" atau "presisi" untuk lokasi.

## Kode yang ada: tulis ulang, jangan ditambal

`web/src` masih prototipe **RUAS** (peta IRI + vendor LPSE) yang ditulis untuk brief lama.
Hapus `pages/Landing.tsx`, `pages/Daftar.tsx`, `pages/Lapor.tsx`, `lib/reports.ts`, dan `data.ts`;
buat struktur baru:

```
web/src/
├── App.tsx                  # hash router: #/ dan #/lapor
├── lib/paket.ts             # load + filter + matchScore + format angka
├── components/{Peta,PaketPanel,FilterBar,Badge,Stepper}.tsx
├── pages/PetaAudit.tsx
└── pages/Lapor.tsx
```

Tambah dependency: `leaflet`, `@types/leaflet`. Jangan tambah library peta lain, jangan Next.js,
jangan state manager, jangan UI kit.

## Quality gate (harus dijalankan dan dilaporkan apa adanya)

```bash
cd web
npm install
node tools/typecheck.mjs                       # 0 error
node ./node_modules/vite/bin/vite.js build     # sukses
```

Buat `web/tools/check-data.mjs` yang memuat `public/data/paket.json` dan **gagal (exit 1)** bila:
`paket jalan !== 3602` · `titik (lat != null) !== 3331` · `koridor !== 102` · `desa unik !== 251`.
Jalankan dan lampirkan outputnya.

## Di luar cakupan (jangan dikerjakan)

Backend/API/database · login/auth · Next.js · NLP/LLM · computer vision · filter 5 sektor ·
halaman rapor/metode · modul penyedia (FR-07) · deploy · perubahan pada `data/` atau `ingest/`.

## Format laporan akhir

1. Daftar file yang dibuat/dihapus.
2. Output **asli** dari tiga perintah gate.
3. Angka yang tampil di layar (jumlah marker, jumlah hasil filter default, jumlah koridor).
4. Setiap penyimpangan dari brief ini dan alasannya.
