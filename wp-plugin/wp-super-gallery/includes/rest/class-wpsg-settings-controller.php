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
        $denied = self::guard_admin_only_settings($input);
        if (is_wp_error($denied)) {
            return $denied;
        }

        // P67-D: shared global-settings write path (sanitize → merge → audit).
        self::write_global_settings($input, 'replace', true, 'App settings updated: ');

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
        $denied = self::guard_admin_only_settings($input);
        if (is_wp_error($denied)) {
            return $denied;
        }

        // P67-D: shared global-settings write path (patch = only caller-sent keys).
        self::write_global_settings($input, 'patch', true, 'App settings patched: ');

        return new WP_REST_Response(
            WPSG_Settings::to_js(WPSG_Settings::get_settings(), true),
            200
        );
    }

    // P72-C: guard_admin_only_settings() moved to WPSG_REST_Base so the space
    // controller shares the same 403 boundary; the self:: calls above resolve
    // to the inherited method.

}
