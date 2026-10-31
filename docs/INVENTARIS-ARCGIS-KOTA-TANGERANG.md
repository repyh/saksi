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
| `Dinas_PU_TR/Jaringan_Jalan_Kota_Tangerang_2024/MapServer/0` | Polyline | **6.373** | **Semua punya nama**: `namobj` ("Nama Objek") terisi **6.373/6.373**, **5.751 nama unik**. Lihat tabel atribut di bawah. |
| `UTILITAS/jalan_tngkota/FeatureServer/0` (Jalan Utama) | Polyline | **129** | Bersih: `nama` 129/129 (`JL. IMAM BONJOL`), `fungsi_jln` (Arteri/Kolektor Sekunder), `lebar_m`, `kec`, `kel`, `kabkot`. |
| `UTILITAS/jalan_tngkota/FeatureServer/1` (Jalan Lokal) | Polyline | **12.384** | `nama` terisi **8.105** (5.665 berawalan "Jalan"); `lebar_m` 0 dan `panjang` dalam satuan derajat (6e-05) → **fragmen digitasi**, bukan inventaris. |
| `DISPERKIM/jalan_lingkungan/FeatureServer/0` | Polyline | **310** | **Paling berharga**: `nama_jalan` 309/310, `rt`, `rw`, `kelurahan`, `kecamatan`, `tahun`, dan progres `prog_0/30/70/100_persen`. |
| `Kecamatan/pembangunan_jalan_lingkungan_benda/FeatureServer/0` | Polyline | **310** | Sama dengan di atas + `panjang`, `jenis`, `prog_0_pe`, `prog_100_p`. |
| `Dinas_PU_TR/Leger_Kota_Tangerang/MapServer` | campur | **179 layer** | CAD mentah (as-built): `jalan_polyline`, `JEMBATAN_point`, `Trotoar_*`, `saluran_*`, `PJU_*`, `perkerasan_*`, `Marka_jalan_*`. Perlu seleksi layer, jangan dimuat semua. |

### Atribut `Jaringan_Jalan_Kota_Tangerang_2024` (diverifikasi per field, 6.373 baris)

| Field | Terisi | Isi |
|---|---:|---|
| `namobj` | **6.373** | Nama objek = nama jalan, mis. `Jl. Prabu Kiansantang`; **5.751 nama unik** |
| `fcode` | 6.373 | Kode KUGI, dominan `CA02080360` |
| `fgsrjl` | 6.373 | Fungsi jalan (kode): **4 = 5.559**, 3 = 603, 2 = 179, **1 = 32** |
| `jarrjl` | 6.373 | Jenis jaringan jalan, semua bernilai `2` |
| `nomor_ruas` | 6.373 | Nomor ruas; **6.118 unik** (satu ruas bisa beberapa segmen) |
| `lebar` | 6.373 | Lebar (m), rata-rata **3,49 m** (banyak jalan lingkungan sempit); hanya 18 bernilai 0 |
| `panjang` | 6.373 | Panjang (m); total **1.374,6 km** |
| `wadmkc` / `wadmkd` | 6.373 | Kecamatan/kelurahan yang dilalui, dipisah koma |
| `wlyrjl` | 6.341 | Wilayah jalan |
| `nama_ruas` | 32 | Hanya arteri — duplikat dari `namobj`; **bukan** indikator kelengkapan nama |
| `klsrjl`, `starjl`, `konrjl`, `matrjl`, `jparjl`, `lbrjln`, `lbrbhj`, `tgl_sk`, `remark`, `jlnlyg` | **0** | Kelas, status, kondisi, material, lebar badan, tanggal SK — kosong semua |

Cakupan: **13 kecamatan Kota Tangerang** (Karawaci 1.129 segmen, Cipondoh 809, Karang Tengah 667,
Cibodas 601, Ciledug 554, Tangerang 534, Pinang 470, Larangan 457, Jatiuwung 329, Periuk 297,
Neglasari 284, Batuceper 187, Benda 95). Extent WGS84: **106,5514–106,7482 BT / -6,2550 – -6,0974 LS**.
Tidak ada satu pun segmen di Kabupaten Tangerang.

Domain kode (dari metadata layer):

| Field | Domain | Terisi |
|---|---|---|
| `fgsrjl` (Fungsi Jalan) | 1 Arteri · 2 Kolektor · 3 Lokal · 4 Lingkungan · 999 Lainnya | ya — 4: 5.559, 3: 603, 2: 179, 1: 32 |
| `jarrjl` (Sistem Jaringan Jalan) | 1 Primer · 2 Sekunder · 999 Lainnya | ya — semua `2` (Sekunder) |
| `wlyrjl` (Wilayah Pelayanan) | 1 Perkotaan · 2 Pedesaan | 6.341 baris |
| `konrjl` (Kondisi Fisik) | 1 Baik · 2 Sedang · 3 Rusak Ringan · 4 Rusak Berat · 5 Mantap · 6 Tidak Mantap · 7 Kritis | **0** |
| `starjl` (Status Pembangunan) | 1 Operasional · 2 Akan Dibangun · 3 Sedang Dibangun · 4 Tidak Dipergunakan | **0** |
| `klsrjl` (Kelas Jalan) | I · II · III · IIIA · IIIB · IIIC · Lainnya | **0** |

Artinya: domain untuk **kondisi** sudah disiapkan PU, datanya belum diisi. Itu bukan alasan
menganggap layer ini setara penilaian kondisi — jangan diklaim sebagai data kondisi di dokumen.

Nama tidak unik: **436 nama dipakai lebih dari satu segmen** (`Jl. Melati` 10, `Jl. Mawar` 10,
`Jl. Anggrek` 9, `Gg. Masjid` 8). Untuk pencocokan paket → ruas, kunci harus **(nama, kecamatan)**
atau **(nama, kelurahan)** dari `wadmkc`/`wadmkd`, bukan nama saja.

> Catatan: `IS NOT NULL AND <> ''` gagal (HTTP 400) pada field numerik seperti `lebar`, `panjang`,
> `fgsrjl` — itu keterbatasan tipe, bukan tanda data kosong. Hitungan di atas memakai
> `IS NOT NULL` + pembacaan nilai sebenarnya.

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

1. **Tidak bisa dipakai menempatkan paket SIRUP Kab. Tangerang** — cakupannya murni 13 kecamatan Kota
   Tangerang; tidak ada satu pun segmen di Kabupaten.
2. **Yang menambah nilai kalau studi kasus pindah ke Kota Tangerang:** jaringan jalan **6.373 segmen
   bernama lengkap** (5.751 nama unik, 1.374,6 km, lebar rata-rata 3,49 m, fungsi jalan berkode),
   batas kelurahan/RW/RT resmi (104/1.020/5.167 poligon), 168 jembatan dengan kategori+kondisi,
   310 jalan lingkungan dengan progres 0/30/70/100%, dan 156 aduan drainase asli. Semua query-able
   sebagai GeoJSON tanpa token.
3. **Matching paket → ruas** yang dulu kita simpulkan mustahil kini **layak dicoba untuk Kota**:
   `namobj` PU 2024 (5.751 nama) + 129 jalan utama + 8.105 jalan lokal bernama = gazetteer ruas yang
   cukup. Yang tidak ada hanyalah atribut kondisi/kelas/status — jadi matching bisa menghasilkan
   **geometri ruas**, bukan penilaian kondisi.
4. **Jangan diburu sekarang** (FDS 1 Nov): ganti studi kasus = tarik RUP Kota (kode `idKldi` belum
   ditemukan), gazetteer kelurahan baru, pipeline ulang, UI ulang. Simpan sebagai rencana v2 dan
   lampirkan inventaris ini sebagai bukti kelayakan.
