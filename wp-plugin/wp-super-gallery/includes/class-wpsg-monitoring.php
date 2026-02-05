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
}