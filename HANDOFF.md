# HANDOFF — status per 29 Oktober 2026 (sesi Hermes)

Dokumen ini untuk agent/sesi berikutnya. Baca berturut: **HANDOFF.md → AGENTS.md → BRIEF.md →
SPEC.md**. Jangan mengandalkan transkrip percakapan; semua keputusan yang mengikat ada di file.

## 1. Apa yang sudah selesai (jangan dikerjakan ulang)

**Konsep dikunci:** SAKSI, satu jenis infrastruktur = **jalan**, studi kasus **Kota Tangerang**,
subtema *Civic Reporting & Accountability*. Riwayat: SOROT (ditolak) → RUAS (dihentikan) →
SAKSI 5 sektor di Bandung → SAKSI 5 sektor di Tangerang → **SAKSI jalan-only** (arahan dosen).

**Dataset Tangerang selesai dan terverifikasi** (`data/saksi_tangerang_2025_2026.json`, 2,9 MB):

| | |
|---|---:|
| RUP 2025+2026 (`idKldi=D44`) | 51.322 |
| Paket fisik 5 sektor | 5.487 · Rp1.709,17 M |
| **Paket jalan (dipakai produk)** | **1.557 · Rp650,18 M** |
| Terpetakan jalan | **1.155 (74,2%)**: desa 3.000 · koridor 102 · kecamatan 229 |
| Tanpa lokus (tidak dipetakan) | 402 (7,5%) |
| Desa / kecamatan | 251 dari 274 · 29 |

Gazetteer: `data/tangerang_desa_coords.json` (104 kelurahan/kelurahan BPS `3671` + koordinat OSM).
Pipeline reproducible: `ingest/sirup_search.py` → `ingest/geocode_desa.py` → `ingest/build_saksi.py`.
Replikasi Bandung: `data/saksi_bandung_2025_2026.json` (5.013 paket, 86,4%).

**Dokumen v3 jalan-only selesai:** `KONSEP.md`, `SPEC.md`, `README.md`, `data/manifest.json`
(blok `jalan`). Angka di ketiganya dicek silang ke dataset.

## 2. Keputusan yang sudah diambil + alasannya (jangan dibalik tanpa bukti baru)

| Keputusan | Alasan (bukti) |
|---|---|
| **Jalan saja**, bukan 5 sektor | Arahan dosen: *"harus spesifik… satu, satu aja… jalan, itu berarti kembangkan fitur-fitur di dalam; jangan bercabang"* (`docs/transkrip-dosen-pra-2026-10-28.txt`). Ditambah: jalan = 65,6% paket, presisi tertinggi (74,2%), satu-satunya sektor dengan layer garis (818 ber-anchor RW) dan pembanding resmi (IRI). |
| **Kota Tangerang**, bukan Bandung | Arahan dosen + data lebih besar (51.322 vs 23.386 baris RUP). Uji pemetaan: Tangerang 80,4% vs Bandung 76,2% (`docs/MEMO-TANGERANG-2026-10-29.md`). |
| **Tanpa NLP di ekstraksi lokasi** | Uji 29 Okt: fuzzy 0/100, LLM+gazetteer 0/38, LLM+Nominatim 4/23 token; regex 12/40 vs LLM 15/40 (tambahan = sampah). Plafon +1,5 poin (`docs/UJI-NLP-LOKASI-2026-10-29.md`). |
| **Tanpa CV pengukuran kerusakan** | Ditolak user: menambah metrik tanpa menambah urgensi; CV tidak mencakup semua jenis kerusakan. Diganti kategorisasi pelapor. Jangan diusulkan lagi. |
| **Penyedia nama asli, berimbang** | Permintaan dosen 2×; tanpa skor gabungan, selalu dengan penyebut. |
| **FDS = 2 layar, tanpa backend** | Syarat FDS: screenshot landing + 1 fitur. Backend baru setelah 1 Nov. |

## 3. Yang belum dikerjakan (tugas berikutnya)

1. **Dua layar FDS** — `BRIEF.md` sudah ditulis sebagai kontrak. Target: 1 November.
2. Setelah FDS: backend FastAPI + Postgres(+PostGIS) + MinIO, migrasi FE ke Next.js bila tim mau.
3. Masih terbuka: rekam jejak penyedia (FR-07) belum ada datanya — perlu tarikan LPSE per penyedia
   untuk Kota Tangerang; belum dibuat.
4. Masih terbuka: koridor belum punya **geometri garis** (hanya dua titik ujung + nama desa). Kalau
   mau garis mengikuti jalan, perlu routing OSRM untuk 102 pasangan desa.

## 4. Jebakan teknis yang sudah ditemukan (hemat waktu agent berikutnya)

- **SIRUP**: `idKldi` hanya bekerja di `dataruppenyediakldi`. Di `caripaketctr/search`, parameter
  `kldi`/`idsLokasi` **tidak menyaring** — diam-diam mengembalikan 3,56 juta baris nasional.
- **Nama paket Tangerang kotor**: 5,0% diawali kode rekening (`1598.25.397.`), 0,9% entity HTML,
  56% diawali `Belanja …`, ada pembungkus `Belanja Modal Jalan Desa - …`. Semua sudah dibersihkan di
  `build_saksi.py`; jangan menulis parser baru.
- **Bug yang pernah bikin salah hitung**: `norm()` memotong awalan "kel" sehingga "Kelapa Dua" jadi
  "apa dua"; nama desa yang sama dengan nama kecamatan ("Pasar Kemis") salah terpilih kecuali lewat
  penanda `Ds./Desa/Kel.`; koridor hanya sah pada `" - "` ber-spasi (bukan `"Tangerang- Banten"`).
- **Snapshot**: SIRUP menambah paket sepanjang tahun; angka 29 Okt 2026 ini akan bergeser. Jangan
  hardcode di dokumen baru tanpa menyebut tanggal.

## 5. Cara memverifikasi pekerjaan agent

```bash
cd ~/Hermes/wia-webcomp-2026
git log --oneline -5                      # commit klaimnya benar ada dan satu baris
cd web && node tools/typecheck.mjs && node ./node_modules/vite/bin/vite.js build
node tools/check-data.mjs                 # asersi: 1.557 paket jalan, 1.155 bertitik
```

Jangan percaya laporan agent bahwa "sudah selesai" tanpa menjalankan tiga perintah di atas sendiri.
