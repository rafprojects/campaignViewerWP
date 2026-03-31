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
        foreach ($defaults as $snake => $default) {
            if (!$admin && in_array($snake, $admin_only_fields, true)) {
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
}