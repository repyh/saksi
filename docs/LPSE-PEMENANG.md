# Data LPSE → RUP: pemenang kontrak

> **Notasi:** istilah **"pemenang"** hanya dipakai untuk paket tender/seleksi. Untuk
> pengadaan langsung, e-purchasing, dan penunjukan langsung, istilah yang benar adalah **"penyedia"**;
> kode memakai field `penyedia` dan hanya menampilkan label "Pemenang" bila `jenis === "tender"`.

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
| Paket RUP (snapshot 5 Nov 2026) | **1.634** |
| Baris LPSE ditarik (2025+2026) | 4.869 (tender 192 · non-tender 4.677) |
| Detail diambil (nama cocok RUP) | 949 |
| **Paket RUP tercocok** | **943 (60,6%)** — semuanya lewat **Kode RUP**, bukan tebakan nama |
| Paket dengan pemenang | **731** |
| Pagu paket tercocok | Rp182,48 M dari Rp683,34 M |
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

Cara mengakses (dipakai `scripts/realisasi.mjs`). Ada **dua jalur**, keduanya tanpa login:

**Jalur CSV (bawaan)** — 4 request untuk seluruh instansi:

| Langkah | Request |
|---|---|
| 1. Tanda tangan | `POST /dashboard-api/export/signature` body `{"path":"/dashboard-api/realisasi/export","body":"<json filter>"}` → `{time,nonce,signature,path,headers:{x-auth-*}}` |
| 2. Buat job | `POST /dashboard-api/realisasi/export` dengan header `x-auth-*` dari langkah 1 → `{job_id, events_url, download_url}` |
| 3. Tunggu | `GET /dashboard-api/export/<job_id>/events` (`text/event-stream`) → `data: {"download_url": ...}` |
| 4. Unduh | `GET <download_url>` — URL GCS bertanda tangan, **kirim tanpa header API** |

**Jalur tabel (cadangan, `--mode table`)** — 20 baris/halaman, cursor:
`GET /dashboard-api/realisasi/table`, ambil `tablePagination.nextCursor`, kirim balik sebagai `cursor=`.

Keduanya wajib mengirim anti-bot `x-request-time` (epoch ms) + `x-secret` = base64 dari string itu
**dibalik**, dan filter wajib `tahun` + `jenis` (`"5"` = pemerintah daerah) + `instansi` (`D44`).
Catatan: `POST /realisasi/export` tanpa header `x-auth-*` menjawab **401** — bukan karena perlu akun,
tapi karena tanda tangannya belum ada.

Data tersinkron 6 Nov 2026. Untuk Kota Tangerang: **2025 = 37.278 baris · 2026 = 13.558 baris**,
semuanya dalam satu ekspor per tahun.

## Hasil

`node scripts/realisasi.mjs --mode csv` → `data/realisasi_kota_tangerang.json`:
**50.836 transaksi · 20.817 RUP · 12 detik** (seluruh satker `D44`, ekspor 2025 + 2026, snapshot
6 November 2026).
Jalur tabel butuh ~2.549 request (~40 menit) untuk cakupan yang sama — itu sebabnya CSV jadi bawaan.

Digabung ke snapshot jalan (LPSE lebih dulu, celahnya diisi realisasi):

| | Sebelum | Sesudah |
|---|---:|---:|
| Paket punya nama penyedia | 731 (46,9%) | **1.426 (87,3%)** |
| Paket tanpa rekam | 826 | **208** |
| Penyedia unik | 330 | **522** |

695 paket terisi dari realisasi: **378 e-purchasing**, 297 pengadaan langsung, 20 dikecualikan.
Yang masih kosong: 71 e-purchasing, 32 pengadaan langsung, 13 dikecualikan, 16 tender, 76 tanpa
metode di ekspor RUP (rinciannya di `docs/SISA-176-PAKET.md`).

**2 paket jalan** punya lebih dari satu penyedia (satu paket, banyak pesanan) — UI menampilkannya
sebagai baris "Penyedia lain". Contoh transaksi terbanyak: pembangunan jalan sisi Saluran Cisadane
Barat = Rp4,73 M dari **28 transaksi** dengan CV JAYA KONSTRUKSI.

## Perubahan kode

- `scripts/realisasi.mjs` — penarik Data INAPROC: ekspor CSV resmi (signature → job → SSE → URL GCS)
  sebagai jalur bawaan, cursor tabel sebagai cadangan; simpan transaksi mentah **dan** agregat per RUP.
- `src/server/packages/lpse-repository.ts` — kontrak dua sumber: `sumber: "LPSE" | "Data INAPROC"`,
  `jenis` termasuk `e-purchasing`, plus `transaksi`, `penyediaLain`, `sumberTransaksi`.
- `src/features/map/map-dashboard.tsx` — badge berubah jadi `DATA RESMI (LPSE)` / `DATA RESMI (INAPROC)`,
  baris `Sumber` (mis. "E-Katalog Versi 5.0 · 19 transaksi"), dan baris `Penyedia lain`.
- `src/app/penyedia/page.tsx` — metrik dihitung dari data gabungan, bukan dari LPSE saja.

## Etika & batasan

- `data.inaproc.id` tidak punya `robots.txt` yang melarang; API-nya publik dan dipakai dashboard
  resminya sendiri. Penarikan memakai fitur ekspor resmi (4 request per tahun untuk seluruh
  instansi), bukan merayapi halaman; jalur tabel hanya cadangan dan diberi jeda 250 ms per halaman.
- **Kebalikannya**: `katalog.inaproc.id` (`Disallow: /api/`, order di balik login) dan
  `sikap.inaproc.id` (`Disallow: /`) **tidak** di-scrape. SIKaP hanya boleh jadi tautan rujukan manual.
- Realisasi = nilai transaksi, bukan nilai kontrak; untuk e-purchasing satu paket bisa terdiri dari
  puluhan pesanan, sehingga total bisa sedikit di atas pagu bila paket berlanjut antar tahun.

## Sisa yang belum tertutup

208 paket (Rp130,67 M) masih tanpa penyedia. Sebabnya per kategori dan sisa pekerjaan ada di
**`docs/SISA-176-PAKET.md`**.

