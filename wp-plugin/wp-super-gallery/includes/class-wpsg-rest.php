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
    }

    public static function rate_limit_public($request) {
        $limit = intval(apply_filters('wpsg_rate_limit_public', 60));
        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        return self::rate_limit_check($request, 'public', $limit, $window);
    }

    private static function rate_limit_check($request, $scope, $limit, $window) {
        if ($limit <= 0) {
            return true;
        }

        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
        $user_id = get_current_user_id();
        $route = $request->get_route();
        $key = sprintf('wpsg_rl_%s_%s_%s', $scope, $user_id ?: 'anon', md5($ip . '|' . $route));

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
        return current_user_can('manage_wpsg');
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
        $page = max(1, intval($request->get_param('page')));
        $per_page = max(1, min(50, intval($request->get_param('per_page') ?: 10)));

        // Generate cache key based on user ID and query parameters
        $user_id = get_current_user_id();
        $is_admin = current_user_can('manage_options');
        $cache_key = sprintf(
            'wpsg_campaigns_%d_%s_%s_%s_%s_%d_%d_%s',
            $user_id,
            $status ?: 'all',
            $visibility ?: 'all',
            $company ?: 'all',
            $search ?: 'none',
            $page,
            $per_page,
            $is_admin ? 'admin' : 'user'
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
        }

        $query = new WP_Query($args);
        $items = array_map([self::class, 'format_campaign'], $query->posts);

        $response_data = [
            'items' => $items,
            'page' => $page,
            'perPage' => $per_page,
            'total' => (int) $query->found_posts,
            'totalPages' => (int) $query->max_num_pages,
        ];

        // Cache for 5 minutes (300 seconds)
        set_transient($cache_key, $response_data, 300);

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

        self::apply_campaign_meta($post_id, $request);
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
                        if (!preg_match('/^[a-zA-Z0-9_:-]+$/', $embed_slug)) {
                            return new WP_Error('invalid_url', 'Invalid Odysee video ID format');
                        }
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

        self::apply_campaign_meta($post_id, $request);
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

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $attachment_id = media_handle_upload('file', 0);
        if (is_wp_error($attachment_id)) {
            return new WP_REST_Response(['message' => $attachment_id->get_error_message()], 400);
        }

        $url = wp_get_attachment_url($attachment_id);
        return new WP_REST_Response([
            'attachmentId' => $attachment_id,
            'url' => $url,
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
                // Try to get video thumbnail if available
                $poster = get_post_meta($post->ID, '_wp_attachment_image_alt', true);
                $thumbnail = $poster ?: null;
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
        $url = esc_url_raw($request->get_param('url'));
        if (empty($url)) {
            return new WP_REST_Response(['message' => 'url is required'], 400);
        }

        $parsed = wp_parse_url($url);

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

        $attempts = [];
        $result = WPSG_OEmbed_Providers::fetch($url, $parsed, $attempts);
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
            return new WP_REST_Response($result, 200);
        }

        // Cache generic failure to avoid repeated immediate retries
        $fallback = [
            'message' => 'Unable to fetch oEmbed',
            'attempts' => $attempts,
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
        return new WP_REST_Response(['campaignIds' => $campaign_ids, 'isAdmin' => $is_admin], 200);
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
        
        // Allow testing email failure scenario via request param
        $simulate_param = $request->get_param('simulateEmailFailure');
        $simulate_email_failure = ($simulate_param === true || $simulate_param === 'true');
        
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
     * @return WP_REST_Response Settings data.
     */
    public static function get_public_settings() {
        // Use WPSG_Settings if available, otherwise return defaults.
        if (class_exists('WPSG_Settings')) {
            $settings = WPSG_Settings::get_settings();
        } else {
            $settings = [
                'auth_provider'     => 'wp-jwt',
                'api_base'          => '',
                'theme'             => 'dark',
                'gallery_layout'    => 'grid',
                'items_per_page'    => 12,
                'enable_lightbox'   => true,
                'enable_animations' => true,
                'cache_ttl'         => 3600,
            ];
        }

        // Admins get full settings; others get display settings only.
        if (current_user_can('manage_options')) {
            return new WP_REST_Response([
                'authProvider'     => $settings['auth_provider'] ?? 'wp-jwt',
                'apiBase'          => $settings['api_base'] ?? '',
                'theme'            => $settings['theme'] ?? 'dark',
                'galleryLayout'    => $settings['gallery_layout'] ?? 'grid',
                'itemsPerPage'     => $settings['items_per_page'] ?? 12,
                'enableLightbox'   => $settings['enable_lightbox'] ?? true,
                'enableAnimations' => $settings['enable_animations'] ?? true,
                'cacheTtl'         => $settings['cache_ttl'] ?? 3600,
            ], 200);
        }

        // Public users only see display-related settings.
        $public_settings = [
            'theme'            => $settings['theme'] ?? 'dark',
            'galleryLayout'    => $settings['gallery_layout'] ?? 'grid',
            'itemsPerPage'     => $settings['items_per_page'] ?? 12,
            'enableLightbox'   => $settings['enable_lightbox'] ?? true,
            'enableAnimations' => $settings['enable_animations'] ?? true,
        ];

        return new WP_REST_Response($public_settings, 200);
    }

    /**
     * Update settings (admin only).
     *
     * @param WP_REST_Request $request Request object.
     * @return WP_REST_Response Updated settings.
     */
    public static function update_settings($request) {
        if (!class_exists('WPSG_Settings')) {
            return new WP_REST_Response(['error' => 'Settings not available'], 500);
        }

        $body = $request->get_json_params();

        // Map camelCase from frontend to snake_case for PHP.
        $input = [];

        if (isset($body['authProvider'])) {
            $input['auth_provider'] = sanitize_text_field($body['authProvider']);
        }
        if (isset($body['apiBase'])) {
            $input['api_base'] = esc_url_raw($body['apiBase']);
        }
        if (isset($body['theme'])) {
            $input['theme'] = sanitize_text_field($body['theme']);
        }
        if (isset($body['galleryLayout'])) {
            $input['gallery_layout'] = sanitize_text_field($body['galleryLayout']);
        }
        if (isset($body['itemsPerPage'])) {
            $input['items_per_page'] = intval($body['itemsPerPage']);
        }
        if (isset($body['enableLightbox'])) {
            $input['enable_lightbox'] = (bool) $body['enableLightbox'];
        }
        if (isset($body['enableAnimations'])) {
            $input['enable_animations'] = (bool) $body['enableAnimations'];
        }
        if (isset($body['cacheTtl'])) {
            $input['cache_ttl'] = intval($body['cacheTtl']);
        }

        // Use WPSG_Settings sanitization.
        $sanitized = WPSG_Settings::sanitize_settings($input);

        // Merge with existing settings.
        $current = WPSG_Settings::get_settings();
        $merged = array_merge($current, $sanitized);

        // Save to WordPress options.
        update_option(WPSG_Settings::OPTION_NAME, $merged);

        // Return updated settings in frontend format.
        return new WP_REST_Response([
            'authProvider'     => $merged['auth_provider'],
            'apiBase'          => $merged['api_base'],
            'theme'            => $merged['theme'],
            'galleryLayout'    => $merged['gallery_layout'],
            'itemsPerPage'     => $merged['items_per_page'],
            'enableLightbox'   => $merged['enable_lightbox'],
            'enableAnimations' => $merged['enable_animations'],
            'cacheTtl'         => $merged['cache_ttl'],
        ], 200);
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
            'createdAt' => get_post_time('c', true, $post),
            'updatedAt' => get_post_modified_time('c', true, $post),
        ];
    }

    private static function apply_campaign_meta($post_id, $request) {
        $visibility = sanitize_text_field($request->get_param('visibility'));
        $status = sanitize_text_field($request->get_param('status'));
        $tags = $request->get_param('tags');
        $cover_image = esc_url_raw($request->get_param('coverImage'));
        $thumbnail_id = intval($request->get_param('thumbnailId'));

        if (!empty($visibility)) {
            update_post_meta($post_id, 'visibility', $visibility);
        }
        if (!empty($status)) {
            update_post_meta($post_id, 'status', $status);
        }
        if (is_array($tags)) {
            update_post_meta($post_id, 'tags', array_values(array_map('sanitize_text_field', $tags)));
        }
        if (!empty($cover_image)) {
            update_post_meta($post_id, 'cover_image', $cover_image);
        }
        if ($thumbnail_id > 0) {
            set_post_thumbnail($post_id, $thumbnail_id);
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
        $placeholders = implode(',', array_fill(0, count($campaign_ids), '%d'));
        $sql = $wpdb->prepare(
            "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE post_id IN ({$placeholders}) AND meta_key IN (%s, %s)",
            array_merge($campaign_ids, ['access_grants', 'status'])
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
}
