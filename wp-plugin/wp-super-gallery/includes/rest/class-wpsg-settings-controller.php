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
        $settings = WPSG_Settings::get_settings();
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

}
