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
     * Remove an overlay entry and delete the physical file from disk.
     *
     * @param  string $id
     * @return bool  True if found and removed.
     */
    public static function remove( string $id ): bool {
        $all = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $all ) || ! isset( $all[ $id ] ) ) {
            return false;
        }

        // Attempt to delete the physical file.
        $entry = $all[ $id ];
        if ( ! empty( $entry['url'] ) ) {
            $upload_dir = wp_upload_dir();
            $base_url   = trailingslashit( $upload_dir['baseurl'] );
            $base_dir   = trailingslashit( $upload_dir['basedir'] );

            // Only delete if the URL lives inside our uploads directory.
            if ( str_starts_with( $entry['url'], $base_url ) ) {
                $relative  = substr( $entry['url'], strlen( $base_url ) );
                $file_path = $base_dir . $relative;

                // Prevent path traversal: resolve to a real path and ensure
                // it still resides within the uploads directory.
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

    // ── File upload helper ──────────────────────────────────────

    /**
     * Handle an uploaded overlay file, move it to the WPSG uploads sub-dir,
     * and return the public URL.
     *
     * @param  array $file  A single entry from $_FILES (after validation).
     * @return string|WP_Error  Public URL on success, WP_Error on failure.
     */
    public static function handle_upload( array $file ) {
        // Allowed MIME types — covers overlays (transparent formats) and
        // background images (any common image format).
        $allowed_types = [
            'image/png',
            // SVG: allowed for admin-only overlay uploads. SVGs are passed through
            // wp_handle_upload() which validates against the MIME allowlist, but
            // does not strip inline scripts. Restrict callers to admin capability
            // checks (enforced in the REST endpoint) to mitigate XSS risk.
            'image/svg+xml',
            'image/webp',
            'image/gif',
            'image/jpeg',
            'image/jpg',
            'image/avif',
            'image/tiff',
        ];
        // WordPress expects "extension => mime" for upload mimes.
        $allowed_mimes = [
            'png'  => 'image/png',
            'svg'  => 'image/svg+xml',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'avif' => 'image/avif',
            'tif'  => 'image/tiff',
            'tiff' => 'image/tiff',
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

        // L-8: Ensure the .htaccess with CSP headers exists in the overlays dir.
        self::ensure_htaccess( $target_dir );

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
            // Remove the uploaded file using the WP helper which handles errors cleanly.
            if ( ! empty( $result['file'] ) && file_exists( $result['file'] ) ) {
                wp_delete_file( $result['file'] );
            }
            return new WP_Error( 'wpsg_overlay_type', 'Unsupported image type. Allowed: PNG, SVG, WebP, GIF, JPEG, AVIF.' );
        }

        // L-2: Server-side SVG sanitization (P20-L).
        // Strip <script>, event handlers, <foreignObject>, javascript: URIs,
        // and external resource references. Re-serialization also destroys
        // polyglot file properties (SVG/HTML or SVG/JS dual-format tricks).
        if ( ( $result['type'] ?? '' ) === 'image/svg+xml' && ! empty( $result['file'] ) ) {
            $sanitize_result = self::sanitize_svg_file( $result['file'] );
            if ( is_wp_error( $sanitize_result ) ) {
                wp_delete_file( $result['file'] );
                return $sanitize_result;
            }
        }

        return $result['url'];
    }

    // ── Upload Directory Security (L-8) ────────────────────────

    /**
     * Ensure the wpsg-overlays directory has an .htaccess file that:
     * 1. Sets Content-Security-Policy: script-src 'none' on SVG files
     *    (prevents script execution even if served directly)
     * 2. Sets Content-Disposition: inline (safe display, no download prompt)
     * 3. Disables PHP execution in the uploads directory
     *
     * Nginx users should add equivalent rules manually — see docs.
     */
    public static function ensure_htaccess( string $dir ): void {
        $htaccess_path = trailingslashit( $dir ) . '.htaccess';
        if ( file_exists( $htaccess_path ) ) {
            return;
        }

        $rules = <<<'HTACCESS'
# WP Super Gallery — Overlay directory security (P20-L)
# Prevents script execution in SVG files served directly.

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

# CSP and security headers for SVG files.
<IfModule mod_headers.c>
    <FilesMatch "\.svg$">
        Header set Content-Security-Policy "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"
        Header set X-Content-Type-Options "nosniff"
    </FilesMatch>
</IfModule>
HTACCESS;

        file_put_contents( $htaccess_path, $rules );
    }

    // ── SVG Sanitization (P20-L) ────────────────────────────────

    /**
     * Sanitize an SVG file on disk using enshrined/svg-sanitize.
     *
     * Reads the file, runs it through the sanitizer with remote references
     * disabled, applies custom CSS and URI validation, and writes the clean
     * output back. Returns WP_Error if the SVG is entirely malicious
     * (empty after sanitization).
     *
     * @param  string $file_path  Absolute path to the SVG file.
     * @return true|WP_Error      True on success, WP_Error on failure.
     */
    public static function sanitize_svg_file( string $file_path ) {
        if ( ! file_exists( $file_path ) ) {
            return new WP_Error( 'wpsg_svg_missing', 'SVG file not found.' );
        }

        $dirty = file_get_contents( $file_path );
        if ( empty( $dirty ) ) {
            return new WP_Error( 'wpsg_svg_empty', 'SVG file is empty.' );
        }

        $clean = self::sanitize_svg_string( $dirty );
        if ( $clean === null || trim( $clean ) === '' ) {
            return new WP_Error( 'wpsg_svg_malicious', 'SVG rejected: file contained only dangerous content.' );
        }

        // Write sanitized content back.
        file_put_contents( $file_path, $clean );
        return true;
    }

    /**
     * Sanitize an SVG string and return the clean output.
     *
     * @param  string $dirty  Raw SVG markup.
     * @return string|null    Clean SVG or null if entirely stripped.
     */
    public static function sanitize_svg_string( string $dirty ): ?string {
        if ( ! class_exists( '\\enshrined\\svgSanitize\\Sanitizer' ) ) {
            // Autoloader should handle this, but guard against misconfiguration.
            $autoload = dirname( __DIR__ ) . '/vendor/autoload.php';
            if ( file_exists( $autoload ) ) {
                require_once $autoload;
            }
        }

        $sanitizer = new \enshrined\svgSanitize\Sanitizer();
        $sanitizer->removeRemoteReferences( true );
        $sanitizer->minify( true );

        $clean = $sanitizer->sanitize( $dirty );
        if ( $clean === false || $clean === null || trim( $clean ) === '' ) {
            return null;
        }

        // Second pass: custom CSS and URI validation within the sanitized output.
        $clean = self::sanitize_svg_css( $clean );
        $clean = self::sanitize_svg_uris( $clean );

        return $clean;
    }

    /**
     * Sanitize CSS within SVG <style> blocks.
     *
     * Strips dangerous patterns while preserving legitimate styling:
     * - Blocks: url() with external/data:text/data:image/svg+xml URIs,
     *   @import, expression(), -moz-binding, behavior:
     * - Allows: url(#internal), data:image/(png|jpeg|webp|gif), standard CSS
     *
     * @param  string $svg  Sanitized SVG markup.
     * @return string       SVG with CSS blocks cleaned.
     */
    public static function sanitize_svg_css( string $svg ): string {
        // Match <style> blocks and sanitize their contents.
        return preg_replace_callback(
            '/<style[^>]*>(.*?)<\/style>/si',
            function ( $matches ) {
                $css = $matches[1];

                // Block @import rules entirely.
                $css = preg_replace( '/@import\b[^;]*;?/i', '/* import rule removed */', $css );

                // Block expression(), -moz-binding, behavior:
                $css = preg_replace( '/expression\s*\(/i', '/* expression removed */(', $css );
                $css = preg_replace( '/-moz-binding\s*:/i', '/* -moz-binding removed */:', $css );
                $css = preg_replace( '/behavior\s*:/i', '/* behavior removed */:', $css );

                // Validate url() references: allow only internal refs and safe data URIs.
                $css = preg_replace_callback(
                    '/url\s*\(\s*([\'"]?)(.*?)\1\s*\)/i',
                    function ( $url_match ) {
                        $uri = trim( $url_match[2] );

                        // Allow internal SVG references: url(#gradientId)
                        if ( str_starts_with( $uri, '#' ) ) {
                            return $url_match[0];
                        }

                        // Allow safe embedded raster data URIs.
                        if ( preg_match( '/^data:image\/(png|jpeg|webp|gif);base64,/i', $uri ) ) {
                            return $url_match[0];
                        }

                        // Allow embedded font data URIs.
                        if ( preg_match( '/^data:font\/(woff2?|ttf|otf|collection);base64,/i', $uri )
                            || preg_match( '/^data:application\/(font-woff2?|x-font-ttf|x-font-otf);base64,/i', $uri ) ) {
                            return $url_match[0];
                        }

                        // Block everything else (external URLs, data:image/svg+xml,
                        // data:text/html, javascript:, blob:, etc.)
                        return '/* url removed */';
                    },
                    $css
                );

                return '<style>' . $css . '</style>';
            },
            $svg
        ) ?? $svg;
    }

    /**
     * Validate and strip dangerous URIs from SVG attributes.
     *
     * Scans all attribute values that look like URIs and blocks:
     * - javascript: scheme
     * - data:image/svg+xml (recursive SVG)
     * - data:text/html (HTML injection)
     * - blob: scheme
     * - External http(s): URLs (already handled by removeRemoteReferences,
     *   but double-check as defence-in-depth)
     *
     * Allows:
     * - Fragment references: #localId
     * - Safe data URIs: data:image/(png|jpeg|webp|gif), data:font/*
     *
     * @param  string $svg  SVG markup.
     * @return string       SVG with dangerous URIs neutralized.
     */
    public static function sanitize_svg_uris( string $svg ): string {
        // Match common URI-bearing attributes.
        $uri_attrs = 'href|xlink:href|src|data|action|formaction|poster';

        return preg_replace_callback(
            '/(\b(?:' . $uri_attrs . ')\s*=\s*)([\'"])(.*?)\2/i',
            function ( $matches ) {
                $prefix = $matches[1];
                $quote  = $matches[2];
                $uri    = trim( $matches[3] );

                // Allow empty or fragment-only references.
                if ( $uri === '' || str_starts_with( $uri, '#' ) ) {
                    return $matches[0];
                }

                // Allow safe data URIs (raster images and fonts).
                if ( preg_match( '/^data:image\/(png|jpeg|webp|gif);base64,/i', $uri ) ) {
                    return $matches[0];
                }
                if ( preg_match( '/^data:font\/(woff2?|ttf|otf|collection);base64,/i', $uri )
                    || preg_match( '/^data:application\/(font-woff2?|x-font-ttf|x-font-otf);base64,/i', $uri ) ) {
                    return $matches[0];
                }

                // Block dangerous schemes.
                $lower = strtolower( $uri );
                if ( str_starts_with( $lower, 'javascript:' )
                    || str_starts_with( $lower, 'data:image/svg+xml' )
                    || str_starts_with( $lower, 'data:text/html' )
                    || str_starts_with( $lower, 'data:text/xml' )
                    || str_starts_with( $lower, 'blob:' )
                    || str_starts_with( $lower, 'vbscript:' )
                    || str_starts_with( $lower, 'data:application/xhtml' ) ) {
                    return $prefix . $quote . $quote; // Empty attribute.
                }

                // Block any remaining external URLs (http/https/ftp/ftps).
                if ( preg_match( '/^(https?|ftps?):\/\//i', $uri ) ) {
                    return $prefix . $quote . $quote;
                }

                // Allow relative paths and anything else that survived the sanitizer.
                return $matches[0];
            },
            $svg
        ) ?? $svg;
    }
}
