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
            // Vite entry/chunk filenames are content-hashed already. Avoid a
            // WordPress `?ver=` query on ES module entrypoints or the browser
            // will treat the entry script and lazy-loaded `./index-*.js`
            // imports as distinct module URLs, duplicating app state.
            wp_register_script($handle, $script_url, [], null, true);

            if (!empty($entry['css'])) {
                foreach ($entry['css'] as $index => $css_file) {
                    $style_handle = $handle . '-style-' . $index;
                    wp_register_style($style_handle, $base_url . $css_file, [], null);
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

        $uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
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
            'company'  => '',
            'compact'  => 'false',
            'space'    => '',
        ], $atts, 'super-gallery');

        $space_id = self::resolve_space_id($atts);

        $classes = ['wp-super-gallery'];
        if ($atts['compact'] === 'true') {
            $classes[] = 'wp-super-gallery--compact';
        }

        wp_enqueue_script('wp-super-gallery-app');

        $auth_provider = apply_filters('wpsg_auth_provider', 'wp-jwt');
        $api_base = apply_filters('wpsg_api_base', home_url());
        $sentry_dsn = apply_filters('wpsg_sentry_dsn', '');

        // Get effective settings for this space (falls back to global defaults).
        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_effective_settings($space_id) : [];
        $theme = isset($settings['theme']) ? $settings['theme'] : 'default-dark';
        $allow_user_theme_override = isset($settings['allow_user_theme_override']) ? (bool) $settings['allow_user_theme_override'] : true;
        $debug_component_markers = isset($settings['debug_component_markers']) ? (bool) $settings['debug_component_markers'] : true;
        $gallery_layout = isset($settings['gallery_layout']) ? $settings['gallery_layout'] : 'grid';
        $enable_lightbox = isset($settings['enable_lightbox']) ? $settings['enable_lightbox'] : true;
        $enable_animations = isset($settings['enable_animations']) ? $settings['enable_animations'] : true;

        // Enqueue Google Fonts server-side so they load even if JS injection is blocked.
        if (class_exists('WPSG_Settings_Typography')) {
            $families = WPSG_Settings_Typography::extract_google_font_families($settings);
            if (!empty($families)) {
                $specs = WPSG_Settings_Typography::GOOGLE_FONT_SPECS;
                $params = array_map(function ($f) use ($specs) {
                    $spec = isset($specs[$f]) ? $specs[$f] : null;
                    if ($spec === null) {
                        return 'family=' . rawurlencode($f);
                    }
                    return 'family=' . rawurlencode($f) . ':' . $spec;
                }, $families);
                $url = 'https://fonts.googleapis.com/css2?' . implode('&', $params) . '&display=swap';
                $font_handle = 'wpsg-google-fonts-' . md5($url);
                wp_enqueue_style($font_handle, $url, [], null);
            }
        }

        // Enqueue @font-face CSS for custom uploaded fonts (P22-L5).
        if (class_exists('WPSG_Font_Library')) {
            $font_css = WPSG_Font_Library::generate_font_face_css();
            if (!empty($font_css)) {
                wp_register_style('wpsg-custom-fonts', false);
                wp_enqueue_style('wpsg-custom-fonts');
                wp_add_inline_style('wpsg-custom-fonts', $font_css);
            }
        }

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
            'company'  => $atts['company'],
            'space'    => $atts['space'],
        ]));

        // Per-node config: space-specific display settings read by main.tsx per mount point.
        $node_config = esc_attr(wp_json_encode([
            'spaceId'          => $space_id,
            'theme'            => $theme,
            'galleryLayout'    => $gallery_layout,
            'enableLightbox'   => $enable_lightbox,
            'enableAnimations' => $enable_animations,
        ]));

        // Global page config: emitted once per page load (page-global values only).
        // Space-specific settings live in data-wpsg-config on each mount node.
        if (empty($GLOBALS['wpsg_config_emitted'])) {
            $GLOBALS['wpsg_config_emitted'] = true;
            $config = [
                'authProvider'           => $auth_provider,
                'apiBase'                => $api_base,
                'sentryDsn'              => $sentry_dsn,
                'restNonce'              => wp_create_nonce('wp_rest'),
                // P20-K: Gate JWT auth behind server-side constant.
                'enableJwt'              => defined('WPSG_ENABLE_JWT_AUTH') && WPSG_ENABLE_JWT_AUTH,
                // Admin setting controls whether DOM component markers are emitted
                // in deployed builds; sites can still override with a filter.
                'debugComponentMarkers'  => (bool) apply_filters('wpsg_debug_component_markers', $debug_component_markers),
                'allowUserThemeOverride' => $allow_user_theme_override,
            ];
            $config_script = '<script>' .
                'window.__WPSG_CONFIG__ = ' . wp_json_encode($config) . ';' .
                // Keep legacy globals for backward compatibility.
                'window.__WPSG_AUTH_PROVIDER__ = ' . wp_json_encode($auth_provider) . ';' .
                'window.__WPSG_API_BASE__ = ' . wp_json_encode($api_base) . ';' .
                '</script>';
        } else {
            $config_script = '';
        }

        /**
         * P13-E: WP Full Bleed — per-breakpoint edge-to-edge layout.
         *
         * PROBLEM:
         * WordPress Block Themes (FSE) wrap shortcode output in a container such as
         *   <div class="entry-content has-global-padding is-layout-constrained">
         *
         * Two WP classes create the issue:
         *  1. `.has-global-padding` adds horizontal padding via CSS variables:
         *       padding-left:  var(--wp--style--root--padding-left)
         *       padding-right: var(--wp--style--root--padding-right)
         *  2. `.is-layout-constrained` applies max-width on direct children:
         *       > * { max-width: var(--wp--style--global--content-size) }
         *     This prevents children from growing wider than the content area.
         *
         * SOLUTION (3 parts):
         *  A. Wrap shortcode output in `<div class="alignfull wpsg-full-bleed">`.
         *     WordPress's own `alignfull` class removes `is-layout-constrained`'s
         *     max-width restriction, allowing the element to span the full viewport.
         *     Without alignfull, negative margins alone are clamped by the max-width.
         *
         *  B. For breakpoints where bleed is ON: apply negative margins that exactly
         *     cancel the parent's has-global-padding values, using WP's own CSS vars:
         *       margin-left:  calc(-1 * var(--wp--style--root--padding-left, 0px))
         *       margin-right: calc(-1 * var(--wp--style--root--padding-right, 0px))
         *     This makes the element flush with the viewport edge.
         *
         *  C. For breakpoints where bleed is OFF: re-constrain the element by
         *     restoring max-width + centering (since alignfull removed these globally):
         *       max-width: var(--wp--style--global--content-size, ...) !important
         *       margin-left: auto !important; margin-right: auto !important
         *     This ensures the element stays within WP's normal content width at
         *     viewports where the admin doesn't want full bleed.
         *
         * WHY THIS APPROACH:
         *  - Using WP CSS variables means it auto-adapts to any block theme's spacing.
         *  - alignfull is the only reliable escape from is-layout-constrained;
         *    alternatives like max-width:none !important alone fail because the
         *    constrained layout's specificity varies across themes.
         *  - The re-constrain rules for OFF breakpoints are essential because
         *    alignfull is all-or-nothing — it removes constraints at every viewport.
         *  - Server-rendered (PHP), not client-controlled: changing these settings
         *    requires a page refresh since it modifies the HTML outside the React
         *    Shadow DOM boundary.
         *
         * BREAKPOINTS:  Desktop ≥ 1024px | Tablet 768–1023px | Mobile < 768px
         */
        $bleed_desktop = !empty($settings['wp_full_bleed_desktop']);
        $bleed_tablet  = !empty($settings['wp_full_bleed_tablet']);
        $bleed_mobile  = !empty($settings['wp_full_bleed_mobile']);
        $any_bleed = $bleed_desktop || $bleed_tablet || $bleed_mobile;

        $bleed_style = '';
        $bleed_open = '';
        $bleed_close = '';
        if ($any_bleed) {
            // Bleed ON rule: negative margins cancel parent padding.
            $neg_margins = 'margin-left:calc(-1 * var(--wp--style--root--padding-left,0px));'
                . 'margin-right:calc(-1 * var(--wp--style--root--padding-right,0px));';
            // Bleed OFF rule: re-constrain to WP content width (undo alignfull at this breakpoint).
            // Falls back through --global--content-size → --global--wide-size → 1200px.
            $constrain = 'max-width:var(--wp--style--global--content-size,var(--wp--style--global--wide-size,1200px)) !important;'
                . 'margin-left:auto !important;margin-right:auto !important;';
            $rules = [];
            // Each breakpoint always gets a rule — either bleed or re-constrain.
            if ($bleed_desktop) {
                $rules[] = '@media(min-width:1024px){.wpsg-full-bleed{' . $neg_margins . '}}';
            } else {
                $rules[] = '@media(min-width:1024px){.wpsg-full-bleed{' . $constrain . '}}';
            }
            if ($bleed_tablet) {
                $rules[] = '@media(min-width:768px) and (max-width:1023px){.wpsg-full-bleed{' . $neg_margins . '}}';
            } else {
                $rules[] = '@media(min-width:768px) and (max-width:1023px){.wpsg-full-bleed{' . $constrain . '}}';
            }
            if ($bleed_mobile) {
                $rules[] = '@media(max-width:767px){.wpsg-full-bleed{' . $neg_margins . '}}';
            } else {
                $rules[] = '@media(max-width:767px){.wpsg-full-bleed{' . $constrain . '}}';
            }
            $bleed_style = '<style>' . implode('', $rules) . '</style>';
            // alignfull is required to escape is-layout-constrained (see docblock above).
            // wpsg-full-bleed is our own class targeted by the media-query rules.
            $bleed_open = '<div class="alignfull wpsg-full-bleed">';
            $bleed_close = '</div>';
        }

        return $config_script . $bleed_style . $bleed_open . '<div class="' . esc_attr(implode(' ', $classes)) . '" data-wpsg-props="' . $props . '" data-wpsg-config="' . $node_config . '"></div>' . $bleed_close;
    }

    /**
     * Resolve the space ID for a shortcode call.
     *
     * Priority: explicit space= attr (ID or slug) → campaign's _wpsg_space_id →
     * company's _wpsg_space_id → Default Space.
     *
     * @param array $atts Shortcode attributes.
     * @return int Resolved space ID (always ≥ 1).
     */
    private static function resolve_space_id(array $atts): int {
        if (!empty($atts['space'])) {
            $s = $atts['space'];
            if (is_numeric($s) && class_exists('WPSG_DB')) {
                $space = WPSG_DB::get_space((int) $s);
                if ($space) {
                    return (int) $space->id;
                }
            }
            if (class_exists('WPSG_DB')) {
                $space = WPSG_DB::get_space_by_slug($s);
                if ($space) {
                    return (int) $space->id;
                }
            }
        }

        if (!empty($atts['campaign'])) {
            $post = get_page_by_path($atts['campaign'], OBJECT, 'wpsg_campaign');
            if (!$post && is_numeric($atts['campaign'])) {
                $post = get_post((int) $atts['campaign']);
            }
            if ($post) {
                $sid = (int) get_post_meta($post->ID, '_wpsg_space_id', true);
                if ($sid > 0) {
                    return $sid;
                }
            }
        }

        if (!empty($atts['company'])) {
            $term = get_term_by('slug', $atts['company'], 'wpsg_company');
            if ($term && !is_wp_error($term)) {
                $sid = (int) get_term_meta($term->term_id, '_wpsg_space_id', true);
                if ($sid > 0) {
                    return $sid;
                }
            }
        }

        return (int) get_option('wpsg_default_space_id', 1);
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
