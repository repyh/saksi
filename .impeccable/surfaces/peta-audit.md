# Surface brief — `#/` Peta audit jalan

**Mode:** Operate. Pengunjung datang untuk menyelesaikan tugas: mencari paket jalan, tahu berapa
uangnya, dan tahu seberapa presisi lokasinya. Ekspresi tidak boleh menghalangi tugas.

**Penonton & aksi:** warga (mencari ruas di desanya), dinas/inspektorat (membaca sebaran paket),
juri FDS (menilai dalam 10 detik). Aksi utama: klik satu baris → peta bergerak ke paket → baca
detail → `Laporkan kerusakan`.

**Konten yang tersedia:** 3.602 paket jalan, 3.331 bertitik (3.000 desa · 102 koridor · 229
kecamatan), 271 tanpa lokasi, 251 desa, 29 kecamatan, pagu Rp848,60 M.

**Batasan:** tanpa filter sektor; tanpa marker untuk paket tanpa lokasi; badge presisi menempel pada
setiap data; performa 3.331 titik dengan canvas.

## Direction contract

**THESIS.** Halaman ini adalah **register pengukuran**, bukan dashboard peta: tabel dan peta adalah
dua pandangan atas register yang sama, dan presisi setiap baris dinyatakan sebagai glyph. Yang
ditolak: peta besar sebagai hero dengan panel kartu mengambang di atasnya.

**OWN-WORLD.** Kertas `#FBF7F0`, tinta `#16120E`, satu merah saksi `#B3261E` untuk state dan aksi;
hairline 1 px sebagai satu-satunya pemisah; sudut 2 px; tanpa shadow; angka selalu mono tabular;
glyph presisi titik/garis/kotak/putus di setiap titik data.

**STORY.** "Saya bisa melihat uang jalan di desa saya, dan saya tahu seberapa tepat titiknya."
Pengunjung percaya karena angka membawa penyebut; lalu ia mengklik satu paket dan menemukan tombol
melaporkan kerusakan yang sudah membawa nomor RUP.

**FIRST VIEWPORT.** Garis saksi merah 2 px di puncak. Header 56 px: wordmark SAKSI + nav + stempel
tanggal data. Strip metrik 6 sel berhairline (3.602 · Rp848,60 M · 251 desa · 92,5% · 102 koridor ·
271 tanpa lokasi). Filter sticky satu baris. Di bawahnya, peta mengisi 62% lebar dan register 38%,
keduanya setinggi sisa viewport (≥60vh); legenda presisi diletakkan di dalam peta kiri bawah, bukan
sebagai kartu mengambang.

**FORM.** Register tabel + peta bersisian; diambil dari urutan kandidat ke-2 (bukan peta-hero, bukan
kanvas penuh). Seed key: `brief-pinned` (dunia visual dikunci brief: token lama + batasan tanpa font
baru).

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
