# Versioning Scheme

This document outlines the versioning strategy for WP Super Gallery.

## Version Format

We use **Semantic Versioning 2.0.0** with the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, major architectural changes, or significant feature additions that may require migration
- **MINOR**: New features, enhancements, or significant improvements that are backward compatible
- **PATCH**: Bug fixes, security patches, small improvements, and documentation updates

## Version History

### v0.20.0 (March 19, 2026)
- **MINOR**: Phase 22 — Layout Fixes, Theme Contrast & WCAG AA Compliance
  - **P22-A**: CardGallery cardMaxWidth layout fix — replaced wrapper div pattern with conditional flex/SimpleGrid.
  - **P22-B**: Company logo auto-detection — shared CompanyLogo component renders URLs as images, text as spans.
  - **P22-C**: CampaignViewer IIFE refactor — extracted 3 local gallery section components.
  - **P22-D**: Replaced getEffectiveColumns manual resize listener with Mantine useMediaQuery hooks.
  - **P22-E**: Gallery overlay contrast hardening — shared constants at rgba(0,0,0,0.7), applied to all 6 adapters.
  - **P22-F**: Theme textMuted2 WCAG AA contrast audit — all 13 non-compliant themes corrected to ≥4.5:1.
  - **P22-G**: WCAG AA compliance fixes — close button contrast, icon opacity, stats role, empty media message, aria-labels.
  - **P22-H**: Added github-light and catppuccin-latte light themes.
  - **P22-I**: Draggable auth bar position fix — deferred init via useEffect, resize re-clamping, null guard.

### v0.19.0 (March 18, 2026)
- **MINOR**: Phase 21 — UX Overhaul: Bugs, Campaign Cards, Viewer, Typography & In-Context Settings
  - **P21-A**: Bug fixes and UX hardening across theme persistence, modal unification, and settings workflows.
  - **P21-B**: Campaign card visibility toggles (info panel, cover image, tags, admin actions, gallery labels).
  - **P21-C**: Card aspect ratio controls and gallery card presentation refinements.
  - **P21-D**: Viewer background controls (theme/transparent/solid/gradient) with structured gradient state.
  - **P21-E**: Auth bar display modes — bar, floating, draggable, minimal, and auto-hide.
  - **P21-F**: CampaignViewer enhancements including fullscreen and galleries-only mode support.
  - **P21-G**: Gallery label text/icon/justification controls wired through frontend and backend settings.
  - **P21-H**: Settings tooltip infrastructure and comprehensive tooltip audit.
  - **P21-I**: Typography overrides and in-context editor popovers for targeted text styling.
  - **P21-J/K**: QA hardening and PR-review follow-up fixes for persistence, sanitization, and test reliability.

### v0.18.0 (March 10, 2026)
- **MINOR**: Phase 20 — Production Hardening, CI/CD Pipeline & Distribution Readiness
  - **P20-A**: Rate limiting defaults — public 60 req/min, authenticated 120 req/min with filter overrides.
  - **P20-B**: Import payload deep sanitization — `import_campaign()` routes through `sanitize_template_data()`.
  - **P20-C**: CSS value sanitization — `sanitize_css_value()` with type-specific allowlists (color, clip-path, position).
  - **P20-D**: Post meta sanitize callbacks on all 7 REST-exposed fields.
  - **P20-E**: Uninstall cleanup — `uninstall.php` with 9-category data removal, `preserve_data_on_uninstall` option.
  - **P20-F**: License & legal — GPLv2 LICENSE, complete plugin header with all WordPress.org required fields.
  - **P20-G**: GitHub Actions CI/CD — 4 workflows: `ci.yml` (lint → test-frontend → test-php 8.1/8.2/8.3), `release.yml` (auto SemVer + ZIP + GitHub Release), `svn-deploy.yml` (WordPress.org deploy), `e2e.yml` (Playwright). `scripts/compute-version.sh` for conventional commit version calculation. Legacy CircleCI removed.
  - **P20-H** (12/12): Security hardening sprint — parseProps whitelist, DNS rebinding SSRF fix, nonce bypass hardened, Sentry PII scrubbing, CSP headers, ErrorBoundary→Sentry, apiClient timeout+AbortController, status/visibility whitelist, encodeURIComponent, console.info DEV guard, overlay file deletion, password reset URL fix.
  - **P20-I**: Performance — layout template CPT migration, `wpsg_media_refs` reverse-index table, cache version counter, lazy LayoutBuilderModal (504→327 KB), async email queue, shared React root (feature-flagged).
  - **P20-J**: Plugin directory preparation — `readme.txt`, composer dev deps separated, custom capability type (`wpsg_campaign`), i18n `load_plugin_textdomain()` + `__()` wrapping.
  - **P20-K**: JWT nonce-only default — JWT gated behind `WPSG_ENABLE_JWT_AUTH`, `useNonceHeartbeat` hook, cookie-based auth endpoints.
  - **P20-L**: SVG dual-layer sanitization — `enshrined/svg-sanitize`, custom CSS/URI validators, `.htaccess` CSP for overlay dir.
  - **PHPUnit coverage**: 461 tests, 1104 assertions, ~92% method coverage (172/186 methods).
  - **Layout Builder QA**: Rounds 3–7 — advanced gradient controls, mask sub-layer system, image effects (5 categories), per-slot glow, background properties panel, design assets drag-and-drop, canvas drop-to-create.

### v0.17.0 (March 2, 2026)
- **MINOR**: Phase 19 — Builder Coverage, WP-CLI & Toolchain
  - **P19-QA**: 102 new JS tests for 9 Phase 18 components + 2 hooks; functions threshold 60%→65%; ~991 JS tests total.
  - **P19-D**: Pre-commit toolchain — Husky, lint-staged, commitlint; `CONTRIBUTING.md`.
  - **P19-A**: Builder keyboard shortcuts — `Ctrl+S`, `?` help modal, `V`, zoom shortcuts; `BuilderKeyboardShortcutsModal`; 25 tests.
  - **P19-B**: Builder undo/redo improvements — `HistoryEntry` type, 35 labeled `mutate()` call sites, `BuilderHistoryPanel` dockview tab with click-to-jump; 23 tests.
  - **P19-C**: WP-CLI — `wp wpsg campaign list/archive/restore/duplicate/export/import`, `wp wpsg media list/orphans`, `wp wpsg cache clear`, `wp wpsg analytics clear`, `wp wpsg rate-limit reset`; 27 PHPUnit scenarios.
  - **P19-E (fix)**: `SettingsPanel.test.tsx` race condition fixed — `findByRole` load gate, label-targeted switch helpers, `clickTabAndWait` helper.

### v0.16.0 (March 1, 2026)
- **MINOR**: Phase 18 — Admin Power Features, Coverage & Canvas Polish
  - **P18-QA JS**: 841 tests; functions threshold lifted 41%→66.5%; all Vitest thresholds green.
  - **P18-QA PHP**: 117 tests / 303 assertions; `WPSG_Rate_Limiter_Test`, `WPSG_Embed_Test`, Campaign REST edge cases.
  - **P18-A**: Zoomable canvas — `react-zoom-pan-pinch`, `CanvasTransformContext`, hand tool, zoom % indicator, Rnd scale fix.
  - **P18-B**: Bulk actions — `POST /campaigns/batch`, `BulkActionsBar`, select-mode toggle.
  - **P18-C**: Campaign duplication — `POST /campaigns/{id}/duplicate`, `CampaignDuplicateModal`.
  - **P18-D**: Export/Import JSON — `GET /campaigns/{id}/export`, `POST /campaigns/import`, `CampaignImportModal`.
  - **P18-E**: Keyboard shortcuts — `KeyboardShortcutsModal`, `useHotkeys` bindings (`?`, `mod+n`, `mod+i`, `mod+shift+a`).
  - **P18-F**: Analytics dashboard — `wpsg_analytics_events` table, rate-limited beacon, recharts lazy `AnalyticsDashboard`.
  - **P18-G**: Media usage tracking — usage badge popover, orphan filter, delete guard.
  - **P18-H**: Campaign categories — `wpsg_campaign_category` taxonomy, `TagsInput`, `Chip.Group` filter pills.
  - **P18-I**: Access request workflow — per-token WP options storage with index (no custom DB table); `POST/GET /campaigns/{id}/access-requests`; approve/deny action endpoints; `RequestAccessForm`, `PendingRequestsPanel`, approval email.
  - **P18-X**: Code size reduction — `App.tsx` 808→346 lines; `AdminPanel.tsx` 1168→390 lines; 8 new hooks.

### v0.15.0 (February 26, 2026)
- **MINOR**: Phase 17 — Builder UX: Design Assets Consolidation & Dockable Panels
  - **P17-F**: Type rename — `overlay` → `graphicLayer` throughout codebase (~15 files).
  - **P17-B**: `AssetUploader` sub-component extracted from `LayoutBuilderModal`.
  - **P17-C**: Media slot drop guard — prevents non-image drops on image-typed slots.
  - **P17-D**: `GraphicLayerPropertiesPanel` — position, size, opacity, blend mode, z-index.
  - **P17-A**: Design assets consolidation — unified left panel tabbing in `LayoutBuilderModal`.
  - **P17-E**: True dockable panels via `dockview` (~38 KB gzip); `vendor-dockview` chunk split.

### v0.14.0 (February 25, 2026)
- **MINOR**: Phase 16 — Layer System
  - **P16-A**: Unified Layer Panel — `buildLayerList()`, `getLayerName()`, `LayerPanel`, `LayerRow` components.
  - **P16-B**: State actions — 7 new `useLayoutBuilderState` actions (lock/unlock/show/hide/reorder).
  - **P16-C**: Canvas locked support — `LayoutCanvas` and `LayoutSlotComponent` respect locked flag.
  - **P16-D**: Modal restructure for layer panel integration; 25 new tests; 564 tests total.

### v0.13.0 (February 26, 2026)
- **MINOR**: Phase 15 — Layout Builder (all 6 sprints + QA Sprint)
  - **P15-A**: Per-breakpoint gallery selection — 6-way adapter config (desktop/tablet/mobile × image/video), `useBreakpoint` container-width hook.
  - **P15-B**: Layout template data model — `LayoutTemplate`, `LayoutSlot`, `LayoutOverlay`, `CampaignLayoutBinding` interfaces; `assignMediaToSlots()` utility; PHP REST CRUD.
  - **P15-C**: Canvas builder UI — full-screen modal, canvas workspace (react-rnd), slot component (clip-path shapes, focal point, border), properties panel, media picker sidebar, `useLayoutBuilderState` with undo/redo autosave.
  - **P15-D**: Smart guides & snapping — SVG overlay, `computeGuides()` pure function, configurable snap threshold.
  - **P15-E**: Finalized gallery adapter — `LayoutBuilderGallery` with pixel-accurate slot rendering, double-container clip-path border technique, overlay layers, blob-URL guard.
  - **P15-F**: Template library — `LayoutTemplateList` CRUD, campaign layout selector, JSON import/export with schema validation.
  - **P15-G (stretch)**: Z-index layer control — bringToFront/sendToBack/bringForward/sendBackward, keyboard shortcuts, normalize on save.
  - **P15-H (stretch)**: Overlay transparencies — CRUD with file upload/URL, opacity slider, click-through toggle, gallery rendering.
  - **P15-I (stretch)**: Mixed shapes — 8 shapes (circle, ellipse, hexagon, diamond, custom, mask URL); shape preview icons.
  - **P15-J (stretch)**: Premade layout presets — 12 templates, `PresetGalleryModal` with mini-canvas previews.
  - **P15-K (stretch)**: Diagonal shapes — 5 polygon shapes (parallelogram-left/right, chevron, arrow, trapezoid); `getClipPath()` shared utility.
  - **QA Sprint**: 5 new layout builder test files + gallery coverage additions; 539 tests total (up from 319); layout builder ~75% statement coverage, 75%+ branch coverage.

### v0.12.0 (February 22, 2026)
- **MINOR**: Phase 14 — Infrastructure Hardening, Advanced Settings & Backend Utilities
  - **P14-A**: Security hardening — 4 Critical + 6 High findings fixed (dead code removal, POST_TYPE constant, stale closure fix, oEmbed response leak, status/visibility allowlist, CORS headers, WP_DEBUG gate, URI sanitization, DDL identifier validation).
  - **P14-B**: Settings DRY refactor — `to_js()`/`from_js()` auto snake↔camel conversion, generic fallback sanitizer, `mergeSettingsWithDefaults()` React utility. Deleted 586 lines PHP + 240 lines React of triplicated mapping. ~70 new advanced settings behind `advancedSettingsEnabled` toggle.
  - **P14-C**: External thumbnail cache — `WPSG_Thumbnail_Cache` with download/cache/cleanup/refresh, daily cron, REST endpoints.
  - **P14-D**: oEmbed monitoring & rate limiting — per-IP transient limiter, per-provider failure tracking, `get_health_data()` aggregation, REST health endpoint.
  - **P14-F**: Image optimization — auto-resize/compress on upload with optional WebP conversion via GD library.
  - **P14-G**: Media & campaign tagging — `wpsg_campaign_tag` and `wpsg_media_tag` taxonomies with REST endpoints.
  - Advanced Settings UI tab in SettingsPanel with 8 Accordion sections (Card, Text, Modal, Upload/Media, Tile/Adapter, Lightbox, Navigation, System).

### v0.11.0 (February 22, 2026)
- **MINOR**: Phase 13 — UX Polish, Performance & Campaign Scheduling
  - **P13-A**: CampaignViewer converted from fullscreen modal to centered animated modal; 13 card/grid/modal settings added full-stack (border radius, width, mode, color, shadow, thumbnail height/fit, columns, gap, cover height, transition, duration, max height); border color 3-mode system (auto/single/individual) with per-card ColorInput.
  - **P13-F**: Card gallery pagination with 3 display modes (show-all/load-more/paginated), rows-per-page setting, OverlayArrows + DotNavigator, GPU-accelerated slide transition, keyboard navigation, responsive recalculation.
  - **P13-E**: Mobile readiness audit — 17 issues fixed (44px touch targets, dvh units, responsive modals, safe-area-insets); post-audit fixes for filter overflow, AuthBar mobile redesign, header toggles, appPadding/appMaxWidth/wpFullBleed responsive breakpoints.
  - **P13-C**: SWR migration for all admin data fetching (campaigns, media, access, audit), skeleton loading states, background prefetch on tab open, ~130 lines of manual state/effects removed.
  - **P13-B**: LazyImage progressive rendering (skeleton → fade-in → error fallback) in all 6 tile gallery adapters.
  - **P13-D**: Campaign scheduling full-stack — `publishAt`/`unpublishAt` ISO 8601 dates, server-side meta_query filtering for non-admin users, admin datetime-local form inputs, schedule badges (Scheduled/Expired/Expiring soon), hourly WP-Cron auto-archive.
  - Settings panel reorganized from 5 tabs to 3 with Accordion sections.
  - Added `@mantine/dates` and `dayjs` dependencies.

### v0.10.0 (February 19, 2026)
- **MINOR**: Phase 12 close-out and gallery extensibility hardening release
  - Phase 12 tracks finalized with full gallery adapter expansion and documentation close-out.
  - Added/productionized adapter set: `justified` (with `mosaic` legacy alias), `masonry`, `hexagonal`, `circular`, and `diamond`.
  - Added tile appearance controls (size, X/Y spacing, border width/color, hover bounce, glow, masonry columns) across frontend + REST + WP settings sanitization.
  - Added viewport background controls for image/video/unified galleries (`none`, `solid`, `gradient`, `image`) end-to-end.
  - Removed dead legacy `MosaicGallery` file after justified migration.

### v0.9.0 (February 16, 2026)
- **MINOR**: Phase 11 UX & Discovery Improvements release
  - Track A complete: compact sign-in UX, video transparency + fixed-height consistency, campaign thumbnail auto-selection + admin override/upload, and offline/reconnect UX resilience.
  - Track B high-impact delivery: N+1 media fetch eliminated via `include_media=1` bulk campaign payload and dnd-kit-based media drag-and-drop reordering.
  - Admin media UX polish: type/source badges in list/card views, external video cards switched to cached thumbnails to prevent iframe reload churn during reorder, and list-mode pagination/windowing for large media sets.
  - Campaign edit robustness: cover-image clear/reset is persisted end-to-end and included in unsaved-change dirty guard tracking.
  - Backend consistency: campaigns `mediaByCampaign` now shares media-type normalization with media list handling.

### v0.8.0 (February 16, 2026)
- **MINOR**: Phase 10 Codebase Refinement & UX Polish release
  - Component decomposition and DRY consolidation across app/admin surfaces.
  - Extracted reusable primitives: `useXhrUpload`, `useDirtyGuard`, `useSwipe`, `ConfirmModal`, `CampaignSelector`, and shared utility helpers.
  - Completed UX track improvements (loading states, unauthenticated empty state, search, pagination/load-more, swipe navigation, keyboard hints, dirty form guards, sticky auth bar, semantic card interactions).
  - Cleanup/housekeeping track complete (deprecated media API removal, stylesheet cleanup, icon consolidation, global typing cleanup, debug removal, oEmbed sanitization, async modal correctness).
  - Architecture track partial completion: E3 finished (removed production `any` in media/oEmbed flow), E1/E2 deferred.
  - Test baseline strengthened and coverage targets enforced at practical thresholds.

### v0.7.0 (February 5, 2026)
- **MINOR**: Phase 9 Theme System release
  - Full runtime theme switching with 14 bundled themes (O(1) map-lookup, <16ms switch)
  - Theme infrastructure: JSON definitions → chroma.js color generation → pre-computed MantineThemeOverride objects
  - Hierarchical base/extension theme architecture with strict TypeScript validation
  - Shadow DOM compatible via Mantine's native cssVariablesSelector + getRootElement
  - CSS variable bridge (`--wpsg-*`) for SCSS module compatibility
  - Migrated ~45 hardcoded color values across 11 component/SCSS files to theme system
  - WordPress admin: theme selector dropdown (grouped by category) + user override toggle
  - ThemeSelector component with live color-swatch previews
  - 71 unit tests across 5 theme modules (colorGen, validation, adapter, cssVariables, registry)
  - Theme authoring guide and comprehensive QA guide documentation

### v0.6.0 (February 4, 2026)
- **MINOR**: Phase 8 Performance & Production Optimization release
  - Performance: code splitting for heavy components, virtualized media lists, bundle size optimization, and service worker caching.
  - Caching: transients + SWR, ETags for media, oEmbed TTL caching, and static asset cache headers.
  - Monitoring: Web Vitals, Sentry (client + server alerts), REST timing metrics, and alerting via admin email.
  - Database: indexes, pagination, optimized access grants, slow REST profiling, and archive retention strategy.
  - Security: rate limiting, REST nonce verification, CORS hardening, CSP/security headers, and upload validation.

### v0.4.0 (February 2, 2026)
- **MINOR**: Phase 6 Functionality Polish release
  - Searchable user picker, "Current Access" table with company/campaign badges, and a secure Quick Add User experience that surfaces password reset links + email-failure test mode.
  - Media workflow refinements (metadata edit, consistent thumbnails, keyboard lightbox, explicit ordering) and consolidated API client usage.
  - Performance/resilience upgrades: lazy load admin panels inside `Suspense`/`ErrorBoundary`, combobox timeout cleanup, abortable library media requests, and manual chunk splitting.
  - Security/observability: WordPress password reset flow (no plaintext passwords) and comprehensive IPv4/IPv6 private range detection.

### v0.5.0 (February 3, 2026)
- **MINOR**: Phase 7 Visual Polish + Accessibility + Mobile Optimization release
  - Full WCAG 2.1 Level AA accessibility compliance with screen reader support, keyboard navigation, and color contrast
  - Comprehensive mobile optimization including 44px touch targets, responsive tables, and mobile-first design
  - PHP unit tests implementation with wp-env for isolated testing
  - Professional UI polish with Framer Motion animations and Mantine component refinements
  - Production deployment and release preparation

### v0.3.0 (January 30, 2026)
- **MINOR**: Phase 4 Mantine Migration + Phase 5 WordPress Integration
  - **Mantine Migration (Phase 4):**
    - Migrated all 7 main UI components to Mantine 7.17.8
    - Custom dark theme with design token integration
    - framer-motion animations with reduce-motion support
    - 68 tests passing with 93.65% coverage
  - **WordPress Integration (Phase 5):**
    - WordPress Settings API integration (`class-wpsg-settings.php`)
    - REST endpoints for settings (GET/POST `/settings`)
    - In-app SettingsPanel with display settings
    - Comprehensive QA documentation (`TESTING_QA.md`)
    - Packaging & release guide (`PACKAGING_RELEASE.md`)
    - Embed sandbox, caching guide, auth edge cases documented
    - Plugin upgrade path with migration considerations

### v0.2.0 (January 28, 2026)
- **MINOR**: Complete admin panel implementation
  - Campaign CRUD operations
  - Media management (upload/external embeds)
  - User access management
  - Audit trail functionality
- Manual QA testing completed and passed

### v0.1.0 (Initial Release)
- **MINOR**: Core functionality
  - Basic gallery embedding
  - WordPress integration
  - Authentication system
  - Campaign viewing

## Release Process

### Pre-Release Checklist
- [ ] All unit tests passing (target: >80% coverage)
- [ ] E2E tests passing
- [ ] Manual QA completed in WordPress environment
- [ ] Documentation updated
- [ ] Security review completed

### Version Bump Process

Version bumps are handled automatically by the **GitHub Actions release workflow** (`release.yml`):

1. Trigger via GitHub Actions → "Release" → "Run workflow"
2. Version is **auto-computed** from conventional commits since the last tag:
   - `feat:` → MINOR bump
   - `fix:`, `refactor:`, `perf:`, etc. → PATCH bump
   - `BREAKING CHANGE` or `!:` → MINOR bump (pre-1.0); MAJOR bump (post-1.0)
3. Override: enter a specific version (e.g., `1.0.0`) to bypass auto-computation
4. The workflow updates version in all 3 locations:
   - `package.json` (`version` field)
   - `wp-plugin/wp-super-gallery/wp-super-gallery.php` (plugin header `Version:`)
   - `wp-plugin/wp-super-gallery/wp-super-gallery.php` (`WPSG_VERSION` constant)
5. Creates a git tag (`v{version}`) and GitHub Release with a production ZIP
6. Optionally deploys to WordPress.org SVN (checkbox in workflow UI)

**Manual version bump** (if needed):
1. Update version in `package.json`
2. Update version in `wp-plugin/wp-super-gallery/wp-super-gallery.php` (header + constant)
3. Update `VERSIONING.md` with release notes
4. Create git tag: `git tag v{version}`
5. Push tag: `git push origin v{version}`

The auto-compute logic lives in `scripts/compute-version.sh`.

### Deployment Packaging
- Production ZIP built by `release.yml` workflow (excludes tests, dev files, docs)
- WordPress.org SVN deployment via `svn-deploy.yml` (reuses release ZIP artifact)
- Manual packaging: `npm run build:wp` + composer install --no-dev + zip

## Development Phases

Current development follows a phased approach:

- **Phase 1-3**: ✅ Complete (Core functionality + Admin Panel)
- **Phase 4**: ✅ Complete (Main UI Mantine Migration)
- **Phase 5**: ✅ Complete (WordPress Integration)
- **Phase 6**: ✅ Complete (Functionality Polish — v0.4.0 release)
- **Phase 7**: ✅ Complete (Visual Polish + Testing + Accessibility + Mobile Optimization — v0.5.0 release)
- **Phase 8**: ✅ Complete (Performance & Production Optimization — v0.6.0 release)
- **Phase 9**: ✅ Complete (Theme System — v0.7.0 release)
- **Phase 10**: ✅ Complete (Codebase Refinement & UX Polish — v0.8.0 release)
- **Phase 11**: ✅ Complete (UX & Discovery Improvements — v0.9.0 release)
- **Phase 12**: ✅ Complete (Gallery Extensibility & Advanced Experience — v0.10.0 close-out)
- **Phase 13**: ✅ Complete (UX Polish, Performance & Campaign Scheduling — v0.11.0 release)
- **Phase 14**: ✅ Complete (Infrastructure Hardening — v0.12.0 release)
- **Phase 15**: ✅ Complete (Layout Builder — v0.13.0 release)
- **Phase 16**: ✅ Complete (Layer System — v0.14.0 release)
- **Phase 17**: ✅ Complete (Builder UX — v0.15.0 release)
- **Phase 18**: ✅ Complete (Admin Power Features, Coverage & Canvas Polish — v0.16.0 release)
- **Phase 19**: ✅ Complete (Builder Coverage, WP-CLI & Toolchain — v0.17.0 release)
- **Phase 20**: ✅ Complete (Production Hardening, CI/CD Pipeline & Distribution Readiness — v0.18.0 release)
- **Phase 21**: ✅ Complete (UX Overhaul: Bugs, Campaign Cards, Viewer, Typography & In-Context Settings — v0.19.0 release)

## Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `hotfix/*`: Critical bug fixes

---

*Document created: January 28, 2026*
