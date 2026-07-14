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

No exploitable front-end vulnerability was found in the 2026-07-13 review ([REACT_REVIEW_FINDINGS.md](REACT_REVIEW_FINDINGS.md)) — this phase is hardening and compliance polish on an already-strong posture (one `dangerouslySetInnerHTML` behind DOMPurify, consistent CSS-injection sanitization, mount-time prop allowlisting, cookie/nonce auth with no browser-stored tokens by default). All items were independently re-verified against current source on 2026-07-14, with zero disputes.

1. **What triggered it.** B-1 (Google Fonts) is the highest-impact item in this cluster — verified to run on the actual public gallery render path (`CardGallery.tsx`, `CampaignViewer.tsx`), not just an admin preview, disclosing every public visitor's IP to Google with zero documentation of the flow. E-1 (debug markers) is cataloged under "Efficiency" in the source doc but is really the same failure shape as PHP's A-1/A-2 and this phase's own B-1: a setting defaults to the more-invasive choice and nobody has to opt in to get it.
2. **Why it belongs together.** Every item is "harden a default or close an information-exposure gap," none is a live exploit, and all are independent small changes — a natural single batch.
3. **Success.** The Google Fonts data flow is documented (or eliminated via self-hosting, as a follow-on); production galleries don't ship debug markers by default; the mount-config boundary is consistently allowlisted; error messages shown to the public don't leak internals; the JWT permissions cache staleness is tracked against the work item that will actually fix it.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | B-1 fix scope | Ship the **docs-only** fix now (Small effort): document the Google Fonts data flow, trigger condition, and opt-out in `PRIVACY.md`. The self-host variant (download selected font files server-side at settings-save time, serve locally) is a genuinely separate, both-sides, Medium-effort feature — moved to Follow-On Candidates rather than bundled into this phase, since it isn't required to close the compliance-documentation gap. |
| B | E-1's PHP-only scope | This finding is cataloged in the React review but its fix is almost entirely a PHP settings-default flip (`class-wpsg-settings-registry.php`) with zero FE code change needed — it has no existing home in Phases 63–67 since it surfaced in this review, not the PHP one. Kept here (rather than reopening an already-written PHP phase doc) since that's where it's cataloged and the change is trivial. |
| C | B-4 track scope | No standalone implementation work in this phase — `WpJwtProvider`'s localStorage cache is disabled-by-default (`WPSG_ENABLE_JWT_AUTH` opt-in) and display-only staleness (server still enforces). Confirmed the existing "JWT In-Memory Token Auth" item in [FUTURE_TASKS.md](FUTURE_TASKS.md) is the right home for the actual fix; P69-E exists purely so this phase's tracking is complete, not as new scheduled work. |

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

---

## Track P69-B - Debug component markers stamped on production DOM by default

*Source: REACT_REVIEW_FINDINGS.md § E-1 — re-verified 2026-07-14, confirmed accurate: PHP default is `true` (`class-wpsg-settings-registry.php`), and `getWpsgDebugProps()`/`isWpsgDebugEnabled()` is called broadly across public gallery-rendering adapters (verified across ~14 files), not just admin surfaces.*

### Problem

`isWpsgDebugEnabled()` (`src/utils/wpsgDebug.ts`) resolves to `window.__WPSG_CONFIG__?.debugComponentMarkers ?? false` in production builds, and PHP defaults `debug_component_markers` to `true` in the settings registry — so every production install renders `data-wpsg-component`/`data-wpsg-slot` attributes on every tile, row, and panel of every public gallery by default: payload and DOM-size overhead for a debugging aid nobody asked to enable.

### Fix

Per Key Decision B: flip the PHP default to `false` (`class-wpsg-settings-registry.php`'s `debug_component_markers` default). The admin toggle and the `wpsg_debug_component_markers` filter stay as the explicit opt-in. No FE code change needed — `getWpsgDebugProps()` already correctly reads whatever the config says.

### Acceptance criteria

- A fresh install with no settings customization does not render `data-wpsg-*` debug attributes on public gallery output.
- The admin toggle / filter still allow re-enabling markers for debugging.

### Validation

- Existing settings-default tests updated for the new default value.
- Manual: fresh install, view a public gallery's rendered HTML, confirm no `data-wpsg-component`/`data-wpsg-slot` attributes are present; toggle the setting on and confirm they reappear.

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

No standalone fix here — fold into the existing "JWT In-Memory Token Auth" item in `FUTURE_TASKS.md` when that work is scheduled: add a TTL (or drop the cache entirely, since the permissions endpoint is cheap) as part of that larger rework.

### Acceptance criteria

- N/A this phase — recorded so the review is complete and the eventual JWT rework doesn't miss this gap.

### Validation

- N/A this phase.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Google Fonts self-host variant (download selected font files server-side at settings-save time, serve locally, fall back to system fonts stack) | Both-sides, Medium effort — a real feature, not a documentation fix. The docs-only fix (P69-A) closes the compliance-transparency gap without it; revisit if GDPR-conscious buyers specifically ask for a zero-third-party-request option. |

## Implementation Notes

- Record completed work here as tracks land; nothing executed yet.

## Outcome

Not started.
