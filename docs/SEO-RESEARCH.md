# Riset SEO untuk SAKSI

Catatan ini merangkum rekomendasi dari Google Search Central dan dokumentasi Next.js 16 yang tersedia di `node_modules/next/dist/docs/`. SEO membantu crawler memahami dan menemukan halaman, tetapi tidak menjamin crawl, indexing, ranking, maupun tampilan rich result.

## Rekomendasi

### Metadata, judul, dan deskripsi

- Tetapkan `title` dan `description` lewat `Metadata` pada root layout sebagai default, lalu isi metadata spesifik pada halaman publik dan `generateMetadata` untuk halaman dinamis. Next.js menghasilkan tag `<head>` dari API ini; metadata hanya boleh diekspor dari Server Components. [Next.js: Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) · [Next.js: generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata)
- Buat judul ringkas, deskriptif, sesuai bahasa/konten halaman, dan berbeda antarhalaman; samakan maksudnya dengan H1 yang terlihat. Google menyusun title link secara otomatis dari `<title>`, heading, teks menonjol, tautan, `og:title`, dan sumber lain, sehingga judul yang disetel bukan jaminan teks hasil pencarian. [Google: Title links](https://developers.google.com/search/docs/appearance/title-link)
- Tulis deskripsi unik dan faktual per halaman penting. Google biasanya membentuk snippet dari konten halaman dan hanya kadang memakai meta description bila lebih tepat; snippet dapat berbeda menurut kueri dan dipotong sesuai ruang. [Google: Snippets and meta descriptions](https://developers.google.com/search/docs/appearance/snippet)

### Canonical dan robots

- Set `metadataBase` ke origin produksi yang benar agar URL metadata relatif seperti canonical/OG menjadi absolut; gunakan `alternates.canonical` untuk URL pilihan. Pastikan sitemap, canonical, redirect, dan URL publik sepakat pada host/protokol/path. Google memperlakukan canonical sebagai petunjuk, bukan perintah. [Next.js: Metadata fields](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#metadata-fields) · [Google: Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization) · [Google: Specify a canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- Pakai `robots` metadata (`index: false`, `follow: false`) atau header `X-Robots-Tag` untuk halaman yang tidak patut masuk hasil pencarian. Jangan blokir URL tersebut di `robots.txt`: crawler harus dapat membacanya agar melihat `noindex`. `robots.txt` mengatur crawling, bukan penghapusan indexing. [Next.js: generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata#robots) · [Google: Block indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- Tinjau khusus `/login`, `/register`, `/dashboard`, `/laporan` (form), halaman berparameter yang tidak memberi konten publik mandiri, serta route API. Beri `noindex` pada halaman privat/utility yang memang tidak ditujukan untuk pencarian; jangan memasukkan endpoint API atau konten privat ke sitemap. Ini rekomendasi penerapan untuk SAKSI berdasarkan fungsi route, bukan aturan Google yang otomatis mengklasifikasikan route tersebut.

### Open Graph, Twitter, dan gambar pratinjau

- Isi `openGraph` dan `twitter` metadata dengan judul, deskripsi, URL kanonis, serta gambar yang cocok dengan halaman. File `opengraph-image` dapat disediakan di root atau per segmen; segmen yang lebih spesifik menang. Next.js juga menyediakan `ImageResponse` untuk OG dinamis. [Next.js: Metadata and OG images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) · [Next.js: opengraph-image](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image)
- Pilih gambar yang relevan, tajam, beresolusi tinggi, dan tidak terlalu lebar/tinggi; jangan mengandalkan logo generik sebagai gambar utama halaman. Google menyarankan `og:image` sebagai salah satu sinyal gambar pilihan. Pastikan aset dapat diakses crawler dan representatif atas halaman. [Google: Image SEO](https://developers.google.com/search/docs/appearance/google-images)
- Twitter metadata dapat diatur melalui field `twitter` di API Metadata Next.js. Pastikan preview diverifikasi di platform tujuan; metadata tidak menjamin platform akan menampilkan preview yang sama.

### Sitemap dan robots.txt

- Next.js App Router mendukung `app/sitemap.ts` dan `app/robots.ts` sebagai file konvensi metadata. Sitemap dinamis dapat mengembalikan URL publik absolut; robots dapat mengeluarkan aturan crawl dan URL sitemap. [Next.js: sitemap](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap) · [Next.js: robots](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots)
- Sitemap hanya berisi URL kanonis yang memang diinginkan muncul di Search, dengan respons layak dan konten publik. Untuk SAKSI, evaluasi tiap kelompok: halaman utama, metode, kebijakan, daftar/detail paket dan penyedia, serta laporan publik yang disetujui. Keluarkan login, dashboard, form laporan, API, alias/duplikat `/paket` (dengan `/project` dialihkan permanen), dan halaman laporan yang `noindex`. Google menyatakan sitemap membantu discovery tetapi tidak menjamin crawl atau indexing; URL sitemap sebaiknya absolut dan kanonis. [Google: Sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview) · [Google: Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- `SITE_URL` memakai origin HTTPS publik `https://saksi.repyh.my.id` sebagai konfigurasi produksi. Origin ini dipakai bersama oleh `metadataBase`, canonical, Open Graph, robots.txt, dan sitemap; nilai environment deployment dapat menggantikannya. Cantumkan sitemap di `robots.txt` dan submit di Search Console bila digunakan. Sitemap bukan alat untuk menghapus URL dari indeks.

### Structured data

- Tambahkan JSON-LD hanya bila tipe dan informasinya benar-benar cocok dengan konten yang terlihat. Google merekomendasikan JSON-LD, mengharuskan data terstruktur sesuai pedoman umum dan spesifik fitur, serta tidak menjamin rich result meski markup valid. Jangan mengarang rating, organisasi, lokasi, atau klaim yang tidak ditampilkan. [Google: Structured data introduction](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data) · [Google: General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- Next.js merekomendasikan script `application/ld+json` pada Server Component; escape karakter `<` dari `JSON.stringify` untuk mengurangi risiko injeksi HTML saat nilai berasal dari data. [Next.js: JSON-LD guide](https://nextjs.org/docs/app/guides/json-ld)
- Untuk SAKSI, `WebSite`/`Organization` mungkin relevan bila detail organisasi dan identitas resminya jelas. Hindari `Product`, `Review`, atau klaim rich result yang tidak menggambarkan layanan dengan benar. Gunakan hanya tipe yang didukung Google untuk fitur Search yang memang dikejar.

### Indexability dan privasi SAKSI

- Indexing mengharuskan halaman dapat diakses crawler dan punya konten publik yang layak. `noindex` bukan kontrol akses: autentikasi, otorisasi server, dan pembatasan data tetap wajib. Google tidak akan melihat `noindex` pada halaman yang diblokir robots.txt atau tidak dapat diakses. [Google: Block indexing with noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- Laporan publik SAKSI memiliki consent lokasi presisi dan endpoint detail publik yang sengaja tidak membuka identitas, deskripsi, petunjuk lokasi, foto, atau koordinat. Index hanya halaman publik yang memang disetujui dan aman untuk dibagikan; jangan menyisipkan data internal ke metadata, JSON-LD, OG image, atau sitemap. Kewajiban ini mengikuti batas privasi proyek di `AGENTS.md` dan `docs/ARCHITECTURE.md`.
- Hindari URL filter/search berparameter sebagai ribuan halaman tipis atau duplikat. Pilih versi kanonis untuk halaman yang sama, jangan mengandalkan `noindex` untuk memilih canonical, dan gunakan internal link HTML yang dapat dirayapi menuju halaman publik yang penting. [Google: Canonicalization](https://developers.google.com/search/docs/crawling-indexing/canonicalization) · [Google: Sitemap overview](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)

## Pitfalls yang perlu dicegah

1. Canonical/sitemap memakai origin berbeda atau `localhost`; staging ikut terindeks.
2. URL privat diblokir robots.txt sehingga crawler tak melihat `noindex`; atau `noindex` keliru diterapkan pada halaman kanonis publik.
3. Sitemap memuat URL API, parameter filter, halaman duplikat, atau data laporan yang tidak pantas dipublikasikan.
4. Semua halaman memakai title/description sama, sementara teks metadata tidak sesuai konten/H1.
5. OG image tidak bisa diambil crawler, memakai gambar tak relevan, atau metadata dinamis mencoba membaca data privat.
6. JSON-LD berisi klaim yang tak terlihat pengguna, data tak akurat, atau string tak di-escape.
7. Mengharapkan sitemap, canonical, meta description, structured data, atau metadata sosial memaksa Google/platform sosial menampilkan hasil tertentu; semuanya adalah sinyal/petunjuk, bukan jaminan.

## Konteks implementasi yang diperiksa

Audit awal menemukan metadata global yang belum lengkap, belum ada robots.txt atau gambar OG, localhost fallback di sitemap, duplikasi detail `/paket/[rup]`, serta noindex yang belum konsisten. Implementasi SEO kini menyediakan metadata per route, canonical URL, robots.txt, sitemap yang hanya memuat keluarga URL paket kanonis, noindex untuk halaman akun/formulir/detail laporan, dan JSON-LD WebSite/BreadcrumbList. `/paket` adalah satu-satunya direktori dan detail paket; `/project` dialihkan permanen ke sana. Gambar OG aktif khusus untuk `/peta-pekerjaan`: endpoint menghasilkan pratinjau batas kota atau wilayah terpilih dari GeoJSON lokal, menambahkan filter URL yang aman, memakai origin dan label wilayah dari konfigurasi, dan jatuh ke kartu tanpa peta bila berkas batas tidak terbaca; gambar OG global untuk halaman lain tetap dinonaktifkan. Generator desain dasar tetap disimpan di `src/components/seo/opengraph-image.tsx`. Sitemap dan robots.txt telah diperiksa pada build dengan origin `https://saksi.repyh.my.id`.
