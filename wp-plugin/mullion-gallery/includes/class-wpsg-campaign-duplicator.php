<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WPSG_Campaign_Duplicator {
    /**
     * Duplicate a campaign, optionally copying media associations and deep-cloning
     * the linked layout template binding.
     *
     * @param int    $source_id                 Source campaign post ID.
     * @param string $new_name                  Duplicated campaign title.
     * @param bool   $copy_media                Whether to copy media associations.
     * @param bool   $duplicate_layout_template Whether to clone the linked layout template.
     * @return int|WP_Error New campaign post ID or WP_Error on failure.
     */
    public static function duplicate( int $source_id, string $new_name, bool $copy_media = false, bool $duplicate_layout_template = false ) {
        $source = get_post( $source_id );
        if ( ! $source || 'wpsg_campaign' !== $source->post_type ) {
            return new WP_Error( 'wpsg_campaign_not_found', 'Campaign not found', [ 'status' => 404 ] );
        }

        $new_id = wp_insert_post( [
            'post_type'    => 'wpsg_campaign',
            'post_title'   => $new_name,
            'post_content' => $source->post_content,
            'post_status'  => 'publish',
        ], true );

        if ( is_wp_error( $new_id ) ) {
            return new WP_Error( 'wpsg_internal_error', $new_id->get_error_message(), [ 'status' => 500 ] );
        }

        $meta_keys = [
            'visibility',
            'tags',
            'cover_image',
            '_wpsg_gallery_overrides',
            '_wpsg_layout_binding',
            // P66-D: keep the duplicate in the source campaign's space instead of
            // silently dropping to the Default Space.
            '_wpsg_space_id',
        ];

        foreach ( $meta_keys as $key ) {
            $value = get_post_meta( $source_id, $key, true );
            if ( '' !== $value && false !== $value ) {
                update_post_meta( $new_id, $key, $value );
            }
        }

        $source_layout_template_id = get_post_meta( $source_id, '_wpsg_layout_binding_template_id', true );
        if ( '' !== $source_layout_template_id && false !== $source_layout_template_id ) {
            if ( $duplicate_layout_template ) {
                $cloned_template = WPSG_Layout_Templates::duplicate( (string) $source_layout_template_id, '' );
                if ( is_wp_error( $cloned_template ) ) {
                    wp_delete_post( $new_id, true );

                    return new WP_Error(
                        'wpsg_template_duplicate_failed',
                        $cloned_template->get_error_message(),
                        [ 'status' => 500 ]
                    );
                }

                update_post_meta( $new_id, '_wpsg_layout_binding_template_id', $cloned_template['id'] );
            } else {
                update_post_meta( $new_id, '_wpsg_layout_binding_template_id', $source_layout_template_id );
            }
        }

        update_post_meta( $new_id, 'status', 'draft' );

        if ( $copy_media ) {
            $media_items = get_post_meta( $source_id, 'media_items', true );
            if ( is_array( $media_items ) ) {
                update_post_meta( $new_id, 'media_items', $media_items );
            }
        }

        $company_terms = wp_get_post_terms( $source_id, 'wpsg_company', [ 'fields' => 'ids' ] );
        if ( ! is_wp_error( $company_terms ) && ! empty( $company_terms ) ) {
            wp_set_object_terms( $new_id, $company_terms, 'wpsg_company' );
        }

        // P66-D: carry the categorization taxonomies too — previously only the
        // company term was copied, so a duplicate lost its categories and tags.
        foreach ( [ 'wpsg_campaign_category', 'wpsg_campaign_tag' ] as $taxonomy ) {
            $term_ids = wp_get_post_terms( $source_id, $taxonomy, [ 'fields' => 'ids' ] );
            if ( ! is_wp_error( $term_ids ) && ! empty( $term_ids ) ) {
                wp_set_object_terms( $new_id, $term_ids, $taxonomy );
            }
        }

        return $new_id;
    }
}