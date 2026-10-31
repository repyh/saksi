# STATE.md — Lomba Web In Action (MIA 2026)

**Status per 29 Oktober 2026 (disinkronkan dari `KONTEKS-LENGKAP.md` + `KONTEKS-UPDATE-2026-10-29.md` + verifikasi ulang dataset).**

## Konsep

| | |
|---|---|
| Codename | **SAKSI** — *Sistem Akuntabilitas & Komparasi Spasial Infrastruktur* |
| Tema / Subtema | *Designing Digital Futures – Powering Public Transparency* / **Civic Reporting & Accountability** |
| Klaim tunggal | Lapisan penghubung spasial: 5.013 paket fisik (SIRUP/LPSE) + klaim kemantapan IRI Bina Marga ↔ bukti foto warga di titik yang sama |
| Status | **Dikunci** (28–29 Okt 2026). Menggantikan SOROT (ditolak) dan RUAS (dihentikan sebagai kanal aduan) |
| Diferensiasi | SP4N-LAPOR!, JAKI, Jalan Kita 2.0 sudah punya foto before-after + rating warga, tetapi **buta anggaran**; ICW OpenTender & KPK JAGA punya anggaran tetapi tanpa peta desa/ruas dan tanpa laporan fisik warga. Prior art: Sumbong sa Pangulo (PH), BudgIT Tracka (NG) |

## Tenggat

| Tahap | Tanggal | Sisa dari 29 Okt |
|---|---|---|
| **FDS** (repo publik + README, PDF ≤10 hlm, sitemap, mockup, **screenshot ≥2 halaman hidup: landing + 1 fitur**) | **1 Nov 2026** | **3 hari** |
| Final submission penyisihan (proposal ≤30 hlm, surat orisinalitas, video pitch ≤5 mnt) | 11 Nov 2026 | 13 hari |
| Final onsite + pitching (deck ≤15 hlm) | 28 Nov 2026 | 30 hari |

## Dataset terverifikasi di `data/` (dicek ulang 29 Okt 2026)

| Berkas | Isi | Status verifikasi |
|---|---|---|
| `saksi_bandung_2025_2026.json` (3,2 MB) | 5.013 paket fisik Kab. Bandung (SIRUP `idKldi=D107`, TA 2025: 2.566 + TA 2026: 2.447) + koordinat hasil geocoding | **Cocok dengan dokumen**: 2.838/922/832/298/123 paket; Rp693,07/100,41/133,73/39,81/26,93 M; total **Rp993,95 M**; terpetakan **4.329 (86,4%)**; `geocoding_stats`: tier_desa 3.957, tier_kecamatan 372, tier_kabupaten 684 |
| `bandung_desa_coords.json` (48 KB) | 280 Desa/Kelurahan, **31 Kecamatan** unik, koordinat BPS `3204` | Terverifikasi |
| `jalan.json` / `provinsi.json` | 477.032 titik IRI nasional S1 2026, 33 provinsi | Terverifikasi (dari fase RUAS) |
| `vendor_jakarta.json` | Sampel paket LPSE/SPSE (pagu, HPS, pemenang) | 72/72 halaman terbaca, pemenang 61/72 |

### Cacat data yang harus dibereskan sebelum coding peta
1. **684 baris fallback "Kabupaten" menyimpan `lat`/`lon` sebagai string** (`"-7.0252"`, `"107.5198"`) dan semuanya satu titik sentroid kabupaten → jangan dipetakan; ubah ke `null` (atau buang dari payload web) agar tipe TS bersih.
2. **Tidak ada geometri `LineString` di dataset.** Dokumen menjanjikan 222 paket koridor, JSON hanya menyimpan `geocoding_stats.jalan_koridor = 391` tanpa field geometri. Layer garis koridor (FR-01) belum punya bahan — perlu file geojson terpisah atau routing OSRM ulang.
3. **Offset hash ±250 m belum diterapkan**: 3.956 dari 3.957 baris tier-2 memakai koordinat sentroid desa persis → marker menumpuk. Offset harus dihitung di klien (deterministik dari `kode_rup`).
4. Angka koridor tidak konsisten antar dokumen (**222** di SPEC/KONSEP vs **391** di JSON) — pilih satu dan hitung ulang sebelum masuk FDS.

## Kondisi kode (kesenjangan utama)

- `web/` masih **prototipe RUAS v1**: 3 rute (`#/` beranda IRI, `#/lapor`, `#/laporan`) ≈725 baris; `web/src/data.ts` hanya mengimpor `jalan.json` + `vendor_jakarta.json`.
- **Belum ada satu pun layar SAKSI**: peta audit spasial, jelajah desa/paket, form lapor dengan blur+kalibrasi cm², kartu triangulasi, verifikasi dua kunci, rapor kecamatan.
- `data/saksi_bandung_2025_2026.json` dan `bandung_desa_coords.json` **belum tersambung** ke frontend.
- `data/manifest.json` masih menyebut produk **SOROT** (versi 20261021) → akan menyesatkan juri saat repo dibuka.
- Git: `KONSEP.md`, `SPEC.md`, `KONTEKS-*.md`, kedua dataset SAKSI **belum di-commit** (untracked); HEAD masih commit RUAS. Repo publik untuk FDS belum layak.

## Bimbingan dosen 28 Okt 2026 (transkrip + evaluasi)

Transkrip: `docs/transkrip-dosen-2026-10-28.txt` (9 mnt 34 dtk, mulai di tengah percakapan) ·
Evaluasi: `docs/EVALUASI-BIMBINGAN-2026-10-28.md`.
Delapan permintaan: cakupan satu wilayah (Tangerang sebagai contoh), integrasi ≠ inovasi, AI harus
kelihatan, klasifikasi penyebab kerusakan, rekam jejak vendor yang berimbang, layer/overlay dinamis +
klik→tabel, 2D saja + OSM (Google Maps berbayar), pipeline diagram + repo GitHub di-invite ke
`DHREFA1@gmail.com`.

Tiga celah konsep vs arahan: (A) "AI-nya di mana" belum terjawab di permukaan produk; (B) penyebab
kerusakan tidak ada di SPEC sama sekali; (C) rekam jejak vendor diminta 2× lalu dihapus dari konsep
(benturan defamasi vs relevansi).

**Keputusan user 29 Okt:** vendor **pakai nama asli** dengan penyajian berimbang (tanpa skor
gabungan, selalu dengan penyebut jumlah paket/kelas jalan/tahun, frasa "paket dengan laporan
kerusakan dalam masa pemeliharaan") · AI yang ditonjolkan **condong LLM**, detail ditunda ·
**FDS mendemokan dua fitur** (peta audit FR-01 + alur lapor FR-03), bukan satu.

**Uji Tangerang (29 Okt, rev. 2 — `docs/MEMO-TANGERANG-2026-10-29.md`):** premis "Tangerang tidak
punya lokasi mikro" **dan** "tidak ada koridor" dua-duanya **gugur**. Kab. Tangerang: 51.322 RUP,
6.535 paket fisik, **80,4%** nama memuat desa (Bandung 76,2%), **157 paket koridor** vs Bandung 96,
**1.320 paket lintas kecamatan** vs 461, perkiraan 7.397 paket fisik ≈ Rp2,23 T. Keunggulan Bandung
tinggal: nama sekolah 15,6% vs 6,7% dan rate koridor 3,9% vs 2,4%. Alasan jujur bertahan di Bandung
untuk FDS = **jadwal** (pipeline + angka sudah jadi), bukan data. Tangerang masuk proposal 11 Nov
sebagai bukti replikasi (pindah penuh = 1–2 hari karena tarikan + gazetteer 274 desa sudah ada).

Endpoint yang terbukti (tanpa login): `dataruppenyediakldi?idKldi=D..&tahun=..` untuk tarikan penuh;
`caripaketctr/search` untuk kolom lokasi/jenis, tetapi parameter `kldi`/`idsLokasi` **tidak**
menyaring. Skrip: `ingest/sirup_search.py`.

**Uji NLP lokasi (29 Okt, `docs/UJI-NLP-LOKASI-2026-10-29.md`):** NLP **tidak layak** untuk ekstraksi
lokasi — plafonnya +1,5 poin keterpetaan, dan yang gagal bukan bahasa. Hasil: fuzzy tanpa LLM 0/100,
LLM+gazetteer 0/38 baris, LLM+OSM 4/23 token (2–3 realistis, 1 salah). Kontrol: regex menemukan nama
tempat di 12 dari 40 baris vs LLM 15 (tambahan LLM = sampah `RT. 001`). 60% sisa paket memang tak
punya penanda tempat (`Pengadaan Mebel`, `Normalisasi Sungai Wilayah 2`). OSM hamlet Kab. Bandung
hanya 190 nama. → Paket tanpa lokus jangan dipaksa ke peta; LLM dipakai untuk sebab kerusakan,
deteksi koridor (365 kandidat Bandung / 1.163 Tangerang), dan narasi kartu.

## DATASET: pindah ke Kab. Tangerang (keputusan user 29 Okt)

Keputusan: **FDS memakai data Kab. Tangerang, pipeline tetap yang sekarang** (tanpa NLP, tanpa LLM
di pipeline lokasi — lihat hasil uji). Bandung disimpan sebagai pembanding/replikasi.

Dibangun 29 Okt dengan `ingest/build_saksi.py` + `ingest/geocode_desa.py`:

| Item | Nilai |
|---|---|
| RUP Kab. Tangerang 2025+2026 (`idKldi=D50`) | **51.322** |
| Paket pekerjaan fisik (5 sektor) | **5.487** |
| Total pagu fisik | **Rp1.709,17 M** |
| Sektor | Jalan/Jembatan/Drainase 3.602 (Rp848,60 M) · Fasilitas Publik Lainnya 878 (Rp512,23 M) · Pendidikan 460 (Rp266,70 M) · Permukiman/Air/Sanitasi 440 (Rp55,87 M) · PJU/Perhubungan 107 (Rp25,78 M) |
| Presisi peta | desa/kelurahan **4.272** · koridor **110** · kecamatan 635 · tanpa lokus 470 |
| Terpetakan | **5.017 (91,4%)** |
| Satker | 62 · desa terpakai 257 dari 274 |
| Berkas | `data/saksi_tangerang_2025_2026.json` (2,9 MB) · `data/tangerang_desa_coords.json` |

Catatan teknis yang sudah diperbaiki di builder (jangan diulang): `norm()` lama memotong awalan
"kel" sehingga "Kelapa Dua" jadi "apa dua"; koridor harus butuh penanda `" - "` ber-spasi atau
`menuju`, bukan sembarang tanda hubung ("Tangerang- Banten"); nama desa = nama kecamatan hanya
diterima lewat penanda `Ds./Desa/Kel.`; kecamatan hanya dipakai bila tak ada desa.

**Sisa pekerjaan untuk FDS:** ✅ dokumen `KONSEP.md`, `SPEC.md`, `README.md` sudah ditulis ulang
29 Okt (v2, angka Tangerang). Berikutnya: dua layar hidup — peta audit + alur lapor — disambungkan
ke `data/saksi_tangerang_2025_2026.json`.

## FOKUS SEKTOR: jalan saja (rekaman pra-28 Okt, ditemukan 29 Okt)

Transkrip baru `docs/transkrip-dosen-pra-2026-10-28.txt` memuat arahan yang sebelumnya tidak terekam:
*"Infrastruktur yang mana? Kan banyak infrastruktur. **Harus spesifik** … nggak mampu kamu. **Satu,
satu aja**"* `[05:21-05:33]`, *"**Jalan. Itu berarti kembangkan fitur-fitur di dalam**"* `[06:24]`,
*"**Jangan bercabang**"* `[08:06]`.

**Keputusan arah:** UI, narasi, dan demo FDS = **jalan/jembatan/drainase** (3.602 paket · Rp848,60 M ·
92,5% terpetakan · 102 koridor · 251 desa). Dataset 5 sektor tetap disimpan sebagai arsip/roadmap,
**tidak** ditampilkan sebagai filter di demo.

**Eksekusi 29 Okt:** ✅ `KONSEP.md`, `SPEC.md`, `README.md` sudah **v3 jalan-only** (angka 3.602 /
Rp848,60 M / 92,5% / 3.331 terpetakan), `data/manifest.json` dapat blok `jalan`.

Keputusan yang dicatat di SPEC §2.4 agar tidak diuji ulang: tanpa NLP di ekstraksi lokasi; **tanpa CV
pengukuran kerusakan** (ditolak user + dosen: menambah metrik tanpa menambah urgensi, CV tidak
mencakup semua jenis kerusakan) — diganti kategorisasi pelapor (jenis, penyebab, ukuran kasar);
tanpa titik paksa untuk 271 paket tanpa lokus.

Permintaan dosen dari rekaman pra-28 Okt yang **belum** masuk: (a) penekanan dampak & siapa pengguna
(sudah masuk KONSEP §5); (b) rumusan "sistem yang tidak bisa di-deny / di-ignore" (masuk KONSEP §5);
(c) CV dari Vilo — **dibatalkan user**, jangan diusulkan lagi; (d) media sosial sebagai sumber (roadmap).

**Sisa pekerjaan:** dua layar hidup — peta audit jalan + alur lapor.

## KEPUTUSAN 31 Okt: peta tidak memplot paket (anti-misleading)

Masalah yang ditemukan user pada prototipe: 3.331 titik hasil offset hash ±250 m tampil seolah berada
di ruas jalan tertentu (contoh nyata: titik tersebar di atas lapangan golf dan blok perumahan),
padahal pipeline tidak mungkin mengetahui ruas dari nama paket. Itu klaim presisi palsu.

**Keputusan:** peta menampilkan **agregat per desa** (satu lingkaran per desa, radius ∝ jumlah paket)
dan **busur koridor indikatif** antar pusat desa; paket terpilih ditandai **cincin radius 1,5 km**
berlabel "lokasi indikatif". Tidak ada marker per paket, tidak ada jitter. Banner tetap di atas peta:
*"Tidak ada paket yang punya koordinat resmi. Peta menunjukkan desa, bukan lokasi pekerjaan."*
Badge berubah: `Titik Desa` → `Pusat Desa`, `Garis Koridor` → `Koridor Indikatif`.

Alasan tambahan: `presisi_peta` adalah **provenans** (dari mana lokasi diturunkan), bukan akurasi —
dokumen sebelumnya memakai kata "presisi" sehingga terbaca sebagai tingkat ketelitian.

**Revisi keputusan (larut 31 Okt):** agregat lingkaran diganti **koroplet batas desa**. User benar
bahwa poligon resmi lebih jujur dan lebih kuat daripada bubble. Sumber: **GADM 4.1 level 4**, subset
Kab. Tangerang = **274 desa / 29 kecamatan** (cocok persis dengan gazetteer BPS), disederhanakan jadi
**136 KB** (`web/public/data/desa-batas.geojson`, dibuat ulang oleh `tools/buat_batas_desa.py`).
274/274 poligon kini punya `id_desa` BPS; 5 nama GADM dipetakan eksplisit (`Kelebet→Klebet`,
`KampungMelayuTimur/Barat`, `Bunisari→Bonisari`, `Salembaran→Salembaran Jaya`). Batasan GADM (bukan
batas resmi, rilis 2022) dicatat di `docs/DATA-BATAS-DESA.md`. Catatan angka: **252 wilayah** desa
berpaket vs **251 nama unik** (`Jatimulya` ada di Sepatan Timur dan Kosambi) — kartu KPI memakai nama,
legenda peta memakai wilayah.

Sudah diterapkan di `web/src/components/Peta.tsx` (koroplet 6 kelas + sorot batas desa saat paket
dipilih), `AGENTS.md` (aturan 5 & 8), `BRIEF.md` (Layar 1), `SPEC.md` (FR-01, layar, aturan tampilan),
`KONSEP.md`, `README.md`. Diverifikasi: `typecheck` 0 error, `vite build` 441 kB, screenshot Chromium
menunjukkan koroplet tanpa titik paket.

## 31 Okt: inventaris ArcGIS Kota Tangerang (bukan Kabupaten)

`maps.tangerangkota.go.id` = ArcGIS 10.71, **522 layanan**, 53 folder, 11 folder terkunci token.
Semua **Kota Tangerang**. Kabupaten tidak punya ArcGIS publik (`maps.tangerangkab` = TileServer GL
OSM; `geoportal.tangerangkab` menutup koneksi).

Yang terverifikasi: jaringan jalan PU **6.373 segmen dan semuanya bernama** (`namobj` 6.373/6.373,
5.751 nama unik, 1.374,6 km, lebar rata-rata 3,49 m, fungsi jalan berkode `fgsrjl`); atribut
kelas/status/kondisi/material kosong, `nama_ruas` hanya 32 (duplikat `namobj` untuk arteri) — sempat
salah dibaca sebagai "hanya 32 bernama", dikoreksi 31 Okt setelah user memeriksa kolom "Nama Objek".

**Keputusan:** tidak dipakai untuk FDS — cakupan kota, dan pindah studi kasus berarti tarik RUP Kota,
gazetteer kelurahan baru, pipeline + UI ulang. Disimpan sebagai rencana v2 dengan bukti di
`docs/INVENTARIS-ARCGIS-KOTA-TANGERANG.md`. Peta tetap koroplet GADM Kab. Tangerang.

## 31 Okt: uji matching paket → ruas (Kota Tangerang, `idKldi=D44`)

RUP Kota Tangerang 2025+2026 = **21.402 baris**; kandidat paket fisik **1.557**. Hasil uji: hanya
**232 (15%)** yang menyebut nama jalan spesifik; dari 242 nama itu **94 cocok persis + 17 fuzzy
(≈46%)** → **±7% paket** bisa dipasang ke satu ruas bernama (91 paket, Rp108,05 M). Anchor yang
sebenarnya dominan adalah **RW: 853 paket (54,8%)**, kelurahan 320 (20,6%), kecamatan 19 (1,2%),
tanpa anchor 365 (23,4%) — dan server punya 1.020 poligon RW + 5.167 RT. Jadi jalur v2 yang benar =
paket → RW, bukan paket → ruas. Detail: `docs/UJI-MATCHING-KOTA-TANGERANG.md` + CSV 232 baris.

## 31 Okt: PINDAH STUDI KASUS KE KOTA TANGERANG (keputusan user)

User memutuskan FDS memakai **Kota Tangerang**, dengan rencana extend ke kab/kota lain saat server GIS
mereka didapat. Pencocokan lokasi memakai **RW**, sesuai uji: anchor nama paket 54,8% RW, 20,6%
kelurahan, 1,2% kecamatan, 23,4% tanpa anchor — dan Kota punya 1.020 poligon RW + 104 kelurahan resmi.

Yang dikerjakan:
- `tools/build_kota.py` menulis ulang dataset dari 21.402 baris RUP `idKldi=D44` → **1.557 paket,
  Rp650,18 M** (TA2025 939 · TA2026 618); anchor **RW 818 · kelurahan 337 · tanpa 402**; 80 kelurahan,
  483 unit RW, 13 kecamatan.
- Geometri resmi: `web/public/data/rw.geojson` (1.020 poligon, 810 KB) + `kel.geojson` (104, 191 KB),
  disederhanakan `maxAllowableOffset=0,00004`; GADM/`desa-batas.geojson` dibuang.
- `web/src/components/Peta.tsx` ditulis ulang: koroplet dua tingkat (kelurahan < zoom 12, RW ≥ 12),
  sorotan batas wilayah saat paket dipilih, tanpa titik paket. `lib/paket.ts`: `Presisi` =
  RW/Kelurahan/Kecamatan/Kabupaten, statistik baru (`unitRw`), label `RW 04`/`Kelurahan`.
- `lib/paket.ts` juga memperbaiki klasifikasi pekerjaan: "gorong-gorong" dipindah dari jembatan ke
  drainase (sebelumnya 978 paket salah kelas jadi "jembatan"; sekarang jembatan 50, drainase 1.238,
  permukaan 269).
- Angka di AGENTS/BRIEF/README/KONSEP/SPEC/HANDOFF diganti seragam (1.557 · Rp650,18 M · 80 kelurahan
  · 483 RW · 818 anchor · 402 tanpa lokus · 13 kecamatan · `idKldi=D44` · BPS 3671).

Verifikasi: `typecheck` 0 error, `vite build` 439,98 kB, screenshot Chromium: judul "Peta audit jalan
Kota Tangerang", metrik 1.557/Rp650,18 M/80 kelurahan/818 anchor/1.155 lokus/402 tanpa lokus,
koroplet RW dengan legenda 537 RW kosong · 252 (1 paket) · 213 (2–3) · 17 (4–6) · 1 (7–10).

Sisa: AGENTS.md aturan 5 & badge (8) belum ikut diperbarui — penulisan ke berkas itu diblokir
menunggu persetujuan user. `Lapor.tsx` masih memakai nama contoh Kabupaten (Kutabumi, Kresek).

## Modul yang harus ada (SPEC §4)

FR-01 peta audit jalan · FR-02 pencari mikro "jalan mana yang dibangun di dekat saya" (desa/kampung/nama jalan) · FR-03 form lapor (blur privasi, **kategorisasi jenis & penyebab kerusakan oleh pelapor**, ukuran kasar, rekomendasi paket + skor) · FR-04 kartu sandingan · FR-05 verifikasi komunitas dua kunci · FR-06 rapor **29 kecamatan** & jenis kerusakan · FR-07 rekam jejak penyedia berimbang.

FDS 1 Nov: dua layar hidup — **peta audit jalan (FR-01)** dan **alur lapor (FR-03)**.

## Aturan yang tidak boleh dilanggar

1. Bahasa indikator **"Diduga Tidak Sesuai"**, tidak pernah "korupsi/fiktif".
2. Badge **`SIMULASI PROTOTIPE`** (amber) untuk laporan warga; badge **`DATA RESMI (SIRUP / BINA MARGA)`** untuk data asli.
3. Nama CV/PT penyedia **disamarkan** di mode simulasi (risiko defamasi).
4. Format angka Indonesia: `5.013`, `86,4%`, `Rp693,07 Miliar`.
5. Tanpa login identitas; EXIF dibersihkan, wajah/plat diburamkan di perangkat.

## Langkah berikut (urut tenggat)

1. **Hari ini–30 Okt**: putuskan nasib `web/` — tulis ulang rute SAKSI di atas proyek Vite yang ada (rekomendasi) atau fork. Landing + `/jelajah` (peta + daftar 5.013 paket) wajib hidup karena itu dua halaman untuk screenshot FDS.
2. Normalisasi dataset (lat/lon string, entri tanpa titik, offset desa) → payload peta siap.
3. Commit dokumen + dataset SAKSI, perbarui `manifest.json` (produk → SAKSI), README progress, lalu push repo publik.
4. Susun PDF FDS (≤10 hlm): konsep, sitemap, wireframe 5 layar, fitur, 2 screenshot.
5. Sisa modul FR-03 s.d. FR-06 + halaman `/metode` untuk proposal 11 Nov.
