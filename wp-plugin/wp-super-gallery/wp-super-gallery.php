<?php
/**
 * Plugin Name:       WP Super Gallery
 * Plugin URI:        https://github.com/rafprojects/wp-super-gallery
 * Description:       Embeddable campaign gallery with Shadow DOM rendering.
 * Version:           0.26.0
 * Requires at least: 6.4
 * Tested up to:      7.0
 * Requires PHP:      8.2
 * Author:            WP Super Gallery
 * Author URI:        https://github.com/rafprojects/wp-super-gallery
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-super-gallery
 * Domain Path:       /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPSG_VERSION', '0.26.0');
define('WPSG_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPSG_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-cpt.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-rest.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-embed.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-registry.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-core-fields.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-renderer.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-sanitizer.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-service.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-typography.php';
require_once WPSG_PLUGIN_DIR . 'includes/settings/class-wpsg-settings-utils.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-settings.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-db.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-maintenance.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-logger.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-monitoring.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-alerts.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-sentry.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-thumbnail-cache.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-rate-limiter.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-image-optimizer.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-phash.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-layout-templates.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-campaign-duplicator.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-campaign-templates.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-overlay-library.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-font-library.php';

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
    wp_clear_scheduled_hook(WPSG_Maintenance::TRASH_PURGE_HOOK);
    wp_clear_scheduled_hook(WPSG_Maintenance::ANALYTICS_PURGE_HOOK);
    wp_clear_scheduled_hook(WPSG_Maintenance::EXPIRED_GRANTS_HOOK);
    wp_clear_scheduled_hook('wpsg_schedule_auto_archive');
    wp_clear_scheduled_hook('wpsg_thumbnail_cache_cleanup');
    wp_clear_scheduled_hook(WPSG_Alerts::CRON_HOOK);
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
            // Grant custom CPT capabilities
            foreach (WPSG_CPT::CPT_CAPS as $cap) {
                $admin_role->add_cap($cap);
            }
        }
        
        // Create WPSG Admin role if it doesn't exist, or update caps
        $wpsg_role = get_role('wpsg_admin');
        $wpsg_caps = array_merge(
            ['read' => true, 'upload_files' => true, 'manage_wpsg' => true],
            array_fill_keys(WPSG_CPT::CPT_CAPS, true)
        );
        if (!$wpsg_role) {
            add_role('wpsg_admin', __('Gallery Admin', 'wp-super-gallery'), $wpsg_caps);
        } else {
            // Ensure existing role gets CPT caps on upgrade
            foreach (WPSG_CPT::CPT_CAPS as $cap) {
                $wpsg_role->add_cap($cap);
            }
        }
        
        // Clear setup flag
        delete_option('wpsg_needs_setup');
    }
}

add_action('init', function () {
    load_plugin_textdomain('wp-super-gallery', false, dirname(plugin_basename(__FILE__)) . '/languages');
}, 0);
add_action('init', ['WPSG_CPT', 'register']);
add_action('rest_api_init', ['WPSG_REST', 'register_routes']);
// Register early (at plugin load, not inside rest_api_init) so WP's test-framework
// _restore_hooks() does not strip it after the first REST request initialises the server.
add_filter('rest_request_after_callbacks', ['WPSG_REST', 'inject_rate_limit_headers'], 10, 3);
add_action('init', ['WPSG_Embed', 'register_shortcode']);
add_action('wp_enqueue_scripts', ['WPSG_Embed', 'register_assets']);
add_action('init', ['WPSG_DB', 'maybe_upgrade']);
add_action('init', ['WPSG_Maintenance', 'register']);
add_action('init', ['WPSG_Monitoring', 'register']);
add_action('init', ['WPSG_Alerts', 'register']);

// P20-I-2: Automatically sync media refs whenever media_items meta is updated.
add_action('updated_post_meta', function ($meta_id, $post_id, $meta_key, $meta_value) {
    if ($meta_key === 'media_items' && get_post_type($post_id) === WPSG_CPT::POST_TYPE) {
        WPSG_DB::sync_media_refs((int) $post_id, is_array($meta_value) ? $meta_value : []);
    }
}, 10, 4);
add_action('added_post_meta', function ($meta_id, $post_id, $meta_key, $meta_value) {
    if ($meta_key === 'media_items' && get_post_type($post_id) === WPSG_CPT::POST_TYPE) {
        WPSG_DB::sync_media_refs((int) $post_id, is_array($meta_value) ? $meta_value : []);
    }
}, 10, 4);
add_action('deleted_post_meta', function ($meta_ids, $post_id, $meta_key, $meta_value) {
    if ($meta_key === 'media_items' && get_post_type($post_id) === WPSG_CPT::POST_TYPE) {
        // Clear all media refs for this post when media_items meta is deleted.
        WPSG_DB::sync_media_refs((int) $post_id, []);
    }
}, 10, 4);
add_action('init', ['WPSG_Sentry', 'init']);

// P13-D: Campaign schedule auto-archive cron.
add_action('init', 'wpsg_register_schedule_cron');
add_action('wpsg_schedule_auto_archive', 'wpsg_run_schedule_auto_archive');

function wpsg_register_schedule_cron() {
    if (!wp_next_scheduled('wpsg_schedule_auto_archive')) {
        wp_schedule_event(time(), 'hourly', 'wpsg_schedule_auto_archive');
    }
}

/**
 * Fallback archive path using the standard metadata API.
 *
 * @param int[] $post_ids Campaign IDs to archive.
 * @return int Number of campaigns processed.
 */
function wpsg_archive_campaign_status_batch_fallback(array $post_ids) {
    $processed = 0;

    foreach ($post_ids as $post_id) {
        update_post_meta($post_id, 'status', 'archived');
        $processed++;
    }

    return $processed;
}

/**
 * Archive a batch of campaigns with batched postmeta writes.
 *
 * Updates existing `status` rows in one query, inserts missing rows in one
 * query, and falls back to the standard metadata API if either batched query
 * fails.
 *
 * @param int[] $post_ids Campaign IDs to archive.
 * @return int Number of campaigns processed.
 */
function wpsg_archive_campaign_status_batch(array $post_ids) {
    global $wpdb;

    $post_ids = array_values(array_unique(array_map('intval', $post_ids)));
    $post_ids = array_values(array_filter($post_ids, static function ($post_id) {
        return $post_id > 0;
    }));

    if (empty($post_ids)) {
        return 0;
    }

    $placeholders = implode(', ', array_fill(0, count($post_ids), '%d'));
    $existing_ids = $wpdb->get_col(
        $wpdb->prepare(
            "SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE meta_key = %s AND post_id IN ($placeholders)",
            array_merge(['status'], $post_ids)
        )
    );

    if (!is_array($existing_ids)) {
        return wpsg_archive_campaign_status_batch_fallback($post_ids);
    }

    $existing_ids = array_values(array_unique(array_map('intval', $existing_ids)));

    if (!empty($existing_ids)) {
        $existing_placeholders = implode(', ', array_fill(0, count($existing_ids), '%d'));
        $updated = $wpdb->query(
            $wpdb->prepare(
                "UPDATE {$wpdb->postmeta}
                SET meta_value = %s
                WHERE meta_key = %s
                  AND post_id IN ($existing_placeholders)",
                array_merge(['archived', 'status'], $existing_ids)
            )
        );

        if ($updated === false) {
            return wpsg_archive_campaign_status_batch_fallback($post_ids);
        }
    }

    $missing_ids = array_values(array_diff($post_ids, $existing_ids));

    if (!empty($missing_ids)) {
        $value_placeholders = implode(', ', array_fill(0, count($missing_ids), '(%d, %s, %s)'));
        $insert_args = [];

        foreach ($missing_ids as $post_id) {
            $insert_args[] = $post_id;
            $insert_args[] = 'status';
            $insert_args[] = 'archived';
        }

        $inserted = $wpdb->query(
            $wpdb->prepare(
                "INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value) VALUES $value_placeholders",
                $insert_args
            )
        );

        if ($inserted === false) {
            // UPDATE already succeeded for $existing_ids; only retry the missing rows.
            return count($existing_ids) + wpsg_archive_campaign_status_batch_fallback($missing_ids);
        }
    }

    foreach ($post_ids as $post_id) {
        clean_post_cache($post_id);
    }

    return count($post_ids);
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

        if (!empty($query->posts)) {
            $archived_count += wpsg_archive_campaign_status_batch($query->posts);
        }
    } while (!empty($query->posts));

    // Bump cache version once after all updates (no LIKE queries needed).
    if ($archived_count > 0) {
        WPSG_REST::bump_cache_version();
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

// P19-C: WP-CLI command surface — only loaded when running under WP-CLI.
if ( defined( 'WP_CLI' ) && WP_CLI && class_exists( 'WP_CLI' ) ) {
    require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-cli.php';
    WP_CLI::add_command( 'wpsg', 'WPSG_CLI' );
}
