# Future Tasks & Enhancements

This document tracks nice-to-have features and improvements that are deferred for future consideration.

> **Note:** Several items have been promoted to [PHASE10_REPORT.md](./PHASE10_REPORT.md) for active tracking. Items marked 🔗 below have a corresponding Phase 10 task.

---

## 🔴 High Priority

### Compact Sign-In Experience

The current sign-in form is a large `<Paper>` card rendered at the top of the app, pushing public campaigns below the fold. This harms UX for unauthenticated users who want to browse public content. Replace with a compact, non-intrusive sign-in approach.

**Viable Approaches (evaluate and pick best):**

1. **Collapsible header bar** — A slim banner at the top: "Sign in for private campaigns" with an inline expand toggle that reveals email/password fields in a single row.
2. **Modal/drawer** — A small "Sign in" button/link in the header that opens a modal or side drawer with the login form, keeping the main content unobstructed.
3. **Popover** — A "Sign in" button that opens an anchored popover with a compact login form (similar to many SaaS apps).
4. **Floating action button (FAB)** — A persistent small button (e.g., lock icon) positioned in a corner that opens a modal on click.

**Requirements:**
- Must not push gallery content down the page
- Public campaigns must be immediately visible without scrolling
- Sign-in should be discoverable but non-intrusive
- Must work well in both standalone and WP-embedded contexts
- Maintain current AuthBar for signed-in users (it's already compact)

**Effort:** Low–Medium  
**Impact:** High (UX improvement for all unauthenticated users)  
**Notes:** The current `LoginForm` component can be adapted; the main change is presentation/trigger pattern, not auth logic.

### Video Player Transparent Aspect Ratio

The video player in the campaign video gallery must support different aspect ratios without filling the sides with a solid color. The fill should be transparent so only the video itself is visible. If necessary, the video controls should be shrunk to fit the video width.

**Current problem:** Non-16:9 videos (e.g., 4:3, vertical/portrait) get solid-color bars on the sides (letterboxing/pillarboxing), which looks poor when embedded on sites with non-dark backgrounds.

**Requirements:**
- Transparent background behind the video element (no solid color fill)
- Video controls should adapt to match the video's rendered width
- Must work for common aspect ratios: 16:9, 4:3, 9:16 (portrait), 1:1
- Should degrade gracefully for unknown aspect ratios

**Effort:** Low  
**Impact:** High (visual quality for all video content)  
**Notes:** May require CSS `object-fit: contain` with transparent container, or custom player wrapper.

### Campaign Card Thumbnails

Campaign cards currently show a generic "WP Super Gallery" placeholder image. Cards should display a representative thumbnail from the campaign's associated media.

**Requirements:**
- Auto-select: Use the first media item's thumbnail (or cover image if set) as the card front image
- Manual override: Allow admins to select a specific media item as the card thumbnail in campaign editing
- Manual upload: Option to upload a custom thumbnail image as the card front
- Fallback: Keep the current placeholder when no media or thumbnail is available
- Performance: Use WP thumbnail sizes (e.g., `medium` or `medium_large`) to avoid loading full-size images on the gallery grid

**Effort:** Medium  
**Impact:** High (visual appeal, campaign discoverability)  
**Notes:** The `cover_image` meta field already exists but may not be populated. Could extend edit campaign modal with a "Set thumbnail" action.

### Offline / Network Failure Detection

When the user goes offline or loses network connectivity, the app provides no feedback — admin actions silently fail and campaigns don't load, causing UI confusion.

**Requirements:**
- Detect offline/online state using `navigator.onLine` + `window` events (`online`/`offline`)
- Show a non-dismissable banner when offline: "You appear to be offline. Some features are unavailable."
- Prevent API calls while offline (fail fast with a clear message instead of waiting for timeout)
- Gracefully restore when connectivity returns (auto-dismiss banner, optionally revalidate SWR cache)
- Campaign cards should show a placeholder/skeleton state instead of collapsing when data fails to load

**Effort:** Low–Medium  
**Impact:** Medium (error UX, especially for admin users)  
**Notes:** Could use a `useOnlineStatus` hook combined with a context provider. Consider also using `CampaignViewer` as modal overlays instead of full-page repaints for better resilience.

---

## Deferred from Phase 6

### Embed & Media Providers

#### Modularize Embed Provider Handlers

Refactor embed provider logic into modular handlers for better maintainability.

- Revisit Rumble and other non-oEmbed providers for robust previews
- Add fallback thumbnail strategies for providers without oEmbed
- Create provider plugin system for extensibility

**Effort:** Medium  
**Impact:** Low (maintainability improvement)  
**Notes:** Current implementation works well, this is a code organization enhancement

---

#### External Thumbnail Cache

Cache external media thumbnails server-side to improve reliability and performance.

- Fetch and store thumbnails on the server
- Serve cached versions to reduce external dependencies
- Periodic cache refresh mechanism
- CDN integration option

**Effort:** Medium  
**Impact:** Medium (reliability improvement)  
**Notes:** Most useful for high-traffic sites with many external media items

---

### Monitoring & Infrastructure

#### Redis/Memcached Object Cache

Optional object cache backend for high‑traffic deployments.

- Configure Redis/Memcached for transients and cache groups
- Add cache monitoring/eviction guidance
- Document network security requirements

**Effort:** Medium  
**Impact:** Medium (performance at scale)  
**Notes:** Not needed until traffic grows

#### oEmbed Failure Monitoring

Track repeated oEmbed failures and expose metrics for monitoring.

- Expose `wpsg_oembed_failure_count` as a WP option
- Provide a lightweight admin dashboard widget for failure trends
- Alert on high failure rates

**Effort:** Low  
**Impact:** Low (monitoring infrastructure)  
**Notes:** Useful for debugging but not critical for core functionality

---

#### oEmbed Rate Limiting

Implement rate limiting for the public oEmbed proxy endpoint.

- Prevent abuse while maintaining preview functionality
- Consider per-IP or per-session limits
- Configurable rate limit thresholds
- Rate limit status in admin panel

**Effort:** Medium  
**Impact:** Low (abuse prevention)  
**Notes:** Only needed if proxy endpoint is publicly accessible

---

#### Admin Metric & Alerting Panel

Provide a simple admin metric panel for monitoring.

- Integrate `do_action('wpsg_oembed_failure', $url, $attempts)` hook
- Allow external monitoring system integration
- Display health status and key metrics
- Performance monitoring dashboard

**Effort:** Medium  
**Impact:** Low (observability)  
**Notes:** Advanced feature for enterprise deployments

#### Admin Health Dashboard

Provide a dedicated admin view for system health (errors, response time, cache hit rate).

- Summaries of REST error counts and latency
- Last 24h performance snapshots
- Links to logs and diagnostics

**Effort:** Medium  
**Impact:** Medium (observability)  
**Notes:** Defer until core monitoring/alerts are stable

#### Usage Analytics

Track campaign views and media loads for reporting.

- Event schema and storage strategy
- Privacy and data retention policy
- Admin reporting UI

**Effort:** Medium  
**Impact:** Medium (insights)  
**Notes:** Requires product decisions on privacy and data governance

#### WAF Rules (Optional)

Add optional WAF guidance for high‑risk deployments.

- Baseline rules for REST API endpoints
- Block SSRF patterns on oEmbed proxy
- Rate‑limit aggressive IPs at edge

**Effort:** Low  
**Impact:** Medium (security)  
**Notes:** Defer until traffic/attack surface grows

---

#### Logging & Metrics Integration

Ensure oEmbed failures log via `error_log()`.

- Provide opt-in integration point for external metrics
- Support StatsD/Prometheus if configured
- Structured logging format
- Log rotation and management

**Effort:** Medium  
**Impact:** Low (external metrics)  
**Notes:** Requires additional infrastructure setup

---

### Developer Tools

#### Contributor Tooling & Documentation

Improve tooling and documentation for contributors.

- Add Storybook for component development
- Create API documentation with OpenAPI/Swagger
- Add pre-commit hooks with Husky
- Improve TypeScript strict mode compliance
- Add conventional commits with Commitizen
- Create contribution guidelines
- Add architectural decision records (ADRs)
- Improve local development setup docs

**Effort:** Medium
**Impact:** Medium (maintainability, onboarding)
**Notes:** Move from Phase 8 scope to future iteration

#### WP-CLI Commands

Add a `wpsg` WP-CLI command for admin operations.

- View/reset `wpsg_oembed_failure_count`
- Inspect cached oEmbed keys
- Bulk campaign operations
- Media library management
- User access reports

**Effort:** Low  
**Impact:** Low (developer convenience)  
**Notes:** Useful for automation and debugging

**Example Commands:**
```bash
wp wpsg campaigns list
wp wpsg media rescan --campaign=123
wp wpsg access grant --user=5 --campaign=101
wp wpsg cache clear --type=oembed
```

---

## Deferred from Phase 10

### A1. Reduce App.tsx to ≤ 300 Lines (Stretch)

**Current state:** ~703 lines with ~97 hooks/functions. Core decomposition completed (useCarousel, useLightbox, useDirtyGuard, ErrorBoundary extracted), but reaching ≤ 300 requires a full state-management rewrite (e.g., useReducer/Zustand) to extract the remaining orchestration logic.

**Effort:** High  
**Impact:** Medium (maintainability)

### A2. Reduce AdminPanel.tsx to ≤ 200 Lines (Stretch)

**Current state:** ~912 lines with ~102 hooks/functions. Tabs already split into dedicated components (CampaignsTab, MediaTab, etc.), but the file still centralizes modal orchestration, data fetching, and inter-tab communication. Reaching ≤ 200 requires extracting ~15 manual API calls into SWR + creating a shared admin state context.

**Effort:** High  
**Impact:** Medium (maintainability)

### E1. SWR for AdminPanel Data Fetching

AdminPanel manually manages `data`, `loading`, `error` state for ~15 API calls (~30 lines of boilerplate per resource). Migrating to SWR would provide automatic revalidation, caching, and error retry. SWR is already a project dependency used in App.tsx.

**Effort:** Medium  
**Impact:** Medium (DX, reliability)

### E2. Fix N+1 Media Fetch in CardGallery

`CardGallery` fetches all campaigns, then triggers per-campaign media fetches via `useSWR` inside each `CampaignCard`. For 20 campaigns = 21 HTTP requests on initial load. Requires a bulk media endpoint (`GET /campaigns/media?ids=1,2,3`) or including media summary in the campaigns list response.

**Effort:** Medium (requires backend changes)  
**Impact:** High (performance for large deployments)

### Track F Feature Ideas

| Feature | Effort | Impact | Notes |
|---------|--------|--------|-------|
| Drag-and-drop media reordering (`@dnd-kit`) | Medium | High | Replace ↑/↓ buttons; natural UX |
| Bulk media operations (multi-select delete/move) | Medium | High | Common admin workflow |
| Campaign duplication ("Clone Campaign") | Low | Medium | Copy campaign + media metadata |
| Campaign text search in gallery | Low | Medium | Client-side title/description filter |
| Keyboard shortcuts for admin (`Ctrl+N`, `Ctrl+S`) | Low | Medium | `useHotkeys` from Mantine |
| Export/import campaigns as JSON | Medium | Medium | Migration between WP instances |
| Campaign analytics dashboard (view counts) | High | Medium | Requires event tracking backend |

---

## Feature Ideas (Not Committed)

### Media Management

- 🔗 Drag-and-drop media reordering — *Promoted: Phase 10 Track F*
- 🔗 Bulk media operations (multi-select delete/move) — *Promoted: Phase 10 Track F*
- 🔗 Media library search and filtering — *Promoted: Phase 10 Track C3*
- Media sorting controls (alpha, type, date)
- Media tab redesign brainstorming (drag-and-drop sorting, layout refresh)
- Media tagging system
- Duplicate media detection
- Media usage tracking across campaigns

### Campaign Features

- Campaign templates
- 🔗 Campaign cloning / duplication — *Promoted: Phase 10 Track F*
- Campaign scheduling (publish/unpublish dates)
- Campaign categories/folders
- 🔗 Campaign analytics (view counts, engagement) — *Promoted: Phase 10 Track F*

### Access Control

- Role-based access levels (view, edit, admin)
- Time-limited access grants
- Access request workflow
- Access totals (Access/No Access) summary UI
- Access audit log export

### Performance

- Image optimization on upload
- Lazy loading for large galleries
- Virtual scrolling for long media lists
- Progressive Web App (PWA) support
- Admin panel loading performance strategy (profile REST calls, cache hot paths, parallelize non-blocking requests, and add perceived-performance feedback)

### UX Workflow

- Convert settings panel from full-page view shift to an on-the-fly loading modal workflow (non-disruptive context-preserving settings)
- Improve Admin panel tab transitions so loaded data is reused across tab switches (avoid reloading Access/Audit datasets unless filters/targets change)

### Integration

- Third-party OAuth providers (Google, GitHub)
- Webhook support for campaign events
- REST API documentation (OpenAPI/Swagger)
- GraphQL API alternative

---

## Evaluation Criteria

When considering future tasks, evaluate based on:

1. **User Impact:** How many users benefit? How significantly?
2. **Implementation Effort:** Developer time required
3. **Maintenance Burden:** Ongoing support and complexity
4. **Alignment with Core Mission:** Does it enhance the core gallery functionality?
5. **Alternative Solutions:** Can users achieve this another way?

---

*Document created: February 1, 2026*  
*Last updated: February 13, 2026 — added Phase 10 deferred items (A1/A2 stretch, E1/E2, Track F)*
