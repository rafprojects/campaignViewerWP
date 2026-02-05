# Versioning Scheme

This document outlines the versioning strategy for WP Super Gallery.

## Version Format

We use **Semantic Versioning 2.0.0** with the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, major architectural changes, or significant feature additions that may require migration
- **MINOR**: New features, enhancements, or significant improvements that are backward compatible
- **PATCH**: Bug fixes, security patches, small improvements, and documentation updates

## Version History

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
1. Update version in `package.json`
2. Update version in `wp-plugin/wp-super-gallery/wp-super-gallery.php`
3. Update version constant `WPSG_VERSION`
4. Update `VERSIONING.md` with release notes
5. Create git tag: `git tag v{version}`
6. Push tag: `git push origin v{version}`

### Deployment Packaging (Phase 7)
- Plugin ZIP generation
- WordPress.org submission preparation
- Release notes documentation
- Migration guides (for breaking changes)

## Development Phases

Current development follows a phased approach:

- **Phase 1-3**: ✅ Complete (Core functionality + Admin Panel)
- **Phase 4**: ✅ Complete (Main UI Mantine Migration)
- **Phase 5**: ✅ Complete (WordPress Integration)
- **Phase 6**: ✅ Complete (Functionality Polish — v0.4.0 release)
- **Phase 7**: ✅ Complete (Visual Polish + Testing + Accessibility + Mobile Optimization — v0.5.0 release)
- **Phase 8**: ✅ Complete (Performance & Production Optimization — v0.6.0 release)
- **Phase 9**: Ready to start (Theme System)

## Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `hotfix/*`: Critical bug fixes

---

*Document created: January 28, 2026*
