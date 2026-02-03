# Versioning Scheme

This document outlines the versioning strategy for WP Super Gallery.

## Version Format

We use **Semantic Versioning 2.0.0** with the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, major architectural changes, or significant feature additions that may require migration
- **MINOR**: New features, enhancements, or significant improvements that are backward compatible
- **PATCH**: Bug fixes, security patches, small improvements, and documentation updates

## Version History

### v0.4.0 (February 2, 2026)
- **MINOR**: Phase 6 Functionality Polish release
  - Searchable user picker, "Current Access" table with company/campaign badges, and a secure Quick Add User experience that surfaces password reset links + email-failure test mode.
  - Media workflow refinements (metadata edit, consistent thumbnails, keyboard lightbox, explicit ordering) and consolidated API client usage.
  - Performance/resilience upgrades: lazy load admin panels inside `Suspense`/`ErrorBoundary`, combobox timeout cleanup, abortable library media requests, and manual chunk splitting.
  - Security/observability: WordPress password reset flow (no plaintext passwords) and comprehensive IPv4/IPv6 private range detection.

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
- **Phase 7**: Ready to start (Visual Polish + Testing)
- **Phase 8**: Pending (Theme System)

## Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `hotfix/*`: Critical bug fixes

---

*Document created: January 28, 2026*
