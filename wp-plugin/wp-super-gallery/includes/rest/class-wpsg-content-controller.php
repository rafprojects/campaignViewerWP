<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Content_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // P18-H: Campaign categories
        register_rest_route('wp-super-gallery/v1', '/campaign-categories', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_campaign_categories'],
                'permission_callback' => WPSG_Permissions::gate('categories.list'),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign_category'],
                'permission_callback' => WPSG_Permissions::gate('categories.create'),
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
                'permission_callback' => WPSG_Permissions::gate('categories.update'),
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
                'permission_callback' => WPSG_Permissions::gate('categories.delete'),
            ],
        ]);

        // P28-O: Campaign Templates
        register_rest_route('wp-super-gallery/v1', '/campaign-templates', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_campaign_templates'],
                'permission_callback' => WPSG_Permissions::gate('campaign_templates.list'),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign_template'],
                'permission_callback' => WPSG_Permissions::gate('campaign_templates.create'),
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
                'permission_callback' => WPSG_Permissions::gate('campaign_templates.delete'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-templates/(?P<id>[a-zA-Z0-9_]+)/instantiate', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'instantiate_campaign_template'],
                'permission_callback' => WPSG_Permissions::gate('campaign_templates.instantiate'),
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        // Company management routes
        register_rest_route('wp-super-gallery/v1', '/companies', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_companies'],
                'permission_callback' => WPSG_Permissions::gate('companies.list'),
            ],
        ]);

        // P14-G / P28-C: Campaign tags.
        register_rest_route('wp-super-gallery/v1', '/tags/campaign', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaign_tags'],
                'permission_callback' => WPSG_Permissions::gate('campaign_tags.list'),
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_campaign_tag'],
                'permission_callback' => WPSG_Permissions::gate('campaign_tags.create'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/campaign/(?P<id>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_campaign_tag'],
                'permission_callback' => WPSG_Permissions::gate('campaign_tags.delete'),
            ],
        ]);

        // ── P15-B: Layout Template CRUD (admin) ──────────────────
        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_layout_templates'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.list'),
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_layout_template'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.create'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.read'),
            ],
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'update_layout_template'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.update'),
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_layout_template'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.delete'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates/(?P<templateId>[a-f0-9\-]{36})/duplicate', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'duplicate_layout_template'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.duplicate'),
            ],
        ]);

        // P15-H / P50-K: Visual asset library (admin, campaign-agnostic).
        register_rest_route('wp-super-gallery/v1', '/admin/asset-library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_asset_library'],
                'permission_callback' => WPSG_Permissions::gate('assets.list'),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_asset'],
                'permission_callback' => WPSG_Permissions::gate('assets.upload'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/asset-library/(?P<id>[a-f0-9\-]{36})', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'update_asset'],
                'permission_callback' => WPSG_Permissions::gate('assets.update'),
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_asset'],
                'permission_callback' => WPSG_Permissions::gate('assets.delete'),
            ],
        ]);

        // P22-L5: Custom font library (admin, campaign-agnostic).
        register_rest_route('wp-super-gallery/v1', '/admin/font-library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_font_library'],
                'permission_callback' => WPSG_Permissions::gate('fonts.list'),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_font'],
                'permission_callback' => WPSG_Permissions::gate('fonts.upload'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/font-library/(?P<id>[a-f0-9\-]{36})', [
            [
                // P50-J: partial update of a font's `is_universal` flag.
                'methods'             => 'POST',
                'callback'            => [self::class, 'update_font'],
                'permission_callback' => WPSG_Permissions::gate('fonts.update'),
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_font'],
                'permission_callback' => WPSG_Permissions::gate('fonts.delete'),
            ],
        ]);

        // P15-B: Public read-only endpoint for rendering (no auth, ID-based only).
        register_rest_route('wp-super-gallery/v1', '/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template_public'],
                'permission_callback' => WPSG_Permissions::gate('layout_templates.read_public'),
            ],
        ]);
    }

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
                'id'    => strval($term->term_id),
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
            ];
        }, $terms);

        return self::paginated_response($items, $total, $page, $per_page);
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

    // ── Asset Library (P15-H / P50-K) ────────────────────────

    /**
     * P50-B: When a `space` param names a delegated space, restrict library
     * items to assets associated with that space. Open-mode spaces (and
     * requests with no space param) see the full global library.
     */
    private static function filter_library_for_space( array $items, $request, string $asset_type ): array {
        $space_id = intval( $request->get_param( 'space' ) );
        if ( $space_id <= 0 ) {
            return $items;
        }
        $space = WPSG_DB::get_space( $space_id );
        if ( ! $space || $space->isolation_mode !== 'delegated' ) {
            return $items;
        }
        $allowed = array_flip( WPSG_DB::get_space_library_assets( $space_id, $asset_type ) );
        // P50-I: universal assets bypass the per-space association filter and are
        // visible to every delegated space, regardless of association rows.
        return array_values( array_filter(
            $items,
            fn( $item ) => ! empty( $item['isUniversal'] ) || isset( $allowed[ $item['id'] ?? '' ] )
        ) );
    }

    /**
     * List all asset library items.
     */
    public static function list_asset_library( $request ) {
        $items = WPSG_Asset_Library::get_all();
        $items = self::filter_library_for_space( $items, $request, 'asset' );
        return new WP_REST_Response( $items, 200 );
    }

    /**
     * Upload a new visual asset (file upload) or register a URL.
     *
     * Accepts multipart/form-data with a 'file' field, or a JSON body
     * with { url, name, is_universal?, tags? } to register an external URL.
     */
    public static function upload_asset( $request ) {
        $files = $request->get_file_params();
        // File upload path.
        if ( ! empty( $files['file'] ) ) {
            $url = WPSG_Asset_Library::handle_upload( $files['file'] );
            if ( is_wp_error( $url ) ) {
                return new WP_Error( 'wpsg_upload_failed', $url->get_error_message(), [ 'status' => 400 ] );
            }
            $name         = sanitize_text_field( $request->get_param( 'name' ) ?? basename( $files['file']['name'] ) );
            $is_universal = self::to_bool( $request->get_param( 'is_universal' ) );
            $tags         = self::parse_tags_param( $request->get_param( 'tags' ) );
        } else {
            // URL-only path.
            $data         = $request->get_json_params() ?? [];
            $url          = esc_url_raw( $data['url'] ?? '' );
            $name         = sanitize_text_field( $data['name'] ?? '' );
            $is_universal = self::to_bool( $data['is_universal'] ?? false );
            $tags         = self::parse_tags_param( $data['tags'] ?? null );
            if ( empty( $url ) ) {
                return new WP_Error( 'wpsg_missing_file_or_url', 'A file or URL is required.', [ 'status' => 400 ] );
            }
        }

        $entry = WPSG_Asset_Library::add( [ 'url' => $url, 'name' => $name, 'is_universal' => $is_universal, 'tags' => $tags ] );
        if ( is_wp_error( $entry ) ) {
            return new WP_Error( 'wpsg_asset_save_failed', $entry->get_error_message(), [ 'status' => 500 ] );
        }
        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * P50-I / P50-K: Partial update of an asset's `is_universal` flag and/or
     * `tags`. Only the fields present in the JSON body are changed.
     */
    public static function update_asset( $request ) {
        $id   = $request->get_param( 'id' );
        $data = $request->get_json_params() ?? [];

        $has_universal = array_key_exists( 'is_universal', $data );
        $has_tags      = array_key_exists( 'tags', $data );
        if ( ! $has_universal && ! $has_tags ) {
            return new WP_Error( 'wpsg_missing_field', 'is_universal or tags is required.', [ 'status' => 400 ] );
        }

        $response = [ 'id' => $id ];
        if ( $has_universal ) {
            $universal = self::to_bool( $data['is_universal'] );
            if ( ! WPSG_Asset_Library::set_universal( $id, $universal ) ) {
                return new WP_Error( 'wpsg_asset_not_found', 'Asset not found.', [ 'status' => 404 ] );
            }
            $response['isUniversal'] = $universal;
        }
        if ( $has_tags ) {
            $tags = self::parse_tags_param( $data['tags'] );
            if ( ! WPSG_Asset_Library::set_tags( $id, $tags ) ) {
                return new WP_Error( 'wpsg_asset_not_found', 'Asset not found.', [ 'status' => 404 ] );
            }
            $response['tags'] = $tags;
        }
        return new WP_REST_Response( $response, 200 );
    }

    /**
     * Normalize a mixed REST input value to a boolean. Accepts native bools,
     * the strings "1"/"true"/"on"/"yes" (case-insensitive), and integers.
     */
    private static function to_bool( $value ): bool {
        if ( is_bool( $value ) ) {
            return $value;
        }
        if ( is_string( $value ) ) {
            return in_array( strtolower( trim( $value ) ), [ '1', 'true', 'on', 'yes' ], true );
        }
        return (bool) $value;
    }

    /**
     * Normalize a mixed `tags` REST input to a clean string[]. Accepts a native
     * array or a JSON-encoded array string; anything else yields [].
     */
    private static function parse_tags_param( $value ): array {
        if ( is_string( $value ) ) {
            $decoded = json_decode( $value, true );
            $value   = is_array( $decoded ) ? $decoded : [];
        }
        if ( ! is_array( $value ) ) {
            return [];
        }
        $clean = [];
        foreach ( $value as $tag ) {
            $t = sanitize_text_field( (string) $tag );
            if ( $t !== '' && ! in_array( $t, $clean, true ) ) {
                $clean[] = $t;
            }
        }
        return $clean;
    }

    /**
     * Remove an asset library entry.
     */
    public static function delete_asset( $request ) {
        $id      = $request->get_param( 'id' );
        $deleted = WPSG_Asset_Library::remove( $id );
        if ( ! $deleted ) {
            return new WP_Error( 'wpsg_asset_not_found', 'Asset not found.', [ 'status' => 404 ] );
        }
        return new WP_REST_Response( [ 'deleted' => true ], 200 );
    }

    // ── Font Library (P22-L5) ───────────────────────────────────

    /**
     * List all uploaded custom fonts.
     */
    public static function list_font_library( $request ) {
        $items = WPSG_Font_Library::get_all();
        $items = self::filter_library_for_space( $items, $request, 'font' );
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
            'url'          => $result['url'],
            'name'         => $name,
            'filename'     => sanitize_file_name( $file['name'] ),
            'format'       => $result['format'],
            'is_universal' => self::to_bool( $request->get_param( 'is_universal' ) ),
        ] );

        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * P50-J: Partial update of a font's `is_universal` flag.
     */
    public static function update_font( $request ) {
        $id   = $request->get_param( 'id' );
        $data = $request->get_json_params() ?? [];

        if ( ! array_key_exists( 'is_universal', $data ) ) {
            return new WP_Error( 'wpsg_missing_field', 'is_universal is required.', [ 'status' => 400 ] );
        }

        $universal = self::to_bool( $data['is_universal'] );
        if ( ! WPSG_Font_Library::set_universal( $id, $universal ) ) {
            return new WP_Error( 'wpsg_font_not_found', 'Font not found.', [ 'status' => 404 ] );
        }
        return new WP_REST_Response( [ 'id' => $id, 'isUniversal' => $universal ], 200 );
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

    /**
     * List all companies with their campaign counts and statistics.
     */
    public static function list_companies($request) {
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?? 50)));
        $offset = ($page - 1) * $per_page;

        $space_param = sanitize_text_field($request->get_param('space') ?? '');
        $space_id    = (is_numeric($space_param) && intval($space_param) > 0) ? intval($space_param) : 0;

        // Transient cache (same invalidation strategy as list_campaigns).
        $cache_version = get_option('wpsg_cache_version', 0);
        $cache_key = "wpsg_companies_{$page}_{$per_page}_{$space_id}_{$cache_version}";
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            $response = new WP_REST_Response($cached, 200);
            $count_args = ['hide_empty' => false];
            if ($space_id > 0) {
                $count_args['meta_query'] = [['key' => '_wpsg_space_id', 'value' => $space_id, 'type' => 'NUMERIC']];
            }
            $total = wp_count_terms('wpsg_company', $count_args);
            $response->header('X-WPSG-Total', (string) $total);
            $response->header('X-WPSG-Page', (string) $page);
            $response->header('X-WPSG-Per-Page', (string) $per_page);
            return $response;
        }

        $terms_args = [
            'taxonomy' => 'wpsg_company',
            'hide_empty' => false,
            'number' => $per_page,
            'offset' => $offset,
        ];
        if ($space_id > 0) {
            $terms_args['meta_query'] = [['key' => '_wpsg_space_id', 'value' => $space_id, 'type' => 'NUMERIC']];
        }
        $terms = get_terms($terms_args);

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
            update_object_term_cache($campaign_ids, 'wpsg_campaign');
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

        $total_args  = ['hide_empty' => false];
        if ($space_id > 0) {
            $total_args['meta_query'] = [['key' => '_wpsg_space_id', 'value' => $space_id, 'type' => 'NUMERIC']];
        }
        $total       = (int) wp_count_terms('wpsg_company', $total_args);
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


}
