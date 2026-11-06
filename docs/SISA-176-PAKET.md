# Sisa paket tanpa penyedia — sebab dan sisa pekerjaan

> **Catatan 5 November 2026:** setelah sumber RUP pindah ke `data.inaproc.id`, populasi menjadi
> **1.634 paket** dan paket tanpa rekam penyedia **208 paket (Rp130,67 M, 19,1% pagu)**. Angka 176/133
> di bawah adalah riwayat proses penarikan data, bukan kondisi terkini.

Snapshot 3 November 2026. Setelah LPSE (731 paket) dan **ekspor Data INAPROC realisasi untuk seluruh
satker `D44`** (693 paket tambahan), **1.426 dari 1.634** paket jalan punya nama penyedia.
Sisa **208 paket · Rp130,67 M** (19,1% pagu).

> Riwayat angka: 176 paket (LPSE + PUPR saja) → 140 (lima satker) → **133** (ekspor CSV seluruh
> satker). Dua lompatan terakhir menutup 43 paket; sisanya bukan lagi soal satker yang belum
> ditarik.

Dokumen ini mencatat **kenapa** sisanya kosong dan **apa** langkah berikutnya — supaya angka ini
tidak ditebak ulang di sesi lain.

## Sebab, dengan bukti

Cakupan kini **seluruh instansi** (51.051 baris CSV: 37.799 TA2025 + 13.252 TA2026), jadi kategori
"satker belum ditarik" sudah tidak berlaku.

| Sebab | Paket | Bukti |
|---|---:|---|
| **Tidak ada transaksi tercatat** — PUPR | **111** | kode RUP-nya **nol baris** di ekspor lengkap |
| **Tidak ada transaksi tercatat** — Dishub | **22** | idem; 31 paket Dishub lain tertutup setelah satker ditarik |
| **Tender yang tidak ada di daftar lelang SPSE** | 16 | kemiripan nama tertinggi dengan 192 baris lelang hanya **0,38** |
| **Dikecualikan** (di luar prosedur pengadaan) | 15 | tidak muncul di LPSE maupun realisasi |

Menurut metode: **e-purchasing 70 · pengadaan langsung 32 · tender 16 · dikecualikan 15**.
Menurut tahun: **2025 = 77 · 2026 = 56**.

Bukan karena kolom penyedia kosong: dari 50.530 baris realisasi, semua punya `kode_rup`, dan hanya
11 baris berpenyedia `-` — **tidak satu pun** milik paket kita.

## Kenapa paket ini bisa tidak punya transaksi

1. **Belum berjalan.** Paket TA2026 berjadwal Agustus–November 2026 belum tentu sudah bertransaksi;
   data INAPROC tersinkron 2 Nov 2026.
2. **RUP tidak dieksekusi / diganti.** Paket TA2025 yang tidak pernah bertransaksi biasanya
   dibatalkan, digeser ke tahun berikutnya, atau dieksekusi dengan kode RUP lain ("RUP switch").
3. **Di luar SPSE dan INAPROC sekaligus.** 15 paket `Dikecualikan` memang tidak lewat prosedur
   pengadaan, jadi tidak akan pernah muncul di kedua sumber.
4. **Tender tidak terdaftar** di LPSE Kota Tangerang — 16 paket, kemungkinan ditenderkan lewat
   mekanisme/instansi lain atau dibatalkan.

## Sisa pekerjaan

1. **Uji RUP switch** untuk 111 paket PUPR: cocokkan nama + pagu ke seluruh 50.530 baris; kalau ada
   pasangan dengan pagu sama dan nama mirip tetapi `kode_rup` berbeda, paket itu dieksekusi dengan
   RUP lain. Ini satu-satunya cara menaikkan angka tanpa data baru.
2. **Biarkan kosong** paket berjadwal Agustus–November 2026 dan paket `Dikecualikan`; UI sudah
   menyebutkan "belum ada rekam publik".
3. **Jangan kejar SIKaP/e-katalog** untuk sisa ini: `sikap.inaproc.id` (`Disallow: /`) dan
   `katalog.inaproc.id` (`Disallow: /api/`) bukan target pengambilan data.

## Cara menarik ulang

```bash
node scripts/realisasi.mjs --mode csv                     # 4 request/tahun, ±12 detik, seluruh satker D44
node scripts/realisasi.mjs --mode table --satker <kode>   # cadangan per satker, 20 baris/halaman
npm run build                                             # lalu cek /api/packages?kontrak=ADA
```

Angka acuan setelah penarikan: `?kontrak=ADA` **1.426** · `?kontrak=TANPA` **208** · penyedia unik
**522**.
