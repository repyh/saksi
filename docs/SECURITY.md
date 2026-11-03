# SAKSI Security

**Last reviewed:** 4 November 2026
**Status:** Security foundations exist in code, but authentication migrations have not been confirmed on Supabase and protected business APIs are not yet wired to the authorization authority. Do not treat the current prototype as production-ready.

This document distinguishes controls that are implemented in the repository from controls that are only configured, proposed, or still missing. For permission codes and bundle semantics, see [AUTHORIZATION.md](./AUTHORIZATION.md). For server and data boundaries, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Security status at a glance

| Area | Current state | Notes |
|---|---|---|
| Server/client boundary | Implemented | Prisma and auth modules are server-only; the browser uses application APIs. |
| Email/password sign-in | Implemented in code | Better Auth with Prisma/Postgres; unavailable without `DATABASE_URL`. |
| Email/password sign-up | Invite-gated in code | A Better Auth user-creation hook rejects account creation without a valid matching invite. |
| Login and registration rate limit | Configured in code; database deployment unconfirmed | Five requests per minute per client IP for sign-in and sign-up, stored in Postgres. |
| Permission authority | Implemented as a foundation | Invite issue/revoke uses the `access.users.invite` permission; broader staff APIs remain unimplemented. |
| Report submission | Not implemented | The report prototype keeps drafts in the browser; there is no server submission endpoint. |
| Registration invitations | Implemented in code; migration not deployed | `/register`, invite storage, permission-checked issue/revoke APIs, and atomic redemption are implemented. |
| Supabase migrations | Not confirmed deployed | Recent Prisma status/deploy attempts failed while resolving the shared pooler tenant/user. |

## 1. Trust boundaries

- `src/features/**` contains browser UI and browser-side state. It must not import Prisma, database credentials, or `src/server/**` modules.
- `src/app/api/**` contains Next.js route adapters. Domain API classes and server use cases handle request policy and business operations.
- `src/server/**` and `src/lib/**` contain server-side auth, authorization, database, and repository code. Sensitive modules use the `server-only` marker.
- Package snapshot data is read on the server through the package repository. The browser receives API DTOs rather than database access.
- Supabase credentials must remain in server environment variables. `.env*` files are ignored by Git except `.env.example`; this does not replace a production secret manager or safe handling in logs.

The `/api/packages` endpoint is intentionally public. It validates filter inputs and returns a generic error for unexpected failures, but it currently has no request rate limit. Public access is not a permission grant.

## 2. Authentication

### Implemented

- Better Auth is configured for email/password authentication with Prisma's PostgreSQL adapter in `src/lib/auth.ts`.
- The login page calls Better Auth through the browser auth client. The server-side Better Auth handler is mounted at `/api/auth/*`.
- When `DATABASE_URL` is absent, the auth handler returns `503 AUTH_UNAVAILABLE`; the database client is created lazily, so static builds do not need a database.
- Login errors are mapped to user-facing messages. The `returnTo` value is restricted to a local path to prevent an external redirect through that parameter.
- Better Auth owns password verification, account persistence, and session behavior. Application code should not implement a parallel password or session system.

### Registration gate

`/register` uses Better Auth's email/password sign-up flow, but a server-side `databaseHooks.user.create.before` hook rejects every account creation unless the request is the email sign-up endpoint and carries a valid invite token. The gate applies to direct API calls as well as the UI.

The hook hashes the presented token and atomically updates a matching invite only when the email matches, it has not expired, and it is neither redeemed nor revoked. Better Auth runs that hook within the user-creation transaction; account, credential, and invite updates commit or roll back together. The conditional update prevents concurrent reuse. New accounts do not auto sign in and receive no permission bundle. Passwords require 12–128 characters.

Invite tokens use 256 bits of cryptographic randomness. Only a SHA-256 hash is stored. The email-bound link places the raw token in the URL fragment, which is not sent in HTTP requests or referrer headers. The registration page reads it once and removes the fragment from the address bar. It sends the token in a request header; the token is never placed in audit metadata.

`POST /api/access/invites` and `DELETE /api/access/invites/:inviteId` issue and revoke invites through `AccessApi`. Both require `access.users.invite`; issuance is audited without the raw token, limited to three active invitations per email, and returns the link only in the creation response. Invites expire in 1–30 days (7 by default). The app does not send invitation email. Administrative issuance has no endpoint-specific rate limit yet.

Email verification and password-reset email delivery are not configured. Do not present registration as verified or recoverable until those workflows and their email delivery are implemented.

## 3. Login rate limiting

Better Auth is configured to limit `/sign-in/email` to **five requests per minute per client IP**. It is explicitly enabled in development and production and uses the Postgres `rateLimit` table so counters can be shared by multiple app instances. A throttled request returns HTTP `429`; the login UI presents a retry message.

The Prisma model and migration exist in the repository, but the migration has **not been confirmed on Supabase**. Prisma deployment/status attempts have returned a shared-pooler `tenant/user not found` error, so the presence of the table and live enforcement must be verified after correcting the Supabase connection string and successfully applying migrations.

IP-based throttling depends on the hosting proxy supplying a trustworthy client IP. Configure the deployment to overwrite or sanitize forwarded-IP headers. If Better Auth cannot resolve a client IP, it falls back to a shared per-route bucket, which can throttle unrelated users together. Do not trust arbitrary client-supplied forwarding headers.

The sign-in and sign-up limits do not cover every API route. Public package search has no request limit, and administrative invite issuance has no endpoint-specific throttle yet.

## 4. Authorization authority

SAKSI has users, not implicit roles. The central server-side authority in `src/server/authorization/authority.ts` resolves active bundle grants and dispatches checks to domain strategies. Unknown permission codes and unauthenticated requests are denied. Active grants exclude revoked and expired entries.

The current access strategy:

- prevents a user from granting a bundle to themselves;
- checks the actor's delegation authority and the approved bundle-assignment policy;
- requires a reason for grants and revocations;
- writes the grant/revocation and its audit event in the same serializable transaction; and
- prevents revoking the last grant that carries bundle-assignment authority for that subject.

Permission definitions and built-in bundle membership are source-controlled. A new account receives **no bundle automatically**. See [AUTHORIZATION.md](./AUTHORIZATION.md) for the catalog and bundle contents.

### Important enforcement gap

The authority and permission strategies exist. Invite issue/revoke operations now call the central authority, but report and other staff APIs remain unimplemented. A hidden button or a client-side check is not authorization. Every protected server operation must call the central authority and apply field/resource checks before loading or returning sensitive data.

Audit event writes exist for bundle changes, but the database does not enforce an append-only policy. Audit retention, access controls, operational review, and alerting remain to be defined.

## 5. API and error handling

- `src/app/api/packages/route.ts` delegates to the server-only `PackagesApi` class.
- Package query values are validated at the HTTP boundary, and unexpected failures return a generic public error rather than internal exception details.
- Shared API helpers standardize success and failure envelopes. `request-context.ts` currently defines a scaffold only; request IDs are not yet consistently passed into logs or audit records.
- Better Auth's catch-all route is intentionally delegated directly to Better Auth so its authentication responses and cookies are not altered by the generic API wrapper.
- `AccessApi` validates, authorizes, and audits invitation issuance and revocation. It returns the raw invite link once to the authorized inviter and excludes it from audit metadata. Reports API remains a scaffold; no report-submit or general staff-administration endpoint is implemented.

## 6. Reports and personal data

The current report flow is a client-side prototype. Draft state is stored in IndexedDB; there is no report submission API or server-side report persistence. The report flow is designed to remain account-optional, and exact reporter identity is not a prerequisite. This prototype state must not be described as secure server storage or as a submitted report.

The intended privacy rules are to remove photo EXIF and blur faces/vehicle plates on-device before any future upload. Since no upload endpoint exists, these are product requirements for a future submission flow, not a server-side control already enforced by this application.

## 7. Approved registration invitation design

The approved direction is **semi-invite-only**: account creation requires an individual invitation generated on demand. The application code and Prisma migration `20261104130000_registration_invites` are implemented; the migration still needs deployment to Supabase.

### Token lifecycle

1. An authorized inviter requests one invitation for a specific email address.
2. The server generates an opaque, high-entropy token with a cryptographically secure random generator. Do not derive invitations from a shared static code or expose a signing/private key to the browser.
3. Store only a one-way hash of the token, with the normalized intended email, creator, creation time, expiry, redemption time, and revocation state. Show the raw token only when issuing the invitation; never store it in audit metadata or application logs.
4. Opening the registration link does not consume the invitation. The current page defers validation until form submission; this also avoids token-consuming link prefetch behavior.
5. On registration submission, validate the token, email, expiry, and status on the server. The Better Auth create-user hook marks the invitation redeemed in the same transaction as account creation, so parallel submissions cannot reuse it.
6. Reject expired, revoked, already redeemed, mismatched-email, and unknown invitations with a generic response. Better Auth rate-limits registration attempts.

Use a short-lived, single-use invite bound to an email by default. A link token is a bearer credential; use HTTPS, prevent referrer leakage, avoid third-party tracking on the registration route, and clear the token from browser history after it is exchanged. An invite grants no permissions unless the inviter is separately authorized to delegate a specific bundle and that grant is explicitly recorded and audited.

The first administrator/inviter must be provisioned through a controlled, out-of-band bootstrap process. Do not create a public endpoint that lets an unauthenticated visitor mint invitations or grant bundles.

### Local administrator bootstrap

The repository includes a one-time operator command for creating the initial administrator:

```sh
bun run db:seed:authorization
bun run db:bootstrap-admin admin@example.org
```

Run it only from a trusted interactive environment with the intended Supabase database configured. The bootstrap command refuses an existing email, verifies the generated Better Auth password hash before writing, creates the user and credential, grants the source-controlled `admin` bundle, and records a `bundle.bootstrapped` audit event in one serializable transaction. It prints a randomly generated temporary password once. Capture it through a trusted local channel, then replace it after sign-in; do not run this command in CI or a shell whose output is retained by a shared log collector. The new account starts with `emailVerified: false`; verify the mailbox before using it beyond local testing. Never put the password in source control, a ticket, or an audit record.

### Invitation persistence shape

An invitation record should include at least:

| Field | Purpose |
|---|---|
| `id` | Internal invitation identifier |
| `tokenHash` | Unique hash used to find and verify the presented token; never the raw token |
| `email` | Normalized invitee email binding |
| `createdByUserId` | Authorized inviter, or an explicitly identified bootstrap actor |
| `createdAt` / `expiresAt` | Issuance and expiry |
| `redeemedAt` | Single-use redemption marker |
| `revokedAt` | Manual invalidation before redemption |

The redeem operation uses Better Auth's database transaction and a conditional update to enforce single use under concurrent requests. Invite issuance/revocation and redemption are recorded minimally. Raw invite tokens and passwords are excluded from audit metadata.

## 8. Production readiness gaps

Before enabling staff operations or invite registration in production:

1. Correct the Supabase connection configuration, apply pending migrations, and verify migration status. Until then, database-backed auth and rate limiting are not confirmed operational.
2. Apply the registration-invite migration and provision the first administrator out of band with the bootstrap command above. Confirm the admin bundle matches the authorization catalog before issuing invitations.
3. Configure email verification and password-reset delivery, or explicitly decide and document an alternative account recovery process.
4. Wire every protected route to the central authorization authority; add resource-level and field-level checks.
5. Add rate limits to public endpoints based on their abuse and cost profile; configure trusted client-IP handling at the hosting proxy.
6. Define audit-log access, retention, backups, and operational review. Ensure credentials and bearer tokens never enter logs.
7. Implement report submission only after privacy, moderation, retention, and abuse controls are defined. Keep report submission account-optional.

## References

- [Better Auth email/password options](https://better-auth.com/docs/reference/options) — sign-up defaults and verification configuration.
- [Better Auth security](https://better-auth.com/docs/reference/security) — authentication security behavior.
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) — token generation, single use, expiry, referrer leakage, and rate limiting.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) — avoiding secrets in URLs and consistent server-side controls.
- [Supabase shared pooler troubleshooting](https://supabase.com/kb/troubleshooting/tenant-or-user-not-found) — host/username mapping errors.
