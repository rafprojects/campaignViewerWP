<?php
/**
 * WP-admin "Gallery Spaces" page (P47-K).
 *
 * Registers a submenu under the Campaigns CPT that mounts the React space
 * management UI (#wpsg-spaces-admin) for full create / archive / per-space
 * settings / access-grant management — reusing the REST API and the same
 * Vite bundle the shortcode uses, rather than re-implementing CRUD in PHP.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Space_Admin_Renderer {

    const PAGE_SLUG = 'wpsg-spaces';

    /** @var string Admin hook suffix for this page. */
    private static $page_hook = '';

    public static function init() {
        add_action('admin_menu', [self::class, 'add_menu_page']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_admin_assets']);
    }

    public static function add_menu_page() {
        // P52-A3: managing Spaces is a System Admin function (manage_options),
        // not a space-editor one. Editors never see this page (the parent CPT
        // menu is already hidden for them since they hold no CPT caps).
        self::$page_hook = (string) add_submenu_page(
            'edit.php?post_type=wpsg_campaign',
            __('Gallery Spaces', 'wp-super-gallery'),
            __('Spaces', 'wp-super-gallery'),
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
        echo '<h1>' . esc_html__('Gallery Spaces', 'wp-super-gallery') . '</h1>';
        echo '<p>' . esc_html__('Create spaces, edit per-space settings, and manage access grants.', 'wp-super-gallery') . '</p>';
        echo '<div id="wpsg-spaces-admin"></div>';
        echo '</div>';
    }
}
