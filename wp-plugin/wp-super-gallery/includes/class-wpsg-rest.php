<?php

if (!defined('ABSPATH')) {
    exit;
}

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
                'permission_callback' => '__return_true',
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
                'permission_callback' => '__return_true',
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

        register_rest_route('wp-super-gallery/v1', '/media/upload', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'upload_media'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
    }

    public static function require_admin() {
        return current_user_can('manage_options');
    }

    private static function user_can_access_campaign($post_id, $user_id = null) {
        // Admins can access everything
        if (current_user_can('manage_options')) {
            return true;
        }

        $visibility = get_post_meta($post_id, 'visibility', true);
        
        // Public campaigns are accessible to everyone
        if ($visibility === 'public') {
            return true;
        }

        // Private campaigns require authentication and explicit access
        if ($user_id === null) {
            $user_id = get_current_user_id();
        }

        // Unauthenticated users cannot access private campaigns
        if ($user_id <= 0) {
            return false;
        }

        // Check if user has explicit access grant
        $company_term = self::get_company_term($post_id);
        $company_grants = $company_term ? get_term_meta($company_term->term_id, 'access_grants', true) : [];
        $campaign_grants = get_post_meta($post_id, 'access_grants', true);
        $overrides = get_post_meta($post_id, 'access_overrides', true);

        $company_grants = is_array($company_grants) ? $company_grants : [];
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        $overrides = is_array($overrides) ? $overrides : [];

        // Check for deny override
        foreach ($overrides as $override) {
            if (intval($override['userId'] ?? 0) === $user_id && ($override['action'] ?? '') === 'deny') {
                return false;
            }
        }

        // Check for explicit grant in company or campaign
        $all_grants = array_merge($company_grants, $campaign_grants);
        foreach ($all_grants as $grant) {
            if (intval($grant['userId'] ?? 0) === $user_id) {
                return true;
            }
        }

        return false;
    }

    public static function list_campaigns() {
        $request = func_get_arg(0);
        $status = sanitize_text_field($request->get_param('status'));
        $visibility = sanitize_text_field($request->get_param('visibility'));
        $company = sanitize_text_field($request->get_param('company'));
        $search = sanitize_text_field($request->get_param('search'));
        $page = max(1, intval($request->get_param('page')));
        $per_page = max(1, min(50, intval($request->get_param('per_page') ?: 10)));

        $current_user_id = get_current_user_id();
        $is_admin = current_user_can('manage_options');

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

        // For non-admin users, only query public campaigns by default
        // Private campaigns will require additional permission checks
        if (!$is_admin) {
            // If visibility filter is explicitly set to 'private', we need to check access grants
            // Otherwise, just query public campaigns
            if ($visibility === 'private') {
                // Will need to filter by permission after query
                $args['posts_per_page'] = -1; // Need all to filter properly
            } elseif (empty($visibility)) {
                // No visibility filter - show only public campaigns to non-admin
                $meta_query[] = [
                    'key' => 'visibility',
                    'value' => 'public',
                ];
            } else {
                // Visibility is explicitly 'public'
                $meta_query[] = [
                    'key' => 'visibility',
                    'value' => 'public',
                ];
            }
        } else {
            // Admin can see all, apply visibility filter if provided
            if (!empty($visibility)) {
                $meta_query[] = [
                    'key' => 'visibility',
                    'value' => $visibility,
                ];
            }
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

        $query = new WP_Query($args);
        
        // For non-admin users requesting private campaigns, filter by access
        if (!$is_admin && $visibility === 'private') {
            $accessible_posts = array_filter($query->posts, function($post) use ($current_user_id) {
                return self::user_can_access_campaign($post->ID, $current_user_id);
            });
            $accessible_posts = array_values($accessible_posts);
            
            // Re-calculate pagination after filtering
            $total = count($accessible_posts);
            $total_pages = ceil($total / $per_page);
            $offset = ($page - 1) * $per_page;
            $items = array_slice($accessible_posts, $offset, $per_page);
            $items = array_map([self::class, 'format_campaign'], $items);

            return new WP_REST_Response([
                'items' => $items,
                'page' => $page,
                'perPage' => $per_page,
                'total' => $total,
                'totalPages' => $total_pages,
            ], 200);
        }

        // For admin or public campaigns, use standard pagination
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

        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 201);
    }

    public static function get_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        // Check if user has permission to access this campaign
        if (!self::user_can_access_campaign($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
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

        return new WP_REST_Response(self::format_campaign(get_post($post_id)), 200);
    }

    public static function archive_campaign() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        update_post_meta($post_id, 'status', 'archived');
        return new WP_REST_Response(['message' => 'Campaign archived'], 200);
    }

    public static function list_media() {
        $request = func_get_arg(0);
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
        }

        // Check if user has permission to access this campaign
        if (!self::user_can_access_campaign($post_id)) {
            return new WP_REST_Response(['message' => 'Campaign not found'], 404);
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

        foreach ($media_items as &$item) {
            if (($item['id'] ?? '') === $media_id) {
                if (!is_null($request->get_param('caption'))) {
                    $item['caption'] = sanitize_text_field($request->get_param('caption'));
                }
                if (!is_null($request->get_param('order'))) {
                    $item['order'] = intval($request->get_param('order'));
                }
                if (!is_null($request->get_param('thumbnail'))) {
                    $item['thumbnail'] = esc_url_raw($request->get_param('thumbnail'));
                }
                $updated = true;
                break;
            }
        }
        unset($item);

        if (!$updated) {
            return new WP_REST_Response(['message' => 'Media not found'], 404);
        }

        update_post_meta($post_id, 'media_items', $media_items);
        return new WP_REST_Response(['message' => 'Media updated'], 200);
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

        return new WP_REST_Response(['message' => 'Media deleted'], 200);
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

    private static function campaign_exists($post_id) {
        $post = get_post($post_id);
        return $post && $post->post_type === 'wpsg_campaign';
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
            return [
                'provider' => 'vimeo',
                'url' => $url,
                'embedUrl' => 'https://player.vimeo.com/video/' . esc_attr($video_id),
            ];
        }

        if ($host === 'rumble.com' || $host === 'www.rumble.com') {
            $slug = trim($path, '/');
            if (!$slug) {
                return new WP_Error('invalid_url', 'Invalid Rumble URL');
            }
            return [
                'provider' => 'rumble',
                'url' => $url,
                'embedUrl' => 'https://rumble.com/embed/' . esc_attr($slug),
            ];
        }

        if ($host === 'www.bitchute.com' || $host === 'bitchute.com') {
            $matches = [];
            if (!preg_match('#/video/([a-zA-Z0-9]+)/?#', $path, $matches)) {
                return new WP_Error('invalid_url', 'Invalid BitChute URL');
            }
            $video_id = $matches[1];
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
                return [
                    'provider' => 'odysee',
                    'url' => $url,
                    'embedUrl' => 'https://odysee.com/$/embed/' . esc_attr($embed_slug),
                ];
            }
            return [
                'provider' => 'odysee',
                'url' => $url,
                'embedUrl' => $url,
            ];
        }

        return new WP_Error('invalid_url', 'Provider not supported');
    }
}
