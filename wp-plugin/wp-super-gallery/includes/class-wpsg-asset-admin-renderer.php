<?php
/**
 * WP-admin "Asset Library" page (P52-B).
 *
 * Registers a submenu under the Campaigns CPT that mounts the React global
 * asset manager UI (#wpsg-assets-admin) for full add / delete / tag /
 * universal-flag management of the global visual asset library — reusing the
 * REST API and the same Vite bundle the shortcode uses.
 *
 * Capability: manage_options (System Admin only).  Editors manage assets
 * through the Admin Panel "Assets" tab; only a System Admin can reach WP admin.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Asset_Admin_Renderer {

    const PAGE_SLUG = 'wpsg-assets';

    /** @var string Admin hook suffix for this page. */
    private static $page_hook = '';

    public static function init() {
        add_action('admin_menu', [self::class, 'add_menu_page']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_admin_assets']);
    }

    public static function add_menu_page() {
        // Only System Admins (manage_options) can reach WP admin; editors use
        // the in-app Admin Panel "Assets" tab instead.
        self::$page_hook = (string) add_submenu_page(
            'edit.php?post_type=wpsg_campaign',
            __('Asset Library', 'wp-super-gallery'),
            __('Asset Library', 'wp-super-gallery'),
            'manage_options',
            self::PAGE_SLUG,
            [self::class, 'render_page']
        );
    }

    /**
     * Enqueue the React bundle + page-global config, only on this page.
     *
     * @param string $hook_suffix Current admin page hook suffix.
     */
    public static function enqueue_admin_assets($hook_suffix) {
        if (empty(self::$page_hook) || self::$page_hook !== $hook_suffix) {
            return;
        }

        // Register the Vite bundle (idempotent) and enqueue script + all app styles.
        WPSG_Embed::register_assets();
        wp_enqueue_script('wp-super-gallery-app');

        $i = 0;
        while (wp_style_is('wp-super-gallery-app-style-' . $i, 'registered')) {
            wp_enqueue_style('wp-super-gallery-app-style-' . $i);
            $i++;
        }

        // Emit the same page-global config (apiBase, restNonce, authProvider…) the
        // shortcode uses, before the module loads, so the app is nonce-authenticated.
        wp_add_inline_script('wp-super-gallery-app', WPSG_Embed::page_config_js(), 'before');
    }

    public static function render_page() {
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__('Asset Library', 'wp-super-gallery') . '</h1>';
        echo '<p>' . esc_html__('Upload and manage global overlay/graphic assets available across all spaces.', 'wp-super-gallery') . '</p>';
        echo '<div id="wpsg-assets-admin"></div>';
        echo '</div>';
    }
}
