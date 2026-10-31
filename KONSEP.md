# KONSEP — Codename: **SAKSI**
*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*

**Lomba:** Web In Action (WIA) — MIA 2026
**Tema:** *Designing Digital Futures – Powering Public Transparency*
**Subtema:** **Civic Reporting & Accountability**
**Studi kasus:** **Jalan di Kota Tangerang** (`idKldi=D44`, BPS `3671`) — mencakup jalan, jembatan, drainase/saluran, trotoar, TPT/turap
**Status:** v3 — 29 Oktober 2026. Semua angka dari tarikan SIRUP 29 Oktober 2026.

> **Riwayat versi.** v1 studi kasus Kab. Bandung (5 sektor) · v2 pindah ke Kota Tangerang (5 sektor)
> · **v3 mempersempit ke satu jenis infrastruktur: jalan.** Dasar: arahan dosen pembimbing —
> *"infrastruktur yang mana? kan banyak infrastruktur, harus spesifik … satu, satu aja … jalan, itu
> berarti kembangkan fitur-fitur di dalam; jangan bercabang"* — dan karena hanya jalan yang punya
> pembanding resmi (IRI Bina Marga) serta presisi peta tertinggi (74,2%).

---

## 1. Klaim Tunggal

> **"Kalau jalan di depan rumah Anda rusak padahal baru diaspal tahun ini, SAKSI menunjukkan paket mana yang membangunnya, berapa uangnya, siapa penyedianya, dan apakah kerusakannya masih dalam masa garansi — lalu membuat laporan warga itu tidak bisa diabaikan."**

Satu kalimat untuk juri:
> *"Kami tidak membuat aplikasi aduan jalan yang baru. Kami membuat lapisan yang menautkan 1.557 paket pekerjaan jalan Kota Tangerang (Rp650,18 Miliar) dengan foto warga di ruas yang sama, sehingga laporan warga berubah dari keluhan menjadi bukti yang punya nomor paket, tanggal, dan penerima yang jelas."*

---

## 2. Masalah

1. **Warga tidak tahu uangnya ke mana.** Ketika jalan kampung berlubang, warga tidak bisa mengetahui
   apakah ruas itu baru saja dianggarkan, siapa kontraktornya, dan kapan pekerjaannya selesai. Data
   RUP tersedia — 51.322 baris untuk Kota Tangerang — tetapi berupa teks tanpa peta dan tanpa kait ke
   titik mana pun.
2. **Laporan yang bisa diabaikan.** Kanal aduan yang ada menampung laporan, tetapi tidak menempelkan
   laporan itu pada sesuatu yang punya konsekuensi administratif. Bawahan bisa melaporkan "sudah
   ditangani", atasan bisa mengabaikan, dan tidak ada pembanding independen.
3. **Bias pelaporan berjenjang.** *"Kalau laporan dari bawah ke atas, semuanya dilaporkan baik-baik
   saja"* (arahan dosen pembimbing). Pemerintah daerah tidak punya sensor lapangan untuk menangkap
   kerusakan dini selagi kewajiban pemeliharaan kontraktor masih berjalan.

### Fakta pembanding (terverifikasi 29 Oktober 2026)

Filipina menerbitkan **koordinat per kontrak** lewat API publik DPWH (`latitude`, `longitude`,
`hasSatelliteImage`), dan COA–DPWH mewajibkan geo-tagging proyek infrastruktur (September 2025).
Indonesia tidak punya dataset pengadaan terbuka yang memuat koordinat paket: record SIRUP hanya berisi
`lokasi` teks (`"Banten, Tangerang (Kab.)"`), halaman LPSE hanya `Lokasi Pekerjaan` teks. Karena itu
titik di SAKSI **diturunkan** dari teks nama paket + gazetteer desa, dan selalu diberi badge presisi —
batasan yang ditulis terbuka.

---

## 3. Posisi Inovasi

| Platform | Paket anggaran per lokasi? | Laporan warga? | Menautkan paket jalan ↔ bukti warga di ruas yang sama? |
|---|---|---|---|
| **Jalan Kita 2.0** (Bina Marga) | Tidak dibuka publik | Ya — jalan **nasional** | **Tidak** |
| **SP4N-LAPOR! / JAKI** | Tidak ada data paket | Ya | **Tidak** |
| **ICW OpenTender** | Agregat kab/kota + skor risiko | Tidak | **Tidak** |
| **KPK JAGA** | Per entitas (sekolah/desa/puskesmas) | Ya | Tidak untuk paket konstruksi jalan |
| **Sumbong sa Pangulo 2.0 / DPWH** (Filipina) | Ya + **koordinat** | Ya | **Ya — prior art internasional** |
| **SAKSI** | **Ya** — 1.557 paket jalan + 818 ber-anchor RW ruas | **Ya** | **Ya, dengan badge presisi + jendela pemeliharaan** |

### Klaim inovasi sempit
1. **Penautan paket jalan ↔ laporan warga** di desa/koridor yang sama, tahun anggaran berjalan atau
   sebelumnya.
2. **Jendela masa pemeliharaan.** Konstruksi pemerintah memiliki masa pemeliharaan minimum 6 bulan
   pasca-PHO dengan retensi 5%. Laporan yang jatuh di jendela ini diberi prioritas agar instansi bisa
   menagih perbaikan sebelum retensi dicairkan.
3. **Sandingan tiga lapis:** riwayat anggaran (SIRUP/LPSE) ↔ klaim kondisi resmi (IRI Bina Marga) ↔
   bukti warga + konfirmasi warga sekitar, dengan label **"Diduga Tidak Sesuai"**.
4. **Rekam jejak penyedia** dari data publik LPSE, disajikan berimbang: tanpa skor gabungan, selalu
   dengan penyebut (jumlah paket, kelas jalan, tahun), hanya mendeskripsikan "paket dengan laporan
   kerusakan dalam masa pemeliharaan".

---

## 4. Cakupan: Satu Jenis Infrastruktur, Dikembangkan ke Dalam

Dari 51.322 baris RUP Kota Tangerang (TA 2025: 27.125 · TA 2026: 24.197), setelah membuang belanja
operasional dan jasa konsultansi, dan **membatasi pada pekerjaan jalan**:

| | |
|---|---:|
| Paket jalan, jembatan & drainase | **1.557** |
| Pagu | **Rp650,18 Miliar** |
| Paket TA 2025 / TA 2026 | 2.156 / 1.446 |
| Median nilai paket | Rp100 juta |
| Desa/kelurahan tersentuh | **251 dari 274** · 13 kecamatan · 37 satuan kerja |
| Terpetakan | **1.155 (74,2%)** |
| Garis koridor ruas | **102** |
| Punya penanda lokasi mikro (Jl/Kp/RT/RW) | 3.409 (94,6%) |

Komposisi pekerjaan (dari nama paket): paving/beton **1.186** · drainase/saluran **946** ·
hotmix/aspal **560** · turap/talud/TPT **103** · jembatan/gorong-gorong **78**.
Artinya "jalan" di sini bukan hanya aspal — mayoritas justru pekerjaan permukaan dan drainase kampung,
persis jenis pekerjaan yang paling sering dikeluhkan warga.

### Presisi peta — dinyatakan terbuka

| Tingkat | Paket | Arti |
|---|---:|---|
| Desa/Kelurahan | 3.000 (83,3%) | nama desa disebut pada nama paket → lokasi diturunkan ke **pusat desa** |
| Garis koridor | 102 (2,8%) | dua desa pada nama paket (`Kresek - Cempaka`) → **busur indikatif** antar dua pusat desa |
| Kecamatan | 229 (6,4%) | hanya kecamatan disebut → titik **pusat kecamatan** |
| Tanpa lokus | 402 (7,5%) | tidak menyebut tempat → tidak diberi lokasi, hanya tampil di tabel |

Keempat tingkat ini adalah **provenans** (dari mana lokasi diturunkan), bukan akurasi. Tidak ada paket
yang punya koordinat pekerjaan, dan peta tidak memplot paket satu per satu — lihat §6 butir 2.

Kecamatan dengan paket terbanyak: Pasar Kemis 261 · Sepatan 226 · Kelapa Dua 202 · Curug 197 ·
Sepatan Timur 193.

### Kapabilitas pipeline (bukan nilai jual)

Penyaring yang sama bekerja lintas sektor: pada Kota Tangerang totalnya 5.487 paket di 5 sektor, dan
pada Kab. Bandung 5.013 paket (86,4% terpetakan). Dataset itu disimpan sebagai arsip dan bukti
generalisasi, **tetapi produk, narasi, dan demo dibatasi pada jalan** — supaya kedalamannya nyata,
bukan sebaran yang dangkal di lima domain.

---

## 5. Dampak — Siapa Berubah Perilakunya

**Pengguna utama:** warga di 80 kelurahan yang punya paket jalan 2025–2026, dan **Dinas Bina Marga &
Sumber Daya Air** serta **Inspektorat** sebagai pihak yang bisa bertindak.

| Siapa | Perubahan yang diharapkan |
|---|---|
| Warga | dari mengeluh di media sosial menjadi laporan berfoto yang **memuat nomor paket, nilai anggaran, dan tanggal** — sesuatu yang bisa ditanyakan dalam forum resmi |
| Dinas teknis | menerima daftar paket yang **masih dalam masa pemeliharaan** dan dilaporkan rusak — dasar menagih kontraktor tanpa anggaran baru |
| Inspektorat / DPRD | punya sampel lapangan yang bisa diuji, bukan hanya laporan berjenjang |
| Penyedia jasa yang jujur | rekam jejak terbuka membuat pekerjaan di bawah spesifikasi kehilangan keunggulan biaya |

**Yang bisa diklaim, bukan dijanjikan:** 1.557 paket jalan bisa dicari per desa; 1.155 (74,2%) punya
titik; setiap laporan warga terikat ke satu nomor RUP; dan setiap paket yang dilaporkan rusak dalam
masa pemeliharaan masuk daftar tagih.

**"Tidak bisa di-deny, tidak bisa di-ignore"** — rumusan dosen pembimbing yang menjadi target desain:
laporan menyimpan foto, waktu, koordinat, dan tautan RUP; badge membedakan simulasi dan data asli;
statusnya terbuka untuk publik. Instansi masih bisa menolak menindaklanjuti, tetapi tidak bisa
mengatakan laporan itu tidak ada.

---

## 6. Batasan & Etika

1. **Bahasa indikator "Diduga", bukan tuduhan.** Status tertinggi *"Diduga Tidak Sesuai — Perlu
   Tinjauan Lapangan"*; tidak ada label korupsi atau fiktif.
2. **Tidak ada titik paket di peta.** Paket tidak punya koordinat pekerjaan; menggambar satu titik per
   paket — apalagi dengan offset acak di dalam desa — membuat titik itu tampak berada di ruas jalan
   tertentu padahal bukan. Peta menampilkan **agregat per desa** dan **busur koridor indikatif**; detail
   paket selalu di tabel. 402 paket (7,5%) tanpa penanda tempat bahkan tidak diberi lokasi sama sekali.
3. **IRI hanya mencakup jalan nasional** (8,6% jaringan), sedangkan paket kita mayoritas jalan
   kabupaten. Komparasi IRI hanya berlaku bila paket berimpit dengan ruas nasional; selebihnya
   triangulasi berjalan antara anggaran dan laporan warga. Ditulis apa adanya, tidak jadi headline.
4. **Tidak ada pengukuran kerusakan otomatis (computer vision).** Ditolak secara sadar: pengukuran
   luas menambah metrik tanpa menambah urgensi laporan, dan CV tidak dapat mencakup semua jenis
   kerusakan jalan. Sebagai gantinya pelapor **mengategorikan sendiri** jenis kerusakan (lubang,
   retak, amblas, genangan) dan penyebab yang terlihat, plus perkiraan ukuran kasar (setelapak /
   sebesar ban / lebih dari 1 m²) — cukup untuk memprioritaskan, tanpa klaim presisi palsu.
5. **Privasi pelapor:** tanpa login identitas, EXIF dibersihkan di perangkat, wajah dan plat nomor
   diburamkan.
6. **Penyedia disebut asli tetapi berimbang** (butir 3.4).
7. **Media sosial dan berita sebagai sumber tambahan** (arahan dosen: *"boleh masukin TikTok kek"*)
   masuk roadmap, bukan FDS.
