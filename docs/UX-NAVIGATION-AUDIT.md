# SAKSI frontend navigation audit

**Date:** 10 November 2026
**Lens:** Chi, Pirolli, and Pitkow, “The Scent of a Site” (CHI 2000); see [UX-NAVIGATION-RESEARCH.md](./UX-NAVIGATION-RESEARCH.md).

## Method and limits

For each main task, reviewers checked what users are trying to do, what pre-click labels and visual cues promise, whether the destination matches that expectation, and whether route changes preserve useful context. The paper is a modeling paper, not a prescriptive checklist or a usability study of SAKSI. These findings come from source inspection and a read-only desktop homepage inspection. Predicted confusion, mobile impact, and other behavioral effects remain hypotheses until checked with users and target viewport sizes.

Severity describes likely task impact if the issue is confirmed: **P1** can obstruct an important route/task; **P2** adds ambiguity, friction, or lost context.

## Findings

### P1 — The global navigation has no narrow-screen adaptation

`Navbar` renders the brand and all navigation actions in one row; `NavActions` is a single non-wrapping flex row with six destinations plus the account action. There is no compact menu or explicit overflow treatment. At phone widths, controls may become cramped or extend beyond the viewport, making the primary map route harder to reach. The rendered mobile impact has not been verified.

Evidence: `src/components/navigation/navbar.tsx:21-29`; `src/components/navigation/nav-actions.tsx:15-52,57-72`.

### P1, conditional — The previously requested `/project` destination is absent

The current app has `/paket` and `/penyedia`, but no `src/app/project` route. The navbar sends “Paket Jalan” to `/paket`. This conflicts with the earlier request for a `/project` page unless `/paket` was intentionally adopted as its replacement. As currently implemented, `/project` has no matching page.

Evidence: route inventory; `src/components/navigation/nav-actions.tsx:29-32`; `src/app/sitemap.ts:17-35`.

### P2 — Public reports are discoverable from inside the submission flow

The main navigation offers “Laporkan Jalan” to `/laporan`; the “Lihat laporan publik” link is inside that page’s header. A visitor who wants to read published reports must enter the reporting page first. This is an indirect route for a distinct task.

Evidence: `src/features/reports/components/report-prototype.tsx:331-337`; global actions in `src/components/navigation/nav-actions.tsx:44-51`.

### P2 — The homepage journey reads like a clickable path, but its steps are static

“Jalan rusak punya jejak anggaran” describes three sequential actions—find a road, inspect a package, start a report—but renders plain list items without navigation. The page has separate map calls to action, so this does not block the map; the step sequence itself may imply that each step can be followed.

Evidence: `src/features/audit/components/package-journey-section.tsx:1-14,27-43`.

### P2 — Package selection says “Lihat” but opens an in-map summary

In the map’s package list, “Lihat” calls `selectPackage(pkg)`, which opens the selection panel; a separate action in that panel opens the package detail page. The label and accessible name “Lihat paket…” can imply the detail page rather than a selection/summary.

Evidence: `src/features/map/map-dashboard.tsx:666-668,901-905`.

### P2 — Provider detail sends users to the general map without preserving provider context

“Lihat di peta audit” links to `/peta-pekerjaan?region=…` without a provider filter. After reviewing one provider’s package list, the destination is the general map. Either preserve a supported filter or make the general-map destination explicit in the label.

Evidence: `src/app/penyedia/[slug]/page.tsx:134-137`.

### P2 — Directory row styling suggests the full row is clickable

Package and provider table rows change background on hover, but only the name cell contains a link. The row-level hover can suggest a larger click target than the actual one.

Evidence: `src/app/paket/page.tsx:196,199`; `src/app/penyedia/page.tsx:160,162`.

### P2 — Returning from package detail loses directory filters

The package directory supports search, year, type, sorting, and pagination. The package detail return link preserves only `region`, so users returning from a filtered result land in the unfiltered directory unless they use browser Back.

Evidence: `src/app/paket/[rup]/page.tsx:67-72`; directory query state in `src/app/paket/page.tsx`.

### P2 — No skip-to-main navigation was found

The shared sticky navbar precedes page content, but the layout has no skip link and pages do not expose a shared main-content target. Keyboard users may have to pass the repeated global navigation on each page. Verify with a keyboard pass after implementation.

Evidence: `src/app/layout.tsx:27-40`; source search found no skip link or shared main target.

### P2 — Report-wizard step changes may not be announced

The active report step is marked with `aria-current="step"`, but the step content changes in place and the new heading is neither focused nor live. Screen-reader users may not be told that the form moved to a new step. This needs validation with assistive technology.

Evidence: `src/features/reports/components/report-prototype.tsx:342-359,370-392`.

### P2, conditional — Dashboard section selection is not represented in the URL

Dashboard tabs are local state and the default is “Telusuri.” A moderator must choose “Review Laporan” after landing, and refreshing or sharing the URL cannot preserve that section. A reviewer-specific entry point or URL-backed tab could reduce that extra navigation step.

Evidence: `src/features/dashboard/components/dashboard-tabs.tsx:177,276-297,486-487`.

### Conditional — Home search drops the selected region

The home search pushes `/peta-pekerjaan?q=…` without carrying a `region` query parameter. This can lose context if multiple regions are enabled; project docs currently describe one active region, so this is not a current blocker.

Evidence: `src/features/audit/components/package-search-form.tsx:16-22`; `src/app/page.tsx:12-20`.

### Conditional — Directory tables need horizontal scrolling on narrow screens

Package and provider tables have minimum widths of 760px and 720px inside horizontal-scroll containers. The container allows access to the remaining columns, but there is no visible cue in the inspected code that the table continues offscreen. Validate on a phone before prioritizing.

Evidence: `src/app/paket/page.tsx:183`; `src/app/penyedia/page.tsx:147`.

## Navigation patterns that already work

- “Peta Pekerjaan” points directly to `/peta-pekerjaan`; active primary navigation exposes `aria-current="page"` (`src/components/navigation/nav-actions.tsx:33-37,78-85`).
- The home search has a clear label and submit action, applies `q` on the map route, and the budget explorer offers contextual map links (`src/features/audit/components/package-search-form.tsx:16-22`; `src/features/audit/components/budget-explorer.tsx:50,61`).
- Chart drilldown changes the heading, moves keyboard focus to it, and provides a breadcrumb back to earlier groups (`src/features/audit/components/budget-explorer.tsx:29-35,54-61`).
- Map selection exposes an administrative-area breadcrumb, and the map serializes filters and selections to the route (`src/features/map/map-dashboard.tsx:447,755-798`).
- Package and provider detail pages link back to their directories and connect related package details (`src/app/paket/[rup]/page.tsx:67-104`; `src/app/penyedia/[slug]/page.tsx:45-47,102-104`).

## Suggested order for follow-up

1. Verify the global header at 320px, 375px, and tablet widths; provide an accessible compact navigation pattern if it clips or compresses.
2. Resolve whether `/project` remains a required destination or whether `/paket` is the accepted route and label.
3. Improve the map-selection label and expose public reports from a broader discovery point.
4. Add keyboard skip navigation and announce/focus report-step changes.
5. Preserve context on return/map transitions and make row click targets match their hover affordance.
6. Validate remaining conditional findings with task-based sessions before changing the information architecture.

## Scope note

This audit does not make claims about actual user success rates. A short task-based usability pass should confirm the highest-priority hypotheses, especially map discovery on mobile, the “Lihat” action, public-report discovery, and report-step announcements.
