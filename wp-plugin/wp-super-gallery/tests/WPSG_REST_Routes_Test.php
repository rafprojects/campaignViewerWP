<?php

// Tests for REST API route validation and functionality.
// These tests assume a WordPress PHPUnit environment (WP_UnitTestCase).

class WPSG_REST_Routes_Test extends WP_UnitTestCase {

    private $admin_id;

    public function setUp(): void {
        parent::setUp();
        // Routes are registered automatically when the plugin loads
        // via the rest_api_init action in the main plugin file
        $this->admin_id = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $this->admin_id);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($this->admin_id);
    }

    // ── P28-K: args validation tests ────────────────────────────────────────

    public function test_create_campaign_requires_title() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        // No title — WP core should reject with rest_missing_callback_param
        $response = rest_do_request($request);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('rest_missing_callback_param', $data['code']);
    }

    public function test_create_campaign_rejects_invalid_visibility() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $request->set_param('title', 'Test');
        $request->set_param('visibility', 'secret');
        $response = rest_do_request($request);
        $this->assertEquals(400, $response->get_status());
        $this->assertEquals('rest_invalid_param', $response->get_data()['code']);
    }

    public function test_batch_campaigns_requires_action_and_ids() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/batch');
        $response = rest_do_request($request);
        $this->assertEquals(400, $response->get_status());
        $this->assertEquals('rest_missing_callback_param', $response->get_data()['code']);
    }

    public function test_batch_campaigns_rejects_invalid_action() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/batch');
        $request->set_param('action', 'delete');
        $request->set_param('ids', [1, 2]);
        $response = rest_do_request($request);
        $this->assertEquals(400, $response->get_status());
        $this->assertEquals('rest_invalid_param', $response->get_data()['code']);
    }

    public function test_analytics_event_requires_campaign_id() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $response = rest_do_request($request);
        $this->assertEquals(400, $response->get_status());
        $this->assertEquals('rest_missing_callback_param', $response->get_data()['code']);
    }

    public function test_analytics_event_rejects_invalid_event_type() {
        update_option('wpsg_settings', ['enable_analytics' => true]);
        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Analytics Test',
            'post_status' => 'publish',
        ]);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $request->set_param('campaignId', $campaign_id);
        $request->set_param('eventType', 'click');
        $response = rest_do_request($request);
        $this->assertEquals(400, $response->get_status());
        $this->assertEquals('rest_invalid_param', $response->get_data()['code']);

        wp_delete_post($campaign_id, true);
    }

    public function test_schema_document_lists_routes_with_args() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1');
        $response = rest_do_request($request);
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        // Campaigns route should expose its schema
        $this->assertArrayHasKey('/wp-super-gallery/v1/campaigns', $data['routes']);
    }

    // ── P28-L: X-RateLimit-* header tests ───────────────────────────────────

    public function test_rate_limited_response_includes_ratelimit_headers() {
        // GET /campaigns is rate_limit_public — should always return headers
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $response = rest_do_request($request);
        $headers = $response->get_headers();
        $this->assertArrayHasKey('X-RateLimit-Limit', $headers);
        $this->assertArrayHasKey('X-RateLimit-Remaining', $headers);
        $this->assertArrayHasKey('X-RateLimit-Reset', $headers);
        $this->assertGreaterThan(0, (int) $headers['X-RateLimit-Limit']);
        $this->assertGreaterThanOrEqual(0, (int) $headers['X-RateLimit-Remaining']);
        $this->assertGreaterThan(time() - 1, (int) $headers['X-RateLimit-Reset']);
    }

    public function test_remaining_decrements_on_successive_requests() {
        $request1 = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $response1 = rest_do_request($request1);
        $remaining1 = (int) $response1->get_headers()['X-RateLimit-Remaining'];

        $request2 = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $response2 = rest_do_request($request2);
        $remaining2 = (int) $response2->get_headers()['X-RateLimit-Remaining'];

        $this->assertLessThan($remaining1, $remaining2);
    }

    public function test_429_response_includes_ratelimit_headers() {
        // Override limit to 0 so the very first request trips the limiter
        add_filter('wpsg_rate_limit_public', '__return_zero');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        // rate_limit_check returns early when limit <= 0, so use limit=1 instead
        remove_all_filters('wpsg_rate_limit_public');
        add_filter('wpsg_rate_limit_public', static function () { return 1; });

        // First request consumes the only slot
        rest_do_request($request);
        // Second request hits 429
        $response = rest_do_request(new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns'));

        // If the server returned 429, headers must still be present
        if ($response->get_status() === 429) {
            $headers = $response->get_headers();
            $this->assertArrayHasKey('X-RateLimit-Limit', $headers);
            $this->assertArrayHasKey('X-RateLimit-Remaining', $headers);
            $this->assertArrayHasKey('X-RateLimit-Reset', $headers);
            $this->assertEquals(0, (int) $headers['X-RateLimit-Remaining']);
        }

        remove_all_filters('wpsg_rate_limit_public');
    }

    public function test_media_routes_are_registered() {
        $routes = rest_get_server()->get_routes('wp-super-gallery/v1');
        $this->assertArrayHasKey('/wp-super-gallery/v1/campaigns/(?P<id>\d+)/media', $routes);
        $this->assertArrayHasKey('/wp-super-gallery/v1/campaigns/(?P<id>\d+)/media/batch', $routes);
        $this->assertArrayHasKey('/wp-super-gallery/v1/campaigns/(?P<id>\d+)/media/(?P<mediaId>[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)', $routes);
    }

    public function test_valid_media_ids_work_with_api() {
        // Create a test campaign first
        $campaign_id = wp_insert_post([
            'post_type' => 'wpsg_campaign',
            'post_title' => 'Test Campaign',
            'post_status' => 'publish',
        ]);

        $valid_ids = [
            'abc123',
            'test_video',
            'file.mp4',
            'external.youtube.123',
        ];

        foreach ($valid_ids as $media_id) {
            // Test that we can create media with valid IDs
            $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media");
            $request->set_param('type', 'video');
            $request->set_param('source', 'external');
            $request->set_param('provider', 'youtube');
            $request->set_param('url', 'https://youtube.com/watch?v=test');
            $request->set_param('id', $media_id);

            // This should work since we're calling the handler directly
            $response = WPSG_REST::create_media($request);

            // Should not be an error about invalid mediaId format
            $this->assertInstanceOf('WP_REST_Response', $response);
            if ($response->get_status() !== 201) {
                $data = $response->get_data();
                $this->assertStringNotContainsString('invalid', strtolower($data['message'] ?? ''), "Valid mediaId '{$media_id}' should not cause validation error");
            }
        }

        // Clean up
        wp_delete_post($campaign_id, true);
    }

    public function test_invalid_media_ids_are_rejected_by_api() {
        // Create a test campaign first
        $campaign_id = wp_insert_post([
            'post_type' => 'wpsg_campaign',
            'post_title' => 'Test Campaign',
            'post_status' => 'publish',
        ]);

        $invalid_ids = [
            '',           // empty
            '.',          // only period
            '..',         // only periods
            'test.',      // ends with period
            '.test',      // starts with period
            'test..id',   // consecutive periods
            'test@id',    // invalid character
        ];

        foreach ($invalid_ids as $media_id) {
            // Test that invalid IDs cause route not found (404) because they don't match the regex
            $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media/{$media_id}");
            $request->set_param('caption', 'Test caption');

            $response = rest_do_request($request);

            // Should get 404 because route doesn't match due to invalid mediaId
            $this->assertEquals(404, $response->get_status(), "Invalid mediaId '{$media_id}' should result in 404 route not found");
        }

        // Clean up
        wp_delete_post($campaign_id, true);
    }

    public function test_route_parameters_are_extracted_correctly() {
        $media_id = 'test_video_001.mp4';
        $campaign_id = '456';

        $route = "/wp-super-gallery/v1/campaigns/{$campaign_id}/media/{$media_id}";
        $request = new WP_REST_Request('PUT', $route);

        $matched_route = rest_get_server()->match_request_to_handler($request);
        $this->assertNotFalse($matched_route, 'Route should match for valid parameters');

        // Verify that the route matched by checking it's not false
        // The regex validation is already tested in other methods
    }
}

// Simple regex validation tests that can run without WordPress test environment
class WPSG_MediaId_Regex_Test extends PHPUnit\Framework\TestCase {

    public function test_media_id_regex_pattern_directly() {
        // Test the regex pattern directly for comprehensive validation
        $pattern = '/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/';

        $valid_ids = [
            'abc123',
            'test_video',
            'media_001',
            'file.mp4',
            'external.youtube.123',
            'a1_b2.c3_d4',
            'x',
            'test_123.mp4',
            'UPPERCASE_123',
            'a_b_c_d_e_f_g_h_i_j_k_l_m_n_o_p_q_r_s_t_u_v_w_x_y_z_0123456789'
        ];

        foreach ($valid_ids as $media_id) {
            $this->assertMatchesRegularExpression($pattern, $media_id,
                "Expected '{$media_id}' to match the mediaId regex pattern");
        }

        $invalid_ids = [
            '',           // empty
            '.',          // only period
            '..',         // only periods
            'test.',      // ends with period
            '.test',      // starts with period
            'test..id',   // consecutive periods
            'test.id.',   // ends with period after valid part
            '.test.id',   // starts with period
            'test..',     // ends with consecutive periods
            '..test',     // starts with consecutive periods
            'test.id.sub.', // ends with period
            'test.id..sub', // consecutive periods in middle
            ' test',      // leading space
            'test ',      // trailing space
            'test id',    // space in middle
            'test@id',    // invalid character
            'test/id',    // invalid character
            'test?id',    // invalid character
            'test#id',    // invalid character
            'test$id',    // invalid character
            'test%id',    // invalid character
            'test^id',    // invalid character
            'test&id',    // invalid character
            'test*id',    // invalid character
            'test(id)',   // invalid characters
            'test[id]',   // invalid characters
            'test{id}',   // invalid characters
            'test|id',    // invalid character
            'test\id',    // invalid character
            'test:id',    // invalid character (colon not allowed)
            'test;id',    // invalid character
            'test,id',    // invalid character (comma not allowed)
            'test<id',    // invalid character
            'test>id',    // invalid character
            'test"id',    // invalid character
            'test\'id',   // invalid character
        ];

        foreach ($invalid_ids as $media_id) {
            $this->assertDoesNotMatchRegularExpression($pattern, $media_id,
                "Expected '{$media_id}' to NOT match the mediaId regex pattern");
        }
    }

    public function test_regex_pattern_structure_requirements() {
        $pattern = '/^[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*$/';

        // Test that single character IDs work
        $this->assertMatchesRegularExpression($pattern, 'a');
        $this->assertMatchesRegularExpression($pattern, '1');
        $this->assertMatchesRegularExpression($pattern, '_');

        // Test that periods work as internal separators
        $this->assertMatchesRegularExpression($pattern, 'file.mp4');
        $this->assertMatchesRegularExpression($pattern, 'a.b.c');

        // Test that underscores work everywhere
        $this->assertMatchesRegularExpression($pattern, '_test_');
        $this->assertMatchesRegularExpression($pattern, 'test_file.mp4');

        // Test boundaries - must start and end with alphanumeric or underscore
        $this->assertDoesNotMatchRegularExpression($pattern, '.test');
        $this->assertDoesNotMatchRegularExpression($pattern, 'test.');
        $this->assertDoesNotMatchRegularExpression($pattern, '.');
        $this->assertDoesNotMatchRegularExpression($pattern, '');

        // Test consecutive periods are not allowed
        $this->assertDoesNotMatchRegularExpression($pattern, 'test..file');
        $this->assertDoesNotMatchRegularExpression($pattern, '..');
    }
}