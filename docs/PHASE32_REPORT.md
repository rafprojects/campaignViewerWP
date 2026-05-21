# Phase 32 — Shared Infrastructure Maintenance, Observability & API Layer Decomposition

**Status:** Planned
**Created:** 2026-05-19
**Last updated:** 2026-05-19

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P32-A | Scheduled archive batching & cron write-path hardening | Complete ✅ | Small |
| P32-B | WordPress settings facade simplification | Planned | Small |
| P32-C | `ApiClient` transport extraction & domain module split | Planned | Medium |
| P32-D | Structured server-side logging & bounded operator log surface | Planned | Medium |

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

- Boilerplate delegation methods in `WPSG_Settings` are materially reduced. ( )
- Settings-page rendering behavior and callback registrations remain intact. ( )
- The resulting structure is easier to trace than the current wrapper-heavy
  layout. ( )

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

- Shared transport logic is no longer coupled directly to every domain method. ( )
- Domain-specific endpoint groups are separated into clearer modules. ( )
- Existing consumers continue to work without broad behavioral regression. ( )
- The refactor materially improves testability of both transport logic and
  endpoint groups. ( )

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

- Infrastructure log points emit one consistent structured format. ( )
- Slow REST, fatal PHP, oEmbed failure, and security-warning paths are covered
  by the first-pass logger integration. ( )
- Admins can inspect a bounded recent-log view without needing raw server
  access. ( )
- Existing monitoring headers, health counters, and alert hooks remain
  behavior-preserving. ( )

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
- Structured logging was promoted into this phase during the 2026-05-19
  FUTURE_TASKS reconciliation because the monitoring foundation already exists
  and the remaining gap is operator-facing log consistency, not greenfield
  metrics work.
- Keep this phase intentionally maintenance-oriented and behavior-preserving.
- If P32-C grows beyond a controlled transport/domain split, move deeper design
  notes into a supporting addendum instead of overloading this report.
- Do not silently pull gallery reliability or adapter-schema work back into this
  phase; those concerns remain Phase 31 scope.