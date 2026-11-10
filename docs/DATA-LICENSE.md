# Lisensi Data — Jaringan Jalan Overture

Layer jalan SAKSI memakai **Overture Maps transportation segment** (`type=segment`,
`subtype=road`). Data Overture diturunkan dari OpenStreetMap dan sumber lain; lisensi yang
dipakai untuk layer ini adalah **Open Database License (ODbL) 1.0**.

## Atribusi wajib

Setiap tampilan peta dan turunan database harus memuat atribusi:

> © OpenStreetMap contributors, Overture Maps Foundation (ODbL)

Atribusi tersebut ditampilkan di kontrol legenda peta pekerjaan, peta laporan, halaman detail
laporan publik, serta metadata `data/regions/<id>/jalan.geojson` dan
`data/regions/<id>/jalan-tiles/metadata.json` (`source.attribution`, `source.license`). Jangan
menghapus atribusi saat memuat ulang snapshot atau membangun ulang tiles.

## Rilis dan provenance

- Rilis dipin di `data/regions/kota-tangerang/region.json` (`jalan.release`). Rilis yang dipakai
  saat snapshot terakhir adalah **2026-10-21.0**.
- Manifest region mencatat jumlah segmen, jumlah bernama, jumlah tanpa nama, rilis, lisensi, dan
  checksum berkas layer.
- `road_segments.source_release` dan `road_segments.license` menyimpan provenance per baris.
- Overture boleh berubah antar rilis; jangan menganggap nama, kelas, atau lebar sebagai data resmi
  Pemerintah Kota Tangerang.

## Kewajiban ODbL

Karena `data/regions/<id>/jalan.geojson`, tile MVT, dan tabel `road_segments` adalah database
turunan Overture:

1. Pertahankan atribusi dan notice lisensi pada distribusi.
2. Jika database turunan didistribusikan publik, sediakan database tersebut (atau cara
   mendapatkannya) di bawah ODbL; jangan menambahkan pembatasan teknis yang menghalangi hak ODbL.
3. Jangan mengklaim kepemilikan eksklusif atas isi data Overture/OSM.
4. Dokumentasikan perubahan yang dilakukan (filter kelas, clip batas kota, simplifikasi,
   pembulatan koordinat, dan pemetaan properti).

## Batas yang tidak berubah

- Geometri batas administrasi (`public/data/{rw,kel,kec}.geojson`) berasal dari layanan ArcGIS
  Pemerintah Kota Tangerang dan **bukan** bagian dari layer jalan Overture.
- Layer jalan bukan sumber lokasi paket dan tidak boleh dipakai untuk menyimpulkan bahwa suatu
  paket pekerjaan berada di titik tertentu.
- Foto dan laporan warga tidak termasuk data Overture dan tidak boleh diproyeksikan sebagai data
  terbuka tanpa keputusan retensi/privacy terpisah.
