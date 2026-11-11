# UX Peta Pekerjaan — Review dan Rencana

Diperbarui 11 November 2026. Dokumen ini merangkum review UI/UX `/peta-pekerjaan` dan rencana
perbaikannya. Angka dataset tidak ditulis di sini; pakai `data/regions/<id>/manifest.json` atau
`npm run db:verify -- --region <id>` saat membutuhkannya.

## Batas yang tidak dilanggar

- Peta tetap **koroplet batas wilayah**. Tidak ada pin, titik, atau marker per paket.
- Lokasi paket diturunkan ke RW atau kelurahan; paket tanpa anchor hanya tampil di register dengan
  label `Kota Tangerang (umum)`.
- Penyedia disebut dengan penyebutnya; tidak ada skor gabungan.
- **Tidak ada tombol reset filter** (`docs/HANDOFF.md`). Filter dikembalikan lewat pilihannya
  sendiri; pencarian dihapus dari input.
- Bahasa indikator tetap "Diduga Tidak Sesuai", bukan tuduhan.

## Yang sudah kuat

- Koroplet batas + segmented control tiga tingkat yang tidak mengikuti zoom.
- Pemilih kelurahan tri-state dengan peringatan merah dan tanpa request saat kosong.
- Panel paket memisahkan **Pemenang** (tender) dan **Penyedia**, dengan badge sumber resmi.
- Atribusi ODbL dan tooltip ruas "referensi ruas, bukan lokasi paket".

## Temuan

### P0 — peta tidak menjawab pertanyaannya sendiri

1. **Koroplet kelurahan kolaps.** Kelas tetap `0/1/2–3/4–6/7–10/11+` menumpuk hampir semua kelurahan
   di kelas teratas, sehingga default view praktis satu warna. Kecamatan sudah memakai kuantil dengan
   alasan yang sama; kelurahan tidak.
2. **Legenda menutupi peta.** Tiga paragraf eksposisi, tidak bisa ditutup; di layar sempit menutupi
   sebagian besar peta dan melanggar Zero-Exposition (`docs/DESIGN.md`).
3. **Mobile: peta tidak terlihat.** Filter bertumpuk dan register mendahului peta; pengguna harus
   menggulir jauh sebelum melihat peta.
4. **Satu klik poligon = tiga perilaku.** Klik kelurahan memfilter kecamatan, menyorot kelurahan, dan
   membuka satu paket contoh acak.
5. **Filter wilayah tidak menggerakkan peta.** Memilih kecamatan tidak mengubah kamera.
6. **Level RW tidak terbaca** pada zoom kota; keputusan "level tidak mengubah zoom" perlu ditinjau.

### P1 — konsistensi dan kepercayaan

7. `kontrak` dan `desa` tidak ditulis ke URL, padahal didokumentasikan; filter hilang saat reload,
   share, atau back. Slug region juga ditanam.
8. Badge presisi lokasi belum ada di register dan panel (AGENTS aturan 9).
9. Panel paket tidak menautkan bukti SPSE/INAPROC dan tidak menunjukkan selisih pagu vs kontrak.
10. Palet anggaran merah bertabrakan dengan makna *Crimson Alert*.
11. Tampilan **Jenis pekerjaan**: pil ungu di luar palet, bertumpuk, dan terbaca seperti penanda titik;
    magnitudo tidak terwakili.
12. Kartu penjelasan kanan-atas menimpa tombol **Jaringan jalan** saat panel paket terbuka.
13. Register hanya bisa dibuka lewat tombol kecil; tanpa sort; paginasi 50 baris.
14. Angka "N / M paket" ambigu; tidak ada indikator filter aktif.

### P2 — peningkatan

15. Label angka di poligon pada zoom dekat, ringkasan `aria-live` saat wilayah dipilih, keyboard pan.
16. Empty state peta, tombol coba lagi saat batas gagal dimuat, skeleton saat memuat.
17. Ekspor CSV register terfilter.
18. Layer laporan warga `PUBLISHED` (dengan consent titik) — keputusan produk.
19. Performa: `styledCollection` membangun ulang tiga koleksi setiap agregat berubah; marker tampilan
    jenis pekerjaan dibangun ulang seluruhnya.

## Fase 0 — selesai 11 November 2026

- [x] Kelas kelurahan memakai kuantil; legenda mengikuti tingkat.
- [x] Legenda ringkas, bisa ditutup, bawaan tertutup di bawah 1024 px; penjelasan pindah ke
      **Tentang peta**.
- [x] Kartu penjelasan kanan-atas dihapus; catatan hanya untuk paket tanpa wilayah.
- [x] Tombol **Seluruh kota** (mengembalikan extent tanpa mengubah filter).
- [x] Pindah ke RW memperbesar ke kelurahan terpilih atau ke zoom baca RW.
- [x] Filter kecamatan/kelurahan menggerakkan peta; zoom kelurahan diperbaiki.
- [x] `kontrak` dan `desa` ditulis/dibaca dari URL; slug region tidak ditanam.
- [x] Badge presisi di register dan panel.
- [x] "N dari M paket" dan baris **Filter aktif** (tanpa tombol reset).
- [x] `focus-visible` pada kontrol peta, kanvas fokusabel, `prefers-reduced-motion` dihormati.
- [x] Pilihan kelurahan direset saat wilayah berubah agar filter tidak saling bertentangan.

## Fase 1 — struktur interaksi (selesai 11 November 2026)

- [x] Klik poligon = filter ke wilayah itu (kecamatan/kelurahan) + sorot; baris **Filter aktif**
      menyebut wilayahnya. Perilaku "paket contoh acak" dihapus; paket hanya dibuka dari register.
- [x] Mobile: segmented **Peta / Daftar** (peta lebih dulu) dan filter yang bisa dilipat dengan
      penanda jumlah filter aktif.
- [x] Panel paket: tautan bukti SPSE/INAPROC dan baris **Selisih pagu** (rupiah + persen dari pagu).
- [x] Tampilan jenis pekerjaan: isi poligon = jumlah paket, satu ikon jenis dominan per wilayah,
      warna ikon dari palet biru. Tooltip tetap memuat semua jenis.
- [x] Palet anggaran: ramp biru, legenda menyatakan "skala nilai pagu, bukan status atau peringatan".
- [x] Register: seluruh baris dapat diklik (tombol penuh, sorotan baris terpilih) dan tetap
      menyediakan "muat paket lagi". Sort belum ada karena API belum menerima parameter urutan.

## Fase 2 — peningkatan (selesai 11 November 2026)

- [x] Empty state peta saat filter tidak menghasilkan paket; tombol **Coba lagi** saat batas gagal
      dimuat.
- [x] Label angka paket pada poligon di zoom ≥ 12,5 (minzoom), dengan halo putih.
- [x] Ringkasan wilayah untuk pembaca layar: hitungan pada `aria-live` menyebut wilayah terpilih;
      kanvas fokusabel dengan instruksi `aria-describedby`.
- [x] Performa: hanya tingkat poligon yang tampil dibangun ulang (`setData`); tingkat lain dibangun
      saat dipilih. Ikon jenis pekerjaan hanya untuk wilayah di viewport dan diperbarui saat peta
      berhenti bergerak.
- [x] Sort register: `sort` di `GET /api/packages` (`pagu-desc`, `pagu-asc`, `nama`), kontrol
      **Urutkan** di filter, parameter URL `urut`.
- [ ] Ekspor CSV register terfilter (dilewati atas permintaan).
- [ ] Diskusi produk: layer laporan warga terverifikasi di peta yang sama.

## Kriteria penerimaan Fase 0

- Setiap tingkat koroplet memakai minimal empat kelas terisi dan tidak ada kelas yang memuat lebih
  dari separuh wilayah.
- Legenda tidak menutupi lebih dari sepertiga tinggi peta pada 390×844 dan dapat ditutup.
- URL memuat `tahun`, `kontrak`, `desa`, `jenis`, `lokasi`, `tampilan`, `q`; memuat ulang URL
  mengembalikan filter dan jumlah yang sama.
- Memilih kecamatan menggerakkan kamera ke kecamatan itu; **Seluruh kota** mengembalikan extent kota
  tanpa mengubah filter.
- Setiap baris register dan panel paket menampilkan badge presisi lokasi bila paket punya anchor.
- `npm run lint` hijau.

## Fase 3 — peta menyatakan isinya (selesai 11 November 2026)

- [x] **Ringkasan kohort di atas peta**: jumlah paket (dengan penyebut seluruh region), pagu,
      pagu rata-rata, cakupan rekam penyedia beserta jumlah penyedia unik, dan bar komposisi
      jenis pekerjaan. Angka dihitung server dari hasil filter **tanpa** `bbox`, sehingga tidak
      berubah saat peta digeser. Angka "N dari M paket" yang dulu di baris filter dipindah ke sini
      agar tidak ada dua sumber untuk satu angka.
- [x] **Tema pindah ke peta**: segmented **Jumlah / Pagu / Jenis** di atas kanvas, satu tempat
      dengan **Kecamatan / Kelurahan / RW**. Pemilih "Tampilan" di baris filter dihapus.
- [x] **Legenda menyatakan sebaran**, bukan hanya warna: jumlah wilayah per kelas di tiap baris,
      label pagu ringkas (`Rp2–3,2 Miliar`), dan ramp lima kelas dengan ujung terang yang lebih
      gelap agar terbaca di atas Positron.
- [x] **Tema jenis pekerjaan tanpa ikon**: isi poligon = jenis yang mencakup lebih dari separuh
      paket; wilayah tanpa jenis dominan diberi abu-abu "campuran". Marker bulat dihapus (aturan 5
      dan performa); komposisi lengkap tetap di tooltip.
- [x] **Tabel per kecamatan** (buka-tutup di ringkasan): paket, pagu, cakupan rekam, jenis dominan.
      Klik nama kecamatan menyaring register; agregat kecamatan sengaja tidak dibatasi viewport agar
      tabel tidak kehilangan baris.
- [x] `min-w-0` pada kolom grid peta/register dan `map.resize()` setelah gaya peta siap.
- [x] Efek lapisan berhenti bila `map.isStyleLoaded()` masih salah; sebelumnya galat
      "Style is not done loading" menjatuhkan seluruh komponen peta.

Belum dikerjakan dari daftar tema: cakupan rekam sebagai koroplet, konsentrasi penyedia,
selisih pagu–kontrak, metode pengadaan, perbandingan tahun, dan laporan warga. Perluasan
`RoadAreaAggregate` (satu lintasan, field aditif) sudah disiapkan lewat `withContract`.

## Evaluasi

Perubahan ini berbasis review heuristik dan pemeriksaan visual, bukan studi pengguna terukur. Studi
tugas berikutnya: apakah pengguna baru menemukan wilayah, memahami bahwa warna berarti jumlah paket,
dan membuka paket yang benar tanpa bantuan; ukur tingkat keberhasilan, salah langkah, dan waktu.
