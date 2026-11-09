import "server-only";
import { isDatabaseEnabled } from "./data-source";

/**
 * Kebijakan cache katalog. Semua data katalog bersifat turunan snapshot/ingestion
 * yang bertanggal, jadi aman di-cache beberapa menit dan tidak pernah memuat
 * laporan warga (laporan dibaca langsung dari database pada setiap request).
 *
 * `CATALOG_SOURCE` ikut menjadi bagian kunci cache supaya entri snapshot yang
 * terbentuk saat `next build` tanpa DATABASE_URL tidak pernah dipakai oleh
 * proses runtime yang membaca database.
 */
export const CATALOG_REVALIDATE_SECONDS = 300;
export const CATALOG_SOURCE = isDatabaseEnabled() ? "database" : "snapshot";
export const CATALOG_CACHE_TAGS = ["catalog"];
