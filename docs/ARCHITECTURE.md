# SAKSI Architecture

**Status:** The frontend/backend boundary is implemented for road-package search. Package search, contracts, vendors, and audit metrics now read the Supabase catalog through Prisma; the checked-in snapshot remains the no-database fallback. Scraper workers and remaining provenance pages are the next implementation stages.

## Decision

SAKSI uses one repository with two deployment boundaries:

1. **Web application:** Next.js App Router provides the user interface, server-rendered initial data, API routes, authentication, and application use cases.
2. **Scraper workers:** Government-site and public social-source collectors run as separately deployed scheduled processes. They do not run in the user's browser or as part of a web request.

The Next.js server is the web app's backend-for-frontend (BFF). The browser calls application APIs for interactive queries. Only server modules may access Prisma, database credentials, or ingestion interfaces. The map remains a client-side component because MapLibre GL JS requires browser interaction.

This decision supersedes the older FDS instruction to load the JSON directly from the browser. Prisma defines the ingestion, package, administrative-area, and report persistence models; migrations are deployed, and the Kota Tangerang catalog is populated by `workers/ingest.mjs`. When `DATABASE_URL` is set, package search and contract/vendor reads use that catalog; without it, the repository falls back to the checked-in snapshot so `next build` and database-less environments keep working.

## System context

```mermaid
flowchart LR
  Browser["Browser<br/>UI, filters, MapLibre"] -->|"GET /api/packages"| Routes["Next.js route handlers"]
  Page["Next.js server page"] --> UseCases["Package use cases"]
  Routes --> UseCases
  UseCases --> Repository["Road package repository"]
  Repository --> Prisma["Prisma repository<br/>primary adapter"]
  Repository -. "no DATABASE_URL" .-> Snapshot["Checked-in data snapshot<br/>fallback adapter"]
  Prisma --> Postgres["Supabase Postgres + PostGIS"]
  GovWorker["Government scraper<br/>separate scheduled deployment"] --> Ingest["Validated ingestion boundary"]
  SocialWorker["Social-source scraper<br/>separate scheduled deployment"] --> Ingest
  Ingest --> Postgres
```

Prisma, Better Auth, and PostGIS are present. Authentication, authorization, registration-invitation, and report migrations have been deployed to the configured Supabase project, and the Kota Tangerang package, RUP, contract, realization, and administrative-area catalogs are populated. The application queries the package catalog when `DATABASE_URL` is set and otherwise falls back to the snapshot adapter.

## Boundaries and ownership

| Layer | Owns | Must not own |
|---|---|---|
| `src/features/**` | Presentation, map interaction, filter controls, browser-only draft storage | Prisma, database URLs, scraper scheduling, source parsing |
| `src/app/api/**` | Next.js HTTP adapter functions that delegate to a domain API class | Request business logic, SQL, source parsing, UI state |
| `src/server/api/**` | Domain API classes, HTTP input validation, authorization checks, response/error mapping | React components, browser APIs, direct domain persistence |
| `src/server/**` (outside `api/`) | Use cases, domain filtering, repository interfaces and implementations | HTTP transport concerns, React components or browser APIs |
| `src/contracts/**` | Shared request/response and domain DTO types | Runtime secrets or persistence logic |
| `prisma/**` | Database schema and migrations | Scraper schedules or UI behavior |
| `workers/**` | Source adapters, schedules, parsing, normalization, validation, ingestion, run history | Browser UI, public web request handling |

Allowed dependency direction:

```text
Browser UI -> API contract -> Next.js route adapter -> domain API class -> use case -> repository -> data source
Scraper schedule -> source adapter -> normalize/validate -> ingestion -> restricted persistence access
```

Client components must never import from `src/server` or `src/lib/prisma`. Server-only modules use the `server-only` marker to make that boundary enforceable during builds.

## Current implementation

### Package search

- `src/app/page.tsx` is a Server Component. It resolves `?region=` (default `kota-tangerang`), calls `searchRoadPackages({ region })`, and passes the initial result to the interactive map dashboard.
- `src/features/map/map-dashboard.tsx` owns only filter and selection state, plus rendering the list and map.
- Changes to region, year, district, work type, or search text call `GET /api/packages?region=<id>`.
- `src/app/api/packages/route.ts` delegates `GET` to `src/server/api/packages/packages.api.ts`. `PackagesApi` validates query parameters, calls the package use case, and returns the shared `ApiResult<T>` envelope through shared HTTP response handling.
- `src/server/packages/service.ts` owns filtering and result counts. It depends on `RoadPackageRepository`, not on a UI component or Prisma directly.
- `src/server/packages/source.ts` selects the repository per region: `database-repository.ts` queries Prisma when `DATABASE_URL` is set, while `snapshot-repository.ts` reads `data/regions/<id>/region.json` as the fallback. Both are server-only.
- `src/server/packages/lpse-repository.ts` builds the contract and vendor index from `lpse_contracts` and `realization_transactions` in database mode, and from the checked-in LPSE/realization JSON in fallback mode.
- `src/app/peta-pekerjaan/[[...segments]]/page.tsx` is the map route. It server-renders the initial package set and viewport aggregate, parses address/package segments, and hands both to `src/features/map/map-dashboard.tsx`.
- `src/app/paket/page.tsx` is the server-rendered package directory: it lists packages with year, work-type, and text filters plus pagination, and links each row to the detail page.
- `src/app/paket/[rup]/page.tsx` is the server-rendered package reading page. It calls `getRoadPackageDetail()` from `src/server/packages/service.ts`, which joins the active package item with `src/server/packages/rup-detail-repository.ts`. That repository is server-only, reads `region.sumber.detail` once per region into a `Map`, normalizes empty values (`""`, `"-"`, `"tidak ada"`) to `null`, and treats a missing file as an empty detail set without failing the page. The page renders plan, location, contract, and published-report sections; it never renders `lokasi_raw` and never creates a map pin.
- `src/server/regions/region-registry.ts` discovers region configs from `data/regions/*/region.json` and exposes the region summary used by the API, audit metrics, and map (boundary URLs, GeoJSON property names, centre, environment label).
- Shared package DTOs live in `src/contracts/packages/road-package.contract.ts`; region DTOs live in `src/contracts/regions/region.contract.ts`.
- `scripts/check-region.mjs` is the per-region quality gate (structure, road object, anchor consistency, provider coverage) and writes an optional provenance manifest. `scripts/ingest.mjs` runs one job per region with a delay between commands.
- `src/server/api/shared/` contains transport errors, response helpers, and the request-context shape. Each domain API owns its endpoint policy. `AccessApi` handles account directory/profile/lifecycle operations, permission grants, and invite issuance/revocation; `ReportsApi` implements submission, account history, the staff review queue, public published-report queries, and Publish/Reject moderation. Better Auth's catch-all route continues to delegate directly to Better Auth.

The register is paginated (`page`/`limit`, 50 rows by default, 300 maximum) and the map reads a separate compact aggregate endpoint (`GET /api/packages/map`) bounded by the current viewport (`bbox`), so the browser no longer downloads every matching row. A selected package is fetched on demand from `GET /api/packages/[rup]`.

#### Catalog cache and revalidation

The catalog read path is cached with Next's built-in Data Cache, not with a process-lifetime `Map`:

- `src/server/packages/catalog-cache.ts` wraps package rows (`catalog-road-package-bases`), the road-only contract map (`catalog-contracts-per-rup`), the vendor register (`catalog-vendors`), and snapshot metadata (`catalog-snapshot-meta`) in `unstable_cache` with a one-day revalidation window and the tag `catalog`. The source catalog is refreshed by daily ingestion; a five-minute cache expiry forced users to wait for a full remote contract-index rebuild every five minutes.
- Package rows and contracts are two entries because Next refuses a single Data Cache entry above 2 MB. `listRoadPackagesCached()` combines them per request; the same helper feeds the register, detail pages, map aggregate, vendor pages, the landing builders, `/metode`, and the package APIs.
- `cache()` from React deduplicates those loaders within one request. `generateMetadata` and the page on `/paket/[rup]` and `/penyedia/[slug]` therefore read one detail object, `searchRoadPackages` and `aggregateRoadPackages` share one filtered context on `/peta-pekerjaan`, and the two landing builders share one package read.
- The active source (`database` or `snapshot`) is part of every cache key. A build performed without `DATABASE_URL` therefore cannot serve snapshot entries to a runtime process that reads the database.
- `/paket`, `/penyedia`, `/penyedia/[slug]`, `/peta-pekerjaan`, `/metode`, and `/` export `revalidate = 300`. Every one of those routes reads `searchParams` for region/filters, so Next keeps the route itself dynamic; the effective cross-request cache is the Data Cache above, not a cached page shell. Route-level ISR would require giving up server-side query filters, which would change behavior.
- `/paket/[rup]` and `/laporan/publik` deliberately have no route revalidate. Public-only report list/detail projections use a 60-second tagged cache; a moderation status change expires the `published-reports` tag immediately so publish/reject decisions appear on the next request.
- `getIndeksKontrak()` keeps an in-process promise/map cache for CPU work, but the cached package/contract/vendor entries above are the authoritative cross-request layer. On a new instance the maps are rebuilt from the Data Cache entries or, on a cache miss, from one database read; correctness does not depend on process lifetime.
- `scripts/profile-pages.mjs` (`npm run profile`) measures the cache in production mode with sequential p50/p95, optional 8-request parallel batches, optional warm-up, an optional separate cold-start pass, and HTML/JSON dumps for before/after comparison. It discovers the test RUP and vendor slug from the region files, so it runs with or without `DATABASE_URL`.

Refresh remains time-based (`revalidate: 300`) plus the `catalog` tag for future on-demand invalidation after ingestion. Moving filtering and map aggregation into SQL/PostGIS is still the next scale step; the aggregate is recomputed from cached rows per request.

Measured with `next build` + `next start`, `DATABASE_URL` active, 3 warm-up requests and 7 samples per URL on the same machine (`npm run profile`):

| URL | Baseline p50 | After p50 | Target p50 |
|---|---:|---:|---:|
| `/paket` | 1.137 ms | 45 ms | ≤100 ms |
| `/penyedia` | 2.123 ms | 38 ms | ≤100 ms |
| `/api/packages` | 1.923 ms | 16 ms | ≤100 ms |
| `/api/packages/map` | 1.628 ms | 22 ms | ≤100 ms |
| `/api/packages/[rup]` | 1.678 ms | 21 ms | ≤100 ms |
| `/paket/[rup]` | 1.949 ms | 259 ms | ≤300 ms |
| `/penyedia/[slug]` | 3.738 ms | 21 ms | ≤300 ms |
| `/peta-pekerjaan` (full body) | 3.161 ms | 51 ms | ≤300 ms |
| `/laporan/publik` | 1.445 ms | 253 ms | ≤300 ms |
| `/metode` | 1.823 ms | 12 ms | ≤300 ms |
| `/` (full body) | 2.100 ms | 55 ms | ≤300 ms |

The 8-request parallel p95 was 411 ms against the 1.000 ms target. The remaining 253–259 ms on `/paket/[rup]` and `/laporan/publik` is the fresh published-report query, not catalog cost, and is intentionally not cached. The first-request cold sequence (same run, no warm-up) was 3.398 s for `/paket`, 1.826 s for `/penyedia`, 419 ms for `/paket/[rup]`, 102 ms for `/peta-pekerjaan`, 279 ms for `/laporan/publik`, 1.894 s for `/metode`, 1.948 s for `/`, and 3.116 s for `/api/packages`; cold start is reported separately and is not a gate. Snapshot mode (no `DATABASE_URL`) also passed every p50 target; its warm p50 was 17–82 ms for pages and 15–31 ms for APIs, with parallel p95 275 ms.


### Database and authentication

- Supabase is the managed PostgreSQL host. PostGIS is enabled in the `extensions` schema.
- Prisma is the application ORM and is used by Better Auth, the authorization foundation, reports, and the database-backed package/contract repositories. The multi-region ingestion worker uses parameterized `pg` SQL for large batches against the same schema.
- The Prisma schema defines Better Auth, authorization, registration-invitation, ingestion provenance, road-package, administrative-area, and report tables. The migrations are deployed; the Kota Tangerang RUP, detail, contract, realization, and boundary catalogs are populated. Official measurement series remain undefined.
- Browser code must not connect directly to Postgres or receive database credentials or a Supabase service-role key.
- Use Prisma for ordinary reads/writes. Put complex spatial operations behind named repository methods and parameterized SQL; do not spread raw GIS SQL across route handlers or UI code.

### Authorization authority

`src/server/authorization/authority.ts` is the server-only decision entry point. It resolves active individual permission-grant rows and dispatches each permission to a domain strategy registered in `registry.ts`; Better Auth supplies identity and sessions. Domain policy lives in `strategies/reports.ts`, `analytics.ts`, `access.ts`, and `sources.ts`. The central authority owns authentication, deny-by-default behavior, and consistent denials. Strategies own domain prerequisites and transactional permission-grant operations. No account has an implicit role or preset assignment. Permission grants and revocations are persisted per code and audited. Source-controlled access presets are expanded into individual bits before persistence. The invite issue/revoke endpoints consume `access.users.invite`; broader staff routes remain unimplemented. The permission-bit flattening migration is prepared but not deployed. See [AUTHORIZATION.md](./AUTHORIZATION.md) for the permission catalog, preset boundaries, and rollout status.

Better Auth applies a database-backed IP rate limit to email/password sign-in and sign-up: at most five requests per minute per client IP. This is shared across web instances through the deployed `rateLimit` table. Ensure the hosting proxy supplies a sanitized client IP header; without one, requests share a per-route bucket and can throttle unrelated users together.

`/register` is invite-gated by a Better Auth user-creation hook. Tokens are random, email-bound, hashed at rest, single-use, and consumed in the same transaction as account creation. Permission-checked issuance and revocation are exposed through `AccessApi`. Migration `20261104130000_registration_invites` is deployed. See [SECURITY.md](./SECURITY.md) for the security behavior and rollout gaps.

### Reports

The report form keeps state in the page until submission. Local image sanitation is used for preview; on submit, `POST /api/reports` rechecks the multipart image, re-encodes it server-side, stores it in the private `report-evidence` Supabase Storage bucket, and transactionally persists the report, media metadata, package reference, status event, and idempotency result. The API supports an exact-origin CORS allowlist. `GET /api/reports/mine` uses the Better Auth session to return only the signed-in user's coarse report summaries. `GET /api/reports/review` requires `reports.read_queue` and returns a paginated staff queue without reporter identity, private text, or media references. `GET /api/reports/public` exposes only `PUBLISHED` reports with damage type, coarse size, area, dates, and package reference; it never returns reporter identity, description, location hint, precise location, or media. `PATCH /api/reports/review/[reportId]` requires `reports.change_status` (and `reports.read_deidentified`), accepts `PUBLISHED` or `REJECTED` with a mandatory reason, and appends a `ReportStatusEvent`. Submission and moderation were verified end to end on 8–9 November 2026; see [REPORTS.md](./REPORTS.md). Evidence review, public-photo policy, and retention cleanup remain unimplemented. Faces and plates require a manual reporter check.

### Ingestion worker

`workers/ingest.mjs` is the standalone government-data worker for one region. It runs RUP → detail → realization → LPSE → normalize → validate → database upsert → snapshot rebuild → `region:check`. It supports `--region`, `--dry-run`, `--sources`, `--refresh`, a database lock, retries with backoff, rate-limited source commands, structured JSON logs, run history, and atomic failure behavior: the normalized batch is one transaction, and the snapshot is only published after the temporary snapshot passes the gate. See [INGESTION.md](./INGESTION.md).

The worker preserves every source row as a checksummed artifact plus `raw_records`, including rows that do not match a RUP, package, or boundary. It populates the same catalog the application repository reads; the snapshot it publishes remains the fallback and the provenance artifact.

A social-source scraper is not implemented. Do not treat an X post as an official record or as proof of an allegation. Decide and document the permitted access method for X before implementing that worker.

## API contract

### `GET /api/packages`

Optional query parameters:

| Parameter | Accepted values | Meaning |
|---|---|---|
| `region` | Region id, default `kota-tangerang` | Snapshot and boundary configuration |
| `year` | `2025`, `2026` | Fiscal year |
| `district` | Kecamatan name, up to 100 characters | Exact kecamatan filter |
| `desa` | Repeatable kelurahan names, up to 60 | Kelurahan subset inside the chosen kecamatan |
| `work` | `SEMUA`, `PERMUKAAN`, `DRAINASE`, `JEMBATAN` | Work classification |
| `kontrak` | `ADA`, `TANPA` | Contract-record presence |
| `lokasi` | `0`, `1` | `1` hides packages without a derived area |
| `q` | Up to 120 characters | Search package name, RUP, village, or district |
| `page` | Integer 1–10,000, default 1 | Register page |
| `limit` | Integer 1–300, default 50 | Register rows per page |

Successful responses use `{ "data": ..., "error": null }`. Invalid filters return HTTP 400 with `INVALID_QUERY`; unavailable package data returns HTTP 500 with a generic message. Internal exception details are not sent to the browser.

`GET /api/packages/map` accepts the same filters (page/limit are ignored) and returns compact per-RW/kelurahan/kecamatan counts, budgets, work counts, and a sample RUP. `GET /api/packages/[rup]` returns one package including its contract record, or 404 `PACKAGE_NOT_FOUND`.

`GET /api/reports/public` accepts `region`, `paket`, `kecamatan`, `kelurahan`, `page`, and `limit`; it returns only `PUBLISHED` reports. `GET /api/reports/public/[publicCode]` is implemented as the server-rendered detail page rather than a separate JSON route. `PATCH /api/reports/review/[reportId]` accepts `{ status: "PUBLISHED" | "REJECTED", reason: string }`, requires `reports.change_status`, and appends a `ReportStatusEvent`.

`GET /api/roads?region=&q=` returns grouped road names and segment counts; `GET /api/roads?region=&name=` (or `unnamed=1`) returns segments with GeoJSON geometry. `GET /api/geocode?region=&q=` proxies Photon server-side, filters results to the region, and caches them for 10 minutes.

The contract types are shared across the UI and route. Query parameters are validated at the HTTP boundary; TypeScript types alone do not validate user input.

## Data and privacy principles

- Keep the 271 packages without a micro-location in the register; do not create map points for them.
- Preserve location precision (`Desa/Kelurahan`, `Garis Koridor`, `Kecamatan`, or general/unmapped) in all API and database projections.
- Keep source and retrieval metadata attached to official figures so values can be traced and reprocessed.
- Reports are signals for review, not accusations. Include status and uncertainty in public views.
- Do not collect reporter identity as a prerequisite. Apply rate limits without requiring a real-world identity.
- Do not upload photos that the product promises to keep on-device.

## Proposed evolution

1. **Database-backed BFF (done):** All package, contract, vendor, and audit-metric access goes through the server repository and API contract. Prisma is the primary adapter; the snapshot is the fallback when `DATABASE_URL` is unset.
2. **Spatial queries:** Move package filtering and map aggregation into PostGIS so the register no longer filters the full region catalog per request. Catalog reads are already cached by `src/server/packages/catalog-cache.ts`; filtering and aggregation remain in-process for now.
3. **Independent ingestion:** Add the two scheduled workers and an ingestion boundary with restricted credentials, idempotency, validation, and run history.
4. **Reports:** Apply the report migration, create the private bucket, then complete privacy, moderation, abuse-control, and retention decisions in [REPORTS.md](./REPORTS.md) before enabling public report access or publication.
5. **Scale map queries:** Separate paginated register results from minimal map features, query spatial features by viewport (implemented with `bbox`), and precompute the aggregate. The current cache removes the repeated database read but still computes the aggregate from cached rows per request.

Each stage should be independently deployable and should not require UI components to know which repository implementation supplies the data.

## Report location flow and Overture layer (10 November 2026)

```text
Browser report form
  ├─ MapLibre + RW/kelurahan polygons + optional Overture layer
  ├─ device GPS / draggable pin / Photon address search
  ├─ GET /api/roads?q=...        → grouped road names from road_segments
  ├─ GET /api/roads?name=...     → segments + GeoJSON geometry for selection
  └─ GET /api/geocode?q=...      → server-side Photon proxy + region filter + cache
          │
          ▼
POST /api/reports (multipart)
  → parseReportSubmissionFields
  → resolveReportLocation
      ├─ ST_Contains to reject points outside the region
      ├─ derive RW → kelurahan → kecamatan from administrative_areas
      └─ validate road_segment_id belongs to the region and is active
  → persist report + location_point + road snapshots + consent
          │
          ├─ public: GET /laporan/publik/[publicCode]
          │    point only if public_location_consent; no description/hint/photo/identity
          └─ staff: GET /api/reports/review/[reportId]
               point + road geometry only with reports.read_precise_location
               every precise-location read is audited
```

- `data/regions/<id>/jalan.geojson` is an Overture snapshot (ODbL-1.0) generated by
  `scripts/jalan.mjs`; the map loads gzipped MVT tiles generated by `scripts/jalan-tiles.mjs`
  through `/api/jalan-tiles/<region>/{z}/{x}/{y}` only when the layer toggle is on (public detail
  always loads tiles). The visible road network itself comes from the basemap style; the tiles sit
  behind an invisible line layer used for tooltip hit-testing, and hovering draws a single highlight
  line from the hovered segment instead of a second road network.
- `road_segments` is the searchable database copy imported by `ROAD_NETWORK`. It is a reference
  layer, not a package locator or package filter.
- Photon is never called by the browser directly. The proxy caches results, filters them through
  the region polygons, and returns attribution in the response.
- The report point is stored as `geometry(Point,4326)`; the region and area are derived server-side,
  never trusted from the client.
- Public reporting remains text-first: the public list never shows a point, and the detail page
  shows the point only after explicit reporter consent.
