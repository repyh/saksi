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

