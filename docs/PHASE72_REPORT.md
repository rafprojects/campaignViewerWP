# Phase 72 - Mixed-Domain Hardening: i18n Gaps, Privacy, Permissions & Refactoring

**Status:** All 7 tracks landed 2026-07-23
**Created:** 2026-07-23

### Tracks

| Track | Domain | Description | Status | Effort |
|-------|--------|-------------|--------|--------|
| P72-A | React / i18n | Non-notification user-facing strings still bypass i18n | ✅ Done | Medium (grew: full announce() sweep) |
| P72-B | PHP / Privacy | WordPress Core Privacy Integration (DSAR export/erase) | ✅ Done | Medium |
| P72-C | PHP / Settings | `update_space_settings()` silently drops global keys instead of returning 403 | ✅ Done | Tiny |
| P72-D | PHP / Shortcode | Admin notice on unresolved shortcode space reference | ✅ Done | Small |
| P72-E | React / Refactor | `AdminPanel.tsx` remaining tab-state extraction (P70-H remainder) | ✅ Done (option b; 3 child panels) | Medium-Large |
| P72-F | PHP / Privacy + React UI | Retention / auto-purge for PII tables (access-requests, audit-log) | ✅ Done | Small-Medium |
| P72-G | React / a11y | Structural a11y (axe) gate — fix the 2 known `LayoutTemplateList` violations | ✅ Done | Small (this slice) |

---

## Rationale

P72-A is a direct, verified follow-up from the Phase 71 PR review pass ([PHASE71_REPORT.md → "PR Review & Fix Pass (2026-07-23)"](PHASE71_REPORT.md)) — that review found four user-facing string surfaces sitting outside the `wpsg/no-untranslated-notification` gate P71-E shipped, documented as deliberate follow-ups rather than fixed on the spot.

P72-B through P72-G are promoted from the [FUTURE_TASKS.md](FUTURE_TASKS.md) backlog. Selection criteria: independently boundable (no multi-phase dependency chains), already well-scoped in the backlog doc (concrete files, a stated Problem, a stated Fix direction), and deliberately spanning both PHP and React so the phase isn't single-domain — matching the "mixed domains" framing this phase was scoped under. Every file/line reference below was re-verified against current source during planning (2026-07-23); none had drifted.

Two backlog items considered and set aside as **not** promoted, worth naming for the record:
- **`CardGallery` full server-driven host pagination** (Phase 68 follow-on) and **Google Fonts self-host** (Phase 69 follow-on) — both explicitly conditional ("revisit if X becomes a real requirement") in their own deferral rationale, not actionable now. Backfilled into FUTURE_TASKS.md (they had never been recorded there) rather than promoted.
- **`ApiClient` facade → namespaces** and **promote inline sub-components** (Phase 70-E/I follow-ons) — both explicitly framed as opportunistic/incremental ("start whenever convenient," "as each file is next touched"), not bounded phase deliverables. Also backfilled into FUTURE_TASKS.md rather than promoted.

1. **What triggered it.** P72-A closes a gap this session's own review pass found and documented. P72-B–G were sourced from a fresh sweep of FUTURE_TASKS.md, prompted by a recollection that some work recommended-but-deferred in Phases 68–70 might never have made it into that backlog doc — confirmed true (see the two bullets above); the gap is now closed regardless of what gets promoted.
2. **Why it belongs together.** None of these seven items share code. All are independently shippable, no-dependency-chain work pulled opportunistically from review/backlog findings — the same "batch unrelated but individually-valuable fixes into one phase" shape as Phase 71 and the PHP Phase 63–67 arc, deliberately mixing domains this time rather than staying single-arc.
3. **Success.** All four non-notification i18n surfaces render translated; a WP admin can fulfil a DSAR request through core tooling instead of manual SQL; a permission boundary that silently drops writes today returns an explicit error instead; an admin sees a signal when a shortcode's space reference has gone stale instead of a silent fallback; `AdminPanel.tsx`'s tab-selection state moves out of the 927-line file (scope decided explicitly, not assumed); the two known PII tables have an opt-in purge path; the two known `LayoutTemplateList` axe violations are fixed.

## Execution Priority

No cross-track dependencies. Suggested order, batched by domain/size:

1. **P72-C, P72-D** — tiny/small PHP quick wins in the same REST/shortcode layer; batch together.
2. **P72-B, P72-F** — the two Privacy & Compliance items; natural to design together (same domain, adjacent files).
3. **P72-A** — self-contained i18n sweep, same shape as P71-E.
4. **P72-G** — contained a11y fix (2 known violations only).
5. **P72-E** — do last: the largest diff, and requires the (a)-vs-(b) scoping decision (hook extraction only vs. real re-render isolation via child-component split) made explicit before starting, not assumed mid-implementation.

---

## Track P72-A - Non-notification user-facing strings still bypass i18n

*Source: [PHASE71_REPORT.md → "PR Review & Fix Pass (2026-07-23)"](PHASE71_REPORT.md) — findings deliberately left unfixed in that pass, out of P71-E's notification-literal scope.*

### Problem

P71-E's sweep and its `wpsg/no-untranslated-notification` lint gate only guard `notifications.show`/`notifications.update`/`showNotification` `title`/`message` literals. Four surfaces sit outside that guard and remain hardcoded English:

1. `setExternalError(getErrorMessage(err, 'Failed to load preview.'))` in `src/hooks/useMediaExternal.ts` (~line 99) — the identical text *is* translated one line below in the sibling `showNotification` call, but the inline error string rendered via `AddExternalMediaModal`'s `externalError` prop is not.
2. a11y `announce()` calls in `src/hooks/useLayoutBuilderAssets.ts` (`'Overlay uploaded and added to canvas'`, `'Background image uploaded and applied'`) — screen-reader-only live-region text, invisible to any i18n lint mode in use.
3. `validateImportPayload`'s error strings, surfaced via `notifications.show({ message: result.error })` in `src/hooks/useGalleryAdapterSettingsIO.ts` — a pure validator's return value (a `CallExpression`), invisible to the notification-literal rule by design (documented as a known limitation in the rule's own header comment).
4. Draft-restore modal chrome (title/body/button labels) in the `modals.openConfirmModal` call in `src/hooks/useBuilderDraftRestore.tsx` — distinct from the notification toasts P71-E already translated in that same file.

### Fix

Route all four through `i18n.t('key', 'English default')`, the same pattern P71-E used (`useBuilderDraftRestore.tsx` and `useLayoutBuilderAssets.ts` already import `i18n` for their P71-E fixes, so wiring is minimal).

**Decided (2026-07-23 planning — gate scope: partial widen).** Widen the `wpsg/no-untranslated-notification` gate to also catch (2) `announce()` literal arguments and (4) `modals.openConfirmModal` chrome (`title`/`labels.confirm`/`labels.cancel`) — both are the same mechanical AST shape the existing rule already handles (a known-function call with a literal argument/property), cheap to add, and genuine regression risks (screen-reader-only text is invisible to visual QA; modal chrome is trivially re-hardcoded). Do **not** widen for (1) helper-fallback args (e.g. `getErrorMessage(err, 'literal')`) or (3) validator-return-value literals: (1) would require hardcoding specific helper names into the rule (fragile; the rule header already disclaims this) and (3) needs interprocedural data-flow analysis ESLint cannot do. Those two stay manually-swept, documented as intentional non-goals in the rule header.

### Acceptance criteria

- All four identified surfaces render translated text on a non-English locale.
- A decision on lint-gate scope is recorded (even if the decision is "leave as manually-swept, documented in the rule header").

### Validation

- `npm run i18n:check` + `npm run i18n:check:locales` green after the new keys are added and translated across all 5 reference locales.
- Manual non-English locale check: trigger an invalid external-media URL (surface 1), an overlay/background upload and inspect the live region via the devtools accessibility tree (surface 2), a malformed adapter-settings JSON import (surface 3), and an open draft-restore modal (surface 4) — confirm each renders in the active locale.

---

## Track P72-B - WordPress Core Privacy Integration (DSAR export/erase)

*Source: [FUTURE_TASKS.md](FUTURE_TASKS.md) → Privacy & Compliance, flagged there as the highest-value item in that section. Origin: [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) P60-E, surfaced while auditing data handling for `PRIVACY.md`. Re-verified 2026-07-23: `wp_privacy_personal_data_exporters`/`erasers` are not registered anywhere in the plugin.*

### Problem

The plugin stores visitor emails (`wp_wpsg_access_requests.email`) and staff usernames (`wp_wpsg_audit_log`) but registers no `wp_privacy_personal_data_exporters`/`erasers`, so admins cannot fulfil data-subject access/erasure requests via WordPress core's **Tools → Export/Erase Personal Data**. Today this is a manual SQL/WP-CLI process, documented as such in `PRIVACY.md §5`.

### Fix

Register exporters/erasers keyed on email (`wp_wpsg_access_requests`) and username (`wp_wpsg_audit_log`), following the standard WP core privacy-tools contract (`wp_privacy_personal_data_exporters` / `wp_privacy_personal_data_erasers` filters).

### Acceptance criteria

- A DSAR export request for a known email surfaces the visitor's access-request records via **Tools → Export Personal Data**.
- An erase request removes or anonymizes the matching access-request rows.
- **Decided (2026-07-23 planning — audit-log is export-only, exempt from erasure).** Register a `wp_privacy_personal_data_exporters` callback for `wp_wpsg_audit_log` (a DSAR export includes a staff member's own logged actions) but **no eraser** for it. Rationale: audit/accountability logs are a legitimate-interest exception to erasure (GDPR Art. 6(1)(f) / 17(3)(b)) — the log's whole purpose is to show who did what, and a self-service erase reachable only when the requester's email matches their own `actor_login` would let someone erase the record of their own privileged actions. `wp_wpsg_access_requests` (visitor emails, no accountability purpose) gets **both** an exporter and an eraser — full DSAR support, no exemption. This asymmetry must be documented explicitly in code + `PRIVACY.md`, not left implicit.

### Validation

- Manual: WP core's own Tools → Export/Erase Personal Data admin flow against a wp-env site with seeded access-request rows.
- PHP test exercising the exporter/eraser callbacks directly against seeded rows (no live email-confirmation flow needed for the unit-level check).

### Files

New privacy-tools registrations (`wp_privacy_personal_data_exporters` / `_erasers` filter callbacks); `class-wpsg-db.php` for the underlying queries against `wp_wpsg_access_requests` / `wp_wpsg_audit_log`.

---

## Track P72-C - `update_space_settings()` silently drops global keys instead of returning 403

*Source: [FUTURE_TASKS.md](FUTURE_TASKS.md) → Settings & Admin UI, deferred from P67-D (2026-07-19 planning verification). Re-verified 2026-07-23 against current source — the in-code comment at `class-wpsg-space-controller.php:462-466` already points at this backlog entry, confirming the gap is still live and self-documented.*

### Problem

`update_settings()`/`patch_settings()` (`wp-plugin/wp-super-gallery/includes/rest/class-wpsg-settings-controller.php:69-113`) return an explicit 403 via `guard_admin_only_settings()` (`:128-141`) naming the blocked fields when a non-`manage_options` caller attempts to write admin-only keys. `update_space_settings()`'s global-key branch (`class-wpsg-space-controller.php:467-475`) instead **silently drops** those keys: `if (!empty($global_input) && current_user_can('manage_options'))` has no `else` branch, so an unauthorized write to a global key via the space panel simply vanishes with no error surfaced to the caller. P67-D deliberately preserved this inconsistency to stay a pure no-behavior-change refactor.

### Fix

**Decided (2026-07-23 execution, option 1A — full consistency with `/settings`):** route the space panel's global-key branch through the shared `guard_admin_only_settings()` guard, exactly like `update_settings()`/`patch_settings()`. `guard_admin_only_settings()` was promoted from `private` on `WPSG_Settings_Controller` to `protected static` on the shared base `WPSG_REST_Base` so all three write paths call the same method.

**Why 1A over the stricter alternative (1B):** an investigation during implementation found a **98-key gap** — keys that are global (non-overridable) but *not* admin-only (advanced-display settings: `settings_panel_animation`, `image_border_radius`, breakpoints, etc.). Crucially, `/settings` is gated `require_admin` = `manage_wpsg`, so an **editor already can write all 98 non-admin-only globals via `/settings` today**; only the 29 admin-only keys 403 there. The space panel silently dropping *all* global keys was therefore an *accidental inconsistency*, not a deliberate policy. 1A makes the space panel identical to `/settings` (editors write non-admin globals; admin-only globals 403) — granting editors no capability they lack elsewhere, just closing the anomaly. The stricter 1B (any global key via the space panel needs `manage_options`) was considered and rejected because it would perpetuate the inconsistency. The guard runs **before any write**, so a rejected request applies nothing (no partial override write).

### Acceptance criteria

- A non-`manage_options` caller writing an **admin-only** global key via the space panel receives the same explicit `wpsg_forbidden_settings` 403 as `/settings`. ✅
- A non-`manage_options` editor writing a **non-admin-only** global key via the space panel succeeds (consistency with `/settings`). ✅
- No more silent data loss on this permission boundary. ✅
- The `P57A` editor test was rewritten to encode the new behavior (was: "200 + silent drop"; now: two cases — non-admin global succeeds, admin-only global 403s).

### Validation

- PHP test: call `update_space_settings()` as a `manage_wpsg`-only (non-`manage_options`) user attempting a global-key change; assert the new explicit error response.
- Existing space-settings PHPUnit coverage stays green — no change to the overridable-key write path.

### Files

`wp-plugin/wp-super-gallery/includes/rest/class-wpsg-space-controller.php` (`update_space_settings()`), `class-wpsg-settings-controller.php` (`guard_admin_only_settings()`), `class-wpsg-rest-base.php` (`write_global_settings()`).

---

## Track P72-D - Admin notice on unresolved shortcode space reference

*Source: [FUTURE_TASKS.md](FUTURE_TASKS.md) → Settings & Admin UI, origin Phase 62 QA (2026-07-06). Re-verified 2026-07-23 against current `resolve_space_id()` (`class-wpsg-embed.php:424-465`) — the silent fallback to `wpsg_default_space_id` at line 464 is confirmed live and unchanged.*

### Problem

`WPSG_Embed::resolve_space_id()` resolves an explicit `space=`/`campaign=`/`company=` shortcode attribute and, when the target does not exist, silently falls through to `wpsg_default_space_id` with no admin-facing signal. Confirmed real-world case from Phase 62 QA: a page with three `[super-gallery space="…"]` shortcodes (originally three distinct spaces) silently collapsed all three onto the default space after the referenced spaces no longer existed — confusing to diagnose because nothing indicated the fallback had occurred.

### Fix

In `resolve_space_id()`, distinguish "an explicit attribute was given but did not resolve" from "the attribute was omitted" (the latter is an intentional default, not an error condition). In `render_shortcode()`, emit a `manage_wpsg`-gated inline notice on that gallery instance when the fallback was taken due to an unresolved *explicit* reference — never shown to visitors, never shown when the attribute was simply omitted.

### Acceptance criteria

- An admin viewing a page with a shortcode pointing at a deleted/renamed/mistyped space sees an inline notice explaining the fallback (e.g. *"This gallery references a space that no longer exists — showing the default space."*).
- Visitors never see the notice.
- Omitting `space=`/`campaign=`/`company=` entirely (the intentional-default case) triggers no notice.

### Validation

- PHP test seeding a shortcode with a non-existent space id/slug; assert the notice renders in an admin-capability render context and does not render in a visitor context.
- Manual QA reproducing the original Phase 62 scenario directly: delete a referenced space, reload the page as an admin (notice visible) and as a visitor (no notice, gallery renders normally with the default space).

### Files

`wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php` (`resolve_space_id()` to distinguish "given but unresolved" from "omitted"; `render_shortcode()` to emit the capability-gated notice).

---

## Track P72-E - `AdminPanel.tsx` remaining tab-state extraction (P70-H remainder)

*Source: [FUTURE_TASKS.md](FUTURE_TASKS.md) → Code Quality & Refactoring, deferred from [PHASE70_REPORT.md](archive/phases/PHASE70_REPORT.md) § P70-H (2026-07-21) — P70-H shipped only `useAdminZipTransfers`, the self-contained win; the tab-state concerns were carved out. Re-verified 2026-07-23: `AdminPanel.tsx` is 927 lines; `mediaCampaignId`/`accessCampaignId`/`auditCampaignId`/`selectedCompanyId`/`accessViewMode`/`showExpiredGrants` are all still inline exactly as documented.*

### Problem

`AdminPanel.tsx` still holds the media/access/audit tab-selection state inline — the six state atoms above — plus the default-selection effects, the `selectedSpaceId` reset effect, and the prefetch orchestration (`*PrefetchedRef`/`cancel*Ref`). These are tightly coupled to the data-fetching hooks (`useAuditEntries`, `useAccessGrants`, `useGlobalAuditEntries`), which key on `activeTab` plus these atoms. (`useAdminAccessState` already owns the deeper access **form** state — this track is only the tab-selection layer.)

**Framing caveat — must be decided up front, not assumed mid-implementation.** The original P70-H plan claimed hook extraction alone would stop `AdminPanel` re-rendering on unrelated tabs' state changes. **It does not** — a hook's `useState` re-renders whichever component calls the hook, and these hooks would still be called by `AdminPanel` itself. True re-render isolation requires splitting each tab into a **child component** that owns its own state. Two real options:

- **(a) Code-organization only.** Extract `useAuditTabState` / `useAccessTabState` / `useMediaTabState` as hooks called by `AdminPanel`. Shrinks the file and makes each concern independently testable, but does **not** reduce re-renders. Lower effort, lower risk.
- **(b) Real re-render isolation.** Split the media/access/audit tabs into child components that own their own selection state (and colocate their data-fetching + prefetch). Larger change, but the only way to get the isolation benefit.

### Fix

**Decided (2026-07-23 planning — option (b): real re-render isolation).** Split the media/access/audit tabs into child components that each own their own tab-selection state (colocated with their data-fetching + prefetch orchestration). Option (a) (hook extraction only) was rejected because it does not reduce re-renders — a hook's `useState` still re-renders whoever calls it, and `AdminPanel` would still be the caller; only a component split achieves the isolation benefit. This is the larger, last, riskiest track in the phase.

Either way, preserve behavior exactly: the `selectedSpaceId` reset, the "default to first campaign/company" effects, and the prefetch-once-per-tab orchestration must move with their state, not get dropped or duplicated. Mirror the existing `useAdminCampaignActions` / `useAdminZipTransfers` / `useAdminAccessState` extraction shape.

### Acceptance criteria

- The chosen option (a or b) is fully implemented.
- All existing tab-state behavior — default selection, `selectedSpaceId` reset, prefetch-once-per-tab — is preserved exactly, not dropped or duplicated.

### Validation

- Existing AdminPanel/tab-specific test coverage passes unmodified if (a) is chosen.
- New per-tab component tests if (b) is chosen — a "same identity across renders" or re-render-count assertion is only meaningful under (b); it would test nothing under (a).

### Files

`src/components/Admin/AdminPanel.tsx`; new `src/hooks/useAuditTabState.ts`, `src/hooks/useAccessTabState.ts`, `src/hooks/useMediaTabState.ts` (option a) or new per-tab child components under `src/components/Admin/` (option b).

---

## Track P72-F - Retention / auto-purge for PII tables

*Source: [FUTURE_TASKS.md](FUTURE_TASKS.md) → Privacy & Compliance, origin [PHASE60_REPORT.md](archive/phases/PHASE60_REPORT.md) P60-E. Re-verified 2026-07-23: `class-wpsg-maintenance.php` has `ANALYTICS_PURGE_HOOK` (`wpsg_analytics_purge`) and an `analytics_retention_days` setting for analytics only; no equivalent purge job exists for the two PII tables named below.*

### Problem

`wp_wpsg_access_requests` (visitor emails) and `wp_wpsg_audit_log` (staff usernames/attempted logins) have no purge job and grow unbounded. The existing analytics purge job's own default (`analytics_retention_days = 0`) means "never purge," so even the precedent pattern this track would mirror ships off by default.

### Fix

Add optional, **opt-in** (not opt-out — avoid surprising existing installs with unexpected data loss) retention windows for the two PII tables, mirroring the existing `wpsg_analytics_purge` cron pattern in `class-wpsg-maintenance.php`. Separately, as a judgment call and not a requirement of this track, consider whether the analytics default should become non-zero.

### Acceptance criteria

- A configured retention window purges rows older than the window on the existing cron cadence.
- An unset or zero window preserves the current never-purge behavior (opt-in semantics).

### Validation

- PHP test seeding old and recent rows in both tables, running the purge job, asserting only rows outside the configured window are removed.
- Confirm the cron hook registers/deregisters correctly on plugin activation/deactivation, mirroring `WPSG_Cron_Hooks_Test`'s existing coverage for the analytics job.

### Files

`wp-plugin/wp-super-gallery/includes/class-wpsg-maintenance.php`, settings registration in `class-wpsg-settings-registry.php`.

---

## Track P72-G - Structural a11y (axe) gate: fix the 2 known `LayoutTemplateList` violations

*Source: [FUTURE_TASKS.md](FUTURE_TASKS.md) → Accessibility, origin [PHASE62_REPORT.md](archive/phases/PHASE62_REPORT.md) P62-H (2026-07-11). This track is a deliberately-scoped-down slice of the full backlog entry — the entry's "extend coverage to more surfaces" half is intentionally **not** part of this track; see the note at the end of this section.*

### Problem

The jsdom axe harness (`src/test/axe.ts` → `expectNoA11yViolations`) already found two concrete issues in `LayoutTemplateList` during the P62-H harness rollout, never fixed since:

- **(a)** The icon-only view-toggle `SegmentedControl` segments have no accessible name — `label`, critical severity.
- **(b)** A `role="button"` template `Card` nests a Menu button — `nested-interactive`, serious severity.

### Fix

- **(a)** Give each segment an i18n'd accessible name (visually-hidden text or `aria-label` — requires the standard 5-locale i18n step).
- **(b)** Restructure so the primary action is a real button/link (e.g. on the title), not a button wrapping another button.

### Acceptance criteria

- Both violations are fixed.
- `expectNoA11yViolations` gates `LayoutTemplateList` and passes.

### Validation

- `expectNoA11yViolations` test for `LayoutTemplateList` green.
- Full a11y-gated test suite green.
- `npm run i18n:check` + `npm run i18n:check:locales` green for the new accessible-name strings.

### Note on scope

Extending `expectNoA11yViolations` coverage to further surfaces (the LayoutBuilder property panels, modals, `AdminPanel`, `SettingsPanel`, the gallery adapters) remains open-ended backlog and is intentionally **not** part of this track — it stays in FUTURE_TASKS.md as a trimmed remainder entry rather than being treated as closed by P72-G. See [FUTURE_TASKS.md](FUTURE_TASKS.md) → Accessibility.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|---------------------|
| Extend `expectNoA11yViolations` coverage beyond `LayoutTemplateList` | P72-G fixes only the two known violations; growing coverage to further surfaces is open-ended and stays in [FUTURE_TASKS.md](FUTURE_TASKS.md) as its own item. |
| P72-A's lint-gate-scope decision, if it resolves to "widen the gate" | The track resolves the immediate string gaps regardless; a gate-scope widening is a separate, secondary deliverable depending on that decision. |

## Implementation Notes

Report created 2026-07-23 during a planning pass on `feature/phase71-react-hardening-4-of-4`. A follow-up execution session (2026-07-23, model Opus) re-verified all seven tracks' claims against current source (all confirmed, zero drift), resolved the four open decisions with the user (recorded per-track above), and began execution. A companion manual-QA runbook — [PHASE72_MANUAL_QA_RUNBOOK.md](PHASE72_MANUAL_QA_RUNBOOK.md) — is built incrementally, one section per track as it lands.

### Batch 1 — P72-C + P72-D (landed 2026-07-23)

**P72-C rationale.** The investigation that drove the 1A-vs-1B decision (see the P72-C Fix section) hinged on one discovered fact: `/settings` is gated at the `manage_wpsg` (editor) tier and already lets editors write the 98 non-admin-only global keys, so the space panel's stricter "manage_options for *any* global key" was an accidental inconsistency, not policy. Implementation promoted `guard_admin_only_settings()` from `private` on `WPSG_Settings_Controller` to `protected static` on `WPSG_REST_Base` (the two `self::` call sites resolve to the inherited method unchanged), then routed `update_space_settings()`'s global-key branch through it, guarding before any write so a rejected request is atomic. The stale `write_global_settings()` docblock note ("space panel silently drops the keys… unify later") was updated to reflect the now-unified guard.

**P72-D rationale.** `resolve_space_id()` gained a `bool &$unresolved` out-param set true only when at least one explicit `space=`/`campaign=`/`company=` attribute was given *and* every resolution path failed (so the default fallback was taken) — this precisely distinguishes "given but unresolved" from "omitted" (the precedence subtlety is handled naturally: a successful lower-priority resolution returns early, leaving `$unresolved` false). `render_shortcode()` captures the flag and, via the new `render_unresolved_space_notice()` helper, emits a `manage_wpsg`-gated inline notice naming the stale reference — placed outside the full-bleed wrapper and before the mount node. The notice string is routed through WP's `__()`/`esc_html()` (text domain `wp-super-gallery`).

**Verification.** 64 PHPUnit tests green (376 assertions) across `WPSG_P57A_Settings_Split_Save_Test` (rewritten for the new 1A behavior — 2 new methods), `WPSG_Embed_Test` (4 new P72-D methods), and regressions `WPSG_P52A4_Settings_Split_Test`, `WPSG_Settings_Rest_Test`, `WPSG_P47_Spaces_Settings_Test`. See the runbook for the failure-first / manual-QA detail.

### Batch 2 — P72-B + P72-F (landed 2026-07-23)

**P72-B rationale.** New `WPSG_Privacy` class (`includes/class-wpsg-privacy.php`, hooked on `init` like the other registrars) registers WP core `wp_privacy_personal_data_exporters`/`_erasers`. The deliberate asymmetry (decision above): **access-requests get an exporter AND an eraser** (both keyed on email, case-insensitive via `LOWER(email)`), **audit-log gets an exporter but NO eraser** — the eraser registry simply omits it, and both the class docblock and `PRIVACY.md §5` document the legitimate-interest reasoning. Audit rows are attributed to a DSAR email by resolving `get_user_by('email')` then matching `actor_id` OR `actor_login` (legacy rows carry only the login). New DB helpers: `get_access_requests_by_email`, `delete_access_requests_by_email`, `get_audit_entries_by_actor`. Exporters page at 100 rows (`done` when a short page returns).

**P72-F rationale + scope note.** Backend mirrors the analytics purge exactly: two new cron hooks (`ACCESS_REQUESTS_PURGE_HOOK`, `AUDIT_LOG_PURGE_HOOK`) scheduled weekly only when their setting > 0 (opt-in; default 0 = never), batched `DELETE` keyed on `requested_at` / `created_at`. Both hooks were added to the canonical `wpsg_get_cron_hooks()` list (and its test) so deactivate/uninstall clear them. Two settings registered (defaults 0, admin-only, range `[0, 3650]`). **Scope addition beyond the report's original PHP-only Files list** (decided with the user during execution): because the analytics-retention pattern being mirrored *has* a React admin control, a backend-only setting would be unconfigurable from the UI — so matching **NumberInput controls were added to `AdvancedSettingsSection.tsx`** (Data Maintenance), with `accessRequestsRetentionDays`/`auditLogRetentionDays` added to the `GallerySettings` type + defaults, and 4 new i18n keys translated across all 5 reference locales (`.po` + recompiled `.mo`/`.l10n.php`; PHP manifest + `.pot` regenerated). Translations are AI-generated, terminology-aligned to the existing catalogue — they satisfy the coverage gate and keep correct English fallbacks, but warrant an eventual native-speaker review (same caveat as P71-E).

**Verification.** 88 PHPUnit tests green (652 assertions): `WPSG_P72B_Privacy_Test` (9 — incl. the "no audit eraser" assertion), `WPSG_P72F_PII_Retention_Test` (6 — purge window + opt-in + scheduling), `WPSG_Cron_Hooks_Test` (updated), regressions `WPSG_Maintenance_Test` / `WPSG_Settings_Test` / `WPSG_Settings_Extended_Test`. Front-end: `tsc -b` clean, ESLint clean on changed files, `i18n:check` + `i18n:check:locales` green (all 5 locales, 2351 strings each).

### Batch 3 — P72-A (landed 2026-07-23)

**Rationale + scope growth.** The four originally-named surfaces were all fixed (route through `i18n.t`): the `useMediaExternal.ts` preview-failed fallback (reused the existing `extmedia_preview_failed_message` key), the three `useLayoutBuilderAssets.ts` `announce()` strings, `validateImportPayload`'s four error strings in `useGalleryAdapterSettingsIO.ts` (interpolated), and the `useBuilderDraftRestore.tsx` draft-restore modal chrome (title/body/labels + the `ageLabel`, pluralized).

**Gate-widen decisions (resolved with the user during execution):**
- **`modals.openConfirmModal` chrome → widened, essentially free.** Investigation found all 5 *other* `openConfirmModal` call sites already route their `title`/`labels` through `t()`/`tr()`; only the in-scope `useBuilderDraftRestore.tsx` was hardcoded. So enabling the gate for modal chrome added zero sweep beyond the one surface.
- **`announce()` → widened, but this forced a repo-wide sweep far beyond the plan's 4 surfaces.** Enabling the gate as repo-wide `error` meant *every* hardcoded `announce()` had to be swept: ~23 total, only 3 in-scope. The other ~20 live in `LayoutBuilderModal.tsx` and `useLayoutBuilderKeyboardHandlers.ts`, several with interpolation/pluralization. **The user chose the full sweep** (complete + regression-proof) over deferring. `useLayoutBuilderKeyboardHandlers.ts` gained a module-level `t` binding; `LayoutBuilderModal.tsx` reused its existing `tr` binding and several paired-notification keys (`lb_mod_group_created`, `lb_mod_ungrouped`, `lb_mod_media_assigned`).
- The two ESLint limitations that *stay* manually-swept (documented in the rule header): helper-fallback args (`getErrorMessage(err, '…')`) and validator-return-value literals surfaced as `message: result.error` — both need cross-function analysis ESLint can't do. Surfaces 1 and 3 above are exactly those cases, translated by hand.

**Implementation.** The `wpsg/no-untranslated-notification` rule (name retained for config continuity) was extended to guard three sinks — notifications (unchanged), `announce()` first-arg literals, and `openConfirmModal` `title`/`labels.confirm`/`labels.cancel`. The gate test gained 4 cases (announce flagged/passing; modal chrome flagged×3/passing). 32 new i18n keys added (several reusing existing English msgids like "Discard"), translated across all 5 locales, PHP manifest + `.pot` regenerated, `.mo`/`.l10n.php` recompiled. Translations AI-generated, terminology-aligned (native-review caveat, as P71-E).

**Verification.** Full front-end suite green (251 files / 3764 tests); gate test 10/10 (4 new); `npm run lint` green repo-wide with the widened gate (proves the whole announce/modal sweep is complete); `tsc -b`, `i18n:check`, `i18n:check:locales` (2379 strings/locale) all green.

### Batch 4 — P72-G (landed 2026-07-23)

**Nuance resolved (the planning flag).** The plan warned that `LayoutTemplateList`'s icon-only `SegmentedControl` already carried a group-level `aria-label`, so whether axe still flagged the individual segments was unprovable by reading code. Following the plan, the axe test was **written first and run against current source**: **both** violations reproduced — the group-level `aria-label` does **not** give the individual segment radio inputs accessible names (`label`, critical), and the `role="button"` Card nesting the Menu button flags (`nested-interactive`, serious). So both fixes were genuinely needed.

**Fixes.**
- **(a) label:** each icon-only segment now carries a `<VisuallyHidden>` accessible name (`admin_lt_view_grid` "Grid view" / `admin_lt_view_list` "List view", both already-translated msgids in every locale), wrapping the icon so the segment's radio input gets a name. The group `aria-label` stays.
- **(b) nested-interactive:** the Card is no longer `role="button"`. The primary edit action is a real `UnstyledButton` (native `<button>`) wrapping the preview + title; the action Menu moved to an absolutely-positioned sibling (top-right), so no interactive control nests inside another. One existing test that fired `keyDown(Enter)` on the old div was updated to `click` (the correct interaction for a real button; native keyboard activation is free in a real browser).

**Verification.** New `LayoutTemplateList.a11y.test.tsx` gates **both** the grid and list views with `expectNoA11yViolations` — green (was red on both violations pre-fix). All 18 `LayoutTemplateList` tests pass; `tsc -b`, ESLint, `i18n:check`, `i18n:check:locales` green. **Scope note (unchanged from plan):** extending axe coverage to further surfaces stays in FUTURE_TASKS.md — P72-G fixed only the two known `LayoutTemplateList` violations.

### Batch 5 — P72-E (**LANDED 2026-07-23** — incremental, three commits)

Picked up in a fresh session (2026-07-23). Per user direction, option (b) was landed **incrementally, one panel per commit**, starting with the least-coupled tab. **All three data tabs are now split:**
- **`AuditPanel`** — the audit tab's `auditCampaignId` + `auditFilters` state, its `useAuditEntries`/`useAuditRows` calls, its default-to-first effect, and its once-per-mount prefetch all moved into `src/components/Admin/AuditPanel.tsx`. `AdminPanel` renders `<AuditPanel key={selectedSpaceId} active={activeTab === 'audit'} … />`.
- **`AccessPanel`** — the heavy one. Moved the four selection atoms (`accessCampaignId`/`accessViewMode`/`selectedCompanyId`/`showExpiredGrants`), the `useAccessGrants` + `useCompanies` data hooks, the `useAdminAccessState` form-state hook and its two `mutate*Wrapped` callbacks, the `companySelectData`/`selectedCampaign`/`selectedCompany` memos, `useAccessRows`, both default-select effects, and the once-per-mount access prefetch into `src/components/Admin/AccessPanel.tsx`. Crucially, the two access modals (`ArchiveCompanyModal`, `QuickAddUserModal`) — driven entirely by `accessState` — **moved into the child too** (their lazy imports came along); leaving them at the root would have kept `accessState` lifted and defeated the isolation. `AdminPanel` renders `<AccessPanel key={selectedSpaceId} active={activeTab === 'access'} … />`, threading `selectedSpaceId` (for `useCompanies`), `allCampaigns`/`campaignSelectData`, the paginated `campaigns` (for QuickAddUserModal), `campaignsMutator`, `onNotify`, `isMobile`, `isSystemAdmin`.

- **`MediaPanel`** — the last and smallest. Moved `mediaCampaignId` + the `rescanAllLoading` flag, the media default-select effect, and the once-per-mount media prefetch, plus the whole media toolbar (CampaignSelector + the system-admin ZIP export/import + Rescan-All controls) and the lazy `MediaTab` into `src/components/Admin/MediaPanel.tsx`. As flagged during sizing, **`addMediaCampaign` stayed in `AdminPanel`** — it is a Campaigns-tab row action (its setter feeds `useCampaignsRows`) whose `MediaUploadController` modal renders at the panel root, not a media-tab-local atom. With Media extracted, the shared `selectedSpaceId` reset effect is gone entirely (each child now self-resets via its `key`).

`AdminPanel` dropped to ~800 lines and no longer owns any of the three data tabs' selection state, hooks, effects, prefetch, or the access modals — it renders `<MediaPanel key={selectedSpaceId} active={activeTab === 'media'} … />` alongside the other two.

**Verification finding that corrected the handoff (below): the plan's Mantine/lifecycle assumption was wrong for this stack.** The handoff (behaviours #3/#4) assumed Mantine `Tabs.Panel` unmounts inactive panels, so moving state into a child would fetch-gate via mount/unmount. This repo is **Mantine v9** (`Tabs` defaults `keepMounted: true`, `keepMountedMode: "activity"`) on **React 19** — inactive panels stay **mounted** in `<Activity mode="hidden">` (state preserved, effects torn down; `env="test"` skips Activity, so all panels render in tests). Fetch-gating therefore stays an **explicit `active` prop** threaded to `useAuditEntries`, exactly as the inline code did — nothing about *when* data fetches changed. Two coupling facts in the handoff were also corrected: `addMediaCampaign` is **not** Media-local (its setter feeds `useCampaignsRows` on the Campaigns tab; its modal renders at root) so it stays in `AdminPanel`; and the Access split must move its two root modals into the child.

**Reset mechanism (behaviour #1): chose `key={selectedSpaceId}`** on the child (user-confirmed) over a prop+effect — remount cleanly resets selection + refetch + re-runs default-select/prefetch, matching the old "reset to empty then default-select" sequence. The shared `selectedSpaceId` reset effect in `AdminPanel` dropped only its `setAuditCampaignId('')` line.

**Validation.** New `AuditPanel.test.tsx` + `AccessPanel.test.tsx` + `MediaPanel.test.tsx` — 3 tests each: default-select drives the tab's data fetch / selection (`/campaigns/101/audit`, `/campaigns/101/access`, and the media CampaignSelector showing the first campaign); `active={false}` does nothing (gating preserved); and the **isolation assertion only meaningful under (b)** — a stable-prop parent harness renders the child, the child's own default-select changes its state, yet the parent's render count stays `1`. The existing `AdminPanel` tests pass unmodified. Full front-end suite green: **255 files / 3775 tests** (+9). `tsc -b` + ESLint clean on all changed files. See `PHASE72_MANUAL_QA_RUNBOOK.md` → P72-E.

**Original handoff guidance (retained for the Access + Media follow-ups):**

**Handoff guidance (gathered while sizing the track — verified against current source 2026-07-23):**

The tab-selection state to move into per-tab child components, and every consumer that must move *with* it (or be threaded as props), grouped by tab:

- **Media tab** → `mediaCampaignId` (`AdminPanel.tsx:129`), `addMediaCampaign` (`:131`); the default-select effect (`:232-234`); the media prefetch (`mediaPrefetchedRef`/`cancelMediaRef`, `:251-256`); the media toolbar (`CampaignSelector` at `:574`, the ZIP export button at `:583` calling `zipTransfers.exportMediaZip`), and the `<MediaTab>` render (`:632`). `MediaTab` is `lazy`.
- **Access tab** → `accessCampaignId` (`:136`), `accessViewMode` (`:137`), `selectedCompanyId` (`:138`), `showExpiredGrants` (`:144`); data hooks `useAccessGrants` (`:178`, gated on `activeTab==='access'`), `useCompanies` (`:182`, `companiesEnabled`); `useAdminAccessState` (`:217`, depends on the three access atoms); the `useAccessRows` row-builder (`:328`); default-select effects (`:235-237`, `:241-243`); the access prefetch (`:257-262`); the `<AccessTab>` render (`:653`).
- **Audit tab** → `auditCampaignId` (`:139`), `auditFilters` (`:140`); `useAuditEntries` (`:183`); `useAuditRows` (`:329`); default-select effect (`:238-240`); the audit prefetch (`:263-268`); the `<AuditTab>` render (`:678`).

**Behaviour that MUST be preserved exactly (the acceptance criteria):**
1. **`selectedSpaceId` reset** (`:225-230`) — changing the space clears the media/access/audit/company selections. With child components owning their own state, this needs a deliberate mechanism (e.g. a `key={selectedSpaceId}` on each child to remount-and-reset, or an effect inside each child keyed on a `selectedSpaceId` prop). Don't drop it.
2. **Default-to-first-campaign/company** — when a tab activates with no selection and options exist, select the first. Naturally becomes a mount-time effect in the child.
3. **Prefetch-once-per-tab** — the `*PrefetchedRef` guards fire the bulk prefetch exactly once; the cleanup (`:269`) cancels in-flight prefetches on unmount. Moving these into the child changes "once per AdminPanel lifetime" to "once per child mount" — decide whether that's acceptable (it likely is, and is arguably better) and note it.
4. **The `activeTab === '<tab>' ? … : ''` gating** on the data hooks exists so inactive tabs don't fetch. If each tab becomes a child rendered only when active (mounted/unmounted with the tab), that gating is achieved by mount/unmount instead — simpler, but verify the `Tabs.Panel` `keepMounted`/lazy behaviour so an inactive child truly unmounts (Mantine `Tabs.Panel` unmounts inactive panels by default unless `keepMounted`).

**Validation for the next agent:** the re-render-isolation benefit is only real under (b), so a "same identity / re-render-count" assertion is meaningful here (unlike (a)); add one. Keep the full existing AdminPanel/tab test coverage green, and re-run the full front-end suite. Follow the Batch-1..4 pattern: add a `## Track P72-E` section to `PHASE72_MANUAL_QA_RUNBOOK.md` when it lands.

## Batch 6 — PR review pass over the whole branch (2026-07-23)

After all seven tracks landed, the branch was re-reviewed end-to-end as a pull request (self-review; there were no external reviewer comments to fetch). The review read every changed file against `main`, re-derived each track's claims from source rather than from the report, and re-ran both baselines first (front-end **255 files / 3775 tests**, PHP **1297 tests / 13665 assertions / 2 skipped** — both green) so any new red was attributable. Seven findings were raised and all seven were fixed; each behavioural fix was **failure-first** — the test was written and observed red against the landed source before the fix.

### Finding 1 (HIGH, correctness) — P72-C's guard blocked *every* editor settings save

**What was wrong.** `guard_admin_only_settings()` 403'd on the mere **presence** of an admin-only key in the payload. But `SettingsPanel.handleSave()` PUTs the **whole settings object** on every save: `WPSG_Settings::to_js($effective, $is_admin)` computes `$is_admin` from `manage_wpsg` (true for a `wpsg_editor`), so an editor's GET already carries every admin-only field, and the client's `mergeSettingsWithDefaults()` re-adds from `DEFAULT_GALLERY_BEHAVIOR_SETTINGS` any the server stripped. The 31 `admin_only_fields` are disjoint from the 227 `space_overridable_fields`, so all 31 land in `$global_input` on every save.

Net effect: a space editor saving *anything* in the space settings panel — even a pure theme change — got a 403 naming all 31 system keys, and because the guard is deliberately atomic, **their display overrides were discarded too**. Pre-P72-C those keys were silently dropped and the save succeeded, so P72-C converted a cosmetic inconsistency into a hard break of the editor's primary save path. The same defect existed (pre-existing, since P52-A4) on `POST /settings`; unifying the guard is what made it uniform.

**Reproduced first.** Three new methods in `WPSG_P57A_Settings_Split_Save_Test` build the payload the way the panel does (`to_js(get_settings(), true)` plus one changed display key) and were red on the landed source: the 403 body listed `auth_provider, api_base, … magic_link_landing_page_id` — all 31 keys — on a save that changed only `theme`.

**Fix.** The guard now blocks an *effective change*, not presence. It sanitizes the input and strict-compares each admin-only key against the stored option — mirroring `write_global_settings()`'s own changed-key computation exactly — so an editor may echo back a system setting's current value but still cannot change it. All three call sites (`update_settings`, `patch_settings`, `update_space_settings`) now pass the key⇒value map instead of `array_keys(...)`. This fixes the space panel *and* the pre-existing `/settings` case, keeping the two paths identical as P72-C intended. The two P72-C tests that assert the 403 on a real admin-only change still pass unchanged — the boundary is narrowed, not removed.

### Finding 2 (MEDIUM, correctness) — P72-D warned on references that were perfectly valid

**What was wrong.** `resolve_space_id()` set `$unresolved = $had_explicit` whenever the default fallback was reached. But `campaign=`/`company=` only return early when the entity carries a `_wpsg_space_id`; a campaign or company that **exists and simply has no space assignment** — the normal case on a single-space install, and on any campaign predating spaces — fell through to the default and was reported to the admin as *"references a space that no longer exists"*. The notice also named every attribute provided, including ones that had resolved.

**Reproduced first.** Four new `WPSG_Embed_Test` methods; two were red on the landed source (a campaign with no space meta, and a company with no space meta, both produced the notice).

**Fix.** The out-param became `array &$unresolved_refs`, populated per reference and only when the named entity **does not exist**: a missing space id/slug, a campaign post that cannot be found, a company term that cannot be found. An entity that exists but inherits the default space is explicitly not an error (commented as such). `render_unresolved_space_notice()` now takes that list and names only the references that actually failed, and the message was corrected from the space-specific wording to *"this shortcode reference could not be resolved (%s)"*, since the failing reference may be a campaign or company. The four original P72-D tests still pass.

### Finding 3 (MEDIUM, i18n) — the new PHP-side strings never reached the catalogs

Batch 2/3 regenerated the `.pot` and the five `.po` files for the *front-end* manifest strings, but the PHP `__()` strings introduced by **P72-B** (`WPSG_Privacy`: exporter/eraser names, group descriptions, field labels) and **P72-D** (the shortcode notice) were never harvested — zero of them appeared in `wp-super-gallery.pot`. They would have shipped English-only in every reference locale. This is not a project convention: the `.pot` already covers PHP-only sources (`class-wpsg-cpt.php`, the settings renderers, `wp-super-gallery.php`).

**Root cause of the miss:** `scripts/check-i18n-locales.mjs` gates coverage only for values in `src/i18n-strings.en.json` — PHP-only `__()` strings are outside its remit, so nothing failed. (Extending that gate is recorded as a follow-on below.)

**Fix.** Eight new msgids added to the `.pot` and translated across all five reference locales, then `.mo` and `.l10n.php` recompiled with `wp i18n make-mo` / `make-php`. Six of the exporter's field labels (`Email`, `Campaign ID`, `Status`, `Action`, `Summary`, `Actor`) were already-translated msgids in every locale and are deliberately not duplicated — gettext dedupes on msgid. Translations are AI-generated and terminology-aligned to the existing catalogue (`space` → Bereich / Espacio / Espace / Пространство / 空间), carrying the same native-review caveat as P71-E and Batch 2/3. `i18n:check` and `i18n:check:locales` (2379 strings/locale) stay green.

### Finding 4 (LOW, docs) — `PRIVACY.md` still listed the shipped work as planned

§5 and §6 were updated by Batch 2, but the **Follow-Ons** list at the end still advertised "WordPress core privacy integration" and "Retention jobs for emails & audit log" as future work — directly contradicting the sections above them in a compliance-facing document. Both entries were removed and replaced with an explicit *"Shipped since this list was written"* pointer to §5 / §6.

### Finding 5 (LOW, docs) — stale `[P71-E]` scope comments in two hooks

`useGalleryAdapterSettingsIO.ts` said its validator error strings were "intentionally out of F-1's direct notification-literal scope" and `useBuilderDraftRestore.tsx` said the modal title/labels were "intentionally left untouched" — both describing exactly the strings P72-A then translated. Rewritten to describe the current state (and, for the validator, *why* the ESLint gate still cannot see those strings across the function boundary).

### Finding 6 (LOW, visual/contrast) — P72-G's action menu moved onto the dark preview canvas

The `nested-interactive` fix repositioned the card's action `Menu` to `pos="absolute" top={8} right={8}`, which places a `variant="subtle"` `ActionIcon` over the preview canvas (`background: '#1a1a1a'` by default) — near-invisible in light mode, and something axe cannot detect. The title `Box` also kept a now-dead `paddingRight: 28` that had reserved the menu's gutter in the pre-P72-G layout. Both resolved by pinning the menu to `bottom={8} right={8}`: it sits beside the title on the card background exactly as it did pre-P72-G, the reserved gutter is meaningful again, and the a11y fix is untouched (still a sibling of the primary button, never nested). The block's indentation, left un-reflowed when the `UnstyledButton` wrapper was introduced, was also corrected.

### Finding 7 (LOW, test quality) — the P72-E isolation assertion could not fail

Each panel test asserted `parentRenders.count === 1` after the child's mount-time default-select. But the harness holds no state and receives stable props, so its render count is `1` regardless of where the child's state lives — the assertion the report calls "only meaningful under (b)" was tautological. All three tests now additionally drive a **user-initiated** selection change through the child's `CampaignSelector` (open combobox → pick the second campaign), assert the child acted on it (new `/campaigns/102/audit` and `/campaigns/102/access` fetches; `Second Campaign` displayed in Media), and re-assert the parent's render count is unchanged. That is a real structural guard: the interaction is exactly the one that would run through a parent-owned setter had the selection stayed lifted.

### Reviewed and accepted without change

- **The P72-B export/erase asymmetry.** Re-checked against the registrations: `wpsg-audit-log` appears in the exporter registry and is absent from the eraser registry, with the GDPR Art. 6(1)(f) / 17(3)(b) reasoning documented in both the class docblock and `PRIVACY.md §5`, and a test that pins the absence. Correct and well-evidenced.
- **`LOWER(email) = LOWER(%s)`** in the DSAR queries defeats any index on `email`. Kept: case-insensitive matching is the correct DSAR behaviour, and these run at human request frequency, not per page-view.
- **P72-F scheduling from `time()`** means enabling a retention window purges on the next cron tick rather than a week out. This exactly mirrors the existing analytics purge, and the windows are opt-in with a 0 default; consistency wins.
- **`isAnnounceCall` matching any identifier named `announce`.** Deliberately name-based, in keeping with the rule's stated zero-false-positive/no-heuristics design; a same-named non-user-facing helper would be a false positive, but none exists and the fix (route through `t()`) is harmless anyway.

### Verification

Every fix landed with its test. Suites after the pass:

| Suite | Before the pass | After |
|---|---|---|
| PHPUnit | 1297 tests / 13665 assertions / 2 skipped | **1304 tests / 13683 assertions / 2 skipped — green** (+7: 3 P57A, 4 Embed) |
| Vitest | 255 files / 3775 tests | **255 files / 3775 tests — green** (3 strengthened in place, no count change) |
| `npx tsc -b` | green | green |
| `npm run lint` | green | green |
| `i18n:check` / `i18n:check:locales` | green | green (2379 strings × 5 locales) |

**One unrelated flake observed and chased down, not a regression.** The first post-fix full front-end run showed `AuthContext.test.tsx` → "re-hydrates on visibilitychange" red. That file is untouched by this branch and by this review pass; it passes in isolation and on re-run of the full suite. The test mutates the global `document.visibilityState` and dispatches `visibilitychange`, which is order/parallelism sensitive — a pre-existing flake shape. Recorded here rather than silently re-run.

### Follow-on candidate raised by this pass

| Candidate | Why |
|---|---|
| Extend the locale-coverage gate to PHP `__()` strings | `check-i18n-locales.mjs` only walks `src/i18n-strings.en.json`, so a PHP-only user-facing string can ship untranslated with every gate green — exactly how Finding 3 slipped through two batches. Catching it needs a `.pot`-vs-source harvest step (`wp i18n make-pot --dry-run` diff, or parsing `__()`/`_x()` call sites), which is its own piece of tooling. |

## Outcome

**All 7 tracks landed, then hardened by a full PR-review pass (Batch 6).** P72-C, P72-D (Batch 1); P72-B, P72-F (Batch 2); P72-A (Batch 3); P72-G (Batch 4); **P72-E (Batch 5) — option (b), three incremental commits: AuditPanel → AccessPanel → MediaPanel, all data tabs now re-render-isolated child components**; **Batch 6 — 7 review findings fixed, including one HIGH-severity regression (P72-C 403'ing every space-editor settings save) and one MEDIUM false-positive admin notice (P72-D)**. Final state: front-end 255 files / 3775 tests green, PHP 1304 tests / 13683 assertions green, `tsc -b` / lint / both i18n gates green. Branch: `feature/phase72-backlogged-hardening-1`.
