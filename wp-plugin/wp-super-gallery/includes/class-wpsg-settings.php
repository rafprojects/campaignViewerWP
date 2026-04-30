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
     * Lazily loaded registry metadata.
     *
     * @var array
     */
    private static $defaults = [];

    /**
     * @var string[]
     */
    private static $admin_only_fields = [];

    /**
     * @var array
     */
    private static $valid_options = [];

    /**
     * @var array<string, array{0: int|float, 1: int|float}>
     */
    private static $field_ranges = [];

    /**
     * @var bool
     */
    private static $registry_loaded = false;

    /**
     * Register hooks for admin menu and settings.
     */
    public static function init() {
        self::load_registry();
        WPSG_Settings_Renderer::init();

        // Hook into filters to provide settings values.
        add_filter('wpsg_auth_provider', [self::class, 'filter_auth_provider']);
        add_filter('wpsg_api_base', [self::class, 'filter_api_base']);
    }

    /**
     * Load settings metadata from the extracted registry once per request.
     */
    private static function load_registry() {
        if (self::$registry_loaded) {
            return;
        }

        self::$defaults = WPSG_Settings_Registry::get_defaults();
        self::$admin_only_fields = WPSG_Settings_Registry::get_admin_only_fields();
        self::$valid_options = WPSG_Settings_Registry::get_valid_options();
        self::$field_ranges = WPSG_Settings_Registry::get_field_ranges();
        self::$registry_loaded = true;
    }

    /**
     * Add settings page to admin menu.
     */
    public static function add_menu_page() {
        WPSG_Settings_Renderer::add_menu_page();
    }

    /**
     * Register settings with WordPress Settings API.
     */
    public static function register_settings() {
        WPSG_Settings_Renderer::register_settings();
    }

    /**
     * Google Font family names that may be loaded from the CDN.
     * Must stay in sync with GOOGLE_FONT_NAMES in TypographyEditor.tsx.
     */
    const GOOGLE_FONT_NAMES = WPSG_Settings_Typography::GOOGLE_FONT_NAMES;

    /**
     * Per-font axis specifications for Google Fonts CSS API v2.
     * Must stay in sync with GOOGLE_FONT_SPECS in loadGoogleFont.ts.
     *
     * null = no axes needed (regular 400 only, e.g. Pacifico).
     */
    const GOOGLE_FONT_SPECS = WPSG_Settings_Typography::GOOGLE_FONT_SPECS;

    /**
     * Extract Google Font family names from typography_overrides.
     *
     * @param array $settings Plugin settings array.
     * @return array Deduplicated Google Font family names.
     */
    public static function extract_google_font_families($settings) {
        return WPSG_Settings_Typography::extract_google_font_families($settings);
    }

    /**
     * Get all settings with defaults applied.
     *
     * @return array Settings array.
     */
    public static function get_settings() {
        self::load_registry();
        $stored_settings = get_option(self::OPTION_NAME, []);
        $settings = wp_parse_args($stored_settings, self::$defaults);

        if (!array_key_exists('gallery_config', $settings)) {
            return $settings;
        }

        return WPSG_Settings_Utils::strip_nested_only_gallery_legacy_fields($settings);
    }

    /**
     * Get a single setting value.
     *
     * @param string $key     Setting key.
     * @param mixed  $default Default value if not set.
     * @return mixed Setting value.
     */
    public static function get_setting($key, $default = null) {
        self::load_registry();
        $settings = self::get_settings();
        if (isset($settings[$key])) {
            return $settings[$key];
        }
        return $default !== null ? $default : (self::$defaults[$key] ?? null);
    }

    // =========================================================================
    // DRY snake_case ↔ camelCase conversion (B-8)
    // =========================================================================

    /**
     * Convert a snake_case key to camelCase.
     *
     * @param string $key Snake-case key, e.g. 'video_viewport_height'.
     * @return string CamelCase key, e.g. 'videoViewportHeight'.
     */
    public static function snake_to_camel($key) {
        return WPSG_Settings_Utils::snake_to_camel($key);
    }

    /**
     * Convert stored PHP settings to a camelCase JS-ready array.
     *
     * Uses $defaults as the registry: every key in $defaults is included.
     * Admin-only fields are omitted unless $admin is true.
     *
     * @param array $settings Settings array (snake_case keys).
     * @param bool  $admin    Whether to include admin-only fields.
     * @return array Associative array with camelCase keys.
     */
    public static function to_js($settings, $admin = false) {
        self::load_registry();
        return WPSG_Settings_Utils::to_js($settings, self::$defaults, self::$admin_only_fields, $admin);
    }

    /**
     * Convert a camelCase JS request body to snake_case input for sanitization.
     *
     * Only includes keys that exist in both the request body and $defaults.
     *
     * @param array $body Decoded JSON body (camelCase keys).
     * @return array Associative array with snake_case keys.
     */
    public static function from_js($body) {
        self::load_registry();
        return WPSG_Settings_Utils::from_js($body, self::$defaults);
    }

    /**
     * Get the defaults array (useful for React-side reference).
     *
     * @return array
     */
    public static function get_defaults() {
        self::load_registry();
        return self::$defaults;
    }

    /**
     * Sanitize settings before saving.
     *
     * @param array $input Raw input array.
     * @return array Sanitized settings.
     */
    public static function sanitize_settings($input) {
        self::load_registry();
        return WPSG_Settings_Sanitizer::sanitize_settings(
            $input,
            self::$defaults,
            self::$valid_options,
            self::$field_ranges
        );
    }

    /**
     * Filter: Provide auth_provider setting value.
     *
     * @param string $default Default value.
     * @return string Auth provider.
     */
    public static function filter_auth_provider($default) {
        return WPSG_Settings_Service::filter_auth_provider($default);
    }

    /**
     * Filter: Provide api_base setting value.
     *
     * @param string $default Default value.
     * @return string API base URL.
     */
    public static function filter_api_base($default) {
        return WPSG_Settings_Service::filter_api_base($default);
    }

    // =========================================================================
    // Section Renderers
    // =========================================================================

    /**
     * Render authentication section description.
     */
    public static function render_auth_section() {
        WPSG_Settings_Core_Fields::render_auth_section();
    }

    /**
     * Render display section description.
     */
    public static function render_display_section() {
        WPSG_Settings_Core_Fields::render_display_section();
    }

    /**
     * Render performance section description.
     */
    public static function render_performance_section() {
        WPSG_Settings_Core_Fields::render_performance_section();
    }

    // =========================================================================
    // Field Renderers
    // =========================================================================

    /**
     * Render auth provider select field.
     */
    public static function render_auth_provider_field() {
        WPSG_Settings_Core_Fields::render_auth_provider_field();
    }

    /**
     * Render API base URL field.
     */
    public static function render_api_base_field() {
        WPSG_Settings_Core_Fields::render_api_base_field();
    }

    /**
     * Render theme select field with all available themes.
     */
    public static function render_theme_field() {
        WPSG_Settings_Core_Fields::render_theme_field();
    }

    /**
     * Render allow user theme override checkbox.
     */
    public static function render_allow_user_theme_override_field() {
        WPSG_Settings_Core_Fields::render_allow_user_theme_override_field();
    }

    /**
     * Render gallery layout select field.
     */
    public static function render_layout_field() {
        WPSG_Settings_Core_Fields::render_layout_field();
    }

    /**
     * Render items per page number field.
     */
    public static function render_items_per_page_field() {
        WPSG_Settings_Core_Fields::render_items_per_page_field();
    }

    /**
     * Render enable lightbox checkbox.
     */
    public static function render_lightbox_field() {
        WPSG_Settings_Core_Fields::render_lightbox_field();
    }

    /**
     * Render enable animations checkbox.
     */
    public static function render_animations_field() {
        WPSG_Settings_Core_Fields::render_animations_field();
    }

    /**
     * Render cache TTL number field.
     */
    public static function render_cache_ttl_field() {
        WPSG_Settings_Core_Fields::render_cache_ttl_field();
    }

    // =========================================================================
    // Settings Page
    // =========================================================================

    /**
     * Render the settings page.
     */
    public static function render_settings_page() {
        WPSG_Settings_Renderer::render_settings_page();
    }

    /**
     * AJAX handler for testing authentication.
     */
    public static function ajax_test_auth() {
        WPSG_Settings_Service::ajax_test_auth();
    }
}
