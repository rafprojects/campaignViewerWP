<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-wpsg-oembed-providers.php';

class WPSG_REST {
    private static function respond_with_etag($request, $payload, $status = 200, $salt = '') {
        $etag = '"' . md5(wp_json_encode($payload) . $salt) . '"';
        $if_none_match = $request ? $request->get_header('if-none-match') : '';

        if (!empty($if_none_match) && trim($if_none_match) === $etag) {
            $response = new WP_REST_Response(null, 304);
            $response->header('ETag', $etag);
            return $response;
        }

        $response = new WP_REST_Response($payload, $status);
        $response->header('ETag', $etag);
        return $response;
    }
    public static function register_routes() {
        register_rest_route('wp-super-gallery/v1', '/campaigns', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaigns'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_campaign'],
                'permission_callback' => function ( $request ) {
                    $campaign_id = isset( $request['id'] ) ? intval( $request['id'] ) : 0;

                    if ( ! $campaign_id ) {
                        return false;
                    }

                    $campaign = get_post( $campaign_id );

                    // Deny access if the campaign does not exist.
                    if ( ! $campaign ) {
                        return false;
                    }

                    // Allow public (published) campaigns to be accessed by anyone.
                    if ( isset( $campaign->post_status ) && 'publish' === $campaign->post_status ) {
                        return true;
                    }

                    // For non-public campaigns, require appropriate capabilities.
                    if ( current_user_can( 'read_post', $campaign_id ) || current_user_can( 'manage_options' ) ) {
                        return true;
                    }

                    return false;
                },
            ],
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'update_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/archive', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'archive_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/restore', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'restore_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-C: Campaign duplication
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/duplicate', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'duplicate_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-B: Bulk campaign actions (archive/restore)
        register_rest_route('wp-super-gallery/v1', '/campaigns/batch', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'batch_campaigns'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-D: Export / Import
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/export', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'export_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/campaigns/import', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'import_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-G: Media usage tracking — summary route BEFORE parameterised route
        register_rest_route('wp-super-gallery/v1', '/media/usage-summary', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_media_usage_summary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/media/(?P<mediaId>[a-zA-Z0-9_.]+)/usage', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_media_usage'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-H: Campaign categories
        register_rest_route('wp-super-gallery/v1', '/campaign-categories', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaign_categories'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-F: Analytics
        register_rest_route('wp-super-gallery/v1', '/analytics/event', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'record_analytics_event'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/analytics/campaigns/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_campaign_analytics'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_media'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_media'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // Register specific sub-routes BEFORE the generic mediaId route to avoid pattern conflicts
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/reorder', [
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'reorder_media'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/rescan', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'rescan_media_types'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // Generic mediaId route must come AFTER specific sub-routes
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/(?P<mediaId>[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)', [
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'update_media'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_media'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/rescan-all', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'rescan_all_media_types'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_access'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'grant_access'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access/(?P<userId>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'revoke_access'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P18-I: Access Request Workflow
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'submit_access_request'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_access_requests'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/approve', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'approve_access_request'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/deny', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'deny_access_request'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/audit', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_audit'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/library', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_media_library'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/upload', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'upload_media'],
                'permission_callback' => [self::class, 'require_admin'],
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
                'methods' => 'POST',
                'callback' => [self::class, 'create_user'],
                'permission_callback' => [self::class, 'require_admin'],
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
                'methods' => 'POST',
                'callback' => [self::class, 'grant_company_access'],
                'permission_callback' => [self::class, 'require_admin'],
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

        // P14-G: Campaign tags.
        register_rest_route('wp-super-gallery/v1', '/tags/campaign', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaign_tags'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_media_tags'],
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

        // P15-B: Public read-only endpoint for rendering (no auth, ID-based only).
        register_rest_route('wp-super-gallery/v1', '/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template_public'],
                'permission_callback' => '__return_true',
            ],
        ]);
    }

    public static function rate_limit_public($request) {
        $limit = intval(apply_filters('wpsg_rate_limit_public', 60));
        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        return self::rate_limit_check($request, 'public', $limit, $window);
    }

    /**
     * Rate-limit authenticated endpoints (admin actions).
     *
     * Default: 120 requests per minute per IP. Override via
     * `wpsg_rate_limit_authenticated` filter.
     *
     * @since 0.18.0 P20-A
     */
    public static function rate_limit_authenticated($request) {
        if (!current_user_can('manage_wpsg')) {
            return false;
        }

        $limit = intval(apply_filters('wpsg_rate_limit_authenticated', 120));
        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        $result = self::rate_limit_check($request, 'authenticated', $limit, $window);

        if (is_wp_error($result)) {
            return $result;
        }

        // Delegate the rest of the admin permission check (nonce, etc.)
        return self::verify_admin_auth();
    }

    private static function rate_limit_check($request, $scope, $limit, $window) {
        if ($limit <= 0) {
            return true;
        }

        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
        $user_id = get_current_user_id();
        $route = $request->get_route();
        $key = sprintf('wpsg_rl_%s_%s_%s', $scope, $user_id ?: 'anon', md5($ip . '|' . $route));

        if (function_exists('wp_cache_incr')) {
            $cache_key = $key . '_count';
            $current = wp_cache_incr($cache_key, 1, 'wpsg_rate_limit');
            if ($current === false) {
                wp_cache_add($cache_key, 1, 'wpsg_rate_limit', $window);
                $current = 1;
            }

            if ($current > $limit) {
                return new WP_Error(
                    'wpsg_rate_limited',
                    'Rate limit exceeded. Please try again later.',
                    ['status' => 429]
                );
            }

            return true;
        }

        $data = get_transient($key);
        if (!is_array($data)) {
            $data = [
                'count' => 0,
                'start' => time(),
            ];
        }

        $elapsed = time() - intval($data['start']);
        if ($elapsed > $window) {
            $data = [
                'count' => 0,
                'start' => time(),
            ];
        }

        $data['count']++;
        set_transient($key, $data, $window);

        if ($data['count'] > $limit) {
            return new WP_Error(
                'wpsg_rate_limited',
                'Rate limit exceeded. Please try again later.',
                ['status' => 429]
            );
        }

        return true;
    }

    public static function require_admin() {
        if (!current_user_can('manage_wpsg')) {
            return false;
        }

        return self::verify_admin_auth();
    }

    /**
     * Shared admin auth verification extracted for reuse by rate_limit_authenticated.
     *
     * @since 0.18.0 P20-A
     */
    private static function verify_admin_auth() {
        // For token-based auth (e.g., JWT Bearer), WordPress nonce is not required.
        // Nonce verification is only needed for cookie-authenticated REST requests.
        $auth_header = isset($_SERVER['HTTP_AUTHORIZATION']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_AUTHORIZATION'])) : '';
        if (!empty($auth_header) && stripos($auth_header, 'Bearer ') === 0) {
            return true;
        }

        // Allow nonce bypass ONLY when BOTH WP_DEBUG and the explicit
        // WPSG_ALLOW_NONCE_BYPASS constant are set — for automated tests.
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG
            && defined( 'WPSG_ALLOW_NONCE_BYPASS' ) && WPSG_ALLOW_NONCE_BYPASS ) {
            return true;
        }

        return self::verify_rest_nonce();
    }

    private static function verify_rest_nonce() {
        $nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_X_WP_NONCE'])) : '';
        return (bool) wp_verify_nonce($nonce, 'wp_rest');
    }

    public static function require_authenticated() {
        return is_user_logged_in();
    }

    public static function list_campaigns() {
        $start = microtime(true);
        $request = func_get_arg(0);
        $status = sanitize_text_field($request->get_param('status'));
        $visibility = sanitize_text_field($request->get_param('visibility'));
        $company = sanitize_text_field($request->get_param('company'));
        $search = sanitize_text_field($request->get_param('search'));
        $include_media_raw = $request->get_param('include_media');
        $include_media = in_array(strtolower((string) $include_media_raw), ['1', 'true', 'yes'], true);
        $page = max(1, intval($request->get_param('page')));
        $per_page = max(1, min(50, intval($request->get_param('per_page') ?: 10)));

        // Generate cache key based on user ID and query parameters
        $user_id = get_current_user_id();
        $is_admin = current_user_can('manage_options') || current_user_can('manage_wpsg');
        $search_key = $search ? md5($search) : 'none';
        $cache_key = sprintf(
            'wpsg_campaigns_%d_%s_%s_%s_%s_%d_%d_%s_%s',
            $user_id,
            $status ?: 'all',
            $visibility ?: 'all',
            $company ?: 'all',
            $search_key,
            $page,
            $per_page,
            $is_admin ? 'admin' : 'user',
            $include_media ? 'with_media' : 'no_media'
        );

        // Try to get cached data
        $cached = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            return new WP_REST_Response($cached, 200);
        }

        $args = [
            'post_type' => 'wpsg_campaign',
            'post_status' => 'publish',
            'paged' => $page,
            'posts_per_page' => $per_page,
            's' => $search,
        ];

        $meta_query = [];
        if (!empty($status)) {
            $meta_query[] = [
                'key' => 'status',
                'value' => $status,
            ];
        }
        if (!empty($visibility)) {
            $meta_query[] = [
                'key' => 'visibility',
                'value' => $visibility,
            ];
        }
        if (!empty($meta_query)) {
            $args['meta_query'] = $meta_query;
        }

        if (!empty($company)) {
            $args['tax_query'] = [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'slug',
                    'terms' => [$company],
                ],
            ];
        }

        if (!$is_admin) {
            if (!$user_id) {
                $meta_query[] = [
                    'key' => 'visibility',
                    'value' => 'public',
                ];
                $args['meta_query'] = $meta_query;
            } else {
                $accessible_ids = self::get_accessible_campaign_ids($user_id);
                if (empty($accessible_ids)) {
                    $accessible_ids = [0];
                } else {
                    $accessible_ids = array_map('intval', $accessible_ids);
                }
                $args['post__in'] = $accessible_ids;
            }

            // P13-D: Hide campaigns outside their scheduled window.
            $now = gmdate('Y-m-d H:i:s'); // UTC datetime — matches stored format
            $meta_query[] = [
                'relation' => 'OR',
                ['key' => 'publish_at', 'compare' => 'NOT EXISTS'],
                ['key' => 'publish_at', 'value' => '', 'compare' => '='],
                ['key' => 'publish_at', 'value' => $now, 'compare' => '<=', 'type' => 'DATETIME'],
            ];
            $meta_query[] = [
                'relation' => 'OR',
                ['key' => 'unpublish_at', 'compare' => 'NOT EXISTS'],
                ['key' => 'unpublish_at', 'value' => '', 'compare' => '='],
                ['key' => 'unpublish_at', 'value' => $now, 'compare' => '>=', 'type' => 'DATETIME'],
            ];
            $args['meta_query'] = $meta_query;
            if (count($meta_query) > 1 && !isset($meta_query['relation'])) {
                $args['meta_query']['relation'] = 'AND';
            }
        }

        $query = new WP_Query($args);
        $items = array_map([self::class, 'format_campaign'], $query->posts);

        $media_by_campaign = [];
        if ($include_media && !empty($query->posts)) {
            foreach ($query->posts as $post) {
                $campaign_id = (string) $post->ID;
                $media_items = get_post_meta($post->ID, 'media_items', true);
                $media_items = is_array($media_items) ? $media_items : [];
                $normalized = self::normalize_media_items_types($media_items);
                $media_by_campaign[$campaign_id] = self::enrich_media_with_dimensions($normalized['items']);
            }
        }

        $response_data = [
            'items' => $items,
            'page' => $page,
            'perPage' => $per_page,
            'total' => (int) $query->found_posts,
            'totalPages' => (int) $query->max_num_pages,
        ];

        if ($include_media) {
            $response_data['mediaByCampaign'] = $media_by_campaign;
        }

        // Cache using configured TTL (defaults to 5 minutes / 300 seconds)
        $ttl = 300;
        if (class_exists('WPSG_Settings')) {
            $ttl = intval(WPSG_Settings::get_setting('cache_ttl') ?: 300);
        }
        set_transient($cache_key, $response_data, $ttl);

        $response = new WP_REST_Response($response_data, 200);
        self::log_slow_rest('campaigns.list', $start, [
            'count' => count($items),
            'page' => $page,
        ]);
        return $response;
    }

    public static function create_campaign() {
        $request = func_get_arg(0);
        $title = sanitize_text_field($request->get_param('title'));
        $description = wp_kses_post($request->get_param('description'));

        if (empty($title)) {
            return new WP_REST_Response(['message' => 'Title is required'], 400);
        }

        $post_id = wp_insert_post([
            'post_type' => 'wpsg_campaign',
            'post_title' => $title,
            'post_content' => $description,
            'post_status' => 'publish',
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_REST_Response(['message' => $post_id->get_error_message()], 500);
        }

        $meta_result = self::apply_campaign_meta($post_id, $request);
        if ($meta_result instanceof WP_REST_Response) {
            wp_delete_post($post_id, true);
            return $meta_result;
        }
        self::assign_company($post_id, $request->get_param('company'));
        self::add_audit_entry($post_id, 'campaign.created', [
            'title' => $title,
        ]);

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 201);
    }

    public static function get_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $user_id = get_current_user_id();
        if (!self::can_view_campaign($post_id, $user_id)) {
            return new WP_REST_Response(['message' => 'Forbidden'], 403);
        }

        return new WP_REST_Response(self::format_campaign($post), 200);
    }

    public static function update_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $title = $request->get_param('title');
        $description = $request->get_param('description');

        $update = [
            'ID' => $post_id,
        ];
        if (!empty($title)) {
            $update['post_title'] = sanitize_text_field($title);
        }
        if (!is_null($description)) {
            $update['post_content'] = wp_kses_post($description);
        }
        wp_update_post($update);

        $meta_result = self::apply_campaign_meta($post_id, $request);
        if ($meta_result instanceof WP_REST_Response) {
            return $meta_result;
        }
        self::assign_company($post_id, $request->get_param('company'));

        self::add_audit_entry($post_id, 'campaign.updated', [
            'title' => $title,
            'visibility' => $request->get_param('visibility'),
            'status' => $request->get_param('status'),
        ]);

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 200);
    }

    public static function archive_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        update_post_meta($post_id, 'status', 'archived');
        self::add_audit_entry($post_id, 'campaign.archived', []);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Campaign archived'], 200);
    }

    public static function restore_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        update_post_meta($post_id, 'status', 'active');
        self::add_audit_entry($post_id, 'campaign.restored', []);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Campaign restored'], 200);
    }

    // ── P18-C: Campaign duplication ───────────────────────────────────────────

    public static function duplicate_campaign() {
        $request  = func_get_arg(0);
        $source_id = intval($request->get_param('id'));

        if (!self::campaign_exists($source_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $source   = get_post($source_id);
        $new_name = sanitize_text_field(
            $request->get_param('name') ?: ($source->post_title . ' (Copy)')
        );
        $copy_media = (bool) $request->get_param('copy_media');

        $new_id = wp_insert_post([
            'post_type'    => 'wpsg_campaign',
            'post_title'   => $new_name,
            'post_content' => $source->post_content,
            'post_status'  => 'publish',
        ], true);

        if (is_wp_error($new_id)) {
            return new WP_REST_Response(['message' => $new_id->get_error_message()], 500);
        }

        // Copy campaign-specific meta keys (settings + bindings), excluding WP internal meta
        $meta_keys = [
            'visibility',
            'tags',
            'cover_image',
            '_wpsg_image_adapter_id',
            '_wpsg_video_adapter_id',
            '_wpsg_layout_binding_template_id',
            '_wpsg_layout_binding',
        ];
        foreach ($meta_keys as $key) {
            $value = get_post_meta($source_id, $key, true);
            if ($value !== '' && $value !== false) {
                update_post_meta($new_id, $key, $value);
            }
        }
        // Clones always start as draft regardless of source status
        update_post_meta($new_id, 'status', 'draft');

        // Optionally copy media associations
        if ($copy_media) {
            $media_items = get_post_meta($source_id, 'media_items', true);
            if (is_array($media_items)) {
                update_post_meta($new_id, 'media_items', $media_items);
            }
        }

        // Copy company assignment
        $company_term = self::get_company_term($source_id);
        if ($company_term) {
            wp_set_object_terms($new_id, $company_term->term_id, 'wpsg_company');
        }

        self::add_audit_entry($new_id, 'campaign.duplicated', [
            'source_id'  => $source_id,
            'copy_media' => $copy_media,
        ]);
        self::clear_accessible_campaigns_cache();

        return new WP_REST_Response(self::format_campaign(get_post($new_id)), 201);
    }

    // ── P18-B: Bulk campaign actions ──────────────────────────────────────────

    public static function batch_campaigns() {
        $request = func_get_arg(0);
        $action  = sanitize_text_field($request->get_param('action'));
        $ids     = $request->get_param('ids');

        $allowed_actions = ['archive', 'restore'];
        if (!in_array($action, $allowed_actions, true)) {
            return new WP_REST_Response(['message' => 'Invalid action. Allowed: archive, restore'], 400);
        }
        if (!is_array($ids) || empty($ids)) {
            return new WP_REST_Response(['message' => 'ids must be a non-empty array'], 400);
        }

        $success = [];
        $failed  = [];
        $new_status = $action === 'archive' ? 'archived' : 'active';

        foreach ($ids as $raw_id) {
            $post_id = intval($raw_id);
            if (!self::campaign_exists($post_id)) {
                $failed[] = ['id' => (string) $post_id, 'reason' => 'not found'];
                continue;
            }
            update_post_meta($post_id, 'status', $new_status);
            self::add_audit_entry($post_id, "campaign.{$action}d", []);
            $success[] = (string) $post_id;
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['success' => $success, 'failed' => $failed], 200);
    }

    // P18-D: Export a single campaign as a self-contained JSON payload.
    public static function export_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $post      = get_post($post_id);
        $campaign  = self::format_campaign($post);
        $media     = get_post_meta($post_id, 'media_items', true) ?: [];

        // Embed layout template by value so export is self-contained.
        $template_id  = get_post_meta($post_id, '_wpsg_layout_binding_template_id', true);
        $layout_template = null;
        if ($template_id) {
            $tmpl = get_post(intval($template_id));
            if ($tmpl) {
                $layout_template = [
                    'id'          => (string) $tmpl->ID,
                    'title'       => $tmpl->post_title,
                    'slots'       => get_post_meta($tmpl->ID, 'slots', true) ?: [],
                    'background'  => get_post_meta($tmpl->ID, 'background', true) ?: [],
                    'graphicLayers' => get_post_meta($tmpl->ID, 'graphic_layers', true) ?: [],
                ];
            }
        }

        $payload = [
            'version'          => 1,
            'exported_at'      => gmdate('c'),
            'campaign'         => $campaign,
            'layout_template'  => $layout_template,
            'media_references' => array_values(array_map(function ($item) {
                return ['id' => $item['id'] ?? '', 'url' => $item['url'] ?? '', 'title' => $item['title'] ?? ''];
            }, $media)),
        ];

        $response = new WP_REST_Response($payload, 200);
        $response->header('Content-Disposition', 'attachment; filename="campaign-' . $post_id . '.json"');
        return $response;
    }

    // P18-D: Import a campaign from a JSON export payload.
    public static function import_campaign() {
        $request = func_get_arg(0);
        $body    = $request->get_json_params();

        if (empty($body) || !isset($body['campaign'])) {
            return new WP_REST_Response(['message' => 'Invalid payload: missing campaign key'], 400);
        }
        $version = intval($body['version'] ?? 0);
        if ($version !== 1) {
            return new WP_REST_Response(['message' => 'Unsupported export version'], 400);
        }

        $src = $body['campaign'];
        $title = sanitize_text_field($src['title'] ?? 'Imported Campaign');
        $description = sanitize_textarea_field($src['description'] ?? '');

        $post_id = wp_insert_post([
            'post_title'   => $title,
            'post_content' => $description,
            'post_type'    => 'wpsg_campaign',
            'post_status'  => 'publish',
        ], true);
        if (is_wp_error($post_id)) {
            return new WP_REST_Response(['message' => $post_id->get_error_message()], 500);
        }

        // Copy scalar meta fields; always import as draft.
        $meta_map = [
            'visibility'   => 'visibility',
            'tags'         => 'tags',
            'coverImage'   => 'cover_image',
            'publishAt'    => 'publish_at',
            'unpublishAt'  => 'unpublish_at',
            'imageAdapterId' => '_wpsg_image_adapter_id',
            'videoAdapterId' => '_wpsg_video_adapter_id',
        ];
        update_post_meta($post_id, 'status', 'draft');
        foreach ($meta_map as $src_key => $meta_key) {
            if (!empty($src[$src_key])) {
                if ($src_key === 'tags' && is_array($src[$src_key])) {
                    update_post_meta($post_id, $meta_key, array_values(array_map('sanitize_text_field', $src[$src_key])));
                } else {
                    update_post_meta($post_id, $meta_key, sanitize_text_field($src[$src_key]));
                }
            }
        }

        // Embed layout binding by value if provided.
        $layout_template = $body['layout_template'] ?? null;
        if ($layout_template && is_array($layout_template)) {
            // Route through the same sanitization pipeline used by template
            // create/update so imported payloads receive identical validation.
            $sanitized = WPSG_Layout_Templates::sanitize_template_data($layout_template);

            $tmpl_id = wp_insert_post([
                'post_title'  => sanitize_text_field($layout_template['title'] ?? 'Imported Template'),
                'post_type'   => 'wpsg_layout_template',
                'post_status' => 'publish',
            ]);
            if (!is_wp_error($tmpl_id)) {
                update_post_meta($tmpl_id, 'slots', $sanitized['slots']);
                update_post_meta($tmpl_id, 'background', [
                    'backgroundMode'              => $sanitized['backgroundMode'],
                    'backgroundColor'             => $sanitized['backgroundColor'],
                    'backgroundGradientDirection'  => $sanitized['backgroundGradientDirection'],
                    'backgroundGradientStops'     => $sanitized['backgroundGradientStops'],
                    'backgroundGradientType'      => $sanitized['backgroundGradientType'],
                    'backgroundGradientAngle'     => $sanitized['backgroundGradientAngle'],
                    'backgroundRadialShape'       => $sanitized['backgroundRadialShape'],
                    'backgroundRadialSize'        => $sanitized['backgroundRadialSize'],
                    'backgroundGradientCenterX'   => $sanitized['backgroundGradientCenterX'],
                    'backgroundGradientCenterY'   => $sanitized['backgroundGradientCenterY'],
                    'backgroundImage'             => $sanitized['backgroundImage'],
                    'backgroundImageFit'          => $sanitized['backgroundImageFit'],
                    'backgroundImageOpacity'      => $sanitized['backgroundImageOpacity'],
                ]);
                update_post_meta($tmpl_id, 'graphic_layers', $sanitized['overlays']);
                update_post_meta($post_id, '_wpsg_layout_binding_template_id', (string) $tmpl_id);
                if (!empty($src['layoutBinding'])) {
                    // Sanitize layout binding the same way as apply_campaign_meta.
                    $binding = $src['layoutBinding'];
                    if (is_array($binding)) {
                        array_walk_recursive($binding, function (&$v) {
                            if (is_string($v)) {
                                $v = sanitize_text_field($v);
                            }
                        });
                    }
                    update_post_meta($post_id, '_wpsg_layout_binding', $binding);
                }
            }
        }

        // Import media references (URL-only, no binary transfer).
        $media_refs = $body['media_references'] ?? [];
        if (is_array($media_refs) && !empty($media_refs)) {
            $media_items = array_values(array_map(function ($ref) {
                return [
                    'id'    => sanitize_text_field($ref['id'] ?? wp_generate_uuid4()),
                    'url'   => esc_url_raw($ref['url'] ?? ''),
                    'title' => sanitize_text_field($ref['title'] ?? ''),
                    'type'  => 'image',
                    'source' => 'url',
                    'order' => 0,
                ];
            }, $media_refs));
            update_post_meta($post_id, 'media_items', $media_items);
        }

        self::add_audit_entry($post_id, 'campaign.imported', ['source_title' => $title]);
        $new_post = get_post($post_id);
        return new WP_REST_Response(self::format_campaign($new_post), 201);
    }

    // ─────────────────────────────────────────────────────────────────────
    // P18-F: Analytics
    // ─────────────────────────────────────────────────────────────────────

    /**
     * POST /analytics/event
     * Public endpoint (rate-limited). Accepts { campaign_id, event_type }.
     * Requires `enable_analytics` setting to be truthy.
     */
    public static function record_analytics_event() {
        $request = func_get_arg(0);

        // Respect the enable_analytics setting (default: disabled).
        $settings = get_option('wpsg_settings', []);
        if (empty($settings['enable_analytics'])) {
            return new WP_REST_Response(['message' => 'Analytics disabled'], 403);
        }

        $campaign_id = intval($request->get_param('campaign_id'));
        $event_type  = sanitize_text_field($request->get_param('event_type') ?? 'view');

        if ($campaign_id <= 0) {
            return new WP_REST_Response(['message' => 'Invalid campaign_id'], 400);
        }
        if (!self::campaign_exists($campaign_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $allowed_events = ['view'];
        if (!in_array($event_type, $allowed_events, true)) {
            $event_type = 'view';
        }

        global $wpdb;
        $ip   = $_SERVER['REMOTE_ADDR'] ?? '';
        $salt = wp_salt('auth');
        $hash = hash('sha256', $ip . $salt);

        $table = WPSG_DB::get_analytics_table();
        $wpdb->insert($table, [
            'campaign_id'  => $campaign_id,
            'event_type'   => $event_type,
            'visitor_hash' => $hash,
            'occurred_at'  => current_time('mysql', true),
        ], ['%d', '%s', '%s', '%s']);

        return new WP_REST_Response(['recorded' => true], 201);
    }

    /**
     * GET /analytics/campaigns/{id}?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Admin-only. Returns total_views, unique_visitors, daily breakdown.
     */
    public static function get_campaign_analytics() {
        $request     = func_get_arg(0);
        $campaign_id = intval($request->get_param('id'));

        if (!self::campaign_exists($campaign_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $from = sanitize_text_field($request->get_param('from') ?? '');
        $to   = sanitize_text_field($request->get_param('to') ?? '');

        // Default: last 30 days.
        $to_ts   = $to   ? strtotime($to)   : time();
        $from_ts = $from ? strtotime($from) : strtotime('-30 days', $to_ts);
        if (!$from_ts || !$to_ts || $from_ts > $to_ts) {
            return new WP_REST_Response(['message' => 'Invalid date range'], 400);
        }

        $from_str = gmdate('Y-m-d 00:00:00', $from_ts);
        $to_str   = gmdate('Y-m-d 23:59:59', $to_ts);

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
            'total_views'      => (int) $total_views,
            'unique_visitors'  => $total_unique,
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
     * GET /media/{mediaId}/usage
     * Returns which campaigns reference this media item.
     */
    public static function get_media_usage() {
        $request  = func_get_arg(0);
        $media_id = sanitize_text_field($request->get_param('mediaId'));

        if (empty($media_id)) {
            return new WP_REST_Response(['message' => 'mediaId is required'], 400);
        }

        $campaigns = get_posts([
            'post_type'      => WPSG_CPT::POST_TYPE,
            'posts_per_page' => -1,
            'post_status'    => ['publish', 'draft', 'private'],
        ]);

        $found = [];
        foreach ($campaigns as $campaign) {
            $items = get_post_meta($campaign->ID, 'media_items', true);
            if (!is_array($items)) {
                continue;
            }
            foreach ($items as $item) {
                if (($item['id'] ?? '') === $media_id) {
                    $found[] = ['id' => strval($campaign->ID), 'title' => $campaign->post_title];
                    break; // at most once per campaign
                }
            }
        }

        return new WP_REST_Response(['count' => count($found), 'campaigns' => $found], 200);
    }

    /**
     * GET /media/usage-summary?ids[]=id1&ids[]=id2...
     * Returns a map { mediaId: count } for the given IDs.
     */
    public static function get_media_usage_summary() {
        $request = func_get_arg(0);
        $ids     = $request->get_param('ids');

        if (!is_array($ids) || empty($ids)) {
            return new WP_REST_Response((object)[], 200);
        }

        $ids = array_values(array_unique(array_map('sanitize_text_field', $ids)));
        if (count($ids) > 200) {
            return new WP_REST_Response(['message' => 'Too many IDs (max 200)'], 400);
        }

        $id_set = array_fill_keys($ids, 0);

        $campaigns = get_posts([
            'post_type'      => WPSG_CPT::POST_TYPE,
            'posts_per_page' => -1,
            'post_status'    => ['publish', 'draft', 'private'],
        ]);

        foreach ($campaigns as $campaign) {
            $items = get_post_meta($campaign->ID, 'media_items', true);
            if (!is_array($items)) {
                continue;
            }
            $seen = [];
            foreach ($items as $item) {
                $mid = $item['id'] ?? '';
                // Count each campaign only once per media ID
                if (isset($id_set[$mid]) && !in_array($mid, $seen, true)) {
                    $id_set[$mid]++;
                    $seen[] = $mid;
                }
            }
        }

        return new WP_REST_Response((object)$id_set, 200);
    }

    /**
     * P18-H helper: return category names for a campaign post.
     */
    private static function get_campaign_category_names($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_campaign_category', ['fields' => 'names']);
        return is_array($terms) && !is_wp_error($terms) ? array_values($terms) : [];
    }

    /**
     * GET /campaign-categories
     * Returns all wpsg_campaign_category terms (id, name, slug, count).
     */
    public static function list_campaign_categories() {
        $terms = get_terms([
            'taxonomy'   => 'wpsg_campaign_category',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ]);

        if (is_wp_error($terms)) {
            return new WP_REST_Response(['message' => 'Failed to retrieve categories'], 500);
        }

        $result = array_map(function ($term) {
            return [
                'id'    => strval($term->term_id),
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => (int) $term->count,
            ];
        }, $terms);

        return new WP_REST_Response($result, 200);
    }

    public static function list_media() {
        $start = microtime(true);
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $user_id = get_current_user_id();
        if (!self::can_view_campaign($post_id, $user_id)) {
            return new WP_REST_Response(['message' => 'Forbidden'], 403);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];

        // Normalize legacy media types on read for accuracy
        $updated_count = 0;
        $normalized = self::normalize_media_items_types($media_items);
        $media_items = self::enrich_media_with_dimensions($normalized['items']);
        $updated_count = $normalized['updated'];

        if ($updated_count > 0) {
            update_post_meta($post_id, 'media_items', $media_items);
            self::add_audit_entry($post_id, 'media.types_rescanned', [
                'updated' => $updated_count,
            ]);
        }

        $payload = [
            'items' => $media_items,
            'meta' => [
                'typesUpdated' => $updated_count,
                'total' => count($media_items),
            ],
        ];

        $response = self::respond_with_etag($request, $payload, 200, (string) $post_id);
        self::log_slow_rest('media.list', $start, [
            'campaignId' => $post_id,
            'total' => count($media_items),
        ]);
        return $response;
    }

    public static function create_media() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $type = sanitize_text_field($request->get_param('type'));
        $source = sanitize_text_field($request->get_param('source'));
        $caption = sanitize_text_field($request->get_param('caption'));
        $order = intval($request->get_param('order'));
        if ($order < 0) {
            $order = 0;
        } elseif ($order > 1000000) {
            $order = 1000000;
        }
        $thumbnail = esc_url_raw($request->get_param('thumbnail'));

        if (!in_array($type, ['video', 'image'], true)) {
            return new WP_REST_Response(['message' => 'Invalid media type'], 400);
        }

        $media_item = [
            'id' => uniqid('m', true),
            'type' => $type,
            'source' => $source,
            'caption' => $caption,
            'order' => $order,
        ];

        if ($source === 'external') {
            $url = esc_url_raw($request->get_param('url'));
            $normalized = self::normalize_external_media($url);
            if (is_wp_error($normalized)) {
                return new WP_REST_Response(['message' => $normalized->get_error_message()], 400);
            }
            $media_item['url'] = $normalized['url'];
            $media_item['embedUrl'] = $normalized['embedUrl'];
            $media_item['provider'] = $normalized['provider'];
            $media_item['thumbnail'] = $thumbnail;
        } elseif ($source === 'upload') {
            $attachment_id = intval($request->get_param('attachmentId'));
            if ($attachment_id <= 0) {
                return new WP_REST_Response(['message' => 'attachmentId is required for uploads'], 400);
            }
            $attachment_url = wp_get_attachment_url($attachment_id);
            if (!$attachment_url) {
                return new WP_REST_Response(['message' => 'Invalid attachmentId'], 400);
            }
            $media_item['attachmentId'] = $attachment_id;
            $media_item['url'] = $attachment_url;
            $media_item['thumbnail'] = $thumbnail ?: $attachment_url;
        } else {
            return new WP_REST_Response(['message' => 'Invalid media source'], 400);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        if (!is_array($media_items)) {
            $media_items = [];
        }
        $media_items[] = $media_item;
        update_post_meta($post_id, 'media_items', $media_items);

        self::add_audit_entry($post_id, 'media.created', [
            'mediaId' => $media_item['id'],
            'type' => $media_item['type'],
            'source' => $media_item['source'],
            'provider' => $media_item['provider'] ?? '',
            'url' => $media_item['url'] ?? '',
            'attachmentId' => $media_item['attachmentId'] ?? 0,
        ]);

        return new WP_REST_Response($media_item, 201);
    }

    public static function list_access() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

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

        $effective = array_values(array_filter(array_merge($company_grants, $campaign_grants), function ($entry) use ($deny_user_ids) {
            $user_id = intval($entry['userId'] ?? 0);
            return $user_id > 0 && !in_array($user_id, $deny_user_ids, true);
        }));

        // Enrich with user details
        $user_ids = array_unique(array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $effective));
        
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
            return $entry;
        }, $effective);

        return new WP_REST_Response($enriched, 200);
    }

    public static function grant_access() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $user_id = intval($request->get_param('userId'));
        $source = sanitize_text_field($request->get_param('source'));
        $action = sanitize_text_field($request->get_param('action')) ?: 'grant';

        if ($user_id <= 0) {
            return new WP_REST_Response(['message' => 'userId is required'], 400);
        }

        if (!in_array($source, ['company', 'campaign'], true)) {
            return new WP_REST_Response(['message' => 'Invalid source'], 400);
        }

        $entry = [
            'userId' => $user_id,
            'campaignId' => $post_id,
            'source' => $source,
            'grantedAt' => gmdate('c'),
        ];

        if ($source === 'company') {
            $company_term = self::get_company_term($post_id);
            if (!$company_term) {
                return new WP_REST_Response(['message' => 'Company not set for campaign'], 400);
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

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Access updated'], 200);
    }

    public static function revoke_access() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));
        if (!self::campaign_exists($post_id) || $user_id <= 0) {
            return new WP_REST_Response(['message' => 'Invalid request'], 400);
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
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Access revoked'], 200);
    }

    // -------------------------------------------------------------------------
    // P18-I: Access Request Workflow helpers
    // -------------------------------------------------------------------------

    /** Return the option name for a single request. */
    private static function access_request_option(string $token): string {
        return 'wpsg_access_request_' . $token;
    }

    /** Retrieve the stored request data for $token, or null if not found. */
    private static function get_access_request(string $token): ?array {
        $data = get_option(self::access_request_option($token), null);
        return is_array($data) ? $data : null;
    }

    /** Persist the request data and ensure the global index contains $token. */
    private static function save_access_request(string $token, array $data): void {
        update_option(self::access_request_option($token), $data, false);
        $index = get_option('wpsg_access_request_index', []);
        if (!is_array($index)) {
            $index = [];
        }
        if (!in_array($token, $index, true)) {
            $index[] = $token;
            update_option('wpsg_access_request_index', $index, false);
        }
    }

    /** Remove a request from storage and from the global index. */
    private static function delete_access_request(string $token): void {
        delete_option(self::access_request_option($token));
        $index = get_option('wpsg_access_request_index', []);
        if (!is_array($index)) {
            return;
        }
        $index = array_values(array_diff($index, [$token]));
        update_option('wpsg_access_request_index', $index, false);
    }

    // -------------------------------------------------------------------------
    // P18-I: Handler methods
    // -------------------------------------------------------------------------

    /**
     * POST /campaigns/{id}/access-requests
     * Public (rate-limited) — submit an access request by email.
     */
    public static function submit_access_request() {
        $request    = func_get_arg(0);
        $post_id    = intval($request->get_param('id'));
        $email      = sanitize_email($request->get_param('email') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }
        if (!is_email($email)) {
            return new WP_REST_Response(['message' => 'A valid email address is required'], 400);
        }

        // 24-hour cooldown per email per campaign for previously denied requests
        $index = get_option('wpsg_access_request_index', []);
        if (is_array($index)) {
            foreach ($index as $existing_token) {
                $data = self::get_access_request((string) $existing_token);
                if (
                    $data &&
                    intval($data['campaign_id']) === $post_id &&
                    strtolower($data['email']) === strtolower($email)
                ) {
                    if ($data['status'] === 'pending') {
                        return new WP_REST_Response([
                            'message' => 'A request for this email is already pending.',
                        ], 409);
                    }
                    if ($data['status'] === 'denied') {
                        $cooldown_seconds = 24 * 60 * 60;
                        $elapsed = time() - strtotime($data['requested_at']);
                        if ($elapsed < $cooldown_seconds) {
                            return new WP_REST_Response([
                                'message' => 'Please wait 24 hours before submitting another request.',
                            ], 429);
                        }
                        // Remove stale denied request so a fresh one can be created
                        self::delete_access_request((string) $existing_token);
                    }
                }
            }
        }

        $token = wp_generate_uuid4();
        $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
        $now    = gmdate('c');

        $data = [
            'token'        => $token,
            'email'        => $email,
            'campaign_id'  => $post_id,
            'status'       => 'pending',
            'requested_at' => $now,
        ];
        self::save_access_request($token, $data);

        // Confirmation email to the requester
        $site_name = get_bloginfo('name');
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
    public static function list_access_requests() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $status  = sanitize_text_field($request->get_param('status') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $index  = get_option('wpsg_access_request_index', []);
        $result = [];

        if (is_array($index)) {
            foreach ($index as $token) {
                $data = self::get_access_request((string) $token);
                if (!$data) {
                    continue;
                }
                if (intval($data['campaign_id']) !== $post_id) {
                    continue;
                }
                if ($status && $data['status'] !== $status) {
                    continue;
                }
                $result[] = [
                    'token'        => $data['token'],
                    'email'        => $data['email'],
                    'campaign_id'  => $data['campaign_id'],
                    'status'       => $data['status'],
                    'requested_at' => $data['requested_at'],
                    'resolved_at'  => $data['resolved_at'] ?? null,
                ];
            }
        }

        // Sort newest-first
        usort($result, function ($a, $b) {
            return strcmp($b['requested_at'], $a['requested_at']);
        });

        return new WP_REST_Response($result, 200);
    }

    /**
     * POST /campaigns/{id}/access-requests/{token}/approve
     * Admin — approve a pending access request.
     */
    public static function approve_access_request() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $data = self::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return new WP_REST_Response(['message' => 'Request not found'], 404);
        }
        if ($data['status'] !== 'pending') {
            return new WP_REST_Response(['message' => 'Request already resolved'], 409);
        }

        // Provision access: look up or create a WP user for this email
        $user = get_user_by('email', $data['email']);
        if (!$user) {
            $username = sanitize_user(explode('@', $data['email'])[0], true);
            // Ensure unique username
            $base = $username ?: 'user';
            $username = $base;
            $suffix = 1;
            while (username_exists($username)) {
                $username = $base . $suffix++;
            }
            $user_id = wp_create_user($username, wp_generate_password(), $data['email']);
            if (is_wp_error($user_id)) {
                return new WP_REST_Response(['message' => 'Failed to create user: ' . $user_id->get_error_message()], 500);
            }
            $user = get_user_by('ID', $user_id);
        }

        // Grant access (campaign-level)
        $grants = get_post_meta($post_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];
        $grants = self::upsert_grant($grants, [
            'userId'    => $user->ID,
            'campaignId' => $post_id,
            'source'    => 'campaign',
            'grantedAt' => gmdate('c'),
        ]);
        update_post_meta($post_id, 'access_grants', $grants);
        self::clear_accessible_campaigns_cache();

        // Update request record
        $data['status']      = 'approved';
        $data['resolved_at'] = gmdate('c');
        self::save_access_request($token, $data);

        self::add_audit_entry($post_id, 'access.request.approved', [
            'email'  => $data['email'],
            'userId' => $user->ID,
            'token'  => $token,
        ]);

        // Notify requester
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

        return new WP_REST_Response(['message' => 'Access request approved'], 200);
    }

    /**
     * POST /campaigns/{id}/access-requests/{token}/deny
     * Admin — deny a pending access request.
     */
    public static function deny_access_request() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $data = self::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return new WP_REST_Response(['message' => 'Request not found'], 404);
        }
        if ($data['status'] !== 'pending') {
            return new WP_REST_Response(['message' => 'Request already resolved'], 409);
        }

        $data['status']      = 'denied';
        $data['resolved_at'] = gmdate('c');
        self::save_access_request($token, $data);

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
    public static function list_companies() {
        $request = func_get_arg(0);
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?? 50)));
        $offset = ($page - 1) * $per_page;

        $terms = get_terms([
            'taxonomy' => 'wpsg_company',
            'hide_empty' => false,
            'number' => $per_page,
            'offset' => $offset,
        ]);

        if (is_wp_error($terms)) {
            return new WP_REST_Response(['message' => 'Failed to fetch companies'], 500);
        }

        $companies = [];
        foreach ($terms as $term) {
            // Get campaigns for this company
            $campaigns = get_posts([
                'post_type' => 'wpsg_campaign',
                'posts_per_page' => -1,
                'tax_query' => [
                    [
                        'taxonomy' => 'wpsg_company',
                        'field' => 'term_id',
                        'terms' => $term->term_id,
                    ],
                ],
            ]);

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

        $response = new WP_REST_Response($companies, 200);
        $total = wp_count_terms('wpsg_company', ['hide_empty' => false]);
        $response->header('X-WPSG-Total', (string) $total);
        $response->header('X-WPSG-Page', (string) $page);
        $response->header('X-WPSG-Per-Page', (string) $per_page);
        return $response;
    }

    /**
     * List access grants for a specific company (company-level + optionally all campaign grants)
     */
    public static function list_company_access() {
        $start = microtime(true);
        $request = func_get_arg(0);
        $term_id = intval($request->get_param('id'));
        $include_campaigns = $request->get_param('include_campaigns') === 'true';

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_REST_Response(['message' => 'Company not found'], 404);
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

        // Enrich with user details
        $user_ids = array_unique(array_filter(array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $all_grants)));

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
            return $entry;
        }, $all_grants);

        $response = new WP_REST_Response($enriched, 200);
        self::log_slow_rest('companies.access', $start, [
            'companyId' => $term_id,
            'entries' => count($enriched),
            'includeCampaigns' => $include_campaigns,
        ]);
        return $response;
    }

    /**
     * Grant company-wide access to a user
     */
    public static function grant_company_access() {
        $request = func_get_arg(0);
        $term_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_REST_Response(['message' => 'Company not found'], 404);
        }

        if ($user_id <= 0) {
            return new WP_REST_Response(['message' => 'userId is required'], 400);
        }

        $grants = get_term_meta($term_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];

        $entry = [
            'userId' => $user_id,
            'companyId' => $term_id,
            'source' => 'company',
            'grantedAt' => gmdate('c'),
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
    public static function revoke_company_access() {
        $request = func_get_arg(0);
        $term_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_REST_Response(['message' => 'Company not found'], 404);
        }

        if ($user_id <= 0) {
            return new WP_REST_Response(['message' => 'userId is required'], 400);
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
    public static function archive_company() {
        $request = func_get_arg(0);
        $term_id = intval($request->get_param('id'));
        $revoke_access = $request->get_param('revokeAccess') === true || $request->get_param('revokeAccess') === 'true';

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_REST_Response(['message' => 'Company not found'], 404);
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

    public static function update_media() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $media_id = sanitize_text_field($request->get_param('mediaId'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $updated = false;

        foreach ($media_items as &$media_item) {
            if (($media_item['id'] ?? '') === $media_id) {
                if (!is_null($request->get_param('caption'))) {
                    $media_item['caption'] = sanitize_text_field($request->get_param('caption'));
                }
                if (!is_null($request->get_param('order'))) {
                    $media_item['order'] = intval($request->get_param('order'));
                }
                if (!is_null($request->get_param('thumbnail'))) {
                    $media_item['thumbnail'] = esc_url_raw($request->get_param('thumbnail'));
                }
                $updated = true;
                break;
            }
        }
        unset($media_item);

        if (!$updated) {
            return new WP_REST_Response(['message' => 'Media not found'], 404);
        }

        update_post_meta($post_id, 'media_items', $media_items);
        self::add_audit_entry($post_id, 'media.updated', [
            'mediaId' => $media_id,
        ]);
        return new WP_REST_Response(['message' => 'Media updated'], 200);
    }

    public static function reorder_media() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $items = $request->get_param('items');
        if (!is_array($items)) {
            return new WP_REST_Response(['message' => 'items must be an array'], 400);
        }

        $order_map = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $id = sanitize_text_field($item['id'] ?? '');
            $order = intval($item['order'] ?? 0);
            if (!$id) {
                continue;
            }
            if ($order < 0) {
                $order = 0;
            } elseif ($order > 1000000) {
                $order = 1000000;
            }
            $order_map[$id] = $order;
        }

        if (empty($order_map)) {
            return new WP_REST_Response(['message' => 'No valid items provided'], 400);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];

        // Validate that all provided IDs belong to this campaign's media items.
        $existing_ids = array_map(function ($m) { return $m['id'] ?? ''; }, $media_items);
        $invalid = array_values(array_filter(array_keys($order_map), function ($id) use ($existing_ids) {
            return !in_array($id, $existing_ids, true);
        }));
        if (!empty($invalid)) {
            return new WP_REST_Response(['message' => 'Invalid media id(s) provided', 'invalid' => $invalid], 400);
        }

        foreach ($media_items as &$media_item) {
            $id = $media_item['id'] ?? '';
            if ($id && array_key_exists($id, $order_map)) {
                $media_item['order'] = $order_map[$id];
            }
        }
        unset($media_item);

        update_post_meta($post_id, 'media_items', $media_items);
        self::add_audit_entry($post_id, 'media.reordered', [
            'count' => count($order_map),
        ]);

        return new WP_REST_Response(['message' => 'Media reordered'], 200);
    }

    /**
     * Infer media type from URL (file extension or known video providers).
     */
    private static function infer_media_type_from_url($url) {
        $image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
        $video_extensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wmv', 'flv'];
        
        // Parse the URL and get the path extension
        $parsed = wp_parse_url($url);
        $path = isset($parsed['path']) ? strtolower($parsed['path']) : '';
        $extension = pathinfo($path, PATHINFO_EXTENSION);
        
        if (in_array($extension, $image_extensions, true)) {
            return 'image';
        }
        if (in_array($extension, $video_extensions, true)) {
            return 'video';
        }
        
        // Check for known video providers in the URL
        $video_providers = ['youtube.com', 'youtu.be', 'vimeo.com', 'rumble.com', 'bitchute.com', 'odysee.com', 'dailymotion.com'];
        $host = isset($parsed['host']) ? strtolower($parsed['host']) : '';
        foreach ($video_providers as $provider) {
            if (strpos($host, $provider) !== false) {
                return 'video';
            }
        }
        
        // Default: keep existing type or assume video for external
        return null;
    }

    /**
     * Normalize media item types, including legacy records missing/incorrect type fields.
     *
     * @param array $media_items
     * @return array{items: array, updated: int}
     */
    private static function normalize_media_items_types(array $media_items) {
        $updated_count = 0;

        foreach ($media_items as &$media_item) {
            $url = $media_item['url'] ?? '';
            $current_type = $media_item['type'] ?? '';
            $inferred_type = self::infer_media_type_from_url($url);

            if (!empty($media_item['embedUrl'])) {
                $inferred_type = 'video';
            }

            if ($inferred_type && $inferred_type !== $current_type) {
                $media_item['type'] = $inferred_type;
                $updated_count++;
            }
        }
        unset($media_item);

        return [
            'items' => $media_items,
            'updated' => $updated_count,
        ];
    }

    /**
     * Enrich media items with width/height from WP attachment metadata.
     * Items that already carry dimensions are left unchanged.
     * Images without stored dimensions are probed via wp_get_attachment_metadata().
     *
     * @param array $items Normalised media items array.
     * @return array Items with 'width' / 'height' fields populated where possible.
     */
    private static function enrich_media_with_dimensions(array $items): array {
        foreach ($items as &$item) {
            // Already has server-side dimensions — nothing to do.
            if (!empty($item['width']) && !empty($item['height'])) {
                continue;
            }

            $attachment_id = intval($item['attachmentId'] ?? 0);
            if ($attachment_id > 0 && ($item['type'] ?? '') === 'image') {
                $meta = wp_get_attachment_metadata($attachment_id);
                if (!empty($meta['width']) && !empty($meta['height'])) {
                    $item['width']  = intval($meta['width']);
                    $item['height'] = intval($meta['height']);
                }
            }
        }
        unset($item);

        return $items;
    }

    /**
     * Rescan and fix media types for a single campaign.
     */
    public static function rescan_media_types() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        if (!is_array($media_items) || empty($media_items)) {
            return new WP_REST_Response(['message' => 'No media items to scan', 'updated' => 0], 200);
        }

        $updated_count = 0;
        foreach ($media_items as &$media_item) {
            $url = $media_item['url'] ?? '';
            $current_type = $media_item['type'] ?? '';
            $inferred_type = self::infer_media_type_from_url($url);
            
            if ($inferred_type && $inferred_type !== $current_type) {
                $media_item['type'] = $inferred_type;
                $updated_count++;
            }
        }
        unset($media_item);

        if ($updated_count > 0) {
            update_post_meta($post_id, 'media_items', $media_items);
            self::add_audit_entry($post_id, 'media.types_rescanned', [
                'updated' => $updated_count,
            ]);
        }

        return new WP_REST_Response([
            'message' => $updated_count > 0 ? 'Media types updated' : 'No changes needed',
            'updated' => $updated_count,
            'total' => count($media_items),
        ], 200);
    }

    /**
     * Rescan and fix media types for ALL campaigns.
     */
    public static function rescan_all_media_types() {
        $campaigns = get_posts([
            'post_type' => WPSG_CPT::POST_TYPE,
            'posts_per_page' => -1,
            'post_status' => ['publish', 'draft', 'private'],
        ]);

        $total_updated = 0;
        $campaigns_updated = 0;

        foreach ($campaigns as $campaign) {
            $media_items = get_post_meta($campaign->ID, 'media_items', true);
            if (!is_array($media_items) || empty($media_items)) {
                continue;
            }

            $updated_count = 0;
            foreach ($media_items as &$media_item) {
                $url = $media_item['url'] ?? '';
                $current_type = $media_item['type'] ?? '';
                $inferred_type = self::infer_media_type_from_url($url);
                
                if ($inferred_type && $inferred_type !== $current_type) {
                    $media_item['type'] = $inferred_type;
                    $updated_count++;
                }
            }
            unset($media_item);

            if ($updated_count > 0) {
                update_post_meta($campaign->ID, 'media_items', $media_items);
                self::add_audit_entry($campaign->ID, 'media.types_rescanned', [
                    'updated' => $updated_count,
                ]);
                $total_updated += $updated_count;
                $campaigns_updated++;
            }
        }

        return new WP_REST_Response([
            'message' => $total_updated > 0 ? 'Media types updated' : 'No changes needed',
            'campaigns_scanned' => count($campaigns),
            'campaigns_updated' => $campaigns_updated,
            'media_updated' => $total_updated,
        ], 200);
    }

    public static function delete_media() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $media_id = sanitize_text_field($request->get_param('mediaId'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $media_items = array_values(array_filter($media_items, function ($item) use ($media_id) {
            return ($item['id'] ?? '') !== $media_id;
        }));
        update_post_meta($post_id, 'media_items', $media_items);

        self::add_audit_entry($post_id, 'media.deleted', [
            'mediaId' => $media_id,
        ]);

        return new WP_REST_Response(['message' => 'Media deleted'], 200);
    }

    public static function list_audit() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        $entries = get_post_meta($post_id, 'audit_log', true);
        $entries = is_array($entries) ? $entries : [];
        return new WP_REST_Response($entries, 200);
    }

    public static function upload_media() {
        $request = func_get_arg(0);
        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_REST_Response(['message' => 'File is required'], 400);
        }

        $file = $files['file'];
        if (isset($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
            $message = 'Upload failed.';
            $status = 400;
            switch ($file['error']) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $message = 'Uploaded file exceeds the allowed size.';
                    $status = 413;
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $message = 'The uploaded file was only partially uploaded.';
                    $status = 400;
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $message = 'No file was uploaded.';
                    $status = 400;
                    break;
                case UPLOAD_ERR_NO_TMP_DIR:
                case UPLOAD_ERR_CANT_WRITE:
                case UPLOAD_ERR_EXTENSION:
                    $message = 'Server error while processing upload.';
                    $status = 500;
                    break;
            }
            return new WP_REST_Response(['message' => $message], $status);
        }
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            return new WP_REST_Response(['message' => 'Invalid upload'], 400);
        }

        $allowed_mimes = apply_filters('wpsg_upload_allowed_mimes', [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/webm',
            'video/ogg',
        ]);

        $size_limit = intval(apply_filters('wpsg_upload_max_bytes', 50 * 1024 * 1024));
        if (isset($file['size']) && $file['size'] > $size_limit) {
            return new WP_REST_Response(['message' => 'File too large'], 413);
        }

        $check = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
        $mime = $check['type'] ?? '';
        $ext = $check['ext'] ?? '';
        $check_filename = wp_check_filetype($file['name']);
        $mime_filename = $check_filename['type'] ?? '';

        if (!$mime || !in_array($mime, $allowed_mimes, true)) {
            return new WP_REST_Response(['message' => 'Invalid file type'], 415);
        }

        if (!$ext || ($mime_filename && $mime_filename !== $mime)) {
            return new WP_REST_Response(['message' => 'Invalid file type'], 415);
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $attachment_id = media_handle_upload('file', 0);
        if (is_wp_error($attachment_id)) {
            return new WP_REST_Response(['message' => $attachment_id->get_error_message()], 400);
        }

        $url = wp_get_attachment_url($attachment_id);

        // Generate thumbnail for images
        $thumbnail = null;
        $mime = get_post_mime_type($attachment_id);
        if ($mime && strpos($mime, 'image') === 0) {
            $thumb = wp_get_attachment_image_src($attachment_id, 'medium');
            $thumbnail = $thumb ? $thumb[0] : $url;
        }

        return new WP_REST_Response([
            'attachmentId' => $attachment_id,
            'url' => $url,
            'thumbnail' => $thumbnail,
        ], 201);
    }

    /**
     * List media items from the WordPress Media Library.
     * Returns image and video attachments that can be associated with campaigns.
     */
    public static function list_media_library() {
        $request = func_get_arg(0);
        $per_page = intval($request->get_param('per_page') ?? 50);
        $page = intval($request->get_param('page') ?? 1);
        $search = sanitize_text_field($request->get_param('search') ?? '');

        $args = [
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => min($per_page, 100),
            'paged' => max($page, 1),
            'orderby' => 'date',
            'order' => 'DESC',
            'post_mime_type' => ['image', 'video'],
        ];

        if (!empty($search)) {
            $args['s'] = $search;
        }

        $query = new WP_Query($args);
        $items = [];

        foreach ($query->posts as $post) {
            $mime = get_post_mime_type($post->ID);
            $type = 'other';
            if (strpos($mime, 'image') === 0) {
                $type = 'image';
            } elseif (strpos($mime, 'video') === 0) {
                $type = 'video';
            }

            $url = wp_get_attachment_url($post->ID);
            $thumbnail = null;
            if ($type === 'image') {
                $thumb = wp_get_attachment_image_src($post->ID, 'thumbnail');
                $thumbnail = $thumb ? $thumb[0] : null;
            } elseif ($type === 'video') {
                // Try to get video poster/thumbnail if WP generated one
                $poster_id = get_post_meta($post->ID, '_thumbnail_id', true);
                if ($poster_id) {
                    $poster_src = wp_get_attachment_image_src(intval($poster_id), 'medium');
                    $thumbnail = $poster_src ? $poster_src[0] : null;
                }
            }

            $items[] = [
                'id' => strval($post->ID),
                'type' => $type,
                'source' => 'upload',
                'url' => $url,
                'thumbnail' => $thumbnail,
                'caption' => $post->post_excerpt ?: $post->post_title,
                'filename' => basename(get_attached_file($post->ID)),
                'mimeType' => $mime,
                'dateCreated' => $post->post_date,
            ];
        }

        $payload = [
            'items' => $items,
            'total' => $query->found_posts,
            'pages' => $query->max_num_pages,
            'page' => $page,
        ];

        return self::respond_with_etag($request, $payload, 200, sprintf('%d:%d:%s', $page, $per_page, $search));
    }

    public static function proxy_oembed() {
        $request = func_get_arg(0);

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

        $url = esc_url_raw($request->get_param('url'));
        if (empty($url)) {
            return new WP_REST_Response(['message' => 'url is required'], 400);
        }

        $parsed = wp_parse_url($url);
        if (!is_array($parsed)) {
            return new WP_REST_Response(['message' => 'Invalid oEmbed URL'], 400);
        }

        // Basic SSRF mitigations: require HTTPS and block private/internal IPs.
        $host = isset($parsed['host']) ? $parsed['host'] : '';
        $scheme = isset($parsed['scheme']) ? strtolower($parsed['scheme']) : '';
        if (empty($host)) {
            return new WP_REST_Response(['message' => 'Invalid oEmbed URL host'], 400);
        }

        // Normalize IPv6 literals wrapped in brackets (e.g. [::1])
        if (strlen($host) > 2 && $host[0] === '[' && substr($host, -1) === ']') {
            $host = substr($host, 1, -1);
        }

        if ($scheme !== 'https') {
            return new WP_REST_Response(['message' => 'Only HTTPS oEmbed URLs are allowed'], 400);
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
                    return new WP_REST_Response(['message' => 'Unable to resolve host for oEmbed URL'], 400);
                }
            }

            foreach ($ips_to_check as $ip) {
                if (self::is_private_ip($ip)) {
                    return new WP_REST_Response(['message' => 'oEmbed host resolves to a private or disallowed IP'], 400);
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
        $result = WPSG_OEmbed_Providers::fetch($url, $parsed, $attempts);

        // Remove the SSRF filter immediately after the fetch completes.
        if ($wpsg_ssrf_filter !== null) {
            remove_filter('pre_http_request', $wpsg_ssrf_filter, 10);
        }

        // H-2: If the SSRF filter blocked the request due to DNS rebinding,
        // return a clear 400 instead of a generic 502 failure.
        if ($wpsg_ssrf_blocked) {
            return new WP_REST_Response(['message' => 'DNS rebinding detected: oEmbed host resolved to a private IP'], 400);
        }

        if (is_array($result) && !empty($result)) {
            // If provider returned an error payload, cache it for a short TTL
            // to avoid hammering external services on repeated requests.
            if (!empty($result['error'])) {
                $error_payload = $result;
                $error_payload['_wpsg_status'] = 502;
                // Log and metric: record repeated oEmbed failures
                error_log('WPSG oEmbed failure for ' . $url . ': ' . json_encode($attempts));
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
        error_log('WPSG oEmbed fallback cached for ' . $url . ': ' . json_encode($attempts));
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

            return new WP_REST_Response([
                'code'    => 'invalid_credentials',
                'message' => 'Invalid username or password.',
            ], 401);
        }

        // Explicitly set the current user so subsequent calls
        // (wp_create_nonce, current_user_can, etc.) work in this request.
        wp_set_current_user($user->ID);

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
    public static function search_users() {
        $request = func_get_arg(0);
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
    public static function create_user() {
        $request = func_get_arg(0);
        $email = sanitize_email($request->get_param('email') ?? '');
        $display_name = sanitize_text_field($request->get_param('displayName') ?? '');
        $role = sanitize_text_field($request->get_param('role') ?? 'subscriber');
        $campaign_id = intval($request->get_param('campaignId') ?? 0);

        // Validate required fields
        if (empty($email) || !is_email($email)) {
            return new WP_REST_Response(['message' => 'Valid email is required.'], 400);
        }

        if (empty($display_name)) {
            return new WP_REST_Response(['message' => 'Display name is required.'], 400);
        }

        // Check if email already exists
        if (email_exists($email)) {
            return new WP_REST_Response(['message' => 'A user with this email already exists.'], 409);
        }

        // Validate role exists and prevent privilege escalation
        $allowed_roles = ['subscriber', 'wpsg_admin'];
        if (!in_array($role, $allowed_roles, true)) {
            return new WP_REST_Response(['message' => 'Invalid role. Allowed: subscriber, wpsg_admin.'], 400);
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
            return new WP_REST_Response(['message' => $user_id->get_error_message()], 500);
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
    public static function list_roles() {
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

        return new WP_REST_Response(['roles' => $roles], 200);
    }

    /**
     * Get public display settings for frontend consumption.
     * Admins get all settings; non-admins get display settings only.
     *
     * Uses WPSG_Settings::to_js() for DRY snake→camel conversion.
     *
     * @return WP_REST_Response Settings data.
     */
    public static function get_public_settings() {
        if (class_exists('WPSG_Settings')) {
            $settings = WPSG_Settings::get_settings();
        } else {
            $settings = [];
        }

        $is_admin = current_user_can('manage_options');
        return new WP_REST_Response(
            WPSG_Settings::to_js($settings, $is_admin),
            200
        );
    }

    /**
     * Update settings (admin only).
     *
     * Uses WPSG_Settings::from_js() for DRY camel→snake conversion
     * and WPSG_Settings::to_js() for the response.
     *
     * @return WP_REST_Response Updated settings.
     */
    public static function update_settings() {
        if (!class_exists('WPSG_Settings')) {
            return new WP_REST_Response(['error' => 'Settings not available'], 500);
        }

        $request = func_get_arg(0);
        $body = $request->get_json_params();
        $input = WPSG_Settings::from_js($body);
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $current = WPSG_Settings::get_settings();
        $merged = array_merge($current, $sanitized);
        update_option(WPSG_Settings::OPTION_NAME, $merged);

        return new WP_REST_Response(
            WPSG_Settings::to_js($merged, true),
            200
        );
    }

    private static function campaign_exists($post_id) {
        $post = get_post($post_id);
        return $post && $post->post_type === 'wpsg_campaign';
    }

    /**
     * Check if an IP address is private/reserved (SSRF protection).
     *
     * Handles both IPv4 and IPv6 addresses, including:
     * - IPv4 private ranges (10.x, 172.16-31.x, 192.168.x)
     * - IPv4 loopback (127.x)
     * - IPv4 link-local (169.254.x)
     * - IPv6 loopback (::1)
     * - IPv6 unique local (fc00::/7)
     * - IPv6 link-local (fe80::/10)
     * - IPv6-mapped IPv4 (::ffff:x.x.x.x)
     * - IPv6 documentation (2001:db8::/32)
     * - IPv6 discard (100::/64)
     *
     * @param string $ip The IP address to check.
     * @return bool True if the IP is private/reserved, false otherwise.
     */
    private static function is_private_ip($ip) {
        // Normalize the IP - remove brackets if present (common in URL parsing)
        $ip = trim($ip, '[]');

        // Check IPv4 first
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $long = sprintf('%u', ip2long($ip));
            $ranges = [
                ['10.0.0.0', '10.255.255.255'],         // Private (RFC 1918)
                ['172.16.0.0', '172.31.255.255'],       // Private (RFC 1918)
                ['192.168.0.0', '192.168.255.255'],     // Private (RFC 1918)
                ['127.0.0.0', '127.255.255.255'],       // Loopback (RFC 1122)
                ['169.254.0.0', '169.254.255.255'],     // Link-local (RFC 3927)
                ['0.0.0.0', '0.255.255.255'],           // "This" network (RFC 1122)
                ['100.64.0.0', '100.127.255.255'],      // Shared address space (RFC 6598)
                ['192.0.0.0', '192.0.0.255'],           // IETF Protocol Assignments (RFC 6890)
                ['192.0.2.0', '192.0.2.255'],           // TEST-NET-1 (RFC 5737)
                ['198.51.100.0', '198.51.100.255'],     // TEST-NET-2 (RFC 5737)
                ['203.0.113.0', '203.0.113.255'],       // TEST-NET-3 (RFC 5737)
            ];
            foreach ($ranges as $r) {
                $from = sprintf('%u', ip2long($r[0]));
                $to = sprintf('%u', ip2long($r[1]));
                if ($long >= $from && $long <= $to) {
                    return true;
                }
            }
            return false;
        }

        // Check IPv6
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            // Expand the IPv6 address to full notation for consistent checking
            $expanded = self::expand_ipv6($ip);
            if (!$expanded) {
                // Invalid IPv6 - treat as private for safety
                return true;
            }

            $lower = strtolower($expanded);

            // Loopback (::1)
            if ($lower === '0000:0000:0000:0000:0000:0000:0000:0001') {
                return true;
            }

            // Unspecified (::)
            if ($lower === '0000:0000:0000:0000:0000:0000:0000:0000') {
                return true;
            }

            // IPv4-mapped IPv6 (::ffff:x.x.x.x) - check the embedded IPv4
            if (substr($lower, 0, 30) === '0000:0000:0000:0000:0000:ffff:') {
                $ipv4_hex = substr($lower, 30);
                $parts = explode(':', $ipv4_hex);
                if (count($parts) === 2) {
                    $oct1 = hexdec(substr($parts[0], 0, 2));
                    $oct2 = hexdec(substr($parts[0], 2, 2));
                    $oct3 = hexdec(substr($parts[1], 0, 2));
                    $oct4 = hexdec(substr($parts[1], 2, 2));
                    $ipv4 = "$oct1.$oct2.$oct3.$oct4";
                    return self::is_private_ip($ipv4);
                }
            }

            // Get the first 16 bits (first group) for prefix checking
            $first_group = substr($lower, 0, 4);
            $first_byte = hexdec(substr($first_group, 0, 2));

            // Unique local addresses fc00::/7 (fc00-fdff)
            if ($first_byte >= 0xfc && $first_byte <= 0xfd) {
                return true;
            }

            // Link-local fe80::/10 (fe80-febf)
            if ($first_byte === 0xfe) {
                $second_nibble = hexdec(substr($first_group, 2, 1));
                // fe80-febf: second nibble is 8, 9, a, or b
                if ($second_nibble >= 0x8 && $second_nibble <= 0xb) {
                    return true;
                }
            }

            // Documentation 2001:db8::/32
            if (substr($lower, 0, 9) === '2001:0db8') {
                return true;
            }

            // Discard prefix 100::/64
            if (substr($lower, 0, 4) === '0100' && substr($lower, 0, 19) === '0100:0000:0000:0000') {
                return true;
            }

            // Multicast ff00::/8
            if ($first_byte === 0xff) {
                return true;
            }

            return false;
        }

        // If we can't validate the IP format, treat as private for safety
        return true;
    }

    /**
     * Public wrapper for is_private_ip() — used by the pre_http_request SSRF filter
     * closure in proxy_oembed() (H-2 DNS rebinding protection).
     *
     * @param string $ip The IP address to check.
     * @return bool True if the IP is private/reserved.
     */
    public static function check_private_ip($ip) {
        return self::is_private_ip($ip);
    }

    /**
     * Expand an IPv6 address to full notation (8 groups of 4 hex digits).
     *
     * @param string $ip The IPv6 address to expand.
     * @return string|false The expanded address or false on failure.
     */
    private static function expand_ipv6($ip) {
        // Use inet_pton and inet_ntop to normalize, then expand
        $packed = @inet_pton($ip);
        if ($packed === false) {
            return false;
        }

        // Convert to hex string
        $hex = bin2hex($packed);
        if (strlen($hex) !== 32) {
            return false;
        }

        // Format as 8 groups of 4 hex digits
        $groups = str_split($hex, 4);
        return implode(':', $groups);
    }

    private static function can_view_campaign($post_id, $user_id) {
        if ($user_id && current_user_can('manage_options')) {
            return true;
        }

        $visibility = get_post_meta($post_id, 'visibility', true) ?: 'private';
        if ($visibility === 'public') {
            return true;
        }

        if (!$user_id) {
            return false;
        }

        $deny_user_ids = self::get_campaign_deny_ids($post_id);
        if (in_array($user_id, $deny_user_ids, true)) {
            return false;
        }

        $grants = self::get_effective_grants($post_id);
        foreach ($grants as $entry) {
            if (intval($entry['userId'] ?? 0) === $user_id) {
                return true;
            }
        }

        return false;
    }

    private static function get_accessible_campaign_ids($user_id) {
        $sanitized_user_id = absint($user_id);
        $cache_key = 'wpsg_accessible_campaigns_' . $sanitized_user_id;
        $cached = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            return $cached;
        }

        $per_page = max(1, intval(apply_filters('wpsg_permissions_page_size', 200)));
        $page = 1;
        $campaign_ids = [];

        do {
            $query = new WP_Query([
                'post_type' => 'wpsg_campaign',
                'post_status' => 'publish',
                'posts_per_page' => $per_page,
                'paged' => $page,
                'fields' => 'ids',
                'no_found_rows' => true,
            ]);

            foreach ($query->posts as $post_id) {
                if (self::can_view_campaign($post_id, $user_id)) {
                    $campaign_ids[] = (string) $post_id;
                }
            }

            $page += 1;
        } while (count($query->posts) === $per_page);

        $ttl = max(1, intval(apply_filters('wpsg_permissions_cache_ttl', 15 * MINUTE_IN_SECONDS)));
        set_transient($cache_key, $campaign_ids, $ttl);
        return $campaign_ids;
    }

    private static function clear_accessible_campaigns_cache() {
        global $wpdb;

        // Clear accessible campaigns cache
        $prefix = $wpdb->esc_like('_transient_wpsg_accessible_campaigns_') . '%';
        $sql = $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            $prefix
        );
        $wpdb->query($sql);

        $timeout_prefix = $wpdb->esc_like('_transient_timeout_wpsg_accessible_campaigns_') . '%';
        $timeout_sql = $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            $timeout_prefix
        );
        $wpdb->query($timeout_sql);

        // Clear campaign list cache for all users
        $campaigns_prefix = $wpdb->esc_like('_transient_wpsg_campaigns_') . '%';
        $campaigns_sql = $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            $campaigns_prefix
        );
        $wpdb->query($campaigns_sql);

        $campaigns_timeout_prefix = $wpdb->esc_like('_transient_timeout_wpsg_campaigns_') . '%';
        $campaigns_timeout_sql = $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s",
            $campaigns_timeout_prefix
        );
        $wpdb->query($campaigns_timeout_sql);
    }

    private static function get_campaign_deny_ids($post_id) {
        $overrides = get_post_meta($post_id, 'access_overrides', true);
        $overrides = is_array($overrides) ? $overrides : [];
        return array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, array_filter($overrides, function ($entry) {
            return ($entry['action'] ?? '') === 'deny';
        }));
    }

    private static function get_effective_grants($post_id) {
        $company_term = self::get_company_term($post_id);
        $company_grants = $company_term ? get_term_meta($company_term->term_id, 'access_grants', true) : [];
        $campaign_grants = get_post_meta($post_id, 'access_grants', true);

        $company_grants = is_array($company_grants) ? $company_grants : [];
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];

        return array_values(array_merge($company_grants, $campaign_grants));
    }

    /**
     * Read a stored Y-m-d H:i:s UTC meta value and return ISO 8601 string (or '').
     */
    private static function meta_to_iso8601($post_id, $meta_key) {
        $value = (string) get_post_meta($post_id, $meta_key, true);
        if ($value === '') {
            return '';
        }
        $ts = strtotime($value . ' UTC');
        return $ts !== false ? gmdate('c', $ts) : '';
    }

    private static function format_campaign($post) {
        $company_term = self::get_company_term($post->ID);
        $company_id = $company_term ? $company_term->slug : '';
        $thumbnail_id = get_post_thumbnail_id($post->ID);
        $thumbnail_url = $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : '';

        return [
            'id' => (string) $post->ID,
            'companyId' => $company_id,
            'title' => $post->post_title,
            'description' => $post->post_content,
            'thumbnail' => $thumbnail_url,
            'coverImage' => (string) get_post_meta($post->ID, 'cover_image', true),
            'status' => (string) get_post_meta($post->ID, 'status', true) ?: 'draft',
            'visibility' => (string) get_post_meta($post->ID, 'visibility', true) ?: 'private',
            'tags' => get_post_meta($post->ID, 'tags', true) ?: [],
            'categories' => self::get_campaign_category_names($post->ID),
            'publishAt' => self::meta_to_iso8601($post->ID, 'publish_at'),
            'unpublishAt' => self::meta_to_iso8601($post->ID, 'unpublish_at'),
            'layoutTemplateId' => get_post_meta($post->ID, '_wpsg_layout_binding_template_id', true) ?: null,
            'layoutBinding' => get_post_meta($post->ID, '_wpsg_layout_binding', true) ?: null,
            'imageAdapterId' => get_post_meta($post->ID, '_wpsg_image_adapter_id', true) ?: null,
            'videoAdapterId' => get_post_meta($post->ID, '_wpsg_video_adapter_id', true) ?: null,
            'createdAt' => get_post_time('c', true, $post),
            'updatedAt' => get_post_modified_time('c', true, $post),
        ];
    }

    private static function apply_campaign_meta($post_id, $request) {
        $visibility = sanitize_text_field($request->get_param('visibility'));
        $status = sanitize_text_field($request->get_param('status'));
        $tags = $request->get_param('tags');
        $cover_image_param = $request->get_param('coverImage');
        $thumbnail_id = intval($request->get_param('thumbnailId'));

        $allowed_visibility = ['public', 'private'];
        if (!empty($visibility)) {
            if (!in_array($visibility, $allowed_visibility, true)) {
                return new WP_REST_Response(['message' => 'Invalid visibility value'], 400);
            }
            update_post_meta($post_id, 'visibility', $visibility);
        }
        $allowed_status = ['draft', 'active', 'archived'];
        if (!empty($status)) {
            if (!in_array($status, $allowed_status, true)) {
                return new WP_REST_Response(['message' => 'Invalid status value'], 400);
            }
            update_post_meta($post_id, 'status', $status);
        }
        if (is_array($tags)) {
            update_post_meta($post_id, 'tags', array_values(array_map('sanitize_text_field', $tags)));
        }

        // P18-H: Campaign categories — resolve names to term IDs, creating missing terms.
        $categories = $request->get_param('categories');
        if (is_array($categories)) {
            $term_ids = [];
            foreach ($categories as $cat_name) {
                $cat_name = sanitize_text_field($cat_name);
                if ($cat_name === '') {
                    continue;
                }
                $term = get_term_by('name', $cat_name, 'wpsg_campaign_category');
                if ($term && !is_wp_error($term)) {
                    $term_ids[] = $term->term_id;
                } else {
                    $new_term = wp_insert_term($cat_name, 'wpsg_campaign_category');
                    if (!is_wp_error($new_term)) {
                        $term_ids[] = $new_term['term_id'];
                    }
                }
            }
            wp_set_object_terms($post_id, $term_ids, 'wpsg_campaign_category');
        }
        if (!is_null($cover_image_param)) {
            $cover_image = esc_url_raw($cover_image_param);
            if ($cover_image === '') {
                delete_post_meta($post_id, 'cover_image');
            } else {
                update_post_meta($post_id, 'cover_image', $cover_image);
            }
        }
        if ($thumbnail_id > 0) {
            set_post_thumbnail($post_id, $thumbnail_id);
        }

        // P13-D: Campaign scheduling dates (UTC datetime or empty to clear).
        $publish_at = $request->get_param('publishAt');
        if (!is_null($publish_at)) {
            $publish_at = sanitize_text_field($publish_at);
            if ($publish_at === '') {
                delete_post_meta($post_id, 'publish_at');
            } else {
                $ts = strtotime($publish_at);
                if ($ts !== false) {
                    update_post_meta($post_id, 'publish_at', gmdate('Y-m-d H:i:s', $ts));
                }
            }
        }
        $unpublish_at = $request->get_param('unpublishAt');
        if (!is_null($unpublish_at)) {
            $unpublish_at = sanitize_text_field($unpublish_at);
            if ($unpublish_at === '') {
                delete_post_meta($post_id, 'unpublish_at');
            } else {
                $ts = strtotime($unpublish_at);
                if ($ts !== false) {
                    update_post_meta($post_id, 'unpublish_at', gmdate('Y-m-d H:i:s', $ts));
                }
            }
        }

        // Per-campaign gallery adapter overrides.
        $valid_adapters = ['classic', 'compact-grid', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'];
        $image_adapter_id = $request->get_param('imageAdapterId');
        if (!is_null($image_adapter_id)) {
            $image_adapter_id = sanitize_text_field($image_adapter_id);
            if ($image_adapter_id === '' || !in_array($image_adapter_id, $valid_adapters, true)) {
                delete_post_meta($post_id, '_wpsg_image_adapter_id');
            } else {
                update_post_meta($post_id, '_wpsg_image_adapter_id', $image_adapter_id);
            }
        }
        $video_adapter_id = $request->get_param('videoAdapterId');
        if (!is_null($video_adapter_id)) {
            $video_adapter_id = sanitize_text_field($video_adapter_id);
            if ($video_adapter_id === '' || !in_array($video_adapter_id, $valid_adapters, true)) {
                delete_post_meta($post_id, '_wpsg_video_adapter_id');
            } else {
                update_post_meta($post_id, '_wpsg_video_adapter_id', $video_adapter_id);
            }
        }

        // P15-B: Layout template binding.
        $layout_template_id = $request->get_param('layoutTemplateId');
        if (!is_null($layout_template_id)) {
            $layout_template_id = sanitize_text_field($layout_template_id);
            if ($layout_template_id === '') {
                delete_post_meta($post_id, '_wpsg_layout_binding_template_id');
                delete_post_meta($post_id, '_wpsg_layout_binding');
            } else {
                update_post_meta($post_id, '_wpsg_layout_binding_template_id', $layout_template_id);
            }
        }
        $layout_binding = $request->get_param('layoutBinding');
        if (!is_null($layout_binding) && is_array($layout_binding)) {
            // Sanitize slot overrides.
            $sanitized_binding = [
                'templateId' => sanitize_text_field($layout_binding['templateId'] ?? ''),
                'slotOverrides' => [],
            ];
            if (!empty($layout_binding['slotOverrides']) && is_array($layout_binding['slotOverrides'])) {
                foreach ($layout_binding['slotOverrides'] as $slot_id => $overrides) {
                    $clean = [];
                    if (isset($overrides['mediaId'])) {
                        $clean['mediaId'] = sanitize_text_field($overrides['mediaId']);
                    }
                    if (isset($overrides['objectPosition'])) {
                        $clean['objectPosition'] = sanitize_text_field($overrides['objectPosition']);
                    }
                    if (!empty($clean)) {
                        $sanitized_binding['slotOverrides'][sanitize_text_field($slot_id)] = $clean;
                    }
                }
            }
            update_post_meta($post_id, '_wpsg_layout_binding', $sanitized_binding);
            if (!empty($sanitized_binding['templateId'])) {
                update_post_meta($post_id, '_wpsg_layout_binding_template_id', $sanitized_binding['templateId']);
            }
        }
    }

    private static function assign_company($post_id, $company) {
        if (empty($company)) {
            return;
        }

        $company = sanitize_text_field($company);
        $term = term_exists($company, 'wpsg_company');
        if (!$term) {
            $term = wp_insert_term($company, 'wpsg_company');
        }
        if (!is_wp_error($term)) {
            wp_set_object_terms($post_id, intval($term['term_id']), 'wpsg_company', false);
        }
    }

    private static function get_company_term($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_company');
        if (!empty($terms) && !is_wp_error($terms)) {
            return $terms[0];
        }
        return null;
    }

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

    private static function add_audit_entry($post_id, $action, $details) {
        $entries = get_post_meta($post_id, 'audit_log', true);
        $entries = is_array($entries) ? $entries : [];
        $entries[] = [
            'id' => uniqid('audit_', true),
            'action' => sanitize_text_field($action),
            'details' => self::sanitize_audit_details($details),
            'userId' => get_current_user_id(),
            'createdAt' => gmdate('c'),
        ];

        if (count($entries) > 200) {
            $entries = array_slice($entries, -200);
        }

        update_post_meta($post_id, 'audit_log', $entries);
    }

    private static function sanitize_audit_details($details) {
        if (!is_array($details)) {
            return [];
        }

        $sanitized = [];
        foreach ($details as $key => $value) {
            $safe_key = sanitize_text_field($key);
            if (is_array($value)) {
                $sanitized[$safe_key] = self::sanitize_audit_details($value);
            } elseif (is_numeric($value)) {
                $sanitized[$safe_key] = $value + 0;
            } elseif (is_bool($value)) {
                $sanitized[$safe_key] = (bool) $value;
            } elseif (is_string($value)) {
                $sanitized[$safe_key] = sanitize_text_field($value);
            } else {
                $sanitized[$safe_key] = '';
            }
        }
        return $sanitized;
    }

    private static function log_slow_rest($label, $start_time, $context = []) {
        $elapsed_ms = (microtime(true) - $start_time) * 1000;
        $threshold_ms = intval(apply_filters('wpsg_slow_query_threshold_ms', 100));

        if ($elapsed_ms < $threshold_ms) {
            return;
        }

        $payload = [
            'label' => $label,
            'elapsedMs' => round($elapsed_ms, 2),
            'context' => $context,
        ];

        error_log('[WPSG] Slow REST: ' . wp_json_encode($payload));
        do_action('wpsg_slow_rest', $payload);
    }

    private static function normalize_external_media($url) {
        if (empty($url)) {
            return new WP_Error('invalid_url', 'URL is required');
        }

        $parsed = wp_parse_url($url);
        if (empty($parsed['scheme']) || strtolower($parsed['scheme']) !== 'https') {
            return new WP_Error('invalid_url', 'URL must use HTTPS');
        }

        $host = strtolower($parsed['host'] ?? '');
        $path = $parsed['path'] ?? '';
        $query = $parsed['query'] ?? '';

        if (in_array($host, ['www.youtube.com', 'youtube.com', 'youtu.be'], true)) {
            if ($host === 'youtu.be') {
                $video_id = trim($path, '/');
            } else {
                parse_str($query, $params);
                $video_id = $params['v'] ?? '';
            }
            if (!$video_id) {
                return new WP_Error('invalid_url', 'Invalid YouTube URL');
            }
            if (!preg_match('/^[a-zA-Z0-9_-]{11}$/', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid YouTube video ID format');
            }
            return [
                'provider' => 'youtube',
                'url' => $url,
                'embedUrl' => 'https://www.youtube.com/embed/' . esc_attr($video_id),
            ];
        }

        if ($host === 'vimeo.com' || $host === 'www.vimeo.com') {
            $video_id = trim($path, '/');
            if (!$video_id) {
                return new WP_Error('invalid_url', 'Invalid Vimeo URL');
            }
            if (!preg_match('/^[0-9]+$/', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid Vimeo video ID format');
            }
            return [
                'provider' => 'vimeo',
                'url' => $url,
                'embedUrl' => 'https://player.vimeo.com/video/' . esc_attr($video_id),
            ];
        }

        if ($host === 'rumble.com' || $host === 'www.rumble.com') {
            $slug = trim($path, '/');
            // Rumble share URLs often end with .html — strip that before validating
            $slug = preg_replace('/\.html$/i', '', $slug);
            if (!$slug) {
                return new WP_Error('invalid_url', 'Invalid Rumble URL');
            }

            // The canonical Rumble video identifier is the first slug segment (e.g. "v72ksce" from "v72ksce-...")
            $parts = explode('-', $slug);
            $video_id = $parts[0] ?? $slug;
            if (!preg_match('/^v[0-9a-zA-Z]+$/i', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid Rumble video ID format');
            }

            // Use the compact embed path that Rumble expects (video id only)
            $embed_url = 'https://rumble.com/embed/' . esc_attr($video_id) . '/';

            return [
                'provider' => 'rumble',
                'url' => $url,
                'embedUrl' => $embed_url,
            ];
        }

        if ($host === 'www.bitchute.com' || $host === 'bitchute.com') {
            $matches = [];
            if (!preg_match('#/video/([a-zA-Z0-9]+)/?#', $path, $matches)) {
                return new WP_Error('invalid_url', 'Invalid BitChute URL');
            }
            $video_id = $matches[1];
            if (!preg_match('/^[a-zA-Z0-9]+$/', $video_id)) {
                return new WP_Error('invalid_url', 'Invalid BitChute video ID format');
            }
            return [
                'provider' => 'bitchute',
                'url' => $url,
                'embedUrl' => 'https://www.bitchute.com/embed/' . esc_attr($video_id) . '/',
            ];
        }

        if ($host === 'odysee.com' || $host === 'www.odysee.com') {
            $matches = [];
            if (!preg_match('#/\$/embed/([^/]+)#', $path, $matches)) {
                $slug = trim($path, '/');
                $slug = preg_replace('#^@#', '', $slug);
                if (!$slug) {
                    return new WP_Error('invalid_url', 'Invalid Odysee URL');
                }
                $parts = explode('/', $slug);
                $embed_slug = end($parts);
            } else {
                $embed_slug = $matches[1];
            }
            if (!preg_match('/^[a-zA-Z0-9_:-]+$/', $embed_slug)) {
                return new WP_Error('invalid_url', 'Invalid Odysee video ID format');
            }
            return [
                'provider' => 'odysee',
                'url' => $url,
                'embedUrl' => 'https://odysee.com/$/embed/' . esc_attr($embed_slug),
            ];
        }

        return new WP_Error('invalid_url', 'Provider not supported');
    }

    // --- P14-C: Thumbnail cache endpoints ---

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

    public static function reset_oembed_failures() {
        $request = func_get_arg(0);
        $provider = sanitize_text_field($request->get_param('provider') ?? '');
        WPSG_Monitoring::reset_oembed_failures($provider ?: null);
        return new WP_REST_Response(['reset' => true], 200);
    }

    // --- P14-G: Tag endpoints ---

    public static function list_campaign_tags() {
        $terms = get_terms([
            'taxonomy'   => 'wpsg_campaign_tag',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ]);

        if (is_wp_error($terms)) {
            return new WP_REST_Response([], 200);
        }

        $result = array_map(function ($term) {
            return [
                'id'    => $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
            ];
        }, $terms);

        return new WP_REST_Response($result, 200);
    }

    public static function list_media_tags() {
        $terms = get_terms([
            'taxonomy'   => 'wpsg_media_tag',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ]);

        if (is_wp_error($terms)) {
            return new WP_REST_Response([], 200);
        }

        $result = array_map(function ($term) {
            return [
                'id'    => $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
            ];
        }, $terms);

        return new WP_REST_Response($result, 200);
    }

    // ── P15-B: Layout Template Handlers ──────────────────────

    /**
     * List all layout templates (admin).
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
            $status = $result->get_error_data()['status'] ?? 400;
            return new WP_REST_Response(['message' => $result->get_error_message()], $status);
        }

        return new WP_REST_Response($result, 201);
    }

    /**
     * Get a single layout template (admin).
     */
    public static function get_layout_template($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);

        if (!$template) {
            return new WP_REST_Response(['message' => 'Template not found.'], 404);
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
            $status = $result->get_error_data()['status'] ?? 400;
            return new WP_REST_Response(['message' => $result->get_error_message()], $status);
        }

        return new WP_REST_Response($result, 200);
    }

    /**
     * Delete a layout template (admin).
     */
    public static function delete_layout_template($request) {
        $id      = $request->get_param('templateId');
        $deleted = WPSG_Layout_Templates::delete($id);

        if (!$deleted) {
            return new WP_REST_Response(['message' => 'Template not found.'], 404);
        }

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
            $status = $result->get_error_data()['status'] ?? 400;
            return new WP_REST_Response(['message' => $result->get_error_message()], $status);
        }

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
                return new WP_REST_Response( [ 'message' => $url->get_error_message() ], 400 );
            }
            $name = sanitize_text_field( $request->get_param( 'name' ) ?? basename( $_FILES['file']['name'] ) );
        } else {
            // URL-only path.
            $data = $request->get_json_params() ?? [];
            $url  = esc_url_raw( $data['url'] ?? '' );
            $name = sanitize_text_field( $data['name'] ?? '' );
            if ( empty( $url ) ) {
                return new WP_REST_Response( [ 'message' => 'A file or URL is required.' ], 400 );
            }
        }

        $entry = WPSG_Overlay_Library::add( [ 'url' => $url, 'name' => $name ] );
        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * Remove an overlay library entry.
     */
    public static function delete_overlay( $request ) {
        $id      = $request->get_param( 'id' );
        $deleted = WPSG_Overlay_Library::remove( $id );
        if ( ! $deleted ) {
            return new WP_REST_Response( [ 'message' => 'Overlay not found.' ], 404 );
        }
        return new WP_REST_Response( [ 'deleted' => true ], 200 );
    }

    /**
     * Public read-only endpoint for rendering (no auth, ID-based only).
     */
    public static function get_layout_template_public($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);

        if (!$template) {
            return new WP_REST_Response(['message' => 'Template not found.'], 404);
        }

        return new WP_REST_Response($template, 200);
    }
}
