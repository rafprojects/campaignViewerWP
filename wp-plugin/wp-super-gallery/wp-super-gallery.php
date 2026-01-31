<?php
/**
 * Plugin Name: WP Super Gallery
 * Description: Embeddable campaign gallery with Shadow DOM rendering.
 * Version: 0.2.0
 * Author: WP Super Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPSG_VERSION', '0.2.0');
define('WPSG_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('WPSG_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-cpt.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-rest.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-embed.php';
require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-settings.php';

add_action('init', ['WPSG_CPT', 'register']);
add_action('rest_api_init', ['WPSG_REST', 'register_routes']);
add_action('init', ['WPSG_Embed', 'register_shortcode']);
add_action('wp_enqueue_scripts', ['WPSG_Embed', 'register_assets']);

// Initialize settings (admin only).
if (is_admin()) {
    WPSG_Settings::init();
}
