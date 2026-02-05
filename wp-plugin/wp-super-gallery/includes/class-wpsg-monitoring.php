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

        $total = intval(get_option('wpsg_rest_request_count', 0));
        update_option('wpsg_rest_request_count', $total + 1, false);

        if ($status >= 400) {
            $errors = intval(get_option('wpsg_rest_error_count', 0));
            update_option('wpsg_rest_error_count', $errors + 1, false);
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

    private static function is_wpsg_request() {
        $route = isset($_GET['rest_route']) ? sanitize_text_field(wp_unslash($_GET['rest_route'])) : '';
        if (strpos($route, '/wp-super-gallery/v1/') === 0) {
            return true;
        }

        $uri = isset($_SERVER['REQUEST_URI']) ? sanitize_text_field(wp_unslash($_SERVER['REQUEST_URI'])) : '';
        return strpos($uri, '/wp-json/wp-super-gallery/v1/') !== false;
    }
}