<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Campaign_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
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
                        'enum'     => ['archive', 'restore', 'delete'],
                    ],
                    'ids'    => [
                        'required' => true,
                        'type'     => 'array',
                        'items'    => ['type' => 'integer'],
                    ],
                    'purge_analytics' => [
                        'required' => false,
                        'type'     => 'boolean',
                        'default'  => false,
                    ],
                    'confirm'         => [
                        'required' => false,
                        'type'     => 'boolean',
                        'default'  => false,
                    ],
                ],
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
        if (is_wp_error($meta_result)) {
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
        if (is_wp_error($meta_result)) {
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

        $allowed_actions = ['archive', 'restore', 'delete'];
        if (!in_array($action, $allowed_actions, true)) {
            return new WP_Error('wpsg_invalid_action', 'Invalid action. Allowed: archive, restore, delete', ['status' => 400]);
        }
        if (!is_array($ids) || empty($ids)) {
            return new WP_Error('wpsg_invalid_ids', 'ids must be a non-empty array', ['status' => 400]);
        }

        $success = [];
        $failed  = [];

        if ($action === 'delete') {
            if (!self::is_truthy_param($request->get_param('confirm'))) {
                return new WP_Error(
                    'wpsg_delete_unconfirmed',
                    'Missing confirm=true parameter for bulk delete',
                    ['status' => 400]
                );
            }
            global $wpdb;
            $purge_analytics = self::is_truthy_param($request->get_param('purge_analytics'));
            foreach ($ids as $raw_id) {
                $post_id = intval($raw_id);
                if (!self::campaign_exists($post_id)) {
                    $failed[] = ['id' => (string) $post_id, 'reason' => 'not found'];
                    continue;
                }
                self::add_audit_entry($post_id, 'campaign.deleted', ['purge_analytics' => $purge_analytics]);
                do_action('wpsg_campaign_deleted', $post_id);
                WPSG_DB::delete_media_refs($post_id);
                WPSG_DB::delete_access_requests_for_campaign($post_id);
                if ($purge_analytics) {
                    $wpdb->delete(WPSG_DB::get_analytics_table(), ['campaign_id' => $post_id], ['%d']); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
                }
                $deleted = wp_delete_post($post_id, true);
                if ($deleted) {
                    $success[] = (string) $post_id;
                } else {
                    $failed[] = ['id' => (string) $post_id, 'reason' => 'wp_delete_post failed'];
                }
            }
        } else {
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
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['success' => $success, 'failed' => $failed], 200);
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
            'scope'       => $request->get_param('scope') ?: null,
            'severity'    => $request->get_param('severity') ?: null,
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
            'scope'    => $request->get_param('scope') ?: null,
            'severity' => $request->get_param('severity') ?: null,
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
}
