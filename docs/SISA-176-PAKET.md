# Sisa paket tanpa penyedia — sebab dan sisa pekerjaan

> **Catatan 11 November 2026:** register aktif = **2.228 paket**, tanpa rekam penyedia publik
> **146 paket · Rp99,17 M** (`data/regions/kota-tangerang/manifest.json`, `npm run rup:switch`).
> Uji RUP switch sudah dijalankan — lihat §Hasil uji RUP switch. Angka 2.552/218 di bawah adalah
> tahap 6–10 November.

> **Catatan 8 November 2026:** kondisi aktif = **2.552 paket** dan **218 paket (Rp132,34 M, 16,3%
> pagu) tanpa rekam penyedia publik**. Angka 176/140/133 di bagian riwayat adalah tahap penarikan
> data, bukan kondisi terkini.

Snapshot RUP **5 November 2026**; realisasi **6 November 2026**. Setelah LPSE (731 paket) dan **ekspor
Data INAPROC realisasi untuk seluruh satker `D44`** (1.603 paket tambahan), **2.334 dari 2.552** paket
jalan punya nama penyedia. Sisa **218 paket · Rp132,34 M** (16,3% pagu).

> Riwayat angka: 176 paket (LPSE + PUPR saja) → 140 (lima satker) → **133** (ekspor CSV seluruh
> satker) → **208** setelah populasi RUP naik ke 1.634 paket → **218** setelah rebuild prefiks `Jl.`
> menaikkan populasi ke 2.552 paket.

Dokumen ini mencatat **kenapa** sisanya kosong dan **apa** langkah berikutnya — supaya angka ini
tidak ditebak ulang di sesi lain.

## Rincian sisa 218 paket (data 6 November 2026)

| Metode di ekspor RUP | Paket |
|---|---:|
| E-Purchasing | 71 |
| Pengadaan Langsung | 42 |
| Tanpa metode di ekspor | 76 |
| Tender | 16 |
| Dikecualikan | 13 |
| **Total** | **218** |

Menurut tahun: **2025 = 120 · 2026 = 98**. Menurut satker terbesar: PUPR 146, Dishub 27, enam
kecamatan 43, Disperindagkop 1, DLH 1.

Bukan karena kolom penyedia kosong: ekspor 6 November 2026 memuat **50.836 baris** dan **tidak ada**
baris berpenyedia `-`. Ada 265 baris tanpa `kode_rup`; baris itu tidak dipakai sebagai rekam paket.

## Riwayat analisis sebab (kondisi 133 paket, 4 November 2026)

> Bagian di bawah adalah riwayat proses penarikan data. Angka 111/22/15 dan totalnya **tidak lagi
> menjumlah ke 218**; rincian aktif ada di tabel metode di atas.

| Sebab | Paket | Bukti |
|---|---:|---|
| **Tidak ada transaksi tercatat** — PUPR | **111** | kode RUP-nya **nol baris** di ekspor lengkap |
| **Tidak ada transaksi tercatat** — Dishub | **22** | idem; 31 paket Dishub lain tertutup setelah satker ditarik |
| **Tender yang tidak ada di daftar lelang SPSE** | 16 | kemiripan nama tertinggi dengan 192 baris lelang hanya **0,38** |
| **Dikecualikan** (di luar prosedur pengadaan) | 15 | tidak muncul di LPSE maupun realisasi |

Menurut metode saat itu: **e-purchasing 70 · pengadaan langsung 32 · tender 16 · dikecualikan 15**.
Menurut tahun saat itu: **2025 = 77 · 2026 = 56**.

## Kenapa paket ini bisa tidak punya transaksi

1. **Belum berjalan.** Paket TA2026 berjadwal Agustus–November 2026 belum tentu sudah bertransaksi;
   data INAPROC tersinkron 6 Nov 2026.
2. **RUP tidak dieksekusi / diganti.** Paket TA2025 yang tidak pernah bertransaksi biasanya
   dibatalkan, digeser ke tahun berikutnya, atau dieksekusi dengan kode RUP lain ("RUP switch").
3. **Di luar SPSE dan INAPROC sekaligus.** 13 paket `Dikecualikan` memang tidak lewat prosedur
   pengadaan, jadi tidak akan pernah muncul di kedua sumber.
4. **Tender tidak terdaftar** di LPSE Kota Tangerang — 16 paket, kemungkinan ditenderkan lewat
   mekanisme/instansi lain atau dibatalkan.

## Sisa pekerjaan

1. ~~**Uji RUP switch** untuk 146 paket PUPR~~ **sudah dijalankan 11 November 2026** — hasilnya di
   §Hasil uji RUP switch: hanya 2 paket (6 bila entri `ABT` ikut dihitung) yang punya kembaran dan
   tetap perlu verifikasi manusia. Uji ini **tidak** menaikkan cakupan.
2. **Biarkan kosong** paket berjadwal Agustus–November 2026 dan paket `Dikecualikan`; UI sudah
   menyebutkan "belum ada rekam publik".
3. **Jangan kejar SIKaP/e-katalog** untuk sisa ini: `sikap.inaproc.id` (`Disallow: /`) dan
   `katalog.inaproc.id` (`Disallow: /api/`) bukan target pengambilan data.

## Hasil uji RUP switch (11 November 2026)

`npm run rup:switch` mencocokkan **146 paket** register tanpa rekam penyedia ke seluruh **29.288 baris**
RUP `D44` (TA 2025–2026). Keluaran mesin: `data/rup_switch_kota-tangerang.json` (tidak di-commit,
regenerasi dengan perintah itu).

**Aturan uji.** Nama **identik** setelah normalisasi, bukan skor kemiripan. Pagu tidak boleh dipakai
sendirian: **119 dari 146** paket tanpa rekam punya kandidat berpagu sama, setahun, dan sesatker
dengan nama yang sepenuhnya lain — pagu dibulatkan dan berulang (Rp200.000.000 saja muncul pada
**840** paket register).

| Hasil | Paket |
|---|---:|
| Kembar se-tahun, kandidat punya penyedia (**diduga** dieksekusi lewat RUP lain) | **2** |
| Kembar se-tahun, kandidat bertanda `ABT` — perlu tinjauan | 4 |
| Kembar se-tahun, kandidat juga tanpa rekam | 0 |
| Kembar lintas tahun — tidak dipakai sebagai bukti | 41 |
| Tanpa pasangan nama di seluruh dump | **100** |

Baris tidak dijumlahkan: satu paket (`65350555`) punya kembar se-tahun sekaligus lintas tahun,
sehingga 146 = 46 paket berpapasan + 100 tanpa pasangan.

| RUP tanpa rekam | Pagu | RUP kembar | Pagu kembar | Penyedia pada RUP kembar |
|---|---:|---|---:|---|
| `65350555` Peningkatan Jl. Lingk. RW 08 dsk Kel. Alam Jaya | 175.000.000 | `66049812` | 198.000.000 | CV. TUNAS HARAPAN MANDIRI (LPSE, kontrak 196.600.000) |
| `59360344` Pembangunan Tanggul/Turap Kunciran Indah | 400.000.000 | `61608383` | 200.000.000 | CV TAPAK NURANI BERKAH (LPSE, kontrak 198.815.000) |
| `61104833` … Saluran Pembuang Semanan (Poris Indah – Gor Gondrong) (ABT) | 1.000.000.000 | `56507341` | 2.000.000.000 | wijha mandiri (realisasi 1.891.283.070) |
| `61129076` Peningkatan Jalan M. Toha (ABT) | 1.000.000.000 | `56743156` | 2.000.000.000 | CV. ARYA KAMANDANU KONSTRUKSI (realisasi 1.917.925.773) |
| `61121119` … Cisadane Timur (Selatan) (ABT) | 1.000.000.000 | `56507469` | 4.000.000.000 | VIR Maju Bersama (realisasi 3.829.790.685) |
| `61104506` … Saluran Pembuang Semanan (Green Lake – Batas DKI) (ABT) | 1.000.000.000 | `56505775` | 5.000.000.000 | PT. NUSA CIPTA LESTARI (realisasi 4.755.162.441) |

**Kenapa tetap "diduga", bukan bukti.** Dua baris pertama berpagu jauh dari kembarannya (13% dan
50%), jadi bisa juga pekerjaan yang sama dipecah menjadi beberapa kontrak. Empat baris `ABT` justru
menunjukkan pola paling masuk akal: nama sama tanpa penanda `ABT` pada RUP yang bertransaksi senilai
±95% pagunya, sedangkan entri `ABT` (anggaran biaya tambahan) tidak pernah bertransaksi sendiri.
Keduanya hanya bisa dipastikan dengan membuka halaman RUP di `data.inaproc.id/rup?kode=<kode RUP>`
dan memeriksa status/keterangannya — bukan dengan pencocokan teks.

**Yang ditutup oleh hasil ini.** 100 paket tidak punya RUP bernama sama di seluruh `D44`, jadi
hipotesis "RUP switch" tidak menjelaskan mayoritas sisa. Jalur lain juga buntu: **269** baris
realisasi tanpa `kode_rup` tidak satu pun menyebut objek jalan (isinya belanja kantor, puskesmas,
iuran), sehingga bukan celah join untuk register jalan. Kembar lintas tahun tidak boleh dipakai:
pekerjaan jalan bernama sama dianggarkan lagi setiap tahun, dan 41 pasangan itu persis pola tersebut.

**Jadwal.** Dari 146 paket, **122** sudah melewati akhir jadwal kontrak dan **24** belum (acuan
November 2026). Untuk 122 itu, "belum berjalan sesuai jadwal" bukan lagi penjelasan yang bertahan;
yang tersisa hanya keterlambatan, RUP tidak dieksekusi, atau eksekusi di luar SPSE dan Data INAPROC.
Tanpa bukti untuk salah satunya, label UI tetap **"belum ada rekam publik"** — bukan "batal".

## Cara menarik ulang

```bash
node scripts/realisasi.mjs --mode csv                     # 4 request/tahun, ±12 detik, seluruh satker D44
node scripts/realisasi.mjs --mode table --satker <kode>   # cadangan per satker, 20 baris/halaman
npm run rup:switch                                        # uji RUP switch + jadwal paket tanpa rekam
npm run build                                             # lalu cek /api/packages?kontrak=ADA
```

Angka acuan 11 November 2026: `?kontrak=ADA` **2.082** · `?kontrak=TANPA` **146** (register
**2.228** paket).
