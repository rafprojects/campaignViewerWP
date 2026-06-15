<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Settings_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // Public endpoint to get display settings (no auth required for frontend).
        // POST requires admin permission to update settings.
        register_rest_route('wp-super-gallery/v1', '/settings', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_public_settings'],
                'permission_callback' => WPSG_Permissions::gate('settings.read_public'),
                'args' => [
                    // P47-J: optional space scoping — returns effective settings (global merged with space overrides).
                    'space' => [
                        'type'    => 'string',
                        'default' => '',
                    ],
                ],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'update_settings'],
                'permission_callback' => WPSG_Permissions::gate('settings.update'),
            ],
            [
                'methods' => 'PATCH',
                'callback' => [self::class, 'patch_settings'],
                'permission_callback' => WPSG_Permissions::gate('settings.patch'),
            ],
        ]);
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
        if (!class_exists('WPSG_Settings')) {
            return self::respond_with_etag($request, []);
        }
        // P47-J: when a space ID is provided, merge space overrides over global defaults.
        $space_param = $request ? sanitize_text_field($request->get_param('space') ?? '') : '';
        $space_id    = (is_numeric($space_param) && intval($space_param) > 0) ? intval($space_param) : 0;
        $settings    = $space_id > 0
            ? WPSG_Settings::get_effective_settings($space_id)
            : WPSG_Settings::get_settings();
        $is_admin = current_user_can('manage_wpsg');
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
        $body      = $request->get_json_params() ?: [];
        $input     = WPSG_Settings::from_js($body);

        // P52-A4: system-level keys require manage_options; editors may write
        // display/campaign keys only.
        $denied = self::guard_admin_only_settings(array_keys($input));
        if (is_wp_error($denied)) {
            return $denied;
        }

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

        // P52-A4: system-level keys require manage_options; editors may write
        // display/campaign keys only.
        $denied = self::guard_admin_only_settings(array_keys($input));
        if (is_wp_error($denied)) {
            return $denied;
        }

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
     * P52-A4: enforce the system-vs-display settings boundary.
     *
     * Writing settings requires manage_wpsg (the route gate). Writing any
     * *system-level* key (the registry's $admin_only_fields — cache, uploads,
     * auth provider, retention, etc.) additionally requires manage_options.
     * A space editor (manage_wpsg only) may write display/campaign keys but
     * not system ones.
     *
     * @param string[] $requested_keys snake_case keys the caller is writing.
     * @return WP_Error|null WP_Error (403) if a system key is written without
     *                       manage_options; null when the write is permitted.
     */
    private static function guard_admin_only_settings(array $requested_keys) {
        if (current_user_can('manage_options')) {
            return null;
        }

        $admin_only = WPSG_Settings_Registry::get_admin_only_fields();
        $blocked    = array_values(array_intersect($requested_keys, $admin_only));

        if (!empty($blocked)) {
            return new WP_Error(
                'wpsg_forbidden_settings',
                'These settings require a System Administrator (manage_options): ' . implode(', ', $blocked),
                ['status' => 403, 'fields' => $blocked]
            );
        }

        return null;
    }

}
