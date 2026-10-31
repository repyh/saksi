# Inventaris ArcGIS Server — maps.tangerangkota.go.id

Enumerasi 31 Okt 2026. Semua angka di bawah **hasil query langsung**, bukan perkiraan.

## Ringkas server

| | |
|---|---|
| Versi | ArcGIS Server 10.71 |
| Folder | 53 (+4 layanan di root) |
| Layanan | **522** |
| Folder terkunci | **11** — `Aset`, `Bapenda`, `BPKD`, `DINSOS`, `KADASTER`, `PBB`, `Perizinan`, `Persil`, `SATPOLPP`, `SATUPETAKOTATANGERANG`, `Tools` → `{"code":499,"message":"Token Required"}` |
| Format query | `f=json` dan **`f=geojson`** keduanya jalan; `maxRecordCount` 1.000 (2.000 untuk `UTILITAS/jalan_tngkota`) |
| Cakupan | **Kota Tangerang saja** — 13 kecamatan, 104 kelurahan |

**Penting:** ini Kota Tangerang, bukan Kabupaten Tangerang (studi kasus SAKSI: 29 kecamatan, 274 desa).
Kabupaten tidak punya ArcGIS publik: `maps.tangerangkab.go.id` adalah **TileServer GL** (vector tile
OSM, bukan data resmi), dan `geoportal.tangerangkab.go.id` menutup koneksi (80/443 terbuka, TLS drop).

## Layer yang bisa dipakai

### Jalan

| Layanan | Geometri | Fitur | Kondisi data |
|---|---|---:|---|
| `Dinas_PU_TR/Jaringan_Jalan_Kota_Tangerang_2024/MapServer/0` | Polyline | **6.373** | Skema KUGI 44 kolom, tetapi **`nama_ruas` hanya terisi 32**; `klsrjl`/`starjl`/`konrjl` (kelas, status, kondisi) **kosong** dan query-nya bahkan gagal (HTTP 400). Praktis hanya geometri + `nomor_ruas`. |
| `UTILITAS/jalan_tngkota/FeatureServer/0` (Jalan Utama) | Polyline | **129** | Bersih: `nama` 129/129 (`JL. IMAM BONJOL`), `fungsi_jln` (Arteri/Kolektor Sekunder), `lebar_m`, `kec`, `kel`, `kabkot`. |
| `UTILITAS/jalan_tngkota/FeatureServer/1` (Jalan Lokal) | Polyline | **12.384** | `nama` terisi **8.105** (5.665 berawalan "Jalan"); `lebar_m` 0 dan `panjang` dalam satuan derajat (6e-05) → **fragmen digitasi**, bukan inventaris. |
| `DISPERKIM/jalan_lingkungan/FeatureServer/0` | Polyline | **310** | **Paling berharga**: `nama_jalan` 309/310, `rt`, `rw`, `kelurahan`, `kecamatan`, `tahun`, dan progres `prog_0/30/70/100_persen`. |
| `Kecamatan/pembangunan_jalan_lingkungan_benda/FeatureServer/0` | Polyline | **310** | Sama dengan di atas + `panjang`, `jenis`, `prog_0_pe`, `prog_100_p`. |
| `Dinas_PU_TR/Leger_Kota_Tangerang/MapServer` | campur | **179 layer** | CAD mentah (as-built): `jalan_polyline`, `JEMBATAN_point`, `Trotoar_*`, `saluran_*`, `PJU_*`, `perkerasan_*`, `Marka_jalan_*`. Perlu seleksi layer, jangan dimuat semua. |

### Jembatan

`Dinas_PU_TR/jembatan/FeatureServer/0` — **168 titik**, geometri Point, atribut: `nama`, `kategori`
(Jembatan Jalan Kota, Jembatan Nasional, Jembatan Provinsi, Fly Over, Over Pass, Under Pass),
`kondisi_je` (terisi **"Baik"** atau kosong), `nilai_kond`, `panjang_je`, `lebar_jemb`, `kecamatan`,
`kelurahan`, `program_pe`.

### Batas administrasi (resmi, bisa langsung dipakai)

| Layanan | Geometri | Fitur |
|---|---|---:|
| `Batas_Adminsitratif/Batas_Wilayah_Kecamatan_def/FeatureServer/0` | Polygon | 13 |
| `Batas_Adminsitratif/Batas_Wilayah_Kelurahan_def/FeatureServer/0` | Polygon | **104** |
| `Batas_Adminsitratif/batas_rw_2021/FeatureServer/0` | Polygon | **1.020** |
| `Batas_Adminsitratif/batas_rt_2021/FeatureServer/0` | Polygon | **5.167** |

Ketiganya `capabilities: Query` (read-only) dan mengembalikan **GeoJSON** — bisa langsung dipakai
sebagai pengganti GADM/`Batas_kelurahan_area`, dengan `wadmkc` (kecamatan), `wadmkd` (kelurahan),
`rt`, `rw` sebagai kunci join.

### Aduan warga (asli, bukan simulasi)

| Layanan | Fitur | Atribut |
|---|---:|---|
| `Dinas_PU_TR/Pengaduan_Drainase_Tidak_Menampung_Air_Hujan/FeatureServer/0` | **156** | `no`, `x`, `y`, `bulan` — **tanpa teks aduan, tanpa status** |
| `Dinas_PU_TR/Pengaduan_Permintaan_Peninggian_Jalan_Karena_Saluran_Drainase/FeatureServer/0` | **2** | sama |
| `Dinas_PU_TR/Pengaduan_Permintaan_Pengadaan_Saluran_Drainase/FeatureServer/0` | belum dihitung | — |

### Rusak / kosong

| Layanan | Hasil |
|---|---|
| `Dinas_PU_TR/Drainase/MapServer` | `layers: []` — tidak ada layer yang bisa di-query |
| `Estes/Estes/Jalan_Kotang` | `Invalid URL` |
| `Dinas_PU_TR/sipantau_pt` | 25 titik, hanya `name`/`snippet` (pointer aplikasi, bukan data) |

### Lain-lain yang relevan tema (belum dihitung)

`Kebencanaan/*` (`banjir_rt_rw`, `wilayah_terdampak_banjir`, `titik_lokasi_banjir`),
`DISHUB/*` (PJU, `Perlengkapan_Jalan`, `Titik_Penutupan_Jalan`),
`TRANSPORTASI/*` (halte, terminal, jalur BRT), `BAPPEDA/RencanaDrainase`.

## Kesimpulan untuk SAKSI

1. **Tidak bisa dipakai menempatkan paket SIRUP Kab. Tangerang** — cakupannya kota, dan layer jalannya
   pun tidak punya ruas bernama yang lengkap (32/6.373).
2. **Yang benar-benar menambah nilai kalau studi kasus pindah ke Kota Tangerang:** batas
   kelurahan/RW/RT resmi (104/1.020/5.167 poligon), 168 jembatan dengan kategori+kondisi,
   310 jalan lingkungan dengan progres, dan 156 aduan drainase asli. Semua bisa di-query sebagai
   GeoJSON tanpa token.
3. **Matching paket → ruas** yang dulu kita simpulkan mustahil: untuk Kota ada 8.105 segmen jalan
   lokal bernama + 129 jalan utama. Itu cukup sebagai gazetteer ruas, tetapi `nama_ruas` PU yang
   lengkap hanya 32 — jadi sumber nama terbaik justru layer UTILITAS, bukan layer PU 2024.
4. **Jangan diburu sekarang** (FDS 1 Nov): ganti studi kasus = tarik RUP Kota (kode `idKldi` belum
   ditemukan), gazetteer kelurahan baru, pipeline ulang, UI ulang. Simpan sebagai rencana v2 dan
   lampirkan inventaris ini sebagai bukti kelayakan.
