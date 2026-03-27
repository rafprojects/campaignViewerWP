<?php
/**
 * Settings sanitization helpers for WP Super Gallery.
 *
 * Keeps the legacy settings facade thin while preserving the existing
 * sanitization behavior and compatibility rules.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Settings_Sanitizer {

    /**
     * Sanitize settings before saving.
     *
     * @param array $input Raw input array.
     * @param array $defaults Registered defaults.
     * @param array $valid_options Registered valid options.
     * @param array $field_ranges Registered numeric ranges.
     * @return array Sanitized settings.
     */
    public static function sanitize_settings($input, $defaults, $valid_options, $field_ranges) {
        $sanitized = [];

        if (isset($input['auth_provider'])) {
            $sanitized['auth_provider'] = in_array($input['auth_provider'], $valid_options['auth_provider'], true)
                ? $input['auth_provider']
                : $defaults['auth_provider'];
        }

        if (isset($input['api_base'])) {
            $sanitized['api_base'] = esc_url_raw(trim($input['api_base']));
        }

        if (isset($input['theme'])) {
            $sanitized['theme'] = in_array($input['theme'], $valid_options['theme'], true)
                ? $input['theme']
                : $defaults['theme'];
        }

        if (isset($input['gallery_layout'])) {
            $sanitized['gallery_layout'] = in_array($input['gallery_layout'], $valid_options['gallery_layout'], true)
                ? $input['gallery_layout']
                : $defaults['gallery_layout'];
        }

        if (isset($input['items_per_page'])) {
            $items = intval($input['items_per_page']);
            $sanitized['items_per_page'] = max(1, min(100, $items));
        }

        if (isset($input['video_viewport_height'])) {
            $height = intval($input['video_viewport_height']);
            $sanitized['video_viewport_height'] = max(180, min(900, $height));
        }

        if (isset($input['image_viewport_height'])) {
            $height = intval($input['image_viewport_height']);
            $sanitized['image_viewport_height'] = max(180, min(900, $height));
        }

        if (isset($input['gallery_manual_height'])) {
            $height = sanitize_text_field((string) $input['gallery_manual_height']);
            $height = trim($height);
            if (preg_match('/^\d+(?:\.\d+)?\s*(px|em|rem|vh|dvh|svh|lvh|vw|%)$/i', $height)) {
                $sanitized['gallery_manual_height'] = $height;
            } else {
                $sanitized['gallery_manual_height'] = $defaults['gallery_manual_height'];
            }
        }

        if (isset($input['thumbnail_scroll_speed'])) {
            $speed = floatval($input['thumbnail_scroll_speed']);
            $sanitized['thumbnail_scroll_speed'] = max(0.25, min(3, $speed));
        }

        if (isset($input['scroll_animation_style'])) {
            $sanitized['scroll_animation_style'] = in_array($input['scroll_animation_style'], $valid_options['scroll_animation_style'], true)
                ? $input['scroll_animation_style']
                : $defaults['scroll_animation_style'];
        }

        if (isset($input['scroll_animation_duration_ms'])) {
            $duration = intval($input['scroll_animation_duration_ms']);
            $sanitized['scroll_animation_duration_ms'] = max(0, min(2000, $duration));
        }

        if (isset($input['scroll_animation_easing'])) {
            $sanitized['scroll_animation_easing'] = in_array($input['scroll_animation_easing'], $valid_options['scroll_animation_easing'], true)
                ? $input['scroll_animation_easing']
                : $defaults['scroll_animation_easing'];
        }

        if (isset($input['scroll_transition_type'])) {
            $sanitized['scroll_transition_type'] = in_array($input['scroll_transition_type'], $valid_options['scroll_transition_type'], true)
                ? $input['scroll_transition_type']
                : $defaults['scroll_transition_type'];
        }

        if (isset($input['image_border_radius'])) {
            $radius = intval($input['image_border_radius']);
            $sanitized['image_border_radius'] = max(0, min(48, $radius));
        }

        if (isset($input['video_border_radius'])) {
            $radius = intval($input['video_border_radius']);
            $sanitized['video_border_radius'] = max(0, min(48, $radius));
        }

        if (isset($input['transition_fade_enabled'])) {
            $sanitized['transition_fade_enabled'] = (bool) $input['transition_fade_enabled'];
        }

        if (isset($input['video_thumbnail_width'])) {
            $sanitized['video_thumbnail_width'] = max(30, min(200, intval($input['video_thumbnail_width'])));
        }
        if (isset($input['video_thumbnail_height'])) {
            $sanitized['video_thumbnail_height'] = max(30, min(200, intval($input['video_thumbnail_height'])));
        }
        if (isset($input['image_thumbnail_width'])) {
            $sanitized['image_thumbnail_width'] = max(30, min(200, intval($input['image_thumbnail_width'])));
        }
        if (isset($input['image_thumbnail_height'])) {
            $sanitized['image_thumbnail_height'] = max(30, min(200, intval($input['image_thumbnail_height'])));
        }
        if (isset($input['thumbnail_gap'])) {
            $sanitized['thumbnail_gap'] = max(0, min(24, intval($input['thumbnail_gap'])));
        }
        if (isset($input['thumbnail_wheel_scroll_enabled'])) {
            $sanitized['thumbnail_wheel_scroll_enabled'] = (bool) $input['thumbnail_wheel_scroll_enabled'];
        }
        if (isset($input['thumbnail_drag_scroll_enabled'])) {
            $sanitized['thumbnail_drag_scroll_enabled'] = (bool) $input['thumbnail_drag_scroll_enabled'];
        }
        if (isset($input['thumbnail_scroll_buttons_visible'])) {
            $sanitized['thumbnail_scroll_buttons_visible'] = (bool) $input['thumbnail_scroll_buttons_visible'];
        }

        if (isset($input['nav_arrow_position'])) {
            $sanitized['nav_arrow_position'] = in_array($input['nav_arrow_position'], $valid_options['nav_arrow_position'], true)
                ? $input['nav_arrow_position']
                : $defaults['nav_arrow_position'];
        }
        if (isset($input['nav_arrow_size'])) {
            $sanitized['nav_arrow_size'] = max(20, min(64, intval($input['nav_arrow_size'])));
        }
        if (isset($input['nav_arrow_color'])) {
            $sanitized['nav_arrow_color'] = sanitize_text_field($input['nav_arrow_color']);
        }
        if (isset($input['nav_arrow_bg_color'])) {
            $sanitized['nav_arrow_bg_color'] = sanitize_text_field($input['nav_arrow_bg_color']);
        }
        if (isset($input['nav_arrow_border_width'])) {
            $sanitized['nav_arrow_border_width'] = max(0, min(6, intval($input['nav_arrow_border_width'])));
        }
        if (isset($input['nav_arrow_hover_scale'])) {
            $sanitized['nav_arrow_hover_scale'] = max(1.0, min(1.5, floatval($input['nav_arrow_hover_scale'])));
        }
        if (isset($input['nav_arrow_auto_hide_ms'])) {
            $sanitized['nav_arrow_auto_hide_ms'] = max(0, min(10000, intval($input['nav_arrow_auto_hide_ms'])));
        }

        if (isset($input['dot_nav_enabled'])) {
            $sanitized['dot_nav_enabled'] = (bool) $input['dot_nav_enabled'];
        }
        if (isset($input['dot_nav_position'])) {
            $sanitized['dot_nav_position'] = in_array($input['dot_nav_position'], $valid_options['dot_nav_position'], true)
                ? $input['dot_nav_position']
                : $defaults['dot_nav_position'];
        }
        if (isset($input['dot_nav_size'])) {
            $sanitized['dot_nav_size'] = max(4, min(24, intval($input['dot_nav_size'])));
        }
        if (isset($input['dot_nav_active_color'])) {
            $sanitized['dot_nav_active_color'] = sanitize_text_field($input['dot_nav_active_color']);
        }
        if (isset($input['dot_nav_inactive_color'])) {
            $sanitized['dot_nav_inactive_color'] = sanitize_text_field($input['dot_nav_inactive_color']);
        }
        if (isset($input['dot_nav_shape'])) {
            $sanitized['dot_nav_shape'] = in_array($input['dot_nav_shape'], $valid_options['dot_nav_shape'], true)
                ? $input['dot_nav_shape']
                : $defaults['dot_nav_shape'];
        }
        if (isset($input['dot_nav_spacing'])) {
            $sanitized['dot_nav_spacing'] = max(2, min(20, intval($input['dot_nav_spacing'])));
        }
        if (isset($input['dot_nav_active_scale'])) {
            $sanitized['dot_nav_active_scale'] = max(1.0, min(2.0, floatval($input['dot_nav_active_scale'])));
        }

        if (isset($input['image_shadow_preset'])) {
            $sanitized['image_shadow_preset'] = in_array($input['image_shadow_preset'], $valid_options['image_shadow_preset'], true)
                ? $input['image_shadow_preset']
                : $defaults['image_shadow_preset'];
        }
        if (isset($input['video_shadow_preset'])) {
            $sanitized['video_shadow_preset'] = in_array($input['video_shadow_preset'], $valid_options['video_shadow_preset'], true)
                ? $input['video_shadow_preset']
                : $defaults['video_shadow_preset'];
        }
        if (isset($input['image_shadow_custom'])) {
            $sanitized['image_shadow_custom'] = sanitize_text_field($input['image_shadow_custom']);
        }
        if (isset($input['video_shadow_custom'])) {
            $sanitized['video_shadow_custom'] = sanitize_text_field($input['video_shadow_custom']);
        }

        $valid_adapters = class_exists('WPSG_CPT') ? WPSG_CPT::VALID_ADAPTERS
            : ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'];
        if (isset($input['image_gallery_adapter_id'])) {
            $sanitized['image_gallery_adapter_id'] = in_array($input['image_gallery_adapter_id'], $valid_adapters, true)
                ? $input['image_gallery_adapter_id']
                : 'classic';
        }
        if (isset($input['video_gallery_adapter_id'])) {
            $sanitized['video_gallery_adapter_id'] = in_array($input['video_gallery_adapter_id'], $valid_adapters, true)
                ? $input['video_gallery_adapter_id']
                : 'classic';
        }
        if (isset($input['unified_gallery_enabled'])) {
            $sanitized['unified_gallery_enabled'] = (bool) $input['unified_gallery_enabled'];
        }
        if (isset($input['unified_gallery_adapter_id'])) {
            $sanitized['unified_gallery_adapter_id'] = in_array($input['unified_gallery_adapter_id'], $valid_adapters, true)
                ? $input['unified_gallery_adapter_id']
                : 'compact-grid';
        }
        if (isset($input['gallery_selection_mode'])) {
            $sanitized['gallery_selection_mode'] = in_array($input['gallery_selection_mode'], ['unified', 'per-breakpoint'], true)
                ? $input['gallery_selection_mode']
                : 'unified';
        }
        $bp_adapter_fields = [
            'desktop_image_adapter_id', 'desktop_video_adapter_id',
            'tablet_image_adapter_id',  'tablet_video_adapter_id',
            'mobile_image_adapter_id',  'mobile_video_adapter_id',
        ];
        foreach ($bp_adapter_fields as $field) {
            if (isset($input[$field])) {
                $sanitized[$field] = in_array($input[$field], $valid_adapters, true)
                    ? $input[$field]
                    : 'classic';
            }
        }
        if (isset($input['layout_builder_scope'])) {
            $sanitized['layout_builder_scope'] = in_array($input['layout_builder_scope'], ['full', 'viewport'], true)
                ? $input['layout_builder_scope']
                : 'full';
        }
        if (isset($input['mosaic_target_row_height'])) {
            $sanitized['mosaic_target_row_height'] = max(60, min(600, intval($input['mosaic_target_row_height'])));
        }
        if (isset($input['grid_card_width'])) {
            $sanitized['grid_card_width'] = max(80, min(400, intval($input['grid_card_width'])));
        }
        if (isset($input['grid_card_height'])) {
            $sanitized['grid_card_height'] = max(80, min(600, intval($input['grid_card_height'])));
        }
        if (isset($input['tile_size'])) {
            $sanitized['tile_size'] = max(60, min(400, intval($input['tile_size'])));
        }
        if (isset($input['tile_gap_x'])) {
            $sanitized['tile_gap_x'] = max(0, min(60, intval($input['tile_gap_x'])));
        }
        if (isset($input['tile_gap_y'])) {
            $sanitized['tile_gap_y'] = max(0, min(60, intval($input['tile_gap_y'])));
        }
        if (isset($input['tile_border_width'])) {
            $sanitized['tile_border_width'] = max(0, min(20, intval($input['tile_border_width'])));
        }
        if (isset($input['tile_border_color'])) {
            $sanitized['tile_border_color'] = sanitize_hex_color($input['tile_border_color']) ?: '#ffffff';
        }
        if (isset($input['tile_glow_enabled'])) {
            $sanitized['tile_glow_enabled'] = (bool) $input['tile_glow_enabled'];
        }
        if (isset($input['tile_glow_color'])) {
            $sanitized['tile_glow_color'] = sanitize_hex_color($input['tile_glow_color']) ?: '#7c9ef8';
        }
        if (isset($input['tile_glow_spread'])) {
            $sanitized['tile_glow_spread'] = max(2, min(60, intval($input['tile_glow_spread'])));
        }
        if (isset($input['tile_hover_bounce'])) {
            $sanitized['tile_hover_bounce'] = (bool) $input['tile_hover_bounce'];
        }
        if (isset($input['masonry_columns'])) {
            $sanitized['masonry_columns'] = max(0, min(8, intval($input['masonry_columns'])));
        }

        $allowed_bg_types = ['none', 'solid', 'gradient', 'image'];
        if (isset($input['image_bg_type'])) { $sanitized['image_bg_type'] = in_array($input['image_bg_type'], $allowed_bg_types, true) ? $input['image_bg_type'] : 'none'; }
        if (isset($input['image_bg_color'])) { $sanitized['image_bg_color'] = sanitize_text_field($input['image_bg_color']); }
        if (isset($input['image_bg_gradient'])) { $sanitized['image_bg_gradient'] = sanitize_text_field($input['image_bg_gradient']); }
        if (isset($input['image_bg_image_url'])) { $sanitized['image_bg_image_url'] = esc_url_raw($input['image_bg_image_url']); }
        if (isset($input['video_bg_type'])) { $sanitized['video_bg_type'] = in_array($input['video_bg_type'], $allowed_bg_types, true) ? $input['video_bg_type'] : 'none'; }
        if (isset($input['video_bg_color'])) { $sanitized['video_bg_color'] = sanitize_text_field($input['video_bg_color']); }
        if (isset($input['video_bg_gradient'])) { $sanitized['video_bg_gradient'] = sanitize_text_field($input['video_bg_gradient']); }
        if (isset($input['video_bg_image_url'])) { $sanitized['video_bg_image_url'] = esc_url_raw($input['video_bg_image_url']); }
        if (isset($input['unified_bg_type'])) { $sanitized['unified_bg_type'] = in_array($input['unified_bg_type'], $allowed_bg_types, true) ? $input['unified_bg_type'] : 'none'; }
        if (isset($input['unified_bg_color'])) { $sanitized['unified_bg_color'] = sanitize_text_field($input['unified_bg_color']); }
        if (isset($input['unified_bg_gradient'])) { $sanitized['unified_bg_gradient'] = sanitize_text_field($input['unified_bg_gradient']); }
        if (isset($input['unified_bg_image_url'])) { $sanitized['unified_bg_image_url'] = esc_url_raw($input['unified_bg_image_url']); }

        if (isset($input['card_border_radius'])) {
            $sanitized['card_border_radius'] = max(0, min(24, intval($input['card_border_radius'])));
        }
        if (isset($input['card_border_width'])) {
            $sanitized['card_border_width'] = max(0, min(8, intval($input['card_border_width'])));
        }
        if (isset($input['card_border_mode']) && in_array($input['card_border_mode'], $valid_options['card_border_mode'], true)) {
            $sanitized['card_border_mode'] = $input['card_border_mode'];
        }
        if (isset($input['card_border_color'])) {
            $sanitized['card_border_color'] = sanitize_hex_color($input['card_border_color']) ?: '#228be6';
        }
        if (isset($input['card_shadow_preset']) && in_array($input['card_shadow_preset'], $valid_options['card_shadow_preset'], true)) {
            $sanitized['card_shadow_preset'] = $input['card_shadow_preset'];
        }
        if (isset($input['card_thumbnail_height'])) {
            $sanitized['card_thumbnail_height'] = max(100, min(400, intval($input['card_thumbnail_height'])));
        }
        if (isset($input['card_thumbnail_fit']) && in_array($input['card_thumbnail_fit'], $valid_options['card_thumbnail_fit'], true)) {
            $sanitized['card_thumbnail_fit'] = $input['card_thumbnail_fit'];
        }
        if (isset($input['card_grid_columns'])) {
            $sanitized['card_grid_columns'] = max(0, min(6, intval($input['card_grid_columns'])));
        }
        if (isset($input['card_gap_h'])) {
            $sanitized['card_gap_h'] = max(0, min(48, intval($input['card_gap_h'])));
        }
        if (isset($input['card_gap_v'])) {
            $sanitized['card_gap_v'] = max(0, min(48, intval($input['card_gap_v'])));
        }
        if (isset($input['modal_cover_height'])) {
            $sanitized['modal_cover_height'] = max(100, min(400, intval($input['modal_cover_height'])));
        }
        if (isset($input['modal_transition']) && in_array($input['modal_transition'], $valid_options['modal_transition'], true)) {
            $sanitized['modal_transition'] = $input['modal_transition'];
        }
        if (isset($input['modal_transition_duration'])) {
            $sanitized['modal_transition_duration'] = max(100, min(1000, intval($input['modal_transition_duration'])));
        }
        if (isset($input['modal_max_height'])) {
            $sanitized['modal_max_height'] = max(50, min(100, intval($input['modal_max_height'])));
        }

        if (isset($input['card_display_mode']) && in_array($input['card_display_mode'], $valid_options['card_display_mode'], true)) {
            $sanitized['card_display_mode'] = $input['card_display_mode'];
        }
        if (isset($input['card_rows_per_page'])) {
            $sanitized['card_rows_per_page'] = max(1, min(10, intval($input['card_rows_per_page'])));
        }
        if (isset($input['card_page_dot_nav'])) {
            $sanitized['card_page_dot_nav'] = (bool) $input['card_page_dot_nav'];
        }
        if (isset($input['card_page_transition_ms'])) {
            $sanitized['card_page_transition_ms'] = max(100, min(800, intval($input['card_page_transition_ms'])));
        }

        if (isset($input['show_gallery_title'])) {
            $sanitized['show_gallery_title'] = (bool) $input['show_gallery_title'];
        }
        if (isset($input['show_gallery_subtitle'])) {
            $sanitized['show_gallery_subtitle'] = (bool) $input['show_gallery_subtitle'];
        }
        if (isset($input['show_access_mode'])) {
            $sanitized['show_access_mode'] = (bool) $input['show_access_mode'];
        }
        if (isset($input['show_filter_tabs'])) {
            $sanitized['show_filter_tabs'] = (bool) $input['show_filter_tabs'];
        }
        if (isset($input['show_search_box'])) {
            $sanitized['show_search_box'] = (bool) $input['show_search_box'];
        }

        if (isset($input['app_max_width'])) {
            $sanitized['app_max_width'] = max(0, min(3000, intval($input['app_max_width'])));
        }
        if (isset($input['app_padding'])) {
            $sanitized['app_padding'] = max(0, min(100, intval($input['app_padding'])));
        }
        if (isset($input['wp_full_bleed_desktop'])) {
            $sanitized['wp_full_bleed_desktop'] = (bool) $input['wp_full_bleed_desktop'];
        }
        if (isset($input['wp_full_bleed_tablet'])) {
            $sanitized['wp_full_bleed_tablet'] = (bool) $input['wp_full_bleed_tablet'];
        }
        if (isset($input['wp_full_bleed_mobile'])) {
            $sanitized['wp_full_bleed_mobile'] = (bool) $input['wp_full_bleed_mobile'];
        }
        if (isset($input['image_tile_size'])) {
            $sanitized['image_tile_size'] = max(60, min(400, intval($input['image_tile_size'])));
        }
        if (isset($input['video_tile_size'])) {
            $sanitized['video_tile_size'] = max(60, min(400, intval($input['video_tile_size'])));
        }

        if (isset($input['enable_lightbox'])) {
            $sanitized['enable_lightbox'] = (bool) $input['enable_lightbox'];
        }
        if (isset($input['enable_animations'])) {
            $sanitized['enable_animations'] = (bool) $input['enable_animations'];
        }
        if (isset($input['allow_user_theme_override'])) {
            $sanitized['allow_user_theme_override'] = (bool) $input['allow_user_theme_override'];
        }

        if (isset($input['cache_ttl'])) {
            $ttl = intval($input['cache_ttl']);
            $sanitized['cache_ttl'] = max(0, min(604800, $ttl));
        }

        if (isset($input['typography_overrides'])) {
            $sanitized['typography_overrides'] = self::sanitize_typography_overrides($input['typography_overrides']);
        }

        if (isset($input['viewer_bg_gradient'])) {
            $sanitized['viewer_bg_gradient'] = self::sanitize_viewer_bg_gradient($input['viewer_bg_gradient']);
        }

        if (isset($input['gallery_config'])) {
            $sanitized['gallery_config'] = self::sanitize_gallery_config(
                $input['gallery_config'],
                $defaults['gallery_config'] ?? []
            );
        }

        foreach ($input as $key => $value) {
            if (isset($sanitized[$key])) {
                continue;
            }
            if (!array_key_exists($key, $defaults)) {
                continue;
            }

            if (isset($valid_options[$key])) {
                $sanitized[$key] = in_array($value, $valid_options[$key], true)
                    ? $value
                    : $defaults[$key];
                continue;
            }

            $default = $defaults[$key];

            if (is_bool($default)) {
                $sanitized[$key] = (bool) $value;
            } elseif (is_int($default)) {
                $val = intval($value);
                if (isset($field_ranges[$key])) {
                    $val = max((int) $field_ranges[$key][0], min((int) $field_ranges[$key][1], $val));
                }
                $sanitized[$key] = $val;
            } elseif (is_float($default)) {
                $val = floatval($value);
                if (isset($field_ranges[$key])) {
                    $val = max((float) $field_ranges[$key][0], min((float) $field_ranges[$key][1], $val));
                }
                $sanitized[$key] = $val;
            } else {
                if (str_ends_with($key, '_url') || str_ends_with($key, '_image_url')) {
                    $sanitized[$key] = esc_url_raw((string) $value);
                } else {
                    $sanitized[$key] = sanitize_text_field((string) $value);
                }
            }
        }

        return $sanitized;
    }

    /**
     * Sanitize nested gallery config scalar or object values.
     *
     * @param mixed $value Raw nested value.
     * @return mixed
     */
    private static function sanitize_gallery_config_value($value) {
        if (is_bool($value) || is_int($value) || is_float($value) || is_null($value)) {
            return $value;
        }

        if (is_string($value)) {
            return sanitize_text_field($value);
        }

        if (!is_array($value)) {
            return null;
        }

        $sanitized = [];
        foreach ($value as $key => $item) {
            $sanitized_key = is_string($key) ? preg_replace('/[^A-Za-z0-9_-]/', '', $key) : $key;
            if ($sanitized_key === '' || $sanitized_key === null) {
                continue;
            }

            $sanitized[$sanitized_key] = self::sanitize_gallery_config_value($item);
        }

        return $sanitized;
    }

    /**
     * Sanitize a single nested gallery scope config.
     *
     * @param mixed $scope_config Raw scope config.
     * @param array $valid_adapters Allowed adapter ids.
     * @return array|null
     */
    private static function sanitize_gallery_scope($scope_config, $valid_adapters) {
        if (!is_array($scope_config)) {
            return null;
        }

        $sanitized = [];

        if (isset($scope_config['adapterId'])) {
            $adapter_id = sanitize_text_field($scope_config['adapterId']);
            if (in_array($adapter_id, $valid_adapters, true)) {
                $sanitized['adapterId'] = $adapter_id;
            }
        }

        if (!empty($scope_config['common']) && is_array($scope_config['common'])) {
            $sanitized['common'] = self::sanitize_gallery_config_value($scope_config['common']);
        }

        if (!empty($scope_config['adapterSettings']) && is_array($scope_config['adapterSettings'])) {
            $sanitized['adapterSettings'] = self::sanitize_gallery_config_value($scope_config['adapterSettings']);
        }

        return empty($sanitized) ? null : $sanitized;
    }

    /**
     * Sanitize nested gallery config payloads for global settings.
     *
     * @param mixed $raw Raw gallery config value.
     * @param array $default Default gallery config fallback.
     * @return array
     */
    private static function sanitize_gallery_config($raw, $default) {
        $decoded = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
        if (!is_array($decoded)) {
            return is_array($default) ? $default : [];
        }

        $valid_adapters = class_exists('WPSG_CPT') ? WPSG_CPT::VALID_ADAPTERS
            : ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond', 'layout-builder'];

        $sanitized = [];

        if (isset($decoded['mode']) && in_array($decoded['mode'], ['unified', 'per-type'], true)) {
            $sanitized['mode'] = $decoded['mode'];
        }

        if (!empty($decoded['breakpoints']) && is_array($decoded['breakpoints'])) {
            $sanitized_breakpoints = [];

            foreach (['desktop', 'tablet', 'mobile'] as $breakpoint) {
                if (empty($decoded['breakpoints'][$breakpoint]) || !is_array($decoded['breakpoints'][$breakpoint])) {
                    continue;
                }

                $sanitized_scopes = [];
                foreach (['unified', 'image', 'video'] as $scope) {
                    $sanitized_scope = self::sanitize_gallery_scope($decoded['breakpoints'][$breakpoint][$scope] ?? null, $valid_adapters);
                    if (!empty($sanitized_scope)) {
                        $sanitized_scopes[$scope] = $sanitized_scope;
                    }
                }

                if (!empty($sanitized_scopes)) {
                    $sanitized_breakpoints[$breakpoint] = $sanitized_scopes;
                }
            }

            if (!empty($sanitized_breakpoints)) {
                $sanitized['breakpoints'] = $sanitized_breakpoints;
            }
        }

        if (empty($sanitized['mode']) && isset($default['mode'])) {
            $sanitized['mode'] = $default['mode'];
        }

        return empty($sanitized) ? (is_array($default) ? $default : []) : $sanitized;
    }

    /**
     * Sanitize typography override JSON.
     *
     * @param mixed $raw Raw typography payload.
     * @return string JSON encoded sanitized typography overrides.
     */
    private static function sanitize_typography_overrides($raw) {
        $decoded = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
        if (!is_array($decoded)) {
            $decoded = [];
        }

        $allowed_props = [
            'fontFamily', 'fontFallback1', 'fontFallback2',
            'fontSize', 'fontWeight', 'fontStyle',
            'textTransform', 'textDecoration', 'lineHeight',
            'letterSpacing', 'wordSpacing', 'color',
            'textStrokeWidth', 'textStrokeColor',
            'textShadowOffsetX', 'textShadowOffsetY', 'textShadowBlur', 'textShadowColor',
            'textGlowColor', 'textGlowBlur',
        ];
        $allowed_elements = [
            'viewerTitle', 'viewerSubtitle',
            'cardTitle', 'cardDescription', 'cardCompanyName', 'cardMediaCounts',
            'campaignTitle', 'campaignDescription', 'campaignDate',
            'campaignAboutHeading', 'campaignStatsValue', 'campaignStatsLabel',
            'galleryLabel', 'mediaCaption', 'authBarText', 'accessBadgeText',
        ];

        $clean = [];
        foreach ($decoded as $element_id => $overrides) {
            if (!is_string($element_id) || !is_array($overrides)) {
                continue;
            }
            if (!in_array($element_id, $allowed_elements, true)) {
                continue;
            }

            $element_clean = [];
            foreach ($overrides as $prop => $val) {
                if (!in_array($prop, $allowed_props, true)) {
                    continue;
                }

                if ($prop === 'fontWeight') {
                    $val = max(100, min(900, intval($val)));
                } elseif ($prop === 'lineHeight') {
                    $val = max(0.5, min(5.0, floatval($val)));
                } else {
                    $val = sanitize_text_field((string) $val);
                }

                $element_clean[$prop] = $val;
            }

            if (!empty($element_clean)) {
                $clean[$element_id] = $element_clean;
            }
        }

        return wp_json_encode($clean);
    }

    /**
     * Sanitize structured viewer background gradient payload.
     *
     * @param mixed $raw Raw gradient payload.
     * @return array|object Sanitized gradient payload.
     */
    private static function sanitize_viewer_bg_gradient($raw) {
        $decoded = is_string($raw) ? json_decode($raw, true) : (is_array($raw) ? $raw : null);
        if (!is_array($decoded)) {
            $decoded = [];
        }

        $clean_grad = [];
        $allowed_types = ['linear', 'radial', 'conic'];
        $allowed_dirs  = ['horizontal', 'vertical', 'diagonal-right', 'diagonal-left'];
        $allowed_shapes = ['circle', 'ellipse'];
        $allowed_sizes  = ['farthest-corner', 'farthest-side', 'closest-corner', 'closest-side'];

        if (isset($decoded['type']) && in_array($decoded['type'], $allowed_types, true)) {
            $clean_grad['type'] = $decoded['type'];
        }
        if (isset($decoded['direction']) && in_array($decoded['direction'], $allowed_dirs, true)) {
            $clean_grad['direction'] = $decoded['direction'];
        }
        if (isset($decoded['angle'])) {
            $clean_grad['angle'] = max(0, min(360, intval($decoded['angle'])));
        }
        if (isset($decoded['radialShape']) && in_array($decoded['radialShape'], $allowed_shapes, true)) {
            $clean_grad['radialShape'] = $decoded['radialShape'];
        }
        if (isset($decoded['radialSize']) && in_array($decoded['radialSize'], $allowed_sizes, true)) {
            $clean_grad['radialSize'] = $decoded['radialSize'];
        }
        if (isset($decoded['centerX'])) {
            $clean_grad['centerX'] = max(0, min(100, intval($decoded['centerX'])));
        }
        if (isset($decoded['centerY'])) {
            $clean_grad['centerY'] = max(0, min(100, intval($decoded['centerY'])));
        }
        if (isset($decoded['stops']) && is_array($decoded['stops'])) {
            $clean_stops = [];
            foreach (array_slice($decoded['stops'], 0, 3) as $stop) {
                if (!is_array($stop)) {
                    continue;
                }

                $clean_stop = [];
                if (isset($stop['color'])) {
                    $clean_stop['color'] = sanitize_text_field((string) $stop['color']);
                }
                if (isset($stop['position'])) {
                    $clean_stop['position'] = max(0, min(100, intval($stop['position'])));
                }
                if (!empty($clean_stop)) {
                    $clean_stops[] = $clean_stop;
                }
            }
            if (!empty($clean_stops)) {
                $clean_grad['stops'] = $clean_stops;
            }
        }

        return empty($clean_grad) ? (object) [] : $clean_grad;
    }
}