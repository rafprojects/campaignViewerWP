# Phase 51 - Shared Package Extraction, Decoupling & Abstraction Audit

**Status:** Planning
**Created:** 2026-06-12
**Last updated:** 2026-06-12

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P51-A | Abstraction Spike — Opus/Fable audit of the full codebase for package candidates, WordPress-coupling points, and decoupling paths | To do | Medium |
| P51-B | `packages/shared-utils/` — extract pure utility and primitive hook modules | To do | Medium |
| P51-C | `packages/shared-ui/` — extract decoupled Auth, Lightbox, and generic UI components | To do | Medium-High |
| P51-D | WordPress coupling audit & decoupling — replace or wrap all hardcoded WP assumptions in library code | To do | Medium |

---

## Rationale

P50-G scoped the shared-package extraction to five `src/lib/` modules and the Auth/Lightbox components that were already confirmed clean by P46-D/E. That scope was deliberately conservative — the extraction was sequenced last in P50, and the audit needed to start somewhere. With P50 closed, the question is: **what else in this codebase could be extracted?**

There is almost certainly more than the P50-G list suggests. The project now has:

- 60+ utility functions in `src/utils/` — most are pure or nearly pure; only a handful import WPSG-specific types
- 60+ hooks in `src/hooks/` — some are tightly WordPress- or WPSG-specific; others (breakpoint, carousel, idle timeout, online status, tab visibility, viewport height, swipe, media dimensions) appear to be generic browser/React primitives buried in an application tree
- A layered HTTP transport (`HttpTransport` interface + `HttpTransportImpl`) and auth provider abstraction (`AuthProvider` / `WpJwtProvider`) that already follow an interface/implementation split suggesting they were designed to be replaceable
- A theme engine (`src/themes/`) with color generation, CSS variable emission, and validation that operates on plain JSON — no WP runtime dependency is immediately obvious
- Components where WordPress-specific behaviour (nonce heartbeats, `window.__WPSG_CONFIG__` reads, `wp_localize_script`-injected config) is co-located with generic UI logic that would work in any React context

Before committing to a package topology (how many packages, what goes where, what the public API surface looks like), a thorough human+model audit of the full source tree is warranted. P51-A is that audit.

---

## Track P51-A — Abstraction Spike (Opus/Fable Codebase Audit)

### Problem

The P50-G plan named a conservative set of extraction candidates based on prior Phase 46 analysis. The codebase has grown significantly since then (P47–P50 added gallery spaces, adapters, the Layout Builder, the asset library, and the service worker). Several new modules may be ready for extraction; others that looked coupled in P46 may have since been cleaned up. More importantly, the P50-G plan says nothing about:

- Utils in `src/utils/` beyond the `src/lib/` five
- Hooks in `src/hooks/` beyond `useSwipe`
- The HTTP/auth service layer (`HttpTransport`, `WpJwtProvider`, `AuthProvider`)
- The theme engine (`src/themes/`)
- Layout engine utilities (`canvasMeasurement`, `smartGuides`, `groupGeometry`, `alignSlots`, `graphicLayerTransform`, `clipPath`, `layerList`)
- Generic UI component pieces inside the Layout Builder (canvas grid, rulers, measurement overlay, smart guides overlay)
- WordPress coupling points embedded in otherwise-generic code (nonce management, `window.__WPSG_CONFIG__`, `wp-json` URL patterns, `WpJwtProvider`)

Without this broader scan, P51-B and P51-C risk carving the wrong boundaries and leaving obvious candidates on the table.

### Goal of the Spike

Produce a **ranked, categorized candidate list** covering every module that is either:

1. **Ready now** — no WPSG/WP-specific imports; could move to a package today with only path changes
2. **Ready with light decoupling** — 1–3 WPSG-specific dependencies that can be injected as props/parameters or replaced with a generic interface
3. **Requires refactoring** — meaningfully coupled to WP or WPSG concerns, but the underlying logic is reusable enough that extraction with a refactor is worth considering
4. **Informative only** — tightly coupled but worth noting because a future abstraction boundary would naturally land nearby

For each candidate, the spike should capture:
- Current file path
- Category (pure util / hook / service / component / theme)
- WordPress/WPSG coupling points (specific symbols, imports, or runtime globals that tie it to this host)
- Proposed decoupling strategy if in category 2 or 3
- Target package (`shared-utils`, `shared-ui`, a new `shared-layout` package, or none)
- Confidence (high / medium / low)

### Scope

**Areas to survey:**

- `src/lib/` — the P50-G baseline; confirm still clean; nothing to discover but good calibration
- `src/utils/` — every file; classify pure vs. WPSG-coupled
- `src/hooks/` — every file; generic browser hooks vs. admin/WP hooks vs. genuinely mixed
- `src/services/http/` and `src/services/auth/` — the interface/impl split; assess portability
- `src/themes/` — color generation, CSS variable emission, adapter, types, validation
- `src/components/Admin/LayoutBuilder/` — canvas primitives (CanvasGrid, CanvasRulers, MeasurementOverlay, SmartGuides, GraphicLayerContent) that may be geometry/rendering utilities wearing component clothes
- `src/contexts/` and `src/services/queryClient.ts` — context providers; are any context shapes generic?
- `src/i18n/` and `src/lib/` (already listed) — for completeness

**WordPress coupling to flag specifically:**
- Direct `window.__WPSG_CONFIG__` reads
- `window.wp.*` accesses (WP media frame, WP API settings)
- Hardcoded `/wp-json/` URL prefixes
- `WpJwtProvider` — the nonce/cookie auth model is WP-specific; flag the shape of a generic JWT/token interface it could be abstracted from
- `useNonceHeartbeat` — WP nonce refresh; entirely WP-specific but worth noting if the underlying "token refresh" pattern could be generic
- WordPress admin CSS bleeding (e.g. `wpAdminFormReset.css`) — flag that this is WP-specific glue

**Packages to consider (beyond the P50-G two):**
- `@wp-super-gallery/shared-utils` — pure utilities and generic hooks (confirmed P50-G scope + new candidates)
- `@wp-super-gallery/shared-ui` — decoupled React components (Auth, Lightbox + new candidates)
- `@wp-super-gallery/canvas-primitives` — layout-builder canvas utilities if the geometry/rendering helpers are dense enough to warrant their own package
- `@wp-super-gallery/theme-engine` — if the theme system has no runtime WP deps and is self-contained enough to be independently published and consumed

### Output

The spike should produce a structured report (appended to this section as "Spike Findings") with:

1. **Executive summary** — how many modules found in each category; which packages make sense; any surprising coupling or surprising cleanliness discovered
2. **Candidate table** — one row per module: path | category | WP coupling points | decoupling strategy | target package | confidence
3. **Recommended package topology** — which packages to create in P51-B / P51-C / beyond, with rationale
4. **Decoupling playbook** — a concise description of each recurring coupling pattern found and the standard fix (e.g., "inject base URL as parameter instead of reading from `window.__WPSG_CONFIG__`")

### How to run the spike

Invoke an Opus or Fable agent with read access to the full `src/` tree. The agent should read each candidate file in its entirety — not just the top — because coupling often appears in a single import or runtime global read buried in an otherwise-clean file. For components, it should read both the `.tsx` and any co-located `.test.tsx` to understand what the test stubs out (stubbed globals are a coupling signal).

The agent should **not** write any code. Output is research only. P51-B and P51-C will use the findings to define their implementation scope.

### Acceptance criteria

- Every file in `src/lib/`, `src/utils/`, `src/hooks/`, `src/services/http/`, `src/services/auth/`, and `src/themes/` has an entry in the candidate table.
- Every Layout Builder canvas primitive (`CanvasGrid`, `CanvasRulers`, `MeasurementOverlay`, `SmartGuides`, `GraphicLayerContent`) has an entry.
- All WordPress coupling points are listed by file and symbol, not summarized.
- The recommended package topology includes a concrete `package.json` name + proposed contents for each package, and explicitly argues against any package that doesn't make the cut.
- The decoupling playbook names the concrete symbol or pattern to replace in each case.

---

## Track P51-B — `packages/shared-utils/` extraction

> **Blocked on P51-A.** Scope defined by spike findings.

Baseline from P50-G: `src/lib/sanitizeCss.ts`, `cssUnits.ts`, `safeLocalStorage.ts`, `useSwipe.ts`, `scrollLock.ts`. The spike may expand this to include generic hooks and pure utils from `src/utils/` and `src/hooks/`.

---

## Track P51-C — `packages/shared-ui/` extraction

> **Blocked on P51-A.** Scope defined by spike findings.

Baseline from P50-G: Auth components (`LoginForm`, `AuthBarFloating`, `AuthBarMinimal`) and Lightbox (`Lightbox`, `KeyboardHintOverlay`). The spike may expand this to include Layout Builder canvas primitives or theme engine components if they prove sufficiently decoupled.

---

## Track P51-D — WordPress coupling audit & decoupling

> **Blocked on P51-A.** Specific WP coupling points identified by the spike.

For any module targeted for extraction that has WordPress coupling, this track applies the decoupling playbook: replacing direct runtime global reads with injected parameters, replacing WP-specific interfaces with generic interface contracts, and removing or isolating WP admin CSS assumptions.

---

*Updated: 2026-06-12 (P51-A spike track written; P51-B/C/D stubs blocked on spike findings)*
