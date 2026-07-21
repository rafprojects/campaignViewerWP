# Phase 69 - React Security, Privacy & Hardening Defaults

**Status:** Planned
**Created:** 2026-07-14
**Last updated:** 2026-07-14

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P69-A | Google Fonts fetched client-side by public visitors — undocumented third-party data flow | Planned | Small (docs) |
| P69-B | Debug component markers stamped on production DOM by default — mostly PHP | Planned | Small |
| P69-C | `parseNodeConfig` skips the key-allowlist treatment `parseProps` gets | Planned | Small |
| P69-D | ErrorBoundary shows raw `error.message` to public visitors | Planned | Small |
| P69-E | JWT provider's localStorage permissions cache never expires (opt-in path) | Planned | — (tracking only) |

---

## Rationale

No exploitable front-end vulnerability was found in the 2026-07-13 review ([REACT_REVIEW_FINDINGS.md](archive/reviews/REACT_REVIEW_FINDINGS.md)) — this phase is hardening and compliance polish on an already-strong posture (one `dangerouslySetInnerHTML` behind DOMPurify, consistent CSS-injection sanitization, mount-time prop allowlisting, cookie/nonce auth with no browser-stored tokens by default). All items were independently re-verified against current source on 2026-07-14, with zero disputes.

1. **What triggered it.** B-1 (Google Fonts) is the highest-impact item in this cluster — verified to run on the actual public gallery render path (`CardGallery.tsx`, `CampaignViewer.tsx`), not just an admin preview, disclosing every public visitor's IP to Google with zero documentation of the flow. E-1 (debug markers) is cataloged under "Efficiency" in the source doc but is really the same failure shape as PHP's A-1/A-2 and this phase's own B-1: a setting defaults to the more-invasive choice and nobody has to opt in to get it.
2. **Why it belongs together.** Every item is "harden a default or close an information-exposure gap," none is a live exploit, and all are independent small changes — a natural single batch.
3. **Success.** The Google Fonts data flow is documented (or eliminated via self-hosting, as a follow-on); production galleries don't ship debug markers by default; the mount-config boundary is consistently allowlisted; error messages shown to the public don't leak internals; the JWT permissions cache staleness is tracked against the work item that will actually fix it.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | B-1 fix scope | Ship the **docs-only** fix now (Small effort): document the Google Fonts data flow, trigger condition, and opt-out in `PRIVACY.md`. The self-host variant (download selected font files server-side at settings-save time, serve locally) is a genuinely separate, both-sides, Medium-effort feature — moved to Follow-On Candidates rather than bundled into this phase, since it isn't required to close the compliance-documentation gap. |
| B | E-1's PHP-only scope | This finding is cataloged in the React review but its fix is almost entirely a PHP settings-default flip (`class-wpsg-settings-registry.php`) with zero FE code change needed — it has no existing home in Phases 63–67 since it surfaced in this review, not the PHP one. Kept here (rather than reopening an already-written PHP phase doc) since that's where it's cataloged and the change is trivial. |
| C | B-4 track scope | No standalone implementation work in this phase — `WpJwtProvider`'s localStorage cache is disabled-by-default (`WPSG_ENABLE_JWT_AUTH` opt-in) and display-only staleness (server still enforces). Confirmed the existing "JWT In-Memory Token Auth" item in [FUTURE_TASKS.md](FUTURE_TASKS.md) is the right home for the actual fix; P69-E exists purely so this phase's tracking is complete, not as new scheduled work. **Refined during planning validation (2026-07-21, see below): that FUTURE_TASKS.md item doesn't currently mention this cache/TTL gap at all, so P69-E now includes a 2-line doc cross-reference rather than zero action.** |

## Planning Refinement Pass (2026-07-21)

Before execution, every claim in this doc was independently re-verified against current source (two Explore agents + direct inspection), not re-trusted from the 2026-07-14 pass. All five tracks' core claims held up. Three refinements were surfaced and approved by the user; they supersede the affected text elsewhere in this doc:

1. **P69-B — two default locations, not one.** `debug_component_markers` defaults to `true` in both `class-wpsg-settings-registry.php:30` (canonical `self::$defaults`, already cited) **and** `class-wpsg-embed.php:68` (`isset($settings['debug_component_markers']) ? … : true` — a defensive fallback that only fires if `WPSG_Settings::get_settings()` fails to run at all, since `get_settings()` always merges the registry default via `wp_parse_args()`). Both flip to `false`. The `WPSG_DEBUG_COMPONENT_MARKERS` constant override (`class-wpsg-settings-registry.php:977-979`) is an intentional dev/test escape hatch and stays untouched.
2. **P69-B — no existing test asserts the current default.** Searched all PHP test files; nothing calls `get_defaults()['debug_component_markers']` and asserts a value (`WPSG_Settings_Test.php:298-321` and `WPSG_Settings_Extended_Test.php:315-321` test sanitization/rendering, not the default). The track's acceptance criteria below is corrected accordingly — write a **new** test, not an "updated" one.
3. **P69-E — upgraded from zero action to a 2-line `FUTURE_TASKS.md` edit.** See Key Decision C above.

**Non-blocking notes carried forward for execution** (don't change scope, but matter for correctly scoping/testing each fix):
- P69-B's "~14 files" file-count claim undercounts (actual is ~32 narrow / ~121 broad call sites) — doesn't change the fix, which is PHP-only regardless of FE call-site count.
- `isWpsgDebugEnabled()` (`src/utils/wpsgDebug.ts:7-9`) short-circuits true whenever `import.meta.env.DEV` — validate P69-B against a **production build**, not dev.
- P69-C's `NodeConfig` (`src/main.tsx:81-90`) has **8** fields (`spaceId`, `spaceName`, `instanceId`, `theme`, `galleryLayout`, `enableLightbox`, `enableAnimations`, `authBarMode`), not just the 3 named as examples in the Fix section below — all 8 need allowlist/type coverage. `zod` (already a dependency, `^4.3.6`) is already used for exactly this in `src/types/settingsSchemas.ts` — follow that pattern.
- P69-D: `ErrorBoundary` is a class component, so it can't call `useAuth()` directly for admin status, and there's no `isAdmin` on `window.__WPSG_CONFIG__`. Add an `isAdmin` prop and thread it from its 5 mount sites (`src/App.tsx:422,441`; `AdminPanel.tsx:702,793`; `LayoutBuilderModal.tsx:474`), all of which already have `isAdmin` in scope via `useAuth()` (`AuthContext.tsx:166-167`). Combine with `isDebugEnabled()` (`src/utils/debug.ts`, safe to call directly, no hook). Use the existing `i18n.t('key', 'fallback')` (i18next) pattern already in this file — this codebase doesn't use `@wordpress/i18n`'s `__()` anywhere in the frontend.

**New required deliverable:** as each track lands, add a section to a new companion doc, `docs/PHASE69_MANUAL_QA_RUNBOOK.md`, following the style/structure of [PHASE67_MANUAL_QA_RUNBOOK.md](PHASE67_MANUAL_QA_RUNBOOK.md) — what & why, pre-fix behavior, manual verification steps (or explicit rationale where no hand-testable surface exists, e.g. P69-E), why it proves the fix, regression checks, pitfalls — closing with a sign-off checklist table.

**Approved commit batching:** single branch (`feature/phase69-react-hardening-2-of-4`), one PR, two commits, matching the Phase 68 (PR #82) pattern — Commit 1: P69-A + P69-B + P69-E (defaults/docs, no shared code); Commit 2: P69-C + P69-D (independent small FE hardening).

## Execution Priority

1. **P69-A** — highest impact (compliance posture, EU market); purely additive doc change, zero code risk.
2. **P69-B** — independent; one-line PHP default flip, do alongside P69-A since both are "change a default/add documentation" with no shared code.
3. **P69-C, P69-D** — small, independent FE hardening; batch together.
4. **P69-E** — no action in this phase; confirm the FUTURE_TASKS.md item still references this gap correctly when that item is eventually scheduled.

---

## Track P69-A - Google Fonts fetched client-side by public visitors

*Source: REACT_REVIEW_FINDINGS.md § B-1 — re-verified 2026-07-14, confirmed accurate: `loadGoogleFont.ts` is called from the actual public render paths (`CardGallery.tsx`, `CampaignViewer.tsx`), not just an admin context, and `PRIVACY.md` has zero mentions of fonts/Google anywhere in the file.*

### Problem

`packages/shared-utils/src/loadGoogleFont.ts` injects `fonts.googleapis.com` stylesheet links at runtime when a typography setting selects a Google font — for public gallery visitors, not just admins previewing in the builder. Each visitor's IP is disclosed to Google, matching the fact pattern behind the German LG München Google-Fonts ruling; GDPR-conscious site owners increasingly reject plugins that do this silently. `PRIVACY.md` (recently extended for the Freemius data flow) doesn't mention it.

### Fix

Per Key Decision A: document the flow in `PRIVACY.md` — trigger condition (a typography setting selecting a Google font), what's disclosed (visitor IP to Google), and how to avoid it (use system/custom fonts instead).

### Acceptance criteria

- `PRIVACY.md` accurately describes the Google Fonts data flow, its trigger, and the opt-out.

### Validation

- Manual doc review: confirm the new section accurately reflects when `loadGoogleFont.ts` actually runs (public render, not just builder preview).

### Implementation (2026-07-21) — Done

Added a dedicated bullet to `PRIVACY.md` §3 ("Data that leaves your server"). During implementation, verification of the actual code surfaced that the flow is **broader than the source finding stated**: it is *not only* the client-side `loadGoogleFont.ts` injection. `class-wpsg-embed.php` (`render_shortcode`, ~line 248-264) *also* enqueues a `fonts.googleapis.com` `<link>` server-side via `wp_enqueue_style`, reading the same `typography_overrides` source (`WPSG_Settings_Typography::extract_google_font_families`). So the font request fires on the public page **even with JavaScript disabled** — the server-side path is actually the primary one. The doc documents both mechanisms, the opt-in trigger (default theme uses no Google font ⇒ zero requests by default), the IP disclosure, and the two opt-outs (system font stack; custom uploaded fonts served locally via `@font-face`, per `WPSG_Font_Library::generate_font_face_css`). Header "Last reviewed" bumped to 2026-07-21. QA in [PHASE69_MANUAL_QA_RUNBOOK.md](PHASE69_MANUAL_QA_RUNBOOK.md) § P69-A (doc-review + optional Network-panel confirmation).

---

## Track P69-B - Debug component markers stamped on production DOM by default

*Source: REACT_REVIEW_FINDINGS.md § E-1 — re-verified 2026-07-14, confirmed accurate: PHP default is `true` (`class-wpsg-settings-registry.php`), and `getWpsgDebugProps()`/`isWpsgDebugEnabled()` is called broadly across public gallery-rendering adapters (verified across ~14 files), not just admin surfaces.*

### Problem

`isWpsgDebugEnabled()` (`src/utils/wpsgDebug.ts`) resolves to `window.__WPSG_CONFIG__?.debugComponentMarkers ?? false` in production builds, and PHP defaults `debug_component_markers` to `true` in the settings registry — so every production install renders `data-wpsg-component`/`data-wpsg-slot` attributes on every tile, row, and panel of every public gallery by default: payload and DOM-size overhead for a debugging aid nobody asked to enable.

### Fix

Per Key Decision B, flip the PHP default to `false` in **both** places it's hardcoded (see Planning Refinement Pass #1 above): `class-wpsg-settings-registry.php:30`'s canonical `self::$defaults` array, and `class-wpsg-embed.php:68`'s defensive `isset(...) ? ... : true` fallback. The admin toggle and the `wpsg_debug_component_markers` filter stay as the explicit opt-in. No FE code change needed — `getWpsgDebugProps()` already correctly reads whatever the config says.

### Acceptance criteria

- A fresh install with no settings customization does not render `data-wpsg-*` debug attributes on public gallery output **in a production build** (dev builds always show markers via `isWpsgDebugEnabled()`'s `import.meta.env.DEV` short-circuit — that's expected, not a regression).
- The admin toggle / filter still allow re-enabling markers for debugging.

### Validation

- New PHP test asserting `WPSG_Settings::get_defaults()['debug_component_markers'] === false` (no existing test locks in the current default — see Planning Refinement Pass #2).
- Manual: fresh install, view a public gallery's rendered HTML **from a production build**, confirm no `data-wpsg-component`/`data-wpsg-slot` attributes are present; toggle the setting on and confirm they reappear.

### Implementation (2026-07-21) — Done

Flipped `'debug_component_markers'` `true → false` in `class-wpsg-settings-registry.php` (`$defaults`) and the `page_config_js()` fallback in `class-wpsg-embed.php`. Left the `WPSG_DEBUG_COMPONENT_MARKERS` constant override (`get_defaults()`) untouched. Added `WPSG_Settings_Extended_Test::test_get_defaults_debug_component_markers_is_false`; confirmed the constant is not defined in the test bootstrap (so `get_defaults()` returns the raw `false`, not the override branch), and that no existing test asserted the old `true` default (the ones referencing the key set it explicitly to `false`/`true` as input and are unaffected). No FE change. QA in [PHASE69_MANUAL_QA_RUNBOOK.md](PHASE69_MANUAL_QA_RUNBOOK.md) § P69-B — note the prod-build requirement (dev builds force markers on via `import.meta.env.DEV`).

---

## Track P69-C - `parseNodeConfig` skips the key-allowlist treatment `parseProps` gets

*Source: REACT_REVIEW_FINDINGS.md § B-2 — re-verified 2026-07-14, confirmed accurate.*

### Problem

At mount, `data-wpsg-props` is filtered through the `ALLOWED_PROPS` allowlist (`src/main.tsx:65-79`), but `data-wpsg-config` is cast to `NodeConfig` unfiltered (`src/main.tsx:81-102`) — a compile-time-only type assertion, no runtime field allowlist or type-check. The attribute is PHP-generated today, so risk is low, but the asymmetry is exactly the kind that erodes: anything else that can set that attribute (a page-builder plugin storing raw HTML, an XSS elsewhere) gets arbitrary keys/types into the mount config.

### Fix

Apply the same allowlist+type-check treatment already used for `parseProps` — a small validator (or a zod schema, already a dependency) checking `spaceId` is a number, `theme`/`authBarMode` are known enum values, etc.

### Acceptance criteria

- `parseNodeConfig` rejects or strips unexpected keys/wrong-typed values the same way `parseProps` does.
- No behavior change for legitimate PHP-generated config payloads.

### Validation

- Unit test: feed `parseNodeConfig` a payload with an extra unexpected key and a wrong-typed known key; assert it's stripped/coerced rather than silently passed through.

---

## Track P69-D - ErrorBoundary shows raw `error.message` to public visitors

*Source: REACT_REVIEW_FINDINGS.md § B-3 — re-verified 2026-07-14, confirmed accurate; no debug-mode or admin-status gate exists anywhere in the component.*

### Problem

`ErrorBoundary.tsx`'s fallback renders `this.state.error?.message` directly (~line 58) to whoever is looking. Exception messages can carry internal details (URLs, state fragments). Sentry already receives the full error; end users don't need it.

### Fix

Show generic translated copy by default; include the raw message only when the `wpsg_debug` flag (`src/utils/debug.ts`) is set or the viewer is an admin.

### Acceptance criteria

- A public visitor triggering an error boundary sees generic copy, not the raw exception message.
- An admin or debug-mode session still sees the raw message for troubleshooting.

### Validation

- Unit test: render the boundary with a thrown error under both debug-on and debug-off conditions, assert the correct copy in each.

---

## Track P69-E - JWT provider's localStorage permissions cache never expires (tracking only)

*Source: REACT_REVIEW_FINDINGS.md § B-4 — re-verified 2026-07-14, confirmed accurate. No implementation in this phase — see Key Decision C.*

### Problem

`WpJwtProvider.getPermissions()` (`src/services/auth/WpJwtProvider.ts:123-131`) returns the cached `wpsg_permissions` localStorage entry with no TTL, cleared only on logout. Revoked grants persist in the client UI until logout (server still enforces, so this is display-only staleness). The provider is disabled by default behind `WPSG_ENABLE_JWT_AUTH`.

### Fix

No standalone fix here — fold into the existing "JWT In-Memory Token Auth" item in `FUTURE_TASKS.md` when that work is scheduled: add a TTL (or drop the cache entirely, since the permissions endpoint is cheap) as part of that larger rework. **Refined during planning validation:** that FUTURE_TASKS.md item (~line 356+) currently says nothing about this cache/TTL gap — it only covers access-token storage — and the only prior record of the gap (`REACT_REVIEW_FINDINGS.md`) has since been archived. So this phase adds a 2-line cross-reference to that item (plus fixes its stale claim that `WpJwtProvider.tsx` is "currently commented out" — it's live, working `.ts` code today, flag-gated at `App.tsx:50-56`) rather than doing nothing.

### Acceptance criteria

- `docs/FUTURE_TASKS.md`'s "JWT In-Memory Token Auth" section cross-references the `wpsg_permissions` cache/TTL gap and no longer claims `WpJwtProvider` is commented out.

### Validation

- Doc-only: review the `FUTURE_TASKS.md` diff for accuracy. No test — recorded in the companion QA runbook with rationale rather than a script (see Planning Refinement Pass).

### Implementation (2026-07-21) — Done

Edited `docs/FUTURE_TASKS.md`'s "JWT In-Memory Token Auth" section: (1) added a bullet in "What it would take" describing the `wpsg_permissions` no-TTL cache staleness (revoked grant lingers in UI until logout; display-only) with a back-link to this report's P69-E section; (2) corrected three stale "commented out" references — the Context paragraph, the file bullet (also fixed the filename `WpJwtProvider.tsx → .ts`), and the Prerequisites line — to state the provider is live, flag-gated code (`getAuthProvider()` in `App.tsx` instantiates it only when `enableJwt === true`). QA in [PHASE69_MANUAL_QA_RUNBOOK.md](PHASE69_MANUAL_QA_RUNBOOK.md) § P69-E (diff review; no runtime surface).

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Google Fonts self-host variant (download selected font files server-side at settings-save time, serve locally, fall back to system fonts stack) | Both-sides, Medium effort — a real feature, not a documentation fix. The docs-only fix (P69-A) closes the compliance-transparency gap without it; revisit if GDPR-conscious buyers specifically ask for a zero-third-party-request option. |

## Implementation Notes

- **Commit 1 — P69-A + P69-B + P69-E (2026-07-21).** Defaults/docs batch, no shared code.
  - P69-A: `docs/PRIVACY.md` §3 documents the Google Fonts flow (server-side `wp_enqueue_style` `<link>` + client-side `loadGoogleFont.ts` injection; opt-in trigger; IP disclosure; system-font/custom-font opt-outs). Broader than the source finding — the server-side path is primary and fires with JS off.
  - P69-B: `debug_component_markers` default flipped `true → false` in `class-wpsg-settings-registry.php` + `class-wpsg-embed.php` fallback; new `WPSG_Settings_Extended_Test::test_get_defaults_debug_component_markers_is_false`. PHP-only, no FE change.
  - P69-E: `docs/FUTURE_TASKS.md` JWT item cross-references the `wpsg_permissions` cache/TTL gap and corrects the stale "commented out" wording.
  - Companion `docs/PHASE69_MANUAL_QA_RUNBOOK.md` created with §§ P69-A/B/E and the sign-off table (C/D rows added in commit 2).
- **Commit 2 — P69-C + P69-D:** pending.

## Outcome

Not started.
