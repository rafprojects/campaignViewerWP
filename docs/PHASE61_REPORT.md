# Phase 61 - Front-End i18n Completeness (Literal-String Audit & Closeout)

**Status:** Planned
**Created:** 2026-07-04
**Last updated:** 2026-07-04

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P61-A | Trivial enablement — `src/contexts/**` + `src/components/Galleries/Shared/**` (0 violations) | Done | Small |
| P61-B | Near-zero-cost fixes — `Settings/SettingsSystemAdminTab.tsx`, `ErrorBoundary.tsx`, `App.tsx` (6 violations) | Done | Small |
| P61-C | `src/components/Common/**` sweep (37 violations, 5 files) | Planned | Medium |
| P61-D | `src/components/CampaignGallery/**` sweep (18 violations, 4 files) | Planned | Small-Medium |
| P61-E | `src/components/CardViewer/CampaignViewer.tsx` sweep (12 violations, 1 file) | Planned | Small |
| P61-F | `src/components/Auth/AuthBar.tsx` sweep (8 violations) | Planned | Small |
| P61-G | Global enforcement flip + translation sweep + `FUTURE_TASKS.md` closeout | Planned | Medium |

---

## Rationale

P60-G (customer-facing front-end) and P60-I (admin panel) closed the two biggest i18n surfaces, but both were scoped **by area**, not by exhaustive coverage — the enforced-glob mechanism in `eslint.config.js` has to be extended by hand for each new component family, and nothing catches a family that's missed until a human notices raw English in a non-English locale.

1. **What triggered it.** Two component families (`src/hooks/**`, `src/components/Campaign/**`) were already found missing enforcement mid-session — one QA bugfix (campaign-row actions/status/visibility + built-in template names shipping raw English) and one lint-glob-extension sweep (3 more files it surfaced) landed back to back. That is a recurring-defect pattern, not a one-off, so the enforcement boundary itself needed a full audit rather than another one-off patch.
2. **Why it belongs together.** A full-`src/` scan (2026-07-04) found the boundary is still incomplete: **81 real violations remain across 6 more directories/files**, none of them in the currently-enforced globs (`Admin/**`, `Galleries/Adapters/**`, `Campaign/**`, `hooks/**`, `packages/shared-ui/src/**`). Closing all of them in one phase — and replacing the ad hoc allow-list with blanket enforcement — is one coherent unit of work; doing it piecemeal just repeats the pattern that triggered this phase.
3. **Success.** `i18next/no-literal-string` is `'error'` for the entirety of `src/**/*.{ts,tsx}` (test/story fixtures exempt) with zero violations, no per-directory allow-list left to maintain, all newly-harvested strings translated into the five shipped locales, and the stale `FUTURE_TASKS.md` entry this phase supersedes is closed out.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Scope boundary | This phase covers the entire remaining front-end, not just admin — supersedes the stale framing in `FUTURE_TASKS.md`'s "Full Admin-Panel i18n Migration" entry (P60-I already completed the admin-specific harvest that entry described; what's left is everything else). |
| B | `AuthBar.tsx` | Sweep its 8 strings in place with local `t()` calls. Do **not** relocate it into `packages/shared-ui/src/` alongside its already-migrated siblings (`AuthBarFloating`/`AuthBarMinimal`) in this phase — that's a file-organization change, not an i18n fix, and would conflate two kinds of diffs. Logged as a Follow-On candidate instead. |
| C | Enforcement mechanism | Once every remaining directory is verified clean, replace the growing per-glob `'error'` override list in `eslint.config.js` with **one blanket `'error'`** for `src/**/*.{ts,tsx}` (keeping the existing test/story `ignores`), rather than appending yet another named glob. This is the terminal state — no future directory needs manual glob registration to be protected. |

## Execution Priority

1. **P61-A / P61-B (trivial + near-zero cost)** — clear the cheap wins first to shrink remaining scope fast; no real translation work, just enablement and a handful of strings.
2. **P61-C → P61-F (real translation work)**, ordered by violation count: `Common/**` (37, headlined by an abandoned partial migration) → `CampaignGallery/**` (18, customer-facing) → `CardViewer/**` (12, customer-facing) → `Auth/AuthBar.tsx` (8).
3. **P61-G (global flip + translation sweep + closeout)** — last; only valid once P61-A–F leave zero violations anywhere in `src/**`.

---

## Track P61-A - Trivial enablement

### Problem

`src/contexts/**` and `src/components/Galleries/Shared/**` render no raw literal JSX text at all (a forced-error lint pass found 0 violations in both), but neither is in the enforced glob — so a future change to either could introduce untranslated strings with nothing to catch it.

### Fix

Add both globs to the enforced list in `eslint.config.js`. No source changes are expected.

### Acceptance criteria

- Both globs are enforced (`'error'`, `jsx-text-only`).
- `npx eslint` scoped to both globs reports 0 violations, confirming the pre-check held.

### Validation

- `npx eslint 'src/contexts/**/*.{ts,tsx}' 'src/components/Galleries/Shared/**/*.{ts,tsx}'` — must be clean with no code changes.

## Track P61-B - Near-zero-cost fixes

### Problem

Three small, low-traffic spots carry a handful of raw strings: `src/components/Settings/SettingsSystemAdminTab.tsx` (1 — a `<code>` sample string), `src/components/ErrorBoundary.tsx` (1 — "Try Again" button), and `src/App.tsx` (4 — idle-timeout warning text, "Stay signed in" button, offline `Alert` copy).

### Fix

- Standard `useTranslation`/`t()` wiring for `ErrorBoundary.tsx` and `App.tsx`; new keys appended to `src/i18n-strings.en.json`.
- For the `SettingsSystemAdminTab.tsx` `<code>` sample: decide `t()` vs. a documented `eslint-disable-next-line`, following the precedent set in P60-I for the taxonomy tree-indent glyph (technical/code tokens are not prose).
- Add all three paths (or their parent dirs) to the enforced glob.

### Acceptance criteria

- All 6 violations resolved or explicitly, documentedly exempted.
- The three paths are enforced going forward.

### Validation

- `npx eslint` scoped to the three files; `tsc -b`; any touched test suites (delegate execution to a Haiku subagent per standing practice).

## Track P61-C - `src/components/Common/**` sweep

### Problem

37 violations across 5 files. `GalleryConfigEditorModal.tsx` accounts for 21 of them — it already imports `useTranslation` and calls `t()` twice, so this is a **partially-started, abandoned migration** to finish (Accordion headers like "Shared Section Sizing"/"Viewport Backgrounds", Menu items like "Reset All Changes", descriptive `<Text>` copy) rather than a fresh one. The remainder: `NearDuplicateWarning.tsx` (8), `TypographyEditor.tsx` (5), `CompanyCombobox.tsx` (2), `ConfirmModal.tsx` (1, a reused "Cancel").

### Fix

- Finish `GalleryConfigEditorModal.tsx`'s migration using its existing `t()` wiring.
- Wrap the remaining 4 files' literals; check for existing reusable msgids before minting new keys (e.g. `ConfirmModal.tsx`'s "Cancel" almost certainly already has a key — same reuse pattern used in the `51969bb5` sweep).
- Add `src/components/Common/**` to the enforced glob.

### Acceptance criteria

- 0 violations in `src/components/Common/**`.
- No duplicate msgids created where an existing key already covers the English string.

### Validation

- `npx eslint 'src/components/Common/**/*.{ts,tsx}'`; `tsc -b`; touched test suites.

## Track P61-D - `src/components/CampaignGallery/**` sweep

### Problem

18 violations across 4 files, none using `useTranslation` — this is customer-facing **public** campaign-gallery UI that appears to have been missed by the original P54-B/P60-G customer-facing harvest despite being customer-facing: `CardGallery.tsx` (7 — "Viewer Header Settings", access-mode tabs/alert copy), `CampaignCard.tsx` (4 — "Access" badge, video/image stat labels), `CardGalleryHostPagination.tsx` (4 — "Page X of Y", "Load more"), `RequestAccessForm.tsx` (3 — email-check copy, "Request Access" button).

### Fix

- Standard `useTranslation`/`t()` wiring across all 4 files; new keys appended to `src/i18n-strings.en.json`.
- Add `src/components/CampaignGallery/**` to the enforced glob.

### Acceptance criteria

- 0 violations in `src/components/CampaignGallery/**`.
- Public-facing pagination/access-request copy renders translated under a non-English locale.

### Validation

- `npx eslint 'src/components/CampaignGallery/**/*.{ts,tsx}'`; `tsc -b`; touched test suites; wp-env spot-check of the public gallery view under a non-English locale.

## Track P61-E - `src/components/CardViewer/CampaignViewer.tsx` sweep

### Problem

12 violations in a single file: "Campaign Header", "Stats Section", Videos/Images/Tags labels, private-campaign / empty-media / loading copy. Sibling files in the same directory (`CampaignGalleryAdapterRenderer.tsx`, `GallerySectionWrapper.tsx`, `PerTypeGallerySection.tsx`, `UnifiedGallerySection.tsx`) are pure dispatch wrappers with 0 violations.

### Fix

- Standard `useTranslation`/`t()` wiring for `CampaignViewer.tsx`.
- Add the whole `src/components/CardViewer/**` directory to the enforced glob once this file is clean (siblings already pass with no changes needed).

### Acceptance criteria

- 0 violations across `src/components/CardViewer/**`.

### Validation

- `npx eslint 'src/components/CardViewer/**/*.{ts,tsx}'`; `tsc -b`; touched test suites.

## Track P61-F - `src/components/Auth/AuthBar.tsx` sweep

### Problem

8 violations — "Admin Panel", "Sign out", and similar chrome strings — in the one file left behind when its siblings (`AuthBarFloating.tsx`, `AuthBarMinimal.tsx`) were extracted into the already-enforced `packages/shared-ui/src/`.

### Fix

Per Key Decision B: wrap the 8 strings with local `t()` calls in place. Do not relocate the file this phase. Add the path to the enforced glob.

### Acceptance criteria

- 0 violations in `src/components/Auth/AuthBar.tsx`.

### Validation

- `npx eslint 'src/components/Auth/**/*.{ts,tsx}'`; `tsc -b`; touched test suites.

## Track P61-G - Global enforcement flip + translation + closeout

### Problem

Once P61-A–F land, every known directory is individually enforced, but the allow-list mechanism itself is still the ad hoc pattern that caused this phase — and every new key harvested across P61-A–F still needs translating into the five shipped locales before it's actually usable internationally.

### Fix

- Replace `eslint.config.js`'s per-glob override list with a single blanket `'error'` for `src/**/*.{ts,tsx}` (keeping the existing test/story `ignores`), per Key Decision C.
- Run a full-repo forced-error lint pass to confirm zero violations anywhere outside exempted test/story fixtures.
- Regenerate the manifest/`.pot` (`npm run i18n:generate`, `wp i18n make-pot`); translate every new msgid into all five shipped packs (**fr_FR, es_ES, de_DE, zh_CN, ru_RU**) via the established deterministic patch pipeline — reuse existing msgids where the English matches, validate `{{var}}`/`%s`/`%d` placeholder parity, 0 empty / 0 mismatches bar; recompile `.mo`/`.l10n.php`; `npm run i18n:check` green.
- Runtime-verify under at least one non-English locale via wp-env (`switch_to_locale` + `__()` probe, same pattern used in the prior two sweep sessions).
- Update `docs/FUTURE_TASKS.md`'s "Full Admin-Panel i18n Migration" entry to reflect closure (P60-I + this phase together fully resolve it) — mark resolved/archive rather than leaving it as an open, now-inaccurate backlog item.

### Acceptance criteria

- `i18next/no-literal-string` (`jsx-text-only`) is `'error'` for the entirety of `src/**/*.{ts,tsx}` — no more per-directory allow-list.
- Zero raw-literal violations anywhere in `src/**` outside exempted fixtures.
- All newly-harvested keys are translated into all five shipped locales with 0 empty/0 placeholder-mismatch; runtime-verified under a live non-English locale.
- `FUTURE_TASKS.md`'s stale i18n entry is closed out.

### Validation

- Full-repo `npx eslint 'src/**/*.{ts,tsx}'`; `npm run i18n:check`; production build (`npm run build:wp`); wp-env runtime spot-check.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Relocate `AuthBar.tsx` into `packages/shared-ui/src/` alongside `AuthBarFloating`/`AuthBarMinimal` | File-organization change, not an i18n fix (Key Decision B) — separate PR to avoid conflating concerns. |
| Native-speaker review of all 5 packs | Standing deferred item from P60-H/I; this phase adds more machine-translated strings to the same packs, same caveat applies. |

## Implementation Notes

- Record completed work at a high level as tracks land. Keep short and factual.

**P61-A + P61-B (landed together):** `contexts/**`, `Galleries/Shared/**`, and the whole `Settings/**` dir were confirmed 0-violation and enrolled in the enforced glob as directories (Settings verified clean beyond just the one tab file). The 6 near-zero-cost strings were wired: `App.tsx` idle-timeout notification (title + message with `{{seconds}}` interpolation + "Stay signed in" button) and offline `Alert` → `app_idle_*` / `app_offline` keys via `useTranslation`; `ErrorBoundary.tsx` (a class component) → `i18n` singleton `i18n.t()` for title/body/retry-aria/"Try Again" (`eb_*` keys), matching the `AuthBarFloating.tsx` precedent for non-hook contexts. `SettingsSystemAdminTab.tsx` `<code>?wpsg_result=…</code>` sample is a literal URL query-string token (surrounding prose already split-translated) → documented `eslint-disable-next-line` per Key Decision B / the P60-I glyph precedent, not a `t()` call. Verified: `npx eslint` (real config) clean on all A/B paths; `tsc -b` clean; `i18n:generate` + `i18n:check` in sync (2482 strings); 43 tests pass across App/ErrorBoundary/Settings suites.

## Outcome

_To be completed once the phase ships._

- What shipped.
- What was deferred.
- What should happen next.
