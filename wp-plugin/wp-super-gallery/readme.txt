=== WP Super Gallery ===
Contributors: wpsupergallery
Tags: gallery, media, campaign, layout-builder, embed
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 8.2
Stable tag: 0.90.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embeddable campaign gallery with Shadow DOM rendering, a visual layout builder, and pluggable tile adapters.

== Description ==

WP Super Gallery lets you create rich, embeddable campaign galleries directly inside WordPress.

**Key features:**

* **Shadow DOM rendering** — galleries embed on any page without CSS conflicts.
* **Visual layout builder** — drag-and-drop grid editor with layer support (masks, overlays, backgrounds, text).
* **Multiple tile adapters** — classic grid, masonry, justified, hexagonal, circular, diamond, and compact-grid layouts.
* **Campaign management** — create, schedule, and organise media campaigns with tagging and access controls.
* **oEmbed proxy** — embed external media via a built-in oEmbed proxy with provider allowlist and SSRF protection.
* **Lightbox & viewer** — configurable modal viewer with keyboard navigation, pagination, and responsive breakpoints.
* **Admin panel** — TanStack Query-powered admin UI with analytics, audit logs, access-request management, and advanced settings.
* **Theme system** — ship custom themes or let users author their own via a documented JSON schema.
* **Design assets** — SVG overlay library with drag-and-drop, upload sanitization, and .htaccess hardening.
* **Image optimisation** — automatic resize, compression, and optional WebP conversion on upload.
* **Extensible** — hooks, filters, and a REST API for custom integrations.

== Installation ==

1. Upload the `wp-super-gallery` folder to the `/wp-content/plugins/` directory, or install directly through the WordPress plugin screen.
2. Activate the plugin through the **Plugins** screen in WordPress.
3. Navigate to **WP Super Gallery** in the admin menu to create your first campaign.
4. Use the shortcode `[wp_super_gallery id="123"]` or the block editor embed to display a gallery on any page.

= Requirements =

* WordPress 6.0 or later
* PHP 8.2 or later
* MySQL 5.7 / MariaDB 10.3 or later

== Frequently Asked Questions ==

= Does the gallery work with any theme? =

Yes. Galleries render inside a Shadow DOM, so they are fully isolated from your theme's CSS.

= Can I embed galleries on external sites? =

Yes. Each campaign provides an embed snippet (iframe or JS) that can be placed on any website.

= What media providers are supported? =

The oEmbed proxy supports YouTube, Vimeo, Spotify, SoundCloud, Dailymotion, TikTok, and more. A configurable allowlist controls which providers are enabled.

= Is SVG upload safe? =

SVG files are sanitised on upload using a dual-layer approach: the `enshrined/svg-sanitize` library strips dangerous elements, and custom validators block malicious CSS and URIs. A restrictive `.htaccess` is also placed in the overlay directory.

== Screenshots ==

1. Campaign gallery with classic grid adapter.
2. Visual layout builder with layer panels.
3. Admin campaign management panel.
4. Lightbox viewer with keyboard navigation.
5. Advanced settings accordion.

== Changelog ==

= 0.90.0 =
**Consolidated pre-release — development Phases 30–59**

The version is advanced to 0.90.0 to signal proximity to the first paid release. Highlights, grouped by theme:

* Added: Gallery Spaces — run independent, access-scoped galleries on one site, each with its own media library, settings inheritance, and access grants; move campaigns across spaces; target a space with the shortcode `space` attribute.
* Added: New tile/layout adapters — Spotlight/Hero, Scroll-Snap, Waterfall, Coverflow (3D), Mosaic/Pinterest, Stacked/Deck, and Isotope/Filterable Grid; unified campaign-listing adapters with carousel pagination.
* Added: Layout Builder maturity — grid/snapping/rulers toolbar, responsive per-breakpoint preview and slot overrides, nested groups, marquee select, clipboard copy/paste, per-slot opacity/rotation, scroll-reveal animations, auto-grid generator, saved color swatches with eyedropper, layer search, draggable guides, and full text/caption layers with on-canvas editing.
* Added: Role-based access control — System-Admin vs Editor tiers, per-campaign and per-company access grants, and viewer-only time-limited grants.
* Added: Admin productivity — analytics live-refresh, advanced media sorting, near-duplicate detection, reload-safe UI state, inline campaign-metadata edits, asset-management UI, and a tags/categories overhaul.
* Added: Gallery configuration controls — client-side validation, configurable breakpoint thresholds, adapter capability badges, reset-to-default, schema hints, and JSON import/export of gallery settings.
* Added: Enterprise & integration — webhooks for campaign events, binary campaign/media/audit-log exports with ZIP import, and object-cache (Redis/Memcached) guidance.
* Added: Auditing & observability — canonical audit-event contract, campaign- and system-scoped coverage, structured server-side logging, and audit-log export.
* Changed: Production hardening — CSS/DOMPurify sanitization, localStorage audit, front-end accessibility baseline, and LayoutBuilder robustness (error boundaries, drag-bounds clamping).
* Changed: Internationalization groundwork — user-facing front-end strings wrapped for translation with WordPress-locale detection; translation template (`.pot`) now ships.
* Changed: Maintainability & performance — REST class decomposed into domain controllers, shared `@wpsg` packages extracted, single-source TS/PHP field-map schema, lazy-loaded adapters, and service-worker offline caching.

= 0.25.0 =
**Phase 28 — API Capability Expansion & Backend Hardening**

* Added: Campaign hard-delete endpoint (`DELETE /campaigns/{id}`) with confirmation guard
* Added: Time-limited access grants with `expires_at` support
* Added: Taxonomy CRUD endpoints for campaign categories and tags (create/update/delete)
* Added: Batch media upload support (`POST /media/upload` multi-file + `POST /campaigns/{id}/media/batch`)
* Added: Campaign filtering enhancements (category, tag, sort, include_archived, template_id)
* Added: Pagination on unbounded list endpoints (companies, categories, tags, roles, access grants, audit logs)
* Added: Audit log improvements with dedicated table and global view
* Added: Analytics expansion with per-media tracking and summary dashboard
* Added: Magic-link access request approval with one-click email integration
* Added: Access totals summary endpoint for aggregate views
* Added: REST args hardening with typed parameters for better validation
* Added: Rate-limit status headers for quota visibility
* Added: Media sort controls for better organization
* Added: Duplicate media detection on upload with MD5-based checks
* Added: Campaign templates with preset library support
* Added: Settings ETag support and PATCH method for partial updates
* Added: Hierarchical campaign categories with tree-based UI

= 0.24.0 =
**Phase 25 — Settings UX follow-through and query architecture**

* Added: live campaign gallery preview with cancel-to-revert behavior, per-breakpoint unified adapter selection, accordionized campaign gallery config, shared upload/external media entry, and higher-level card/gallery scale and positioning controls.
* Changed: Settings moved to a regrouped drawer workflow; app/admin/layout data fetching now uses TanStack Query and the nested `galleryConfig` / `galleryOverrides` contract only.
* Fixed: classic WordPress settings partial saves no longer reset nested gallery settings; modal stacking correctness when opening Settings above an active campaign viewer.
* Changed: upgraded the frontend runtime to React 19.2.6 and Mantine 9.1.1; removed unused `react-window` packages; applied React 19 type fixes (nullable refs, timer ref initialization, ReactElement return types).
* Fixed: portal-heavy viewer/admin surfaces now stay inside the active tree in both shadow and non-shadow mounts; `Notifications` component configured with `withinPortal={false}` to prevent shadow DOM escape.

= 0.23.0 =
**Phase 24 — Flat-Field Deprecation, Gallery Selection Parity & UX Fixes**

* Added: nested-only write paths for global settings and campaign saves, breakpoint-grid adapter selection parity, theme preview/cancel reliability, and faster gallery-config editor entry points.
* Fixed: hashed manifest entry scripts now register without `?ver=` so lazy chunks reuse the same main module instance and live theme preview stays consistent.

= 0.22.0 =
**Phase 23 — Settings Architecture Refactor, Responsive Gallery Config & Campaign Parity**

* Added: backend and frontend settings decomposition, authoritative adapter schema, nested responsive `galleryConfig`, shared effective-config resolution, a shared Gallery Config editor, campaign override parity, and render-path consolidation.
* Fixed: schedule visibility enforcement, UTC datetime sanitization, mixed-state campaign selector indicators, and nested gallery config sync with inline settings edits.

= 0.21.0 =
**Phase 22 — Carousel Overhaul, Viewer Alignment & Gallery Layout Fixes**

* Added: Embla-powered classic carousel with multi-card view, autoplay, drag, edge fade, darken-unfocused, loop, and gap controls.
* Added: carousel settings controls in Settings Panel, including unified-gallery support for the classic carousel adapter.
* Added: modal content vertical alignment setting for campaign viewer gallery sections.
* Fixed: compact grid justification by switching to `auto-fit` so incomplete rows align correctly.
* Fixed: carousel settings visibility logic so classic adapter settings appear in unified, unified-selection, and per-breakpoint modes.

= 0.19.0 =
**Phase 21 — UX Overhaul: Bugs, Campaign Cards, Viewer, Typography & In-Context Settings**

* Added: campaign card visibility toggles, aspect ratio controls, auth bar display modes, viewer background/border controls, gallery label customization, in-context typography editors and settings tooltips.
* Improved: CampaignViewer behavior and fullscreen/galleries-only experiences, modal flow unification, and settings persistence/reliability fixes.
* Fixed: multiple QA and PR-review issues including gradient object-shape sanitization, debounced save cleanup on unmount, and missing PHP defaults for P21-G label settings persistence.

= 0.18.0 =
**Phase 20 — Production Hardening, CI/CD Pipeline & Distribution Readiness**

* Security hardening: rate limiting defaults, CSS value sanitization, import payload sanitization, meta sanitize callbacks, nonce bypass hardening, DNS rebinding SSRF fix, CSP headers, Sentry PII scrubbing.
* Uninstall cleanup with 9-category data removal and preserve-data option.
* GPLv2 license, complete plugin header for WordPress.org.
* GitHub Actions CI/CD: lint/test/PHPUnit pipeline, automated release with SemVer, WordPress.org SVN deploy, E2E workflow.
* Performance: layout template CPT migration, media refs reverse-index, cache version counter, lazy-loaded builder (504→327 KB), async email queue.
* Plugin directory prep: readme.txt, custom capabilities, i18n text domain loading.
* JWT gated behind env var, nonce-only auth default with heartbeat refresh.
* SVG dual-layer sanitization (server + client) with enshrined/svg-sanitize.
* PHPUnit coverage raised to ~92% (461 tests, 1104 assertions).

= 0.17.0 =
**Phase 19 — Builder Test Coverage, WP-CLI & Toolchain**

* Layout-builder unit-test coverage raised to ~75 % area / 75 %+ branch (539 tests, 37 files).
* New `wp wpsg` WP-CLI commands: campaign CRUD, media import, settings get/set, cache flush, health check.
* Commitlint + lint-staged + Husky git-hooks pipeline with `@commitlint/config-conventional`.
* ESLint 9 flat-config migration; added `eslint-plugin-react-compiler`.
* Playwright E2E suite: smoke, admin-actions, auth-permissions, media-flows specs.
* PHPUnit test infrastructure with `yoast/phpunit-polyfills` and 10+ server-side test classes.

= 0.16.0 =
**Phase 18 — Admin Power Features**

* Analytics dashboard: per-campaign embed views, unique visitors, referrer breakdown, date-range filtering.
* Access-request workflow: users request access, admins approve/deny from dedicated panel tab.
* Audit-log viewer: filterable table of admin actions with user, action, timestamp, and detail columns.
* Bulk campaign actions: multi-select archive, delete, export (JSON).
* Campaign duplication with deep-copy of media and settings.
* Email notifications: configurable alerts for access requests, campaign publish, and weekly digest.
* Service-worker offline cache for admin SPA assets.

= 0.15.0 =
**Phase 17 — Design Assets, Dockable Panels & Advanced Layer Editing**

* Design-asset browser: built-in SVG overlay library with search, categories, drag-and-drop onto canvas.
* Dockview panel system: resizable, collapsible, and dockable editor panels replacing fixed sidebars.
* Layer reordering via drag-and-drop with react-dnd; multi-select and group operations.
* Mask sub-layer UX overhaul: shape picker, feather, invert, and offset controls.
* Background sub-layer panel: solid, gradient, pattern, and image fill modes.
* Overlay library CRUD REST endpoints with file-upload support.

= 0.14.0 =
**Phase 16 — Layer System**

* Full layer system: masks, overlays, text, and background sub-layers per media item.
* Layer panel UI with per-layer visibility toggle, opacity slider, blend-mode picker.
* Clip-path mask shapes: circle, ellipse, polygon, inset, and custom SVG path.
* Text layers with font-family, size, colour, alignment, and shadow controls.

= 0.13.0 =
**Phase 15 — Layout Builder & QA Sprint**

* Visual layout builder: drag-and-drop grid editor with cell merge, split, resize.
* 6 tile gallery adapters: classic, masonry, justified, hexagonal, circular, diamond.
* Card gallery pagination: show-all, load-more, and paginated display modes.
* Mobile readiness audit: 17 issues fixed, responsive breakpoints, safe-area-inset support.
* Admin SWR migration: skeleton loading, background prefetch, staggered dedup.
* Campaign scheduling: publishAt / unpublishAt with cron auto-archive.
* Lazy image loading with skeleton placeholders and error fallback.

= 0.12.0 =
**Phase 14 — Infrastructure Hardening & Advanced Settings**

* Security hardening: dead code removal, status/visibility allowlists, CORS tightening.
* External thumbnail cache with daily cron cleanup and REST management endpoints.
* oEmbed monitoring and per-IP rate limiting (30 req / 60 s).
* Image optimisation on upload: auto-resize, compress, optional WebP.
* Campaign and media tagging taxonomies.
* ~70 advanced settings behind feature toggle with generic type-aware sanitiser.
* Settings DRY refactor: deleted 586 lines of triplicated mapping code.

== Upgrade Notice ==

= 0.90.0 =
Consolidated pre-release covering Phases 30–59: Gallery Spaces (multi-instance isolation), an expanded adapter library, a matured Layout Builder with text layers, role-based access control, and production hardening. Rebuild plugin assets and review access-control roles and per-space settings after upgrade.

= 0.24.0 =
Settings and gallery configuration now run on the nested-only `galleryConfig` / `galleryOverrides` contract, and the frontend runtime now uses React 19.2.6 plus Mantine 9.1.1. Rebuild plugin assets and smoke-test custom settings and modal-heavy flows after upgrade.

= 0.18.0 =
Production hardening: JWT auth gated behind env var (nonce-only default), CSS sanitization, async email queue, rate-limiting defaults, GPLv2 licensing, CI/CD pipeline, and WordPress.org distribution readiness. Review auth settings after upgrade.

= 0.17.0 =
Adds WP-CLI commands, Playwright E2E tests, and raises builder test coverage to 75 %+. No breaking changes.
