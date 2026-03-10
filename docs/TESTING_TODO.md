# Testing Verification TODO

> **Disposable document** — delete after all checks pass. Repeatable tests have been copied to `TESTING_QA.md`.

## 1. H-2 DNS Rebinding SSRF Fix

- [ ] Test oEmbed with a non-allowlisted URL (e.g. custom domain); verify the `pre_http_request` filter fires
- [ ] Simulate DNS rebinding: configure a hostname (via `/etc/hosts` or a rebinding test tool like `rebind.network`) that resolves to `127.0.0.1`; call oEmbed proxy with `https://that-host/path` → confirm 400 response with "DNS rebinding detected" or "private IP" message
- [ ] Verify allowlisted providers (youtube.com, vimeo.com) still work without regression

**Repeatable test steps copied to:** `TESTING_QA.md` → "H-2 · DNS Rebinding SSRF Protection" (4 steps)

## 2. L-Track: SVG Sanitization (after implementation)

- [ ] Run `composer install` in `wp-plugin/wp-super-gallery/` → `enshrined/svg-sanitize` installs without errors
- [ ] Run PHPUnit: `vendor/bin/phpunit tests/WPSG_SVG_Sanitization_Test.php` → all tests pass
- [ ] Upload test SVGs with malicious content (`<script>`, `onload`, `<foreignObject>`, `javascript:` URIs, CSS exfiltration payloads) → verify they are sanitized (scripts stripped, clean XML output)
- [ ] Upload a clean SVG with gradients, filters, clip-paths → verify it renders correctly after sanitization round-trip

## 3. J-Track: Plugin Directory Preparation (after implementation)

- [ ] Validate `readme.txt` with the [WordPress.org readme validator](https://wordpress.org/plugins/developers/readme-validator/)
- [ ] Run `composer install --no-dev` in `wp-plugin/wp-super-gallery/` → `vendor/` does NOT contain `phpunit/phpunit` or `yoast/phpunit-polyfills`
- [ ] As an Editor-role user, attempt to access campaigns via native WP admin (Posts → wpsg_campaign) → should be blocked by custom capabilities
- [ ] Generate `.pot` file: `wp i18n make-pot wp-plugin/wp-super-gallery wp-plugin/wp-super-gallery/languages/wp-super-gallery.pot` → file generated without errors

## 4. I-Track: Performance Optimizations (after implementation)

- [ ] **I-3 (cache version):** Install Query Monitor; trigger a campaign save; verify no `DELETE ... LIKE '%wpsg_%'` queries appear in the query log
- [ ] **I-4 (lazy dockview):** Open the admin panel (without opening Layout Builder); check Network tab → no dockview chunk loaded. Open Layout Builder → dockview chunk fetched on demand
- [ ] **I-5 (async email):** Trigger an alert condition; verify email is not sent synchronously (check WP-Cron debug tools or `_transient` table for queued alert)
- [ ] **I-1 (CPT migration):** After migration, open Query Monitor; load a layout template → verify it uses `WP_Query` on `wpsg_layout_template` CPT (not `get_option`)
- [ ] **I-2 (media index):** Check `SHOW TABLES LIKE '%wpsg_media_refs%'` → table exists; save a campaign with media → verify rows appear in the index table
- [ ] **I-6 (shared root):** Place 3 `[wp_super_gallery]` shortcodes on one page; check Network tab → only 1 set of API requests (not 3×); verify all 3 galleries render with correct data
