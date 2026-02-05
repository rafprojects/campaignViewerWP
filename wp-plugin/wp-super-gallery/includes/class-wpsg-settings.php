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
        'auth_provider'     => 'wp-jwt',
        'api_base'          => '',
        'theme'             => 'dark',
        'gallery_layout'    => 'grid',
        'items_per_page'    => 12,
        'enable_lightbox'   => true,
        'enable_animations' => true,
        'cache_ttl'         => 3600,
    ];

    /**
     * Valid options for select fields.
     *
     * @var array
     */
    private static $valid_options = [
        'auth_provider'  => ['wp-jwt', 'none'],
        'theme'          => ['dark', 'light', 'auto'],
        'gallery_layout' => ['grid', 'masonry', 'carousel'],
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

        // Boolean fields.
        $sanitized['enable_lightbox']   = !empty($input['enable_lightbox']);
        $sanitized['enable_animations'] = !empty($input['enable_animations']);

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
     * Render theme select field.
     */
    public static function render_theme_field() {
        $value = self::get_setting('theme');
        $options = [
            'dark'  => __('Dark', 'wp-super-gallery'),
            'light' => __('Light', 'wp-super-gallery'),
            'auto'  => __('Auto (Match System)', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(self::OPTION_NAME); ?>[theme]" id="wpsg_theme">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Default color theme for gallery display.', 'wp-super-gallery'); ?>
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
