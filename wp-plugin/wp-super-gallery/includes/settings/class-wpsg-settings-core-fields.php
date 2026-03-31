<?php
/**
 * Core settings sections and field renderers for WP Super Gallery.
 *
 * Keeps the Settings API registration layer thin by moving the initial
 * auth/display/performance callbacks into a dedicated module.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Settings_Core_Fields {

    /**
     * Render authentication section description.
     *
     * @return void
     */
    public static function render_auth_section() {
        echo '<p>' . esc_html__('Configure how the gallery authenticates with the WordPress REST API.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render display section description.
     *
     * @return void
     */
    public static function render_display_section() {
        echo '<p>' . esc_html__('Configure default display settings for galleries.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render performance section description.
     *
     * @return void
     */
    public static function render_performance_section() {
        echo '<p>' . esc_html__('Configure caching and performance settings.', 'wp-super-gallery') . '</p>';
    }

    /**
     * Render auth provider select field.
     *
     * @return void
     */
    public static function render_auth_provider_field() {
        $value = WPSG_Settings::get_setting('auth_provider');
        $options = [
            'wp-jwt' => __('WordPress JWT (Recommended)', 'wp-super-gallery'),
            'none'   => __('None (Public Access Only)', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[auth_provider]" id="wpsg_auth_provider">
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
     *
     * @return void
     */
    public static function render_api_base_field() {
        $value = WPSG_Settings::get_setting('api_base');
        ?>
        <input type="url"
               name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[api_base]"
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
     *
     * @return void
     */
    public static function render_theme_field() {
        $value = WPSG_Settings::get_setting('theme');
        $theme_groups = [
            __('Default', 'wp-super-gallery') => [
                'default-dark'  => __('Default Dark', 'wp-super-gallery'),
                'default-light' => __('Default Light', 'wp-super-gallery'),
            ],
            __('Material', 'wp-super-gallery') => [
                'material-dark'  => __('Material Dark', 'wp-super-gallery'),
                'material-light' => __('Material Light', 'wp-super-gallery'),
            ],
            __('Classic', 'wp-super-gallery') => [
                'darcula' => __('Darcula', 'wp-super-gallery'),
                'nord'    => __('Nord', 'wp-super-gallery'),
            ],
            __('Solarized', 'wp-super-gallery') => [
                'solarized-dark'  => __('Solarized Dark', 'wp-super-gallery'),
                'solarized-light' => __('Solarized Light', 'wp-super-gallery'),
            ],
            __('Accessibility', 'wp-super-gallery') => [
                'high-contrast' => __('High Contrast (WCAG AAA)', 'wp-super-gallery'),
            ],
            __('Community', 'wp-super-gallery') => [
                'catppuccin-mocha' => __('Catppuccin Mocha', 'wp-super-gallery'),
                'catppuccin-latte' => __('Catppuccin Latte', 'wp-super-gallery'),
                'tokyo-night'      => __('Tokyo Night', 'wp-super-gallery'),
                'gruvbox-dark'     => __('Gruvbox Dark', 'wp-super-gallery'),
                'github-light'     => __('GitHub Light', 'wp-super-gallery'),
            ],
            __('Neon', 'wp-super-gallery') => [
                'cyberpunk' => __('Cyberpunk', 'wp-super-gallery'),
                'synthwave' => __('Synthwave \'84', 'wp-super-gallery'),
            ],
        ];
        ?>
        <select name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[theme]" id="wpsg_theme">
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
     *
     * @return void
     */
    public static function render_allow_user_theme_override_field() {
        $value = WPSG_Settings::get_setting('allow_user_theme_override');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[allow_user_theme_override]"
                   id="wpsg_allow_user_theme_override"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Allow visitors to switch themes via the gallery UI.', 'wp-super-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('When disabled, the gallery will always use the theme selected above and hide the theme picker from visitors.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render gallery layout select field.
     *
     * @return void
     */
    public static function render_layout_field() {
        $value = WPSG_Settings::get_setting('gallery_layout');
        $options = [
            'grid'     => __('Grid', 'wp-super-gallery'),
            'masonry'  => __('Masonry', 'wp-super-gallery'),
            'carousel' => __('Carousel', 'wp-super-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[gallery_layout]" id="wpsg_gallery_layout">
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
     *
     * @return void
     */
    public static function render_items_per_page_field() {
        $value = WPSG_Settings::get_setting('items_per_page');
        ?>
        <input type="number"
               name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[items_per_page]"
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
     *
     * @return void
     */
    public static function render_lightbox_field() {
        $value = WPSG_Settings::get_setting('enable_lightbox');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[enable_lightbox]"
                   id="wpsg_enable_lightbox"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Enable fullscreen lightbox when clicking gallery items.', 'wp-super-gallery'); ?>
        </label>
        <?php
    }

    /**
     * Render enable animations checkbox.
     *
     * @return void
     */
    public static function render_animations_field() {
        $value = WPSG_Settings::get_setting('enable_animations');
        ?>
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[enable_animations]"
                   id="wpsg_enable_animations"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Enable smooth animations and transitions.', 'wp-super-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Disable for better performance on low-end devices.', 'wp-super-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render cache TTL select field.
     *
     * @return void
     */
    public static function render_cache_ttl_field() {
        $value = WPSG_Settings::get_setting('cache_ttl');
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
        <select name="<?php echo esc_attr(WPSG_Settings::OPTION_NAME); ?>[cache_ttl]" id="wpsg_cache_ttl">
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
}