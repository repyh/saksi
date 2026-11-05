import "server-only";
import type { DashboardAccount } from "@/contracts/account/dashboard.contract";
import { prisma } from "@/lib/prisma";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/** Account-domain reads used by authenticated account surfaces. */
export class AccountApi {
  async getDashboardAccount(userId: string): Promise<DashboardAccount | null> {
    const now = new Date();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        createdAt: true,
        bundleGrants: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            bundle: { isActive: true },
          },
          orderBy: { grantedAt: "desc" },
          select: {
            expiresAt: true,
            bundle: {
              select: {
                code: true,
                name: true,
                description: true,
                permissions: { select: { permissionCode: true } },
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const uniqueBundles = new Map<string, {
      bundle: Omit<DashboardAccount["accessBundles"][number], "expiresAtLabel">;
      expiresAt: Date | null;
    }>();
    const activePermissions = new Set<string>();
    for (const grant of user.bundleGrants) {
      for (const { permissionCode } of grant.bundle.permissions) activePermissions.add(permissionCode);
      const current = uniqueBundles.get(grant.bundle.code);
      if (!current) {
        uniqueBundles.set(grant.bundle.code, {
          bundle: { code: grant.bundle.code, name: grant.bundle.name, description: grant.bundle.description },
          expiresAt: grant.expiresAt,
        });
      } else if (current.expiresAt && (!grant.expiresAt || grant.expiresAt > current.expiresAt)) {
        current.expiresAt = grant.expiresAt;
      }
    }

    return {
      name: user.name,
      email: user.email,
      createdAtLabel: formatDate(user.createdAt),
      accessBundles: [...uniqueBundles.values()].map(({ bundle, expiresAt }) => ({
        ...bundle,
        expiresAtLabel: expiresAt ? formatDate(expiresAt) : null,
      })),
      dashboardPermissions: {
        manageAccounts: activePermissions.has("access.users.read"),
        moderateReports: ["reports.read_queue", "reports.change_status", "reports.assign"]
          .some((permission) => activePermissions.has(permission)),
        inviteAccounts: activePermissions.has("access.users.invite"),
        editAccounts: activePermissions.has("access.users.edit"),
      },
    };
  }
}

export const accountApi = new AccountApi();
