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
