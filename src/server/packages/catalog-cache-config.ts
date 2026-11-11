import "server-only";
import { isDatabaseEnabled } from "./data-source";

/**
 * Katalog sumber berubah lewat ingestion harian, bukan transaksi pengguna.
 * Cache lima menit membangun ulang indeks kontrak besar pada permintaan pengguna
 * dan menghasilkan jeda belasan detik. Pertahankan data sampai siklus harian berikutnya.
 *
 * `CATALOG_SOURCE` ikut menjadi bagian kunci cache supaya entri snapshot yang
 * terbentuk saat `next build` tanpa DATABASE_URL tidak pernah dipakai oleh
 * proses runtime yang membaca database.
 */
export const CATALOG_REVALIDATE_SECONDS = 86_400;
export const CATALOG_SOURCE = isDatabaseEnabled() ? "database" : "snapshot";
export const CATALOG_CACHE_TAGS = ["catalog"];
