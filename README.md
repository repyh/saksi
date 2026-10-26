# RUAS

RUAS is a civic road-condition reporting platform that uses on-device AI to assess reports and compare them with official Bina Marga data. The goal is not to add another complaints channel, but to make **consistency scores** and **data gaps** visible, using neutral language and avoiding blame.

## How the product works

1. **People report without an account.** The form accepts text, location, and a photo for on-device analysis. Photos are not sent to RUAS servers; the browser runs the ONNX model, removes EXIF metadata, and handles image privacy locally. Location is blurred before submission.
2. **AI helps assess reports.** Computer vision suggests the damage type and severity with a confidence score. NLP classifies the issue, extracts location references from text, helps detect spam, and flags likely duplicate reports.
3. **Reports are matched to road segments.** PostGIS finds nearby road segments within documented distance and uncertainty limits.
4. **Official data provides a comparison.** IRI, PCI, and official road-condition data are compared with citizen reports for comparable road segments and time periods.
5. **Results are presented as evidence for review.** The map, road pages, consistency scores, gap list, and methodology include sources and data dates. Report statuses: `suspected → verified → followed up`.

Reports are signals for review, not accusations or proof of wrongdoing. Use neutral terms such as **“suspected,” “unverified,”** and **“inconsistent with measurements.”**

## Technology

- Next.js App Router, React, TypeScript, Tailwind CSS, and React Icons
- Bun for project installation and scripts
- Leaflet with OpenStreetMap tiles and visible attribution
- Supabase Postgres + PostGIS for the database and geospatial queries
- Prisma ORM for data access; parameterized SQL for PostGIS queries
- Better Auth is available in the application foundation, but public reporters do not need to log in
- ONNX model in the browser for photo analysis (planned)
- Installable PWA foundation with local-only report draft storage; offline map tiles are not cached

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for component details and data flows.

The app manifest and service worker support installation and an offline fallback page. Report drafts can be stored in browser IndexedDB; they stay on the device until the user explicitly submits them online. The report form and submission flow are still to be built. OpenStreetMap tiles, API responses, and photos are not cached by the service worker. Install prompts require HTTPS in production (localhost is supported for development).

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

## Implementation status

As of October 26, 2026, this repository contains the Next.js foundation and a Leaflet/OpenStreetMap map view. Prisma, Better Auth, Supabase Postgres, and PostGIS migration configuration are prepared. The map does not yet show reports or road-condition data.

The following features still need to be built:

- RUAS landing page with sourced data highlights and a report call to action
- Anonymous report form with location and on-device ONNX photo analysis
- Storage for text, blurred location, and model results without uploading photos
- Map/list of reports and road detail pages with IRI/PCI comparisons
- Official data ingestion with paging, provenance, and validation
- NLP processing, geospatial matching, basic moderation, consistency scoring, and a gap list

### FDS priorities — November 1, 2026

The following must be working for the First Draft Submission:

- Landing page with one sourced figure, its explanation, and a **Report** button
- Report form that displays CV results
- Map or list of reports
- Public repository and a PDF of up to 10 pages with the concept, sitemap, wireframes, key features, and screenshots of at least two pages (the landing page and one other page)

Additional features such as road detail pages, scoring, full methodology, and moderation can follow after the core flow works. Do not show regency/city figures until paging and matching are complete.

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
  app/          # Next.js routes, layouts, and API
  contracts/    # API contracts grouped by domain
  features/     # Application features; currently the map
  lib/          # Better Auth and Prisma
prisma/         # Postgres/PostGIS schema and migrations
docs/           # Project and architecture documentation
```

Government and social media scrapers will run as two scheduled workloads on a server separate from Next.js. Scraper implementations are not yet in this repository.

## Privacy and data quality principles

- Public reporters do not need accounts. Do not request names, national ID numbers, phone numbers, or social media accounts.
- Photos are processed on-device and are not sent to RUAS. Do not add a photo upload path to the server.
- Ask for consent before accessing location; blur it before submission and show public locations at an appropriately coarse level.
- Clearly label report status and uncertainty. Rejected reports remain recorded as unverified so patterns can still be studied.
- Show the source, date, coverage, and methodology alongside every figure.
- Do not infer causes or blame from data differences; explain that differences can reflect data age, methods, location, or field conditions.

## Competition deadlines

- **November 1, 2026:** First Draft Submission — public repository and FDS PDF of up to 10 pages.
- **November 11, 2026:** Qualifiers — proposal of up to 30 pages, originality letter, and pitch video of up to 5 minutes.
- **November 28, 2026:** On-site final — deck of up to 15 slides, 10-minute presentation, and 5-minute Q&A.

The team name, role assignments, availability of local photos, GPU access, and final product-name check still need to be decided by the team. See the full project brief for the rubric, sources, risks, and competition rules.
