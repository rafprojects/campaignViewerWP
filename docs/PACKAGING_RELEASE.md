# Packaging & Release Guide

This document provides a comprehensive guide for building, packaging, and releasing WP Super Gallery for production deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Build Process](#build-process)
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
- **PHP** 7.4+ (for plugin syntax validation)
- **Git** for version control
- Access to the WordPress installation for deployment
- (Optional) **Composer** for PHP dependencies in the plugin

### Verify Prerequisites

```bash
node --version    # Should be 18+
npm --version     # Should be 9+
php --version     # Should be 7.4+
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
- Asset manifest (`manifest.json`)

### 4. Copy Assets to Plugin

Copy the built assets into the WordPress plugin folder:

```bash
npm run build:wp
```

Or manually:

```bash
rm -rf wp-plugin/wp-super-gallery/assets/*
cp -r dist/* wp-plugin/wp-super-gallery/assets/
```

### 5. Verify the Build

Check that the plugin assets directory contains:

```
wp-plugin/wp-super-gallery/assets/
├── index-[hash].js          # Main JS bundle
├── index-[hash].css         # Main CSS bundle
├── manifest.json            # Vite manifest for asset resolution
└── (other chunks if code-split)
```

---

## Plugin Structure

The complete plugin structure for distribution:

```
wp-super-gallery/
├── assets/                     # Built SPA assets (from dist/)
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── manifest.json
├── includes/
│   ├── class-wpsg-cpt.php      # Custom post type registration
│   ├── class-wpsg-embed.php    # Shortcode and embed logic
│   ├── class-wpsg-rest.php     # REST API endpoints
│   ├── class-wpsg-settings.php # Admin settings page
│   └── class-wpsg-oembed-providers.php  # oEmbed provider handling
├── tests/                      # PHPUnit tests (exclude from distribution)
├── vendor/                     # Composer dependencies (if any)
├── composer.json               # PHP dependencies
├── phpunit.xml.dist            # PHPUnit configuration
└── wp-super-gallery.php        # Main plugin file
```

---

## Packaging for Distribution

### Create a Distribution ZIP

For sharing or uploading to WordPress:

```bash
# From repository root
cd wp-plugin

# Create ZIP excluding development files
zip -r wp-super-gallery-v$(cat wp-super-gallery/wp-super-gallery.php | grep "Version:" | sed 's/.*Version: //').zip wp-super-gallery \
  -x "wp-super-gallery/tests/*" \
  -x "wp-super-gallery/.phpunit.result.cache" \
  -x "wp-super-gallery/phpunit.xml.dist" \
  -x "wp-super-gallery/.circleci/*" \
  -x "wp-super-gallery/composer.lock"
```

Or use the npm script (if configured):

```bash
npm run package
```

### Exclude from Distribution

These files should NOT be in the production ZIP:

- `tests/` directory
- `.phpunit.result.cache`
- `phpunit.xml.dist`
- `.circleci/` directory
- `composer.lock` (include `composer.json` for reference)
- Any `.git` files
- Development documentation

### Include in Distribution

These files MUST be in the production ZIP:

- `wp-super-gallery.php` (main plugin file)
- `includes/` directory (all PHP classes)
- `assets/` directory (built SPA assets)
- `composer.json` (for dependency reference)
- `readme.txt` (WordPress plugin readme, if present)

---

## Deployment Steps

### Method 1: Direct Copy (Local/Staging)

For local WordPress or staging environments:

```bash
# Remove old plugin files
rm -rf /path/to/wordpress/wp-content/plugins/wp-super-gallery

# Copy new plugin files
cp -r wp-plugin/wp-super-gallery /path/to/wordpress/wp-content/plugins/

# Verify permissions (Linux/Mac)
chmod -R 755 /path/to/wordpress/wp-content/plugins/wp-super-gallery
```

### Method 2: ZIP Upload (WordPress Admin)

1. Create the distribution ZIP (see above).
2. Go to **WP Admin → Plugins → Add New → Upload Plugin**.
3. Upload the ZIP file.
4. Click **Install Now**, then **Activate**.

### Method 3: FTP/SFTP (Production)

1. Create the distribution ZIP and extract locally.
2. Connect via FTP/SFTP to your production server.
3. Navigate to `wp-content/plugins/`.
4. Upload the `wp-super-gallery/` folder.
5. Deactivate/Reactivate the plugin if it was already active.

### Method 4: Git-based Deployment

For CI/CD pipelines:

```bash
# Example: deploy from CI
git clone --depth 1 <repo-url>
cd wp-super-gallery
npm ci
npm run build:wp
rsync -avz --delete wp-plugin/wp-super-gallery/ user@server:/path/to/wp-content/plugins/wp-super-gallery/
```

---

## Release Checklist

Use this checklist for every release:

### Pre-Release

- [ ] All tests pass (`npm test -- --run`)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] PHP syntax is valid (`php -l wp-plugin/wp-super-gallery/wp-super-gallery.php`)
- [ ] Version number updated in:
  - [ ] `wp-super-gallery.php` (Plugin header)
  - [ ] `package.json` (npm version)
- [ ] CHANGELOG updated with release notes
- [ ] Manual QA completed (see TESTING_QA.md)

### Build

- [ ] Clean install dependencies (`rm -rf node_modules && npm ci`)
- [ ] Production build created (`npm run build`)
- [ ] Assets copied to plugin (`npm run build:wp`)
- [ ] Build artifacts verified in `wp-plugin/wp-super-gallery/assets/`

### Package

- [ ] Distribution ZIP created
- [ ] ZIP excludes test/dev files
- [ ] ZIP includes all required files

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

1. **Plugin Header** (`wp-super-gallery.php`):
   ```php
   * Version: 1.2.3
   ```

2. **Version Constant** (`wp-super-gallery.php`):
   ```php
   define('WPSG_VERSION', '1.2.3');
   ```

3. **package.json**:
   ```json
   "version": "1.2.3"
   ```

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
| Plugin settings | `wp_options` table (`wpsg_settings`) | ✅ Yes |
| Campaigns | `wp_posts` table (CPT: `wpsg_campaign`) | ✅ Yes |
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
| Main plugin file | `wp-super-gallery.php` is replaced |

### Standard Upgrade Procedure

#### Method 1: Direct File Replacement

```bash
# 1. Backup current plugin (recommended)
cp -r /path/to/wp-content/plugins/wp-super-gallery /path/to/backups/wp-super-gallery-$(date +%Y%m%d)

# 2. Remove old plugin files (preserves database)
rm -rf /path/to/wp-content/plugins/wp-super-gallery

# 3. Copy new plugin files
cp -r wp-plugin/wp-super-gallery /path/to/wp-content/plugins/

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
npm run build:wp
rsync -avz --delete \
  --exclude 'tests/' \
  --exclude 'phpunit.xml.dist' \
  wp-plugin/wp-super-gallery/ \
  user@server:/path/to/wp-content/plugins/wp-super-gallery/
```

### Migration Considerations

#### Settings Schema Changes

If a new version adds settings fields:

1. New fields automatically get default values via `wp_parse_args()`.
2. Existing settings are preserved.
3. No migration script needed for additive changes.

Example in `class-wpsg-settings.php`:
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
// In wp-super-gallery.php
register_activation_hook(__FILE__, 'wpsg_run_migrations');

function wpsg_run_migrations() {
    $current_version = get_option('wpsg_db_version', '0.0.0');
    
    if (version_compare($current_version, '2.0.0', '<')) {
        // Run migration for v2.0.0
        wpsg_migrate_to_v2();
    }
    
    update_option('wpsg_db_version', WPSG_VERSION);
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
   cp -r /path/to/backups/wp-super-gallery-YYYYMMDD /path/to/wp-content/plugins/wp-super-gallery
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
cp -r /path/to/wordpress/wp-content/plugins/wp-super-gallery /path/to/backups/wp-super-gallery-backup-$(date +%Y%m%d)

# Rollback to previous version
rm -rf /path/to/wordpress/wp-content/plugins/wp-super-gallery
cp -r /path/to/backups/wp-super-gallery-previous /path/to/wordpress/wp-content/plugins/wp-super-gallery
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
   delete_option('wpsg_settings');
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

- Verify `manifest.json` exists in `assets/` directory.
- Check file permissions (should be readable by web server).
- Clear any caching plugins in WordPress.
- Check browser console for specific 404 URLs.

**Problem:** Plugin activation fails

- Check PHP error log for syntax errors.
- Validate PHP syntax: `php -l wp-super-gallery.php`
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

# Build for production
npm run build

# Build and copy to plugin
npm run build:wp

# Type check
npx tsc --noEmit

# PHP syntax check
php -l wp-plugin/wp-super-gallery/wp-super-gallery.php

# Deploy to local WP (adjust path)
rm -rf /path/to/wp-content/plugins/wp-super-gallery && \
cp -r wp-plugin/wp-super-gallery /path/to/wp-content/plugins/
```

### Key File Locations

| Purpose | Location |
| ------- | -------- |
| Main plugin file | `wp-plugin/wp-super-gallery/wp-super-gallery.php` |
| Built assets | `wp-plugin/wp-super-gallery/assets/` |
| PHP classes | `wp-plugin/wp-super-gallery/includes/` |
| Settings class | `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` |
| REST API | `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` |
| Frontend source | `src/` |
| Build output | `dist/` |

---

Document created: January 30, 2026
