<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Monitoring {
    private static $rest_start = null;

    public static function register() {
        add_filter('rest_pre_dispatch', [self::class, 'start_timer'], 1, 3);
        add_filter('rest_post_dispatch', [self::class, 'attach_metrics'], 10, 3);
        add_action('shutdown', [self::class, 'log_fatal_error']);
        add_action('wpsg_oembed_failure', [self::class, 'track_oembed_failure'], 10, 2);
    }

    public static function start_timer($result, $server, $request) {
        $route = $request->get_route();
        if (strpos($route, '/wp-super-gallery/v1/') !== 0) {
            return $result;
        }

        self::$rest_start = microtime(true);
        return $result;
    }

    public static function attach_metrics($response, $server, $request) {
        $route = $request->get_route();
        if (strpos($route, '/wp-super-gallery/v1/') !== 0) {
            return $response;
        }

        $elapsed_ms = null;
        if (self::$rest_start) {
            $elapsed_ms = round((microtime(true) - self::$rest_start) * 1000, 2);
            $response->header('X-WPSG-Response-Time', (string) $elapsed_ms);
        }

        $status = is_wp_error($response) ? 500 : (method_exists($response, 'get_status') ? $response->get_status() : 200);

        self::buffer_metric('wpsg_rest_request_count', 1);
        if ($status >= 400) {
            self::buffer_metric('wpsg_rest_error_count', 1);
        }

        do_action('wpsg_rest_metrics', [
            'route' => $route,
            'status' => $status,
            'elapsedMs' => $elapsed_ms,
        ]);

        return $response;
    }

    public static function log_fatal_error() {
        if (!self::is_wpsg_request()) {
            return;
        }

        $error = error_get_last();
        if (!$error || !isset($error['type'])) {
            return;
        }

        $fatal_types = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
        if (!in_array($error['type'], $fatal_types, true)) {
            return;
        }

        $payload = [
            'type' => $error['type'],
            'message' => $error['message'] ?? '',
            'file' => $error['file'] ?? '',
            'line' => $error['line'] ?? 0,
        ];

        error_log('[WPSG] Fatal error: ' . wp_json_encode($payload));
        do_action('wpsg_php_error', $payload);
    }

    private static function buffer_metric($key, $increment) {
        $buffer_key = $key . '_buffer';
        $buffer = get_transient($buffer_key);
        $buffer = is_array($buffer) ? $buffer : ['count' => 0, 'last_flush' => time()];

        $buffer['count'] += $increment;

        $flush_every = intval(apply_filters('wpsg_metrics_flush_every', 10));
        $flush_seconds = intval(apply_filters('wpsg_metrics_flush_seconds', 60));

        $should_flush = $buffer['count'] >= $flush_every || (time() - intval($buffer['last_flush'])) >= $flush_seconds;

        if ($should_flush) {
            $total = intval(get_option($key, 0));
            update_option($key, $total + $buffer['count'], false);
            $buffer = ['count' => 0, 'last_flush' => time()];
        }

        set_transient($buffer_key, $buffer, $flush_seconds);
    }

    private static function is_wpsg_request() {
        $route = isset($_GET['rest_route']) ? sanitize_text_field(wp_unslash($_GET['rest_route'])) : '';
        if (strpos($route, '/wp-super-gallery/v1/') === 0) {
            return true;
        }

        $uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
        return strpos($uri, '/wp-json/wp-super-gallery/v1/') !== false;
    }

    // --- P14-D: Per-provider oEmbed failure tracking ---

    /**
     * Track an oEmbed failure keyed by provider.
     *
     * @param string $url      The media URL that failed.
     * @param array  $attempts Array of attempted provider endpoints.
     */
    public static function track_oembed_failure($url, $attempts) {
        $provider = self::detect_provider($url);
        $failures = get_option('wpsg_oembed_provider_failures', []);

        if (!isset($failures[$provider])) {
            $failures[$provider] = [
                'count'       => 0,
                'first_at'    => time(),
                'last_at'     => 0,
                'last_error'  => '',
                'recent'      => [],
            ];
        }

        $failures[$provider]['count']++;
        $failures[$provider]['last_at'] = time();
        $failures[$provider]['last_error'] = is_array($attempts) ? wp_json_encode(array_slice($attempts, -1)) : '';

        // Keep last 10 failure timestamps for trend analysis.
        $failures[$provider]['recent'][] = time();
        $failures[$provider]['recent'] = array_slice($failures[$provider]['recent'], -10);

        update_option('wpsg_oembed_provider_failures', $failures, false);
    }

    /**
     * Get per-provider oEmbed failure data.
     *
     * @return array Provider failure stats.
     */
    public static function get_oembed_failures() {
        return get_option('wpsg_oembed_provider_failures', []);
    }

    /**
     * Reset oEmbed failure counters for a provider or all.
     *
     * @param string|null $provider Provider name, or null for all.
     */
    public static function reset_oembed_failures($provider = null) {
        if ($provider === null) {
            update_option('wpsg_oembed_provider_failures', [], false);
        } else {
            $failures = get_option('wpsg_oembed_provider_failures', []);
            unset($failures[$provider]);
            update_option('wpsg_oembed_provider_failures', $failures, false);
        }
    }

    /**
     * Get aggregated health data for the admin dashboard.
     *
     * @return array Health metrics.
     */
    public static function get_health_data() {
        $request_count = intval(get_option('wpsg_rest_request_count', 0));
        $error_count   = intval(get_option('wpsg_rest_error_count', 0));
        $oembed_failures = intval(get_option('wpsg_oembed_failure_count', 0));

        // Campaign stats.
        $active_campaigns   = self::count_campaigns_by_status('active');
        $archived_campaigns = self::count_campaigns_by_status('archived');
        $draft_campaigns    = self::count_campaigns_by_status('draft');

        // Storage stats.
        $upload_dir   = wp_upload_dir();
        $wpsg_storage = self::get_directory_size(trailingslashit($upload_dir['basedir']) . 'wpsg-thumbnails');

        // Thumbnail cache stats.
        $cache_stats = [];
        if (class_exists('WPSG_Thumbnail_Cache')) {
            $cache_stats = WPSG_Thumbnail_Cache::get_stats();
        }

        return [
            'restRequestCount'   => $request_count,
            'restErrorCount'     => $error_count,
            'restErrorRate'      => $request_count > 0 ? round($error_count / $request_count * 100, 2) : 0,
            'oembedFailureCount' => $oembed_failures,
            'oembedProviders'    => self::get_oembed_failures(),
            'campaigns'          => [
                'active'   => $active_campaigns,
                'archived' => $archived_campaigns,
                'draft'    => $draft_campaigns,
            ],
            'storage'            => [
                'thumbnailCache' => $wpsg_storage,
            ],
            'thumbnailCache'     => $cache_stats,
            'phpVersion'         => PHP_VERSION,
            'wpVersion'          => get_bloginfo('version'),
            'pluginVersion'      => defined('WPSG_VERSION') ? WPSG_VERSION : 'unknown',
            'timestamp'          => time(),
        ];
    }

    /**
     * Detect provider name from a media URL.
     *
     * @param string $url
     * @return string Provider name.
     */
    private static function detect_provider($url) {
        $host = wp_parse_url($url, PHP_URL_HOST);
        if (empty($host)) {
            return 'unknown';
        }

        $host = strtolower($host);
        $map = [
            'youtube.com'   => 'youtube',
            'youtu.be'      => 'youtube',
            'vimeo.com'     => 'vimeo',
            'rumble.com'    => 'rumble',
            'odysee.com'    => 'odysee',
            'dailymotion'   => 'dailymotion',
            'soundcloud'    => 'soundcloud',
            'spotify.com'   => 'spotify',
            'twitter.com'   => 'twitter',
            'x.com'         => 'twitter',
        ];

        foreach ($map as $pattern => $name) {
            if (strpos($host, $pattern) !== false) {
                return $name;
            }
        }

        return $host;
    }

    /**
     * Count campaigns by status meta.
     *
     * @param string $status
     * @return int
     */
    private static function count_campaigns_by_status($status) {
        $query = new WP_Query([
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'any',
            'meta_key'       => 'status',
            'meta_value'     => $status,
            'posts_per_page' => 1,
            'fields'         => 'ids',
            'no_found_rows'  => false,
        ]);
        return intval($query->found_posts);
    }

    /**
     * Calculate directory size in bytes.
     *
     * @param string $dir
     * @return int Size in bytes.
     */
    private static function get_directory_size($dir) {
        if (!is_dir($dir)) {
            return 0;
        }

        $size = 0;
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS)
        );

        foreach ($files as $file) {
            if ($file->isFile()) {
                $size += $file->getSize();
            }
        }

        return $size;
    }
}