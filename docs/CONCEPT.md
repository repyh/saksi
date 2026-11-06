# KONSEP — Codename: **SAKSI**
*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*

**Lomba:** Web In Action (WIA) — MIA 2026
**Tema:** *Designing Digital Futures – Powering Public Transparency*
**Subtema:** **Civic Reporting & Accountability**
**Studi kasus:** **Jalan di Kota Tangerang** (`idKldi=D44`, BPS `3671`) — mencakup jalan, jembatan, drainase/saluran, trotoar, TPT/turap
**Status:** v5 — 5 November 2026. Semua angka dari ekspor RUP `data.inaproc.id` (28.699 baris D44) + detail RUP + realisasi; sumber utama SIRUP sudah ditinggalkan.

> **Riwayat versi.** v1 studi kasus Kab. Bandung (5 sektor) · v2 pindah ke Kab. Tangerang (5 sektor)
> · v3 mempersempit ke satu jenis infrastruktur: jalan. Dasar: arahan dosen pembimbing —
> *"infrastruktur yang mana? kan banyak infrastruktur, harus spesifik … satu, satu aja … jalan, itu
> berarti kembangkan fitur-fitur di dalam; jangan bercabang"* — dan karena hanya jalan yang punya
> pembanding resmi (IRI Bina Marga).
> · **v4 pindah studi kasus ke Kota Tangerang** dan meninggalkan penempatan titik per paket: peta
> menjadi koroplet batas wilayah resmi dengan anchor lokasi RW/kelurahan/kecamatan. Kabupaten
> Tangerang disimpan sebagai arsip historis, bukan studi kasus.

---

## 1. Klaim Tunggal

> **"Kalau jalan di depan rumah Anda rusak padahal baru diaspal tahun ini, SAKSI menunjukkan paket mana yang membangunnya, berapa uangnya, siapa penyedianya, dan apakah kerusakannya masih dalam masa garansi — lalu membuat laporan warga itu tidak bisa diabaikan."**

Satu kalimat untuk juri:
> *"Kami tidak membuat aplikasi aduan jalan yang baru. Kami membuat lapisan yang menautkan 1.634 paket pekerjaan jalan Kota Tangerang (Rp683,34 Miliar) dengan foto warga di wilayah yang sama, sehingga laporan warga berubah dari keluhan menjadi bukti yang punya nomor paket, tanggal, dan penerima yang jelas."*

---

## 2. Masalah

1. **Warga tidak tahu uangnya ke mana.** Ketika jalan kampung berlubang, warga tidak bisa mengetahui
   apakah ruas itu baru saja dianggarkan, siapa kontraktornya, dan kapan pekerjaannya selesai. Data
   RUP tersedia — 21.402 baris untuk Kota Tangerang — tetapi berupa teks tanpa peta dan tanpa kait ke
   wilayah mana pun.
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
`lokasi` teks tingkat kota, halaman LPSE hanya `Lokasi Pekerjaan` teks. Karena itu SAKSI **tidak
menempatkan titik per paket**: anchor lokasi diturunkan dari teks nama paket menjadi poligon wilayah
resmi (RW, kelurahan, kecamatan), dan setiap angka peta menyatakan tingkat poligon yang dipakai —
batasan yang ditulis terbuka.

---

## 3. Posisi Inovasi

| Platform | Paket anggaran per lokasi? | Laporan warga? | Menautkan paket jalan ↔ bukti warga di wilayah yang sama? |
|---|---|---|---|
| **Jalan Kita 2.0** (Bina Marga) | Tidak dibuka publik | Ya — jalan **nasional** | **Tidak** |
| **SP4N-LAPOR! / JAKI** | Tidak ada data paket | Ya | **Tidak** |
| **ICW OpenTender** | Agregat kab/kota + skor risiko | Tidak | **Tidak** |
| **KPK JAGA** | Per entitas (sekolah/desa/puskesmas) | Ya | Tidak untuk paket konstruksi jalan |
| **Sumbong sa Pangulo 2.0 / DPWH** (Filipina) | Ya + **koordinat** | Ya | **Ya — prior art internasional** |
| **SAKSI** | **Ya** — 1.634 paket jalan, dibaca per poligon RW/kelurahan/kecamatan | **Ya** | **Ya, dengan tingkat anchor + jendela pemeliharaan** |

### Klaim inovasi sempit
1. **Penautan paket jalan ↔ laporan warga** di kelurahan/RW yang sama, tahun anggaran berjalan atau
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

Dari 21.402 baris RUP Kota Tangerang (TA 2025 + TA 2026), setelah membuang belanja
operasional dan jasa konsultansi, dan **membatasi pada pekerjaan jalan**:

| | |
|---|---:|
| Paket jalan, jembatan & drainase | **1.634** |
| Pagu | **Rp683,34 Miliar** |
| Paket TA 2025 / TA 2026 | 981 / 653 |
| Kelurahan tersentuh | **85 dari 104** · 13 kecamatan |
| RW tersentuh | 490 dari 1.020 |
| Anchor lokasi turunan (RW/kelurahan/kecamatan) | **1.286 (78,7%)** |
| Penyedia bernama (LPSE/SPSE + Data INAPROC) | 1.426 (87,3%) · 522 penyedia unik |
| Tanpa rekam publik | 208 paket (Rp130,67 M, 19,1% pagu) |
| Rasio kontrak/pagu median | 0,99 |

Komposisi pekerjaan (dari nama paket): drainase/saluran **1.303** · pekerjaan permukaan
(paving/beton/hotmix, trotoar, TPT) **287** · jembatan/gorong-gorong **50**.
Artinya "jalan" di sini bukan hanya aspal — mayoritas justru pekerjaan drainase dan permukaan
kampung, persis jenis pekerjaan yang paling sering dikeluhkan warga.

### Anchor lokasi — dinyatakan terbuka

| Tingkat anchor | Paket | Arti di peta |
|---|---:|---|
| RW | 821 (50,2%) | nama paket menyebut RW → masuk poligon RW resmi |
| Kelurahan | 375 (22,9%) | hanya kelurahan disebut → poligon kelurahan |
| Kecamatan | 90 (5,5%) | hanya kecamatan disebut → poligon kecamatan |
| Tanpa lokus | 348 (21,3%) | tidak menyebut tempat → **tidak masuk peta**, hanya di tabel |

**Tidak ada pin, titik, atau jitter per paket** — karena tidak ada koordinat pekerjaan di sumber mana
pun. Peta adalah koroplet batas wilayah resmi (ArcGIS Kota Tangerang) dengan segmented control di peta
untuk memilih tingkat poligon: **kecamatan (13 poligon), kelurahan (104), atau RW (1.020)**. Angka
kecamatan menjumlahkan seluruh paket di dalamnya — termasuk yang anchor-nya RW dan kelurahan — dan
memakai kelas kuantil; kelurahan dan RW memakai kelas 0 / 1 / 2–3 / 4–6 / 7–10 / 11+.

### Kapabilitas pipeline (bukan nilai jual)

Penyaring yang sama bekerja pada dua daerah. Dataset Kabupaten Tangerang tetap disimpan sebagai arsip
historis dan bukti bahwa pipeline-nya tidak terikat satu daerah, **tetapi bukan studi kasus**:
produk, narasi, dan demo dibatasi pada Kota Tangerang dan pada jalan — supaya kedalamannya nyata,
bukan sebaran yang dangkal di lima domain.

---

## 5. Dampak — Siapa Berubah Perilakunya

**Pengguna utama:** warga di 85 kelurahan yang punya paket jalan 2025–2026, dan **dinas teknis
pengelola jalan** serta **Inspektorat** sebagai pihak yang bisa bertindak.

| Siapa | Perubahan yang diharapkan |
|---|---|
| Warga | dari mengeluh di media sosial menjadi laporan berfoto yang **memuat nomor paket, nilai anggaran, dan tanggal** — sesuatu yang bisa ditanyakan dalam forum resmi |
| Dinas teknis | menerima daftar paket yang **masih dalam masa pemeliharaan** dan dilaporkan rusak — dasar menagih kontraktor tanpa anggaran baru |
| Inspektorat / DPRD | punya sampel lapangan yang bisa diuji, bukan hanya laporan berjenjang |
| Penyedia jasa yang jujur | rekam jejak terbuka membuat pekerjaan di bawah spesifikasi kehilangan keunggulan biaya |

**Yang bisa diklaim, bukan dijanjikan:** 1.634 paket jalan bisa dicari per kelurahan/RW; 1.286 (78,7%)
punya anchor lokasi di poligon resmi; setiap laporan warga terikat ke satu nomor RUP; dan setiap paket
yang dilaporkan rusak dalam masa pemeliharaan masuk daftar tagih.

**"Tidak bisa di-deny, tidak bisa di-ignore"** — rumusan dosen pembimbing yang menjadi target desain:
laporan menyimpan foto, waktu, koordinat, dan tautan RUP; badge membedakan simulasi dan data asli;
statusnya terbuka untuk publik. Instansi masih bisa menolak menindaklanjuti, tetapi tidak bisa
mengatakan laporan itu tidak ada.

---

## 6. Batasan & Etika

1. **Bahasa indikator "Diduga", bukan tuduhan.** Status tertinggi *"Diduga Tidak Sesuai — Perlu
   Tinjauan Lapangan"*; tidak ada label korupsi atau fiktif.
2. **Tidak memaksa titik.** 348 paket (21,3%) tanpa penanda tempat tidak dipetakan, dan tidak ada
   pin per paket yang dikarang: peta hanya menjumlahkan paket ke poligon wilayah resmi.
3. **IRI hanya mencakup jalan nasional** (8,6% jaringan), sedangkan paket kita mayoritas jalan kota.
   Komparasi IRI hanya berlaku bila paket berimpit dengan ruas nasional; selebihnya
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
