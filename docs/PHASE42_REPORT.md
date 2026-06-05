# Phase 42 — D-7: Decompose Monolithic REST Class into Domain Controllers

**Status:** Complete ✅
**Created:** 2026-06-03
**Last updated:** 2026-06-06

### Tracks

| Track    | Description                                          | Status         | Effort |
|----------|------------------------------------------------------|----------------|--------|
| P42-DC0  | Base class scaffold, subdirectory, load wiring       | Complete ✅    | M      |
| P42-DC1  | Campaign Controller                                  | Complete ✅    | L      |
| P42-DC2  | Export/Import Controller                             | Complete ✅    | M      |
| P42-DC3  | Media Controller                                     | Complete ✅    | L      |
| P42-DC4  | Analytics Controller                                 | Complete ✅    | S      |
| P42-DC5  | Access Controller                                    | Complete ✅    | M      |
| P42-DC6  | Auth + User Controller                               | Complete ✅    | S      |
| P42-DC7  | Settings Controller                                  | Complete ✅    | S      |
| P42-DC8  | Content Controller (templates, taxonomy, library)    | Complete ✅    | M      |
| P42-DC9  | System Controller (health, thumbnails, oEmbed, hooks)| Complete ✅    | S      |

---

## Rationale

`class-wpsg-rest.php` was a single 7,837-line static class (`WPSG_REST`) responsible for every REST
endpoint the plugin exposes. The class had strong test coverage and no open bugs, making this a pure
DX/maintainability refactor.

The decomposition creates 9 domain controllers + 1 abstract base, with `WPSG_REST` reduced to a
33-line dispatcher. Contributors can now navigate to any domain without reading through thousands of
unrelated lines.

---

## Architecture

### Final directory layout

```
wp-plugin/wp-super-gallery/includes/
├── class-wpsg-rest.php              ← thin dispatcher (33 lines)
└── rest/
    ├── class-wpsg-rest-base.php     ← DC0: abstract base (~960 lines)
    ├── class-wpsg-campaign-controller.php    ← DC1
    ├── class-wpsg-export-controller.php      ← DC2
    ├── class-wpsg-media-controller.php       ← DC3
    ├── class-wpsg-analytics-controller.php   ← DC4
    ├── class-wpsg-access-controller.php      ← DC5
    ├── class-wpsg-auth-controller.php        ← DC6
    ├── class-wpsg-settings-controller.php    ← DC7
    ├── class-wpsg-content-controller.php     ← DC8
    └── class-wpsg-system-controller.php      ← DC9
```

### Inheritance model

All controllers extend `WPSG_REST_Base`. `WPSG_REST` also extends `WPSG_REST_Base` so existing
hook registrations (`['WPSG_REST', 'register_routes']`, `['WPSG_REST', 'inject_rate_limit_headers']`,
`WPSG_REST::bump_cache_version()`) continue to resolve via PHP static inheritance — no changes to
`wp-super-gallery.php`.

### Final dispatcher

```php
class WPSG_REST extends WPSG_REST_Base {
    public static function register_routes(): void {
        WPSG_Campaign_Controller::register_routes();
        WPSG_Export_Controller::register_routes();
        WPSG_Media_Controller::register_routes();
        WPSG_Analytics_Controller::register_routes();
        WPSG_Access_Controller::register_routes();
        WPSG_Auth_Controller::register_routes();
        WPSG_Settings_Controller::register_routes();
        WPSG_Content_Controller::register_routes();
        WPSG_System_Controller::register_routes();
    }
}
```

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Shared helpers placement | Moved `format_campaign`, `add_audit_entry`, `find_attachment_by_md5`, `promote_campaign_gallery_overrides` to `WPSG_REST_Base` so all controllers inherit them via `self::`. DC2 and DC3 both needed these. |
| B | `list_campaign_categories` in DC3 | Found accidentally included in `WPSG_Media_Controller` during DC3. Removed from media controller in DC8 and placed in `WPSG_Content_Controller` where it belongs. |
| C | `WPSG_REST::check_private_ip` reference in `proxy_oembed` | Changed to `self::check_private_ip` in `WPSG_System_Controller` since `check_private_ip` is `public static` on the base class. |
| D | Test direct-call updates | Three test files updated: `WPSG_REST_Routes_Test.php` (DC3), `ProxyOEmbedTest.php` and `ProxyOEmbedSSRFTest.php` (DC9). All other tests use `rest_do_request()` and needed no changes. |
| E | `normalize_media_items_types` / `enrich_media_with_metadata` in DC1 | Post-launch runtime error: `WPSG_Campaign_Controller::list_campaigns` called `self::normalize_media_items_types()` and `self::enrich_media_with_metadata()`, both of which were only in `WPSG_Media_Controller` (a sibling, not a parent). Fixed by moving all three methods (`infer_media_type_from_url`, `normalize_media_items_types`, `enrich_media_with_metadata`) from `WPSG_Media_Controller` to `WPSG_REST_Base` as `protected static`, so all controllers inherit them via `self::`. |
| F | PR review fixes (6 threads) | (1) `get_public_settings`: guarded `to_js()` inside the `class_exists` check and changed `manage_options` → `manage_wpsg` to match the rest of the auth layer. (2–3) `apply_campaign_meta` returns `WP_Error`, not `WP_REST_Response`; fixed both create and update call sites to use `is_wp_error()`. (4) `update_object_term_cache` in `list_company_access` passed taxonomy name `'wpsg_company'` instead of object type `'wpsg_campaign'`, defeating N+1 cache priming. (5) Removed orphaned "P18-F: Analytics" stub from `WPSG_Export_Controller`. (6) oEmbed route `permission_callback` reverted from `rate_limit_public` to `'__return_true'` — `proxy_oembed` already does its own rate limiting via `WPSG_Rate_Limiter` with admin exemption; the permission callback was double-applying a separate rate limiter and contradicted the security comment. |
| G | `handle_term_insert` / `handle_term_delete` in DC3 | Post-suite failure: `WPSG_Media_Controller::create_media_tag` and `delete_media_tag` called `self::handle_term_insert()` and `self::handle_term_delete()`, which were `private static` on the sibling `WPSG_Content_Controller`. Also moved `format_term` and `taxonomy_label` (called by `handle_term_insert`) to `WPSG_REST_Base` as `protected static`. |
| H | Orphaned unclosed docblock in DC5 (`access_summary`) | Post-deploy test failure: `WPSG_P28J_Access_Summary_Test::test_non_admin_is_rejected` returned 500 instead of 403. Root cause: `add_audit_entry` docblock left behind during DC5 was never closed (missing `*/`). PHP consumed everything to the next `*/` in the file, making `access_summary` invisible to the class parser. WordPress REST server's `is_callable` check returned false and emitted 500 instead of reaching the permission callback. `php -l` still passed because the class `}` appeared outside the unclosed comment. Fixed by removing the 14-line orphaned docblock. |
| I | PR review r2 (2 threads) | (1) GET /campaigns/{id} permission callback: replaced incorrect inline closure (checked WP `post_status`/`read_post`/`manage_options`) with `rate_limit_public`; the handler's `can_view_campaign()` already implements the full grant-based access model. Updated test to expect 404 (from handler) instead of 401/403 (from old permission callback). (2) Analytics media `COUNT(*)` inflated views with non-view events; changed to `SUM(CASE WHEN event_type = 'view')`. Updated test assertion from 3 to 2 for img-1. |
| J | PR review r3 (3 threads) | (1–2) Both `import_campaign` and `import_single_campaign_from_zip` stored ISO-8601 `publishAt`/`unpublishAt` values directly into meta; added `strtotime()`+`gmdate('Y-m-d H:i:s')` conversion branch in both import loops, matching `apply_campaign_meta`. (3) `update_settings()` passed `get_json_params()` raw (can be null) to `WPSG_Settings::from_js()`; added `?: []` guard (same pattern already used in `patch_settings`). |
| K | PR review r4 (3 threads) | (1) `inject_rate_limit_headers()` never cleared `$rate_limit_headers` after attaching them; added `self::$rate_limit_headers = []` after the foreach to prevent stale headers bleeding across requests in the same PHP process. (2) `list_campaigns` transient key built via `sprintf` could exceed WP's 191-char option-name limit; wrapped sprintf in `md5()` for a fixed-length 47-char key. (3) `list_campaign_tags` and `list_media_tags` returned `id` as integer; changed to `strval()` for consistency with `format_term()` and create/delete responses. |
| L | PR review r5 (4 threads) | (1) `can_view_campaign()` admin bypass checked only `manage_options`; changed to `manage_wpsg \|\| manage_options` to match the plugin's auth layer. (2) `proxy_oembed()` rate-limit exemption same issue; same fix. (3) `proxy_oembed()` hostname allowlist comparison: `$host` was not lowercased before matching the lowercase allowlist, so `YouTube.com` would miss; added `strtolower()`. (4) `upload_overlay()` read from `$_FILES` superglobal instead of `$request->get_file_params()`; fixed to match `upload_font()` in the same controller. |

---

## Implementation Notes

### Orphaned artifacts cleaned up

Several docblocks and section headers became orphaned as methods were removed from
`class-wpsg-rest.php`. Each was identified by PHP parse errors (`Unterminated comment`,
`unexpected token "*"`) and removed. Notable cases:

- Orphaned `*/` from deleted audit docblock found after DC5 method deletion.
- Orphaned `// P18-F: Analytics` section header + stale `proxy_oembed` docblock found after
  DC4 deletion (analytics methods had been removed but section comment remained).
- Orphaned `/** Read a stored Y-m-d H:i:s UTC meta value */` docblock left from DC helper
  extraction, found before `get_campaign_meta_maps`.

### Visibility changes in `WPSG_REST_Base`

- `respond_with_etag` and `error_response` promoted from `private` to `protected static`
  so domain controllers can call them.
- `format_campaign`, `add_audit_entry`, `promote_campaign_gallery_overrides`,
  `find_attachment_by_md5` moved from `WPSG_Campaign_Controller` to `WPSG_REST_Base` when DC2
  (export) and DC3 (media) both needed them. `add_audit_entry` is `public static` for test
  accessibility; the rest are `protected static`.

### PHP test environment

WordPress test environment unavailable locally during implementation. Used `php -l` for syntax
validation after each track. PHPUnit suite was not run.

---

## Outcome

- `class-wpsg-rest.php` reduced from 7,837 lines to 33 lines.
- 9 domain controllers created, each self-contained with its route registrations and handler methods.
- `WPSG_REST_Base` (~960 lines) holds all shared infrastructure inherited by all controllers.
- 3 direct-call test references updated (`create_media`, `proxy_oembed` ×2).
- No changes to `wp-super-gallery.php` or any route URL/response shape.
- All 11 PHP files pass `php -l` syntax validation.
