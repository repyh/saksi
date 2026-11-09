/**
 * Badge "SIMULASI PROTOTIPE" pada alur lapor dan laporan warga.
 * Bawaannya mati; nyalakan dengan NEXT_PUBLIC_SIMULATION_BADGE=1.
 * Nilai NEXT_PUBLIC_* ditanam saat build, jadi ubah lalu build ulang.
 */
export function simulationBadgeEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_SIMULATION_BADGE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "on" || value === "ya";
}
