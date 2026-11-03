import type { PermissionCode } from "../catalog";
import type { AuthorizationStrategy } from "../types";

const analyticsPermissions = ["analytics.read", "analytics.export"] as const satisfies readonly PermissionCode[];

export const analyticsAuthorizationStrategy: AuthorizationStrategy = {
  domain: "analytics",
  decide({ permission, grantedPermissions }) {
    if (!analyticsPermissions.includes(permission as (typeof analyticsPermissions)[number])) {
      return { allowed: false, reason: "Permission does not belong to the analytics domain." };
    }
    if (permission === "analytics.export" && !grantedPermissions.has("analytics.read")) {
      return { allowed: false, reason: "Analytics export also requires analytics read access." };
    }
    if (!grantedPermissions.has(permission)) {
      return { allowed: false, reason: "The required analytics permission is not granted." };
    }
    return { allowed: true };
  },
};
