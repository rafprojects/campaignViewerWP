# React Front-End Code Review — Findings & Task Backlog

This document tracks the findings of a full review of the plugin's React/TypeScript surface (`src/` — ~59k lines excluding tests — plus `packages/shared-ui`, `packages/shared-utils`, `packages/theme-engine`, and `public/sw.js`). Items follow the [FUTURE_TASKS.md](FUTURE_TASKS.md) conventions: each entry carries **Context**, **What to fix/implement**, **Files**, and an **Effort | Impact** estimate. Items promoted to active phase execution should move into phase reports and be checked off here. It is the front-end companion to [PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md); cross-side items reference that document.

**Review date:** 2026-07-13 (branch `feat/phase62-monetization-licensing`, v0.90.0)
**Method:** full manual read of the core infrastructure (bootstrap, transport, auth providers, query layer, contexts, builder state hooks, service worker), targeted audit sweeps of the whole tree for DOM-injection sinks, storage access, URL handling, and duplicated patterns, structural review of the largest components/hooks, and REST-contract tracing into the PHP controllers where a front-end behavior depends on server semantics. `tsc -b` and `eslint .` both run **completely clean** (0 errors, 0 warnings).

**Triage (2026-07-14):** every finding below was independently re-verified against current source — all 24 confirmed accurate, zero real disputes (a few line-count/count estimates drifted slightly, e.g. C-5's `apiClient.ts` is 422 lines not ~300, D-1's `useState` count is 24 not ~30 — same direction, no change to the fix). All are now planned across four phase reports. Section G's cross-side items are folded into these phases directly (A-2, B-1, E-1 as both-sides tracks within them); the two items that live primarily in the PHP backlog (PHP A-14, PHP A-3) were cross-referenced back into [PHASE64_REPORT.md](PHASE64_REPORT.md) and [PHASE66_REPORT.md](PHASE66_REPORT.md) respectively rather than duplicated here.

| Findings | Phase |
|---|---|
| A-1, A-2, A-3, A-4, A-5 | [PHASE68_REPORT.md](PHASE68_REPORT.md) — React Correctness: Listing, Freshness & SW Cache Fixes |
| B-1, B-2, B-3, B-4, E-1 | [PHASE69_REPORT.md](PHASE69_REPORT.md) — React Security, Privacy & Hardening Defaults |
| C-1, C-2, C-3, C-4, C-5, C-6, D-1, D-2, D-3 | [PHASE70_REPORT.md](PHASE70_REPORT.md) — React Structure, Abstraction & Duplication Cleanup |
| E-2, E-3, E-4, E-5, F-1 | [PHASE71_REPORT.md](PHASE71_REPORT.md) — React Efficiency & i18n Consistency Sweep |

---

## Overall Assessment

The React side is in **excellent shape** — the same deliberate, phase-by-phase engineering visible on the PHP side shows here. Highlights worth calling out before the findings:

- **DOM-injection surface** — exactly **one** `dangerouslySetInnerHTML` in the entire tree ([MediaAddModal.tsx:353](../src/components/Admin/MediaAddModal.tsx#L353)), and it is behind DOMPurify with an explicit tag allowlist, an attribute allowlist (no event handlers can slip through), and a provider-pinned `ALLOWED_URI_REGEXP`. No `innerHTML`, `document.write`, `insertAdjacentHTML`, `eval`, or `new Function` anywhere in source.
- **CSS injection defenses** — a dedicated sanitizer module (`sanitizeCssUrl` / `sanitizeCssColor` / `sanitizeClipPath` / `sanitizeCssValue` in [sanitizeCss.ts](../packages/shared-utils/src/sanitizeCss.ts)) is used at every site where a user-controlled value is interpolated into a style or `<style>` tag — mask URLs, background images, glow colors, clip paths. `javascript:`/`data:` URI schemes are rejected, `url()` breakout characters are rejected.
- **Auth architecture** — transport (`HttpTransportImpl`), auth (`AuthProvider` contract with `WpNonceProvider`/`WpJwtProvider` adapters), and WP-global coupling (`wpNonce.ts`, `wpThemeId.ts`) are cleanly separated. The default deployment keeps no tokens in the browser (cookie + nonce); the JWT/localStorage path is opt-in behind a wp-config constant and its upgrade path is already documented in FUTURE_TASKS.
- **Mount hardening** — shortcode props are filtered through an explicit key allowlist before entering the React tree ([main.tsx:65-79](../src/main.tsx#L65-L79)); JSON parse failures degrade to `{}`.
- **Monitoring hygiene** — Sentry `beforeSend` strips `Authorization` headers from breadcrumbs and deletes auto-detected user IPs; Sentry is lazy-loaded and disabled in dev.
- **Server remains authoritative** — client-side gates that look like access control (the `canAccess` media filter in [App.tsx:245](../src/App.tsx#L245), the `isPro` feature gates) were traced to the server: the campaigns listing is access-scoped in `WPSG_Campaign_Controller::list_campaigns()` (guests get public-only, users get accessible IDs), and the pro fields (`texts`, `breakpointOverrides`) are stripped server-side by `WPSG_License::can_use_feature()` on save. The client checks are defense-in-depth/UX, exactly as they should be.
- **Structure** — admin surfaces and all heavy modals are lazy-loaded; the 1,100-line builder state hook is genuinely decomposed into seven sub-hooks with labeled immer history mutations; the query layer has consistent keys, stale times, and optimistic-update rollback.

The findings below are mostly **one real correctness bug, dead-by-gating code (the same failure pattern as PHP A-1/A-2), duplication that has started to drift, oversized-but-working components, and hardening/compliance polish** — no exploitable front-end vulnerability was found.

### Suggested fix order (highest value first)

| # | Finding | Effort | Impact |
|---|---------|--------|--------|
| 1 | A-1 Public gallery listing silently capped at 10 campaigns | Small-Medium | High |
| 2 | A-2 Service-worker SWR for anonymous visitors is unreachable (nonce on every request) | Small-Medium FE + Small PHP | Medium-High |
| 3 | F-1 Untranslated notification/toast strings regressed vs the P60/61 i18n milestone | Medium | Medium |
| 4 | B-1 Google Fonts fetched client-side — undocumented third-party data flow | Small (docs) / Medium (self-host) | Medium |
| 5 | C-1 + C-2 Adapter duplication (Diamond≅Hexagonal; 14× chrome boilerplate) | Medium | Medium |
| 6 | E-1 Debug component markers stamped on production DOM by default | Small | Low-Medium |
| 7 | A-4 Permission changes don't refresh the public campaigns query | Small | Low-Medium |
| 8 | D-1 AdminPanel state extraction | Medium-Large | Medium (maintainability) |

---

## A. Correctness

### A-1: Public gallery listing is silently capped at 10 campaigns

**Context:** The public campaign fetch requests `/campaigns?include_media=1` with **no `per_page` and no page loop** ([App.tsx:240](../src/App.tsx#L240)). The controller defaults `per_page` to 10 (max 50) ([class-wpsg-campaign-controller.php:202](../wp-plugin/wp-super-gallery/includes/rest/class-wpsg-campaign-controller.php#L202)) and the response's `total`/`totalPages` fields are ignored by the caller. `CardGallery`'s host pagination only slices the client-side array, so any site (or space) with more than 10 campaigns silently shows exactly 10 — no error, no "load more". The admin panel is unaffected (its query layer passes `page`/`per_page` and even has a capped all-pages loop in `fetchAllCampaignOptions`).

**What to fix:** Either pass `per_page=50` and loop `totalPages` (mirroring [adminQuery.ts `fetchAllCampaignOptions`](../src/services/adminQuery.ts) — consider extracting that loop as a shared helper), or wire real server-side pagination into the CardGallery host-pagination path. Add a regression test with a >10-campaign fixture.

**Files:** [App.tsx](../src/App.tsx) (`fetchCampaigns`), [CardGallery.tsx](../src/components/CampaignGallery/CardGallery.tsx) (if server-driven paging is chosen).

**Effort:** Small-Medium | **Impact:** High — data-loss-shaped bug on any install with >10 campaigns per gallery.

---

### A-2: Anonymous stale-while-revalidate in the service worker is unreachable (cross-side)

**Context:** [sw.js](../public/sw.js) routes public metadata requests to a carefully built SWR cache (`META_CACHE`, TTL stamping, FIFO eviction) **only when** the request has no `X-WP-Nonce`/`Authorization` header. But PHP injects `restNonce => wp_create_nonce('wp_rest')` unconditionally — for anonymous visitors too ([class-wpsg-embed.php:71](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php#L71)) — and `HttpTransportImpl.buildAuthHeaders()` attaches the nonce whenever one exists. Result: **every** request from the app carries `X-WP-Nonce`, the `isAuthenticated` check in the SW is always true, and the entire anonymous SWR path (~100 lines: `handleMetaRequest`, `stampResponse`, `evictOldestMetaEntries`) never executes for the app's own traffic. Same failure pattern as PHP A-1/A-2: a well-built subsystem made inert by its gate. (For a logged-out visitor the nonce authenticates user 0 — it provides nothing.)

**What to fix:** Decide the authoritative signal and align both sides. Cleanest: `WpNonceProvider` knows whether a user session was actually detected — expose that, and have the transport skip the nonce header for anonymous sessions (public GET endpoints don't need it). Alternatively have PHP only inject `restNonce` when `is_user_logged_in()` (verify the login form flow still works — it sends the guest nonce today). Add an integration test asserting the SWR path is exercised for a logged-out fetch.

**Files:** [sw.js](../public/sw.js), [HttpTransportImpl.ts](../src/services/http/HttpTransportImpl.ts), [WpNonceProvider.ts](../src/services/auth/WpNonceProvider.ts), [class-wpsg-embed.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php). *Both-sides task.*

**Effort:** Small-Medium FE + Small PHP | **Impact:** Medium-High — restores the designed offline/latency benefit for exactly the audience it targets (anonymous public visitors), and stops sending a useless auth header on every public request.

---

### A-3: Campaign load progress indicator never shows intermediate progress

**Context:** `fetchCampaigns` sets `{ total: N, completed: 0 }` and then immediately `{ total: N, completed: N }` after a synchronous `items.map(...)` ([App.tsx:243-261](../src/App.tsx#L243-L261)). The `(completed/total processed)` copy in the loading alert ([App.tsx:439](../src/App.tsx#L439)) can therefore only ever display `0/N` for one frame or `N/N` — it's a progress bar over a synchronous loop.

**What to fix:** Remove the `campaignLoadProgress` state and the counter copy (the spinner already communicates loading), or make it real by keying it to actual async work (e.g. paginated fetches from A-1 — which would make a genuine progress signal for free).

**Files:** [App.tsx](../src/App.tsx).

**Effort:** Small | **Impact:** Low — dead state + misleading UI copy.

---

### A-4: Permission changes mid-session don't refresh the public campaigns query

**Context:** The campaigns query key includes `user?.id`, `isAuthenticated`, and the admin flag, but **not** `permissions` ([App.tsx:265-272](../src/App.tsx#L265-L272)) — while `fetchCampaigns` uses `permissions` to decide which campaigns' media to expose. If a viewer's grants change mid-session (e.g. an access request is approved elsewhere), the cached data keeps the old access mapping until a full reload or an unrelated key change. The server response itself is also permission-scoped, so this is stale-data, not a leak.

**What to fix:** Include a stable digest of `permissions` (e.g. sorted-join) in the query key, or invalidate the campaigns query wherever `permissions` state is refreshed in `AuthContext`.

**Files:** [App.tsx](../src/App.tsx), possibly [AuthContext.tsx](../src/contexts/AuthContext.tsx).

**Effort:** Small | **Impact:** Low-Medium — correctness of access-driven UI without reload.

---

### A-5: `handleResponse` assumes every 2xx body is JSON

**Context:** [HttpTransportImpl.ts:126-147](../src/services/http/HttpTransportImpl.ts#L126-L147) ends with `return response.json()` unconditionally. Endpoints typed `Promise<void>` (e.g. `deleteCampaignTemplate`) or any future 204/empty-body response would reject with a JSON parse error despite succeeding. Today the WP controllers appear to always return JSON bodies, so this is latent.

**What to fix:** Guard on `response.status === 204` / empty `content-length` (or catch the parse error for 2xx and return `undefined as T`). One-line hardening in one place, protects every domain module.

**Files:** [HttpTransportImpl.ts](../src/services/http/HttpTransportImpl.ts).

**Effort:** Small | **Impact:** Low — latent contract fragility.

---

## B. Security & Privacy Hardening

*(No exploitable issue was found; these are hardening/compliance items.)*

### B-1: Google Fonts are fetched client-side by public visitors — undocumented third-party data flow

**Context:** [loadGoogleFont.ts](../packages/shared-utils/src/loadGoogleFont.ts) injects `fonts.googleapis.com` stylesheet links at runtime when a typography setting selects a Google font — for **public gallery visitors**, not just admins. Each visitor's IP is disclosed to Google, which is exactly the fact pattern of the German LG München Google-Fonts ruling; GDPR-conscious site owners increasingly reject plugins that do this. `docs/PRIVACY.md` (just extended for the Freemius flow in P62-J) does not mention it.

**What to fix:** Minimum: document the flow in [PRIVACY.md](PRIVACY.md) (trigger condition, data disclosed, how to avoid it by using system/custom fonts). Better: add a self-host path — download the selected font files into WP uploads at settings-save time (server-side fetch, admin-initiated) and serve locally; fall back to the fallback stack when unavailable. *Both-sides task in the self-host variant.*

**Files:** [loadGoogleFont.ts](../packages/shared-utils/src/loadGoogleFont.ts), [PRIVACY.md](PRIVACY.md), typography settings UI, PHP settings sanitizer + font fetcher (self-host variant).

**Effort:** Small (docs only) / Medium (self-host) | **Impact:** Medium — compliance posture for the EU market; aligns with the existing Privacy & Compliance backlog section.

---

### B-2: `parseNodeConfig` skips the key-allowlist treatment `parseProps` gets

**Context:** At mount, `data-wpsg-props` is filtered through the `ALLOWED_PROPS` allowlist (P20-H-1), but `data-wpsg-config` is cast to `NodeConfig` unfiltered ([main.tsx:92-102](../src/main.tsx#L92-L102)). The attribute is PHP-generated, so risk is low — but the asymmetry is exactly the kind that erodes: anything that can set that attribute (page-builder plugins storing raw HTML, an XSS elsewhere) gets arbitrary keys/types into the mount config.

**What to fix:** Apply the same allowlist+type-check treatment (`spaceId` number, `theme` string, etc.) — a 10-line validator or a small zod schema (zod is already a dependency).

**Files:** [main.tsx](../src/main.tsx).

**Effort:** Small | **Impact:** Low — consistency of the mount-hardening boundary.

---

### B-3: ErrorBoundary shows raw `error.message` to public visitors

**Context:** The fallback renders `this.state.error?.message` to whoever is looking ([ErrorBoundary.tsx:58](../src/components/ErrorBoundary.tsx#L58)). Exception messages can carry internal details (URLs, state fragments). Sentry already receives the full error; end users don't need it.

**What to fix:** Show the generic translated copy by default; include the raw message only when the `wpsg_debug` flag ([utils/debug.ts](../src/utils/debug.ts)) is set or the viewer is an admin.

**Files:** [ErrorBoundary.tsx](../src/components/ErrorBoundary.tsx).

**Effort:** Small | **Impact:** Low — information-exposure hygiene.

---

### B-4: JWT provider's localStorage permissions cache never expires (opt-in path)

**Context:** `WpJwtProvider.getPermissions()` returns the cached `wpsg_permissions` localStorage entry forever — it is only cleared on logout ([WpJwtProvider.ts:123-131](../src/services/auth/WpJwtProvider.ts#L123-L131)). Revoked grants persist in the client UI until logout (server still enforces, so display-only). The whole provider is disabled by default (`WPSG_ENABLE_JWT_AUTH`) and its in-memory-token rework is already tracked in [FUTURE_TASKS.md](FUTURE_TASKS.md) § "JWT In-Memory Token Auth".

**What to fix:** Fold into the existing JWT rework task: add a TTL (or drop the cache — the permissions endpoint is cheap) when that item is executed. No standalone work needed now; recorded here so the review is complete.

**Files:** [WpJwtProvider.ts](../src/services/auth/WpJwtProvider.ts).

**Effort:** — (absorbed by existing task) | **Impact:** Low — disabled-by-default path, display-only staleness.

---

## C. Duplication & Abstraction

### C-1: `DiamondGallery` and `HexagonalGallery` are the same component with 5 constants changed

**Context:** [DiamondGallery.tsx](../src/components/Galleries/Adapters/diamond/DiamondGallery.tsx) (218 lines) and [HexagonalGallery.tsx](../src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx) (218 lines) differ only in: clip-path polygon, `V_OVERLAP` (0.5 vs 0.25), title icon, CSS scope string, and a few icon-size/badge-position magic numbers. Every future fix (the files' own comments show the non-`px` unit bug was already fixed twice, once per file) must be applied twice.

**What to fix:** Extract a `ClippedTileGridGallery` (in `Adapters/_shared/`) taking a config object `{ scope, clipPath, vOverlap, icon, badgeOffsets }`; each adapter file becomes a ~20-line registration wrapper. Snapshot tests already exist per adapter and will confirm no visual change.

**Files:** the two adapters + a new `_shared/ClippedTileGridGallery.tsx`.

**Effort:** Small-Medium | **Impact:** Medium — halves the maintenance surface for this adapter family and removes a proven drift vector.

---

### C-2: 14 adapters hand-roll the same chrome (heading, Lightbox wiring, common-settings resolve)

**Context:** Every gallery adapter repeats: `resolveGalleryComponentCommonSettings` + `resolveGalleryHeading` + the `heading.visible && <Title …><Group…>{icon}{label}` block, the `<Lightbox>` element with the same 9 settings props, the `openAt`/`close` carousel-lightbox callbacks, and `resolveAdapterShellStyle` + padding-clamp. Three adapters additionally hand-roll a `ResizeObserver` container-width hook. The `_shared/` module is a good start but stops at style helpers.

**What to fix:** Add to `_shared/`:
- `<AdapterHeading common={…} icon={…} label={…} />` (or fold into a `useAdapterChrome(settings, runtime)` hook returning `{ common, heading, shellStyle }`),
- `<AdapterLightbox settings media …/>` that owns the 9-prop mapping once,
- `useContainerWidth(ref)` (or adopt `useElementSize` from `@mantine/hooks`, already a dependency) replacing the three hand-rolled `ResizeObserver` effects.
Migrate adapters incrementally — each is a mechanical ~30-line diet with snapshot coverage.

**Files:** [Adapters/_shared/](../src/components/Galleries/Adapters/_shared/), all 14 adapter components.

**Effort:** Medium | **Impact:** Medium — one place to change lightbox behavior/heading a11y instead of 14; shrinks every adapter.

---

### C-3: Nonce refresh logic exists in three copies

**Context:** "GET the nonce endpoint with the current nonce, write the result to both window globals" is implemented in (1) `HttpTransportImpl.refreshNonce()` ([HttpTransportImpl.ts:153-174](../src/services/http/HttpTransportImpl.ts#L153-L174)), (2) `useNonceHeartbeat`'s inline `refresh()` which also re-reads/re-writes the globals directly instead of using the `getWpNonce`/`setWpNonce` helpers ([useNonceHeartbeat.ts:36-67](../src/hooks/useNonceHeartbeat.ts#L36-L67)), and (3) the helpers themselves in [wpNonce.ts](../src/services/wpNonce.ts) that (2) bypasses. The P51-D decoupling explicitly made `wpNonce.ts` "the single place" for the globals — the heartbeat predates it and was never migrated.

**What to fix:** Add `fetchFreshNonce(apiBase): Promise<string | null>` to `wpNonce.ts`; have the heartbeat call it + `setWpNonce`, and have the transport's `refreshNonce` delegate to it via its injected callbacks (or accept it as `ApiClientOptions.refreshNonce`).

**Files:** [wpNonce.ts](../src/services/wpNonce.ts), [useNonceHeartbeat.ts](../src/hooks/useNonceHeartbeat.ts), [HttpTransportImpl.ts](../src/services/http/HttpTransportImpl.ts).

**Effort:** Small | **Impact:** Low-Medium — closes an already-materialized drift (the heartbeat violates the P51-D seam).

---

### C-4: Gallery-config utilities split across two overlapping modules

**Context:** [utils/galleryConfig.ts](../src/utils/galleryConfig.ts) (503 lines) and [components/Common/galleryConfigUtils.ts](../src/components/Common/galleryConfigUtils.ts) (484 lines) both own gallery-config scope/breakpoint logic; `GALLERY_BREAKPOINTS` is defined **in both** (galleryConfig.ts:20, galleryConfigUtils.ts:18), the legacy viewport-background field map lives in one and is imported by the other, and the editor-side module reaches back into the utils module. The boundary ("pure config transforms" vs "editor helpers") is real but the constants/types are duplicated across it.

**What to fix:** Move shared constants/types (`GALLERY_BREAKPOINTS`, scope types) to a single home (utils or `@/types`), re-export from the editor module, and document the intended split at the top of each file. Optionally merge outright if the editor helpers have no non-editor consumers.

**Files:** [utils/galleryConfig.ts](../src/utils/galleryConfig.ts), [components/Common/galleryConfigUtils.ts](../src/components/Common/galleryConfigUtils.ts).

**Effort:** Small-Medium | **Impact:** Low-Medium — removes a two-headed source of truth on a hot config path.

---

### C-5: `ApiClient` facade is ~300 lines of hand-written one-line delegations

**Context:** [apiClient.ts](../src/services/apiClient.ts) forwards ~70 methods to the domain modules verbatim to preserve the pre-P32-C surface. Every new endpoint costs three edits (domain module, facade method, type re-export) and the facade adds no behavior.

**What to fix:** Expose the domain modules as public readonly namespaces (`client.campaigns.duplicate(…)`, `client.webhooks.list(…)`) and migrate call sites incrementally (mechanical codemod), keeping the flat methods as deprecated shims until callers are gone. Not urgent — pure maintenance economics.

**Files:** [apiClient.ts](../src/services/apiClient.ts) + call sites over time.

**Effort:** Medium (mostly mechanical) | **Impact:** Low-Medium — removes a standing three-edit tax on every endpoint addition.

---

### C-6: `useLayoutBuilderState` — 17 one-line template-field setters

**Context:** [useLayoutBuilderState.ts:384-475](../src/hooks/useLayoutBuilderState.ts#L384-L475) defines seventeen `useCallback`s of the shape `mutate((d) => { d.<field> = v; }, '<label>')` (name, aspect ratio, all background/gradient fields, canvas height…). Each new template field adds ~5 lines of hook + ~2 lines of interface.

**What to fix:** Replace with one generic `setTemplateField<K extends keyof LayoutTemplate>(key: K, value: LayoutTemplate[K], label: string)` (plus a small label map), keeping thin named wrappers only where clamping logic exists (`setCanvasHeightVh`). Cuts ~120 lines and the matching interface entries without changing behavior or history labels.

**Files:** [useLayoutBuilderState.ts](../src/hooks/useLayoutBuilderState.ts) + the panels calling the setters.

**Effort:** Small | **Impact:** Low — boilerplate reduction on the file most future builder work touches.

---

## D. Structure & Large Files

*(Nothing here is broken — these are maintainability investments, ordered by expected payoff. The builder state hook was reviewed and is already well-decomposed; it is deliberately **not** listed.)*

### D-1: `AdminPanel.tsx` — ~1,000 lines, ~30 `useState` hooks in one component

**Context:** [AdminPanel.tsx](../src/components/Admin/AdminPanel.tsx) already lazy-loads its 16 modals, but the component body holds every tab's state (media/access/audit selection, filters, five separate `*ZipExporting` flags), the ZIP export/import handlers, prefetch orchestration, and cross-tab wiring. Any change to one tab risks touching shared render scope, and the whole panel re-renders on any of the ~30 state atoms.

**What to fix:** Extract per-concern hooks mirroring the existing pattern (`useAdminCampaignActions` already exists): `useAdminZipTransfers` (the three export/import handler pairs + flags), `useAuditTabState`, `useAccessTabState`, `useMediaTabState`. Pure state/handler moves — no behavior change, each independently testable.

**Files:** [AdminPanel.tsx](../src/components/Admin/AdminPanel.tsx) + new hooks under `src/hooks/`.

**Effort:** Medium-Large | **Impact:** Medium — the highest-churn admin file becomes navigable; fewer accidental cross-tab re-renders.

---

### D-2: `types/index.ts` — 1,811-line single-file type barrel

**Context:** [types/index.ts](../src/types/index.ts) holds ~74 exported types/consts spanning unrelated domains (campaign, media, layout template, gallery settings, analytics, access). Everything imports from `@/types`, so any edit invalidates a very wide TS graph, and finding a type means scrolling.

**What to fix:** Split into `types/campaign.ts`, `types/media.ts`, `types/layoutTemplate.ts`, `types/gallerySettings.ts`, etc., re-exported from `types/index.ts` so **zero import sites change**. Mechanical; do it in one PR to avoid drift.

**Files:** [types/index.ts](../src/types/index.ts).

**Effort:** Medium (mechanical) | **Impact:** Low-Medium — navigability + marginally better incremental type-check times.

---

### D-3: Remaining 900+-line components — split along already-visible seams

**Context:** Several components sit near or above 900 lines with internal sub-components already defined inline: [MediaCarouselAdapter.tsx](../src/components/Galleries/Adapters/MediaCarouselAdapter.tsx) (874 — contains `MediaCarouselInner` **and** `CampaignListingCarousel` plus six module-level helpers), [UnifiedCampaignModal.tsx](../src/components/Campaign/UnifiedCampaignModal.tsx) (926 — contains `MediaTabContent` and four helpers), [GalleryConfigEditorModal.tsx](../src/components/Common/GalleryConfigEditorModal.tsx) (916), [LayoutCanvas.tsx](../src/components/Admin/LayoutBuilder/LayoutCanvas.tsx) (1,036), [LayoutSlotComponent.tsx](../src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx) (993), [SlotPropertiesPanel.tsx](../src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx) (938).

**What to fix:** Promote the inline sub-components to sibling files (the seams already exist — this is file moves plus prop-type exports, not redesign). Target: no file over ~600 lines. Do opportunistically as each file is next touched rather than as a big-bang.

**Files:** as listed.

**Effort:** Small per file, Medium overall | **Impact:** Medium (maintainability) — review diffs and code navigation improve where the codebase is densest.

---

## E. Efficiency (no functionality risk)

### E-1: Debug component markers are stamped onto production DOM by default (cross-side)

**Context:** `getWpsgDebugProps()` falls back to `window.__WPSG_CONFIG__?.debugComponentMarkers`, and PHP defaults that setting to **true** ([class-wpsg-embed.php:66](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php#L66)). So every production install renders `data-wpsg-component`/`data-wpsg-slot` attributes on every tile, row, and panel of every gallery — payload and DOM-size overhead on the public path, per-render helper calls included, for a debugging aid.

**What to fix:** Flip the PHP default to `false` (the admin toggle and the `wpsg_debug_component_markers` filter stay as the opt-in). One-line PHP change + settings-default migration note. *Both-sides task (trivial FE impact).*

**Files:** [class-wpsg-embed.php](../wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php), settings defaults; no FE code change needed.

**Effort:** Small | **Impact:** Low-Medium — leaner public DOM by default.

---

### E-2: Reconnect triggers a double refetch of campaigns

**Context:** The campaigns query sets `refetchOnReconnect: true` **and** a manual effect refetches when `isOnline` flips true ([App.tsx:291](../src/App.tsx#L291)) — two refetches per reconnect (React Query's own online-manager plus the `useOnlineStatus` effect). The manual effect also fires once on every mount.

**What to fix:** Drop the manual effect and rely on `refetchOnReconnect` (or vice-versa if the custom online hook is the trusted signal — pick one).

**Files:** [App.tsx](../src/App.tsx).

**Effort:** Small | **Impact:** Low — removes a duplicate network round-trip on flaky connections.

---

### E-3: `useUpdateSettings` sets fresh data then immediately invalidates it

**Context:** `onSuccess` writes the normalized response into the cache and then `invalidateQueries({ queryKey: SETTINGS_QUERY_KEY })` ([settingsQuery.ts:76-79](../src/services/settingsQuery.ts#L76-L79)) — invalidating the very entry just written (plus all other spaces' settings), scheduling refetches of data the server just returned.

**What to fix:** Invalidate only sibling keys (other spaces) if that's the intent, or skip invalidation entirely since the canonical response was just written. One-line scoping.

**Files:** [settingsQuery.ts](../src/services/settingsQuery.ts).

**Effort:** Small | **Impact:** Low — avoids redundant settings refetches after every save.

---

### E-4: Per-render `AssetsApi` construction in the global-asset mutation hooks

**Context:** `useUploadGlobalAsset` / `useUpdateGlobalAsset` / `useDeleteGlobalAsset` each do `new AssetsApi(apiClient)` in the hook body ([adminQuery.ts:850-880](../src/services/adminQuery.ts#L850-L880)) — a new instance every render, and the `mutationFn` closes over the stale-most one. Harmless today (the class is stateless), but it's the only place in the query layer that constructs per render.

**What to fix:** `useMemo(() => new AssetsApi(apiClient), [apiClient])`, matching how everything else treats `apiClient`.

**Files:** [adminQuery.ts](../src/services/adminQuery.ts).

**Effort:** Small | **Impact:** Low — consistency; removes a footgun if `AssetsApi` ever gains state.

---

### E-5: Runtime SW cache is cache-first with no revalidation for same-origin static assets

**Context:** The default branch of the SW fetch handler serves same-origin non-hashed GETs (fonts, upload-dir images) cache-first forever — an entry is only replaced when `CACHE_VERSION` bumps ([sw.js:119-143](../public/sw.js#L119-L143)). WP media that is edited/regenerated **under the same URL** (image editor, thumbnail regeneration plugins) will render stale indefinitely for returning visitors.

**What to fix:** Give the runtime cache the same SWR treatment as the metadata cache (serve cached, revalidate in background), or scope cache-first to font/static paths and let `/wp-content/uploads/` revalidate. Reuse `stampResponse`/TTL from the meta path.

**Files:** [sw.js](../public/sw.js).

**Effort:** Small-Medium | **Impact:** Low — correctness of long-lived clients after media edits; rare but confusing when hit.

---

## F. i18n & UX Consistency

### F-1: User-facing strings in notification calls bypass i18n (regression vs the P60/61 milestone)

**Context:** FUTURE_TASKS marks the admin-panel i18n migration ✅ resolved, and `eslint-plugin-i18next` guards **JSX text** — but strings passed to `notifications.show()` / `showNotification()` in plain `.ts` hooks escape the rule. A sweep finds hardcoded English in at least: [useMediaExternal.ts](../src/hooks/useMediaExternal.ts) (5 toasts), [useLayoutBuilderAssets.ts](../src/hooks/useLayoutBuilderAssets.ts) (4), [useLayoutBuilderFileIO.ts](../src/hooks/useLayoutBuilderFileIO.ts) (4), [useBroadcastStaleness.ts](../src/hooks/useBroadcastStaleness.ts), [useGalleryAdapterSettingsIO.ts](../src/hooks/useGalleryAdapterSettingsIO.ts), [useMediaUpload.ts](../src/hooks/useMediaUpload.ts) (2), [SettingsPanel.tsx](../src/components/Admin/SettingsPanel.tsx) (draft-restore toasts) — plus non-toast literals in [App.tsx](../src/App.tsx) (`'Session expired. Please sign in again.'` L215, `title="Sign in"` L358, `Loading campaigns...` L439). The pattern used in `wpsgUpsell.tsx` (route through the shared `i18n` instance) is the established fix.

**What to fix:** Sweep all `notifications.show`/`showNotification` call sites and the App.tsx literals into `i18n.t(key, fallback)` with keys added to `i18n-strings.en.json` (the generator script keeps PHP in sync). Then close the lint gap: enable the plugin's non-JSX string rules for `src/hooks/**` or add a lightweight custom rule/grep CI check for string literals inside notification-call arguments.

**Files:** the hooks listed, [App.tsx](../src/App.tsx), [i18n-strings.en.json](../src/i18n-strings.en.json), [eslint.config.js](../eslint.config.js).

**Effort:** Medium | **Impact:** Medium — restores the "fully localizable" property P60/61 shipped; the lint extension prevents re-regression.

---

## G. Cross-Side Coordination (PHP review overlap)

These items live primarily in [PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md) but need front-end work when executed; recorded here so neither side is scheduled alone.

- **PHP A-14 — split revoke granularity (campaign-scoped vs company-wide):** the decided UX needs FE changes in the access tab/rows (`useAccessRows`, access mutation calls) alongside the PHP endpoint split. *(Small-Medium FE, per the PHP doc.)*
- **PHP A-3 — analytics `space_id` stamping:** the FE already passes `spaceId` to `getAnalyticsSummary` and gates the space filter UI; once PHP stamps `space_id` on events, verify the dashboard's space-filtered views against real data and remove any FE workaround if one was added.
- **A-2 (this doc) — anonymous nonce / SW SWR:** both-sides item, listed above.
- **B-1 (this doc) — Google Fonts self-host variant:** both-sides item, listed above.
- **E-1 (this doc) — debug markers default:** PHP one-liner, listed above.

---

*Created: July 13, 2026 — full React front-end review on `feat/phase62-monetization-licensing` (v0.90.0), companion to the same-day PHP review. `tsc`/`eslint` clean at review time.*
