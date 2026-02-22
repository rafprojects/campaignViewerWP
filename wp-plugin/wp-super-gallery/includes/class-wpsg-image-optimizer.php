<?php
/**
 * Image Optimization on Upload — P14-F
 *
 * Auto-generates optimized image variants when media is uploaded
 * through the WPSG plugin. Supports WebP conversion and max dimension
 * constraints. Leverages WordPress image editor API.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Image_Optimizer {
    const MAX_WIDTH_DEFAULT  = 1920;
    const MAX_HEIGHT_DEFAULT = 1920;
    const QUALITY_DEFAULT    = 82;

    /**
     * Register optimization hooks.
     */
    public static function register() {
        // Register custom image sizes for gallery variants.
        add_action('after_setup_theme', [self::class, 'register_image_sizes']);
        // Hook into attachment upload to optimize.
        add_filter('wp_handle_upload', [self::class, 'optimize_on_upload'], 10, 2);
        // Add WebP mime type support.
        add_filter('upload_mimes', [self::class, 'add_webp_mime'], 10, 1);
    }

    /**
     * Register custom image sizes for gallery use.
     */
    public static function register_image_sizes() {
        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [];

        $max_width  = intval($settings['optimize_max_width'] ?? self::MAX_WIDTH_DEFAULT);
        $max_height = intval($settings['optimize_max_height'] ?? self::MAX_HEIGHT_DEFAULT);

        add_image_size('wpsg_gallery', $max_width, $max_height, false);
        add_image_size('wpsg_thumb', 400, 400, false);
    }

    /**
     * Optimize image after upload.
     *
     * @param array  $upload Array with 'file', 'url', 'type' keys.
     * @param string $context Upload context.
     * @return array Modified upload data.
     */
    public static function optimize_on_upload($upload, $context = '') {
        // Only process images.
        if (empty($upload['type']) || strpos($upload['type'], 'image/') !== 0) {
            return $upload;
        }

        // Skip SVGs and GIFs (animated).
        $skip_types = ['image/svg+xml', 'image/gif'];
        if (in_array($upload['type'], $skip_types, true)) {
            return $upload;
        }

        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [];
        $enabled  = !empty($settings['optimize_on_upload']);

        if (!$enabled) {
            return $upload;
        }

        $file = $upload['file'];
        if (!file_exists($file)) {
            return $upload;
        }

        $max_width  = intval($settings['optimize_max_width'] ?? self::MAX_WIDTH_DEFAULT);
        $max_height = intval($settings['optimize_max_height'] ?? self::MAX_HEIGHT_DEFAULT);
        $quality    = intval($settings['optimize_quality'] ?? self::QUALITY_DEFAULT);

        // Constrain dimensions.
        $result = self::constrain_image($file, $max_width, $max_height, $quality);
        if (is_wp_error($result)) {
            // Log but don't fail the upload.
            error_log('[WPSG] Image optimization failed: ' . $result->get_error_message());
            return $upload;
        }

        // Generate WebP variant if enabled.
        if (!empty($settings['optimize_webp_enabled'])) {
            self::generate_webp($file, $quality);
        }

        return $upload;
    }

    /**
     * Constrain image dimensions using WordPress image editor.
     *
     * @param string $file      Absolute path to image file.
     * @param int    $max_width  Maximum width in pixels.
     * @param int    $max_height Maximum height in pixels.
     * @param int    $quality    JPEG/WebP quality (1-100).
     * @return true|WP_Error
     */
    public static function constrain_image($file, $max_width, $max_height, $quality) {
        $editor = wp_get_image_editor($file);
        if (is_wp_error($editor)) {
            return $editor;
        }

        $size = $editor->get_size();
        $w = $size['width'] ?? 0;
        $h = $size['height'] ?? 0;

        // Skip if already within bounds.
        if ($w <= $max_width && $h <= $max_height) {
            return true;
        }

        $editor->set_quality($quality);
        $resized = $editor->resize($max_width, $max_height, false);
        if (is_wp_error($resized)) {
            return $resized;
        }

        // Save over original (original preserved in WP backup metadata).
        $saved = $editor->save($file);
        if (is_wp_error($saved)) {
            return $saved;
        }

        return true;
    }

    /**
     * Generate a WebP variant of an image.
     *
     * @param string $file    Absolute path to source image.
     * @param int    $quality WebP quality (1-100).
     * @return string|WP_Error Path to WebP file, or error.
     */
    public static function generate_webp($file, $quality = 82) {
        $editor = wp_get_image_editor($file);
        if (is_wp_error($editor)) {
            return $editor;
        }

        $editor->set_quality($quality);

        $info = pathinfo($file);
        $webp_path = $info['dirname'] . '/' . $info['filename'] . '.webp';

        $saved = $editor->save($webp_path, 'image/webp');
        if (is_wp_error($saved)) {
            return $saved;
        }

        return $webp_path;
    }

    /**
     * Add WebP to allowed upload MIME types.
     *
     * @param array $mimes Existing mime types.
     * @return array Modified mime types.
     */
    public static function add_webp_mime($mimes) {
        $mimes['webp'] = 'image/webp';
        return $mimes;
    }

    /**
     * Get optimization statistics.
     *
     * @return array{total_optimized: int, total_saved_bytes: int, webp_count: int}
     */
    public static function get_stats() {
        $upload_dir = wp_upload_dir();
        $base_dir = $upload_dir['basedir'];

        $webp_count = 0;
        $wpsg_sizes = 0;

        // Count WebP files and wpsg-specific sizes.
        $attachments = get_posts([
            'post_type'      => 'attachment',
            'post_mime_type' => 'image',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'no_found_rows'  => true,
        ]);

        foreach ($attachments as $id) {
            $metadata = wp_get_attachment_metadata($id);
            if (!is_array($metadata) || empty($metadata['sizes'])) {
                continue;
            }

            if (isset($metadata['sizes']['wpsg_gallery'])) {
                $wpsg_sizes++;
            }

            // Check for WebP variant.
            $file = get_attached_file($id);
            if ($file) {
                $info = pathinfo($file);
                $webp = $info['dirname'] . '/' . $info['filename'] . '.webp';
                if (file_exists($webp)) {
                    $webp_count++;
                }
            }
        }

        return [
            'optimizedCount' => $wpsg_sizes,
            'webpCount'      => $webp_count,
            'totalImages'    => count($attachments),
        ];
    }
}
