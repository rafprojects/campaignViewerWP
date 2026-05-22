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
 *
 * This class owns the canonical settings interface: reading, writing, sanitizing,
 * and converting settings between PHP and JS representations.  Rendering, field
 * registration, and service-level filter hooks live in the dedicated sub-modules
 * (WPSG_Settings_Renderer, WPSG_Settings_Core_Fields, WPSG_Settings_Service) and
 * are NOT proxied through this class.
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

        // Register WP filters directly on the service that owns the logic.
        add_filter('wpsg_auth_provider', ['WPSG_Settings_Service', 'filter_auth_provider']);
        add_filter('wpsg_api_base',      ['WPSG_Settings_Service', 'filter_api_base']);
    }

    /**
     * Load settings metadata from the extracted registry once per request.
     */
    private static function load_registry() {
        if (self::$registry_loaded) {
            return;
        }

        self::$defaults          = WPSG_Settings_Registry::get_defaults();
        self::$admin_only_fields = WPSG_Settings_Registry::get_admin_only_fields();
        self::$valid_options     = WPSG_Settings_Registry::get_valid_options();
        self::$field_ranges      = WPSG_Settings_Registry::get_field_ranges();
        self::$registry_loaded   = true;
    }

    // =========================================================================
    // Core settings interface
    // =========================================================================

    /**
     * Get all settings with defaults applied.
     *
     * @return array Settings array.
     */
    public static function get_settings() {
        self::load_registry();
        $stored_settings = get_option(self::OPTION_NAME, []);
        $settings = WPSG_Settings_Sanitizer::normalize_card_config_settings(
            wp_parse_args($stored_settings, self::$defaults)
        );

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

    // =========================================================================
    // JS ↔ PHP conversion
    // =========================================================================

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
}
