# Phase 54 - Production Hardening

**Status:** Complete
**Created:** 2026-06-17
**Last updated:** 2026-06-17

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P54-A | Security hardening pass — audit free-form CSS fields, DOMPurify allowlist, localStorage; run `/security-review` | **Done** | Small-Medium |
| P54-B | User-facing i18n harvest — front-end strings → `t()`; scope the i18next lint rule on for front-end dirs | **Done** | Medium |
| P54-C | Front-end accessibility baseline — axe pass on gallery / Lightbox / auth; fix critical+serious | **Done** | Medium |
| P54-D | LayoutBuilder robustness — error boundary, drag bounds clamping, large-layout perf check | **Done** | Small-Medium |
| P54-E | Release-readiness closeout — suites green, bundle budget, `build:wp`, version bump | **Done** | Small |
| P54-F | SpaceSwitcher regression — dropdown broken after P54-B; hook removed from `forwardRef` trigger and `SpaceSwitcher`, imperative `i18n.t()` used instead | **Done** | XS |

---

## Rationale

The plugin is "just around the corner from production." Phase 54 is a deliberate **production-readiness pass, not a feature push**. A three-angle review (gallery + adapters; LayoutBuilder; overall React/UI + security/testing) confirmed the architecture is mature and the audited areas are fundamentally sound — so this phase is intentionally **tight: must-fix blockers only**. Everything that is an *enhancement* rather than a *blocker* — including the gallery-control additions and the LayoutBuilder feature work — is captured in `docs/FUTURE_TASKS.md`, ordered, ready to promote into Phase 55+.

1. **What triggered it.** The review surfaced a small set of genuine pre-production gaps (free-form CSS sanitization to verify, no front-end i18n harvest, no a11y audit, LayoutBuilder lacks an error boundary / drag-bounds clamp) against an otherwise solid codebase.
2. **Why it belongs together.** Each track is a launch gate; none is a new capability. Grouping them gives one green-light checklist for "ready to ship."
3. **Success.** A build that passes a security pass, has translatable user-facing strings, no critical/serious a11y violations on the public surface, a LayoutBuilder that fails safe, and a documented release checklist — for whichever distribution target is chosen (see *Production Target & Monetization*).

### Review findings (the audit the review produced; fixes are deferred, not in P54)

- **Adapters — pattern is correct.** Registry + Factory + Strategy (`src/components/Galleries/Adapters/adapterRegistry.ts`, `GalleryAdapter.ts`): 14 adapters behind one `GalleryAdapterProps` contract, lazy-loaded, metadata-driven settings UI. Best-practice tensions worth recording (deferred): (1) `GalleryAdapterId` is a **closed union**, which fights the runtime `registerAdapter()` seam — third parties can't extend the type, so the seam is effectively internal-only; either document it as such or widen the type. (2) `SETTING_GROUP_DEFINITIONS` (~1000 lines of *data*) lives inside `adapterRegistry.ts` — extract to data modules. (3) The **dual field-map** (TS camelCase ↔ PHP snake_case in `class-wpsg-settings-sanitizer.php`) is a single-source-of-truth violation — generate one from the other.
- **Gallery setup — layering is sound.** Clean 3-layer merge: hardcoded `DEFAULT_GALLERY_BEHAVIOR_SETTINGS` → admin `wpsg_settings` → per-campaign `galleryOverrides`, via `src/utils/mergeSettingsWithDefaults.ts` + `src/utils/galleryConfig.ts` (careful structural sharing). Control gaps are **sensible additions, not blockers**: no client-side range/enum validation (server-only today), hardcoded breakpoint pixel thresholds, listing-mode `renderItem` not admin-configurable, implicit mobile-support restrictions.
- **LayoutBuilder — mature.** Undo/redo (50-deep), hierarchical groups, snapping/smart guides, ~25 keyboard shortcuts, auto-save + draft recovery, device preview. Robustness gaps (P54-D) are the only must-fix; the enhancement backlog feeds four FUTURE_TASKS entries.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Report shape | **Tight, must-fix only.** Enhancements (gallery control, all four LayoutBuilder categories, adapter/clean-code cleanups) go to `docs/FUTURE_TASKS.md`, not into P54 tracks. (User direction, 2026-06-17.) |
| B | i18n scope for v1 | **User-facing strings only.** Harvest front-end (gallery adapters, Lightbox, AuthBar, `shared-ui`) into `t()`; defer the admin panel. Scope the i18next lint rule `'error'` for front-end dirs only. (User direction, 2026-06-17.) |
| C | Production target | **Undecided — kept target-independent.** The P54 must-fix bar is the common prerequisite for every distribution path; target-specific extras (full admin i18n, full WCAG AA, licensing infra) are parked in FUTURE_TASKS and activate only once a path is chosen. Decision support: `docs/MONETIZATION_OPTIONS.md`. |
| D | Security scope | **Audit-and-close, not rebuild.** The PHP sanitizer already validates colors (`is_valid_css_color`) and structured gradients (`sanitize_viewer_bg_gradient`); P54-A only verifies the remaining free-form CSS fields and the DOMPurify allowlist rather than re-doing solved work. |

## Execution Priority

1. **P54-A (security)** — highest risk; gates any production target.
2. **P54-D (LayoutBuilder robustness)** — small, self-contained, removes a fail-ugly path.
3. **P54-C (a11y baseline)** — public-surface gate; some fixes may overlap with B's markup edits.
4. **P54-B (i18n harvest)** — largest mechanical effort; do after C so a11y markup changes don't re-touch harvested strings.
5. **P54-E (closeout)** — last; validates the whole.

---

## Track P54-A - Security hardening pass

### Problem

The review found the security posture is already strong (DOMPurify, nonce handling with 403-refresh retry, Zod validation, online guards) but left a few items to **verify and close**:

- **Free-form CSS string fields.** Most settings are well-validated, but fields like `image_shadow_custom` / `video_shadow_custom` (custom `box-shadow` CSS) and `masonry_auto_column_breakpoints` flow through the generic `sanitize_text_field` path (`class-wpsg-settings-sanitizer.php`), which strips tags but **not** CSS metacharacters (`}` `;` `:`). This is only exploitable if such a value is reflected into a **concatenated stylesheet string** (e.g. a generated `<style>` block) rather than a React inline-style object (where the DOM style API neutralizes breakout). The consumption path must be verified.
- **DOMPurify allowlist.** `src/components/Admin/MediaAddModal.tsx:351` is the **only** `dangerouslySetInnerHTML` in the codebase; its config allows `iframe` + a provider URL allowlist (YouTube/Vimeo/Rumble/Dailymotion/Wistia). Needs a confirmation pass that the allowlist is exactly the intended providers and that no attribute (`srcdoc`, event handlers) slips through.
- **localStorage.** ~15 write points (theme, drafts, prefs). Confirm none store tokens/credentials unprotected; JWT path stores tokens in localStorage only under the opt-in `enableJwt` flag — confirm the default nonce path stores nothing sensitive.

### Fix

- Trace each free-form CSS field from the sanitizer to its front-end render site. Where a value lands in a concatenated CSS/stylesheet string, constrain it (property allowlist or escape `;{}`) — mirror the existing `is_valid_css_color` approach. Where it lands only in a React inline-style object, document it as safe (no change).
- Verify and, if needed, tighten the `MediaAddModal` DOMPurify config (explicit `ALLOWED_ATTR`, forbid event-handler attributes).
- Produce a short localStorage inventory (key → contents → sensitivity) and remediate any sensitive value.
- Run the `/security-review` skill on the branch and triage every high/critical.

### Acceptance criteria

- No free-form value can break out of its CSS context at any render site (verified or constrained).
- DOMPurify config documented and confirmed to permit only intended providers/attributes.
- localStorage inventory recorded in this report; no unprotected sensitive data.
- `/security-review` shows no unaddressed high/critical findings.

### Validation

- New PHPUnit cases in the sanitizer suite for the free-form fields (malicious `}`/`;` payloads rejected/escaped). PHP test execution delegated to a Haiku subagent.
- `vitest` for any front-end consumption-path change.
- `/security-review` run + triage notes.

### Implementation notes

**Free-form CSS fields — consumption path verified (2026-06-17)**

Both `image_shadow_custom` and `video_shadow_custom` flow through:
`adapterSettings.imageShadowCustom` → `resolveBoxShadow()` → React inline `style.boxShadow` (MediaCarouselAdapter.tsx). The DOM style setter is a structured API; it does not interpret CSS breakout sequences (`}`, `;`), so these fields carry **no stylesheet-injection risk** on the front end. The PHP sanitizer now adds a defence-in-depth layer (`is_safe_css_box_shadow()`) that rejects values containing `;`, `{`, `}`, `url(`, `expression(`, or `@import`.

`masonry_auto_column_breakpoints` is split by `,` and `:` and parsed with `Number()` in `resolveColumnsFromWidth.ts` — no CSS path; no code change needed.

**DOMPurify — `MediaAddModal.tsx:351` (2026-06-17)**

Config updated from `ADD_ATTR` to explicit `ALLOWED_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src', 'title', 'width', 'height']`. This prevents event-handler attributes from slipping through regardless of DOMPurify default-list changes. Provider allowlist (YouTube, Vimeo, Rumble, Dailymotion, Wistia) and HTTPS-only `ALLOWED_URI_REGEXP` unchanged — confirmed correct.

**localStorage inventory (2026-06-17)**

All write points traced in `src/services/auth/WpJwtProvider.ts`, `src/hooks/useLayoutBuilderState.ts`, `src/hooks/useMediaTab.ts`, and `src/hooks/useAdminNavigation.ts`:

| Key pattern | Content | Sensitivity |
|-------------|---------|-------------|
| `wpsg_access_token` | JWT bearer token | **High** — gated by `[WPSG_JWT_DISABLED]`; inactive by default |
| `wpsg_user` | `{id, email, role}` JSON | **High** — gated by `[WPSG_JWT_DISABLED]`; inactive |
| `wpsg_permissions` | `['campaignId', …]` array | **High** — gated by `[WPSG_JWT_DISABLED]`; inactive |
| `wpsg_admin_shortcuts` | Keyboard shortcut overrides | Low — config only |
| `wpsg_admin_active_tab` | Last admin tab viewed | Low — UI state |
| `wpsg_view_${rootId}_scroll_${view}` | Window scroll Y position | Low — UI state |
| `wpsg_builder_${rootId}_layout` | GoldenLayout panel state | Low — UI layout |
| `wpsg_builder_${rootId}_design_assets_open` | Boolean panel toggle | Low — UI state |
| `wpsg_media_viewMode_${layoutId}` | 'compact' or 'list' | Low — UI preference |
| `wpsg_media_sortMode_${layoutId}` | Sort column name | Low — UI preference |

**Finding**: No sensitive data is stored outside the `[WPSG_JWT_DISABLED]` gate. The JWT auth path is disabled by default (requires `WPSG_ENABLE_JWT_AUTH` constant in `wp-config.php`). If JWT auth is enabled in future, tokens should move to `httpOnly; Secure; SameSite=Strict` cookies. This is captured in FUTURE_TASKS.md.

**PHPUnit results (2026-06-17)**

`WPSG_P54A_Security_Test` — 12/12 tests passed (green). `WPSG_Settings_Test`, `WPSG_Settings_Extended_Test` — no regressions.

## Track P54-B - User-facing i18n harvest

### Problem

~300 raw JSX string literals are unharvested and the `i18next/no-literal-string` rule is `'off'` globally (`eslint.config.js:82`). The i18n runtime is already wired (`src/i18n.ts`, `wpsg` namespace, strings injected via `window.__WPSG_I18N__`). For v1, user-facing strings should be translatable; the admin panel can wait.

### Fix

- Harvest **front-end** strings into `t()` under the `wpsg` namespace: gallery adapters (`src/components/Galleries/Adapters/`), the Lightbox and auth surfaces (`packages/shared-ui/src/` — `Lightbox.tsx`, `AuthBar*.tsx`, `LoginForm.tsx`, `SpaceSwitcher.tsx`, `KeyboardHintOverlay.tsx`), and other public-facing components.
- Leave admin-panel strings deferred (FUTURE_TASKS — full migration).
- Scope the i18next lint rule to `'error'` for the front-end directories only (admin stays `'off'`) so regressions are caught where it matters. Update the string source / `.pot` accordingly.

### Acceptance criteria

- All identified front-end components render via `t()` with sensible keys.
- `eslint` passes with `i18next/no-literal-string` set to `'error'` for the front-end dir scope.
- String source / `.pot` updated; English fallback unchanged.

### Validation

- `eslint` (scoped rule green), `vitest` (no snapshot/string regressions).
- Manual smoke: inject a non-English `window.__WPSG_I18N__.strings` subset and confirm the gallery/Lightbox/auth UI translate.

### Implementation notes

**Scope and approach (2026-06-23)**

Harvested all user-facing JSX string literals from 20 front-end files into `t()` calls under the `wpsg` i18next namespace. Admin panel strings remain deferred per Decision B.

**Files modified:**

| File | String count |
|------|-------------|
| `packages/shared-ui/src/AuthBarFloating.tsx` | 15 |
| `packages/shared-ui/src/AuthBarMinimal.tsx` | 7 |
| `packages/shared-ui/src/LoginForm.tsx` | 12 |
| `packages/shared-ui/src/Lightbox.tsx` | 7 |
| `packages/shared-ui/src/KeyboardHintOverlay.tsx` | 6 |
| `packages/shared-ui/src/SpaceSwitcher.tsx` | 2 |
| `src/components/Galleries/Adapters/MediaCarouselAdapter.tsx` | 13 |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | 4 |
| `src/components/Galleries/Adapters/circular/CircularGallery.tsx` | 3 |
| `src/components/Galleries/Adapters/coverflow/CoverflowAdapter.tsx` | 2 |
| `src/components/Galleries/Adapters/diamond/DiamondGallery.tsx` | 3 |
| `src/components/Galleries/Adapters/hexagonal/HexagonalGallery.tsx` | 3 |
| `src/components/Galleries/Adapters/isotope/IsotopeAdapter.tsx` | 8 |
| `src/components/Galleries/Adapters/justified/JustifiedGallery.tsx` | 1 |
| `src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx` | 14 |
| `src/components/Galleries/Adapters/masonry/MasonryGallery.tsx` | 1 |
| `src/components/Galleries/Adapters/pinterest/PinterestAdapter.tsx` | 2 |
| `src/components/Galleries/Adapters/scroll-snap/ScrollSnapGallery.tsx` | 3 |
| `src/components/Galleries/Adapters/spotlight/SpotlightGallery.tsx` | 2 |
| `src/components/Galleries/Adapters/stacked/StackedDeckAdapter.tsx` | 2 |

**English defaults (2026-06-23)**

`src/i18n-strings.en.json` — 68 translation keys covering auth, login, lightbox, keyboard hint, gallery badges, carousel, filter/sort, and layout builder strings. Loaded as the `en` resource in `src/i18n.ts` so the UI shows correct English text in standalone/Storybook/test mode even without PHP injection. PHP-injected strings for the active locale override the defaults at runtime.

**ESLint rule (2026-06-23)**

`eslint.config.js` — added a scoped override for `src/components/Galleries/Adapters/**` and `packages/shared-ui/src/**` that sets `i18next/no-literal-string: ['error', { markupOnly: true }]`. The `markupOnly: true` option catches JSX text content regressions (the most common case) without producing noise from non-translatable attribute values. The global `src/**` block remains `'off'` to keep admin panel strings unblocked.

**react-i18next peer dep (2026-06-23)**

Added `react-i18next: >=13` as a peer dependency to `packages/shared-ui/package.json` so the package correctly declares its runtime requirement on the host app's i18next instance.

**Test setup (2026-06-23)**

`src/test/setup.ts` — added `import '../i18n'` so the English defaults are initialized before any test renders a component that calls `useTranslation`. Without this, `t()` returned keys instead of English strings, breaking 9 existing tests.

**vitest results (2026-06-23)**

3124/3124 green after the setup fix. `tsc --noEmit` and `eslint` (scoped rule) both pass cleanly.

## Track P54-C - Front-end accessibility baseline

### Problem

No a11y audit exists. The gallery and Lightbox are the public-facing surface, and Shadow-DOM exposure to assistive tech is unverified. Mantine gives a baseline (484 aria/role/tabindex usages found) but nothing is measured.

### Fix

- Run `axe-core` against the core front-end flows: gallery rendering (a representative set of adapters), Lightbox open/navigate/close, and the auth/login flow.
- Fix **critical and serious** violations: focus order, missing aria-labels, keyboard traps, color contrast on shipped themes, and landmark roles where missing.
- If inexpensive, wire the axe pass into the existing Playwright config (`playwright.config.ts`) so it stays enforced.

### Acceptance criteria

- Zero **critical** or **serious** axe violations on gallery, Lightbox, and auth flows.
- Lightbox is fully keyboard-operable; focus is trapped within it while open and restored on close.

### Validation

- `axe-core` run (ideally as a Playwright check), manual keyboard-only pass, and a screen-reader spot-check of the Lightbox.

### Implementation notes

**Code review findings and fixes (2026-06-17)**

Manual static analysis of the four public surfaces (`Lightbox`, `MediaCarouselAdapter`/`CampaignListingCarousel`, `OverlayArrows`, `KeyboardHintOverlay`, `AuthBar*`, `LoginForm`) against WCAG 2.1 AA and WAI-ARIA authoring patterns. The existing baseline was already strong — `Lightbox` had `role="dialog"`, `aria-modal`, `<FocusTrap>`, focus-on-open, focus-restore-on-close, Escape/arrow-key handling, and labelled close/prev/next buttons; `MediaCarouselAdapter` had `role="region"`, `aria-roledescription="carousel"`, per-slide `role="group"` labels, keyboard `onKeyDown`, and explicit arrow labels. Four specific gaps were found and fixed:

| Finding | Severity | File | Fix |
|---------|----------|------|-----|
| `KeyboardHintOverlay` inside lightbox `<FocusTrap>` had no `aria-hidden` — screen readers would read decorative `<Kbd>` elements | Serious | `KeyboardHintOverlay.tsx` | Added `aria-hidden="true"` to outer `Box` |
| Lightbox position counter (`1 / 5`) not announced on keyboard navigation — no live region | Serious | `Lightbox.tsx` | Added `aria-live="polite" aria-atomic="true"` to counter `<Text>` |
| `OverlayArrows` buttons remain in tab order when opacity:0 (auto-hide mode) — keyboard users Tab to invisible controls | Moderate | `OverlayArrows.tsx` | Added `tabIndex={visible ? 0 : -1}` and `aria-hidden={!visible}` to both buttons |
| `CampaignListingCarousel` outer container had no `role="region"` or label — carousel pattern incomplete | Moderate | `MediaCarouselAdapter.tsx` | Added `role="region" aria-label="Campaign listing"` |

**Items confirmed sound (no changes):**
- `LoginForm` — Mantine `TextInput`/`PasswordInput` supply `<label>` + `required`; error `Alert` has `role="alert" aria-live="assertive"`.
- `AuthBarMinimal` — `<nav aria-label="User navigation">`, all interactive icons labelled, decorative icon has `aria-hidden`.
- `AuthBarFloating` — Trigger has `aria-label="Admin menu"`; campaign action buttons have campaign-title-qualified labels.
- `DotNavigator` — `role="tablist" aria-label="Slide navigation"` container; each dot is `role="tab" aria-selected aria-label="Go to slide N"` with 44 px min hit target; ellipsis spans are `aria-hidden`.
- `OverlayArrows` — already had distinct `previousLabel`/`nextLabel` props threaded from each adapter.

**Axe Playwright spec (2026-06-17)**

`@axe-core/playwright` installed as dev dependency. `e2e/accessibility.spec.ts` added with four tests:
1. **Gallery listing** — mocked campaign API, renders `CardGallery`, runs axe filtered to `impact: critical | serious`.
2. **Login modal** — JWT mode, unauthenticated; opens sign-in modal via auth bar, runs axe scoped to `[role="dialog"]`.
3. **Campaign carousel** — mocked campaign + image media, opens campaign detail, runs axe once the carousel region is visible.
4. **Lightbox** — same mock; clicks "Open lightbox" button, waits for `role="dialog" aria-label="Media lightbox"`, runs axe scoped to the dialog.

All four tests filter to `criticalViolations` (impact critical or serious) so the spec stays green against Mantine's own internal patterns while catching real regressions.

**vitest results (2026-06-17)**

3124/3124 green after all four fixes; no regressions in `OverlayArrows.test.tsx` or `Lightbox.test.tsx`.

## Track P54-D - LayoutBuilder robustness

### Problem

The LayoutBuilder is mature but has three fail-ugly gaps: (1) no error boundary — a thrown render error blanks the editor with no recovery; (2) direct-canvas drag can push a slot past the 0–100% bounds (only keyboard nudge clamps today) in `LayoutCanvas` / `useLayoutBuilderState`; (3) performance at 50–100 slots is unverified.

### Fix

- Wrap the `LayoutBuilderModal` body in an error boundary with a recovery action (reload editor / discard-to-last-save), reusing the existing `ErrorBoundary` pattern.
- Clamp `move`/`resize` operations to canvas bounds in the canvas drag handlers and the corresponding state reducers.
- Add a perf sanity check at ~100 slots (render + drag interaction) and record the result.

### Acceptance criteria

- A thrown render error inside the builder shows a recoverable fallback, not a blank modal.
- Slots cannot be dragged outside 0–100% on either axis.
- 100-slot perf measured and documented as acceptable (or a follow-up filed if not).

### Validation

- `vitest` for the error boundary fallback and the clamp logic (boundary inputs).
- Manual large-layout interaction check.

### Implementation notes

**Error boundary (2026-06-17)**

`LayoutBuilderModal.tsx` is now wrapped in `<ErrorBoundary>` (existing component at `src/components/ErrorBoundary.tsx`). The fallback renders a centered "Something went wrong in the Layout Editor" message with a "Close Editor" button that calls `onClose()` directly (bypasses the dirty-check confirm modal since builder state may be corrupted). Sentry capture is handled automatically by `ErrorBoundary.componentDidCatch`.

**Drag bounds clamping (2026-06-17)**

`moveSlot` in `useLayoutBuilderState.ts` now applies the same clamping as `nudgeSlots`:
```ts
slot.x = Math.max(0, Math.min(100 - slot.width, x));
slot.y = Math.max(0, Math.min(100 - slot.height, y));
```
This ensures slots cannot be dragged outside the 0–100% canvas boundary on either axis. The fix lives in the state mutation layer so all callers (canvas drag, canvas drop, group move) benefit automatically.

**100-slot perf check (2026-06-17)**

Hook-level: 100 `moveSlot` calls on a 100-slot template completed in <200 ms threshold (vitest, headless). Full-UI drag frame rate was not measured programmatically; the hook mutation overhead is negligible compared to React's render cost. If render jank is observed in a real browser at 50+ slots, a `useMemo` or virtualization pass can be filed in FUTURE_TASKS.

**vitest results (2026-06-17)**

`useLayoutBuilderState.test.ts` — 66/66 green. `useLayoutBuilderState.coverage.test.tsx` — 14/14 green (including 2 new P54-D perf tests).

## Track P54-E - Release-readiness closeout

### Problem

"Gearing to production" needs an explicit, repeatable green-light checklist rather than ad-hoc confidence.

### Fix

- Full `vitest` + PHPUnit suites green (PHP execution via Haiku subagent).
- `scripts/check-bundle-size.mjs` within budget (main ≤ 200 kB gz, adapter chunks ≤ 50 kB gz).
- `build:wp` smoke — confirm a clean WordPress asset build.
- Version bump + a `docs/VERSION_HISTORY.md` entry.
- Confirm Sentry / web-vitals env wiring is correct for the chosen environment.
- `readme.txt` / README sanity — **only if** the public-WP.org or premium path is chosen (see `docs/MONETIZATION_OPTIONS.md`).

### Acceptance criteria

- All test suites green; bundle within budget; `build:wp` produces a clean versioned artifact.
- Version history updated.

### Validation

- Run suites (Haiku for PHP), `check-bundle-size.mjs`, `build:wp`.

### Implementation notes

**Suite results (2026-06-23)**

| Suite | Result |
|-------|--------|
| vitest | 3124/3124 green (0 failures) |
| PHPUnit | 1049 tests, 12 982 assertions, 2 skipped, 0 failures, 0 errors |

**Bundle budget (2026-06-23)**

All 50 non-vendor chunks pass. Main entries: `index-7T6wA9-4.js` 156.9 kB gz (budget 200 kB), `index-CQvpIELy.js` 89.2 kB gz. No adapter chunk exceeds 50 kB gz. Vendor bundles (Mantine, dockview, charts) are excluded from the budget check per `check-bundle-size.mjs` policy.

**`build:wp` (2026-06-23)**

Clean build in 8.52 s; output copied to `wp-plugin/wp-super-gallery/assets/`. Rollup large-chunk warnings for vendor bundles (`vendor-mantine-core`, `vendor-charts`, `vendor-dockview`) are expected pre-existing notices — all are vendor code excluded from the size budget.

**Sentry / web-vitals (2026-06-23)**

Sentry: correctly gated — `initSentry()` is a no-op when no DSN is provided and is skipped entirely in `DEV` mode. DSN is injected via `window.__WPSG_SENTRY_DSN__` or `wpsgConfig.sentryDsn` from the WP plugin config. `Authorization` headers are stripped from breadcrumbs; user IP is redacted before sending. Ready to activate by setting the DSN constant in `wp-config.php`.

Web-vitals: not yet implemented — expected at this stage since the production target is undecided (see Decision C). Promoted to `FUTURE_TASKS.md` for the chosen distribution path.

**Version bump (2026-06-23)**

`0.26.0 → 0.27.0` in `package.json`, `package-lock.json`, and `wp-super-gallery.php` plugin header. `docs/VERSION_HISTORY.md` updated with full P54 track summary.

---

## Production Target & Monetization

The P54 must-fix phase is the **common prerequisite for every distribution path**; only the *extra* work differs. Full detail, comparisons, fee tables, and codebase-anchored LOE live in **[`MONETIZATION_OPTIONS.md`](../../MONETIZATION_OPTIONS.md)**. Summary:

| Target | Pros | Cons | Delta LOE on top of P54 |
|--------|------|------|-------------------------|
| **Public WP.org (free)** | Huge discovery + credibility | Strict GPL/escaping/no-undisclosed-remote review; full i18n + `.pot` effectively required; support load; no direct revenue | **High** — full admin i18n, plugin-check compliance, `readme.txt`/assets, full WCAG AA |
| **Premium / marketplace** | Direct revenue; control of update channel | Licensing + update server + docs/support; CodeCanyon review + ~30–50% cut; i18n still expected | **Med-High** — licensing/update infra (Freemius shortcuts this), docs, i18n |
| **Private / client / agency** | Lowest bar; revenue via services | No passive distribution | **Low** — P54 ≈ sufficient; i18n/a11y pragmatic |
| **Internal / single-site** | Ship right after P54 | No reuse/revenue | **Lowest** |

## Follow-On Candidates

Surfaced by the review, intentionally **out of P54** (tight must-fix). Promoted to `docs/FUTURE_TASKS.md`, ordered by user priority.

| Candidate | Why it is deferred |
|-----------|--------------------|
| LayoutBuilder Editor UX polish (true copy/paste, alignment keyboard shortcuts, layer search) | Enhancement, not a blocker; Ctrl+D duplicate already covers the core need. |
| LayoutBuilder Responsive editing (per-breakpoint slot overrides) | New capability; preview-per-device exists today. Medium-large. |
| LayoutBuilder Text layers | Large new capability — likely its own phase. |
| LayoutBuilder design-tool affordances (swatches, eyedropper, rotation handles, persistent guides) | Polish that narrows the Figma/Canva gap; not launch-gating. |
| Gallery admin-control additions (client-side validation, configurable breakpoints, listing-mode config, mobile-support visibility) | Sensible control additions; server-side validation already enforces correctness. |
| Adapter / clean-code cleanup (extract setting-group data; closed-union vs `registerAdapter`; unify TS/PHP field-map) | Maintainability, not correctness; no user-visible impact. |
| Large-file decomposition (`LayoutBuilderModal.tsx`, `useLayoutBuilderState.ts`, `MediaTab.tsx`) | Refactor; covered by tests, no behavior change. |
| Full admin-panel i18n migration + flip lint rule globally | Deferred per Decision B; gates the public/premium paths. |
| Full WCAG AA audit | Beyond the P54-C critical/serious baseline; gates the public WP.org path. |
| Monetization infrastructure (Freemius/EDD licensing + update server) | Activates only if the premium path is chosen. |

## Implementation Notes

- Record completed work here as tracks land; keep it factual.
- PHP test/build execution is delegated to Haiku subagents; tests are authored in this repo.

## Track P54-F - SpaceSwitcher regression fix

### Problem

Manual testing after P54-B revealed that on multi-space pages, the `SpaceSwitcher` badge no longer opened the dropdown menu, and the displayed space defaulted to the wrong (last) entry. The regression was introduced by P54-B adding `useTranslation` hooks to two components:

1. **`AuthBarFloatingTrigger`** — a `forwardRef` expression-body component used directly as `Popover.Target`'s child. Converting it from an expression body to a block body to add a React hook changed the component's contract in a way that interferes with how Mantine v9's `Popover.Target` attaches its ref and click handlers via `React.cloneElement`.

2. **`SpaceSwitcher`** — now had `useTranslation` which subscribes to i18n state updates. In Mantine v9 with React 18's `useSyncExternalStore` (used by react-i18next v17), this may schedule additional render passes that race with Mantine's click-outside / floater open/close state machines, preventing the nested `Menu` from opening inside the `Popover.Dropdown`.

### Fix (2026-06-23)

- **`AuthBarFloatingTrigger`**: Restored to the original expression-body `forwardRef` form (no hooks). The single `aria-label` string uses the imperative `i18n.t()` API — correct at load time, doesn't subscribe to i18n updates, zero render-cycle impact.
- **`SpaceSwitcher`**: Removed `useTranslation` hook. Both strings (`aria-label` and "Target space" menu label) use `i18n.t()` — same translation, no hook subscription.

The `AuthBarFloatingMenuContent` function (the inner popover content) retains `useTranslation` unchanged — it has many strings, is not a Mantine Target/Trigger, and had no reported issues.

### Why `i18n.t()` is correct here

Both affected strings are read once at render time (locale is set by PHP before the page loads and doesn't change at runtime). `i18n.t()` is synchronous, uses the initialized namespace, and returns the correct translated string. The only trade-off vs `useTranslation` is that runtime language switches won't re-render these two strings — which is acceptable since the plugin doesn't support mid-session language switching.

### Validation

3150/3150 vitest green; `tsc --noEmit` and scoped ESLint clean.

---

## Outcome

All five core tracks and the regression fix landed on `feat/phase54-production-hardening` (commits `987d1589`→`20bd4043`). The codebase now has:
- No unaddressed high/critical security findings (P54-A)
- All public-facing JSX strings translatable via `t()` with PHP-injectable translations (P54-B)
- Zero critical/serious axe violations on gallery, Lightbox, and auth flows; axe Playwright spec enforcing the baseline (P54-C)
- LayoutBuilder fails safe with an error boundary and correct canvas drag bounds (P54-D)
- Both test suites green, bundle within budget, clean `build:wp`, Sentry wired — version shipped as **v0.27.0** (P54-E)

## Review Follow-Ups

**P54-B i18n lint gate — `markupOnly` → `mode` (2026-06-23)**

Branch self-review found the i18n lint gate configured with `['error', { markupOnly: true }]`. `markupOnly` is **not** a recognized option in `eslint-plugin-i18next` v6.1.4 (valid keys: `framework, mode, jsx-components, jsx-attributes, words, callees, object-properties, class-properties, message, should-validate-template`). The rule schema does not forbid unknown keys, so the option was silently ignored and the gate ran in the plugin's default `mode: 'jsx-text-only'`. The intended behavior (flag literal JSX text only, skip attribute-string noise) was therefore being achieved by accident, not by config.

Fixed by switching to the supported, explicit `['error', { mode: 'jsx-text-only' }]` — identical effective behavior in this version, but valid and resilient to a future change in the plugin's default mode. Note the gate intentionally covers JSX **text** only; literals in attributes (`aria-label`, `placeholder`, `title`) are not enforced, so broadening to attribute coverage (`mode: 'jsx-only'` + an `jsx-attributes` allowlist) remains a follow-on if/when the public-distribution path is pursued.

**Branch-coverage buffer (2026-06-23)**

Post-P54 the global branch coverage sat at 72.02% (5398/7495) — only 0.02 over the 72 gate, i.e. a single new uncovered branch would have broken the build. Added targeted tests to restore a real margin:

- `PinterestAdapter` was fully untested (0% — it was simply missing from the parametrized adapter suite in `__tests__/adapters.test.tsx`). Added it to that suite plus a Pinterest-specific block for aspect-ratio tile classification and the narrow-layout collapse → 0% → 75.4% branch.
- `resolveBoxShadow` (`shadowPresets.ts`, 33% → 100%) — new unit suite covering custom/named/unknown-key paths.
- `themeScope.ts` (58% → 100%) — covered the `CSS.escape`-absent fallback and token-generation branches.
- `i18n.ts` — covered the `locale !== 'en'` branch (injected non-en locale with en-default fallback) that the existing test never exercised.

Result: branches 72.02% → **72.72%** (5451/7495), margin +0.02 → +0.72 over the gate. Full suite 3150 tests green, `tsc -b` clean.
