<?php
/**
 * Admin renderer and Settings API registration for WP Super Gallery settings.
 *
 * This is an intermediate extraction from the legacy settings class. It keeps
 * the existing WPSG_Settings field callbacks intact while moving the admin
 * wiring and page shell into a dedicated module.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Settings_Renderer {

    /**
     * Register admin hooks for the settings page.
     *
     * @return void
     */
    public static function init() {
        add_action('admin_menu', [self::class, 'add_menu_page']);
        add_action('admin_init', [self::class, 'register_settings']);
        add_action('wp_ajax_wpsg_test_auth', ['WPSG_Settings_Service', 'ajax_test_auth']);
    }

    /**
     * Add the settings page to the admin menu.
     *
     * @return void
     */
    public static function add_menu_page() {
        add_submenu_page(
            'edit.php?post_type=wpsg_campaign',
            __('Super Gallery Settings', 'wp-super-gallery'),
            __('Settings', 'wp-super-gallery'),
            'manage_options',
            WPSG_Settings::PAGE_SLUG,
            [self::class, 'render_settings_page']
        );
    }

    /**
     * Register settings and the initial field groups with the Settings API.
     *
     * @return void
     */
    public static function register_settings() {
        register_setting(
            'wpsg_settings_group',
            WPSG_Settings::OPTION_NAME,
            [
                'type'              => 'array',
                'sanitize_callback' => ['WPSG_Settings', 'sanitize_settings'],
                'default'           => WPSG_Settings::get_defaults(),
            ]
        );

        add_settings_section(
            'wpsg_auth_section',
            __('Authentication', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_auth_section'],
            WPSG_Settings::PAGE_SLUG
        );

        add_settings_field(
            'auth_provider',
            __('Auth Provider', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_auth_provider_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_auth_section'
        );

        add_settings_field(
            'api_base',
            __('API Base URL', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_api_base_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_auth_section'
        );

        add_settings_section(
            'wpsg_display_section',
            __('Display Settings', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_display_section'],
            WPSG_Settings::PAGE_SLUG
        );

        add_settings_field(
            'theme',
            __('Theme', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_theme_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'allow_user_theme_override',
            __('Allow User Theme Override', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_allow_user_theme_override_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'gallery_layout',
            __('Default Layout', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_layout_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'items_per_page',
            __('Items Per Page', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_items_per_page_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'enable_lightbox',
            __('Enable Lightbox', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_lightbox_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_field(
            'enable_animations',
            __('Enable Animations', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_animations_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_display_section'
        );

        add_settings_section(
            'wpsg_performance_section',
            __('Performance', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_performance_section'],
            WPSG_Settings::PAGE_SLUG
        );

        add_settings_field(
            'cache_ttl',
            __('Cache Duration', 'wp-super-gallery'),
            ['WPSG_Settings_Core_Fields', 'render_cache_ttl_field'],
            WPSG_Settings::PAGE_SLUG,
            'wpsg_performance_section'
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

            <?php settings_errors('wpsg_messages'); ?>

            <form action="options.php" method="post">
                <?php
                settings_fields('wpsg_settings_group');
                do_settings_sections(WPSG_Settings::PAGE_SLUG);
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
                    .catch(function() {
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
}