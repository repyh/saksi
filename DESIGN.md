# Design System — SAKSI

**Dunia visual: _Register Lapangan._**
SAKSI digambar seperti **lembar register pengukuran**: kertas kerja surveyor yang mencatat setiap
paket sebagai satu baris, setiap angka dalam kolom tabular, setiap ketidakpastian diberi tanda.
Bukan poster, bukan koran, bukan dashboard SaaS. Identitasnya datang dari **cara data diukur dan
dinyatakan**, bukan dari ornamen kertas.

**Gerakan tanda tangan (satu, dan hanya satu):** *presisi sebagai bahasa visual.* Setiap titik data
membawa **glyph presisi** yang sama di peta, tabel, badge, dan panel detail — titik (desa), garis
(koridor), kotak (kecamatan), garis putus (tanpa lokasi). Bila pengguna melihat satu glyph, ia sudah
tahu seberapa besar ia boleh percaya posisi itu.

**Yang ditolak:** kartu-ikon-judul sebagai struktur halaman · pil dan chip bulat sebagai navigasi ·
drop shadow · sudut >6 px · gradien · emoji sebagai ikon · mono sebagai kostum "teknis" (mono hanya
untuk angka, kode, satuan, tanggal) · estetika poster krem-editorial (krem di sini adalah kertas
kerja, bukan gaya) · tuduhan dalam copy.

---

## 1. Warna

Satu ground kertas, satu tinta, satu saksi merah, dua warna status, dua warna data. Tidak ada warna
dekoratif. Rasio kontras diukur terhadap `--color-paper` (#FBF7F0).

| Token | Hex | Peran | Kontras |
|---|---|---|---|
| `--color-paper` | `#FBF7F0` | ground seluruh halaman | — |
| `--color-paper-recess` | `#F4EEE4` | bidang tenggelam: header tabel, filter sticky, chrome peta | — |
| `--color-card` | `#FFFDF8` | panel, input, popup | — |
| `--color-ink` | `#16120E` | teks utama, tombol primer, garis aktif | 16,9:1 |
| `--color-ink-soft` | `#3A332B` | teks sekunder padat | 10,6:1 |
| `--color-muted` | `#6B6259` | label, keterangan, placeholder | 5,5:1 |
| `--color-line` | `#E3DCD1` | hairline pemisah, border kontrol | non-teks |
| `--color-line-strong` | `#CFC4B5` | header kolom, border kontrol aktif | non-teks |
| `--color-accent` | `#B3261E` | **saksi**: fokus, filter aktif, CTA lapor, penanda terpilih | 6,1:1 |
| `--color-accent-deep` | `#8B1B15` | hover/active dari accent, teks accent di atas tint | 8,2:1 |
| `--color-accent-soft` | `#FBEAE7` | ground baris terpilih, tint peringatan | — |
| `--color-badge-asli` | `#1B5C47` | badge data resmi (hijau) | 6,6:1 |
| `--color-badge-asli-soft` | `#E7EFE9` | ground badge resmi | — |
| `--color-badge-simulasi` | `#8A5A00` | badge simulasi (amber) | 5,8:1 |
| `--color-badge-simulasi-soft` | `#FAEECD` | ground badge simulasi | — |
| `--color-badge-presisi` | `#5B5348` | badge presisi netral, titik kecamatan | 6,4:1 |
| `--color-badge-presisi-soft` | `#EDE7DC` | ground badge presisi | — |
| `--color-koridor` | `#1D4E89` | garis & titik koridor di peta | 7,7:1 |
| `--color-kabupaten` | `#A79C8C` | glyph tanpa lokasi (tidak pernah jadi marker) | non-teks |

**Aturan pemakaian warna**
- Merah **tidak** dipakai untuk mempermanis. Tugasnya: (1) garis saksi 2 px di puncak halaman,
  (2) state terpilih/aktif, (3) CTA `Laporkan kerusakan`, (4) cincin fokus. Tidak pernah sebagai
  latar area besar.
- Hijau hanya untuk "data resmi"; amber hanya untuk "simulasi". Keduanya tidak pernah dipakai untuk
  status lain, supaya badge bisa dibaca dari warna sebelum teksnya dibaca.
- Warna peta: desa = accent, koridor = `--color-koridor`, kecamatan = `--color-badge-presisi`.
  Tile OSM diredam (`saturate(.45) contrast(1.02) brightness(1.03)`) agar peta duduk di atas kertas
  tanpa berteriak.
- Tidak ada mode gelap di FDS. `color-scheme: light` dikunci.

---

## 2. Tipografi

Tanpa font baru (batasan brief). Identitas dibawa oleh **pembagian tugas dua keluarga**:

- **Prosa** — `--font-sans` (system UI, Inter bila terpasang). Berat 400/500/600.
- **Ukuran** — `--font-mono` untuk **semua** angka, kode RUP, satuan, tanggal, label struktural.
  `font-variant-numeric: tabular-nums`, tracking `-0.02em`…`-0.04em` pada ukuran besar.

Tidak ada serif. Tidak ada display face di luar dua ini.

| Token | px | Dipakai untuk | Aturan |
|---|---:|---|---|
| `--text-2xs` | 10.5 | badge, kode, satuan | mono, uppercase, tracking `0.06em` |
| `--text-xs` | 11.5 | label kolom, metadata | mono, uppercase, tracking `0.12em`, warna muted |
| `--text-sm` | 13 | sel tabel, kontrol, keterangan | sans 400; baris 1.5 |
| `--text-base` | 15 | prosa, isi form | sans 400; baris 1.55; maks 68ch |
| `--text-lg` | 17 | judul bagian | sans 600; baris 1.3 |
| `--text-xl` | 22 | judul halaman | sans 600; tracking `-0.015em` |
| `--text-2xl` | 28 | angka register | mono 500; tracking `-0.03em` |
| `--text-metric` | clamp(22, 2.2vw, 32) | angka strip metrik | mono 500; tracking `-0.035em` |

**Aturan angka:** `.num` wajib pada setiap nilai. Persen dan desimal memakai koma (`92,5%`),
ribuan memakai titik (`3.602`). Pagu ringkas: `Rp848,60 M` · `Rp115,17 jt` · `Rp681.000`; prosa
memakai kata penuh (`Rp848,60 Miliar`). Tidak pernah `Rp848.600.673.650` di UI.

**Ritme vertikal:** lebih banyak ruang di atas judul daripada di bawahnya. Satu skala spasi saja
(kelipatan 4): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64.

---

## 3. Grid, bentuk, dan elevasi

- **Grid:** 12 kolom. Workspace peta maks 1560 px; halaman lapor maks 1180 px. Gutter 20 px (mobile)
  / 32 px (≥1024).
- **Sudut:** `--radius: 2px` untuk kontrol, panel, badge, popup. Full-bleed (peta, strip) = 0.
  Tidak ada `rounded-xl`, tidak ada pil — kecuali `<input type=range>` milik browser.
- **Garis:** hairline 1 px adalah satu-satunya alat pemisah. 2 px hanya untuk garis saksi di puncak
  halaman dan cincin fokus. Tidak pernah lebih.
- **Elevasi:** tanpa `box-shadow`. Panel dibedakan oleh bidang (`card` di atas `paper`) + hairline.
  Bar sticky memakai `paper-recess` + hairline bawah; **bukan** backdrop blur.
- **Ikon:** SVG authored, stroke 1.5 px, `currentColor`, kotak 16/20/24. Tidak ada emoji, tidak ada
  ikon pustaka yang gayanya berbeda.

---

## 4. Glyph presisi (komponen inti)

Ukuran 10×10 px di dalam tabel, 12×12 di badge, 14×14 di legenda peta. Digambar dengan SVG agar
tajam di semua DPI; warna mengikuti token.

| Presisi | Glyph | Teks wajib | Warna |
|---|---|---|---|
| `Desa/Kelurahan` | ● titik penuh r=3.5 | `Titik Desa` | accent |
| `Garis Koridor` | ─ garis 2 px | `Garis Koridor` | `--color-koridor` |
| `Kecamatan` | ■ kotak 7 px | `Kecamatan` | `--color-badge-presisi` |
| `Kabupaten` | ┅ garis putus | `Tanpa lokasi` (bukan badge peta) | `--color-kabupaten` |

Marker peta: `circleMarker` r=4 (desa/kecamatan), r=3 (koridor), stroke `ink/.35` 1 px; terpilih:
r=7, stroke accent 2 px + cincin luar r=11 `accent/.35` 1 px. Renderer canvas.

---

## 5. Komponen

### 5.1 Badge / stempel
Tinggi 20 px, padding 0 6 px, border 1 px, radius 2 px, mono `--text-2xs`, uppercase.
- `badge--asli` — border & teks `--color-badge-asli`, ground `--color-badge-asli-soft`,
  teks persis `DATA RESMI (SIRUP / BINA MARGA)`.
- `badge--simulasi` — **border putus-putus** & teks `--color-badge-simulasi`, ground
  `--color-badge-simulasi-soft`, teks persis `SIMULASI PROTOTIPE`. Border putus = "belum nyata".
- `badge--presisi` — border & teks `--color-badge-presisi`, ground transparan, didahului glyph.

### 5.2 Strip metrik (header register)
Satu baris, bukan hero. Kolom dipisah hairline vertikal, semua baseline rata bawah:
`nilai` (mono `--text-metric`) di atas `label` (`--text-xs` uppercase) + catatan sekunder
(`--text-2xs`, muted). Di mobile menjadi grid 2 kolom tanpa hairline vertikal. Sel terakhir
menyatakan kebalikannya: **271 paket tanpa lokasi, tidak dipetakan** — angka jujur ikut di header.

### 5.3 Filter bar
Sticky di bawah header, ground `--color-paper-recess`, hairline bawah.
Segmented control = satu kotak ber-border dengan pembatas 1 px; opsi aktif = ground ink, teks paper.
`<select>` asli untuk kecamatan (bukan dropdown buatan). Kanan: `3.602 paket` + tombol `Atur ulang`.
Mobile: kontrol membungkus dua baris; peta tetap ≥60vh.

### 5.4 Register tabel (daftar paket)
Header kolom `--text-xs` uppercase di ground `paper-recess`, hairline kuat di bawahnya.
Baris ≥44 px, hairline `line`, hover `paper-recess`, fokus `outline` accent 2 px ke dalam.
Tiga kolom fisik: **Paket** (glyph presisi + nama 2 baris + baris meta
`desa · kecamatan · tahun`), **Pagu** (rata kanan, tabular), **Presisi** (badge; disembunyikan
di bawah 1280 px karena lebar panel register 420–470 px — desa/kecamatan/tahun tetap terbaca di
baris meta). Baris tanpa lokasi memakai label `Kab. Tangerang (Umum)` (glyph garis putus) dan tidak
melakukan `flyTo`.

### 5.5 Panel detail
Menggantikan daftar di kolom kanan (bukan modal). Kepala: `Kembali ke daftar` (ghost) + label
`Detail paket`. Badan yang bisa digulir: badge presisi + badge data resmi, nama paket `--text-lg`,
`kode_rup` mono, daftar `label : nilai` (kolom label 108 px) dengan baris hairline, catatan jendela
pemeliharaan, sumber data. Kaki **tetap** (tidak ikut tergulir): tombol `Laporkan kerusakan` accent
selebar panel.

### 5.6 Stepper (alur lapor)
Tiga langkah horizontal, mono `01 02 03` (urutan membawa informasi, jadi angka sah).
Garis penghubung 1 px `line`; langkah aktif = angka di kotak ink, garis di atas menjadi accent 2 px;
langkah sebelum langkah aktif yang sudah terisi = centang authored. Semua langkah bisa diklik;
lompat maju tanpa syarat memunculkan pesan kesalahan di dekat tombol lanjut.
Di bawah 640 px stepper menjadi **rel vertikal** (garis kiri 2 px, langkah aktif bertinta
`paper-recess`) karena tiga kolom tidak cukup untuk label Indonesia.

### 5.7 Field
Label `--text-xs` mono uppercase di atas kontrol; kontrol tinggi 40 px (44 px di mobile),
ground `card`, border 1 px `line`, radius 2 px, padding 0 10 px.
Fokus: border accent + ring 2 px `accent/25`. Error: border accent + pesan `--text-sm` dengan ikon.
Placeholder memakai `muted` (5,5:1 — bukan abu-abu pucat).

### 5.8 Chip pilihan (penyebab)
Kotak 1 px `line`, radius 2 px, tinggi 30 px, mono `--text-xs`. Aktif = ground ink, teks paper,
tanpa centang emoji — dipakai glyph centang authored.

### 5.9 Tombol
- `primer` — ground ink, teks paper, 1 px ink, radius 2 px, tinggi 40/44 px, padding 0 16 px.
- `saksi` (accent) — hanya untuk aksi lapor.
- `datar` — transparan + border 1 px `line-strong`; hover ground `paper-recess`.
- `ghost` — teks + underline offset 3 px.
Fokus selalu `outline: 2px solid accent; outline-offset: 2px`.

### 5.10 Catatan status (callout)
Bukan kartu: bidang `accent-soft`/`asli-soft`/`simulasi-soft` dengan border 1 px senada, ikon 20 px,
teks `--text-sm`. Dipakai untuk `Tidak Dapat Ditautkan`, hasil pencocokan, dan info privasi.

---

## 6. State

| State | Perlakuan |
|---|---|
| memuat | strip metrik menampilkan `—` + label `memuat data…`; peta ground `paper-recess` |
| kosong (filter) | satu baris teks + tombol `Atur ulang filter`; peta tetap dengan batas kabupaten |
| kosong (laporan) | penjelasan satu paragraf + CTA `Mulai laporan` di tempat daftar |
| galat data | callout accent: "Data paket gagal dimuat." + tombol `Coba lagi` |
| terpilih | baris `accent-soft`, marker accent + cincin, panel detail |
| nonaktif | opacity 40%, `cursor: not-allowed`, `aria-disabled` |

---

## 7. Gerak

Satu gerak authored: **peta bergerak ke paket** (`flyTo`, 0.9 s, ease-out) saat baris diklik.
Transisi UI 140 ms `cubic-bezier(.2,.7,.3,1)` hanya untuk warna/border. Tidak ada animasi masuk
pada data (screenshot tidak boleh menangkap elemen setengah muncul). `prefers-reduced-motion`
mematikan `flyTo` (pakai `setView`) dan seluruh transisi.

---

## 8. Aksesibilitas

Kontras minimum 4,5:1 untuk teks, 3:1 untuk teks ≥19 px. Setiap glyph presisi selalu disertai teks
(bukan warna saja). Baris tabel adalah `<tr>` yang dapat difokus dan diaktifkan dengan Enter/Space.
Peta punya alternatif tabel lengkap. Target sentuh ≥44 px di alur lapor. Bahasa halaman `id`.

---

## 9. Batasan implementasi

- Token hidup di `web/src/index.css` dalam `@theme` Tailwind 4; komponen identitas (badge, field,
  tombol, stepper, glyph) adalah kelas CSS kecil di file yang sama, bukan pustaka komponen.
- Tailwind utility untuk layout/spasi; nilai warna/ukuran selalu token, tidak pernah hex lepas.
- Data tetap di `web/public/data/`; tidak ada import JSON ke bundle.
