<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Space_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        register_rest_route('wp-super-gallery/v1', '/spaces', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_spaces'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_space'],
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
                    'isolation_mode' => [
                        'type'    => 'string',
                        'enum'    => ['open', 'delegated'],
                        'default' => 'open',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/spaces/(?P<id>\d+)', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_space_item'],
                'permission_callback' => [self::class, 'require_space_member'],
            ],
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_space'],
                'permission_callback' => [self::class, 'require_space_owner'],
                'args'                => [
                    'name' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'isolation_mode' => [
                        'type' => 'string',
                        'enum' => ['open', 'delegated'],
                    ],
                ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_space_item'],
                'permission_callback' => [self::class, 'require_space_owner'],
                'args'                => [
                    'force' => [
                        'type'    => 'boolean',
                        'default' => false,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/spaces/(?P<id>\d+)/access', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_access'],
                'permission_callback' => [self::class, 'require_space_owner'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'grant_access'],
                'permission_callback' => [self::class, 'require_space_owner'],
                'args'                => [
                    'userId' => [
                        'required' => true,
                        'type'     => 'integer',
                        'minimum'  => 1,
                    ],
                    'access_level' => [
                        'type'    => 'string',
                        'enum'    => ['viewer', 'editor', 'owner'],
                        'default' => 'viewer',
                    ],
                    'expires_at' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/spaces/(?P<id>\d+)/access/(?P<userId>\d+)', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'revoke_access'],
                'permission_callback' => [self::class, 'require_space_owner'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/spaces/(?P<id>\d+)/settings', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'get_space_settings'],
                'permission_callback' => [self::class, 'require_space_member'],
            ],
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_space_settings'],
                'permission_callback' => [self::class, 'require_space_owner'],
            ],
        ]);
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    public static function list_spaces($request) {
        $include_archived = filter_var($request->get_param('include_archived'), FILTER_VALIDATE_BOOLEAN);
        $cv        = self::get_cache_version();
        $user_id   = get_current_user_id();
        $cache_key = 'wpsg_spaces_v' . $cv . '_' . $user_id . '_' . ($include_archived ? 'all' : 'active');
        $cached    = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            return new WP_REST_Response($cached, 200);
        }

        $spaces   = WPSG_DB::list_spaces($include_archived ? [] : ['archived' => 0]);
        $default_id = intval(get_option('wpsg_default_space_id', 0));
        $items    = array_map(function ($space) use ($default_id) {
            return self::format_space($space, $default_id);
        }, $spaces);

        $ttl = max(60, intval(apply_filters('wpsg_cache_ttl', 300)));
        set_transient($cache_key, $items, $ttl);
        return new WP_REST_Response($items, 200);
    }

    public static function create_space($request) {
        $name = sanitize_text_field($request->get_param('name'));
        if ($name === '') {
            return new WP_Error('wpsg_invalid_name', 'Space name is required', ['status' => 400]);
        }

        $slug_raw = sanitize_text_field($request->get_param('slug') ?? '');
        $slug     = $slug_raw !== '' ? sanitize_title($slug_raw) : sanitize_title($name);
        $iso_mode = sanitize_text_field($request->get_param('isolation_mode') ?: 'open');

        $id = WPSG_DB::insert_space([
            'name'           => $name,
            'slug'           => $slug,
            'isolation_mode' => $iso_mode,
        ]);

        if (!$id) {
            return new WP_Error('wpsg_create_failed', 'Failed to create space', ['status' => 500]);
        }

        self::add_audit_entry(0, 'space.created', ['spaceName' => $name, 'isolationMode' => $iso_mode], [
            'scope'          => 'system',
            'summary'        => "Space created: {$name}",
            'resource_type'  => 'space',
            'resource_id'    => (string) $id,
            'resource_label' => $name,
        ]);
        self::bump_cache_version();

        $space = WPSG_DB::get_space($id);
        $default_id = intval(get_option('wpsg_default_space_id', 0));
        return new WP_REST_Response(self::format_space($space, $default_id), 201);
    }

    public static function get_space_item($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }
        $default_id = intval(get_option('wpsg_default_space_id', 0));
        return new WP_REST_Response(self::format_space($space, $default_id, true), 200);
    }

    public static function update_space($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }

        $data = [];
        $name = $request->get_param('name');
        if ($name !== null) {
            $data['name'] = sanitize_text_field($name);
        }
        $iso_mode = $request->get_param('isolation_mode');
        if ($iso_mode !== null) {
            $data['isolation_mode'] = sanitize_text_field($iso_mode);
        }

        if (!empty($data)) {
            WPSG_DB::update_space($space_id, $data);
            self::add_audit_entry(0, 'space.updated', $data, [
                'scope'          => 'system',
                'summary'        => "Space updated: {$space->name}",
                'resource_type'  => 'space',
                'resource_id'    => (string) $space_id,
                'resource_label' => $space->name,
            ]);
            self::bump_cache_version();
        }

        $updated    = WPSG_DB::get_space($space_id);
        $default_id = intval(get_option('wpsg_default_space_id', 0));
        return new WP_REST_Response(self::format_space($updated, $default_id), 200);
    }

    public static function delete_space_item($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }

        $default_id = intval(get_option('wpsg_default_space_id', 0));
        if ($space_id === $default_id) {
            return new WP_Error('wpsg_cannot_delete_default', 'The Default Space cannot be deleted', ['status' => 400]);
        }

        $has_campaigns = !empty(get_posts([
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'any',
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'meta_query'     => [['key' => '_wpsg_space_id', 'value' => $space_id]],
        ]));

        $force = filter_var($request->get_param('force'), FILTER_VALIDATE_BOOLEAN);

        if ($has_campaigns && $force) {
            return new WP_Error('wpsg_space_has_campaigns', 'Cannot hard-delete a space with campaigns; move or delete campaigns first', ['status' => 400]);
        }

        if ($force && !$has_campaigns) {
            WPSG_DB::delete_space($space_id);
            $action = 'space.deleted';
            $msg    = "Space deleted: {$space->name}";
        } else {
            WPSG_DB::archive_space($space_id);
            $action = 'space.archived';
            $msg    = "Space archived: {$space->name}";
        }

        self::add_audit_entry(0, $action, [], [
            'scope'          => 'system',
            'summary'        => $msg,
            'resource_type'  => 'space',
            'resource_id'    => (string) $space_id,
            'resource_label' => $space->name,
        ]);
        self::bump_cache_version();

        return new WP_REST_Response(['deleted' => true, 'archived' => !($force && !$has_campaigns)], 200);
    }

    // ── Space access grant management ─────────────────────────────────────────

    public static function list_access($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }

        $grants = json_decode($space->access_grants, true);
        $grants = is_array($grants) ? $grants : [];

        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total      = count($grants);
        $page_items = array_slice($grants, $offset, $per_page);

        $user_ids = array_unique(array_map(fn($g) => intval($g['userId'] ?? 0), $page_items));
        $user_map = [];
        if (!empty($user_ids)) {
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'user_email', 'display_name', 'user_login']]);
            foreach ($users as $user) {
                $user_map[$user->ID] = [
                    'displayName' => $user->display_name,
                    'email'       => $user->user_email,
                    'login'       => $user->user_login,
                ];
            }
        }

        $now      = time();
        $enriched = array_map(function ($grant) use ($user_map, $now) {
            $uid = intval($grant['userId'] ?? 0);
            if (isset($user_map[$uid])) {
                $grant['user'] = $user_map[$uid];
            }
            $grant['access_level'] = self::validate_access_level($grant['access_level'] ?? 'viewer');
            $expires_at            = $grant['expires_at'] ?? null;
            $grant['expires_at']   = $expires_at;
            $grant['is_expired']   = $expires_at !== null && strtotime($expires_at) < $now;
            return $grant;
        }, $page_items);

        return self::paginated_response($enriched, $total, $page, $per_page);
    }

    public static function grant_access($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }

        $user_id = intval($request->get_param('userId'));
        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }
        if (!get_userdata($user_id)) {
            return new WP_Error('wpsg_user_not_found', 'User not found', ['status' => 404]);
        }

        $expires_at = null;
        $expires_raw = $request->get_param('expires_at');
        if ($expires_raw !== null && $expires_raw !== '') {
            $ts = strtotime(sanitize_text_field($expires_raw));
            if ($ts === false) {
                return new WP_Error('wpsg_invalid_expires_at', 'expires_at must be a valid ISO 8601 datetime', ['status' => 400]);
            }
            $expires_at = gmdate('c', $ts);
        }

        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');

        $grants  = json_decode($space->access_grants, true);
        $grants  = is_array($grants) ? $grants : [];
        $grants  = self::upsert_space_grant($grants, [
            'userId'       => $user_id,
            'access_level' => $access_level,
            'grantedAt'    => gmdate('c'),
            'expires_at'   => $expires_at,
        ]);

        WPSG_DB::update_space($space_id, ['access_grants' => $grants]);
        self::add_audit_entry(0, 'space.access.granted', ['userId' => $user_id, 'accessLevel' => $access_level], [
            'scope'          => 'system',
            'summary'        => "Space access granted for user {$user_id}",
            'resource_type'  => 'space',
            'resource_id'    => (string) $space_id,
            'resource_label' => $space->name,
        ]);
        self::bump_cache_version();
        self::clear_accessible_campaigns_cache();

        return new WP_REST_Response(['message' => 'Access granted'], 200);
    }

    public static function revoke_access($request) {
        $space_id = intval($request->get_param('id'));
        $user_id  = intval($request->get_param('userId'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space || $user_id <= 0) {
            return new WP_Error('wpsg_invalid_request', 'Invalid request', ['status' => 400]);
        }

        $grants = json_decode($space->access_grants, true);
        $grants = is_array($grants) ? $grants : [];
        $grants = array_values(array_filter($grants, fn($g) => intval($g['userId'] ?? 0) !== $user_id));

        WPSG_DB::update_space($space_id, ['access_grants' => $grants]);
        self::add_audit_entry(0, 'space.access.revoked', ['userId' => $user_id], [
            'scope'          => 'system',
            'summary'        => "Space access revoked for user {$user_id}",
            'resource_type'  => 'space',
            'resource_id'    => (string) $space_id,
            'resource_label' => $space->name,
        ]);
        self::bump_cache_version();
        self::clear_accessible_campaigns_cache();

        return new WP_REST_Response(['message' => 'Access revoked'], 200);
    }

    // ── Space settings ────────────────────────────────────────────────────────

    public static function get_space_settings($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }

        $effective = WPSG_Settings::get_effective_settings($space_id);
        $overrides = json_decode($space->settings_overrides, true);

        return new WP_REST_Response([
            'settings'  => WPSG_Settings::to_js($effective, true),
            'overrides' => is_array($overrides) ? $overrides : [],
        ], 200);
    }

    public static function update_space_settings($request) {
        $space_id = intval($request->get_param('id'));
        $space    = WPSG_DB::get_space($space_id);
        if (!$space) {
            return new WP_Error('wpsg_space_not_found', 'Space not found', ['status' => 404]);
        }

        $body        = $request->get_json_params() ?? [];
        $snake_input = WPSG_Settings::from_js($body);
        $allowed     = array_flip(WPSG_Settings::get_overridable_keys());
        $to_set      = array_intersect_key($snake_input, $allowed);

        $to_clear  = array_keys(array_filter($to_set, fn($v) => $v === null));
        $to_update = array_filter($to_set, fn($v) => $v !== null);

        $override_patch = [];
        if (!empty($to_update)) {
            $override_patch = WPSG_Settings::sanitize_overrides($to_update);
        }

        $existing      = json_decode($space->settings_overrides, true);
        $existing      = is_array($existing) ? $existing : [];
        $new_overrides = array_merge($existing, $override_patch);
        foreach ($to_clear as $key) {
            unset($new_overrides[$key]);
        }

        WPSG_DB::update_space($space_id, ['settings_overrides' => $new_overrides]);
        self::add_audit_entry(0, 'space.settings.updated',
            ['keys' => array_keys($override_patch), 'cleared' => $to_clear],
            [
                'scope'          => 'system',
                'summary'        => "Space settings updated: {$space->name}",
                'resource_type'  => 'space',
                'resource_id'    => (string) $space_id,
                'resource_label' => $space->name,
            ]
        );
        self::bump_cache_version();

        $updated_space = WPSG_DB::get_space($space_id);
        $effective     = WPSG_Settings::get_effective_settings($space_id);
        $raw_overrides = json_decode($updated_space->settings_overrides, true);

        return new WP_REST_Response([
            'settings'  => WPSG_Settings::to_js($effective, true),
            'overrides' => is_array($raw_overrides) ? $raw_overrides : [],
        ], 200);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static function format_space(object $space, int $default_id, bool $include_grants = false): array {
        $grants = json_decode($space->access_grants, true);
        $grants = is_array($grants) ? $grants : [];
        $out = [
            'id'            => intval($space->id),
            'slug'          => $space->slug,
            'name'          => $space->name,
            'isolationMode' => $space->isolation_mode,
            'isDefault'     => intval($space->id) === $default_id,
            'archived'      => (bool) $space->archived,
            'grantCount'    => count($grants),
            'createdAt'     => $space->created_at,
            'updatedAt'     => $space->updated_at,
        ];
        if ($include_grants) {
            $out['grants'] = $grants;
        }
        return $out;
    }

    private static function upsert_space_grant(array $grants, array $entry): array {
        $user_id  = intval($entry['userId']);
        $filtered = array_filter($grants, fn($g) => intval($g['userId'] ?? 0) !== $user_id);
        $filtered[] = $entry;
        return array_values($filtered);
    }
}
