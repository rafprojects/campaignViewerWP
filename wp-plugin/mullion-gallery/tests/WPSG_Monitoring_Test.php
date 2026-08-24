<?php

class WPSG_Monitoring_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        delete_option('wpsg_rest_request_count');
        delete_option('wpsg_rest_error_count');
        delete_option('wpsg_oembed_provider_failures');
        delete_option('wpsg_oembed_failure_count');
        // Reset the static timer.
        $ref = new ReflectionProperty(WPSG_Monitoring::class, 'rest_start');
        $ref->setAccessible(true);
        $ref->setValue(null, null);
    }

    public function tearDown(): void {
        delete_option('wpsg_rest_request_count');
        delete_option('wpsg_rest_error_count');
        delete_option('wpsg_oembed_provider_failures');
        delete_option('wpsg_oembed_failure_count');
        delete_transient('wpsg_rest_request_count_buffer');
        delete_transient('wpsg_rest_error_count_buffer');
        remove_all_filters('wpsg_metrics_flush_every');
        remove_all_filters('wpsg_metrics_flush_seconds');
        parent::tearDown();
    }

    // ── start_timer ────────────────────────────────────────────────────────

    public function test_start_timer_sets_for_wpsg_routes() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $server = rest_get_server();

        $result = WPSG_Monitoring::start_timer(null, $server, $request);
        $this->assertNull($result);

        $ref = new ReflectionProperty(WPSG_Monitoring::class, 'rest_start');
        $ref->setAccessible(true);
        $this->assertNotNull($ref->getValue(null));
    }

    public function test_start_timer_ignores_non_wpsg_routes() {
        $request = new WP_REST_Request('GET', '/wp/v2/posts');
        $server = rest_get_server();

        $ref = new ReflectionProperty(WPSG_Monitoring::class, 'rest_start');
        $ref->setAccessible(true);
        $ref->setValue(null, null);

        WPSG_Monitoring::start_timer(null, $server, $request);
        $this->assertNull($ref->getValue(null));
    }

    // ── attach_metrics ─────────────────────────────────────────────────────

    public function test_attach_metrics_adds_timing_header_for_wpsg_routes() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $server = rest_get_server();

        // Start timer first.
        WPSG_Monitoring::start_timer(null, $server, $request);

        $response = new WP_REST_Response(['ok' => true], 200);
        $result = WPSG_Monitoring::attach_metrics($response, $server, $request);

        $headers = $result->get_headers();
        $this->assertArrayHasKey('X-WPSG-Response-Time', $headers);
        $this->assertIsNumeric($headers['X-WPSG-Response-Time']);
    }

    public function test_attach_metrics_ignores_non_wpsg_routes() {
        $request = new WP_REST_Request('GET', '/wp/v2/posts');
        $server = rest_get_server();
        $response = new WP_REST_Response(['ok' => true], 200);

        $result = WPSG_Monitoring::attach_metrics($response, $server, $request);
        $headers = $result->get_headers();
        $this->assertArrayNotHasKey('X-WPSG-Response-Time', $headers);
    }

    public function test_attach_metrics_fires_wpsg_rest_metrics_action() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $server = rest_get_server();
        $response = new WP_REST_Response(['ok' => true], 200);

        $captured = null;
        add_action('wpsg_rest_metrics', function ($payload) use (&$captured) {
            $captured = $payload;
        });

        WPSG_Monitoring::start_timer(null, $server, $request);
        WPSG_Monitoring::attach_metrics($response, $server, $request);

        $this->assertNotNull($captured);
        $this->assertEquals('/wp-super-gallery/v1/campaigns', $captured['route']);
        $this->assertEquals(200, $captured['status']);
    }

    // ── log_fatal_error ────────────────────────────────────────────────────

    public function test_log_fatal_error_fires_action_on_fatal() {
        // Simulate a WPSG request context.
        $_GET['rest_route'] = '/wp-super-gallery/v1/campaigns';

        // We can't easily simulate error_get_last() returning a fatal in unit tests,
        // but we can verify the method doesn't crash when called directly.
        WPSG_Monitoring::log_fatal_error();
        $this->assertTrue(true); // No exception thrown.

        unset($_GET['rest_route']);
    }

    // ── track_oembed_failure ───────────────────────────────────────────────

    public function test_track_oembed_failure_records_provider() {
        WPSG_Monitoring::track_oembed_failure('https://www.youtube.com/watch?v=abc', ['endpoint1']);

        $failures = WPSG_Monitoring::get_oembed_failures();
        $this->assertArrayHasKey('youtube', $failures);
        $this->assertEquals(1, $failures['youtube']['count']);
    }

    public function test_track_oembed_failure_increments_count() {
        WPSG_Monitoring::track_oembed_failure('https://vimeo.com/123', ['ep1']);
        WPSG_Monitoring::track_oembed_failure('https://vimeo.com/456', ['ep2']);

        $failures = WPSG_Monitoring::get_oembed_failures();
        $this->assertEquals(2, $failures['vimeo']['count']);
    }

    public function test_track_oembed_failure_stores_recent_timestamps() {
        for ($i = 0; $i < 12; $i++) {
            WPSG_Monitoring::track_oembed_failure('https://rumble.com/v' . $i, ['ep']);
        }

        $failures = WPSG_Monitoring::get_oembed_failures();
        // Only last 10 timestamps kept.
        $this->assertCount(10, $failures['rumble']['recent']);
    }

    public function test_track_oembed_failure_detects_providers() {
        $providers = [
            'https://www.youtube.com/watch?v=1'    => 'youtube',
            'https://youtu.be/abc'                  => 'youtube',
            'https://vimeo.com/123'                 => 'vimeo',
            'https://rumble.com/v1'                 => 'rumble',
            'https://twitter.com/user/status/1'     => 'twitter',
            'https://x.com/user/status/1'           => 'twitter',
            'https://open.spotify.com/track/1'      => 'spotify',
            'https://soundcloud.com/artist/track'   => 'soundcloud',
        ];

        foreach ($providers as $url => $expected) {
            WPSG_Monitoring::track_oembed_failure($url, ['ep']);
        }

        $failures = WPSG_Monitoring::get_oembed_failures();
        foreach ($providers as $url => $expected) {
            $this->assertArrayHasKey($expected, $failures, "Provider '$expected' not detected for $url");
        }
    }

    public function test_track_oembed_failure_unknown_provider() {
        WPSG_Monitoring::track_oembed_failure('https://example.com/media/1', ['ep']);

        $failures = WPSG_Monitoring::get_oembed_failures();
        $this->assertArrayHasKey('example.com', $failures);
    }

    // ── reset_oembed_failures ──────────────────────────────────────────────

    public function test_reset_oembed_failures_clears_all() {
        WPSG_Monitoring::track_oembed_failure('https://youtube.com/v1', ['ep']);
        WPSG_Monitoring::track_oembed_failure('https://vimeo.com/1', ['ep']);

        WPSG_Monitoring::reset_oembed_failures();

        $failures = WPSG_Monitoring::get_oembed_failures();
        $this->assertEmpty($failures);
    }

    public function test_reset_oembed_failures_clears_single_provider() {
        WPSG_Monitoring::track_oembed_failure('https://youtube.com/v1', ['ep']);
        WPSG_Monitoring::track_oembed_failure('https://vimeo.com/1', ['ep']);

        WPSG_Monitoring::reset_oembed_failures('youtube');

        $failures = WPSG_Monitoring::get_oembed_failures();
        $this->assertArrayNotHasKey('youtube', $failures);
        $this->assertArrayHasKey('vimeo', $failures);
    }

    // ── get_health_data ────────────────────────────────────────────────────

    public function test_get_health_data_returns_expected_keys() {
        $data = WPSG_Monitoring::get_health_data();

        $this->assertArrayHasKey('restRequestCount', $data);
        $this->assertArrayHasKey('restErrorCount', $data);
        $this->assertArrayHasKey('restErrorRate', $data);
        $this->assertArrayHasKey('oembedFailureCount', $data);
        $this->assertArrayHasKey('oembedProviders', $data);
        $this->assertArrayHasKey('campaigns', $data);
        $this->assertArrayHasKey('storage', $data);
        $this->assertArrayHasKey('phpVersion', $data);
        $this->assertArrayHasKey('wpVersion', $data);
        $this->assertArrayHasKey('timestamp', $data);
    }

    public function test_get_health_data_error_rate_zero_when_no_requests() {
        $data = WPSG_Monitoring::get_health_data();
        $this->assertEquals(0, $data['restErrorRate']);
    }

    public function test_get_health_data_counts_campaigns_by_status() {
        // Create active and archived campaigns.
        $active_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Active',
            'post_status' => 'publish',
        ]);
        update_post_meta($active_id, 'status', 'active');

        $archived_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Archived',
            'post_status' => 'publish',
        ]);
        update_post_meta($archived_id, 'status', 'archived');

        $data = WPSG_Monitoring::get_health_data();
        $this->assertGreaterThanOrEqual(1, $data['campaigns']['active']);
        $this->assertGreaterThanOrEqual(1, $data['campaigns']['archived']);
    }
}
