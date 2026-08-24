<?php
/**
 * External Thumbnail Cache — P14-C / P49-F
 *
 * Downloads and caches external media thumbnails locally for reliability
 * and performance. Thumbnails are stored in wp-content/uploads/wpsg-thumbnails/.
 *
 * P49-F: Per-hash wp_options storage — each cached URL is a separate
 * `wpsg_thumb_<sha256>` option row with autoload='no'.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Thumbnail_Cache {
    const UPLOAD_DIR          = 'wpsg-thumbnails';
    const META_KEY            = '_wpsg_cached_thumbnail';
    const TTL_OPTION          = 'wpsg_thumbnail_cache_ttl';
    const DEFAULT_TTL         = 86400; // 24 hours
    const OPTION_PREFIX = 'wpsg_thumb_';

    /**
     * Register hooks.
     */
    public static function register() {
        add_action('wpsg_oembed_success', [self::class, 'cache_oembed_thumbnail'], 10, 2);
        add_action('wpsg_thumbnail_cache_cleanup', [self::class, 'cleanup_expired']);
        if (!wp_next_scheduled('wpsg_thumbnail_cache_cleanup')) {
            wp_schedule_event(time(), 'daily', 'wpsg_thumbnail_cache_cleanup');
        }
    }

    /**
     * Get the cache directory path, creating it if needed.
     *
     * @return string|false Absolute path to cache dir, or false on failure.
     */
    public static function get_cache_dir() {
        $upload_dir = wp_upload_dir();
        if (!empty($upload_dir['error'])) {
            return false;
        }

        $cache_dir = trailingslashit($upload_dir['basedir']) . self::UPLOAD_DIR;
        if (!file_exists($cache_dir)) {
            wp_mkdir_p($cache_dir);
            $index = $cache_dir . '/index.php';
            if (!file_exists($index)) {
                file_put_contents($index, '<?php // Silence is golden.');
            }
        }

        return $cache_dir;
    }

    /**
     * Get the public URL for the cache directory.
     *
     * @return string|false
     */
    public static function get_cache_url() {
        $upload_dir = wp_upload_dir();
        if (!empty($upload_dir['error'])) {
            return false;
        }

        return trailingslashit($upload_dir['baseurl']) . self::UPLOAD_DIR;
    }

    /**
     * Cache a thumbnail from an external URL.
     *
     * @param string $url        The external thumbnail URL.
     * @param string $source_url The original media URL (used as cache key).
     * @return array{cached: bool, local_url?: string, error?: string}
     */
    public static function cache_thumbnail($url, $source_url) {
        if (empty($url) || !filter_var($url, FILTER_VALIDATE_URL)) {
            return ['cached' => false, 'error' => 'Invalid thumbnail URL'];
        }

        $cache_dir = self::get_cache_dir();
        if (!$cache_dir) {
            return ['cached' => false, 'error' => 'Cannot create cache directory'];
        }

        $hash     = hash('sha256', $source_url);
        $ext      = self::get_extension_from_url($url);
        $filename = $hash . '.' . $ext;
        $filepath = trailingslashit($cache_dir) . $filename;

        $response = wp_safe_remote_get($url, [
            'timeout'   => 15,
            'sslverify' => true,
            'headers'   => ['Accept' => 'image/*'],
        ]);

        if (is_wp_error($response)) {
            return ['cached' => false, 'error' => $response->get_error_message()];
        }

        $status = wp_remote_retrieve_response_code($response);
        if ($status < 200 || $status >= 300) {
            return ['cached' => false, 'error' => 'HTTP ' . $status];
        }

        $body = wp_remote_retrieve_body($response);
        if (empty($body)) {
            return ['cached' => false, 'error' => 'Empty response body'];
        }

        $max_size = intval(apply_filters('wpsg_thumbnail_max_download_size', 5 * 1024 * 1024));
        if (strlen($body) > $max_size) {
            return ['cached' => false, 'error' => 'Thumbnail exceeds maximum size of ' . size_format($max_size)];
        }

        $content_type = wp_remote_retrieve_header($response, 'content-type');
        if ($content_type && strpos($content_type, 'image/') !== 0) {
            return ['cached' => false, 'error' => 'Content is not an image'];
        }

        $written = file_put_contents($filepath, $body);
        if ($written === false) {
            return ['cached' => false, 'error' => 'Failed to write cache file'];
        }

        $cache_url = self::get_cache_url();
        $local_url = trailingslashit($cache_url) . $filename;

        $meta = [
            'source_url'    => $source_url,
            'thumbnail_url' => $url,
            'local_url'     => $local_url,
            'local_path'    => $filepath,
            'cached_at'     => time(),
            'file_size'     => $written,
        ];

        // P49-F: write a dedicated option row per hash (autoload=no).
        update_option(self::option_key($hash), $meta, false);

        return ['cached' => true, 'local_url' => $local_url];
    }

    /**
     * Get cached thumbnail URL for a source URL.
     *
     * @param string $source_url The original media URL.
     * @return string|null Local URL if cached and not expired, null otherwise.
     */
    public static function get_cached_url($source_url) {
        $hash  = hash('sha256', $source_url);
        $entry = get_option(self::option_key($hash), false);

        if ($entry === false) {
            return null;
        }

        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [];
        $ttl      = intval($settings['thumbnail_cache_ttl'] ?? self::DEFAULT_TTL);
        $age      = time() - intval($entry['cached_at']);

        if ($age > $ttl) {
            return null;
        }

        if (!empty($entry['local_path']) && !file_exists($entry['local_path'])) {
            return null;
        }

        return $entry['local_url'] ?? null;
    }

    /**
     * Cache thumbnail from oEmbed result.
     * Fired on wpsg_oembed_success action.
     *
     * @param string $url    The original media URL.
     * @param array  $result The oEmbed result data.
     */
    public static function cache_oembed_thumbnail($url, $result) {
        $thumbnail = $result['thumbnail_url'] ?? $result['thumbnailUrl'] ?? '';
        if (empty($thumbnail)) {
            return;
        }
        self::cache_thumbnail($thumbnail, $url);
    }

    /**
     * Cache all external thumbnails for a campaign's media items.
     *
     * @param int $campaign_id The campaign post ID.
     * @return array{cached: int, skipped: int, failed: int}
     */
    public static function cache_campaign_thumbnails($campaign_id) {
        $media_items = get_post_meta($campaign_id, 'media_items', true);
        if (!is_array($media_items)) {
            return ['cached' => 0, 'skipped' => 0, 'failed' => 0];
        }

        $result = ['cached' => 0, 'skipped' => 0, 'failed' => 0];

        foreach ($media_items as $item) {
            $thumbnail = $item['thumbnail'] ?? '';
            $source    = $item['url'] ?? $item['embedUrl'] ?? '';

            if (empty($thumbnail) || empty($source)) {
                $result['skipped']++;
                continue;
            }

            if (!empty($item['attachmentId'])) {
                $result['skipped']++;
                continue;
            }

            $existing = self::get_cached_url($source);
            if ($existing) {
                $result['skipped']++;
                continue;
            }

            $cache_result = self::cache_thumbnail($thumbnail, $source);
            if ($cache_result['cached']) {
                $result['cached']++;
            } else {
                $result['failed']++;
            }
        }

        return $result;
    }

    /**
     * Get overall cache statistics.
     *
     * @return array{totalFiles: int, totalSize: int, oldest: int|null, newest: int|null, ttl: int}
     */
    public static function get_stats() {
        $entries    = self::get_all_entries();
        $total_size = 0;
        $oldest     = null;
        $newest     = null;
        $valid_count = 0;

        foreach ($entries as $entry) {
            if (!empty($entry['local_path']) && file_exists($entry['local_path'])) {
                $valid_count++;
                $total_size += intval($entry['file_size'] ?? 0);
                $cached_at = intval($entry['cached_at'] ?? 0);
                if ($oldest === null || $cached_at < $oldest) {
                    $oldest = $cached_at;
                }
                if ($newest === null || $cached_at > $newest) {
                    $newest = $cached_at;
                }
            }
        }

        return [
            'totalFiles' => $valid_count,
            'totalSize'  => $total_size,
            'oldest'     => $oldest,
            'newest'     => $newest,
            'ttl'        => intval(
                (class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [])['thumbnail_cache_ttl']
                ?? self::DEFAULT_TTL
            ),
        ];
    }

    /**
     * Refresh (re-download) all cached thumbnails.
     *
     * @return array{refreshed: int, failed: int}
     */
    public static function refresh_all() {
        $entries = self::get_all_entries();
        $result  = ['refreshed' => 0, 'failed' => 0];

        foreach ($entries as $entry) {
            $thumb_url  = $entry['thumbnail_url'] ?? '';
            $source_url = $entry['source_url'] ?? '';
            if (empty($thumb_url) || empty($source_url)) {
                $result['failed']++;
                continue;
            }

            $cache_result = self::cache_thumbnail($thumb_url, $source_url);
            if ($cache_result['cached']) {
                $result['refreshed']++;
            } else {
                $result['failed']++;
            }
        }

        return $result;
    }

    /**
     * Remove expired cache entries and their files.
     */
    public static function cleanup_expired() {
        $entries  = self::get_all_entries();
        $settings = class_exists('WPSG_Settings') ? WPSG_Settings::get_settings() : [];
        $ttl      = intval($settings['thumbnail_cache_ttl'] ?? self::DEFAULT_TTL);
        $now      = time();

        foreach ($entries as $hash => $entry) {
            $age = $now - intval($entry['cached_at'] ?? 0);
            if ($age > $ttl * 2) {
                if (!empty($entry['local_path']) && file_exists($entry['local_path'])) {
                    wp_delete_file($entry['local_path']);
                }
                delete_option(self::option_key($hash));
            }
        }
    }

    /**
     * Clear all cached thumbnails.
     *
     * @return int Number of files removed.
     */
    public static function clear_all() {
        $entries = self::get_all_entries();
        $removed = 0;

        foreach ($entries as $hash => $entry) {
            if (!empty($entry['local_path']) && file_exists($entry['local_path'])) {
                wp_delete_file($entry['local_path']);
                $removed++;
            }
            delete_option(self::option_key($hash));
        }

        return $removed;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /**
     * Build the wp_options key for a given sha256 hash.
     */
    private static function option_key($hash) {
        return self::OPTION_PREFIX . $hash;
    }

    /**
     * Return all cached entries as hash => meta array, sourced from
     * per-hash option rows.
     *
     * @return array<string, array>
     */
    private static function get_all_entries() {
        global $wpdb;
        $like = $wpdb->esc_like(self::OPTION_PREFIX) . '%';
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE %s",
                $like
            )
        );

        $entries = [];
        $prefix_len = strlen(self::OPTION_PREFIX);
        foreach ($rows ?? [] as $row) {
            $hash  = substr($row->option_name, $prefix_len);
            $value = maybe_unserialize($row->option_value);
            if (is_array($value)) {
                $entries[$hash] = $value;
            }
        }
        return $entries;
    }

    /**
     * Extract file extension from a URL.
     *
     * @param string $url
     * @return string Extension (default: 'jpg').
     */
    private static function get_extension_from_url($url) {
        $path = wp_parse_url($url, PHP_URL_PATH);
        if (empty($path)) {
            return 'jpg';
        }

        $ext     = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        return in_array($ext, $allowed, true) ? $ext : 'jpg';
    }
}
