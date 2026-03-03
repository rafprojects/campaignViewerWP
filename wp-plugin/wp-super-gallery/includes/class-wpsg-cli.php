<?php
/**
 * WP-CLI command surface for WP Super Gallery.
 *
 * Registers the `wp wpsg` command group. All sub-commands bypass
 * the HTTP-layer permission checks (no `manage_wpsg` capability check)
 * because the CLI already requires shell-level access to the server.
 *
 * Usage examples:
 *
 *   wp wpsg campaign list
 *   wp wpsg campaign list --status=archived --format=table
 *   wp wpsg campaign archive 42
 *   wp wpsg campaign restore 42
 *   wp wpsg campaign duplicate 42 --name="Copy of Campaign" --copy-media
 *   wp wpsg campaign export 42
 *   wp wpsg campaign export 42 > campaign-42.json
 *   wp wpsg campaign import ./campaign-42.json
 *   wp wpsg media list 42
 *   wp wpsg media orphans
 *   wp wpsg cache clear
 *   wp wpsg analytics clear 42
 *   wp wpsg rate-limit reset 192.168.1.1
 *
 * @package WP_Super_Gallery
 * @since   0.17.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Manage WP Super Gallery campaigns, media, cache, analytics, and rate-limits.
 */
class WPSG_CLI {

    // ─────────────────────────────────────────────────────────────────────────
    // Campaign commands
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * List campaigns.
     *
     * ## OPTIONS
     *
     * [--status=<status>]
     * : Filter by status (active, archived, draft). Defaults to all.
     *
     * [--format=<format>]
     * : Output format: table, csv, json, ids. Default: table.
     *
     * ## EXAMPLES
     *
     *   wp wpsg campaign list
     *   wp wpsg campaign list --status=archived
     *   wp wpsg campaign list --format=json
     *
     * @subcommand campaign list
     * @when       after_wp_load
     */
    public function campaign_list( array $args, array $assoc_args ): void {
        $status = isset( $assoc_args['status'] ) ? sanitize_text_field( $assoc_args['status'] ) : '';
        $format = isset( $assoc_args['format'] ) ? sanitize_text_field( $assoc_args['format'] ) : 'table';

        $query_args = [
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'no_found_rows'  => true,
        ];

        if ( ! empty( $status ) ) {
            if ( 'draft' === $status ) {
                // Campaigns with no status meta are implicitly draft (matches REST default).
                $query_args['meta_query'] = [
                    'relation' => 'OR',
                    [
                        'key'     => 'status',
                        'value'   => 'draft',
                    ],
                    [
                        'key'     => 'status',
                        'compare' => 'NOT EXISTS',
                    ],
                ];
            } else {
                $query_args['meta_query'] = [
                    [
                        'key'   => 'status',
                        'value' => $status,
                    ],
                ];
            }
        }

        $query = new WP_Query( $query_args );

        if ( empty( $query->posts ) ) {
            WP_CLI::line( 'No campaigns found.' );
            return;
        }

        $rows = [];
        foreach ( $query->posts as $post ) {
            $rows[] = [
                'id'         => $post->ID,
                'title'      => $post->post_title,
                'status'     => get_post_meta( $post->ID, 'status', true ) ?: 'draft',
                'visibility' => get_post_meta( $post->ID, 'visibility', true ) ?: 'private',
                'created'    => $post->post_date,
            ];
        }

        $fields = [ 'id', 'title', 'status', 'visibility', 'created' ];
        WP_CLI\Utils\format_items( $format, $rows, $fields );
    }

    /**
     * Archive a campaign.
     *
     * ## OPTIONS
     *
     * <id>
     * : Campaign post ID.
     *
     * ## EXAMPLES
     *
     *   wp wpsg campaign archive 42
     *
     * @subcommand campaign archive
     * @when       after_wp_load
     */
    public function campaign_archive( array $args, array $assoc_args ): void {
        $post_id = intval( $args[0] ?? 0 );
        if ( ! $this->campaign_exists( $post_id ) ) {
            WP_CLI::error( "Campaign {$post_id} not found." );
        }

        update_post_meta( $post_id, 'status', 'archived' );
        $this->add_audit_entry( $post_id, 'campaign.archived', [ 'source' => 'cli' ] );
        $this->clear_campaign_cache();
        WP_CLI::success( "Campaign {$post_id} archived." );
    }

    /**
     * Restore an archived campaign.
     *
     * ## OPTIONS
     *
     * <id>
     * : Campaign post ID.
     *
     * ## EXAMPLES
     *
     *   wp wpsg campaign restore 42
     *
     * @subcommand campaign restore
     * @when       after_wp_load
     */
    public function campaign_restore( array $args, array $assoc_args ): void {
        $post_id = intval( $args[0] ?? 0 );
        if ( ! $this->campaign_exists( $post_id ) ) {
            WP_CLI::error( "Campaign {$post_id} not found." );
        }

        update_post_meta( $post_id, 'status', 'active' );
        $this->add_audit_entry( $post_id, 'campaign.restored', [ 'source' => 'cli' ] );
        $this->clear_campaign_cache();
        WP_CLI::success( "Campaign {$post_id} restored." );
    }

    /**
     * Duplicate a campaign.
     *
     * ## OPTIONS
     *
     * <id>
     * : Source campaign post ID.
     *
     * [--name=<name>]
     * : Title for the new campaign. Defaults to "<original title> (Copy)".
     *
     * [--copy-media]
     * : Also copy the media_items array to the new campaign.
     *
     * ## EXAMPLES
     *
     *   wp wpsg campaign duplicate 42
     *   wp wpsg campaign duplicate 42 --name="My New Campaign" --copy-media
     *
     * @subcommand campaign duplicate
     * @when       after_wp_load
     */
    public function campaign_duplicate( array $args, array $assoc_args ): void {
        $source_id = intval( $args[0] ?? 0 );
        if ( ! $this->campaign_exists( $source_id ) ) {
            WP_CLI::error( "Campaign {$source_id} not found." );
        }

        $source     = get_post( $source_id );
        $new_name   = isset( $assoc_args['name'] )
            ? sanitize_text_field( $assoc_args['name'] )
            : ( $source->post_title . ' (Copy)' );
        $copy_media = isset( $assoc_args['copy-media'] );

        $new_id = wp_insert_post( [
            'post_type'    => 'wpsg_campaign',
            'post_title'   => $new_name,
            'post_content' => $source->post_content,
            'post_status'  => 'publish',
        ], true );

        if ( is_wp_error( $new_id ) ) {
            WP_CLI::error( 'Failed to create campaign: ' . $new_id->get_error_message() );
        }

        // Copy campaign-specific meta keys.
        $meta_keys = [
            'visibility',
            'tags',
            'cover_image',
            '_wpsg_image_adapter_id',
            '_wpsg_video_adapter_id',
            '_wpsg_layout_binding_template_id',
            '_wpsg_layout_binding',
        ];
        foreach ( $meta_keys as $key ) {
            $value = get_post_meta( $source_id, $key, true );
            if ( $value !== '' && $value !== false ) {
                update_post_meta( $new_id, $key, $value );
            }
        }
        // Duplicates always start as draft.
        update_post_meta( $new_id, 'status', 'draft' );

        if ( $copy_media ) {
            $media_items = get_post_meta( $source_id, 'media_items', true );
            if ( is_array( $media_items ) ) {
                update_post_meta( $new_id, 'media_items', $media_items );
            }
        }

        // Copy company taxonomy assignment.
        $company_terms = wp_get_post_terms( $source_id, 'wpsg_company', [ 'fields' => 'ids' ] );
        if ( ! is_wp_error( $company_terms ) && ! empty( $company_terms ) ) {
            wp_set_object_terms( $new_id, $company_terms, 'wpsg_company' );
        }

        $this->add_audit_entry( $new_id, 'campaign.duplicated', [
            'source_id'  => $source_id,
            'copy_media' => $copy_media,
            'source'     => 'cli',
        ] );
        $this->clear_campaign_cache();
        WP_CLI::success( "Campaign duplicated. New ID: {$new_id}" );
    }

    /**
     * Export a campaign as JSON to stdout.
     *
     * ## OPTIONS
     *
     * <id>
     * : Campaign post ID.
     *
     * ## EXAMPLES
     *
     *   wp wpsg campaign export 42
     *   wp wpsg campaign export 42 > campaign-42.json
     *
     * @subcommand campaign export
     * @when       after_wp_load
     */
    public function campaign_export( array $args, array $assoc_args ): void {
        $post_id = intval( $args[0] ?? 0 );
        if ( ! $this->campaign_exists( $post_id ) ) {
            WP_CLI::error( "Campaign {$post_id} not found." );
        }

        $post     = get_post( $post_id );
        $campaign = $this->format_campaign( $post );
        $media    = get_post_meta( $post_id, 'media_items', true ) ?: [];

        // Embed layout template by value so the export is self-contained.
        $template_id     = get_post_meta( $post_id, '_wpsg_layout_binding_template_id', true );
        $layout_template = null;
        if ( $template_id ) {
            $tmpl = get_post( intval( $template_id ) );
            if ( $tmpl ) {
                $layout_template = [
                    'id'             => (string) $tmpl->ID,
                    'title'          => $tmpl->post_title,
                    'slots'          => get_post_meta( $tmpl->ID, 'slots', true ) ?: [],
                    'background'     => get_post_meta( $tmpl->ID, 'background', true ) ?: [],
                    'graphicLayers'  => get_post_meta( $tmpl->ID, 'graphic_layers', true ) ?: [],
                ];
            }
        }

        $payload = [
            'version'          => 1,
            'exported_at'      => gmdate( 'c' ),
            'campaign'         => $campaign,
            'layout_template'  => $layout_template,
            'media_references' => array_values( array_map( function ( $item ) {
                return [
                    'id'    => $item['id'] ?? '',
                    'url'   => $item['url'] ?? '',
                    'title' => $item['title'] ?? '',
                ];
            }, (array) $media ) ),
        ];

        // Output raw JSON — allows shell redirect to file.
        WP_CLI::line( wp_json_encode( $payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) );
    }

    /**
     * Import a campaign from a JSON export file.
     *
     * ## OPTIONS
     *
     * <file>
     * : Path to a JSON file previously exported by `wp wpsg campaign export`.
     *
     * ## EXAMPLES
     *
     *   wp wpsg campaign import ./campaign-42.json
     *
     * @subcommand campaign import
     * @when       after_wp_load
     */
    public function campaign_import( array $args, array $assoc_args ): void {
        $file = $args[0] ?? '';
        if ( ! $file || ! file_exists( $file ) ) {
            WP_CLI::error( "File not found: {$file}" );
        }
        if ( ! is_readable( $file ) ) {
            WP_CLI::error( "File is not readable: {$file}" );
        }

        $raw = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        if ( $raw === false ) {
            WP_CLI::error( "Could not read file: {$file}" );
        }

        $body = json_decode( $raw, true );
        if ( json_last_error() !== JSON_ERROR_NONE ) {
            WP_CLI::error( 'Invalid JSON: ' . json_last_error_msg() );
        }

        if ( empty( $body ) || ! isset( $body['campaign'] ) ) {
            WP_CLI::error( 'Invalid payload: missing campaign key.' );
        }
        $version = intval( $body['version'] ?? 0 );
        if ( $version !== 1 ) {
            WP_CLI::error( "Unsupported export version: {$version}." );
        }

        $src         = $body['campaign'];
        $title       = sanitize_text_field( $src['title'] ?? 'Imported Campaign' );
        $description = sanitize_textarea_field( $src['description'] ?? '' );

        $post_id = wp_insert_post( [
            'post_title'   => $title,
            'post_content' => $description,
            'post_type'    => 'wpsg_campaign',
            'post_status'  => 'publish',
        ], true );

        if ( is_wp_error( $post_id ) ) {
            WP_CLI::error( 'Failed to create campaign: ' . $post_id->get_error_message() );
        }

        // Copy scalar meta; always import as draft.
        $meta_map = [
            'visibility'      => 'visibility',
            'tags'            => 'tags',
            'coverImage'      => 'cover_image',
            'publishAt'       => 'publish_at',
            'unpublishAt'     => 'unpublish_at',
            'imageAdapterId'  => '_wpsg_image_adapter_id',
            'videoAdapterId'  => '_wpsg_video_adapter_id',
        ];
        update_post_meta( $post_id, 'status', 'draft' );
        foreach ( $meta_map as $src_key => $meta_key ) {
            if ( ! empty( $src[ $src_key ] ) ) {
                if ( $src_key === 'tags' && is_array( $src[ $src_key ] ) ) {
                    update_post_meta( $post_id, $meta_key, array_values( array_map( 'sanitize_text_field', $src[ $src_key ] ) ) );
                } else {
                    update_post_meta( $post_id, $meta_key, sanitize_text_field( $src[ $src_key ] ) );
                }
            }
        }

        // Embed layout template by value if provided.
        $layout_template = $body['layout_template'] ?? null;
        if ( $layout_template ) {
            $tmpl_id = wp_insert_post(
                [
                    'post_title'  => sanitize_text_field( $layout_template['title'] ?? 'Imported Template' ),
                    'post_type'   => 'wpsg_layout_template',
                    'post_status' => 'publish',
                ],
                true // Return WP_Error on failure instead of 0.
            );
            if ( $tmpl_id && ! is_wp_error( $tmpl_id ) ) {
                update_post_meta( $tmpl_id, 'slots', $layout_template['slots'] ?? [] );
                update_post_meta( $tmpl_id, 'background', $layout_template['background'] ?? [] );
                update_post_meta( $tmpl_id, 'graphic_layers', $layout_template['graphicLayers'] ?? [] );
                update_post_meta( $post_id, '_wpsg_layout_binding_template_id', (string) $tmpl_id );
                if ( ! empty( $src['layoutBinding'] ) ) {
                    update_post_meta( $post_id, '_wpsg_layout_binding', $src['layoutBinding'] );
                }
            }
        }

        // Import media references (URL-only, no binary transfer).
        $media_refs = $body['media_references'] ?? [];
        if ( is_array( $media_refs ) && ! empty( $media_refs ) ) {
            $media_items = array_values( array_map( function ( $ref ) {
                return [
                    'id'     => sanitize_text_field( $ref['id'] ?? '' ),
                    'url'    => esc_url_raw( $ref['url'] ?? '' ),
                    'title'  => sanitize_text_field( $ref['title'] ?? '' ),
                    'type'   => 'image',
                    'source' => 'url',
                    'order'  => 0,
                ];
            }, $media_refs ) );
            update_post_meta( $post_id, 'media_items', $media_items );
        }

        $this->add_audit_entry( $post_id, 'campaign.imported', [ 'source_title' => $title, 'source' => 'cli' ] );
        WP_CLI::success( "Campaign imported. New ID: {$post_id}" );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Media commands
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * List media items for a campaign.
     *
     * ## OPTIONS
     *
     * <campaign-id>
     * : Campaign post ID.
     *
     * [--format=<format>]
     * : Output format: table, csv, json, ids. Default: table.
     *
     * ## EXAMPLES
     *
     *   wp wpsg media list 42
     *   wp wpsg media list 42 --format=json
     *
     * @subcommand media list
     * @when       after_wp_load
     */
    public function media_list( array $args, array $assoc_args ): void {
        $post_id = intval( $args[0] ?? 0 );
        if ( ! $this->campaign_exists( $post_id ) ) {
            WP_CLI::error( "Campaign {$post_id} not found." );
        }

        $format      = isset( $assoc_args['format'] ) ? sanitize_text_field( $assoc_args['format'] ) : 'table';
        $media_items = get_post_meta( $post_id, 'media_items', true );
        $media_items = is_array( $media_items ) ? $media_items : [];

        if ( empty( $media_items ) ) {
            WP_CLI::line( "No media items found for campaign {$post_id}." );
            return;
        }

        $rows = array_map( function ( $item ) {
            return [
                'id'     => $item['id'] ?? '',
                'title'  => $item['title'] ?? '',
                'type'   => $item['type'] ?? 'image',
                'source' => $item['source'] ?? '',
                'url'    => $item['url'] ?? '',
            ];
        }, $media_items );

        WP_CLI\Utils\format_items( $format, $rows, [ 'id', 'title', 'type', 'source', 'url' ] );
    }

    /**
     * List media items that are not attached to any campaign.
     *
     * Orphan media items are WordPress attachments (post_type=attachment) under
     * the wpsg_company taxonomy that are not referenced by any campaign's
     * media_items meta array (i.e. no campaign has an entry whose attachmentId
     * matches the attachment's post ID).
     *
     * ## OPTIONS
     *
     * [--format=<format>]
     * : Output format: table, csv, json, ids. Default: table.
     *
     * ## EXAMPLES
     *
     *   wp wpsg media orphans
     *   wp wpsg media orphans --format=json
     *
     * @subcommand media orphans
     * @when       after_wp_load
     */
    public function media_orphans( array $args, array $assoc_args ): void {
        $format = isset( $assoc_args['format'] ) ? sanitize_text_field( $assoc_args['format'] ) : 'table';

        // Collect all media IDs referenced by any campaign.
        $campaigns = get_posts( [
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'publish',
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ] );

        // Build a set for O(1) membership checks (vs O(n) in_array on large sites).
        $referenced_ids = [];
        foreach ( $campaigns as $campaign_id ) {
            $media_items = get_post_meta( $campaign_id, 'media_items', true );
            if ( is_array( $media_items ) ) {
                foreach ( $media_items as $item ) {
                    // Only use attachmentId (WP post ID); 'id' is a uniqid string and never matches attachment IDs.
                    if ( ! empty( $item['attachmentId'] ) ) {
                        $referenced_ids[ (string) $item['attachmentId'] ] = true;
                    }
                }
            }
        }

        // Find WP attachment posts that are under this plugin's taxonomy
        // (uploaded via wp-super-gallery) and not referenced by any campaign.
        $attachments = get_posts( [
            'post_type'      => 'attachment',
            'post_status'    => 'inherit',
            'posts_per_page' => -1,
            'tax_query'      => [
                [
                    'taxonomy' => 'wpsg_company',
                    'operator' => 'EXISTS',
                ],
            ],
        ] );

        $orphans = [];
        foreach ( $attachments as $att ) {
            if ( ! isset( $referenced_ids[ (string) $att->ID ] ) ) {
                $orphans[] = [
                    'id'    => $att->ID,
                    'title' => $att->post_title,
                    'url'   => wp_get_attachment_url( $att->ID ),
                    'date'  => $att->post_date,
                ];
            }
        }

        if ( empty( $orphans ) ) {
            WP_CLI::success( 'No orphaned media found.' );
            return;
        }

        WP_CLI::warning( count( $orphans ) . ' orphaned media item(s) found.' );
        WP_CLI\Utils\format_items( $format, $orphans, [ 'id', 'title', 'url', 'date' ] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Cache commands
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Clear the thumbnail cache.
     *
     * ## EXAMPLES
     *
     *   wp wpsg cache clear
     *
     * @subcommand cache clear
     * @when       after_wp_load
     */
    public function cache_clear( array $args, array $assoc_args ): void {
        $removed = WPSG_Thumbnail_Cache::clear_all();
        $this->clear_campaign_cache();
        WP_CLI::success( "Thumbnail cache cleared. Removed: {$removed} item(s)." );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Analytics commands
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Clear analytics events for a campaign.
     *
     * ## OPTIONS
     *
     * <campaign-id>
     * : Campaign post ID. Pass 0 to clear all analytics.
     *
     * ## EXAMPLES
     *
     *   wp wpsg analytics clear 42
     *   wp wpsg analytics clear 0
     *
     * @subcommand analytics clear
     * @when       after_wp_load
     */
    public function analytics_clear( array $args, array $assoc_args ): void {
        global $wpdb;

        $campaign_id = intval( $args[0] ?? -1 );
        $table       = WPSG_DB::get_analytics_table();

        if ( $campaign_id === 0 ) {
            // Clear all analytics.
            $deleted = $wpdb->query( "TRUNCATE TABLE {$table}" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            WP_CLI::success( 'All analytics events cleared.' );
            return;
        }

        if ( ! $this->campaign_exists( $campaign_id ) ) {
            WP_CLI::error( "Campaign {$campaign_id} not found." );
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $deleted = $wpdb->delete( $table, [ 'campaign_id' => $campaign_id ], [ '%d' ] );
        $count   = is_int( $deleted ) ? $deleted : 0;
        WP_CLI::success( "Analytics cleared for campaign {$campaign_id}. Rows deleted: {$count}." );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rate-limit commands
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Reset all rate-limit counters for an IP address.
     *
     * The actual cache keys used by WPSG_REST::rate_limit_check() include the
     * route in the hash — i.e. wpsg_rl_<scope>_<user|anon>_<md5(ip|route)> —
     * so individual keys cannot be recovered from the IP alone. This command
     * therefore flushes the entire wpsg_rate_limit object-cache group and
     * bulk-deletes all _transient_wpsg_rl_* rows from wp_options, effectively
     * clearing rate limits for every client. Use on dev/staging only.
     *
     * ## OPTIONS
     *
     * <ip>
     * : IP address whose rate-limit counter should be reset (used for logging).
     *
     * ## EXAMPLES
     *
     *   wp wpsg rate-limit reset 192.168.1.1
     *
     * @subcommand rate-limit reset
     * @when       after_wp_load
     */
    public function rate_limit_reset( array $args, array $assoc_args ): void {
        global $wpdb;

        $ip = sanitize_text_field( $args[0] ?? '' );
        if ( ! $ip ) {
            WP_CLI::error( 'IP address is required.' );
        }

        // Flush the entire object-cache group (wp_cache_flush_group() available WP ≥ 6.1).
        if ( function_exists( 'wp_cache_flush_group' ) ) {
            wp_cache_flush_group( 'wpsg_rate_limit' );
        }

        // Bulk-delete all matching transients from the DB (fallback storage path and
        // persistent caches that mirror to wp_options).
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
        $deleted = $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
                $wpdb->esc_like( '_transient_wpsg_rl_' ) . '%',
                $wpdb->esc_like( '_transient_timeout_wpsg_rl_' ) . '%'
            )
        );

        WP_CLI::success( "Rate-limit counters reset (triggered for IP: {$ip}). DB rows removed: {$deleted}." );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Check whether a campaign post exists.
     */
    private function campaign_exists( int $post_id ): bool {
        if ( $post_id <= 0 ) {
            return false;
        }
        $post = get_post( $post_id );
        return $post instanceof WP_Post && $post->post_type === 'wpsg_campaign';
    }

    /**
     * Format a campaign post into a simple associative array (subset of
     * WPSG_REST::format_campaign, sufficient for export payloads).
     */
    private function format_campaign( WP_Post $post ): array {
        return [
            'id'          => (string) $post->ID,
            'title'       => $post->post_title,
            'description' => $post->post_content,
            'status'      => get_post_meta( $post->ID, 'status', true ) ?: 'draft',
            'visibility'  => get_post_meta( $post->ID, 'visibility', true ) ?: 'private',
            'tags'        => get_post_meta( $post->ID, 'tags', true ) ?: [],
            'coverImage'  => get_post_meta( $post->ID, 'cover_image', true ) ?: '',
            'publishAt'   => get_post_meta( $post->ID, 'publish_at', true ) ?: '',
            'unpublishAt' => get_post_meta( $post->ID, 'unpublish_at', true ) ?: '',
            'layoutBinding' => get_post_meta( $post->ID, '_wpsg_layout_binding', true ) ?: null,
            'imageAdapterId' => get_post_meta( $post->ID, '_wpsg_image_adapter_id', true ) ?: '',
            'videoAdapterId' => get_post_meta( $post->ID, '_wpsg_video_adapter_id', true ) ?: '',
            'createdAt'   => $post->post_date,
            'updatedAt'   => $post->post_modified,
        ];
    }

    /**
     * Record a campaign audit-log entry (mirrors WPSG_REST::add_audit_entry).
     */
    private function add_audit_entry( int $campaign_id, string $event, array $data = [] ): void {
        $entries   = get_post_meta( $campaign_id, 'audit_log', true );
        $entries   = is_array( $entries ) ? $entries : [];
        $entries[] = [
            'event'   => $event,
            'data'    => $data,
            'user_id' => 0, // CLI context — no WP user.
            'time'    => gmdate( 'c' ),
        ];
        update_post_meta( $campaign_id, 'audit_log', $entries );
    }

    /**
     * Invalidate all wpsg_campaigns_* transient cache entries.
     */
    private function clear_campaign_cache(): void {
        global $wpdb;
        $like         = $wpdb->esc_like( '_transient_wpsg_campaigns_' ) . '%';
        $timeout_like = $wpdb->esc_like( '_transient_timeout_wpsg_campaigns_' ) . '%';
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
                $like,
                $timeout_like
            )
        );
    }
}
