---
name: saksi-feature-implementation
description: Implement SAKSI product features across UI, contracts, domain APIs, persistence, and authorization. Use when adding or changing a feature, permission, or protected API endpoint in this repository.
---

# SAKSI feature implementation

Implement a complete feature across the layers it needs while preserving the product, privacy, and authorization boundaries below. Do not expand the requested scope into unrelated features or external deployment.

## Start with the repository

Before editing, read `AGENTS.md`, `docs/STATE.md`, and the relevant sections of `docs/ARCHITECTURE.md`. Read `docs/AUTHORIZATION.md`, `docs/SECURITY.md`, or `docs/REPORTS.md` when the feature touches those domains. Inspect the current code and migrations instead of assuming documentation is fully current. For Next.js changes, read the relevant guide under `node_modules/next/dist/docs/` as required by `AGENTS.md`.

Trace the existing path for the closest feature: UI → shared contract → App Router handler → domain API class → use case/repository → data source. Identify which layers need changes and keep dependencies flowing in that direction. Preserve established response envelopes, validation, error handling, and UI patterns.

## Layer ownership

- `src/features/<domain>/`: client presentation and browser interactions. Do not import server modules, Prisma, database URLs, or privileged Supabase credentials.
- `src/contracts/<domain>/`: request/response DTOs shared across the client/server boundary. Use runtime validation at untrusted HTTP boundaries; TypeScript types do not validate input.
- `src/app/api/**/route.ts`: thin Next.js HTTP adapters. Delegate to a domain API class; keep business logic and persistence out of route handlers.
- `src/server/api/<domain>/<domain>.api.ts`: one API class per domain, extending shared `ApiController` where appropriate. Own endpoint orchestration, request validation, authorization, and mapping to the shared response format.
- `src/server/<domain>/`: server-only use cases, strategies, repositories, and domain policy. Keep HTTP and React concerns out.
- `prisma/schema.prisma` and `prisma/migrations/`: persisted model and forward migration. Preserve existing data and history; do not edit an already-applied migration.

Keep server-only modules marked `server-only` where they handle credentials or private data. Browser-facing responses should expose only the fields needed by that view.

## Authorization is per permission bit

Every authenticated account is a `User`; do not add implicit user, moderator, or admin roles to the user model. Persist authorization as individual `UserPermissionGrant` rows referencing canonical `Permission` codes. Permission bundles/presets are source-controlled conveniences that expand into permission codes before persistence. They are not stored as a user's role or bundle assignment. If product work introduces resource-scoped grants, first inspect the schema and authorization design; do not overload a global grant with a scope it cannot represent.

When a feature needs a new permission:

1. Add a stable, narrowly scoped code and description to `src/server/authorization/catalog.ts`. Treat the catalog as the source of truth; update its seed/migration path if the existing seed process requires it.
2. Decide which presets include the permission. Presets are derived assignment conveniences, not effective authorization rules. Ensure Admin continues to include all catalog permissions and Moderator gets only its intended moderation subset.
3. If individual assignment policy must change, update `PERMISSION_ASSIGNMENT_POLICY` explicitly. Do not allow a permission grant to delegate `access.permissions.assign` or `access.presets.apply` through the individual-bit path.
4. Add or update the domain authorization strategy under `src/server/authorization/strategies/` and register it through the existing registry when the domain is new. Keep central identity resolution, deny-by-default behavior, and permission dispatch in `authority.ts`.
5. Enforce authorization on the server for every protected read and mutation. UI tabs, disabled buttons, and client permission state are presentation only. Add resource ownership, field-level filtering, and state-transition checks separately where needed.
6. Audit sensitive authorization or moderation changes through the established audit path. Keep secrets, raw invite tokens, and sensitive payloads out of audit metadata.

Do not create a new permission for a distinction already enforced by domain/resource policy. Do not grant privileges just to make a UI control visible. For public or account-optional endpoints, document that they are intentionally public and apply input validation, rate limits, CORS, and abuse protections appropriate to that endpoint.

## Add an API endpoint

1. Define or update its contract in `src/contracts/<domain>/` and validate URL, JSON, or multipart input at the server boundary using the established schema library.
2. Add endpoint behavior to the domain API class. Use `requireRequestPermission()` or another central authority entry point before protected work. Fail closed if identity, permission, or required configuration cannot be established.
3. Add a thin route adapter under `src/app/api/` that handles only HTTP method wiring and transport-specific behavior such as preflight/CORS. Follow the existing exact-origin CORS helpers when cross-origin access is required; never use wildcard origins with credentials.
4. Put domain rules and persistence in a server use case/repository, not in the route or UI. Use Prisma for ordinary persistence; use named repository methods for spatial queries.
5. Return the shared `{ data, error }` API envelope, stable status codes, and generic client-safe error messages. Do not leak SQL, stack traces, credentials, or private identifiers.
6. For mutating endpoints, consider idempotency, rate limits, audit records, transaction boundaries, and retry behavior based on the operation. Never assume a browser retry happens only once.

## Data, product, and privacy constraints

- Keep official road-package snapshots and database credentials server-side. Browser features call the application API.
- Preserve provenance, retrieval date, and location precision when surfacing official data. The map represents administrative area coverage, not exact package worksite coordinates.
- Treat citizen reports as signals for review, not proof or accusations. Use careful uncertainty language and preserve moderation state.
- Report photos must be sanitized before persistence, stored privately, and excluded from public projections. Respect existing report retention and moderation decisions; do not quietly change the on-device/privacy promise.
- Keep the product focused on road, bridge, drainage, sidewalk, and retaining-wall infrastructure in the current Kota Tangerang scope unless the user asks to change it.
- Match the Indonesian UI language, existing design system, and terminology in `docs/DESIGN.md`.

## Finish and report

Update relevant documentation when a feature changes a contract, permission, schema, privacy boundary, or implementation status. Add a migration when persisted schema changes; describe any required rollout order without deploying it unless specifically requested.

Verify the change with the repository's applicable lint/build/type or Prisma validation commands, observing the user's request and repository instructions. Do not claim checks that were not run. Do not add tests unless the user asks for tests. Review the diff for accidental secrets, generated files, unrelated edits, and `.agents/` changes. Report the files and behavior changed, checks actually performed, and any remaining operational steps.
