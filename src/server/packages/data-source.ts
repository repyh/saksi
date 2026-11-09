import "server-only";

/**
 * Sumber data paket aktif. Database menjadi sumber utama bila DATABASE_URL diisi;
 * snapshot tetap menjadi jalur cadangan supaya `next build` dan lingkungan tanpa
 * database dapat berjalan.
 */
export function isDatabaseEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
