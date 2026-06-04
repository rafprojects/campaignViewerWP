# Phase 42 — D-7: Decompose Monolithic REST Class into Domain Controllers

**Status:** Not started
**Created:** 2026-06-03
**Last updated:** 2026-06-03

### Tracks

| Track    | Description                                          | Status      | Effort |
|----------|------------------------------------------------------|-------------|--------|
| P42-DC0  | Base class scaffold, subdirectory, load wiring       | Not started | M      |
| P42-DC1  | Campaign Controller                                  | Not started | L      |
| P42-DC2  | Export/Import Controller                             | Not started | M      |
| P42-DC3  | Media Controller                                     | Not started | L      |
| P42-DC4  | Analytics Controller                                 | Not started | S      |
| P42-DC5  | Access Controller                                    | Not started | M      |
| P42-DC6  | Auth + User Controller                               | Not started | S      |
| P42-DC7  | Settings Controller                                  | Not started | S      |
| P42-DC8  | Content Controller (templates, taxonomy, library)    | Not started | M      |
| P42-DC9  | System Controller (health, thumbnails, oEmbed, hooks)| Not started | S      |

---

## Rationale

`class-wpsg-rest.php` is a single 7800-line static class (`WPSG_REST`) responsible for every REST
endpoint the plugin exposes — campaign CRUD, media upload, analytics, access control, auth, settings,
campaign/layout templates, overlays, fonts, oEmbed proxying, webhook management, and more. The
class has strong test coverage and no open bugs, so this is a pure DX/maintainability refactor.

The immediate pain points:
- A contributor touching the analytics endpoint must read through 7800 lines to locate it.
- `register_routes()` alone is ~1100 lines of interleaved route definitions for unrelated domains.
- PHP's class size limit is not a problem today, but the file is already unwieldy in any editor.
- All future domain additions land in the same file, compounding the problem over time.

The target state is 9 domain controller files (totalling the same number of lines) plus a thin
shared base class, with `WPSG_REST` reduced to a ~30-line dispatcher whose only job is to
require the controllers and call each one's `register_routes()`.

---

## Architecture

### Directory layout

```
wp-plugin/wp-super-gallery/includes/
├── class-wpsg-rest.php              ← thin dispatcher (survives after all DC tracks)
└── rest/
    ├── class-wpsg-rest-base.php     ← DC0: abstract base with shared helpers
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

All controllers extend `WPSG_REST_Base`, which holds every shared static helper.
`WPSG_REST` also extends `WPSG_REST_Base` so existing hook registrations in
`wp-super-gallery.php` (`['WPSG_REST', 'register_routes']`,
`['WPSG_REST', 'inject_rate_limit_headers']`, `WPSG_REST::bump_cache_version()`) continue
to resolve via PHP's static-method inheritance — no changes needed to `wp-super-gallery.php`.

```php
abstract class WPSG_REST_Base {
    protected static function respond_with_etag(...) { ... }
    protected static function error_response(...) { ... }
    public    static function inject_rate_limit_headers(...) { ... }
    public    static function get_cache_version(): int { ... }
    public    static function bump_cache_version(): void { ... }
    public    static function require_admin() { ... }
    // ... all shared helpers ...
}

class WPSG_Campaign_Controller extends WPSG_REST_Base {
    public static function register_routes(): void { ... }
    public static function list_campaigns($request) { ... }
    // ...
}

class WPSG_REST extends WPSG_REST_Base {
    public static function register_routes(): void {
        WPSG_Campaign_Controller::register_routes();
        WPSG_Export_Controller::register_routes();
        // ... remaining controllers in route-registration order
    }
}
```

### Route ordering constraint

Some routes must be registered before others to avoid WordPress regex short-circuiting
(e.g. `/campaigns/access-summary` before `/campaigns/(?P<id>\d+)`). The dispatcher in
`WPSG_REST::register_routes()` must call controllers in the order documented in the
`# Route ordering` comment block that DC0 adds to `class-wpsg-rest.php`.

### Test compatibility

Nearly all PHPUnit tests exercise routes via `rest_do_request()` / `$this->get()` and are
unaffected by where the handler lives — they only care about URL and response shape.

Four tests call `WPSG_REST` static methods directly:
- `ProxyOEmbedTest.php` / `ProxyOEmbedSSRFTest.php`: `WPSG_REST::proxy_oembed()` → updated in DC9
- `WPSG_Auto_Archive_Cron_Test.php` / `WPSG_REST_Extended_Test.php`: `WPSG_REST::get_cache_version()` /
  `bump_cache_version()` → these stay callable on `WPSG_REST` via inheritance from `WPSG_REST_Base`
- `WPSG_REST_Routes_Test.php`: `WPSG_REST::create_media()` → updated in DC3

---

## Track P42-DC0 — Base Class Scaffold

### Goal

Create the `includes/rest/` subdirectory and the abstract `WPSG_REST_Base` class. Wire the load
order so `class-wpsg-rest.php` requires all controller files. After this track, `WPSG_REST` still
contains all its current methods — subsequent DC tracks move them out domain by domain.

### Methods to extract to `WPSG_REST_Base`

Shared infrastructure helpers that every domain controller will need:

| Group | Methods |
|-------|---------|
| HTTP utilities | `respond_with_etag`, `error_response` |
| Rate limiting | `rate_limit_public`, `rate_limit_authenticated`, `rate_limit_magic_approve`, `rate_limit_check`, `inject_rate_limit_headers` |
| Auth gates | `require_admin`, `require_authenticated`, `require_campaign_editor`, `require_campaign_owner`, `verify_admin_auth`, `verify_rest_nonce` |
| Access level helpers | `validate_access_level`, `get_effective_campaign_level` |
| Cache version | `get_cache_version`, `bump_cache_version` |
| Network / SSRF | `check_private_ip` |
| Pagination | `parse_pagination`, `paginated_response` |
| Param coercion | `is_truthy_param` |

### Changes

- Create `includes/rest/` directory.
- Create `includes/rest/class-wpsg-rest-base.php` with `abstract class WPSG_REST_Base`.
- Change `class-wpsg-rest.php` opener: `class WPSG_REST extends WPSG_REST_Base`.
- Move the shared helpers listed above from `WPSG_REST` into `WPSG_REST_Base`.
- Add a `# Route ordering` comment block at the top of `WPSG_REST::register_routes()` documenting
  the required controller call sequence.
- Add stub `require_once` lines in `class-wpsg-rest.php` for all 9 future controller files
  (present but pointing to non-existent files — these are activated one at a time in DC1–DC9).

### Verification

Full PHPUnit suite passes unchanged — this track moves helpers only; no route callbacks change.

---

## Track P42-DC1 — Campaign Controller

### Domain boundary

All campaign lifecycle methods: list, get, create, update, archive, restore, delete, duplicate,
batch operations, audit log entries, gallery override promotion, and category/tag name helpers
that campaigns depend on.

### Methods moved

`list_campaigns`, `create_campaign`, `get_campaign`, `update_campaign`, `archive_campaign`,
`restore_campaign`, `delete_campaign`, `duplicate_campaign`, `batch_campaigns`,
`add_audit_entry`, `promote_campaign_gallery_overrides`,
`get_campaign_category_names`, `get_campaign_category_ids`

### Route blocks moved from `register_routes()`

`/campaigns` (GET/POST), `/campaigns/access-summary`, `/campaigns/(?P<id>\d+)` (GET/PATCH/DELETE),
`/campaigns/(?P<id>\d+)/archive`, `/campaigns/(?P<id>\d+)/restore`,
`/campaigns/(?P<id>\d+)/duplicate`, `/campaigns/batch`

### Test files

`WPSG_Campaign_Rest_Test.php`, `WPSG_P28G_Audit_Log_Test.php`, `WPSG_P28E_Campaign_Filters_Test.php`,
`WPSG_P28F_Pagination_Test.php`, `WPSG_P36C_Draft_Permissions_Test.php`, `WPSG_P33B_Access_Level_Test.php`

---

## Track P42-DC2 — Export/Import Controller

### Domain boundary

All JSON and binary export/import handlers, export job management (poll, download, delete),
and the per-campaign sideload helper.

### Methods moved

`export_campaign`, `import_campaign`, `export_campaign_binary`, `batch_export_binary`,
`get_export_job`, `delete_export_job`, `download_export_job`,
`import_campaign_binary`, `import_single_campaign_from_zip`

### Route blocks moved

`/campaigns/(?P<id>\d+)/export`, `/campaigns/import`, `/campaigns/(?P<id>\d+)/export/binary`,
`/campaigns/import/binary`, `/campaigns/batch/export/binary`,
`/export-jobs/(?P<job_id>[a-f0-9]{32})` (GET/DELETE),
`/export-jobs/(?P<job_id>[a-f0-9]{32})/download`

### Test files

`WPSG_P39CM1_Export_Test.php`, `WPSG_Import_Sanitization_Test.php`, `WPSG_REST_Routes_Test.php`
(import-related assertions)

---

## Track P42-DC3 — Media Controller

### Domain boundary

Media item CRUD on campaigns, batch and rescan operations, media tags, media usage stats,
and all private upload/dedup helpers.

### Methods moved

`list_media`, `create_media`, `create_media_batch`, `get_media_usage`, `get_media_usage_summary`,
`list_media_tags`, `create_media_tag`, `delete_media_tag`

Private helpers: `sort_media_items`, `resolve_campaign_id_from_request`, `clamp_media_order`,
`get_next_media_order`, `build_media_item_from_payload`, `get_max_batch_upload_size`,
`get_uploaded_file_entries`, `get_upload_error_data`, `is_trusted_uploaded_file`,
`create_attachment_from_upload`, `prepare_uploaded_attachment_payload`,
`find_attachment_by_md5`, `find_near_duplicates_by_phash`, `find_attachment_origin_meta`,
`upload_single_media_file`

### Route blocks moved

`/media/usage-summary`, `/media/(?P<mediaId>...)/usage`,
`/campaigns/(?P<id>\d+)/media` (GET/POST),
`/campaigns/(?P<id>\d+)/media/batch`,
`/campaigns/(?P<id>\d+)/media/reorder`,
`/campaigns/(?P<id>\d+)/media/rescan`,
`/campaigns/(?P<id>\d+)/media/(?P<mediaId>...)` (PATCH/DELETE),
`/media/rescan-all`,
`/campaigns/(?P<id>\d+)/media-tags`, `/media-tags` CRUD

### Test files

`WPSG_P28D_Batch_Media_Upload_Test.php`, `WPSG_P28N_Duplicate_Detection_Test.php`,
`WPSG_P38MD1_PHash_Test.php`, `WPSG_REST_Routes_Test.php` (media + `create_media` direct call),
`WPSG_P28C_Taxonomy_CRUD_Test.php` (media-tag assertions)

Update `WPSG_REST_Routes_Test.php`: change `WPSG_REST::create_media($request)` →
`WPSG_Media_Controller::create_media($request)`.

---

## Track P42-DC4 — Analytics Controller

### Domain boundary

Event recording, per-campaign analytics queries, and the analytics summary endpoint.

### Methods moved

`record_analytics_event`, `get_campaign_analytics`, `parse_analytics_date_range`,
`get_campaign_media_analytics`, `get_analytics_summary`

### Route blocks moved

`/analytics/event`, `/analytics/campaigns/(?P<id>\d+)`,
`/analytics/campaigns/(?P<id>\d+)/media`, `/analytics/summary`

### Test files

`WPSG_P28H_Analytics_Test.php`, `WPSG_P40_BS1_Audit_Baseline_Test.php`

---

## Track P42-DC5 — Access Controller

### Domain boundary

Per-campaign access grants and revocations, magic-link approve/deny flow, access request
management, and the access summary endpoint. Company-level access listing belongs here
because it serves the same ACL surface.

### Methods moved

`list_access`, `grant_access`, `revoke_access`, `format_access_request`,
`submit_access_request`, `list_access_requests`, `approve_access_request`, `do_approve_request`,
`magic_approve_access_request`, `magic_link_redirect`, `deny_access_request`,
`access_summary`, `list_company_access`

### Route blocks moved

`/campaigns/(?P<id>\d+)/access` (GET/POST),
`/campaigns/(?P<id>\d+)/access/(?P<userId>\d+)` (DELETE),
`/campaigns/(?P<id>\d+)/access-requests` (GET/POST),
`/campaigns/(?P<id>\d+)/access-requests/(?P<token>...)/approve`,
`/campaigns/(?P<id>\d+)/access-requests/(?P<token>...)/deny`,
`/access-requests/magic-approve`,
`/campaigns/access-summary`,
`/companies/(?P<companyId>\d+)/access`

### Test files

`WPSG_P28I_Magic_Link_Test.php`, `WPSG_P28J_Access_Summary_Test.php`,
`WPSG_P28B_Access_Expiry_Test.php`, `WPSG_P33C_Role_Enforcement_Test.php`

---

## Track P42-DC6 — Auth + User Controller

### Domain boundary

Cookie-based session login/logout, WordPress user search/creation, and role listing.

### Methods moved

`handle_cookie_login`, `handle_cookie_logout`, `search_users`, `create_user`, `list_roles`

### Route blocks moved

`/auth/cookie` (POST), `/auth/logout` (POST),
`/users` (GET/POST), `/users/roles`

### Test files

`WPSG_Cookie_Auth_Test.php`, `WPSG_Capability_Test.php`

---

## Track P42-DC7 — Settings Controller

### Domain boundary

Public and admin settings endpoints.

### Methods moved

`get_public_settings`, `update_settings`, `patch_settings`

### Route blocks moved

`/settings` (GET/PUT/PATCH)

### Test files

`WPSG_Settings_Test.php`, `WPSG_Settings_Extended_Test.php`, `WPSG_Settings_Rest_Test.php`

---

## Track P42-DC8 — Content Controller

### Domain boundary

Campaign templates, layout templates, campaign categories, campaign/media tags, overlay library,
and font library. These are all content-library resources that exist independently of any single
campaign.

### Methods moved

`list_campaign_categories`, `create_campaign_category`, `update_campaign_category`,
`delete_campaign_category`, `list_campaign_tags`, `create_campaign_tag`, `delete_campaign_tag`,
`list_campaign_templates`, `create_campaign_template`, `delete_campaign_template`,
`instantiate_campaign_template`,
`list_layout_templates`, `create_layout_template`, `get_layout_template`,
`update_layout_template`, `delete_layout_template`, `duplicate_layout_template`,
`get_layout_template_public`,
`list_overlay_library`, `upload_overlay`, `delete_overlay`,
`list_font_library`, `upload_font`, `delete_font`,
`list_companies`

### Route blocks moved

`/campaign-categories` (GET/POST), `/campaign-categories/(?P<id>\d+)` (PATCH/DELETE),
`/campaign-tags` (GET/POST/DELETE), `/media-tags` (already covered in DC3 if media-tags belong there),
`/campaign-templates` (GET/POST), `/campaign-templates/(?P<id>...)` (GET/DELETE),
`/campaign-templates/(?P<id>...)/instantiate`,
`/layout-templates` (GET/POST), `/layout-templates/(?P<id>...)` (GET/PATCH/DELETE/duplicate),
`/layout-templates/(?P<id>...)/public`,
`/overlays` (GET/POST/DELETE), `/fonts` (GET/POST/DELETE),
`/companies`

### Test files

`WPSG_P28C_Taxonomy_CRUD_Test.php`, `WPSG_P28O_Campaign_Templates_Test.php`,
`WPSG_Layout_Templates_Test.php`, `WPSG_Overlay_Library_Test.php`

---

## Track P42-DC9 — System Controller

### Domain boundary

Thumbnail cache management, health/monitoring data, oEmbed proxy, and webhook CRUD.

### Methods moved

`get_thumbnail_cache_stats`, `clear_thumbnail_cache`, `refresh_thumbnail_cache`,
`get_health_data`, `get_oembed_failures`, `reset_oembed_failures`,
`proxy_oembed`,
`list_webhook_endpoints`, `create_webhook_endpoint`, `update_webhook_endpoint`,
`delete_webhook_endpoint`, `rotate_webhook_secret`, `list_webhook_deliveries`

### Route blocks moved

`/thumbnail-cache` (GET/DELETE), `/thumbnail-cache/refresh`,
`/health`, `/oembed-failures` (GET/DELETE),
`/oembed/proxy`,
`/webhook-endpoints` (GET/POST), `/webhook-endpoints/(?P<id>...)` (PATCH/DELETE),
`/webhook-endpoints/(?P<id>...)/rotate-secret`,
`/webhook-deliveries`

### Test files

`WPSG_P39OC1_CacheHealth_Test.php`, `WPSG_Thumbnail_Cache_Test.php`,
`ProxyOEmbedTest.php`, `ProxyOEmbedSSRFTest.php`, `WPSG_P39IN1_Webhook_Test.php`

Update `ProxyOEmbedTest.php` and `ProxyOEmbedSSRFTest.php`: change
`WPSG_REST::proxy_oembed($request)` → `WPSG_System_Controller::proxy_oembed($request)`.

---

## End state

After all DC tracks are merged, `class-wpsg-rest.php` contains:

```php
require_once __DIR__ . '/rest/class-wpsg-rest-base.php';
require_once __DIR__ . '/rest/class-wpsg-campaign-controller.php';
// ... 8 more require_once lines ...

class WPSG_REST extends WPSG_REST_Base {
    public static function register_routes(): void {
        // Route ordering: see comment block in this method.
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

`WPSG_REST_Base` holds ~300 lines of shared infrastructure.
Each controller holds its domain methods and route registrations.
The full PHPUnit suite passes without modification to any test assertion.
