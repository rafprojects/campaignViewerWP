# Future Tasks & Enhancements

This document tracks deferred and exploratory work remaining after Phase 18 is planned. Items promoted to active phase execution are moved into dedicated phase reports and removed from this backlog.

> **Note:** Phase 18 is under way — see [PHASE18_REPORT.md](PHASE18_REPORT.md) for the promoted items (bulk actions, campaign duplication, export/import JSON, keyboard shortcuts, analytics dashboard, media usage tracking, campaign categories, access request workflow, App.tsx/AdminPanel.tsx reduction, JS+PHP coverage to ≥ 75 %).

---

## Builder

### Full-Page Route for Layout Builder (`/builder/:templateId`)

**Context:** The Layout Builder currently lives inside a Mantine `<Modal fullScreen>` overlay. This is pragmatic (no router changes, no callsite changes) but carries long-term costs: z-index management over the WP admin bar, no bookmarkable/shareable URL, Mantine's focus trap interacting with dockview floating panels.

**What it would take:**
- Add a dedicated admin route using the project's existing client-side router (or React Router if not yet wired).
- Protect the route: requires `manage_wpsg` capability; redirect to `/` if unauthenticated.
- The `opened` / `onClose` / `onSaved` prop API on `LayoutBuilderModal` becomes redundant — replace with `useNavigate()`.
- WP admin page registration: add a hidden admin page slug that loads the SPA so WordPress renders the full admin chrome (or a stripped canvas-only mode).

**Open questions:**
- Q1: Should the builder route fully own the WP admin viewport (strip sidebar + top bar) for a distraction-free canvas experience, or keep the WP admin chrome?
- Q2: Does the URL include the template ID (`/builder/tpl-uuid`) or the campaign ID? The template is the editing target, but users navigate from a campaign — both IDs may be relevant.
- Q3: Cross-tab consistency: if a user has the builder open in two tabs and saves from one, the other tab will have stale state — how is this handled?

**Effort:** Medium | **Impact:** Medium — primarily a DX/UX quality-of-life win; blocks shareable builder URLs.

---

### Builder Keyboard Shortcuts (Builder-Specific)

**Context:** P18-E covers admin panel shortcuts only. The builder warrants its own shortcut set — it is a design tool, not a data management UI, and has different interaction conventions.

**Proposed shortcut map:**

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Ctrl+S` / `Cmd+S` | Save template |
| `Escape` | Deselect current layer / close floating panel |
| `Arrow keys` | Nudge selected slot/graphic layer by 1 % |
| `Shift+Arrow` | Nudge by 10 % |
| `Delete` / `Backspace` | Remove selected layer (with confirmation) |
| `[` / `]` | Send backward / bring forward (z-order) |
| `H` | Toggle hand/pan tool |
| `V` | Return to select/move tool |
| `0` | Reset canvas zoom to 100 % |
| `+` / `-` | Zoom in / out |

**Open questions:**
- Q1: Should builder shortcuts conflict-check against admin panel shortcuts (P18-E)? The builder runs in a full-screen modal overlay — both `useHotkeys` scopes are mounted simultaneously. A `scopeKey` or activation/deactivation on modal open/close is needed.
- Q2: Nudge values — should `Arrow` nudge by 1 px (absolute) or 1 % (relative to canvas)? Relative is more consistent when canvas is zoomed.

**Effort:** Low | **Impact:** Medium

---

### Shortcut User Configuration

**Context:** P18-E deploys a fixed shortcut map. Power users will want to remap keys — e.g. `Ctrl+K` instead of `/` for search (VS Code convention), or avoiding `Ctrl+N` for users who rely on browser new-tab.

**What it would take:**
- Settings page section: "Keyboard Shortcuts" — a table of all shortcuts with editable key binding fields.
- Store the map in `localStorage` as JSON keyed by action ID.
- A "Reset to defaults" button.
- Conflicts detected at save time (two actions bound to the same key → validation error).

**Open questions:**
- Q1: Should shortcut config be per-user (browser-local) or per-site (WP user meta)? Local storage is simpler but doesn't persist across devices.
- Q2: Should certain shortcuts (Escape, standard browser shortcuts) be locked against remapping?

**Effort:** Medium | **Impact:** Low — niche power-user feature

---

### Builder Template Deep Clone

**Context:** P18-C's campaign duplication shares the layout template by reference. Editing the duplicate's layout changes the original too. A "deep clone" duplicates the template itself and points the new campaign at the copy.

**Open questions:**
- Q1: Should deep clone be an option in the P18-C duplicate modal, or a separate action in the Layout Builder?
- Q2: Template naming convention for clones: append "(Copy)" to the template name, or prompt for a new name?

**Effort:** Low (builds on P18-C plumbing) | **Impact:** Medium

---

### Campaign Analytics — Extended Scope (P18-F Follow-Ups)

**Context:** P18-F covers per-campaign view counts and unique visitors with a daily line chart. Several natural follow-ons were explicitly out of scope for P18:

**Per-media-item view counts:**
- Track which media items within a campaign are viewed (opened in lightbox or played).
- Requires a `media_id` column in `wpsg_analytics_events` and a secondary aggregation query.
- UI: a "Media performance" section below the campaign chart.
- Open question: does tracking per-media views materially increase the row volume in the events table? (Potentially 10–50× more events per session — the retention/cleanup job becomes more critical.)

**Aggregate cross-campaign dashboard:**
- A top-level "Analytics" admin tab showing total views across all campaigns, top-10 campaigns by views, a trend line for the whole gallery.
- No new data model required — aggregates are queryable via the same events table from P18-F.
- Open question: should this be a new admin tab or a section within the existing admin panel?

**Real-time updates:**
- Poll the aggregation endpoint every 30–60 seconds when the analytics tab is open.
- Full WebSocket or SSE is likely overkill for this use case.

**External analytics integration:**
- Emit a `wpsg_gallery_view` action that third-party plugins can hook to inject a Google Analytics / Matomo beacon.
- No first-party API keys required — the hook provides `campaign_id` and `media_id` in the payload.

**Effort:** Medium per follow-on | **Impact:** Medium–High

---

### Analytics: Magic-Link Auto-Approval for Access Requests (P18-I Follow-Up)

**Context:** P18-I requires admin action in the panel to approve access requests. A magic-link in the approval-notification email would let the admin approve with one click from their inbox without opening the admin panel.

**Open questions:**
- Q1: Security model — the magic-link token must be single-use and time-limited (e.g. 24 hours). Is HMAC token rotation after use adequate, or does it need to be scoped to the admin's WP session?
- Q2: Should the magic-link silently approve and redirect to a confirmation page, or open the admin panel with the approval pre-filled? Silent approval is more convenient but less transparent.

**Effort:** Low (single endpoint + email template change) | **Impact:** Medium

---

### Access Request Workflow — Scale Considerations (P18-I Follow-Up)

**Context:** P18-I stores access requests as WP options (keyed by token) with an index option listing all tokens. This is adequate for a few hundred requests per campaign. At higher volumes, a dedicated table is warranted.

**What it would take:**
- `wpsg_access_requests` table: `(id, token, email, campaign_id, status, requested_at, resolved_at)`.
- Index on `(campaign_id, status)` for admin list queries.
- Migrate existing option-based records at plugin upgrade time.

**Open questions:**
- Q1: What is the realistic upper bound of access requests for a typical installation? For most galleries this never exceeds a few hundred — the option approach may be indefinitely adequate.
- Q2: If a dedicated table is added, should it also store a `user_id` column (for when the requester is a logged-in WP user)?

**Effort:** Low (schema + migration) | **Impact:** Low for most, Medium for high-traffic galleries

---

### Campaign Export — Full Binary Media Export (P18-D Follow-Up)

**Context:** P18-D exports media by URL reference only. For deployments where source media is on a CDN that the target WP instance cannot access, a full binary export (ZIP of media files + JSON manifest) would be needed.

**Open questions:**
- Q1: ZIP generation on the server requires `ext-zip`. Should the feature require this PHP extension, or use `file_get_contents` to stream media (which has SSRF risk if URLs are untrusted)?
- Q2: What is a reasonable size limit for a single export? (Proposed: 50 MB hard limit, user-configurable up to 250 MB in settings.)
- Q3: Should the export be generated synchronously (small galleries only) or via a background WP-Cron job with a progress indicator?

**Effort:** Medium | **Impact:** Medium — primarily needed for multi-instance deployments

---

## Infrastructure & Performance

### Redis / Memcached Object Cache

**Context:** WP Super Gallery relies on WP's default database-backed object cache. High-traffic gallery embeds with many concurrent anonymous visitors hit the DB on every `get_option()` call. This is adequate for most deployments but becomes a bottleneck above approximately 500 concurrent users.

**What it would take:**
- Document how to configure WP's object cache drop-in with Redis or Memcached.
- Add a `WPSG_DB::warm_cache()` utility that pre-loads frequently-read options on `init`.
- Admin health screen: a "Cache" section showing hit/miss rates via `WP_Object_Cache::stats()`.
- Eviction guidance: gallery settings suit a long TTL (hours); access grant lists need a short TTL (seconds–minutes) so revocations take effect promptly.

**Open questions:**
- Q1: Should `WPSG_REST::check_access()` ever bypass the object cache for real-time access control checks? (Yes — access grants must not be stale by more than the cache TTL, which must be configurable.)
- Q2: Is there a network security constraint preventing some WP hosts from running Redis? (Yes — document APCu as an alternative for single-server setups.)

**Effort:** Medium | **Impact:** Medium — significant only for high-traffic deployments

---

### WAF Rules

**Context:** The REST API is protected by nonces and capability checks. Application-layer WAF rules can block common attack patterns before they reach PHP, saving CPU and adding defence-in-depth.

**Proposed rules:**
- Block IPs that trigger 10+ 4xx responses to `/wp-json/wpsg/` endpoints in 60 seconds.
- SSRF pattern blocking on the oEmbed proxy endpoint — block RFC-1918 IP ranges at the WAF level as a secondary layer on top of the PHP-side SSRF checks.
- Block common scanner user-agents from the API namespace.

**Open questions:**
- Q1: Should WPSG ship example configs for Nginx, Apache mod_security, and Cloudflare WAF? Maintaining three different rule sets is non-trivial.
- Q2: Are edge rate-limits at the WAF level a duplication of `WPSG_RateLimiter`? Technically yes, but WAF rules prevent PHP from running at all on abusive requests — a meaningful CPU saving.

**Effort:** Low (documentation + example configs) | **Impact:** Medium for exposed/public deployments

---

### Structured Logging & Metrics Integration

**Context:** WP Super Gallery has no first-party logging beyond `trigger_error`. Operators running it in production have no structured way to observe errors, slow queries, or anomalous access patterns.

**What it would take:**
- `WPSG_Logger` class wrapping `error_log` with structured JSON: `{ "level": "error", "context": "embed", "message": "...", "data": {} }`.
- Verbose logging gated behind `WP_DEBUG` and a `wpsg_debug_logging` filter (opt-in for production).
- Optional: `WPSGMetrics::increment($key)` that publishes to a StatsD/Prometheus pushgateway if `WPSG_METRICS_HOST` constant is defined.
- Admin "Logs" screen: last 100 log lines from a rotating option or a lightweight file in `wp-content/wpsg-logs/`.

**Open questions:**
- Q1: Where should logs be written? `error_log()` goes to the PHP error log (not always operator-accessible). Writing to a WP option pollutes the options table. A dedicated log file in `wp-content/wpsg-logs/` requires directory write permission — how is this bootstrapped?
- Q2: Should the metrics integration be separated from the logging integration? A small `mu-plugin` defining `WPSGMetrics` is a cleaner boundary.

**Effort:** Medium | **Impact:** Low for typical deployments, High for ops-heavy teams

---

## Developer Experience

### Contributor Tooling & Documentation

**Context:** The codebase has grown significantly but lacks tooling expected by external contributors. These sub-tasks are independent and can be done in any order.

**Storybook for component development:**
- Install `@storybook/react-vite`. Write stories for `AssetUploader`, `GraphicLayerPropertiesPanel`, `LayoutCanvas` (with mock slots), and all six gallery adapters.
- Gallery adapter stories double as visual regression test snapshots.
- Open question: Storybook adds ~200 MB to `node_modules` as a dev dependency — acceptable? (Yes, dev-only.)

**OpenAPI / Swagger documentation:**
- Generate an OpenAPI 3.1 spec from WordPress REST Controller schemas via a custom exporter script.
- Host the rendered docs at a new admin page or link from the readme.
- Open question: should the spec cover the public embed beacon endpoints (analytics, access request) as well as the admin-only endpoints?

**Pre-commit tooling:**
- Install `husky` + `lint-staged` to run ESLint + `tsc --noEmit` on staged files before every commit.
- Open question: should the pre-commit hook block on test failures or only on type/lint errors? Blocking on all unit tests adds 30–60 seconds per commit — a pre-push test hook is preferable.

**Conventional commits & CHANGELOG automation:**
- Enforce `feat:` / `fix:` / `chore:` / `test:` prefixes via `commitlint`.
- `standard-version` or `release-it` can auto-generate `CHANGELOG.md` entries from commit messages.
- Open question: does the existing CHANGELOG.md need to be migrated to the generated format, or maintained in parallel?

**TypeScript strictness improvements:**
- Enable `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` progressively.
- Current `tsconfig.json` has `"strict": true` — check for exceptions/overrides that have been silently added.
- Open question: run `tsc --noEmit` with `exactOptionalPropertyTypes` before committing to the task scope — count the errors first.

**Effort:** Medium per sub-task | **Impact:** Medium — primarily affects project health and contributor on-ramp

---

### WP-CLI Commands

**Context:** Admin/debug operations on campaign and media data currently require the WP admin UI or direct DB access. WP-CLI commands allow scripted automation, expected by site operators who manage WordPress programmatically.

**Proposed command surface:**

```
wp wpsg campaign list           # tabular list: id, title, status
wp wpsg campaign archive <id>
wp wpsg campaign duplicate <id> # same options as P18-C UI
wp wpsg campaign export <id>    # JSON to stdout (pipe-friendly)
wp wpsg campaign import <file>  # import from JSON file

wp wpsg media list <campaign>   # media associated with a campaign
wp wpsg media orphans           # media items with zero campaign associations

wp wpsg cache clear             # clear all wpsg_* transients
wp wpsg cache stats             # hit/miss summary (requires object cache)

wp wpsg analytics clear <id>    # delete events for a campaign
wp wpsg rate-limit reset <ip>   # reset rate-limit counters for an IP
```

**Open questions:**
- Q1: Should WP-CLI commands be bundled with the plugin or shipped as a separate companion plugin? Bundled is simpler; a companion plugin keeps the main plugin lean.
- Q2: Should commands respect `manage_wpsg` capability, or run unrestricted as the CLI process owner?

**Effort:** Low per command | **Impact:** Low for GUI users, High for server operators

---

## Access Control

### Role-Based Access Levels

**Context:** Current per-campaign access control is binary: a user either has access or does not. RBAC would allow differentiated permissions (view-only vs. edit) within a campaign context — relevant for team-managed galleries.

**Proposed levels:**

| Level | Can view | Can edit campaign | Can manage access |
|-------|----------|-------------------|-------------------|
| `viewer` | ✅ | ❌ | ❌ |
| `editor` | ✅ | ✅ | ❌ |
| `owner` | ✅ | ✅ | ✅ |

**Open questions:**
- Q1: Should RBAC use WordPress roles (`wp_capabilities`) or a custom per-campaign access level stored in the join table? Per-campaign is more granular but more complex to maintain.
- Q2: Should `editor` access allow editing the layout template, or just campaign metadata and media? The builder is a significant surface — restricting it to `owner` may be appropriate.
- Q3: Does `manage_wpsg` (the site-wide capability) always override per-campaign roles? (Yes — must be documented explicitly.)

**Effort:** High | **Impact:** High for multi-user team deployments

---

### Time-Limited Access Grants

**Context:** Access grants are currently permanent. A common gallery scenario is a time-limited event — a product launch, a wedding gallery shared with guests for 30 days. Expiry timestamps on grants enable this without manual revocation.

**What it would take:**
- Add an `expires_at` (nullable `DATETIME`) column to the access grants join table.
- In `WPSG_REST::check_access()`, compare `expires_at` against `current_time()`.
- Admin Access tab: optional date picker when adding or editing a grant.
- Daily WP-Cron job to clean up expired grants.

**Open questions:**
- Q1: Should expired grants show as "expired" in the Access tab (for audit purposes) or be deleted immediately?
- Q2: Should the grant holder receive an email warning before their access expires (e.g. 3 days before expiry)?

**Effort:** Low (schema + check logic) | **Impact:** High for event galleries

---

### Access Audit Log Export

**Context:** For GDPR compliance and enterprise deployments, administrators need a record of who accessed what and when.

**What it would take:**
- Log access events to `wpsg_analytics_events` (P18-F table) with `event_type: 'access'` and a `user_id` or hashed identifier.
- Export endpoint: `GET /wpsg/v1/audit-log?campaign_id=&from=&to=` returns CSV or JSON.
- Same configurable retention policy as analytics events.

**Open questions:**
- Q1: If WP user IDs or email hashes are stored in the log, does this constitute a GDPR personal data record? (Yes, under most interpretations — storage must be disclosed in the plugin's privacy policy declaration.)
- Q2: Should audit log export be accessible to campaign-level `owner` users, or only to WP `manage_wpsg` admins?

**Effort:** Medium | **Impact:** Medium — primarily relevant for regulated/enterprise deployments

---

### Access Totals Summary UI

**Context:** Admins have no at-a-glance view of total access grant counts across all campaigns without navigating to each one individually.

**What it would take:**
- A "grants" column in the campaigns list: "14 / 50 (capacity)".
- Aggregate REST endpoint: `GET /wpsg/v1/campaigns/access-summary` returns `[{ id, title, grant_count, capacity }]`.
- Optionally: a global "Access" admin screen listing all grants across all campaigns in one table, filterable by user/campaign/status.

**Open questions:**
- Q1: Should this be a WP dashboard widget (visible on `/wp-admin/`) or a column/section in the WPSG admin panel?
- Q2: What defines "capacity"? Is it a per-campaign limit set by the admin, or a global site-wide seat count?

**Effort:** Low | **Impact:** Low–Medium

---

## Media Management

### Media Sorting Controls

**Context:** Media grids are currently sorted by upload date (newest first). For galleries with hundreds of items, alphabetical, file-size, or usage-count sorting is often more useful.

**Proposed sort options:**
- Upload date (newest / oldest)
- Alphabetical (A–Z / Z–A) by filename
- File size (largest / smallest)
- Usage count (most-used / least-used — builds on P18-G)

**Implementation note:** For small-to-medium lists (< 200 items), client-side sort is fine. Above that threshold, pass sort parameters to the REST endpoint and use SQL `ORDER BY`.

**Open questions:**
- Q1: Should the sort preference be persisted in `localStorage` or reset per session?
- Q2: At what item count should the switch from client-side to server-side sorting occur?

**Effort:** Low | **Impact:** Medium

---

### Duplicate Media Detection

**Context:** The same image can be uploaded multiple times, wasting storage and causing confusion in the media grid. Detecting duplicates on upload — and warning the user — prevents this.

**Detection strategy:**
- Compute a perceptual hash (pHash) of the uploaded image serverside using GD library.
- Compare against a pHash index stored in post meta for all existing attachments.
- Near-duplicate (Hamming distance < threshold): warn with a side-by-side preview; offer to use the existing file.
- Exact duplicate (identical MD5): always warn and default to "use existing".

**Open questions:**
- Q1: Is pHash computation feasible in PHP without a native extension? The `jenssegers/imagehash` Composer package is an option — evaluate its GD compatibility and performance on large images.
- Q2: Should the duplicate check run synchronously (blocks the upload response) or asynchronously (upload succeeds immediately; warning appears subsequently)?
- Q3: What Hamming distance threshold constitutes a "near-duplicate"? Typical values: ≤ 10 for visually identical images. This should be tunable in settings.

**Effort:** Medium | **Impact:** Medium

---

## Campaign Features

### Campaign Templates (Preset Library)

**Context:** P15-J added 12 layout presets. This task extends the concept to campaign-level templates: pre-configured campaigns (metadata + display settings + empty layout) that a user can instantiate as a starting point.

**Distinction from P18-C duplication:** Duplication copies a real campaign with real data. Campaign templates are intentionally blank prototypes designed to be filled in.

**Open questions:**
- Q1: Should campaign templates be stored as WP posts (same CPT as campaigns, with a `template` flag in post meta) or as a separate data structure?
- Q2: Should there be a first-party template library curated by the plugin authors? A first-party library needs a distribution mechanism (versioned JSON embedded in the plugin or fetched from a remote CDN endpoint).
- Q3: Can users publish their templates to a shared community library? Out of scope for initial implementation, but the data format requirement is relevant: templates must be self-contained and importable via P18-D's import flow.

**Effort:** Medium | **Impact:** Medium

---

### Hierarchical Campaign Categories (P18-H Follow-Up)

**Context:** P18-H implements flat campaign categories. Many gallery managers organise their work in trees (e.g. `Events > Weddings > 2026`). Hierarchical taxonomy support requires `'hierarchical' => true` on the taxonomy and a nested tree selector in the UI.

**Open questions:**
- Q1: How deep should nesting go? (Proposed: max 3 levels — arbitrary depth makes the selector unwieldy.)
- Q2: Should a campaign be assignable to both a parent category and a child category simultaneously? (Standard WP taxonomy behaviour allows it — make the UI clear about the distinction.)

**Effort:** Low (taxonomy config change + UI update) | **Impact:** Low–Medium

---

## Build & Bundle

### Async Chunk Candidates — Admin Code-Split

**Context:** `vendor-dockview` was split into its own chunk in P17-E, reducing the admin chunk from 710 kB to 410 kB raw. The next step is lazy-loading admin sub-sections that are rarely visited on first open.

**Known high-value candidates:**

| Component | Trigger | Approx raw size |
|-----------|---------|----------------|
| `LayoutBuilderModal` + dockview | User opens Layout Builder | ~350 kB (est.) |
| `SettingsPanel` | User clicks Settings | ~60 kB (est.) |
| `MediaTab` | User navigates to Media tab | ~80 kB (est.) |
| `AccessTab` | User navigates to Access tab | ~40 kB (est.) |
| `AnalyticsDashboard` + recharts (P18-F) | User opens Analytics tab | ~80 kB (est.) |

**Implementation approach:** Wrap each lazy target in `React.lazy(() => import('./...'))` gated by `<Suspense fallback={<Loader />}>`. Each becomes its own Rollup chunk. Remove from `manualChunks.admin` once lazy.

**Action:** Before implementing, profile the actual initial-parse budget and measure whether TTI improves. Start with `LayoutBuilderModal` (largest + rarest trigger). The `AnalyticsDashboard` (recharts) is the highest-priority new candidate from P18.

**Open questions:**
- Q1: Should lazy chunks be preloaded on hover over the relevant nav item (to make the first render instantaneous) or strictly on click?
- Q2: Does the `<Suspense>` fallback need to match the section dimensions to prevent layout shift?

**Effort:** Medium | **Impact:** Medium (current gzip is ~187 kB — real-world impact modest unless embedded on high-traffic public pages)

---

### Progressive Web App (PWA) Support

**Context:** The embedded gallery is a natural candidate for offline/cached delivery via a Service Worker — once loaded, a gallery should be viewable without a network connection.

**Scope:**
- Register a Service Worker for the embed script only (not the admin SPA).
- Cache-first strategy for the embed JS bundle and media thumbnails.
- Stale-while-revalidate (5-minute TTL) for gallery metadata (campaign settings, media list).
- Explicitly exclude the admin SPA from Service Worker caching (always network-first).

**Open questions:**
- Q1: Does offline mode need to support the full lightbox / video playback experience, or just the gallery thumbnail grid?
- Q2: If the WP site already registers a Service Worker (e.g. via a caching plugin), how is scope isolation between the embed SW and the site SW verified?
- Q3: Cache size budget: media thumbnails can be large — should there be a configurable limit (e.g. last 50 gallery images)?

**Effort:** Medium | **Impact:** Low for most deployments, High for mobile-first or offline-capable use cases

---

## UX Workflow

### Settings Panel as a Non-Disruptive Modal

**Context:** Navigating to Settings currently causes a full admin-panel tab transition. Returning to a campaign requires re-selecting it.

**What it would take:**
- Convert the Settings panel from a full admin tab to a `<Drawer>` or large `<Modal>` that overlays the current admin view.
- The underlying campaign list or detail page remains mounted and visible through the overlay.
- Settings save/cancel closes the drawer without a full re-render.

**Open questions:**
- Q1: The Settings panel is large (~20 accordion sections). Does it fit in a `<Drawer>` UX model, or does it need a `Modal size="xl"`?
- Q2: Should settings changes take effect immediately (live preview behind the overlay) or only on explicit save? Immediate effect is powerful but risks inadvertent changes to live gallery visitors before the admin clicks Save.

**Effort:** Medium | **Impact:** Low–Medium

---

### Reuse Loaded Admin Tab Data Across Tab Switches

**Context:** Switching between admin tabs (Campaigns, Media, Access, Analytics) re-fetches data when the tab is re-activated, even when filters/targets have not changed. For large media libraries this is a noticeable delay.

**What it would take:**
- Confirm whether React Query's existing `staleTime` config is set to a non-zero value. If not, set it to 30 seconds for all admin queries.
- Validate that `queryClient.invalidateQueries()` is consistently called after mutations so stale data cannot persist after a write.
- Preserve MediaTab scroll position and filter state across tab switches.

**Open questions:**
- Q1: Is this already partially solved by React Query's caching? Audit current `staleTime` / `gcTime` settings before committing to active development.
- Q2: Should preserved tab state (scroll position, active filters) be in React state (lost on component unmount) or URL params (persistent on refresh)?

**Effort:** Low–Medium | **Impact:** Medium

---

## Integration

### Third-Party OAuth Providers

**Context:** Authentication supports WP native + JWT. Google and GitHub OAuth would reduce friction for organizations whose members already have Google Workspace or GitHub accounts.

**Open questions:**
- Q1: Should OAuth be implemented directly in the plugin or via a WP OAuth hook (e.g. integrating with an existing OAuth plugin)? Direct implementation adds maintenance burden.
- Q2: The OAuth redirect lands on the WP host, not the embedding page — is a popup-window OAuth flow the right model when the gallery is embedded as a Web Component on a non-WP page?
- Q3: Which providers are highest priority? (Survey/feedback required before committing scope.)

**Effort:** High | **Impact:** Medium — valuable for SSO deployments, complex to implement correctly

---

### Webhook Support for Campaign Events

**Context:** Campaign state changes (created, archived, media added, access granted) could trigger webhooks to external services (Zapier, Slack, CRM systems), enabling automation.

**Proposed events:**
- `campaign.created`, `campaign.archived`, `campaign.restored`, `campaign.deleted`
- `media.added`, `media.removed`
- `access.granted`, `access.revoked`
- `analytics.milestone` (e.g. N views — configurable threshold)

**Open questions:**
- Q1: Should webhooks be configured per-event-type or per-URL (one URL receives all events)? Per-URL is simpler to implement; per-event is more useful.
- Q2: Delivery guarantees: should failed webhook deliveries be retried? If so, what is the retry schedule and max-attempt count?
- Q3: Security: webhook payloads should be signed (HMAC-SHA256 header) so the receiver can verify origin. How is the signing secret generated and rotated?

**Effort:** Medium | **Impact:** Medium — primarily for automation-heavy workflows

---

### GraphQL API Alternative

**Context:** The REST API is adequate for the admin SPA but is verbose for external integrations that need only specific fields. A GraphQL endpoint allows consumers to request exactly the data they need.

**Open questions:**
- Q1: Is there sufficient external-integrator demand for a GraphQL API? This is a significant investment with unclear ROI unless there is a concrete use case.
- Q2: Build on `WPGraphQL` (broad adoption, reduces code) or a custom GraphQL endpoint (more control, adds a third-party dependency)?
- Q3: Would a GraphQL API make the REST API redundant, or would both coexist? Coexistence adds documentation and maintenance burden.

**Effort:** High | **Impact:** Low for current users, potentially High for ecosystem adoption

---

## Evaluation Criteria

When promoting future tasks to an active phase:

1. **User impact** — How many users does this affect, and how much does it improve their workflow?
2. **Implementation effort** — What is the realistic development time, including tests and documentation?
3. **Maintenance burden** — Does this add surface area that will need ongoing upkeep?
4. **Alignment with core mission** — Does this serve the gallery-management use case, or is it scope creep?
5. **Open questions resolved** — A task should not be promoted until its key design questions have answers.
6. **Dependencies satisfied** — Note which other features must ship first.

---

*Document created: February 1, 2026*  
*Last updated: February 27, 2026 — Phase 18 items promoted and removed (bulk actions, campaign duplication, export/import JSON, keyboard shortcuts, analytics dashboard, media usage tracking, campaign categories, access request workflow, App.tsx+AdminPanel.tsx reduction, JS+PHP coverage). All remaining one-liners expanded with implementation notes and open questions. New sections added: full-page builder route, builder keyboard shortcuts, shortcut configuration, deep clone, analytics follow-ons, access request scale/magic-link, binary export, role-based access, time-limited grants, audit log export, access totals, media sorting, duplicate detection, campaign templates, hierarchical categories, PWA, settings modal, tab data reuse.*
