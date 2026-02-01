<?php
/**
 * Plugin Name: WP Super Gallery
 * Description: Embeddable campaign gallery with Shadow DOM rendering.
 * Version: 0.3.0
 * Author: WP Super Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPSG_VERSION', '0.3.0');
define('WPSG_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPSG_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-cpt.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-rest.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-embed.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-settings.php';

// Activation hook - set up capabilities and roles
register_activation_hook(__FILE__, 'wpsg_activate');
function wpsg_activate() {
    // Add manage_wpsg capability to Administrator role
    $admin_role = get_role('administrator');
    if ($admin_role) {
        $admin_role->add_cap('manage_wpsg');
    }
    
    // Create WPSG Admin role (can manage plugin but not full WP admin)
    $existing_role = get_role('wpsg_admin');
    if (!$existing_role) {
        add_role('wpsg_admin', 'Gallery Admin', [
            'read' => true,
            'upload_files' => true,
            'manage_wpsg' => true,
        ]);
    }
}

// Deactivation hook - optionally clean up (roles persist by design)
register_deactivation_hook(__FILE__, 'wpsg_deactivate');
function wpsg_deactivate() {
    // Roles and capabilities are kept on deactivation
    // Only remove on uninstall if desired
}

// Ensure capabilities exist on every load (handles manual role edits)
add_action('admin_init', 'wpsg_ensure_capabilities');
function wpsg_ensure_capabilities() {
    $admin_role = get_role('administrator');
    if ($admin_role && !$admin_role->has_cap('manage_wpsg')) {
        $admin_role->add_cap('manage_wpsg');
    }
}

add_action('init', ['WPSG_CPT', 'register']);
add_action('rest_api_init', ['WPSG_REST', 'register_routes']);
add_action('init', ['WPSG_Embed', 'register_shortcode']);
add_action('wp_enqueue_scripts', ['WPSG_Embed', 'register_assets']);

// Initialize settings (admin only).
if (is_admin()) {
    WPSG_Settings::init();
}
