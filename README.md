# SAKSI

**SAKSI** (*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*) makes public road-work packages in Kabupaten Tangerang easier to explore by linking procurement records with their mapped location and location precision.

The product uses neutral, evidence-led language. A map location or a citizen report is a signal for review, not proof of wrongdoing or a guarantee of government action.

## Current implementation

- The home page presents the audit overview and an interactive road-package map.
- The map shows the 2025–2026 snapshot, with filters for year, kecamatan, work type, and search.
- Selecting a package opens its details and RUP reference.
- Package data is read by a server-only repository. The initial page uses a Next.js Server Component; interactive filters use `GET /api/packages`.
- The current repository adapter reads the checked-in JSON snapshot. It does not query Supabase for package records.
- Better Auth and Prisma are configured for server use. PostGIS is enabled in the Supabase project, but package, GIS, report, and ingestion domain tables are not yet modeled.
- The report draft store uses IndexedDB. The report page and submission API are not implemented.
- Government and social-source scrapers are planned as separately deployed scheduled workers; they are not implemented yet.

## Technology

- Next.js App Router, React, TypeScript, Tailwind CSS, React Icons, and Bun
- Leaflet / React Leaflet with OpenStreetMap tiles and attribution
- Supabase Postgres with PostGIS, Prisma ORM, and Better Auth foundations
- PWA install and offline fallback foundations; map tiles and API responses are not cached by the service worker

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the frontend/backend boundary, API contract, repository design, and planned scraper flow. See [docs/DESIGN.md](docs/DESIGN.md) for interface rules.

Report drafts are stored locally in IndexedDB and stay on the device until a future submission flow is explicitly implemented. Do not add a server photo upload path; image privacy processing is intended to happen in the browser before submission.

## Data sources and early findings

The following sources were researched for the project as of October 26, 2026. These figures are **research baselines, not live data currently displayed by the application**.

| Source | Contents | Notes |
|---|---|---|
| [Bina Marga GIS — IRI 1/2026](https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/IRI_1_2026/FeatureServer/0) | 477,032 measurement points, about 47,703 km of national roads | Public endpoint; use `outSR=4326` for web mapping |
| [Bina Marga GIS — PCI 2025](https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/Centerline_PCI_2025/FeatureServer/0) | 926,416 PCI segments | Public endpoint |
| [Bina Marga GIS — national road segments](https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/Jalan_Nasional_PPK_Satker/FeatureServer/0) | 3,306 road segments, including regency/city names | Reference data for road matching |
| [Ministry of Public Works data portal](https://data.pu.go.id/) — road surface conditions | CSV condition data by province, 2020–2023 | Historical data; show the source year |

An initial IRI analysis found a national average of 4.97 and about 6.8% of points in damaged classes. Regency/city aggregation covers only 299 locations, with about 63% of roads successfully matched; results are still sampled and **must not be cited as final figures**. The ArcGIS service limits query results to 2,000 rows, so full extraction must use paging by `objectid` and `resultOffset`.

Every figure shown on the site must come from processed data and its source manifest, not a hard-coded UI value. Include the retrieval date, measurement period, methodology, coverage, and limits on interpretation.

## Remaining implementation

- A citizen report page and submission API, including moderation and abuse controls
- Prisma domain models and repository backed by Supabase Postgres/PostGIS
- Separate government-site and social-source scraper workers with provenance, validation, retries, and run history
- Viewport-aware map queries and a separately paginated package register
- Published methodology and source metadata for every displayed metric

### FDS priorities — November 1, 2026

The following must be working for the First Draft Submission:

- Landing page with one sourced figure, its explanation, and a **Report** button
- Report form that displays CV results
- Map or list of reports
- Public repository and a PDF of up to 10 pages with the concept, sitemap, wireframes, key features, and screenshots of at least two pages (the landing page and one other page)

Do not present inferred location precision as an official contract coordinate. Keep report status and uncertainty explicit, and do not show derived comparisons without their source, period, coverage, and methodology.

## Running the project

### Prerequisites

- Bun 1.4.2
- Node.js 24 LTS for Next.js compatibility
- A Supabase Postgres project

### Local installation

```powershell
bun install
Copy-Item .env.example .env.local
```

Set `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `DIRECT_URL`, and `DATABASE_POOL_MAX` in `.env.local`. If `.env.local` already exists, add the required values without overwriting existing secrets.

Get the connection URLs from **Supabase Dashboard → Connect**. Use the Session pooler on port 5432 for a persistent server; use the direct URL for migrations when the network supports IPv6. If it does not, the Session pooler can also be used for migrations. For serverless deployments, use the Transaction pooler on port 6543 for `DATABASE_URL`, add `pgbouncer=true`, and start with `DATABASE_POOL_MAX=1`. Never put database credentials or a service-role key in browser code.

```powershell
bun run db:generate
bun run db:migrate --name init
bun run dev
```

Open <http://localhost:3000>. Prisma Migrate in development also requires a shadow database; configure the required permissions or a separate shadow database. To apply committed migrations in staging or production, run `bun run db:deploy`. Check migration status with `bun run db:status`.

### Main scripts

| Command | Purpose |
|---|---|
| `bun run dev` | Start Next.js in development mode |
| `bun run build` | Create a production build |
| `bun run lint` | Run ESLint |
| `bun run db:generate` | Generate the Prisma Client |
| `bun run db:migrate --name init` | Create and apply a development migration |
| `bun run db:deploy` | Apply committed migrations |
| `bun run db:status` | Check migration status |

## Current repository structure

```text
src/
  app/          # Server-rendered pages and HTTP route handlers
  contracts/    # Shared request and response DTOs
  features/     # Browser UI and feature interactions
  server/       # Use cases, repository interfaces, server-only adapters
  lib/          # Better Auth and Prisma clients
workers/        # Planned, independently deployed scraper processes
data/           # Versioned source snapshots
prisma/         # Postgres schema and migrations
docs/           # Product, design, handoff, and architecture documentation
```

Government and social media scrapers will run as two scheduled workloads on a server separate from Next.js. Scraper implementations are not yet in this repository.

## Privacy and data quality principles

- Public reporters do not need accounts. Do not request names, national ID numbers, phone numbers, or social media accounts.
- The report submission flow is not implemented. Keep its privacy design explicit; do not add a photo upload path if photos are promised to stay on-device.
- Ask for consent before accessing location; blur it before submission and show public locations at an appropriately coarse level.
- Clearly label report status and uncertainty. Rejected reports remain recorded as unverified so patterns can still be studied.
- Show the source, date, coverage, and methodology alongside every figure.
- Do not infer causes or blame from data differences; explain that differences can reflect data age, methods, location, or field conditions.

## Competition deadlines

- **November 1, 2026:** First Draft Submission — public repository and FDS PDF of up to 10 pages.
- **November 11, 2026:** Qualifiers — proposal of up to 30 pages, originality letter, and pitch video of up to 5 minutes.
- **November 28, 2026:** On-site final — deck of up to 15 slides, 10-minute presentation, and 5-minute Q&A.

The team name, role assignments, availability of local photos, GPU access, and final product-name check still need to be decided by the team. See the full project brief for the rubric, sources, risks, and competition rules.
