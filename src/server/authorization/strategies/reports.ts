import type { PermissionCode } from "../catalog";
import type { AuthorizationStrategy } from "../types";

const reportPermissions = [
  "reports.read_queue",
  "reports.read_deidentified",
  "reports.read_sensitive_evidence",
  "reports.read_precise_location",
] as const satisfies readonly PermissionCode[];

export const reportsAuthorizationStrategy: AuthorizationStrategy = {
  domain: "reports",
  decide({ permission, grantedPermissions }) {
    if (!reportPermissions.includes(permission as (typeof reportPermissions)[number])) {
      return { allowed: false, reason: "Permission does not belong to the reports domain." };
    }

    if (!grantedPermissions.has(permission)) {
      return { allowed: false, reason: "The required report permission is not granted." };
    }
    return { allowed: true };
  },
};
