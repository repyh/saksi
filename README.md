# SAKSI
**Sistem Akuntabilitas & Komparasi Spasial Infrastruktur**

> Platform pelaporan warga dan audit silang spasial untuk **satu jenis infrastruktur: jalan** —
> menautkan **1.557 paket pekerjaan jalan Kota Tangerang (Rp650,18 Miliar)** dengan **bukti foto warga
> di ruas yang sama**, ditambah pembanding kondisi resmi dari GIS Bina Marga.
>
> Disusun untuk lomba **MIA 2026 — Web In Action (WIA)**
> **Tema:** *Designing Digital Futures – Powering Public Transparency* · **Subtema:** *Civic Reporting & Accountability*
> **Studi kasus:** Kota Tangerang (`idKldi=D44`, BPS `3671`) · **replikasi:** Kabupaten Bandung

---

## Ringkasan

Warga yang menemukan jalan kampung berlubang tidak tahu apakah ruas itu **baru saja dianggarkan**, siapa
kontraktornya, dan kapan pekerjaannya selesai. Pemerintah daerah sebaliknya menghadapi **bias
pelaporan berjenjang** (*laporan ke atas selalu dinyatakan tuntas*) dan tidak punya sensor lapangan
untuk menangkap kerusakan dini selagi **masa pemeliharaan (garansi kontraktor)** masih berlaku.

SAKSI mengisi celah itu untuk jalan:

1. **Menyaring & memetakan belanja jalan** — 1.557 paket (Rp650,18 M) dari 21.402 baris RUP **Kota
   Tangerang** TA 2025–2026, dikaitkan ke **80 kelurahan**, **483 RW**, dan 13 kecamatan. Setiap paket
   punya **sumber lokasi turunan** (RW / kelurahan); tidak ada yang punya koordinat pekerjaan, dan
   peta menampilkan **batas RW/kelurahan**, bukan titik paket.
2. **Menautkan laporan warga ke paket anggaran** — foto (EXIF dibersihkan, wajah/plat diburamkan),
   jenis & penyebab kerusakan yang dikategorikan pelapor, lalu dicocokkan ke paket RUP di desa/koridor
   yang sama dengan skor kecocokan yang ditampilkan apa adanya.
3. **Indikator "Diduga Tidak Sesuai" + verifikasi dua kunci** — menyandingkan riwayat anggaran
   (SIRUP/LPSE), klaim kondisi resmi (477.032 titik IRI Bina Marga), dan laporan warga yang
   dikonfirmasi warga sekitar. Paket yang dilaporkan rusak **dalam masa pemeliharaan** masuk daftar
   tagih ke kontraktor.

---

## Dokumen

- **[`KONSEP.md`](./KONSEP.md)** — masalah, posisi inovasi (termasuk pembanding Filipina/DPWH),
  cakupan jalan, dampak & siapa penerimanya, batasan dan etika.
- **[`SPEC.md`](./SPEC.md)** — sumber data, pipeline (termasuk daftar keputusan yang sudah diuji),
  pemetaan 4 tingkat, model data laporan, rumus `MatchScore`, 7 modul, 5 layar.
- **[`STATE.md`](./STATE.md)** — status kerja, keputusan, catatan bug pipeline.
- `docs/` — aturan lomba, transkrip bimbingan, memo uji data, uji NLP.

---

## Dataset di `data/` (snapshot 29 Oktober 2026)

| Berkas | Sumber | Isi |
|---|---|---|
| `web/public/data/paket.json` | SIRUP Inaproc `idKldi=D44` | **1.557 paket jalan** TA 2025–2026 + anchor RW/kelurahan |
| `web/public/data/rw.geojson` | ArcGIS Kota Tangerang (`batas_rw_2021`) | **1.020 poligon RW** |
| `web/public/data/kel.geojson` | ArcGIS Kota Tangerang (`Batas_Wilayah_Kelurahan_def`) | **104 poligon kelurahan** |
| `web/public/data/desa.json` | turunan `rw.geojson` | unit wilayah (RW) + titik tengah untuk pencarian terdekat |
| `data/scratch/kota_tng/rup_kota_*.json` | tarikan mentah SIRUP | 21.402 baris RUP 2025 + 2026 (tidak di-commit) |
| `saksi_tangerang_2025_2026.json` | arsip | dataset **Kabupaten** Tangerang (studi kasus sebelumnya) |
| `saksi_bandung_2025_2026.json` | arsip | dataset replikasi Bandung |

### Cakupan jalan — Kota Tangerang (2025–2026)

| | |
|---|---:|
| Paket jalan, jembatan & drainase | **1.557** |
| Pagu | **Rp650,18 M** |
| Median nilai paket | Rp200 juta |
| TA 2025 / TA 2026 | 939 / 618 |
| Kelurahan tersentuh | **80 dari 104** · 13 kecamatan |
| RW tersentuh | **483 dari 1.020** |
| Anchor RW di nama paket | **818 (52,5%)** |
| Anchor kelurahan | 337 (21,6%) |
| Tanpa lokus (tidak tampil di peta) | 402 (25,8%) |

**Tidak ada paket yang punya koordinat pekerjaan.** Angka di atas adalah provenans lokasi, bukan
akurasi; karena itu peta mewarnai **batas RW/kelurahan resmi**, bukan titik per paket.

Komposisi: drainase/saluran 1.238 · permukaan (paving/hotmix) 269 · jembatan 50.

---

## Tech Stack

- **Frontend:** Vite + React 19 + TypeScript + Tailwind CSS 4; peta **OpenStreetMap** (Leaflet/MapLibre), 2D, build statis.
- **Pipeline data:** Python 3 — tarikan SIRUP, geocoding gazetteer desa (Nominatim, checkpoint), penyaringan & kelas pekerjaan jalan, pemetaan berjenjang.
- **Penyimpanan prototipe:** JSON terbundel + `localStorage` untuk laporan baru saat demo.

---

## Cara Menjalankan

```bash
# Aplikasi web
cd web
npm install
npm run dev                                   # http://localhost:5173
node tools/typecheck.mjs
node ./node_modules/vite/bin/vite.js build     # build statis ke web/dist

# Pipeline data
python3 ingest/sirup_search.py tarik D50 2026 data/scratch/tangerang_kab_2026.json
python3 ingest/geocode_desa.py                 # gazetteer desa → koordinat (butuh data/scratch/tangerang_desa_wilayah.json)
python3 ingest/build_saksi.py tangerang_kab 2025 2026
```

---

## Status (29 Oktober 2026)

- ✅ Dataset Tangerang selesai & diverifikasi (5.487 paket unik; produk memakai subset jalan 1.557).
- ✅ Pipeline reproducible: `sirup_search.py` → `geocode_desa.py` → `build_saksi.py`.
- ✅ Dokumen (KONSEP/SPEC/README) versi **jalan-only**.
- 🚧 Frontend: dua layar FDS (peta audit jalan + alur lapor) sedang dibangun di atas dataset ini.
- 📌 Tidak ada dataset pengadaan Indonesia yang memuat koordinat paket. Lokasi di SAKSI diturunkan
  dari teks nama paket ke **pusat desa/kecamatan**; peta tidak memplot titik paket agar tidak
  menyesatkan.

---

## Prinsip Kredibilitas, Privasi & Etika

1. **Bahasa "Diduga", bukan tuduhan** — status tertinggi *"Diduga Tidak Sesuai — Perlu Tinjauan
   Lapangan"*; tidak pernah menyebut korupsi atau fiktif.
2. **Privasi pelapor** — tanpa login identitas, EXIF dihapus di perangkat, wajah/plat diburamkan.
3. **Penyedia disebut asli tetapi berimbang** — nama dari data publik LPSE, tanpa skor gabungan,
   selalu dengan penyebut (jumlah paket, kelas jalan, tahun), hanya mendeskripsikan paket dengan
   laporan kerusakan dalam masa pemeliharaan.
4. **Tanpa klaim presisi palsu** — tidak ada pengukuran kerusakan otomatis (CV); pelapor
   mengategorikan jenis & penyebab kerusakan serta ukuran kasar. Paket tanpa penanda lokasi tidak
   dipetakan.
5. **Transparansi data** — angka SIRUP dan IRI adalah data asli bertanggal; laporan warga pada
   prototipe diberi badge `SIMULASI PROTOTIPE`, data asli diberi badge `DATA RESMI (SIRUP / BINA MARGA)`.
