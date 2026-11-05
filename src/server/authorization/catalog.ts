export const PERMISSION_CATALOG = [
  { code: "reports.read_queue", description: "View report queue metadata", sensitive: false },
  { code: "reports.read_deidentified", description: "Read report details without restricted evidence or direct identifiers", sensitive: false },
  { code: "reports.read_sensitive_evidence", description: "View original or restricted report evidence", sensitive: true },
  { code: "reports.read_precise_location", description: "View exact report locations", sensitive: true },
  { code: "reports.assign", description: "Assign or reassign reports for review", sensitive: false },
  { code: "reports.change_status", description: "Change report moderation status", sensitive: true },
  { code: "reports.add_internal_note", description: "Add staff-only notes to reports", sensitive: true },
  { code: "reports.redact", description: "Redact sensitive material from public projections", sensitive: true },
  { code: "reports.export", description: "Export report records", sensitive: true },
  { code: "analytics.read", description: "View aggregate analytics", sensitive: false },
  { code: "analytics.export", description: "Export aggregate analytics", sensitive: true },
  { code: "access.users.read", description: "View staff accounts and access state", sensitive: true },
  { code: "access.users.edit", description: "Update staff account profile details", sensitive: true },
  { code: "access.users.invite", description: "Invite staff accounts", sensitive: true },
  { code: "access.users.disable", description: "Disable staff accounts and revoke sessions", sensitive: true },
  { code: "access.bundles.assign", description: "Grant or revoke approved permission bundles", sensitive: true },
  { code: "access.audit.read", description: "Read authorization and moderation audit events", sensitive: true },
  { code: "sources.read", description: "View source and ingestion metadata", sensitive: false },
  { code: "sources.review_import", description: "Review an imported source batch", sensitive: true },
  { code: "sources.publish_snapshot", description: "Publish an approved normalized snapshot", sensitive: true },
] as const;

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

/** Explicit delegation policy: grant authority is separate from the permissions being delegated. */
export const BUNDLE_ASSIGNMENT_POLICY = {
  "access.bundles.assign": ["analyst", "moderator", "admin"],
} as const satisfies Partial<Record<PermissionCode, readonly string[]>>;

export const PERMISSION_BUNDLES = [
  {
    code: "analyst",
    name: "Analyst",
    description: "Read de-identified reports and aggregate analytics.",
    permissions: ["reports.read_queue", "reports.read_deidentified", "analytics.read"],
  },
  {
    code: "moderator",
    name: "Moderator",
    description: "Review and moderate reports, including sensitive evidence.",
    permissions: [
      "reports.read_queue",
      "reports.read_deidentified",
      "reports.read_sensitive_evidence",
      "reports.read_precise_location",
      "reports.assign",
      "reports.change_status",
      "reports.add_internal_note",
      "reports.redact",
    ],
  },
  {
    code: "admin",
    name: "Admin",
    description: "Full access to every permission in the SAKSI catalog.",
    permissions: PERMISSION_CATALOG.map(({ code }) => code),
  },
] as const satisfies ReadonlyArray<{
  code: string;
  name: string;
  description: string;
  permissions: readonly PermissionCode[];
}>;

export function isPermissionCode(value: string): value is PermissionCode {
  return PERMISSION_CATALOG.some((permission) => permission.code === value);
}
