<?php

class WPSG_Alerts_Test extends WP_UnitTestCase {

    /** @var array Captured wp_mail calls */
    private $sent_mails = [];

    public function setUp(): void {
        parent::setUp();
        delete_option(WPSG_Alerts::EMAIL_QUEUE);
        delete_transient(WPSG_Alerts::REST_ERROR_BUCKET);
        delete_transient(WPSG_Alerts::ALERT_THROTTLE_FATAL);
        delete_transient(WPSG_Alerts::ALERT_THROTTLE_REST);
        // Enable alert emails via filter.
        add_filter('wpsg_alert_email_enabled', '__return_true');
        // Capture mail sends (DISABLE_WP_CRON is true in test env, so emails send synchronously).
        $this->sent_mails = [];
        add_filter('pre_wp_mail', function ($null, $atts) {
            $this->sent_mails[] = $atts;
            return true; // Prevent actual sending.
        }, 10, 2);
    }

    public function tearDown(): void {
        delete_option(WPSG_Alerts::EMAIL_QUEUE);
        delete_transient(WPSG_Alerts::REST_ERROR_BUCKET);
        delete_transient(WPSG_Alerts::ALERT_THROTTLE_FATAL);
        delete_transient(WPSG_Alerts::ALERT_THROTTLE_REST);
        remove_all_filters('wpsg_alert_email_enabled');
        remove_all_filters('wpsg_alert_rate_window_minutes');
        remove_all_filters('wpsg_alert_error_threshold');
        remove_all_filters('wpsg_alert_email_recipient');
        remove_all_filters('wpsg_alert_throttle_minutes');
        remove_all_filters('pre_wp_mail');
        parent::tearDown();
    }

    // ── add_cron_interval ──────────────────────────────────────────────────

    public function test_add_cron_interval_adds_every_minute_schedule() {
        $schedules = WPSG_Alerts::add_cron_interval([]);
        $this->assertArrayHasKey('wpsg_every_minute', $schedules);
        $this->assertEquals(60, $schedules['wpsg_every_minute']['interval']);
    }

    public function test_add_cron_interval_does_not_overwrite_existing() {
        $existing = [
            'wpsg_every_minute' => [
                'interval' => 999,
                'display'  => 'Custom',
            ],
        ];
        $result = WPSG_Alerts::add_cron_interval($existing);
        $this->assertEquals(999, $result['wpsg_every_minute']['interval']);
    }

    // ── notify_fatal_error ─────────────────────────────────────────────────

    public function test_notify_fatal_error_queues_email() {
        $payload = [
            'type'    => E_ERROR,
            'message' => 'Class not found',
            'file'    => '/var/www/plugin.php',
            'line'    => 42,
        ];

        WPSG_Alerts::notify_fatal_error($payload);

        // In test env DISABLE_WP_CRON=true, so emails are sent synchronously.
        $this->assertCount(1, $this->sent_mails);
        $this->assertStringContainsString('[WPSG] Fatal error', $this->sent_mails[0]['subject']);
        $this->assertStringContainsString('Class not found', $this->sent_mails[0]['message']);
    }

    public function test_notify_fatal_error_is_throttled() {
        $payload = ['type' => E_ERROR, 'message' => 'err', 'file' => 'x', 'line' => 1];

        WPSG_Alerts::notify_fatal_error($payload);
        WPSG_Alerts::notify_fatal_error($payload);

        // Only first one should have been sent.
        $this->assertCount(1, $this->sent_mails);
    }

    public function test_notify_fatal_error_skipped_when_disabled() {
        remove_all_filters('pre_wp_mail');
        add_filter('wpsg_alert_email_enabled', '__return_false');

        WPSG_Alerts::notify_fatal_error(['type' => E_ERROR, 'message' => 'err', 'file' => 'x', 'line' => 1]);

        $this->assertEmpty($this->sent_mails);
    }

    // ── track_rest_metrics ─────────────────────────────────────────────────

    public function test_track_rest_metrics_ignores_non_500_errors() {
        WPSG_Alerts::track_rest_metrics(['status' => 404, 'route' => '/test']);

        $bucket = get_transient(WPSG_Alerts::REST_ERROR_BUCKET);
        $this->assertEmpty($bucket);
    }

    public function test_track_rest_metrics_accumulates_500_errors() {
        add_filter('wpsg_alert_error_threshold', function () { return 100; });

        for ($i = 0; $i < 3; $i++) {
            WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);
        }

        $bucket = get_transient(WPSG_Alerts::REST_ERROR_BUCKET);
        $this->assertCount(3, $bucket);
    }

    public function test_track_rest_metrics_triggers_alert_at_threshold() {
        add_filter('wpsg_alert_error_threshold', function () { return 3; });

        for ($i = 0; $i < 3; $i++) {
            WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);
        }

        $this->assertCount(1, $this->sent_mails);
        $this->assertStringContainsString('REST error spike', $this->sent_mails[0]['subject']);
    }

    public function test_track_rest_metrics_alert_throttled_after_first() {
        add_filter('wpsg_alert_error_threshold', function () { return 2; });

        // First spike.
        WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);
        WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);

        // Second spike (same window, should be throttled).
        delete_transient(WPSG_Alerts::REST_ERROR_BUCKET);
        WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);
        WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);

        $this->assertCount(1, $this->sent_mails);
    }

    public function test_track_rest_metrics_skipped_when_disabled() {
        add_filter('wpsg_alert_email_enabled', '__return_false');

        for ($i = 0; $i < 10; $i++) {
            WPSG_Alerts::track_rest_metrics(['status' => 500, 'route' => '/test']);
        }

        $this->assertEmpty($this->sent_mails);
    }

    // ── process_email_queue ────────────────────────────────────────────────

    public function test_process_email_queue_sends_and_clears() {
        $sent = [];
        // Override wp_mail to capture calls.
        add_filter('pre_wp_mail', function ($null, $atts) use (&$sent) {
            $sent[] = $atts;
            return true; // Prevent actual sending.
        }, 10, 2);

        update_option(WPSG_Alerts::EMAIL_QUEUE, [
            [
                'to'      => 'admin@example.com',
                'subject' => 'Test Subject',
                'message' => 'Test body',
                'queued'  => time(),
            ],
        ]);

        WPSG_Alerts::process_email_queue();

        $this->assertNotEmpty($sent);
        $this->assertStringContainsString('Test Subject', $sent[0]['subject'] ?? '');

        // Queue should be cleared (atomic swap sets empty array).
        $remaining = get_option(WPSG_Alerts::EMAIL_QUEUE, 'deleted');
        $this->assertIsArray($remaining);
        $this->assertEmpty($remaining);
    }

    public function test_process_email_queue_noop_when_empty() {
        delete_option(WPSG_Alerts::EMAIL_QUEUE);

        // Should not throw.
        WPSG_Alerts::process_email_queue();
        $this->assertTrue(true);
    }

    public function test_process_email_queue_skips_malformed_items() {
        $sent = [];
        add_filter('pre_wp_mail', function ($null, $atts) use (&$sent) {
            $sent[] = $atts;
            return true;
        }, 10, 2);

        update_option(WPSG_Alerts::EMAIL_QUEUE, [
            'not-an-array',
            ['to' => '', 'subject' => '', 'message' => 'bad'],
            ['to' => 'ok@example.com', 'subject' => 'Good', 'message' => 'body', 'queued' => time()],
        ]);

        WPSG_Alerts::process_email_queue();

        // Only the well-formed item should be sent.
        $this->assertCount(1, $sent);
    }

    // ── Queue cap (only relevant when DISABLE_WP_CRON is false) ───────────

    public function test_email_queue_cap_behavior() {
        // When DISABLE_WP_CRON is true (test env), emails go synchronous.
        // We verify throttling still prevents duplicates.
        WPSG_Alerts::notify_fatal_error(['type' => E_ERROR, 'message' => 'cap_test', 'file' => 'x', 'line' => 1]);
        WPSG_Alerts::notify_fatal_error(['type' => E_ERROR, 'message' => 'cap_test2', 'file' => 'x', 'line' => 2]);

        // Only 1 because of throttle.
        $this->assertCount(1, $this->sent_mails);
    }

    // ── Custom recipient filter ────────────────────────────────────────────

    public function test_custom_recipient_used() {
        add_filter('wpsg_alert_email_recipient', function () {
            return 'custom@example.com';
        });

        WPSG_Alerts::notify_fatal_error(['type' => E_ERROR, 'message' => 'test', 'file' => 'f', 'line' => 1]);

        $this->assertNotEmpty($this->sent_mails);
        $this->assertEquals('custom@example.com', $this->sent_mails[0]['to']);
    }
}
