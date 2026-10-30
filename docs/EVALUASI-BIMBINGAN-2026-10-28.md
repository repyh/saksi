# Evaluasi bimbingan dosen — Rabu 28 Oktober 2026

Sumber: `docs/transkrip-dosen-2026-10-28.txt` (9 mnt 34 dtk, mulai di tengah percakapan).
Dibandingkan dengan konsep yang akhirnya dikunci 29 Oktober 2026: **SAKSI**
(`KONSEP.md`, `SPEC.md`, `KONTEKS-UPDATE-2026-10-29.md`).

Tiga blok di bawah dipisah tegas: **yang terdengar**, **penilaian saya**, **keputusan yang masih terbuka**.

---

## 1. Yang dosen minta (terdengar, dengan timestamp)

| # | Permintaan | Bukti |
|---|---|---|
| 1 | **Perkecil cakupan ke satu wilayah** — Tangerang sebagai bukti, bukan semua daerah | `[00:00]` "kalau kamu bisa ngerjain Tangerang, berarti kamu bisa ngerjain Bekasi dong. Enggak perlu semua" |
| 2 | **Integrasi data ≠ inovasi** — proyek + anggaran + pemenang + durasi hanya "basic data" | `[00:34]`–`[01:00]` "itu cuma mengintegrasikan… kalau gitu nggak akan juara" |
| 3 | **AI harus kelihatan di produk** | `[01:07]` "kalau dimasukin AI, AI-nya di mana?" |
| 4 | **Klasifikasi penyebab kerusakan**, bukan sekadar label "rusak" | `[04:20]`–`[05:04]` "kamu harus bilang kategorinya — rusaknya kenapa? … jangan cuma rusak, rusak, rusak" |
| 5 | **Rekam jejak vendor**, tapi berimbang | `[03:49]` "top 10 vendor yang bikin rusak jalan… tapi harus balance. Kenapa rusaknya?"; `[05:06]` "kalau ini vendor ini, pasti masalahnya sama… 6 bulan rusak" |
| 6 | **Inferensi + tampilan dinamis & berlapis (layer/overlay), klik → tabel** | `[03:25]` `[05:26]` `[06:03]` `[08:06]` `[08:30]` "pokoknya layer aja datanya" |
| 7 | **2D saja, tanpa 3D; pakai OSM (Google Maps berbayar)** | `[07:18]` "nggak usah 3D… 2D cukup"; `[07:40]`–`[07:50]` "pakai OSM" → "open source ya? nanti pakai itu" |
| 8 | **Pipeline + diagram metode; repo GitHub untuk di-invite** | `[08:58]` "bikin metode pipeline, metode-metodenya pakai diagram"; `[09:11]` "buat GitHub-nya, nanti mau invite… DHREFA1" |

## 2. Yang sudah dijawab konsep SAKSI

- **#1 cakupan**: SAKSI sudah satu kabupaten (Kab. Bandung, `idKldi=D107`) — sesuai semangat permintaan. Yang belum ada: **alasan tertulis mengapa Bandung, bukan Tangerang**. Perlu satu paragraf di proposal (data mikro terbaca di teks nama paket + gazetteer BPS `3204` sudah teruji), bukan dibiarkan seolah diabaikan.
- **#2–#3 sebagian**: SAKSI tidak berhenti di integrasi — ada penautan laporan warga ↔ paket + indikator "Diduga Tidak Sesuai" + jendela masa pemeliharaan. Tapi NLP-nya (penyaringan paket fisik, geocoding 3 tier) adalah **AI di balik layar**, dan dosen justru bertanya "AI-nya di mana". Di layar, SAKSI hari ini masih akan terbaca sebagai dasbor integrasi.
- **#6–#7 sebagian**: 5 layar + peta + filter sudah sejalan dengan semangat layer/overlay dan klik-ke-data; stack memakai peta berbasis OSM (Leaflet/MapLibre), bukan Google Maps, dan tanpa 3D.
- **#8 belum**: diagram pipeline/metode dan repo GitHub dengan akses untuk dosen belum ada (repo belum di-push, dokumen SAKSI masih untracked).

## 3. Tiga celah yang paling menentukan

### Celah A — "AI-nya di mana" belum terjawab di permukaan produk
Saat ini kontribusi AI = ekstraksi & geocoding (pipeline). Juri dan dosen tidak melihatnya; yang mereka lihat adalah peta + tabel anggaran, yaitu persis "basic data" yang dikritik `[01:00]`.
**Perbaikan minimum yang murah:** tampilkan keluaran inferensinya, bukan prosesnya — (a) skor kecocokan laporan↔paket beserta alasannya, (b) dugaan penyebab kerusakan otomatis, (c) status "dalam masa pemeliharaan → perlu ditagih". Tiga hal ini terlihat dalam satu kartu kasus (FR-04) tanpa membangun model baru.

### Celah B — Penyebab kerusakan tidak ada sama sekali di spesifikasi
`SPEC.md` hanya punya sektor + `MatchScore`. Taksonomi penyebab yang dosen sebut — dilalui truk/kendaraan berat, kepadatan/macet, tidak ada drainase, bahan tidak sesuai — bisa masuk sebagai **multi-select wajib di form lapor** (FR-03) + kolom di dataset laporan, lalu dipakai untuk agregasi "penyebab dominan per kecamatan/ruas" (FR-06). Ini yang membuat produk punya *pendapat*, bukan cuma peta. Biaya: satu field enum + satu panel agregasi.

### Celah C — Rekam jejak vendor diminta dua kali, lalu dihapus dari konsep
SAKSI memilih jalur aman: nama penyedia **disamarkan**, vendor tidak jadi fitur. Dosen memintanya dua kali (`[03:49]`, `[05:06]`) dan menyebutnya sendiri sebagai "itu inovasi".
Ini bukan sekadar preferensi — ini benturan dua risiko: **defamasi** (menyebut CV nyata sebagai penyebab jalan cepat rusak) vs **relevansi** (dosen menilai justru di situ letak inovasi). Ada jalan tengah yang memenuhi keduanya: tampilkan **rekam jejak paket per penyedia dari data LPSE asli** (nama pemenang memang data publik), tetapi (i) tanpa skor gabungan "vendor perusak", (ii) selalu dengan penyebut — jumlah paket, kelas jalan, tahun — sehingga pembaca bisa menimbang sendiri, (iii) frasa tetap "paket dengan laporan kerusakan dalam masa pemeliharaan", bukan tuduhan. Itu persis "harus balance" yang diminta.
Keputusan perlu diambil sebelum FDS, karena menentukan ada/tidaknya satu layar.

## 4. Keputusan yang masih terbuka

1. **Vendor**: masukkan modul rekam jejak berimbang (nama asli, dari LPSE) atau tetap disamarkan dan siapkan argumen penggantinya di proposal?
2. **Tangerang vs Bandung**: pertahankan Bandung dengan alasan teknis tertulis, atau uji cepat endpoint SIRUP Tangerang untuk membuktikan dataset-nya tidak punya teks lokasi mikro? (Biaya uji rendah: satu `idKldi` + satu tarikan.)
3. **AI yang ditonjolkan**: CV (klasifikasi kerusakan dari foto) atau LLM (ringkasan + dugaan penyebab dari teks laporan)? Arahan sebelumnya: "pilih salah satu, tidak harus dua-duanya". Untuk demo 1 November, LLM di atas teks laporan lebih murah dan lebih terlihat daripada CV.
4. **Cakupan layar FDS**: dua layar wajib (landing + 1 fitur) — apakah fitur yang didemokan peta audit (FR-01) atau alur lapor (FR-03)? Peta lebih kuat untuk tema; alur lapor lebih kuat untuk "inti proyek = pelaporan masyarakat" versi dosen.

## 5. Konsekuensi jadwal

FDS 1 November hanya menuntut konsep + sitemap + mockup + 2 layar hidup. Dari delapan permintaan dosen, yang **harus** terlihat di FDS: alasan pemilihan wilayah (#1), satu bukti inferensi di layar (#3/#6), dan penyebab kerusakan di form (#4). Rekam jejak vendor (#5) dan diagram pipeline (#8) bisa menyusul di proposal 11 November — kecuali dosen menagihnya lebih dulu.

---

## 6. Rekaman sebelumnya (pra-28 Oktober) — penciutan SEKTOR, bukan hanya wilayah

Transkrip: `docs/transkrip-dosen-pra-2026-10-28.txt` (9 mnt 25 dtk, rekaman yang terjadi sebelum sesi
28 Oktober; bagian yang hilang di awal rekaman 28 Oktober ternyata ada di sini).

**Temuan yang mengubah pembacaan sebelumnya:** pada evaluasi pertama saya menulis "rekaman tidak
menyebut penciutan sektor". Itu keliru karena rekaman 28 Oktober mulai di tengah. Di rekaman ini
dosen menyatakannya eksplisit:

- `[05:21]` *"Infrastruktur yang mana? Kan banyak infrastruktur. **Harus spesifik.**"*
- `[05:24]`–`[05:33]` *"Nggak ada gunanya kamu soal bangunan, soal proyek bendungan — itu kan gede,
  nggak mampu kamu. Saya jawab jujur: nggak mampu. **Satu, satu aja.**"*
- `[05:38]` mahasiswa: *"Jadi kita balik fokus ke jalan, aman ya Pak?"* → dosen: *"Ya. Yang sederhana,
  yang juga bisa."*
- `[06:02]` *"**Kami menang karena sederhana** … requirements yang kita ajukan semuanya dapat."*
- `[06:24]` *"**Jalan. Itu berarti kembangkan fitur-fitur di dalam.**"*
- `[08:06]` *"**Jangan bercabang.** Kalau udah satu, satu. Kalau bercabang, mentah lagi."*

Konsekuensi: **UI, narasi, dan demo = jalan saja.** Klaim "5 sektor" tidak lagi dipakai sebagai jualan;
dataset 5 sektor tetap disimpan sebagai arsip/roadmap, bukan ditampilkan sebagai filter.

### Angka untuk fokus jalan (Kab. Tangerang, dari dataset 29 Oktober)

| Ukuran | Nilai |
|---|---|
| Paket Jalan, Jembatan & Drainase | **3.602** (65,6% dari 5.487) |
| Pagu | **Rp848,60 M** (49,6% dari Rp1.709,17 M) |
| Terpetakan | **92,5%** (desa 83,3% · koridor 2,8% · kecamatan 6,4% · tanpa lokus 7,5%) |
| Garis koridor | **110** — seluruh layer garis ada di sektor ini |

### Empat permintaan baru yang belum ada di dokumen

1. **"Siapa yang pakai, dampaknya ke siapa"** (`[00:12]`–`[00:42]`). Dosen menekan dampak sebagai
   syarat menang: *"kalau dampaknya luas, kemungkinan kita dipakai — dan juara."* Perlu satu paragraf
   tajam di KONSEP: pengguna utama, perubahan perilaku yang diharapkan, dan siapa yang dirugikan bila
   produk tidak ada.
2. **"Sistem yang tidak bisa di-deny, tidak bisa di-ignore"** (`[07:13]`). Ini rumusan pertanggungjawaban
   yang lebih keras daripada "early warning": laporan warga (foto + GPS + waktu + tautan RUP) harus
   sedemikian rupa sehingga baik bawahan maupun atasan tidak bisa mengabaikannya. Belum tercermin di
   `KONSEP.md`/`SPEC.md`.
3. **Computer vision untuk mengukur kerusakan jalan** (`[06:29]`): *"Vilo udah punya programnya, yang
   jalan-jalan bisa mengukur. Coba minta izin dia untuk ambil."* Ini menjawab pertanyaan "CV atau LLM"
   dari sisi dosen: **CV untuk pengukuran jalan**. Perlu ditindaklanjuti ke Vilo sebelum FDS.
4. **Media sosial sebagai sumber** (`[07:52]`): *"boleh masukin TikTok kek, apa kek — itu jadi
   sumbernya."* Sejalan dengan arahan lama (scraping berita/Twitter). Masuk roadmap, bukan FDS.

### Yang gugur atau turun prioritas

- **Rekam jejak vendor** (diminta di sesi 28 Oktober) tetap dipertahankan sebagai FR-07, tetapi bukan
  fitur yang didemokan di FDS.
- **5 sektor sebagai nilai jual** → turun menjadi kapabilitas pipeline (satu paragraf di dokumen,
  tanpa tabel besar di UI).

