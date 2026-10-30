# Surface brief — `#/lapor` Alur lapor 3 langkah

**Mode:** Operate. Warga datang dengan satu tujuan: mengirim bukti kerusakan yang menempel pada satu
nomor paket. Setiap piksel yang tidak membantu tujuan itu dihapus.

**Penonton & aksi:** warga di tepi jalan, sering satu tangan, sinyal lambat, mungkin tidak paham
istilah pengadaan. Aksi utama: `Kirim laporan` → kode laporan + badge simulasi + paket tertaut.

**Konten yang tersedia:** 7 jenis kerusakan, 6 penyebab, 3 ukuran kasar, 274 desa, 3.602 paket
(kandidat dihitung dengan `MatchScore`), 3 contoh laporan berlabel untuk state demo.

**Batasan:** tanpa login; tanpa CV; tanpa input luas cm²; blur + hapus EXIF di browser; laporan tanpa
dasar penautan tetap boleh dikirim dengan status `Tidak Dapat Ditautkan`.

## Direction contract

**THESIS.** Alur ini adalah **lembar pemeriksaan lapangan** yang diisi sambil berdiri di pinggir
jalan: tiga langkah bernomor, satu kolom isian yang tenang, dan satu kolom kanan yang terus
menyatakan apa yang akan dikirim. Yang ditolak: wizard kartu bertumpuk dan ilustrasi dekoratif.

**OWN-WORLD.** Sama dengan `#/`: kertas, tinta, satu merah saksi, hairline, sudut 2 px, mono untuk
angka dan kode. Bahasa tambahan: **kanvas foto sebagai objek**, bukan thumbnail — bingkai 1 px,
kontrol kuas langsung di bawahnya, metadata (dimensi, ukuran hasil, `EXIF dibuang`) dalam mono.

**STORY.** "Laporan saya akan punya nomor paket, dan kalau tidak ada dasar penautan, sistem
mengatakannya jujur." Pengunjung selesai dengan kode laporan dan tautan ke paket — atau penjelasan
mengapa tidak ada tautan.

**FIRST VIEWPORT.** Header yang sama. Judul `Laporkan kerusakan jalan` + satu kalimat + badge
`SIMULASI PROTOTIPE`. Stepper horizontal 3 langkah dengan garis hairline. Kolom kiri (maks 640 px)
berisi langkah aktif; kolom kanan sticky (360 px) berisi ringkasan: paket terpilih, jenis, status
foto, dan daftar privasi yang sudah dilakukan. Aksi primer di bawah langkah, rata kanan.

**FORM.** Form vertikal + ringkasan sticky; urutan kandidat ke-1 (paling jelas untuk tugas berurutan),
bukan wizard modal.

**FINISH.** unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.
