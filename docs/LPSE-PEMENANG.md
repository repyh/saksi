# Data LPSE → RUP: pemenang kontrak

Snapshot **2 November 2026**. Skrip: `scripts/lpse.mjs` (`npm run lpse:list|detail|match`).
Keluaran: `data/lpse_kota_tangerang_2025_2026.json`.

## Sumber

LPSE Kota Tangerang kini dilayani **SPSE 4.5** di `https://spse.inaproc.id/tangerangkota`
(domain lama `lpse.tangerangkota.go.id` sudah mati — DNS-nya menunjuk Cloudflare dan membalas
`error code: 1001`). Semua halaman di bawah publik, tanpa login:

| Data | Endpoint |
|---|---|
| Daftar tender | `POST /tangerangkota/dt/lelang?tahun=YYYY` (butuh `authenticityToken` + cookie sesi) |
| Daftar non-tender (pengadaan langsung) | `POST /tangerangkota/dt/pl?tahun=YYYY` |
| Detail tender (memuat **Kode RUP**) | `/tangerangkota/lelang/<id>/pengumumanlelang` |
| Detail non-tender (memuat Kode RUP) | `/tangerangkota/nontender/<id>/pengumumanpl` |
| Pemenang + nilai kontrak (tender) | `/tangerangkota/evaluasi/<id>/pemenangberkontrak` |
| Pemenang + nilai kontrak (non-tender) | `/tangerangkota/evaluasinontender/<id>/pemenangberkontrak` |

Catatan teknis: `recordsTotal` dari DataTables tidak bisa dipercaya (bernilai `2147483647`), jadi
pengambilan dilakukan dengan paginasi sampai halaman kosong. Nilai pagu di daftar ditulis ringkas
("98 Jt", "1,1 M") sehingga skrip mengalikan sendiri; nilai kontrak di halaman pemenang memakai
format penuh.

## Hasil pencocokan

| | |
|---|---:|
| Paket RUP (snapshot 31 Okt) | **1.557** |
| Baris LPSE ditarik (2025+2026) | 4.869 (tender 192 · non-tender 4.677) |
| Detail diambil (nama cocok RUP) | 949 |
| **Paket RUP tercocok** | **943 (60,6%)** — semuanya lewat **Kode RUP**, bukan tebakan nama |
| Paket dengan pemenang | **731** |
| Pagu paket tercocok | Rp182,48 M dari Rp650,18 M |
| Nilai kontrak total | **Rp138,81 M** |
| Rasio median kontrak/pagu | **0,99** (tidak ada outlier >1,2 atau <0,3) |

Penyedia terbesar dari sisi nilai: **CV. TRISULA UTAMA** (1 paket, Rp4,07 M — Jembatan Kp. Bayur sisi
Cisadane Barat), **CV. SINAR AGAM LESTARI** (1 paket, Rp1,45 M), lalu beberapa kontraktor dengan 7
paket drainase @Rp200 jt.

## Temuan yang lebih penting: 614 paket tidak punya rekam kontrak

| Metode pada RUP | Paket tidak tercocok |
|---|---:|
| **E-Purchasing** | **448** |
| Pengadaan Langsung | 117 |
| Dikecualikan | 33 |
| Tender | 16 |

Nilainya **Rp467,69 M (71,9% pagu)** — dan yang terbesar justru e-purchasing: Jembatan Saluran
Cisadane Barat 1 (Rp11,76 M), Bahan Material Pemeliharaan Rutin Jalan (Rp8,74 M), Peningkatan Jalan
Iskandar Muda (Rp5,30 M). Artinya: **semakin besar paketnya, semakin kecil kemungkinan nama pemenang
tersedia di LPSE**, karena pengadaannya lewat e-katalog dan bukan tender/penunjukan yang dicatat SPSE.

Ini bukan tuduhan; ini kesenjangan keterbukaan data yang layak ditampilkan apa adanya
("kontrak tidak tersedia di LPSE; kemungkinan melalui e-purchasing").

## Batasan

- **NPWP disamarkan** oleh LPSE (`0*.5**.4**.*-*17.**0`), jadi deduplikasi penyedia hanya bisa lewat
  nama — varian penulisan (`CV`, `cv.`, `PT`) perlu dinormalisasi lebih lanjut.
- 117 paket pengadaan langsung tidak muncul di daftar non-tender meski ada di RUP — kemungkinan belum
  dicatat atau tercatat di tahun berbeda; jangan diklaim sebagai "tidak ada kontrak".
- 33 paket `Dikecualikan` memang tidak melalui LPSE.
- Nama paket di SPSE kadang berbeda kapitalisasi dari RUP; pencocokan tetap memakai Kode RUP.

## Langkah berikutnya (UI)

1. Panel detail paket: tampilkan `Pemenang`, `Nilai kontrak`, `HPS`, `Rasio kontrak/pagu`, dan tautan
   ke halaman LPSE — dengan badge `DATA RESMI (LPSE)` dan kalimat netral.
2. Filter "punya kontrak / tidak" dan kolom penyedia di register.
3. Halaman rekam jejak penyedia: daftar paket per penyedia + penyebut (jumlah paket, tahun, nilai) —
   tanpa skor gabungan.

Ketiganya sudah dikerjakan 2 November 2026:

- `src/server/packages/lpse-repository.ts` — memuat snapshot, indeks `kode_rup → kontrak`,
  `kode_rup → penyedia`.
- `src/server/packages/snapshot-repository.ts` — menempelkan `kontrak` ke setiap paket.
- `src/server/packages/service.ts` — filter `contract`, pencarian nama penyedia, `listVendors`,
  `getVendor`.
- `src/features/map/map-dashboard.tsx` — filter "Kontrak", baris pemenang di daftar, blok
  "Pemenang & kontrak" di panel detail, dan kotak "Tanpa rekam kontrak di LPSE" yang menyebut
  alasan (e-purchasing / dikecualikan / belum tercatat).
- `src/app/penyedia/page.tsx` dan `src/app/penyedia/[slug]/page.tsx` — halaman penyedia.

Hasil verifikasi: `GET /api/packages?kontrak=ADA` → 731 paket, `?kontrak=TANPA` → 826,
`?q=fakhri` → 12 paket (pencarian nama penyedia), 330 penyedia di `/penyedia`.

---

# Lapisan kedua: Data INAPROC — Realisasi (menutup celah e-purchasing)

## Kenapa LPSE saja tidak cukup

SPSE tidak pernah memuat e-purchasing. Menu publiknya hanya `/lelang`, `/nontender`,
`/pengumuman`, `/publik/*` (dicek 2 Nov 2026). SIRUP juga tidak menyimpan penyedia: datatable
publiknya 8 kolom (kode, satker, nama, pagu, metode, sumber dana, kode RUP, bulan) tanpa kolom
penyedia, dan UI-nya sekarang login-gated.

## Sumber yang dipakai

**`https://data.inaproc.id/realisasi`** — dashboard publik LKPP/INAPROC. Isinya transaksi
realisasi per paket, termasuk e-purchasing, dan **memuat `Kode RUP` + `Nama Penyedia`**.

Kolom tabel: Nama Instansi · Nama Satuan Kerja · Kode Paket · **Kode RUP** · Tahun Anggaran ·
Sumber Transaksi (Toko Daring / E-Katalog Versi 6.0 / Non Tender) · Sumber Dana · **Nama Penyedia** ·
Metode Pengadaan · Jenis Pengadaan · Nama Paket · Status Paket · Tahapan · Total Nilai · Nilai PDN · UMK.

Cara mengakses (dipakai `scripts/realisasi.mjs`):

| | |
|---|---|
| Endpoint tabel | `GET https://data.inaproc.id/dashboard-api/realisasi/table` |
| Endpoint ringkas | `GET .../dashboard-api/realisasi/summary` |
| Filter | `tahun`, `instansi` (kldi, mis. `D44`), `satker`, `eselon`, `sumber`, `sumberDana`, `metodePengadaan`, `statusPaket` |
| Paginasi | cursor: ambil `tablePagination.nextCursor`, kirim balik sebagai **`cursor=`** (limit tetap 20) |
| Header wajib | `x-request-time` = epoch ms, `x-secret` = base64 dari string itu **dibalik** |

Data tersinkron 2 Nov 2026 02.39 WIB. Untuk Kota Tangerang: 2025 = 37.799 paket · 2026 = 13.179
paket (semua OPD); filter `satker=1.03.2.10.0.00.01.0000` (Dinas PUPR) menyisakan 9.210 + 1.143.

## Hasil

`node scripts/realisasi.mjs --tahun 2025,2026` → `data/realisasi_kota_tangerang.json`:
**13.240 transaksi · 5.074 RUP** (lima satker D44: PUPR, Dishub, DLH, Kecamatan Pinang, Dispora).

Digabung ke snapshot jalan (LPSE lebih dulu, celahnya diisi realisasi):

| | Sebelum | Sesudah |
|---|---:|---:|
| Paket punya nama penyedia | 731 (46,9%) | **1.417 (91,0%)** |
| Paket tanpa rekam | 826 | **140** |
| Penyedia unik | 330 | **518** |

686 paket terisi dari realisasi: **377 e-purchasing**, 295 pengadaan langsung, 14 dikecualikan.
Yang masih kosong: 71 e-purchasing, 34 pengadaan langsung, 19 dikecualikan, 16 tender
(rinciannya di `docs/SISA-176-PAKET.md`).

**3 paket jalan** punya lebih dari satu penyedia (satu paket, banyak pesanan) — UI menampilkannya
sebagai baris "Penyedia lain". Contoh transaksi terbanyak: pembangunan jalan sisi Saluran Cisadane
Barat = Rp4,73 M dari **28 transaksi** dengan CV JAYA KONSTRUKSI.

## Perubahan kode

- `scripts/realisasi.mjs` — penarik Data INAPROC (header + cursor pagination), simpan transaksi
  mentah **dan** agregat per RUP.
- `src/server/packages/lpse-repository.ts` — kontrak dua sumber: `sumber: "LPSE" | "Data INAPROC"`,
  `jenis` termasuk `e-purchasing`, plus `transaksi`, `penyediaLain`, `sumberTransaksi`.
- `src/features/map/map-dashboard.tsx` — badge berubah jadi `DATA RESMI (LPSE)` / `DATA RESMI (INAPROC)`,
  baris `Sumber` (mis. "E-Katalog Versi 5.0 · 19 transaksi"), dan baris `Penyedia lain`.
- `src/app/penyedia/page.tsx` — metrik dihitung dari data gabungan, bukan dari LPSE saja.

## Etika & batasan

- `data.inaproc.id` tidak punya `robots.txt` yang melarang; API-nya publik dan dipakai dashboard
  resminya sendiri. Pengambilan dibatasi ke satu satker Kota Tangerang + jeda 250 ms per halaman.
- **Kebalikannya**: `katalog.inaproc.id` (`Disallow: /api/`, order di balik login) dan
  `sikap.inaproc.id` (`Disallow: /`) **tidak** di-scrape. SIKaP hanya boleh jadi tautan rujukan manual.
- Realisasi = nilai transaksi, bukan nilai kontrak; untuk e-purchasing satu paket bisa terdiri dari
  puluhan pesanan, sehingga total bisa sedikit di atas pagu bila paket berlanjut antar tahun.

## Sisa yang belum tertutup

140 paket (Rp98,6 M) masih tanpa penyedia. Sebabnya per kategori, daftar kode satker, dan langkah
penarikan semua satker `D44` (beserta estimasi request) ada di **`docs/SISA-176-PAKET.md`**.

