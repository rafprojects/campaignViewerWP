=== WP Super Gallery ===
Contributors: wpsupergallery
Tags: gallery, media, campaign, layout-builder, embed
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 8.0
Stable tag: 0.21.0
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
* **Admin panel** — SWR-powered admin UI with analytics, audit logs, access-request management, and advanced settings.
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
* PHP 8.0 or later
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

= 0.18.0 =
Production hardening: JWT auth gated behind env var (nonce-only default), CSS sanitization, async email queue, rate-limiting defaults, GPLv2 licensing, CI/CD pipeline, and WordPress.org distribution readiness. Review auth settings after upgrade.

= 0.17.0 =
Adds WP-CLI commands, Playwright E2E tests, and raises builder test coverage to 75 %+. No breaking changes.
