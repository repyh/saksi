# SAKSI — Developer Handoff

**Updated:** 1 November 2026

**Repository:** `repyh/saksi`

**Branch:** `master`
**Baseline commit:** `0acb378` (`Add map search and reporting flow`)

This is the operational handoff for continuing work in this repository. The short root-level [`HANDOFF.md`](../HANDOFF.md) points here. For design decisions and constraints, read [`DESIGN.md`](DESIGN.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) before changing the interface or data flow.

## Product and data scope

SAKSI makes public road-work package records easier to inspect by connecting them to a map at the location precision supported by their source data. The current active snapshot is **Kota Tangerang, 2025–2026**, stored in `data/saksi_kota_tangerang_2025_2026.json`. Do not carry forward old Kabupaten Tangerang totals or assume that a package has an official coordinate. The map geometry is inferred from package text and the available geographic reference data; show its precision honestly.

Use neutral, evidence-led wording. A map match or citizen report is a signal for review, not proof of wrongdoing or a promise that an agency will act. Keep packages without a sufficiently specific location in the package list; do not invent map points for them.

## Current routes and behavior

| Route | Purpose | Current behavior |
|---|---|---|
| `/` | Home and audit overview | Landing page, source/context sections, and the interactive road-package map. Hero search passes its query to the map search. |
| `/project` | Peta Pekerjaan | Full-viewport map and package list with year, district, work-type, and map-view filters; compact search sits beside the filtered/total package count. Selecting a package opens the right detail panel. |
| `/project/kota-tangerang/...` | Address/package selection | Address hierarchy is reflected in the URL; query parameters preserve year, work type, map view, and search. Package routes include the RUP and a readable name slug. |
| `/laporan/` | Laporkan Jalan | Four-step **mockup**: photo, damage, location/package, success. It does not submit or persist a report. The success state says “masih mockup & belum disubmit”. |
| `/laporan/paket/[rup]` | Report with a package reference | Opens the report mockup with the matching package preselected as a reference. |
| `/api/packages` | Package search API | Validates filter/search parameters and returns an `ApiResult` response. |

There is intentionally no reset-filter button on Peta Pekerjaan. Filters can be returned to their defaults through their existing selections; search text can be cleared in the input.

## Data flow and code ownership

```text
Next.js server page ─┐
                     ├─> package service ─> repository interface ─> checked-in snapshot
Browser filters ─> GET /api/packages ─────┘
```

- `src/app/**` owns routes, server-rendered page entry points, and HTTP route handlers.
- `src/features/map/**` owns map UI, filter/search state, URL selection state, and rendering. Leaflet stays client-side.
- `src/features/reports/**` owns the local, non-submitting report mockup.
- `src/app/api/packages/route.ts` validates HTTP query input; it should not contain SQL or scraping logic.
- `src/server/packages/**` owns package search and the repository implementation. The current `snapshot-repository.ts` is server-only and reads the checked-in Kota Tangerang JSON.
- `src/contracts/**` owns DTOs shared between client and server.
- `prisma/**` and `src/lib/**` hold database/auth foundations. The current snapshot package search does not query Supabase.
- Scraper workers are planned as separately deployed scheduled processes; they are not implemented yet.

Keep the dependency direction: UI → API/contract → server use case → repository → data source. Never import server code, Prisma, database URLs, or Supabase service credentials into browser components.

## Important implementation details

- `src/features/map/report-routes.ts` defines address slugs, package paths, filter query parameters, and parsing. Update parsing and generation together when changing route shape.
- `/project` filter query parameters are `tahun`, `jenis`, `tampilan`, and `q`. The API uses `year`, `district`, `work`, and `q`; the dashboard translates between them.
- `src/features/map/map-dashboard.tsx` keeps filters and selection state. Filter changes request `GET /api/packages`; the list is capped at 120 visible entries while matching package features are passed to the map.
- `src/features/map/map-canvas.tsx` owns Leaflet rendering, geographic layers, region selection, and map legends. Selecting a region updates the district filter; clicking a non-region clears that selection. A package with broad location precision should show an explanatory note instead of a fabricated specific-region highlight.
- `src/features/reports/components/report-prototype.tsx` holds report data in component state only. Photo preview uses a local object URL and is not uploaded or persisted. The success step is a confirmation of the mock flow, not a submission receipt.
- The report’s candidate package list is currently matched against the selected RW/village using the loaded geographic data and package fields. Do not describe it as an authoritative contract-to-road match.

## Current stack and local commands

- Next.js 16.4.3, React 19, TypeScript, Tailwind CSS v4, Bun 1.4.2
- Leaflet / React Leaflet with OpenStreetMap tiles and attribution
- Supabase Postgres + PostGIS and Prisma foundations; Better Auth
- Node.js 24 is required by the package engine range (`>=24 <25`).

```powershell
bun install
bun run dev
bun run lint
bun run build
```

Database commands are available (`bun run db:generate`, `bun run db:migrate`, `bun run db:deploy`, `bun run db:status`), but package/report domain tables are not currently implemented. Do not run migrations against production as part of ordinary UI work.

## Known gaps and next implementation decisions

1. **Report persistence:** The report route is still a UI mockup. Before submission is implemented, decide privacy processing, consent, abuse controls, moderation/status states, retention, and what data is public. Do not imply that a report has been sent.
2. **Spatial/package domain model:** Define source provenance, location precision, and PostGIS geometry semantics before replacing the snapshot adapter with Prisma queries. Keep package DTOs stable where possible.
3. **Scrapers:** Government website and official/public social-source collectors need separate adapters and schedules, provenance, validation, idempotent ingestion, run history, retries, and restricted credentials. Determine an allowed X access method before building that collector. Social posts are not official records.
4. **Map scale:** The current API and map pass all filtered package rows; the list only displays the first 120. Introduce separate paginated list and viewport-bounded map-feature queries when scale requires it.
5. **Documentation consistency:** `docs/STATE.md`, `README.md`, and some sections in `docs/SPEC.md` still contain older Kabupaten Tangerang, FDS, route, and implementation-status language. Treat the code and this handoff as the latest implementation status; reconcile those documents when their respective scope is next edited.

## Working rules

- Follow [`DESIGN.md`](DESIGN.md): preserve the established palette, typography, spacing, and restrained divider use. Avoid generic dashboard patterns and unnecessary copy.
- Keep user-facing interface text in Indonesian; repository documentation currently uses Indonesian or English by document.
- Format numbers for Indonesian readers (`1.557`, `92,5%`, `Rp…`). Attach source, date, coverage, and methodology to public claims.
- Keep the 2025/2026 road-only product scope; do not surface unrelated sectors.
- Never present an inferred map location as an official package coordinate.
- Use concise conventional commits, such as `feat: …`, `fix: …`, and `docs: …`.
