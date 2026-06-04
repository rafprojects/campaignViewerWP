<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-wpsg-oembed-providers.php';
require_once __DIR__ . '/rest/class-wpsg-rest-base.php';
require_once __DIR__ . '/rest/class-wpsg-campaign-controller.php';
require_once __DIR__ . '/rest/class-wpsg-export-controller.php';
require_once __DIR__ . '/rest/class-wpsg-media-controller.php';
// require_once __DIR__ . '/rest/class-wpsg-analytics-controller.php';   // DC4
// require_once __DIR__ . '/rest/class-wpsg-access-controller.php';      // DC5
// require_once __DIR__ . '/rest/class-wpsg-auth-controller.php';        // DC6
// require_once __DIR__ . '/rest/class-wpsg-settings-controller.php';    // DC7
// require_once __DIR__ . '/rest/class-wpsg-content-controller.php';     // DC8
// require_once __DIR__ . '/rest/class-wpsg-system-controller.php';      // DC9

class WPSG_REST extends WPSG_REST_Base {
    // Route ordering (when DC tracks activate, WPSG_REST::register_routes() will
    // delegate to each controller in this sequence):
    //   1. WPSG_Campaign_Controller::register_routes()   — DC1
    //   2. WPSG_Export_Controller::register_routes()     — DC2
    //   3. WPSG_Media_Controller::register_routes()      — DC3
    //   4. WPSG_Analytics_Controller::register_routes()  — DC4
    //   5. WPSG_Access_Controller::register_routes()     — DC5
    //   6. WPSG_Auth_Controller::register_routes()       — DC6
    //   7. WPSG_Settings_Controller::register_routes()   — DC7
    //   8. WPSG_Content_Controller::register_routes()    — DC8
    //   9. WPSG_System_Controller::register_routes()     — DC9

    public static function register_routes() {
        WPSG_Campaign_Controller::register_routes();
        WPSG_Export_Controller::register_routes();
        WPSG_Media_Controller::register_routes();

        // P28-J: Access totals summary — will move to WPSG_Access_Controller in DC5.
        register_rest_route('wp-super-gallery/v1', '/campaigns/access-summary', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'access_summary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-H: Campaign categories
        register_rest_route('wp-super-gallery/v1', '/campaign-categories', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_campaign_categories'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign_category'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'slug' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_title',
                    ],
                    'parent_id' => [
                        'type'    => 'integer',
                        'default' => 0,
                        'minimum' => 0,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-categories/(?P<id>\d+)', [
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_campaign_category'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'slug' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_title',
                    ],
                    'parent_id' => [
                        'type'    => 'integer',
                        'minimum' => 0,
                    ],
                ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_campaign_category'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P28-O: Campaign Templates
        register_rest_route('wp-super-gallery/v1', '/campaign-templates', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_campaign_templates'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign_template'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'description' => [
                        'type'              => 'string',
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'from_campaign_id' => [
                        'type'    => 'integer',
                        'minimum' => 1,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-templates/(?P<id>[a-zA-Z0-9_]+)', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_campaign_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-templates/(?P<id>[a-zA-Z0-9_]+)/instantiate', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'instantiate_campaign_template'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        // P18-F: Analytics
        register_rest_route('wp-super-gallery/v1', '/analytics/event', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'record_analytics_event'],
                'permission_callback' => [self::class, 'rate_limit_public'],
                'args'                => [
                    'campaign_id' => [
                        'required' => true,
                        'type'     => 'integer',
                        'minimum'  => 1,
                    ],
                    'event_type'  => [
                        'type'    => 'string',
                        'enum'    => ['view', 'lightbox_open'],
                        'default' => 'view',
                    ],
                    'media_id'    => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/analytics/campaigns/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_campaign_analytics'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/analytics/campaigns/(?P<id>\d+)/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_campaign_media_analytics'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/analytics/summary', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_analytics_summary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access', [
            [
                'methods'             => 'GET',
                // P33-C: owner can read the access list for their campaign.
                'callback'            => [self::class, 'list_access'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
            [
                'methods'             => 'POST',
                // P33-C: only owner can grant access.
                'callback'            => [self::class, 'grant_access'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
                'args'                => [
                    'userId'     => [
                        'required' => true,
                        'type'     => 'integer',
                        'minimum'  => 1,
                    ],
                    'source'     => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['company', 'campaign'],
                    ],
                    'action'     => [
                        'type'    => 'string',
                        'enum'    => ['grant', 'deny'],
                        'default' => 'grant',
                    ],
                    'expires_at' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    // P33-B: per-campaign role level.
                    'access_level' => [
                        'type'    => 'string',
                        'enum'    => ['viewer', 'editor', 'owner'],
                        'default' => 'viewer',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access/(?P<userId>\d+)', [
            [
                'methods' => 'DELETE',
                // P33-C: only owner can revoke access.
                'callback' => [self::class, 'revoke_access'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
        ]);

        // P18-I: Access Request Workflow
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'submit_access_request'],
                'permission_callback' => [self::class, 'rate_limit_public'],
                'args'                => [
                    'email' => [
                        'required'          => true,
                        'type'              => 'string',
                        'format'            => 'email',
                        'sanitize_callback' => 'sanitize_email',
                    ],
                ],
            ],
            [
                'methods'             => 'GET',
                // P33-C: owner can list pending access requests for their campaign.
                'callback'            => [self::class, 'list_access_requests'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/approve', [
            [
                'methods'             => 'POST',
                // P33-C: only owner can approve access requests.
                'callback'            => [self::class, 'approve_access_request'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
                'args'                => [
                    // P33-B: role to assign on approval. Defaults to 'viewer'.
                    'access_level' => [
                        'type'    => 'string',
                        'enum'    => ['viewer', 'editor', 'owner'],
                        'default' => 'viewer',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/deny', [
            [
                'methods' => 'POST',
                // P33-C: only owner can deny access requests.
                'callback' => [self::class, 'deny_access_request'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/magic-approve', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'magic_approve_access_request'],
                'permission_callback' => [self::class, 'rate_limit_magic_approve'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/permissions', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_permissions'],
                'permission_callback' => [self::class, 'require_authenticated'],
            ],
        ]);

        // P20-K: Lightweight nonce refresh endpoint for long-running tabs.
        // Returns a fresh wp_rest nonce so the client can update its header
        // without a full page reload. Requires existing valid cookie auth.
        register_rest_route('wp-super-gallery/v1', '/nonce', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'refresh_nonce'],
                'permission_callback' => [self::class, 'require_authenticated'],
            ],
        ]);

        // P20-K: Cookie-based login endpoint so the React LoginForm modal works
        // without JWT and without redirecting to wp-login.php.
        register_rest_route('wp-super-gallery/v1', '/auth/login', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'handle_cookie_login'],
                'permission_callback' => '__return_true',
                'args'                => [
                    'username' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'password' => [
                        'required'          => true,
                        'type'              => 'string',
                    ],
                    'remember' => [
                        'type'    => 'boolean',
                        'default' => false,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/auth/logout', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'handle_cookie_logout'],
                'permission_callback' => [self::class, 'require_authenticated'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/users/search', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'search_users'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/users', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_user'],
                'permission_callback' => [self::class, 'rate_limit_authenticated'],
                'args'                => [
                    'email'       => [
                        'required'          => true,
                        'type'              => 'string',
                        'format'            => 'email',
                        'sanitize_callback' => 'sanitize_email',
                    ],
                    'displayName' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'role'        => [
                        'type'    => 'string',
                        'enum'    => ['subscriber', 'wpsg_admin'],
                        'default' => 'subscriber',
                    ],
                    'campaignId'  => [
                        'type'    => 'integer',
                        'minimum' => 1,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/roles', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_roles'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // Company management routes
        register_rest_route('wp-super-gallery/v1', '/companies', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_companies'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/companies/(?P<id>\d+)/access', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_company_access'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'grant_company_access'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    // P33-B: per-company role level propagated to all company campaigns.
                    'access_level' => [
                        'type'    => 'string',
                        'enum'    => ['viewer', 'editor', 'owner'],
                        'default' => 'viewer',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/companies/(?P<id>\d+)/access/(?P<userId>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'revoke_company_access'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/companies/(?P<id>\d+)/archive', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'archive_company'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // Public endpoint to get display settings (no auth required for frontend).
        // POST requires admin permission to update settings.
        register_rest_route('wp-super-gallery/v1', '/settings', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_public_settings'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'update_settings'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'PATCH',
                'callback' => [self::class, 'patch_settings'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // Allow oEmbed proxy as public endpoint to avoid auth/cors issues for previews.
        // If you prefer restricting this, change permission_callback accordingly.
        //
        // SECURITY NOTE: This endpoint is publicly accessible (permission_callback: '__return_true')
        // which could allow anyone to use your server as a proxy for fetching external content.
        // While SSRF mitigations are in place (HTTPS requirement, IP blocking, allowlist), this could
        // still be abused for reconnaissance or as a component in attack chains. Consider requiring
        // authentication for this endpoint or implementing rate limiting to prevent abuse. If public
        // access is intentional for preview functionality, document this security tradeoff prominently.
        register_rest_route('wp-super-gallery/v1', '/oembed', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'proxy_oembed'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
        ]);

        // P14-D/E: Health & monitoring endpoints (admin only).
        register_rest_route('wp-super-gallery/v1', '/admin/health', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_health_data'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/oembed-failures', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_oembed_failures'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'reset_oembed_failures'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P14-C: Thumbnail cache management (admin only).
        register_rest_route('wp-super-gallery/v1', '/admin/thumbnail-cache', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_thumbnail_cache_stats'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'clear_thumbnail_cache'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/thumbnail-cache/refresh', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'refresh_thumbnail_cache'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P14-G / P28-C: Campaign tags.
        register_rest_route('wp-super-gallery/v1', '/tags/campaign', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaign_tags'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_campaign_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/campaign/(?P<id>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_campaign_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // ── P15-B: Layout Template CRUD (admin) ──────────────────
        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_layout_templates'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'update_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates/(?P<templateId>[a-f0-9\-]{36})/duplicate', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'duplicate_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P15-H: Overlay image library (admin, campaign-agnostic).
        register_rest_route('wp-super-gallery/v1', '/admin/overlay-library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_overlay_library'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_overlay'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/overlay-library/(?P<id>[a-f0-9\-]{36})', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_overlay'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P22-L5: Custom font library (admin, campaign-agnostic).
        register_rest_route('wp-super-gallery/v1', '/admin/font-library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_font_library'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_font'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/font-library/(?P<id>[a-f0-9\-]{36})', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_font'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P15-B: Public read-only endpoint for rendering (no auth, ID-based only).
        register_rest_route('wp-super-gallery/v1', '/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template_public'],
                'permission_callback' => '__return_true',
            ],
        ]);

        // P39-IN1: Webhook endpoint management.
        register_rest_route('wp-super-gallery/v1', '/webhooks', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_webhook_endpoints'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_webhook_endpoint'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/webhooks/delivery-log', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_webhook_deliveries'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/webhooks/(?P<index>\d+)', [
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_webhook_endpoint'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_webhook_endpoint'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/webhooks/(?P<index>\d+)/rotate-secret', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'rotate_webhook_secret'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────
    // P18-F: Analytics
    // ─────────────────────────────────────────────────────────────────────

    /**
     * POST /analytics/event
     * Public endpoint (rate-limited). Accepts { campaign_id, event_type }.
     * Requires `enable_analytics` setting to be truthy.
     */
    public static function record_analytics_event($request) {

        // Respect the enable_analytics setting (default: disabled).
        $settings = get_option('wpsg_settings', []);
        if (empty($settings['enable_analytics'])) {
            return new WP_Error('wpsg_analytics_disabled', 'Analytics disabled', ['status' => 403]);
        }

        $campaign_id = intval($request->get_param('campaign_id'));
        $event_type  = sanitize_text_field($request->get_param('event_type') ?? 'view');

        if ($campaign_id <= 0) {
            return new WP_Error('wpsg_invalid_campaign_id', 'Invalid campaignId', ['status' => 400]);
        }
        if (!self::campaign_exists($campaign_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $allowed_events = ['view', 'lightbox_open'];
        if (!in_array($event_type, $allowed_events, true)) {
            $event_type = 'view';
        }

        $media_id_raw = $request->get_param('media_id') ?? null;
        $media_id     = ($media_id_raw !== null && $media_id_raw !== '')
            ? sanitize_text_field($media_id_raw)
            : null;

        global $wpdb;
        $ip   = $_SERVER['REMOTE_ADDR'] ?? '';
        $salt = wp_salt('auth');
        $hash = hash('sha256', $ip . $salt);

        $table = WPSG_DB::get_analytics_table();
        $row   = [
            'campaign_id'  => $campaign_id,
            'event_type'   => $event_type,
            'visitor_hash' => $hash,
            'occurred_at'  => current_time('mysql', true),
        ];
        $fmts = ['%d', '%s', '%s', '%s'];
        if ($media_id !== null) {
            $row['media_id'] = $media_id;
            $fmts[]          = '%s';
        }
        $wpdb->insert($table, $row, $fmts);

        do_action('wpsg_analytics_event', $campaign_id, $media_id, $event_type, $hash);

        return new WP_REST_Response(['recorded' => true], 201);
    }

    /**
     * GET /analytics/campaigns/{id}?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Admin-only. Returns totalViews, uniqueVisitors, daily breakdown.
     */
    public static function get_campaign_analytics($request) {
        $campaign_id = intval($request->get_param('id'));

        if (!self::campaign_exists($campaign_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $range = self::parse_analytics_date_range($request);
        if (is_wp_error($range)) {
            return $range;
        }
        [$from_str, $to_str] = $range;

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        // Aggregate per day.
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT
                    DATE(occurred_at) AS date,
                    COUNT(*) AS views,
                    COUNT(DISTINCT visitor_hash) AS unique_visitors
                FROM {$table}
                WHERE campaign_id = %d
                  AND event_type = 'view'
                  AND occurred_at BETWEEN %s AND %s
                GROUP BY DATE(occurred_at)
                ORDER BY date ASC",
                $campaign_id,
                $from_str,
                $to_str
            ),
            ARRAY_A
        );

        $total_views   = array_sum(array_column($rows, 'views'));
        $total_unique  = 0;
        if (!empty($rows)) {
            $total_unique = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT visitor_hash) FROM {$table}
                     WHERE campaign_id = %d AND event_type = 'view'
                       AND occurred_at BETWEEN %s AND %s",
                    $campaign_id,
                    $from_str,
                    $to_str
                )
            );
        }

        return new WP_REST_Response([
            'totalViews'       => (int) $total_views,
            'uniqueVisitors'   => $total_unique,
            'daily'            => array_map(function ($row) {
                return [
                    'date'    => $row['date'],
                    'views'   => (int) $row['views'],
                    'unique'  => (int) $row['unique_visitors'],
                ];
            }, $rows),
        ], 200);
    }

    /**
     * Shared date-range parser for analytics endpoints.
     * Returns [from_str, to_str] or WP_Error on invalid range.
     */
    private static function parse_analytics_date_range($request) {
        $from = sanitize_text_field($request->get_param('from') ?? '');
        $to   = sanitize_text_field($request->get_param('to') ?? '');

        $to_ts   = $to   ? strtotime($to)   : time();
        $from_ts = $from ? strtotime($from) : strtotime('-30 days', $to_ts);
        if (!$from_ts || !$to_ts || $from_ts > $to_ts) {
            return new WP_Error('wpsg_invalid_date_range', 'Invalid date range', ['status' => 400]);
        }

        return [gmdate('Y-m-d 00:00:00', $from_ts), gmdate('Y-m-d 23:59:59', $to_ts)];
    }

    /**
     * GET /analytics/campaigns/{id}/media
     * Admin-only. Returns per-media view/lightbox_open breakdown.
     */
    public static function get_campaign_media_analytics($request) {
        $campaign_id = intval($request->get_param('id'));
        if (!self::campaign_exists($campaign_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $range = self::parse_analytics_date_range($request);
        if (is_wp_error($range)) {
            return $range;
        }
        [$from_str, $to_str] = $range;

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT
                    media_id,
                    COUNT(*) AS views,
                    SUM(CASE WHEN event_type = 'lightbox_open' THEN 1 ELSE 0 END) AS lightbox_opens
                FROM {$table}
                WHERE campaign_id = %d
                  AND media_id IS NOT NULL
                  AND occurred_at BETWEEN %s AND %s
                GROUP BY media_id
                ORDER BY views DESC",
                $campaign_id,
                $from_str,
                $to_str,
            ),
            ARRAY_A,
        );

        $items = array_map(function ($row) {
            return [
                'media_id'      => $row['media_id'],
                'views'         => (int) $row['views'],
                'lightbox_opens' => (int) $row['lightbox_opens'],
            ];
        }, $rows);

        return new WP_REST_Response(['items' => $items], 200);
    }

    /**
     * GET /analytics/summary
     * Admin-only. Cross-campaign totals and top-10 campaigns by views.
     */
    public static function get_analytics_summary($request) {
        $range = self::parse_analytics_date_range($request);
        if (is_wp_error($range)) {
            return $range;
        }
        [$from_str, $to_str] = $range;

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $total_views = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$table}
                 WHERE event_type = 'view' AND occurred_at BETWEEN %s AND %s",
                $from_str,
                $to_str,
            )
        );

        $unique_visitors = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(DISTINCT visitor_hash) FROM {$table}
                 WHERE occurred_at BETWEEN %s AND %s",
                $from_str,
                $to_str,
            )
        );

        $top_rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT campaign_id, COUNT(*) AS views
                 FROM {$table}
                 WHERE event_type = 'view' AND occurred_at BETWEEN %s AND %s
                 GROUP BY campaign_id
                 ORDER BY views DESC
                 LIMIT 10",
                $from_str,
                $to_str,
            ),
            ARRAY_A,
        );

        $top_campaigns = array_map(function ($row) {
            return [
                'id'    => strval($row['campaign_id']),
                'title' => get_post_field('post_title', intval($row['campaign_id'])) ?: sprintf('Campaign #%d', $row['campaign_id']),
                'views' => (int) $row['views'],
            ];
        }, $top_rows);

        return new WP_REST_Response([
            'totalViews'     => $total_views,
            'uniqueVisitors' => $unique_visitors,
            'topCampaigns'   => $top_campaigns,
        ], 200);
    }

    /**
     * GET /media/{mediaId}/usage
     * Returns which campaigns reference this media item.
     * Uses indexed wpsg_media_refs table (P20-I-2).

    public static function list_access($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        // P28-B: include_expired=true shows grants past their expiry (hidden by default).
        $include_expired = filter_var($request->get_param('include_expired'), FILTER_VALIDATE_BOOLEAN);

        $company_term = self::get_company_term($post_id);
        $company_grants = $company_term ? get_term_meta($company_term->term_id, 'access_grants', true) : [];
        $campaign_grants = get_post_meta($post_id, 'access_grants', true);
        $overrides = get_post_meta($post_id, 'access_overrides', true);

        $company_grants = is_array($company_grants) ? $company_grants : [];
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        $overrides = is_array($overrides) ? $overrides : [];

        $deny_user_ids = array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, array_filter($overrides, function ($entry) {
            return ($entry['action'] ?? '') === 'deny';
        }));

        $now = time();
        $effective = array_values(array_filter(array_merge($company_grants, $campaign_grants), function ($entry) use ($deny_user_ids, $include_expired, $now) {
            $user_id = intval($entry['userId'] ?? 0);
            if ($user_id <= 0 || in_array($user_id, $deny_user_ids, true)) {
                return false;
            }
            // P28-B: skip expired grants unless caller asks for them.
            if (!$include_expired && !empty($entry['expires_at']) && strtotime($entry['expires_at']) < $now) {
                return false;
            }
            return true;
        }));

        // P28-F: paginate before enrichment.
        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total = count($effective);
        $page_items = array_slice($effective, $offset, $per_page);

        // Enrich only the current page with user details.
        $user_ids = array_unique(array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $page_items));

        $user_map = [];
        if (!empty($user_ids)) {
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'user_email', 'display_name', 'user_login']]);
            foreach ($users as $user) {
                $user_map[$user->ID] = [
                    'displayName' => $user->display_name,
                    'email' => $user->user_email,
                    'login' => $user->user_login,
                ];
            }
        }

        $enriched = array_map(function ($entry) use ($user_map, $now) {
            $user_id = intval($entry['userId'] ?? 0);
            if (isset($user_map[$user_id])) {
                $entry['user'] = $user_map[$user_id];
            }
            // P28-B: compute is_expired on the fly.
            $expires_at = $entry['expires_at'] ?? null;
            $entry['expires_at'] = $expires_at;
            $entry['is_expired'] = $expires_at !== null && strtotime($expires_at) < $now;
            // P33-B: normalize legacy grants that pre-date RBAC.
            $entry['access_level'] = self::validate_access_level($entry['access_level'] ?? 'viewer');
            return $entry;
        }, $page_items);

        return self::paginated_response($enriched, $total, $page, $per_page);
    }

    public static function grant_access($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $user_id = intval($request->get_param('userId'));
        $source = sanitize_text_field($request->get_param('source'));
        $action = sanitize_text_field($request->get_param('action')) ?: 'grant';

        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }

        if (!in_array($source, ['company', 'campaign'], true)) {
            return new WP_Error('wpsg_invalid_source', 'Invalid source', ['status' => 400]);
        }

        // P28-B: optional expiry — validate ISO 8601 datetime if provided.
        $expires_at_raw = $request->get_param('expires_at');
        $expires_at = null;
        if ($expires_at_raw !== null && $expires_at_raw !== '') {
            $ts = strtotime(sanitize_text_field($expires_at_raw));
            if ($ts === false) {
                return new WP_Error('wpsg_invalid_expires_at', 'expires_at must be a valid ISO 8601 datetime', ['status' => 400]);
            }
            $expires_at = gmdate('c', $ts);
        }

        // P33-B: access_level for RBAC (deny entries carry no role).
        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');

        $entry = [
            'userId'       => $user_id,
            'campaignId'   => $post_id,
            'source'       => $source,
            'grantedAt'    => gmdate('c'),
            'expires_at'   => $expires_at,
            'access_level' => $access_level,
        ];

        if ($source === 'company') {
            $company_term = self::get_company_term($post_id);
            if (!$company_term) {
                return new WP_Error('wpsg_company_not_set', 'Company not set for campaign', ['status' => 400]);
            }
            $grants = get_term_meta($company_term->term_id, 'access_grants', true);
            $grants = is_array($grants) ? $grants : [];
            $grants = self::upsert_grant($grants, $entry);
            update_term_meta($company_term->term_id, 'access_grants', $grants);
        } else {
            if ($action === 'deny') {
                $overrides = get_post_meta($post_id, 'access_overrides', true);
                $overrides = is_array($overrides) ? $overrides : [];
                $overrides = self::upsert_override($overrides, [
                    'userId' => $user_id,
                    'action' => 'deny',
                    'grantedAt' => gmdate('c'),
                ]);
                update_post_meta($post_id, 'access_overrides', $overrides);
            } else {
                $grants = get_post_meta($post_id, 'access_grants', true);
                $grants = is_array($grants) ? $grants : [];
                $grants = self::upsert_grant($grants, $entry);
                update_post_meta($post_id, 'access_grants', $grants);
            }
        }

        $audit_action = $source === 'company' ? 'access.company.granted' : ($action === 'deny' ? 'access.denied' : 'access.granted');
        self::add_audit_entry($post_id, $audit_action, [
            'userId' => $user_id,
            'source' => $source,
            'action' => $action,
        ]);

        if ($action !== 'deny') {
            do_action('wpsg_access_granted', $post_id, ['userId' => $user_id, 'source' => $source]);
        }
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Access updated'], 200);
    }

    public static function revoke_access($request) {
        $post_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));
        if (!self::campaign_exists($post_id) || $user_id <= 0) {
            return new WP_Error('wpsg_invalid_request', 'Invalid request', ['status' => 400]);
        }

        $company_term = self::get_company_term($post_id);
        if ($company_term) {
            $company_grants = get_term_meta($company_term->term_id, 'access_grants', true);
            $company_grants = is_array($company_grants) ? $company_grants : [];
            $company_grants = array_values(array_filter($company_grants, function ($entry) use ($user_id) {
                return intval($entry['userId'] ?? 0) !== $user_id;
            }));
            update_term_meta($company_term->term_id, 'access_grants', $company_grants);
        }

        $campaign_grants = get_post_meta($post_id, 'access_grants', true);
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        $campaign_grants = array_values(array_filter($campaign_grants, function ($entry) use ($user_id) {
            return intval($entry['userId'] ?? 0) !== $user_id;
        }));
        update_post_meta($post_id, 'access_grants', $campaign_grants);

        $overrides = get_post_meta($post_id, 'access_overrides', true);
        $overrides = is_array($overrides) ? $overrides : [];
        $overrides = array_values(array_filter($overrides, function ($entry) use ($user_id) {
            return intval($entry['userId'] ?? 0) !== $user_id;
        }));
        update_post_meta($post_id, 'access_overrides', $overrides);

        self::add_audit_entry($post_id, 'access.revoked', [
            'userId' => $user_id,
        ]);
        do_action('wpsg_access_revoked', $post_id, ['userId' => $user_id]);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Access revoked'], 200);
    }

    // -------------------------------------------------------------------------
    // P18-I: Access Request Workflow helpers  (D-9: now backed by custom table)
    // -------------------------------------------------------------------------

    /**
     * Format a DB row into the REST response shape expected by the frontend.
     */
    private static function format_access_request(array $row): array {
        return [
            'token'       => $row['token'],
            'email'       => $row['email'],
            'campaignId'  => (int) $row['campaign_id'],
            'campaign_id' => (int) $row['campaign_id'],
            'status'      => $row['status'],
            'requestedAt' => gmdate('c', strtotime($row['requested_at'])),
            'requested_at' => gmdate('c', strtotime($row['requested_at'])),
            'resolvedAt'  => $row['resolved_at']
                ? gmdate('c', strtotime($row['resolved_at']))
                : null,
            'resolved_at' => $row['resolved_at']
                ? gmdate('c', strtotime($row['resolved_at']))
                : null,
        ];
    }

    // -------------------------------------------------------------------------
    // P18-I: Handler methods
    // -------------------------------------------------------------------------

    /**
     * POST /campaigns/{id}/access-requests
     * Public (rate-limited) — submit an access request by email.
     */
    public static function submit_access_request($request) {
        $post_id    = intval($request->get_param('id'));
        $email      = sanitize_email($request->get_param('email') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }
        if (!is_email($email)) {
            return new WP_Error('wpsg_invalid_email', 'A valid email address is required', ['status' => 400]);
        }

        // Check for existing request (duplicate / cooldown)
        $existing = WPSG_DB::find_access_request_by_email($email, $post_id);
        if ($existing) {
            if ($existing['status'] === 'pending') {
                return new WP_Error('wpsg_request_pending', 'A request for this email is already pending.', ['status' => 409]);
            }
            if ($existing['status'] === 'denied') {
                $cooldown_seconds = 24 * 60 * 60;
                $elapsed = time() - strtotime($existing['requested_at']);
                if ($elapsed < $cooldown_seconds) {
                    return new WP_Error('wpsg_rate_limited', 'Please wait 24 hours before submitting another request.', ['status' => 429]);
                }
                // Remove stale denied request so a fresh one can be created
                WPSG_DB::delete_access_request($existing['token']);
            }
        }

        $token = wp_generate_uuid4();
        $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
        $now    = gmdate('c');

        WPSG_DB::insert_access_request([
            'token'        => $token,
            'email'        => $email,
            'campaign_id'  => $post_id,
            'status'       => 'pending',
            'requested_at' => $now,
        ]);

        // Generate magic key for one-click admin approval (P28-I).
        // 256 bits of random entropy — hash stored in DB, raw key sent in email.
        $raw_magic_key  = bin2hex(random_bytes(32));
        $magic_key_hash = hash('sha256', $raw_magic_key);
        $expires_at     = gmdate('Y-m-d H:i:s', time() + 48 * 3600);
        WPSG_DB::set_magic_key($token, $magic_key_hash, $expires_at);

        $site_name = get_bloginfo('name');

        // One-click magic link for the admin email.
        $magic_link = rest_url(
            sprintf(
                'wp-super-gallery/v1/campaigns/%d/access-requests/%s/magic-approve?magic_key=%s',
                $post_id,
                rawurlencode($token),
                rawurlencode($raw_magic_key)
            )
        );

        // Admin notification with one-click approval link.
        wp_mail(
            get_option('admin_email'),
            sprintf('[%s] Access Request — %s', $site_name, $campaign_title),
            sprintf(
                "Hello,\n\nA new access request for \"%s\" has been received from: %s\n\nClick to approve instantly (valid 48 hours):\n%s\n\nOr log in to review requests manually:\n%s\n\nThank you,\n%s",
                $campaign_title,
                $email,
                $magic_link,
                admin_url(),
                $site_name
            )
        );

        // Confirmation email to the requester.
        wp_mail(
            $email,
            sprintf('[%s] Access Request Received — %s', $site_name, $campaign_title),
            sprintf(
                "Hello,\n\nYour access request for \"%s\" has been received.\nAn administrator will review your request shortly.\n\nThank you,\n%s",
                $campaign_title,
                $site_name
            )
        );

        return new WP_REST_Response([
            'message' => 'Request submitted. Check your email for confirmation.',
            'token'   => $token,
        ], 201);
    }

    /**
     * GET /campaigns/{id}/access-requests
     * Admin — list all access requests for a campaign.
     */
    public static function list_access_requests($request) {
        $post_id = intval($request->get_param('id'));
        $status  = sanitize_text_field($request->get_param('status') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $rows = WPSG_DB::list_access_requests($post_id, $status);
        $result = array_map([self::class, 'format_access_request'], $rows);

        return new WP_REST_Response($result, 200);
    }

    /**
     * POST /campaigns/{id}/access-requests/{token}/approve
     * Admin — approve a pending access request.
     */
    public static function approve_access_request($request) {
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $data = WPSG_DB::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return new WP_Error('wpsg_request_not_found', 'Request not found', ['status' => 404]);
        }
        if ($data['status'] !== 'pending') {
            return new WP_Error('wpsg_request_resolved', 'Request already resolved', ['status' => 409]);
        }

        // P33-B: admin may specify a role; default to 'viewer'.
        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');
        $result = self::do_approve_request($post_id, $token, $data, $access_level);
        if (is_wp_error($result)) {
            return $result;
        }

        return new WP_REST_Response(['message' => 'Access request approved'], 200);
    }

    /**
     * Shared approval logic used by both the admin POST and the magic-link GET endpoints.
     *
     * Provisions or looks up the WP user, grants campaign access, updates request
     * status, fires the audit entry, and sends the requester notification email.
     *
     * @param string $access_level P33-B: role to assign ('viewer' | 'editor' | 'owner'). Defaults to 'viewer'.
     * @return true|WP_Error
     */
    private static function do_approve_request(int $post_id, string $token, array $data, string $access_level = 'viewer') {
        // Provision access: look up or create a WP user for this email.
        $user = get_user_by('email', $data['email']);
        if (!$user) {
            $username = sanitize_user(explode('@', $data['email'])[0], true);
            $base     = $username ?: 'user';
            $username = $base;
            $suffix   = 1;
            while (username_exists($username)) {
                $username = $base . $suffix++;
            }
            $user_id = wp_create_user($username, wp_generate_password(), $data['email']);
            if (is_wp_error($user_id)) {
                return new WP_Error(
                    'wpsg_user_creation_failed',
                    'Failed to create user: ' . $user_id->get_error_message(),
                    ['status' => 500]
                );
            }
            $user = get_user_by('ID', $user_id);
        }

        // Grant access (campaign-level). P33-B: persist the approved role.
        $grants = get_post_meta($post_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];
        $grants = self::upsert_grant($grants, [
            'userId'       => $user->ID,
            'campaignId'   => $post_id,
            'source'       => 'campaign',
            'grantedAt'    => gmdate('c'),
            'access_level' => self::validate_access_level($access_level),
        ]);
        update_post_meta($post_id, 'access_grants', $grants);
        self::clear_accessible_campaigns_cache();

        // Update request status.
        WPSG_DB::update_access_request_status($token, 'approved');

        self::add_audit_entry($post_id, 'access.request.approved', [
            'email'  => $data['email'],
            'userId' => $user->ID,
            'token'  => $token,
        ]);

        // Notify the requester.
        $site_name      = get_bloginfo('name');
        $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
        wp_mail(
            $data['email'],
            sprintf('[%s] Access Approved — %s', $site_name, $campaign_title),
            sprintf(
                "Hello,\n\nYour access request for \"%s\" has been approved!\nYou can now view the campaign at: %s\n\nThank you,\n%s",
                $campaign_title,
                home_url(),
                $site_name
            )
        );

        return true;
    }

    /**
     * GET /campaigns/{id}/access-requests/{token}/magic-approve?magic_key=…
     * Public (rate-limited at 10/min) — one-click approval from admin email.
     *
     * Validates the magic key, approves the request, then redirects to the
     * configured landing page or returns inline HTML if no page is set.
     */
    public static function magic_approve_access_request($request) {
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');
        $raw_key = sanitize_text_field($request->get_param('magic_key') ?? '');

        if (!self::campaign_exists($post_id)) {
            return self::magic_link_redirect('invalid');
        }

        $data = WPSG_DB::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return self::magic_link_redirect('invalid');
        }

        if ($raw_key === '' || empty($data['magic_key_hash'])) {
            return self::magic_link_redirect('invalid');
        }

        // Constant-time hash comparison prevents timing attacks.
        $expected_hash = hash('sha256', $raw_key);
        if (!hash_equals($data['magic_key_hash'], $expected_hash)) {
            return self::magic_link_redirect('invalid');
        }

        // Check TTL.
        if (!empty($data['magic_key_expires_at']) && strtotime($data['magic_key_expires_at']) < time()) {
            return self::magic_link_redirect('expired');
        }

        // Check replay (key already consumed).
        if (!empty($data['magic_key_used_at'])) {
            return self::magic_link_redirect('used');
        }

        // Request already resolved by another means.
        if ($data['status'] !== 'pending') {
            return self::magic_link_redirect('used');
        }

        // Mark consumed BEFORE processing to close the replay window.
        WPSG_DB::mark_magic_key_used($token);

        $result = self::do_approve_request($post_id, $token, $data);
        if (is_wp_error($result)) {
            return self::magic_link_redirect('invalid');
        }

        return self::magic_link_redirect('approved');
    }

    /**
     * Build a WP_REST_Response for the magic-link result. When a landing page is
     * configured a 302 redirect is returned; otherwise a 200 HTML response is
     * returned. Returns rather than calling header()/exit() so the handler is
     * testable and compatible with rest_do_request().
     */
    private static function magic_link_redirect(string $result): WP_REST_Response {
        $settings = get_option('wpsg_settings', []);
        $page_id  = intval($settings['magic_link_landing_page_id'] ?? 0);
        $page_url = $page_id ? get_permalink($page_id) : null;

        if ($page_url) {
            $redirect_url = add_query_arg('wpsg_result', rawurlencode($result), $page_url);
            $response = new WP_REST_Response(null, 302);
            $response->header('Location', $redirect_url);
            return $response;
        }

        // Inline HTML fallback — used when no landing page is configured.
        $labels = [
            'approved' => ['Access Approved',   'The access request has been approved. The user will receive a notification email.', '#16a34a'],
            'expired'  => ['Link Expired',       'This magic link has expired (valid for 48 hours). Please log in to approve requests manually.', '#d97706'],
            'used'     => ['Already Processed',  'This magic link has already been used or the request was already resolved.', '#d97706'],
            'invalid'  => ['Invalid Link',       'This magic link is invalid or the request could not be found.', '#dc2626'],
        ];
        [$title, $message, $color] = $labels[$result] ?? $labels['invalid'];

        $site_name  = esc_html(get_bloginfo('name'));
        $title_e    = esc_html($title);
        $message_e  = esc_html($message);
        $admin_url  = esc_url(admin_url());

        // phpcs:disable
        $html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>{$title_e} — {$site_name}</title>
<style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f5}.card{max-width:420px;width:100%;margin:1rem;padding:2rem;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}h1{margin:0 0 .75rem;font-size:1.4rem;color:{$color}}p{margin:0 0 1.5rem;color:#555;line-height:1.5}a{color:#3b82f6;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}</style>
</head><body><div class=\"card\"><h1>{$title_e}</h1><p>{$message_e}</p><a href=\"{$admin_url}\">Go to Admin Panel</a></div></body></html>";
        // phpcs:enable
        $response = new WP_REST_Response($html, 200);
        $response->header('Content-Type', 'text/html; charset=utf-8');
        return $response;
    }

    /**
     * POST /campaigns/{id}/access-requests/{token}/deny
     * Admin — deny a pending access request.
     */
    public static function deny_access_request($request) {
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $data = WPSG_DB::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return new WP_Error('wpsg_request_not_found', 'Request not found', ['status' => 404]);
        }
        if ($data['status'] !== 'pending') {
            return new WP_Error('wpsg_request_resolved', 'Request already resolved', ['status' => 409]);
        }

        WPSG_DB::update_access_request_status($token, 'denied');

        self::add_audit_entry($post_id, 'access.request.denied', [
            'email' => $data['email'],
            'token' => $token,
        ]);

        // Optional denial email
        $send_denial = apply_filters('wpsg_send_denial_email', true);
        if ($send_denial) {
            $site_name      = get_bloginfo('name');
            $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
            wp_mail(
                $data['email'],
                sprintf('[%s] Access Request Update — %s', $site_name, $campaign_title),
                sprintf(
                    "Hello,\n\nUnfortunately your access request for \"%s\" has not been approved at this time.\n\nThank you,\n%s",
                    $campaign_title,
                    $site_name
                )
            );
        }

        return new WP_REST_Response(['message' => 'Access request denied'], 200);
    }

    /**
     * List all companies with their campaign counts and statistics
     */
    public static function list_companies($request) {
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?? 50)));
        $offset = ($page - 1) * $per_page;

        // Transient cache (same invalidation strategy as list_campaigns).
        $cache_version = get_option('wpsg_cache_version', 0);
        $cache_key = "wpsg_companies_{$page}_{$per_page}_{$cache_version}";
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            $response = new WP_REST_Response($cached, 200);
            $total = wp_count_terms('wpsg_company', ['hide_empty' => false]);
            $response->header('X-WPSG-Total', (string) $total);
            $response->header('X-WPSG-Page', (string) $page);
            $response->header('X-WPSG-Per-Page', (string) $per_page);
            return $response;
        }

        $terms = get_terms([
            'taxonomy' => 'wpsg_company',
            'hide_empty' => false,
            'number' => $per_page,
            'offset' => $offset,
        ]);

        if (is_wp_error($terms)) {
            return new WP_Error('wpsg_internal_error', 'Failed to fetch companies', ['status' => 500]);
        }

        $companies = [];
        $term_ids = wp_list_pluck($terms, 'term_id');

        // Single query: fetch ALL campaigns assigned to ANY of the returned companies,
        // avoiding an N+1 get_posts call per company term.
        $all_campaigns = [];
        if (!empty($term_ids)) {
            $all_campaigns = get_posts([
                'post_type'      => 'wpsg_campaign',
                'posts_per_page' => -1,
                'tax_query'      => [
                    [
                        'taxonomy' => 'wpsg_company',
                        'field'    => 'term_id',
                        'terms'    => $term_ids,
                    ],
                ],
            ]);
        }

        // Prime meta + term caches in batch to eliminate N+1 queries in the loop.
        if (!empty($all_campaigns)) {
            $campaign_ids = wp_list_pluck($all_campaigns, 'ID');
            update_meta_cache('post', $campaign_ids);
            update_object_term_cache($campaign_ids, 'wpsg_company');
        }

        // Index campaigns by company term_id for O(1) lookup per company.
        $campaigns_by_term = [];
        foreach ($all_campaigns as $campaign) {
            $campaign_terms = wp_get_object_terms($campaign->ID, 'wpsg_company', ['fields' => 'ids']);
            foreach ($campaign_terms as $tid) {
                $campaigns_by_term[$tid][] = $campaign;
            }
        }

        foreach ($terms as $term) {
            $campaigns = $campaigns_by_term[$term->term_id] ?? [];

            $active_count = 0;
            $archived_count = 0;
            $campaign_list = [];

            foreach ($campaigns as $campaign) {
                $status = get_post_meta($campaign->ID, 'status', true) ?: 'active';
                if ($status === 'archived') {
                    $archived_count++;
                } else {
                    $active_count++;
                }
                $campaign_list[] = [
                    'id' => $campaign->ID,
                    'title' => $campaign->post_title,
                    'status' => $status,
                ];
            }

            // Get company-level access grants
            $company_grants = get_term_meta($term->term_id, 'access_grants', true);
            $company_grants = is_array($company_grants) ? $company_grants : [];

            $companies[] = [
                'id' => $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug,
                'campaignCount' => count($campaigns),
                'activeCampaigns' => $active_count,
                'archivedCampaigns' => $archived_count,
                'accessGrantCount' => count($company_grants),
                'campaigns' => $campaign_list,
            ];
        }

        $total       = (int) wp_count_terms('wpsg_company', ['hide_empty' => false]);
        $total_pages = $per_page > 0 ? max(1, (int) ceil($total / $per_page)) : 1;
        $response_data = [
            'items'       => $companies,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => $total_pages,
        ];

        $ttl = 300;
        if (class_exists('WPSG_Settings')) {
            $ttl = intval(WPSG_Settings::get_setting('cache_ttl') ?: 300);
        }
        set_transient($cache_key, $response_data, $ttl);

        $response = new WP_REST_Response($response_data, 200);
        $response->header('X-WPSG-Total', (string) $total);
        $response->header('X-WPSG-Page', (string) $page);
        $response->header('X-WPSG-Per-Page', (string) $per_page);
        return $response;
    }

    /**
     * List access grants for a specific company (company-level + optionally all campaign grants)
     */
    public static function list_company_access($request) {
        $start = microtime(true);
        $term_id = intval($request->get_param('id'));
        $include_campaigns = $request->get_param('include_campaigns') === 'true';

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        // Get company-level grants
        $company_grants = get_term_meta($term_id, 'access_grants', true);
        $company_grants = is_array($company_grants) ? $company_grants : [];

        // Mark each grant with its source
        $all_grants = array_map(function ($entry) use ($term) {
            $entry['source'] = 'company';
            $entry['companyId'] = $term->term_id;
            $entry['companyName'] = $term->name;
            return $entry;
        }, $company_grants);

        // If requested, also include campaign-level grants for all campaigns under this company
        if ($include_campaigns) {
            $campaigns = get_posts([
                'post_type' => 'wpsg_campaign',
                'posts_per_page' => -1,
                'tax_query' => [
                    [
                        'taxonomy' => 'wpsg_company',
                        'field' => 'term_id',
                        'terms' => $term_id,
                    ],
                ],
            ]);

            $campaign_ids = array_map(function ($campaign) {
                return intval($campaign->ID);
            }, $campaigns);

            $campaign_meta = self::get_campaign_meta_maps($campaign_ids);
            $campaign_grants_map = $campaign_meta['grants'];
            $campaign_status_map = $campaign_meta['status'];

            foreach ($campaigns as $campaign) {
                $campaign_id = intval($campaign->ID);
                $campaign_grants = $campaign_grants_map[$campaign_id] ?? [];

                foreach ($campaign_grants as $entry) {
                    $entry['source'] = 'campaign';
                    $entry['campaignId'] = $campaign_id;
                    $entry['campaignTitle'] = $campaign->post_title;
                    $entry['campaignStatus'] = $campaign_status_map[$campaign_id] ?? 'active';
                    $all_grants[] = $entry;
                }
            }
        }

        // P28-F: paginate before enrichment.
        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total      = count($all_grants);
        $page_slice = array_slice($all_grants, $offset, $per_page);

        $user_ids = array_unique(array_filter(array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $page_slice)));

        $user_map = [];
        if (!empty($user_ids)) {
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'user_email', 'display_name', 'user_login']]);
            foreach ($users as $user) {
                $user_map[$user->ID] = [
                    'displayName' => $user->display_name,
                    'email' => $user->user_email,
                    'login' => $user->user_login,
                ];
            }
        }

        $enriched = array_map(function ($entry) use ($user_map) {
            $user_id = intval($entry['userId'] ?? 0);
            if (isset($user_map[$user_id])) {
                $entry['user'] = $user_map[$user_id];
            }
            // P33-B: normalize legacy grants that pre-date RBAC.
            $entry['access_level'] = self::validate_access_level($entry['access_level'] ?? 'viewer');
            return $entry;
        }, $page_slice);

        $response = self::paginated_response($enriched, $total, $page, $per_page);
        self::log_slow_rest('companies.access', $start, [
            'companyId' => $term_id,
            'entries' => $total,
            'includeCampaigns' => $include_campaigns,
        ]);
        return $response;
    }

    /**
     * Grant company-wide access to a user
     */
    public static function grant_company_access($request) {
        $term_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }

        // P28-B: optional expiry.
        $expires_at_raw = $request->get_param('expires_at');
        $expires_at = null;
        if ($expires_at_raw !== null && $expires_at_raw !== '') {
            $ts = strtotime(sanitize_text_field($expires_at_raw));
            if ($ts === false) {
                return new WP_Error('wpsg_invalid_expires_at', 'expires_at must be a valid ISO 8601 datetime', ['status' => 400]);
            }
            $expires_at = gmdate('c', $ts);
        }

        // P33-B: access_level for RBAC.
        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');

        $grants = get_term_meta($term_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];

        $entry = [
            'userId'       => $user_id,
            'companyId'    => $term_id,
            'source'       => 'company',
            'grantedAt'    => gmdate('c'),
            'expires_at'   => $expires_at,
            'access_level' => $access_level,
        ];

        $grants = self::upsert_grant($grants, $entry);
        update_term_meta($term_id, 'access_grants', $grants);

        // Get first campaign for audit log (if any)
        $campaigns = get_posts([
            'post_type' => 'wpsg_campaign',
            'posts_per_page' => 1,
            'tax_query' => [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'term_id',
                    'terms' => $term_id,
                ],
            ],
        ]);

        if (!empty($campaigns)) {
            self::add_audit_entry($campaigns[0]->ID, 'access.company.granted', [
                'userId' => $user_id,
                'companyId' => $term_id,
                'companyName' => $term->name,
            ]);
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Company access granted'], 200);
    }

    /**
     * Revoke company-wide access for a user
     */
    public static function revoke_company_access($request) {
        $term_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }

        $grants = get_term_meta($term_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];
        $grants = array_values(array_filter($grants, function ($entry) use ($user_id) {
            return intval($entry['userId'] ?? 0) !== $user_id;
        }));
        update_term_meta($term_id, 'access_grants', $grants);

        // Get first campaign for audit log (if any)
        $campaigns = get_posts([
            'post_type' => 'wpsg_campaign',
            'posts_per_page' => 1,
            'tax_query' => [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'term_id',
                    'terms' => $term_id,
                ],
            ],
        ]);

        if (!empty($campaigns)) {
            self::add_audit_entry($campaigns[0]->ID, 'access.company.revoked', [
                'userId' => $user_id,
                'companyId' => $term_id,
                'companyName' => $term->name,
            ]);
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Company access revoked'], 200);
    }

    /**
     * Archive all campaigns under a company
     */
    public static function archive_company($request) {
        $term_id = intval($request->get_param('id'));
        $revoke_access = $request->get_param('revokeAccess') === true || $request->get_param('revokeAccess') === 'true';

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        // Get all non-archived campaigns for this company
        $campaigns = get_posts([
            'post_type' => 'wpsg_campaign',
            'posts_per_page' => -1,
            'meta_query' => [
                [
                    'key' => 'status',
                    'value' => 'archived',
                    'compare' => '!=',
                ],
            ],
            'tax_query' => [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'term_id',
                    'terms' => $term_id,
                ],
            ],
        ]);

        $archived_count = 0;
        foreach ($campaigns as $campaign) {
            update_post_meta($campaign->ID, 'status', 'archived');
            self::add_audit_entry($campaign->ID, 'campaign.archived', [
                'bulkAction' => true,
                'companyId' => $term_id,
                'companyName' => $term->name,
            ]);
            $archived_count++;
        }

        // Optionally revoke company-level access grants
        if ($revoke_access) {
            update_term_meta($term_id, 'access_grants', []);
            if (!empty($campaigns)) {
                self::add_audit_entry($campaigns[0]->ID, 'access.company.bulk_revoked', [
                    'companyId' => $term_id,
                    'companyName' => $term->name,
                ]);
            }
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response([
            'message' => "Archived {$archived_count} campaigns",
            'archivedCount' => $archived_count,
            'accessRevoked' => $revoke_access,
        ], 200);
    }

    public static function proxy_oembed($request) {

        // P14-D: Rate limiting — exempt authenticated admins.
        if (!current_user_can('manage_options')) {
            $ip = WPSG_Rate_Limiter::get_client_ip();
            $rate_check = WPSG_Rate_Limiter::check($ip, 'oembed');
            if (!$rate_check['allowed']) {
                $response = new WP_REST_Response(['message' => 'Too many requests'], 429);
                $response->header('Retry-After', (string) ($rate_check['retry_after'] ?? 60));
                return $response;
            }
        }

        $url = esc_url_raw($request->get_param('url') ?? '');
        if (empty($url)) {
            return self::error_response('url is required', 400, 'wpsg_missing_url');
        }

        $parsed = wp_parse_url($url);
        if (!is_array($parsed)) {
            return self::error_response('Invalid oEmbed URL', 400, 'wpsg_invalid_oembed_url');
        }

        // Basic SSRF mitigations: require HTTPS and block private/internal IPs.
        $host = isset($parsed['host']) ? $parsed['host'] : '';
        $scheme = isset($parsed['scheme']) ? strtolower($parsed['scheme']) : '';
        if (empty($host)) {
            return self::error_response('Invalid oEmbed URL host', 400, 'wpsg_invalid_oembed_host');
        }

        // Normalize IPv6 literals wrapped in brackets (e.g. [::1])
        if (strlen($host) > 2 && $host[0] === '[' && substr($host, -1) === ']') {
            $host = substr($host, 1, -1);
        }

        if ($scheme !== 'https') {
            return self::error_response('Only HTTPS oEmbed URLs are allowed', 400, 'wpsg_oembed_https_required');
        }

        // Allowlist of well-known oEmbed providers (allows subdomains).
        $allowlist = [
            'youtube.com', 'youtu.be', 'vimeo.com', 'twitter.com', 'x.com', 'instagram.com',
            'soundcloud.com', 'flickr.com', 'dailymotion.com', 'noembed.com', 'rumble.com', 'odysee.com'
        ];

        $allowed = false;
        foreach ($allowlist as $a) {
            if ($host === $a || substr($host, -strlen('.' . $a)) === '.' . $a) {
                $allowed = true;
                break;
            }
        }

        if (!$allowed) {
            // Resolve host and ensure it doesn't resolve to private/internal IP ranges.
            // Check both IPv4 (A) and IPv6 (AAAA) records to prevent SSRF bypass.
            $ips_to_check = [];

            // If host is already an IP address, check it directly
            if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
                $ips_to_check[] = $host;
            } else {
                // For hostnames, try DNS resolution first (includes IPv6 support)
                $dns_records = dns_get_record($host, DNS_A | DNS_AAAA);
                if ($dns_records !== false && is_array($dns_records) && count($dns_records) > 0) {
                    foreach ($dns_records as $record) {
                        if (isset($record['ip'])) {
                            $ips_to_check[] = $record['ip']; // IPv4
                        }
                        if (isset($record['ipv6'])) {
                            $ips_to_check[] = $record['ipv6']; // IPv6
                        }
                    }
                }

                // Fallback to gethostbynamel() for IPv4 if DNS resolution failed
                if (empty($ips_to_check)) {
                    $ipv4_ips = gethostbynamel($host);
                    if ($ipv4_ips !== false && is_array($ipv4_ips)) {
                        $ips_to_check = array_merge($ips_to_check, $ipv4_ips);
                    }
                }

                if (empty($ips_to_check)) {
                    return self::error_response('Unable to resolve host for oEmbed URL', 400, 'wpsg_oembed_dns_failed');
                }
            }

            foreach ($ips_to_check as $ip) {
                if (self::is_private_ip($ip)) {
                    return self::error_response('oEmbed host resolves to a private or disallowed IP', 400, 'wpsg_oembed_ssrf_blocked');
                }
            }
        }

        $cache_key = 'wpsg_oembed_' . md5($url);
        $cached = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            // If we cached a previous error result include its status if present.
            $cached_status = isset($cached['_wpsg_status']) ? intval($cached['_wpsg_status']) : 200;
            // Remove internal status marker before returning to clients.
            $out = $cached;
            if (isset($out['_wpsg_status'])) {
                unset($out['_wpsg_status']);
            }
            return new WP_REST_Response($out, $cached_status);
        }

        // H-2: DNS rebinding SSRF protection.
        // The pre-flight DNS check above validates the IP *before* the HTTP request,
        // but a DNS rebinding attack can return a public IP for the validation lookup
        // and a private IP for the actual request (TOCTOU gap). This filter re-validates
        // the resolved IP at connection time inside wp_remote_get().
        $wpsg_ssrf_filter = null;
        $wpsg_ssrf_blocked = false;
        if (!$allowed) {
            $wpsg_ssrf_filter = function ($preempt, $args, $request_url) use (&$wpsg_ssrf_blocked) {
                $req_host = wp_parse_url($request_url, PHP_URL_HOST);
                if (empty($req_host)) {
                    return $preempt;
                }

                // Collect all resolved IPs for the host
                $ips = [];
                if (filter_var($req_host, FILTER_VALIDATE_IP)) {
                    $ips[] = $req_host;
                } else {
                    $dns = dns_get_record($req_host, DNS_A | DNS_AAAA);
                    if ($dns !== false && is_array($dns)) {
                        foreach ($dns as $record) {
                            if (isset($record['ip'])) {
                                $ips[] = $record['ip'];
                            }
                            if (isset($record['ipv6'])) {
                                $ips[] = $record['ipv6'];
                            }
                        }
                    }
                    if (empty($ips)) {
                        $ipv4 = gethostbynamel($req_host);
                        if ($ipv4 !== false && is_array($ipv4)) {
                            $ips = $ipv4;
                        }
                    }
                }

                foreach ($ips as $ip) {
                    if (WPSG_REST::check_private_ip($ip)) {
                        $wpsg_ssrf_blocked = true;
                        return new WP_Error(
                            'ssrf_dns_rebind',
                            'DNS rebinding detected: host resolved to a private IP at request time'
                        );
                    }
                }

                return $preempt;
            };
            add_filter('pre_http_request', $wpsg_ssrf_filter, 10, 3);
        }

        $attempts = [];
        try {
            $result = WPSG_OEmbed_Providers::fetch($url, $parsed, $attempts);
        } finally {
            // Always remove the SSRF filter — even if fetch() throws.
            if ($wpsg_ssrf_filter !== null) {
                remove_filter('pre_http_request', $wpsg_ssrf_filter, 10);
            }
        }

        // H-2: If the SSRF filter blocked the request due to DNS rebinding,
        // return a clear 400 instead of a generic 502 failure.
        if ($wpsg_ssrf_blocked) {
            return self::error_response('DNS rebinding detected: oEmbed host resolved to a private IP', 400, 'wpsg_oembed_dns_rebind');
        }

        if (is_array($result) && !empty($result)) {
            // If provider returned an error payload, cache it for a short TTL
            // to avoid hammering external services on repeated requests.
            if (!empty($result['error'])) {
                $error_payload = $result;
                $error_payload['_wpsg_status'] = 502;
                // Log and metric: record repeated oEmbed failures
                WPSG_Logger::warning('oembed', 'oEmbed fetch returned error payload', ['url' => $url, 'attempts' => $attempts]);
                do_action('wpsg_oembed_failure', $url, $attempts);
                $count = intval(get_option('wpsg_oembed_failure_count', 0));
                update_option('wpsg_oembed_failure_count', $count + 1);
                set_transient($cache_key, $error_payload, 5 * MINUTE_IN_SECONDS);
                return new WP_REST_Response($result, 502);
            }

            // Successful fetch: cache for longer TTL
            set_transient($cache_key, $result, 6 * HOUR_IN_SECONDS);
            // P14-C/D: Fire success hook for thumbnail caching.
            do_action('wpsg_oembed_success', $url, $result);
            return new WP_REST_Response($result, 200);
        }

        // Cache generic failure to avoid repeated immediate retries
        $fallback = [
            'message' => 'Unable to fetch oEmbed',
        ];
        $fallback['_wpsg_status'] = 502;
        // Log and metric: record generic fallback cache
        WPSG_Logger::warning('oembed', 'oEmbed fetch failed, caching generic fallback', ['url' => $url, 'attempts' => $attempts]);
        do_action('wpsg_oembed_failure', $url, $attempts);
        $count = intval(get_option('wpsg_oembed_failure_count', 0));
        update_option('wpsg_oembed_failure_count', $count + 1);
        set_transient($cache_key, $fallback, 5 * MINUTE_IN_SECONDS);
        // Do not expose internal cache metadata to clients.
        $out_fallback = $fallback;
        unset($out_fallback['_wpsg_status']);
        return new WP_REST_Response($out_fallback, 502);
    }


    public static function list_permissions() {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return new WP_REST_Response(['campaignIds' => [], 'isAdmin' => false], 200);
        }

        $campaign_ids = self::get_accessible_campaign_ids($user_id);
        $is_admin = current_user_can('manage_wpsg');
        $user = get_user_by('id', $user_id);

        // P20-K: Include userId and userEmail so the nonce-only auth path
        // (no JWT provider) can detect the current user without localStorage.
        return new WP_REST_Response([
            'campaignIds' => $campaign_ids,
            'isAdmin'     => $is_admin,
            'userId'      => $user_id,
            'userEmail'   => $user ? $user->user_email : '',
        ], 200);
    }

    /**
     * Return a fresh wp_rest nonce for long-running browser tabs.
     *
     * The client's useNonceHeartbeat hook calls this endpoint periodically
     * to refresh its X-WP-Nonce before the default 24-hour expiry window.
     *
     * @since 0.18.0 P20-K
     * @return WP_REST_Response
     */
    public static function refresh_nonce() {
        return new WP_REST_Response([
            'nonce' => wp_create_nonce('wp_rest'),
        ], 200);
    }

    /**
     * Cookie-based login via wp_signon().
     *
     * Allows the React LoginForm modal to authenticate without JWT and
     * without redirecting to wp-login.php. On success the response sets
     * the WordPress auth cookie (HttpOnly, same-origin) and returns a
     * fresh wp_rest nonce so the client can make authenticated REST
     * requests immediately.
     *
     * Rate-limited via rate_limit_public (default 60 req/min).
     *
     * @since 0.18.0 P20-K
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public static function handle_cookie_login($request) {
        // Rate-limit like any public endpoint.
        $rate_check = self::rate_limit_public($request);
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }

        // CSRF protection: verify Origin or Referer header matches the site URL.
        // Without this, an attacker could craft a cross-origin form POST that
        // logs a victim into an attacker-controlled account (login CSRF).
        $site_host = wp_parse_url(home_url(), PHP_URL_HOST);
        $origin    = isset($_SERVER['HTTP_ORIGIN']) ? wp_parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST) : '';
        $referer   = isset($_SERVER['HTTP_REFERER']) ? wp_parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '';
        if ( $origin !== $site_host && $referer !== $site_host ) {
            return new WP_REST_Response([
                'code'    => 'csrf_failed',
                'message' => 'Cross-origin login requests are not allowed.',
            ], 403);
        }

        $username = $request->get_param('username');
        $password = $request->get_param('password');
        $remember = (bool) $request->get_param('remember');

        $creds = [
            'user_login'    => $username,
            'user_password' => $password,
            'remember'      => $remember,
        ];

        // Capture the new logged-in cookie into $_COOKIE within this request.
        // wp_set_auth_cookie() (called by wp_signon) sends Set-Cookie headers
        // to the browser but does NOT update the $_COOKIE superglobal. Without
        // this, wp_create_nonce('wp_rest') generates a nonce tied to the wrong
        // session token, causing "Cookie check failed" 403s on subsequent calls.
        add_action('set_logged_in_cookie', static function ($cookie_value) {
            $_COOKIE[ LOGGED_IN_COOKIE ] = $cookie_value;
        });

        // wp_signon() validates credentials and sets the auth cookie via Set-Cookie headers.
        $user = wp_signon($creds, is_ssl());

        if (is_wp_error($user)) {
            // Fire the standard hook so brute-force plugins can act.
            /** This action is documented in wp-includes/user.php */
            do_action('wp_login_failed', $username, $user);

            self::add_audit_entry(0, 'auth.login_failed', [
                'login' => sanitize_text_field($username ?? ''),
            ], [
                'scope'         => 'system',
                'severity'      => 'warning',
                'summary'       => 'Failed login attempt: ' . sanitize_text_field($username ?? '(unknown)'),
                'resource_type' => 'user',
            ]);

            return new WP_REST_Response([
                'code'    => 'invalid_credentials',
                'message' => 'Invalid username or password.',
            ], 401);
        }

        // Explicitly set the current user so subsequent calls
        // (wp_create_nonce, current_user_can, etc.) work in this request.
        wp_set_current_user($user->ID);

        self::add_audit_entry(0, 'auth.login_success', [
            'userId' => $user->ID,
            'login'  => $user->user_login,
        ], [
            'scope'          => 'system',
            'summary'        => "Login: {$user->user_login}",
            'resource_type'  => 'user',
            'resource_id'    => (string) $user->ID,
            'resource_label' => $user->user_login,
        ]);

        $is_admin = current_user_can('manage_wpsg');
        $campaign_ids = self::get_accessible_campaign_ids($user->ID);

        return new WP_REST_Response([
            'user'        => [
                'id'    => (string) $user->ID,
                'email' => $user->user_email,
                'role'  => $is_admin ? 'admin' : 'viewer',
            ],
            'permissions' => $campaign_ids,
            'isAdmin'     => $is_admin,
            'nonce'       => wp_create_nonce('wp_rest'),
        ], 200);
    }

    /**
     * Cookie-based logout. Clears WordPress auth cookies and destroys
     * the session. Returns a guest-level nonce for subsequent requests.
     *
     * @since 0.18.0 P20-K
     * @return WP_REST_Response
     */
    public static function handle_cookie_logout() {
        $logout_user    = wp_get_current_user();
        $logout_user_id = $logout_user->ID ?? 0;
        $logout_login   = $logout_user->user_login ?? '';

        if ($logout_user_id > 0) {
            self::add_audit_entry(0, 'auth.logout', [
                'userId' => $logout_user_id,
                'login'  => $logout_login,
            ], [
                'scope'          => 'system',
                'summary'        => "Logout: {$logout_login}",
                'resource_type'  => 'user',
                'resource_id'    => (string) $logout_user_id,
                'resource_label' => $logout_login,
            ]);
        }

        wp_logout();

        // wp_logout() calls wp_clear_auth_cookie() which sends Set-Cookie
        // headers to expire browser cookies, but $_COOKIE still holds the old
        // values within this request. Clear them so wp_create_nonce('wp_rest')
        // generates a valid guest-level nonce (UID 0, empty session token).
        $_COOKIE[ LOGGED_IN_COOKIE ]  = ' ';
        $_COOKIE[ AUTH_COOKIE ]       = ' ';
        $_COOKIE[ SECURE_AUTH_COOKIE ] = ' ';

        return new WP_REST_Response([
            'loggedOut' => true,
            'nonce'     => wp_create_nonce('wp_rest'),
        ], 200);
    }

    /**
     * Search WordPress users for the access management UI.
     * Returns matching users with id, email, and display name.
     *
     * @return WP_REST_Response List of matching users.
     */
    public static function search_users($request) {
        $search = sanitize_text_field($request->get_param('search') ?? '');
        $per_page = min(intval($request->get_param('per_page') ?? 20), 50);

        $args = [
            'number' => $per_page,
            'orderby' => 'display_name',
            'order' => 'ASC',
        ];

        if (!empty($search)) {
            $args['search'] = '*' . $search . '*';
            $args['search_columns'] = ['user_login', 'user_email', 'display_name'];
        }

        $user_query = new WP_User_Query($args);
        $users = [];

        foreach ($user_query->get_results() as $user) {
            $users[] = [
                'id' => $user->ID,
                'email' => $user->user_email,
                'displayName' => $user->display_name,
                'login' => $user->user_login,
                'isAdmin' => user_can($user->ID, 'manage_wpsg'),
            ];
        }

        return new WP_REST_Response([
            'users' => $users,
            'total' => $user_query->get_total(),
        ], 200);
    }

    /**
     * Create a new WordPress user.
     * Sends password setup email to the user.
     *
     * @return WP_REST_Response User creation result.
     */
    public static function create_user($request) {
        $email = sanitize_email($request->get_param('email') ?? '');
        $display_name = sanitize_text_field($request->get_param('displayName') ?? '');
        $role = sanitize_text_field($request->get_param('role') ?? 'subscriber');
        $campaign_id = intval($request->get_param('campaignId') ?? 0);

        // Validate required fields
        if (empty($email) || !is_email($email)) {
            return new WP_Error('wpsg_invalid_email', 'Valid email is required.', ['status' => 400]);
        }

        if (empty($display_name)) {
            return new WP_Error('wpsg_missing_display_name', 'Display name is required.', ['status' => 400]);
        }

        // Check if email already exists
        if (email_exists($email)) {
            return new WP_Error('wpsg_user_exists', 'A user with this email already exists.', ['status' => 409]);
        }

        // Validate role exists and prevent privilege escalation
        $allowed_roles = ['subscriber', 'wpsg_admin'];
        if (!in_array($role, $allowed_roles, true)) {
            return new WP_Error('wpsg_invalid_role', 'Invalid role. Allowed: subscriber, wpsg_admin.', ['status' => 400]);
        }

        // Generate username from email (before @)
        $username = sanitize_user(explode('@', $email)[0], true);
        $base_username = $username;
        $counter = 1;
        while (username_exists($username)) {
            $username = $base_username . $counter;
            $counter++;
        }

        // Generate temporary password (required by WordPress, but user will set their own via reset link)
        // This password is never exposed or used - it's immediately superseded by the password reset flow
        $password = wp_generate_password(24, true, true);

        // Create user account
        $user_id = wp_insert_user([
            'user_login' => $username,
            'user_email' => $email,
            'user_pass' => $password,
            'display_name' => $display_name,
            'role' => $role,
        ]);

        if (is_wp_error($user_id)) {
            return new WP_Error('wpsg_internal_error', $user_id->get_error_message(), ['status' => 500]);
        }

        // Send password reset email so user can set their own password
        // Note: wp_new_user_notification() with 'user' param sends a password reset link, not the password
        $email_sent = false;
        
        // Allow testing email failure scenario via request param (debug only)
        $simulate_email_failure = false;
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $simulate_param = $request->get_param('simulateEmailFailure');
            $simulate_email_failure = ($simulate_param === true || $simulate_param === 'true');
        }
        
        if (!$simulate_email_failure) {
            try {
                // Send password reset email to user
                wp_new_user_notification($user_id, null, 'user');
                $email_sent = true;
            } catch (Exception $e) {
                $email_sent = false;
            }
        }

        // If campaign_id provided, grant access
        $access_granted = false;
        if ($campaign_id > 0 && self::campaign_exists($campaign_id)) {
            $grants = get_post_meta($campaign_id, 'access_grants', true);
            if (!is_array($grants)) {
                $grants = [];
            }
            // Check if not already granted
            $already_granted = false;
            foreach ($grants as $grant) {
                if (isset($grant['userId']) && intval($grant['userId']) === $user_id) {
                    $already_granted = true;
                    break;
                }
            }
            if (!$already_granted) {
                $grants[] = [
                    'userId' => $user_id,
                    'grantedAt' => current_time('mysql'),
                    'grantedBy' => get_current_user_id(),
                ];
                update_post_meta($campaign_id, 'access_grants', $grants);
                self::add_audit_entry($campaign_id, 'access.granted', [
                    'userId' => $user_id,
                    'email' => $email,
                    'source' => 'quick_add_user',
                ]);
                self::clear_accessible_campaigns_cache();
                $access_granted = true;
            }
        }

        // Add audit entry for user creation
        if ($campaign_id > 0) {
            self::add_audit_entry($campaign_id, 'user.created', [
                'userId' => $user_id,
                'email' => $email,
                'role' => $role,
            ]);
        }

        $response = [
            'message' => 'User created successfully.',
            'userId' => $user_id,
            'username' => $username,
            'email' => $email,
            'emailSent' => $email_sent,
            'accessGranted' => $access_granted,
        ];

        // If email failed, generate password reset link instead of exposing password
        if (!$email_sent) {
            // Generate a password reset key
            $reset_key = get_password_reset_key(new WP_User($user_id));
            
            if (!is_wp_error($reset_key)) {
                // Build password reset URL
                $reset_url = network_site_url("wp-login.php?action=rp&key=$reset_key&login=" . rawurlencode($username), 'login');
                
                $response['resetUrl'] = $reset_url;
                $response['message'] = 'User created but email failed. Use the password reset link to set up the account.';
                $response['emailFailed'] = true;
            } else {
                // If reset key generation also fails, we have a bigger problem
                $response['message'] = 'User created but email and password reset failed. Please use WordPress admin to reset password.';
                $response['emailFailed'] = true;
                $response['resetFailed'] = true;
            }
        }

        return new WP_REST_Response($response, 201);
    }

    /**
     * List available roles for user creation.
     *
     * @return WP_REST_Response Available roles.
     */
    public static function list_roles($request) {
        // Only return roles that can be assigned via quick add
        $roles = [
            [
                'value' => 'subscriber',
                'label' => 'Viewer',
                'description' => 'Can view campaigns they are granted access to.',
            ],
            [
                'value' => 'wpsg_admin',
                'label' => 'Gallery Admin',
                'description' => 'Can manage campaigns and access in this plugin, but not WordPress admin.',
            ],
        ];

        // P28-F: paginated shape for consistency.
        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total      = count($roles);
        $page_items = array_slice($roles, $offset, $per_page);

        return self::paginated_response($page_items, $total, $page, $per_page);
    }

    /**
     * Get public display settings for frontend consumption.
     * Admins get all settings; non-admins get display settings only.
     *
     * Uses WPSG_Settings::to_js() for DRY snake→camel conversion.
     *
     * @return WP_REST_Response Settings data.
     */
    public static function get_public_settings($request = null) {
        if (class_exists('WPSG_Settings')) {
            $settings = WPSG_Settings::get_settings();
        } else {
            $settings = [];
        }

        $is_admin = current_user_can('manage_options');
        $payload  = WPSG_Settings::to_js($settings, $is_admin);
        return self::respond_with_etag($request, $payload);
    }

    /**
     * Update settings (admin only).
     *
     * Uses WPSG_Settings::from_js() for DRY camel→snake conversion
     * and WPSG_Settings::to_js() for the response.
     *
     * @return WP_REST_Response Updated settings.
     */
    public static function update_settings($request) {
        if (!class_exists('WPSG_Settings')) {
            return new WP_Error('wpsg_internal_error', 'Settings not available', ['status' => 500]);
        }
        $body      = $request->get_json_params();
        $input     = WPSG_Settings::from_js($body);
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $current   = WPSG_Settings::get_settings();
        $merged    = array_merge($current, $sanitized);

        $changed_keys = array_keys(array_filter($sanitized, function ($v, $k) use ($current) {
            return !array_key_exists($k, $current) || $current[$k] !== $v;
        }, ARRAY_FILTER_USE_BOTH));

        update_option(WPSG_Settings::OPTION_NAME, $merged);
        self::bump_cache_version();

        if (!empty($changed_keys)) {
            self::add_audit_entry(0, 'settings.updated', [
                'changedKeys' => $changed_keys,
            ], [
                'scope'   => 'system',
                'summary' => 'App settings updated: ' . implode(', ', $changed_keys),
            ]);
        }

        return new WP_REST_Response(
            WPSG_Settings::to_js(WPSG_Settings::get_settings(), true),
            200
        );
    }

    public static function patch_settings($request) {
        if (!class_exists('WPSG_Settings')) {
            return new WP_Error('wpsg_internal_error', 'Settings not available', ['status' => 500]);
        }
        $body      = $request->get_json_params() ?: [];
        $input     = WPSG_Settings::from_js($body);
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $current   = WPSG_Settings::get_settings();
        $applied   = array_intersect_key($sanitized, $input);

        $changed_keys = array_keys(array_filter($applied, function ($v, $k) use ($current) {
            return !array_key_exists($k, $current) || $current[$k] !== $v;
        }, ARRAY_FILTER_USE_BOTH));

        // Only merge the keys the caller actually sent.
        $merged = array_merge($current, $applied);
        update_option(WPSG_Settings::OPTION_NAME, $merged);
        self::bump_cache_version();

        if (!empty($changed_keys)) {
            self::add_audit_entry(0, 'settings.updated', [
                'changedKeys' => $changed_keys,
            ], [
                'scope'   => 'system',
                'summary' => 'App settings patched: ' . implode(', ', $changed_keys),
            ]);
        }

        return new WP_REST_Response(
            WPSG_Settings::to_js(WPSG_Settings::get_settings(), true),
            200
        );
    }

    /**
     * Read a stored Y-m-d H:i:s UTC meta value and return ISO 8601 string (or '').
     */
    private static function get_campaign_meta_maps($campaign_ids) {
        $campaign_ids = array_values(array_filter(array_map('intval', $campaign_ids)));
        if (empty($campaign_ids)) {
            return [
                'grants' => [],
                'status' => [],
            ];
        }

        global $wpdb;
        $placeholders = implode(', ', array_fill(0, count($campaign_ids), '%d'));
        $params = array_merge($campaign_ids, ['access_grants', 'status']);
        $sql = $wpdb->prepare(
            "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE post_id IN ({$placeholders}) AND meta_key IN (%s, %s)",
            $params
        );

        $rows = $wpdb->get_results($sql);
        $grants = [];
        $status = [];

        foreach ($rows as $row) {
            $post_id = intval($row->post_id);
            if ($row->meta_key === 'access_grants') {
                $value = maybe_unserialize($row->meta_value);
                $grants[$post_id] = is_array($value) ? $value : [];
            } elseif ($row->meta_key === 'status') {
                $status_value = is_string($row->meta_value) && $row->meta_value !== '' ? $row->meta_value : 'active';
                $status[$post_id] = $status_value;
            }
        }

        return [
            'grants' => $grants,
            'status' => $status,
        ];
    }

    private static function upsert_grant($grants, $entry) {
        $user_id = intval($entry['userId']);
        $filtered = array_filter($grants, function ($item) use ($user_id) {
            return intval($item['userId'] ?? 0) !== $user_id;
        });
        $filtered[] = $entry;
        return array_values($filtered);
    }

    private static function upsert_override($overrides, $entry) {
        $user_id = intval($entry['userId']);
        $filtered = array_filter($overrides, function ($item) use ($user_id) {
            return intval($item['userId'] ?? 0) !== $user_id;
        });
        $filtered[] = $entry;
        return array_values($filtered);
    }

    /**
     * Write a canonical audit entry.
     *
     * @param int   $post_id Campaign post ID (0 for system-scope events).
     * @param string $action  Dot-namespaced event key.
     * @param array  $details Arbitrary context payload.
     * @param array  $ctx     P40-CT1 canonical fields:
     *   severity       string  'info'|'warning'|'error'  (default 'info')
     *   scope          string  'campaign'|'system'        (default 'campaign')
     *   summary        string  Human-readable summary     (default '')
     *   resource_type  string  Resource category          (default '')
     *   resource_id    string  Resource identifier        (default '')
     *   resource_label string  Human-readable resource    (default '')
     *   source         string  Origin layer               (default 'rest')

    public static function get_thumbnail_cache_stats() {
        $stats = WPSG_Thumbnail_Cache::get_stats();
        return new WP_REST_Response($stats, 200);
    }

    public static function clear_thumbnail_cache() {
        $removed = WPSG_Thumbnail_Cache::clear_all();
        return new WP_REST_Response(['cleared' => $removed], 200);
    }

    public static function refresh_thumbnail_cache() {
        $result = WPSG_Thumbnail_Cache::refresh_all();
        return new WP_REST_Response($result, 200);
    }

    // --- P14-D/E: Health & monitoring endpoints ---

    public static function get_health_data() {
        $health = WPSG_Monitoring::get_health_data();
        return new WP_REST_Response($health, 200);
    }

    public static function get_oembed_failures() {
        $failures = WPSG_Monitoring::get_oembed_failures();
        return new WP_REST_Response($failures, 200);
    }

    public static function reset_oembed_failures($request) {
        $provider = sanitize_text_field($request->get_param('provider') ?? '');
        WPSG_Monitoring::reset_oembed_failures($provider ?: null);
        return new WP_REST_Response(['reset' => true], 200);
    }

    // --- P14-G: Tag endpoints ---

    public static function list_campaign_tags($request) {
        [$page, $per_page, $offset] = self::parse_pagination($request);

        $total = (int) wp_count_terms('wpsg_campaign_tag', ['hide_empty' => false]);

        $terms = get_terms([
            'taxonomy'   => 'wpsg_campaign_tag',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
            'number'     => $per_page,
            'offset'     => $offset,
        ]);

        if (is_wp_error($terms)) {
            return self::paginated_response([], 0, $page, $per_page);
        }

        $items = array_map(function ($term) {
            return [
                'id'    => $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
            ];
        }, $terms);

        return self::paginated_response($items, $total, $page, $per_page);
    }

    public static function list_campaign_templates($request) {
        $builtins = WPSG_Campaign_Templates::get_builtins();
        $user     = WPSG_Campaign_Templates::get_user_templates();
        return new WP_REST_Response(['items' => array_merge($builtins, $user)], 200);
    }

    public static function create_campaign_template($request) {
        $name        = sanitize_text_field($request->get_param('name'));
        $description = sanitize_text_field($request->get_param('description') ?? '');
        $from_id     = intval($request->get_param('from_campaign_id') ?? 0);

        $meta = [
            'visibility'       => 'private',
            'gallery_overrides' => null,
            'layout_template_id' => null,
        ];

        if ($from_id > 0) {
            $source = get_post($from_id);
            if (!$source || $source->post_type !== 'wpsg_campaign') {
                return new WP_Error('wpsg_campaign_not_found', 'Source campaign not found', ['status' => 404]);
            }
            $meta['visibility']           = get_post_meta($from_id, 'visibility', true) ?: 'private';
            $meta['gallery_overrides']    = get_post_meta($from_id, '_wpsg_gallery_overrides', true) ?: null;
            $meta['layout_template_id']   = get_post_meta($from_id, '_wpsg_layout_binding_template_id', true) ?: null;
        }

        $post_id = wp_insert_post([
            'post_type'    => 'wpsg_campaign',
            'post_title'   => $name,
            'post_content' => $description,
            'post_status'  => 'publish',
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('wpsg_internal_error', $post_id->get_error_message(), ['status' => 500]);
        }

        update_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, '1');
        update_post_meta($post_id, 'visibility', $meta['visibility']);
        if ($meta['gallery_overrides'] !== null) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', $meta['gallery_overrides']);
        }
        if ($meta['layout_template_id'] !== null) {
            update_post_meta($post_id, '_wpsg_layout_binding_template_id', $meta['layout_template_id']);
        }

        $post = get_post($post_id);
        return new WP_REST_Response(WPSG_Campaign_Templates::post_to_template($post), 201);
    }

    public static function delete_campaign_template($request) {
        $id = sanitize_text_field($request->get_param('id'));

        if (WPSG_Campaign_Templates::is_builtin($id)) {
            return new WP_Error('wpsg_forbidden', 'Built-in templates cannot be deleted', ['status' => 403]);
        }

        $post_id = intval($id);
        $post    = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_Error('wpsg_not_found', 'Template not found', ['status' => 404]);
        }
        if (!get_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, true)) {
            return new WP_Error('wpsg_not_found', 'Template not found', ['status' => 404]);
        }

        wp_delete_post($post_id, true);
        return new WP_REST_Response(['deleted' => true, 'id' => $id], 200);
    }

    public static function instantiate_campaign_template($request) {
        $id   = sanitize_text_field($request->get_param('id'));
        $name = sanitize_text_field($request->get_param('name'));

        if (WPSG_Campaign_Templates::is_builtin($id)) {
            $tpl = WPSG_Campaign_Templates::get_builtin($id);
        } else {
            $post_id = intval($id);
            $post    = get_post($post_id);
            if (!$post || $post->post_type !== 'wpsg_campaign' || !get_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, true)) {
                return new WP_Error('wpsg_not_found', 'Template not found', ['status' => 404]);
            }
            $tpl = WPSG_Campaign_Templates::post_to_template($post);
        }

        $settings = $tpl['settings'] ?? [];

        $new_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $name,
            'post_status' => 'publish',
        ], true);

        if (is_wp_error($new_id)) {
            return new WP_Error('wpsg_internal_error', $new_id->get_error_message(), ['status' => 500]);
        }

        update_post_meta($new_id, 'visibility', $settings['visibility'] ?? 'private');
        update_post_meta($new_id, 'status', 'draft');
        if (!empty($settings['galleryOverrides'])) {
            update_post_meta($new_id, '_wpsg_gallery_overrides', $settings['galleryOverrides']);
        }
        if (!empty($settings['layoutTemplateId'])) {
            update_post_meta($new_id, '_wpsg_layout_binding_template_id', $settings['layoutTemplateId']);
        }

        return new WP_REST_Response(self::format_campaign(get_post($new_id)), 201);
    }

    private static function format_term($term) {
        return [
            'id'        => strval($term->term_id),
            'name'      => $term->name,
            'slug'      => $term->slug,
            'count'     => (int) $term->count,
            'parent_id' => (int) $term->parent,
        ];
    }

    private static function taxonomy_label(string $taxonomy): string {
        $labels = [
            'wpsg_campaign_category' => 'Campaign category',
            'wpsg_campaign_tag'      => 'Campaign tag',
            'wpsg_media_tag'         => 'Media tag',
        ];
        return $labels[$taxonomy] ?? $taxonomy;
    }

    private static function handle_term_insert($name, $slug, $taxonomy, $created_status = 201, $parent_id = 0) {
        $name = sanitize_text_field($name ?? '');
        if ($name === '') {
            return new WP_Error('wpsg_missing_name', 'name is required', ['status' => 400]);
        }
        $args = [];
        if ($slug !== null && $slug !== '') {
            $args['slug'] = sanitize_title($slug);
        }
        if ($parent_id > 0) {
            $args['parent'] = $parent_id;
        }
        $result = wp_insert_term($name, $taxonomy, $args);
        if (is_wp_error($result)) {
            $code = $result->get_error_code();
            if ($code === 'term_exists' || $code === 'duplicate_term_slug') {
                return new WP_Error('wpsg_term_exists', 'A term with that name or slug already exists', ['status' => 409]);
            }
            return new WP_Error('wpsg_internal_error', $result->get_error_message(), ['status' => 500]);
        }
        $label = self::taxonomy_label($taxonomy);
        self::add_audit_entry(0, 'taxonomy.term_created', [
            'taxonomy' => $taxonomy,
            'name'     => $name,
            'termId'   => strval($result['term_id']),
        ], [
            'scope'          => 'system',
            'summary'        => "{$label} created: {$name}",
            'resource_type'  => 'taxonomy',
            'resource_id'    => strval($result['term_id']),
            'resource_label' => $name,
        ]);
        $term = get_term($result['term_id'], $taxonomy);
        return new WP_REST_Response(self::format_term($term), $created_status);
    }

    private static function handle_term_delete($term_id, $taxonomy) {
        $term_id = intval($term_id);
        $term = get_term($term_id, $taxonomy);
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_not_found', 'Term not found', ['status' => 404]);
        }
        $term_name = $term->name;
        $result = wp_delete_term($term_id, $taxonomy);
        if (is_wp_error($result) || $result === false) {
            return new WP_Error('wpsg_internal_error', 'Failed to delete term', ['status' => 500]);
        }
        $label = self::taxonomy_label($taxonomy);
        self::add_audit_entry(0, 'taxonomy.term_deleted', [
            'taxonomy' => $taxonomy,
            'name'     => $term_name,
            'termId'   => strval($term_id),
        ], [
            'scope'          => 'system',
            'summary'        => "{$label} deleted: {$term_name}",
            'resource_type'  => 'taxonomy',
            'resource_id'    => strval($term_id),
            'resource_label' => $term_name,
        ]);
        return new WP_REST_Response(['deleted' => true, 'id' => strval($term_id)], 200);
    }

    public static function create_campaign_category(WP_REST_Request $request) {
        return self::handle_term_insert(
            $request->get_param('name'),
            $request->get_param('slug'),
            'wpsg_campaign_category',
            201,
            (int) ($request->get_param('parent_id') ?? 0),
        );
    }

    public static function update_campaign_category(WP_REST_Request $request) {
        $term_id = intval($request->get_param('id'));
        $term    = get_term($term_id, 'wpsg_campaign_category');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_not_found', 'Category not found', ['status' => 404]);
        }
        $args = [];
        $name      = $request->get_param('name');
        $slug      = $request->get_param('slug');
        $parent_id = $request->get_param('parent_id');
        if ($name !== null) {
            $args['name'] = sanitize_text_field($name);
        }
        if ($slug !== null) {
            $args['slug'] = sanitize_title($slug);
        }
        if ($parent_id !== null) {
            $args['parent'] = (int) $parent_id;
        }
        if (empty($args)) {
            return new WP_Error('wpsg_bad_request', 'Provide name, slug, or parent_id to update', ['status' => 400]);
        }
        $result = wp_update_term($term_id, 'wpsg_campaign_category', $args);
        if (is_wp_error($result)) {
            $code = $result->get_error_code();
            if ($code === 'term_exists' || $code === 'duplicate_term_slug') {
                return new WP_Error('wpsg_term_exists', 'A category with that name or slug already exists', ['status' => 409]);
            }
            return new WP_Error('wpsg_internal_error', $result->get_error_message(), ['status' => 500]);
        }
        $updated_term = get_term($result['term_id'], 'wpsg_campaign_category');
        $updated_name = $updated_term ? $updated_term->name : ($args['name'] ?? '');
        self::add_audit_entry(0, 'taxonomy.term_updated', [
            'taxonomy' => 'wpsg_campaign_category',
            'name'     => $updated_name,
            'termId'   => strval($term_id),
        ], [
            'scope'          => 'system',
            'summary'        => "Campaign category updated: {$updated_name}",
            'resource_type'  => 'taxonomy',
            'resource_id'    => strval($term_id),
            'resource_label' => $updated_name,
        ]);
        return new WP_REST_Response(self::format_term($updated_term), 200);
    }

    public static function delete_campaign_category(WP_REST_Request $request) {
        return self::handle_term_delete($request->get_param('id'), 'wpsg_campaign_category');
    }

    public static function create_campaign_tag(WP_REST_Request $request) {
        return self::handle_term_insert(
            $request->get_param('name'),
            $request->get_param('slug'),
            'wpsg_campaign_tag',
        );
    }

    public static function delete_campaign_tag(WP_REST_Request $request) {
        return self::handle_term_delete($request->get_param('id'), 'wpsg_campaign_tag');
    }
     */
    public static function list_layout_templates($request) {
        $templates = WPSG_Layout_Templates::get_all();
        return new WP_REST_Response(array_values($templates), 200);
    }

    /**
     * Create a new layout template (admin).
     */
    public static function create_layout_template($request) {
        $data   = $request->get_json_params();
        $result = WPSG_Layout_Templates::create($data);

        if (is_wp_error($result)) {
            return $result;
        }

        $tmpl_name = $result['name'] ?? '';
        self::add_audit_entry(0, 'layout_template.created', [
            'templateId' => $result['id'] ?? '',
            'name'       => $tmpl_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template created: {$tmpl_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $result['id'] ?? '',
            'resource_label' => $tmpl_name,
        ]);

        return new WP_REST_Response($result, 201);
    }

    /**
     * Get a single layout template (admin).
     */
    public static function get_layout_template($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);

        if (!$template) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }

        return new WP_REST_Response($template, 200);
    }

    /**
     * Update a layout template (admin).
     */
    public static function update_layout_template($request) {
        $id     = $request->get_param('templateId');
        $data   = $request->get_json_params();
        $result = WPSG_Layout_Templates::update($id, $data);

        if (is_wp_error($result)) {
            return $result;
        }
        self::bump_cache_version();

        $tmpl_name = $result['name'] ?? '';
        self::add_audit_entry(0, 'layout_template.updated', [
            'templateId' => $id,
            'name'       => $tmpl_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template updated: {$tmpl_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $id,
            'resource_label' => $tmpl_name,
        ]);

        return new WP_REST_Response($result, 200);
    }

    /**
     * Delete a layout template (admin).
     */
    public static function delete_layout_template($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);
        $tmpl_name = $template ? ($template['name'] ?? $id) : $id;

        $deleted = WPSG_Layout_Templates::delete($id);

        if (!$deleted) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }
        self::bump_cache_version();

        self::add_audit_entry(0, 'layout_template.deleted', [
            'templateId' => $id,
            'name'       => $tmpl_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template deleted: {$tmpl_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $id,
            'resource_label' => $tmpl_name,
        ]);

        return new WP_REST_Response(['deleted' => true], 200);
    }

    /**
     * Duplicate a layout template (admin).
     */
    public static function duplicate_layout_template($request) {
        $id       = $request->get_param('templateId');
        $data     = $request->get_json_params();
        $new_name = sanitize_text_field($data['name'] ?? '');
        $result   = WPSG_Layout_Templates::duplicate($id, $new_name);

        if (is_wp_error($result)) {
            return $result;
        }

        $dup_name = $result['name'] ?? '';
        self::add_audit_entry(0, 'layout_template.duplicated', [
            'sourceId'   => $id,
            'templateId' => $result['id'] ?? '',
            'name'       => $dup_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template duplicated: {$dup_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $result['id'] ?? '',
            'resource_label' => $dup_name,
        ]);

        return new WP_REST_Response($result, 201);
    }

    // ── Overlay Library (P15-H) ──────────────────────────────

    /**
     * List all overlay library items.
     */
    public static function list_overlay_library( $request ) {
        $items = WPSG_Overlay_Library::get_all();
        return new WP_REST_Response( $items, 200 );
    }

    /**
     * Upload a new overlay image (file upload) or register a URL.
     *
     * Accepts multipart/form-data with a 'file' field, or a JSON body
     * with { url, name } to register an external URL.
     */
    public static function upload_overlay( $request ) {
        // File upload path.
        if ( ! empty( $_FILES['file'] ) ) {
            $url = WPSG_Overlay_Library::handle_upload( $_FILES['file'] );
            if ( is_wp_error( $url ) ) {
                return new WP_Error( 'wpsg_upload_failed', $url->get_error_message(), [ 'status' => 400 ] );
            }
            $name = sanitize_text_field( $request->get_param( 'name' ) ?? basename( $_FILES['file']['name'] ) );
        } else {
            // URL-only path.
            $data = $request->get_json_params() ?? [];
            $url  = esc_url_raw( $data['url'] ?? '' );
            $name = sanitize_text_field( $data['name'] ?? '' );
            if ( empty( $url ) ) {
                return new WP_Error( 'wpsg_missing_file_or_url', 'A file or URL is required.', [ 'status' => 400 ] );
            }
        }

        $entry = WPSG_Overlay_Library::add( [ 'url' => $url, 'name' => $name ] );
        if ( is_wp_error( $entry ) ) {
            return new WP_Error( 'wpsg_overlay_save_failed', $entry->get_error_message(), [ 'status' => 500 ] );
        }
        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * Remove an overlay library entry.
     */
    public static function delete_overlay( $request ) {
        $id      = $request->get_param( 'id' );
        $deleted = WPSG_Overlay_Library::remove( $id );
        if ( ! $deleted ) {
            return new WP_Error( 'wpsg_overlay_not_found', 'Overlay not found.', [ 'status' => 404 ] );
        }
        return new WP_REST_Response( [ 'deleted' => true ], 200 );
    }

    // ── Font Library (P22-L5) ───────────────────────────────────

    /**
     * List all uploaded custom fonts.
     */
    public static function list_font_library( $request ) {
        $items = WPSG_Font_Library::get_all();
        return new WP_REST_Response( $items, 200 );
    }

    /**
     * Upload a new custom font file.
     */
    public static function upload_font( $request ) {
        $files = $request->get_file_params();
        if ( empty( $files['file'] ) ) {
            return new WP_Error( 'wpsg_missing_file', 'A font file is required.', [ 'status' => 400 ] );
        }

        $file = $files['file'];
        if ( isset( $file['error'] ) && UPLOAD_ERR_OK !== $file['error'] ) {
            $message = 'Upload failed.';
            $status  = 400;
            switch ( $file['error'] ) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $message = 'Uploaded file exceeds the allowed size.';
                    $status  = 413;
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $message = 'The uploaded file was only partially uploaded.';
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $message = 'No file was uploaded.';
                    break;
                case UPLOAD_ERR_NO_TMP_DIR:
                case UPLOAD_ERR_CANT_WRITE:
                case UPLOAD_ERR_EXTENSION:
                    $message = 'Server error while processing upload.';
                    $status  = 500;
                    break;
            }
            return new WP_Error( 'wpsg_font_upload_failed', $message, [ 'status' => $status ] );
        }

        if ( ! isset( $file['tmp_name'] ) || ! is_uploaded_file( $file['tmp_name'] ) ) {
            return new WP_Error( 'wpsg_invalid_upload', 'Invalid upload.', [ 'status' => 400 ] );
        }

        $result = WPSG_Font_Library::handle_upload( $file );
        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'wpsg_font_upload_failed', $result->get_error_message(), [ 'status' => 400 ] );
        }

        $name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
        if ( empty( $name ) ) {
            // Derive name from filename: "BrandSans-Bold.woff2" → "BrandSans Bold"
            $name = pathinfo( sanitize_file_name( $file['name'] ), PATHINFO_FILENAME );
            $name = str_replace( [ '-', '_' ], ' ', $name );
        }

        $entry = WPSG_Font_Library::add( [
            'url'      => $result['url'],
            'name'     => $name,
            'filename' => sanitize_file_name( $file['name'] ),
            'format'   => $result['format'],
        ] );

        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * Remove a custom font entry and its file.
     */
    public static function delete_font( $request ) {
        $id      = $request->get_param( 'id' );
        $deleted = WPSG_Font_Library::remove( $id );
        if ( ! $deleted ) {
            return new WP_Error( 'wpsg_font_not_found', 'Font not found.', [ 'status' => 404 ] );
        }
        return new WP_REST_Response( [ 'deleted' => true ], 200 );
    }

    // =========================================================================
    // P28-J — Access Totals Summary
    // =========================================================================

    /**
     * GET /campaigns/access-summary
     *
     * Returns grant counts and pending access-request counts for every campaign.
     * Supports optional `page` + `per_page` query params.
     */
    public static function access_summary($request) {
        global $wpdb;

        $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50)));
        $page     = max(1, intval($request->get_param('page') ?: 1));
        $offset   = ($page - 1) * $per_page;

        // Count all campaigns (any post_status that "exists").
        $total = intval($wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'wpsg_campaign' AND post_status NOT IN ('trash','auto-draft')"
        ));

        $total_pages = max(1, (int) ceil($total / $per_page));

        // Fetch this page of campaigns.
        $ids = $wpdb->get_col($wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
             WHERE post_type = 'wpsg_campaign'
               AND post_status NOT IN ('trash','auto-draft')
             ORDER BY post_title ASC
             LIMIT %d OFFSET %d",
            $per_page,
            $offset
        ));

        if (empty($ids)) {
            return new WP_REST_Response([
                'items'      => [],
                'page'       => $page,
                'perPage'    => $per_page,
                'total'      => $total,
                'totalPages' => $total_pages,
            ], 200);
        }

        // Batch-load post meta to avoid N+1 queries.
        update_meta_cache('post', $ids);

        // Load titles in one query.
        $id_placeholders = implode(',', array_fill(0, count($ids), '%d'));
        // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        $posts = $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_title FROM {$wpdb->posts} WHERE ID IN ({$id_placeholders})",
            ...$ids
        ), ARRAY_A);
        $title_map = array_column($posts, 'post_title', 'ID');

        // Pending request counts for these campaigns in one SQL query.
        $pending_map = [];
        $table       = WPSG_DB::get_access_requests_table();
        // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        $pending_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT campaign_id, COUNT(*) AS cnt FROM {$table}
             WHERE status = 'pending' AND campaign_id IN ({$id_placeholders})
             GROUP BY campaign_id",
            ...$ids
        ), ARRAY_A);
        foreach ($pending_rows as $row) {
            $pending_map[intval($row['campaign_id'])] = intval($row['cnt']);
        }

        $now   = time();
        $items = [];
        foreach ($ids as $id) {
            $id    = intval($id);
            $grants = get_post_meta($id, 'access_grants', true);
            $grants = is_array($grants) ? $grants : [];

            // Count only non-expired grants.
            $active_count = 0;
            foreach ($grants as $grant) {
                if (!empty($grant['expires_at']) && strtotime($grant['expires_at']) < $now) {
                    continue;
                }
                if (!empty($grant['userId'])) {
                    $active_count++;
                }
            }

            $items[] = [
                'id'                  => $id,
                'title'               => $title_map[$id] ?? '',
                'grantCount'          => $active_count,
                'pendingRequestCount' => $pending_map[$id] ?? 0,
                'capacity'            => null,
            ];
        }

        return new WP_REST_Response([
            'items'      => $items,
            'page'       => $page,
            'perPage'    => $per_page,
            'total'      => $total,
            'totalPages' => $total_pages,
        ], 200);
    }

    /**
     * Public read-only endpoint for rendering (no auth, ID-based only).
     */
    public static function get_layout_template_public($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);

        if (!$template) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }

        return new WP_REST_Response($template, 200);
    }

    // ── P39-IN1: Webhook endpoint management ─────────────────────────────────

    public static function list_webhook_endpoints($request) {
        $endpoints = WPSG_Webhooks::get_endpoints();
        $items = [];
        foreach ($endpoints as $idx => $endpoint) {
            $items[] = WPSG_Webhooks::format_endpoint_for_api($idx, $endpoint);
        }
        return new WP_REST_Response($items, 200);
    }

    public static function create_webhook_endpoint($request) {
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (count($endpoints) >= WPSG_Webhooks::MAX_ENDPOINTS) {
            return new WP_Error(
                'wpsg_webhook_limit',
                sprintf('Maximum of %d webhook endpoints allowed.', WPSG_Webhooks::MAX_ENDPOINTS),
                ['status' => 400]
            );
        }

        $raw_url = $request->get_param('url');
        $url = WPSG_Webhooks::sanitize_url(is_string($raw_url) ? $raw_url : '');
        if (empty($url)) {
            return new WP_Error('wpsg_invalid_url', 'A valid HTTP(S) URL is required.', ['status' => 400]);
        }

        $raw_events = $request->get_param('events');
        $events = WPSG_Webhooks::sanitize_events(is_array($raw_events) ? $raw_events : []);
        if (is_array($raw_events) && !empty($raw_events) && empty($events)) {
            return new WP_Error('wpsg_invalid_events', 'No recognised event names in the provided list.', ['status' => 400]);
        }
        $raw_enabled = $request->get_param('enabled');
        $enabled     = $raw_enabled === null ? true : self::is_truthy_param($raw_enabled);
        $secret = WPSG_Webhooks::generate_secret();

        $endpoint = [
            'id'      => wp_generate_uuid4(),
            'url'     => $url,
            'secret'  => $secret,
            'events'  => $events,
            'enabled' => $enabled,
        ];

        $endpoints[] = $endpoint;
        WPSG_Webhooks::save_endpoints($endpoints);

        $idx = count($endpoints) - 1;
        $response = WPSG_Webhooks::format_endpoint_for_api($idx, $endpoint);
        $response['secret'] = $secret; // One-time full secret exposure on creation.

        return new WP_REST_Response($response, 201);
    }

    public static function update_webhook_endpoint($request) {
        $idx       = intval($request->get_param('index'));
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (!isset($endpoints[$idx])) {
            return new WP_Error('wpsg_not_found', 'Webhook endpoint not found.', ['status' => 404]);
        }

        $existing = $endpoints[$idx];

        if ($request->get_param('url') !== null) {
            $raw_url = $request->get_param('url');
            $url = WPSG_Webhooks::sanitize_url(is_string($raw_url) ? $raw_url : '');
            if (empty($url)) {
                return new WP_Error('wpsg_invalid_url', 'A valid HTTP(S) URL is required.', ['status' => 400]);
            }
            $existing['url'] = $url;
        }

        if ($request->get_param('events') !== null) {
            $raw_events      = $request->get_param('events');
            $sanitized_events = WPSG_Webhooks::sanitize_events(is_array($raw_events) ? $raw_events : []);
            if (is_array($raw_events) && !empty($raw_events) && empty($sanitized_events)) {
                return new WP_Error('wpsg_invalid_events', 'No recognised event names in the provided list.', ['status' => 400]);
            }
            $existing['events'] = $sanitized_events;
        }

        if ($request->get_param('enabled') !== null) {
            $existing['enabled'] = self::is_truthy_param($request->get_param('enabled'));
        }

        $endpoints[$idx] = $existing;
        WPSG_Webhooks::save_endpoints($endpoints);

        return new WP_REST_Response(WPSG_Webhooks::format_endpoint_for_api($idx, $existing), 200);
    }

    public static function delete_webhook_endpoint($request) {
        $idx       = intval($request->get_param('index'));
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (!isset($endpoints[$idx])) {
            return new WP_Error('wpsg_not_found', 'Webhook endpoint not found.', ['status' => 404]);
        }

        array_splice($endpoints, $idx, 1);
        WPSG_Webhooks::save_endpoints($endpoints);

        return new WP_REST_Response(['deleted' => true], 200);
    }

    public static function rotate_webhook_secret($request) {
        $idx       = intval($request->get_param('index'));
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (!isset($endpoints[$idx])) {
            return new WP_Error('wpsg_not_found', 'Webhook endpoint not found.', ['status' => 404]);
        }

        $new_secret           = WPSG_Webhooks::generate_secret();
        $endpoints[$idx]['secret'] = $new_secret;
        WPSG_Webhooks::save_endpoints($endpoints);

        return new WP_REST_Response(['secret' => $new_secret], 200);
    }

    public static function list_webhook_deliveries($request) {
        $log   = WPSG_Webhooks::get_delivery_log();
        $limit = max(0, min(intval($request->get_param('limit') ?? 50), 50));
        return new WP_REST_Response(array_slice($log, 0, $limit), 200);
    }
}
