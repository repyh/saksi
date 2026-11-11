import { expect, test } from "bun:test";
import { PROTECTED_AUTHORITY_CODES } from "./catalog";
import { describeAuthorities, strandedAuthorities, type AuthorityHolders } from "./last-authority";

function holders(entries: Record<string, string[]>): AuthorityHolders {
  return new Map(Object.entries(entries).map(([code, users]) => [code, new Set(users)]));
}

test("otoritas yang masih dipegang akun aktif lain tidak dilaporkan", () => {
  const hasil = strandedAuthorities(
    ["access.presets.apply", "access.users.disable"],
    holders({ "access.presets.apply": ["user-b"], "access.users.disable": ["user-b"] }),
  );

  expect(hasil).toEqual([]);
});

test("otoritas tanpa pemegang aktif lain dilaporkan", () => {
  const hasil = strandedAuthorities(
    ["access.presets.apply", "access.users.delete"],
    holders({ "access.presets.apply": ["user-b"] }),
  );

  expect(hasil).toEqual(["access.users.delete"]);
});

test("akun yang tidak memegang otoritas terlindungi tidak dilaporkan", () => {
  const hasil = strandedAuthorities(["reports.read_queue"], holders({}));

  expect(hasil).toEqual([]);
});

test("izin biasa tidak pernah dianggap otoritas terlindungi", () => {
  const hasil = strandedAuthorities(
    ["reports.read_queue", "reports.change_status", "access.users.read"],
    holders({}),
  );

  expect(hasil).toEqual([]);
});

test("daftar otoritas terlindungi dijaga tetap empat bit", () => {
  expect([...PROTECTED_AUTHORITY_CODES]).toEqual([
    "access.presets.apply",
    "access.permissions.assign",
    "access.users.disable",
    "access.users.delete",
  ]);
});

test("pesan galat menyebut setiap kode yang hilang", () => {
  expect(describeAuthorities(["access.presets.apply", "access.users.delete"]))
    .toBe("access.presets.apply, access.users.delete");
});
