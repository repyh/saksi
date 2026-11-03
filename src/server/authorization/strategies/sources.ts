import type { PermissionCode } from "../catalog";
import type { AuthorizationStrategy } from "../types";

const sourcePermissions = [
  "sources.read",
  "sources.review_import",
  "sources.publish_snapshot",
] as const satisfies readonly PermissionCode[];

export const sourcesAuthorizationStrategy: AuthorizationStrategy = {
  domain: "sources",
  decide({ permission, grantedPermissions }) {
    if (!sourcePermissions.includes(permission as (typeof sourcePermissions)[number])) {
      return { allowed: false, reason: "Permission does not belong to the sources domain." };
    }
    if (!grantedPermissions.has(permission)) {
      return { allowed: false, reason: "The required source operation permission is not granted." };
    }
    return { allowed: true };
  },
};
