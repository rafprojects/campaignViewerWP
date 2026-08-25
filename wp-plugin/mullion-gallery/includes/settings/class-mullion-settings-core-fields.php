<?php
/**
 * Core settings sections and field renderers for Mullion.
 *
 * Keeps the Settings API registration layer thin by moving the initial
 * auth/display/performance callbacks into a dedicated module.
 *
 * @package Mullion
 */

if (!defined('ABSPATH')) {
    exit;
}

class Mullion_Settings_Core_Fields {

    /**
     * Render authentication section description.
     *
     * @return void
     */
    public static function render_auth_section() {
        echo '<p>' . esc_html__('Configure how the gallery authenticates with the WordPress REST API.', 'mullion-gallery') . '</p>';
    }

    /**
     * Render display section description.
     *
     * @return void
     */
    public static function render_display_section() {
        echo '<p>' . esc_html__('Configure default display settings for galleries.', 'mullion-gallery') . '</p>';
    }

    /**
     * Render auth bar section description.
     *
     * @return void
     */
    public static function render_authbar_section() {
        echo '<p>' . esc_html__('Global auth bar appearance. Override per-page with the auth_bar_mode shortcode attribute.', 'mullion-gallery') . '</p>';
    }

    /**
     * Render auth bar display mode select field.
     *
     * @return void
     */
    public static function render_auth_bar_display_mode_field() {
        $value   = Mullion_Settings::get_setting('auth_bar_display_mode') ?: 'floating';
        $options = [
            'floating'  => __('Floating (circular icon, bottom-right)', 'mullion-gallery'),
            'draggable' => __('Draggable (movable floating icon)', 'mullion-gallery'),
            'bar'       => __('Bar (full-width sticky bar)', 'mullion-gallery'),
            'auto-hide' => __('Auto-hide (bar hides on scroll)', 'mullion-gallery'),
            'minimal'   => __('Minimal (thin strip, ≤32px)', 'mullion-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[auth_bar_display_mode]" id="wpsg_auth_bar_display_mode">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('How the authentication bar appears on all gallery pages. Use the auth_bar_mode shortcode attribute to override on a specific page.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render auth bar drag margin field (only relevant for draggable mode).
     *
     * @return void
     */
    public static function render_auth_bar_drag_margin_field() {
        $value = (int) (Mullion_Settings::get_setting('auth_bar_drag_margin') ?? 16);
        ?>
        <input type="number"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[auth_bar_drag_margin]"
               id="wpsg_auth_bar_drag_margin"
               value="<?php echo esc_attr($value); ?>"
               class="small-text"
               min="0"
               max="64">
        <p class="description">
            <?php esc_html_e('Minimum distance from viewport edges when dragging (draggable mode only).', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render performance section description.
     *
     * @return void
     */
    public static function render_performance_section() {
        echo '<p>' . esc_html__('Configure caching and performance settings.', 'mullion-gallery') . '</p>';
    }

    /**
     * Render auth provider select field.
     *
     * @return void
     */
    public static function render_auth_provider_field() {
        $value = Mullion_Settings::get_setting('auth_provider');
        $options = [
            'wp-jwt' => __('WordPress JWT (Recommended)', 'mullion-gallery'),
            'none'   => __('None (Public Access Only)', 'mullion-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[auth_provider]" id="wpsg_auth_provider">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Select the authentication method for REST API access.', 'mullion-gallery'); ?>
        </p>
        <p style="margin-top: 10px;">
            <button type="button" class="button" id="wpsg-test-auth">
                <?php esc_html_e('Test Connection', 'mullion-gallery'); ?>
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
        $value = Mullion_Settings::get_setting('api_base');
        ?>
        <input type="url"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[api_base]"
               id="wpsg_api_base"
               value="<?php echo esc_attr($value); ?>"
               class="regular-text"
               placeholder="<?php echo esc_attr(home_url()); ?>">
        <p class="description">
            <?php esc_html_e('Leave empty to use the current site URL. Only change this for multi-site or headless setups.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render theme select field with all available themes.
     *
     * @return void
     */
    /**
     * Load theme groups from the shared theme-catalog.json.
     *
     * Returns an associative array keyed by translated group label, each
     * containing an associative array of theme-id => translated display name.
     * Falls back to a hard-coded list if the catalog file is unreadable.
     *
     * @return array<string, array<string, string>>
     */
    private static function get_theme_groups(): array {
        $catalog_path = plugin_dir_path(__FILE__) . '../../theme-catalog.json';
        if (file_exists($catalog_path)) {
            $json = file_get_contents($catalog_path); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
            if ($json !== false) {
                $entries = json_decode($json, true);
                if (is_array($entries)) {
                    $groups = [];
                    foreach ($entries as $entry) {
                        if (!isset($entry['id'], $entry['name'], $entry['group'])) {
                            continue;
                        }
                        // The catalog is the display source of truth for group and theme names.
                        // Dynamic strings can't be extracted by WP i18n tools, so we use the
                        // catalog values directly. The hard-coded fallback below covers the
                        // extractable/translatable path for the shipped theme set.
                        $groups[$entry['group']][$entry['id']] = $entry['name'];
                    }
                    return $groups;
                }
            }
        }

        // Fallback: hard-coded full list matching the catalog (all 23 themes).
        return [
            __('Default', 'mullion-gallery') => [
                'default-dark'  => __('Default Dark', 'mullion-gallery'),
                'default-light' => __('Default Light', 'mullion-gallery'),
            ],
            __('Material', 'mullion-gallery') => [
                'material-dark'  => __('Material Dark', 'mullion-gallery'),
                'material-light' => __('Material Light', 'mullion-gallery'),
            ],
            __('Classic', 'mullion-gallery') => [
                'darcula' => __('Darcula', 'mullion-gallery'),
                'nord'    => __('Nord', 'mullion-gallery'),
            ],
            __('Solarized', 'mullion-gallery') => [
                'solarized-dark'  => __('Solarized Dark', 'mullion-gallery'),
                'solarized-light' => __('Solarized Light', 'mullion-gallery'),
            ],
            __('Accessibility', 'mullion-gallery') => [
                'high-contrast' => __('High Contrast', 'mullion-gallery'),
            ],
            __('Community', 'mullion-gallery') => [
                'catppuccin-mocha' => __('Catppuccin Mocha', 'mullion-gallery'),
                'catppuccin-latte' => __('Catppuccin Latte', 'mullion-gallery'),
                'tokyo-night'      => __('Tokyo Night', 'mullion-gallery'),
                'gruvbox-dark'     => __('Gruvbox Dark', 'mullion-gallery'),
                'github-light'     => __('GitHub Light', 'mullion-gallery'),
            ],
            __('Neon', 'mullion-gallery') => [
                'cyberpunk' => __('Cyberpunk', 'mullion-gallery'),
                'synthwave' => __("Synthwave '84", 'mullion-gallery'),
            ],
            __('Artistic', 'mullion-gallery') => [
                'sunset-boulevard' => __('Sunset Boulevard', 'mullion-gallery'),
                'ocean-breeze'     => __('Ocean Breeze', 'mullion-gallery'),
                'crimson-canvas'   => __('Crimson Canvas', 'mullion-gallery'),
                'forest-whisper'   => __('Forest Whisper', 'mullion-gallery'),
                'midnight-rose'    => __('Midnight Rose', 'mullion-gallery'),
            ],
            __('Seasonal', 'mullion-gallery') => [
                'halloween'         => __('Halloween', 'mullion-gallery'),
                'reverse-halloween' => __('Reverse Halloween', 'mullion-gallery'),
            ],
        ];
    }

    public static function render_theme_field() {
        $value        = Mullion_Settings::get_setting('theme');
        $theme_groups = self::get_theme_groups();
        ?>
        <select name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[theme]" id="wpsg_theme">
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
            <?php esc_html_e('Default color theme for gallery display. Users can override this if allowed below.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render allow user theme override checkbox.
     *
     * @return void
     */
    public static function render_allow_user_theme_override_field() {
        $value = Mullion_Settings::get_setting('allow_user_theme_override');
        ?>
        <input type="hidden"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[allow_user_theme_override]"
               value="0">
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[allow_user_theme_override]"
                   id="wpsg_allow_user_theme_override"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Allow visitors to switch themes via the gallery UI.', 'mullion-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('When disabled, the gallery will always use the theme selected above and hide the theme picker from visitors.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render debug component markers checkbox.
     *
     * @return void
     */
    public static function render_debug_component_markers_field() {
        $value = Mullion_Settings::get_setting('debug_component_markers');
        ?>
        <input type="hidden"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[debug_component_markers]"
               value="0">
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[debug_component_markers]"
                   id="wpsg_debug_component_markers"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Keep React DevTools names and emit DOM component markers in deployed builds.', 'mullion-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Adds explicit component names for React DevTools in production builds and injects data-wpsg-component/data-wpsg-slot attributes for browser Elements inspection, QA selectors, and UI-surface debugging.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render gallery layout select field.
     *
     * @return void
     */
    public static function render_layout_field() {
        $value = Mullion_Settings::get_setting('gallery_layout');
        $options = [
            'grid'     => __('Grid', 'mullion-gallery'),
            'masonry'  => __('Masonry', 'mullion-gallery'),
            'carousel' => __('Carousel', 'mullion-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[gallery_layout]" id="wpsg_gallery_layout">
            <?php foreach ($options as $key => $label) : ?>
                <option value="<?php echo esc_attr($key); ?>" <?php selected($value, $key); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('Default layout for displaying gallery items.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render items per page number field.
     *
     * @return void
     */
    public static function render_items_per_page_field() {
        $value = Mullion_Settings::get_setting('items_per_page');
        ?>
        <input type="number"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[items_per_page]"
               id="wpsg_items_per_page"
               value="<?php echo esc_attr($value); ?>"
               min="1"
               max="100"
               step="1"
               class="small-text">
        <p class="description">
            <?php esc_html_e('Number of items to display per page (1-100).', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render enable lightbox checkbox.
     *
     * @return void
     */
    public static function render_lightbox_field() {
        $value = Mullion_Settings::get_setting('enable_lightbox');
        ?>
        <input type="hidden"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[enable_lightbox]"
               value="0">
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[enable_lightbox]"
                   id="wpsg_enable_lightbox"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Enable fullscreen lightbox when clicking gallery items.', 'mullion-gallery'); ?>
        </label>
        <?php
    }

    /**
     * Render enable animations checkbox.
     *
     * @return void
     */
    public static function render_animations_field() {
        $value = Mullion_Settings::get_setting('enable_animations');
        ?>
        <input type="hidden"
               name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[enable_animations]"
               value="0">
        <label>
            <input type="checkbox"
                   name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[enable_animations]"
                   id="wpsg_enable_animations"
                   value="1"
                   <?php checked((bool) $value, true); ?>>
            <?php esc_html_e('Enable smooth animations and transitions.', 'mullion-gallery'); ?>
        </label>
        <p class="description">
            <?php esc_html_e('Disable for better performance on low-end devices.', 'mullion-gallery'); ?>
        </p>
        <?php
    }

    /**
     * Render cache TTL select field.
     *
     * @return void
     */
    public static function render_cache_ttl_field() {
        $value = Mullion_Settings::get_setting('cache_ttl');
        $options = [
            0      => __('Disabled', 'mullion-gallery'),
            10     => __('10 seconds', 'mullion-gallery'),
            30     => __('30 seconds', 'mullion-gallery'),
            60     => __('1 minute', 'mullion-gallery'),
            300    => __('5 minutes', 'mullion-gallery'),
            900    => __('15 minutes', 'mullion-gallery'),
            1200   => __('20 minutes', 'mullion-gallery'),
            1800   => __('30 minutes', 'mullion-gallery'),
            2700   => __('45 minutes', 'mullion-gallery'),
            3600   => __('1 hour', 'mullion-gallery'),
            7200   => __('2 hours', 'mullion-gallery'),
            14400  => __('4 hours', 'mullion-gallery'),
            28800  => __('8 hours', 'mullion-gallery'),
            43200  => __('12 hours', 'mullion-gallery'),
            86400  => __('1 day', 'mullion-gallery'),
            259200 => __('3 days', 'mullion-gallery'),
            604800 => __('1 week', 'mullion-gallery'),
        ];
        ?>
        <select name="<?php echo esc_attr(Mullion_Settings::OPTION_NAME); ?>[cache_ttl]" id="wpsg_cache_ttl">
            <?php foreach ($options as $seconds => $label) : ?>
                <option value="<?php echo esc_attr($seconds); ?>" <?php selected($value, $seconds); ?>>
                    <?php echo esc_html($label); ?>
                </option>
            <?php endforeach; ?>
        </select>
        <p class="description">
            <?php esc_html_e('How long to cache API responses. Higher values improve performance but show stale data.', 'mullion-gallery'); ?>
        </p>
        <?php
    }
}