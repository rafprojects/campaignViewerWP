<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_CPT {
    const POST_TYPE = 'wpsg_campaign';

    public static function register() {
        register_post_type(self::POST_TYPE, [
            'label' => 'Campaigns',
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'supports' => ['title', 'editor', 'thumbnail'],
            'menu_icon' => 'dashicons-images-alt2',
        ]);

        register_taxonomy('wpsg_company', self::POST_TYPE, [
            'label' => 'Companies',
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'hierarchical' => false,
        ]);

        // P14-G: Campaign tags (non-hierarchical, like WordPress post tags).
        register_taxonomy('wpsg_campaign_tag', self::POST_TYPE, [
            'label' => 'Campaign Tags',
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'hierarchical' => false,
            'show_admin_column' => true,
        ]);

        // P14-G: Media tags (attached to attachments for cross-campaign organization).
        register_taxonomy('wpsg_media_tag', 'attachment', [
            'label' => 'Media Tags',
            'public' => false,
            'show_ui' => true,
            'show_in_rest' => true,
            'hierarchical' => false,
        ]);

        register_post_meta(self::POST_TYPE, 'visibility', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => 'private',
        ]);

        register_post_meta(self::POST_TYPE, 'status', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => 'draft',
        ]);

        register_post_meta(self::POST_TYPE, 'media_items', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => [
                'schema' => [
                    'type'  => 'array',
                    'items' => [
                        'type'       => 'object',
                        'properties' => [
                            'id'           => ['type' => 'string'],
                            'type'         => ['type' => 'string'],
                            'source'       => ['type' => 'string'],
                            'url'          => ['type' => 'string'],
                            'thumbnail'    => ['type' => 'string'],
                            'caption'      => ['type' => 'string'],
                            'order'        => ['type' => 'integer'],
                            'embedUrl'     => ['type' => 'string'],
                            'provider'     => ['type' => 'string'],
                            'attachmentId' => ['type' => 'integer'],
                            'title'        => ['type' => 'string'],
                        ],
                    ],
                ],
            ],
            'default' => [],
        ]);

        register_post_meta(self::POST_TYPE, 'tags', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => [
                'schema' => [
                    'type'  => 'array',
                    'items' => ['type' => 'string'],
                ],
            ],
            'default' => [],
        ]);

        register_post_meta(self::POST_TYPE, 'cover_image', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
        ]);

        register_post_meta(self::POST_TYPE, 'access_grants', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);

        register_post_meta(self::POST_TYPE, 'access_overrides', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);

        // P13-D: Campaign scheduling — optional ISO 8601 date strings.
        // null/empty = no schedule constraint.
        register_post_meta(self::POST_TYPE, 'publish_at', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
        ]);

        register_post_meta(self::POST_TYPE, 'unpublish_at', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
        ]);

        register_term_meta('wpsg_company', 'access_grants', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);
    }
}
