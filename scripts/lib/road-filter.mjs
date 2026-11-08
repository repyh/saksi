// Penyaring objek pekerjaan jalan. Dipakai pembangun snapshot dan gerbang kualitas region
// supaya keduanya tidak memiliki definisi yang berbeda.

export const VERB =
  "(pekerjaan|peningkatan|rekonstruksi|pembangunan|pemeliharaan|rehabilitasi|penataan|pengaspalan|pengerasan|pembetonan|pemasangan|lanjutan|normalisasi|perbaikan|pelebaran)";
export const OBJ =
  "(jalan|jembatan|trotoar|drainase|saluran|turap|talud|paving|hotmix|rabat|gorong)";
export const BUKAN =
  "(puskesmas|sekolah|gedung|kantor|ruang|aula|klinik|posyandu|pasar|terminal|instalasi)";

export const RE_FISIK = new RegExp(
  `${VERB}[^|]{0,40}${OBJ}|${OBJ}[^|]{0,25}${VERB}`,
  "i",
);

// Prefiks ruas "Jl." / "Jl" adalah objek jalan hanya bila ia langsung mengikuti kata kerja,
// mis. "Peningkatan Jl. Lingk. RW 04". Penyebutan "Jl." sebagai alamat saja
// (mis. "... Signage di Jl. Mayjen Sutoyo") tidak dihitung sebagai objek pekerjaan.
export const RE_OBJ_JL = new RegExp(`\\b${VERB}\\s+\\bjl\\b\\.?`, "i");

export const RE_BUKAN = new RegExp(BUKAN, "i");

/** true bila nama paket menyebut objek jalan/jembatan/drainase. */
export function objekJalan(nama) {
  return RE_FISIK.test(nama) || RE_OBJ_JL.test(nama);
}

/** true bila nama paket menyebut objek non-jalan yang harus ditolak. */
export function objekLain(nama) {
  return RE_BUKAN.test(nama);
}
