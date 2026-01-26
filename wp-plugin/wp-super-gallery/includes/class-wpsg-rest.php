<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-wpsg-oembed-providers.php';

class WPSG_REST {
    public static function register_routes() {
        register_rest_route('wp-super-gallery/v1', '/campaigns', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaigns'],
                'permission_callback' => '__return_true',
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

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_media'],
                'permission_callback' => function () {
                    return is_user_logged_in();
                },
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_media'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/(?P<mediaId>[a-zA-Z0-9_-]+)', [
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

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/media/reorder', [
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'reorder_media'],
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

        // Allow oEmbed proxy as public endpoint to avoid auth/cors issues for previews.
        // If you prefer restricting this, change permission_callback accordingly.
        register_rest_route('wp-super-gallery/v1', '/oembed', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'proxy_oembed'],
                'permission_callback' => '__return_true',
            ],
        ]);
    }

    public static function require_admin() {
        return current_user_can('manage_options');
    }

    public static function require_authenticated() {
        return is_user_logged_in();
    }

    public static function list_campaigns() {
        $request = func_get_arg(0);
        $status = sanitize_text_field($request->get_param('status'));
        $visibility = sanitize_text_field($request->get_param('visibility'));
        $company = sanitize_text_field($request->get_param('company'));
        $search = sanitize_text_field($request->get_param('search'));
        $page = max(1, intval($request->get_param('page')));
        $per_page = max(1, min(50, intval($request->get_param('per_page') ?: 10)));

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

        $user_id = get_current_user_id();
        if (!current_user_can('manage_options')) {
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

        return new WP_REST_Response([
            'items' => $items,
            'page' => $page,
            'perPage' => $per_page,
            'total' => (int) $query->found_posts,
            'totalPages' => (int) $query->max_num_pages,
        ], 200);
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

    public static function list_media() {
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
        return new WP_REST_Response($media_items ?: [], 200);
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

        return new WP_REST_Response($effective, 200);
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

    public static function proxy_oembed() {
        $request = func_get_arg(0);
        $url = esc_url_raw($request->get_param('url'));
        if (empty($url)) {
            return new WP_REST_Response(['message' => 'url is required'], 400);
        }

        $parsed = wp_parse_url($url);

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
        $is_admin = current_user_can('manage_options');
        return new WP_REST_Response(['campaignIds' => $campaign_ids, 'isAdmin' => $is_admin], 200);
    }

    private static function campaign_exists($post_id) {
        $post = get_post($post_id);
        return $post && $post->post_type === 'wpsg_campaign';
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
