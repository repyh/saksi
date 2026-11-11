export const PERMISSION_CATALOG = [
  { code: "reports.read_queue", description: "View report queue metadata", sensitive: false },
  { code: "reports.read_deidentified", description: "Read report details without reporter identity or restricted evidence", sensitive: true },
  { code: "reports.change_status", description: "Publish or reject reports with a required moderation reason", sensitive: true },
  { code: "reports.read_sensitive_evidence", description: "View private report photo evidence", sensitive: true },
  { code: "reports.read_precise_location", description: "View exact report locations and annotated road segments", sensitive: true },
  { code: "access.users.read", description: "View staff accounts and access state", sensitive: true },
  { code: "access.permissions.read_own", description: "View your own active permission details in the dashboard", sensitive: false },
  { code: "access.users.edit", description: "Update staff account profile details", sensitive: true },
  { code: "access.users.invite", description: "Invite staff accounts", sensitive: true },
  { code: "access.users.disable", description: "Disable or restore staff accounts and revoke sessions", sensitive: true },
  { code: "access.users.delete", description: "Permanently remove a disabled staff account", sensitive: true },
  { code: "access.presets.apply", description: "Apply approved permission presets to individual grants", sensitive: true },
  { code: "access.permissions.assign", description: "Grant or revoke approved individual permissions", sensitive: true },
] as const;

// Keep not-yet-implemented permissions documented here, but out of the active
// catalog. They cannot be assigned, included in presets, or resolved by the authority.
// Reports: assignment, notes, redaction, export.
// { code: "reports.assign", description: "Assign or reassign reports for review", sensitive: false },
// { code: "reports.add_internal_note", description: "Add staff-only notes to reports", sensitive: true },
// { code: "reports.redact", description: "Redact sensitive material from public projections", sensitive: true },
// { code: "reports.export", description: "Export report records", sensitive: true },
// Analytics: no analytics read or export workflow exists yet.
// { code: "analytics.read", description: "View aggregate analytics", sensitive: false },
// { code: "analytics.export", description: "Export aggregate analytics", sensitive: true },
// { code: "access.audit.read", description: "Read authorization and moderation audit events", sensitive: true },
// Data operations: ingestion, import review, and snapshot publishing are not implemented.
// { code: "sources.read", description: "View source and ingestion metadata", sensitive: false },
// { code: "sources.review_import", description: "Review an imported source batch", sensitive: true },
// { code: "sources.publish_snapshot", description: "Publish an approved normalized snapshot", sensitive: true },

export type PermissionCode = (typeof PERMISSION_CATALOG)[number]["code"];

/** Permission presets are conveniences for assigning their expanded permission bits. */
export const PRESET_ASSIGNMENT_POLICY = {
  "access.presets.apply": ["moderator", "admin"],
} as const satisfies Partial<Record<PermissionCode, readonly string[]>>;

/**
 * Otoritas yang tidak boleh lenyap dari sistem. Revocation, penonaktifan, dan
 * penghapusan akun wajib menyisakan minimal satu akun aktif yang memegangnya.
 */
export const PROTECTED_AUTHORITY_CODES = [
  "access.presets.apply",
  "access.permissions.assign",
  "access.users.disable",
  "access.users.delete",
] as const satisfies readonly PermissionCode[];

const PROTECTED_AUTHORITY_SET: ReadonlySet<string> = new Set(PROTECTED_AUTHORITY_CODES);

export function isProtectedAuthority(code: string): boolean {
  return PROTECTED_AUTHORITY_SET.has(code);
}

/** Individual grants cannot delegate the authorities used to assign presets or permissions. */
export const PERMISSION_ASSIGNMENT_POLICY = {
  "access.permissions.assign": PERMISSION_CATALOG
    .map(({ code }) => code)
    .filter((code) => !PROTECTED_AUTHORITY_SET.has(code)),
} as const satisfies Partial<Record<PermissionCode, readonly PermissionCode[]>>;

export const PERMISSION_PRESETS = [
  {
    code: "moderator",
    name: "Moderator",
    description: "Review reports, view private photo evidence, and publish or reject reports with a reason.",
    permissions: ["reports.read_queue", "reports.read_deidentified", "reports.change_status", "reports.read_sensitive_evidence"],
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

export type PermissionPresetCode = (typeof PERMISSION_PRESETS)[number]["code"];

export function permissionCodesForPreset(code: PermissionPresetCode): readonly PermissionCode[] {
  return PERMISSION_PRESETS.find((preset) => preset.code === code)?.permissions ?? [];
}

export function isPermissionPresetCode(value: string): value is PermissionPresetCode {
  return PERMISSION_PRESETS.some((preset) => preset.code === value);
}

export function isPermissionCode(value: string): value is PermissionCode {
  return PERMISSION_CATALOG.some((permission) => permission.code === value);
}
