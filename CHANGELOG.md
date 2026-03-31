# Changelog

All notable changes to WP Super Gallery will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.23.0] - 2026-03-31

### Added - Phase 24: Flat-Field Deprecation, Gallery Selection Parity & UX Fixes

- **P24-A** Flat-field deprecation on write paths — global settings and campaign saves now write nested gallery config only, while legacy flat gallery fields are still promoted on read for compatibility and pruned on subsequent nested saves.
- **P24-B** Breakpoint-grid adapter selection parity — unified and per-type gallery selection now use consistent breakpoint grids in Settings and campaign edit flows, with inherited-state behavior for campaign overrides.
- **P24-C** Theme selection UX hardening — `ThemeSelector` is now controlled from settings state, previews immediately on selection, and reverts on cancel instead of drifting from the persisted theme value.
- **P24-D** Gallery config editor access improvements — lazy editor entry points now expose explicit loading feedback and campaign-context editing shortcuts.
- **P24-E** Deferred review cleanup — remaining settings sanitization and confirmation-modal cleanup tied to the Phase 24 settings pipeline were completed.

### Fixed

- WordPress manifest-based ES module entry assets now register without `?ver=` so Vite lazy chunks resolve to the same main module instance; this removes the duplicated React context state that broke live theme preview inside the lazy-loaded settings UI.
- Added a PHP regression test asserting that hashed manifest entry scripts are registered versionless.

## [0.22.0] - 2026-03-30

### Added - Phase 23: Settings Architecture Refactor, Responsive Gallery Config & Campaign Parity

- **P23-A** Backend settings decomposition — split monolithic `class-wpsg-settings.php` into thin facade with registry, conversion, sanitizer, renderer, and field-group modules.
- **P23-B** Frontend settings decomposition — extracted all tab bodies (General, Layout, Media Display, Typography, Campaign Cards, Campaign Viewer, Advanced) into dedicated section modules; `SettingsPanel` reduced to shell/orchestration.
- **P23-C** Authoritative adapter schema — centralized adapter metadata (id, label, scope, breakpoint restrictions, capabilities, field groups) in a shared registry; replaced duplicated option lists and hardcoded visibility rules with schema-driven rendering.
- **P23-D** Nested responsive gallery config model — `galleryConfig` structure organized by mode → breakpoint → scope → common/adapter settings; legacy flat fields serve as compatibility bridge.
- **P23-E** Shared resolver and inheritance layer — unified effective-config resolution (campaign nested → campaign legacy → global nested → global flat → fallback) for editor, runtime, and render paths.
- **P23-F** Shared Gallery Config editor UX — lazy-loaded responsive gallery editor with breakpoint/scope switching, common and adapter-specific settings, reset/clear actions, and inherited-vs-overridden messaging; used by both SettingsPanel and campaign modal.
- **P23-G** Campaign full gallery config parity — campaigns can override the same responsive gallery surface as global settings; inheritance-first with scope-level reset; override summaries and badges in admin UI; duplicate/import flows preserve nested overrides.
- **P23-H** Render-path consolidation — unified and per-type gallery sections share one `CampaignGalleryAdapterRenderer`; shell-level spacing resolved through shared helpers; breakpoint-specific resolution validated.
- **P23-I** Shared sanitization and REST support — schema-driven nested payload sanitization for both global `gallery_config` and campaign `galleryOverrides`; explicit adapter field allowlists; misplaced-key rejection with forward-compatible unknown-key preservation.
- **P23-J/J1** Documentation, testing, and PHP test audit — phase report, data model doc, UI flow doc; focused frontend and PHPUnit coverage; full suite verification (85 frontend files / 1205 tests, 495 backend tests / 1433 assertions).

### Fixed

- Campaign quick selectors now show "Mixed (breakpoint-specific)" indicator when breakpoint-specific overrides differ across breakpoints.
- Schedule visibility gate added to `can_view_campaign()` — future and expired campaigns are no longer exposed through direct reads or permission-derived lists.
- Datetime sanitizer now accepts the plugin's own stored UTC format (`Y-m-d H:i:s`) alongside ISO 8601, normalizing all inputs to UTC for storage.
- REST rate limiting now covers user creation requests.
- Nested gallery scalar values validated in sanitizer.
- Legacy per-type adapter correctly ignored in unified mode for campaign overrides.
- Nested gallery config syncs with inline settings edits.

## [0.21.0] - 2026-03-25

### Added - Phase 22: Carousel Overhaul, Viewer Alignment & Gallery Layout Fixes

- **P22-P8d** Embla carousel migration — replaced custom carousel internals with `embla-carousel-react` + autoplay plugin, adding multi-card view, autoplay, drag, loop, gap, edge fade, and darken-unfocused controls.
- Carousel settings accordion in SettingsPanel, including unified-gallery support for the classic carousel adapter.
- `modalContentVerticalAlign` setting for top/center/bottom alignment of gallery sections within CampaignViewer.

### Fixed

- Compact grid row justification now uses `auto-fit` instead of `auto-fill`, allowing incomplete rows to align correctly.
- Carousel settings visibility now works in unified, unified-selection, and per-breakpoint adapter modes.

## [0.20.0] - 2026-03-19

### Added - Phase 22: Layout Fixes, Theme Contrast & WCAG AA Compliance

- **P22-A** CardGallery cardMaxWidth layout fix — conditional flex/SimpleGrid replaces wrapper div pattern.
- **P22-B** Company logo auto-detection — shared CompanyLogo renders URLs as images, text/emojis as spans.
- **P22-C** CampaignViewer IIFE refactor — extracted UnifiedGallerySection, VideoGallerySection, ImageGallerySection.
- **P22-D** Replaced getEffectiveColumns resize listener with Mantine useMediaQuery hooks.
- **P22-E** Gallery overlay contrast hardening — shared constants (rgba(0,0,0,0.7)) across all 6 adapters.
- **P22-F** Theme textMuted2 WCAG AA contrast audit — all 13 non-compliant themes corrected to ≥4.5:1.
- **P22-G** WCAG AA compliance: close button contrast, icon opacity, stats role, empty media message, aria-labels.
- **P22-H** New light themes: github-light and catppuccin-latte.

### Fixed

- **P22-I** Draggable auth bar positioning — deferred default via useEffect, resize re-clamping, null guard on mount.
- Close button contrast increased from rgba(0,0,0,0.45) to rgba(0,0,0,0.65) in CampaignViewer.
- BuilderHistoryPanel icon opacity raised from 0.3 to 0.5 for WCAG 1.4.11 compliance.
- LayoutSlotComponent mask opacity increased from 0.4 to 0.6; removed userSelect:none from text content.

## [0.19.0] - 2026-03-18

### Added - Phase 21: UX Overhaul, Viewer Controls & In-Context Editing

- **P21-A** Bug fixes and UX hardening across Settings and modal workflows.
- **P21-B** Campaign card visibility toggles (info panel, cover image, tags, admin actions, gallery labels).
- **P21-C** Card aspect ratio controls and layout refinements.
- **P21-D** Viewer background type controls (theme/transparent/solid/gradient) and structured gradient settings.
- **P21-E** Auth bar display modes: bar, floating, draggable, minimal, auto-hide.
- **P21-F** CampaignViewer enhancements including fullscreen and galleries-only mode controls.
- **P21-G** Gallery label editing controls (image/video labels, label icon toggle, justification).
- **P21-H** Settings tooltip infrastructure and copy cleanup.
- **P21-I** Typography overrides system with in-context editor popovers.
- **P21-J/K** QA stabilization and follow-up fixes from PR review rounds.

### Fixed

- Empty gradient sanitization now preserves object shape (`{}`) in PHP default/sanitization paths.
- Debounced in-context save now clears pending timers on unmount to avoid stale updates.
- Added missing PHP defaults for P21-G gallery label settings so SettingsPanel values persist correctly.

## [0.18.0] - 2026-03-10

### Added - Phase 20: Production Hardening, CI/CD Pipeline & Distribution Readiness

- **P20-A** Rate limiting defaults — public 60 req/min, authenticated 120 req/min, filter overrides; 7 PHPUnit tests.
- **P20-B** Import payload deep sanitization — `import_campaign()` routed through `sanitize_template_data()`, slots/overlays/background all sanitized; 10 PHPUnit tests.
- **P20-C** CSS value sanitization — `sanitize_css_value()` with type-specific allowlists (color, clip-path, position), universal blocklist, 4 call sites updated; 34 PHPUnit tests.
- **P20-D** Post meta sanitize callbacks on all 7 REST-exposed post meta fields; 8 PHPUnit tests.
- **P20-E** Uninstall cleanup — `uninstall.php` with 9-category data removal (posts, terms, options, transients, tables, roles, cron, files), `preserve_data_on_uninstall` option.
- **P20-F** License & legal — GPLv2 `LICENSE` at repo root and plugin dir, complete plugin header with all WordPress.org required fields.
- **P20-G** GitHub Actions CI/CD pipeline — `ci.yml` (ESLint + tsc → Vitest + build → PHPUnit matrix PHP 8.1/8.2/8.3), `release.yml` (workflow_dispatch with auto SemVer from conventional commits, production ZIP, GitHub Release), `svn-deploy.yml` (WordPress.org SVN deploy of existing release), `e2e.yml` (manual Playwright via wp-env). `scripts/compute-version.sh` for automated version calculation. Legacy CircleCI deleted.
- **P20-H** (12/12) Security hardening sprint — parseProps prop whitelist, DNS rebinding SSRF fix (TOCTOU-safe `pre_http_request`), nonce bypass hardened (constant-gated), password reset URL removed from response, overlay file deletion on remove, Sentry PII scrubbing (`beforeSend`), CSP headers, ErrorBoundary→Sentry, apiClient 30s timeout + AbortController, status/visibility whitelist, `encodeURIComponent` on URL segments, `console.info` DEV guard.
- **P20-I** Performance optimizations — layout templates migrated from `wp_options` to `wpsg_layout_tpl` CPT with auto-migration + UUID backward compat; `wpsg_media_refs` reverse-index table (DB v3); cache version counter replaces LIKE-based invalidation; `React.lazy()` for LayoutBuilderModal + PresetGalleryModal (admin chunk 504→327 KB); async email queue + 1-min cron dispatch; shared React root via `createPortal` (feature-flagged).
- **P20-J** Plugin directory preparation — `readme.txt` in WordPress.org format, composer dev deps separated, `capability_type => wpsg_campaign` with `map_meta_cap` (10 CPT caps), `load_plugin_textdomain()` + `__()` i18n wrapping.
- **P20-K** JWT nonce-only default — JWT gated behind `WPSG_ENABLE_JWT_AUTH`, `useNonceHeartbeat` hook, `/nonce` endpoint, cookie-based `/auth/login` and `/auth/logout` REST endpoints; 12 Vitest + 6 AuthContext + 11 PHPUnit tests.
- **P20-L** SVG dual-layer sanitization — `enshrined/svg-sanitize` with custom CSS validator (`sanitize_svg_css`), URI allowlist (`sanitize_svg_uris`), `.htaccess` CSP headers for overlay dir; 24 PHPUnit tests.

### Changed

- PHPUnit test suite expanded to 461 tests / 1104 assertions with ~92% method coverage (172/186 methods); fixed all 14 pre-existing test failures (PHP 8.3 null deprecations, nonce bypass, CPT caps).
- Layout Builder QA Rounds 3–7: advanced gradient controls (linear/radial/conic with full CSS output), mask sub-layer system (Photoshop-style with canvas resize handles), image effects system (5 categories: filters, shadow/glow, 3D tilt, blend modes, overlay), per-slot glow color/spread, background properties panel, design assets drag-and-drop, canvas drop-to-create for media and assets.
- `VERSIONING.md` updated with automated release process documentation.
- `PACKAGING_RELEASE.md` updated: PHP 7.4→8.0+, CircleCI references removed, GitHub Actions notes added.

## [0.17.0] - 2026-03-02

### Added - Phase 19: Builder Coverage, WP-CLI & Toolchain

- **P19-QA** (`9963400`): 102 new JS tests across 9 Phase 18 components (`AccessRequestForm`, `PendingRequestsPanel`, `QuickAddUserModal`, `AnalyticsDashboard`, `MediaUsageBadge`, `CampaignDuplicateModal`, `CampaignImportModal`, `KeyboardShortcutsModal`, `BulkActionsBar`) and 2 hooks (`useAdminCampaignActions`, `useAdminAccessState`); functions coverage threshold lifted 60%→65%; all Vitest thresholds green; ~991 JS tests total.
- **P19-D** (`e604ff6`): Pre-commit toolchain — Husky hooks (`pre-commit` → lint-staged, `commit-msg` → commitlint, `pre-push` → vitest run); lint-staged runs ESLint + `tsc --noEmit` on staged TS/TSX; commitlint enforces Conventional Commits (11 allowed types, 120-char header limit); `CONTRIBUTING.md` documents all hooks and bypass instructions.
- **P19-A** (`5685249`): Builder keyboard shortcuts hardening — `Ctrl+S` save, `?` opens `BuilderKeyboardShortcutsModal` (7 shortcut categories rendered in a Kbd table), `V` select tool, `0` reset zoom, `=`/`+` zoom in, `-` zoom out via `useHotkeys`; 25 new tests.
- **P19-B** (`12e0155`): Builder undo/redo improvements — `HistoryEntry` interface (`id`, `label`, `timestamp`) added to `useLayoutBuilderState`; `mutate()` accepts a descriptive label (35 labeled call sites); new `BuilderHistoryPanel` dockview tab showing reverse-ordered history with click-to-jump, current-entry highlight, and undo/redo header buttons; 23 new tests.
- **P19-C** (`a979761`): WP-CLI command surface — `class-wpsg-cli.php` registered under `WP_CLI::add_command('wpsg', 'WPSG_CLI')` gated on `defined('WP_CLI')`. Commands: `wp wpsg campaign list/archive/restore/duplicate/export/import`, `wp wpsg media list/orphans`, `wp wpsg cache clear`, `wp wpsg analytics clear`, `wp wpsg rate-limit reset`; all write audit-log entries and invalidate campaign transient cache; 27 PHPUnit scenarios in `WPSG_CLI_Test.php`.

### Fixed

- **P19-E** (`aed33af`): `SettingsPanel.test.tsx` race condition — all `waitFor` load gates replaced with `await screen.findByRole('tab', {name: /General/i})` (resolves only after `isLoading=false`); slow all-checkbox loops replaced by label-targeted `toggleSwitchByLabel()` helper; `clickTabAndWait()` helper waits for panel content after tab click; 16/16 tests pass reliably without hangs.

## [0.16.0] - 2026-03-01

### Added - Phase 18: Admin Power Features, Coverage & Canvas Polish

- **P18-QA JS** (`e996fb5`): 841 tests; functions threshold 41%→66.5%; all thresholds green (statements 75%, branches 60%, functions 60%, lines 75%).
- **P18-QA PHP** (`477521f`): 117 tests / 303 assertions; new `WPSG_Rate_Limiter_Test`, `WPSG_Embed_Test`, Campaign REST edge cases.
- **P18-A Zoomable Canvas** (`1f2bc57`): `react-zoom-pan-pinch`; `CanvasTransformContext`; hand tool; zoom % indicator; Rnd scale fix.
- **P18-B Bulk Actions** (`e392e8a`): `POST /campaigns/batch`; `BulkActionsBar`; select-mode toggle; `handleBulkArchive`/`handleBulkRestore`.
- **P18-C Campaign Duplication** (`e392e8a`): `POST /campaigns/{id}/duplicate`; `CampaignDuplicateModal`; Clone button in campaign list.
- **P18-D Export/Import JSON** (`d5859ff`): `GET /campaigns/{id}/export`; `POST /campaigns/import`; `CampaignImportModal`; `CampaignExportPayload` type.
- **P18-E Keyboard Shortcuts** (`d5859ff`): `KeyboardShortcutsModal`; `useHotkeys` bindings (`?`, `mod+n`, `mod+i`, `mod+shift+a`).
- **P18-F Analytics Dashboard** (`588c85e`): `wpsg_analytics_events` DB table; `POST /analytics/event` (rate-limited, IP-hashed); `GET /analytics/campaigns/{id}`; recharts `AnalyticsDashboard` (lazy-loaded).
- **P18-G Media Usage Tracking**: `GET /media/{id}/usage`; `GET /media/usage-summary`; `MediaUsageBadge` popover; orphan filter; delete guard.
- **P18-H Campaign Categories**: `wpsg_campaign_category` taxonomy; `GET /campaign-categories`; `categories[]` in create/update; `TagsInput` in form; `Chip.Group` filter pills.
- **P18-I Access Request Workflow** (`4a5712a`): `POST /campaigns/{id}/access-requests` (submit); `GET /campaigns/{id}/access-requests` (admin list); `POST …/approve` + `POST …/deny` action endpoints; per-token WP options storage with `wpsg_access_request_index` (no custom DB table); `RequestAccessForm`; `PendingRequestsPanel`; `QuickAddUserModal`; approval email flow.
- **P18-X Code Size Reduction** (`2b093b4`): `App.tsx` 808→346 lines; `AdminPanel.tsx` 1168→390 lines; 8 new hooks extracted.

## [0.15.0] - 2026-02-26

### Added - Phase 17: Builder UX — Design Assets Consolidation & Dockable Panels

- **P17-F**: Type rename pre-work — `overlay` → `graphicLayer` throughout codebase (~15 files).
- **P17-B**: `AssetUploader` sub-component extracted from `LayoutBuilderModal`.
- **P17-C**: Media slot drop guard — prevents non-image drops on image-typed slots.
- **P17-D**: `GraphicLayerPropertiesPanel` — dedicated properties panel for graphic layers (position, size, opacity, blend mode, z-index).
- **P17-A**: Design assets consolidation in `LayoutBuilderModal` — unified left panel with tabbed interface.
- **P17-E**: True dockable panels via `dockview` (~38 KB gzip) — resizable/detachable builder panels; `vendor-dockview` chunk split.

## [0.14.0] - 2026-02-25

### Added - Phase 16: Layer System

- **P16-A**: Unified Layer Panel — `buildLayerList()` + `getLayerName()` utilities; `LayerPanel` + `LayerRow` components; unified slot + graphic layer list with drag-to-reorder.
- **P16-B**: State actions — 7 new actions in `useLayoutBuilderState` (lock, unlock, show, hide, move-up, move-down, z-reorder layers).
- **P16-C**: Canvas locked support — `LayoutCanvas` and `LayoutSlotComponent` respect locked flag; visual locked indicator overlay.
- **P16-D**: Modal restructure — `LayoutBuilderModal` restructured for layer panel integration; 25 new tests; 564 tests total.

## [0.13.0] - 2026-02-26

### Added - Phase 15: Layout Builder (Complete + QA Sprint)

#### Layout Builder — Core Features
- **P15-A — Per-Breakpoint Gallery Selection**: 6-way adapter config (desktop/tablet/mobile × image/video); `useBreakpoint` container-width hook; unified toggle collapses to single selection (backward compat).
- **P15-B — Layout Template Data Model**: `LayoutTemplate`, `LayoutSlot`, `LayoutOverlay`, `CampaignLayoutBinding` TypeScript interfaces; `assignMediaToSlots()` auto-fill utility; PHP REST CRUD for templates.
- **P15-C — Canvas Builder UI**: Full-screen `LayoutBuilderModal`; `LayoutCanvas` workspace; `LayoutSlotComponent` (react-rnd drag+resize, clip-path shapes, focal point, border); `SlotPropertiesPanel` (X/Y/W/H, lock-ratio, shape, border, z-index, click action, hover effect, focal point 9-dot grid); `MediaPickerSidebar` (auto-assign, drag-to-slot, click-to-assign, assignments panel); `useLayoutBuilderState` hook with undo/redo stack and autosave.
- **P15-D — Smart Guides & Snapping**: `SmartGuides` SVG overlay; `computeGuides()` pure function; configurable snap threshold slider; edge/center/spacing detection with color-coded guide lines.
- **P15-E — Finalized Gallery Adapter**: `LayoutBuilderGallery` renders templates with pixel-perfect slot positioning; `useLayoutTemplate` SWR hook; lightbox integration; overlay rendering; count mismatch warnings.
- **P15-F — Template Library**: `LayoutTemplateList` admin panel; campaign layout selector in `CampaignFormModal`; JSON import/export with schema validation.

#### Stretch Goals
- **P15-G — Z-Index / Layer Control**: bringToFront / sendToBack / bringForward / sendBackward actions; keyboard shortcuts; layer-ordered slot list; normalize z-index on save.
- **P15-H — Overlay Transparencies**: Overlay CRUD (file upload + URL); canvas rendering via Rnd; opacity slider; click-through toggle; gallery adapter overlay rendering; blob-URL guard.
- **P15-I — Mixed Shapes**: Shape preview icons; 8 shapes including circle, ellipse, hexagon, diamond, custom mask URL; mask URL support.
- **P15-J — Premade Layout Presets**: 12 premade templates in `src/data/layoutPresets.ts`; `PresetGalleryModal` with mini-canvas previews; "From Preset" button; `crypto.randomUUID()` for new slot IDs.
- **P15-K — Diagonal Shapes**: 5 additional polygon shapes (parallelogram-left/right, chevron, arrow, trapezoid); `getClipPath()` shared utility; shape selector dropdown.

#### QA Sprint — Test Coverage
- 5 new layout builder test files: `SmartGuides.test.tsx` (18), `LayoutCanvas.test.tsx` (34), `LayoutSlotComponent.test.tsx` (31), `SlotPropertiesPanel.test.tsx` (30), `MediaPickerSidebar.test.tsx` (23).
- Additional `LayoutBuilderGallery.test.tsx` coverage: clip-path double-container, border fill layer, hexagon/diamond shapes, blob-URL overlay guard.
- Test suite: 539 passing (up from 319 at Sprint 6), 37 test files.
- Layout builder area statement coverage: ~75%; branch coverage: 75%+.
- Added `scrollIntoView` polyfill to `src/test/setup.ts` for Mantine Combobox JSDOM compatibility.

### Changed
- Version bumped from 0.12.0 → 0.13.0 to reflect Phase 15 feature set + QA sprint.

## [0.12.0] - 2026-02-22

### Added - Phase 14: Infrastructure Hardening, Advanced Settings & Backend Utilities

#### Security Hardening (P14-A)
- **A-1**: Removed dead Odysee code in `can_view_campaign()` guard.
- **A-2**: Added `WPSG_CPT::POST_TYPE` constant, refactored 10 string-literal references.
- **A-4**: Fixed `campaignsRows` useMemo stale closure in AdminPanel — added missing deps + `useCallback` for `handleEdit`.
- **B-1**: Removed `attempts` field from public oEmbed fallback response to avoid leaking internal retry info.
- **B-2**: Added allowlist validation for campaign `status` and `visibility` with 400 rejection; callers check return and rollback on create.
- **B-4**: Moved CORS `Allow-Methods`/`Allow-Headers` inside origin check so they aren't sent to disallowed origins.
- **B-5**: Gated `simulateEmailFailure` behind `WP_DEBUG`.
- **B-6**: Sanitized `$_SERVER['REQUEST_URI']` in `class-wpsg-embed.php`.
- **B-7**: Added regex validation for DDL identifiers in `class-wpsg-db.php`.

#### External Thumbnail Cache (P14-C)
- New `WPSG_Thumbnail_Cache` class: downloads and caches external thumbnails to `wp-content/uploads/wpsg-thumbnails/`.
- Hooked into `wpsg_oembed_success` for automatic caching; daily cron cleanup of expired entries.
- REST endpoints: `GET /admin/thumbnail-cache` (stats), `DELETE /admin/thumbnail-cache` (clear), `POST /admin/thumbnail-cache/refresh`.

#### oEmbed Monitoring & Rate Limiting (P14-D)
- New `WPSG_Rate_Limiter` class: per-IP transient-based rate limiting for public oEmbed proxy (30 req/60 s, admins exempt).
- Extended `WPSG_Monitoring` with per-provider oEmbed failure tracking, `get_health_data()` aggregation.
- Rest endpoints: `GET /admin/health`, `GET|DELETE /admin/oembed-failures`.

#### Image Optimization (P14-F)
- New `WPSG_Image_Optimizer` class: hooks `wp_handle_upload` to auto-resize and compress images; optional WebP conversion.
- Controlled by `optimize_on_upload`, `optimize_max_width`, `optimize_max_height`, `optimize_quality`, `optimize_webp_enabled` settings.

#### Media & Campaign Tagging (P14-G)
- Registered `wpsg_campaign_tag` and `wpsg_media_tag` taxonomies in `WPSG_CPT`.
- REST endpoints: `GET /tags/campaign`, `GET /tags/media`.

#### Advanced Settings System (P14-B)
- ~70 new settings (Card Appearance, Gallery Text, Modal/Viewer, Upload/Media, Tile/Adapter, Lightbox, Navigation, System) added to PHP `$defaults` registry.
- All gated behind `advancedSettingsEnabled` toggle — controls remain hidden until enabled.
- Generic fallback sanitizer: auto-detects type from `$defaults` (bool/int/float/string/URL/enum) with `$field_ranges` clamping.
- `$admin_only_fields` array controls which settings are excluded from public API responses.

### Changed

#### Settings DRY Refactor (P14-B-8)
- **PHP**: Added `WPSG_Settings::to_js()` / `from_js()` helpers with auto snake↔camel conversion. Rewrote `get_public_settings()` (12 lines) and `update_settings()` (15 lines). Deleted 586 lines of triplicated manual mapping code.
- **React**: Created `mergeSettingsWithDefaults()` utility, replacing ~240 lines of manual `response.field ?? DEFAULT.field` chains in `App.tsx` and `SettingsPanel.tsx`. `defaultSettings` in SettingsPanel now spreads `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`.
- **apiClient**: Replaced duplicate `SettingsUpdateRequest` interface with `Partial<SettingsResponse>`.
- Added ~70 new fields to `GalleryBehaviorSettings`, `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`, and `SettingsResponse`.

#### Advanced Settings UI
- New "Advanced" tab in SettingsPanel (visible only when toggle is on) with Accordion sections: Card Appearance, Gallery Text, Modal/Viewer, Upload/Media & Image Optimization, Tile/Adapter, Lightbox, Navigation, System.
- "Enable Advanced Settings" toggle added to General tab under new "Developer" divider.

### Fixed
- `REST class-wpsg-rest.php`: Removed 586 lines of orphaned old settings mapping code left after DRY refactor.
- Cleaned up duplicate `campaign_exists` method produced during REST refactor.

## [0.11.0] - 2026-02-22

### Added - Phase 13: UX Polish, Performance & Campaign Scheduling
- **P13-A — Modal CampaignViewer + Card Settings**: Converted CampaignViewer from fullscreen to centered animated modal; added 13 configurable card/grid/modal settings full-stack (border radius, width, mode, color, shadow, thumbnail height/fit, columns, gap, cover height, transition, duration, max height); border color 3-mode system (auto/single/individual) with per-card ColorInput.
- **P13-F — Card Gallery Pagination**: Three display modes (show-all, load-more, paginated), rows-per-page setting, OverlayArrows + DotNavigator, GPU-accelerated slide transition, keyboard navigation, responsive recalculation.
- **P13-E — Mobile Readiness Audit**: 17 mobile issues fixed (44px touch targets, dvh viewport units, responsive modals, safe-area-insets, touch detection); post-audit: filter overflow fix, AuthBar mobile redesign, 5 header visibility toggles, `appPadding`/`appMaxWidth`/`wpFullBleed` responsive breakpoints, lightbox animation.
- **P13-C — Admin Panel Performance**: Migrated all admin data fetching to SWR (campaigns, media, access, audit hooks in `useAdminSWR.ts`), added skeleton loading states for all tabs, background prefetch on tab open with staggered dedup, removed ~130 lines of manual state/effects.
- **P13-B — Lazy Loading**: `LazyImage` component (skeleton placeholder → opacity fade-in → error fallback) integrated into all 6 tile gallery adapters via render overrides.
- **P13-D — Campaign Scheduling**: Full-stack `publishAt`/`unpublishAt` ISO 8601 date fields — PHP post meta registration, REST format/save/filter, server-side `meta_query` filtering (non-admin only), admin `datetime-local` form inputs, schedule badges (Scheduled/Expired/Expiring soon) in admin table, hourly WP-Cron auto-archive.

### Changed
- Settings panel reorganized from 5 tabs (General/Gallery/Transitions/Navigation/Cards) to 3 tabs (General/Campaign Cards/Media Gallery) with Accordion sections.
- Admin campaign table rows now show schedule status badges alongside campaign status.
- CampaignFormModal extended with schedule date inputs and `toLocalInputValue()` ISO↔local conversion.

### Added (Dependencies)
- `@mantine/dates` ^7.17.8 and `dayjs` ^1.11.19 for date handling.

## [0.10.0] - 2026-02-19

### Added - Phase 12: Gallery Extensibility & Advanced Experience (Close-out)
- Completed pluggable gallery expansion with shipping adapters: `compact-grid`, `justified` (legacy `mosaic` alias), `masonry`, `hexagonal`, `circular`, and `diamond`.
- Added advanced tile appearance controls for non-classic adapters: tile size, X/Y gaps, border width/color, hover bounce, glow color/spread, and masonry column override.
- Added per-media viewport background controls for image/video/unified galleries with four modes: `none`, `solid`, `gradient`, `image`.
- Settings, REST API, and WordPress defaults/sanitization were extended end-to-end for all new gallery/viewport options.

### Changed
- Fixed justified rows root-cause layout regression by removing conflicting display override in `RowsPhotoAlbum` render path.
- CampaignViewer gallery rendering now applies optional background wrappers per media mode while preserving adapter behavior.
- Phase 12 report and future-task backlog were updated to close the phase and move deferred layout-builder work into a structured post-phase epic.

### Fixed
- Removed deprecated dead `MosaicGallery` implementation superseded by `JustifiedGallery`.
- Maintained clean build/test baseline while adding adapter and viewport background extensibility.

## [0.9.0] - 2026-02-16

### Added - Phase 11: UX & Discovery Improvements
- **Track A complete**: compact sign-in UX, transparent/stable video player behavior, campaign thumbnail auto-selection + admin override/upload controls, and robust online/offline fail-fast + reconnect revalidation.
- **Track B high-impact delivery**: N+1 media fetch removed via `include_media=1` bulk payload, and media reordering upgraded to `dnd-kit` drag-and-drop interactions.
- **Admin media clarity**: media type/source badges added in card and list admin views to improve at-a-glance identification.

### Changed
- Admin media card rendering now uses cached thumbnails for external videos (instead of live embeds) to avoid iframe reload churn during reorder operations.
- Campaign edit thumbnail workflow now supports explicit clear/reset, including dirty-state tracking for thumbnail-only edits.
- Campaign list `mediaByCampaign` now uses shared media-type normalization to keep types consistent with media list endpoints.

### Fixed
- `useOnlineStatus` hardened for SSR/non-browser contexts by guarding `window`/`navigator` access.
- Campaign cover-image clear behavior now persists end-to-end (frontend sends explicit clears; backend removes stored `cover_image` meta).
- Reordering/list and modal test flows stabilized around async UI timing and updated interaction paths.

## [0.8.0] - 2026-02-16

### Added - Phase 10: Codebase Refinement & UX Polish
- **Component decomposition + shared architecture**: Extracted reusable hooks/components including `useXhrUpload`, `useDirtyGuard`, `useSwipe`, `ConfirmModal`, `CampaignSelector`, `KeyboardHintOverlay`, and shared fallback/error utilities.
- **UX improvements (C1-C9)**: Admin loading states, unauthenticated empty-state messaging, gallery search, pagination/load-more behavior, touch swipe support, keyboard hint overlay, dirty-form confirmation guards, sticky auth bar, and semantic `CampaignCard` button handling.
- **Admin and media workflow quality**: Unified upload behavior, client-side file validation, better status/error messaging, and immediate gallery revalidation after media mutations.
- **Testing expansion**: New tests for `SettingsPanel`, `ThemeContext`, `ThemeSelector`, `useSwipe`, `useTheme`, and `useDirtyGuard`.

### Changed
- App/admin orchestration reduced through extraction and modal decomposition; deprecated `src/api/media.ts` flow fully removed in favor of `services/apiClient.ts`.
- Theme and typing hygiene improvements including elimination of remaining production `any` usage in media/oEmbed paths via shared typed interfaces.
- Coverage gate strategy aligned to realistic baselines while preserving quality bars (`80%` lines/statements, `72%` branches, `60%` functions).

### Fixed
- Upload auth-header mismatch regression and media-linking workflow edge cases in edit flows.
- Async modal handler correctness for archive/restore actions.
- oEmbed rendering path hardened via sanitization before `dangerouslySetInnerHTML`.

## [0.7.0] - 2026-02-05

### Added - Phase 9: Theme System
- **Theme Infrastructure**: JSON-based theme definitions with chroma.js LAB-space color generation, strict TypeScript validation, and pre-computed MantineThemeOverride objects cached in a Map for O(1) switching.
- **14 Bundled Themes**: default-dark, default-light, material-dark, material-light, darcula, nord, solarized-dark, solarized-light, high-contrast, catppuccin-mocha, tokyo-night, gruvbox-dark, cyberpunk, synthwave.
- **Runtime Switching**: Instant theme switching via React context + MantineProvider. <16ms switch time, no page reload.
- **Shadow DOM Support**: Mantine native `cssVariablesSelector` + `getRootElement` + `forceColorScheme` for full shadow DOM compatibility.
- **CSS Variable Bridge**: `--wpsg-*` custom properties generated from theme JSON for SCSS module compatibility.
- **ThemeSelector Component**: Admin dropdown with live color-swatch previews per theme.
- **WordPress Backend**: Grouped theme dropdown in WP admin settings, `allow_user_theme_override` toggle, config injection via `__WPSG_CONFIG__`.
- **71 Unit Tests**: colorGen, validation, adapter, cssVariables, and registry test suites.
- **Documentation**: Theme Authoring Guide, Theme QA Guide (80+ test cases), Phase 9 Report.

### Changed
- Migrated ~45 hardcoded color values across 11 component/SCSS files to use `var(--wpsg-*)` and `color-mix()` expressions.
- `src/theme.ts` replaced with thin re-export from theme adapter.
- `src/styles/_tokens.scss` converted to alias bridge for `--wpsg-*` variables.
- `src/styles/global.scss` migrated to theme-aware CSS variable references.
- `src/contexts/ThemeContext.tsx` split into `themeContextDef.ts` + provider + `hooks/useTheme.ts` for Fast Refresh compatibility.

### Fixed
- Comment numbering typo in ThemeContext.tsx (`resolveInitialThemeId` step 3 → 4).
- Unused `ThemeSelectItem` component refactored into `renderOption` in ThemeSelector.tsx.

---

## [0.6.0] - 2026-02-04

### Added - Phase 8: Performance, Caching, Monitoring, Security
- **Performance**: lazy loaded heavy components, virtualized admin media lists, service worker caching.
- **Caching**: transients + SWR, oEmbed TTL cache, ETag support, static asset cache headers.
- **Monitoring**: Web Vitals logging, Sentry client + server alerts, REST timing metrics.
- **Database**: indexes, pagination, access grant query optimization, archive retention strategy.
- **Security**: rate limiting (opt-in), REST nonce validation (configurable), CORS hardening, CSP + security headers, upload validation.

### Changed
- Campaigns cache TTL now respects settings.
- Public media load and auth-aware cache keys improved.

### Fixed
- Service worker caching now skips wp-admin/wp-json and respects no-store.
- Admin alert throttling split per alert type.

---

## [0.5.0] - 2026-02-03

### Added - Phase 7: Visual Polish & Testing
- **Accessibility (WCAG 2.1 Level AA)**
  - Comprehensive ARIA labels on all interactive elements
  - Proper heading hierarchy (h1 → h2 → h3) throughout application
  - `aria-live` regions for dynamic content updates
  - Context-aware button labels with campaign/media context
  - Enhanced carousel ARIA labels with keyboard instructions
  - Field descriptions on all form inputs

- **Mobile Optimization**
  - 44x44px minimum touch targets on all buttons (WCAG 2.1 AA)
  - Table.ScrollContainer for horizontal table scrolling on mobile
  - 16px base font size to prevent iOS zoom on input focus
  - Word-wrap on headings to prevent overflow
  - Responsive grid breakpoints optimized for all screen sizes
  - Touch-optimized ActionIcon sizing across admin panels

- **Keyboard Navigation**
  - Full keyboard access to all interactive elements
  - Arrow key navigation in image/video carousels
  - Enter/Space to activate cards and open lightbox
  - Escape key closes modals and lightbox
  - Home/End navigation support in media lists
  - Focus indicators (2px solid outline) on all focusable elements

- **Animations & Polish**
  - Framer Motion hover effects on campaign cards
  - Media card hover with translateY and box-shadow
  - Modal fade transitions (200ms duration)
  - Reduced motion support (respects `prefers-reduced-motion`)
  - Smooth carousel transitions
  - Admin button hover effects

- **Testing Infrastructure**
  - PHP unit tests for REST API endpoints
  - Campaign create/update/archive/restore test coverage
  - SSRF protection tests with IPv6 support
  - wp-env integration for isolated testing

### Changed
- Upgraded focus management in modals with proper tabIndex
- Improved error messages with role="alert" for screen readers
- Enhanced table markup for better screen reader compatibility
- Updated button sizes for consistent touch targets

### Fixed
- CSS preload warnings eliminated
- Media loading errors with better error boundaries
- Responsive prop issues in Mantine components
- ScrollArea behavior on mobile devices

## [0.4.0] - 2026-02-01

### Added - Phase 6: Core Features
- Campaign management with CRUD operations
- Media upload and external URL support (YouTube, Vimeo, oEmbed)
- User access control with campaign and company-level grants
- Admin panel with tabs for Campaigns, Media, Access, Audit
- Settings panel for display configuration
- Quick Add User functionality
- Archive/restore campaign workflow
- Company view mode for bulk access management
- Mantine UI 7 component library integration
- Dark theme with brand color support

### Changed
- Migrated from custom CSS to Mantine theming system
- Refactored components to use Mantine primitives

---

## [0.3.0] - 2026-01-XX

### Added - Phase 5: Authentication & Authorization
- WordPress JWT authentication integration
- Role-based access control (Administrator, WPSG Admin, Subscriber)
- Login form with email/password authentication
- Session management with token refresh
- Protected routes and conditional rendering

---

## [0.2.0] - 2026-01-XX

### Added - Phase 4: Media Management
- Image carousel with lightbox
- Video carousel with YouTube/Vimeo embed support
- Media upload functionality
- External URL media integration
- oEmbed proxy endpoint with SSRF protection

---

## [0.1.0] - 2026-01-XX

### Added - Phase 1-3: Foundation
- Initial WordPress plugin structure
- React 18 + TypeScript + Vite setup
- Custom Post Type for campaigns
- REST API endpoints
- Shadow DOM embedding
- Gallery card grid layout
- Campaign viewer modal
- Basic responsive design

---

## Upcoming

See [PHASE13_REPORT.md](./docs/archive/phases/PHASE13_REPORT.md) for Phase 13 execution details.

---

[0.11.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.9.0...v0.10.0
[0.5.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.4.0...v0.5.0
[0.9.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.5.0...v0.6.0
[0.4.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourorg/wp-super-gallery/releases/tag/v0.1.0
