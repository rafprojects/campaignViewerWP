# Phase 72 - Mixed-Domain Hardening: i18n Gaps, Privacy, Permissions & Refactoring

**Status:** Planned
**Created:** 2026-07-23

### Tracks

| Track | Domain | Description | Status | Effort |
|-------|--------|-------------|--------|--------|
| P72-A | React / i18n | Non-notification user-facing strings still bypass i18n | Planned | Medium |
| P72-B | PHP / Privacy | WordPress Core Privacy Integration (DSAR export/erase) | Planned | Medium |
| P72-C | PHP / Settings | `update_space_settings()` silently drops global keys instead of returning 403 | Planned | Tiny |
| P72-D | PHP / Shortcode | Admin notice on unresolved shortcode space reference | Planned | Small |
| P72-E | React / Refactor | `AdminPanel.tsx` remaining tab-state extraction (P70-H remainder) | Planned | Medium |
| P72-F | PHP / Privacy | Retention / auto-purge for PII tables (access-requests, audit-log) | Planned | Small-Medium |
| P72-G | React / a11y | Structural a11y (axe) gate — fix the 2 known `LayoutTemplateList` violations | Planned | Small (this slice) |

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

Route all four through `i18n.t('key', 'English default')`, the same pattern P71-E used (`useBuilderDraftRestore.tsx` and `useLayoutBuilderAssets.ts` already import `i18n` for their P71-E fixes, so wiring is minimal). Make an explicit, documented decision on whether the `wpsg/no-untranslated-notification` gate's scope should widen to catch one or more of these categories (e.g. a sibling rule for `modals.openConfirmModal` chrome), or whether they stay as manually-swept exceptions — write the decision down rather than leaving it implicit.

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
- **Open question requiring an explicit decision during implementation:** how the audit-log (staff-action) side interacts with erasure requests — audit trails commonly carry a legitimate-interest retention override that should not be silently bypassed by a self-service erase request. Resolve this deliberately, not by default assumption.

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

Decide whether `update_space_settings()` should return the same explicit 403 as the other two write paths for an unauthorized global-key write, then implement it via the shared `write_global_settings()` / `guard_admin_only_settings()` helpers already in place — no new authorization logic needed, just routing this call site through the existing guard.

### Acceptance criteria

- A non-`manage_options` caller attempting to change a global key via the space panel receives the same explicit 403 (or a deliberately-chosen and documented alternative) as the other two settings-write paths.
- No more silent data loss on this permission boundary.

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

Pick (a) or (b) explicitly before starting — this is a required decision point, not an implementation detail to resolve along the way. Either way, preserve behavior exactly: the `selectedSpaceId` reset, the "default to first campaign/company" effects, and the prefetch-once-per-tab orchestration must move with their state, not get dropped or duplicated. Mirror the existing `useAdminCampaignActions` / `useAdminZipTransfers` / `useAdminAccessState` extraction shape.

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

Not yet started. This report was created 2026-07-23 during a planning pass on `feature/phase71-react-hardening-4-of-4`; execution will happen in a later session. See Execution Priority above for the suggested batching.

## Outcome

Planned — no tracks have landed yet.
