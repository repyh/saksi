# HANDOFF — status per 31 Oktober 2026

Dokumen ini untuk agent/sesi berikutnya. Baca berturut: **HANDOFF.md → AGENTS.md → BRIEF.md →
SPEC.md**. Jangan mengandalkan transkrip percakapan; keputusan yang mengikat ada di file.

## 1. Status

**Konsep dikunci:** SAKSI, satu jenis infrastruktur = **jalan**, studi kasus **Kota Tangerang**,
subtema *Civic Reporting & Accountability*. Riwayat: SOROT (ditolak) → RUAS (dihentikan) → SAKSI 5
sektor Bandung → SAKSI 5 sektor Kab. Tangerang → SAKSI jalan-only Kab. Tangerang → **31 Okt: pindah ke
Kota Tangerang karena server GIS-nya terbuka** (rencana extend ke kab/kota lain menyusul).

**Dua layar FDS sudah jadi dan hijau** di `web/` (peta audit + alur lapor). Dataset Kota dibangun ulang
31 Okt; studi kasus Kabupaten tetap tersimpan sebagai arsip.

| | |
|---|---:|
| RUP Kota Tangerang 2025+2026 (`idKldi=D44`) | **21.402** baris |
| Paket jalan (dipakai produk) | **1.557 · Rp650,18 M** |
| TA 2025 / TA 2026 | 939 / 618 |
| Anchor **RW** (nomor RW di nama paket) | **818 (52,5%)** |
| Anchor kelurahan | 337 (21,6%) |
| Tanpa lokus (tidak tampil di peta) | 402 (25,8%) |
| Kelurahan tersentuh | **80 dari 104** · 13 kecamatan |
| Unit RW tersentuh | **483 dari 1.020** |

Pipeline: `tools/build_kota.py` (SIRUP `D44` + `rw.geojson`/`kel.geojson` dari ArcGIS Kota Tangerang)
→ `web/public/data/{paket,desa}.json`. Batas wilayah: `docs/INVENTARIS-ARCGIS-KOTA-TANGERANG.md`.

## 2. Keputusan + bukti (jangan dibalik tanpa bukti baru)

| Keputusan | Alasan |
|---|---|
| **Jalan saja**, bukan 5 sektor | Arahan dosen: *"harus spesifik… satu, satu aja… jangan bercabang"*. |
| **Kota Tangerang**, bukan Kabupaten | Kabupaten tidak punya GIS publik (`maps.tangerangkab` = TileServer GL OSM; `geoportal` menutup koneksi), Kota punya ArcGIS 10.71 dengan 522 layanan. |
| **Anchor RW**, bukan ruas jalan | Uji 31 Okt: hanya 7% paket menyebut ruas yang bisa dicocokkan; 54,8% menyebut RW. `docs/UJI-MATCHING-KOTA-TANGERANG.md`. |
| **Peta = koroplet wilayah**, tanpa titik | Paket tidak punya koordinat pekerjaan; offset acak membuat titik tampak presisi di ruas (keluhan user). |
| **Tanpa NLP di ekstraksi lokasi** | Uji 29 Okt: fuzzy 0/100, LLM+gazetteer 0/38; plafon +1,5 poin. `docs/UJI-NLP-LOKASI-2026-10-29.md`. |
| **Tanpa CV pengukuran kerusakan** | Ditolak user + dosen. Diganti kategorisasi pelapor. Jangan diusulkan lagi. |
| **Penyedia nama asli, berimbang** | Permintaan dosen 2×; tanpa skor gabungan, selalu dengan penyebut. |

## 3. Yang belum dikerjakan

1. **PDF FDS ≤10 hlm + repo publik + screenshot landing** (tenggat 1 Nov).
2. FR-07 rekam jejak penyedia: belum ada datanya; perlu tarikan LPSE per penyedia Kota Tangerang.
3. Rencana extend: parameterkan `build_kota.py` per `idKldi` + adapter batas (ArcGIS Kota vs GADM/BIG
   untuk kabupaten yang tidak punya server).
4. Kalau mau presisi ruas untuk 7% paket: pakai `namobj` layer PU 2024 (5.751 nama) + kecamatan sebagai
   kunci — sudah diuji, hasil 94 cocok persis + 17 fuzzy.

## 4. Jebakan teknis

- **SIRUP**: `idKldi` hanya bekerja di `dataruppenyediakldi`; `caripaketctr/search` tidak menyaring dan
  mengembalikan data nasional. Kode Kota Tangerang = **D44** (ditemukan dengan menyapu D1–D400 dan
  mencocokkan nama satker ke nama kecamatan). Endpoint membalas **HTTP 429** kalau dipanggil rapat —
  beri jeda 3 detik antar halaman.
- **ArcGIS Kota**: `f=geojson` jalan; `maxRecordCount` 1.000 (2.000 untuk `UTILITAS/jalan_tngkota`);
  pakai `maxAllowableOffset=0,00004` agar poligon tidak timeout. Query `IS NOT NULL AND <> ''` gagal
  (HTTP 400) pada field numerik. Folder aset/kadaster/persil butuh token.
- **Nama ruas PU 2024 ada di `namobj`, bukan `nama_ruas`** (`nama_ruas` hanya 32 baris duplikat arteri).
- **Klasifikasi pekerjaan**: "gorong-gorong" harus masuk **drainase**, bukan jembatan — sebelumnya 978
  paket salah kelas.
- **Snapshot**: SIRUP menambah paket sepanjang tahun. Angka 31 Okt 2026 akan bergeser; jangan hardcode
  tanpa tanggal.

## 5. Verifikasi

```bash
cd ~/dev/saksi/web
node tools/typecheck.mjs && node ./node_modules/vite/bin/vite.js build
node tools/check-data.mjs      # 1.557 paket · 1.155 berlokus · 818 anchor RW · 1.020 poligon RW
```

Repo kerja: `~/dev/saksi` (kode + data). Arsip dokumen: `~/Hermes/wia-webcomp-2026`.

Jangan percaya laporan agent bahwa "sudah selesai" tanpa menjalankan tiga perintah di atas sendiri.
