/** Slug stabil untuk nama penyedia (dipakai server dan klien). */
export function slugPenyedia(nama: string) {
  return nama
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}
