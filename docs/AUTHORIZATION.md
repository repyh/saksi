# SAKSI Authorization Design

**Status:** Authorization foundation and catalog are implemented, with the migration deployed and catalog seeded to the configured Supabase project on 4 November 2026. Account listing, display-name edits, and invite creation are permission guarded. Account disable/delete controls remain non-functional mockups; report moderation and data-operations workflows are not available yet.
**Scope:** Staff access to moderation, analytics, data operations, and account administration.

This document defines a permission catalog for SAKSI. Every authenticated account is a `User`; there is no default `user` role. Users receive no staff access unless an administrator grants one or more permission bundles. Public map browsing and the planned anonymous report-submission path do not require an account.

## 1. Design principles

1. **Authentication and authorization are separate.** Better Auth establishes who is signed in. SAKSI's server-side authorization layer decides what that account may do.
2. **Deny by default.** A user with no active grants has no staff permissions.
3. **Permissions name actions.** Avoid broad flags such as `isAdmin`, `isModerator`, or `canManageReports`.
4. **Bundles are additive.** A person may receive one or more bundles. The Admin bundle intentionally includes every permission in the catalog, including moderation and sensitive evidence permissions; Analyst and Moderator remain narrower bundles.
5. **Sensitive access is explicit.** Reading original photos, exact locations, or exporting records requires separate permissions.
6. **Every grant and sensitive action is auditable.** Permission checks and UI visibility do not replace audit records for changes or consequential actions.
7. **Public reporting stays account-optional.** Do not collect a real-world identity as a condition of submitting a report. If an authenticated user chooses to associate an account, that relation is optional.
8. **Permission codes are stable API identifiers.** They are lowercase, namespaced, and not translated. Labels and descriptions may change without changing the code.

## 2. Permission catalog

The permission catalog is the complete set of actions that the application may grant. New permissions should be added only when a real workflow requires them. `read_deidentified` must return records with direct identifiers and restricted evidence removed; `read_sensitive_evidence` and `read_precise_location` are distinct grants.

### Reports

| Permission code | Allows | Boundary |
|---|---|---|
| `reports.read_queue` | See report IDs, status, timestamps, and coarse area in the review queue | Does not reveal evidence or exact coordinates |
| `reports.read_deidentified` | Read report details with direct identifiers and restricted evidence omitted | Suitable for aggregate review and analysis |
| `reports.read_sensitive_evidence` | Open original or otherwise restricted report evidence | Grant only to staff who need evidence for review |
| `reports.read_precise_location` | View exact report coordinates or the most precise stored location | Keep separate from general report reading |
| `reports.assign` | Assign or reassign a report to a reviewer | Every assignment change is audited |
| `reports.change_status` | Move a report through the approved moderation states | State transitions are validated by the server |
| `reports.add_internal_note` | Add staff-only notes to a report | Notes must never appear in public responses |
| `reports.redact` | Hide or replace sensitive material in a public projection | Preserve an audit event; do not silently rewrite source evidence |
| `reports.export` | Export report records | Export endpoint must apply the same sensitive-field checks and log the export |

### Analytics

| Permission code | Allows | Boundary |
|---|---|---|
| `analytics.read` | View aggregate counts and regional summaries | No individual report evidence |
| `analytics.export` | Download aggregate results | No row-level report export |

### User and access administration

| Permission code | Allows | Boundary |
|---|---|---|
| `access.users.read` | View staff account list and access state | Do not expose authentication secrets or session tokens |
| `access.users.edit` | Update staff display name and non-sensitive profile details | Email changes require address verification |
| `access.users.invite` | Create or invite staff accounts | Invitation does not imply a permission bundle |
| `access.users.disable` | Disable staff access and revoke active sessions | Record actor, subject, reason, and time |
| `access.bundles.assign` | Grant or revoke approved bundles for another account | Grants follow the explicit source-controlled delegation policy; no self-grant |
| `access.audit.read` | Read access and moderation audit events | Audit history is read-only |

### Data operations

| Permission code | Allows | Boundary |
|---|---|---|
| `sources.read` | View source configuration, snapshot metadata, and ingestion history | Read-only |
| `sources.review_import` | Review a completed import and its validation summary | Does not edit official source records directly |
| `sources.publish_snapshot` | Publish an approved normalized snapshot | Requires a recorded review and source provenance |

Report submission and private evidence storage have an API and persistent records. Moderation queue, status changes, assignments, audit review UI, and scraper operations workflows still need their own server-side handlers and permission checks before those catalog entries enable them.

## 3. Permission bundles

Bundles are reusable collections of permission codes. Bundle names are conveniences for granting access, not account types. A user can have zero, one, or multiple bundles.

| Bundle code | Included permissions | Intended use |
|---|---|---|
| `analyst` | `reports.read_queue`, `reports.read_deidentified`, `analytics.read` | Analyze report patterns without access to original evidence or exact location |
| `moderator` | `reports.read_queue`, `reports.read_deidentified`, `reports.read_sensitive_evidence`, `reports.read_precise_location`, `reports.assign`, `reports.change_status`, `reports.add_internal_note`, `reports.redact` | Review and moderate reports |
| `admin` | Every permission code in `PERMISSION_CATALOG`, including all Moderator permissions and sensitive evidence/export permissions | Full system access |

The `admin` bundle derives its permission list from `PERMISSION_CATALOG`, so it receives newly added permissions when the authorization catalog is reseeded. This is an intentional superuser grant. Use Analyst or Moderator for narrower access. `reports.export` and `analytics.export` are available to Admin because the bundle is full access; they remain excluded from the narrower starter bundles.

There is no `user` bundle. A user with no rows in `UserBundleGrant` has no staff privileges. Anonymous visitors are not represented in the auth tables.

## 4. Authorization persistence

Better Auth continues to own `User`, `Session`, `Account`, and `Verification`. The authorization schema adds the following tables, defined in the Prisma schema and migration.

### `Permission`

| Field | Type | Constraints / purpose |
|---|---|---|
| `code` | String | Primary key, for example `reports.assign` |
| `description` | String | Staff-facing explanation |
| `sensitive` | Boolean | Marks actions involving restricted evidence, location, exports, or access changes |
| `createdAt` | DateTime | Catalog creation time |

Permission codes are seeded from source-controlled definitions. They are not created freely in the admin UI.

### `PermissionBundle`

| Field | Type | Constraints / purpose |
|---|---|---|
| `id` | String | Primary key |
| `code` | String | Unique stable identifier such as `moderator` |
| `name` | String | Display name |
| `description` | String | Intended use |
| `isSystem` | Boolean | True for built-in bundles whose definitions are source-controlled |
| `isActive` | Boolean | Deactivation prevents new grants; existing grants must be reviewed |
| `createdAt` / `updatedAt` | DateTime | Lifecycle timestamps |

### `PermissionBundlePermission`

Join table for bundle definitions.

| Field | Type | Constraints / purpose |
|---|---|---|
| `bundleId` | String | Foreign key to `PermissionBundle`, cascade on bundle deletion only for non-system bundles |
| `permissionCode` | String | Foreign key to `Permission.code` |

Use the pair (`bundleId`, `permissionCode`) as the primary key. System bundle contents are updated by reviewed migrations or seed changes, not ad hoc UI edits.

### `UserBundleGrant`

An assignment of a bundle to a Better Auth user.

| Field | Type | Constraints / purpose |
|---|---|---|
| `id` | String | Primary key |
| `userId` | String | Foreign key to Better Auth `User` |
| `bundleId` | String | Foreign key to `PermissionBundle` |
| `grantedByUserId` | String | Foreign key to the granting staff user |
| `grantedAt` | DateTime | Grant timestamp |
| `expiresAt` | DateTime? | Optional expiry for temporary access |
| `revokedAt` | DateTime? | Revocation timestamp; retain the row for history |
| `revokedByUserId` | String? | Staff user who revoked the grant |
| `reason` | String | Required justification for the original grant; revocation reasons are recorded on the audit event |

Index active grants by `userId`, `bundleId`, and expiry/revocation state. Prevent duplicate active grants for the same user and bundle. Do not hard-delete grant history during ordinary revocation.

**Initial scope:** grants are global. If future moderation must be restricted to districts, introduce an explicit district-scope relation with a real foreign key to the district table. Avoid a polymorphic `scopeId` that can point to unrelated tables without referential integrity. Per-report assignments should use the report's assignment field, not a permission-scope string.

### `AuthorizationAuditEvent`

Append-only event log for permission changes and sensitive operations.

| Field | Type | Constraints / purpose |
|---|---|---|
| `id` | String | Primary key |
| `actorUserId` | String? | User who initiated the event; nullable only for controlled system actions |
| `action` | String | Stable code, e.g. `bundle.granted`, `report.status_changed`, `report.exported` |
| `subjectUserId` | String? | Account affected by access changes |
| `resourceType` | String? | Affected domain type such as `report` or `bundle` |
| `resourceId` | String? | Identifier of the affected domain record |
| `reason` | String? | Required for high-impact access or moderation changes |
| `requestId` | String? | Correlation ID for application logs |
| `metadata` | Json? | Minimal before/after summary; must not contain passwords, tokens, or photo bytes |
| `createdAt` | DateTime | Event timestamp; immutable after creation |

Index by actor, resource, action, and timestamp. Keep this table inaccessible to normal update/delete code paths. Define retention and export policy before production use.

## 5. Strategy architecture

The central authority is the only entry point that application routes and server use cases should call. It authenticates requests, loads active permissions, denies unknown codes, selects a domain strategy, and converts denials into consistent errors. Strategies own rules for their domain; they do not create a second permission catalog.

```text
src/server/authorization/
  authority.ts       # Shared authorize / require entry point
  registry.ts        # Routes permission namespaces to a strategy
  catalog.ts         # Canonical permission codes, bundles, delegation policy
  permissions.ts     # Resolves active grants from persistence
  audit.ts           # Shared transactional audit writer
  strategies/
    reports.ts       # Report visibility and action prerequisites
    analytics.ts     # Aggregate access and export prerequisites
    access.ts        # Account-access policy and grant/revoke operations
    sources.ts       # Import review and snapshot permissions
```

Strategies may add resource-level checks and return obligations such as a de-identified projection as those workflows are built. Routes must not call strategy modules directly. Features without protected operations should not get placeholder strategies until there is a real policy to enforce.

The current strategies require de-identified report access alongside report actions and sensitive reads; analytics export also requires analytics read. Access bundle assignment is governed by `BUNDLE_ASSIGNMENT_POLICY`, currently allowing the Admin bundle to assign the built-in Analyst, Moderator, and Admin bundles. Admin already has all catalog permissions; bundle assignment remains audited and a user cannot grant a bundle to themselves. No direct self-grant is allowed.

## 6. Authorization checks

1. **Check on the server for every protected operation.** Hiding a button or route in the UI is not authorization.
2. **Resolve permissions from active grants.** Ignore revoked and expired grants. Permission bundles are additive; there is no implicit deny override in the initial design.
3. **Fail closed.** Missing user, missing grant data, unknown permission code, or database failure must not grant access.
4. **Check record ownership and scope separately.** Permission to `reports.read_deidentified` does not imply access to every field or that a report may be changed.
5. **Enforce field-level projections.** Sensitive evidence and precise coordinates should not be loaded into a general report response then hidden in the UI.
6. **Validate state transitions.** `reports.change_status` allows approved transitions only; it does not allow arbitrary status strings.
7. **Audit grants, revocations, exports, redactions, and status changes.** Write the audit event in the same transaction as the consequential mutation where possible.
8. **Keep permission caches short-lived or invalidatable.** Revocation must take effect promptly, including for existing sessions.
9. **Protect the last administrator path.** The current revoke operation prevents removing a user's last active grant that includes `access.bundles.assign`. A global administrator-count check, account disabling controls, and out-of-band recovery process remain future work.
10. **Do not permit self-escalation.** A user cannot grant bundles or permissions to themselves or edit system bundle definitions. Delegation is a separate authority from the permissions being delegated: `access.bundles.assign` can assign only the built-in bundles explicitly listed in `BUNDLE_ASSIGNMENT_POLICY` in the source catalog. Admin has the full catalog by design; narrower accounts still cannot self-grant or edit system bundles.

## 7. Better Auth boundary

The current Better Auth configuration provides email/password authentication and Prisma-backed core auth tables. Do not assume that signing in means a user has staff permissions.

For this design, use Better Auth for authentication and session lifecycle, and keep the permission catalog and bundle grants in SAKSI-owned tables and server authorization functions. This avoids storing a comma-separated role as a second source of truth. If a future implementation chooses Better Auth's Admin plugin instead, map its custom access-control definitions to this catalog and do not also maintain a competing permission evaluator.

Before enabling account creation for deployment, decide whether staff accounts are invite-only. Public reporting remains available without signing up. Any role/bundle field exposed through Better Auth must be server-owned and excluded from user-controlled registration/update input.

## 8. Implementation status and rollout

Implemented foundation:

- `src/server/authorization/catalog.ts` is the source-controlled permission and built-in bundle catalog.
- `src/server/authorization/authority.ts` is the server-only decision entry point; the registry dispatches to one strategy per implemented permission domain. It denies unknown permissions and ignores expired/revoked grants.
- `src/server/authorization/strategies/access.ts` handles grant/revoke policy and writes audit events transactionally. Assignment is limited by `BUNDLE_ASSIGNMENT_POLICY` and self-grants are blocked.
- Prisma models and `prisma/migrations/20261104090000_authorization_authority/` persist bundles, grants, and audit events. The migration bootstraps the Better Auth tables only because the repository has no earlier auth-table migration.
- `scripts/seed-authorization.ts` and `bun run db:seed:authorization` seed the catalog and bundles. An initial admin may be bootstrapped only by setting `AUTHZ_BOOTSTRAP_ADMIN_EMAIL` to an existing verified account.
- `docs/ARCHITECTURE.md` records the boundary between Better Auth and SAKSI authorization.

Still required before staff features are usable:

1. Verify or run `bun run db:seed:authorization` against the intended database so the permission and bundle catalog is populated.
2. Add guarded administration endpoints for account lookup and bundle grant/revoke, and add staff route handlers using `requireRequestPermission()`.
3. Add audit events in the same transaction as any sensitive report operation. Currently only bundle grants/revocations and bootstrap are audited.
4. Add tests for permission resolution, grant boundaries, expiry, revocation, and authorization failures before exposing the workflows.
5. Add report persistence and moderation only after privacy, retention, evidence access, and anonymous submission rules are finalized.
6. Add district scope only when a concrete workflow requires it and the district domain table is established.

## 9. Decisions still open

- Are staff accounts invite-only, or can authenticated public users also create accounts?
- Should moderators receive access to exact coordinates and original photos through the same bundle, or should those remain separate case-by-case grants?
- Which status transitions are allowed, and does any status require a second reviewer?
- Should report exports exist at all? If so, which fields, filters, and approval/audit controls are mandatory?
- What retention period applies to authorization audit events and moderation notes?
- Is district-scoped moderation actually needed for the initial launch?

## References

- [Better Auth user and account model](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth server-owned additional fields](https://better-auth.com/docs/concepts/typescript)
- [Better Auth Admin plugin and access control](https://better-auth.com/docs/plugins/admin)
