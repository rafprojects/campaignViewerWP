# Changelog

All notable changes to WP Super Gallery will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

See [PHASE13_REPORT.md](./docs/PHASE13_REPORT.md) for Phase 13 execution details.

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
