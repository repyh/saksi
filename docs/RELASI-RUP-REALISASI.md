# Relasi RUP ↔ paket realisasi (Data INAPROC)

**Snapshot:** 6 November 2026 · **Sumber:** `data/realisasi_kota_tangerang.json` (ekspor CSV resmi
`data.inaproc.id`, seluruh satker `D44`, TA 2025 + 2026) · **Skrip:** `npm run data:realisasi`

Dokumen ini menjawab dua hal yang sering keliru diasumsikan:

1. **Kunci halaman bukti.** `https://data.inaproc.id/realisasi?kode=…` memakai **kode paket**
   (kode tender / kode e-katalog), **bukan** kode RUP. Realisasi menyimpan kolom `kode_rup` khusus
   untuk bergabung ke RUP.
2. **Kardinalitas.** Hubungan RUP ↔ paket realisasi **bukan** satu-ke-satu. Arahnya bergantung pada
   metode/metode transaksi, dan itu menentukan bagaimana penyedia serta nilai harus dijumlahkan.

## 1. Cakupan data

| Ukuran | Nilai |
|---|---|
| Baris transaksi unik | **50.836** |
| RUP unik | **20.817** |
| Paket unik (kode paket) | **31.305** |
| Baris tanpa `kode_paket` | 0 |
| Metode pengadaan | E-Purchasing 38.561 · Pengadaan Langsung 7.051 · Swakelola 3.897 · Dikecualikan 1.099 · Tender 92 · Seleksi 81 · Penunjukan Langsung 55 |
| Sumber transaksi | E-Katalog 6.0 20.494 · E-Katalog 5.0 18.067 · Non Tender 4.152 · Pencatatan Non Tender 4.053 · Pencatatan Swakelola 3.897 · Tender 173 |

## 2. Kardinalitas per metode pengadaan

| Metode | Baris | RUP | Paket | RUP → >1 paket | Paket → >1 RUP | Relasi |
|---|---:|---:|---:|---:|---:|---|
| E-Purchasing | 38.561 | 8.991 | 25.192 | 2.843 | 0 | **1–N** |
| Pengadaan Langsung | 7.051 | 6.789 | 7.040 | 94 | 11 | **M–N** |
| Swakelola | 3.897 | 3.814 | 3.897 | 77 | 0 | **1–N** |
| Dikecualikan | 1.099 | 1.003 | 1.099 | 4 | 0 | **1–N** |
| Tender | 92 | 92 | 92 | 0 | 0 | **1–1** |
| Seleksi | 81 | 81 | 81 | 0 | 0 | **1–1** |
| Penunjukan Langsung | 55 | 51 | 55 | 2 | 0 | **1–N** |

Bacaan: satu RUP **hampir selalu** hanya punya satu paket realisasi, kecuali e-purchasing (banyak
pesanan) dan sebagian pengadaan langsung. Kasus **paket → banyak RUP** jarang (11 paket) dan hanya
muncul pada pengadaan langsung, ketika satu paket SPSE dirujuk beberapa RUP.

## 3. Kardinalitas per sumber transaksi

| Sumber transaksi | Baris | RUP | Paket | RUP → >1 paket | Paket → >1 RUP | Relasi |
|---|---:|---:|---:|---:|---:|---|
| E-Katalog Versi 6.0 | 20.494 | 7.701 | 20.494 | 2.544 | 0 | 1–N |
| E-Katalog Versi 5.0 | 18.067 | 1.701 | 4.698 | 405 | 0 | 1–N |
| Non Tender | 4.152 | 4.150 | 4.152 | 2 | 0 | 1–N |
| Pencatatan Non Tender | 4.053 | 3.748 | 4.053 | 40 | 0 | 1–N |
| Pencatatan Swakelola | 3.897 | 3.814 | 3.897 | 77 | 0 | 1–N |
| Tender | 173 | 173 | 173 | 0 | 0 | 1–1 |

Catatan penting: hubungan **paket → banyak RUP** (11 kasus) **tidak terlihat** saat dipecah per
sumber, karena pasangan itu selalu menyeberang antara `Non Tender` dan `Pencatatan Non Tender`.
Artinya: satu kode tender tercatat dua kali (pencatatan + transaksi), dan dua RUP berbeda bisa
menunjuk kode tender yang sama.

## 4. Di dalam cakupan produk (1.634 paket)

- Baris transaksi: **6.582** · RUP: **1.471** · kode paket unik: **1.484**
- Distribusi jumlah paket per RUP: 1 paket **1.466 RUP**, 2 paket 3, 5 paket 1, 7 paket 1 (maksimum 7)
- Metode: Pengadaan Langsung 1.020 · E-Purchasing 5.486 baris · Dikecualikan 22 · Swakelola 44 · Seleksi 7 · Tender 3
- Sumber: E-Katalog 5.0 5.347 · Non Tender 1.018 · E-Katalog 6.0 139 · Pencatatan Swakelola 44 · Pencatatan Non Tender 24 · Tender 10

Konsekuensi untuk UI: penyedia dan nilai diambil dari **penyedia dengan nilai terbesar**, sisa
penyedia ditampilkan sebagai "penyedia lain", dan nilai yang ditampilkan adalah **nilai realisasi**
(bukan nilai kontrak). Bila RUP punya beberapa paket, tautan bukti memakai paket dengan nilai terbesar
yang sumbernya paling informatif.

## 5. Ketersediaan halaman detail (`/realisasi?kode=<kode paket>`)

Diuji dengan 12 sampel acak per sumber transaksi (endpoint `dashboard-api/realisasi/detail`):

| Sumber | Sampel | Punya detail |
|---|---:|---:|
| Tender | 12 | **12** |
| Non Tender | 12 | 1 |
| Pencatatan Swakelola | 12 | 1 |
| E-Katalog Versi 5.0 | 12 | 1 |
| E-Katalog Versi 6.0 | 12 | 0 |
| Pencatatan Non Tender | 12 | 0 |

Kesimpulan: **halaman realisasi hanya kaya untuk paket bertanda tender.** Paket e-katalog tetap
membuka halaman dengan konteks paket yang benar, tetapi badan halaman menjawab
"Realisasi ini tidak memiliki Data Detail". Karena itu SAKSI memakai tautan ini sebagai bukti paket
(identitas transaksi), sementara detail RUP tetap tersedia lewat `https://data.inaproc.id/rup?kode=<kode RUP>`.

## 6. Aturan yang dipakai kode

`src/server/packages/lpse-repository.ts`:

1. Baris realisasi ber-metode **Swakelola** dan nama "penyedia" yang sebenarnya instansi
   (Dinas/OPD/Pegawai) **tidak** dihitung sebagai pelaksana.
2. Satu RUP → kumpulan paket; tautan bukti memilih paket dengan prioritas sumber
   `Tender → Non Tender → Pencatatan Non Tender → Pencatatan Swakelola → E-Katalog`, lalu nilai terbesar.
3. `nilai_kontrak` untuk jalur realisasi = **jumlah nilai transaksi**, bukan nilai kontrak; field
   `transaksi` dan `jumlahPaket` ikut disimpan agar pembaca tahu asal angkanya.
4. LPSE tetap diutamakan bila ada rekamnya (HPS, nilai kontrak, NPWP, URL SPSE).
