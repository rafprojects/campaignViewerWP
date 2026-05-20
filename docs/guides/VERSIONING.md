# Versioning Scheme

This document outlines the versioning strategy for WP Super Gallery.

## Version Format

We use **Semantic Versioning 2.0.0** with the format: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes, major architectural changes, or significant feature additions that may require migration
- **MINOR**: New features, enhancements, or significant improvements that are backward compatible
- **PATCH**: Bug fixes, security patches, small improvements, and documentation updates

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
3. Update `docs/VERSION_HISTORY.md` with release notes
4. Update `CHANGELOG.md` with a new `[{version}]` section following Keep a Changelog format
5. Update version in `wp-plugin/wp-super-gallery/readme.txt` (`Stable tag`)
6. Commit all version-bump changes
7. Create git tag: `git tag v{version}`
8. Push tag: `git push origin v{version}`


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
