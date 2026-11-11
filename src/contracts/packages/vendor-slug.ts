import { kunciPenyedia } from "./vendor-name";

/**
 * Slug stabil untuk nama penyedia (dipakai server dan klien), diturunkan dari kunci
 * penyedia yang sama dengan pembanding kontrak. Varian penulisan (`CV. JABARU`,
 * `CV JABARU`, `CVKARYA`) karena itu menuju slug yang sama, bukan halaman ganda.
 */
export function slugPenyedia(nama: string) {
  return kunciPenyedia(nama)
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}
