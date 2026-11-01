# SAKSI

**SAKSI** (_Sistem Akuntabilitas & Komparasi Spasial Infrastruktur_) memudahkan penelusuran paket
pekerjaan jalan publik di **Kota Tangerang** dengan menghubungkan riwayat pengadaan dengan lokasi atau wilayah
yang disebut dalam paket tersebut.

> Wilayah yang dipetakan atau laporan warga adalah tanda untuk ditinjau, bukan bukti pelanggaran
> maupun jaminan tindakan pemerintah.

## Implementasi saat ini

- Landing page (`/`) berisi ringkasan audit, angka anggaran bersumber, dan peta interaktif.
- Peta (`/project`) berupa **koroplet batas resmi**: poligon RW pada zoom ≥ 12 dan poligon
  kelurahan di bawahnya. Tidak ada pin per paket. Paket dihubungkan pada suatu wilayah, bukan pada
  koordinat lokasi pekerjaan.
- Filter tahun anggaran, kecamatan, jenis pekerjaan, dan pencarian teks bebas (wilayah, ruas jalan,
  atau kode RUP).
- Halaman detail paket dan alur pelaporan (`/laporan`, `/laporan/paket/[rup]`) yang dimulai dari
  sebuah paket lalu memeringkat kandidat paket berdasarkan RW → kelurahan → penanda (landmark).
- Data paket dibaca oleh repository server-only. Render pertama memakai Next.js Server Component.
  Filter interaktif memanggil `GET /api/packages`. Adapter membaca snapshot JSON yang tersimpan di repo.
- Better Auth dan Prisma sudah terpasang untuk penggunaan di server. Keduanya **belum digunakan untuk FDS**.
- Draf laporan disimpan di perangkat melalui IndexedDB (`saksi-local-reports`). API pengiriman belum
  ada.

## Implementasi yang tersisa

- API pengiriman laporan dengan moderasi dan pengendalian penyalahgunaan (saat ini draf hanya lokal)
- Model domain Prisma dan repository berbasis Postgres/PostGIS
- Worker scraper terjadwal untuk sumber dataset, lengkap dengan provenance dan
  riwayat eksekusi
- Query peta berbasis viewport dan register paket yang paged
- Halaman metodologi yang dipublikasikan dan metadata sumber untuk setiap metrik yang ditampilkan

## Teknologi

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, React Icons
- Leaflet / React Leaflet dengan tile dari OpenStreetMap
- Supabase Postgres + PostGIS, Prisma ORM, dan Better Auth
- Instalasi PWA dan fallback offline

## Menjalankan proyek

### Prasyarat

- Node.js 24 LTS. Bun 1.4.2 juga bisa dipakai.
- Database Postgres bersifat **opsional**.

### Instalasi lokal

```bash
npm ci            # atau: bun install
npm run dev       # http://localhost:3000
```

> Langkah-langkah di bawah tidak diperlukan untuk menjalankan proyek ini karena saat ini belum
> menggunakan database maupun autentikasi.

`prisma generate` berjalan otomatis lewat `predev`/`prebuild` dan tidak membutuhkan database.

Untuk mengaktifkan fitur server opsional, salin `.env.example` ke `.env.local` lalu isi
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `DIRECT_URL`, dan `DATABASE_POOL_MAX`.

Ambil URL koneksi dari **Supabase Dashboard → Connect**.

```bash
npm run db:migrate -- --name init
npm run db:deploy     # terapkan migrasi yang sudah di-commit
npm run db:status     # cek status migrasi
```

### Skrip utama

| Perintah                                                          | Kegunaan                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `npm run dev`                                                     | Menjalankan Next.js dalam mode pengembangan          |
| `npm run build`                                                   | Build produksi (harus lolos tanpa `DATABASE_URL`)    |
| `npm run lint`                                                    | ESLint                                               |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:status`  | Perintah Prisma                                      |

## Struktur repository

```text
src/
  app/          # Halaman dan route handler HTTP
  contracts/    # DTO request dan response yang dipakai bersama
  features/     # UI browser dan interaksi fitur
  server/       # Use case, antarmuka repository, adapter server-only
  lib/          # Klien Better Auth dan Prisma
data/           # Snapshot sumber yang berversi
public/data/    # GeoJSON batas yang disajikan ke peta
prisma/         # Skema dan migrasi Postgres
```

## Identitas Tim

Tim minim literasi - Universitas Pelita Harapan

- Christian Jonathan Hiroshi Oroh
- Christopher Marchel Mark Gijoh
- Valdosi Hilkia Masehito Djarang

> MIA 2026 - Web in Action
