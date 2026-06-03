<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-wpsg-oembed-providers.php';

class WPSG_REST {
    // Populated by rate_limit_check(); read by inject_rate_limit_headers filter.
    private static $rate_limit_headers = [];

    /**
     * Object-cache TTL (seconds) for general plugin settings.
     * Use this when caching settings that do not affect access control.
     */
    const CACHE_TTL_SETTINGS = 3600;

    /**
     * Object-cache TTL (seconds) for access-control reads.
     *
     * Kept short (60 s) so that grant revocations propagate quickly.
     * Access-control checks (grant lookups, role checks) MUST use this TTL
     * or bypass the cache entirely — never use CACHE_TTL_SETTINGS for them.
     */
    const CACHE_TTL_ACCESS = 60;

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

    private static function error_response($message, $status, $code = 'wpsg_error') {
        return new WP_REST_Response([
            'code' => $code,
            'message' => $message,
        ], $status);
    }
    public static function register_routes() {
        register_rest_route('wp-super-gallery/v1', '/campaigns', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaigns'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'title'       => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'description' => [
                        'type'    => 'string',
                        'default' => '',
                    ],
                    'visibility'  => [
                        'type' => 'string',
                        'enum' => ['public', 'private'],
                    ],
                    'status'      => [
                        'type' => 'string',
                        'enum' => ['draft', 'active', 'archived'],
                    ],
                ],
            ],
        ]);

        // P28-J: Access totals summary (must be before (?P<id>\d+) to avoid regex clash).
        register_rest_route('wp-super-gallery/v1', '/campaigns/access-summary', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'access_summary'],
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
                'methods'             => 'PUT',
                // P33-C: editor and owner can update campaign metadata.
                'callback'            => [self::class, 'update_campaign'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
                'args'                => [
                    'title'      => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'visibility' => [
                        'type' => 'string',
                        'enum' => ['public', 'private'],
                    ],
                    'status'     => [
                        'type' => 'string',
                        'enum' => ['draft', 'active', 'archived'],
                    ],
                ],
            ],
            [
                'methods' => 'DELETE',
                // P33-C: only owner can delete a campaign.
                'callback' => [self::class, 'delete_campaign'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/archive', [
            [
                'methods' => 'POST',
                // P33-C: only owner can archive a campaign.
                'callback' => [self::class, 'archive_campaign'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/restore', [
            [
                'methods' => 'POST',
                // P33-C: restore is paired with archive — owner-only.
                'callback' => [self::class, 'restore_campaign'],
                'permission_callback' => [self::class, 'require_campaign_owner'],
            ],
        ]);

        // P18-C: Campaign duplication
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/duplicate', [
            [
                'methods' => 'POST',
                // P33-C: editor and owner can duplicate a campaign.
                'callback' => [self::class, 'duplicate_campaign'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        // P18-B: Bulk campaign actions (archive/restore)
        register_rest_route('wp-super-gallery/v1', '/campaigns/batch', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'batch_campaigns'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'action' => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['archive', 'restore'],
                    ],
                    'ids'    => [
                        'required' => true,
                        'type'     => 'array',
                        'items'    => ['type' => 'integer'],
                    ],
                ],
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

        // P39-CM1: Binary export / import
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/export/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'export_campaign_binary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/campaigns/import/binary', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'import_campaign_binary'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/export-jobs/(?P<job_id>[a-f0-9]{32})', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_export_job'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_export_job'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/export-jobs/(?P<job_id>[a-f0-9]{32})/download', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'download_export_job'],
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
        register_rest_route('wp-super-gallery/v1', '/media/(?P<mediaId>[a-zA-Z0-9_.-]+)/usage', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_media_usage'],
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

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_media'],
                'permission_callback' => [self::class, 'rate_limit_public'],
                'args'                => [
                    'sort' => [
                        'type'    => 'string',
                        'enum'    => ['order_asc', 'order_desc', 'title_asc', 'title_desc', 'created_asc', 'created_desc', 'size_asc', 'size_desc'],
                        'default' => 'order_asc',
                    ],
                ],
            ],
            [
                'methods'             => 'POST',
                // P33-C: editor and owner can add media.
                'callback'            => [self::class, 'create_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
                'args'                => [
                    'type'   => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['image', 'video'],
                    ],
                    'source' => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['upload', 'external', 'library'],
                    ],
                    'url'    => [
                        'type'              => 'string',
                        'sanitize_callback' => 'esc_url_raw',
                    ],
                    'caption' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/batch', [
            [
                'methods' => 'POST',
                // P33-C: editor and owner can batch-add media.
                'callback' => [self::class, 'create_media_batch'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        // Register specific sub-routes BEFORE the generic mediaId route to avoid pattern conflicts
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/reorder', [
            [
                'methods' => 'PUT',
                // P33-C: editor and owner can reorder media.
                'callback' => [self::class, 'reorder_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/rescan', [
            [
                'methods' => 'POST',
                // P33-C: editor and owner can rescan media types.
                'callback' => [self::class, 'rescan_media_types'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
        ]);

        // Generic mediaId route must come AFTER specific sub-routes
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/(?P<mediaId>[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)', [
            [
                'methods' => 'PUT',
                // P33-C: editor and owner can update media items.
                'callback' => [self::class, 'update_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
            ],
            [
                'methods' => 'DELETE',
                // P33-C: editor and owner can delete media items.
                'callback' => [self::class, 'delete_media'],
                'permission_callback' => [self::class, 'require_campaign_editor'],
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

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/audit', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_audit'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P28-G: cross-campaign audit log.
        register_rest_route('wp-super-gallery/v1', '/admin/audit-log', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_global_audit'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_media_library'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'sort' => [
                        'type'    => 'string',
                        'enum'    => ['order_asc', 'order_desc', 'title_asc', 'title_desc', 'created_asc', 'created_desc', 'size_asc', 'size_desc'],
                        'default' => 'created_desc',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/media/upload', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_media'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'force' => [
                        'type'    => 'boolean',
                        'default' => false,
                    ],
                ],
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

        register_rest_route('wp-super-gallery/v1', '/tags/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_media_tags'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_media_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/media/(?P<id>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_media_tag'],
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

    /**
     * Rate-limit the magic-link approve endpoint.
     *
     * Default: 10 requests per minute per IP. Override via
     * `wpsg_rate_limit_magic_approve` filter.
     */
    public static function rate_limit_magic_approve($request) {
        $limit  = intval(apply_filters('wpsg_rate_limit_magic_approve', 10));
        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        return self::rate_limit_check($request, 'magic_approve', $limit, $window);
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
            $reset_key = $key . '_reset';

            $current = wp_cache_incr($cache_key, 1, 'wpsg_rate_limit');
            if ($current === false) {
                wp_cache_add($cache_key, 1, 'wpsg_rate_limit', $window);
                $current = 1;
            }

            $reset = wp_cache_get($reset_key, 'wpsg_rate_limit');
            if ($reset === false) {
                $reset = time() + $window;
                wp_cache_add($reset_key, $reset, 'wpsg_rate_limit', $window);
            }

            self::$rate_limit_headers = [
                'X-RateLimit-Limit'     => $limit,
                'X-RateLimit-Remaining' => max(0, $limit - $current),
                'X-RateLimit-Reset'     => (int) $reset,
            ];

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

        self::$rate_limit_headers = [
            'X-RateLimit-Limit'     => $limit,
            'X-RateLimit-Remaining' => max(0, $limit - $data['count']),
            'X-RateLimit-Reset'     => intval($data['start']) + $window,
        ];

        if ($data['count'] > $limit) {
            return new WP_Error(
                'wpsg_rate_limited',
                'Rate limit exceeded. Please try again later.',
                ['status' => 429]
            );
        }

        return true;
    }

    public static function inject_rate_limit_headers($response, $handler, $request) {
        if (empty(self::$rate_limit_headers)) {
            return $response;
        }
        // rest_request_after_callbacks may receive a WP_Error (e.g. 429 rate-limit
        // denial from permission_callback). Convert it to WP_REST_Response so we
        // can attach the rate-limit headers before WP Core calls error_to_response.
        if (is_wp_error($response)) {
            $error_data = $response->get_error_data();
            $status     = isset($error_data['status']) ? (int) $error_data['status'] : 500;
            $response   = new WP_REST_Response([
                'code'    => $response->get_error_code(),
                'message' => $response->get_error_message(),
                'data'    => $error_data,
            ], $status);
        }
        if (method_exists($response, 'header')) {
            foreach (self::$rate_limit_headers as $header => $value) {
                $response->header($header, $value);
            }
        }
        return $response;
    }

    public static function require_admin() {
        if (!current_user_can('manage_wpsg')) {
            return false;
        }

        return self::verify_admin_auth();
    }

    /**
     * P33-B: Sanitize and validate an access_level value.
     *
     * Returns the value unchanged if it is one of the accepted levels;
     * falls back to 'viewer' for any other input (including null or empty).
     * This implements the migration-default behaviour: legacy grant entries
     * without an explicit access_level are treated as 'viewer'.
     *
     * @param mixed $level
     * @return string 'viewer' | 'editor' | 'owner'
     */
    private static function validate_access_level($level): string {
        return in_array($level, ['viewer', 'editor', 'owner'], true)
            ? (string) $level
            : 'viewer';
    }

    // ── P33-C: Role-Aware Permission Helpers ─────────────────────────────────

    /**
     * Resolve the effective access level for a user on a specific campaign.
     *
     * Precedence (highest → lowest):
     *   1. manage_wpsg capability → implicitly 'owner' (site-wide admin override)
     *   2. Explicit deny override → '' (no access)
     *   3. Campaign-level grant (overrides company grant for this campaign)
     *   4. Company-level grant (propagated to all company campaigns)
     *   5. No grant found → '' (no access)
     *
     * Expired grants are ignored in all cases.
     *
     * @param int $user_id     WordPress user ID.
     * @param int $campaign_id Post ID of the campaign.
     * @return string 'viewer' | 'editor' | 'owner' | '' (no access)
     */
    private static function get_effective_campaign_level(int $user_id, int $campaign_id): string {
        if ($user_id <= 0 || $campaign_id <= 0) {
            return '';
        }

        // 1. Site-wide admin always wins — they are treated as owner.
        if (current_user_can('manage_wpsg')) {
            return 'owner';
        }

        // 2. Explicit deny override beats every grant.
        $overrides = get_post_meta($campaign_id, 'access_overrides', true);
        $overrides = is_array($overrides) ? $overrides : [];
        foreach ($overrides as $entry) {
            if (intval($entry['userId'] ?? 0) === $user_id && ($entry['action'] ?? '') === 'deny') {
                return '';
            }
        }

        $now = time();

        // 3. Campaign-level grant (most specific, overrides company grant).
        $campaign_grants = get_post_meta($campaign_id, 'access_grants', true);
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        foreach ($campaign_grants as $entry) {
            if (intval($entry['userId'] ?? 0) !== $user_id) {
                continue;
            }
            // Expired grants do not confer access.
            if (!empty($entry['expires_at']) && strtotime($entry['expires_at']) < $now) {
                continue;
            }
            return self::validate_access_level($entry['access_level'] ?? 'viewer');
        }

        // 4. Company-level grant (falls back to this when no campaign grant exists).
        $company_term = self::get_company_term($campaign_id);
        if ($company_term) {
            $company_grants = get_term_meta($company_term->term_id, 'access_grants', true);
            $company_grants = is_array($company_grants) ? $company_grants : [];
            foreach ($company_grants as $entry) {
                if (intval($entry['userId'] ?? 0) !== $user_id) {
                    continue;
                }
                if (!empty($entry['expires_at']) && strtotime($entry['expires_at']) < $now) {
                    continue;
                }
                return self::validate_access_level($entry['access_level'] ?? 'viewer');
            }
        }

        // 5. No grant.
        return '';
    }

    /**
     * P33-C: Permission callback — requires at least 'editor' role on the
     * campaign identified by the request's `id` parameter.
     *
     * Site-wide manage_wpsg capability always satisfies this check.
     * Both `editor` and `owner` campaign roles satisfy this check.
     *
     * @param WP_REST_Request $request
     * @return bool
     */
    public static function require_campaign_editor(WP_REST_Request $request): bool {
        // Auth integrity check (nonce or Bearer token).
        if (!self::verify_admin_auth()) {
            return false;
        }

        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }

        // Site-wide admin is always allowed.
        if (current_user_can('manage_wpsg')) {
            return true;
        }

        $campaign_id = intval($request->get_param('id'));
        if ($campaign_id <= 0) {
            return false;
        }

        $level = self::get_effective_campaign_level($user_id, $campaign_id);
        return in_array($level, ['editor', 'owner'], true);
    }

    /**
     * P33-C: Permission callback — requires at least 'owner' role on the
     * campaign identified by the request's `id` parameter.
     *
     * Site-wide manage_wpsg capability always satisfies this check.
     * Only the `owner` campaign role (or site admin) satisfies this check.
     *
     * @param WP_REST_Request $request
     * @return bool
     */
    public static function require_campaign_owner(WP_REST_Request $request): bool {
        // Auth integrity check (nonce or Bearer token).
        if (!self::verify_admin_auth()) {
            return false;
        }

        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }

        // Site-wide admin is always allowed.
        if (current_user_can('manage_wpsg')) {
            return true;
        }

        $campaign_id = intval($request->get_param('id'));
        if ($campaign_id <= 0) {
            return false;
        }

        $level = self::get_effective_campaign_level($user_id, $campaign_id);
        return $level === 'owner';
    }

    /**
     * Get the current cache version counter.
     *
     * Included in all transient cache keys so that bumping the version
     * invalidates every key without expensive LIKE-based DELETEs.
     * Stale keys expire naturally via their TTL.
     *
     * @since 0.18.0 P20-I-3
     * @return int
     */
    public static function get_cache_version(): int {
        return intval(get_option('wpsg_cache_version', 1));
    }

    /**
     * Bump the cache version counter, effectively invalidating all caches.
     *
     * @since 0.18.0 P20-I-3
     */
    public static function bump_cache_version(): void {
        $v = self::get_cache_version();
        update_option('wpsg_cache_version', $v + 1, true);
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

        // Application Password auth uses HTTP Basic. WP authenticates it before this
        // callback runs — no CSRF nonce is needed (nonces protect cookie sessions only).
        if (!empty($auth_header) && stripos($auth_header, 'Basic ') === 0) {
            return is_user_logged_in();
        }

        // Allow nonce bypass ONLY when the explicit WPSG_ALLOW_NONCE_BYPASS
        // constant is set AND we are in a recognised test/debug environment.
        // wp-env's test container sets WP_DEBUG=false in wp-config.php, so we
        // also accept the WP_TESTS_DOMAIN constant (defined by the WP PHPUnit
        // bootstrap) as a secondary indicator.
        if ( defined( 'WPSG_ALLOW_NONCE_BYPASS' ) && WPSG_ALLOW_NONCE_BYPASS ) {
            $is_test_env = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) || defined( 'WP_TESTS_DOMAIN' );
            if ( ! $is_test_env ) {
                // Log a critical warning — this should never be active in production.
                WPSG_Logger::warning( 'security', 'WPSG_ALLOW_NONCE_BYPASS is enabled outside a recognized test environment', [ 'constant' => 'WPSG_ALLOW_NONCE_BYPASS' ] );
            }
            if ( $is_test_env ) {
                return true;
            }
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

    public static function list_campaigns($request) {
        $start = microtime(true);
        $status = sanitize_text_field($request->get_param('status'));
        $visibility = sanitize_text_field($request->get_param('visibility'));
        $company = sanitize_text_field($request->get_param('company'));
        $search = sanitize_text_field($request->get_param('search'));
        $include_media_raw = $request->get_param('include_media');
        $include_media = in_array(strtolower((string) $include_media_raw), ['1', 'true', 'yes'], true);
        $page = max(1, intval($request->get_param('page')));
        $per_page = max(1, min(50, intval($request->get_param('per_page') ?: 10)));
        // P28-E: New filter params.
        $category           = sanitize_text_field($request->get_param('category') ?? '');
        $tag                = sanitize_text_field($request->get_param('tag') ?? '');
        $sort               = sanitize_text_field($request->get_param('sort') ?: 'created_desc');
        $include_archived   = in_array(strtolower((string) $request->get_param('include_archived')), ['1', 'true', 'yes'], true);
        $template_id_filter = sanitize_text_field($request->get_param('template_id') ?? '');

        // Generate cache key based on user ID, query parameters, and cache version
        $user_id = get_current_user_id();
        $is_admin = current_user_can('manage_options') || current_user_can('manage_wpsg');
        $search_key = $search ? md5($search) : 'none';
        $cv = self::get_cache_version();
        $cache_key = sprintf(
            'wpsg_campaigns_v%d_%d_%s_%s_%s_%s_%d_%d_%s_%s_%s_%s_%s_%s_%s',
            $cv,
            $user_id,
            $status ?: 'all',
            $visibility ?: 'all',
            $company ?: 'all',
            $search_key,
            $page,
            $per_page,
            $is_admin ? 'admin' : 'user',
            $include_media ? 'with_media' : 'no_media',
            $category ?: 'none',
            $tag ?: 'none',
            $sort,
            $include_archived ? 'incl' : 'excl',
            $template_id_filter ? md5($template_id_filter) : 'none'
        );

        // Try to get cached data
        $cached = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            return new WP_REST_Response($cached, 200);
        }

        $args = [
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'publish',
            'paged'          => $page,
            'posts_per_page' => $per_page,
            's'              => $search,
        ];

        // P28-E: Sort mapping.
        switch ($sort) {
            case 'created_asc':
                $args['orderby'] = 'date';
                $args['order']   = 'ASC';
                break;
            case 'title_asc':
                $args['orderby'] = 'title';
                $args['order']   = 'ASC';
                break;
            case 'title_desc':
                $args['orderby'] = 'title';
                $args['order']   = 'DESC';
                break;
            case 'updated_desc':
                $args['orderby'] = 'modified';
                $args['order']   = 'DESC';
                break;
            default: // created_desc
                $args['orderby'] = 'date';
                $args['order']   = 'DESC';
        }

        $meta_query = [];
        if (!empty($status)) {
            $meta_query[] = [
                'key'   => 'status',
                'value' => $status,
            ];
        } elseif (!$include_archived) {
            // P28-E: Exclude archived campaigns by default; pass include_archived=true to override.
            $meta_query[] = [
                'relation' => 'OR',
                ['key' => 'status', 'compare' => 'NOT EXISTS'],
                ['key' => 'status', 'value' => 'archived', 'compare' => '!='],
            ];
        }
        if (!empty($visibility)) {
            $meta_query[] = [
                'key'   => 'visibility',
                'value' => $visibility,
            ];
        }
        // P28-E: Filter by layout template ID.
        if (!empty($template_id_filter)) {
            $meta_query[] = [
                'key'   => '_wpsg_layout_binding_template_id',
                'value' => $template_id_filter,
            ];
        }
        if (!empty($meta_query)) {
            $args['meta_query'] = $meta_query;
        }

        // P28-E: Taxonomy filters — company, category, and tag may all be present simultaneously.
        $tax_clauses = [];
        if (!empty($company)) {
            $tax_clauses[] = [
                'taxonomy' => 'wpsg_company',
                'field'    => 'slug',
                'terms'    => [$company],
            ];
        }
        if (!empty($category)) {
            $tax_clauses[] = [
                'taxonomy' => 'wpsg_campaign_category',
                'field'    => 'slug',
                'terms'    => [$category],
            ];
        }
        if (!empty($tag)) {
            $tax_clauses[] = [
                'taxonomy' => 'wpsg_campaign_tag',
                'field'    => 'slug',
                'terms'    => [$tag],
            ];
        }
        if (!empty($tax_clauses)) {
            if (count($tax_clauses) > 1) {
                $tax_clauses['relation'] = 'AND';
            }
            $args['tax_query'] = $tax_clauses;
        }

        if (!$is_admin) {
            if (!$user_id) {
                $meta_query[] = [
                    'key' => 'visibility',
                    'value' => 'public',
                ];
                // P36-C: Exclude campaigns with an explicit draft status from anonymous listings.
                $meta_query[] = [
                    'relation' => 'OR',
                    ['key' => 'status', 'compare' => 'NOT EXISTS'],
                    ['key' => 'status', 'value' => 'draft', 'compare' => '!='],
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
            // Prime the WP object cache with a single batch query so the
            // per-campaign get_post_meta() calls below are cache hits.
            update_meta_cache('post', wp_list_pluck($query->posts, 'ID'));

            foreach ($query->posts as $post) {
                $campaign_id = (string) $post->ID;
                $media_items = get_post_meta($post->ID, 'media_items', true);
                $media_items = is_array($media_items) ? $media_items : [];
                $normalized = self::normalize_media_items_types($media_items);
                // Use dimensions_only=true so the campaigns list (which serves initial
                // app-load thumbnails) does not pay the cost of the date/filesize/tag
                // SQL queries. Full enrichment is available via the single-gallery endpoint.
                $media_by_campaign[$campaign_id] = self::enrich_media_with_metadata($normalized['items'], true);
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

    public static function create_campaign($request) {
        $title = sanitize_text_field($request->get_param('title') ?? '');
        $description = wp_kses_post($request->get_param('description') ?? '');

        if (empty($title)) {
            return new WP_Error('wpsg_missing_title', 'Title is required', ['status' => 400]);
        }

        $post_id = wp_insert_post([
            'post_type' => 'wpsg_campaign',
            'post_title' => $title,
            'post_content' => $description,
            'post_status' => 'publish',
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('wpsg_internal_error', $post_id->get_error_message(), ['status' => 500]);
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

        do_action('wpsg_campaign_created', $post_id, ['title' => $title]);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 201);
    }

    public static function get_campaign($request) {
        $post_id = intval($request->get_param('id'));
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $user_id = get_current_user_id();
        if (!self::can_view_campaign($post_id, $user_id)) {
            return new WP_Error('wpsg_forbidden', 'Forbidden', ['status' => 403]);
        }

        return new WP_REST_Response(self::format_campaign($post), 200);
    }

    public static function update_campaign($request) {
        $post_id = intval($request->get_param('id'));
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
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

        do_action('wpsg_campaign_updated', $post_id, [
            'title' => $title,
            'status' => $request->get_param('status'),
        ]);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 200);
    }

    public static function archive_campaign($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        update_post_meta($post_id, 'status', 'archived');
        self::add_audit_entry($post_id, 'campaign.archived', []);
        do_action('wpsg_campaign_archived', $post_id);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Campaign archived'], 200);
    }

    public static function restore_campaign($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        update_post_meta($post_id, 'status', 'active');
        self::add_audit_entry($post_id, 'campaign.restored', []);
        do_action('wpsg_campaign_restored', $post_id);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Campaign restored'], 200);
    }

    // ── P28-A: Campaign hard-delete ───────────────────────────────────────────

    public static function delete_campaign($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $confirm = $request->get_param('confirm');
        if (!self::is_truthy_param($confirm)) {
            return new WP_Error(
                'wpsg_delete_unconfirmed',
                'Missing confirm=true query parameter',
                ['status' => 400]
            );
        }

        $purge_analytics = self::is_truthy_param($request->get_param('purge_analytics'));

        // Audit and webhook BEFORE deletion so the entry is preserved in any external sink
        // (post meta entry itself is dropped with the post).
        self::add_audit_entry($post_id, 'campaign.deleted', [
            'purge_analytics' => $purge_analytics,
        ]);
        do_action('wpsg_campaign_deleted', $post_id);

        WPSG_DB::delete_media_refs($post_id);
        WPSG_DB::delete_access_requests_for_campaign($post_id);

        if ($purge_analytics) {
            global $wpdb;
            $wpdb->delete(
                WPSG_DB::get_analytics_table(),
                ['campaign_id' => $post_id],
                ['%d']
            );
        }

        $deleted = wp_delete_post($post_id, true);
        if (!$deleted) {
            return new WP_Error('wpsg_delete_failed', 'Failed to delete campaign', ['status' => 500]);
        }

        self::clear_accessible_campaigns_cache();

        return new WP_REST_Response([
            'message' => 'Campaign deleted',
            'id'      => $post_id,
        ], 200);
    }

    private static function is_truthy_param($value): bool {
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
        }
        return (bool) $value;
    }

    // ── P18-C: Campaign duplication ───────────────────────────────────────────

    public static function duplicate_campaign($request) {
        $source_id = intval($request->get_param('id'));

        if (!self::campaign_exists($source_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $source   = get_post($source_id);
        $new_name = sanitize_text_field(
            $request->get_param('name') ?: ($source->post_title . ' (Copy)')
        );
        $copy_media = (bool) $request->get_param('copyMedia');
        $duplicate_layout_template = (bool) $request->get_param('duplicateLayoutTemplate');

        $new_id = WPSG_Campaign_Duplicator::duplicate(
            $source_id,
            $new_name,
            $copy_media,
            $duplicate_layout_template
        );

        if (is_wp_error($new_id)) {
            return $new_id;
        }

        self::add_audit_entry($new_id, 'campaign.duplicated', [
            'source_id'               => $source_id,
            'copyMedia'               => $copy_media,
            'duplicateLayoutTemplate' => $duplicate_layout_template,
        ]);
        self::clear_accessible_campaigns_cache();

        return new WP_REST_Response(self::format_campaign(get_post($new_id)), 201);
    }

    // ── P18-B: Bulk campaign actions ──────────────────────────────────────────

    public static function batch_campaigns($request) {
        $action  = sanitize_text_field($request->get_param('action'));
        $ids     = $request->get_param('ids');

        $allowed_actions = ['archive', 'restore'];
        if (!in_array($action, $allowed_actions, true)) {
            return new WP_Error('wpsg_invalid_action', 'Invalid action. Allowed: archive, restore', ['status' => 400]);
        }
        if (!is_array($ids) || empty($ids)) {
            return new WP_Error('wpsg_invalid_ids', 'ids must be a non-empty array', ['status' => 400]);
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
            do_action("wpsg_campaign_{$action}d", $post_id);
            $success[] = (string) $post_id;
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['success' => $success, 'failed' => $failed], 200);
    }

    // P18-D: Export a single campaign as a self-contained JSON payload.
    public static function export_campaign($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
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
    public static function import_campaign($request) {
        $body    = $request->get_json_params();

        if (empty($body) || !isset($body['campaign'])) {
            return new WP_Error('wpsg_invalid_payload', 'Invalid payload: missing campaign key', ['status' => 400]);
        }
        $version = intval($body['version'] ?? 0);
        if ($version !== 1) {
            return new WP_Error('wpsg_unsupported_version', 'Unsupported export version', ['status' => 400]);
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
            return new WP_Error('wpsg_internal_error', $post_id->get_error_message(), ['status' => 500]);
        }

        // Copy scalar meta fields; always import as draft.
        $meta_map = [
            'visibility'   => 'visibility',
            'tags'         => 'tags',
            'coverImage'   => 'cover_image',
            'publishAt'    => 'publish_at',
            'unpublishAt'  => 'unpublish_at',
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

        $gallery_overrides = self::promote_campaign_gallery_overrides($src['galleryOverrides'] ?? null);
        if (!empty($gallery_overrides)) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', wp_json_encode($gallery_overrides));
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
        self::clear_accessible_campaigns_cache();
        $new_post = get_post($post_id);
        return new WP_REST_Response(self::format_campaign($new_post), 201);
    }

    // ─────────────────────────────────────────────────────────────────────
    // P39-CM1: Binary export / import
    // ─────────────────────────────────────────────────────────────────────

    // POST /campaigns/{id}/export/binary — enqueue a background ZIP export job.
    public static function export_campaign_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary export.',
                ['status' => 500]
            );
        }

        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $post     = get_post($post_id);
        $campaign = self::format_campaign($post);
        $media    = get_post_meta($post_id, 'media_items', true) ?: [];

        $template_id     = get_post_meta($post_id, '_wpsg_layout_binding_template_id', true);
        $layout_template = null;
        if ($template_id) {
            $tmpl = get_post(intval($template_id));
            if ($tmpl) {
                $layout_template = [
                    'id'             => (string) $tmpl->ID,
                    'title'          => $tmpl->post_title,
                    'slots'          => get_post_meta($tmpl->ID, 'slots', true) ?: [],
                    'background'     => get_post_meta($tmpl->ID, 'background', true) ?: [],
                    'graphicLayers'  => get_post_meta($tmpl->ID, 'graphic_layers', true) ?: [],
                ];
            }
        }

        // Build v2 manifest — same as v1 but version=2 and each media_reference
        // carries a `filename` matching the file the engine will write to media/.
        $media_references = array_values(array_map(function ($item) {
            return [
                'id'       => $item['id'] ?? '',
                'url'      => $item['url'] ?? '',
                'title'    => $item['title'] ?? '',
                'filename' => WPSG_Export_Engine::get_media_filename($item),
            ];
        }, (array) $media));

        $manifest = wp_json_encode([
            'version'          => 2,
            'exported_at'      => gmdate('c'),
            'campaign'         => $campaign,
            'layout_template'  => $layout_template,
            'media_references' => $media_references,
        ]);

        $job_id = WPSG_Export_Engine::create_job('campaign', $manifest, (array) $media);

        return new WP_REST_Response(['jobId' => $job_id, 'status' => 'pending'], 202);
    }

    // GET /export-jobs/{job_id} — poll job status.
    public static function get_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        $payload = [
            'jobId'      => $job['id'],
            'type'       => $job['type'],
            'status'     => $job['status'],
            'createdAt'  => $job['created_at'],
            'error'      => $job['error'],
        ];

        if ($job['status'] === 'complete') {
            $payload['downloadUrl'] = rest_url('wp-super-gallery/v1/export-jobs/' . $job_id . '/download');
        }

        return new WP_REST_Response($payload, 200);
    }

    // DELETE /export-jobs/{job_id} — cancel / discard a job.
    public static function delete_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        WPSG_Export_Engine::delete_job($job_id);
        return new WP_REST_Response(['deleted' => true], 200);
    }

    // GET /export-jobs/{job_id}/download — stream the ZIP file.
    public static function download_export_job($request) {
        $job_id = sanitize_key($request->get_param('job_id'));
        $job    = WPSG_Export_Engine::get_job($job_id);

        if (!$job) {
            return new WP_Error('wpsg_not_found', 'Export job not found', ['status' => 404]);
        }

        if ($job['status'] !== 'complete') {
            return new WP_Error(
                'wpsg_not_ready',
                'Export is not complete (status: ' . esc_html($job['status']) . ')',
                ['status' => 409]
            );
        }

        $zip_path = $job['zip_path'];
        if (!$zip_path || !file_exists($zip_path)) {
            return new WP_Error('wpsg_file_missing', 'Export file not found', ['status' => 404]);
        }

        $filename = basename($zip_path);
        // phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped
        while (ob_get_level()) {
            ob_end_clean();
        }
        header('Content-Type: application/zip');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($zip_path));
        header('Cache-Control: no-store');
        readfile($zip_path); // phpcs:ignore WordPress.WP.AlternativeFunctions
        // phpcs:enable
        exit;
    }

    // POST /campaigns/import/binary — accept a ZIP upload and import its campaign.
    public static function import_campaign_binary($request) {
        if (!WPSG_Export_Engine::check_zip_available()) {
            return new WP_Error(
                'wpsg_missing_dependency',
                'ext-zip is required for binary import.',
                ['status' => 500]
            );
        }

        $files = $request->get_file_params();
        if (empty($files['file'])) {
            return new WP_Error('wpsg_missing_file', 'No file uploaded (field: file)', ['status' => 400]);
        }

        $file = $files['file'];
        if (isset($file['error']) && $file['error'] !== UPLOAD_ERR_OK) {
            return new WP_Error('wpsg_upload_error', 'File upload failed', ['status' => 400]);
        }

        $zip = new ZipArchive();
        if ($zip->open($file['tmp_name']) !== true) {
            return new WP_Error('wpsg_invalid_zip', 'Could not open ZIP archive', ['status' => 400]);
        }

        $manifest_json = $zip->getFromName('manifest.json');
        if ($manifest_json === false) {
            $zip->close();
            return new WP_Error('wpsg_invalid_package', 'manifest.json not found in archive', ['status' => 400]);
        }

        $body = json_decode($manifest_json, true);
        if (!$body || !isset($body['campaign'])) {
            $zip->close();
            return new WP_Error('wpsg_invalid_manifest', 'Invalid manifest structure', ['status' => 400]);
        }

        $version = intval($body['version'] ?? 0);
        if ($version !== 2) {
            $zip->close();
            return new WP_Error(
                'wpsg_unsupported_version',
                'Binary import requires manifest version 2',
                ['status' => 400]
            );
        }

        // Create the campaign post.
        $src         = $body['campaign'];
        $title       = sanitize_text_field($src['title'] ?? 'Imported Campaign');
        $description = sanitize_textarea_field($src['description'] ?? '');

        $post_id = wp_insert_post([
            'post_title'   => $title,
            'post_content' => $description,
            'post_type'    => 'wpsg_campaign',
            'post_status'  => 'publish',
        ], true);

        if (is_wp_error($post_id)) {
            $zip->close();
            return new WP_Error('wpsg_internal_error', $post_id->get_error_message(), ['status' => 500]);
        }

        // Apply scalar campaign meta (same as JSON import).
        $meta_map = [
            'visibility'  => 'visibility',
            'tags'        => 'tags',
            'coverImage'  => 'cover_image',
            'publishAt'   => 'publish_at',
            'unpublishAt' => 'unpublish_at',
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

        $gallery_overrides = self::promote_campaign_gallery_overrides($src['galleryOverrides'] ?? null);
        if (!empty($gallery_overrides)) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', wp_json_encode($gallery_overrides));
        }

        // Embed layout template if present.
        $layout_template = $body['layout_template'] ?? null;
        if ($layout_template && is_array($layout_template)) {
            $sanitized = WPSG_Layout_Templates::sanitize_template_data($layout_template);
            $tmpl_id   = wp_insert_post([
                'post_title'  => sanitize_text_field($layout_template['title'] ?? 'Imported Template'),
                'post_type'   => 'wpsg_layout_template',
                'post_status' => 'publish',
            ]);
            if (!is_wp_error($tmpl_id)) {
                update_post_meta($tmpl_id, 'slots', $sanitized['slots']);
                update_post_meta($tmpl_id, 'background', [
                    'backgroundMode'             => $sanitized['backgroundMode'],
                    'backgroundColor'            => $sanitized['backgroundColor'],
                    'backgroundGradientDirection' => $sanitized['backgroundGradientDirection'],
                    'backgroundGradientStops'    => $sanitized['backgroundGradientStops'],
                    'backgroundGradientType'     => $sanitized['backgroundGradientType'],
                    'backgroundGradientAngle'    => $sanitized['backgroundGradientAngle'],
                    'backgroundRadialShape'      => $sanitized['backgroundRadialShape'],
                    'backgroundRadialSize'       => $sanitized['backgroundRadialSize'],
                    'backgroundGradientCenterX'  => $sanitized['backgroundGradientCenterX'],
                    'backgroundGradientCenterY'  => $sanitized['backgroundGradientCenterY'],
                    'backgroundImage'            => $sanitized['backgroundImage'],
                    'backgroundImageFit'         => $sanitized['backgroundImageFit'],
                    'backgroundImageOpacity'     => $sanitized['backgroundImageOpacity'],
                ]);
                update_post_meta($tmpl_id, 'graphic_layers', $sanitized['overlays']);
                update_post_meta($post_id, '_wpsg_layout_binding_template_id', (string) $tmpl_id);
                if (!empty($src['layoutBinding'])) {
                    $binding = $src['layoutBinding'];
                    if (is_array($binding)) {
                        array_walk_recursive($binding, function (&$v) {
                            if (is_string($v)) { $v = sanitize_text_field($v); }
                        });
                    }
                    update_post_meta($post_id, '_wpsg_layout_binding', $binding);
                }
            }
        }

        // Sideload media from the ZIP — SSRF-safe: we read from the archive,
        // never from the URLs in the manifest.
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $media_items = [];
        foreach ((array) ($body['media_references'] ?? []) as $ref) {
            $filename = sanitize_file_name($ref['filename'] ?? '');
            if (!$filename) {
                continue;
            }

            $file_data = $zip->getFromName('media/' . $filename);
            if ($file_data === false) {
                continue;
            }

            $tmp = wp_tempnam($filename);
            if ($tmp === false) {
                continue;
            }
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            file_put_contents($tmp, $file_data);
            unset($file_data);

            $file_array = ['name' => $filename, 'tmp_name' => $tmp];
            $att_id     = media_handle_sideload($file_array, $post_id, sanitize_text_field($ref['title'] ?? ''));
            @unlink($tmp); // phpcs:ignore WordPress.PHP.NoSilencedErrors

            if (is_wp_error($att_id)) {
                continue;
            }

            $media_items[] = [
                'id'     => (string) $att_id,
                'url'    => wp_get_attachment_url($att_id),
                'title'  => sanitize_text_field($ref['title'] ?? ''),
                'type'   => 'image',
                'source' => 'upload',
                'order'  => 0,
            ];
        }

        $zip->close();

        if (!empty($media_items)) {
            update_post_meta($post_id, 'media_items', $media_items);
        }

        self::add_audit_entry($post_id, 'campaign.imported', ['source_title' => $title, 'source' => 'binary']);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 201);
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
     */
    public static function get_media_usage($request) {
        $media_id = sanitize_text_field($request->get_param('mediaId'));

        if (empty($media_id)) {
            return new WP_Error('wpsg_missing_media_id', 'mediaId is required', ['status' => 400]);
        }

        $found = WPSG_DB::get_media_usage($media_id);
        return new WP_REST_Response(['count' => count($found), 'campaigns' => $found], 200);
    }

    /**
     * GET /media/usage-summary?ids[]=id1&ids[]=id2...
     * Returns a map { mediaId: count } for the given IDs.
     * Uses indexed wpsg_media_refs table (P20-I-2).
     */
    public static function get_media_usage_summary($request) {
        $ids     = $request->get_param('ids');

        if (!is_array($ids) || empty($ids)) {
            return new WP_REST_Response((object)[], 200);
        }

        $ids = array_values(array_unique(array_map('sanitize_text_field', $ids)));
        if (count($ids) > 200) {
            return new WP_Error('wpsg_too_many_ids', 'Too many IDs (max 200)', ['status' => 400]);
        }

        $result = WPSG_DB::get_media_usage_summary($ids);
        return new WP_REST_Response((object)$result, 200);
    }

    /**
     * P18-H helper: return category names for a campaign post.
     */
    private static function get_campaign_category_names($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_campaign_category', ['fields' => 'names']);
        return is_array($terms) && !is_wp_error($terms) ? array_values($terms) : [];
    }

    private static function get_campaign_category_ids($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_campaign_category', ['fields' => 'ids']);
        return is_array($terms) && !is_wp_error($terms) ? array_values(array_map('strval', $terms)) : [];
    }

    // ── P28-F: Pagination helpers ────────────────────────────────────────────

    private static function parse_pagination($request, int $default_per_page = 50, int $max_per_page = 200): array {
        $page     = max(1, intval($request->get_param('page') ?? 1));
        $per_page = max(1, min($max_per_page, intval($request->get_param('per_page') ?? $default_per_page)));
        return [$page, $per_page, ($page - 1) * $per_page];
    }

    private static function paginated_response(array $items, int $total, int $page, int $per_page): WP_REST_Response {
        $total_pages = $per_page > 0 ? (int) ceil($total / $per_page) : 1;
        return new WP_REST_Response([
            'items'       => $items,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => max(1, $total_pages),
        ], 200);
    }

    /**
     * GET /campaign-categories
     * Returns paginated wpsg_campaign_category terms (id, name, slug, count).
     */
    public static function list_campaign_categories($request) {
        [$page, $per_page, $offset] = self::parse_pagination($request);

        $total = (int) wp_count_terms('wpsg_campaign_category', ['hide_empty' => false]);

        $terms = get_terms([
            'taxonomy'   => 'wpsg_campaign_category',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
            'number'     => $per_page,
            'offset'     => $offset,
        ]);

        if (is_wp_error($terms)) {
            return new WP_Error('wpsg_internal_error', 'Failed to retrieve categories', ['status' => 500]);
        }

        $items = array_map(function ($term) {
            return [
                'id'        => strval($term->term_id),
                'name'      => $term->name,
                'slug'      => $term->slug,
                'count'     => (int) $term->count,
                'parent_id' => (int) $term->parent,
            ];
        }, $terms);

        return self::paginated_response($items, $total, $page, $per_page);
    }

    public static function list_media($request) {
        $start = microtime(true);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $user_id = get_current_user_id();
        if (!self::can_view_campaign($post_id, $user_id)) {
            return new WP_Error('wpsg_forbidden', 'Forbidden', ['status' => 403]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];

        // Normalize legacy media types on read for accuracy
        $updated_count = 0;
        $normalized = self::normalize_media_items_types($media_items);
        $media_items = self::enrich_media_with_metadata($normalized['items']);
        $updated_count = $normalized['updated'];

        // Backfill missing IDs and repair duplicate IDs.
        // Duplicates arise when the campaign's route {id} param was mistakenly stored as every
        // item's media ID — all items end up with the same ID, so any delete wipes the whole set.
        $ids_backfilled = 0;
        $seen_ids = [];
        foreach ($media_items as &$item) {
            $current_id = $item['id'] ?? '';
            if ($current_id === '' || isset($seen_ids[$current_id])) {
                do {
                    $current_id = wp_generate_uuid4();
                } while (isset($seen_ids[$current_id]));
                $item['id'] = $current_id;
                $ids_backfilled++;
            }
            $seen_ids[$current_id] = true;
        }
        unset($item);

        if ($updated_count > 0 || $ids_backfilled > 0) {
            update_post_meta($post_id, 'media_items', $media_items);
            if ($updated_count > 0) {
                self::add_audit_entry($post_id, 'media.types_rescanned', [
                    'updated' => $updated_count,
                ]);
            }
            if ($ids_backfilled > 0) {
                self::add_audit_entry($post_id, 'media.ids_backfilled', [
                    'count' => $ids_backfilled,
                ]);
            }
        }

        $sort = sanitize_text_field($request->get_param('sort') ?? 'order_asc');
        $media_items = self::sort_media_items($media_items, $sort);

        $payload = [
            'items' => $media_items,
            'meta' => [
                'typesUpdated' => $updated_count,
                'total' => count($media_items),
                'sort' => $sort,
            ],
        ];

        $response = self::respond_with_etag($request, $payload, 200, $post_id . ':' . $sort);
        self::log_slow_rest('media.list', $start, [
            'campaignId' => $post_id,
            'total' => count($media_items),
        ]);
        return $response;
    }

    private static function sort_media_items(array $items, string $sort): array {
        usort($items, static function ($a, $b) use ($sort) {
            switch ($sort) {
                case 'order_desc':
                    return intval($b['order'] ?? 0) <=> intval($a['order'] ?? 0);

                case 'title_asc':
                    return strnatcasecmp($a['caption'] ?? $a['title'] ?? '', $b['caption'] ?? $b['title'] ?? '');

                case 'title_desc':
                    return strnatcasecmp($b['caption'] ?? $b['title'] ?? '', $a['caption'] ?? $a['title'] ?? '');

                case 'created_asc':
                    $ta = strtotime($a['dateUploaded'] ?? '') ?: intval($a['order'] ?? 0);
                    $tb = strtotime($b['dateUploaded'] ?? '') ?: intval($b['order'] ?? 0);
                    return $ta <=> $tb;

                case 'created_desc':
                    $ta = strtotime($a['dateUploaded'] ?? '') ?: intval($a['order'] ?? 0);
                    $tb = strtotime($b['dateUploaded'] ?? '') ?: intval($b['order'] ?? 0);
                    return $tb <=> $ta;

                case 'size_asc':
                    return intval($a['filesize'] ?? 0) <=> intval($b['filesize'] ?? 0);

                case 'size_desc':
                    return intval($b['filesize'] ?? 0) <=> intval($a['filesize'] ?? 0);

                case 'order_asc':
                default:
                    return intval($a['order'] ?? 0) <=> intval($b['order'] ?? 0);
            }
        });
        return $items;
    }

    private static function resolve_campaign_id_from_request($request) {
        $post_id = intval($request->get_param('campaignId') ?? 0);
        if ($post_id > 0) {
            return $post_id;
        }

        $route = method_exists($request, 'get_route') ? $request->get_route() : '';
        if (is_string($route) && preg_match('#/campaigns/(\d+)/media(?:/batch)?$#', $route, $matches)) {
            return intval($matches[1]);
        }

        $route_id = $request->get_param('id');
        if (is_numeric($route_id)) {
            return intval($route_id);
        }

        return 0;
    }

    private static function clamp_media_order($order) {
        $order = intval($order);
        if ($order < 0) {
            return 0;
        }

        if ($order > 1000000) {
            return 1000000;
        }

        return $order;
    }

    private static function get_next_media_order(array $media_items) {
        $max_order = -1;
        foreach ($media_items as $media_item) {
            $max_order = max($max_order, intval($media_item['order'] ?? 0));
        }

        return $max_order + 1;
    }

    private static function build_media_item_from_payload(array $payload) {
        $type = sanitize_text_field($payload['type'] ?? '');
        $source = sanitize_text_field($payload['source'] ?? '');
        $caption = sanitize_text_field($payload['caption'] ?? '');
        $title = sanitize_text_field($payload['title'] ?? '');
        $thumbnail = esc_url_raw($payload['thumbnail'] ?? '');

        if (!in_array($type, ['video', 'image'], true)) {
            return new WP_Error('wpsg_invalid_media_type', 'Invalid media type', ['status' => 400]);
        }

        $custom_media_id = sanitize_text_field($payload['id'] ?? '');
        if ($custom_media_id !== '' && !preg_match('/^[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/', $custom_media_id)) {
            return new WP_Error('wpsg_invalid_media_id', 'Invalid media ID', ['status' => 400]);
        }

        $media_item = [
            'id' => $custom_media_id !== '' ? $custom_media_id : wp_generate_uuid4(),
            'type' => $type,
            'source' => $source,
            'caption' => $caption,
            'order' => self::clamp_media_order($payload['order'] ?? 0),
        ];

        if ($title !== '') {
            $media_item['title'] = $title;
        }

        if ($source === 'external') {
            $url = esc_url_raw($payload['url'] ?? '');
            if (empty($url)) {
                return new WP_Error('invalid_url', 'URL is required', ['status' => 400]);
            }

            $parsed = wp_parse_url($url);
            if (empty($parsed['scheme']) || strtolower($parsed['scheme']) !== 'https') {
                return new WP_Error('invalid_url', 'URL must use HTTPS', ['status' => 400]);
            }

            if ($type === 'image') {
                $media_item['url'] = $url;
                $media_item['provider'] = 'external';
                if ($thumbnail !== '') {
                    $media_item['thumbnail'] = $thumbnail;
                }
            } else {
                $normalized = self::normalize_external_media($url);
                if (is_wp_error($normalized)) {
                    return new WP_Error('wpsg_bad_request', $normalized->get_error_message(), ['status' => 400]);
                }

                $media_item['url'] = $normalized['url'];
                $media_item['embedUrl'] = $normalized['embedUrl'];
                $media_item['provider'] = $normalized['provider'];
                if ($thumbnail !== '') {
                    $media_item['thumbnail'] = $thumbnail;
                }
            }
        } elseif ($source === 'upload') {
            $attachment_id = intval($payload['attachmentId'] ?? 0);
            if ($attachment_id <= 0) {
                return new WP_Error('wpsg_missing_attachment_id', 'attachmentId is required for uploads', ['status' => 400]);
            }

            $attachment_url = wp_get_attachment_url($attachment_id);
            if (!$attachment_url) {
                return new WP_Error('wpsg_invalid_attachment_id', 'Invalid attachmentId', ['status' => 400]);
            }

            $provider = sanitize_text_field($payload['provider'] ?? '');
            $media_item['attachmentId'] = $attachment_id;
            $media_item['url'] = $attachment_url;
            $media_item['thumbnail'] = $thumbnail ?: $attachment_url;
            if ($provider !== '') {
                $media_item['provider'] = $provider;
            }
        } else {
            return new WP_Error('wpsg_invalid_media_source', 'Invalid media source', ['status' => 400]);
        }

        return $media_item;
    }

    private static function get_max_batch_upload_size() {
        $configured_limit = intval(WPSG_Settings::get_setting('max_batch_upload_size', 20));
        if ($configured_limit <= 0) {
            $configured_limit = 20;
        }

        return intval(apply_filters('wpsg_max_batch_upload_size', $configured_limit));
    }

    private static function get_uploaded_file_entries(array $files) {
        if (!empty($files['file']) && !is_array($files['file']['name'] ?? null)) {
            return [$files['file']];
        }

        if (!empty($files['files']) && is_array($files['files']['name'] ?? null)) {
            $entries = [];
            $names = $files['files']['name'];
            foreach ($names as $index => $name) {
                $entries[] = [
                    'name' => $name,
                    'type' => $files['files']['type'][$index] ?? '',
                    'tmp_name' => $files['files']['tmp_name'][$index] ?? '',
                    'error' => $files['files']['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                    'size' => $files['files']['size'][$index] ?? 0,
                ];
            }

            return $entries;
        }

        return [];
    }

    private static function get_upload_error_data(array $file) {
        if (!isset($file['error']) || $file['error'] === UPLOAD_ERR_OK) {
            return null;
        }

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
                break;
            case UPLOAD_ERR_NO_FILE:
                $message = 'No file was uploaded.';
                break;
            case UPLOAD_ERR_NO_TMP_DIR:
            case UPLOAD_ERR_CANT_WRITE:
            case UPLOAD_ERR_EXTENSION:
                $message = 'Server error while processing upload.';
                $status = 500;
                break;
        }

        return [
            'message' => $message,
            'status' => $status,
        ];
    }

    private static function is_trusted_uploaded_file($tmp_name, array $file) {
        $allow_non_http_uploads = (bool) apply_filters('wpsg_allow_non_http_uploads', false, $file);
        if ($allow_non_http_uploads) {
            return is_string($tmp_name) && $tmp_name !== '' && file_exists($tmp_name);
        }

        return is_string($tmp_name) && $tmp_name !== '' && is_uploaded_file($tmp_name);
    }

    private static function create_attachment_from_upload(array $upload, $original_name) {
        $file_path = $upload['file'] ?? '';
        if (!is_string($file_path) || $file_path === '' || !file_exists($file_path)) {
            return new WP_Error('wpsg_bad_request', 'Upload failed.', ['status' => 400]);
        }

        $file_name = $original_name ?: wp_basename($file_path);
        $file_type = wp_check_filetype(wp_basename($file_path), null);
        $attachment = [
            'post_mime_type' => $file_type['type'] ?? ($upload['type'] ?? ''),
            'post_title' => sanitize_text_field(pathinfo($file_name, PATHINFO_FILENAME)),
            'post_content' => '',
            'post_status' => 'inherit',
        ];

        $attachment_id = wp_insert_attachment($attachment, $file_path, 0, true);
        if (is_wp_error($attachment_id)) {
            return new WP_Error('wpsg_bad_request', $attachment_id->get_error_message(), ['status' => 400]);
        }

        $attachment_metadata = wp_generate_attachment_metadata($attachment_id, $file_path);
        if (!is_wp_error($attachment_metadata)) {
            wp_update_attachment_metadata($attachment_id, $attachment_metadata);
        }

        return intval($attachment_id);
    }

    private static function prepare_uploaded_attachment_payload($attachment_id) {
        $url = wp_get_attachment_url($attachment_id);
        $thumbnail = null;
        $mime = get_post_mime_type($attachment_id);

        if ($mime && strpos($mime, 'image') === 0) {
            $thumb = wp_get_attachment_image_src($attachment_id, 'medium');
            $thumbnail = $thumb ? $thumb[0] : $url;
        }

        return [
            'attachmentId' => intval($attachment_id),
            'url' => $url,
            'thumbnail' => $thumbnail,
            'mimeType' => $mime,
        ];
    }

    private static function find_attachment_by_md5(string $md5): int {
        global $wpdb;
        $id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wpsg_file_md5' AND meta_value = %s LIMIT 1",
            $md5
        ));
        return $id ? intval($id) : 0;
    }

    // P38-MD1: Find the closest pHash match within $threshold Hamming bits.
    // Returns ['id' => int, 'url' => string, 'distance' => int] or [].
    private static function find_near_duplicates_by_phash(string $phash, int $threshold): array {
        global $wpdb;
        $limit = max(1, intval(apply_filters('wpsg_phash_max_scan', 5000)));
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT pm.post_id, pm.meta_value
                 FROM {$wpdb->postmeta} pm
                 INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 WHERE pm.meta_key = %s
                   AND p.post_type = 'attachment'
                   AND p.post_status = 'inherit'
                 LIMIT %d",
                '_wpsg_file_phash',
                $limit
            ),
            ARRAY_A
        );
        if (empty($rows)) {
            return [];
        }

        $best_id       = 0;
        $best_distance = PHP_INT_MAX;

        foreach ($rows as $row) {
            $d = WPSG_PHash::hamming_distance($phash, (string) $row['meta_value']);
            if ($d === 0) {
                $best_id       = intval($row['post_id']);
                $best_distance = 0;
                break;
            }
            if ($d < $best_distance) {
                $best_distance = $d;
                $best_id       = intval($row['post_id']);
            }
        }

        if ($best_distance > $threshold || $best_id <= 0) {
            return [];
        }

        return [
            'id'       => $best_id,
            'url'      => wp_get_attachment_url($best_id) ?: '',
            'distance' => $best_distance,
        ];
    }

    // P38-MD1: Return display name and campaign list for a WordPress attachment.
    // Used to enrich duplicate/near-duplicate 409 responses with context.
    private static function find_attachment_origin_meta(int $id): array {
        $file = get_attached_file($id);
        $name = $file ? basename($file) : (get_the_title($id) ?: '');
        $campaigns = class_exists('WPSG_DB') ? WPSG_DB::get_campaigns_for_attachment_id($id) : [];
        return ['name' => $name, 'campaigns' => $campaigns];
    }

    private static function upload_single_media_file(array $file, bool $force = false) {
        $error = self::get_upload_error_data($file);
        if ($error) {
            return new WP_Error('wpsg_upload_error', $error['message'], ['status' => $error['status']]);
        }

        if (!isset($file['tmp_name']) || !self::is_trusted_uploaded_file($file['tmp_name'], $file)) {
            return new WP_Error('wpsg_invalid_upload', 'Invalid upload', ['status' => 400]);
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
        if (isset($file['size']) && intval($file['size']) > $size_limit) {
            return new WP_Error('wpsg_file_too_large', 'File too large', ['status' => 413]);
        }

        $check = wp_check_filetype_and_ext($file['tmp_name'], $file['name']);
        $mime = $check['type'] ?? '';
        $ext = $check['ext'] ?? '';
        $check_filename = wp_check_filetype($file['name']);
        $mime_filename = $check_filename['type'] ?? '';

        if (!$mime || !in_array($mime, $allowed_mimes, true)) {
            return new WP_Error('wpsg_invalid_file_type', 'Invalid file type', ['status' => 415]);
        }

        if (!$ext || ($mime_filename && $mime_filename !== $mime)) {
            return new WP_Error('wpsg_invalid_file_type', 'Invalid file type', ['status' => 415]);
        }

        // P28-N: MD5 duplicate detection — compute before sideload while tmp file is readable.
        $md5 = md5_file($file['tmp_name']) ?: null;
        if ($md5 && !$force) {
            $existing_id = self::find_attachment_by_md5($md5);
            if ($existing_id > 0) {
                $origin = self::find_attachment_origin_meta($existing_id);
                return new WP_Error('wpsg_duplicate_file', 'This file has already been uploaded.', [
                    'status'              => 409,
                    'existing_id'         => $existing_id,
                    'existing_url'        => wp_get_attachment_url($existing_id),
                    'existing_name'       => $origin['name'],
                    'existing_campaigns'  => $origin['campaigns'],
                ]);
            }
        }

        // P38-MD1: pHash near-duplicate detection for images (runs after exact-duplicate check).
        // Compute unconditionally so forced uploads still get their hash stored for future scans.
        $phash = null;
        if (class_exists('WPSG_PHash') && WPSG_PHash::is_image_mime($mime)) {
            $phash = WPSG_PHash::compute($file['tmp_name']);
            if ($phash !== null && !$force) {
                $threshold  = intval(apply_filters('wpsg_phash_hamming_threshold', 10));
                $near_match = self::find_near_duplicates_by_phash($phash, $threshold);
                if (!empty($near_match)) {
                    $origin = self::find_attachment_origin_meta($near_match['id']);
                    return new WP_Error('wpsg_near_duplicate_file', 'A visually similar image has already been uploaded.', [
                        'status'           => 409,
                        'similar_id'       => $near_match['id'],
                        'similar_url'      => $near_match['url'],
                        'distance'         => $near_match['distance'],
                        'similar_name'     => $origin['name'],
                        'similar_campaigns' => $origin['campaigns'],
                    ]);
                }
            }
        }

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $overrides = [
            'test_form' => false,
        ];

        $upload = wp_handle_sideload($file, $overrides);
        if (!empty($upload['error'])) {
            return new WP_Error('wpsg_bad_request', $upload['error'], ['status' => 400]);
        }

        if (class_exists('WPSG_Image_Optimizer')) {
            WPSG_Image_Optimizer::$wpsg_upload_context = true;
            try {
                $upload = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
            } finally {
                WPSG_Image_Optimizer::$wpsg_upload_context = false;
            }
        }

        $attachment_id = self::create_attachment_from_upload($upload, $file['name'] ?? '');
        if (is_wp_error($attachment_id)) {
            return $attachment_id;
        }

        // P28-N: Store MD5 for future duplicate detection.
        if ($md5) {
            update_post_meta($attachment_id, '_wpsg_file_md5', $md5);
        }

        // P38-MD1: Store pHash for near-duplicate detection on future uploads.
        if ($phash !== null) {
            update_post_meta($attachment_id, '_wpsg_file_phash', $phash);
        }

        return self::prepare_uploaded_attachment_payload($attachment_id);
    }

    public static function create_media($request) {
        $post_id = self::resolve_campaign_id_from_request($request);
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $payload = $request->get_json_params();
        if (!is_array($payload)) {
            $payload = [];
        }

        // 'id' is intentionally excluded: the route's {id} capture is the campaign post ID,
        // not a media item ID. If the client wants to supply a custom media ID it must
        // include it in the JSON body; otherwise build_media_item_from_payload generates a UUID.
        foreach (['type', 'source', 'url', 'attachmentId', 'caption', 'order', 'thumbnail', 'provider', 'title'] as $key) {
            if (!array_key_exists($key, $payload)) {
                $value = $request->get_param($key);
                if (!is_null($value)) {
                    $payload[$key] = $value;
                }
            }
        }

        $media_item = self::build_media_item_from_payload($payload);
        if (is_wp_error($media_item)) {
            return $media_item;
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
        do_action('wpsg_media_added', $post_id, ['mediaId' => $media_item['id'], 'count' => 1]);
        self::bump_cache_version();

        return new WP_REST_Response($media_item, 201);
    }

    public static function create_media_batch($request) {
        $post_id = self::resolve_campaign_id_from_request($request);
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $items = $request->get_param('items');
        if (!is_array($items) || empty($items)) {
            return new WP_Error('wpsg_invalid_items', 'items must be a non-empty array', ['status' => 400]);
        }

        $max_batch_upload_size = self::get_max_batch_upload_size();
        if (count($items) > $max_batch_upload_size) {
            return new WP_Error(
                'wpsg_batch_limit_exceeded',
                sprintf('A maximum of %d items can be added per batch.', $max_batch_upload_size),
                ['status' => 400]
            );
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $next_order = self::get_next_media_order($media_items);
        $added = [];
        $failed = [];

        foreach ($items as $index => $item) {
            if (!is_array($item)) {
                $failed[] = [
                    'index' => intval($index),
                    'error' => 'Each batch item must be an object.',
                ];
                continue;
            }

            if (!isset($item['order'])) {
                $item['order'] = $next_order;
                $next_order++;
            }

            $media_item = self::build_media_item_from_payload($item);
            if (is_wp_error($media_item)) {
                $failed[] = [
                    'index' => intval($index),
                    'error' => $media_item->get_error_message(),
                ];
                continue;
            }

            $added[] = $media_item;
        }

        if (!empty($added)) {
            $media_items = array_merge($media_items, $added);
            update_post_meta($post_id, 'media_items', $media_items);
            self::add_audit_entry($post_id, 'media.batch_created', [
                'count' => count($added),
                'failed' => count($failed),
                'mediaIds' => array_values(array_map(function ($item) {
                    return $item['id'];
                }, $added)),
            ]);
            do_action('wpsg_media_added', $post_id, ['count' => count($added)]);
            self::bump_cache_version();
        }

        $status = !empty($added) ? 201 : 400;

        return new WP_REST_Response([
            'added' => $added,
            'failed' => $failed,
            'total' => count($items),
        ], $status);
    }

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

    public static function update_media($request) {
        $post_id = intval($request->get_param('id'));
        $media_id = sanitize_text_field($request->get_param('mediaId'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
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
            return new WP_Error('wpsg_media_not_found', 'Media not found', ['status' => 404]);
        }

        update_post_meta($post_id, 'media_items', $media_items);
        self::add_audit_entry($post_id, 'media.updated', [
            'mediaId' => $media_id,
        ]);
        self::bump_cache_version();
        return new WP_REST_Response(['message' => 'Media updated'], 200);
    }

    public static function reorder_media($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $items = $request->get_param('items');
        if (!is_array($items)) {
            return new WP_Error('wpsg_invalid_items', 'items must be an array', ['status' => 400]);
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
            return new WP_Error('wpsg_no_valid_items', 'No valid items provided', ['status' => 400]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];

        // Validate that all provided IDs belong to this campaign's media items.
        $existing_ids = array_map(function ($m) { return $m['id'] ?? ''; }, $media_items);
        $invalid = array_values(array_filter(array_keys($order_map), function ($id) use ($existing_ids) {
            return !in_array($id, $existing_ids, true);
        }));
        if (!empty($invalid)) {
            return new WP_Error('wpsg_invalid_media_ids', 'Invalid media id(s) provided', ['status' => 400, 'invalid' => $invalid]);
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
        self::bump_cache_version();

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
     * Enrich media items with server-derived metadata: pixel dimensions,
     * upload date, filesize, and taxonomy tags.
     *
     * Only `source === 'upload'` items with a valid `attachmentId` receive the
     * date/filesize/tag enrichment. External media items receive dimension
     * enrichment only when width/height are missing (existing behaviour).
     *
     * Batching strategy: when full enrichment is requested, all attachment IDs
     * are collected upfront and the post-meta cache is primed in one batch so
     * the per-item loop runs on cached data and does not trigger N+1 queries.
     *
     * @param array $items          Raw media-item arrays from post_meta.
     * @param bool  $dimensions_only When true, skip the date/filesize/tag enrichment
     *                               and only fill in missing pixel dimensions. Use for
     *                               lightweight list endpoints (e.g. list_campaigns)
     *                               where the extra SQL joins would slow the response
     *                               without benefiting the caller.
     * @return array                 Same items with additional fields populated.
     */
    private static function enrich_media_with_metadata(array $items, bool $dimensions_only = false): array {
        // Collect upload attachment IDs, prime the post-meta cache, and batch-load
        // taxonomy tags in three upfront queries so the per-item loop runs on cached
        // data without N+1 queries.
        //
        // Skipped entirely in $dimensions_only mode: the date/filesize/tag work is
        // not needed for lightweight endpoints. Note that the per-item dimension
        // check below will still call wp_get_attachment_metadata() for each image —
        // those calls may individually hit the DB unless the caller has separately
        // pre-warmed attachment post meta.
        $terms_by_attachment = []; // populated below when !$dimensions_only
        if (!$dimensions_only) {
            $attachment_ids = [];
            foreach ($items as $item) {
                $aid = intval($item['attachmentId'] ?? 0);
                if ($aid > 0 && ($item['source'] ?? '') === 'upload') {
                    $attachment_ids[$aid] = $aid; // keyed for O(1) deduplication
                }
            }
            $attachment_ids = array_values($attachment_ids);

            if (!empty($attachment_ids)) {
                update_meta_cache('post', $attachment_ids);

                // Batch-load tags for all upload attachment IDs in a single query.
                // 'all_with_object_id' adds an object_id property to each WP_Term
                // so results can be grouped by attachment without a second query.
                $all_terms = wp_get_object_terms(
                    $attachment_ids,
                    'wpsg_media_tag',
                    ['fields' => 'all_with_object_id'],
                );
                if (!is_wp_error($all_terms)) {
                    foreach ($all_terms as $t) {
                        $terms_by_attachment[(int) $t->object_id][] = [
                            'id'   => (int) $t->term_id,
                            'name' => (string) $t->name,
                            'slug' => (string) $t->slug,
                        ];
                    }
                }
            }
        }

        foreach ($items as &$item) {
            $source = $item['source'] ?? '';
            $aid    = intval($item['attachmentId'] ?? 0);

            // Pixel dimensions — uses cached post meta after the batch prime above.
            if (empty($item['width']) || empty($item['height'])) {
                if ($aid > 0 && ($item['type'] ?? '') === 'image') {
                    $meta = wp_get_attachment_metadata($aid);
                    if (!empty($meta['width']) && !empty($meta['height'])) {
                        $item['width']  = intval($meta['width']);
                        $item['height'] = intval($meta['height']);
                    }
                }
            }

            // Metadata enrichment (date/filesize/tags) applies only to upload items
            // with a valid attachment and is skipped entirely in dimensions_only mode.
            if ($dimensions_only || $source !== 'upload' || $aid <= 0) {
                continue;
            }

            // dateUploaded: read directly from the WP_Post object. get_post() is
            // reliable in all environments and returns from the object cache when warm.
            $post = get_post($aid);
            if ($post instanceof WP_Post) {
                $item['dateUploaded'] = $post->post_date;
            }

            // filesize: prefer the value WP stores in attachment metadata (added in WP 6.0),
            // falling back to a direct filesystem check for older installs.
            $meta = wp_get_attachment_metadata($aid) ?: [];
            if (!empty($meta['filesize'])) {
                $item['filesize'] = intval($meta['filesize']);
            } else {
                $file = get_attached_file($aid);
                if ($file && file_exists($file)) {
                    $item['filesize'] = (int) filesize($file);
                }
            }

            // tags: served from the batch-loaded map built above the loop — no
            // per-item query needed; the single wp_get_object_terms() call above
            // already fetched all tags for all upload attachment IDs.
            if (isset($terms_by_attachment[$aid])) {
                $item['tags'] = $terms_by_attachment[$aid];
            }
        }
        unset($item);

        return $items;
    }

    /**
     * @deprecated Use enrich_media_with_metadata() instead.
     * Kept for call sites that have not yet been migrated; delegates directly.
     */
    private static function enrich_media_with_dimensions(array $items): array {
        return self::enrich_media_with_metadata($items);
    }

    /**
     * Rescan and fix media types for a single campaign.
     */
    public static function rescan_media_types($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
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
            self::bump_cache_version();
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

        if ($total_updated > 0) {
            self::bump_cache_version();
        }

        return new WP_REST_Response([
            'message' => $total_updated > 0 ? 'Media types updated' : 'No changes needed',
            'campaigns_scanned' => count($campaigns),
            'campaigns_updated' => $campaigns_updated,
            'media_updated' => $total_updated,
        ], 200);
    }

    public static function delete_media($request) {
        $post_id = intval($request->get_param('id'));
        $media_id = sanitize_text_field($request->get_param('mediaId'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        if (empty($media_id)) {
            return new WP_Error('wpsg_invalid_media_id', 'mediaId is required', ['status' => 400]);
        }

        $media_items = get_post_meta($post_id, 'media_items', true);
        $media_items = is_array($media_items) ? $media_items : [];
        $before_count = count($media_items);
        $media_items = array_values(array_filter($media_items, function ($item) use ($media_id) {
            return ($item['id'] ?? '') !== $media_id;
        }));

        if (count($media_items) === $before_count) {
            return new WP_Error('wpsg_media_not_found', 'Media item not found', ['status' => 404]);
        }

        update_post_meta($post_id, 'media_items', $media_items);

        self::add_audit_entry($post_id, 'media.deleted', [
            'mediaId' => $media_id,
        ]);
        do_action('wpsg_media_removed', $post_id, ['mediaId' => $media_id]);
        self::bump_cache_version();

        return new WP_REST_Response(['message' => 'Media deleted'], 200);
    }

    public static function list_audit($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        // P28-G: backfill from post meta if no DB entries exist yet for this campaign.
        $db_count = WPSG_DB::list_audit_entries(['campaign_id' => $post_id, 'per_page' => 1, 'page' => 1])['total'];
        if ($db_count === 0) {
            $legacy = get_post_meta($post_id, 'audit_log', true);
            if (is_array($legacy) && count($legacy) > 0) {
                WPSG_DB::backfill_audit_entries($post_id, $legacy);
            }
        }

        // P28-F: pagination; P28-G: from/to/action filters.
        [$page, $per_page, ] = self::parse_pagination($request);
        $result = WPSG_DB::list_audit_entries([
            'campaign_id' => $post_id,
            'from'        => $request->get_param('from') ?: null,
            'to'          => $request->get_param('to') ?: null,
            'action'      => $request->get_param('action') ?: null,
            'page'        => $page,
            'per_page'    => $per_page,
        ]);

        return self::paginated_response($result['items'], $result['total'], $page, $per_page);
    }

    // P28-G: cross-campaign audit log.
    public static function list_global_audit($request) {
        [$page, $per_page, ] = self::parse_pagination($request);

        $args = [
            'from'     => $request->get_param('from') ?: null,
            'to'       => $request->get_param('to') ?: null,
            'action'   => $request->get_param('action') ?: null,
            'page'     => $page,
            'per_page' => $per_page,
        ];

        $campaign_id_param = $request->get_param('campaign_id');
        if ($campaign_id_param) {
            $args['campaign_id'] = intval($campaign_id_param);
        }

        $result = WPSG_DB::list_audit_entries($args);

        // Accept: text/csv → CSV export.
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        if (strpos($accept, 'text/csv') !== false) {
            return self::audit_csv_response($result['items']);
        }

        return self::paginated_response($result['items'], $result['total'], $page, $per_page);
    }

    private static function audit_csv_response(array $items): WP_REST_Response {
        $lines = ["id,campaign_id,action,actor_login,created_at,details"];
        foreach ($items as $item) {
            $lines[] = implode(',', [
                '"' . $item['id'] . '"',
                '"' . $item['campaignId'] . '"',
                '"' . str_replace('"', '""', $item['action']) . '"',
                '"' . str_replace('"', '""', $item['actorLogin']) . '"',
                '"' . $item['createdAt'] . '"',
                '"' . str_replace('"', '""', wp_json_encode($item['details'])) . '"',
            ]);
        }
        $csv = implode("\r\n", $lines);

        // Register a one-shot filter so WP REST serves raw CSV instead of JSON.
        add_filter('rest_pre_serve_request', function ($served) use ($csv) {
            if (!$served) {
                header('Content-Type: text/csv; charset=utf-8');
                header('Content-Disposition: attachment; filename="audit-log.csv"');
                // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
                echo $csv;
                $served = true;
            }
            return $served;
        }, 10, 1);

        $response = new WP_REST_Response(null, 200);
        $response->header('Content-Type', 'text/csv; charset=utf-8');
        $response->header('Content-Disposition', 'attachment; filename="audit-log.csv"');
        return $response;
    }

    public static function upload_media($request) {
        $files = $request->get_file_params();
        $entries = self::get_uploaded_file_entries($files);
        if (empty($entries)) {
            return new WP_Error('wpsg_missing_file', 'File is required', ['status' => 400]);
        }

        $force = (bool) ($request->get_param('force') ?? false);

        $is_batch = count($entries) > 1 || isset($files['files']);
        $max_batch_upload_size = self::get_max_batch_upload_size();
        if ($is_batch && count($entries) > $max_batch_upload_size) {
            return new WP_Error(
                'wpsg_batch_limit_exceeded',
                sprintf('A maximum of %d files can be uploaded per batch.', $max_batch_upload_size),
                ['status' => 400]
            );
        }

        if (!$is_batch) {
            $upload = self::upload_single_media_file($entries[0], $force);
            if (is_wp_error($upload)) {
                if ($upload->get_error_code() === 'wpsg_duplicate_file') {
                    $data = $upload->get_error_data();
                    return new WP_REST_Response([
                        'duplicate'          => true,
                        'existing_id'        => $data['existing_id'],
                        'existing_url'       => $data['existing_url'],
                        'existing_name'      => $data['existing_name'] ?? '',
                        'existing_campaigns' => $data['existing_campaigns'] ?? [],
                    ], 409);
                }
                if ($upload->get_error_code() === 'wpsg_near_duplicate_file') {
                    $data = $upload->get_error_data();
                    return new WP_REST_Response([
                        'near_duplicate'    => true,
                        'similar_id'        => $data['similar_id'],
                        'similar_url'       => $data['similar_url'],
                        'distance'          => $data['distance'],
                        'similar_name'      => $data['similar_name'] ?? '',
                        'similar_campaigns' => $data['similar_campaigns'] ?? [],
                    ], 409);
                }
                return $upload;
            }

            return new WP_REST_Response($upload, 201);
        }

        $results = [];
        $success_count = 0;

        foreach ($entries as $entry) {
            $upload = self::upload_single_media_file($entry, $force);
            $filename = sanitize_file_name($entry['name'] ?? '');

            if (is_wp_error($upload)) {
                $result = [
                    'filename' => $filename,
                    'success'  => false,
                    'error'    => $upload->get_error_message(),
                ];
                if ($upload->get_error_code() === 'wpsg_duplicate_file') {
                    $data = $upload->get_error_data();
                    $result['duplicate']          = true;
                    $result['existing_id']        = $data['existing_id'];
                    $result['existing_url']       = $data['existing_url'];
                    $result['existing_name']      = $data['existing_name'] ?? '';
                    $result['existing_campaigns'] = $data['existing_campaigns'] ?? [];
                }
                if ($upload->get_error_code() === 'wpsg_near_duplicate_file') {
                    $data = $upload->get_error_data();
                    $result['near_duplicate']    = true;
                    $result['similar_id']        = $data['similar_id'];
                    $result['similar_url']       = $data['similar_url'];
                    $result['distance']          = $data['distance'];
                    $result['similar_name']      = $data['similar_name'] ?? '';
                    $result['similar_campaigns'] = $data['similar_campaigns'] ?? [];
                }
                $results[] = $result;
                continue;
            }

            $results[] = array_merge([
                'filename' => $filename,
                'success'  => true,
            ], $upload);
            $success_count++;
        }

        return new WP_REST_Response([
            'results'   => $results,
            'total'     => count($entries),
            'succeeded' => $success_count,
            'failed'    => count($entries) - $success_count,
        ], 201);
    }

    /**
     * List media items from the WordPress Media Library.
     * Returns image and video attachments that can be associated with campaigns.
     */
    public static function list_media_library($request) {
        $per_page = intval($request->get_param('per_page') ?? 50);
        $page = intval($request->get_param('page') ?? 1);
        $search = sanitize_text_field($request->get_param('search') ?? '');
        $sort = sanitize_text_field($request->get_param('sort') ?? 'created_desc');

        $sort_map = [
            'order_asc'    => ['orderby' => 'menu_order', 'order' => 'ASC'],
            'order_desc'   => ['orderby' => 'menu_order', 'order' => 'DESC'],
            'title_asc'    => ['orderby' => 'title',      'order' => 'ASC'],
            'title_desc'   => ['orderby' => 'title',      'order' => 'DESC'],
            'created_asc'  => ['orderby' => 'date',       'order' => 'ASC'],
            'created_desc' => ['orderby' => 'date',       'order' => 'DESC'],
            'size_asc'     => ['orderby' => 'meta_value_num', 'meta_key' => '_wp_attachment_metadata', 'order' => 'ASC'],
            'size_desc'    => ['orderby' => 'meta_value_num', 'meta_key' => '_wp_attachment_metadata', 'order' => 'DESC'],
        ];
        $sort_opts = $sort_map[$sort] ?? $sort_map['created_desc'];

        $args = [
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => min($per_page, 100),
            'paged'          => max($page, 1),
            'orderby'        => $sort_opts['orderby'],
            'order'          => $sort_opts['order'],
            'post_mime_type' => ['image', 'video'],
        ];
        if (isset($sort_opts['meta_key'])) {
            $args['meta_key'] = $sort_opts['meta_key'];
        }

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

        return self::respond_with_etag($request, $payload, 200, sprintf('%d:%d:%s:%s', $page, $per_page, $search, $sort));
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
        $body = $request->get_json_params();
        $input = WPSG_Settings::from_js($body);
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $current = WPSG_Settings::get_settings();
        $merged = array_merge($current, $sanitized);

        update_option(WPSG_Settings::OPTION_NAME, $merged);
        self::bump_cache_version();

        return new WP_REST_Response(
            WPSG_Settings::to_js(WPSG_Settings::get_settings(), true),
            200
        );
    }

    public static function patch_settings($request) {
        if (!class_exists('WPSG_Settings')) {
            return new WP_Error('wpsg_internal_error', 'Settings not available', ['status' => 500]);
        }
        $body  = $request->get_json_params() ?: [];
        $input = WPSG_Settings::from_js($body);
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $current = WPSG_Settings::get_settings();
        // Only merge the keys the caller actually sent.
        $merged = array_merge($current, array_intersect_key($sanitized, $input));
        update_option(WPSG_Settings::OPTION_NAME, $merged);
        self::bump_cache_version();
        return new WP_REST_Response(
            WPSG_Settings::to_js(WPSG_Settings::get_settings(), true),
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

        if (!self::is_campaign_within_schedule_window($post_id)) {
            return false;
        }

        // P36-C: Draft campaigns are only visible to their author.
        $campaign_status = (string) get_post_meta($post_id, 'status', true);
        if ($campaign_status === 'draft') {
            if (!$user_id) {
                return false;
            }
            $post = get_post($post_id);
            return $post && intval($post->post_author) === $user_id;
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

    private static function is_campaign_within_schedule_window($post_id) {
        $now = gmdate('Y-m-d H:i:s');

        $publish_at = (string) get_post_meta($post_id, 'publish_at', true);
        if ($publish_at !== '' && $publish_at > $now) {
            return false;
        }

        $unpublish_at = (string) get_post_meta($post_id, 'unpublish_at', true);
        if ($unpublish_at !== '' && $unpublish_at <= $now) {
            return false;
        }

        return true;
    }

    private static function get_accessible_campaign_ids($user_id) {
        $sanitized_user_id = absint($user_id);
        $cv = self::get_cache_version();
        $cache_key = 'wpsg_acc_v' . $cv . '_' . $sanitized_user_id;
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
        self::bump_cache_version();
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
            'companyName' => $company_term ? $company_term->name : '',
            'title' => $post->post_title,
            'description' => $post->post_content,
            'thumbnail' => $thumbnail_url,
            'coverImage' => (string) get_post_meta($post->ID, 'cover_image', true),
            'status' => (string) get_post_meta($post->ID, 'status', true) ?: 'draft',
            'visibility' => (string) get_post_meta($post->ID, 'visibility', true) ?: 'private',
            'tags' => get_post_meta($post->ID, 'tags', true) ?: [],
            'categories' => self::get_campaign_category_ids($post->ID),
            'publishAt' => self::meta_to_iso8601($post->ID, 'publish_at'),
            'unpublishAt' => self::meta_to_iso8601($post->ID, 'unpublish_at'),
            'layoutTemplateId' => get_post_meta($post->ID, '_wpsg_layout_binding_template_id', true) ?: null,
            'layoutBinding' => get_post_meta($post->ID, '_wpsg_layout_binding', true) ?: null,
            'galleryOverrides' => self::get_campaign_gallery_overrides($post->ID),
            'createdAt' => get_post_time('c', true, $post),
            'updatedAt' => get_post_modified_time('c', true, $post),
        ];
    }

    public static function promote_campaign_gallery_overrides($gallery_overrides) {
        $sanitized = WPSG_Settings_Sanitizer::sanitize_gallery_overrides($gallery_overrides);
        return !empty($sanitized) ? $sanitized : null;
    }

    private static function get_campaign_gallery_overrides($post_id) {
        $raw = get_post_meta($post_id, '_wpsg_gallery_overrides', true);
        $decoded = null;

        if (is_array($raw)) {
            $decoded = $raw;
        } elseif (is_string($raw) && $raw !== '') {
            $candidate = json_decode($raw, true);
            $decoded = is_array($candidate) ? $candidate : null;
        }

        return self::promote_campaign_gallery_overrides($decoded);
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
                return new WP_Error('wpsg_invalid_visibility', 'Invalid visibility value', ['status' => 400]);
            }
            update_post_meta($post_id, 'visibility', $visibility);
        }
        $allowed_status = ['draft', 'active', 'archived'];
        if (!empty($status)) {
            if (!in_array($status, $allowed_status, true)) {
                return new WP_Error('wpsg_invalid_status', 'Invalid status value', ['status' => 400]);
            }
            update_post_meta($post_id, 'status', $status);
        }
        if (is_array($tags)) {
            update_post_meta($post_id, 'tags', array_values(array_map('sanitize_text_field', $tags)));
        }

        // P28-R: Campaign categories — accept integer term IDs sent from the frontend picker.
        $categories = $request->get_param('categories');
        if (is_array($categories)) {
            $term_ids = array_values(array_filter(array_map('intval', $categories)));
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
        if ($request->has_param('galleryOverrides')) {
            delete_post_meta($post_id, '_wpsg_image_adapter_id');
            delete_post_meta($post_id, '_wpsg_video_adapter_id');

            $gallery_overrides = WPSG_Settings_Sanitizer::sanitize_gallery_overrides($request->get_param('galleryOverrides'));
            if (empty($gallery_overrides)) {
                delete_post_meta($post_id, '_wpsg_gallery_overrides');
            } else {
                update_post_meta($post_id, '_wpsg_gallery_overrides', wp_json_encode($gallery_overrides));
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

        if (is_array($company)) {
            $name = isset($company['name']) ? sanitize_text_field($company['name']) : '';
            $slug = isset($company['slug']) ? sanitize_title($company['slug']) : '';
            if (empty($name)) {
                return;
            }
            $term = $slug ? term_exists($slug, 'wpsg_company') : null;
            if (!$term) {
                $term = term_exists($name, 'wpsg_company');
            }
            if (!$term) {
                $args = $slug ? ['slug' => $slug] : [];
                $term = wp_insert_term($name, 'wpsg_company', $args);
            }
        } else {
            $company = sanitize_text_field($company);
            if (empty($company)) {
                return;
            }
            $term = term_exists($company, 'wpsg_company');
            if (!$term) {
                $term = wp_insert_term($company, 'wpsg_company');
            }
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

    public static function add_audit_entry($post_id, $action, $details = []) {
        $user = wp_get_current_user();
        WPSG_DB::insert_audit_entry([
            'campaign_id' => intval($post_id),
            'action'      => $action,
            'actor_id'    => $user->ID ?? 0,
            'actor_login' => $user->user_login ?? '',
            'details'     => self::sanitize_audit_details($details),
            'created_at'  => gmdate('Y-m-d H:i:s'),
        ]);
    }

    private static function sanitize_audit_details($details, int $depth = 0) {
        if (!is_array($details)) {
            return [];
        }

        // Cap nesting depth to prevent stack overflow from crafted payloads.
        if ($depth > 5) {
            return [];
        }

        $sanitized = [];
        foreach ($details as $key => $value) {
            $safe_key = sanitize_text_field($key);
            if (is_array($value)) {
                $sanitized[$safe_key] = self::sanitize_audit_details($value, $depth + 1);
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
        $threshold_ms = intval(apply_filters('wpsg_slow_query_threshold_ms', 500));

        if ($elapsed_ms < $threshold_ms) {
            return;
        }

        $payload = [
            'label' => $label,
            'elapsedMs' => round($elapsed_ms, 2),
            'context' => $context,
        ];

        WPSG_Logger::warning('rest', 'Slow REST request detected', $payload);
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
            if (!preg_match('/^[a-zA-Z0-9_-]{4,64}$/', $video_id)) {
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

    public static function list_media_tags($request) {
        [$page, $per_page, $offset] = self::parse_pagination($request);

        $total = (int) wp_count_terms('wpsg_media_tag', ['hide_empty' => false]);

        $terms = get_terms([
            'taxonomy'   => 'wpsg_media_tag',
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

    // ── P28-C: Taxonomy CRUD Handlers ────────────────────────

    // ── P28-O: Campaign Templates ────────────────────────────────────────────

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
        $term = get_term($result['term_id'], $taxonomy);
        return new WP_REST_Response(self::format_term($term), $created_status);
    }

    private static function handle_term_delete($term_id, $taxonomy) {
        $term_id = intval($term_id);
        $term = get_term($term_id, $taxonomy);
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_not_found', 'Term not found', ['status' => 404]);
        }
        $result = wp_delete_term($term_id, $taxonomy);
        if (is_wp_error($result) || $result === false) {
            return new WP_Error('wpsg_internal_error', 'Failed to delete term', ['status' => 500]);
        }
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
        $term = get_term($result['term_id'], 'wpsg_campaign_category');
        return new WP_REST_Response(self::format_term($term), 200);
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

    public static function create_media_tag(WP_REST_Request $request) {
        return self::handle_term_insert(
            $request->get_param('name'),
            $request->get_param('slug'),
            'wpsg_media_tag',
        );
    }

    public static function delete_media_tag(WP_REST_Request $request) {
        return self::handle_term_delete($request->get_param('id'), 'wpsg_media_tag');
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
            return $result;
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

        return new WP_REST_Response($result, 200);
    }

    /**
     * Delete a layout template (admin).
     */
    public static function delete_layout_template($request) {
        $id      = $request->get_param('templateId');
        $deleted = WPSG_Layout_Templates::delete($id);

        if (!$deleted) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }
        self::bump_cache_version();

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

        $url = WPSG_Webhooks::sanitize_url($request->get_param('url') ?? '');
        if (empty($url)) {
            return new WP_Error('wpsg_invalid_url', 'A valid HTTP(S) URL is required.', ['status' => 400]);
        }

        $raw_events = $request->get_param('events');
        $events = WPSG_Webhooks::sanitize_events(is_array($raw_events) ? $raw_events : []);
        $raw_enabled = $request->get_param('enabled');
        $enabled     = $raw_enabled === null ? true : (bool) $raw_enabled;
        $secret = WPSG_Webhooks::generate_secret();

        $endpoint = [
            'url'     => $url,
            'secret'  => $secret,
            'events'  => $events,
            'enabled' => (bool) $enabled,
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
            $url = WPSG_Webhooks::sanitize_url($request->get_param('url'));
            if (empty($url)) {
                return new WP_Error('wpsg_invalid_url', 'A valid HTTP(S) URL is required.', ['status' => 400]);
            }
            $existing['url'] = $url;
        }

        if ($request->get_param('events') !== null) {
            $raw_events = $request->get_param('events');
            $existing['events'] = WPSG_Webhooks::sanitize_events(is_array($raw_events) ? $raw_events : []);
        }

        if ($request->get_param('enabled') !== null) {
            $existing['enabled'] = (bool) $request->get_param('enabled');
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
        $limit = min(intval($request->get_param('limit') ?? 50), 50);
        return new WP_REST_Response(array_slice($log, 0, $limit), 200);
    }
}
