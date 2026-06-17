# PR Review — Phase 52 & Phase 53

**Status:** ✅ Complete
**Created:** 2026-06-17
**Last updated:** 2026-06-17
**Branch under review:** `feat/phase52-admin-features-and-enhancements` (vs `main`)
**Scope:** Correctness + security (real bugs, RBAC bypasses, gating gaps, edge
cases, and report claims the code/tests don't back). Pure style nits skipped.

This is a self-review of the committed Phase 52 + Phase 53 work before merge. It
follows the spirit of `git-address-comments` (triage each finding accept/reject/flag
with a rationale, commit + push fixes) minus the PR-thread mechanics. The running
finding log lives here; the PHASE reports get pointer lines and any doc-claim
corrections.

### Chunks

| Chunk | Area | Status | Findings | Fix commit |
|-------|------|--------|----------|------------|
| C1 | RBAC core: permissions map & REST primitives | ✅ Done | 0 fixes (2 obs.) | none (sound) |
| C2 | Role setup/migration & REST controllers | ✅ Done | 1 doc fix (+1 flag) | pending |
| C3 | Frontend tier plumbing & gating | ✅ Done | 0 fixes | none (sound) |
| C4 | Frontend features (assets, tags/cats, delete-confirm, access) | ✅ Done | 1 defensive fix | pending |
| C5 | Service worker & build | ✅ Done | 0 fixes | none (sound) |
| C6 | Dependencies & docs hygiene | ✅ Done | 0 fixes (+2 notes) | none (sound) |

**Severity:** 🔴 High (security/correctness bug) · 🟠 Medium (real bug, narrow blast
radius) · 🟡 Low (edge case / robustness) · 🔵 Doc (report claim vs code).
**Disposition:** Accept (fix) · Reject (won't fix, with reason) · Flag (needs user call).

---

## C1 — RBAC core: permissions map & REST primitives

**Files:** `includes/class-wpsg-permissions.php`, `includes/rest/class-wpsg-rest-base.php`,
`includes/class-wpsg-rest.php`.

**Verdict:** RBAC core is sound. The MAP is fail-closed (unknown action → deny in
both `check()` and the `gate()` closure), `actor_has_tier` maps the three tiers
correctly, the `can_view_campaign` reorder (P53-B) is safe, and the batch gate has no
parse-disagreement bypass. No code fixes accepted in C1; two observations recorded.

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| C1-1 | 🟡 Low | `rest-base.php:557` `user_can_access_campaign_space` vs `get_effective_campaign_level:353` | The new helper falls back to the **default space** when a campaign has no `_wpsg_space_id`; `get_effective_campaign_level` does **not** (it skips the space gate and grants `manage_wpsg ⇒ owner`). So for a space-less campaign with a configured default space, an editor without a default-space grant can *view* (manage_wpsg bypass in `can_view_campaign`) but not *edit* (`require_campaign_space_access` denies). | **Reject** | Not exploitable — the active gate is the *stricter* of the two, and the looser path feeds only the now-deprecated `require_campaign_*` gates. Narrow: only campaigns lacking `_wpsg_space_id`, which the P47 backfill eliminates. Documented here for awareness. | — |
| C1-2 | 🔵 Doc | `get_effective_space_level:280` removal of open-mode short-circuit | After removing `open-mode + manage_wpsg ⇒ owner`, `isolation_mode` ('open'/'delegated') no longer affects editor access resolution anywhere in `includes/` (grep-confirmed) — both modes now require explicit grants for editors. The field is effectively vestigial for the editor tier. | **Reject** | Intended per P53-A two-tier model; not a bug. Flagged so a follow-up can decide whether to retire/relabel `isolation_mode` in the space UI. | — |
| C1-3 | 🟠 Med | cross-cutting → C2 | Removing the open-mode short-circuit means existing `wpsg_editor` (ex-`wpsg_admin`) users in **open-mode** deployments lose effective space access on upgrade unless the migration backfills grants. Must verify `wpsg_maybe_migrate_roles` preserves *effective* access, not just the `manage_wpsg` cap. | **Flag → resolve in C2** | The enabling change is in C1 but the fix/verification is in the migration (C2). | see C2 |

---

## C2 — Role setup/migration & REST controllers

**Verdict:** Migration is idempotent + flag-gated; the editor wp-admin redirect
excludes AJAX and leaves REST untouched; the A4 settings per-key guard is correct
(both sides snake_case — verified `from_js` output keys vs `$admin_only_fields` — so
the intersection genuinely catches system keys; runs pre-persistence, atomic); A5c
delete guards return 404/409/`force` correctly; `count_asset_associations` is
whitelist-checked + prepared; the gate↔MAP wiring is a clean 119↔119 bijection (the
only stray `gate('foo.bar')` is the docblock example); public reads enforce
`can_view_campaign`; `list_campaigns` restricts the unscoped view to `manage_options`
and `list_spaces` filters before a per-user-keyed cache write; access/auth enums +
`isSystemAdmin` tier signal are correct. One comment fix applied; C1-3 resolved as a
documentation recommendation.

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| C1-3 | 🟠→✅ | `wp-super-gallery.php:170` `wpsg_maybe_migrate_roles` | (Carried from C1.) Migration preserves the `manage_wpsg` cap but not *effective* space access; on an open-mode upgrade, existing editors that relied on the now-removed `open + manage_wpsg ⇒ owner` short-circuit lose access until re-granted. | **Resolved (user, 2026-06-17)** | App is **not in production**, so the upgrade scenario is moot. Verified **new editors are unaffected**: the intended provisioning is role + explicit space grant, and a granted `wpsg_editor` passes `require_campaign_space_access` in *both* isolation modes (the grant level is irrelevant — editing comes from the role). The only behavioral nuance is that in open mode the role alone no longer confers access (a space grant is now required) — by design (P53). No code change. | none |
| C2-1 | 🔵 Doc | `class-wpsg-embed.php:503,535` | Two comments said a `wpsg_editor` sees "open + granted-delegated spaces," implying open-mode spaces are visible without a grant — contradicts the C1 open-mode removal (grants now required in *either* mode). Misstates the security model in security-relevant code. | **Accept** | Comment-only fix; reworded to "spaces it has been granted access to (in either isolation mode)." Behavior unchanged (`current_actor_can_access_space` was already correct). | this commit |

---

## C3 — Frontend tier plumbing & gating

**Verdict:** Clean — no code findings. `resolveRole`/`AuthContext` derive the tier
correctly (`isSystemAdmin ⟹ isAdmin` holds since an administrator carries both caps).
The `isAdmin` *redefinition* (now editor-or-above) is safe: its **only** derivation
point was `App.tsx` (`role === 'admin'` → context `isAdmin`), and every system-only
surface was migrated to `isSystemAdmin` — Import (menu/button/modal), media binary
ZIP export+import, Rescan All, System Audit (tab + panel + persisted-tab reset),
all-campaign analytics totals/top, Access company/all, create-space, Settings
Integrations + System tabs, and font delete. All three hard-403 queries
(`useAccessSummary`, `useGlobalAuditEntries`, `useAnalyticsSummary`) take an `enabled`
arg wired to `isSystemAdmin`. New `isSystemAdmin` props all default to `false`
(fail-closed UI). `ApiError.data` plumbing is backward-compatible (optional ctor arg)
and feeds the C4 409-force flow.

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| — | — | — | No correctness/security findings. UI gating is defense-in-depth over server-side enforcement; a missed gate would be a UX error (control 403s), not a leak. | — | — | — |

---

## C4 — Frontend features

**Verdict:** Sound. Both 409→force flows (GlobalAssetManager, LayoutTemplateList) read
the in-use count at the correct `err.data.data.inUse` path, park state, and resend
`force: true`. The tags `string → string[]` migration updated all 4 form touch points
(type, `emptyForm`, `openForEdit` load, save) with no stale split/join — remaining
`.tags.join()` calls are on the `Campaign` model (always `string[]`). Asset mutation
hooks invalidate the library cache and thread `force`. The `main.tsx` asset-admin
mount branch is correctly ordered. AccessTab company/all toggle is `isSystemAdmin`-
gated and the role dropdown is viewer-only (P53-D3); `accessViewMode` is non-persisted
`useState('campaign')`, so an editor can't carry a stale system-only mode (the
persisted-tab reset was only needed for `activeTab`). One defensive fix applied.

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| C4-1 | 🟡 Low | `src/services/api/assetsApi.ts:55,60` | `update()`/`delete()` interpolated the asset `id` into the URL **without** `encodeURIComponent`, unlike the sibling `layoutTemplatesApi.deleteLayoutTemplate`. | **Accept** | Not an active bug — asset ids are `wp_generate_uuid4()` (URL-safe) — but un-encoded interpolation in URL-building code is fragile if the id format ever changes, and it diverged from the sibling API. Added `encodeURIComponent` to both; zero-risk (no-op on UUIDs). 43 targeted tests green. | this commit |

---

## C5 — Service worker & build

**Verdict:** Clean — no findings; verified end-to-end. The fetch-handler restructure
preserves every prior guard: method!=GET, cross-origin, wp-login, and wp-admin all
return before the new navigate branch (wp-admin now short-circuits *all* its paths,
not just navigations). `handleNavigationRequest` is network-first, caches only
`response.ok` (no error/redirect/opaque caching), clones before returning, and falls
back to exact-URL cache → inline `OFFLINE_HTML`. `activate` now also preserves
`SHELL_CACHE`, so a new build's hash sweeps the stale shell. The Vite plugin is
`apply:'build'` + `enforce:'post'` + try/catch, and `build.manifest: true` is set (the
plugin's manifest dependency is satisfied). **Build run:** `npm run build` green;
`dist/sw.js` shows `BUILD_HASH = '106839da'` with **zero** `__WPSG_BUILD_HASH__`
placeholders left, while `public/sw.js` source correctly retains the placeholder for
the next build. Vitest-4 pool config (`minForks`/`maxForks` top-level) validated by
the green 2386-test baseline.

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| — | — | — | No correctness/security findings. | — | — | — |

---

## C6 — Dependencies & docs hygiene

**Verdict:** Clean. `package.json` carries `vitest`/`@vitest/coverage-v8` `^4.0.0`
(matching majors) + the `overrides.esbuild >=0.28.1`. Resolved lock: vitest 4.1.9,
esbuild **0.28.1 deduped across all instances** (override effective), dompurify 3.4.10,
fast-uri 3.1.2, postcss 8.5.15, vite 6.4.3 — every advisory threshold met.
**`npm audit` → 0 vulnerabilities** (the push-time "11 vulnerabilities" warning is on
`main`, which lacks these fixes). Doc moves are committed cleanly: `object-cache-setup.md`
→ `docs/setup/`, `PHASE51_REPORT.md` → `docs/archive/phases/`, with no dangling
*active* links.

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| C6-1 | 🔵→✅ | `docs/PHASE52_REPORT.md:3,523` | Header said `Status: In Progress` and Outcome `_Pending_` though all 7 tracks are ✅ Done. | **Resolved (user, 2026-06-17 — QA good)** | User confirmed manual QA is good. Set `Status: ✅ Done`, bumped Last updated, and wrote the Outcome section. | this commit |
| C6-2 | 🔵 Doc | `docs/archive/phases/PHASE39_REPORT.md:549,700` | Two prose references to the old `docs/object-cache-setup.md` path remain after the move to `docs/setup/`. | **Reject** | These are historical records inside an *archived* phase report (a past review log), not active navigation. Editing archived history to chase a moved file would be revisionist. Left as-is. | — |

---

## Summary

**Reviewed:** all of Phase 52 (A–G) + Phase 53 (A–D) across 6 chunks — RBAC core,
role migration + REST controllers, frontend tier plumbing/gating, frontend features,
service worker/build, and deps/docs. Focus: correctness + security.

**Headline: the security-critical RBAC work is sound.** The `WPSG_Permissions` MAP is
fail-closed with a clean 119↔119 gate↔route bijection; the `can_view_campaign` reorder
(P53-B) preserves private/draft/schedule isolation while fixing public visibility; the
A4 settings per-key guard genuinely blocks system keys (snake_case both sides); A5c
delete guards + `force` are correct; `list_campaigns`/`list_spaces` scoping is
per-user-cached and restricts the unscoped view to `manage_options`; the frontend
`isAdmin` redefinition is safe (single derivation point, every system surface
`isSystemAdmin`-gated, hard-403 queries `enabled`-gated); the SW restructure preserves
all guards and the deploy-hash injection works end-to-end; deps are at fix thresholds
with `npm audit` clean.

**Fixes applied (2, both low-risk):**
- C2-1 — corrected two `class-wpsg-embed.php` comments that misstated the open-mode
  access model (security-relevant doc). Commit `3819c528`.
- C4-1 — `encodeURIComponent` on asset ids in `assetsApi` update/delete (defensive,
  consistency with sibling API). Commit `860bd6e7`.

**Flagged for the author (no code change):**
- C1-3 / 🟠 — open-mode editors lose effective space access on upgrade (the migration
  preserves the cap, not grants). No safe auto-backfill exists; document the re-grant
  step / add a one-time admin notice.
- C6-1 / 🔵 — finalize `PHASE52_REPORT.md` Status + Outcome once manual QA signs off.

**Verification (all run 2026-06-17, via Haiku subagents):**
- **PHP PHPUnit** (wp-env/Docker): **1037 tests, 12970 assertions, 0 failures, 2 skipped** (exit 0) — confirms the reports' claim and that the C2 comment change broke nothing.
- **ESLint** (`npm run lint`): **0 problems** (exit 0).
- **Vitest** (`npm run test:coverage`): **2396 tests pass** (2386 baseline + 10 new for `assetsApi`). `npm run build` green with the SW build-hash injected; `npm audit` 0 vulns.

**Coverage gate — now GREEN (2026-06-17).** At review start the configured thresholds
(lines/statements/functions 75, branches 72) were failing: functions 72.15%, branches
66.76% (statements/lines passed). On user direction ("push to pass the gate"), the
suite was extended with **hand-authored** tests (Haiku subagents were used only to
*run* tests, not write them — they produced unreliable assertions). Final
`npm run test:coverage` is **exit 0**: **Statements 82.63% · Branches 72.06% ·
Functions 78% · Lines 84.82%** — all four thresholds met (suite ~3115 tests).

New test files added (all hand-authored): `assetsApi`, `slotEffects`,
`apiClient.delegation`, `galleryConfigUtils(+adapters)`, `useMediaDimensions`,
`useTypographyStyle`, `adminApi`, `validation`, `groupGeometry`, `layerList`,
`campaignGalleryOverrides`, `galleryConfig`, `useUnifiedCampaignModal`,
`useAdminCampaignActions`, `useAdminAccessState`, `adminQuery`,
`useLayoutBuilderState`, `LayoutTemplateList`, `MediaUploadController`,
`layoutTemplateQuery`. The gate is **not** wired into `npm test`/pre-push (those run
`vitest run` without `--coverage`); run `npm run test:coverage` to enforce it.
