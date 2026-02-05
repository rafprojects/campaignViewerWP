# Changelog

All notable changes to WP Super Gallery will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

See [PHASE9_REPORT.md](./docs/PHASE9_REPORT.md) for planned features:
- Theme system and customization

---

[0.5.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.4.0...v0.5.0
[0.6.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.5.0...v0.6.0
[0.4.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yourorg/wp-super-gallery/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yourorg/wp-super-gallery/releases/tag/v0.1.0
