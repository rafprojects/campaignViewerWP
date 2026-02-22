<?php
/**
 * Plugin Name: WP Super Gallery
 * Description: Embeddable campaign gallery with Shadow DOM rendering.
 * Version: 0.12.0
 * Author: WP Super Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPSG_VERSION', '0.12.0');
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
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-thumbnail-cache.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-rate-limiter.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-image-optimizer.php';

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
    wp_clear_scheduled_hook('wpsg_schedule_auto_archive');
    wp_clear_scheduled_hook('wpsg_thumbnail_cache_cleanup');
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

// P13-D: Campaign schedule auto-archive cron.
add_action('init', 'wpsg_register_schedule_cron');
add_action('wpsg_schedule_auto_archive', 'wpsg_run_schedule_auto_archive');

function wpsg_register_schedule_cron() {
    if (!wp_next_scheduled('wpsg_schedule_auto_archive')) {
        wp_schedule_event(time(), 'hourly', 'wpsg_schedule_auto_archive');
    }
}

function wpsg_run_schedule_auto_archive() {
    $now = gmdate('Y-m-d H:i:s'); // UTC datetime — matches stored format
    $archived_count = 0;

    // Process in batches of 100 until none remain.
    do {
        $query = new WP_Query([
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'publish',
            'posts_per_page' => 100,
            'fields'         => 'ids',
            'no_found_rows'  => true,
            'meta_query'     => [
                'relation' => 'AND',
                [
                    'key'     => 'unpublish_at',
                    'value'   => '',
                    'compare' => '!=',
                ],
                [
                    'key'     => 'unpublish_at',
                    'value'   => $now,
                    'compare' => '<',
                    'type'    => 'DATETIME',
                ],
                [
                    'relation' => 'OR',
                    ['key' => 'status', 'value' => 'archived', 'compare' => '!='],
                    ['key' => 'status', 'compare' => 'NOT EXISTS'],
                ],
            ],
        ]);

        foreach ($query->posts as $post_id) {
            update_post_meta($post_id, 'status', 'archived');
            $archived_count++;
        }
    } while (!empty($query->posts));

    // Clear campaign transient + timeout caches once after all updates.
    if ($archived_count > 0) {
        global $wpdb;
        $like = $wpdb->esc_like('_transient_wpsg_campaigns_') . '%';
        $timeout_like = $wpdb->esc_like('_transient_timeout_wpsg_campaigns_') . '%';
        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
                $like,
                $timeout_like
            )
        );
    }
}

add_filter('rest_pre_serve_request', 'wpsg_add_cors_headers', 10, 4);
add_action('send_headers', 'wpsg_add_security_headers');

function wpsg_add_cors_headers($served, $result, $request, $server) {
    $route = $request->get_route();
    if (strpos($route, '/wp-super-gallery/v1/') !== 0) {
        return $served;
    }

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_ORIGIN'])) : '';
    $allowed = apply_filters('wpsg_cors_allowed_origins', []);

    if ($origin && !empty($allowed) && in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        if (apply_filters('wpsg_cors_allow_credentials', true)) {
            header('Access-Control-Allow-Credentials: true');
        }
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
    }

    return $served;
}

function wpsg_add_security_headers() {
    if (!apply_filters('wpsg_security_headers_enabled', true)) {
        return;
    }

    if (!wpsg_should_add_security_headers()) {
        return;
    }

    if (!headers_sent()) {
        $xfo = apply_filters('wpsg_x_frame_options', 'SAMEORIGIN');
        $referrer = apply_filters('wpsg_referrer_policy', 'strict-origin-when-cross-origin');
        $permissions = apply_filters('wpsg_permissions_policy', 'camera=(), microphone=(), geolocation=()');
        $csp = apply_filters('wpsg_csp_header', '');

        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: ' . $xfo);
        header('Referrer-Policy: ' . $referrer);
        header('Permissions-Policy: ' . $permissions);

        if (!empty($csp)) {
            header('Content-Security-Policy: ' . $csp);
        }
    }
}

function wpsg_should_add_security_headers() {
    if (!empty($GLOBALS['wpsg_has_shortcode'])) {
        return true;
    }

    $route = isset($_GET['rest_route']) ? sanitize_text_field(wp_unslash($_GET['rest_route'])) : '';
    if (strpos($route, '/wp-super-gallery/v1/') === 0) {
        return true;
    }

    $uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
    if (strpos($uri, '/wp-json/wp-super-gallery/v1/') !== false) {
        return true;
    }

    return strpos($uri, '/wp-content/plugins/wp-super-gallery/') !== false;
}

// Initialize settings (admin only).
if (is_admin()) {
    WPSG_Settings::init();
}

// P14-C/D/E/F: Register infrastructure.
WPSG_Thumbnail_Cache::register();
WPSG_Image_Optimizer::register();
