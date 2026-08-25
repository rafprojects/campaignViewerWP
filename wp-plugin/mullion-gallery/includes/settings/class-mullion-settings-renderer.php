<?php
/**
 * Admin renderer and Settings API registration for Mullion settings.
 *
 * This is an intermediate extraction from the legacy settings class. It keeps
 * the existing Mullion_Settings field callbacks intact while moving the admin
 * wiring and page shell into a dedicated module.
 *
 * @package Mullion
 */

if (!defined('ABSPATH')) {
    exit;
}

class Mullion_Settings_Renderer {

    /**
     * Admin hook suffix for the settings page.
     *
     * @var string
     */
    private static $settings_page_hook = '';

    /**
     * Register admin hooks for the settings page.
     *
     * @return void
     */
    public static function init() {
        add_action('admin_menu', [self::class, 'add_menu_page']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_admin_assets']);
        add_action('wp_ajax_mullion_test_auth', ['Mullion_Settings_Service', 'ajax_test_auth']);
    }

    /**
     * Add the settings page to the admin menu.
     *
     * @return void
     */
    public static function add_menu_page() {
        self::$settings_page_hook = add_submenu_page(
            'edit.php?post_type=mullion_campaign',
            __('Super Gallery Settings', 'mullion-gallery'),
            __('Settings', 'mullion-gallery'),
            'manage_options',
            Mullion_Settings::PAGE_SLUG,
            [self::class, 'render_settings_page']
        );
    }

    /**
     * Enqueue settings-page-only admin assets.
     *
     * @param string $hook_suffix Current admin page hook suffix.
     * @return void
     */
    public static function enqueue_admin_assets($hook_suffix) {
        if (empty(self::$settings_page_hook) || self::$settings_page_hook !== $hook_suffix) {
            return;
        }

        wp_register_script(
            'mullion-settings-admin',
            MULLION_PLUGIN_URL . 'includes/settings/assets/settings-auth-test.js',
            [],
            MULLION_VERSION,
            true
        );

        wp_localize_script(
            'mullion-settings-admin',
            'mullionSettingsAuthTest',
            [
                'ajaxUrl'              => admin_url('admin-ajax.php'),
                'nonce'                => wp_create_nonce('mullion_test_auth'),
                'testingText'          => __('Testing...', 'mullion-gallery'),
                'connectionFailedText' => __('Connection failed', 'mullion-gallery'),
                'requestFailedText'    => __('Request failed', 'mullion-gallery'),
                'authRejectedText'     => __('Authentication test was rejected. Refresh the page and try again.', 'mullion-gallery'),
                'unexpectedResponseText' => __('Unexpected server response while testing authentication.', 'mullion-gallery'),
            ]
        );

        wp_enqueue_script('mullion-settings-admin');
    }

    /**
     * Register settings and the initial field groups with the Settings API.
     *
     * @return void
     */
    public static function register_settings() {
        register_setting(
            'mullion_settings_group',
            Mullion_Settings::OPTION_NAME,
            [
                'type'              => 'array',
                'sanitize_callback' => ['Mullion_Settings', 'sanitize_settings'],
                'default'           => Mullion_Settings::get_defaults(),
            ]
        );

        add_settings_section(
            'mullion_auth_section',
            __('Authentication', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_auth_section'],
            Mullion_Settings::PAGE_SLUG
        );

        add_settings_field(
            'auth_provider',
            __('Auth Provider', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_auth_provider_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_auth_section'
        );

        add_settings_field(
            'api_base',
            __('API Base URL', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_api_base_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_auth_section'
        );

        add_settings_section(
            'mullion_display_section',
            __('Display Settings', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_display_section'],
            Mullion_Settings::PAGE_SLUG
        );

        add_settings_field(
            'theme',
            __('Theme', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_theme_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_field(
            'allow_user_theme_override',
            __('Allow User Theme Override', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_allow_user_theme_override_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_field(
            'debug_component_markers',
            __('Component Debug Names & Markers', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_debug_component_markers_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_field(
            'gallery_layout',
            __('Default Layout', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_layout_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_field(
            'items_per_page',
            __('Items Per Page', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_items_per_page_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_field(
            'enable_lightbox',
            __('Enable Lightbox', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_lightbox_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_field(
            'enable_animations',
            __('Enable Animations', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_animations_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_display_section'
        );

        add_settings_section(
            'mullion_authbar_section',
            __('Auth Bar', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_authbar_section'],
            Mullion_Settings::PAGE_SLUG
        );

        add_settings_field(
            'auth_bar_display_mode',
            __('Display Mode', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_auth_bar_display_mode_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_authbar_section'
        );

        add_settings_field(
            'auth_bar_drag_margin',
            __('Drag Margin (px)', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_auth_bar_drag_margin_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_authbar_section'
        );

        add_settings_section(
            'mullion_performance_section',
            __('Performance', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_performance_section'],
            Mullion_Settings::PAGE_SLUG
        );

        add_settings_field(
            'cache_ttl',
            __('Cache Duration', 'mullion-gallery'),
            ['Mullion_Settings_Core_Fields', 'render_cache_ttl_field'],
            Mullion_Settings::PAGE_SLUG,
            'mullion_performance_section'
        );
    }

    /**
     * Render the settings page shell.
     *
     * @return void
     */
    public static function render_settings_page() {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

            <?php settings_errors('mullion_messages'); ?>

            <form action="options.php" method="post">
                <?php
                settings_fields('mullion_settings_group');
                do_settings_sections(Mullion_Settings::PAGE_SLUG);
                submit_button(__('Save Settings', 'mullion-gallery'));
                ?>
            </form>

            <hr>

            <h2><?php esc_html_e('Shortcode Usage', 'mullion-gallery'); ?></h2>
            <p><?php esc_html_e('Embed a gallery using the following shortcode:', 'mullion-gallery'); ?></p>
            <code>[mullion-gallery campaign="your-campaign-slug"]</code>

            <h3><?php esc_html_e('Shortcode Attributes', 'mullion-gallery'); ?></h3>
            <table class="widefat" style="max-width: 600px;">
                <thead>
                    <tr>
                        <th><?php esc_html_e('Attribute', 'mullion-gallery'); ?></th>
                        <th><?php esc_html_e('Description', 'mullion-gallery'); ?></th>
                        <th><?php esc_html_e('Default', 'mullion-gallery'); ?></th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><code>campaign</code></td>
                        <td><?php esc_html_e('Campaign slug or ID to display', 'mullion-gallery'); ?></td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td><code>company</code></td>
                        <td><?php esc_html_e('Filter by company slug', 'mullion-gallery'); ?></td>
                        <td>—</td>
                    </tr>
                    <tr>
                        <td><code>compact</code></td>
                        <td><?php esc_html_e('Use compact display mode', 'mullion-gallery'); ?></td>
                        <td>false</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <?php
    }
}