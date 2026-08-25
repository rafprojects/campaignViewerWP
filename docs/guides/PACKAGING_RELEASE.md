# Packaging & Release Guide

This document provides a comprehensive guide for building, packaging, and releasing Mullion for production deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Build Process](#build-process)
   - [3a. Choosing an Edition: Premium vs. Free ("Lite")](#3a-choosing-an-edition-premium-vs-free-lite)
3. [Plugin Structure](#plugin-structure)
4. [Packaging for Distribution](#packaging-for-distribution)
5. [Deployment Steps](#deployment-steps)
6. [Release Checklist](#release-checklist)
7. [Version Management](#version-management)
8. [Rollback Procedures](#rollback-procedures)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before building or releasing, ensure you have:

- **Node.js** 18+ and npm 9+
- **PHP** 8.0+ (for plugin syntax validation)
- **Git** for version control
- Access to the WordPress installation for deployment
- (Optional) **Composer** for PHP dependencies in the plugin

### Verify Prerequisites

```bash
node --version    # Should be 18+
npm --version     # Should be 9+
php --version     # Should be 8.0+
git --version     # Any recent version
```

---

## Build Process

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Tests

Always run tests before building for production:

```bash
npm test -- --run
```

Ensure all tests pass before proceeding.

### 3. Build for Production

The production build compiles the React SPA and prepares assets for WordPress:

```bash
npm run build
```

This creates optimized assets in the `dist/` directory:
- Minified JavaScript bundle
- Minified CSS
- Asset manifest (Vite writes `.vite/manifest.json`; PHP also accepts `assets/manifest.json`)

`npm run build` is the **premium** default (`MULLION_PREMIUM` unset). For the WordPress.org lite edition, see [3a](#3a-choosing-an-edition-premium-vs-free-lite) before you copy assets or zip anything.

### 3a. Choosing an Edition: Premium vs. Free ("Lite")

This product ships **two** front-end bundles from one codebase. PHP is identical in both ZIPs (server code is license *enforcement*, not premium *feature* code). The JavaScript is not.

`vite.config.ts` defines `__MULLION_PREMIUM__` from `process.env.MULLION_PREMIUM !== 'false'`. Unset or any value other than the string `false` keeps Pro authoring in the bundle (premium). `MULLION_PREMIUM=false` makes the flag a literal `false`, so Rollup dead-code-eliminates those branches — including the dynamic `import()`s they guard — and the Pro chunks never enter the free bundle.

`scripts/copy-wp-assets.js` uses that **same** env check and writes `wp-plugin/mullion-gallery/assets/mullion-edition.json` (`{ "premium": true|false }`) so PHP/`mullion_fs()` can self-identify the ZIP to Freemius (P75-A). Do not hand-copy `dist/` without that marker; a missing marker is treated as premium.

| Script | `package.json` | What it produces |
| ------ | -------------- | ---------------- |
| `npm run build` | `tsc -b && vite build` | Premium `dist/` (default). |
| `npm run build:wp` | `npm run i18n:generate && npm run build && node scripts/copy-wp-assets.js` | Premium plugin tree, marker `"premium": true`. |
| `npm run build:free` | `MULLION_PREMIUM=false npm run build` | Lite `dist/` only (no copy, no marker). |
| `npm run build:wp:free` | `MULLION_PREMIUM=false npm run build:wp` | Lite plugin tree, marker `"premium": false`. |
| `npm run check:free-build` | `MULLION_PREMIUM=false npm run build && node scripts/check-free-build-clean.mjs` | Rebuilds lite `dist/` and fails if any Pro chunk/marker leaked. CI runs this on every PR. |

Both `build:wp` and `build:wp:free` write the **same** `wp-plugin/mullion-gallery/assets/` directory — the two editions cannot coexist there. Rebuild to switch. If you need both ZIPs, zip the premium tree **before** running `build:wp:free` (that is the Release workflow's ordering constraint).

WordPress.org [guideline 5](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/#5-trialware-is-not-permitted) forbids locked/premium code in the directory. [Freemius does not SVN-publish](https://freemius.com/help/documentation/wordpress/deployment-process/) for you. The lite ZIP is what `SVN Deploy` publishes; the premium ZIP is Freemius-only.

Full rationale: [PRO_FEATURES.md §7](PRO_FEATURES.md#7-free-vs-premium-build-split--the-wporg-lite-build-p62-f-decision). Deploy-testing the three states (lite / premium unlicensed / premium licensed): [PRO_FEATURES.md §8](PRO_FEATURES.md#8-building--deploy-testing-the-free-vs-premium-editions).

### 4. Copy Assets to Plugin

Prefer the npm scripts above over a raw `cp`. They run i18n generation, the Vite build, the copy, and the edition marker together:

```bash
npm run build:wp        # premium (default)
npm run build:wp:free   # lite
```

A manual `cp -r dist/* wp-plugin/mullion-gallery/assets/` skips `mullion-edition.json` and will self-report as premium.

### 5. Verify the Build

`copy-wp-assets.js` copies all of `dist/` into the plugin assets directory, so hashed chunks are one level down. A complete tree looks like:

```
wp-plugin/mullion-gallery/assets/
├── assets/                     # Vite hashed JS/CSS (copy of dist/assets/)
│   ├── index-[hash].js
│   └── …
├── index.html
├── sw.js
├── .vite/manifest.json         # PHP also accepts assets/manifest.json
└── mullion-edition.json        # { "premium": true } or { "premium": false }
```

For a lite tree, also run a static scan (no extra rebuild if you just ran `build:wp:free`):

```bash
node scripts/check-free-build-clean.mjs wp-plugin/mullion-gallery/assets
```

The script walks `.js` files recursively (chunks live in `assets/assets/`). With no argument it scans `./dist/assets` — that is what `npm run check:free-build` uses after it rebuilds.

---

## Plugin Structure

The plugin folder as it exists in the repo (not everything here ships — see [Packaging for Distribution](#packaging-for-distribution)):

```
mullion-gallery/
├── assets/                        # Built SPA (from dist/) + mullion-edition.json
│   ├── assets/                    # hashed JS/CSS chunks
│   ├── index.html
│   ├── sw.js
│   └── mullion-edition.json
├── includes/
│   ├── class-mullion-cpt.php
│   ├── class-mullion-embed.php
│   ├── class-mullion-rest.php
│   ├── class-mullion-settings.php
│   └── class-mullion-oembed-providers.php
├── languages/                     # ships
├── vendor/                        # production Composer deps, including Freemius SDK; ships
├── tests/                         # exclude
├── composer.json / composer.lock  # exclude (deps are vendored)
├── phpunit.xml.dist / phpcs.xml   # exclude
├── readme.txt                     # ships
└── mullion-gallery.php
```

---

## Packaging for Distribution

There are **two** distribution ZIPs. The slug inside both is `mullion-gallery/` — only the **filename** carries `-lite-` (Phase 74 Decision C). PHP is the same; `assets/` and `mullion-edition.json` differ.

| Edition | Build first | ZIP name | Who receives it |
| ------- | ----------- | -------- | --------------- |
| Premium | `npm run build:wp` | `mullion-gallery-v${VERSION}.zip` | GitHub Release; Freemius (later). **Not** WordPress.org. |
| Lite | `npm run build:wp:free` | `mullion-gallery-lite-v${VERSION}.zip` | GitHub Release **and** WordPress.org SVN. |

The automated Release workflow produces both in one run: it zips premium, then rebuilds lite (overwriting `assets/`), scans, zips lite, and attaches both files to the GitHub Release. `SVN Deploy` downloads the **lite** ZIP and re-scans the extracted tree before pushing.

If you package by hand, zip premium **before** running `build:wp:free`. After the free rebuild, confirm the marker and scan:

```bash
# After npm run build:wp:free
node -p "require('./wp-plugin/mullion-gallery/assets/mullion-edition.json').premium"
# must print: false

node scripts/check-free-build-clean.mjs wp-plugin/mullion-gallery/assets
```

### Create a Distribution ZIP

No packaging npm script exists (do not look for one). Copy the exclude list from `.github/workflows/release.yml` (keep it in sync with `wp-plugin/mullion-gallery/.distignore`):

```bash
# From repository root, after the matching build:wp or build:wp:free
VERSION=$(node -p "require('./package.json').version")
# Premium:  ZIP_NAME="mullion-gallery-v${VERSION}.zip"
# Lite:     ZIP_NAME="mullion-gallery-lite-v${VERSION}.zip"

cd wp-plugin
zip -r "../${ZIP_NAME}" mullion-gallery \
  -x "mullion-gallery/tests/*" \
  -x "mullion-gallery/phpunit/*" \
  -x "mullion-gallery/phpunit.xml.dist" \
  -x "mullion-gallery/phpcs.xml" \
  -x "mullion-gallery/.phpunit.result.cache" \
  -x "mullion-gallery/composer.json" \
  -x "mullion-gallery/composer.lock" \
  -x "mullion-gallery/.wp-env.json" \
  -x "mullion-gallery/bin/*"
cd ..
```

### Exclude from Distribution

Canonical list: [`wp-plugin/mullion-gallery/.distignore`](../../wp-plugin/mullion-gallery/.distignore). The 10up WordPress.org deploy action honors it. The GitHub Release `zip -x` list above is the same set of development files **except** one known drift: `.distignore` also excludes the root `phpunit` binary; `zip -x` only excludes `phpunit/*`, so current GitHub ZIPs still contain `mullion-gallery/phpunit`. Do not invent extra excludes in a one-off zip unless you intend to diverge from the Release artifact.

Do **not** ship:

- `tests/`, `bin/`, `phpunit.xml.dist`, `phpcs.xml`, `.phpunit.result.cache`
- `composer.json` and `composer.lock` (production deps are already in `vendor/`)
- `.wp-env.json`, `.distignore` (SVN path)

### Include in Distribution

These files MUST be in both ZIPs:

- `mullion-gallery.php`
- `includes/` (all PHP classes)
- `assets/` including `mullion-edition.json` and the nested hashed chunks
- `vendor/` (production Composer deps, including the Freemius SDK)
- `languages/`
- `readme.txt`

---

## Deployment Steps

### Method 1: Direct Copy (Local/Staging)

For local WordPress or staging environments:

```bash
# Remove old plugin files
rm -rf /path/to/wordpress/wp-content/plugins/mullion-gallery

# Copy new plugin files
cp -r wp-plugin/mullion-gallery /path/to/wordpress/wp-content/plugins/

# Verify permissions (Linux/Mac)
chmod -R 755 /path/to/wordpress/wp-content/plugins/mullion-gallery
```

### Method 2: ZIP Upload (WordPress Admin)

1. Create the distribution ZIP for the edition you mean (premium vs lite — see above). Uploading the premium ZIP to a site is correct for a Freemius customer install. Uploading the premium ZIP to WordPress.org is a guideline 5 violation; that channel is lite-only.
2. Go to **WP Admin → Plugins → Add New → Upload Plugin**.
3. Upload the ZIP file.
4. Click **Install Now**, then **Activate**.

### Method 3: FTP/SFTP (Production)

1. Create the distribution ZIP and extract locally.
2. Connect via FTP/SFTP to your production server.
3. Navigate to `wp-content/plugins/`.
4. Upload the `mullion-gallery/` folder.
5. Deactivate/Reactivate the plugin if it was already active.

### Method 4: Git-based Deployment

For CI/CD pipelines:

```bash
# Example: deploy from CI
git clone --depth 1 <repo-url>
cd mullion-gallery
npm ci
# Premium working tree (default). For a WP.org-like lite install use:
#   npm run build:wp:free
#   node scripts/check-free-build-clean.mjs wp-plugin/mullion-gallery/assets
npm run build:wp
rsync -avz --delete wp-plugin/mullion-gallery/ user@server:/path/to/wp-content/plugins/mullion-gallery/
```

---

## Release Checklist

The **preferred method** is the automated GitHub Actions **Release** workflow:

1. Go to **Actions → Release → Run workflow**
2. Enter version (or leave `auto` to compute from conventional commits)
3. Optionally check **Deploy to WordPress.org SVN** — that path publishes the **lite** working tree (assets already overwritten by `build:wp:free`). Prefer the dedicated **SVN Deploy** workflow, which downloads `mullion-gallery-lite-v*.zip` from the GitHub Release (exact released bytes) and re-scans it before SVN.
4. The workflow handles: version bump, tests, premium build, premium ZIP, lite rebuild, Pro-code scan, lite ZIP, tag, GitHub Release with **both** ZIPs attached (`mullion-gallery-v*.zip` and `mullion-gallery-lite-v*.zip`)

For manual releases, use this checklist:

### Pre-Release

- [ ] All tests pass (`npm test -- --run`)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] PHP syntax is valid (`php -l wp-plugin/mullion-gallery/mullion-gallery.php`)
- [ ] Version number updated in:
  - [ ] `mullion-gallery.php` (Plugin header)
  - [ ] `mullion-gallery.php` (`MULLION_VERSION` constant)
  - [ ] `wp-plugin/mullion-gallery/readme.txt` (`Stable tag`)
  - [ ] `package.json` (npm version)
  - [ ] `package-lock.json` (lockfile root version)
- [ ] CHANGELOG updated with release notes
- [ ] `docs/guides/VERSIONING.md` updated with the release summary
- [ ] Manual QA completed (see TESTING_QA.md)

### Build

- [ ] Clean install dependencies (`rm -rf node_modules && npm ci`)
- [ ] Choose an edition ([3a](#3a-choosing-an-edition-premium-vs-free-lite)):
  - [ ] Premium: `npm run build:wp` → `mullion-edition.json` has `"premium": true`
  - [ ] Lite: `npm run build:wp:free` → `"premium": false`, then `node scripts/check-free-build-clean.mjs wp-plugin/mullion-gallery/assets`
- [ ] Build artifacts verified in `wp-plugin/mullion-gallery/assets/` (hashed chunks under `assets/assets/`)

### Package

- [ ] ZIP name matches the edition (`mullion-gallery-v*.zip` or `mullion-gallery-lite-v*.zip`)
- [ ] If producing both, premium was zipped **before** the lite rebuild
- [ ] ZIP excludes match `.distignore` / `release.yml` (not this doc's older shorter list)
- [ ] ZIP includes `vendor/`, `languages/`, `readme.txt`, and `assets/mullion-edition.json`

### Deploy (Staging)

- [ ] Plugin deployed to staging environment
- [ ] Plugin activated successfully
- [ ] Basic smoke test passed:
  - [ ] Shortcode renders gallery
  - [ ] Login/auth works
  - [ ] Admin panel accessible

### Deploy (Production)

- [ ] Staging sign-off complete
- [ ] Production backup created
- [ ] Plugin deployed to production
- [ ] Plugin activated successfully
- [ ] Production smoke test passed
- [ ] Monitor for errors (15-30 minutes)

### Post-Release

> **Note:** If you used the GitHub Actions release workflow, tagging and GitHub Release
> creation are handled automatically. These steps are for manual releases only.

- [ ] Git tag created (`git tag -a v1.2.3 -m "Release v1.2.3"`)
- [ ] Git tag pushed (`git push origin v1.2.3`)
- [ ] Release notes published (GitHub/internal)
- [ ] Team notified of release

---

## Version Management

### Semantic Versioning

Follow [SemVer](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, incompatible API changes
- **MINOR** (1.0.0 → 1.1.0): New features, backward compatible
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, backward compatible

### Updating Version Numbers

Update version in these locations:

1. **Plugin Header** (`mullion-gallery.php`):
   ```php
   * Version: 1.2.3
   ```

2. **Version Constant** (`mullion-gallery.php`):
   ```php
   define('MULLION_VERSION', '1.2.3');
   ```

3. **WordPress.org readme** (`wp-plugin/mullion-gallery/readme.txt`):
   ```text
   Stable tag: 1.2.3
   ```

4. **package.json**:
   ```json
   "version": "1.2.3"
   ```

5. **package-lock.json**:
   - Update the root `version` fields alongside `package.json`.

6. **Release documentation**:
   - Add the release to `CHANGELOG.md`.
   - Roll `docs/guides/VERSIONING.md` forward from `Unreleased` to the new tagged version.

### Git Tagging

```bash
# Create annotated tag
git tag -a v1.2.3 -m "Release v1.2.3: Brief description"

# Push tag to remote
git push origin v1.2.3

# List tags
git tag -l
```

---

## Plugin Upgrade Path

This section documents how to safely upgrade the plugin while preserving user data, settings, and media.

### What Gets Preserved on Upgrade

| Data Type | Storage Location | Preserved? |
| --------- | ---------------- | ---------- |
| Plugin settings | `wp_options` table (`mullion_settings`) | ✅ Yes |
| Campaigns | `wp_posts` table (CPT: `mullion_campaign`) | ✅ Yes |
| Campaign metadata | `wp_postmeta` table | ✅ Yes |
| Media items | Campaign post meta | ✅ Yes |
| Access grants | Campaign post meta | ✅ Yes |
| Company taxonomy | `wp_terms` / `wp_term_taxonomy` | ✅ Yes |
| Uploaded files | `wp-content/uploads/` | ✅ Yes |
| Audit logs | Campaign post meta | ✅ Yes |

### What Gets Replaced on Upgrade

| Component | Notes |
| --------- | ----- |
| PHP classes | All files in `includes/` are replaced |
| JS/CSS assets | All files in `assets/` are replaced (content-hashed) |
| Main plugin file | `mullion-gallery.php` is replaced |

### Standard Upgrade Procedure

#### Method 1: Direct File Replacement

```bash
# 1. Backup current plugin (recommended)
cp -r /path/to/wp-content/plugins/mullion-gallery /path/to/backups/mullion-gallery-$(date +%Y%m%d)

# 2. Remove old plugin files (preserves database)
rm -rf /path/to/wp-content/plugins/mullion-gallery

# 3. Copy new plugin files
cp -r wp-plugin/mullion-gallery /path/to/wp-content/plugins/

# 4. Clear caches
wp cache flush  # If using object cache
```

#### Method 2: WordPress Admin Upload

1. Download the new version ZIP.
2. Go to **Plugins → Add New → Upload Plugin**.
3. Upload the ZIP file.
4. WordPress will prompt to replace the existing plugin.
5. Click **Replace current with uploaded**.
6. Reactivate if needed.

#### Method 3: Git-Based CI/CD

```bash
# In CI pipeline
git pull origin main
npm ci
npm run build:wp   # premium. For lite: npm run build:wp:free, then scan.
rsync -avz --delete \
  --exclude 'tests/' \
  --exclude 'phpunit.xml.dist' \
  wp-plugin/mullion-gallery/ \
  user@server:/path/to/wp-content/plugins/mullion-gallery/
```

### Migration Considerations

#### Settings Schema Changes

If a new version adds settings fields:

1. New fields automatically get default values via `wp_parse_args()`.
2. Existing settings are preserved.
3. No migration script needed for additive changes.

Example in `class-mullion-settings.php`:
```php
public static function get_settings() {
    $settings = get_option(self::OPTION_NAME, []);
    return wp_parse_args($settings, self::$defaults);  // Merges with defaults
}
```

#### Breaking Changes (Major Versions)

For major version upgrades with breaking changes:

1. **Document breaking changes** in CHANGELOG.
2. **Provide migration guide** if data format changes.
3. **Consider compatibility layer** for gradual migration.

Example migration hook (if needed in future):
```php
// In mullion-gallery.php
register_activation_hook(__FILE__, 'mullion_run_migrations');

function mullion_run_migrations() {
    $current_version = get_option('mullion_db_version', '0.0.0');
    
    if (version_compare($current_version, '2.0.0', '<')) {
        // Run migration for v2.0.0
        mullion_migrate_to_v2();
    }
    
    update_option('mullion_db_version', MULLION_VERSION);
}
```

### Pre-Upgrade Checklist

- [ ] Backup WordPress database
- [ ] Backup current plugin folder
- [ ] Note current plugin version
- [ ] Review CHANGELOG for breaking changes
- [ ] Test upgrade on staging first

### Post-Upgrade Checklist

- [ ] Plugin activates without errors
- [ ] Settings are preserved (check WP Admin → Campaigns → Settings)
- [ ] Existing campaigns load correctly
- [ ] Media items display properly
- [ ] Access grants still work
- [ ] Shortcode embeds render correctly
- [ ] Clear all caches

### Downgrade Procedure

If an upgrade causes issues:

1. Deactivate the new version.
2. Delete the plugin folder.
3. Restore from backup:
   ```bash
   cp -r /path/to/backups/mullion-gallery-YYYYMMDD /path/to/wp-content/plugins/mullion-gallery
   ```
4. Reactivate the plugin.
5. Verify functionality.

**Note:** Downgrading after a migration has run may cause issues if data format changed. Always test on staging first.

### Version Compatibility Matrix

| Plugin Version | Min PHP | Min WP | Notes |
| -------------- | ------- | ------ | ----- |
| 0.1.x | 7.4 | 5.8 | Initial release |
| 0.2.x | 7.4 | 5.8 | Mantine UI migration |
| 0.3.x | 7.4 | 5.8 | Settings UI, Phase 5 complete |

---

## Rollback Procedures

### Quick Rollback (Direct Copy)

If issues are discovered after deployment:

```bash
# Keep a backup before deploying
cp -r /path/to/wordpress/wp-content/plugins/mullion-gallery /path/to/backups/mullion-gallery-backup-$(date +%Y%m%d)

# Rollback to previous version
rm -rf /path/to/wordpress/wp-content/plugins/mullion-gallery
cp -r /path/to/backups/mullion-gallery-previous /path/to/wordpress/wp-content/plugins/mullion-gallery
```

### Rollback via Git

```bash
# Checkout previous version
git checkout v1.2.2

# Rebuild and deploy
npm ci
npm run build:wp
# Deploy as usual
```

### WordPress Plugin Rollback

1. Deactivate the current plugin version.
2. Delete the plugin via WP Admin.
3. Upload and activate the previous version ZIP.

### Database Rollback

If the plugin made database changes (rare):

1. Restore from database backup.
2. Or manually revert option changes:
   ```php
   // In wp-cli or a script
   delete_option('mullion_settings');
   ```

---

## Troubleshooting

### Build Issues

**Problem:** `npm run build` fails

```bash
# Clear npm cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
npm run build
```

**Problem:** TypeScript errors

```bash
# Check for type errors
npx tsc --noEmit

# Fix or update types as needed
```

### Deployment Issues

**Problem:** Assets not loading (404)

- Verify the Vite manifest exists at `assets/.vite/manifest.json` (or `assets/manifest.json`). Hashed chunks live in `assets/assets/`.
- Check file permissions (should be readable by web server).
- Clear any caching plugins in WordPress.
- Check browser console for specific 404 URLs.

**Problem:** Plugin activation fails

- Check PHP error log for syntax errors.
- Validate PHP syntax: `php -l mullion-gallery.php`
- Ensure PHP version meets requirements (7.4+).

**Problem:** Shortcode not rendering

- Verify plugin is activated.
- Check that assets are built and copied.
- Inspect browser console for JavaScript errors.
- Verify the embed container exists in page source.

### API Issues

**Problem:** REST API returns 401/403

- Verify JWT plugin is installed and configured.
- Check that permalinks are set to "Post name".
- Verify `.htaccess` has proper rewrite rules.
- Test token validity via `/wp-json/jwt-auth/v1/token/validate`.

**Problem:** CORS errors

- Check WordPress CORS headers configuration.
- Verify `Access-Control-Allow-Origin` includes your domain.
- See `WP_JWT_SETUP.md` for CORS configuration.

### Cache Issues

**Problem:** Old assets loading after update

- Clear browser cache.
- Clear WordPress object cache (if using Redis/Memcached).
- Clear any CDN cache.
- Clear caching plugin cache (WP Super Cache, W3 Total Cache, etc.).
- Vite uses content hashes in filenames—verify new hashes in `manifest.json`.

---

## Quick Reference

### Common Commands

```bash
# Install dependencies
npm install

# Run tests
npm test -- --run

# Premium plugin tree (default)
npm run build:wp

# Lite plugin tree (overwrites assets/)
npm run build:wp:free

# Lite dist/ only (no copy)
npm run build:free

# Rebuild lite dist/ and fail on Pro-code leak (CI gate)
npm run check:free-build

# Scan an already-built plugin assets tree (no rebuild)
node scripts/check-free-build-clean.mjs wp-plugin/mullion-gallery/assets

# Type check
npx tsc --noEmit

# PHP syntax check
php -l wp-plugin/mullion-gallery/mullion-gallery.php

# Deploy to local WP (adjust path) — copies whichever edition is currently in assets/
rm -rf /path/to/wp-content/plugins/mullion-gallery && \
cp -r wp-plugin/mullion-gallery /path/to/wp-content/plugins/
```

### Key File Locations

| Purpose | Location |
| ------- | -------- |
| Main plugin file | `wp-plugin/mullion-gallery/mullion-gallery.php` |
| Built assets | `wp-plugin/mullion-gallery/assets/` (chunks in `assets/assets/`) |
| Edition marker | `wp-plugin/mullion-gallery/assets/mullion-edition.json` |
| Dist ignore (SVN) | `wp-plugin/mullion-gallery/.distignore` |
| PHP classes | `wp-plugin/mullion-gallery/includes/` |
| Settings class | `wp-plugin/mullion-gallery/includes/class-mullion-settings.php` |
| REST API | `wp-plugin/mullion-gallery/includes/class-mullion-rest.php` |
| Frontend source | `src/` |
| Build output | `dist/` |

---

Document created: January 30, 2026
Last updated: 2026-08-25 (P75-C: free/premium split)
