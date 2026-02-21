<?php
/**
 * WP Super Gallery Settings Page
 *
 * Handles plugin configuration through WordPress admin.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Settings class for WP Super Gallery.
 */
class WPSG_Settings {

    /**
     * Option name for all plugin settings.
     */
    const OPTION_NAME = 'wpsg_settings';

    /**
     * Settings page slug.
     */
    const PAGE_SLUG = 'wpsg-settings';

    /**
     * Default settings values.
     *
     * @var array
     */
    private static $defaults = [
        'auth_provider'              => 'wp-jwt',
        'api_base'                   => '',
        'theme'                      => 'default-dark',
        'allow_user_theme_override'  => true,
        'gallery_layout'             => 'grid',
        'items_per_page'             => 12,
        'enable_lightbox'            => true,
        'enable_animations'          => true,
        'video_viewport_height'      => 420,
        'image_viewport_height'      => 420,
        'thumbnail_scroll_speed'     => 1,
        'scroll_animation_style'     => 'smooth',
        'scroll_animation_duration_ms' => 350,
        'scroll_animation_easing'    => 'ease',
        'scroll_transition_type'     => 'slide-fade',
        'image_border_radius'        => 8,
        'video_border_radius'        => 8,
        'transition_fade_enabled'    => true,
        // P12-A/B: Advanced thumbnail strip
        'video_thumbnail_width'      => 60,
        'video_thumbnail_height'     => 45,
        'image_thumbnail_width'      => 60,
        'image_thumbnail_height'     => 60,
        'thumbnail_gap'              => 6,
        'thumbnail_wheel_scroll_enabled' => true,
        'thumbnail_drag_scroll_enabled'  => true,
        'thumbnail_scroll_buttons_visible' => false,
        // P12-H: Navigation Overlay Arrows
        'nav_arrow_position'         => 'center',
        'nav_arrow_size'             => 36,
        'nav_arrow_color'            => '#ffffff',
        'nav_arrow_bg_color'         => 'rgba(0,0,0,0.45)',
        'nav_arrow_border_width'     => 0,
        'nav_arrow_hover_scale'      => 1.1,
        'nav_arrow_auto_hide_ms'     => 0,
        // P12-I: Dot Navigator
        'dot_nav_enabled'            => true,
        'dot_nav_position'           => 'below',
        'dot_nav_size'               => 10,
        'dot_nav_active_color'       => 'var(--wpsg-color-primary)',
        'dot_nav_inactive_color'     => 'rgba(128,128,128,0.4)',
        'dot_nav_shape'              => 'circle',
        'dot_nav_spacing'            => 6,
        'dot_nav_active_scale'       => 1.3,
        // P12-J: Shadow & Depth
        'image_shadow_preset'        => 'subtle',
        'video_shadow_preset'        => 'subtle',
        'image_shadow_custom'        => '0 2px 8px rgba(0,0,0,0.15)',
        'video_shadow_custom'        => '0 2px 8px rgba(0,0,0,0.15)',
        // P12-C: Gallery Adapters
        'image_gallery_adapter_id'   => 'classic',
        'video_gallery_adapter_id'   => 'classic',
        'unified_gallery_enabled'    => false,
        'unified_gallery_adapter_id' => 'compact-grid',
        'grid_card_width'            => 160,
        'grid_card_height'           => 224,
        'mosaic_target_row_height'   => 200,
        // Tile appearance (hex / circle / diamond / masonry / justified)
        'tile_size'                  => 150,
        'tile_gap_x'                 => 8,
        'tile_gap_y'                 => 8,
        'tile_border_width'          => 0,
        'tile_border_color'          => '#ffffff',
        'tile_glow_enabled'          => false,
        'tile_glow_color'            => '#7c9ef8',
        'tile_glow_spread'           => 12,
        'tile_hover_bounce'          => true,
        'masonry_columns'            => 0,
        // Viewport backgrounds
        'image_bg_type'              => 'none',
        'image_bg_color'             => '#1a1a2e',
        'image_bg_gradient'          => 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
        'image_bg_image_url'         => '',
        'video_bg_type'              => 'none',
        'video_bg_color'             => '#0d0d0d',
        'video_bg_gradient'          => 'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)',
        'video_bg_image_url'         => '',
        'unified_bg_type'            => 'none',
        'unified_bg_color'           => '#1a1a2e',
        'unified_bg_gradient'        => 'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)',
        'unified_bg_image_url'       => '',
        // P13-A: Campaign Card
        'card_border_radius'         => 8,
        'card_border_width'          => 4,
        'card_border_mode'           => 'auto',
        'card_border_color'          => '#228be6',
        'card_shadow_preset'         => 'subtle',
        'card_thumbnail_height'      => 200,
        'card_thumbnail_fit'         => 'cover',
        'card_grid_columns'          => 0,
        'card_gap'                   => 16,
        'modal_cover_height'         => 240,
        'modal_transition'           => 'pop',
        'modal_transition_duration'  => 300,
        'modal_max_height'           => 90,
        // P13-F: Card Gallery Pagination
        'card_display_mode'          => 'load-more',
        'card_rows_per_page'         => 3,
        'card_page_dot_nav'          => false,
        'card_page_transition_ms'    => 300,
        // P13-E: Header visibility toggles
        'show_gallery_title'         => true,
        'show_gallery_subtitle'      => true,
        'show_access_mode'           => true,
        'show_filter_tabs'           => true,
        'show_search_box'            => true,
        // P13-E: App width & per-gallery tile sizes
        'app_max_width'              => 1200,
        'image_tile_size'            => 150,
        'video_tile_size'            => 150,
        'cache_ttl'                  => 3600,
    ];

    /**
     * Valid options for select fields.
     *
     * @var array
     */
    private static $valid_options = [
        'auth_provider'  => ['wp-jwt', 'none'],
        'theme'          => [
            'default-dark',
            'default-light',
            'material-dark',
            'material-light',
            'darcula',
            'nord',
            'solarized-dark',
            'solarized-light',
            'high-contrast',
            'catppuccin-mocha',
            'tokyo-night',
            'gruvbox-dark',
            'cyberpunk',
            'synthwave',
        ],
        'gallery_layout' => ['grid', 'masonry', 'carousel'],
        'scroll_animation_style' => ['smooth', 'instant'],
        'scroll_animation_easing' => ['ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out'],
        'scroll_transition_type' => ['fade', 'slide', 'slide-fade'],
        'nav_arrow_position'     => ['top', 'center', 'bottom'],
        'dot_nav_position'       => ['below', 'overlay-bottom', 'overlay-top'],
        'dot_nav_shape'          => ['circle', 'pill', 'square'],
        'image_shadow_preset'    => ['none', 'subtle', 'medium', 'strong', 'custom'],
        'video_shadow_preset'    => ['none', 'subtle', 'medium', 'strong', 'custom'],
        'card_shadow_preset'     => ['none', 'subtle', 'medium', 'dramatic'],
        'card_thumbnail_fit'     => ['cover', 'contain'],
        'card_border_mode'       => ['auto', 'single', 'individual'],
        'modal_transition'       => ['pop', 'fade', 'slide-up'],
        'card_display_mode'      => ['show-all', 'load-more', 'paginated'],
    ];

    /**
     * Register hooks for admin menu and settings.
     */
    public static function init() {
        add_action('admin_menu', [self::class, 'add_menu_page']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('wp_ajax_wpsg_test_auth', [self::class, 'ajax_test_auth']);

        // Hook into filters to provide settings values.
        add_filter('wpsg_auth_provider', [self::class, 'filter_auth_provider']);
        add_filter('wpsg_api_base', [self::class, 'filter_api_base']);
    }

    /**
     * Add settings page to admin menu.
     */
    public static function add_menu_page() {
        add_submenu_page(
            'edit.php?post_type=wpsg_campaign',
            __('Super Gallery Settings', 'wp-super-gallery'),
            __('Settings', 'wp-super-gallery'),
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'render_settings_page']
        );
    }

    /**
     * Register settings with WordPress Settings API.
     */
    public static function register_settings() {
        register_setting(
            'wpsg_settings_group',
            self::OPTION_NAME,
            [
                'type'              => 'array',
                'sanitize_callback' => [self::class, 'sanitize_settings'],
                'default'           => self::$defaults,
            ]
        );

        // Authentication Section.
        add_settings_section(
            'wpsg_auth_section',
            __('Authentication', 'wp-super-gallery'),
            [self::class, 'render_auth_section'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'auth_provider',
            __('Auth Provider', 'wp-super-gallery'),
            [self::class, 'render_auth_provider_field'],
            self::PAGE_SLUG,
            'wpsg_auth_section'
        );

        add_settings_field(
            'api_base',
            __('API Base URL', 'wp-super-gallery'),
            [self::class, 'render_api_base_field'],
            self::PAGE_SLUG,
            'wpsg_auth_section'
        );

        // Display Section.
        add_settings_section(
            'wpsg_display_section',
            __('Display Settings', 'wp-super-gallery'),
            [self::class, 'render_display_section'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'theme',
            __('Theme', 'wp-super-gallery'),
            [self::class, 'render_theme_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'allow_user_theme_override',
            __('Allow User Theme Override', 'wp-super-gallery'),
            [self::class, 'render_allow_user_theme_override_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'gallery_layout',
            __('Default Layout', 'wp-super-gallery'),
            [self::class, 'render_layout_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'items_per_page',
            __('Items Per Page', 'wp-super-gallery'),
            [self::class, 'render_items_per_page_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'enable_lightbox',
            __('Enable Lightbox', 'wp-super-gallery'),
            [self::class, 'render_lightbox_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'enable_animations',
            __('Enable Animations', 'wp-super-gallery'),
            [self::class, 'render_animations_field'],
            self::PAGE_SLUG,
            'wpsg_display_section'
        );

        // Performance Section.
        add_settings_section(
            'wpsg_performance_section',
            __('Performance', 'wp-super-gallery'),
            [self::class, 'render_performance_section'],
            self::PAGE_SLUG
        );

        add_settings_field(
            'cache_ttl',
            __('Cache Duration', 'wp-super-gallery'),
            [self::class, 'render_cache_ttl_field'],
            self::PAGE_SLUG,
            'wpsg_performance_section'
        );
    }

    /**
     * Get all settings with defaults applied.
     *
     * @return array Settings array.
     */
    public static function get_settings() {
        $settings = get_option(self::OPTION_NAME, []);
        return wp_parse_args($settings, self::$defaults);
    }

    /**
     * Get a single setting value.
     *
     * @param string $key     Setting key.
     * @param mixed  $default Default value if not set.
     * @return mixed Setting value.
     */
    public static function get_setting($key, $default = null) {
        $settings = self::get_settings();
        if (isset($settings[$key])) {
            return $settings[$key];
        }
        return $default !== null ? $default : (self::$defaults[$key] ?? null);
    }

    /**
     * Sanitize settings before saving.
     *
     * @param array $input Raw input array.
     * @return array Sanitized settings.
     */
    public static function sanitize_settings($input) {
        $sanitized = [];

        // Auth provider - must be valid option.
        if (isset($input['auth_provider'])) {
            $sanitized['auth_provider'] = in_array($input['auth_provider'], self::$valid_options['auth_provider'], true)
                ? $input['auth_provider']
                : self::$defaults['auth_provider'];
        }

        // API base - sanitize URL, empty means use home_url().
        if (isset($input['api_base'])) {
            $sanitized['api_base'] = esc_url_raw(trim($input['api_base']));
        }

        // Theme - must be valid option.
        if (isset($input['theme'])) {
            $sanitized['theme'] = in_array($input['theme'], self::$valid_options['theme'], true)
                ? $input['theme']
                : self::$defaults['theme'];
        }

        // Gallery layout - must be valid option.
        if (isset($input['gallery_layout'])) {
            $sanitized['gallery_layout'] = in_array($input['gallery_layout'], self::$valid_options['gallery_layout'], true)
                ? $input['gallery_layout']
                : self::$defaults['gallery_layout'];
        }

        // Items per page - integer between 1 and 100.
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

        if (isset($input['thumbnail_scroll_speed'])) {
            $speed = floatval($input['thumbnail_scroll_speed']);
            $sanitized['thumbnail_scroll_speed'] = max(0.25, min(3, $speed));
        }

        if (isset($input['scroll_animation_style'])) {
            $sanitized['scroll_animation_style'] = in_array($input['scroll_animation_style'], self::$valid_options['scroll_animation_style'], true)
                ? $input['scroll_animation_style']
                : self::$defaults['scroll_animation_style'];
        }

        if (isset($input['scroll_animation_duration_ms'])) {
            $duration = intval($input['scroll_animation_duration_ms']);
            $sanitized['scroll_animation_duration_ms'] = max(0, min(2000, $duration));
        }

        if (isset($input['scroll_animation_easing'])) {
            $sanitized['scroll_animation_easing'] = in_array($input['scroll_animation_easing'], self::$valid_options['scroll_animation_easing'], true)
                ? $input['scroll_animation_easing']
                : self::$defaults['scroll_animation_easing'];
        }

        if (isset($input['scroll_transition_type'])) {
            $sanitized['scroll_transition_type'] = in_array($input['scroll_transition_type'], self::$valid_options['scroll_transition_type'], true)
                ? $input['scroll_transition_type']
                : self::$defaults['scroll_transition_type'];
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

        // P12-A/B: Advanced thumbnail strip
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

        // P12-H: Navigation Overlay Arrows
        if (isset($input['nav_arrow_position'])) {
            $sanitized['nav_arrow_position'] = in_array($input['nav_arrow_position'], self::$valid_options['nav_arrow_position'], true)
                ? $input['nav_arrow_position']
                : self::$defaults['nav_arrow_position'];
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

        // P12-I: Dot Navigator
        if (isset($input['dot_nav_enabled'])) {
            $sanitized['dot_nav_enabled'] = (bool) $input['dot_nav_enabled'];
        }
        if (isset($input['dot_nav_position'])) {
            $sanitized['dot_nav_position'] = in_array($input['dot_nav_position'], self::$valid_options['dot_nav_position'], true)
                ? $input['dot_nav_position']
                : self::$defaults['dot_nav_position'];
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
            $sanitized['dot_nav_shape'] = in_array($input['dot_nav_shape'], self::$valid_options['dot_nav_shape'], true)
                ? $input['dot_nav_shape']
                : self::$defaults['dot_nav_shape'];
        }
        if (isset($input['dot_nav_spacing'])) {
            $sanitized['dot_nav_spacing'] = max(2, min(20, intval($input['dot_nav_spacing'])));
        }
        if (isset($input['dot_nav_active_scale'])) {
            $sanitized['dot_nav_active_scale'] = max(1.0, min(2.0, floatval($input['dot_nav_active_scale'])));
        }

        // P12-J: Shadow & Depth
        if (isset($input['image_shadow_preset'])) {
            $sanitized['image_shadow_preset'] = in_array($input['image_shadow_preset'], self::$valid_options['image_shadow_preset'], true)
                ? $input['image_shadow_preset']
                : self::$defaults['image_shadow_preset'];
        }
        if (isset($input['video_shadow_preset'])) {
            $sanitized['video_shadow_preset'] = in_array($input['video_shadow_preset'], self::$valid_options['video_shadow_preset'], true)
                ? $input['video_shadow_preset']
                : self::$defaults['video_shadow_preset'];
        }
        if (isset($input['image_shadow_custom'])) {
            $sanitized['image_shadow_custom'] = sanitize_text_field($input['image_shadow_custom']);
        }
        if (isset($input['video_shadow_custom'])) {
            $sanitized['video_shadow_custom'] = sanitize_text_field($input['video_shadow_custom']);
        }

        // P12-C: Gallery Adapters
        if (isset($input['image_gallery_adapter_id'])) {
            $valid_adapters = ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond'];
            $sanitized['image_gallery_adapter_id'] = in_array($input['image_gallery_adapter_id'], $valid_adapters, true)
                ? $input['image_gallery_adapter_id']
                : 'classic';
        }
        if (isset($input['video_gallery_adapter_id'])) {
            $valid_adapters = ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond'];
            $sanitized['video_gallery_adapter_id'] = in_array($input['video_gallery_adapter_id'], $valid_adapters, true)
                ? $input['video_gallery_adapter_id']
                : 'classic';
        }
        $sanitized['unified_gallery_enabled'] = !empty($input['unified_gallery_enabled']);
        if (isset($input['unified_gallery_adapter_id'])) {
            $valid_adapters = ['classic', 'compact-grid', 'mosaic', 'justified', 'masonry', 'hexagonal', 'circular', 'diamond'];
            $sanitized['unified_gallery_adapter_id'] = in_array($input['unified_gallery_adapter_id'], $valid_adapters, true)
                ? $input['unified_gallery_adapter_id']
                : 'compact-grid';
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
        // Tile appearance settings
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

        // Viewport backgrounds.
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

        // P13-A: Campaign Card settings.
        if (isset($input['card_border_radius'])) {
            $sanitized['card_border_radius'] = max(0, min(24, intval($input['card_border_radius'])));
        }
        if (isset($input['card_border_width'])) {
            $sanitized['card_border_width'] = max(0, min(8, intval($input['card_border_width'])));
        }
        if (isset($input['card_border_mode']) && in_array($input['card_border_mode'], self::$valid_options['card_border_mode'], true)) {
            $sanitized['card_border_mode'] = $input['card_border_mode'];
        }
        if (isset($input['card_border_color'])) {
            $sanitized['card_border_color'] = sanitize_hex_color($input['card_border_color']) ?: '#228be6';
        }
        if (isset($input['card_shadow_preset']) && in_array($input['card_shadow_preset'], self::$valid_options['card_shadow_preset'], true)) {
            $sanitized['card_shadow_preset'] = $input['card_shadow_preset'];
        }
        if (isset($input['card_thumbnail_height'])) {
            $sanitized['card_thumbnail_height'] = max(100, min(400, intval($input['card_thumbnail_height'])));
        }
        if (isset($input['card_thumbnail_fit']) && in_array($input['card_thumbnail_fit'], self::$valid_options['card_thumbnail_fit'], true)) {
            $sanitized['card_thumbnail_fit'] = $input['card_thumbnail_fit'];
        }
        if (isset($input['card_grid_columns'])) {
            $sanitized['card_grid_columns'] = max(0, min(4, intval($input['card_grid_columns'])));
        }
        if (isset($input['card_gap'])) {
            $sanitized['card_gap'] = max(0, min(48, intval($input['card_gap'])));
        }
        if (isset($input['modal_cover_height'])) {
            $sanitized['modal_cover_height'] = max(100, min(400, intval($input['modal_cover_height'])));
        }
        if (isset($input['modal_transition']) && in_array($input['modal_transition'], self::$valid_options['modal_transition'], true)) {
            $sanitized['modal_transition'] = $input['modal_transition'];
        }
        if (isset($input['modal_transition_duration'])) {
            $sanitized['modal_transition_duration'] = max(100, min(1000, intval($input['modal_transition_duration'])));
        }
        if (isset($input['modal_max_height'])) {
            $sanitized['modal_max_height'] = max(50, min(100, intval($input['modal_max_height'])));
        }

        // P13-F: Card Gallery Pagination.
        if (isset($input['card_display_mode']) && in_array($input['card_display_mode'], self::$valid_options['card_display_mode'], true)) {
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

        // P13-E: Header visibility toggles.
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

        // P13-E: App width & per-gallery tile sizes.
        if (isset($input['app_max_width'])) {
            $sanitized['app_max_width'] = max(0, min(3000, intval($input['app_max_width'])));
        }
        if (isset($input['image_tile_size'])) {
            $sanitized['image_tile_size'] = max(60, min(400, intval($input['image_tile_size'])));
        }
        if (isset($input['video_tile_size'])) {
            $sanitized['video_tile_size'] = max(60, min(400, intval($input['video_tile_size'])));
        }

        // Boolean fields.
        $sanitized['enable_lightbox']            = !empty($input['enable_lightbox']);
        $sanitized['enable_animations']          = !empty($input['enable_animations']);
        $sanitized['allow_user_theme_override']  = !empty($input['allow_user_theme_override']);

        // Cache TTL - integer, 0 means disabled, max 1 week.
        if (isset($input['cache_ttl'])) {
            $ttl = intval($input['cache_ttl']);
            $sanitized['cache_ttl'] = max(0, min(604800, $ttl));
        }

        return $sanitized;
    }

    /**
     * Filter: Provide auth_provider setting value.
     *
     * @param string $default Default value.
     * @return string Auth provider.
     */
    public static function filter_auth_provider($default) {
        return self::get_setting('auth_provider', $default);
    }

    /**
     * Filter: Provide api_base setting value.
     *
     * @param string $default Default value.
     * @return string API base URL.
     */
    public static function filter_api_base($default) {
        $api_base = self::get_setting('api_base', '');
        return !empty($api_base) ? $api_base : $default;
    }

    // =========================================================================
    // Section Renderers
    // =========================================================================

    /**
     * Render authentication section description.
     */
    public static function render_auth_section() {
        echo '<p>' . esc_html__('Configure how the gallery authenticates with the WordPress REST API.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render display section description.
     */
    public static function render_display_section() {
        echo '<p>' . esc_html__('Configure default display settings for galleries.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render performance section description.
     */
    public static function render_performance_section() {
        echo '<p>' . esc_html__('Configure caching and performance settings.', 'wp-super-gallery') . '</p>';
    }

    // =========================================================================
    // Field Renderers
    // =========================================================================

    /**
     * Render auth provider select field.
     */
    public static function render_auth_provider_field() {
        $value = self::get_setting('auth_provider');
        $options = [
            'wp-jwt' => __('WordPress JWT (Recommended)', 'wp-super-gallery'),
            'none'   => __('None (Public Access Only)', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[auth_provider]" id="wpsg_auth_provider">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Select the authentication method for REST API access.', 'wp-super-gallery'); ?>
        </p>
        <p style="margin-top: 10px;">
            <button type="button" class="button" id="wpsg-test-auth">
                <?php esc_html_e('Test Connection', 'wp-super-gallery'); ?>
            </button>
            <span id="wpsg-test-auth-result" style="margin-left: 10px;"></span>
        </p>
        <?php
    }

    /**
     * Render API base URL field.
     */
    public static function render_api_base_field() {
        $value = self::get_setting('api_base');
        ?>
        <input type="url"
               name="<?php echo esc_attr(self::OPTION_NAME); ?>[api_base]"
               id="wpsg_api_base"
               value="<?php echo esc_attr($value); ?>"
               class="regular-text"
               placeholder="<?php echo esc_attr(home_url()); ?>">
        <p class="description">
            <?php esc_html_e('Leave empty to use the current site URL. Only change this for multi-site or headless setups.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render theme select field with all available themes.
     */
    public static function render_theme_field() {
        $value = self::get_setting('theme');
        $theme_groups = [
            __('Default', 'wp-super-gallery') => [
                'default-dark'    => __('Default Dark', 'wp-super-gallery'),
                'default-light'   => __('Default Light', 'wp-super-gallery'),
            ],
            __('Material', 'wp-super-gallery') => [
                'material-dark'   => __('Material Dark', 'wp-super-gallery'),
                'material-light'  => __('Material Light', 'wp-super-gallery'),
            ],
            __('Classic', 'wp-super-gallery') => [
                'darcula'         => __('Darcula', 'wp-super-gallery'),
                'nord'            => __('Nord', 'wp-super-gallery'),
            ],
            __('Solarized', 'wp-super-gallery') => [
                'solarized-dark'  => __('Solarized Dark', 'wp-super-gallery'),
                'solarized-light' => __('Solarized Light', 'wp-super-gallery'),
            ],
            __('Accessibility', 'wp-super-gallery') => [
                'high-contrast'   => __('High Contrast (WCAG AAA)', 'wp-super-gallery'),
            ],
            __('Community', 'wp-super-gallery') => [
                'catppuccin-mocha' => __('Catppuccin Mocha', 'wp-super-gallery'),
                'tokyo-night'      => __('Tokyo Night', 'wp-super-gallery'),
                'gruvbox-dark'     => __('Gruvbox Dark', 'wp-super-gallery'),
            ],
            __('Neon', 'wp-super-gallery') => [
                'cyberpunk'        => __('Cyberpunk', 'wp-super-gallery'),
                'synthwave'        => __('Synthwave \u002784', 'wp-super-gallery'),
            ],
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[theme]" id="wpsg_theme">
            <?php foreach ($theme_groups as $group_label => $options) : ?>
                <optgroup label="<?php echo esc_attr($group_label); ?>">
                    <?php foreach ($options as $key => $label) : ?>
                        <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                            <?php echo esc_html($label); ?>
                        </option>
                    <?php endforeach; ?>
                </optgroup>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Default color theme for gallery display. Users can override this if allowed below.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render allow user theme override checkbox.
     */
    public static function render_allow_user_theme_override_field() {
        $value = self::get_setting('allow_user_theme_override');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(self::OPTION_NAME); ?>[allow_user_theme_override]"
                   id="wpsg_allow_user_theme_override"
                   value="1"
                   <?php checked($value, true); ?>>
            <?php esc_html_e('Allow visitors to switch themes via the gallery UI.', 'wp-super-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('When disabled, the gallery will always use the theme selected above and hide the theme picker from visitors.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render gallery layout select field.
     */
    public static function render_layout_field() {
        $value = self::get_setting('gallery_layout');
        $options = [
            'grid'     => __('Grid', 'wp-super-gallery'),
            'masonry'  => __('Masonry', 'wp-super-gallery'),
            'carousel' => __('Carousel', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[gallery_layout]" id="wpsg_gallery_layout">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Default layout for displaying gallery items.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render items per page number field.
     */
    public static function render_items_per_page_field() {
        $value = self::get_setting('items_per_page');
        ?>
        <input type="number"
               name="<?php echo esc_attr(self::OPTION_NAME); ?>[items_per_page]"
               id="wpsg_items_per_page"
               value="<?php echo esc_attr($value); ?>"
               min="1"
               max="100"
               step="1"
               class="small-text">
        <p class="description">
            <?php esc_html_e('Number of items to display per page (1-100).', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render enable lightbox checkbox.
     */
    public static function render_lightbox_field() {
        $value = self::get_setting('enable_lightbox');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(self::OPTION_NAME); ?>[enable_lightbox]"
                   id="wpsg_enable_lightbox"
                   value="1"
                   <?php checked($value, true); ?>>
            <?php esc_html_e('Enable fullscreen lightbox when clicking gallery items.', 'wp-super-gallery'); ?>
        </label>
        <?php
    }

    /**
     * Render enable animations checkbox.
     */
    public static function render_animations_field() {
        $value = self::get_setting('enable_animations');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(self::OPTION_NAME); ?>[enable_animations]"
                   id="wpsg_enable_animations"
                   value="1"
                   <?php checked($value, true); ?>>
            <?php esc_html_e('Enable smooth animations and transitions.', 'wp-super-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Disable for better performance on low-end devices.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render cache TTL number field.
     */
    public static function render_cache_ttl_field() {
        $value = self::get_setting('cache_ttl');
        $options = [
            0      => __('Disabled', 'wp-super-gallery'),
            10     => __('10 seconds', 'wp-super-gallery'),
            30     => __('30 seconds', 'wp-super-gallery'),
            60     => __('1 minute', 'wp-super-gallery'),
            300    => __('5 minutes', 'wp-super-gallery'),
            900    => __('15 minutes', 'wp-super-gallery'),
            1200   => __('20 minutes', 'wp-super-gallery'),
            1800   => __('30 minutes', 'wp-super-gallery'),
            2700   => __('45 minutes', 'wp-super-gallery'),
            3600   => __('1 hour', 'wp-super-gallery'),
            7200   => __('2 hours', 'wp-super-gallery'),
            14400  => __('4 hours', 'wp-super-gallery'),
            28800  => __('8 hours', 'wp-super-gallery'),
            43200  => __('12 hours', 'wp-super-gallery'),
            86400  => __('1 day', 'wp-super-gallery'),
            259200 => __('3 days', 'wp-super-gallery'),
            604800 => __('1 week', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[cache_ttl]" id="wpsg_cache_ttl">
            <?php foreach ($options as $seconds => $label) : ?>
                <option value="<?php echo esc_attr($seconds); ?>" <?php selected($value, $seconds); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('How long to cache API responses. Higher values improve performance but show stale data.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    // =========================================================================
    // Settings Page
    // =========================================================================

    /**
     * Render the settings page.
     */
    public static function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        // Check for settings saved message.
        if (isset($_GET['settings-updated'])) {
            add_settings_error(
                'wpsg_messages',
                'wpsg_message',
                __('Settings Saved', 'wp-super-gallery'),
                'updated'
            );
        }
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <?php settings_errors('wpsg_messages'); ?>

            <form action="options.php" method="post">
                <?php
                settings_fields('wpsg_settings_group');
                do_settings_sections(self::PAGE_SLUG);
                submit_button(__('Save Settings', 'wp-super-gallery'));
                ?>
            </form>

            <hr>

            <h2><?php esc_html_e('Shortcode Usage', 'wp-super-gallery'); ?></h2>
            <p><?php esc_html_e('Embed a gallery using the following shortcode:', 'wp-super-gallery'); ?></p>
            <code>[super-gallery campaign="your-campaign-slug"]</code>

            <h3><?php esc_html_e('Shortcode Attributes', 'wp-super-gallery'); ?></h3>
            <table class="widefat" style="max-width: 600px;">
                <thead>
                    <tr>
                        <th><?php esc_html_e('Attribute', 'wp-super-gallery'); ?></th>
                        <th><?php esc_html_e('Description', 'wp-super-gallery'); ?></th>
                        <th><?php esc_html_e('Default', 'wp-super-gallery'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>campaign</code></td>
                        <td><?php esc_html_e('Campaign slug or ID to display', 'wp-super-gallery'); ?></td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td><code>company</code></td>
                        <td><?php esc_html_e('Filter by company slug', 'wp-super-gallery'); ?></td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td><code>compact</code></td>
                        <td><?php esc_html_e('Use compact display mode', 'wp-super-gallery'); ?></td>
                        <td>false</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <script>
        (function() {
            var testBtn = document.getElementById('wpsg-test-auth');
            var resultSpan = document.getElementById('wpsg-test-auth-result');

            if (testBtn) {
                testBtn.addEventListener('click', function() {
                    testBtn.disabled = true;
                    resultSpan.textContent = '<?php echo esc_js(__('Testing...', 'wp-super-gallery')); ?>';
                    resultSpan.style.color = '';

                    fetch(ajaxurl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            action: 'wpsg_test_auth',
                            _ajax_nonce: '<?php echo wp_create_nonce('wpsg_test_auth'); ?>'
                        })
                    })
                    .then(function(response) { return response.json(); })
                    .then(function(data) {
                        testBtn.disabled = false;
                        if (data.success) {
                            resultSpan.textContent = '✓ ' + data.data.message;
                            resultSpan.style.color = 'green';
                        } else {
                            resultSpan.textContent = '✗ ' + (data.data.message || 'Connection failed');
                            resultSpan.style.color = 'red';
                        }
                    })
                    .catch(function(err) {
                        testBtn.disabled = false;
                        resultSpan.textContent = '✗ Request failed';
                        resultSpan.style.color = 'red';
                    });
                });
            }
        })();
        </script>
        <?php
    }

    /**
     * AJAX handler for testing authentication.
     */
    public static function ajax_test_auth() {
        check_ajax_referer('wpsg_test_auth');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Permission denied.', 'wp-super-gallery')]);
        }

        $settings = self::get_settings();
        $api_base = !empty($settings['api_base']) ? $settings['api_base'] : home_url();
        $test_url = trailingslashit($api_base) . 'wp-json/wp-super-gallery/v1/campaigns';

        $response = wp_remote_get($test_url, [
            'timeout'   => 10,
            'sslverify' => apply_filters('https_local_ssl_verify', false),
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error([
                'message' => sprintf(
                    __('Connection failed: %s', 'wp-super-gallery'),
                    $response->get_error_message()
                ),
            ]);
        }

        $code = wp_remote_retrieve_response_code($response);

        if ($code === 200) {
            wp_send_json_success([
                'message' => __('API connection successful!', 'wp-super-gallery'),
            ]);
        } elseif ($code === 401 || $code === 403) {
            // Auth required but endpoint is reachable - this is expected for auth provider 'wp-jwt'.
            wp_send_json_success([
                'message' => __('API reachable. Authentication required for protected endpoints.', 'wp-super-gallery'),
            ]);
        } else {
            wp_send_json_error([
                'message' => sprintf(
                    __('Unexpected response: HTTP %d', 'wp-super-gallery'),
                    $code
                ),
            ]);
        }
    }
}
