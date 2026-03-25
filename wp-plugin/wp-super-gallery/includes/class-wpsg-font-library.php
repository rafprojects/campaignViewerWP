<?php
/**
 * WP Super Gallery — Custom Font Library
 *
 * Manages custom font uploads for use in typography overrides.
 * Files are stored in wp-content/uploads/wpsg-fonts/.
 * Metadata is stored in the `wpsg_font_library` WP option.
 *
 * Modeled on class-wpsg-overlay-library.php.
 *
 * @package WP_Super_Gallery
 * @since   0.21.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WPSG_Font_Library {

    const OPTION_KEY    = 'wpsg_font_library';
    const UPLOAD_SUBDIR = 'wpsg-fonts';
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

    /**
     * Allowed MIME types for font uploads.
     */
    private static $allowed_mimes = [
        'woff2' => 'font/woff2',
        'woff'  => 'font/woff',
        'ttf'   => 'font/ttf',
        'otf'   => 'font/opentype',
    ];

    // ── Read ────────────────────────────────────────────────────

    /**
     * Return all stored font entries, newest first.
     *
     * @return array
     */
    public static function get_all(): array {
        $raw = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $raw ) ) {
            return [];
        }
        $items = array_values( $raw );
        usort( $items, fn( $a, $b ) => strcmp( $b['uploadedAt'] ?? '', $a['uploadedAt'] ?? '' ) );
        return $items;
    }

    // ── Write ───────────────────────────────────────────────────

    /**
     * Add a new font entry after successful upload.
     *
     * @param  array $data  { url, name, filename, format }
     * @return array The stored font record.
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
            'filename'   => sanitize_file_name( $data['filename'] ?? '' ),
            'format'     => sanitize_text_field( $data['format'] ?? '' ),
            'uploadedAt' => gmdate( 'c' ),
        ];

        $all[ $id ] = $entry;
        update_option( self::OPTION_KEY, $all, false );

        return $entry;
    }

    /**
     * Remove a font entry and delete the physical file.
     *
     * @param  string $id
     * @return bool
     */
    public static function remove( string $id ): bool {
        $all = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $all ) || ! isset( $all[ $id ] ) ) {
            return false;
        }

        $entry = $all[ $id ];
        if ( ! empty( $entry['url'] ) ) {
            $upload_dir = wp_upload_dir();
            $base_url   = trailingslashit( $upload_dir['baseurl'] );
            $base_dir   = trailingslashit( $upload_dir['basedir'] );

            if ( str_starts_with( $entry['url'], $base_url ) ) {
                $relative  = substr( $entry['url'], strlen( $base_url ) );
                $file_path = $base_dir . $relative;

                $real_path = realpath( $file_path );
                if ( $real_path && str_starts_with( $real_path, realpath( $upload_dir['basedir'] ) . DIRECTORY_SEPARATOR ) ) {
                    wp_delete_file( $real_path );
                }
            }
        }

        unset( $all[ $id ] );
        update_option( self::OPTION_KEY, $all, false );
        return true;
    }

    // ── File upload ─────────────────────────────────────────────

    /**
     * Handle an uploaded font file.
     *
     * @param  array $file  Single entry from $_FILES.
     * @return array|WP_Error  { url, format } on success.
     */
    public static function handle_upload( array $file ) {
        // Check file size.
        $max_size = apply_filters( 'wpsg_font_max_upload_size', self::MAX_FILE_SIZE );
        if ( ! empty( $file['size'] ) && $file['size'] > $max_size ) {
            return new WP_Error( 'wpsg_font_too_large', 'Font file exceeds the maximum allowed size of 2 MB.' );
        }

        if ( ! function_exists( 'wp_handle_upload' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }

        $upload_dir = wp_upload_dir();
        $target_dir = trailingslashit( $upload_dir['basedir'] ) . self::UPLOAD_SUBDIR;
        $target_url = trailingslashit( $upload_dir['baseurl'] ) . self::UPLOAD_SUBDIR;

        if ( ! wp_mkdir_p( $target_dir ) ) {
            return new WP_Error( 'wpsg_font_dir', 'Could not create font upload directory.' );
        }

        self::ensure_htaccess( $target_dir );

        // Temporarily override upload directory.
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

        $result = wp_handle_upload( $file, [
            'test_form' => false,
            'test_type' => true,
            'mimes'     => self::$allowed_mimes,
        ] );

        remove_filter( 'upload_dir', $upload_dir_filter );

        if ( isset( $result['error'] ) ) {
            return new WP_Error( 'wpsg_font_upload', $result['error'] );
        }

        // Validate MIME type after upload.
        $allowed_types = array_values( self::$allowed_mimes );
        if ( ! in_array( $result['type'] ?? '', $allowed_types, true ) ) {
            if ( ! empty( $result['file'] ) && file_exists( $result['file'] ) ) {
                wp_delete_file( $result['file'] );
            }
            return new WP_Error( 'wpsg_font_type', 'Unsupported font type. Allowed: WOFF2, WOFF, TTF, OTF.' );
        }

        // Determine format label for @font-face src.
        $ext = strtolower( pathinfo( $result['file'], PATHINFO_EXTENSION ) );
        $format_map = [
            'woff2' => 'woff2',
            'woff'  => 'woff',
            'ttf'   => 'truetype',
            'otf'   => 'opentype',
        ];

        return [
            'url'    => $result['url'],
            'format' => $format_map[ $ext ] ?? $ext,
        ];
    }

    // ── @font-face CSS generation ───────────────────────────────

    /**
     * Generate @font-face CSS rules for all uploaded fonts.
     *
     * @return string CSS string (empty if no fonts uploaded).
     */
    public static function generate_font_face_css(): string {
        $fonts = self::get_all();
        if ( empty( $fonts ) ) {
            return '';
        }

        $css = '';
        foreach ( $fonts as $font ) {
            if ( empty( $font['url'] ) || empty( $font['name'] ) ) {
                continue;
            }
            $name   = addcslashes( $font['name'], "'" );
            $url    = esc_url( $font['url'] );
            $format = ! empty( $font['format'] ) ? " format('" . esc_attr( $font['format'] ) . "')" : '';

            $css .= "@font-face {\n";
            $css .= "  font-family: '{$name}';\n";
            $css .= "  src: url('{$url}'){$format};\n";
            $css .= "  font-display: swap;\n";
            $css .= "}\n";
        }

        return $css;
    }

    // ── Directory security ──────────────────────────────────────

    /**
     * Ensure .htaccess with correct headers exists in the fonts dir.
     */
    public static function ensure_htaccess( string $dir ): void {
        $htaccess_path = trailingslashit( $dir ) . '.htaccess';
        if ( file_exists( $htaccess_path ) ) {
            return;
        }

        $rules = <<<'HTACCESS'
# WP Super Gallery — Font directory security (P22-L5)

# Disable PHP execution.
<IfModule mod_php.c>
    php_flag engine off
</IfModule>
<IfModule mod_php7.c>
    php_flag engine off
</IfModule>
<IfModule mod_php8.c>
    php_flag engine off
</IfModule>

# Correct Content-Type headers for font files.
<IfModule mod_headers.c>
    <FilesMatch "\.woff2$">
        Header set Content-Type "font/woff2"
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
    <FilesMatch "\.woff$">
        Header set Content-Type "font/woff"
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
    <FilesMatch "\.(ttf|otf)$">
        Header set Access-Control-Allow-Origin "*"
    </FilesMatch>
</IfModule>

# MIME type corrections for older Apache versions.
<IfModule mod_mime.c>
    AddType font/woff2 .woff2
    AddType font/woff .woff
    AddType font/ttf .ttf
    AddType font/opentype .otf
</IfModule>
HTACCESS;

        file_put_contents( $htaccess_path, $rules );
    }
}
