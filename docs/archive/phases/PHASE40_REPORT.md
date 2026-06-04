# Phase 40 — Audit Baseline, Event Clarity, and Coverage Expansion

**Status:** Complete
**Created:** 2026-06-01
**Last updated:** 2026-06-03 (PR #55 r3 review fixes)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P40-BS1 | Campaign audit baseline stabilization and current bug fix | Complete | S |
| P40-CT1 | Canonical audit event contract, storage, and API evolution | Complete | L |
| P40-UX1 | Audit surface naming, summaries, and shared event presentation | Complete | M |
| P40-CA1 | Campaign-scoped audit coverage expansion for high-signal admin flows | Complete | L |
| P40-SA1 | System-scope audit coverage for settings, auth, templates, and taxonomy | Complete | L |
| P40-QA1 | Regression coverage, docs, QA, and backlog closeout | Complete | M |

> **Note:** Phase 40 is intentionally a focused audit-domain phase.
>
> The immediate product need is not only "add more log entries." The current
> audit system has three separate problems that now need to be solved together:
>
> 1. the campaign audit surface is reportedly not showing activity,
> 2. several important admin outcomes are still not audited,
> 3. the existing audit views are not clear enough for admins to review later.
>
> `P40-BS1` must begin first so Phase 40 starts from a working baseline.
> `P40-CT1` is the architectural gate for both the UX track and the coverage
> expansion tracks. `P40-QA1` should only close once the other tracks are
> completed, explicitly narrowed, superseded, or deferred.

---

## Rationale

The audit system already has a solid baseline implementation. The backend audit
table and list endpoints exist in `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`
and `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`, and the admin UI
already exposes both campaign-scoped and cross-campaign audit surfaces through
`src/components/Admin/AuditTab.tsx`,
`src/components/Admin/GlobalAuditTab.tsx`, and
`src/services/adminQuery.ts`.

That baseline is no longer sufficient for the current product need.

The specific issues surfaced for this phase are:

- duplicate upload and near-duplicate resolution outcomes in the Media flow are
  important review events for admins, but they are not currently captured as
  first-class audit entries,
- the campaign audit view is reportedly not showing activity despite existing
  audit writes in multiple campaign, media, and access mutations,
- the current "Global Audit" wording does not explain scope clearly enough,
- the current row presentation relies too heavily on raw action keys and raw
  JSON details rather than admin-readable summaries,
- several system-level admin actions still have no audit path at all because
  the current model is built primarily around campaign-scoped events.

The repo already contains clear anchors for this work:

- `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php` owns the current
  audit table schema, insert/list logic, and response formatting.
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` already writes many
  campaign, media, and access events via `add_audit_entry()` and also owns the
  settings, auth, taxonomy, and layout-template mutation handlers that still
  need audit coverage.
- `src/components/Admin/AdminPanel.tsx` already wires the audit tabs and now
  auto-seeds a campaign in the campaign audit view, so the current bug likely
  sits below a simple "no campaign selected" explanation.
- `src/components/Admin/MediaTab.tsx` already contains the duplicate and
  near-duplicate decision points that motivated this phase.

Phase 40 therefore groups six tracks in a strict sequence:

1. fix the current campaign-audit baseline,
2. define a canonical event contract that can represent campaign and system
   events cleanly,
3. use that contract to improve the admin-facing audit UX,
4. expand campaign-scoped coverage where admins most need historical review,
5. add true system-scope audit coverage where the current campaign-only model
   falls short,
6. close the phase with regression coverage, documentation, and backlog
   cleanup.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Phase entry gate | Fix the current campaign audit regression before broadening scope. Phase 40 needs a known-good baseline surface before it can add more coverage. |
| B | Scope model | Evolve the audit model to support true system-wide events. Do not force system activity into fake campaign IDs. |
| C | UI terminology | Replace the current tab-level wording with clearer scope labels: `Campaign Activity` for campaign-scoped review and `System Audit` for cross-campaign and system-wide review. |
| D | Entry presentation | Raw action keys and raw JSON may remain as secondary detail, but the primary row content should become an admin-readable summary with explicit severity and resource context. |
| E | Logging threshold | Keep the audit log intentionally high-signal: committed admin actions, important warnings, and actionable errors. Exclude read-only views, keystrokes, autosaves, and low-value implementation chatter. |
| F | Write path ownership | Keep one canonical backend audit writer and formatter in the PHP layer. Do not create a parallel frontend-only event bus or multiple competing wrappers. |
| G | Compatibility posture | Preserve legacy rows for display and export, but author all new Phase 40 events through the expanded canonical event contract rather than extending the raw `action + details` pattern further. |

## Execution Priority

1. `P40-BS1` — establish whether campaign audit breakage is a write-path,
   retrieval, filter, or presentation defect, and capture the failure in a
   regression test.
2. `P40-CT1` — define the canonical event shape once so later tracks do not
   pile new ad hoc fields onto the existing model.
3. `P40-UX1` — improve naming, summaries, and shared event rendering on top of
   the new event contract.
4. `P40-CA1` — fill campaign-scoped gaps, especially duplicate upload and other
   review-critical admin outcomes.
5. `P40-SA1` — add true system-scope coverage for settings, auth, templates,
   taxonomy, and other non-campaign admin mutations.
6. `P40-QA1` — finish the phase with tests, docs, QA, and backlog cleanup
   aligned to the actual implementation outcome.

---

## Track P40-BS1 — Campaign Audit Baseline Stabilization

### Problem

Campaign audit logs are reported as not showing activity despite the fact that
the backend already writes many audit entries for campaign, media, and access
operations.

The frontend anchor already auto-seeds a campaign in `AdminPanel.tsx`, so the
old "nothing is selected" explanation is no longer a strong default
hypothesis. Phase 40 should therefore begin by reproducing the problem with one
mutation that is already known to call `add_audit_entry()` today.

The critical question is whether the failure is:

- no rows being written,
- rows being written for a different campaign than the one being inspected,
- `/campaigns/{id}/audit` failing or returning empty while the global filtered
  route still works,
- or a UI-level presentation or error-surfacing issue.

### Goal

Reproduce the current campaign-audit failure, identify the actual control-path
defect, and keep that failure as a permanent regression check for Phase 40.

### Implementation outline

1. Use one known-audited mutation such as campaign archive/restore, media batch
   creation, or access grant to produce a deterministic audit event.
2. Compare the campaign route and the global filtered route for the same
   campaign to localize the failure.
3. Confirm whether rows exist in the audit table for the chosen campaign before
   changing the schema or UI.
4. Fix the controlling defect in the smallest possible slice.
5. Add regression coverage so Phase 40 does not build on a broken campaign
   audit baseline.

### Key files

- `src/components/Admin/AdminPanel.tsx`
- `src/components/Admin/AuditTab.tsx`
- `src/services/adminQuery.ts`
- `src/hooks/useAuditRows.tsx`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_P28G_Audit_Log_Test.php`

### Acceptance criteria

- The campaign audit failure is reproduced with a deterministic known-audited
  action before any schema expansion begins.
- The root cause is identified and fixed in the controlling code path.
- `GET /campaigns/{id}/audit` and the filtered global route agree for the same
  campaign on the same known-audited mutation.
- Regression coverage exists for the resolved failure mode.

### Implementation Notes

**Investigation outcome:** The backend write/read path is correct. `add_audit_entry()` stores `campaign_id = intval($post_id)` and `GET /campaigns/{id}/audit` queries `WHERE campaign_id = %d` consistently. The full REST mutation → REST audit retrieval path was untested, but three new regression tests confirm it works end-to-end.

**Root cause of reported silent failure:** `useAuditEntries` in `adminQuery.ts` returns `auditError`, but `AdminPanel.tsx` never destructured or forwarded it to `AuditTab`. If the backend returned any non-2xx response (403 from expired nonce, 404 from missing campaign, etc.) the component silently showed "No audit entries yet." instead of surfacing the error.

**Changes shipped:**
- `WPSG_P40_BS1_Audit_Baseline_Test.php` — three regression tests covering the full `POST .../archive` → `GET .../audit` and `GET /admin/audit-log?campaign_id` path; both routes confirmed to agree.
- `AuditTab.tsx` — added optional `auditError` prop; error branch renders a visible `role="alert"` message before the empty-state message so backend failures are not silent.
- `AdminPanel.tsx` — destructures and forwards `auditError` to `AuditTab`.
- `AuditTab.test.tsx` — added test covering error state rendering.

### Status: Complete

---

## Track P40-CT1 — Canonical Audit Event Contract, Storage, and API Evolution

### Problem

The current audit model is adequate for simple campaign-scoped event storage,
but it is too narrow for the next phase of audit work.

Today the core shape is still effectively `campaign_id + action + details +
actor + created_at`. That makes it awkward to represent:

- true system-wide events with no campaign context,
- explicit severity,
- human-readable summaries,
- stable resource context,
- richer filtering without forcing the UI to infer meaning from raw strings.

If Phase 40 tries to add coverage first and schema later, it will compound the
existing model limitations and spread formatting assumptions across the frontend.

### Goal

Define one canonical audit event contract that can represent campaign and system
events, preserve backward compatibility for legacy rows, and support clearer
admin presentation and filtering.

### Implementation outline

1. Extend the audit storage model so events can carry:
   - event key,
   - severity (`info`, `warning`, `error`),
   - scope (`campaign`, `system`),
   - resource type, resource ID, and resource label,
   - optional campaign ID,
   - human-readable summary,
   - structured context details,
   - actor identity,
   - source,
   - timestamp.
2. Prefer an explicit scope/resource model over fake campaign IDs for
   system-wide actions.
3. Update the formatter and REST responses so legacy rows remain displayable and
   exportable while new rows return the expanded contract.
4. Keep the write path centralized in the PHP layer.
5. Extend CSV/export behavior only as needed so newer fields remain useful
   without breaking older workflows.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-db.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `src/services/adminQuery.ts`
- `src/services/api/adminApi.ts`
- `wp-plugin/wp-super-gallery/tests/WPSG_P28G_Audit_Log_Test.php`

### Open follow-ups

- **Migration shape** — confirm whether the Phase 40 schema change is handled as
  additive columns, a one-time upgrade plus formatter fallback, or both.
- **Export surface** — decide whether legacy CSV output remains field-compatible
  by default or whether a richer export format becomes the new baseline.
- **Filtering** — decide whether severity and scope filters ship in the same
  track or follow immediately after the contract lands.

### Acceptance criteria

- The canonical audit event contract supports both campaign and system events.
- The backend write path remains centralized and authoritative.
- Legacy rows remain readable through the formatter and UI.
- The frontend types and queries are updated to the expanded response shape.
- Test coverage exists for schema compatibility and new contract behavior.

### Implementation Notes

**Root cause and approach:**

The `wpsg_audit_log` table carried only `campaign_id + action + details + actor +
created_at`. Seven columns needed for the canonical event contract were absent:
`severity`, `scope`, `summary`, `resource_type`, `resource_id`, `resource_label`,
and `source`.

**Changes shipped:**

- `class-wpsg-db.php` — `DB_VERSION` bumped to `'9'`; `maybe_create_audit_log_table()`
  SQL extended with all seven new columns and a `KEY scope (scope)` index;
  `maybe_upgrade_audit_log_v9()` private method handles the additive column
  migration via `dbDelta` (INFORMATION_SCHEMA check guards duplicate runs);
  `insert_audit_entry()` stores all seven new fields with validation;
  `list_audit_entries()` accepts and applies `scope` and `severity` filter args;
  `format_audit_entry()` returns all seven new fields with `??` defaults so
  legacy rows remain fully readable.
- `class-wpsg-rest.php` — `add_audit_entry()` signature extended to
  `($post_id, $action, $details, $ctx)` — all seven new fields flow through
  from `$ctx`; `list_audit()` and `list_global_audit()` now forward `scope`
  and `severity` query params to `list_audit_entries()`.
- `src/services/adminQuery.ts` — `AuditEntry` interface extended with seven
  optional fields (`severity`, `scope`, `summary`, `resourceType`, `resourceId`,
  `resourceLabel`, `source`); `AuditFilters` extended with `scope` and
  `severity`; `fetchAuditEntries` and `fetchGlobalAuditEntries` forward both
  new params when present.
- `src/components/Admin/AuditTab.tsx` and `GlobalAuditTab.tsx` — `mergeFilter`
  cast fixed for the narrower union types introduced by `scope`/`severity`.
- `WPSG_P40_CT1_Event_Contract_Test.php` — 7-test PHP regression suite covering
  schema presence, insert/format round-trip, `scope` and `severity` DB filtering,
  REST endpoint param forwarding, and legacy-row default values.
- `src/services/adminQuery.test.tsx` — new test verifying `scope`/`severity`
  forwarding in the fetch URL and that new fields are returned on entries.

**Migration decision:** Additive columns via `dbDelta` (no destructive changes).
`campaign_id` retains `NOT NULL` with `DEFAULT 0`; `scope = 'system'` is the
authoritative indicator for plugin-level events rather than using NULL.

**Verification:** 7 PHP tests pass (`OK (7 tests, 41 assertions)`), 15 frontend
tests pass, lint clean, build clean.

### Status: Complete

---

## Track P40-UX1 — Audit Surface Naming, Summaries, and Shared Event Presentation

### Problem

The current audit UI is functional but not clear enough for admins returning to
past events.

The two main problems are:

- `Global Audit` does not explain scope well enough,
- rows currently rely on raw action keys and raw JSON details, which places too
  much interpretation burden on the admin.

Phase 40 should treat this as a product clarity problem, not just a copy tweak.
If the system becomes more comprehensive but the review surface remains cryptic,
the new coverage will not be meaningfully more useful.

### Goal

Turn the existing audit views into clearer admin review surfaces by renaming the
tabs, adding concise scope help, and rendering shared human-readable summaries
from the canonical audit event contract.

### Implementation outline

1. Rename the current tab labels and headings:
   - `Audit` -> `Campaign Activity`
   - `Global Audit` -> `System Audit`
2. Add concise help text or tooltips explaining when each surface should be
   used.
3. Replace raw action keys as the primary row content with an admin-readable
   summary.
4. Move raw event key and structured detail payloads into secondary or expanded
   detail presentation.
5. Share the formatter and row renderer between campaign and system views so the
   two surfaces do not drift.
6. Add severity and resource context to improve scannability.

### Key files

- `src/components/Admin/AdminPanel.tsx`
- `src/components/Admin/AuditTab.tsx`
- `src/components/Admin/GlobalAuditTab.tsx`
- `src/hooks/useAuditRows.tsx`
- `src/services/adminQuery.ts`
- `src/components/Admin/AuditTab.test.tsx`
- `src/components/Admin/GlobalAuditTab.test.tsx`

### Acceptance criteria

- The admin UI uses scope-explicit names for the two audit surfaces.
- Each row has a primary human-readable summary rather than only a raw action
  key.
- Severity, actor, timestamp, and resource context are visible without opening
  raw JSON.
- Campaign and system audit views share a single formatting and presentation
  pattern.
- UI coverage exists for the renamed headings, help text, and summary-based
  rendering.

### Implementation Notes

**Changes shipped:**

- `AuditEventRow.tsx` — new shared row component used by both audit surfaces. Renders:
  primary summary text (`entry.summary` falling back to `entry.action`), an optional secondary
  resource label line, a colour-coded severity badge (`info`=blue, `warning`=orange, `error`=red),
  actor, and lineClamp-1 details. Accepts `showCampaignCol` to toggle the Campaign column for the
  system-audit view.
- `useAuditRows.tsx` — refactored to use `AuditEventRow`; sorting logic preserved.
- `AuditTab.tsx` — heading renamed to `Campaign Activity`; help text added (`All activity recorded
  for the selected campaign.`); column headers updated (When, Summary, Severity, Actor, Details);
  skeleton rows aligned to 5 columns.
- `GlobalAuditTab.tsx` — heading renamed to `System Audit`; help text added (`Cross-campaign and
  plugin-wide admin events.`); row rendering replaced with `AuditEventRow showCampaignCol`; column
  headers updated (When, Summary, Severity, Campaign, Actor, Details); skeleton rows aligned to 6
  columns.
- `AdminPanel.tsx` — mobile select data and `Tabs.Tab` labels updated to `Campaign Activity` and
  `System Audit`.
- `AuditTab.test.tsx` — added `'shows Campaign Activity heading'` and `'shows help text explaining
  scope'` tests.
- `GlobalAuditTab.test.tsx` — updated heading assertion; added tests for help text, summary-first
  rendering, severity badge, and resource label visibility.

**Verification:** 32 frontend tests pass, lint clean, build clean.

### Status: Complete

---

## Track P40-CA1 — Campaign-Scoped Audit Coverage Expansion

### Problem

Many campaign-level mutations are already audited, but Phase 40 is being driven
by a class of missing entries that admins explicitly want to return to later.

The Media flow is the clearest example. Successful media creation and batch
addition already produce audit rows, but duplicate and near-duplicate decisions
do not yet have first-class audit coverage. That means an admin can later see
that media changed without understanding that a duplicate was detected, whether
the existing asset was reused, or whether the admin deliberately forced a new
upload.

The same pattern appears elsewhere: some review-critical outcomes exist in the
UI today as notifications, partial failures, or branch decisions, but not as
durable audit entries.

### Goal

Expand campaign-scoped audit coverage for high-signal admin outcomes while
keeping the log intentionally selective and reviewable.

### Implementation outline

1. Add audit coverage for exact duplicate detection outcomes in the Media flow.
2. Add audit coverage for near-duplicate detection outcomes and the admin's
   chosen resolution path.
3. Add campaign-scoped coverage for other important review events that are
   currently under-documented in the audit trail, such as batch outcomes,
   import/export details, and missing warning or error branches around already
   audited flows.
4. Reuse the canonical event contract and severity model from `P40-CT1`.
5. Keep sensitive values redacted and avoid logging oversized payloads or low-
   value implementation noise.

### Key files

- `src/components/Admin/MediaTab.tsx`
- `src/hooks/useUnifiedCampaignModal.ts`
- `src/hooks/useAdminCampaignActions.ts`
- `src/components/Admin/AccessTab.tsx`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-maintenance.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_P28N_Duplicate_Detection_Test.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_P38MD1_PHash_Test.php`

### Explicit coverage targets

- duplicate file detected and rejected,
- near-duplicate detected,
- near-duplicate resolved by reusing existing media,
- near-duplicate resolved by forced upload,
- campaign import and export outcomes with usable context,
- batch creation and partial-failure outcomes where admins need a durable
  record,
- important warning and error branches around existing campaign/media/access
  actions.

### Noise exclusions

- Do not log keystroke-level edits or unsaved form churn.
- Do not log read-only page loads, audit tab views, or basic selector changes.
- Do not log temp file paths, raw binary metadata, or oversized blobs.

### Acceptance criteria

- Duplicate and near-duplicate media flows create meaningful campaign audit
  entries with the admin's final outcome.
- Campaign-scoped high-signal warning and error branches are captured where
  admins need durable review history.
- The added entries use the Phase 40 severity and summary conventions.
- Automated coverage exists for duplicate and near-duplicate audit behavior.

### Implementation Notes

**Investigation outcome:** Five audit gaps confirmed in static analysis: `upload_media` had no campaign context to write duplicate/near-dup entries; `export_campaign` and `export_campaign_binary` had no export audit entries; `create_media_batch` wrote audit entries without severity or summary; `campaign.imported` calls used the pre-CT1 format.

**Changes shipped:**

- `class-wpsg-rest.php` — `upload_media` route accepts optional `campaign_id` integer param. When supplied: `media.duplicate_rejected` (warning) on MD5 duplicate, `media.near_duplicate_detected` (warning) on pHash near-dup, `media.upload_forced` (info) on successful force bypass. Batch upload aggregates per-type counts into a single audit entry each. `create_media_batch` audit entry now carries `severity: 'warning'` and descriptive `summary` when `failed > 0`. `export_campaign` writes `campaign.exported` with format, mediaCount, summary, and resource fields. `export_campaign_binary` writes `campaign.exported` with jobId. Both `campaign.imported` calls (JSON and binary) upgraded with summary, resource_type, resource_id, resource_label, and format/count fields.
- `src/components/Admin/MediaTab.tsx` — `handleUpload` passes `campaign_id` to `uploadMany` so the upload endpoint can write campaign-scoped duplicate/near-dup audit entries. `handleNearDupUploadAnyway` also passes `campaign_id` in extraFields so forced near-dup bypass is auditable.
- `WPSG_P40_CA1_Campaign_Coverage_Test.php` — 10 regression tests: duplicate rejection with and without campaign_id, duplicate rejection severity and summary fields, forced upload audit entry and summary, JSON export audit entry and summary, JSON import audit entry with summary, all-success batch severity (info), partial-failure batch severity (warning).

**Noise exclusions applied:** Duplicate/near-dup detection is only audited when `campaign_id` is explicitly provided. Upload-level events without a campaign context produce no audit entries. Read-only operations (list, view) remain excluded.

**Verification:** 10 PHP tests pass (`OK (10 tests, 28 assertions)`); full suite passes (`OK (833 tests, 2640 assertions)`); lint clean; build clean.

### Status: Complete

---

## Track P40-SA1 — System-Scope Audit Coverage Expansion

### Problem

Several important admin-only operations still have no audit path because the
current model is centered on campaign-related changes.

The clearest gaps are system-facing surfaces such as:

- settings updates,
- auth login and logout outcomes,
- layout-template CRUD and duplication,
- taxonomy CRUD,
- other admin configuration changes with no single campaign owner.

Those actions matter operationally and often materially change application
behavior, but they cannot be represented cleanly if the audit system remains
strictly campaign-scoped.

### Goal

Add first-class system-scope audit coverage for admin operations that affect the
application as a whole or do not belong to a single campaign.

### Implementation outline

1. Audit settings changes at the save point, with a constrained changed-fields
   payload and appropriate redaction.
2. Audit auth login success, login failure, and logout using the system-scope
   event contract.
3. Audit layout-template create, update, delete, duplicate, import, and export
   operations.
4. Audit campaign-category and campaign-tag CRUD, and apply the same review to
   media-tag mutations if they remain in active admin use.
5. Keep resource context explicit so system-scope rows still identify what was
   changed and by whom.

### Key files

- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Admin/LayoutTemplateList.tsx`
- `src/components/Admin/TaxonomyManagerModal.tsx`
- `src/contexts/AuthContext.tsx`
- `src/services/auth/WpJwtProvider.ts`

### Explicit coverage targets

- app settings update,
- auth login success,
- auth login failure,
- auth logout,
- layout template create/update/delete/duplicate/import/export,
- campaign category create/update/delete,
- campaign tag create/delete,
- media tag create/delete if retained as an active admin surface.

### Redaction rules

- Do not log plaintext passwords, tokens, or other secrets.
- Do not dump full settings payloads when a constrained changed-fields summary
  is sufficient.
- Do not emit low-value auth noise such as every background token refresh unless
  it is promoted to an actionable warning or error case.

### Acceptance criteria

- System-scope admin actions have first-class audit coverage without fake
  campaign IDs.
- The added entries identify actor, resource, scope, severity, and summary
  clearly.
- Sensitive values remain redacted.
- Automated coverage exists for the main settings, auth, template, and taxonomy
  audit paths.

### Implementation Notes

**Coverage targets shipped vs. deferred:**
- `auth.login_success` / `auth.login_failed` / `auth.logout` — all implemented. Login failure uses `severity: 'warning'`. Logout captures actor before `wp_logout()` so the session is still valid when the audit entry is written.
- `settings.updated` — written by both `update_settings` (POST) and `patch_settings` (PATCH) only when keys actually changed vs. current stored values; no-ops produce no entry. Values are redacted; only changed key names are logged.
- `layout_template.created/updated/deleted/duplicated` — all four mutations audited with template name, resource_type, scope=system.
- `taxonomy.term_created/updated/deleted` — implemented via `handle_term_insert` and `handle_term_delete` shared helpers + direct call in `update_campaign_category`. Covers campaign categories, campaign tags, and media tags.
- Layout template import/export — no routes exist in the current codebase; deferred to a future phase if those routes are added.

**Changes shipped:**
- `class-wpsg-rest.php` — `handle_cookie_login`: `auth.login_failed` (warning) on 401 path; `auth.login_success` after `wp_set_current_user`. `handle_cookie_logout`: audit written before `wp_logout()` to preserve actor context. `update_settings`/`patch_settings`: `settings.updated` with `changedKeys` array; skipped on no-ops. `create/update/delete/duplicate_layout_template`: system-scope audit entries with name, resource_type. `update_campaign_category`: `taxonomy.term_updated` inline. `handle_term_insert`: `taxonomy.term_created` after successful insert. `handle_term_delete`: `taxonomy.term_deleted` before return. `taxonomy_label()` private helper maps taxonomy slugs to human-readable labels.
- `WPSG_P40_SA1_System_Coverage_Test.php` — 19 tests / 62 assertions covering all new system-scope paths.

**Verification:** 19 SA1 tests pass; full suite `OK (852 tests, 2702 assertions)`; lint clean; build clean.

### Status: Complete

---

## Track P40-QA1 — Regression Coverage, Docs, QA, and Backlog Closeout

### Problem

Phase 40 touches storage, API behavior, admin UI language, and multiple mutation
surfaces. Without focused verification and documented admin expectations, the
phase could easily widen audit coverage while leaving regressions undetected or
the final behavior under-explained.

Phase 40 also needs explicit backlog closeout discipline so the audit-related
items surfaced during planning are either completed, narrowed, or moved forward
cleanly rather than duplicated across future reports.

### Goal

Close Phase 40 with regression coverage, documented audit semantics, manual QA,
and explicit cleanup of any residual audit-domain backlog items.

### Implementation outline

1. Preserve the campaign-audit bug from `P40-BS1` as a regression test.
2. Extend PHP coverage for the expanded event contract, system-scope events,
   duplicate-media outcomes, and any new serialization/export behavior.
3. Extend Vitest coverage for renamed audit surfaces, new row summaries,
   expanded frontend types, and any touched admin flows.
4. Update audit-facing docs so admins understand the difference between
   campaign activity and system audit, what severities mean, and what is
   intentionally excluded from logging.
5. Reconcile any audit-domain follow-ups in `docs/FUTURE_TASKS.md` or related
   planning docs once implementation outcomes are known.

### Key files

- `wp-plugin/wp-super-gallery/tests/WPSG_P28G_Audit_Log_Test.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_P28N_Duplicate_Detection_Test.php`
- `wp-plugin/wp-super-gallery/tests/WPSG_P38MD1_PHash_Test.php`
- `src/components/Admin/AuditTab.test.tsx`
- `src/components/Admin/GlobalAuditTab.test.tsx`
- `src/services/adminQuery.test.tsx`
- `docs/FUTURE_TASKS.md`
- `docs/PHASE40_REPORT.md`

### Acceptance criteria

- The campaign-audit bug is covered by regression tests.
- The expanded event contract has backend and frontend coverage.
- The renamed and clarified audit UI has dedicated UI coverage.
- Admin-facing docs explain the final audit model, review surfaces, and
  exclusions.
- Remaining audit follow-ups are explicitly closed, deferred, or moved to the
  appropriate backlog surface.

### Implementation Notes

**Coverage verified:** Regression tests were shipped inline with each track — no gaps at close.

- `WPSG_P40_BS1_Audit_Baseline_Test.php` — 3 tests: full `POST .../archive` → `GET .../audit` round-trip and cross-route agreement.
- `WPSG_P40_CT1_Event_Contract_Test.php` — 7 tests: schema presence, insert/format round-trip, scope/severity filtering, REST param forwarding, legacy-row defaults.
- `WPSG_P40_CA1_Campaign_Coverage_Test.php` — 10 tests: duplicate rejection, forced upload, batch severity, JSON export/import audit entries.
- `WPSG_P40_SA1_System_Coverage_Test.php` — 19 tests: auth login/logout, settings update, layout template CRUD, taxonomy term CRUD.
- Frontend audit coverage: `AuditTab.test.tsx` (12 tests), `GlobalAuditTab.test.tsx` (20 tests), `adminQuery.test.tsx` (5 tests) — 37 tests covering error surfacing, renamed headings, help text, summary-first rendering, severity badge, and scope/severity query forwarding.

**Suite totals at phase close:** PHP `OK (852 tests, 2702 assertions)`; 37 frontend audit tests; lint clean; build clean.

**Backlog reconciliation:** One audit-domain item remains in `docs/FUTURE_TASKS.md` — "Audit Log Binary Export" (Campaign Management section). It is already correctly deferred: the engine exists (`WPSG_Export_Engine`, shipped P39-CM1) but the compliance-specific use case does not justify Phase 40 scope. Listed in the Follow-On Candidates table above. No promotion or closure action required.

### Status: Complete

---

## Testing Strategy

### Frontend

- Run targeted audit UI and query coverage:
  `npm test -- src/components/Admin/AuditTab.test.tsx src/components/Admin/GlobalAuditTab.test.tsx src/services/adminQuery.test.tsx`
- Run targeted Vitest suites for touched admin surfaces after implementation,
  especially Media, Settings, Layout Templates, Taxonomy, and Auth surfaces.
- Run `npm run lint`.
- Run `npm run build`.

### Backend

- Run the existing repo PHPUnit harness for:
  - `WPSG_P28G_Audit_Log_Test.php`,
  - `WPSG_P28N_Duplicate_Detection_Test.php`,
  - `WPSG_P38MD1_PHash_Test.php`,
  - new Phase 40 audit coverage for system-scope events, severity, summaries,
    and redaction rules.

### Manual QA

- Verify campaign audit entries appear after a known-audited mutation.
- Verify the same event is visible through the filtered system audit route.
- Verify `Campaign Activity` and `System Audit` wording and help text are clear.
- Verify duplicate and near-duplicate media outcomes are durable and readable.
- Verify settings, auth, layout-template, and taxonomy changes create clear
  system-scope entries.
- Verify CSV export still returns a usable audit export after the event model
  expands.

## Follow-On Candidates

These items were surfaced during planning but are intentionally outside Phase 40
unless later implementation work proves they are inseparable.

| Candidate | Why it is deferred |
|-----------|--------------------|
| Audit retention and archival policy | Important for long-term operations, but Phase 40 first needs a stable event model and clear admin review surface. |
| Saved filters, search, or full-text audit exploration | Useful after summaries and scope are stabilized; not required to make the core audit surface understandable. |
| External shipping of audit events to third-party systems | Better considered after the canonical event contract is proven locally. |
| Non-admin or end-user activity history surfaces | Phase 40 is explicitly admin-audit focused. |
| Fine-grained role-based audit redaction rules | Can follow once the new event contract and system-scope coverage are established. |

## Implementation Notes

- Planning-only report at creation time; no Phase 40 implementation has landed
  yet.
- Start with a deterministic audited mutation and keep the first investigation
  tightly scoped until the campaign-audit failure is explained.
- Keep event-summary generation centralized. Avoid scattering ad hoc summary
  strings across individual React components.
- Prefer additive compatibility behavior where practical, but do not let
  backward compatibility block the introduction of true system-scope audit
  events.

## Outcome

All six tracks shipped as planned.

**P40-BS1 — Campaign audit baseline stabilization.** Root cause was a silent error-swallow in `AdminPanel.tsx`: `auditError` from `useAuditEntries` was never destructured or forwarded to `AuditTab`, so any non-2xx backend response rendered as "No audit entries yet." rather than a visible error message. Fixed and covered by 3 regression tests confirming the full REST mutation → REST audit-retrieval round-trip.

**P40-CT1 — Canonical event contract.** Additive 7-column migration (`severity`, `scope`, `summary`, `resource_type`, `resource_id`, `resource_label`, `source`) on `wpsg_audit_log` via `dbDelta`. Legacy rows remain fully displayable. Scope `system` is the authoritative marker for plugin-level events; `campaign_id = 0` is the storage convention. All new Phase 40 entries authored against the expanded contract.

**P40-UX1 — Audit surface naming and presentation.** `Global Audit` → `System Audit`; `Audit` → `Campaign Activity`. Shared `AuditEventRow` component renders summary-first with a colour-coded severity badge, resource label, actor, and raw details; used by both audit surfaces so they cannot drift. Help text added to both headings.

**P40-CA1 — Campaign-scoped coverage expansion.** Five previously uncovered paths now produce first-class audit entries: exact duplicate rejection (`media.duplicate_rejected`, warning), near-duplicate detection (`media.near_duplicate_detected`, warning), forced-upload bypass (`media.upload_forced`, info), partial-failure batch creation (`media.batch_created`, warning when `failed > 0`), and campaign JSON/binary import/export (`campaign.exported`, `campaign.imported`). Upload endpoint extended with optional `campaign_id` param; `MediaTab.tsx` passes it through `extraFields` so the upload-path audit context is available without a request-body change.

**P40-SA1 — System-scope coverage expansion.** Five previously uncovered admin surfaces now produce `scope=system` audit entries without fake campaign IDs: auth login success/failure and logout (`auth.login_success`, `auth.login_failed`, `auth.logout`); settings saves when values actually changed (`settings.updated`, redacted to changed key names only); layout template create/update/delete/duplicate; taxonomy term create/update/delete across campaign categories, campaign tags, and media tags.

**P40-QA1 — Regression coverage, docs, QA, and backlog closeout.** 39 PHP regression tests (across 4 new test files) and 37 frontend audit tests cover all Phase 40 changes. "Audit Log Binary Export" in `docs/FUTURE_TASKS.md` confirmed deferred — the engine exists but the compliance use case is not Phase 40 scope.

**Deferred items (not in scope for Phase 40):** Audit retention/archival policy, saved filters and full-text audit search, external shipping of audit events, non-admin activity history, role-based audit redaction, audit log binary export.

---

## Post-Merge Review — PR #55

Four issues identified by Copilot review and addressed in commit `02cc499a`:

**`class-wpsg-db.php` — `summary` column type.** `TEXT NOT NULL DEFAULT ''` is not supported on MariaDB and older MySQL versions (DEFAULT is prohibited on BLOB/TEXT columns). Changed to `VARCHAR(255) NOT NULL DEFAULT ''`, which is safe for `dbDelta` and adequate for a one-line summary string.

**`class-wpsg-rest.php` — `add_audit_entry` source backward-compat.** Legacy WP-CLI callsites pass `source` inside `$details` (e.g. `['source' => 'cli']`). With the new canonical `source` column reading from `$ctx`, those events would have been stored with `source='rest'`. Added a shim at the top of `add_audit_entry`: if `$ctx['source']` is absent and `$details['source']` is a string, it is promoted to `$ctx['source']` and removed from `$details` before the insert.

**CA1 `test_batch_created_with_all_valid_items_has_info_severity`.** The original test used `assertContains([201, 200])` and wrapped the severity assertion in an `if (!empty($batch))` guard that could pass silently if the audit entry was never written. Tightened to assert `201` explicitly, then `assertNotEmpty` on the batch entry, then the `info` severity assertion — all unconditional.

**CA1 `test_batch_created_with_failures_has_warning_severity`.** The original test had a `markTestSkipped` branch that could mask regressions on a payload that deterministically produces one added and one failed item. Replaced with unconditional assertions: `assertEquals(201)`, `assertCount(1, added)`, `assertCount(1, failed)`, then the `media.batch_created` / `warning` severity assertions. Suite total after fix: `OK (10 tests, 32 assertions)` (+4 assertions from the strengthened batch tests).

### Round 2

**`class-wpsg-db.php` — `maybe_upgrade_audit_log_v9` docblock.** The docblock claimed to "normalise the campaign_id DEFAULT to 0" but the method only guards on the `severity` column and re-runs `dbDelta`. Corrected the docblock to accurately describe what the method does: adds the seven new P40-CT1 audit columns via `dbDelta`, guarded by presence of `severity` as the first new column.

### Round 3

**`class-wpsg-db.php` — `insert_audit_entry` source default.** The raw insert function defaulted `source` to `''`, diverging from the `'rest'` default established by `WPSG_REST::add_audit_entry`. Changed the fallback to `'rest'`. `backfill_audit_entries` does not pass `source` and its entries predate the REST layer, so it now explicitly passes `'source' => 'legacy'` to avoid being mislabelled.

**`GlobalAuditTab.tsx` — stale aria-labels.** The tab was renamed to "System Audit" in P40-UX1 but the two `Table` aria-labels (`"Loading global audit entries"`, `"Global audit entries"`) were not updated. Changed to `"Loading system audit entries"` and `"System audit entries"` respectively. Corresponding test assertion in `GlobalAuditTab.test.tsx` updated to match.