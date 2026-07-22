# Phase 70 - React Structure, Abstraction & Duplication Cleanup

**Status:** Planned
**Created:** 2026-07-14
**Last updated:** 2026-07-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P70-A | Extract shared adapter chrome (heading, Lightbox wiring, container-width hook) | Done | Medium |
| P70-B | Consolidate `DiamondGallery`/`HexagonalGallery` into a config-driven `ClippedTileGridGallery` | Done | Small-Medium |
| P70-C | Consolidate nonce-refresh logic into one place | Planned | Small |
| P70-D | Merge gallery-config utility duplication (`galleryConfig.ts` / `galleryConfigUtils.ts`) | Planned | Small-Medium |
| P70-E | `ApiClient` facade — migrate to namespaced domain modules | Deferred (follow-on) | Medium |
| P70-F | `useLayoutBuilderState` — collapse 17 one-line template-field setters into one generic setter | Planned | Small |
| P70-G | Split `types/index.ts` 1,811-line barrel into per-domain files | Done | Medium |
| P70-H | `AdminPanel.tsx` state extraction into per-concern hooks | Planned | Medium-Large |
| P70-I | Promote inline sub-components out of six 900+-line files | Deferred (follow-on) | Small per file, Medium overall |

---

## Rationale

Nothing in this phase is broken — the 2026-07-13 review ([REACT_REVIEW_FINDINGS.md](REACT_REVIEW_FINDINGS.md)) explicitly notes the builder state hook was reviewed and found already well-decomposed, and none of these items were flagged as functional risk. All nine were independently re-verified against current source on 2026-07-14 — every line-count and duplication claim held up (two minor calibration notes below), with zero real disputes.

1. **What triggered it.** The gallery-adapter family (C-1, C-2) is the largest concrete duplication in the whole React codebase: 14 adapters each hand-roll the same heading/Lightbox/resize-observer chrome, and two of them (`DiamondGallery`/`HexagonalGallery`) are byte-for-byte identical except for ~5 constants. `AdminPanel.tsx` and `types/index.ts` are the two largest single-file maintainability risks in the tree.
2. **Why it belongs together.** Every item here is "reduce duplication or split an oversized file with no behavior change" — kept as one phase per direction (better one substantial cleanup phase than several thin ones), mirroring how the PHP-side backlog handled its equivalent cleanup cluster (Phase 67).
3. **Success.** Adding or fixing adapter chrome (heading, lightbox, resize behavior) happens in one shared place instead of 14; the Diamond/Hexagonal family shares one component; nonce-refresh logic lives in the one place P51-D already designated for it; `AdminPanel.tsx` and `types/index.ts` stop being single points of wide-blast-radius change.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | C-1/C-2 sequencing | Extract the shared adapter chrome (P70-A, generalizes to all 14 adapters) **before** consolidating Diamond/Hexagonal (P70-B) — so the new `ClippedTileGridGallery` is built on top of the shared chrome hook from day one instead of needing a second pass. Verification found `_shared/` already exports `resolveGalleryHeading`/`resolveAdapterShellStyle` as data/style *logic*; P70-A's job is wrapping that logic in the actual shared JSX (heading block, `<Lightbox>` element, `useContainerWidth`) that's currently hand-copied per file. |
| B | C-5 scope calibration | Verification found `apiClient.ts` is 422 lines, not the ~300 estimated in the review — same duplication-facade shape, just a larger file than stated. No change to the fix direction, just a note that this track is somewhat bigger than its original Effort estimate suggested. |

## Planning Refinement & Execution Decisions (2026-07-21)

A validation pass re-checked every structural claim against current source (all held: Diamond/Hex 217 lines each, 17 template-field setters, `apiClient.ts` 422 lines, `AdminPanel.tsx` 999 / `types/index.ts` 1811 / `useLayoutBuilderState.ts` 1130, all six P70-I line counts exact, 14 chrome-bearing adapters = 16 main `.tsx` − 2 layer-content files). One path correction surfaced: the report references **flat** adapter paths (`Adapters/DiamondGallery.tsx`) but adapters live in **per-type subdirectories** (`Adapters/diamond/DiamondGallery.tsx`); `_shared/` is `Adapters/_shared/`.

Four execution decisions were taken with the maintainer:

| # | Decision | Resolution |
|---|----------|------------|
| C | Scope of P70-E and P70-I | **Deferred to a follow-on.** Both are by-design incremental/opportunistic (E = ~70-call-site codemod behind deprecated shims; I = "do each file as it's next touched") and don't fit a bounded phase. In-scope this phase: **A, B, C, D, F, G.** |
| D | PR strategy | **One PR, batched commits** on the `feature/phase70-*` branch (Phase 69 precedent). |
| E | P70-D depth | **Dedupe-and-keep-split** — move `GALLERY_BREAKPOINTS`/scope types to one home and re-export; do *not* merge `galleryConfigUtils.ts` (one consumer) into a ~1000-line file. |
| F | P70-A container-width | **Custom `useContainerWidth(ref)`**, not Mantine's `useElementSize` — replicates the exact existing effect (initial `clientWidth` seed + `ResizeObserver`) with a consumer-supplied ref, guaranteeing byte-identical behaviour. |

**Execution order (batched commits, single PR):** Batch 1 = P70-A → P70-B (adapter chrome, A first so B builds on it); Batch 2 = P70-G (`types` split); Batch 3 = P70-C / P70-D / P70-F (independent small consolidations); Batch 4 = P70-H (`AdminPanel`, largest, last).

## Execution Priority

No cross-track dependencies beyond A→B noted above. Suggested batching (not a hard sequence):

1. **P70-A → P70-B** — the adapter-chrome extraction and the Diamond/Hexagonal consolidation, in that order (Key Decision A).
2. **P70-G** — `types/index.ts` split: purely mechanical, zero import-site changes required, quick independent win.
3. **P70-C, P70-D, P70-F** — the three smaller logic-consolidation tracks (nonce refresh, gallery-config utils, layout-builder setters); independent of each other and of the above.
4. **P70-E** — `ApiClient` facade migration: larger, touches call sites incrementally over time; start whenever convenient, no rush.
5. **P70-H** — `AdminPanel.tsx` extraction: the largest, most involved track; do after the smaller wins build momentum/context.
6. **P70-I** — opportunistic; do each file as it's next touched for an unrelated reason, per the review's own suggested approach, rather than as a big-bang.

---

## Track P70-A - Extract shared adapter chrome

*Source: REACT_REVIEW_FINDINGS.md § C-2 — re-verified 2026-07-14, confirmed accurate. Verification nuance: `_shared/runtimeCommon.ts` already exports `resolveGalleryHeading`/`resolveAdapterShellStyle` as data/style logic — the duplication that remains is the actual heading and `<Lightbox>` JSX, hand-copied per file, plus 3 adapters' hand-rolled `ResizeObserver` hooks (confirmed: hexagonal, diamond, layout-builder).*

### Problem

All 14 gallery adapters (`src/components/Galleries/Adapters/`) call `resolveGalleryComponentCommonSettings` + `resolveGalleryHeading`, then hand-roll an identical `heading.visible && <Title>…<Group>{icon}{label}` JSX block and an identical `<Lightbox>` element with the same 9 settings props and `openAt`/`close` carousel-lightbox callbacks — confirmed byte-identical between `DiamondGallery.tsx` and `CircularGallery.tsx`. Three adapters additionally hand-roll a `ResizeObserver`-based container-width hook.

### Fix

Add to `_shared/`:
- `<AdapterHeading common={…} icon={…} label={…} />` (or a `useAdapterChrome(settings, runtime)` hook returning `{ common, heading, shellStyle }`).
- `<AdapterLightbox settings media …/>` owning the 9-prop mapping once.
- `useContainerWidth(ref)` (or adopt `useElementSize` from `@mantine/hooks`, already a dependency) replacing the three hand-rolled `ResizeObserver` effects.

Migrate adapters incrementally — each is a mechanical ~30-line diet with existing snapshot coverage confirming no visual change.

### Acceptance criteria

- All 14 adapters render heading and lightbox chrome via the shared components/hook, not hand-copied JSX.
- The 3 `ResizeObserver`-based adapters use the shared `useContainerWidth` (or `useElementSize`) instead of their own effect.
- No visual or behavioral change (snapshot tests confirm).

### Validation

- Existing per-adapter snapshot tests pass unmodified after migration.
- New unit tests directly against the shared `AdapterHeading`/`AdapterLightbox`/`useContainerWidth`.

### Implementation (2026-07-21)

Added to `Adapters/_shared/`: `useContainerWidth.ts`, `AdapterLightbox.tsx`, `AdapterHeading.tsx` (+ a unit test each). Verification surfaced that the chrome is **not** uniform across all 14 adapters — three shapes exist, and the extraction was built to preserve each exactly:
- **Heading:** an *icon variant* (`<Title><Group>{icon}{label}</Group></Title>`, 8 adapters, Masonry with an extra `titleStyle`) and a *label-only variant* (`<Title>{label}</Title>`, 5 adapters). `AdapterHeading` selects between them by **whether an `icon` prop is passed** (not by `showGalleryLabelIcon`). LayoutBuilder's `<Text>`-based heading is a third shape and stays inline (not migrated).
- **Lightbox:** the five `settings.lightbox*` props were byte-identical across all 14; `AdapterLightbox` owns them, the six variable props stay per-adapter. Migrated all 12 non-clipped adapters (Diamond/Hex get it via P70-B).
- **Container width:** only Diamond/Hex/LayoutBuilder hand-rolled a `ResizeObserver`. `useContainerWidth` reproduces the Diamond/Hex effect (initial `clientWidth` seed + observer). **LayoutBuilder was intentionally left inline** — its observer uses a different, no-initial-read shape (`containerWidth || 9999` fallback + `runtime.breakpoint`) whose first-render breakpoint must not shift; forcing it onto the seeding hook would be a subtle behaviour change. Its first consumer is `ClippedTileGridGallery` (P70-B).

**Outcome:** `tsc -b` clean; 322 adapter tests + 18 `_shared` unit tests green; eslint clean. No DOM/snapshot change.

---

## Track P70-B - Consolidate `DiamondGallery`/`HexagonalGallery`

*Source: REACT_REVIEW_FINDINGS.md § C-1 — re-verified 2026-07-14, confirmed accurate (both files 217 lines, structurally identical aside from ~5 constants: clip-path, `V_OVERLAP` 0.5 vs 0.25, icon, CSS scope string, and a few magic numbers). Depends on P70-A per Key Decision A.*

### Problem

`DiamondGallery.tsx` and `HexagonalGallery.tsx` differ only in a clip-path polygon, a `V_OVERLAP` constant, a title icon, a CSS scope string, and a handful of icon-size/badge-position magic numbers. Every future fix must be applied twice — confirmed the files' own comments already show one bug (a non-`px` unit issue) was fixed twice, once per file.

### Fix

Extract a `ClippedTileGridGallery` (in `Adapters/_shared/`, built on P70-A's shared chrome) taking a config object `{ scope, clipPath, vOverlap, icon, badgeOffsets }`; each adapter file becomes a ~20-line registration wrapper.

### Acceptance criteria

- `DiamondGallery.tsx` and `HexagonalGallery.tsx` are thin config-passing wrappers around `ClippedTileGridGallery`.
- No visual change (existing snapshot tests per adapter confirm).

### Validation

- Existing snapshot tests for both adapters pass unmodified.
- Manual: render both gallery types on the dev site, visually confirm no regression.

### Implementation (2026-07-21)

Added `Adapters/_shared/ClippedTileGridGallery.tsx` (built on P70-A's chrome + `useContainerWidth`), driven by a `ClippedTileGridConfig` capturing the ~7 constants that differed: `scope`, `debugName`, `clipPath`, `vOverlap`, heading `icon`, `playIconRatio`/`zoomIconRatio`, and `badge` (`bottom`/`padding`/`fontSize`/optional `whiteSpace`). `DiamondGallery.tsx` and `HexagonalGallery.tsx` are now ~45-line config wrappers (down from 217 each). Inline-style property order is preserved (the diamond badge's `whiteSpace: 'nowrap'` is spread last, conditionally) so the emitted `style` attribute stays byte-identical.

**Outcome:** `tsc -b` clean (after typing the forwarded optional `runtime` prop as `ResolvedGallerySectionRuntime | undefined` for `exactOptionalPropertyTypes`); adapter smoke suite green unmodified; eslint clean. Net −131 lines plus single-source-of-truth for the clipped-grid family.

---

## Track P70-C - Consolidate nonce-refresh logic

*Source: REACT_REVIEW_FINDINGS.md § C-3 — re-verified 2026-07-14, confirmed accurate: `useNonceHeartbeat.ts`'s inline `refresh()` reads/writes `window.__WPSG_CONFIG__`/`window.__WPSG_REST_NONCE__` directly, calling neither `HttpTransportImpl.refreshNonce()` nor the `getWpNonce`/`setWpNonce` helpers in `wpNonce.ts` that P51-D introduced specifically to be "the single place" for this.*

### Problem

"GET the nonce endpoint, write the result to both window globals" is implemented three times: `HttpTransportImpl.refreshNonce()`, `useNonceHeartbeat`'s inline `refresh()` (which bypasses the P51-D helpers entirely), and `wpNonce.ts`'s helpers themselves. The heartbeat predates the P51-D decoupling and was never migrated.

### Fix

Add `fetchFreshNonce(apiBase): Promise<string | null>` to `wpNonce.ts`; have the heartbeat call it plus `setWpNonce`; have the transport's `refreshNonce` delegate to it via its injected callbacks (or accept it as `ApiClientOptions.refreshNonce`).

### Acceptance criteria

- All three call sites use the same `wpNonce.ts`-owned fetch-and-store logic; no direct `window.__WPSG_*` reads/writes remain in `useNonceHeartbeat.ts`.
- No behavior change: nonce refresh still works identically for the heartbeat and for transport-triggered refreshes.

### Validation

- Existing nonce-heartbeat and transport-refresh test coverage passes unmodified.

---

## Track P70-D - Merge gallery-config utility duplication

*Source: REACT_REVIEW_FINDINGS.md § C-4 — re-verified 2026-07-14, confirmed accurate: `galleryConfig.ts` (503 lines) and `galleryConfigUtils.ts` (484 lines) both define `GALLERY_BREAKPOINTS` independently, and the legacy viewport-background field map lives in the former and is imported by the latter.*

### Problem

`src/utils/galleryConfig.ts` and `src/components/Common/galleryConfigUtils.ts` both own gallery-config scope/breakpoint logic, with `GALLERY_BREAKPOINTS` defined independently in both rather than one importing from the other. The boundary ("pure config transforms" vs. "editor helpers") is real, but the constants/types are duplicated across it.

### Fix

Move shared constants/types (`GALLERY_BREAKPOINTS`, scope types) to a single home (utils or `@/types`), re-export from the editor module, and document the intended split at the top of each file. Consider merging outright if the editor helpers have no non-editor consumers.

### Acceptance criteria

- `GALLERY_BREAKPOINTS` and other shared constants/types are defined exactly once.
- Each file's top-of-file comment documents its actual scope (pure transforms vs. editor helpers) if the split is kept.

### Validation

- Existing gallery-config test coverage passes unmodified (same exported values from the single source of truth).

---

## Track P70-E - `ApiClient` facade migration to namespaced domain modules

*Source: REACT_REVIEW_FINDINGS.md § C-5 — re-verified 2026-07-14. Note: actual file size is 422 lines, not the ~300 estimated in the review (see Key Decision B) — same shape, bigger than stated.*

### Problem

`apiClient.ts` forwards roughly 70 methods to domain modules verbatim, to preserve the pre-P32-C flat call surface. Every new endpoint currently costs three edits (domain module, facade method, type re-export) and the facade adds no behavior of its own.

### Fix

Expose the domain modules as public readonly namespaces (`client.campaigns.duplicate(…)`, `client.webhooks.list(…)`) and migrate call sites incrementally via a mechanical codemod, keeping the flat methods as deprecated shims until callers are gone. Not urgent — pure maintenance economics, no user-facing behavior at stake.

### Acceptance criteria

- New endpoints can be added by touching only the domain module — no facade edit required going forward.
- Existing call sites continue to work unchanged during the incremental migration (deprecated shims remain functional).

### Validation

- Existing full test suite (which exercises the facade methods extensively) passes unmodified throughout the migration.
- Type-check (`tsc -b`) stays clean at each incremental step.

---

## Track P70-F - Collapse `useLayoutBuilderState`'s 17 one-line template-field setters

*Source: REACT_REVIEW_FINDINGS.md § C-6 — re-verified 2026-07-14, confirmed accurate: exactly 17 `useCallback`s of the shape `mutate((d) => { d.<field> = v; }, '<label>')` in a 1,130-line file.*

### Problem

`useLayoutBuilderState.ts` defines seventeen near-identical one-line-body `useCallback`s for template-field setters (name, aspect ratio, background/gradient fields, canvas height, etc.). Each new template field currently costs ~5 lines of hook plus ~2 lines of interface.

### Fix

Replace with one generic `setTemplateField<K extends keyof LayoutTemplate>(key: K, value: LayoutTemplate[K], label: string)` (plus a small label map), keeping thin named wrappers only where clamping logic exists (e.g. `setCanvasHeightVh`).

### Acceptance criteria

- The 17 one-line setters are replaced by the generic setter (plus any wrappers that do real clamping work).
- No change to undo/redo history labels or behavior — existing builder-history tests confirm.

### Validation

- Existing `useLayoutBuilderState` and builder-history test suites pass unmodified.
- Manual: exercise a handful of the affected fields in the Layout Builder, confirm undo/redo labels are unchanged.

---

## Track P70-G - Split `types/index.ts` into per-domain files

*Source: REACT_REVIEW_FINDINGS.md § D-2 — re-verified 2026-07-14, confirmed accurate: exactly 1,811 lines, 73 top-level exports spanning campaign, media, layout template, gallery settings, analytics, and access domains.*

### Problem

`src/types/index.ts` holds ~74 exported types/consts spanning entirely unrelated domains. Everything imports from `@/types`, so any edit invalidates a very wide TS dependency graph, and finding a specific type means scrolling a 1,811-line file.

### Fix

Split into `types/campaign.ts`, `types/media.ts`, `types/layoutTemplate.ts`, `types/gallerySettings.ts`, etc., all re-exported from `types/index.ts` so zero import sites change. Mechanical; do it in one PR to avoid drift.

### Acceptance criteria

- `types/index.ts` becomes a thin re-export barrel; the actual type definitions live in per-domain files.
- Zero import-site changes required anywhere in the codebase.

### Validation

- `tsc -b` clean, full test suite green — both are strong signals here since a barrel split either works completely or breaks obviously.

### Implementation (2026-07-21)

Split into `types/gallerySettings.ts` (gallery config/runtime + behaviour/card settings, 1078 lines), `types/media.ts` (137), `types/access.ts` (42), `types/campaign.ts` (43), `types/layoutTemplate.ts` (541); `types/index.ts` is now a 5-line `export *` barrel. Cross-domain references use `import type` and form a clean DAG (`campaign → media + gallerySettings`, `layoutTemplate → gallerySettings`; media/access/gallerySettings self-contained — the tail's `Campaign` mentions were all comments, so gallerySettings needs no campaign/layout imports). The three non-exported helpers (`DEFAULT_GALLERY_COMMON_SETTINGS`, `createDefaultGalleryScopeConfig`, `createDefaultGalleryConfig`) stayed module-private in `gallerySettings.ts` beside their consumer.

**Outcome:** all 73 exports preserved (verified mechanically), zero duplicate names, **zero import-site changes**. `tsc -b` clean, eslint clean, full suite green (247 files / 3727 tests).

---

## Track P70-H - `AdminPanel.tsx` state extraction into per-concern hooks

*Source: REACT_REVIEW_FINDINGS.md § D-1 — re-verified 2026-07-14, confirmed accurate (999 lines, 16 lazy-loaded modals, 24 `useState` hooks — the review's "~30" estimate was somewhat high but directionally correct; 4 total zip-transfer flags, not 5 as stated, same minor overcount). `useAdminCampaignActions` (`src/hooks/useAdminCampaignActions.ts`, 419 lines) already exists and is wired into `AdminPanel.tsx`, confirming the extraction pattern this track continues.*

### Problem

`AdminPanel.tsx` already lazy-loads its 16 modals, but the component body holds state for every tab (media/access/audit selection, filters, multiple zip-transfer flags), the ZIP export/import handlers, prefetch orchestration, and cross-tab wiring. Any change to one tab risks touching shared render scope, and the whole panel re-renders on any of its ~24 state atoms changing.

### Fix

Extract per-concern hooks mirroring the existing `useAdminCampaignActions` pattern: `useAdminZipTransfers` (the export/import handler pairs + flags), `useAuditTabState`, `useAccessTabState`, `useMediaTabState`. Pure state/handler moves — no behavior change, each independently testable.

### Acceptance criteria

- Each extracted concern's state and handlers live in their own hook, mirroring `useAdminCampaignActions`'s existing shape.
- `AdminPanel.tsx` itself shrinks substantially and no longer re-renders on state changes belonging to unrelated tabs.
- No behavior change in any tab.

### Validation

- Existing AdminPanel and per-tab test suites pass unmodified.
- New unit tests directly against each extracted hook.
- Manual: exercise media, access, and audit tabs plus ZIP export/import, confirm no regressions.

---

## Track P70-I - Promote inline sub-components out of six 900+-line files

*Source: REACT_REVIEW_FINDINGS.md § D-3 — re-verified 2026-07-14, all six line counts confirmed exactly: `MediaCarouselAdapter.tsx` 874, `UnifiedCampaignModal.tsx` 926, `GalleryConfigEditorModal.tsx` 916, `LayoutCanvas.tsx` 1036, `LayoutSlotComponent.tsx` 993, `SlotPropertiesPanel.tsx` 938. Inline sub-components confirmed: `MediaCarouselAdapter.tsx` contains `MediaCarouselInner` and `CampaignListingCarousel` plus six module-level helpers; `UnifiedCampaignModal.tsx` contains `MediaTabContent` plus four helpers.*

### Problem

Six components sit at or above 900 lines with internal sub-components already defined inline — the seams for extraction already exist.

### Fix

Promote the inline sub-components to sibling files (file moves plus prop-type exports, not a redesign). Target: no file over ~600 lines. Do opportunistically as each file is next touched for an unrelated reason, rather than as a big-bang across all six.

### Acceptance criteria

- Each file, once touched, has its inline sub-components promoted to sibling files with no behavior change.
- No file in this list stays above ~600 lines once addressed.

### Validation

- Existing test coverage for each component passes unmodified after extraction.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| **P70-E — `ApiClient` facade → namespaces** | Deferred 2026-07-21 (Planning Decision C). A ~70-call-site incremental codemod behind deprecated shims — long-tail migration economics, not a bounded phase deliverable. Start whenever convenient. |
| **P70-I — promote inline sub-components** | Deferred 2026-07-21 (Planning Decision C). Opportunistic by design ("do each file as it's next touched"); forcing all six 900+-line files in one big-bang creates churn without behaviour benefit. |

## Implementation Notes

- Manual-QA companion: [PHASE70_MANUAL_QA_RUNBOOK.md](PHASE70_MANUAL_QA_RUNBOOK.md) — a verification section is added per landed fix.
- **Batch 1 (P70-A, P70-B) landed 2026-07-21** — see each track's *Implementation* block. `tsc -b` clean, 322 adapter + 18 `_shared` unit tests green, eslint clean.
- **Batch 2 (P70-G) landed 2026-07-21** — `types/index.ts` split. `tsc -b` + eslint clean, full suite green (247 files / 3727 tests), zero import-site changes.

## Outcome

In progress. Batches 1–2 complete (adapter-chrome extraction, Diamond/Hexagonal consolidation, `types` split); Batches 3–4 (C/D/F; H) pending. P70-E and P70-I deferred to Follow-On Candidates.
