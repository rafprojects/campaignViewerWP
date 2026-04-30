<?php
/**
 * Settings utility helpers for WP Super Gallery.
 *
 * This is the first extraction from the legacy monolithic settings class.
 * It centralizes the snake_case <-> camelCase conversion helpers and REST
 * payload shaping so later decomposition can move more logic out safely.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Settings_Utils {

    /**
     * Return the nested-only gallery keys omitted from the public settings contract.
     *
     * @return string[]
     */
    private static function get_nested_only_legacy_gallery_setting_keys() {
        return WPSG_Settings_Sanitizer::get_nested_only_gallery_setting_keys();
    }

    /**
     * Determine whether a flat key is omitted when nested gallery_config exists.
     *
     * @param string $key Flat settings key.
     * @return bool
     */
    private static function is_nested_only_legacy_gallery_setting_key($key) {
        static $nested_only_legacy_gallery_setting_keys = null;

        if ($nested_only_legacy_gallery_setting_keys === null) {
            $nested_only_legacy_gallery_setting_keys = array_fill_keys(
                self::get_nested_only_legacy_gallery_setting_keys(),
                true
            );
        }

        return isset($nested_only_legacy_gallery_setting_keys[$key]);
    }

    /**
     * Convert a snake_case key to camelCase.
     *
     * @param string $key Snake-case key.
     * @return string
     */
    public static function snake_to_camel($key) {
        return lcfirst(str_replace('_', '', ucwords($key, '_')));
    }

    /**
     * Convert stored PHP settings to a camelCase JS-ready array.
     *
     * @param array $settings Snake-case settings.
     * @param array $defaults Registered defaults.
     * @param array $admin_only_fields Fields hidden from non-admin users.
     * @param bool  $admin Whether to include admin-only fields.
     * @return array
     */
    public static function to_js($settings, $defaults, $admin_only_fields = [], $admin = false) {
        $result = [];
        $omit_nested_only_gallery_fields = array_key_exists('gallery_config', $defaults);
        foreach ($defaults as $snake => $default) {
            if (!$admin && in_array($snake, $admin_only_fields, true)) {
                continue;
            }

            if (
                $omit_nested_only_gallery_fields
                && self::is_nested_only_legacy_gallery_setting_key($snake)
            ) {
                continue;
            }

            $val = $settings[$snake] ?? $default;
            if ($snake === 'viewer_bg_gradient' && is_array($val) && empty($val)) {
                $val = (object) [];
            }

            $result[self::snake_to_camel($snake)] = $val;
        }

        return $result;
    }

    /**
     * Convert a camelCase JS request body to snake_case input.
     *
     * @param array $body Decoded JSON request body.
     * @param array $defaults Registered defaults.
     * @return array
     */
    public static function from_js($body, $defaults) {
        $input = [];
        foreach ($defaults as $snake => $default) {
            $camel = self::snake_to_camel($snake);
            if (array_key_exists($camel, $body)) {
                $input[$snake] = $body[$camel];
            }
        }

        return $input;
    }

    /**
        * Remove nested-only flat gallery fields from the outward settings shape.
     *
     * @param array $settings Parsed settings array.
     * @return array
     */
    public static function strip_nested_only_gallery_legacy_fields($settings) {
        if (!is_array($settings) || !array_key_exists('gallery_config', $settings)) {
            return $settings;
        }

        foreach (self::get_nested_only_legacy_gallery_setting_keys() as $key) {
            unset($settings[$key]);
        }

        return $settings;
    }
}