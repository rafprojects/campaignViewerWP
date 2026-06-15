# Phase 51 - Shared Package Extraction, Decoupling & Abstraction Audit + Front-end Fixes

**Status:** Planning
**Created:** 2026-06-12
**Last updated:** 2026-06-14

This phase carries **two track groups**:

- **Abstraction work (P51-A…D)** — the shared-package extraction spike and its follow-on extraction/decoupling tracks. Planning-stage; B/C/D are sequenced after the spike.
- **Front-end fixes & admin quick wins (P51-E…H)** — small, ship-now bug fixes and polish, ready to execute independently of the spike. P51-E is also the first concrete input to the spike: it extracts a shared adapter tile-size/geometry helper that P51-A then folds into its candidate list (see the recalibration note in P51-A).

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P51-A | Abstraction Spike — Opus/Fable audit of the full codebase for package candidates, WordPress-coupling points, and decoupling paths | ✅ Complete | Medium |
| P51-B | `packages/shared-utils/` — extract pure utility and primitive hook modules | 🔶 In progress (increment 1 done) | Medium |
| P51-C | `packages/shared-ui/` — extract decoupled Auth, Lightbox, and generic UI components | To do | Medium-High |
| P51-D | WordPress coupling audit & decoupling — replace or wrap all hardcoded WP assumptions in library code | To do | Medium |
| P51-E | Gallery adapter bug fixes — Spotlight thumbnail cap + hero max-width/justification, Hexagon/Diamond %-unit height + row reflow, Scroll-snap/Coverflow/Stacked infinite growth; shared tile-layout + bounded-section-height helpers | ✅ Complete | Medium |
| P51-F | Campaign listing card — uniform hover scale (card + image grow together) | ✅ Complete | Small |
| P51-G | WP admin IA quick wins — rename top-level menu to "SuperGallery"; fix Companies taxonomy labels ("Add Tag") + clarify "Count" column | ✅ Complete | Small |
| P51-H | Access-grant role editing — inline role dropdown in the grant row (currently delete-only) | ✅ Complete | Small |

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

> **Recalibration (2026-06-14):** Two changes from the original P50-G-derived scope. (1) **`src/components/Galleries/Adapters/` is now in scope** — the adapter tree was never surveyed and is a strong source of pure-geometry/units candidates. (2) **Sequencing with P51-E:** run P51-E first. It extracts a shared tile-size-resolution + row-split helper from the hexagonal/diamond adapters (fixing the %-unit bugs in the process); that helper, plus the `cssUnits` helpers it builds on, are pre-classified `shared-utils` candidates the spike inherits rather than rediscovers. The spike's job for the adapters is to find the *rest* of the candidates around that seed.

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
- `src/components/Galleries/Adapters/` — **added 2026-06-14.** The adapters are a large, previously-unsurveyed area. P51-E (see below) lands a shared tile-size resolution + row-split geometry helper extracted from `hexagonal/` and `diamond/`; that helper is a pre-seeded `shared-utils` candidate the spike should classify. Beyond it, survey the adapter registry (`adapterRegistry.ts`), the `GalleryAdapterProps` contract (`GalleryAdapter.ts`), and per-adapter rendering helpers for further pure-geometry/units candidates vs. WPSG-coupled rendering.
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

### Spike Findings (2026-06-14)

**Method.** Read-only full-tree survey, fanned out over five parallel sub-agents (utils, hooks, services+auth+contexts, themes, canvas-primitives+adapters), each reading files in full and flagging coupling by symbol. Synthesis + every "ready-now / zero-coupling" claim and the strongest surprises were re-verified directly (grep of import lines + WP-global reads) before inclusion — see verification notes inline.

**Baseline correction (supersedes the acceptance criteria above).** `src/lib/` and `src/i18n/` **no longer exist** — P50-G already extracted the `src/lib/` modules into `packages/shared-utils` (`cssUnits`, `safeLocalStorage`, `sanitizeCss`, `scrollLock`, `useSwipe`) and `packages/shared-ui` (`Lightbox`, `KeyboardHintOverlay`, `LoginForm`). The two packages exist and are wired; `shared-utils` is still `"private": true`. So the spike's real baseline is "what remains in `src/`", and the `AuthBarFloating`/`AuthBarMinimal` components named in the P50-G `shared-ui` scope were **not** carried over and are still in the app tree (a small loose end for P51-C).

#### 1. Executive summary

| Area | Files surveyed | Ready now (move w/ path change) | Ready w/ light decoupling | Stays (domain/WP) |
|------|----------------|----------------------------------|----------------------------|--------------------|
| `src/utils/` | 37 | 8 | ~13 | ~16 |
| `src/hooks/` | 46 | 10 | ~7 | ~29 |
| `src/services/{http,auth}` + `queryClient`/`apiClient` | 6 | 3 interfaces/factory | 2 impls (isolate globals) | 1 |
| `src/contexts/` | 7 | 3 generic | 2 (externalize init) | 2 domain |
| `src/themes/` | ~28 (incl. 23 JSON) | color/validation/types/JSON | adapter+index (Mantine, env, prefix) | — |
| Layout Builder canvas primitives | 5 | 0 (shells) | — | 5 |
| Adapters `_shared` + tree | ~20 | 2 (`tileLayout`, `sectionHeight`) | 1 (`pinterest` math) | rest |

**Headline conclusions.**
- **`shared-utils` has a large, low-risk backlog** — ~18 modules (8 pure utils + 10 generic hooks) can move with only path changes, plus ~20 more behind a single trivial decoupling each. This is the bulk of the value and should be P51-B.
- **A dedicated `shared-layout` package is not justified.** The five canvas-primitive *components* are thin WPSG-coupled SVG render-shells (`useBuilderOverlayColors`, `useCanvasTransform`, `@/types` layout types). The only genuinely portable layout code is the *underlying* pure geometry in `src/utils/` (`canvasMeasurement`, `smartGuides`) — fold those into `shared-utils`, don't spin up a package.
- **`theme-engine` is viable as a future package (YES-with-caveats)** — the color pipeline (`colorGen`, `validation`, `types`, all `definitions/*.json`) is genuinely clean; the blockers are mechanical (Mantine in `adapter.ts`, `import.meta.env.DEV`, a hardcoded `--wpsg` prefix, a catalog path import, and `shared-utils` being private). Recommend its own track, not folded into P51-B/C.
- **The WP coupling is already well-isolated by interfaces in the service layer.** `AuthProvider`/`HttpTransport` are clean contracts; `WpJwtProvider` confines all WP endpoints/fields. The leaks are confined to two impls (`HttpTransportImpl.buildAuthHeaders`/`refreshNonce`) and the nonce-cookie branch of `AuthContext` — both fixable with a `getNonce`/`WpNonceProvider` injection (P51-D).

#### 2. Candidate tables

Confidence column omitted where "high" throughout; coupling cited by symbol. "shared-utils✓" = the package already exists and this is a clean add.

**`src/utils/` — ready now (zero `@/` imports, verified by grep):**

| file | what | target |
|------|------|--------|
| `clampDimension.ts` | pure math | shared-utils✓ |
| `sortByOrder.ts` | `{order?}` sort | shared-utils✓ |
| `getErrorMessage.ts` | error→string | shared-utils✓ |
| `resolveColumnsFromWidth.ts` | pure column math | shared-utils✓ |
| `galleryAnimations.ts` | DOM transition over `HTMLElement` | shared-utils✓ |
| `maskFeather.ts` | Canvas feather | shared-utils✓ |
| `canvasMeasurement.ts` | snap/tick/distance geometry | shared-utils✓ (geometry) |
| `smartGuides.ts` | guide-snap geometry | shared-utils✓ (geometry) |

**`src/utils/` — ready with light decoupling (one fix each):**

| file | coupling (symbol) | fix | target |
|------|--------------------|-----|--------|
| `alignSlots.ts` | `LayoutSlot` (used as `{id,x,y,w,h}`) | inline structural type | shared-utils✓ |
| `graphicLayerTransform.ts` | `LayoutGraphicLayer` (rotation/flipH/flipV) | accept `{rotation?,flipH?,flipV?}` | shared-utils✓ |
| `slotEffects.ts` | `Slot*` data-bag types | inline structural types | shared-utils✓ |
| `shadowPresets.ts` | `ShadowPreset` union | inline union literal | shared-utils✓ |
| `resolveBreakpointValue.ts` | `Breakpoint` union | inline `'desktop'\|'tablet'\|'mobile'` | shared-utils✓ |
| `gradientCss.ts` | `Gradient*` shape types | inline as generic CSS types | shared-utils✓ |
| `clipPath.ts` | `getClipPathForShape` is pure; wrappers take `LayoutSlot` | move `getClipPathForShape` only | shared-utils✓ |
| `groupGeometry.ts` | `LayoutGroup`/`LayoutSlot` | generic `{id,…,memberIds}` interfaces | shared-utils✓ (geometry) |
| `checkeredBg.ts` | Mantine CSS vars | parametrize var names | shared-utils✓ |
| `loadCustomFonts.ts` / `loadGoogleFont.ts` | hardcoded style-id / app-name strings | parametrize | shared-utils✓ |
| `spaceColor.ts` / `themeScope.ts` / `debug.ts` / `fallback.ts` | hardcoded `wpsg-`/key/label strings only | parametrize prefix/label | shared-utils✓ (low) |

**`src/utils/` — stays (WPSG-domain model, not worth decoupling):** `galleryConfig.ts`, `campaignGalleryOverrides.ts`, `campaignGalleryRenderPlan.ts`, `campaignViewerLayout.ts`, `cardConfig.ts`, `mergeSettingsWithDefaults.ts`, `resolveAdapterId.ts`, `resolveListingAdapterId.ts`, `gridLayout.ts` (`resolveListingColumns` takes `GalleryBehaviorSettings`; the pure `resolveFixedCardWidth`/`gridRowMaxWidthCss`/`formatGapCss` could split out later), `layerList.ts`, `layoutSlotAssignment.ts`, `wpsgDebug.ts` (reads `window.__WPSG_CONFIG__`), plus `assetFileType.ts`/`maskFeather` siblings already covered.

**`src/hooks/` — ready now (zero `@/` imports + no WP globals, verified by grep):** `useCarousel`, `useIdleTimeout`, `useOnlineStatus`, `useTabVisibility`, `useViewportHeight`, `useDirtyGuard`, `useLazyAccordion`, `useXhrUpload` (takes `url`/`headers` as params), `useBuilderDeepLink` (History/URLSearchParams), and `useLightbox` (already imports `acquireBodyScrollLock` from `shared-utils`). → all `shared-utils✓` (mirrors `useSwipe` already living there).

**`src/hooks/` — ready with light decoupling:**

| hook | coupling (symbol) | fix |
|------|--------------------|-----|
| `usePersistentAccordion` / `useScrollRestore` / `useReloadSafeView` | `useRootId()` from `RootIdContext` for storage-key prefix | accept `storageKeyPrefix`/`storageKey` param |
| `useRecentFonts` | `localStorage` key `wpsg-recent-fonts` | configurable `storageKey`/`maxRecent` |
| `useMediaDimensions` / `useMediaLightbox` | `MediaItem` (uses `.id`/dims only) | generic `<T extends {id:string;…}>` |
| `useBreakpoint` | `useMantineTheme()` for px + `ResponsiveBreakpoint` | inject `mobileMaxPx`/`tabletMaxPx` |

**`src/hooks/` — stays (WP/WPSG/admin):** `useNonceHeartbeat` (`window.__WPSG_CONFIG__`, `/wp-json/.../nonce`), `useAuth` (re-export of WP `AuthContext`), `usePageSpaces` (`window.__WPSG_PAGE_SPACES__`), and the `ApiClient`/`adminQuery`/`@/types`-bound admin & builder hooks: `useAdminAccessState`, `useAccessRows`, `useAdminCampaignActions`, `useArchiveModal`, `useAuditRows`, `useCampaignsRows`, `useExternalMediaModal`, `useInContextSave`, `useMediaUsageSummary`, `useRecordAnalyticsEvent`, `useUnifiedCampaignModal`, `useBuilderCampaignMedia`, `useBuilderDraftRestore`, `useBuilderOverlayColors`, `useBuilderShellColors`, `useBuilderWorkspacePrefs`, `useLayoutBuilderState`, `useLayoutTemplate`, `useBroadcastStaleness`, `useFeatheredMask`, `useMediaTransition`, `useMediaDnd` (also `@dnd-kit`), `useMediaViewPrefs`, `useShortcutConfig`, `useTheme`, `useTypographyStyle`.

**Service / auth / context layer:**

| file | verdict | coupling (symbol) |
|------|---------|--------------------|
| `services/http/HttpTransport.ts` | clean interface (verified no WP globals) | none — injects `baseUrl`/`authProvider`/`onUnauthorized` |
| `services/http/HttpTransportImpl.ts` | leak, P51-D | `buildAuthHeaders`/`refreshNonce` read+write `window.__WPSG_CONFIG__.restNonce`, `window.__WPSG_REST_NONCE__`; `/wp-json/.../nonce` literal |
| `services/auth/AuthProvider.ts` | clean interface (verified no imports) | none |
| `services/auth/WpJwtProvider.ts` | **playbook exemplar** — WP fully behind the interface | `/wp-json/jwt-auth/v1/token*`, `/permissions`; `wpsg_*` localStorage; `data.user_id/isAdmin/campaignIds` |
| `services/queryClient.ts` | clean factory | none |
| `services/apiClient.ts` | thin facade | wiring lives in caller |
| `contexts/RootIdContext.tsx` | generic string-id provider | none |
| `contexts/CanvasTransformContext.ts` | generic UI state (`scale`,`isHandTool`) | none |
| `contexts/themeContextDef.ts` | generic | `MantineThemeOverride` (theme registry) |
| `contexts/ThemeContext.tsx` | externalize init | `resolveInitialThemeId` reads `window.__WPSG_CONFIG__?.theme`, `window.__wpsgThemeId` |
| `contexts/AuthContext.tsx` | leak, P51-D | nonce-cookie branch reads `__WPSG_CONFIG__`/`__WPSG_REST_NONCE__`/`__WPSG_API_BASE__`, hits `/auth/login`/`/auth/logout`, `window.location.reload()` |
| `contexts/CampaignContext.tsx` | domain | `Campaign` + campaign callbacks |
| `contexts/SettingsStore.ts` | domain | `GalleryBehaviorSettings`, `magicLinkLandingPageId` |

**Themes (`theme-engine` candidate):** `colorGen.ts` (only `chroma-js`+`./types`, verified), `validation.ts` (portable; `import.meta.env.DEV`), `types.ts` (zero imports), `definitions/*.json` (23 plain JSON) — all clean. Blockers: `adapter.ts` returns `MantineThemeOverride`/`colorsTuple` (the framework boundary — split a neutral `resolveColors`/`generateCssVariables` layer from the `adaptTheme` Mantine shim); `cssVariables.ts` hardcodes `const PREFIX = '--wpsg'`; `index.ts` static-imports `../../wp-plugin/.../theme-catalog.json` and uses `import.meta.env.DEV`; `cssVariables` imports `sanitizeCssValue` from the still-private `shared-utils`.

**Layout Builder canvas primitives:** `CanvasGrid`, `CanvasRulers`, `MeasurementOverlay`, `SmartGuides`, `GraphicLayerContent` — all thin render-shells coupled via `useBuilderOverlayColors`/`useCanvasTransform`/`@/types`. **No component extraction.** Their math already lives in `src/utils/{canvasMeasurement,smartGuides}.ts` (covered above).

**Adapters:** `_shared/tileLayout.ts` (only `CssWidthUnit` from `shared-utils` + browser globals — verified) and `_shared/sectionHeight.ts` (zero imports — verified) are the **P51-E seed**, clean `shared-utils` adds. Minor further candidate: `pinterest/PinterestAdapter.tsx` `classifyTile(ratio)` + `rowUnit` formula (~8 lines, low value). `GalleryAdapter.ts` (contract), `adapterRegistry.ts`, `_shared/runtimeCommon.ts`, `_shared/tileHoverStyles.ts` stay (WPSG-domain).

#### 3. Recommended package topology

- **`@wp-super-gallery/shared-utils`** *(exists — expand in P51-B).* Add the 8 pure utils + 10 generic hooks (ready now), then the ~20 light-decoupling modules. Fold pure geometry (`canvasMeasurement`, `smartGuides`, and later `alignSlots`/`groupGeometry`) here under a `geometry` entry rather than a new package. **First action: flip `"private": true` → publishable**, since `theme-engine` and any external consumer depend on it.
- **`@wp-super-gallery/shared-ui`** *(exists — expand in P51-C).* Carry over the still-missing `AuthBarFloating`/`AuthBarMinimal` from the P50-G scope; candidates to add: `RootIdContext`, `CanvasTransformContext`, `themeContextDef` (generic providers).
- **`@wp-super-gallery/theme-engine`** *(new — its own track, recommend a dedicated P51 or P52 track, not folded into P51-B).* Contents: `colorGen`, `validation`, `types`, `cssVariables` (parametrized prefix), `definitions/*.json`, an injectable catalog. Excludes `adapter.ts` (stays app-side as the Mantine shim). Peer-dep-free if the Mantine boundary is kept out.
- **`@wp-super-gallery/shared-layout`** — **argued against.** The only portable layout code is pure geometry already destined for `shared-utils`; the canvas components are WPSG shells. Revisit only if the geometry set grows enough to warrant its own surface.
- **`@wp-super-gallery/canvas-primitives`** — **argued against**, same reason.

#### 4. Decoupling playbook (recurring pattern → standard fix)

1. **WPSG type used only structurally** → replace the `@/types` import with a local inline structural type or a generic `<T extends {…}>` param. (`alignSlots`, `slotEffects`, `graphicLayerTransform`, `shadowPresets`, `resolveBreakpointValue`, `gradientCss`, `useMediaDimensions`, `useMediaLightbox`.)
2. **`useRootId()` storage-key scoping** → accept a `storageKeyPrefix`/`storageKey` string param; callers compose it. (`usePersistentAccordion`, `useScrollRestore`, `useReloadSafeView`.)
3. **Direct `window.__WPSG_*` / nonce reads** → inject a `getNonce: () => string|undefined` callback + endpoint/baseURL options; for auth, lift the nonce-cookie branch into a `WpNonceProvider implements AuthProvider`. (`HttpTransportImpl`, `AuthContext`, `ThemeContext.resolveInitialThemeId`.)
4. **Mantine token coupling** → split a framework-neutral token layer (`resolveColors`/`generateCssVariables`) from the Mantine `adaptTheme` shim; keep the shim app-side. (`themes/adapter.ts`.)
5. **`import.meta.env.DEV`** → `process.env.NODE_ENV !== 'production'` or an injected `isDev`. (`themes/validation.ts`, `themes/index.ts`.)
6. **Hardcoded `wpsg-`/`--wpsg`/style-id/app-name strings** → parametrize with a default. (`cssVariables` `PREFIX`, `loadCustomFonts`/`loadGoogleFont`, `themeScope`, `debug`, `fallback`, `spaceColor`.)

#### 5. Notes / risks surfaced

- **Eager registry import (verified).** `src/utils/galleryConfig.ts` imports `getRegisteredAdapters`/`getSettingGroupDefinition` from `adapterRegistry` and calls them at module-eval time to build `LEGACY_ADAPTER_SETTING_KEYS` (line 99), guarded by a defensive `getRegisteredAdaptersSafe()` — a real circular-dependency signal. Any extraction touching `galleryConfig` or the registry must preserve/keep this lazy-guard.
- **`shared-utils` is `"private": true`** — a hard prerequisite for `theme-engine` (which imports `sanitizeCssValue` from it) and for any external publish. Flip this first in P51-B.
- **P50-G loose end:** `AuthBarFloating`/`AuthBarMinimal` were named for `shared-ui` but never moved; pick them up in P51-C.

### Acceptance criteria

- Every file in `src/lib/`, `src/utils/`, `src/hooks/`, `src/services/http/`, `src/services/auth/`, and `src/themes/` has an entry in the candidate table.
- Every Layout Builder canvas primitive (`CanvasGrid`, `CanvasRulers`, `MeasurementOverlay`, `SmartGuides`, `GraphicLayerContent`) has an entry.
- The adapter tree (`src/components/Galleries/Adapters/`) is surveyed: the P51-E tile-size/geometry helper is classified, and any further geometry/units candidates across the adapters have entries.
- All WordPress coupling points are listed by file and symbol, not summarized.
- The recommended package topology includes a concrete `package.json` name + proposed contents for each package, and explicitly argues against any package that doesn't make the cut.
- The decoupling playbook names the concrete symbol or pattern to replace in each case.

---

## Track P51-B — `packages/shared-utils/` extraction

> **Unblocked by P51-A.** Scope below is set by the Spike Findings.

`shared-utils` already exists (P50-G: `sanitizeCss`, `cssUnits`, `safeLocalStorage`, `useSwipe`, `scrollLock`). The spike defines the expansion:

- **First action:** flip the package's `"private": true` → publishable (prerequisite for `theme-engine` and external consumers).
- **Move now (verified zero-coupling):** utils `clampDimension`, `sortByOrder`, `getErrorMessage`, `resolveColumnsFromWidth`, `galleryAnimations`, `maskFeather`, plus geometry `canvasMeasurement`, `smartGuides`; hooks `useCarousel`, `useIdleTimeout`, `useOnlineStatus`, `useTabVisibility`, `useViewportHeight`, `useDirtyGuard`, `useLazyAccordion`, `useXhrUpload`, `useBuilderDeepLink`, `useLightbox`; and the P51-E seed `_shared/tileLayout.ts` + `_shared/sectionHeight.ts`.
- **Move after light decoupling (one fix each — see playbook §4):** `alignSlots`, `graphicLayerTransform`, `slotEffects`, `shadowPresets`, `resolveBreakpointValue`, `gradientCss`, `clipPath` (`getClipPathForShape` only), `groupGeometry`, `checkeredBg`, `loadCustomFonts`, `loadGoogleFont`; hooks `usePersistentAccordion`, `useScrollRestore`, `useReloadSafeView`, `useRecentFonts`, `useMediaDimensions`, `useMediaLightbox`, `useBreakpoint`.

### Implementation — increment 1 (2026-06-14): zero-coupling batch moved

Moved the **20 verified zero-coupling modules** into `packages/shared-utils/src/` via `git mv` (history preserved), with their co-located unit tests: utils `clampDimension`, `sortByOrder`, `getErrorMessage`, `resolveColumnsFromWidth`, `galleryAnimations`, `maskFeather`, `canvasMeasurement`, `smartGuides`; hooks `useCarousel`, `useIdleTimeout`, `useOnlineStatus`, `useTabVisibility`, `useViewportHeight`, `useDirtyGuard`, `useLazyAccordion`, `useXhrUpload`, `useBuilderDeepLink`, `useLightbox`; and the P51-E seed `_shared/tileLayout.ts` + `_shared/sectionHeight.ts`. The barrel (`index.ts`) re-exports all of them; `useLightbox`'s `scrollLock` import and `tileLayout`'s `cssUnits` import were relativized to siblings. Flipped the package `"private": true → false` and added a `types` field (a built `dist/` + `exports` map for true external `npm publish` is the remaining publishability step — deferred; monorepo consumption already works via the workspace alias).

**Consumer repoint:** 47 app files had their `@/utils/*` / `@/hooks/*` / relative / `../_shared/*` imports repointed to `@wp-super-gallery/shared-utils`; eslint `--fix` consolidated the resulting duplicate import lines.

**Test-mock fallout (fixed):** nine test files mocked a moved module by its old path. Converted each to mock the barrel with the real module spread in (`vi.mock('@wp-super-gallery/shared-utils', async () => ({ ...(await vi.importActual(...)), <override> }))`), merging the per-file `useCarousel`+`useLightbox` pairs into one mock, and repointed three dynamic `await import('@/hooks/useOnlineStatus')` calls (`AnalyticsDashboard.test`). One latent strict-tsc issue surfaced (`resolveColumnsFromWidth.test` `first[0]!` under `noUncheckedIndexedAccess`, now type-checked by the package project) and was fixed.

**Gate:** `tsc -b` clean, `eslint` clean, **173 files / 2348 tests pass**, coverage thresholds met (functions 75.2% — note the gate is tight). **Remaining in P51-B:** the ~18 light-decoupling modules (playbook §4), then the `theme-engine` track.

### Implementation — increment 2a (2026-06-14): decoupled css/geometry/layout helpers

Moved 7 modules that needed a one-line decoupling each (playbook §1):
- `shadowPresets` — inlined the `ShadowPreset` union locally.
- `graphicLayerTransform` — replaced the `LayoutGraphicLayer` param with a structural `GraphicLayerTransformInput`.
- `alignSlots` — retyped `LayoutSlot` → the package's existing `SlotRect` (from `smartGuides`); not re-exported, to avoid a barrel name clash.
- `slotEffects` — inlined `SlotFilterEffects`/`SlotShadow`/`SlotOverlayEffect`/`SlotBlendMode`; relativized `sanitizeCssColor`.
- `gradientCss` — inlined `GradientType`/`GradientDirection`/`RadialShape`/`RadialSize`/`GradientStop`; relativized `sanitizeCssColor`. `src/types/index.ts` now references `GradientOptions` via the package (same inline-import pattern it already uses for the `Css*Unit` types).
- `resolveBreakpointValue` — inlined the `Breakpoint` literal.
- `clipPath` — **split**: `getClipPathForShape` (+ inlined `LayoutSlotShape`) moved to the package; the `LayoutSlot` wrappers `getClipPath`/`usesClipPath` stay in `src/utils/clipPath.ts` and call the package fn (its test exercises them via the rich `DEFAULT_LAYOUT_SLOT`, so it stays app-side too).

Repointed 14 consumers. The `alignSlots`/`gradientCss` unit tests stay in `src` (they import `@/types` fixtures) but now import the function from the package — an acceptable app-level test over a package fn.

**Coverage scope change:** extended the coverage `include` to `packages/shared-utils/src/**` — the package is first-party code extracted from `src/`, and its tests already run; counting them keeps the metric honest as modules migrate (and lifts function coverage to 76.28%, undoing the dip from moving well-tested fns out of `src/`). **Gate:** `tsc`/`eslint` clean, 2348 tests pass, coverage met (functions 76.28%).

---

## Track P51-C — `packages/shared-ui/` extraction

> **Unblocked by P51-A.** Scope below is set by the Spike Findings.

`shared-ui` already exists (P50-G: `Lightbox`, `KeyboardHintOverlay`, `LoginForm`).

- **Loose end from P50-G:** `AuthBarFloating`/`AuthBarMinimal` were named for `shared-ui` but never moved — carry them over.
- **New candidates (generic providers):** `RootIdContext`, `CanvasTransformContext`, `themeContextDef`.
- **Explicitly NOT in scope:** the five Layout Builder canvas primitives (`CanvasGrid`, `CanvasRulers`, `MeasurementOverlay`, `SmartGuides`, `GraphicLayerContent`) — the spike found them to be thin WPSG-coupled render-shells; only their underlying geometry (already going to `shared-utils`) is portable.
- **`theme-engine` (new package), recommended as its own track:** the color pipeline (`colorGen`, `validation`, `types`, `cssVariables` with a parametrized prefix, `definitions/*.json`, injectable catalog) is extractable; `themes/adapter.ts` stays app-side as the Mantine shim. Blockers are mechanical (Mantine boundary, `import.meta.env.DEV`, `--wpsg` prefix, catalog path import, `shared-utils` privacy).

---

## Track P51-D — WordPress coupling audit & decoupling

> **Unblocked by P51-A.** Specific WP coupling points identified by the spike.

The WP coupling is already well-isolated behind interfaces (`AuthProvider`/`HttpTransport` are clean; `WpJwtProvider` is the playbook exemplar). The remaining leaks to fix:

- `HttpTransportImpl.buildAuthHeaders`/`refreshNonce` read+write `window.__WPSG_CONFIG__.restNonce` / `window.__WPSG_REST_NONCE__` and hardcode `/wp-json/.../nonce` → inject a `getNonce` callback + endpoint option.
- `AuthContext.tsx` nonce-cookie branch reads `__WPSG_CONFIG__`/`__WPSG_REST_NONCE__`/`__WPSG_API_BASE__` and calls `/auth/login`·`/auth/logout` directly → lift into a `WpNonceProvider implements AuthProvider`.
- `ThemeContext.resolveInitialThemeId` reads `window.__WPSG_CONFIG__?.theme` / `window.__wpsgThemeId` → externalize to an injected resolver.
- Apply playbook §6 to remaining hardcoded `wpsg-`/`--wpsg` strings in extracted modules.

---

# Front-end Fixes & Admin Quick Wins (P51-E…H)

These tracks are independent of the abstraction spike and ready to execute. They are grouped into Phase 51 as small, ship-now fixes (the larger net-new features and the RBAC audit live in PHASE52_REPORT.md).

## Track P51-E — Gallery adapter bug fixes

### Problem
Four adapter bugs, all front-end-only:

1. **Spotlight thumbnail cap too low.** The `spotlightThumbnailSize` dimension control caps at `max: 200` in `src/components/Galleries/Adapters/adapterRegistry.ts` (~line 879). Consumed in `spotlight/SpotlightGallery.tsx` (`thumbSize`, ~line 67) — no logic change, just the cap.
2. **Hexagon %-unit height + row reflow broken.** In `src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx`: `tSize` is computed in px (~line 68) but applied to both width and height via `toCssOrNumber(tSize, tileSizeUnit)` (~lines 134–135), so non-`px` units flatten the hexagons. The tiles-per-row math (~line 80, `Math.floor((containerWidth + gapX) / (tSize + gapX))`) compares a px container width against a non-px tile value, so for `%`/`vw`/`em`/`rem` nothing ever wraps and tiles overflow offscreen.
3. **Diamond — same two bugs**, copy-pasted in `src/components/Galleries/Adapters/diamond/DiamondGallery.tsx` (~lines 69, 80, 134–135; `V_OVERLAP = 0.5`).
4. **Scroll-snap infinite growth.** In `src/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery.tsx`, the scroll container (~lines 140–266) holds N slides each `height: snapHeightCss` + `flexShrink: 0` (~lines 186, 192) without a bounded column track, so intrinsic height grows with item count and the viewport balloons.

### Goal / approach
- **Spotlight:** raise the `max` (e.g. 400–600) at `adapterRegistry.ts:879`.
- **Hexagon + Diamond:** resolve `tileSize` to an actual px width before geometry — using `containerWidth` for `%`, viewport for `vw`, font metrics for `em`/`rem` — then drive width/height/overlap/row-split from the resolved px value, preserving the clip's aspect ratio. **Extract this as a shared helper** (e.g. `resolveTileLayout(tileSize, unit, containerWidth, gap) → { pxSize, tilesPerRow, rows }`) so hexagon and diamond share one implementation instead of two copies. This helper is the seed candidate handed to the P51-A spike.
- **Scroll-snap:** rebuild the container as a bounded vertical scroll-snap pager — explicit `flexDirection: column`, fixed container height, `scrollSnapType: 'y mandatory'`, slides carrying `scrollSnapAlign`. Reference: the standard CSS scroll-snap vertical-pager pattern the user provided.

**Shared infra:** `Adapters/GalleryAdapter.ts` (`GalleryAdapterProps`); `adapterRegistry.ts`; unit helpers `packages/shared-utils/src/cssUnits.ts` (`toCss`, `toCssOrNumber`, `CSS_WIDTH_UNITS`).

### Acceptance criteria
- Spotlight thumbnails render above 200px when configured.
- Hexagon and Diamond render correct aspect ratios and wrap into rows for every supported unit (`px`, `%`, `vw`, `em`, `rem`); none overflow the container horizontally.
- Hexagon and Diamond share a single tile-layout helper (no copy-paste).
- Scroll-snap renders a fixed-height pager that snaps between items and does not grow unbounded; covered by a test asserting bounded container height for N items.

### Implementation (2026-06-14) — status: ✅ done; automated tests green + live visual QA passed (2026-06-14)

**Corrected root cause for scroll-snap.** The planning note (inherited from the exploration agent) blamed `flexShrink: 0`. That was wrong — the snap container is a *block* container, not a flex container, so `flexShrink` is a no-op. The actual bug is a **measurement feedback loop**: `GallerySectionWrapper` measures the section's `contentRect.height` and passes it down as `containerDimensions.height`; the adapter then used that as its own fixed snap height. The wrapper only applies a bounding `maxHeight` + `overflow:hidden` when `common.sectionHeightMode` is `viewport`/`manual` — in the **default `auto` mode** the section is content-sized, so adopting the measurement made the section grow by the heading/padding delta every ResizeObserver cycle (the "one image growing infinitely" symptom). Fix: `ScrollSnapGallery` now only adopts `containerDimensions.height` when `common.sectionHeightMode` is `viewport`/`manual`; otherwise it uses the fixed `FALLBACK_HEIGHT_PX` (500). This reads the same resolved `common.sectionHeightMode` the wrapper keys its bounding off, so the two stay consistent.

**Hexagon/Diamond %-unit bugs.** Both adapters computed tiles-per-row by comparing a px container width against the raw numeric tile value (unit-ignorant), and applied the same raw value to `height` (a `%` height has no parent height → collapsed/flattened tiles). Extracted a shared, framework-agnostic helper `src/components/Galleries/Adapters/_shared/tileLayout.ts` (`resolveLengthToPx`, `resolveTileGridLayout`) that resolves tile size + gap to pixels against the measured container width, then drives width/height/overlap/row-splitting from that single px value. Hexagon and Diamond now call it instead of each carrying a copy. `em` is approximated with the root font size (documented in the helper) since tiles size against the container, not a local font context. This helper is the seed candidate handed to the P51-A spike.

**Spotlight cap.** Raised `spotlightThumbnailSize.max` from 200 → 600 in `adapterRegistry.ts`. Confirmed there is **no** corresponding server-side clamp (`spotlight_thumbnail_size` is not in `WPSG_Settings_Registry::get_field_ranges()`), so no PHP change is needed.

**Files changed:** `_shared/tileLayout.ts` (new), `hexagonal/HexagonalGallery.tsx`, `diamond/DiamondGallery.tsx`, `scroll-snap/ScrollSnapGallery.tsx`, `adapterRegistry.ts`. **Tests added:** `_shared/tileLayout.test.ts` (9 cases — px/%/vw/rem/em resolution + reflow/fallback/min-per-row), `scroll-snap/ScrollSnapGallery.heightBound.test.tsx` (2 cases — auto-mode falls back to fixed height, bounded mode adopts measured height). Full `src/components/Galleries/Adapters` suite: 276 passing; `tsc -b` and `eslint` clean.

**Live visual QA (2026-06-14): passed.** Hexagon/Diamond with `%` units reflow and keep aspect; Scroll-snap in `auto` mode no longer grows unbounded.

### Implementation (2026-06-14, expansion from user manual QA) — status: ✅ done; automated tests green + live visual QA passed (2026-06-14)

During manual QA the user found three more issues; the track was expanded to cover them.

**Coverflow + Stacked infinite growth.** Both adapters had the *exact same* `containerDimensions.height` feedback loop as Scroll-snap (take the measured section height as their own fixed stage height; runaway in the default `auto` mode). Rather than triplicate the guard, extracted a shared helper `src/components/Galleries/Adapters/_shared/sectionHeight.ts` (`resolveBoundedSectionHeight`) that returns the measured height only in `viewport`/`manual` modes and a fixed fallback otherwise. Scroll-snap was refactored to use it too (replacing the inline guard added earlier), and Coverflow (`CoverflowAdapter.tsx`) and Stacked (`StackedDeckAdapter.tsx`) now call it. Second P51-A spike candidate alongside the tile-layout helper.

**Spotlight "Hero Max Width" did not size the hero.** The cap was applied to the whole adapter shell (`Stack`) with `marginInline: auto`, and the inner hero/strip container used `alignItems: 'flex-start'`, so the block shrink-wrapped and the hero was pinned left rather than filling/growing. Restructured: the hero+strip block now carries the `spotlightHeroMaxWidth` cap with `width: 100%` and `alignItems: 'stretch'` (below mode), so the hero fills the block up to the cap and raising the cap enlarges the hero. The block sits inside a full-width justification wrapper.

**Missing hero justification in "Below" mode.** The justification wrapper's `justifyContent` is driven by a **dedicated** `spotlightHeroJustification` setting (start | center | end). _Revised after review:_ the first pass reused the shared `common.adapterJustifyContent` ("Adapter Sizing → Adapter Justification"), but that setting is a single shared value for grid item-distribution (consumed by CompactGrid/Circular) — overloading it would have prevented independent control (e.g. section centered while the hero is justified end). So a dedicated, Spotlight-scoped setting was wired end-to-end instead: TS type + default (`'center'`) in `src/types/index.ts`; zod enum `SPOTLIGHT_HERO_JUSTIFICATIONS` in `settingsSchemas.ts`; a `select` control in the spotlight group of `adapterRegistry.ts`; and the PHP persistence path — `spotlightHeroJustification → spotlight_hero_justification` in the `$nested_adapter_field_map` (`class-wpsg-settings-sanitizer.php`), plus `spotlight_hero_justification` in the registry `$defaults` (`'center'`) and `$valid_options` (`['start','center','end']`) so it passes the sanitizer's `array_key_exists($flat_key, $defaults)` gate and persists (the same pattern that makes `tile_size` persist). The adapter maps start/center/end → `flex-start`/`center`/`flex-end`.

**Adapter-settings persistence gap (resolved).** While wiring the dedicated justification key above, I found that the *existing* Spotlight, Scroll-snap, and Masonry-entrance adapter flat keys were **absent from the registry `$defaults`**. The nested sanitizer (`sanitize_nested_gallery_setting`) gates every leaf on `array_key_exists($flat_key, $defaults)`, so these values were silently dropped on save through **both** persistence paths — global `gallery_config` saves and per-campaign `galleryOverrides`. (The space-override path was not affected: `space_overridable_fields` doesn't include `gallery_config`, and the nested sanitizers build their own allow-lists from the field maps.) Thirteen slugs were missing: `spotlight_hero_aspect_ratio`, `spotlight_thumbnail_size`(`_unit`), `spotlight_transition_duration`, `spotlight_strip_position`, `spotlight_hero_max_width`(`_unit`), `scroll_snap_alignment`, `scroll_snap_page_indicator`, `scroll_snap_max_width`(`_unit`), `masonry_entrance_animation`, `masonry_entrance_stagger`. **Fix:** registered each in `$defaults` (values mirrored from the TS `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`), plus `$valid_options` for the enum/unit keys and `$field_ranges` for the numeric keys — the same `tile_size` precedent. **Root cause of the blind spot:** the `adapterSettingsParity` test verified the registry↔PHP field *map* but never checked `$defaults`; added a new guard asserting every adapter-map slug exists in `$defaults`. **Regression tests:** `WPSG_Settings_Test::test_sanitize_settings_persists_spotlight_and_scroll_snap_adapter_settings` (global path) and `…::test_sanitize_gallery_overrides_persists_spotlight_adapter_settings` (campaign path, invalid enum rejected). Full PHP suite **951 passing**; JS `adapterSettingsParity` **7 passing**.

**Files changed (expansion):** `_shared/sectionHeight.ts` (new), `coverflow/CoverflowAdapter.tsx`, `stacked/StackedDeckAdapter.tsx`, `scroll-snap/ScrollSnapGallery.tsx` (now uses the shared helper), `spotlight/SpotlightGallery.tsx`. **Tests added:** `_shared/sectionHeight.test.ts`, `_shared/boundedStageHeight.test.tsx` (Coverflow + Stacked: auto falls back, bounded adopts), `spotlight/SpotlightGallery.layout.test.tsx` (cap applies to the block + fills width, justify via adapterJustifyContent); updated the existing `adapters.test.tsx` spotlight-maxWidth case to the new structure. Full `src/components/Galleries/Adapters` suite: **287 passing**; `tsc -b` and `eslint` clean.

**Live visual QA (2026-06-14): passed.** Coverflow/Stacked in `auto` mode no longer grow unbounded; Spotlight Hero Max Width sizes the hero and justification works in both `below`/`right` strip positions. **P51-E fully Done.**

## Track P51-F — Campaign listing card uniform hover scale

### Problem
`src/components/CampaignGallery/CampaignCard.module.scss` (~lines 5–12): on hover the card gets `translateY(-2px)` while a separate rule scales only `.thumbnailImage` (`transform: scale(1.02)`), producing a "zoom through a window" effect — the image grows but the card chrome does not.

### Approach
Apply the scale to the whole card (scale `.card`, or wrap image + chrome in one transformed element) and remove the image-only transform so card and image grow together uniformly. Component: `CampaignGallery/CampaignCard.tsx`.

### Acceptance criteria
- On hover, the entire card (border, chrome, and image) scales as one unit; the image no longer scales independently of its frame.

### Implementation (2026-06-14) — status: implemented
In `CampaignCard.module.scss` the hover now applies `transform: translateY(-2px) scale(1.02)` to `.card` itself, and the image-only `.card:hover .thumbnailImage { transform: scale(1.02) }` rule (plus the now-unused `.thumbnailImage` transition) was removed — card chrome and image scale as one unit. Also fixed a latent reduced-motion bug: the `@media (prefers-reduced-motion: reduce)` block reset `.card { transform: none }`, which does **not** out-specify `.card:hover`, so the hover transform survived reduced-motion. The reset now targets `.card, .card:hover`, matching the hover specificity so the lift/scale is genuinely disabled. (`styles.thumbnailImage` is now undefined; the component applies that className conditionally, so it simply drops — no JS change needed.)

## Track P51-G — WP admin IA quick wins

### Problem & approach
PHP, `wp-plugin/wp-super-gallery/includes/class-wpsg-cpt.php`:

1. **Rename top-level menu to "SuperGallery"** (keep the inner "Campaigns" list item). The `wpsg_campaign` CPT (~lines 61–70) drives both the top-level menu and its "All Campaigns" submenu from a bare `label`. Provide a `labels` array instead: `menu_name => 'SuperGallery'` and `all_items => 'Campaigns'` (plus `name`/`singular_name`), so only the top-level menu is renamed. Confirm the Settings/Spaces submenus still nest under `edit.php?post_type=wpsg_campaign` (`includes/settings/class-wpsg-settings-renderer.php` ~line 43; `includes/class-wpsg-space-admin-renderer.php` ~line 30).
2. **Fix Companies taxonomy "Add Tag" + "Count".** `register_taxonomy('wpsg_company', …)` (~lines 72–78) is registered with only `label`, so WP falls back to default non-hierarchical strings ("Add New Tag", etc.). Add a proper `labels` array (`add_new_item => 'Add New Company'`, `new_item_name => 'New Company Name'`, …). The ambiguous "Count" column is a fixed WP taxonomy column — rename/clarify it to "Campaigns" via a `manage_edit-wpsg_company_columns` / `manage_wpsg_company_custom_column` filter pair.

### Acceptance criteria
- WP sidebar shows a "SuperGallery" top-level menu with a "Campaigns" item beneath it (plus existing Settings/Spaces).
- The Companies taxonomy screen reads "Add New Company" (no "Add Tag" wording) and the count column is clearly labeled.

### Implementation (2026-06-14) — status: implemented, PHP tests green
In `class-wpsg-cpt.php`: the `wpsg_campaign` registration gained a full `labels` array with `menu_name => 'SuperGallery'` and `all_items => 'Campaigns'` (the bare `label` is kept as a fallback) — only the top-level menu is renamed; the campaign list item and the nested Settings/Spaces submenus (which hang off `edit.php?post_type=wpsg_campaign`) are unaffected. The `wpsg_company` taxonomy gained an explicit non-hierarchical `labels` array (`add_new_item => 'Add New Company'`, `new_item_name => 'New Company Name'`, plus the `separate_items_with_commas`/`add_or_remove_items`/`choose_from_most_used` strings) so WP no longer falls back to the default "tag" wording. For the ambiguous "Count" column I took the simpler route over the planned custom-column pair: a `manage_edit-wpsg_company_columns` filter (`rename_company_count_column`) relabels the built-in `posts` column header to **"Campaigns"**, preserving WP's working count + filtered-list link. **Tests:** `WPSG_CPT_Registration_Test` +4 methods (menu_name/all_items, company labels-not-tag-defaults, column rename, column-rename no-op) — class 30 passing.

## Track P51-H — Access-grant role editing (dropdown)

### Problem & approach
The access-grant row supports delete only; add an inline role `Select` (viewer / editor / owner).
- Row renderer `src/hooks/useAccessRows.tsx` (~lines 62–76): replace the static role `Badge` with a Mantine `Select`.
- On change, upsert via the existing endpoints (no schema change): `POST …/campaigns/{id}/access` and `POST …/companies/{id}/access` both accept `access_level` and use `upsert_grant()` (`includes/rest/class-wpsg-access-controller.php`), which replaces the existing entry for that user.
- Add an update mutation in `src/services/adminQuery.ts` (alongside the existing grant mutations) and invalidate the grants query on success. Grant shape: `CompanyAccessGrant` (`adminQuery.ts` ~lines 111–125).

### Acceptance criteria
- Each grant row exposes a role dropdown; changing it persists the new `access_level` and the row reflects it after refetch.
- No regression to the existing delete/revoke action.

### Implementation (2026-06-14) — status: implemented, automated tests green
The role column in `useAccessRows.tsx` is now a Mantine `Select` (viewer/editor/owner, options derived from the existing `ROLE_BADGE_CONFIG`, current-role tooltip retained) with an accessible `Role for <name>` label. Rather than adding a new mutation in `adminQuery.ts`, the change is handled by a new `handleChangeRole(entry, level)` in `useAdminAccessState.ts` — the server's `upsert_grant()` replaces the existing entry for the user, so re-`POST`ing to the same `/access` endpoint with the new `access_level` is an in-place role update. Endpoint resolution mirrors `handleRevokeAccess` exactly (campaign-view → `campaigns/{accessCampaignId}/access`; company-source → `companies/{selectedCompanyId}/access`; campaign-source → `campaigns/{entry.campaignId}/access`), any existing `expires_at` is preserved, and same-level re-selection is a no-op. `AdminPanel.tsx` passes `onChangeRole: accessState.handleChangeRole`. **Tests:** `useAccessRows.test.tsx` rewritten for the dropdown (11 tests incl. a `fireEvent` interaction asserting `onChangeRole(entry, 'owner')` and a same-role no-op); `useAdminAccessState` suite still green. `tsc` + `eslint` clean. No PHP change — the REST grant endpoints already accept `access_level`.

**Follow-up (live QA) — second Access UI in WP "Spaces → Access".** Initial QA found the per-space grant table still showed static role badges: that screen is a **separate** component (`SpaceManagementView.tsx`, mounted standalone on the WP-admin Spaces page), not the `useAccessRows`/`AdminPanel` table. Applied the same fix there — the row's `<Badge>` is now a `Select` (shared `SPACE_ROLE_OPTIONS`, accessible `Role for <name>` label, disabled while the row's update is in flight). A new `handleChangeRole(userId, level)` re-`POST`s to `/spaces/{id}/access`, which upserts via `WPSG_Space_Controller::upsert_space_grant` (verified), so the role updates in place; same-level re-selection is a no-op. The grant-creation form now reuses the same `SPACE_ROLE_OPTIONS`. **Tests:** `SpaceManagementView.test.tsx` +3 (renders current level as a dropdown; POSTs `{ userId, access_level }` to `/spaces/10/access` on change; no POST on same-role) — file 11 passing; `tsc` + `eslint` clean.

---

*Updated: 2026-06-12 (P51-A spike track written; P51-B/C/D stubs blocked on spike findings)*
*Updated: 2026-06-14 — Added front-end fix tracks P51-E…H (adapter bugs, card hover, WP menu/taxonomy labels, access-grant role dropdown). Recalibrated P51-A: added `src/components/Galleries/Adapters/` to the spike's survey scope and sequenced P51-E first so its extracted tile-layout helper seeds the spike candidate list. Larger net-new features and the RBAC audit split into PHASE52_REPORT.md.*
*Updated: 2026-06-14 — P51-E adapter-settings persistence gap resolved (13 nested Spotlight/Scroll-snap/Masonry-entrance slugs registered in PHP `$defaults`/`$valid_options`/`$field_ranges`; parity guard + PHP regression tests added). P51-F (card hover), P51-G (WP menu/taxonomy IA), and P51-H (access-grant role dropdown) implemented with automated tests green. Remaining: P51-A…D abstraction tracks, and live visual QA of the P51-E adapter fixes.*
*Updated: 2026-06-14 — Marked P51-E…H ✅ Complete in the Tracks table (all four shipped with automated tests green; P51-H follow-up fixed the second per-space Access UI in `SpaceManagementView`). Only live visual QA of the P51-E adapter fixes remains outstanding on those tracks. Starting P51-A (abstraction spike).*
*Updated: 2026-06-14 — P51-A abstraction spike ✅ Complete. Full-tree read survey (5 parallel sub-agents, key claims re-verified by grep) appended as "Spike Findings": candidate tables for utils/hooks/services/contexts/themes/canvas/adapters, recommended topology (expand `shared-utils` + `shared-ui`; new `theme-engine` as its own track; argued against `shared-layout`/`canvas-primitives`), and a 6-pattern decoupling playbook. Corrected the baseline (`src/lib`/`src/i18n` already extracted in P50-G; `shared-utils` still `private`; `AuthBar*` a P50-G loose end). P51-B/C/D stubs rewritten with concrete spike-defined scope; B/C/D now unblocked.*
