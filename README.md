# SAKSI
**Sistem Akuntabilitas & Komparasi Spasial Infrastruktur**

> Platform pelaporan warga dan audit silang spasial untuk **satu jenis infrastruktur: jalan** —
> menautkan **3.602 paket pekerjaan jalan Kab. Tangerang (Rp848,60 Miliar)** dengan **bukti foto warga
> di ruas yang sama**, ditambah pembanding kondisi resmi dari GIS Bina Marga.
>
> Disusun untuk lomba **MIA 2026 — Web In Action (WIA)**
> **Tema:** *Designing Digital Futures – Powering Public Transparency* · **Subtema:** *Civic Reporting & Accountability*
> **Studi kasus:** Kabupaten Tangerang (`idKldi=D50`, BPS `3603`) · **replikasi:** Kabupaten Bandung

---

## Ringkasan

Warga yang menemukan jalan kampung berlubang tidak tahu apakah ruas itu **baru saja dianggarkan**, siapa
kontraktornya, dan kapan pekerjaannya selesai. Pemerintah daerah sebaliknya menghadapi **bias
pelaporan berjenjang** (*laporan ke atas selalu dinyatakan tuntas*) dan tidak punya sensor lapangan
untuk menangkap kerusakan dini selagi **masa pemeliharaan (garansi kontraktor)** masih berlaku.

SAKSI mengisi celah itu untuk jalan:

1. **Menyaring & memetakan belanja jalan** — 3.602 paket (Rp848,60 M) dari 51.322 baris RUP Kab.
   Tangerang TA 2025–2026, dipetakan ke **251 desa** dan 29 kecamatan. **92,5% (3.331 paket)** punya
   titik, masing-masing dengan badge presisi; **102** di antaranya berupa garis koridor antar-desa.
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
| `saksi_tangerang_2025_2026.json` | SIRUP Inaproc (`idKldi=D50`) | 5.487 paket fisik (5 sektor) + koordinat & presisi; **produk memakai 3.602 paket jalan** |
| `tangerang_desa_coords.json` | Kode wilayah BPS `3603` + koordinat OSM | 274 desa/kelurahan, 29 kecamatan (245 presisi desa, 29 sentroid) |
| `saksi_bandung_2025_2026.json` | SIRUP Inaproc (`idKldi=D107`) | dataset **replikasi**: 5.013 paket, Rp993,95 M, 86,4% terpetakan |
| `bandung_desa_coords.json` | Gazetteer BPS `3204` | 280 desa, 31 kecamatan |
| `jalan.json`, `provinsi.json` | GIS Bina Marga (`IRI_1_2026`) | 477.032 titik IRI nasional (47.703 km) + 33 provinsi |
| `vendor_jakarta.json` | LPSE / SPSE | sampel paket: pagu, HPS, pemenang |
| `manifest.json` | — | metadata sumber, tanggal snapshot, peringatan metodologis |

### Cakupan jalan — Kab. Tangerang (2025–2026)

| | |
|---|---:|
| Paket jalan, jembatan & drainase | **3.602** |
| Pagu | **Rp848,60 M** |
| Median nilai paket | Rp100 juta |
| TA 2025 / TA 2026 | 2.156 / 1.446 |
| Desa/kelurahan | 251 dari 274 · 29 kecamatan |
| Terpetakan | **3.331 (92,5%)** — desa 3.000 · koridor 102 · kecamatan 229 |
| Tanpa lokus (tidak dipetakan) | 271 (7,5%) |

Komposisi: paving/beton 1.186 · drainase/saluran 946 · hotmix/aspal 560 · turap/talud/TPT 103 ·
jembatan/gorong-gorong 78.

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

- ✅ Dataset Tangerang selesai & diverifikasi (5.487 paket unik; produk memakai subset jalan 3.602).
- ✅ Pipeline reproducible: `sirup_search.py` → `geocode_desa.py` → `build_saksi.py`.
- ✅ Dokumen (KONSEP/SPEC/README) versi **jalan-only**.
- 🚧 Frontend: dua layar FDS (peta audit jalan + alur lapor) sedang dibangun di atas dataset ini.
- 📌 Tidak ada dataset pengadaan Indonesia yang memuat koordinat paket; titik di SAKSI diturunkan
  dari teks nama paket dan selalu diberi badge presisi.

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
