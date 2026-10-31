# Batas desa untuk peta (sumber, join, batasan)

Peta SAKSI mewarnai **batas desa**, bukan titik paket. Dokumen ini mencatat asal poligon itu dan
seberapa jauh ia boleh dipercaya.

## Sumber

| | |
|---|---|
| Berkas | GADM 4.1, level 4 (desa/kelurahan) |
| URL | `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IDN_4.json` |
| Ukuran asli | 53,4 MB (seluruh Indonesia, 77.473 fitur) |
| Subset dipakai | 274 fitur — `NAME_1 = Banten`, `NAME_2 = Tangerang` |
| Lisensi | GADM: bebas untuk penggunaan akademik/non-komersial, **wajib atribusi**, tidak boleh dijual ulang |
| Dibuat ulang oleh | `python3 tools/buat_batas_desa.py <berkas GADM>` |
| Keluaran | `web/public/data/desa-batas.geojson` — 136 KB |

Jumlah 274 desa dan 29 kecamatan **cocok persis** dengan gazetteer BPS yang dipakai pipeline
(`data/tangerang_desa_coords.json`), jadi GADM menjadi pasangan geometri yang wajar untuk data SIRUP.

## Join ke data paket

1. GADM tidak memuat kode BPS. Pencocokan dilakukan per **(kecamatan, nama desa)** yang dinormalisasi
   (huruf kecil, hanya a–z) — bukan per nama saja, karena 8 nama desa di Kab. Tangerang muncul di dua
   kecamatan (mis. `Sukamulya`, `Mekarsari`, `Caringin`).
2. 269 dari 274 desa cocok langsung; 5 nama ditulis berbeda oleh GADM dan dipetakan eksplisit di
   `OVERRIDE` (`tools/buat_batas_desa.py`): `Kelebet→Klebet`, `KampungMelayuTimur→Kmp Melayu Tim`,
   `KampungMelayuBarat→Kmp Melayu Brt`, `Bunisari→Bonisari`, `Salembaran→Salembaran Jaya`.
3. Hasil: 273 dari 274 poligon mendapat `id_desa` BPS; 1 poligon (`Salembaran`) tidak terpakai karena
   nama serupa. `id_desa` disimpan agar join berikutnya tidak lagi bergantung pada ejaan.

## Batasan yang harus dinyatakan di layar

- **GADM bukan batas resmi.** GADM menyatakan sendiri bahwa batasnya adalah perkiraan dan tidak
  menggantikan peta resmi pemerintah. Untuk lomba ini cukup, asal sumbernya ditulis; kalau nanti
  dipakai untuk keputusan nyata, ganti dengan **Batas Desa BIG (Ina-Geoportal)** atau SK Bupati.
- **Batas ≠ lokasi pekerjaan.** Warna desa hanya menyatakan "sekian paket disebut berada di desa ini".
  Lokasi pekerjaan di dalam desa tetap tidak diketahui, dan aplikasi tidak boleh menampilkan titik
  paket di dalam poligon.
- **Tahun batas ≠ tahun paket.** Poligon GADM 4.1 (rilis 2022) dengan paket TA 2025–2026; pemekaran
  desa setelah 2022 belum tercermin.
- **Dua angka desa berbeda arti.** 252 *wilayah* desa berpaket, 251 *nama* desa unik — karena nama
  `Jatimulya` dipakai di Kec. Sepatan Timur dan Kec. Kosambi. Kartu "Desa tersentuh 251" memakai
  hitungan nama; legenda peta memakai hitungan wilayah.

## Catatan teknis

- Koordinat dibulatkan ke 5 desimal (~1 m) dan titik berurutan kembar dibuang: 0,2 MB → 136 KB tanpa
  perubahan bentuk yang terlihat pada zoom 10–14.
- Peta memakai `L.geoJSON` dengan `preferCanvas: false` agar tiap desa punya elemen SVG sendiri
  (perlu untuk sorotan batas desa saat paket dipilih).
