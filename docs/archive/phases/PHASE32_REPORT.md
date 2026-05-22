# Phase 32 — Shared Infrastructure Maintenance, Observability & API Layer Decomposition

**Status:** Complete ✅
**Created:** 2026-05-19
**Last updated:** 2026-05-19

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P32-A | Scheduled archive batching & cron write-path hardening | Complete ✅ | Small |
| P32-B | WordPress settings facade simplification | Complete ✅ | Small |
| P32-C | `ApiClient` transport extraction & domain module split | Complete ✅ | Medium |
| P32-D | Structured server-side logging & bounded operator log surface | Complete ✅ | Medium |

---

## Rationale

1. The 2026-05-19 gallery/framework review surfaced three legitimate shared
  infrastructure items that do not belong in the gallery-focused Phase 31 lane,
  and the same-day FUTURE_TASKS reconciliation added one more: structured
  server-side logging.
2. Collectively they are not small: two are quick maintenance tasks, one is a
  bounded observability improvement, and `ApiClient` modularization is still a
  real refactor that would widen Phase 31 too far if combined with gallery
  reliability work.
3. Bundling these items into one shared-maintenance phase keeps gallery work and
  infrastructure work separately scoped while still preserving the review and
  backlog-cleanup momentum.
4. The first two tracks remain intentionally behavior-preserving cleanups and
  performance hardening. They should reduce low-level maintenance cost before
  larger diagnostic and client-side refactor work lands.
5. The structured-logging track is not greenfield. WPSG already emits REST
  timing headers, health metrics, fatal-error hooks, and alert thresholds, but
  operators still lack one consistent log format and one bounded place to read
  recent incidents.
6. The `ApiClient` work is still worth doing because transport concerns,
  auth/nonce handling, and domain-specific endpoints now coexist in one growing
  service class, which makes testing and future growth harder.
7. Success for this phase now means four outcomes: the archive cron path stops
  paying unnecessary per-post update cost, WordPress settings rendering sheds
  avoidable delegation boilerplate, operators gain structured logs for the most
  important infrastructure incidents, and the frontend API layer gains a thin
  transport abstraction with domain-oriented modules on top.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Where the deferred infrastructure review items belong | Track them in Phase 32 instead of widening Phase 31. |
| B | How to approach the archive cron optimization | Prefer a batched write path that preserves current behavior and cache-version semantics; do not assume raw SQL is correct unless cache and hook implications are handled explicitly. |
| C | How to simplify the PHP settings facade | Prefer explicit simplification or a constrained delegation map over broad `__callStatic` magic if the latter would reduce discoverability or static analysis quality. |
| D | How to restructure `ApiClient` | Separate thin transport concerns from domain-specific endpoint groups while preserving the current caller-facing behavior in the first pass. |
| E | How to sequence the phase | Ship the two small maintenance tracks first, then land the larger `ApiClient` refactor behind their lower-risk cleanup work. |
| F | How much behavior change is acceptable | Keep all three tracks behavior-preserving; this is an internal maintenance phase, not a product-surface redesign. |
| G | How to scope the observability work | Start with structured logging and a bounded operator-visible sink; do not bundle external metrics shipping or broad telemetry platform work into this phase. |
| H | Whether logging or `ApiClient` modularization lands first | Put structured logging ahead of the frontend API split so larger refactors benefit from better diagnostics and incident visibility. |

---

## Execution Priority

1. P32-A — Small, measurable backend maintenance win with low conceptual risk.
2. P32-B — Small cleanup that reduces boilerplate before larger settings-area
  changes accumulate.
3. P32-D — Add structured diagnostic visibility before the frontend API layer
  refactor so infrastructure work is easier to observe and validate.
4. P32-C — Larger refactor that benefits from landing after the smaller shared
  maintenance and observability work is out of the way.

## Track P32-A — Scheduled Archive Batching & Cron Write-Path Hardening Complete ✅

### Problem

`wpsg_run_schedule_auto_archive` currently queries expired campaigns in batches
of 100 but then archives them one by one with `update_post_meta`. That means the
selection query is batched while the write path is still effectively per-post.

The current path is simple, but it scales poorly and creates unnecessary write
load for campaigns with many expired records.

### Fix

Replace the per-post archive update loop with a batched write strategy that
preserves current observable behavior while reducing query count and write-path
overhead.

### Implementation Details

- Keep the current selection query and batch-size boundary unless measurement
  shows it is also a bottleneck.
- Evaluate whether the safest first implementation is a direct batched SQL
  update with explicit cache handling, or a more constrained helper that still
  avoids one `update_post_meta` call per post.
- Preserve the single post-run cache-version bump behavior already used by the
  cron function.
- Treat cache invalidation and hook semantics as part of the implementation
  contract, not as afterthoughts.

### Acceptance criteria

- Expired campaigns are archived in bounded batches without one meta update call
  per post. ( )
- Cache-version bump behavior remains correct and happens only once per run. ( )
- The cron path remains behavior-preserving from the caller's perspective. ( )

### Validation

- Add focused PHP coverage around scheduled auto-archive behavior if the current
  test harness can support it.
- Otherwise, run manual QA against a seeded set of expired campaigns and confirm
  archive status updates and cache behavior.
- Compare query or write counts before and after the change.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/wp-super-gallery.php` | Batched archive write-path optimization |
| `phpunit/` | Coverage for archive cron behavior if practical |

### Effort Estimate

~1-2 hours.

---

## Track P32-B — WordPress Settings Facade Simplification

### Problem

`WPSG_Settings` contains a large set of one-line delegation methods that simply
pass through to `WPSG_Settings_Core_Fields`, `WPSG_Settings_Service`, or
`WPSG_Settings_Renderer`. The pattern works, but it adds an avoidable indirection
layer and boilerplate maintenance cost for settings-related callbacks.

### Fix

Simplify the settings facade so settings-page wiring stays readable without
requiring a separate one-line wrapper for every renderer or section callback.

### Implementation Details

- Prefer explicit call-site simplification or a constrained delegation mechanism
  over a broad magic-method fallback if that keeps static analysis and grep-based
  discoverability stronger.
- Keep WordPress callback registrations readable and stable.
- Reduce duplication without collapsing truly distinct settings responsibilities
  into one opaque dispatch layer.

### Acceptance criteria

- Boilerplate delegation methods in `WPSG_Settings` are materially reduced. (✅)
- Settings-page rendering behavior and callback registrations remain intact. (✅)
- The resulting structure is easier to trace than the current wrapper-heavy
  layout. (✅)

### Validation

- Run existing PHP settings/admin tests if available.
- Manual QA: open the settings page and verify section descriptions and field
  renderers still appear correctly.
- Manual QA: verify settings-related AJAX/auth test flows still resolve through
  the expected handlers.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` | Facade simplification and callback cleanup |
| `wp-plugin/wp-super-gallery/includes/` | Possible call-site adjustments in settings support classes |

### Effort Estimate

~1-2 hours.

---

## Track P32-C — `ApiClient` Transport Extraction & Domain Module Split

### Problem

`ApiClient` currently combines low-level transport responsibilities — timeouts,
auth headers, nonce refresh, online checks, and response handling — with a large
set of domain-specific endpoint methods. That makes the service harder to grow,
harder to mock cleanly, and harder to reason about as more feature areas land.

### Fix

Refactor the frontend API layer so a thin transport abstraction owns shared HTTP
behavior and domain-specific API modules compose on top of it.

### Implementation Details

- Extract transport behavior first: timeout handling, auth header construction,
  nonce retry, online checks, and shared response parsing.
- Group domain methods into focused modules such as settings, campaigns,
  analytics, layout templates, and admin/support endpoints.
- Preserve current consumer behavior in the first pass, either through a
  compatibility facade or by migrating callers incrementally behind stable
  exports.
- Keep transport-level tests focused on retry/timeout/auth concerns and
  domain-level tests focused on path/body/response contracts.

### Acceptance criteria

- Shared transport logic is no longer coupled directly to every domain method. (✅)
- Domain-specific endpoint groups are separated into clearer modules. (✅)
- Existing consumers continue to work without broad behavioral regression. (✅)
- The refactor materially improves testability of both transport logic and
  endpoint groups. (✅)

### Validation

- Add focused unit coverage for transport retry/timeout/auth behavior.
- Add or update tests for at least one extracted domain module.
- Re-run relevant frontend tests that exercise settings, campaigns, and layout
  template flows.
- Manual QA: verify representative admin/API paths still succeed with auth and
  nonce refresh behavior intact.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/services/apiClient.ts` | Split transport and domain responsibilities |
| `src/services/` | New transport/domain modules and compatibility exports |
| `src/services/settingsQuery.ts` | Consumer updates if the service surface changes |
| `src/contexts/` | Any caller updates needed during migration |

### Effort Estimate

~4-6 hours.

---

## Track P32-D — Structured Server-Side Logging

### Problem

WPSG already records REST timing and health counters through `WPSG_Monitoring`,
and `WPSG_Alerts` can email on fatal errors or 500 spikes. But those signals
still terminate in a mix of ad hoc `error_log` lines, transient counters, and
admin health aggregates.

Operators still lack one consistent log format and one obvious place to inspect
recent infrastructure problems. That makes slow REST requests, oEmbed failures,
security warnings, and fatal errors harder to correlate during real incidents.

### Fix

Add a lightweight structured logging layer and wire the highest-value
infrastructure paths through it. Keep the first pass bounded: emit JSON
records, make the sink configurable, and surface recent logs to admins without
turning this phase into a full telemetry-platform build-out.

### Implementation Details

**Logger shape**

- Introduce a small `WPSG_Logger` facade with methods such as `info`,
  `warning`, and `error` that normalize context payloads into one JSON schema.
- Include fields such as timestamp, level, component, message, and structured
  `data`.
- Keep the first schema simple and append-only so existing log consumers are
  not required.

**Initial migration targets**

- Replace ad hoc infrastructure logging on slow REST paths, fatal-error
  capture, oEmbed failures, image-optimization failures, and security warnings
  where the current code already calls `error_log`.
- Keep purely user-facing validation failures out of the first pass unless they
  represent operator-relevant incidents.
- Preserve existing alert hooks and health metrics while adding structured log
  emission alongside them.

**Sink and admin visibility**

- Support one default sink plus a bounded admin-visible recent-log surface.
- Prefer a bounded file or ring buffer over unbounded option growth.
- The first admin surface can live in the existing health/monitoring area; a
  dedicated Logs screen is follow-on work if needed.

**Scope limits**

- Do not couple this track to StatsD/Prometheus or external log shippers.
- Do not redesign the monitoring/alerts system; this track should sit on top
  of it.

### Acceptance criteria

- Infrastructure log points emit one consistent structured format. (✅)
- Slow REST, fatal PHP, oEmbed failure, and security-warning paths are covered
  by the first-pass logger integration. (✅)
- Admins can inspect a bounded recent-log view without needing raw server
  access. (✅)
- Existing monitoring headers, health counters, and alert hooks remain
  behavior-preserving. (✅)

### Validation

- Add focused PHP coverage around logger formatting and at least one migrated
  integration path.
- Manual QA: trigger a representative slow REST log and a representative
  failure log, then confirm the sink and admin view both capture them.
- Manual QA: verify existing health/alert flows still work after the logger is
  introduced.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `wp-plugin/wp-super-gallery/includes/class-wpsg-logger.php` | New structured logging facade |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-monitoring.php` | Route slow REST and fatal-path logging through the facade |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-alerts.php` | Preserve alert hooks while aligning emitted log records |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Replace high-value infrastructure `error_log` callsites |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-image-optimizer.php` | Route optimizer failure logs through the facade |
| `src/components/Admin/` | Bounded recent-log UI in the existing admin/health area if needed |

### Effort Estimate

~3-5 hours.

---

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Full PHP settings architecture consolidation | The current phase only targets facade simplification, not a complete redesign of settings service boundaries. |
| External metrics or log-shipping integration | Keep the first observability pass focused on structured logging and local operator visibility before adding StatsD/Prometheus or external sinks. |
| Wider frontend service standardization sweep | Other service modules may benefit from the `ApiClient` split later, but Phase 32 should stop once the central client abstraction is modularized. |
| Carousel visible-card helper cleanup | Still not strong enough to justify shared-infrastructure planning; leave it opportunistic. |

## Implementation Notes

- P32-A landed with batched `status` writes in `wp-super-gallery.php`, a
  metadata-API fallback path for DB-write failures, and focused PHPUnit
  coverage in `tests/WPSG_Auto_Archive_Cron_Test.php`.
- P32-C split `src/services/apiClient.ts` (692 lines, mixed transport + domain)
  into a layered structure. `src/services/http/HttpTransport.ts` defines the
  `HttpTransport` interface and `ApiClientOptions`. `HttpTransportImpl`
  (http/HttpTransportImpl.ts) owns all shared transport concerns: timeout +
  AbortController, auth-header construction, nonce injection, nonce refresh on
  403, online guard, response parsing, and 401 callback. Five domain modules
  group endpoint concerns: `api/settingsApi.ts` (settings + connectivity probe),
  `api/layoutTemplatesApi.ts` (layout templates CRUD), `api/analyticsApi.ts`
  (event recording, campaign/media analytics, media usage), `api/campaignsApi.ts`
  (campaign CRUD, categories, tags, templates, media batches, export/import,
  access requests), and `api/adminApi.ts` (WP pages, audit CSV). `ApiClient` now
  extends `HttpTransportImpl` and delegates each domain method to the appropriate
  module — all existing import paths and call sites are unchanged. All types
  previously exported from `apiClient.ts` are re-exported for backward compat.
  New focused unit test `src/services/api/settingsApi.test.ts` (7 tests) proves
  domain modules are independently testable with a mock transport. Full Vitest
  suite: 133 files, 1808 tests, all green.
- P32-D added `WPSG_Logger` (`includes/class-wpsg-logger.php`) — a static
  facade with `info()`, `warning()`, and `error()` methods that emit one
  consistent JSON record (timestamp, level, component, message, optional data)
  to two sinks: the PHP error log and a bounded in-database ring buffer
  (`wpsg_recent_logs`, default 200 entries, configurable via
  `wpsg_log_max_entries` filter). Six ad hoc `error_log` callsites were
  migrated: fatal-error capture in `WPSG_Monitoring`, nonce-bypass security
  warning and both oEmbed failure paths in `WPSG_REST`, slow-REST warning in
  `WPSG_REST`, and image-optimization failure in `WPSG_Image_Optimizer`.
  `WPSG_Monitoring::get_health_data()` now includes a `recentLogs` key (last
  50 entries) so admins can read structured logs from the existing
  `/wp-super-gallery/v1/admin/health` REST endpoint without raw server access.
  All existing monitoring headers, health counters, and alert hooks are
  behavior-preserving. PHPUnit coverage added in `tests/WPSG_Logger_Test.php`
  (11 tests). Full suite: 685 tests, 2294 assertions, all green.
- P32-B removed 16 dead delegation wrappers from `WPSG_Settings` (all
  `render_*` section/field methods, `add_menu_page`, `register_settings`,
  `render_settings_page`, `snake_to_camel`, `extract_google_font_families`,
  `filter_auth_provider`, and `filter_api_base`). The WP filter hooks in
  `init()` now register directly on `WPSG_Settings_Service`. The one
  production caller of `extract_google_font_families` in
  `class-wpsg-embed.php` was updated to call `WPSG_Settings_Typography`
  directly. Tests in `WPSG_Settings_Extended_Test.php` and
  `WPSG_Settings_Test.php` were updated to call implementation classes
  directly. Full PHPUnit suite: 674 tests, 2258 assertions, all green.
- Structured logging was promoted into this phase during the 2026-05-19
  FUTURE_TASKS reconciliation because the monitoring foundation already exists
  and the remaining gap is operator-facing log consistency, not greenfield
  metrics work.
- Keep this phase intentionally maintenance-oriented and behavior-preserving.
- If P32-C grows beyond a controlled transport/domain split, move deeper design
  notes into a supporting addendum instead of overloading this report.
- Do not silently pull gallery reliability or adapter-schema work back into this
  phase; those concerns remain Phase 31 scope.

---

## PR Review — 2026-05-22

**Reviewer:** Claude Sonnet 4.6 (automated)
**Branch:** `feat/phase32-infrastructure-updates`
**PR:** #48
**Review commit:** `dcebc9e` — `fix(p32-review): address PR review findings`

---

### Issues Found and Resolved

#### 🔴 Issue 1 — P32-A: SQL fallback on INSERT failure used the wrong ID set

**File:** `wp-plugin/wp-super-gallery/wp-super-gallery.php`

**What was wrong:**
`wpsg_archive_campaign_status_batch()` processes two phases: first a batched SQL
`UPDATE` for IDs that already have a `status` row, then a batched `INSERT` for IDs
that do not.  If the `INSERT` failed, the fallback called
`wpsg_archive_campaign_status_batch_fallback($post_ids)` — the full original set —
rather than `$missing_ids` (the rows that were never written).  This meant:

1. Already-archived posts had `update_post_meta('status', 'archived')` called on
   them a second time, redundantly.
2. WordPress fired `updated_post_meta` on those posts again.
3. The return value overstated how many posts were newly processed, which is
   misleading to any caller counting results.

The `UPDATE` phase succeeded; only the `INSERT` rows needed retrying.

**Severity:** 🔴 Red — correctness bug under partial failure (rare path, safe
outcome, but wrong semantics and noisy hook side-effects).

**Resolution:** Changed the fallback call to receive `$missing_ids` and combined
the return values: `count($existing_ids) + wpsg_archive_campaign_status_batch_fallback($missing_ids)`.
PHPUnit: 685/685 green (unchanged — the existing three archive-cron tests cover
the happy path; the bug only manifests on a DB INSERT failure which the test
environment does not simulate, so no new test was warranted here).

---

#### 🔴 Issue 2 — P32-C: `HttpTransportImpl` had no unit tests

**Files:** `src/services/http/HttpTransportImpl.ts` (new `HttpTransportImpl.test.ts`)

**What was wrong:**
The phase plan explicitly committed to "focused unit coverage for transport
retry/timeout/auth behavior" as part of P32-C's acceptance criteria and validation
section.  Only `settingsApi.test.ts` was delivered, proving domain modules are
mockable.  The transport's non-trivial internal paths — `AbortController` timeout
compositing with external signals, 403 → nonce refresh → single retry, the
already-aborted signal short-circuit, the offline guard, and 401 callback — had
no isolated tests.  The pre-existing `apiClient.test.ts` exercises these
behaviours end-to-end through `fetch` mocks, but that is integration coverage, not
the isolated transport coverage the plan required.

**Severity:** 🔴 Red — plan commitment gap.  The transport layer is the most
complex part of P32-C and contains branching async logic (retry loop, signal
compositing, timeout propagation) that is hard to diagnose from integration test
failures alone.

**Resolution:** Added `src/services/http/HttpTransportImpl.test.ts` (19 tests)
covering:
- Timeout fires → `ApiError(status: 0)` with `message.includes('timed out')`
- No timeout when response arrives before deadline
- `timeout: 0` bypasses `AbortController` entirely
- External signal abort during in-flight request
- Already-aborted signal short-circuit (no async race needed)
- Nonce injected from `__WPSG_REST_NONCE__`
- Bearer token injected from `authProvider`; omitted when provider returns `null`
- 401 invokes `onUnauthorized`; non-401 errors do not
- 403 → nonce refresh → retry returns retried response
- 403 retry suppressed when refresh endpoint itself fails
- Non-403 errors do not trigger the refresh path at all
- `__WPSG_REST_NONCE__` updated with refreshed nonce after successful refresh
- `navigator.onLine === false` throws `ApiError(status: 0)` before `fetch`
- JSON error message extracted from response body; fallback to `'Request failed'`
- `getBaseUrl()` and `getAuthHeaders()` accessors

Two implementation notes during test authoring:
1. `ApiError` does not set `this.name` in its constructor, so `name` is `'Error'`
   not `'ApiError'`.  Tests use `instanceof ApiError` assertions rather than
   matching on `name`.
2. `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()` is required for async
   timer tests — `advanceTimersByTime()` fires the `setTimeout` callback before the
   async chain has progressed to `fetch()`, causing the abort listener to be
   attached after the signal already fired.  `advanceTimersByTimeAsync(0)` flushes
   pending microtasks first.  The rejection capture (`const captured = promise.catch(e => e)`)
   must also be registered synchronously before any `await` to prevent a transient
   unhandled-rejection warning.

Vitest: 1827/1827 green (+19 new).

---

#### 🟡 Issue 3 — P32-D: `append_to_buffer` performance cost was not documented

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-logger.php`

**What was wrong:**
Every `WPSG_Logger` call runs `get_option()` + `update_option()` synchronously on
the request that produced the event, deserializing and re-serializing the full
ring buffer (up to 200 entries) each time.  This cost is acceptable for rare events
(fatal errors, oEmbed failures) but meaningful for `log_slow_rest`, which fires on
every request exceeding the 500 ms threshold — a path that is by definition already
under load.  Nothing in the code or comments signalled this trade-off to a future
engineer.

**Severity:** 🟡 Yellow — no regression, but an undocumented performance assumption
in a hot path.

**Resolution:** Added a `## Performance model` section to the class-level docblock
describing the synchronous DB round-trip cost per event, when it matters, and what
follow-on mitigation would look like (deferred/async flush).  Added a one-line
summary comment on `append_to_buffer()` itself.

---

#### 🟡 Issue 4 — P32-D: Ring buffer race condition was not documented

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-logger.php`

**What was wrong:**
`append_to_buffer()` is an unguarded `get_option` → modify → `update_option`
read-modify-write.  Concurrent PHP processes (e.g., two simultaneous slow REST
requests both crossing the log threshold) can overwrite each other's entries; the
last writer wins.  For an observability ring buffer this is acceptable, but nothing
in the code stated it as a deliberate choice.  A future engineer debugging
"missing" log entries could spend considerable time before realising the design
does not guarantee delivery.

**Severity:** 🟡 Yellow — known and acceptable concurrency trade-off, but
undocumented.

**Resolution:** Added a `## Concurrency` section to the class-level docblock
documenting the unguarded read-modify-write and stating explicitly that the buffer
is not suitable for audit-critical event guarantees.  Added a matching inline
comment on `append_to_buffer()`.

---

#### 🟡 Issue 5 — P32-B: Inconsistent source in `class-wpsg-embed.php` after facade cleanup

**File:** `wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php`

**What was wrong:**
P32-B correctly migrated the `extract_google_font_families()` call from
`WPSG_Settings` to `WPSG_Settings_Typography`, and the guard was updated to check
`class_exists('WPSG_Settings_Typography')`.  But the very next line read
`$specs = WPSG_Settings::GOOGLE_FONT_SPECS`.  `WPSG_Settings::GOOGLE_FONT_SPECS` is
a constant alias forwarded from `WPSG_Settings_Typography::GOOGLE_FONT_SPECS`, so
it is functionally correct.  However:

1. The guard checks for `WPSG_Settings_Typography` but the code then reads from
   `WPSG_Settings`, creating a misleading dependency chain.
2. If the alias in `WPSG_Settings` were ever removed (e.g., during a future full
   facade removal), the embed logic would silently break while the guard still
   passes.

**Severity:** 🟡 Yellow — works correctly today, but creates a hidden dependency
that contradicts the stated direction of P32-B.

**Resolution:** Changed `$specs = WPSG_Settings::GOOGLE_FONT_SPECS` to
`$specs = WPSG_Settings_Typography::GOOGLE_FONT_SPECS`, making both lines in the
block consistent and directly sourced from the class the guard already checks.

---

### Test Results After Fixes

| Suite | Before | After |
|-------|--------|-------|
| PHPUnit | 685 tests, 2294 assertions | 685 tests, 2294 assertions |
| Vitest | 133 files, 1808 tests | 134 files, 1827 tests (+19 transport) |

All suites green.

---

### Issues Not Raised (and why)

| Observation | Disposition |
|-------------|-------------|
| `updated_post_meta` / `added_post_meta` hooks bypassed by batch SQL in P32-A | The only registered hooks in WPSG that listen to these actions filter on `meta_key === 'media_items'`, not `status`. The bypass is intentional and safe for the `status` key. No issue. |
| `ApiClient extends HttpTransportImpl` instead of composition | Accepted trade-off for zero call-site migration. Noted as a follow-on candidate if transport swapping ever becomes necessary. Not an actionable defect now. |
| `WPSG_Logger::clear_logs()` has no capability check | No REST endpoint exposes it; the method is only callable by internal code. A capability guard is explicitly documented as a requirement for any future endpoint that wraps it. No issue today. |
| Ring buffer `get_option`/`update_option` adds 2 DB round-trips on slow REST | Documented (Issue 3 above). Follow-on deferred async flush is noted in the docblock. No code change needed beyond documentation. |