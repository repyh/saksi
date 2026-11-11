# SAKSI Authorization Design

**Status:** Permission-bit persistence and retired-permission cleanup are applied to the configured database. Account lifecycle actions, report review, and moderation workflows require dedicated permissions and are audited.
**Scope:** Staff access to moderation, analytics, data operations, and account administration.

Every authenticated account is a `User`; there is no implicit user/admin/moderator role. Authorization is expressed as individual permission codes. Named access packages such as Analyst, Moderator, and Admin are source-controlled presets that expand into permission codes before persistence. The database does not store a package assignment on a user.

## 1. Design principles

1. Better Auth identifies the account and manages sessions. SAKSI's server authority decides what the account may do.
2. Deny by default. An account with no active permission grants has no staff access.
3. A permission bit is the smallest authorization unit. Each user grant is a separate `UserPermissionGrant` row.
4. Presets are convenience inputs, not roles or persisted user state. Assigning a preset expands its current permission codes into individual grant rows.
5. An invitation stores the expanded permission-code list as a snapshot. Changing a preset later does not silently change an already-issued invitation.
6. Sensitive reads and consequential changes require explicit bits and audit events.
7. Public map browsing and the public road-report flow remain account-optional.

## 2. Permission catalog

`src/server/authorization/catalog.ts` is the canonical list of permissions currently enabled for assignment and authorization. Database `Permission` rows are seeded from that list by `bun run db:seed:authorization`. The admin UI and APIs may assign active catalog codes only.

### Reports

| Permission code | Allows | Boundary |
|---|---|---|
| `reports.read_queue` | See queue metadata and coarse area | Does not grant access to report details, evidence, or exact coordinates |
| `reports.read_deidentified` | Read report details without reporter identity or restricted evidence | Must be combined with `reports.read_queue`; excludes reporter identity, free-text location hint, and precise coordinates; each successful detail read is audited |
| `reports.read_sensitive_evidence` | View private report photo evidence | Must be combined with `reports.read_queue`; each evidence read is audited; does not permit status changes |

### Analytics

No analytics permissions are currently enabled because the analytics screens and server endpoints are not implemented.

### Account access

| Permission code | Allows | Boundary |
|---|---|---|
| `access.users.read` | View account directory and access state | Never expose credentials or session tokens |
| `access.permissions.read_own` | View the signed-in user's active permission details in Dashboard → Akun Saya | Does not grant access to another account's permissions |
| `access.users.edit` | Edit display names and non-sensitive profile details | Email changes require verification |
| `access.users.invite` | Issue and revoke registration invitations | Does not itself grant permissions |
| `access.users.disable` | Disable or restore staff accounts | Cannot change own status; disabling revokes sessions and outstanding invites |
| `access.users.delete` | Permanently remove a disabled staff account | Requires exact-email confirmation; reports and audit history remain without the deleted account link |
| `access.presets.apply` | Apply approved source-controlled permission presets | Preset expands to permission bits; no user package row is created |
| `access.permissions.assign` | Assign eligible individual permission bits | Cannot assign either delegation authority |

### Account lifecycle and audit

Account disable/session revocation and deletion are available through audited lifecycle endpoints. Reading the full audit history remains unavailable until a dedicated permission and UI exist.

### Data operations

No data-operation permissions are enabled; source ingestion, import review, and snapshot publication are not implemented.

### Disabled permissions

The following definitions remain commented out in `catalog.ts` as a planning record. They are excluded from `PermissionCode`, direct grant policy, presets, permission resolution, and assignment UI:

- Reports: `reports.read_precise_location`, `reports.assign`, `reports.change_status`, `reports.add_internal_note`, `reports.redact`, `reports.export`.
- Analytics: `analytics.read`, `analytics.export`.
- Accounts: `access.audit.read`.
- Data operations: `sources.read`, `sources.review_import`, `sources.publish_snapshot`.

Removing a code from the active catalog immediately makes persisted grants for it ineffective in application authorization. Migration `20261109170000_retire_removed_permissions` revokes any still-effective grants for the listed retired codes, archives the permission definitions, grants, and invitation snapshots in `RetiredPermissionRecordArchive`, removes those codes from live invitation snapshots, and deletes their live `UserPermissionGrant` and `Permission` rows. The archive has no foreign keys so it survives the live-row purge. Existing authorization audit events remain unchanged as historical records. The seed script only upserts active catalog entries and does not recreate retired codes.

Only permissions backed by an implemented workflow belong in the active catalog. Add one only when its server endpoint, policy checks, UI affordance (when applicable), and audit behavior are ready together.

## 3. Permission presets

`PERMISSION_PRESETS` in `catalog.ts` contains the source-controlled preset definitions:

| Preset | Expanded permission codes | Purpose |
|---|---|---|
| Moderator | `reports.read_queue`, `reports.read_deidentified`, `reports.read_sensitive_evidence` | Review report details and private evidence; moderation actions are not available yet |
| Admin | Every active permission code | Full access to currently implemented staff workflows |

When an inviter selects a preset, the API checks `access.presets.apply`, validates that the preset is allowed, expands it into its permission codes, and stores only those codes. The invite response may echo the chosen preset for display, and the audit event may record it as provenance. Neither the invite nor the user has a persisted preset-code field. Admin receives new catalog bits after the preset is applied again; existing user grants do not silently grow when the catalog changes.

Individual-bit assignment uses `access.permissions.assign` and `PERMISSION_ASSIGNMENT_POLICY`. That policy excludes `access.presets.apply`, `access.permissions.assign`, `access.users.disable`, and `access.users.delete`, preventing custom grants from delegating permission-management or account-lifecycle authority. Admin receives these bits through the Admin preset or controlled bootstrap path.

The two assignment modes are mutually exclusive on an invitation: choose one preset, choose individual bits, or grant no staff access. No account can grant access to itself.

## 4. Persistence model

The intended normalized model stores authorization at permission-bit granularity.

### `User`

Better Auth owns the account. It has relations to permission-grant rows, but no role, bundle, or preset field/relation. Effective authorization is the union of its active grant rows.

### `Permission`

The stable permission code is the primary key. Its description and sensitivity marker are seeded from source code. This table is the foreign-key target for grants.

### `UserPermissionGrant`

Each row grants exactly one `permissionCode` to one user.

| Field | Purpose |
|---|---|
| `id` | Grant-row identifier |
| `userId` | Account receiving the bit |
| `permissionCode` | The single permission bit being granted |
| `grantedByUserId` / `grantedAt` | Grantor and timestamp |
| `grantBatchId` | Optional grouping for a multi-bit operation; it does not encode a preset |
| `expiresAt` | Optional expiry |
| `revokedAt` / `revokedByUserId` | Revocation history; ordinary revocation retains the row |
| `reason` | Required justification |

The same user may have multiple historical grants for one code. Effective access exists while at least one matching grant is unrevoked and unexpired. Revoking one row does not remove access if another active row still grants the same bit. Grant rows and audit events are written in the same transaction.

### `RegistrationInvite`

An invitation stores `permissionCodes`, a snapshot list of individual bits to grant on redemption, plus a reason. The API accepts a transient `permissionPresetCode` or permission-code list, expands a preset before writing, and never stores the preset code in the invite. The redemption trigger validates each code against `Permission` and creates one `UserPermissionGrant` row per code in the same transaction as user creation. An empty array means the new account receives no staff access.

### `AuthorizationAuditEvent`

Audit rows record the actor, subject, action, resource, reason, request ID, minimal metadata, and timestamp. A preset application may record its preset code in audit metadata for provenance; this is historical context, not an authorization source. Never put passwords, raw invite tokens, or image bytes in metadata. The database does not yet enforce append-only behavior or retention.

### Migration from package-backed grants

`20261105110000_flatten_permission_grants` copies every historical package grant into per-code grant rows, retaining grantor, timestamps, expiry, revocation state, reason, and source grant grouping. Grants sourced from disabled presets remain revoked. The migration backfills the individual-permission delegation bit for legacy effective administrators, expands pending package invitations to code snapshots, updates the redemption trigger, then drops package-grant tables and invite preset fields. Prior audit history remains intact. The configured database reports this migration as applied.

## 5. Authorization authority

Routes call `requireRequestPermission()` or another server authority entry point. The authority resolves active `UserPermissionGrant` rows, rejects unknown codes and unauthenticated users, and delegates domain policy to the registered strategy. A UI check is never a substitute for a server check.

`src/server/authorization/strategies/access.ts` provides transactional grant operations:

- `grantPermissionPreset()` expands a source preset into per-bit rows and requires the preset delegation authority.
- `grantIndividualPermissions()` validates every code against the direct-assignment policy and requires individual-bit delegation authority.
- `revokePermissionGrant()` revokes one bit-grant row and audits the change. It protects the last remaining delegation authority.

The central resolver combines duplicate active grants into an effective permission set. It ignores expired and revoked rows. Resource ownership, district scope, sensitive projections, and allowed state transitions remain separate checks.

## 6. Security invariants

1. Check each protected server operation. Do not rely on route visibility or client state.
2. Fail closed on missing identity, unknown permissions, or database errors.
3. Never allow a user to grant permissions to themselves.
4. A direct permission assignment cannot grant either delegation authority.
5. Preset assignment is restricted by `PRESET_ASSIGNMENT_POLICY` and expands to bits before persistence.
6. An invite is email-bound, single-use, short-lived, and stores only permission codes, never a preset assignment or raw token.
7. Ordinary revocation retains the grant row and audit history. Retiring a code uses the archive-and-purge migration; effective access is revoked before its live row is removed.
8. Guard the last active holder of delegation and account-lifecycle authority; disabled accounts do not count. Keep an out-of-band recovery path for production.
9. Audit permission changes in the same transaction as the grant mutation.
10. Keep credentials, invite tokens, and sensitive evidence out of browser responses and audit metadata.
11. Return a user's own permission details only when `access.permissions.read_own` is active; `access.users.read` is the separate permission for the staff directory.

## 7. Implementation status

- Permission and preset definitions: `src/server/authorization/catalog.ts`.
- Effective permissions: `src/server/authorization/permissions.ts`.
- Central authority and strategies: `src/server/authorization/authority.ts` and `src/server/authorization/strategies/`.
- Invite issuance expands presets before persistence; registration creates per-bit grant rows.
- Account management opens a profile/access dialog. Profile edits use `PATCH /api/access/accounts/[userId]`; active per-bit grants are read from `GET /api/access/accounts/[userId]/permissions`, granted via `POST` to that endpoint, and individually revoked via `DELETE /api/access/accounts/[userId]/permissions/[grantId]`. Directory reads require `access.users.read`; grant and revoke require `access.permissions.assign`, a reason, and server-side policy checks. Users cannot change their own profile access grants from this dialog.
- Account lifecycle controls use `PATCH /api/access/accounts/[userId]/status` and `DELETE /api/access/accounts/[userId]`. Disabling blocks new sessions, revokes current sessions, and revokes unused invites. Deletion requires a disabled target, exact email confirmation, and an audit reason. Report submissions and audit records are retained with the deleted user's foreign-key references cleared; grants received by that account are removed while grants they issued remain with a null grantor.
- Permission bundles shown in the account directory remain derived summaries. The dialog reads and changes individual permission-grant rows. Grant scope is currently global; package-scoped grants are not represented by the schema.
- `scripts/seed-authorization.ts` seeds permission definitions and can bootstrap permissions for an existing verified administrator.
- `prisma/migrations/20261109170000_retire_removed_permissions/` archives and purges the disabled permission definitions, grants, and invite snapshots listed above. Applied to the configured database on 9 November 2026; retired live rows were verified absent and historical snapshots remain archived.
- `scripts/bootstrap-admin.ts` creates an initial account and grants individual rows expanded from the Admin preset.
- Migration `20261111140000_account_lifecycle` adds the disabled-account state and lifecycle permission bits, grants those bits to existing active Admin permission holders, and makes historical grantor/inviter links nullable so account deletion preserves audit and invitation records.
- `20261105110000_flatten_permission_grants` is reported as applied by `npx prisma migrate status` against the currently configured database.
- Active report reads are `reports.read_queue`, `reports.read_deidentified`, and `reports.read_sensitive_evidence`. Detail reads return de-identified report content and write an authorization audit event. Evidence is streamed through the server from the private bucket and each read writes an authorization audit event. Status changes, assignment, internal notes, report redaction/export, analytics, audit-history reads, and source operations remain disabled.

## References

- [Better Auth user and account model](https://better-auth.com/docs/concepts/users-accounts)
