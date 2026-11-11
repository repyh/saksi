import { PROTECTED_AUTHORITY_CODES, type PermissionCode } from "./catalog";

/** Kode otoritas terlindungi → id akun aktif lain yang memegangnya. */
export type AuthorityHolders = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Otoritas terlindungi yang akan hilang bila `heldCodes` tidak lagi dimiliki
 * pemegangnya. `holders` sengaja hanya memuat akun aktif lain: akun nonaktif
 * tidak dihitung sebagai cadangan karena tidak dapat masuk.
 *
 * Murni supaya dapat diuji tanpa database; pemanggil menyiapkan kedua masukan.
 */
export function strandedAuthorities(
  heldCodes: Iterable<string>,
  holders: AuthorityHolders,
): PermissionCode[] {
  const held = new Set(heldCodes);
  return PROTECTED_AUTHORITY_CODES.filter((code) => held.has(code) && (holders.get(code)?.size ?? 0) === 0);
}

/** Daftar kode untuk pesan galat; urutan mengikuti katalog. */
export function describeAuthorities(codes: readonly PermissionCode[]): string {
  return codes.join(", ");
}
