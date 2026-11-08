# SAKSI — Developer Handoff

**Updated:** 8 November 2026

**Repository:** `repyh/saksi`

**Branch:** `master` (P0 review fixes merged 8 November 2026)
**P0 branches merged:** `fix/audit-metrics-snapshot`, `docs/snapshot-status-alignment`, `feat/report-prototype-badge`, `test/report-e2e-supabase`

This is the operational handoff for continuing work in this repository. The short root-level [`HANDOFF.md`](../HANDOFF.md) points here. For design decisions and constraints, read [`DESIGN.md`](DESIGN.md) and [`ARCHITECTURE.md`](ARCHITECTURE.md) before changing the interface or data flow. Product facts and current numbers live in [`STATE.md`](STATE.md).

## Product and data scope

SAKSI makes public road-work package records easier to inspect by connecting them to a map at the location precision supported by their source data. The active snapshot is **Kota Tangerang, 2025–2026** (`idKldi=D44`, BPS `3671`), stored in `data/saksi_kota_tangerang_2025_2026.json`: **1.634 road/junction/drainage packages, Rp683,34 billion**, snapshot **5 November 2026** from the `data.inaproc.id/rup` export. Do not carry forward old Kabupaten Tangerang totals (D50) or assume that a package has an official coordinate.

Location anchor, after enriching from RUP details: **821 RW (50.2%)**, **375 kelurahan (22.9%)**, **90 kecamatan (5.5%)**, **348 without any locus (21.3%)** — so 1.286 packages (78.7%) carry a derived location. Coverage touches 85 of 104 kelurahan, 490 of 1,020 RW, in 13 kecamatan.

Vendor records: **1.426 of 1.634 packages (87.3%)** name a supplier — **731 from LPSE/SPSE** (`spse.inaproc.id/tangerangkota`) and **695 from Data INAPROC realisation** (`data.inaproc.id`, official CSV export of 50,836 rows for all D44 work units). 208 packages (Rp130.67 billion, 19.1% of pagu) have no public record; 522 unique suppliers; median contract/pagu ratio 0.99.

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
| `POST /api/reports` | Report submission | Bounded multipart with an `Idempotency-Key`; validates the RW area and optional RUP, stores sanitised WebP in the private bucket, and returns an opaque receipt code. |
| `GET /api/reports/mine` | Account report history | Session-authenticated; returns only the current account's receipt, status, damage type, coarse area, and optional package reference. |
| `GET /api/reports/review` | Staff review queue | Requires `reports.read_queue`; paginated, read-only summaries without reporter identity, private text, or media. |

There is intentionally no reset-filter button on Peta Pekerjaan. Filters can be returned to their defaults through their existing selections; search text can be cleared in the input.

## Data flow and code ownership

```text
Next.js server page ─┐
                     ├─> package service ─> repository interface ─> checked-in snapshot + LPSE/realisasi snapshots
Browser filters ─> GET /api/packages ─────┘
```

- `src/app/**` owns routes, server-rendered page entry points, and HTTP route handlers.
- `src/features/map/**` owns map UI, filter/search state, URL selection state, and rendering. MapLibre stays client-side.
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
- `src/features/map/map-canvas.tsx` owns MapLibre rendering, geographic layers, region selection, and legends. Polygon level is chosen by a **segmented control on the map (Kecamatan / Kelurahan / RW)** — it does **not** follow zoom, and switching level does not change the current zoom either.
- Multi-paket relations are surfaced, not hidden: `kontrak.jumlahPaket > 1` renders "· N paket" in the
  list row and a **Paket realisasi** row in the detail panel explaining that the top name is the largest
  recipient and the evidence link opens that package. M–N (one paket → several RUP) does not occur in the
  1,634-package scope.
- Kecamatan choropleth counts aggregate every package inside the kecamatan, including RW- and kelurahan-precision packages, and use quantile class breaks so 13 polygons do not collapse into one colour. Kelurahan/RW layers use the fixed classes 0 / 1 / 2–3 / 4–6 / 7–10 / 11+.
- Basemap comes from one environment variable, `NEXT_PUBLIC_BASEMAP_URL`. It now holds a **vector style JSON URL** (default `https://tiles.openfreemap.org/styles/positron`), not a raster tile template. Attribution is OpenStreetMap + OpenFreeMap for the default style, and switches for CARTO and Esri hosts so changing the style does not silently break attribution.
- MapLibre's worker URL cannot be derived from the package's `import.meta.url` under Turbopack. `predev`/`prebuild` run `scripts/copy-maplibre-worker.mjs` to copy `maplibre-gl-worker.mjs` into `public/vendor/`, and `map-canvas.tsx` calls `setWorkerUrl("/vendor/maplibre-gl-worker.mjs")`. Keep both when upgrading MapLibre.
- `src/features/reports/components/report-prototype.tsx` holds an unsent report in component state. The final action calls `POST /api/reports`; only a successful API receipt opens the submitted state.
- `src/app/api/reports/route.ts` enforces the CORS origin allowlist and delegates to `ReportsApi` (bounded multipart, validation, idempotency key, rate limit, sanitised WebP to private Storage, single-transaction metadata).
- `GET /api/reports/mine` is session-authenticated and returns only the current account's report summaries.
- The report's candidate package list is matched against the selected RW/village using loaded geographic data and package fields. Do not describe it as an authoritative contract-to-road match.

## Current stack and local commands

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4
- MapLibre GL JS 6.16, vector style via `NEXT_PUBLIC_BASEMAP_URL` (default OpenFreeMap Positron)
- Supabase Postgres + PostGIS and Prisma foundations; Better Auth (optional — build works without `DATABASE_URL`)
- Node 24 per the package engine range (`>=24 <25`); the current dev machine runs v26.8.1
- `bun.lock` and `package-lock.json` are both tracked and must stay in sync (`bun install` / `npm install --package-lock-only`)

```bash
npm install
npm run dev
npm run lint
npm run build
npm run data:kecamatan   # regenerate public/data/kec.geojson from ArcGIS
```

Database commands exist (`db:generate`, `db:migrate`, `db:deploy`, `db:status`). Auth, invite, and report migrations were deployed on 4 November 2026. Road-package and administrative-area catalogs remain unpopulated, so package search still uses the checked-in snapshot. Do not run migrations against production as part of ordinary UI work.

## Known gaps and next implementation decisions

1. **Report persistence:** models, migration, `POST /api/reports`, idempotency, CORS, private `report-evidence` bucket, authenticated history, and the read-only review queue are implemented. The submit route was verified end to end on 8 November 2026 (receipt, account history, review queue, Postgres rows, private WebP, cleanup). Moderation, retention cleanup, and public queries are unimplemented (`docs/REPORTS.md`).
2. **Spatial/package domain model:** review and deploy the model, import source-provenanced package and area catalogs, then replace the snapshot adapter with repository queries. Keep package DTOs stable.
3. **Scrapers:** government and official/public social collectors need separate adapters, schedules, provenance, validation, idempotent ingestion, run history, retries, and restricted credentials. Social posts are not official records.
4. **Map scale:** the API and map currently pass all filtered rows; the list shows the first 120. Introduce paginated list and viewport-bounded map queries when scale requires it.
5. **Header metrics and provenance badges:** landing/audit counters now come from `src/server/packages/audit-metrics.ts` (snapshot + boundary GeoJSON). `SIMULASI PROTOTIPE` marks `/laporan`; `DATA RESMI (LPSE/INAPROC)` labels exist in the contract panel. SIRUP/Bina Marga badges are still missing.
6. **Documentation:** STATE, HANDOFF, README, CONCEPT, PRODUCT, SPEC, and DESIGN were reconciled on 8 November 2026.

## MapLibre migration verification (7 November 2026)

Runtime checks ran in Chromium (Playwright, 1440×900) against `npm run dev`; `npm run lint` and
`env -u DATABASE_URL npm run build` also passed. A temporary dev-only `window.__saksiMap` hook was
used to read camera/layer state, then removed; a final UI-only pass (15/15 checks) confirmed the same
behaviour without it.

| Butir | Langkah | Hasil |
|---|---|---|
| Koroplet tiga tingkat | Klik **Kecamatan / Kelurahan / RW** di segmented control | `aria-pressed` berpindah; hanya layer tingkat aktif `visible`; zoom tidak berubah |
| Tooltip wilayah | Arahkan kursor ke poligon | Popup memuat nama wilayah, jumlah paket/pagu, dan “Batas wilayah, bukan titik pekerjaan” |
| Klik wilayah | Klik poligon kecamatan | URL berubah ke rute wilayah/paket, panel detail terbuka |
| Klik area kosong | Klik di luar poligon | URL kembali `/project`, panel detail tertutup |
| Ikon jenis pekerjaan | Tampilan → **Jenis pekerjaan** | 13 ikon agregat di kecamatan, 490 di RW; tidak ada marker per paket |
| fitBounds awal | Muat `/project` | Batas peta memuat seluruh `kel.geojson` dengan padding 18 px |
| flyTo paket/region | Pilih paket kelurahan dan region | Kamera bergerak; zoom akhir ≤ 11,5 (kelurahan) / ≤ 15 (RW) |
| Legenda & overlay | Periksa tiga mode tampilan | Teks legenda dan peringatan sesuai mode; legenda wilayah terpilih muncul |
| Atribusi | Periksa kontrol atribusi | `© OpenStreetMap © OpenFreeMap` tampil |
| Tanpa marker per paket / pemilih basemap | Mode jumlah paket; cari kontrol basemap | 0 marker; tidak ada kontrol pemilih basemap |
| Mount/unmount berulang | Bolak-balik `/` ↔ `/project` tiga kali | Selalu 1 canvas dan 1 instance peta; tanpa error halaman |
| Basemap vector | Periksa request dan style | Request `styles/positron`; source `openmaptiles` bertipe `vector`; override `NEXT_PUBLIC_BASEMAP_URL` ke `styles/liberty` juga dihormati |

## Report submission verification (8 November 2026)

One test administrator submitted a report through the same `POST /api/reports` route the UI calls.
The run used a complete `.env.local` from `~/dev/saksi-web-auth` (Supabase project `hnhidatzcqyewsnouqvu`),
because the `~/dev/saksi-web` copy pairs `SUPABASE_SERVICE_ROLE_KEY` with a **publishable** key
(`sb_publishable…`) and cannot write to Storage.

| Check | Result |
|---|---|
| Submit | `201`, receipt returned, `SUBMITTED` |
| Same idempotency key | Same receipt; no duplicate report |
| `GET /api/reports/mine` | Receipt present with `POTHOLE`, `Sukarasa, RW 5`, `Tangerang` |
| `GET /api/reports/review?status=active` | Same report present in the staff queue |
| Postgres | One report, one media row (`image/webp`), one status event, one completed idempotency row |
| Private bucket | Object `reports/<reportId>/<uuid>.webp` downloaded; WebP, 96×72, no EXIF |
| Cleanup | Storage object, report, media, status event, idempotency row, test user, sessions, grants deleted; baseline 2 reports/2 users restored |

The append-only status-event trigger had to be disabled and re-enabled inside the cleanup transaction;
it is enabled (`tgenabled = O`). No snapshot, GeoJSON, or schema migration was changed by this check.

## Working rules

- Follow [`DESIGN.md`](DESIGN.md): preserve the established palette, typography, spacing, and restrained divider use. Avoid generic dashboard patterns and unnecessary copy.
- Keep user-facing interface text in Indonesian; repository documentation uses Indonesian or English by document.
- Format numbers for Indonesian readers (`1.634`, `87,3%`, `Rp683,34 Miliar`). Attach source, date, coverage, and methodology to public claims.
- Keep the 2025/2026 road-only product scope; do not surface unrelated sectors.
- Never present an inferred map location as an official package coordinate, and never place per-package pins.
- Use concise conventional commits, such as `feat: …`, `fix: …`, and `docs: …`.
