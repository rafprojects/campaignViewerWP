<?php
/**
 * Plugin Name: WP Super Gallery
 * Description: Embeddable campaign gallery with Shadow DOM rendering.
 * Version: 0.5.0
 * Author: WP Super Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPSG_VERSION', '0.5.0');
define('WPSG_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPSG_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-cpt.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-rest.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-embed.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-settings.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-db.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-maintenance.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-monitoring.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-alerts.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-sentry.php';

// Activation hook - trigger setup on next load
register_activation_hook(__FILE__, 'wpsg_activate');
function wpsg_activate() {
    // Flag that setup is needed
    add_option('wpsg_needs_setup', '1');
}

// Deactivation hook - optionally clean up (roles persist by design)
register_deactivation_hook(__FILE__, 'wpsg_deactivate');
function wpsg_deactivate() {
    // Roles and capabilities are kept on deactivation
    // Only remove on uninstall if desired
    wp_clear_scheduled_hook(WPSG_Maintenance::CLEANUP_HOOK);
}

// Set up roles and capabilities on init (more reliable than activation hook)
add_action('init', 'wpsg_setup_roles_and_caps');
function wpsg_setup_roles_and_caps() {
    // Only run setup if flagged or if capability is missing
    $needs_setup = get_option('wpsg_needs_setup', '0');
    $admin_role = get_role('administrator');
    $needs_cap = $admin_role && !$admin_role->has_cap('manage_wpsg');
    
    if ($needs_setup === '1' || $needs_cap) {
        // Add manage_wpsg capability to Administrator role
        if ($admin_role) {
            $admin_role->add_cap('manage_wpsg');
        }
        
        // Create WPSG Admin role if it doesn't exist
        $wpsg_role = get_role('wpsg_admin');
        if (!$wpsg_role) {
            add_role('wpsg_admin', 'Gallery Admin', [
                'read' => true,
                'upload_files' => true,
                'manage_wpsg' => true,
            ]);
        }
        
        // Clear setup flag
        delete_option('wpsg_needs_setup');
    }
}

add_action('init', ['WPSG_CPT', 'register']);
add_action('rest_api_init', ['WPSG_REST', 'register_routes']);
add_action('init', ['WPSG_Embed', 'register_shortcode']);
add_action('wp_enqueue_scripts', ['WPSG_Embed', 'register_assets']);
add_action('init', ['WPSG_DB', 'maybe_upgrade']);
add_action('init', ['WPSG_Maintenance', 'register']);
add_action('init', ['WPSG_Monitoring', 'register']);
add_action('init', ['WPSG_Alerts', 'register']);
add_action('init', ['WPSG_Sentry', 'init']);

// Initialize settings (admin only).
if (is_admin()) {
    WPSG_Settings::init();
}
