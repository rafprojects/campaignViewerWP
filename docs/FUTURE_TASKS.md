# Future Tasks & Enhancements

This document tracks deferred and exploratory work remaining. Items promoted to active phase execution are moved into dedicated phase reports and removed from this backlog.

---

## Current Triage Snapshot

### Promoted or completed elsewhere

| Item | Disposition |
|------|-------------|
| Modal-safe gallery-config selectors, shared manage-media entry, settings stacking fix, backlog cleanup | Active in [PHASE25_REPORT.md](PHASE25_REPORT.md) |
| Bulk actions, campaign duplication, keyboard shortcuts, analytics dashboard, media usage tracking, campaign categories, access request workflow | Keep in [PHASE18_REPORT.md](PHASE18_REPORT.md); do not duplicate here |
| Theme live preview, gallery config accessibility, per-breakpoint adapter parity, deferred review cleanup | Keep in [PHASE24_REPORT.md](PHASE24_REPORT.md); do not duplicate here |
| Settings panel as a modal overlay | Already implemented; only the stacking bug moved to Phase 25 |
| Access-request option storage migration | Already implemented via `wpsg_access_requests` table plus migration support |

### Phase 25 follow-on candidates after the current core fixes

| Candidate | Why it was surfaced now | Impact | Effort |
|-----------|-------------------------|--------|--------|
| Final legacy gallery bridge removal | Phase 24 intentionally deferred full flat-field read-path removal to the next phase; legacy adapter fields still exist in types, resolver helpers, and tests | Medium-High | Medium |
| Builder template deep clone | Solves a real duplication surprise with relatively contained scope | Medium | Low |
| Time-limited access grants | Strong user value for event-style galleries; clear implementation path | High | Low-Medium |
| Admin tab data reuse / SWR cache hardening | Noticeable admin UX gain with moderate scope if the cache audit stays disciplined | Medium | Low-Medium |

### Prune candidates

| Item | Why it is a prune candidate |
|------|-----------------------------|
| URL-based image input re-enable | Security-heavy convenience feature; upload-only already covers the core workflow |
| Third-party OAuth providers | High maintenance and product ambiguity without a clear deployment demand signal |
| GraphQL API alternative | High maintenance cost with unclear near-term ROI |
| Progressive Web App support | Worth revisiting only if there is a concrete offline/mobile deployment requirement |

### Specialized / long-horizon notes

The detailed sections below remain as the long-form backlog for builder, access, media, integration, review debt, and deferred adapter ideas. The tables above are the active triage layer and should be updated first when items move in or out of scope.

---

## Builder

### URL-Based Image Inputs (Mask, Overlay, Background)

**Context:** All URL-based image inputs (paste URL for mask, overlay library, background image) were disabled in Phase 20 and replaced with upload-only workflows. This simplifies the security surface (no external URL fetching, no CORS issues, no SSRF risk) and keeps all assets in the WP media library.

**What was removed:**
- `SlotPropertiesPanel`: "Paste mask URL…" TextInput for adding masks, editable URL field for existing masks.
- `LayoutBuilderMediaPanel`/`AssetUploader`: URL TextInput for graphic layer library and background image sections.
- `LayoutBuilderModal`: `handleAddUrlToLibrary()` callback that POSTed external URLs to the overlay-library endpoint.
- `BuilderDockContext`: `handleAddUrlToLibrary` from the shared context interface.

**To re-enable (if needed):**
- `AssetUploader.onUrlSubmit` is already optional — simply pass the callback to re-show the URL TextInput.
- For masks, restore the TextInput in `SlotPropertiesPanel` mask section and the URL editing field.
- Add server-side URL validation and proxying: fetch the remote image via PHP, validate its content type and size, store it in the WP uploads directory, and return the local URL. This avoids CORS and SSRF issues.
- Consider a URL allowlist or domain whitelist for additional security.

**Effort:** Medium | **Impact:** Low — upload-only covers the primary use case; URL import is a convenience feature for advanced users.

---

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

### Access Request Workflow — Legacy Scale Note (Prune Candidate)

**Current state:** The original premise of this task is stale. Access requests already have a dedicated `wpsg_access_requests` table plus migration support from the old options-based format.

**Decision:** Remove this as an active backlog item unless production evidence shows a new bottleneck in the current table-backed implementation.

**If reopened, focus should shift to:**
- additional indexes based on real query plans
- retention / archival strategy for resolved requests
- reporting and audit UX rather than the already-completed storage migration

**Impact:** Low | **Status:** Prune candidate

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

**TypeScript strictness improvements:**
- Enable `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess` progressively.
- Current `tsconfig.json` has `"strict": true` — check for exceptions/overrides that have been silently added.
- Open question: run `tsc --noEmit` with `exactOptionalPropertyTypes` before committing to the task scope — count the errors first.

**Effort:** Medium per sub-task | **Impact:** Medium — primarily affects project health and contributor on-ramp

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

**Effort:** Low–Medium | **Impact:** High for event galleries

---

### JWT In-Memory Token Auth (Standalone SPA)

**Context:** Phase 20 (P20-K) defaulted the plugin to nonce-only authentication and commented out the JWT localStorage flow to eliminate the XSS → token-theft vector. However, if WPSG is ever deployed as a **standalone SPA on a different origin** (i.e. not embedded via shortcode), WP nonces are unavailable because they require a same-origin page load. In that scenario, JWT auth is required.

The current JWT code stores tokens in `localStorage`, which is accessible to any script on the page. The secure alternative is:

1. **In-memory access token** — stored in a module-scoped variable (not `localStorage`). Survives only for the tab’s lifetime.
2. **httpOnly refresh cookie** — issued by a new `/wpsg/v1/token/refresh` endpoint with `SameSite=Strict; Secure; HttpOnly`. The browser sends it automatically; JS cannot read it.
3. **Silent refresh** — on app boot and before access-token expiry, `POST /wpsg/v1/token/refresh` returns a fresh short-lived access token.

**What it would take:**
- New PHP endpoint: `POST /wpsg/v1/token/refresh` — validates the httpOnly cookie, issues a new JWT with a 15-minute TTL.
- Modify `WpJwtProvider.tsx` (currently commented out): replace `localStorage.setItem/getItem` with a module-scoped `let accessToken: string | null`.
- Add a `useTokenRefresh` hook that calls the refresh endpoint 1 minute before expiry and on window `focus` events.
- `apiClient.ts`: attach `Authorization: Bearer <in-memory-token>` only when the env-var opt-in `WPSG_ENABLE_JWT=1` is set.
- Server-side: set the refresh cookie on `POST /wpsg/v1/token` (login) and clear it on `DELETE /wpsg/v1/token` (logout).
- CORS configuration for the cross-origin case (`Access-Control-Allow-Credentials: true`, explicit origin).

**Open questions:**
- Q1: Should refresh-token rotation be implemented (invalidate old refresh cookie on each use)? This limits replay but adds a revocation table.
- Q2: What is the refresh-cookie TTL? 7 days (convenience) vs. 24 hours (security) — should it be admin-configurable?
- Q3: Is a `/wpsg/v1/token/revoke-all` endpoint needed for the “log out everywhere” use case?

**Prerequisites:** P20-K must be complete (nonce-only default + JWT code commented out with env-var gate).

**Effort:** High (2–4 days) | **Impact:** High for cross-origin standalone SPA deployments; Low for standard WordPress shortcode usage

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

### Remaining Admin Code-Split Opportunities

**Current state:** The first-generation lazy targets originally listed here are already lazy-loaded: `LayoutBuilderModal`, `SettingsPanel`, `MediaTab`, and `AnalyticsDashboard`. The next step is no longer "add lazy loading" but "decide whether secondary splits inside the remaining heavy surfaces are worth the complexity."

**Remaining candidates worth measuring before implementation:**

| Component / surface | Trigger | Note |
|---------------------|---------|------|
| `SettingsPanel` tab internals (especially typography tooling) | User opens specific settings tabs | Only worth doing if the panel keeps growing; current root-level lazy load already removes it from first paint |
| `MediaTab` add/edit/reorder subflows | User opens the media workspace | Data fetch latency is already reduced via SWR; profile bundle cost before splitting UI helpers |
| Layout Builder secondary tooling | User opens builder plus deeper tools | Measure after the builder route-vs-modal decision settles |

**Action:** Profile before adding more chunk boundaries. The obvious wins from the original note are already implemented.

**Effort:** Medium | **Impact:** Medium when profiling proves a real parse or interaction cost

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

### Settings Panel as a Non-Disruptive Modal (Completed)

**Current state:** This is already the shipped behavior. Settings render as a modal overlay instead of a full admin-tab transition.

**Remaining work:** Only modal stacking correctness remained when opening Settings above an active campaign viewer. That follow-up is now tracked in [PHASE25_REPORT.md](PHASE25_REPORT.md), so this item should be removed from the active backlog.

**Status:** Completed / remove from backlog

---

### Reuse Loaded Admin Tab Data Across Tab Switches

**Context:** The admin surface now relies on SWR-backed data sources rather than React Query. There is already deduping and targeted `mutate()` usage in several places, but perceived reload cost can still show up when switching between heavy tabs or reopening campaign-specific panes.

**What it would take:**
- Audit SWR keys and `dedupingInterval` / `revalidateOnFocus` / `revalidateOnReconnect` settings across `useAdminSWR`, `AdminPanel`, `LayoutTemplateList`, and related tab loaders.
- Validate that manual `mutate()` calls are consistently wired after mutations so stale data does not persist after writes.
- Preserve MediaTab scroll position and filter state across tab switches.

**Open questions:**
- Q1: Is this already sufficiently mitigated by current SWR deduping and local optimistic state in the heaviest tabs? Measure before expanding scope.
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
*Last updated: March 31, 2026 — Re-triaged backlog, linked active work to [PHASE25_REPORT.md](PHASE25_REPORT.md), removed stale/completed items, and refreshed the review-debt list to match the current architecture.*

---

## Deferred Review Tasks

Items below were triaged from the PHP and React implementation review deferred task lists.
Easy/ASAP items were handled separately — see ASAP_TASKS.md and the implementation notes in the source review docs.

### Removed from active review backlog

- `D-16` moved to [PHASE24_REPORT.md](PHASE24_REPORT.md) deferred review cleanup and should not stay duplicated here.
- `RD-1` overlaps with the standalone SPA JWT item above; keep one canonical JWT hardening entry, not two.
- `RD-6` is no longer active backlog; there are no remaining `window.confirm` usages in `src/`.
- `RD-7`, `RD-11`, and `RD-20` targeted `EditCampaignModal`, which has been replaced by `UnifiedCampaignModal`.

### PHP — From archived PHP_IMPLEMENTATION_REVIEW.txt

**D-1: CORS Origin Allow-List & Admin UI**
Files: `wp-super-gallery.php`, `class-wpsg-settings.php`  
Add CORS allowed-origins setting and reject wildcard with credentials. Only affects cross-origin REST API usage. Filter workaround exists.  
LOE: Medium (4-6 hours) | Impact: Low

**D-2: Migrate Overlay Library from wp_options to Custom Table**
Files: `class-wpsg-overlay-library.php`, `class-wpsg-db.php`, `uninstall.php`  
Move overlay entries out of single serialized wp_options row. Problem at scale (hundreds of overlays). Corrupted update_option could lose entire library.  
LOE: Large (8-12 hours) | Impact: Low-Medium

**D-5: Pre-Uninstall Export and Confirmation Gate**
Files: `uninstall.php`, `class-wpsg-settings.php`  
Add one-click "Export All" and timed confirmation before uninstall data purge. Default preserves data — low risk, severe consequences when disabled.  
LOE: Medium (4-6 hours) | Impact: Low

**D-7: Decompose Monolithic REST Class into Domain Controllers**
Files: `class-wpsg-rest.php` → 8+ new files  
Split 4400-line WPSG_REST class. All 461 PHPUnit tests pass today. Pure DX/maintainability refactor.  
LOE: X-Large (16-24 hours) | Impact: Low (DX only)

**D-8: Add REST Schema/Args Definitions to All Routes**
Files: `class-wpsg-rest.php` (`register_routes`)  
Define typed args with sanitize/validate callbacks on all 40+ REST route registrations. Large mechanical effort. Best done per-domain if combined with D-7.  
LOE: Large (10-16 hours) | Impact: Low

**D-10: Optimize get_accessible_campaign_ids() — O(n) Full Scan**
Files: `class-wpsg-rest.php`  
Replace per-campaign access checks with queryable grant structure. Cached with 15-min TTL. Only problematic at 1000+ campaigns.  
LOE: Large (8-12 hours) | Impact: Low (current scale), High (1000+ campaigns)

**D-12: Rate Limiter Transient Bloat Under Load**
Files: `class-wpsg-rate-limiter.php`  
Document persistent object cache requirement; optionally add APCu fallback. Standard WP practice, only problematic without Redis/Memcached under heavy load.  
LOE: Small (1-2 hours docs, 4-6 hours APCu) | Impact: Low

**D-13: Thumbnail Cache Index — Single wp_options Row Scalability**
Files: `class-wpsg-thumbnail-cache.php`  
Move thumbnail cache index to per-hash entries or custom table. Cache is self-healing (regenerated on miss).  
LOE: Medium (4-6 hours) | Impact: Low

**D-14: Campaign Export — Stream Large Media Sets**
Files: `class-wpsg-rest.php`, `class-wpsg-cli.php`  
Add chunked/streamed export for campaigns with large media arrays. Most campaigns have <100 items.  
LOE: Medium (4-6 hours) | Impact: Low

**D-17: Add Default Content-Security-Policy Header**
Files: `wp-super-gallery.php`  
Ship sensible default CSP. Could break sites if too restrictive. Needs testing with all embed providers.  
LOE: Medium (3-5 hours) | Impact: Low

### React — From archived REACT_IMPLEMENTATION_REVIEW.txt

**RD-2: SettingsPanel Tab-Level Code Splitting**
Files: `src/components/Admin/SettingsPanel.tsx` (~1822 lines)  
Split into tab-level sub-components with React.memo. Admin-only, negligible perf impact.  
LOE: High (6-8 hours) | Impact: Low

**RD-3: Extract MediaTab Sortable Components**
Files: `src/components/Admin/MediaTab.tsx`  
Move SortableListRow/SortableGridItem outside render body. Inline components reference ~15+ closure variables.  
LOE: Medium (4-6 hours) | Impact: Low-Medium

**RD-4: useLayoutBuilderState Callback Cascade**
Files: `src/hooks/useLayoutBuilderState.ts`  
Break callback cascade by storing template in a ref. Extra re-renders, not user-visible.  
LOE: Medium (3-4 hours) | Impact: Low

**RD-8: CardGallery setTimeout → transitionend**
Files: `src/gallery-adapters/card/CardGallery.tsx`  
Replace setTimeout with CSS transitionend event listener. Minor UX polish.  
LOE: Low (1 hour) | Impact: Low

**RD-9: LayoutBuilderGallery Inline Style → CSS Injection**
Files: `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx`  
Replace inline `<style>` with useInsertionEffect/adoptedStyleSheets. Works correctly inside Shadow DOM today.  
LOE: Low (1-2 hours) | Impact: Low

**RD-10: AdminPanel AccessTab Prop Drilling**
Files: `src/components/Admin/AdminPanel.tsx`, `src/components/Admin/AccessTab.tsx`  
Reduce prop drilling by passing hook object directly. Code organization improvement.  
LOE: Low (1-2 hours) | Impact: Low

**RD-15: SlotPropertiesPanel IIFE Extraction**
Files: `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`  
Extract IIFEs into named sub-components. Readability improvement.  
LOE: Low (1-2 hours) | Impact: Low

**RD-16: LoginForm Password Length from Settings**
Files: `src/components/Auth/LoginForm.tsx`  
Read loginMinPasswordLength from settings instead of hardcoding (6). Server-side still validates.  
LOE: Low (1 hour) | Impact: Low

**RD-17: JWT Token Refresh**
Files: `src/services/apiClient.ts`, `src/hooks/useAuth.ts`  
Transparent JWT token refresh before expiry. **Blocked on RD-1**. Most deployments use nonce auth.  
LOE: Medium (blocked on RD-1) | Impact: Low

**RD-18: useMediaDimensions ID-Based Caching**
Files: `src/hooks/useMediaDimensions.ts`  
Stabilize with ID-based caching to reduce recalculations. Minor optimization.  
LOE: Low (1-2 hours) | Impact: Low

**RD-21: Standardize Error Handling Patterns**
Files: Multiple hooks  
Standardize error handling across admin hooks. Inconsistent DX, no user impact.  
LOE: Medium (3-4 hours) | Impact: Low

---

## Deferred Gallery Adapters

> **Origin:** Phase 8 brainstorm (P22). These gallery adapter concepts were identified as valuable additions but deferred from the active Phase 8 scope. They follow the existing `GalleryAdapterProps` contract and register via `registerAdapter` like all current adapters.

### Mosaic / Pinterest Adapter
Irregular tile sizes (large hero + small surrounding grid) based on aspect ratios or media importance. Similar to Google Photos' auto-layout algorithm. Tiles are assigned sizes dynamically (e.g., 2×2, 1×1, 2×1) to maximize area coverage while respecting aspect ratios.  
LOE: Medium-High | Impact: Medium

### Coverflow / 3D Adapter
CSS 3D perspective carousel where side items are rotated and scaled down. Classic Apple-style cover flow effect. Uses `transform: perspective() rotateY()` and z-index layering. Navigation via click, keyboard, or drag.  
LOE: Medium | Impact: Medium

### Spotlight / Hero Adapter
Large featured item (hero) with a row/grid of smaller thumbnails below or beside it. Clicking a thumbnail promotes it to the hero position with a crossfade transition. Good for campaign highlights.  
LOE: Low-Medium | Impact: Medium

### Stacked / Deck Adapter
Cards stacked on top of each other with slight offset/rotation. Swipe or click to move the top card to the back (Tinder-like). Touch-optimized for mobile previews.  
LOE: Medium | Impact: Low-Medium

### Waterfall Adapter
Vertical masonry variant where items drop in sequence with staggered CSS animation (`@keyframes` with incremental `animation-delay`). Content-driven heights. Essentially masonry with entrance animations.  
LOE: Low (masonry variant) | Impact: Low

### Timeline Adapter
Chronological layout with items on alternating sides of a vertical center line. Date/caption labels at each node. Good for event-based or campaign-chronology galleries.  
LOE: Medium | Impact: Low-Medium

### Isotope / Filterable Grid Adapter
Grid layout with animated filtering, sorting, and category transitions. Items shuffle positions with smooth FLIP animations when filter criteria change. Requires extending the adapter interface to accept filter/sort props.  
LOE: Medium-High | Impact: Medium

### Grid with Variable Aspect-Ratio Tiles Adapter
Auto-assigns tile sizes (1×1, 2×1, 1×2, 2×2) based on media metadata (aspect ratio, resolution). Creates a densely packed, visually varied grid without manual configuration. Similar to Google Photos or Flickr's justified grid but with explicit CSS Grid tracks.  
LOE: Medium-High | Impact: Medium

### Vertical Scroll Snap Adapter
Mobile-first full-screen vertical carousel using CSS `scroll-snap-type: y mandatory`. Each media item occupies the full viewport height. Swiping vertically snaps to the next item. Ideal for story-style or Instagram-reel-like campaign presentations.  
LOE: Medium | Impact: Medium
