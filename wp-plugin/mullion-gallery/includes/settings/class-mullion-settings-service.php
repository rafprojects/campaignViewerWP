<?php
/**
 * Settings support service helpers for Mullion.
 *
 * This extraction keeps non-rendering helper behavior out of the legacy
 * settings class while preserving its public API through delegation.
 *
 * @package Mullion
 */

if (!defined('ABSPATH')) {
    exit;
}

class Mullion_Settings_Service {

    /**
     * Filter helper for auth provider.
     *
     * @param string $default Default value.
     * @return string
     */
    public static function filter_auth_provider($default) {
        return Mullion_Settings::get_setting('auth_provider', $default);
    }

    /**
     * Filter helper for API base.
     *
     * @param string $default Default value.
     * @return string
     */
    public static function filter_api_base($default) {
        $api_base = Mullion_Settings::get_setting('api_base', '');
        return !empty($api_base) ? $api_base : $default;
    }

    /**
     * AJAX handler for testing API reachability/auth configuration.
     *
     * @return void
     */
    public static function ajax_test_auth() {
        check_ajax_referer('mullion_test_auth');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Permission denied.', 'mullion-gallery')]);
        }

        $settings = Mullion_Settings::get_settings();
        $api_base = !empty($settings['api_base']) ? $settings['api_base'] : home_url();
        $test_url = trailingslashit($api_base) . 'wp-json/mullion-gallery/v1/campaigns';

        $response = wp_safe_remote_get($test_url, [
            'timeout'   => 10,
            'sslverify' => apply_filters('https_local_ssl_verify', false),
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error([
                'message' => sprintf(
                    /* translators: %s: WordPress HTTP API error message. */
                    __('Connection failed: %s', 'mullion-gallery'),
                    $response->get_error_message()
                ),
            ]);
        }

        $code = wp_remote_retrieve_response_code($response);

        if ($code === 200) {
            wp_send_json_success([
                'message' => __('API connection successful!', 'mullion-gallery'),
            ]);
        }

        if ($code === 401 || $code === 403) {
            wp_send_json_success([
                'message' => __('API reachable. Authentication required for protected endpoints.', 'mullion-gallery'),
            ]);
        }

        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP response status code. */
                __('Unexpected response: HTTP %d', 'mullion-gallery'),
                $code
            ),
        ]);
    }
}