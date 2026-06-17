# PR Review — Phase 52 & Phase 53

**Status:** In Progress
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
| C5 | Service worker & build | Pending | — | — |
| C6 | Dependencies & docs hygiene | Pending | — | — |

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
| C1-3 | 🟠 Med | `wp-super-gallery.php:170` `wpsg_maybe_migrate_roles` | (Carried from C1.) Migration preserves the `manage_wpsg` cap but not *effective* space access. In an open-mode deployment that relied on the now-removed `open + manage_wpsg ⇒ owner` short-circuit, existing editors lose space access on upgrade until an admin re-grants. | **Flag** | An automatic grant-backfill would be **wrong** in delegated installs (it would over-permission every editor on every space). No universally-safe auto-fix exists. Resolution: document the post-upgrade re-grant step in release notes / the QA plan, and consider a one-time admin notice (feature, not a review fix). | doc only |
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

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| _pending_ | | | | | | |

---

## C6 — Dependencies & docs hygiene

| ID | Sev | Location | Finding | Disposition | Rationale | Fix |
|----|-----|----------|---------|-------------|-----------|-----|
| _pending_ | | | | | | |
