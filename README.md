# SAKSI

**SAKSI** (*Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*) makes public road-work packages
in **Kota Tangerang** easier to explore by linking procurement records with the area named in the
package and the precision of that location.

The product uses neutral, evidence-led language. A mapped area or a citizen report is a signal for
review, not proof of wrongdoing or a guarantee of government action.

## Current implementation

- Landing page (`/`) with the audit overview, a sourced budget figure, and an interactive map.
- Map (`/project`) as a **choropleth of official boundaries**: RW polygons (1,020) at zoom ≥ 12 and
  kelurahan polygons (104) below that. No per-package pins — a package is tied to an area, never to a
  work-site coordinate.
- Filters for budget year, kecamatan, work type, and a free-text search (area, road, or RUP code).
- Package detail pages and a report flow (`/laporan`, `/laporan/paket/[rup]`) that starts from a
  package and ranks candidate packages by RW → kelurahan → landmark, without inventing a score.
- Package data is read by a server-only repository. The first render is a Next.js Server Component;
  interactive filters call `GET /api/packages`. The adapter reads the checked-in JSON snapshot.
- Better Auth and Prisma are wired for server use. They are **optional for the FDS**: when
  `DATABASE_URL` is absent the build still succeeds and the auth route answers `503`.
- Report drafts are stored on the device in IndexedDB (`saksi-local-reports`). There is no submission
  API yet, and the page says so.

## Dataset shown in the app

| | |
|---|---:|
| Packages (road, bridge, drainage) | **1,557** |
| Budget | **Rp650.18 bn** |
| Fiscal years | 2025: 939 · 2026: 618 |
| Kelurahan touched | **80 of 104** · 13 kecamatan |
| RW touched | **483 of 1,020** |
| Location anchor | RW 818 · kelurahan 337 · none 402 |

Snapshot date **31 Oct 2026**. Sources: SIRUP Inaproc (`idKldi=D44`, 21,402 RUP rows for 2025–2026)
and the Kota Tangerang ArcGIS server (`Batas_Adminsitratif/batas_rw_2021`,
`Batas_Wilayah_Kelurahan_def`). No package carries a work-site coordinate; only 7% of packages name a
road segment that can be matched to the city's road layer, so the product anchors on RW instead.

## Technology

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, React Icons
- Leaflet / React Leaflet with OpenStreetMap tiles and attribution
- Supabase Postgres + PostGIS, Prisma ORM, and Better Auth as an optional server foundation
- PWA install and offline fallback; the service worker does not cache map tiles or API responses

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the frontend/backend boundary and API contract,
[docs/DESIGN.md](docs/DESIGN.md) for interface rules, and [docs/STATE.md](docs/STATE.md) for status.

## Data sources and research baselines

The following sources were researched as baselines (October 2026). They are **not live data currently
displayed by the application**.

| Source | Contents | Notes |
|---|---|---|
| [Bina Marga GIS — IRI 1/2026](https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/IRI_1_2026/FeatureServer/0) | 477,032 measurement points, about 47,703 km of national roads | Public endpoint; use `outSR=4326` for web mapping |
| [Bina Marga GIS — PCI 2025](https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/Centerline_PCI_2025/FeatureServer/0) | 926,416 PCI segments | Public endpoint |
| [Bina Marga GIS — national road segments](https://gisportal.binamarga.pu.go.id/arcgis/rest/services/Hosted/Jalan_Nasional_PPK_Satker/FeatureServer/0) | 3,306 road segments with regency/city names | Reference data for road matching |
| [Kota Tangerang ArcGIS](https://maps.tangerangkota.go.id/arcgis/rest/services) | 522 services: boundaries, road network, bridges, drainage complaints | Public; ArcGIS limits 1,000 rows per query, page with `resultOffset` |

Every figure shown on the site must come from processed data and its source manifest, not a
hard-coded UI value. Include the retrieval date, period, coverage, and limits on interpretation.

## Remaining implementation

- Report submission API with moderation and abuse controls (drafts are local-only today)
- Prisma domain models and a repository backed by Postgres/PostGIS instead of the JSON snapshot
- Scheduled scraper workers for government and social sources, with provenance and run history
- Viewport-aware map queries and a paginated package register (`/api/packages` currently returns all
  1,557 items)
- Published methodology page and source metadata for every displayed metric
- Provenance badges (`DATA RESMI` / `SIMULASI PROTOTIPE`) — required by the project rules, not yet shown

### FDS checklist — November 1, 2026

- Public repository and a PDF of up to 10 pages: concept, sitemap, wireframes, key features, and
  screenshots of at least two live pages
- Two live screens: the audit map (with one sourced figure explained) and the report flow
- No CV readout, no damage-area measurement: the reporter classifies damage type, cause, and a coarse
  size; photos are processed in the browser and never uploaded

Do not present inferred location precision as an official contract coordinate. Keep report status and
uncertainty explicit, and do not show derived comparisons without source, period, coverage, and method.

## Running the project

### Prerequisites

- Node.js 24 LTS (`.nvmrc` pins 24). Bun 1.4.2 also works and `bun.lock` is committed.
- A Postgres database is **optional**. Without it the app runs fully on the JSON snapshot; only auth
  and future report storage are disabled.

### Local installation

```bash
npm ci            # or: bun install
npm run dev       # http://localhost:3000
```

`prisma generate` runs automatically via `predev`/`prebuild` and does not need a database.

To enable the optional server features, copy `.env.example` to `.env.local` and set
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `DIRECT_URL`, and `DATABASE_POOL_MAX`.

Get the connection URLs from **Supabase Dashboard → Connect**. Use the Session pooler on port 5432
for a persistent server; use the direct URL for migrations when the network supports IPv6. Never put
database credentials or a service-role key in browser code.

```bash
npm run db:migrate -- --name init
npm run db:deploy     # apply committed migrations
npm run db:status     # check migration status
```

### Main scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Production build (must pass without `DATABASE_URL`) |
| `npm run lint` | ESLint |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:status` | Prisma commands |

## Repository structure

```text
src/
  app/          # Pages and HTTP route handlers
  contracts/    # Shared request and response DTOs
  features/     # Browser UI and feature interactions
  server/       # Use cases, repository interfaces, server-only adapters
  lib/          # Better Auth and Prisma clients
data/           # Versioned source snapshots
public/data/    # Boundary GeoJSON served to the map
prisma/         # Postgres schema and migrations
docs/           # Product, design, handoff, and architecture documentation
```

## Privacy and data quality principles

- Public reporters do not need accounts. Do not request names, national ID numbers, or phone numbers.
- Report submission is not implemented. Keep the design explicit; do not add a server photo upload
  path if photos are promised to stay on-device.
- Ask for consent before accessing location; blur it before submission and show public locations at a
  coarse level.
- Clearly label report status and uncertainty. Rejected reports remain recorded as unverified so
  patterns can still be studied.
- Show source, date, coverage, and method alongside every figure.
- Do not infer causes or blame from data differences; differences can reflect data age, method,
  location, or field conditions.

## Competition deadlines

- **November 1, 2026:** First Draft Submission — public repository and FDS PDF of up to 10 pages.
- **November 11, 2026:** Qualifiers — proposal of up to 30 pages, originality letter, pitch video.
- **November 28, 2026:** On-site final — deck of up to 15 slides, 10-minute presentation, Q&A.
