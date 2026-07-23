# Phase 72 — Manual QA & Validation Runbook

**Companion to:** [PHASE72_REPORT.md](PHASE72_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand — exact preconditions, commands, expected results, the reasoning that makes each result *meaningful*, and the pitfalls that silently invalidate a test. It follows the format of [PHASE71_MANUAL_QA_RUNBOOK.md](PHASE71_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P72-A … P72-G. Phase 72 is a **mixed-domain hardening** phase — unlike P71 (single-arc React efficiency), the tracks here span PHP (privacy, settings, shortcode) and React (i18n, a11y, refactor), and several are **real behaviour/content changes** (a new admin notice, DSAR flows, translated strings, a11y fixes), not pure refactors. So the verification shape differs per track and is stated explicitly in each section. This doc is built **incrementally as each track lands** — a section is added when the corresponding fix is committed, not all at once up front.

**Golden rule (unchanged from P63–P71):** a fix's test is only meaningful if you have also seen it **fail without the fix**, *or* you understand precisely why the pre-fix and post-fix code are behaviourally equivalent. For a behaviour-change track (most of P72), the operative check is the first clause — the new test must be red on the pre-fix source. The cleanest way to watch a track fail by hand is to diff against the pre-phase commit:

```bash
git log --oneline | grep -iE 'p72|phase72'      # find the P72 commits
git checkout <commit-before-the-track>           # e.g. the Phase 71 archive commit
# …run the step / suite, observe the pre-fix behaviour…
git checkout feature/<phase72-branch>            # back to the fixes
```

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| The PHPUnit suite via the `/php-testing` skill (wp-env, WSL nvm Node 20, `npx @wordpress/env`) | The **primary** proof for the PHP tracks (C, D, and later B, F). See the `project_phptest_wpenv_env` note. |
| The Vitest suite (`npm test`) + type-checker (`npx tsc -b`) + `npm run lint` | Primary proof for the React tracks (A, G, E). |
| `npm run i18n:check` + `npm run i18n:check:locales` | For any track adding user-facing strings (A, D's notice string, G). |
| Local `wp-env` dev site (`npx @wordpress/env start`, base URL `http://localhost:8888`) | For the *optional* live checks (an admin viewing a stale shortcode for D; a DSAR flow for B; a locale switch for A). |

**Personas / auth.** Two tiers matter this phase, per the P52-A RBAC model:
- **System Admin** — `administrator` + `manage_wpsg` + `manage_options`. Can write system (admin-only) settings.
- **Space Editor** — `wpsg_editor` role: `manage_wpsg` but **not** `manage_options`. Can write display/campaign settings but not system ones.

See §2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md) for creating each.

---

## 2. Mental model — what actually changed

| Track | The change | Observable at runtime? |
|---|---|---|
| P72-C | `update_space_settings()`'s global-key write now routes through the shared `guard_admin_only_settings()` (promoted to `WPSG_REST_Base`). An admin-only global key written by a non-`manage_options` caller returns a `wpsg_forbidden_settings` 403 instead of being silently dropped; a non-admin-only global key is written (consistency with `/settings`). | **Yes (by response status)** — an editor's admin-only global write is now 403, not a silent 200. |
| P72-D | `resolve_space_id()` reports (via a new out-param) when an explicit `space=`/`campaign=`/`company=` reference fell back to the default because it did not resolve; `render_shortcode()` emits a `manage_wpsg`-gated inline notice in that case. | **Yes** — an admin viewing a page whose shortcode points at a deleted/mistyped space now sees an inline notice; visitors never do; omitting the attribute shows nothing. |
| P72-B | New `WPSG_Privacy` registers WP core personal-data exporters/erasers. Access-requests (visitor emails): exporter + eraser. Audit-log (staff usernames): exporter ONLY (legitimate-interest exemption). | **Yes** — Tools → Export/Erase Personal Data now returns/erases gallery data; audit-log appears under Export but never under Erase. |
| P72-F | Two opt-in retention windows (`access_requests_retention_days`, `audit_log_retention_days`, default 0) drive weekly cron purges of the two PII tables, plus admin NumberInput controls in Settings → Advanced → Data Maintenance. | **Yes** — a configured window purges old rows weekly; 0 keeps forever; the controls are settable in the admin UI. |
| P72-A | ~30 hardcoded strings (a11y `announce()`, draft-restore modal chrome, adapter-import validator errors, an external-media error fallback) routed through `i18n.t`; the `wpsg/no-untranslated-notification` gate widened to also guard `announce()` + `openConfirmModal` chrome. | **Yes** — those strings now render translated on a non-English locale; a new hardcoded `announce()`/modal-chrome string now fails `npm run lint`. |
| P72-G | `LayoutTemplateList` icon-only view-toggle segments gained visually-hidden accessible names; the grid card stopped being a `role="button"` wrapping the menu button — the primary action is now a real `UnstyledButton` with the menu as a sibling. A new axe test gates the component. | **Screen-reader only** — the view-toggle now announces "Grid view"/"List view"; the card is no longer a button-in-a-button. No visible change. |

*(Row for P72-E is added as that track lands.)*

---

## 3. Track-by-track

---

### P72-C — Space-panel global-key write returns an explicit 403

**What & why.** `update_settings()`/`patch_settings()` (the `/settings` write paths) return an explicit `wpsg_forbidden_settings` 403 via `guard_admin_only_settings()` when a non-`manage_options` caller writes a system (admin-only) key. `update_space_settings()`'s global-key branch instead **silently dropped** those keys (`if (!empty($global_input) && current_user_can('manage_options'))` with no `else`). P72-C unifies the boundary: `guard_admin_only_settings()` moved from `private` on `WPSG_Settings_Controller` to `protected static` on `WPSG_REST_Base`, and the space controller now routes its global-key branch through it, **before any write** (so a rejected request applies nothing — no partial override write). Chosen behaviour is **option 1A** (full consistency with `/settings`): editors can write the 98 non-admin-only global keys via the space panel (they already can via `/settings`), and only the 29 admin-only keys 403.

**Pre-fix behaviour.** An editor (`manage_wpsg`, no `manage_options`) writing *any* global key via `PUT /spaces/{id}/settings` got a **200** with the global keys silently discarded — no error, no write, no signal.

**This track's meaningful check is failure-first** — the rewritten `WPSG_P57A_Settings_Split_Save_Test` methods assert the new 403 / write behaviour, which cannot hold on the pre-fix source (pre-fix an editor's admin-only global write returned 200 and changed nothing).

**Verification (primary — automated).**
```bash
# via the /php-testing skill:
tests/WPSG_P57A_Settings_Split_Save_Test.php   # 2 new methods: editor non-admin write succeeds; admin-only write 403s
tests/WPSG_P52A4_Settings_Split_Test.php       # regression: /settings 403 behaviour unchanged after the guard moved
tests/WPSG_Settings_Rest_Test.php              # regression: settings REST paths
tests/WPSG_P47_Spaces_Settings_Test.php        # regression: space-settings paths
```
`test_editor_gets_403_on_admin_only_global_via_space_panel` sends a mixed payload (`theme` overridable + `cacheTtl` admin-only) as an editor, asserts a **403** with `code == 'wpsg_forbidden_settings'`, and asserts **neither** the admin-only global (`cache_ttl` unchanged) **nor** the overridable key (`theme` absent from the space override) was applied — proving the guard runs before any write and the request is atomic. `test_editor_may_write_a_non_admin_global_key_via_space_panel` sends `theme` + `settingsPanelAnimation` (a non-admin global) and asserts a **200** with the global actually written — proving the 1A consistency case.

**Why it proves the fix.** The two new methods bracket the exact boundary the fix defines: admin-only globals → 403 (was silent drop), non-admin globals → written (was silent drop). The P52A4 regression proves promoting `guard_admin_only_settings()` to the base class left the `/settings` 403 behaviour byte-identical (the `self::` call sites resolve to the inherited method). Confirmed: 64 tests / 376 assertions green across the five files.

**Optional live check.** On the dev site, sign in as a **Space Editor**, open a space's Settings panel, and — with DevTools → Network open — save a change. An editor UI hides the System & Admin tab, so a normal save sends only overridable keys (200, no notice). To exercise the 403 path you must craft the request (e.g. `curl`/console `fetch` a `PUT /wp-super-gallery/v1/spaces/{id}/settings` body containing `cacheTtl`) — confirm a 403 `wpsg_forbidden_settings`, and that `GET /settings` still shows the old `cache_ttl`. This is an edge/hardening path, not a normal-UI flow, so the automated test is the real proof; the live check is only for peace of mind.

**Regression checks.** `WPSG_P52A4_Settings_Split_Test`, `WPSG_Settings_Rest_Test`, `WPSG_P47_Spaces_Settings_Test` all green unmodified. The overridable-key write path (the common case) is untouched.

**Pitfall.** The guard must be checked **before** the override write, not after — otherwise a rejected admin-only write would still have persisted the overridable keys in the same request (a partial apply). The test's `assertArrayNotHasKey('theme', …)` after a 403 is exactly the assertion that catches a misordered guard. Also: do **not** guard on `array_keys($snake_input)` (all keys) — guard on `array_keys($global_input)` (the global branch only); overridable keys are legitimately writable by space admins and are never admin-only, so the two happen to be equivalent here, but guarding the global branch reads correctly and stays correct if the key sets ever change.

---

### P72-D — Admin notice on an unresolved shortcode space reference

**What & why.** `WPSG_Embed::resolve_space_id()` resolves an explicit `space=`/`campaign=`/`company=` attribute and, when the target does not exist, silently falls through to `wpsg_default_space_id` — no admin-facing signal (the confirmed Phase 62 QA case: three shortcodes for three deleted spaces silently collapsed onto the default, confusing to diagnose). P72-D adds a `bool &$unresolved` out-param to `resolve_space_id()`, set true **only** when at least one explicit attribute was given *and* every resolution path failed (so the default fallback was taken). `render_shortcode()` captures it and, via the new `render_unresolved_space_notice()` helper, emits a `manage_wpsg`-gated inline notice naming the stale reference — placed outside the full-bleed wrapper, before the mount node, routed through `__()`/`esc_html()` (text domain `wp-super-gallery`).

**Pre-fix behaviour.** A shortcode with a stale explicit reference rendered the default-space gallery with **no** notice for anyone — the fallback was invisible.

**This track's meaningful check is failure-first** — the new admin-notice assertion cannot hold on the pre-fix source (the notice HTML did not exist), and the "no notice when omitted / for visitors" assertions guard the two false-positive directions.

**Verification (primary — automated).**
```bash
# via the /php-testing skill:
tests/WPSG_Embed_Test.php   # 4 new P72-D methods
```
The four new methods pin all four corners of the behaviour:
- `test_unresolved_explicit_space_shows_admin_notice` — admin (`manage_wpsg`) + `space="deleted-space-xyz"` → output contains `wpsg-shortcode-notice` **and** names the stale ref, and the gallery div still renders.
- `test_unresolved_explicit_space_hidden_from_visitor` — anonymous visitor + same stale ref → **no** `wpsg-shortcode-notice`, gallery still renders (default space).
- `test_omitted_space_reference_shows_no_notice_even_for_admin` — admin, no attribute → **no** notice (the intentional-default case is not an error).
- `test_resolved_explicit_space_shows_no_notice` — admin + a **valid** `space=` slug → **no** notice (no false positive on a good reference).

**Why it proves the fix.** The four cases are the full truth table of the out-param logic: (explicit ∧ unresolved) × (admin ∨ visitor), plus the omitted case and the resolved case. The admin-visible + visitor-hidden pair proves the `manage_wpsg` gate; the omitted + resolved pair proves the notice fires *only* on a genuinely stale explicit reference, never on the intentional default or a good ref. Confirmed green (22 tests / 37 assertions in the file).

**Live check (recommended — this is a real user-visible change).** On the dev site, reproduce the original Phase 62 scenario directly:
1. Create a page with `[super-gallery space="acme"]` pointing at an existing space; confirm it renders with no notice.
2. Delete (or rename) the `acme` space so the slug no longer resolves.
3. Reload the page **as a System Admin** → the inline notice appears above the gallery, naming `space="acme"`, and the gallery still renders (default space).
4. Reload **as a logged-out visitor** (or a non-`manage_wpsg` user) → **no** notice; the gallery renders normally.
5. Edit the shortcode to omit the attribute entirely (`[super-gallery]`) → **no** notice even as admin (intentional default).

**i18n check.** The notice string uses WP's `__()` with text domain `wp-super-gallery`. Confirm it is picked up by the plugin's `.pot` regeneration (`wp i18n make-pot` or the project's string-extraction step) so translators can localize it — it is a *PHP/WordPress* string, so it goes through the WP `.pot`, **not** the front-end `src/i18n-strings.en.json` catalogue that `npm run i18n:check` guards.

**Regression checks.** All pre-existing `WPSG_Embed_Test` methods pass unmodified — the notice is additive and only prepends output in the narrow (admin ∧ explicit ∧ unresolved) case; every other render path returns the same HTML as before.

**Pitfall.** The out-param must be set true **only** at the final default-fallback return **and only** when an explicit attribute was given — not on every default. The precedence subtlety is the trap: if `space=` is stale but `campaign=` resolves, the function returns early in the campaign branch with `$unresolved` still false (correct — a lower-priority reference succeeded, so nothing is stale). A naive "any time we hit the default" flag would false-positive whenever the attribute was simply omitted; a naive "space didn't resolve" flag would false-positive when a lower-priority attribute saved the resolution. The `test_omitted_…` and `test_resolved_…` methods are precisely the guards against those two mistakes — do not delete them thinking they're redundant with the positive case.

---

### P72-B — WordPress core privacy integration (DSAR export/erase)

**What & why.** The plugin stored visitor emails (`wp_wpsg_access_requests`) and staff usernames (`wp_wpsg_audit_log`) but registered no WP core personal-data exporters/erasers, so DSAR requests were a manual SQL/WP-CLI chore. P72-B adds `WPSG_Privacy` (hooked on `init`), registering: an **access-requests exporter + eraser** (both keyed on email, case-insensitive) and an **audit-log exporter with NO eraser**. The audit-log erasure exemption is the deliberate decision — an audit trail is a legitimate-interest record (GDPR Art. 6(1)(f)/17(3)(b)); a self-service erase reachable only when the requester's email matches their own `actor_login` must not let someone erase the record of their own privileged actions. Time-boxed retention (P72-F) bounds the audit log instead.

**Pre-fix behaviour.** Tools → Export/Erase Personal Data returned/erased nothing from the plugin; a DSAR meant hand-written SQL.

**This track's meaningful check is failure-first for the registration + behaviour** — the new registration/exporter/eraser assertions cannot hold on the pre-fix source (no `WPSG_Privacy` existed), and the "no audit eraser" assertion encodes the exemption decision as an explicit, regression-proof contract.

**Verification (primary — automated).**
```bash
# via the /php-testing skill:
tests/WPSG_P72B_Privacy_Test.php   # 9 methods
```
The **decision-locking** methods: `test_both_exporters_are_registered` (audit IS exportable) and `test_only_access_requests_eraser_is_registered` (audit is **not** in the eraser registry — `assertArrayNotHasKey('wpsg-audit-log', …)`). The **behaviour** methods exercise each callback against seeded rows: access-request export returns only the subject email's rows (case-insensitively), the eraser deletes only the subject's rows (another email's survive), and the audit exporter returns the matching user's rows — including a **legacy-shaped row** (`actor_id = 0`, matched by `actor_login`) — and returns empty+done for an email that maps to no WP user.

**Why it proves the fix.** The two registry assertions prove the export/erase *asymmetry* is real and can't silently regress (a future dev adding an audit eraser fails the test). The callback tests prove each path returns/removes exactly the right rows and nothing else — the core DSAR-correctness property. Confirmed: 9 tests / 21 assertions green.

**Live check (recommended — real admin flow).** On the dev site: seed an access request (submit one as a visitor for a private campaign) and perform a couple of audited admin actions while logged in as a user whose email you know. Then Tools → **Export Personal Data** for that email → the report contains a *WP Super Gallery — Access Requests* group and a *WP Super Gallery — Audit Log* group. Then Tools → **Erase Personal Data** for the same email → the access-request rows are removed, and note the audit-log group is **absent from the eraser** (it was export-only). Re-run Export → the access-request group is now empty, the audit-log group still present.

**Regression checks.** No existing behaviour changed — `WPSG_Privacy` is purely additive (new class, new filters, new DB read/delete-by-email helpers). The existing audit/access-request read/write paths are untouched.

**Pitfall.** (1) The audit exporter must match on **either** `actor_id` **or** `actor_login` — legacy rows carry only the login, newer rows carry the id; matching only one silently misses half the history. The `..._matches_by_actor_login_when_id_absent` test guards this. (2) Do **not** add an audit-log eraser "for completeness" — its absence is the whole point of the track; the `test_only_access_requests_eraser_is_registered` assertion will (correctly) fail if you do. (3) The exporter must page (`done === count(rows) < PAGE_SIZE`) — returning `done: true` unconditionally would truncate a subject with more than `PAGE_SIZE` (100) rows.

---

### P72-F — Opt-in retention purge for the PII tables (+ admin UI)

**What & why.** `wp_wpsg_access_requests` (emails) and `wp_wpsg_audit_log` (usernames) grew unbounded — no purge job. P72-F adds two **opt-in** retention windows (`access_requests_retention_days`, `audit_log_retention_days`, both default **0 = never purge**, so existing installs are never surprised), each driving a weekly cron purge (`purge_old_access_requests` / `purge_old_audit_log`, batched `DELETE` keyed on `requested_at` / `created_at`) that mirrors the analytics job exactly. Both hooks are in the canonical `wpsg_get_cron_hooks()` list so they're cleared on deactivate/uninstall. Because the mirrored analytics-retention setting has a React admin control, matching **NumberInput controls** were added to Settings → Advanced → Data Maintenance (scope addition decided with the user), with the two keys added to the `GallerySettings` type + defaults and 4 new i18n strings translated across all 5 locales.

**Pre-fix behaviour.** No purge job for either table; rows accumulated forever, and there was no admin control to configure retention.

**This track's meaningful check is failure-first** — the purge methods didn't exist pre-fix, so the "old rows removed, recent rows survive" assertions can't hold on the pre-fix source; and the opt-in (zero-window) case guards against an accidental always-on purge.

**Verification (primary — automated).**
```bash
# via the /php-testing skill:
tests/WPSG_P72F_PII_Retention_Test.php   # 6 methods
tests/WPSG_Cron_Hooks_Test.php           # updated: the 2 new hooks in the canonical list
# front-end:
npx tsc -b
npm run i18n:check && npm run i18n:check:locales   # 4 new strings × 5 locales
```
The purge methods are proven by seeding a 90-day-old and a 5-day-old row in each table, setting a 30-day window, running the purge, and asserting exactly the old row is gone and the recent one (identified by email/`actor_login`) survives. The **opt-in** methods seed a 9999-day-old row with a **zero** window and assert the purge removes nothing. The **scheduling** methods assert `register()` schedules each hook when its window > 0 and clears it when 0.

**Why it proves the fix.** The old-removed/recent-kept pair proves the window boundary is applied correctly (not "delete all" and not "delete none"); the zero-window pair proves the opt-in default is safe (the criterion that this ships off by default); the scheduling pair proves the cron wiring matches the analytics precedent. Confirmed: 6 tests / 12 assertions green, plus `WPSG_Cron_Hooks_Test` green (the canonical-list count assertion catches a missing hook).

**Live check (recommended — the admin UI + a real purge).** On the dev site as a System Admin: Settings → Advanced → **Data Maintenance** shows the two new controls (*Access-Request Retention*, *Audit-Log Retention*), each defaulting to 0. Set one to e.g. 1 (day), save, and confirm the value round-trips (reload). Seed an old row (or wait), then trigger the cron (`wp cron event run wpsg_access_requests_purge` / `wpsg_audit_log_purge`, or `wp cron event run --due-now`) and confirm old rows are gone while recent ones remain. Switch the site to a non-English locale and confirm the two control labels/descriptions render translated (they were added to all 5 `.po` and recompiled to `.mo`/`.l10n.php`).

**Regression checks.** `WPSG_Maintenance_Test` and the settings tests pass unmodified — the new settings are additive (they don't shift any existing key), and the new cron hooks don't touch the existing jobs. The two new UI controls are appended to an existing accordion panel; `tsc`/ESLint clean.

**Pitfall.** (1) The retention windows **must** default to 0 and treat 0/negative as "never purge" — an accidental non-zero default (or treating 0 as "purge everything") would silently destroy PII on every existing install's next cron run. The zero-window tests are the guard; keep them. (2) Both hooks **must** be in `wpsg_get_cron_hooks()` (and its test's expected list) — omit one and it leaks a scheduled event past deactivation/uninstall. (3) The i18n binaries (`.mo`/`.l10n.php`) must be **recompiled** from the `.po` after adding the strings — `i18n:check:locales` reads the `.po` and will pass without recompiling, but the non-English runtime falls back to English until the binaries are rebuilt (`wp i18n make-mo` / `make-php`).

---

### P72-A — Non-notification strings routed through i18n + widened gate

**What & why.** P71-E's gate only guarded notification `title`/`message`. Four surfaces sat outside it, hardcoded English: an external-media error fallback (`useMediaExternal.ts`), a11y `announce()` calls (`useLayoutBuilderAssets.ts`), a pure validator's error strings surfaced as `message: result.error` (`useGalleryAdapterSettingsIO.ts`), and draft-restore modal chrome (`useBuilderDraftRestore.tsx`). P72-A routes all four through `i18n.t('key', 'English default')` and **widens the lint gate** to two new sinks — `announce()` first-arg literals and `modals.openConfirmModal` `title`/`labels` — so those categories can't regress. Widening `announce()` forced a repo-wide sweep (the gate is `error` everywhere): ~20 additional hardcoded `announce()` strings in `LayoutBuilderModal.tsx` + `useLayoutBuilderKeyboardHandlers.ts` were swept too (user chose the full sweep). Two categories stay manually-swept by design (documented in the rule header): helper-fallback args and validator-return literals — ESLint can't see through a function call.

**Pre-fix behaviour.** On a non-English site these strings rendered in English regardless of locale; a hardcoded `announce()` or modal-chrome string passed lint silently.

**Unlike the pure refactors, this is a real content + tooling change** — verification borrows the P71-E shape: a locale-switch manual check plus a deliberately-introduced-violation test for the two new gate sinks. **Failure-first** for the gate (the 4 new gate-test cases fail on the pre-widen rule); **behaviour-equivalence** for the swept strings themselves (each `t('key', 'English default')` keeps the exact original English, so the 3764-test suite passes unmodified).

**Verification (primary — automated).**
```bash
npx vitest run src/test/noUntranslatedNotification.gate.test.ts   # 10 cases (4 new)
npm run lint                 # widened gate green repo-wide — proves the whole sweep is complete
npm run i18n:check           # en source ↔ PHP manifest in sync
npm run i18n:check:locales   # 32 new keys translated in all 5 locales (2379/locale)
npx tsc -b
npm test                     # full suite green (English defaults unchanged)
```
The gate test's new cases: a hardcoded `announce('…')` flags (1), a `t()`-wrapped `announce()` passes (0), a hardcoded `openConfirmModal` `title` + `labels.confirm` + `labels.cancel` flag (3), and a fully `t()`-wrapped modal passes (0).

**Why it proves the fix.** `npm run lint` green is the strongest signal — because the gate is now repo-wide `error` for all three sinks, a green lint means *every* `announce()`/notification/modal-chrome literal in `src/**` is routed through `t()` (an unswept one would fail the build). `i18n:check:locales` green proves the 32 new keys are translated in all 5 locales, not English-only. The full suite passing unmodified proves the swept strings kept their exact English defaults (behaviour-equivalence). The gate test proves the widened rule catches the next regression in the two new sinks.

**Manual check (recommended — real user-visible behaviour).** Switch the site to a non-English locale (e.g. `de_DE`, with the recompiled `.mo`/`.l10n.php` present) and, in the Layout Builder: upload an overlay/background (screen-reader announcement, inspect via the devtools accessibility tree / live region), trigger a keyboard action like copy/paste slots (pluralized announcement), open the draft-restore modal (title/body/buttons + the "N minutes ago" age label), and import a malformed adapter-settings JSON (the validator error toast). Confirm each renders German, then switch back to English and confirm the exact original wording.

**Deliberate-violation manual check (the gate).** Add `announce('temp hardcoded');` (or `modals.openConfirmModal({ title: 'temp' })`) to any `src/**` file, run `npm run lint`, confirm it fails with `wpsg/no-untranslated-notification`; remove it and confirm green.

**Regression checks.** All existing hook/component tests pass unmodified (English defaults unchanged); the `.po`/`.mo`/`.l10n.php` for the 5 locales gained the new entries; `.pot` + PHP manifest regenerated.

**Pitfall.** (1) Widening `announce()` is all-or-nothing under an `error` gate — you cannot fix "just the in-scope 3" and leave the other ~20; lint fails until every one is swept (that's why the sweep grew). (2) The two documented ESLint limitations are real: a fallback inside `getErrorMessage(err, '…')` and a validator's `return { error: '…' }` are **not** caught — those were translated by hand and a future dev adding such a string won't be caught by the gate (see the rule header). (3) Reused pluralized keys (`lbkbd_copied`, `draftrestore_age_minutes`) need **both** the base (`_one`/singular) and `_other` forms in en.json + every locale — a missing `_other` renders the singular for N>1. (4) The `.mo`/`.l10n.php` must be recompiled from the `.po` (the `i18n:check:locales` gate reads `.po` and passes without recompiling, but the non-English runtime falls back to English until the binaries are rebuilt).

---

### P72-G — Fix the two known `LayoutTemplateList` axe violations + gate it

**What & why.** The jsdom axe harness (`expectNoA11yViolations`) had flagged two `LayoutTemplateList` issues during the P62-H rollout that were never fixed (and, it turned out, never had a committed test). **(a)** the icon-only view-toggle `SegmentedControl` segments have no accessible name (`label`, critical); **(b)** a `role="button"` template Card nests the action Menu button (`nested-interactive`, serious). P72-G fixes both and adds a committed axe test gating the component.

**The plan's nuance — resolved by running the test first.** The `SegmentedControl` already carried a *group-level* `aria-label`, so it was unprovable from the code whether the individual segments still flagged. The axe test was **written and run against current source before any fix** — and confirmed **both** violations still reproduce (a group `aria-label` does not name the individual segment radio inputs). So both fixes were real, not speculative.

**The fixes.** (a) each segment wraps its icon with a `<VisuallyHidden>` i18n'd name ("Grid view"/"List view"), giving the radio input an accessible name; the group `aria-label` stays. (b) the Card is no longer `role="button"` — the primary edit action is a real `UnstyledButton` (native `<button>`) around the preview + title, and the Menu is an absolutely-positioned sibling (top-right), so no interactive nests inside another.

**Pre-fix behaviour.** Screen readers announced the view toggle segments with no name (just "radio button"); the card was a button containing a button (ambiguous focus/activation). No *visible* change either way.

**This track's meaningful check is failure-first** — the axe test was confirmed **red** (2 violations) on pre-fix source and **green** after; that is the whole proof, per the golden rule.

**Verification (primary — automated).**
```bash
npx vitest run src/components/Admin/LayoutTemplateList.a11y.test.tsx   # grid + list views, both green
npx vitest run src/components/Admin/LayoutTemplateList                 # all 18 tests (incl. the updated render test)
npx tsc -b
npm run i18n:check && npm run i18n:check:locales   # the 2 new accessible-name keys (already-translated msgids)
```
The a11y test gates **both** views: grid (covers the SegmentedControl toolbar + the grid card) and list (the Table). Confirmed red→green: on pre-fix source it reports `2 accessibility violation(s)` (`label` ×2 segments + `nested-interactive`); post-fix, zero.

**Why it proves the fix.** axe reproduces the exact WCAG failures the fix targets; a green run means the segments now have names and no interactive control nests in another. The updated render test (`click` instead of `keyDown(Enter)`) proves the primary action still works as a native button.

**Live check (recommended — this is screen-reader behaviour, invisible visually).** In the Layout Builder template list: with a screen reader (VoiceOver/NVDA), Tab to the view toggle and confirm each segment announces "Grid view" / "List view" (not an unnamed radio). Tab through a template card and confirm the card body is announced as one "Edit layout {name}" button and the "Actions for {name}" menu is a separate button — not a button inside a button. Visually confirm the card looks unchanged (menu top-right, click card body to edit).

**Regression checks.** All 18 `LayoutTemplateList` tests green; full 3766-test suite green (the restructure is contained to one component). The one behavioural test change (`keyDown`→`click`) reflects the improved semantics, not a regression.

**Pitfall.** (1) A group-level `aria-label` on a `SegmentedControl` does **not** satisfy the `label` rule for its individual segments — each option needs its own accessible name (the visually-hidden text). Don't "fix" this by only adding/adjusting the group label. (2) The menu must be a real DOM **sibling** of the primary button, not a descendant — an absolutely-positioned child that is still inside the `UnstyledButton` in the DOM would re-introduce `nested-interactive` (and make clicking the menu also trigger edit). (3) After removing the Card's manual `onKeyDown`, don't assert keyboard activation with `fireEvent.keyDown` — a native `<button>` activates on `click` in jsdom; keyboard is the browser's job. (4) Scope: this track fixes only the two known violations — do not treat `LayoutTemplateList` as "fully audited" or extend the gate to other components here (that stays in FUTURE_TASKS.md).

---

### P72-E — Split AdminPanel tabs into re-render-isolated child components (incremental; **Audit landed**)

**What & why.** `AdminPanel.tsx` (~925 lines) held every tab's selection state inline, so changing (say) the audit-tab campaign selector set state on `AdminPanel` and re-rendered the *entire* panel — the campaigns table, the media toolbar, every memo. Option (b) of the track splits each data tab into a child component that owns its own selection state, so a selection change re-renders only that child. Delivered **incrementally, one panel per commit**; this commit is **AuditPanel** (the least-coupled tab, done first). Access and Media remain follow-ups.

**Corrected foundation (the handoff's assumption was wrong for this stack).** The plan assumed Mantine `Tabs.Panel` unmounts inactive panels, so moving state into a child would give fetch-gating "for free" via mount/unmount. This repo is **Mantine v9** (`keepMounted: true`, `keepMountedMode: "activity"`) on **React 19** — inactive panels stay **mounted** (wrapped in `<Activity mode="hidden">`, which preserves state but tears down effects; `env="test"` skips Activity entirely, so all panels' children render in tests). So fetch-gating stays an **explicit `active` prop** (`activeTab === 'audit'`) threaded into `useAuditEntries`, exactly as the inline code did. Nothing about *when* data fetches changed.

**What moved.** `AuditPanel.tsx` now owns `auditCampaignId` + `auditFilters`, calls `useAuditEntries`/`useAuditRows`, runs the default-to-first-campaign effect, and runs the once-per-mount audit prefetch. `AdminPanel` renders `<AuditPanel key={selectedSpaceId} active={activeTab === 'audit'} apiClient=… campaignSelectData=… zipTransfers=… />`. The `key={selectedSpaceId}` remounts the child on space change — that is what now resets the audit selection (the shared `selectedSpaceId` reset effect dropped only its `setAuditCampaignId('')` line; it still resets the inline media/access atoms).

**Behaviour preserved (the acceptance criteria).** (1) space-change reset → `key` remount; (2) default-to-first-campaign → mount-time effect in the child; (3) prefetch-once → ref-guarded effect (now once per child mount rather than once per AdminPanel lifetime — equivalent, arguably cleaner); (4) inactive tabs don't fetch → the `active` prop gates the query. No user-visible change.

**Pre-refactor behaviour to compare against.** Functionally identical: pick the audit tab, pick a campaign, see its activity; change the space and the audit campaign resets to the new space's first campaign; CSV/ZIP export use the current selection + filters. The *only* difference is internal (fewer re-renders).

**Verification (primary — automated).**
```bash
npx vitest run src/components/Admin/AuditPanel.test.tsx   # 4 tests: default-select+fetch, inactive no-fetch, parent-isolation
npx vitest run src/components/Admin/AdminPanel.test.tsx    # 3 existing tests, unchanged, green
npx tsc -b
npx eslint src/components/Admin/AuditPanel.tsx src/components/Admin/AdminPanel.tsx
```
The **isolation test is the "only meaningful under (b)" assertion**: a stable-prop parent harness renders `<AuditPanel>`; the child's mount-time default-select drives an audit fetch (proof its own state changed), yet the parent's render count stays exactly `1`. Under option (a) — hook extraction with the state still living in `AdminPanel` — that default-select would have bumped the parent. The fetch-gating test (`active={false}` ⇒ no `/audit` request) proves the mount-stays-mounted correction didn't leak fetches.

**Live check (recommended).** In the admin panel: Campaign Activity tab → confirm the first campaign is auto-selected and its activity loads; switch campaigns and confirm the table updates; change the space dropdown and confirm the audit campaign resets (to the new space's first). Confirm CSV/ZIP export still download for the current selection + filters. Switch to another tab and back — no double-fetch, selection retained.

**Regression checks.** All 3 existing `AdminPanel` tests pass unmodified; full front-end suite green. The diff is contained to `AdminPanel.tsx` (state/hook/effect removals + one child render) and the new `AuditPanel.tsx` — no shared hook or query changed.

**Pitfall.** (1) Do **not** rely on Mantine v9 `Tabs.Panel` unmounting inactive tabs — it doesn't (`keepMounted` defaults true); keep the explicit `active` prop for fetch-gating. (2) `addMediaCampaign` is **not** a Media-tab-local atom (its setter feeds `useCampaignsRows` on the Campaigns tab and its modal renders at the panel root) — it must stay in `AdminPanel` when Media is split next. (3) The Access split is the heavy one: `accessState` drives two **root-level** modals (`ArchiveCompanyModal`, `QuickAddUserModal`) that must move *into* the child, or the isolation is lost. (4) Scope: this commit lands only Audit; Access + Media are separate follow-up commits.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P72-C | New P57A editor tests green (403 on admin-only global, write on non-admin global; confirmed red pre-fix) | P52A4 / Settings_Rest / P47 Spaces_Settings unchanged | ☑ (automated; live 403 edge-check optional, not run) |
| P72-D | 4 new Embed tests green (admin sees notice, visitor doesn't, omitted/resolved show none; confirmed red pre-fix) | Existing Embed tests unchanged | ☑ (automated; live stale-shortcode check optional, not run) |
| P72-B | Privacy tests green (both exporters registered, audit eraser absent, callbacks return/erase correct rows; confirmed red pre-fix) | Additive — no existing behaviour changed | ☑ (automated; live DSAR admin-flow check optional, not run) |
| P72-F | Retention tests green (old purged, recent kept, zero-window no-op, scheduling; confirmed red pre-fix); tsc + i18n gates green | Maintenance/settings tests unchanged; cron-hooks list test green | ☑ (automated; live UI + cron purge check optional, not run) |
| P72-A | Gate test 10/10 (4 new sink cases; confirmed red on pre-widen rule); lint green repo-wide (whole sweep complete); i18n gates green (32 keys × 5 locales) | Full 3764-test suite green unmodified (English defaults unchanged) | ☑ (automated; non-English locale-switch check optional, not run) |
| P72-G | New a11y test green (grid + list; confirmed red pre-fix — 2 violations) | All 18 LayoutTemplateList tests + full 3766-test suite green | ☑ (automated; live screen-reader check optional, not run) |
| P72-E | AuditPanel isolation test green (parent renders once despite child state change; only meaningful under option b); fetch-gating test green | 3 existing AdminPanel tests unchanged; full front-end suite green | ◐ (Audit sub-panel landed; Access + Media are follow-up commits — see PHASE72_REPORT.md → Batch 5) |

**Automated baseline (must be green alongside manual QA):** the PHPUnit suite via `/php-testing` for the PHP tracks; `npx tsc -b`, `npm test`, `npm run lint` for the React tracks. See PHASE72_REPORT.md → each track's section for per-track rationale.
