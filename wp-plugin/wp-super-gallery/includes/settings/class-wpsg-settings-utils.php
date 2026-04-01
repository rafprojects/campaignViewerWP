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

    private const GALLERY_BREAKPOINTS = ['desktop', 'tablet', 'mobile'];

    private const PER_TYPE_REPRESENTATIVE_SCOPES = ['image', 'video'];

    private const ADAPTER_COLLECTION_SCOPES_PER_TYPE = ['image', 'video', 'unified'];

    private const ADAPTER_COLLECTION_SCOPES_UNIFIED = ['unified', 'image', 'video'];

    private const SCOPE_BACKGROUND_KEYS = [
        'viewportBgType',
        'viewportBgColor',
        'viewportBgGradient',
        'viewportBgImageUrl',
    ];

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

    /**
     * Project nested gallery_config values back onto legacy flat settings.
     *
     * gallery_config remains the canonical persisted representation. This
     * bridge keeps the older flat settings contract readable for PHP callers
     * and REST responses without re-persisting duplicate flat gallery fields.
     *
     * @param array $settings Parsed settings array.
     * @return array
     */
    public static function apply_gallery_config_legacy_bridge($settings) {
        if (!is_array($settings) || !array_key_exists('gallery_config', $settings)) {
            return $settings;
        }

        $config = self::decode_gallery_config($settings['gallery_config']);
        if ($config === null) {
            return $settings;
        }

        foreach (self::collect_legacy_gallery_setting_values($config) as $key => $value) {
            $settings[$key] = $value;
        }

        return $settings;
    }

    /**
     * Decode a nested gallery config payload into an associative array.
     *
     * @param mixed $raw Raw gallery config payload.
     * @return array|null
     */
    private static function decode_gallery_config($raw) {
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        } elseif (is_object($raw)) {
            $raw = json_decode(wp_json_encode($raw), true);
        }

        return is_array($raw) ? $raw : null;
    }

    /**
     * Collect legacy flat settings projected from a nested gallery config.
     *
     * @param array $config Nested gallery config.
     * @return array<string, mixed>
     */
    private static function collect_legacy_gallery_setting_values($config) {
        $mode = (isset($config['mode']) && $config['mode'] === 'unified') ? 'unified' : 'per-type';
        $projected = self::collect_gallery_adapter_setting_values($config, $mode);

        $projected['unified_gallery_enabled'] = ($mode === 'unified');
        $projected['unified_gallery_adapter_id'] = self::get_representative_scope_adapter_id($config, 'unified');
        $projected['gallery_selection_mode'] = $mode === 'per-type' ? 'per-breakpoint' : 'unified';
        $projected['image_gallery_adapter_id'] = self::get_representative_scope_adapter_id($config, 'image');
        $projected['video_gallery_adapter_id'] = self::get_representative_scope_adapter_id($config, 'video');
        $projected['desktop_image_adapter_id'] = self::get_scope_adapter_id($config, 'desktop', 'image');
        $projected['desktop_video_adapter_id'] = self::get_scope_adapter_id($config, 'desktop', 'video');
        $projected['tablet_image_adapter_id'] = self::get_scope_adapter_id($config, 'tablet', 'image');
        $projected['tablet_video_adapter_id'] = self::get_scope_adapter_id($config, 'tablet', 'video');
        $projected['mobile_image_adapter_id'] = self::get_scope_adapter_id($config, 'mobile', 'image');
        $projected['mobile_video_adapter_id'] = self::get_scope_adapter_id($config, 'mobile', 'video');

        foreach (WPSG_Settings_Sanitizer::get_nested_common_field_map() as $nested_key => $flat_key) {
            $value = self::get_representative_gallery_common_setting($config, $nested_key, $mode);
            if ($value !== null) {
                $projected[$flat_key] = $value;
            }
        }

        foreach (['image', 'video', 'unified'] as $scope) {
            $scope_map = WPSG_Settings_Sanitizer::get_nested_common_field_map_for_scope($scope);
            foreach (self::SCOPE_BACKGROUND_KEYS as $nested_key) {
                if (!isset($scope_map[$nested_key])) {
                    continue;
                }

                $value = self::get_scope_gallery_common_setting($config, $scope, $nested_key);
                if ($value !== null) {
                    $projected[$scope_map[$nested_key]] = $value;
                }
            }
        }

        return $projected;
    }

    /**
     * Collect representative adapter-setting values from nested adapter settings.
     *
     * @param array $config Nested gallery config.
     * @param string $mode Effective gallery mode.
     * @return array<string, mixed>
     */
    private static function collect_gallery_adapter_setting_values($config, $mode) {
        $collected = [];
        $scopes = $mode === 'unified'
            ? self::ADAPTER_COLLECTION_SCOPES_UNIFIED
            : self::ADAPTER_COLLECTION_SCOPES_PER_TYPE;
        $adapter_field_map = WPSG_Settings_Sanitizer::get_nested_adapter_field_map();

        foreach (self::GALLERY_BREAKPOINTS as $breakpoint) {
            foreach ($scopes as $scope) {
                $adapter_settings = $config['breakpoints'][$breakpoint][$scope]['adapterSettings'] ?? null;
                if (!is_array($adapter_settings)) {
                    continue;
                }

                foreach ($adapter_field_map as $nested_key => $flat_key) {
                    if (array_key_exists($flat_key, $collected) || !array_key_exists($nested_key, $adapter_settings)) {
                        continue;
                    }

                    $value = $adapter_settings[$nested_key];
                    if (self::is_bridge_scalar($value)) {
                        $collected[$flat_key] = $value;
                    }
                }
            }
        }

        return $collected;
    }

    /**
     * Resolve the first configured adapter id for a scope across breakpoints.
     *
     * @param array $config Nested gallery config.
     * @param string $scope Gallery scope.
     * @return string
     */
    private static function get_representative_scope_adapter_id($config, $scope) {
        foreach (self::GALLERY_BREAKPOINTS as $breakpoint) {
            $adapter_id = self::get_scope_adapter_id($config, $breakpoint, $scope);
            if ($adapter_id !== '') {
                return $adapter_id;
            }
        }

        return '';
    }

    /**
     * Resolve the adapter id for one breakpoint/scope pair.
     *
     * @param array $config Nested gallery config.
     * @param string $breakpoint Breakpoint key.
     * @param string $scope Gallery scope.
     * @return string
     */
    private static function get_scope_adapter_id($config, $breakpoint, $scope) {
        $adapter_id = $config['breakpoints'][$breakpoint][$scope]['adapterId'] ?? '';
        return is_string($adapter_id) ? $adapter_id : '';
    }

    /**
     * Resolve a representative shared common setting from the nested config.
     *
     * @param array $config Nested gallery config.
     * @param string $nested_key Nested common-setting key.
     * @param string $mode Effective gallery mode.
     * @return bool|int|float|string|null
     */
    private static function get_representative_gallery_common_setting($config, $nested_key, $mode) {
        $scopes = $mode === 'unified'
            ? ['unified']
            : self::PER_TYPE_REPRESENTATIVE_SCOPES;

        foreach ($scopes as $scope) {
            foreach (self::GALLERY_BREAKPOINTS as $breakpoint) {
                $value = $config['breakpoints'][$breakpoint][$scope]['common'][$nested_key] ?? null;
                if (self::is_bridge_scalar($value)) {
                    return $value;
                }
            }
        }

        return null;
    }

    /**
     * Resolve the first configured background value for one scope.
     *
     * @param array $config Nested gallery config.
     * @param string $scope Gallery scope.
     * @param string $nested_key Nested background key.
     * @return string|null
     */
    private static function get_scope_gallery_common_setting($config, $scope, $nested_key) {
        foreach (self::GALLERY_BREAKPOINTS as $breakpoint) {
            $value = $config['breakpoints'][$breakpoint][$scope]['common'][$nested_key] ?? null;
            if (is_string($value)) {
                return $value;
            }
        }

        return null;
    }

    /**
     * Determine whether a value can be mirrored onto a flat legacy setting.
     *
     * @param mixed $value Candidate value.
     * @return bool
     */
    private static function is_bridge_scalar($value) {
        return is_string($value) || is_int($value) || is_float($value) || is_bool($value);
    }
}