<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Embed {
    private static $manifest_cache = null;

    public static function register_shortcode() {
        add_shortcode('super-gallery', [self::class, 'render_shortcode']);
    }

    public static function register_assets() {
        $handle = 'wp-super-gallery-app';
        $base_url = WPSG_PLUGIN_URL . 'assets/';
        $manifest = self::get_manifest();
        $entry = isset($manifest['index.html']) ? $manifest['index.html'] : null;

        add_action('send_headers', [self::class, 'add_asset_cache_headers']);

        if ($entry && isset($entry['file'])) {
            $script_url = $base_url . $entry['file'];
            wp_register_script($handle, $script_url, [], WPSG_VERSION, true);

            if (!empty($entry['css'])) {
                foreach ($entry['css'] as $index => $css_file) {
                    $style_handle = $handle . '-style-' . $index;
                    wp_register_style($style_handle, $base_url . $css_file, [], WPSG_VERSION);
                }
            }

            // Add filter to load script as ES module (required for Vite code splitting)
            add_filter('script_loader_tag', [self::class, 'add_module_type'], 10, 3);
            return;
        }

        $script_url = $base_url . 'wp-super-gallery.js';
        wp_register_script($handle, $script_url, [], WPSG_VERSION, true);
    }

    public static function add_asset_cache_headers() {
        if (headers_sent()) {
            return;
        }

        $uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
        if (empty($uri)) {
            return;
        }

        if (strpos($uri, '/wp-content/plugins/wp-super-gallery/assets/') === false) {
            return;
        }

        $path = wp_parse_url($uri, PHP_URL_PATH);
        $ext = $path ? strtolower(pathinfo($path, PATHINFO_EXTENSION)) : '';
        $cacheable = ['js', 'css', 'svg', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'woff2', 'woff', 'ttf', 'eot'];

        if (!in_array($ext, $cacheable, true)) {
            return;
        }

        header('Cache-Control: public, max-age=31536000, immutable');
    }

    /**
     * Add type="module" to the script tag for ES module support.
     */
    public static function add_module_type($tag, $handle, $src) {
        if ($handle !== 'wp-super-gallery-app') {
            return $tag;
        }
        // Replace the script tag to use type="module"
        return str_replace('<script ', '<script type="module" ', $tag);
    }

    public static function render_shortcode($atts = []) {
        $GLOBALS['wpsg_has_shortcode'] = true;
        $atts = shortcode_atts([
            'campaign' => '',
            'company' => '',
            'compact' => 'false',
        ], $atts, 'super-gallery');

        $classes = ['wp-super-gallery'];
        if ($atts['compact'] === 'true') {
            $classes[] = 'wp-super-gallery--compact';
        }

        wp_enqueue_script('wp-super-gallery-app');

        $auth_provider = apply_filters('wpsg_auth_provider', 'wp-jwt');
        $api_base = apply_filters('wpsg_api_base', home_url());
        $sentry_dsn = apply_filters('wpsg_sentry_dsn', '');

        // Get display settings from WPSG_Settings if available.
        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [];
        $theme = isset($settings['theme']) ? $settings['theme'] : 'dark';
        $gallery_layout = isset($settings['gallery_layout']) ? $settings['gallery_layout'] : 'grid';
        $enable_lightbox = isset($settings['enable_lightbox']) ? $settings['enable_lightbox'] : true;
        $enable_animations = isset($settings['enable_animations']) ? $settings['enable_animations'] : true;

        $manifest = self::get_manifest();
        $entry = isset($manifest['index.html']) ? $manifest['index.html'] : null;
        if ($entry && !empty($entry['css'])) {
            foreach ($entry['css'] as $index => $css_file) {
                $style_handle = 'wp-super-gallery-app-style-' . $index;
                if (!wp_style_is($style_handle, 'enqueued')) {
                    wp_enqueue_style($style_handle);
                }
            }
        }

        $props = esc_attr(wp_json_encode([
            'campaign' => $atts['campaign'],
            'company' => $atts['company'],
        ]));

        // Build config object with all settings.
        $config = [
            'authProvider'     => $auth_provider,
            'apiBase'          => $api_base,
            'theme'            => $theme,
            'galleryLayout'    => $gallery_layout,
            'enableLightbox'   => $enable_lightbox,
            'enableAnimations' => $enable_animations,
            'sentryDsn'         => $sentry_dsn,
            'restNonce'         => wp_create_nonce('wp_rest'),
        ];

        $config_script = '<script>' .
            'window.__WPSG_CONFIG__ = ' . wp_json_encode($config) . ';' .
            // Keep legacy globals for backward compatibility.
            'window.__WPSG_AUTH_PROVIDER__ = ' . wp_json_encode($auth_provider) . ';' .
            'window.__WPSG_API_BASE__ = ' . wp_json_encode($api_base) . ';' .
            '</script>';

        return $config_script . '<div class="' . esc_attr(implode(' ', $classes)) . '" data-wpsg-props="' . $props . '"></div>';
    }

    private static function get_manifest() {
        if (self::$manifest_cache !== null) {
            return self::$manifest_cache;
        }

        $manifest_path = WPSG_PLUGIN_DIR . 'assets/manifest.json';
        $manifest_alt_path = WPSG_PLUGIN_DIR . 'assets/.vite/manifest.json';
        $resolved_manifest_path = file_exists($manifest_path) ? $manifest_path : $manifest_alt_path;

        if (file_exists($resolved_manifest_path)) {
            $content = file_get_contents($resolved_manifest_path);
            if ($content !== false) {
                $manifest = json_decode($content, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($manifest)) {
                    self::$manifest_cache = $manifest;
                    return self::$manifest_cache;
                }
            }
        }

        self::$manifest_cache = [];
        return self::$manifest_cache;
    }
}
