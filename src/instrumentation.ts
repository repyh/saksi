/**
 * Hook startup server Next. Penjadwal ingestion dimuat hanya di runtime Node dan hanya di
 * luar fase build, supaya `next build` tetap berjalan tanpa DATABASE_URL dan tanpa menjadwalkan
 * pekerjaan.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { mulaiPenjadwal } = await import("./server/scheduler/ingest-scheduler");
  mulaiPenjadwal();
}
