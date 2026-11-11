# BRAND — SAKSI

Logo, aturan pemakaian, dan alasan di baliknya. Sumber kebenaran geometri ada di
`src/components/brand/mark-geometry.ts`; halaman ini menjelaskan cara memakainya.

Ringkas: **emblem persegi** — kotak cobalt dengan huruf yang dilubangi, dan bingkai kuning yang
bergeser di belakangnya. Dua bidang yang tidak sejajar: dua catatan yang dibandingkan.

---

## 1. Emblem

| Properti | Nilai |
|---|---|
| Jenis | Emblem / monogram dalam bidang |
| Lapisan | Bingkai kuning (belakang) + kotak cobalt dengan huruf sebagai lubang |
| Huruf | Bentuk `S` dan `Y` yang saling mengunci, dilubangi dengan `fill-rule="evenodd"` |
| Rasio | 849,49 : 1000 (±0,85) |
| Sumber | Trace `saksi.jpeg` (2048×2048) — marching squares sub-piksel + Douglas–Peucker |
| Titik | 164 titik, 2,5 KB |

Cara membacanya, berurutan sesuai kekuatan:

1. **Dua bidang bergeser** — bingkai kuning tidak sejajar dengan kotak cobalt. Inilah ide utamanya:
   dua sumber yang seharusnya identik, tetapi tidak.
2. **Huruf di dalam** — `S` yang menyambung ke bentuk bercabang di kanan. Pada 72px ke atas terbaca
   sebagai huruf; di bawah itu menjadi bentuk abstrak.

Bidang kuning **tetap ada** di versi satu warna. Ia hanya berubah warna menjadi putih, sama seperti kotak
dan hurufnya; pemisah antara bingkai dan kotak tetap berupa celah tembus pandang, sehingga dibaca sebagai
dua lembar yang tidak sejajar meski semuanya satu warna.

### Warna

| Peran | Token | Hex |
|---|---|---|
| Kotak | `--primary` | `#0058A3` |
| Bingkai | `--secondary` | `#FFDA1A` |
| Versi satu warna | `currentColor` | putih di atas cobalt/navy, `--foreground` untuk cetak |

Sumber aslinya `#1E4A8E` dan `#F7C414`. Keduanya di luar token dan sudah diselaraskan ke palet resmi.

---

## 2. Wordmark

`SAKSI` digambar sebagai path SVG, bukan teks hidup: outline Raleway Black dengan tracking ±`0.10em`
dan koreksi optis per pasangan. Nama panjang (`Sistem Akuntabilitas & Komparasi Spasial
Infrastruktur`) tetap teks hidup Open Sans.

---

## 3. Lockup

| Varian | Isi | Dipakai di |
|---|---|---|
| `mark` | emblem saja | ikon aplikasi, favicon |
| `horizontal` | emblem + wordmark | footer, panel login/register, layar sempit |
| `horizontal-full` | emblem + wordmark + garis rambut + nama panjang | navbar ≥ `sm` |
| `stacked` | emblem di atas wordmark | poster, booth |

Komponen: `<SaksiLogo variant=… tone=… size=… />` di `src/components/brand/`.

| Tone | Emblem | Wordmark | Latar |
|---|---|---|---|
| `onLight` | penuh (cobalt + kuning) | cobalt | putih |
| `onDark` | satu warna putih | putih | cobalt `#0058A3`, navy `#0A192F` |
| `mono` | satu warna navy | navy | cetak satu warna |

Di navbar `SAKSI` memakai `aria-label` karena wordmark-nya SVG; jangan hapus atribut itu saat mengubah
`src/components/navigation/nav-brand.tsx`.

---

## 4. Ukuran dan clearance

| Aturan | Nilai |
|---|---|
| Navbar | 30px (bar 64px) |
| Footer | 38px |
| Panel login/register | 24px |
| Ikon aplikasi 512 | emblem 62% kanvas, latar putih |
| Favicon | emblem 82% kanvas, latar putih |
| Clearance | ½ tinggi emblem di semua sisi, minimum 8px |

**Batas yang sudah diterima:** di bawah 32px, huruf di dalam emblem tidak lagi terbaca — yang tersisa
adalah kotak dengan coretan. Favicon 16px karena itu tampil sebagai bidang cobalt dengan bentuk samar,
bukan huruf. Ini keputusan sadar, bukan kelalaian.

---

## 5. Salah pakai

- Memakai versi penuh (dengan bingkai kuning) di atas latar berwarna — bingkai itu hanya bekerja di putih.
- Menghapus lubang huruf sehingga kotak jadi bidang polos.
- Meregangkan, memutar, atau memberi perspektif.
- Menambah stroke, bayangan, atau gradien.
- Mengganti salah satu warna tanpa mengganti tokennya.
- Menaruh emblem di bawah 24px di dalam UI (kecuali favicon).

---

## 6. Berkas

| Berkas | Isi |
|---|---|
| `src/components/brand/mark-geometry.ts` | path emblem (dua lapis) dan wordmark — sumber kebenaran |
| `src/components/brand/saksi-mark.tsx` | emblem, varian `penuh` dan `mono` |
| `src/components/brand/saksi-wordmark.tsx` | wordmark |
| `src/components/brand/saksi-logo.tsx` | empat varian lockup × tiga tone |
| `src/features/pwa/components/app-icon.tsx` | ikon PWA |
| `src/app/favicon.ico` | 48/32/16 px |
| `src/components/seo/opengraph-image.tsx` | kartu 1200×630 (generator, sengaja di luar `src/app`) |
| `src/components/seo/og-fonts.ts` | subset Raleway 800 + Open Sans 400/600 untuk `ImageResponse`; teks di kartu harus memakai salah satu berat itu |
| `public/fonts/*.ttf` | tiga subset font (OFL), 31 KB total |

Aset statis untuk poster atau cetak tidak disimpan di repo; hasilkan saat dibutuhkan:

```bash
npm run brand:assets   # menulis public/brand/*.svg
```
