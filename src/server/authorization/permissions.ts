import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { isPermissionCode, type PermissionCode } from "./catalog";

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
  const grants = await db.userBundleGrant.findMany({
    where: {
      userId,
      ...activeGrantWhere(now),
      ...(excludedGrantId ? { id: { not: excludedGrantId } } : {}),
      bundle: { isActive: true },
    },
    select: {
      bundle: { select: { permissions: { select: { permissionCode: true } } } },
    },
  });

  const permissions = new Set<PermissionCode>();
  for (const grant of grants) {
    for (const item of grant.bundle.permissions) {
      if (isPermissionCode(item.permissionCode)) permissions.add(item.permissionCode);
    }
  }
  return permissions;
}
