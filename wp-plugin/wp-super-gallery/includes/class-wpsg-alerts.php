<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Alerts {
    const REST_ERROR_BUCKET = 'wpsg_rest_error_bucket';
    const ALERT_THROTTLE_FATAL = 'wpsg_alert_throttle_fatal';
    const ALERT_THROTTLE_REST = 'wpsg_alert_throttle_rest';

    public static function register() {
        add_action('wpsg_php_error', [self::class, 'notify_fatal_error']);
        add_action('wpsg_rest_metrics', [self::class, 'track_rest_metrics']);
    }

    public static function notify_fatal_error($payload) {
        if (!self::email_enabled()) {
            return;
        }

        if (self::is_throttled(self::ALERT_THROTTLE_FATAL)) {
            return;
        }

        $subject = '[WPSG] Fatal error detected';
        $message = "A fatal error occurred in WP Super Gallery.\n\n" . wp_json_encode($payload, JSON_PRETTY_PRINT);
        wp_mail(self::get_recipient(), $subject, $message);
        if (class_exists('WPSG_Sentry')) {
            WPSG_Sentry::capture_message('WPSG fatal error', $payload);
        }
        self::throttle(self::ALERT_THROTTLE_FATAL);
    }

    public static function track_rest_metrics($payload) {
        if (!self::email_enabled()) {
            return;
        }

        $status = intval($payload['status'] ?? 0);
        if ($status < 500) {
            return;
        }

        $window_minutes = intval(apply_filters('wpsg_alert_rate_window_minutes', 10));
        $threshold = intval(apply_filters('wpsg_alert_error_threshold', 5));
        $now = time();
        $window_start = $now - ($window_minutes * 60);

        $bucket = get_transient(self::REST_ERROR_BUCKET);
        $bucket = is_array($bucket) ? $bucket : [];
        $bucket[] = $now;
        $bucket = array_values(array_filter($bucket, function ($ts) use ($window_start) {
            return $ts >= $window_start;
        }));

        set_transient(self::REST_ERROR_BUCKET, $bucket, $window_minutes * 60);

        if (count($bucket) < $threshold) {
            return;
        }

        if (self::is_throttled(self::ALERT_THROTTLE_REST)) {
            return;
        }

        $subject = '[WPSG] REST error spike detected';
        $message = sprintf(
            "Detected %d REST errors (>=500) in the last %d minutes.\n\nLast payload:\n%s",
            count($bucket),
            $window_minutes,
            wp_json_encode($payload, JSON_PRETTY_PRINT)
        );

        wp_mail(self::get_recipient(), $subject, $message);
        if (class_exists('WPSG_Sentry')) {
            WPSG_Sentry::capture_message('WPSG REST error spike', $payload);
        }
        self::throttle(self::ALERT_THROTTLE_REST);
    }

    private static function email_enabled() {
        return apply_filters('wpsg_alert_email_enabled', true) !== false;
    }

    private static function get_recipient() {
        $recipient = apply_filters('wpsg_alert_email_recipient', get_option('admin_email'));
        return is_string($recipient) && $recipient ? $recipient : get_option('admin_email');
    }

    private static function is_throttled($key) {
        return get_transient($key) === '1';
    }

    private static function throttle($key) {
        $minutes = intval(apply_filters('wpsg_alert_throttle_minutes', 10));
        set_transient($key, '1', $minutes * 60);
    }
}