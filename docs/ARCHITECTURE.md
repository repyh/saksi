# RUAS Architecture

**Status:** Approved architecture baseline
**Last updated:** 2026-10-26

## 1. Purpose and product shape

RUAS cross-checks citizen reports about road damage against official road-condition measurements and public statements from government sources. It presents evidence and data gaps by road segment. Reports are signals for review, not accusations or proof of fault.

The system has three main data families:

1. **Citizen reports** — anonymous, approximate location, text, and locally derived image-analysis results.
2. **Official measurements and road references** — versioned datasets such as IRI, PCI, road-segment geometries, and jurisdiction or condition data.
3. **Public-source observations** — relevant posts from approved official government accounts and government websites.

The public experience is a Next.js map and road-detail pages. Moderators use authenticated workflows to review reports and source records. Two scheduled scraper workloads run on a server separate from the web application.

## 2. Approved architectural decisions

- **Web application:** Next.js, React, TypeScript, Tailwind CSS, and Bun.
- **Authentication:** Better Auth for moderators and administrators. Citizen reporting does not require an account.
- **Database and GIS:** Supabase Postgres with PostGIS as the geospatial system of record.
- **ORM:** Prisma for ordinary relational data access. PostGIS queries and writes use parameterized SQL through Prisma where needed.
- **Maps:** OpenStreetMap-based map rendering with visible attribution. Official road measurements remain the comparator dataset; OSM is not treated as their authority.
- **PWA and offline behavior:** The Next.js app is installable. The service worker caches the offline fallback and same-origin static build assets only; it does not cache API responses, report data, photos, or OpenStreetMap tiles. Report drafts may be stored locally in IndexedDB and remain there until the user explicitly submits them online; the report form and submission flow are still to be built.
- **Scraping:** Two independent scheduled workloads: government datasets/websites and approved officials' public social accounts, primarily X. They run outside the Next.js deployment.
- **Photo privacy:** A citizen's original photo never leaves their device and is never uploaded to RUAS. Image classification and any face or plate handling happen on-device. Only the user's report text, coarsened location, consent state, and derived annotations may be submitted.
- **No reporter identity collection:** Do not request or persist reporter name, national ID, phone number, or social account. Rate limiting must not depend on collecting a real-world identity.

## 3. System context

~~~mermaid
flowchart LR
  Citizen[Citizen browser<br/>no account] -->|report text, coarse location,<br/>on-device model result| Web[Next.js application]
  Moderator[Moderator or administrator] --> Web
  Web -->|Prisma relational queries<br/>and PostGIS SQL| DB[(Supabase Postgres<br/>PostGIS)]
  Web -->|Better Auth staff session| DB
  Web -->|map display| OSM[OpenStreetMap tiles<br/>and attribution]

  subgraph scraperHost["Scraper host — separate from web deployment"]
    CronGov[Government-source schedule] --> Gov[Government scraper]
    CronSocial[Social-source schedule] --> Social[Social scraper]
  end

  Gov -->|run metadata, source records,<br/>normalized datasets| DB
  Social -->|run metadata, source records,<br/>normalized posts| DB
  DB -->|moderated, versioned, aggregated data| Web
~~~

The diagram shows logical boundaries. The scrapers may share a repository with the web app, but they have separate deployment configuration, credentials, schedules, logs, and failure handling.

## 4. Runtime and deployment boundaries

### Web application

Deploy the Next.js application to a managed web host or a separately operated Node-compatible host. It serves:

- public map and road pages;
- report submission endpoints;
- moderation and source-review interfaces;
- read APIs for map tiles/overlays, road details, and aggregate scores;
- Better Auth routes for staff accounts.

Use Bun for dependency management and the project runtime where the chosen host supports it. Pin the Bun version used by local development, CI, and worker deployments. Keep the app's declared Node LTS compatibility target aligned with the Next.js requirements and verify it in CI when changing runtime versions.

### Scraper host

Run both scraper workloads on a separate server or container platform. Each schedule invokes a bounded job; a failed run must not prevent the other scraper from running. The host should provide:

- independent schedules and timeouts per source family;
- secrets storage and restricted database credentials;
- structured logs, run identifiers, metrics, and alerting;
- retries with backoff and source-specific rate limits;
- a way to replay a failed or partial run safely.

Scrapers must be idempotent. Reprocessing the same dataset release, source URL, or social post must update or recognize the existing record rather than create duplicates.

### Database and network access

Supabase Postgres is the source of truth. The web server and scraper host connect server-to-server using separate least-privilege database roles. Do not expose database credentials to browser code. Citizen writes go through Next.js server endpoints; the browser does not receive a database service credential.

Configure DATABASE_URL for the runtime connection and DIRECT_URL for Prisma CLI migrations. Use Supavisor session mode (port 5432) for persistent app processes; use transaction mode (port 6543) only for serverless app runtimes, with pgbouncer=true and a small per-process pool. Keep migrations on a direct or session-mode connection. The project loader reads .env.local before .env, so local Supabase credentials can stay in the ignored .env.local file.

Enable PostGIS in Supabase's dedicated `extensions` schema, not `public`. Keep SQL migrations for extension-dependent objects and indexes under version control. See [Supabase's PostGIS guide](https://supabase.com/docs/guides/database/extensions/postgis).

## 5. Main data flows

### 5.1 Citizen report

1. The browser asks for location only after explaining why it is needed and obtaining consent.
2. The browser rounds or otherwise coarsens the location before transmission. The server applies a second coarsening step before persistence and never stores the raw GPS coordinate.
3. The user selects a photo locally. The browser runs the on-device model and any local privacy processing. The original photo remains on the device and is not uploaded, cached by RUAS, or included in telemetry.
4. The browser submits text, the coarsened location, consent state, and optional model annotations such as class, confidence, and bounding-box coordinates.
5. The API validates size and shape, rate-limits the request, checks for obvious spam, and stores a report with status `suspected`. It must not accept a photo or image byte payload.
6. A spatial query associates the report with a candidate road segment when it falls within the configured matching radius. Low-confidence matches remain unmatched for review.
7. Moderators may change status to `verified` or `acted_upon`; a rejected report is retained with an appropriate unverified/closed state and moderation history.

Because the photo is never sent, reviewers cannot inspect it. The UI must describe model outputs as assistance rather than verified evidence. Model version and confidence are stored with each annotation.

### 5.2 Official government sources

1. The source registry identifies each source, owner, URL, source type, expected schedule, parser version, and allowed use.
2. The government scraper fetches public pages or datasets according to the source's access rules and rate limits.
3. Each run stores provenance: source, retrieval time, release/publication date when available, parser version, and outcome.
4. Raw downloadable official files may be retained in private object storage when licensing and retention rules allow. Their checksum and metadata are stored in Postgres.
5. Parsed rows are normalized into versioned measurement and road-reference records. Keep the source release immutable; corrections create a new release or explicit revision.
6. Validation reports record missing, malformed, or out-of-range fields rather than silently dropping them.

### 5.3 Public official social sources

1. Maintain an allowlist of official accounts with the government body, the evidence used to classify the account as official, and a review date.
2. Fetch only public, in-scope posts through an access method permitted by the platform and source terms. Prefer an approved API/provider; do not bypass access controls.
3. Persist the post ID, canonical URL, account reference, publication time, retrieval time, text needed for the project, and content hash. Avoid unrelated profile and personal data.
4. Extract road/location references and topic labels as derived annotations with parser/model version and confidence.
5. Keep the source post as a cross-check signal. It does not establish that a road has been repaired or that a report is true.

If access rules, account ownership, or permitted retention are unclear, mark the source as inactive pending review rather than scraping it.

### 5.4 Measurement comparison and public outputs

For each versioned measurement release, join citizen reports to road segments and comparable measurement periods. Compute a versioned consistency result with its method, input release IDs, matching window, class mapping, included/excluded counts, and uncertainty notes.

Expose the result with the underlying counts and source dates. Do not publish a score when the spatial or temporal match is too weak; show “insufficient comparable data” instead. A segment with many citizen reports and an old official rating is a discrepancy for investigation, not proof that either side is wrong.

## 6. GIS and road data design

### Supabase PostGIS

Use PostGIS types rather than storing coordinates only as unrelated numeric columns:

- citizen report location: `geography(Point, 4326)` after privacy coarsening;
- road segment display/matching shape: `geometry(LineString, 4326)` or a suitable multi-line type;
- administrative boundaries: polygon or multi-polygon geometry as needed.

Add GiST spatial indexes to columns used for proximity, intersection, or containment queries. Use PostGIS functions for candidate selection and distance checks. For distance thresholds expressed in meters, use geography-aware operations or an explicitly suitable projected coordinate system. Confirm coordinate order and SRID at every ingestion boundary.

PostGIS should handle:

- nearest candidate road selection;
- within-radius matching (for example, the initial 30 m policy);
- report aggregation by segment and administrative area;
- spatial validation and boundary checks;
- map viewport queries and generalized public overlays.

Do not treat nearest-road matching as certain. Retain the chosen segment, distance, matching method/version, and match confidence; permit manual correction. Keep unmatched reports queryable.

### OSM and official road references

OSM provides the base map and may contribute display geometry or road names. Official datasets provide measurement IDs and condition values. These sources may not share segmentation, naming, completeness, or update dates.

Maintain an explicit crosswalk between official measurement segments and the road geometry used in RUAS. Store source IDs and crosswalk method, version, and confidence. A road name alone is not a stable join key. Unmatched or ambiguous official segments must remain visible in data-quality reports.

Use the tile provider's attribution and usage requirements in the map UI. Do not assume public OSM tile infrastructure can support arbitrary production traffic; choose an appropriate tile service and budget once expected traffic is known.

## 7. Core domain model

The initial relational model should cover these entities. Names are conceptual; migrations should follow the existing Prisma naming style.

| Entity | Purpose |
|---|---|
| `User`, `Session`, `Account`, `Verification` | Better Auth staff identity and sessions |
| `StaffRole` or equivalent | Moderator/admin authorization; roles are checked on the server |
| `Road`, `RoadSegment` | Stable RUAS road identities, geometries, jurisdiction, and external IDs |
| `RoadSourceReference` | Mapping from OSM and official source IDs to RUAS road/segment IDs |
| `DatasetRelease` | Source, publication/effective dates, retrieval date, checksum, methodology, and parser version |
| `OfficialMeasurement` | IRI, PCI, condition, date/period, segment reference, value, and source release |
| `CitizenReport` | Text, coarsened point, lifecycle status, timestamps, and optional segment match; no reporter identity or photo |
| `ReportAnnotation` | On-device CV/NLP result, model/version, confidence, and provenance |
| `ModerationEvent` | Append-only status changes, reviewer, reason code, and timestamp |
| `SourceRegistryEntry`, `ScrapeRun` | Approved scraper source metadata and run outcomes |
| `SourceObservation` | Normalized public post/page observation and source provenance |
| `ComparisonMethod`, `ComparisonSnapshot` | Versioned score method and computed per-segment results |
| `DataQualityFinding` | Invalid rows, weak joins, stale measurements, or other reviewable gaps |

Do not collapse repeated reports into one destructive record. Detect likely duplicates and preserve each report so counts and timelines remain auditable. Duplicate groups can be represented as a derived relation.

## 8. Application structure

Preserve the existing Next.js app at the repository root. Extend the current `src/app`, `src/features`, `src/lib`, and `src/contracts` layout:

~~~text
src/
  app/
    (public)/
      map/
      roads/[roadId]/
      report/
    (staff)/
      moderation/
      sources/
    api/
      auth/[...all]/
      reports/
      map/
  contracts/
    auth/
    shared/
    reports/
    roads/
    measurements/
    ingestion/
  features/
    pwa/
    map/
    reports/
    roads/
    measurements/
    moderation/
    sources/
  server/
    auth/
    db/
    gis/
    privacy/
    ingestion/
    comparison/
  lib/
    auth.ts
    prisma.ts

public/
  sw.js

prisma/
  schema.prisma
  migrations/

workers/
  government-scraper/
    src/
      sources/
      parsers/
      normalize/
      jobs/
  social-scraper/
    src/
      sources/
      parsers/
      normalize/
      jobs/

docs/
  ARCHITECTURE.md
~~~

Keep browser components separate from server-only modules. Contracts define validated request/response shapes and ingestion payloads; scraper records must be validated against the same contract at their boundary. Keep scraper-specific parsers in the relevant worker, not in the Next.js route tree.

## 9. Security, privacy, and moderation

- Public reporting is anonymous and does not require Better Auth.
- Better Auth is for staff. Enforce roles server-side on every staff mutation; hide-only UI checks are insufficient.
- Never log report text, exact coordinates, auth tokens, database URLs, or secret-bearing request bodies.
- Do not store raw GPS. Coarsen in the browser and again on the server before database insertion.
- Do not accept or store submitted image bytes. Keep image processing local and avoid analytics that capture image data.
- Free-text can contain names, phone numbers, or other personal details. Warn users not to include personal information, provide a report mechanism, and establish review/redaction and retention rules.
- Use short-lived, opaque, server-issued abuse-prevention tokens if needed. Avoid persistent browser fingerprinting. Hashing a stable device identifier does not by itself make it anonymous.
- Apply request size limits, schema validation, bot/rate controls, and abuse monitoring at the API boundary.
- Keep moderation history append-only. Use neutral states and reason codes; “suspected,” “verified,” and “acted upon” describe review status, not a legal finding.
- Public pages should aggregate or spatially generalize locations. Do not expose a precise individual report point by default.
- Separate secrets for web and worker processes. Give each the narrowest database permissions practical. Rotate scraper credentials and review source access regularly.
- Establish backup, restore, incident-response, and data-retention procedures before public launch.

## 10. Scraper reliability and operations

Each scrape run should record:

- run ID, source ID, start/end time, trigger, and scraper/parser version;
- pages or records fetched, parsed, inserted, updated, skipped, and rejected;
- source-provided publication/effective date and observed retrieval date;
- rate-limit response, retry count, and sanitized error summary;
- a completion state such as succeeded, partial, or failed.

Use bounded retries with exponential backoff and jitter. Respect source rate limits and platform rules. Alert on repeated failures, unusual volume changes, stale critical datasets, parser drift, and incomplete runs. Provide a manual re-run path by source and release. Replays must be idempotent.

At first, the two scraper jobs can validate, normalize, and persist their own records directly. Add a durable Postgres-backed queue when image-free report NLP, heavier processing, or ingestion volume needs independent workers. Avoid introducing a separate queue service before there is a clear workload that benefits from one.

## 11. Scoring, interpretation, and missing data

Define the comparison method before exposing a public “fit” percentage:

- mapping from report labels to official condition classes;
- spatial matching rule and treatment of uncertain segment matches;
- time window for considering an official measurement comparable;
- minimum report and measurement counts;
- weighting and deduplication rules;
- treatment of missing, stale, or conflicting data;
- method version and release IDs used for every result.

Display the numerator, denominator, measurement date, report period, source, and methodology with every score. Keep “no comparable data” distinct from “good match.” A discrepancy can result from data age, differing measurement methods, geometry mismatch, reporting bias, or actual change in road condition.

The “frequently reported but never planned for repair” question requires a reliable repair-plan/work-order dataset with road-segment references and effective dates. Until that source exists, describe the output as “frequently reported; repair-plan data unavailable,” not “never planned.”

## 12. Delivery sequence

1. **Foundation:** Supabase project, PostGIS enablement, Prisma connection/migrations, staff Better Auth, shared contracts, and environment/secrets setup.
2. **Reference data:** road geometry, administrative boundaries, official source registry, versioned dataset imports, and quality findings.
3. **Citizen flow:** on-device image inference, coarsened location, anonymous report endpoint, lifecycle states, and moderation tools. No photo upload path.
4. **Scraper operations:** separate server, independent cron schedules, idempotent ingestion, run history, rate limits, and alerts.
5. **GIS and map:** spatial matching, OSM map with attribution, public generalization, road detail pages, and data-date display.
6. **Comparison:** documented class mapping and versioned per-segment scores, followed by gap views.
7. **Public launch readiness:** source-rights review, privacy/retention review, restore rehearsal, accessibility, load/cost checks, and incident process.

## 13. Open questions and risks to close before launch

These do not block the architecture baseline, but affect implementation scope:

1. **Jurisdiction:** Which road classes and government levels are in the first release?
2. **Official datasets:** Who owns each IRI/PCI/condition dataset, what are its terms, update cadence, format, and stable segment identifiers?
3. **X access:** Which permitted API/provider and retention rules will be used? Which accounts count as official, and who approves that allowlist?
4. **Repair plans:** Is there an authoritative work-plan, budget, or work-order dataset for the “reported but not planned” question?
5. **Moderation operations:** Who reviews reports, what is the expected review window, and what appeals or correction path should exist?
6. **Location policy:** What exact coarsening method and public display granularity meet the privacy requirement while still allowing useful road matching?
7. **Retention:** How long should text reports, source observations, official raw files, and moderation records be retained?
8. **Scale and budget:** Expected report volume, traffic, map tile provider, scraper host, storage retention, and alerting budget.
9. **Road crosswalk quality:** Who owns review of ambiguous OSM-to-official segment matches?
10. **Measurement methodology:** Who signs off on class mapping, comparison windows, minimum sample sizes, and public wording?

## 14. References

- [Supabase PostGIS guide](https://supabase.com/docs/guides/database/extensions/postgis) — enabling PostGIS, spatial data types, and indexed geo queries.
- [Prisma guidance for geographic data and raw SQL](https://docs.prisma.io/docs/orm/prisma-client/using-raw-sql/safeql) — Prisma's documented approach for PostGIS fields and SQL operations.
- [OpenStreetMap attribution requirements](https://www.openstreetmap.org/copyright) — attribution text and data licensing.
- [Better Auth documentation](https://www.better-auth.com/docs) — authentication integration reference.
