# Phase 54 - Production Hardening

**Status:** Planned
**Created:** 2026-06-17
**Last updated:** 2026-06-17

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P54-A | Security hardening pass — audit free-form CSS fields, DOMPurify allowlist, localStorage; run `/security-review` | Planned | Small-Medium |
| P54-B | User-facing i18n harvest — front-end strings → `t()`; scope the i18next lint rule on for front-end dirs | Planned | Medium |
| P54-C | Front-end accessibility baseline — axe pass on gallery / Lightbox / auth; fix critical+serious | Planned | Medium |
| P54-D | LayoutBuilder robustness — error boundary, drag bounds clamping, large-layout perf check | Planned | Small-Medium |
| P54-E | Release-readiness closeout — suites green, bundle budget, `build:wp`, version bump | Planned | Small |

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

---

## Production Target & Monetization

The P54 must-fix phase is the **common prerequisite for every distribution path**; only the *extra* work differs. Full detail, comparisons, fee tables, and codebase-anchored LOE live in **[`MONETIZATION_OPTIONS.md`](MONETIZATION_OPTIONS.md)**. Summary:

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

## Outcome

_To be completed when the phase lands._
