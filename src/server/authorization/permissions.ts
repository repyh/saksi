import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isPermissionCode, PROTECTED_AUTHORITY_CODES, type PermissionCode } from "./catalog";
import { strandedAuthorities, type AuthorityHolders } from "./last-authority";

export type AuthorizationDb = typeof prisma | Prisma.TransactionClient;

export const activeGrantWhere = (now: Date) => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

export async function permissionsForUser(
  userId: string,
  db: AuthorizationDb = prisma,
  excludedGrantId?: string,
  now = new Date(),
): Promise<Set<PermissionCode>> {
  const grants = await db.userPermissionGrant.findMany({
    where: { userId, ...activeGrantWhere(now), ...(excludedGrantId ? { id: { not: excludedGrantId } } : {}) },
    select: { permissionCode: true },
  });

  const permissions = new Set<PermissionCode>();
  for (const grant of grants) {
    if (isPermissionCode(grant.permissionCode)) permissions.add(grant.permissionCode);
  }
  return permissions;
}

/**
 * Otoritas terlindungi yang masih aktif pada satu akun, tanpa memandang status
 * akun: akun nonaktif tetap menyimpannya dan dapat diaktifkan kembali.
 */
export async function activeProtectedAuthoritiesOf(
  userId: string,
  db: AuthorizationDb = prisma,
  now = new Date(),
): Promise<PermissionCode[]> {
  const grants = await db.userPermissionGrant.findMany({
    where: { userId, permissionCode: { in: [...PROTECTED_AUTHORITY_CODES] }, ...activeGrantWhere(now) },
    select: { permissionCode: true },
  });

  const held = new Set(grants.map(({ permissionCode }) => permissionCode));
  return PROTECTED_AUTHORITY_CODES.filter((code) => held.has(code));
}

/** Pemegang otoritas terlindungi selain `excludingUserId`, hanya akun aktif. */
export async function otherActiveAuthorityHolders(
  excludingUserId: string,
  db: AuthorizationDb = prisma,
  now = new Date(),
): Promise<AuthorityHolders> {
  const grants = await db.userPermissionGrant.findMany({
    where: {
      userId: { not: excludingUserId },
      permissionCode: { in: [...PROTECTED_AUTHORITY_CODES] },
      ...activeGrantWhere(now),
      user: { disabledAt: null },
    },
    select: { userId: true, permissionCode: true },
  });

  const holders = new Map<string, Set<string>>();
  for (const grant of grants) {
    const set = holders.get(grant.permissionCode) ?? new Set<string>();
    set.add(grant.userId);
    holders.set(grant.permissionCode, set);
  }
  return holders;
}

/** Otoritas yang lenyap dari sistem bila `userId` kehilangan seluruh grant-nya. */
export async function strandedAuthoritiesForAccount(
  userId: string,
  db: AuthorizationDb = prisma,
  now = new Date(),
): Promise<PermissionCode[]> {
  const [held, holders] = await Promise.all([
    activeProtectedAuthoritiesOf(userId, db, now),
    otherActiveAuthorityHolders(userId, db, now),
  ]);
  return strandedAuthorities(held, holders);
}
