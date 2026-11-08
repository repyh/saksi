# Region

Satu direktori per kabupaten/kota. Semua yang khas daerah berada di sini; `scripts/build-snapshot.mjs`
hanya berisi logika penyaringan dan pemetaan lokasi.

```
data/regions/<id>/
  region.json   identitas, path sumber, properti GeoJSON, token lokasi
  aliases.json  varian ejaan kelurahan yang sudah diverifikasi
```

`<id>` hanya boleh huruf kecil, angka, dan tanda hubung. Tambahkan region baru dengan menyalin pola
ini, lalu jalankan:

```bash
node scripts/build-snapshot.mjs --region <id>
node scripts/rup.mjs --region <id>            # daftar RUP
node scripts/rup.mjs --detail --region <id>   # detail RUP
node scripts/realisasi.mjs --region <id>      # realisasi
node scripts/lpse.mjs match --region <id>     # cocokkan LPSE ke snapshot
```

Tanpa `--region`, semua skrip memakai `kota-tangerang` agar perintah `npm run ...` yang sudah ada
tetap sama.

## region.json

| Field | Isi |
|---|---|
| `id`, `label` | Identitas region; `label` dipakai di log |
| `instansi` | Kode instansi INAPROC (mis. `D44`); dipakai pipeline penarikan |
| `tahun` | Tahun anggaran yang dicakup |
| `metadata.snapshot`, `metadata.sumber` | Ditulis apa adanya ke snapshot |
| `sumber.rup`, `sumber.detail`, `sumber.realisasi` | Berkas RUP, detail RUP, dan realisasi |
| `keluaran` | Berkas snapshot yang ditulis |
| `realisasi.satker_pu` | Satker cadangan untuk mode tabel tanpa `--satker` (opsional) |
| `lpse.base`, `lpse.direktori`, `lpse.keluaran` | Host SPSE, direktori kerja, dan berkas hasil pencocokan |
| `batas.kelurahan` | `berkas`, `nama` (properti nama), `kecamatan` (properti kecamatan) |
| `batas.lingkungan` | **Opsional**. Sama seperti kelurahan, plus `nomor` (properti nomor RW/dusun) dan `label` |
| `lokasi.token_lingkungan` | Token nomor lingkungan yang dikenali, mis. `["RW"]` |
| `lokasi.penanda_kelurahan` | Penanda kelurahan, mis. `["kel", "kelurahan"]` |

Properti GeoJSON **tidak boleh** diasumsikan sama antar daerah; selalu isi lewat `batas.*`. Build gagal
bila properti kelurahan tidak menghasilkan satu pun kelurahan. Bila `batas.lingkungan` diisi, properti
lingkungan juga wajib menghasilkan minimal satu unit; bila blok itu dihilangkan, snapshot tetap dibangun
dengan presisi tertinggi **kelurahan** dan `rw` selalu `null`.

## aliases.json

```json
{
  "level": "kelurahan",
  "aliases": [{ "dari": "Nusajaya", "ke": "Nusa Jaya" }]
}
```

Aturan yang divalidasi saat build:

1. `ke` harus menunjuk tepat satu kelurahan resmi di `batas.kelurahan.berkas`.
2. `dari` tidak boleh sama dengan nama kelurahan resmi (kalau sama, itu bukan alias).
3. `dari` tidak boleh ditulis dua kali.
4. Dua alias tidak boleh menunjuk kelurahan yang sama.

Tidak ada pencocokan fuzzy. Alias adalah data kurasi yang harus punya bukti 1:1. Skema saat ini
memakai nama (`ke`) karena batas Kota Tangerang belum memuat kode kelurahan; bila region lain
menyediakan kode wilayah, perluas skema agar target memakai kode supaya nama kembar antar kabupaten
tidak saling bertabrakan.

## Region berikutnya

Sebelum menambah region, pastikan sumber RUP, detail, dan batas wilayahnya tersedia. Wilayah yang
tidak punya poligon RW/dusun cukup memakai batas kelurahan; jangan memaksa presisi yang tidak didukung
data. Model tingkat lokasi yang lebih umum (dusun/banjar/RT) belum diimplementasikan.
