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

        // P18-H: Campaign categories (flat, organisational grouping).
        register_taxonomy('wpsg_campaign_category', self::POST_TYPE, [
            'label'             => 'Campaign Categories',
            'public'            => false,
            'show_ui'           => true,
            'show_in_rest'      => true,
            'rest_base'         => 'campaign-categories',
            'hierarchical'      => false,
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
            'sanitize_callback' => [ self::class, 'sanitize_visibility' ],
        ]);

        register_post_meta(self::POST_TYPE, 'status', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => 'draft',
            'sanitize_callback' => [ self::class, 'sanitize_status' ],
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
            'sanitize_callback' => [ self::class, 'sanitize_media_items' ],
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
            'sanitize_callback' => [ self::class, 'sanitize_tags' ],
        ]);

        register_post_meta(self::POST_TYPE, 'cover_image', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
            'sanitize_callback' => 'esc_url_raw',
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
            'sanitize_callback' => [ self::class, 'sanitize_datetime' ],
        ]);

        register_post_meta(self::POST_TYPE, 'unpublish_at', [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'default' => '',
            'sanitize_callback' => [ self::class, 'sanitize_datetime' ],
        ]);

        register_term_meta('wpsg_company', 'access_grants', [
            'type' => 'array',
            'single' => true,
            'show_in_rest' => false,
            'default' => [],
        ]);
    }

    // ── Sanitize callbacks (P20-D) ───────────────────────────

    /**
     * Whitelist visibility values.
     *
     * @since 0.18.0 P20-D
     * @param  mixed $value Raw value.
     * @return string Sanitized value.
     */
    public static function sanitize_visibility( $value ): string {
        return in_array( $value, [ 'public', 'private' ], true ) ? $value : 'public';
    }

    /**
     * Whitelist status values.
     *
     * @since 0.18.0 P20-D
     * @param  mixed $value Raw value.
     * @return string Sanitized value.
     */
    public static function sanitize_status( $value ): string {
        return in_array( $value, [ 'draft', 'active', 'archived' ], true ) ? $value : 'draft';
    }

    /**
     * Sanitize media_items array.
     *
     * Validates structure and sanitizes each field. Malformed entries are
     * silently dropped.
     *
     * @since 0.18.0 P20-D
     * @param  mixed $value Raw value.
     * @return array Sanitized media items.
     */
    public static function sanitize_media_items( $value ): array {
        if ( ! is_array( $value ) ) {
            return [];
        }

        $valid_types    = [ 'image', 'video', 'embed' ];
        $valid_sources  = [ 'wp', 'external', 'oembed' ];
        $sanitized      = [];

        foreach ( $value as $item ) {
            if ( ! is_array( $item ) ) {
                continue;
            }

            $clean = [
                'id'           => isset( $item['id'] ) ? sanitize_text_field( $item['id'] ) : '',
                'type'         => isset( $item['type'] ) && in_array( $item['type'], $valid_types, true )
                    ? $item['type'] : 'image',
                'source'       => isset( $item['source'] ) && in_array( $item['source'], $valid_sources, true )
                    ? $item['source'] : 'wp',
                'url'          => isset( $item['url'] ) ? esc_url_raw( $item['url'] ) : '',
                'thumbnail'    => isset( $item['thumbnail'] ) ? esc_url_raw( $item['thumbnail'] ) : '',
                'caption'      => isset( $item['caption'] ) ? sanitize_text_field( $item['caption'] ) : '',
                'order'        => isset( $item['order'] ) ? intval( $item['order'] ) : 0,
                'embedUrl'     => isset( $item['embedUrl'] ) ? esc_url_raw( $item['embedUrl'] ) : '',
                'provider'     => isset( $item['provider'] ) ? sanitize_text_field( $item['provider'] ) : '',
                'attachmentId' => isset( $item['attachmentId'] ) ? intval( $item['attachmentId'] ) : 0,
                'title'        => isset( $item['title'] ) ? sanitize_text_field( $item['title'] ) : '',
            ];

            // Drop entries with no usable ID
            if ( $clean['id'] !== '' ) {
                $sanitized[] = $clean;
            }
        }

        return $sanitized;
    }

    /**
     * Sanitize tags array.
     *
     * @since 0.18.0 P20-D
     * @param  mixed $value Raw value.
     * @return array Sanitized tag strings.
     */
    public static function sanitize_tags( $value ): array {
        if ( ! is_array( $value ) ) {
            return [];
        }
        return array_values( array_filter( array_map( 'sanitize_text_field', $value ) ) );
    }

    /**
     * Validate and sanitize ISO 8601 datetime strings.
     *
     * Accepts format: Y-m-d\TH:i:s (e.g. 2026-03-05T14:30:00)
     * Also accepts Y-m-d\TH:i:sP (with timezone offset) and empty string.
     *
     * @since 0.18.0 P20-D
     * @param  mixed $value Raw value.
     * @return string Validated datetime or empty string.
     */
    public static function sanitize_datetime( $value ): string {
        if ( ! is_string( $value ) || trim( $value ) === '' ) {
            return '';
        }
        $value = sanitize_text_field( $value );
        // Accept ISO 8601 variants
        if ( preg_match( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?$/', $value ) ) {
            return $value;
        }
        return '';
    }
}
