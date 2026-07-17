# Phase 64 - Access Request, Grants & Auth Correctness

**Status:** Planned
**Created:** 2026-07-14
**Last updated:** 2026-07-16 — full re-verification against current source (see Validation Notes in each track). P64-B's frontend scope expanded: no revoke confirm-dialog existed anywhere in the codebase, so one must be built, not just re-copied. Added P64-G (space-level revoke confirmation, opportunistic addition decided with the user the same day).

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P64-A | Extract a shared grants helper (`WPSG_Grants`) — enabling refactor for P64-B | ✅ Done | Medium |
| P64-B | Split revoke granularity: campaign-scoped vs company-wide (decided) | Planned | Small-Medium PHP + Medium FE |
| P64-C | Access-request email abuse: defer requester confirmation + tighten rate/abuse control (decided) | Planned | Small |
| P64-D | Approved access-request users have no way to log in | Planned | Tiny |
| P64-E | Magic-link inline-HTML fallback served through the JSON encoder | Planned | Small |
| P64-F | `create_user`'s email-failure fallback can never trigger | Planned | Small |
| P64-G | Space-level revoke confirmation (opportunistic UX consistency) | Planned | Tiny |

---

## Rationale

The review ([PHP_REVIEW_FINDINGS.md](PHP_REVIEW_FINDINGS.md)) found that the access-request → grant → revoke lifecycle is functionally complete but has several correctness gaps clustered in the same files (`class-wpsg-access-controller.php`, `class-wpsg-space-controller.php`), plus one already-user-decided scope change (A-14) that is incoherent without touching both PHP and the frontend. All items below were independently re-verified against current source on 2026-07-14.

1. **What triggered it.** A-14 (revoke over-broadness) and B-1 (access-request email abuse) both went through a decision round with the user on 2026-07-13 and already carry resolved scopes — this phase is where those decisions get executed. A-7, A-8, and A-13 are smaller correctness bugs in the same request/notification code paths, discovered in the same review pass.
2. **Why it belongs together.** Every track touches the access-request, magic-link, or grants code in `class-wpsg-access-controller.php` — bundling avoids re-reading the same 700-line file five separate times, and P64-A's extraction directly de-risks P64-B's revoke-logic change.
3. **Success.** Revoking a user from one campaign never silently revokes their company-wide access; the public access-request endpoint can no longer be used to email arbitrary victims; every path that provisions a WP user account also gives that user a way to actually log in; grant expiry/enrichment logic lives in one place instead of four.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Revoke granularity (A-14) | **Decided by user, 2026-07-13.** Revoke from the campaign by default; provide an explicit, separate mechanism for company-wide revoke. Both granularities must exist end-to-end (PHP + frontend) — carried forward verbatim into P64-B. |
| B | Access-request confirmation email (B-1) | **Decided by user, 2026-07-13.** Do both halves: defer the requester-facing confirmation email to the approve/deny step (structural fix — removes the "email any address I type" primitive), and give the endpoint its own tight rate limit + a `wpsg_access_request_precheck` filter seam for CAPTCHA/honeypot (abuse-volume fix). Carried forward verbatim into P64-C. |
| C | Extraction-before-fix ordering | P64-A (grants helper extraction) is sequenced before P64-B (revoke-granularity fix) so the new campaign-vs-company-vs-deny-override logic lands in the shared helper instead of becoming a fourth divergent copy. This is an engineering-sequencing call, not a product decision — flagged here for visibility since it changes P64-B's effective effort (some of its logic moves into P64-A). |

## Execution Priority

**Note added 2026-07-16: this phase should be executed sequentially by a single agent/session on the existing branch, not split across parallel worktrees or agents.** Verified that 5 of the 6 original tracks (A, B, C, D, E) all touch `class-wpsg-access-controller.php` — concurrent edits from separate branches would produce merge conflicts on the same file. "Can run in parallel" below means "does not block on the prior step's *logic*," not "safe to execute concurrently in a separate branch/worktree."

1. **P64-A** — do first; it's pure refactor (no behavior change) and directly reduces the surface P64-B has to touch correctly.
2. **P64-B** — the highest-impact fix in the phase (closes a real privilege-tier leak); build it on top of P64-A's helper.
3. **P64-C** — logically independent of A/B, but do it after B lands (same file, avoids touching `class-wpsg-access-controller.php` mid-flight from two directions at once). Both halves (deferral + rate limit) should land together since the rate limit alone doesn't remove the "attacker chooses the recipient" property.
4. **P64-D, P64-E, P64-F, P64-G** — small, independent, no dependencies on the above; batch together, in any order. (P64-G touches only `SpaceManagementView.tsx`, disjoint from the others — no file-contention concern for it specifically.)

---

## Track P64-A - Extract a shared grants helper (`WPSG_Grants`)

*Source: PHP_REVIEW_FINDINGS.md § C-2 — re-verified 2026-07-14, confirmed accurate. Verification found the expiry-check duplication is wider than the review estimated (9 call sites, not ~4) — same direction, bigger win. Re-verified again 2026-07-16, count corrected from an earlier "8" to the exact 9 (see Problem section for the full list).*

### Problem

Access-grant handling repeats across three storage locations (campaign postmeta, company termmeta, space-table JSON) with three near-identical `upsert_*` implementations (`upsert_grant`, `upsert_override` in `class-wpsg-access-controller.php` at lines 1072/1081; `upsert_space_grant` in `class-wpsg-space-controller.php:634`), the same expiry check (`!empty($e['expires_at']) && strtotime(...) < time()`) copy-pasted at 9 call sites: `class-wpsg-access-controller.php:199,235,1189`; `class-wpsg-rest-base.php:321,406,421`; `class-wpsg-space-controller.php:366`; `class-wpsg-maintenance.php:197,241`. (A tenth, textually similar hit at `class-wpsg-access-controller.php:638` checks `magic_key_expires_at`, not a grant — it's a magic-link key, not a grant, and should stay out of `WPSG_Grants`' scope.) The same `expires_at` ISO-8601 validation error string is duplicated verbatim in three endpoint handlers (`class-wpsg-access-controller.php:268,876`; `class-wpsg-space-controller.php:393`), and near-identical page-sliced user-enrichment blocks exist in `list_access` (`class-wpsg-access-controller.php:205-239`), `list_company_access` (`class-wpsg-access-controller.php:814-843`), and space `list_access` (`class-wpsg-space-controller.php:340-368`). Any future change to grant shape (e.g. adding `granted_by` uniformly) currently touches ~10+ sites.

### Fix

Introduce `WPSG_Grants` (new `includes/class-wpsg-grants.php`) exposing:
- `upsert(array $grants, array $entry)`
- `remove(array $grants, int $user_id)`
- `is_expired(array $entry, ?int $now = null)`
- `filter_active(array $grants)`
- `parse_expiry_param($raw): string|null|WP_Error`
- `enrich_users(array $entries)` for response shaping

Storage stays exactly where it is (postmeta/termmeta/space JSON) — this is pure logic extraction, no schema change.

### Acceptance criteria

- All three `upsert_*` call sites, all 9 grant-expiry-check sites, the three duplicated validation strings, and the three enrichment blocks are replaced with calls into `WPSG_Grants`.
- Zero behavior change: the full existing P28-B/P33/P47/P53 grant test matrix passes unmodified.

### Validation

- Run the full existing access/grants test suite (P28-B, P33, P47, P53 matrices) and confirm no regressions.
- New unit tests directly against `WPSG_Grants` methods (expiry edge cases, malformed `expires_at` input).

### Implementation (2026-07-16) — ✅ Done

- New `includes/class-wpsg-grants.php` exposes `upsert`, `remove`, `is_expired`, `filter_active`, `parse_expiry_param`, `validate_access_level`, and `enrich_users`. Loaded via `class-wpsg-rest.php` (always required on request + cron).
- **Canonical `validate_access_level`.** Moved the access-level enum rule into `WPSG_Grants`; `WPSG_REST_Base::validate_access_level()` now delegates to it (one source of truth, lets `enrich_users` normalise levels without coupling back to REST_Base). No call site changed — the protected method still resolves via `self::`.
- **`is_expired` robustness.** The canonical check treats empty/`'0'`/unparseable `expires_at` as *not expired* (the old inline `strtotime($x) < now` form cast a `false` from an unparseable date to `0`, making garbage look "expired since 1970"). Real grants only ever store `null` or a `gmdate('c')` ISO string, so this is a no-op on real data — confirmed by the full suite staying green.
- **`enrich_users($entries, $with_expiry)`.** The `with_expiry` flag preserves exact output: the company-access list (`list_company_access`) historically omits `is_expired`/`expires_at`, so it passes `false`; campaign and space lists pass `true`.
- **Call sites converted:** all three `upsert_*` private copies removed (`upsert_grant`/`upsert_override` in access-controller, `upsert_space_grant` in space-controller); the three `parse_expiry_param` blocks, the three enrichment blocks, and every grant-expiry check replaced. **Verification found a 10th grant-expiry site the plan's enumeration missed — `class-wpsg-monitoring.php` (expired-grant metric count) — also converted** (so the real footprint was 5 files, not 4). The `magic_key_expires_at` check at `class-wpsg-access-controller.php:600` was deliberately *left* (it's a magic-link key, not a grant).
- **Tests:** `WPSG_P64A_Grants_Helper_Test` (19 tests, 44 assertions) pins every method incl. expiry edge cases + malformed input. Full suite green after a clean wp-env restart: **1185 tests, 13302 assertions, 0 failures** (baseline 1166 + 19 new). *An initial run showed 26 scattered errors across unrelated suites — font/export/cache/webhook — traced to an unhealthy `tests-mysql` container (`add_cap() on false` in setUp); a clean restart cleared them all, confirming zero regressions.*

---

## Track P64-B - Split revoke granularity: campaign-scoped vs company-wide

*Source: PHP_REVIEW_FINDINGS.md § A-14 — re-verified 2026-07-14, all four sub-claims confirmed accurate. Decision already made — see Key Decision A. This track deliberately includes frontend scope; the fix is incoherent without it. Cross-referenced 2026-07-14 against REACT_REVIEW_FINDINGS.md § G, which names `useAccessRows` for the same fix — both hooks are real and compose together (see the note at the end of the Frontend fix section below). Re-verified again 2026-07-16 — see corrections inline below.*

### Problem

`DELETE /campaigns/{id}/access/{userId}` (`revoke_access()`, `class-wpsg-access-controller.php:326-363`) removes a user's grants from **three** stores at once: campaign postmeta, per-campaign overrides, **and company termmeta** — so revoking one campaign silently revokes every campaign of that company. Two aggravating facts, both re-confirmed:

- **The granularity already exists everywhere else.** Granting already supports both scopes (`source: 'company'|'campaign'`), per-campaign deny overrides already exist and are checked *first* in `get_effective_campaign_level()` (**correction, 2026-07-16: this function lives in `includes/rest/class-wpsg-rest-base.php:371`, not `class-wpsg-access-controller.php`**; the admin short-circuit is at lines 382-385, the deny-override check at lines 387-394, immediately after the short-circuit and before any grant lookup — order as originally described, citation corrected), and the frontend (`src/hooks/useAdminAccessState.ts`) already has an `accessSource` picker on grant (line 40) and already calls the company-scoped revoke endpoint (line 160) whenever a company-sourced entry is revoked outside campaign view (company or "all" view). Only the campaign-scoped revoke handler is over-broad.
- **It is a permission-tier inconsistency.** `company.access.revoke` is gated `require_system_admin`, but campaign-scoped revoke (gated `require_campaign_space_access`, reachable by space editors) mutates the same company-level grants — a space editor can currently destroy System-Admin-tier company-wide grants through the side door.

**Semantics subtlety:** for a user whose access comes from a company grant, merely deleting their (non-existent) campaign grant would not remove access. "Revoke from this campaign" for a company-sourced user must write a **deny override** instead (the mechanism already exists and already wins over grants in precedence).

### Fix

*PHP* (`class-wpsg-access-controller.php`, built on P64-A's `WPSG_Grants` helper):
- `revoke_access()`: remove **campaign-level** grants for the user; if (and only if) an active company grant also covers this user, add a per-campaign deny override instead of touching termmeta. Never modify company grants from this endpoint.
- Distinct audit actions (`access.revoked` vs `access.denied_via_revoke` or similar) so the log tells the two apart.
- Company-wide revoke stays exactly where it is (`DELETE /companies/{id}/access/{userId}`, `require_system_admin`) — no change needed; the tier inconsistency disappears once the campaign endpoint stops reaching into termmeta.
- Response tells the client what happened (`{ removed: 'campaign_grant' | 'deny_override_added' }`) so the UI can phrase its confirmation.

*Frontend* (`src/hooks/useAdminAccessState.ts`, `src/hooks/useAccessRows.tsx`, `AdminPanel.tsx`):
- **Correction, 2026-07-16 — scope is bigger than "copy + action wiring only":** verification found there is currently **no confirm dialog at all** for revoke, anywhere. `useAccessRows.tsx`'s trash `ActionIcon` (line 117) calls `onRevokeAccess(a)` directly on click with zero confirmation step. This must be **built new**, not re-copied. The codebase already has an established pattern for this — `modals.openConfirmModal` from `@mantine/modals`, used in `GlobalAssetManager.tsx:67`, `SettingsPanel.tsx:442`, `LayoutBuilder/LayoutBuilderModal.tsx:211`, and `useBuilderDraftRestore.tsx:88` — the new revoke dialog should follow that convention.
- **Decided scope (user, 2026-07-16):** the new confirm dialog covers **every** revoke action in this table, not only the ambiguous company-sourced case. A campaign-sourced entry gets a plain confirm. A company-sourced entry gets copy distinguishing the outcomes: "Block this user on this campaign only (their company-wide access is kept)" — plus a second, visually distinct action "Revoke company-wide…" calling the existing company endpoint (shown only to System Admins, matching the gate).
- The "all" view (per-entry campaign-scoped delete, ~line 162 of `useAdminAccessState.ts`) inherits the same handling.
- The access list already renders `source` per entry (`CompanyAccessGrant.source: 'campaign' | 'company'`, a required field — `src/services/adminQuery.ts:111-125`) — no data-model change needed, only the new dialog + action wiring.
- New i18n strings follow the existing convention: `t('key', 'Default text')` via `react-i18next` (see `accessrow_revoke_company_tip` / `accessrow_revoke_campaign_tip` at `src/i18n-strings.en.json:2584-2585` for the pattern already in use nearby), added to `src/i18n-strings.en.json` and regenerated into the PHP manifest via `scripts/generate-frontend-i18n.mjs`.
- **Cross-referenced 2026-07-14 against the React review, corrected 2026-07-16:** `useAdminAccessState.ts` owns the state/API-call layer (grant/revoke handlers, `accessSource` picker); the per-row revoke *action* lives one layer down in `src/hooks/useAccessRows.tsx` (confirmed via `AdminPanel.tsx:400`'s `useAccessRows({ accessEntries, accessViewMode, onRevokeAccess: accessState.handleRevokeAccess, onChangeRole: accessState.handleChangeRole })` composition) — but the confirm-dialog itself does not yet exist in either file; it is net-new UI, not a "wiring split" between two existing pieces. Both files are in scope: `useAdminAccessState.ts` for the handler-level source/outcome logic, `useAccessRows.tsx` for the dialog trigger and per-row copy.

### Acceptance criteria

- Revoking a company-sourced user from one campaign leaves their company grant intact and their access to every *other* campaign of that company unaffected; they lose access only to the campaign revoked from.
- Revoking a campaign-sourced user removes only their campaign grant.
- A space editor cannot affect company grants via any campaign-scoped endpoint.
- The company-wide revoke endpoint (System-Admin-only) still works unchanged.
- Every revoke action in the campaign/company access table requires confirmation before firing; the dialog copy correctly distinguishes "block on this campaign" from "revoke company-wide" for company-sourced entries.

### Validation

- Extend the P33-C role-enforcement matrix (`tests/WPSG_P33C_Role_Enforcement_Test.php`, currently 374 lines / 18 test methods, no existing revoke coverage): campaign-sourced revoke removes only campaign grant; company-sourced revoke adds override + leaves company grant + other campaigns intact; space editor cannot touch company grants via any campaign endpoint.
- Frontend (Vitest, not Jest — the suite uses `@testing-library/jest-dom` matchers but runs on Vitest): `useAdminAccessState.coverage.test.tsx` already has branch coverage of the three DELETE-endpoint-resolution paths (campaign revoke, company-source-in-company-view, campaign-source-in-company-view) — extend it for the new `{ removed: 'campaign_grant' | 'deny_override_added' }` response shape. `useAccessRows.test.tsx` currently has zero coverage of click→`onRevokeAccess` or any dialog interaction — this is net-new test surface: add tests for dialog-open-on-click, cancel-does-not-call-onRevokeAccess, confirm-does-call-onRevokeAccess, and the copy split by `source`.
- Manual: revoke a company-sourced user from one of their campaigns, confirm they still see the company's other campaigns; then use the separate company-wide revoke and confirm all access is gone; confirm a campaign-sourced revoke also requires confirmation before firing.

---

## Track P64-C - Access-request email abuse: defer confirmation, tighten rate limit

*Source: PHP_REVIEW_FINDINGS.md § B-1 — re-verified 2026-07-14, confirmed accurate. Decision already made — see Key Decision B.*

### Problem

`POST /campaigns/{id}/access-requests` (`submit_access_request()`, `class-wpsg-access-controller.php:398-486`) is public/unauthenticated and sends **two** emails: an admin notification to the fixed `admin_email`, and a confirmation to the **requester-supplied address**, which the code never verifies the caller owns — confirmed. An unauthenticated endpoint that emails an attacker-chosen recipient is a mail-amplification / email-bombing primitive: an attacker can loop through a victim list and make the site send "your access request was received" mail to each one, with (pre-P63-A) no effective rate limiting. Fallout: harassment of arbitrary victims, admin-inbox flooding, and — the more durable cost — mail-reputation damage to the site's own sending domain from bounces/spam-reports, degrading delivery of the site's *legitimate* mail. Confirmed both approve and deny handlers already send their own requester-facing emails independently (`do_approve_request()` at approval; `deny_access_request()` at denial, behind the `wpsg_send_denial_email` filter) — so deferring the pre-approval email doesn't leave requesters uninformed once resolved.

### Fix

- **Structural:** stop sending the requester confirmation on submit. Change the 201 response copy from "check your email for confirmation" to "you'll receive an email once your request is reviewed." The admin notification (fixed recipient) still fires immediately.
- **Rate/abuse:** give the endpoint its own tight limit (e.g. 5/min/IP + a daily per-IP cap on *distinct* emails submitted) and a `wpsg_access_request_precheck` filter so operators can wire a CAPTCHA/honeypot. This depends on P63-A (rate limiting actually working) to be meaningful.

### Acceptance criteria

- Submitting an access request no longer sends any email to the requester-supplied address; only the fixed-recipient admin notification fires.
- The 201 response copy reflects the new "reviewed later" messaging (with matching frontend i18n string update).
- The endpoint has its own rate limit distinct from the generic `rate_limit_public`, and a `wpsg_access_request_precheck` filter hook exists for CAPTCHA/honeypot integration.
- Approval and denial still notify the requester as before (unchanged).

### Validation

- Test: submitting a request no longer triggers a `wp_mail` call to the requester address (mock/assert on `wp_mail` calls).
- Test: the new per-endpoint rate limit trips independently of the generic public limit.
- Manual: submit a request from the public form, confirm the on-page copy and the absence of a requester email; then approve it and confirm the approval email arrives.

---

## Track P64-D - Approved access-request users have no way to log in

*Source: PHP_REVIEW_FINDINGS.md § A-7 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`do_approve_request()` (`class-wpsg-access-controller.php:545-604`) provisions missing users via `wp_create_user($username, wp_generate_password(), $email)` and emails "your access has been approved — visit the site," but never calls `wp_new_user_notification()` or otherwise sends credentials or a reset link. A first-time visitor granted access via the magic-link flow lands on a login form with a password nobody knows and must discover "Lost your password?" on their own. The parallel `create_user` admin endpoint (`class-wpsg-auth-controller.php`) already does this correctly via `wp_new_user_notification($user_id, null, 'user')`.

### Fix

Call `wp_new_user_notification($user_id, null, 'user')` after `wp_create_user()` in `do_approve_request()`, mirroring the existing `create_user` path.

### Acceptance criteria

- A first-time access-request approval sends a password-reset-link notification in addition to the "access approved" email.
- Approving a request for an *existing* user does not trigger a spurious reset-link notification.

### Validation

- Test asserting `wp_new_user_notification` fires for the new-user path and not for the existing-user path.
- Manual: approve an access request for a brand-new email, confirm two emails arrive (approval notice + reset-link notification) and the reset link works.

---

## Track P64-E - Magic-link inline-HTML fallback served through the JSON encoder

*Source: PHP_REVIEW_FINDINGS.md § A-8 — re-verified 2026-07-14, confirmed accurate.*

### Problem

When no landing page is configured, `magic_link_redirect()` (`class-wpsg-access-controller.php:669-705`) returns a `WP_REST_Response` whose *data* is an HTML string (line 702). `WP_REST_Server::serve_request()` JSON-encodes response data by default, so the browser receives a quoted, backslash-escaped blob under `Content-Type: text/html` — a visually broken page. The CSV export in the same codebase (`audit_csv_response()`, `class-wpsg-campaign-controller.php:958-988` — **corrected 2026-07-16 from "952-961"**) already solves an analogous problem correctly via a one-shot `rest_pre_serve_request` filter (registered at lines 973-982) that echoes raw output and bypasses JSON encoding.

### Fix

Reuse the `rest_pre_serve_request` echo pattern for the HTML fallback (or, more simply, always redirect — e.g. to `home_url()` with a `wpsg_result` query arg — and drop inline HTML entirely).

### Acceptance criteria

- Visiting a magic link with no landing page configured renders actual HTML in the browser, not an escaped JSON string.

### Validation

- Manual: clear `magic_link_landing_page_id`, follow a magic link, confirm the fallback page renders correctly.
- If the redirect approach is chosen instead: confirm the redirect target renders the intended message.

---

## Track P64-F - `create_user`'s email-failure fallback can never trigger

*Source: PHP_REVIEW_FINDINGS.md § A-13 — re-verified 2026-07-14, confirmed accurate.*

### Problem

`wp_new_user_notification()` is wrapped in `try/catch (Exception)` (`class-wpsg-auth-controller.php:405-423`), but `wp_mail()` catches PHPMailer exceptions internally and returns `false` rather than throwing — nothing ever throws through this call. `$email_sent` is therefore always `true`, and the reset-URL fallback below it (returned to the client when mail fails) is unreachable on a real mail failure.

### Fix

Hook `wp_mail_failed` around the call (set a flag in a closure, remove the hook after) instead of relying on an exception, or call `wp_mail()` directly and check its boolean return.

### Acceptance criteria

- Simulating a mail-send failure (e.g. via a `wp_mail_failed`-triggering SMTP misconfiguration in a test) results in `$email_sent = false` and the reset-URL fallback being returned to the client.

### Validation

- Test that forces `wp_mail` to fail (filter `pre_wp_mail` to short-circuit failure, or trigger `wp_mail_failed` directly) and asserts the fallback path activates.

---

## Track P64-G - Space-level revoke confirmation (opportunistic UX consistency)

*Source: not in PHP_REVIEW_FINDINGS.md or REACT_REVIEW_FINDINGS.md — surfaced during 2026-07-16 verification of P64-B's frontend claims, and added as its own small track by user decision the same day.*

### Problem

`SpaceManagementView.tsx` has its own independent `handleRevokeAccess` (line 246) and revoke `ActionIcon` (line 468) for space-level access grants — a separate access surface from the campaign/company table that P64-B covers, with no campaign/company source ambiguity of its own. It has the identical gap P64-B found: the destructive action fires immediately on click, with zero confirmation step.

### Fix

Add a `modals.openConfirmModal` confirmation (same `@mantine/modals` convention as P64-B's new dialog — see precedent at `GlobalAssetManager.tsx:67`, `SettingsPanel.tsx:442`, `LayoutBuilder/LayoutBuilderModal.tsx:211`, `useBuilderDraftRestore.tsx:88`) before the space-level revoke fires. No source-branching copy needed — this is a plain confirm, not the campaign-vs-company split P64-B builds.

### Acceptance criteria

- Clicking revoke in the space-access table opens a confirm dialog; the DELETE only fires on confirm; cancel leaves access unchanged.

### Validation

- New Vitest coverage in the relevant `SpaceManagementView` test file for the confirm→delete flow (open-on-click, cancel-does-not-delete, confirm-does-delete).
- Manual: revoke a space-level grant, confirm the dialog appears, cancel and confirm access is still intact, then confirm and verify it's revoked.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full storage-backend unification for grants (single table instead of postmeta/termmeta/space-JSON) | C-2's logic-only extraction (P64-A) captures nearly all the maintenance win without a schema migration; revisit only if the three storage backends themselves become a maintenance burden. |

## Implementation Notes

- Record completed work here as tracks land; nothing executed yet.
- **Orphaned worktree, flagged 2026-07-16:** `.claude/worktrees/agent-ab1b1caa62a012e2e` (branch `worktree-agent-ab1b1caa62a012e2e`) contains a stale duplicate copy of the plugin/frontend source from a prior agent session. It was not used in this validation pass and is unrelated to Phase 64 — flagging so the execution agent edits the canonical tree (`wp-plugin/wp-super-gallery/`, `src/`) and doesn't get confused by the duplicate. Not part of this phase's scope to clean up.

## Outcome

Not started.
