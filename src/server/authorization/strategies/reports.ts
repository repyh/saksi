import type { PermissionCode } from "../catalog";
import type { AuthorizationStrategy } from "../types";

const reportPermissions = [
  "reports.read_queue",
  "reports.read_deidentified",
  "reports.read_sensitive_evidence",
  "reports.read_precise_location",
  "reports.assign",
  "reports.change_status",
  "reports.add_internal_note",
  "reports.redact",
  "reports.export",
] as const satisfies readonly PermissionCode[];

const reportReadRequired: readonly PermissionCode[] = [
  "reports.read_deidentified",
];

export const reportsAuthorizationStrategy: AuthorizationStrategy = {
  domain: "reports",
  decide({ permission, grantedPermissions }) {
    if (!reportPermissions.includes(permission as (typeof reportPermissions)[number])) {
      return { allowed: false, reason: "Permission does not belong to the reports domain." };
    }

    const requiresDeidentifiedRead = permission !== "reports.read_queue" && permission !== "reports.read_deidentified";
    if (requiresDeidentifiedRead && !reportReadRequired.every((required) => grantedPermissions.has(required))) {
      return { allowed: false, reason: "Report access also requires de-identified report reading." };
    }
    if (!grantedPermissions.has(permission)) {
      return { allowed: false, reason: "The required report permission is not granted." };
    }
    return { allowed: true };
  },
};
