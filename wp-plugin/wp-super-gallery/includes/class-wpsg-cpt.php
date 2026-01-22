<?php

if (!defined('ABSPATH')) {
    exit;
}

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
