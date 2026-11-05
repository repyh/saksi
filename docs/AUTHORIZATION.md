# SAKSI Authorization Design

**Status:** Permission-bit persistence is implemented in the working tree. A migration is prepared to flatten the existing bundle-grant data; it has not been deployed. Some access-management controls remain mockups. The staff report queue is read-only; report moderation actions and evidence review are not available.
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

`src/server/authorization/catalog.ts` is the canonical, source-controlled list. Database `Permission` rows mirror that catalog and are seeded by `bun run db:seed:authorization`. The admin UI may assign catalog codes, but may not create new codes.

### Reports

| Permission code | Allows | Boundary |
|---|---|---|
| `reports.read_queue` | See queue metadata and coarse area | No evidence or exact coordinates |
| `reports.read_deidentified` | Read report details with restricted evidence and identifiers omitted | Suitable for aggregate review |
| `reports.read_sensitive_evidence` | Open original or restricted evidence | Grant only when required |
| `reports.read_precise_location` | View exact report coordinates | Separate from general report reading |
| `reports.assign` | Assign or reassign a report | Audit each change |
| `reports.change_status` | Apply approved moderation transitions | Server validates transitions |
| `reports.add_internal_note` | Add staff-only notes | Never return notes publicly |
| `reports.redact` | Redact sensitive material from public projections | Preserve source evidence and audit the change |
| `reports.export` | Export report records | Apply field-level checks and audit exports |

### Analytics

| Permission code | Allows | Boundary |
|---|---|---|
| `analytics.read` | View aggregate counts and regional summaries | No individual report evidence |
| `analytics.export` | Download aggregate results | No row-level report export |

### Account access

| Permission code | Allows | Boundary |
|---|---|---|
| `access.users.read` | View account directory and access state | Never expose credentials or session tokens |
| `access.permissions.read_own` | View the signed-in user's active permission details in Dashboard → Akun Saya | Does not grant access to another account's permissions |
| `access.users.edit` | Edit display names and non-sensitive profile details | Email changes require verification |
| `access.users.invite` | Issue and revoke registration invitations | Does not itself grant permissions |
| `access.users.disable` | Disable accounts and revoke sessions | Audit actor, subject, reason, and time |
| `access.presets.apply` | Apply approved source-controlled permission presets | Preset expands to permission bits; no user package row is created |
| `access.permissions.assign` | Assign eligible individual permission bits | Cannot assign either delegation authority |
| `access.audit.read` | Read authorization and moderation audit events | Read-only |

### Data operations

| Permission code | Allows | Boundary |
|---|---|---|
| `sources.read` | View source configuration and ingestion metadata | Read-only |
| `sources.review_import` | Review completed imports and validation summaries | Does not edit official records directly |
| `sources.publish_snapshot` | Publish an approved normalized snapshot | Preserve review and source provenance |

The catalog may include permissions before the corresponding workflow exists. A catalog entry alone does not make an operation available or safe; the server route must enforce it and apply resource and field-level checks.

## 3. Permission presets

`PERMISSION_PRESETS` in `catalog.ts` contains the source-controlled preset definitions:

| Preset | Expanded permission codes | Purpose |
|---|---|---|
| Analyst | `reports.read_queue`, `reports.read_deidentified`, `analytics.read` | Review de-identified records and aggregate patterns |
| Moderator | Report review, sensitive evidence, precise location, assignment, status change, internal notes, and redaction | Moderate reports |
| Admin | Every current permission code | Full system access, including moderator capabilities |

When an inviter selects a preset, the API checks `access.presets.apply`, validates that the preset is allowed, expands it into its permission codes, and stores only those codes. The invite response may echo the chosen preset for display, and the audit event may record it as provenance. Neither the invite nor the user has a persisted preset-code field. Admin receives new catalog bits after the preset is applied again; existing user grants do not silently grow when the catalog changes.

Individual-bit assignment uses `access.permissions.assign` and `PERMISSION_ASSIGNMENT_POLICY`. That policy excludes `access.presets.apply` and `access.permissions.assign`, preventing a custom grant from delegating its own assignment authority. Admin receives both authority bits through the Admin preset or the controlled bootstrap path.

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

`20261105110000_flatten_permission_grants` copies every historical package grant into per-code grant rows, retaining grantor, timestamps, expiry, revocation state, reason, and source grant grouping. Grants sourced from disabled presets remain revoked. The migration backfills the individual-permission delegation bit for legacy effective administrators, expands pending package invitations to code snapshots, updates the redemption trigger, then drops package-grant tables and invite preset fields. Prior audit history remains intact. The migration is not deployed yet; deploy it before running application code that expects the normalized schema.

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
7. Revoke a single permission row without deleting history. Effective access persists if another active grant supplies the same bit.
8. Guard the last active holder of delegation authority; define an out-of-band recovery path before production.
9. Audit permission changes in the same transaction as the grant mutation.
10. Keep credentials, invite tokens, and sensitive evidence out of browser responses and audit metadata.
11. Return a user's own permission details only when `access.permissions.read_own` is active; `access.users.read` is the separate permission for the staff directory.

## 7. Implementation status

- Permission and preset definitions: `src/server/authorization/catalog.ts`.
- Effective permissions: `src/server/authorization/permissions.ts`.
- Central authority and strategies: `src/server/authorization/authority.ts` and `src/server/authorization/strategies/`.
- Invite issuance expands presets before persistence; registration creates per-bit grant rows.
- Account management opens a profile/access dialog. Profile edits use `PATCH /api/access/accounts/[userId]`; active per-bit grants are read from `GET /api/access/accounts/[userId]/permissions`, granted via `POST` to that endpoint, and individually revoked via `DELETE /api/access/accounts/[userId]/permissions/[grantId]`. Directory reads require `access.users.read`; grant and revoke require `access.permissions.assign`, a reason, and server-side policy checks. Users cannot change their own profile access grants from this dialog.
- Permission bundles shown in the account directory remain derived summaries. The dialog reads and changes individual permission-grant rows. Grant scope is currently global; package-scoped grants are not represented by the schema.
- `scripts/seed-authorization.ts` seeds permission definitions and can bootstrap permissions for an existing verified administrator.
- `scripts/bootstrap-admin.ts` creates an initial account and grants individual rows expanded from the Admin preset.
- Migration source is prepared in `prisma/migrations/20261105110000_flatten_permission_grants/`; it has not been deployed.
- Account-management disable/delete controls remain mockups. Protected staff/report workflows still need server endpoints and enforcement.

## References

- [Better Auth user and account model](https://better-auth.com/docs/concepts/users-accounts)
