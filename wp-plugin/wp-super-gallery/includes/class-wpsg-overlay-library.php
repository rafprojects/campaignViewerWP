<?php
/**
 * WP Super Gallery — Overlay Image Library
 *
 * Manages a campaign-agnostic library of overlay images that can be
 * used across any layout template.  Entries are stored in the
 * `wpsg_overlay_library` WP option as a flat array:
 *   [ { id, url, name, uploadedAt }, … ]
 *
 * Files are uploaded into wp-content/uploads/wpsg-overlays/.
 *
 * @package WP_Super_Gallery
 * @since   0.13.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WPSG_Overlay_Library {

    const OPTION_KEY   = 'wpsg_overlay_library';
    const UPLOAD_SUBDIR = 'wpsg-overlays';

    // ── Read ────────────────────────────────────────────────────

    /**
     * Return all stored overlays, newest first.
     *
     * @return array<int, array{id:string, url:string, name:string, uploadedAt:string}>
     */
    public static function get_all(): array {
        $raw = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $raw ) ) {
            return [];
        }
        // Newest first.
        $items = array_values( $raw );
        usort( $items, fn( $a, $b ) => strcmp( $b['uploadedAt'] ?? '', $a['uploadedAt'] ?? '' ) );
        return $items;
    }

    // ── Write ───────────────────────────────────────────────────

    /**
     * Add a new overlay entry.
     *
     * @param  array{url:string, name:string} $data
     * @return array  The stored overlay record.
     */
    public static function add( array $data ): array {
        $all = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $all ) ) {
            $all = [];
        }

        $id    = wp_generate_uuid4();
        $entry = [
            'id'         => $id,
            'url'        => esc_url_raw( $data['url'] ),
            'name'       => sanitize_text_field( $data['name'] ?? '' ),
            'uploadedAt' => gmdate( 'c' ),
        ];

        $all[ $id ] = $entry;
        update_option( self::OPTION_KEY, $all, false );

        return $entry;
    }

    /**
     * Remove an overlay entry.  Does NOT delete the physical file.
     *
     * @param  string $id
     * @return bool  True if found and removed.
     */
    public static function remove( string $id ): bool {
        $all = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $all ) || ! isset( $all[ $id ] ) ) {
            return false;
        }
        unset( $all[ $id ] );
        update_option( self::OPTION_KEY, $all, false );
        return true;
    }

    // ── File upload helper ──────────────────────────────────────

    /**
     * Handle an uploaded overlay file, move it to the WPSG uploads sub-dir,
     * and return the public URL.
     *
     * @param  array $file  A single entry from $_FILES (after validation).
     * @return string|WP_Error  Public URL on success, WP_Error on failure.
     */
    public static function handle_upload( array $file ) {
        // Allowed MIME types for overlays.
        $allowed_types = [ 'image/png', 'image/svg+xml', 'image/webp', 'image/gif' ];
        // WordPress expects "extension => mime" for upload mimes.
        $allowed_mimes = [
            'png'  => 'image/png',
            'svg'  => 'image/svg+xml',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
        ];

        if ( ! function_exists( 'wp_handle_upload' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        // Determine upload directory.
        $upload_dir = wp_upload_dir();
        $target_dir = trailingslashit( $upload_dir['basedir'] ) . self::UPLOAD_SUBDIR;
        $target_url = trailingslashit( $upload_dir['baseurl'] ) . self::UPLOAD_SUBDIR;

        if ( ! wp_mkdir_p( $target_dir ) ) {
            return new WP_Error( 'wpsg_overlay_dir', 'Could not create overlay upload directory.' );
        }

        // Move uploaded file.
        $overrides = [
            'test_form'   => false,
            'test_type'   => true,
            'mimes'       => $allowed_mimes,
            'upload_error_handler' => null,
        ];

        // Temporarily override WordPress upload directory.
        $base_dir = $upload_dir['basedir'];
        $base_url = $upload_dir['baseurl'];
        $upload_dir_filter = function () use ( $target_dir, $target_url, $base_dir, $base_url ) {
            return [
                'path'    => $target_dir,
                'url'     => $target_url,
                'subdir'  => '/' . self::UPLOAD_SUBDIR,
                'basedir' => $base_dir,
                'baseurl' => $base_url,
                'error'   => false,
            ];
        };
        add_filter( 'upload_dir', $upload_dir_filter );
        $result = wp_handle_upload( $file, $overrides );
        remove_filter( 'upload_dir', $upload_dir_filter );

        if ( isset( $result['error'] ) ) {
            return new WP_Error( 'wpsg_overlay_upload', $result['error'] );
        }

        // Validate MIME type after upload.
        if ( ! in_array( $result['type'] ?? '', $allowed_types, true ) ) {
            // Remove the uploaded file.
            @unlink( $result['file'] );
            return new WP_Error( 'wpsg_overlay_type', 'Only PNG, SVG, WebP, or GIF images are allowed.' );
        }

        return $result['url'];
    }
}
