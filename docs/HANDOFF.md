# SAKSI — Developer Handoff

**Updated:** 5 November 2026

**Repository:** `repyh/saksi`

**Branch:** `feat/map-improvement` (active)
**`master`:** `8842dc9` (state before the map-work branch)

This is the operational handoff for continuing work in this repository. The short root-level [`HANDOFF.md`](../HANDOFF.md) points here. For design decisions and constraints, read [`DESIGN.md`](DESIGN.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) before changing the interface or data flow. Product facts and current numbers live in [`STATE.md`](STATE.md).

## Product and data scope

SAKSI makes public road-work package records easier to inspect by connecting them to a map at the location precision supported by their source data. The active snapshot is **Kota Tangerang, 2025–2026** (`idKldi=D44`, BPS `3671`), stored in `data/saksi_kota_tangerang_2025_2026.json`: **1.634 road/junction/drainage packages, Rp683,34 billion**. Do not carry forward old Kabupaten Tangerang totals (D50) or assume that a package has an official coordinate.

Location anchor, after enriching from RUP details: **821 RW (50.2%)**, **375 kelurahan (22.9%)**, **90 kecamatan (5.5%)**, **312 without any locus (21.3%)** — so 1.286 packages (78.7%) carry a derived location. Coverage touches 85 of 104 kelurahan, 490 of 1,020 RW, in 13 kecamatan.

Vendor records: **1.426 of 1.634 packages (87.3%)** name a supplier — **731 from LPSE/SPSE** (`spse.inaproc.id/tangerangkota`) and **693 from Data INAPROC realisation** (`data.inaproc.id`, official CSV export for all D44 work units). 133 packages (Rp97.6 billion, 19.1% of pagu) have no public record; 522 unique suppliers; median contract/pagu ratio 0.99.

Use neutral, evidence-led wording. A map match or citizen report is a signal for review, not proof of wrongdoing or a promise that an agency will act.

## Current routes and behavior

| Route | Purpose | Current behavior |
|---|---|---|
| `/` | Home and audit overview | Landing page, source/context sections, and the interactive road-package map. Hero search passes its query to the map search. |
| `/project` | Peta Pekerjaan | Full-viewport map and package list with **year → kecamatan → kelurahan (checkbox)**, work-type, contract-record, and map-view filters; "Hanya paket berlokasi" is **on by default** (1.286 of 1.634). Selecting a package opens the right detail panel with the LPSE winner/contract block. |
| `/project/kota-tangerang/...` | Address/package selection | Address hierarchy is reflected in the URL; query parameters preserve year, work type, contract filter, map view, and search. |
| `/laporan/` | Laporkan Jalan | Four-step report flow: photo, damage, location/package, and submission receipt. Requires a deployed report migration and private Supabase bucket to submit. |
| `/laporan/paket/[rup]` | Report with a package reference | Opens the report flow with the matching package preselected as a reference. |
| `/penyedia`, `/penyedia/[slug]` | Supplier register | Suppliers with at least one road package, joined to RUP; every figure carries its denominator, never a composite score. |
| `/api/packages` | Package search API | Validates filter/search parameters and returns an `ApiResult` response. |

There is intentionally no reset-filter button on Peta Pekerjaan. Filters can be returned to their defaults through their existing selections; search text can be cleared in the input.

## Data flow and code ownership

```text
Next.js server page ─┐
                     ├─> package service ─> repository interface ─> checked-in snapshot + LPSE/realisasi snapshots
Browser filters ─> GET /api/packages ─────┘
```

- `src/app/**` owns routes, server-rendered page entry points, and HTTP route handlers.
- `src/features/map/**` owns map UI, filter/search state, URL selection state, and rendering. Leaflet stays client-side.
- `src/features/reports/**` owns report form state and browser-side photo preview sanitation.
- `src/server/api/packages/**` validates HTTP query input (`query-schema.ts`); it holds no SQL or scraping logic.
- `src/server/packages/**` owns package search, the snapshot repository, and the LPSE contract index (`lpse-repository.ts`).
- `src/contracts/**` owns DTOs shared between client and server.
- `prisma/**` and `src/lib/**` hold database/auth foundations. Package search still reads the snapshot, not Supabase.

Keep the dependency direction: UI → API/contract → server use case → repository → data source. Never import server code, Prisma, database URLs, or Supabase service credentials into browser components.

## Important implementation details

- `src/features/map/report-routes.ts` defines address slugs, package paths, filter query parameters, and parsing. Update parsing and generation together when changing route shape.
- `/project` filter query parameters are `tahun`, `kecamatan`/district, `desa` (repeatable kelurahan), `jenis`, `kontrak`, `lokasi`, `tampilan`, and `q`. The API uses `year`, `district`, `desa`, `work`, `kontrak`, `lokasi`, and `q`; the dashboard translates between them.
- Kelurahan selection is **tri-state**: `null` = all kelurahan of the chosen kecamatan, an array = explicit subset, and an **empty array is invalid** — the picker stays open with a red warning, the list shows the empty message, and no request is sent. Never treat "none selected" as "all".
- `src/features/map/map-dashboard.tsx` keeps filters and selection state. Filter changes request `GET /api/packages`; the list is capped at 120 visible entries while matching packages are passed to the map.
- `src/features/map/map-canvas.tsx` owns Leaflet rendering, geographic layers, region selection, and legends. Polygon level is chosen by a **segmented control on the map (Kecamatan / Kelurahan / RW)** — it does **not** follow zoom, and switching level does not change the current zoom either.
- Multi-paket relations are surfaced, not hidden: `kontrak.jumlahPaket > 1` renders "· N paket" in the
  list row and a **Paket realisasi** row in the detail panel explaining that the top name is the largest
  recipient and the evidence link opens that package. M–N (one paket → several RUP) does not occur in the
  1,634-package scope.
- Kecamatan choropleth counts aggregate every package inside the kecamatan, including RW- and kelurahan-precision packages, and use quantile class breaks so 13 polygons do not collapse into one colour. Kelurahan/RW layers use the fixed classes 0 / 1 / 2–3 / 4–6 / 7–10 / 11+.
- Basemap comes from one environment variable, `NEXT_PUBLIC_BASEMAP_URL` (default `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`). Attribution switches automatically for OpenStreetMap, CARTO, and Esri hosts, so changing the tile source does not silently break attribution.
- `src/features/reports/components/report-prototype.tsx` holds an unsent report in component state. The final action calls `POST /api/reports`; only a successful API receipt opens the submitted state.
- `src/app/api/reports/route.ts` enforces the CORS origin allowlist and delegates to `ReportsApi` (bounded multipart, validation, idempotency key, rate limit, sanitised WebP to private Storage, single-transaction metadata).
- `GET /api/reports/mine` is session-authenticated and returns only the current account's report summaries.
- The report's candidate package list is matched against the selected RW/village using loaded geographic data and package fields. Do not describe it as an authoritative contract-to-road match.

## Current stack and local commands

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- Leaflet 1.9.4 / React Leaflet 5, tile source via `NEXT_PUBLIC_BASEMAP_URL`
- Supabase Postgres + PostGIS and Prisma foundations; Better Auth (optional — build works without `DATABASE_URL`)
- Node 24 per the package engine range (`>=24 <25`); the current dev machine runs v26.8.1
- `package-lock.json` is **not tracked** in git yet

```bash
npm install
npm run dev
npm run lint
npm run build
npm run data:kecamatan   # regenerate public/data/kec.geojson from ArcGIS
```

Database commands exist (`db:generate`, `db:migrate`, `db:deploy`, `db:status`). Auth, invite, and report migrations were deployed on 4 November 2026. Road-package and administrative-area catalogs remain unpopulated, so package search still uses the checked-in snapshot. Do not run migrations against production as part of ordinary UI work.

## Known gaps and next implementation decisions

1. **Report persistence:** models, migration, `POST /api/reports`, idempotency, CORS, private `report-evidence` bucket, and authenticated history are implemented. End-to-end UI submission still needs confirmation; moderation, retention cleanup, and public queries are unimplemented (`docs/REPORTS.md`).
2. **Spatial/package domain model:** review and deploy the model, import source-provenanced package and area catalogs, then replace the snapshot adapter with repository queries. Keep package DTOs stable.
3. **Scrapers:** government and official/public social collectors need separate adapters, schedules, provenance, validation, idempotent ingestion, run history, retries, and restricted credentials. Social posts are not official records.
4. **Map scale:** the API and map currently pass all filtered rows; the list shows the first 120. Introduce paginated list and viewport-bounded map queries when scale requires it.
5. **Header metrics and provenance badges:** some counters are still constants and the `DATA RESMI (…)` / `SIMULASI PROTOTIPE` badges are not yet applied everywhere.
6. **Documentation:** STATE, HANDOFF, README, CONCEPT, PRODUCT, SPEC, and DESIGN were reconciled on 5 November 2026.

## Working rules

- Follow [`DESIGN.md`](DESIGN.md): preserve the established palette, typography, spacing, and restrained divider use. Avoid generic dashboard patterns and unnecessary copy.
- Keep user-facing interface text in Indonesian; repository documentation uses Indonesian or English by document.
- Format numbers for Indonesian readers (`1.634`, `87,3%`, `Rp683,34 Miliar`). Attach source, date, coverage, and methodology to public claims.
- Keep the 2025/2026 road-only product scope; do not surface unrelated sectors.
- Never present an inferred map location as an official package coordinate, and never place per-package pins.
- Use concise conventional commits, such as `feat: …`, `fix: …`, and `docs: …`.
