<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WPSG Custom Post Type Registration
 * 
 * SECURITY MODEL:
 * ===============
 * The wpsg_campaign post type uses a layered security approach:
 * 
 * 1. POST TYPE CONFIGURATION:
 *    - 'public' => false: Hides campaigns from public WordPress queries (archives, search)
 *    - 'show_in_rest' => true: Enables REST API access for authenticated API usage
 *    - 'show_ui' => true: Allows admin management in WP admin panel
 * 
 * 2. VISIBILITY LEVELS (via 'visibility' meta field):
 *    - 'public': Viewable by anyone (logged in or not)
 *    - 'unlisted': Viewable only by users with explicit access grants
 *    - 'private': Viewable only by users with explicit access grants (default)
 * 
 * 3. ACCESS CONTROL SYSTEM:
 *    - Admins (manage_options capability) have full access to all campaigns
 *    - Non-admin access is controlled via:
 *      a) Company-level grants (wpsg_company taxonomy meta 'access_grants')
 *      b) Campaign-level grants (post meta 'access_grants')
 *      c) Campaign-level overrides (post meta 'access_overrides') - can deny specific users
 * 
 * 4. REST API ENFORCEMENT:
 *    - All GET endpoints enforce visibility and access grant checks
 *    - List endpoint filters results based on current user's access
 *    - Individual campaign GET returns 403 if user lacks access
 *    - Write operations (POST, PUT, DELETE) require admin privileges
 * 
 * This configuration provides fine-grained control while maintaining REST API
 * functionality for the frontend application.
 */
class WPSG_CPT {
    public static function register() {
        register_post_type('wpsg_campaign', [
            'label' => 'Campaigns',
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'supports' => ['title', 'editor', 'thumbnail'],
            'menu_icon' => 'dashicons-images-alt2',
        ]);

        register_taxonomy('wpsg_company', 'wpsg_campaign', [
            'label' => 'Companies',
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'hierarchical' => false,
        ]);

        register_post_meta('wpsg_campaign', 'visibility', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => 'private',
        ]);

        register_post_meta('wpsg_campaign', 'status', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => 'draft',
        ]);

        register_post_meta('wpsg_campaign', 'media_items', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => true,
            'default' => [],
        ]);

        register_post_meta('wpsg_campaign', 'tags', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => true,
            'default' => [],
        ]);

        register_post_meta('wpsg_campaign', 'cover_image', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
        ]);

        register_post_meta('wpsg_campaign', 'access_grants', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);

        register_post_meta('wpsg_campaign', 'access_overrides', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);

        register_term_meta('wpsg_company', 'access_grants', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);
    }
}
