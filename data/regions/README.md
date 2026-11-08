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
```

Tanpa `--region`, skrip memakai `kota-tangerang` agar `npm run data:snapshot` tetap sama.

## region.json

| Field | Isi |
|---|---|
| `id`, `label` | Identitas region; `label` dipakai di log |
| `instansi` | Kode instansi INAPROC (mis. `D44`); dipakai pipeline penarikan |
| `tahun` | Tahun anggaran yang dicakup |
| `metadata.snapshot`, `metadata.sumber` | Ditulis apa adanya ke snapshot |
| `sumber.rup`, `sumber.detail` | Berkas RUP dan detail RUP |
| `keluaran` | Berkas snapshot yang ditulis |
| `batas.kelurahan` | `berkas`, `nama` (properti nama), `kecamatan` (properti kecamatan) |
| `batas.lingkungan` | Sama seperti kelurahan, plus `nomor` (properti nomor RW/dusun) dan `label` |
| `lokasi.token_lingkungan` | Token nomor lingkungan yang dikenali, mis. `["RW"]` |
| `lokasi.penanda_kelurahan` | Penanda kelurahan, mis. `["kel", "kelurahan"]` |

Properti GeoJSON **tidak boleh** diasumsikan sama antar daerah; selalu isi lewat `batas.*`. Build gagal
bila properti yang dikonfigurasi tidak menghasilkan satu pun kelurahan atau unit lingkungan.

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
