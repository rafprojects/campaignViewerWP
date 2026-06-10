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

    /**
     * Page-global JS config consumed by main.tsx / App.tsx.
     *
     * Returns the inline JS (no <script> wrapper) that sets window.__WPSG_CONFIG__
     * plus the legacy __WPSG_AUTH_PROVIDER__ / __WPSG_API_BASE__ globals. All values
     * are page-global (auth/api/nonce); the only settings-derived fields
     * (debug_component_markers, allow_user_theme_override) are admin-only, so the
     * global settings are authoritative regardless of space context.
     *
     * Shared by the front-end shortcode and the wp-admin Spaces page so both mount
     * the React app with an identical, nonce-authenticated config.
     */
    public static function page_config_js(): string {
        $auth_provider = apply_filters('wpsg_auth_provider', 'wp-jwt');
        $api_base      = apply_filters('wpsg_api_base', home_url());
        $sentry_dsn    = apply_filters('wpsg_sentry_dsn', '');

        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [];
        $allow_user_theme_override = isset($settings['allow_user_theme_override']) ? (bool) $settings['allow_user_theme_override'] : true;
        $debug_component_markers   = isset($settings['debug_component_markers']) ? (bool) $settings['debug_component_markers'] : true;

        $config = [
            'authProvider'           => $auth_provider,
            'apiBase'                => $api_base,
            'sentryDsn'              => $sentry_dsn,
            'restNonce'              => wp_create_nonce('wp_rest'),
            'enableJwt'              => defined('WPSG_ENABLE_JWT_AUTH') && WPSG_ENABLE_JWT_AUTH,
            'debugComponentMarkers'  => (bool) apply_filters('wpsg_debug_component_markers', $debug_component_markers),
            'allowUserThemeOverride' => $allow_user_theme_override,
        ];

        return 'window.__WPSG_CONFIG__ = ' . wp_json_encode($config) . ';'
            . 'window.__WPSG_AUTH_PROVIDER__ = ' . wp_json_encode($auth_provider) . ';'
            . 'window.__WPSG_API_BASE__ = ' . wp_json_encode($api_base) . ';';
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
        $valid_auth_bar_modes = ['bar', 'floating', 'draggable', 'minimal', 'auto-hide'];
        $atts = shortcode_atts([
            'campaign'      => '',
            'company'       => '',
            'compact'       => 'false',
            'space'         => '',
            'auth_bar_mode' => '',
        ], $atts, 'super-gallery');

        $space_id = self::resolve_space_id($atts);
        $space_obj  = class_exists('WPSG_DB') ? WPSG_DB::get_space($space_id) : null;
        $space_slug = ($space_obj && !empty($space_obj->slug)) ? $space_obj->slug : (string) $space_id;
        $space_name = ($space_obj && !empty($space_obj->name)) ? $space_obj->name : $space_slug;

        // P48-I: Generate a stable, unique instance ID for this shortcode mount point.
        // getRootId() in main.tsx uses host.id as highest priority, making the rootId
        // space-slug-based and collision-free instead of index-based.
        if (!isset($GLOBALS['wpsg_instance_ids'])) {
            $GLOBALS['wpsg_instance_ids'] = [];
        }
        $base_id = 'wpsg-' . $space_slug;
        if (in_array($base_id, $GLOBALS['wpsg_instance_ids'], true)) {
            $counter = 2;
            while (in_array($base_id . '-' . $counter, $GLOBALS['wpsg_instance_ids'], true)) {
                $counter++;
            }
            $instance_id = $base_id . '-' . $counter;
        } else {
            $instance_id = $base_id;
        }
        $GLOBALS['wpsg_instance_ids'][] = $instance_id;

        // Accumulate space instances for the WP admin bar (P48-I Layer 4).
        if (!isset($GLOBALS['wpsg_spaces_on_page'])) {
            $GLOBALS['wpsg_spaces_on_page'] = [];
        }
        $GLOBALS['wpsg_spaces_on_page'][$instance_id] = [
            'id'   => $space_id,
            'slug' => $space_slug,
            'name' => $space_name,
        ];
        if (!has_action('admin_bar_menu', [self::class, 'register_admin_bar_nodes'])) {
            add_action('admin_bar_menu', [self::class, 'register_admin_bar_nodes'], 90);
            // Emit __WPSG_PAGE_SPACES__ after all shortcodes have accumulated their entries.
            // Priority 1 fires before wp_print_footer_scripts (priority 10+) so the global
            // is set before the React bundle loads.
            add_action('wp_footer', [self::class, 'emit_page_spaces_js'], 1);
        }

        $classes = ['wp-super-gallery'];
        if ($atts['compact'] === 'true') {
            $classes[] = 'wp-super-gallery--compact';
        }

        wp_enqueue_script('wp-super-gallery-app');

        // Get effective settings for this space (falls back to global defaults).
        // Page-global config (auth/api/nonce) is emitted via self::page_config_js().
        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_effective_settings($space_id) : [];
        $theme = isset($settings['theme']) ? $settings['theme'] : 'default-dark';
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
        $raw_auth_bar_mode = trim((string) $atts['auth_bar_mode']);
        $auth_bar_mode     = in_array($raw_auth_bar_mode, $valid_auth_bar_modes, true) ? $raw_auth_bar_mode : null;

        $node_config_data = [
            'spaceId'          => $space_id,
            'spaceName'        => $space_name,
            'instanceId'       => $instance_id,
            'theme'            => $theme,
            'galleryLayout'    => $gallery_layout,
            'enableLightbox'   => $enable_lightbox,
            'enableAnimations' => $enable_animations,
        ];
        if ($auth_bar_mode !== null) {
            $node_config_data['authBarMode'] = $auth_bar_mode;
        }
        $node_config = esc_attr(wp_json_encode($node_config_data));

        // Global page config: emitted once per page load (page-global values only).
        // Space-specific settings live in data-wpsg-config on each mount node.
        if (empty($GLOBALS['wpsg_config_emitted'])) {
            $GLOBALS['wpsg_config_emitted'] = true;
            // admin_bar_delegation_js() is emitted once here alongside page config.
            // It listens for WP admin bar clicks and routes them to per-instance openers.
            $config_script = '<script>' . self::page_config_js() . self::admin_bar_delegation_js() . '</script>';
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
            // Scope selector to this instance's space slug so two shortcodes on the
            // same page with different bleed settings don't stomp each other (P48-C).
            $sel = '.wpsg-full-bleed[data-space="' . esc_attr($space_slug) . '"]';
            if ($bleed_desktop) {
                $rules[] = '@media(min-width:1024px){' . $sel . '{' . $neg_margins . '}}';
            } else {
                $rules[] = '@media(min-width:1024px){' . $sel . '{' . $constrain . '}}';
            }
            if ($bleed_tablet) {
                $rules[] = '@media(min-width:768px) and (max-width:1023px){' . $sel . '{' . $neg_margins . '}}';
            } else {
                $rules[] = '@media(min-width:768px) and (max-width:1023px){' . $sel . '{' . $constrain . '}}';
            }
            if ($bleed_mobile) {
                $rules[] = '@media(max-width:767px){' . $sel . '{' . $neg_margins . '}}';
            } else {
                $rules[] = '@media(max-width:767px){' . $sel . '{' . $constrain . '}}';
            }
            $bleed_style = '<style>' . implode('', $rules) . '</style>';
            // alignfull is required to escape is-layout-constrained (see docblock above).
            // wpsg-full-bleed is our own class targeted by the media-query rules.
            $bleed_open = '<div class="alignfull wpsg-full-bleed" data-space="' . esc_attr($space_slug) . '">';
            $bleed_close = '</div>';
        }

        return $config_script . $bleed_style . $bleed_open . '<div id="' . esc_attr($instance_id) . '" class="' . esc_attr(implode(' ', $classes)) . '" data-wpsg-props="' . $props . '" data-wpsg-config="' . $node_config . '"></div>' . $bleed_close;
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

    /**
     * JS snippet emitted once per page. Listens for WP admin bar clicks that
     * carry [data-wpsg-open] and routes them to the per-instance opener
     * registered by each React root (window.__wpsgOpen_<instanceId>).
     */
    private static function admin_bar_delegation_js(): string {
        return <<<'JS'
(function(){
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-wpsg-open]');
    if(!btn)return;
    var a=btn.closest('a');
    var href=a?a.getAttribute('href'):'';
    var instanceId=href?href.replace(/^#/,''):'';
    var panel=btn.getAttribute('data-wpsg-open');
    var opener=instanceId&&window['__wpsgOpen_'+instanceId];
    if(opener){e.preventDefault();opener(panel);}
  });
})();
JS;
    }

    /**
     * Emits window.__WPSG_PAGE_SPACES__ into the footer after all shortcodes have
     * rendered so the React SpaceSwitcher can read the full list on mount.
     * Only emitted for users with manage_wpsg capability.
     */
    public static function emit_page_spaces_js(): void {
        if (empty($GLOBALS['wpsg_spaces_on_page']) || !is_array($GLOBALS['wpsg_spaces_on_page'])) {
            return;
        }
        if (!current_user_can('manage_wpsg') && !current_user_can('manage_options')) {
            return;
        }
        // Reshape to indexed array with instanceId included in each entry.
        $spaces = [];
        foreach ($GLOBALS['wpsg_spaces_on_page'] as $instance_id => $info) {
            $spaces[] = [
                'instanceId' => $instance_id,
                'id'         => $info['id'],
                'slug'       => $info['slug'],
                'name'       => $info['name'],
            ];
        }
        echo '<script>window.__WPSG_PAGE_SPACES__ = ' . wp_json_encode($spaces) . ';</script>' . "\n";
    }

    /**
     * Registers per-space WP admin bar nodes from $GLOBALS['wpsg_spaces_on_page'].
     * Hooked at priority 90 (after WP core nodes).
     *
     * @param \WP_Admin_Bar $wp_admin_bar
     */
    public static function register_admin_bar_nodes(\WP_Admin_Bar $wp_admin_bar): void {
        if (empty($GLOBALS['wpsg_spaces_on_page']) || !is_array($GLOBALS['wpsg_spaces_on_page'])) {
            return;
        }
        if (!current_user_can('manage_wpsg')) {
            return;
        }

        $wp_admin_bar->add_node([
            'id'    => 'wpsg-root',
            'title' => 'WP Super Gallery',
            'href'  => false,
        ]);

        foreach ($GLOBALS['wpsg_spaces_on_page'] as $instance_id => $info) {
            $slug  = esc_attr($instance_id);
            $label = esc_html($info['name']);

            $wp_admin_bar->add_node([
                'id'     => 'wpsg-space-' . $slug,
                'parent' => 'wpsg-root',
                'title'  => $label,
                'href'   => '#' . $slug,
            ]);
            $wp_admin_bar->add_node([
                'id'     => 'wpsg-space-' . $slug . '-settings',
                'parent' => 'wpsg-space-' . $slug,
                'title'  => '<span data-wpsg-open="settings">Settings</span>',
                'href'   => '#' . $slug,
                'meta'   => ['html' => true],
            ]);
            $wp_admin_bar->add_node([
                'id'     => 'wpsg-space-' . $slug . '-admin',
                'parent' => 'wpsg-space-' . $slug,
                'title'  => '<span data-wpsg-open="admin">Admin Panel</span>',
                'href'   => '#' . $slug,
                'meta'   => ['html' => true],
            ]);
        }
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
