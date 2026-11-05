import "server-only";
import type { DashboardAccount } from "@/contracts/account/dashboard.contract";
import { prisma } from "@/lib/prisma";
import { PERMISSION_CATALOG } from "@/server/authorization/catalog";

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
        permissionGrants: {
          where: {
            revokedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          select: { permissionCode: true },
        },
      },
    });

    if (!user) return null;

    const activePermissions = new Set(user.permissionGrants.map(({ permissionCode }) => permissionCode));
    const canViewOwnPermissions = activePermissions.has("access.permissions.read_own");
    const permissions = canViewOwnPermissions
      ? PERMISSION_CATALOG
          .filter(({ code }) => activePermissions.has(code))
          .map(({ code, description }) => ({ code, description }))
      : null;

    return {
      name: user.name,
      email: user.email,
      createdAtLabel: formatDate(user.createdAt),
      permissions,
      dashboardPermissions: {
        viewOwnPermissions: canViewOwnPermissions,
        manageAccounts: activePermissions.has("access.users.read"),
        moderateReports: activePermissions.has("reports.read_queue"),
        inviteAccounts: activePermissions.has("access.users.invite"),
        editAccounts: activePermissions.has("access.users.edit"),
        applyPresets: activePermissions.has("access.presets.apply"),
        assignPermissions: activePermissions.has("access.permissions.assign"),
      },
    };
  }
}

export const accountApi = new AccountApi();
