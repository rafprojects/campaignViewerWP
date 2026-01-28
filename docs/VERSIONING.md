# Versioning Scheme

This document outlines the versioning strategy for WP Super Gallery.

## Version Format

We use **Semantic Versioning 2.0.0** with the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, major architectural changes, or significant feature additions that may require migration
- **MINOR**: New features, enhancements, or significant improvements that are backward compatible
- **PATCH**: Bug fixes, security patches, small improvements, and documentation updates

## Version History

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
- **Phase 4-6**: In Progress (UI migration, integration, polish)
- **Phase 7**: Deployment & Release

## Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature branches
- `hotfix/*`: Critical bug fixes

---

*Document created: January 28, 2026*
