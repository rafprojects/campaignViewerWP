<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Alerts {
    const REST_ERROR_BUCKET = 'wpsg_rest_error_bucket';
    const ALERT_THROTTLE_FATAL = 'wpsg_alert_throttle_fatal';
    const ALERT_THROTTLE_REST = 'wpsg_alert_throttle_rest';
    const EMAIL_QUEUE = 'wpsg_alert_email_queue';
    const CRON_HOOK = 'wpsg_process_alert_emails';

    public static function register() {
        add_action('wpsg_php_error', [self::class, 'notify_fatal_error']);
        add_action('wpsg_rest_metrics', [self::class, 'track_rest_metrics']);
        add_action(self::CRON_HOOK, [self::class, 'process_email_queue']);

        // Register the custom 1-minute interval before scheduling.
        add_filter('cron_schedules', [self::class, 'add_cron_interval']);

        // Schedule 1-minute cron if not already scheduled.
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time(), 'wpsg_every_minute', self::CRON_HOOK);
        }
    }

    /**
     * Register a 1-minute cron interval for alert email processing.
     *
     * @since 0.18.0 P20-I-5
     */
    public static function add_cron_interval(array $schedules): array {
        if (!isset($schedules['wpsg_every_minute'])) {
            $schedules['wpsg_every_minute'] = [
                'interval' => 60,
                'display'  => 'Every minute (WPSG alerts)',
            ];
        }
        return $schedules;
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
        self::queue_email($subject, $message);
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

        self::queue_email($subject, $message);
        if (class_exists('WPSG_Sentry')) {
            WPSG_Sentry::capture_message('WPSG REST error spike', $payload);
        }
        self::throttle(self::ALERT_THROTTLE_REST);
    }

    /**
     * Queue an alert email for async dispatch via cron.
     *
     * Falls back to synchronous wp_mail() when WP-Cron is disabled.
     *
     * @since 0.18.0 P20-I-5
     */
    private static function queue_email(string $subject, string $message): void {
        // If WP-Cron is disabled, send synchronously as fallback.
        if (defined('DISABLE_WP_CRON') && DISABLE_WP_CRON) {
            wp_mail(self::get_recipient(), $subject, $message);
            return;
        }

        // Acquire a short lock to prevent concurrent read-modify-write races.
        $lock_key = 'wpsg_email_queue_lock';
        if (get_transient($lock_key)) {
            // Lock held — fall back to synchronous send so the alert is not lost.
            wp_mail(self::get_recipient(), $subject, $message);
            return;
        }
        set_transient($lock_key, 1, 5);

        $queue = get_option(self::EMAIL_QUEUE, []);
        if (!is_array($queue)) {
            $queue = [];
        }

        // Cap queue at 50 items to prevent unbounded growth.
        if (count($queue) >= 50) {
            delete_transient($lock_key);
            return;
        }

        $queue[] = [
            'to'      => self::get_recipient(),
            'subject' => $subject,
            'message' => $message,
            'queued'  => time(),
        ];

        update_option(self::EMAIL_QUEUE, $queue, false);
        delete_transient($lock_key);
    }

    /**
     * Process queued alert emails (called by cron).
     *
     * @since 0.18.0 P20-I-5
     */
    public static function process_email_queue(): void {
        $queue = get_option(self::EMAIL_QUEUE, []);
        if (!is_array($queue) || empty($queue)) {
            return;
        }

        // Atomic swap: replace the queue with an empty array first, then
        // process the snapshot. If another request calls queue_email()
        // between here and the foreach, the new item lands in the fresh
        // empty array and will be picked up on the next cron tick.
        update_option(self::EMAIL_QUEUE, []);

        $failed = [];
        foreach ($queue as $item) {
            if (!is_array($item) || empty($item['to']) || empty($item['subject'])) {
                continue;
            }
            $sent = wp_mail(
                sanitize_email($item['to']),
                sanitize_text_field($item['subject']),
                $item['message'] ?? ''
            );
            if (!$sent) {
                $failed[] = $item;
            }
        }

        // Re-queue any items that failed to send.
        if (!empty($failed)) {
            $current = get_option(self::EMAIL_QUEUE, []);
            if (!is_array($current)) {
                $current = [];
            }
            update_option(self::EMAIL_QUEUE, array_merge($current, $failed), false);
        }
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