# RUP dari data.inaproc.id (pengganti sirup.inaproc.id)
> **Catatan historis (8 November 2026):** dokumen ini merekam perpindahan sumber 31 Oktober–3 November
> 2026. Kondisi aktif: **snapshot 5 November 2026** (rebuild 8 November 2026), **2.552 paket ·
> Rp813,13 M**, **344 paket tanpa lokus**, **2.208 (86,5%) berlokus**. Angka 1.557/402/312 di bawah
> adalah tahap proses, bukan kondisi terkini.
>
> Rebuild 8 November 2026 memperbaiki pengenalan prefiks ruas `Jl.`/`Jl` di `scripts/build-snapshot.mjs`,
> menarik detail RUP untuk seluruh 2.552 paket (`bulan` terisi 2.472 paket), lalu menangani varian
> lokasi: `RW O7` sebagai RW 7 dan sepuluh varian ejaan kelurahan lewat alias eksplisit. Hasilnya presisi
> RW 1.612 · kelurahan 517 · kecamatan 79 · tanpa lokus 344.
>
> **Status 5 November 2026:** sumber utama sudah **dipindah ke ekspor RUP `data.inaproc.id`**
> (`scripts/build-snapshot.mjs`) di branch `feat/data-pipeline`, karena ekspor ini juga memuat
> seluruh paket yang dulu diambil dari SIRUP.

Snapshot historis 3 November 2026. Skrip: `scripts/rup.mjs` (`npm run data:rup`, `npm run data:rup-detail`).

## Kenapa pindah

`sirup.inaproc.id` sekarang **login-gated**: halaman utamanya 301 ke `/sirup/loginctr/index`, dan
satu-satunya yang masih publik adalah datatable 8 kolom (kode, satker, nama, pagu, metode, sumber
dana, kode RUP, bulan) — tanpa penyedia, tanpa detail. Endpoint detail SIRUP (`/rup/detailrup`,
`/detailctr/rup`, …) semuanya 404.

`data.inaproc.id/rup` adalah dashboard publik untuk RUP yang sama, dengan **ekspor CSV resmi** dan
**endpoint detail**.

## Alur penarikan (tanpa login)

| Langkah | Request |
|---|---|
| 1. Tanda tangan | `POST /dashboard-api/export/signature` body `{"path":"/dashboard-api/rup/export","body":"<json filter>"}` → `{time,nonce,signature,headers:{x-auth-*}}` |
| 2. Buat job | `POST /dashboard-api/rup/export` + header `x-auth-*` → `{job_id, events_url, download_url}` |
| 3. Tunggu | `GET /dashboard-api/export/<job_id>/events` (`text/event-stream`) → `data: {"download_url": ...}` |
| 4. Unduh | `GET <download_url>` — URL GCS bertanda tangan, **kirim tanpa header API** |

Filter wajib: `tahun` + `jenis` (`"5"` = pemerintah daerah) + `instansi` (`D44`). Anti-bot:
`x-request-time` (epoch ms) + `x-secret` = base64(timestamp dibalik).

### Detail per paket

`GET /dashboard-api/rup/detail?kode=<kode_rup>&kind=Penyedia` → `{jenisPengadaan, kind, main, lokasi, sumberDana}`.

`main` memuat field yang **tidak ada di CSV**: `jadwal_pemilihan_penyedia_mulai/akhir`,
`jadwal_pelaksanaan_kontrak_mulai/akhir`, `pemanfaatan_barang_jasa_mulai/akhir`, `uraian_pekerjaan`,
`volume_pekerjaan`, `spesifikasi_pekerjaan`, `pra_dipa_dpa`, `aspek_lingkungan/sosial/ekonomi`.
`lokasi[]` memuat `detail_lokasi`, `kabupaten_kota`, `provinsi`; `sumberDana[]` memuat `mak` (kode
akun) dan `pagu` per sumber dana.

## Hasil ekspor daftar

`node scripts/rup.mjs` → `data/rup_kota_tangerang_2025_2026.json`:

- **28.699 RUP** (2025 **15.238** · 2026 **13.461**), total **Rp6.628,75 M** — kota-wide, semua OPD.
- Menurut cara: Penyedia 21.435 · Swakelola 7.264.
- Menurut jenis: Barang 11.227 · Jasa Lainnya 5.111 · **Pekerjaan Konstruksi 3.360** · Jasa
  Konsultansi 1.732 · Terintegrasi 5 · tanpa jenis 7.264 (swakelola).
- Menurut metode: Pengadaan Langsung 9.515 · E-Purchasing 9.506 · Dikecualikan 2.134 · Tender 116 ·
  Seleksi 89 · Penunjukan Langsung 75 · tanpa metode 7.264.
- **Cakupan snapshot produk: 1.556 dari 1.557** kode RUP ada di ekspor. Yang tidak ada:
  `63431304` (TA2026, "Belanja Bahan Material dan Belanja Cetak Pembangunan Penerangan Jalan Umum").

Perbandingan dengan tarikan SIRUP lama (21.402 baris): ekspor ini **7.297 baris lebih banyak** —
SIRUP sebelumnya terpotong, bukan karena RUP-nya baru.

## Yang berubah bila sumber ini dipakai

| | SIRUP (snapshot 31 Okt) | data.inaproc.id |
|---|---:|---:|
| Baris RUP D44 2025–2026 | 21.402 | **28.699** |
| Jadwal/bulan pemilihan | ada (kolom `bulan`) | **tidak ada di CSV**, harus lewat endpoint detail |
| Lokasi | tidak ada | **ada, kasar** (`detail_lokasi`) |
| Detail paket (volume, MAK, spesifikasi) | tidak ada | ada |

## Keputusan yang disarankan

1. **Pakai ekspor ini sebagai sumber mentah resmi** — satu perintah, tanpa login, dan superset dari
   SIRUP.
2. **Jangan ganti snapshot 1.557 paket sebelum penyisihan 11 Nov** hanya karena sumbernya berubah.
   Filter jalan yang dipakai sekarang (kata kunci + metode + pengecualian) menghasilkan 1.557;
   menerapkan filter yang sama pada 28.699 baris akan menghasilkan **angka baru** (kolamnya 34%
   lebih besar), dan semua dokumen/proposal harus dihitung ulang serta diverifikasi.
3. Kalau mau menaikkan cakupan, lakukan **setelah** penyisihan: rebuild `tools/build_kota.py` dengan
   sumber baru, bandingkan 1.557 vs hasil baru, lalu putuskan.
4. Detail per paket berguna untuk hal yang sekarang tidak ada: **jadwal pemilihan** (menggantikan
   kolom `bulan`) dan **petunjuk lokasi** untuk 402 paket tanpa anchor.

## Hasil penarikan detail (`npm run data:rup-detail`)

> Catatan: angka **402 paket tanpa anchor** di bawah adalah kondisi **sebelum** enrich. Setelah
> `npm run data:enrich` dijalankan (3 Nov 2026), paket tanpa lokus menjadi **312** dan 90 paket
> mendapat anchor kecamatan; lihat `docs/STATE.md` untuk angka final.

`data/rup_detail_kota_tangerang.json` — 1.557 paket, ±14 menit (1 request per paket, jeda 250 ms):

| | Jumlah |
|---|---:|
| Punya jadwal pemilihan | **1.556** (99,9%) |
| Punya `lokasi[]` terisi | **939** (60,3%) |

Kualitas `lokasi` dari 939 itu: **745 menyebut kecamatan** (319 berformat `Kecamatan X`, 426 `Kec. X`),
**6 kelurahan**, 158 hanya `Kota Tangerang`, 30 berisi nama satker (bukan tempat), sisanya lain-lain.
618 paket tidak punya lokasi sama sekali.

**Dampak ke 402 paket tanpa lokus:** 89 bisa diberi anchor kecamatan/kelurahan (88 kecamatan +
1 kelurahan), 175 kosong, 86 hanya "Kota Tangerang", 30 nama satker, 22 lain. Artinya anchor baru
realistis untuk **±22%** dari paket yang selama ini tampil sebagai `Kota Tangerang (umum)`.

**Validasi terhadap kecamatan yang sekarang dipakai:** dari paket yang sudah punya `kecamatan_resmi`
dan detailnya menyebut satu kecamatan, **211 cocok** dan **20 berbeda**. Yang berbeda umumnya paket
lintas kecamatan (detail menyebut tiga kecamatan sekaligus) atau tebakan dari nama paket yang salah —
contoh `56733954`: nama menyiratkan "Tangerang", detail menyebut **Kecamatan Neglasari**.

Konsekuensi: kalau detail dipakai untuk lokasi, ia **memperbaiki** sebagian tebakan dan
**menambah** anchor baru, tetapi jangan dipakai untuk menimpa `RW` yang sudah ada — `detail_lokasi`
tidak pernah menyebut RW.

## Perkayaan snapshot (`npm run data:enrich`)

`scripts/enrich-rup.mjs` membaca snapshot + detail lalu (1) mengisi `bulan` dari
`jadwal_pemilihan_mulai`, dan (2) memberi anchor kecamatan pada paket `Kabupaten` yang detailnya
menyebut **tepat satu** kecamatan. Tidak menimpa anchor RW/kelurahan, tidak mengubah jumlah paket.

Hasil pada snapshot produk (3 Nov 2026):

| | Sebelum | Sesudah |
|---|---:|---:|
| `bulan` terisi | 1.557 (campur Inggris/Indonesia) | **1.557, bahasa Indonesia konsisten** |
| Presisi RW | 818 | 818 |
| Presisi Kelurahan | 337 | 337 |
| Presisi **Kecamatan** | 0 | **90** |
| Tanpa lokus (`Kabupaten`) | 402 | **312** |

Sebaran 90 anchor baru: Periuk 16 · Pinang 14 · Tangerang 12 · Karawaci 11 · Cibodas 9 · Benda 8 ·
Cipondoh 7 · Neglasari 5 · Batuceper 4 · Ciledug 3 · Jatiuwung 1.

Catatan UI: presisi `Kecamatan` **tidak** menyorot poligon di peta (repo ini hanya memuat
`rw.geojson` dan `kel.geojson`); paket tampil dengan breadcrumb `Kec. X` dan tetap muncul di daftar
serta filter wilayah. Peta hanya menyorot untuk presisi RW/kelurahan.
