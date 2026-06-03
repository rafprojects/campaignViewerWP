<?php

/**
 * P39-IN1: Webhook support for campaign events.
 */
class WPSG_P39IN1_Webhook_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        delete_option(WPSG_Webhooks::OPTION_NAME);
        delete_option(WPSG_Webhooks::LOG_OPTION);
        // Remove any registered webhook hooks to avoid bleedthrough between tests.
        remove_all_actions('wpsg_campaign_created');
        remove_all_actions('wpsg_campaign_updated');
        remove_all_actions('wpsg_campaign_archived');
        remove_all_actions('wpsg_campaign_restored');
        remove_all_actions('wpsg_campaign_deleted');
        remove_all_actions('wpsg_media_added');
        remove_all_actions('wpsg_media_removed');
        remove_all_actions('wpsg_access_granted');
        remove_all_actions('wpsg_access_revoked');
        remove_all_actions(WPSG_Webhooks::RETRY_HOOK);
    }

    public function tearDown(): void {
        delete_option(WPSG_Webhooks::OPTION_NAME);
        delete_option(WPSG_Webhooks::LOG_OPTION);
        parent::tearDown();
    }

    // ── Endpoint storage ───────────────────────────────────────────────────────

    public function test_get_endpoints_returns_empty_array_by_default() {
        $this->assertSame([], WPSG_Webhooks::get_endpoints());
    }

    public function test_save_and_get_endpoints_roundtrip() {
        $endpoints = [
            ['url' => 'https://example.com/hook', 'secret' => 'abc', 'events' => [], 'enabled' => true],
        ];
        WPSG_Webhooks::save_endpoints($endpoints);
        $this->assertCount(1, WPSG_Webhooks::get_endpoints());
        $this->assertSame('https://example.com/hook', WPSG_Webhooks::get_endpoints()[0]['url']);
    }

    public function test_save_endpoints_reindexes() {
        $endpoints = [
            2 => ['url' => 'https://a.test/hook', 'secret' => 'x', 'events' => [], 'enabled' => true],
        ];
        WPSG_Webhooks::save_endpoints($endpoints);
        $stored = WPSG_Webhooks::get_endpoints();
        $this->assertArrayHasKey(0, $stored);
        $this->assertArrayNotHasKey(2, $stored);
    }

    // ── Secret helpers ─────────────────────────────────────────────────────────

    public function test_generate_secret_is_64_chars() {
        $secret = WPSG_Webhooks::generate_secret();
        $this->assertSame(64, strlen($secret));
    }

    public function test_generate_secret_is_unique() {
        $a = WPSG_Webhooks::generate_secret();
        $b = WPSG_Webhooks::generate_secret();
        $this->assertNotSame($a, $b);
    }

    public function test_mask_secret_hides_all_but_last_8() {
        $secret = '1234567890abcdef';
        $masked = WPSG_Webhooks::mask_secret($secret);
        $this->assertStringEndsWith('90abcdef', $masked);
        $this->assertStringStartsWith('********', $masked);
    }

    public function test_mask_secret_short_string() {
        $secret = 'abc';
        $masked = WPSG_Webhooks::mask_secret($secret);
        $this->assertSame('***', $masked);
    }

    public function test_sign_produces_sha256_prefix() {
        $sig = WPSG_Webhooks::sign('payload', 'mysecret');
        $this->assertStringStartsWith('sha256=', $sig);
    }

    public function test_sign_is_deterministic() {
        $a = WPSG_Webhooks::sign('body', 'secret');
        $b = WPSG_Webhooks::sign('body', 'secret');
        $this->assertSame($a, $b);
    }

    public function test_sign_differs_for_different_secrets() {
        $a = WPSG_Webhooks::sign('body', 'secret1');
        $b = WPSG_Webhooks::sign('body', 'secret2');
        $this->assertNotSame($a, $b);
    }

    // ── URL sanitization ───────────────────────────────────────────────────────

    public function test_sanitize_url_accepts_https() {
        $url = WPSG_Webhooks::sanitize_url('https://hooks.example.com/path');
        $this->assertNotEmpty($url);
    }

    public function test_sanitize_url_accepts_http() {
        $url = WPSG_Webhooks::sanitize_url('http://hooks.example.com/path');
        $this->assertNotEmpty($url);
    }

    public function test_sanitize_url_rejects_ftp() {
        $url = WPSG_Webhooks::sanitize_url('ftp://files.example.com/hook');
        $this->assertSame('', $url);
    }

    public function test_sanitize_url_rejects_empty() {
        $this->assertSame('', WPSG_Webhooks::sanitize_url(''));
    }

    public function test_sanitize_url_rejects_no_host() {
        $this->assertSame('', WPSG_Webhooks::sanitize_url('https://'));
    }

    // ── Event sanitization ─────────────────────────────────────────────────────

    public function test_sanitize_events_filters_invalid() {
        $events = WPSG_Webhooks::sanitize_events(['campaign.created', 'not.a.valid.event', 'media.added']);
        $this->assertSame(['campaign.created', 'media.added'], $events);
    }

    public function test_sanitize_events_returns_empty_for_empty_input() {
        $this->assertSame([], WPSG_Webhooks::sanitize_events([]));
    }

    // ── format_endpoint_for_api ────────────────────────────────────────────────

    public function test_format_endpoint_masks_secret() {
        $endpoint = [
            'url'     => 'https://example.com/hook',
            'secret'  => '1234567890abcdef',
            'events'  => ['campaign.created'],
            'enabled' => true,
        ];
        $formatted = WPSG_Webhooks::format_endpoint_for_api(0, $endpoint);
        $this->assertArrayNotHasKey('secret', $formatted);
        $this->assertArrayHasKey('secretHint', $formatted);
        $this->assertStringEndsWith('90abcdef', $formatted['secretHint']);
    }

    public function test_format_endpoint_includes_index() {
        $endpoint = ['url' => 'https://a.test/h', 'secret' => 'x', 'events' => [], 'enabled' => true];
        $formatted = WPSG_Webhooks::format_endpoint_for_api(3, $endpoint);
        $this->assertSame(3, $formatted['index']);
    }

    // ── Delivery log ───────────────────────────────────────────────────────────

    public function test_get_delivery_log_returns_empty_array_by_default() {
        $this->assertSame([], WPSG_Webhooks::get_delivery_log());
    }

    public function test_dispatch_logs_delivery_on_success() {
        // Mock wp_remote_post to return 200.
        add_filter('pre_http_request', function ($preempt, $args, $url) {
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/ok',
            'secret'  => 'testsecret',
            'events'  => [],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::dispatch('campaign.created', ['id' => 1, 'title' => 'Test']);

        remove_all_filters('pre_http_request');

        $log = WPSG_Webhooks::get_delivery_log();
        $this->assertCount(1, $log);
        $this->assertTrue($log[0]['success']);
        $this->assertSame(200, $log[0]['statusCode']);
        $this->assertSame('campaign.created', $log[0]['event']);
    }

    public function test_dispatch_logs_delivery_on_failure() {
        add_filter('pre_http_request', function () {
            return new WP_Error('http_request_failed', 'Connection refused');
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/fail',
            'secret'  => 'testsecret',
            'events'  => [],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::dispatch('campaign.archived', ['id' => 1]);

        remove_all_filters('pre_http_request');

        $log = WPSG_Webhooks::get_delivery_log();
        $this->assertCount(1, $log);
        $this->assertFalse($log[0]['success']);
        $this->assertSame(0, $log[0]['statusCode']);
    }

    public function test_dispatch_skips_disabled_endpoint() {
        add_filter('pre_http_request', function () {
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/disabled',
            'secret'  => 'secret',
            'events'  => [],
            'enabled' => false,
        ]]);

        WPSG_Webhooks::dispatch('campaign.created', ['id' => 1]);

        remove_all_filters('pre_http_request');

        $this->assertEmpty(WPSG_Webhooks::get_delivery_log());
    }

    public function test_dispatch_filters_by_event_type() {
        add_filter('pre_http_request', function () {
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/filtered',
            'secret'  => 'secret',
            'events'  => ['media.added'],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::dispatch('campaign.created', ['id' => 1]);

        remove_all_filters('pre_http_request');

        $this->assertEmpty(WPSG_Webhooks::get_delivery_log());
    }

    public function test_dispatch_empty_event_filter_receives_all_events() {
        $delivered = [];
        add_filter('pre_http_request', function ($preempt, $args, $url) use (&$delivered) {
            $delivered[] = $url;
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/all',
            'secret'  => 'secret',
            'events'  => [],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::dispatch('media.removed', ['campaignId' => 1]);
        WPSG_Webhooks::dispatch('access.revoked', ['campaignId' => 1]);

        remove_all_filters('pre_http_request');

        $this->assertCount(2, WPSG_Webhooks::get_delivery_log());
    }

    public function test_delivery_log_capped_at_max_entries() {
        add_filter('pre_http_request', function () {
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/capped',
            'secret'  => 'secret',
            'events'  => [],
            'enabled' => true,
        ]]);

        for ($i = 0; $i < WPSG_Webhooks::MAX_LOG + 10; $i++) {
            WPSG_Webhooks::dispatch('campaign.archived', ['id' => $i]);
        }

        remove_all_filters('pre_http_request');

        $log = WPSG_Webhooks::get_delivery_log();
        $this->assertCount(WPSG_Webhooks::MAX_LOG, $log);
    }

    // ── dispatch fires no delivery with no endpoints ────────────────────────────

    public function test_dispatch_with_no_endpoints_does_nothing() {
        WPSG_Webhooks::dispatch('campaign.created', ['id' => 1]);
        $this->assertEmpty(WPSG_Webhooks::get_delivery_log());
    }

    // ── Payload shape ──────────────────────────────────────────────────────────

    public function test_delivery_payload_contains_event_and_timestamp() {
        $captured_body = null;
        add_filter('pre_http_request', function ($preempt, $args) use (&$captured_body) {
            $captured_body = json_decode($args['body'], true);
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/payload',
            'secret'  => 'secret',
            'events'  => [],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::dispatch('campaign.created', ['id' => 42, 'title' => 'My Campaign']);

        remove_all_filters('pre_http_request');

        $this->assertNotNull($captured_body);
        $this->assertSame('campaign.created', $captured_body['event']);
        $this->assertArrayHasKey('timestamp', $captured_body);
        $this->assertArrayHasKey('data', $captured_body);
        $this->assertSame(42, $captured_body['data']['id']);
    }

    public function test_delivery_includes_signature_header() {
        $captured_headers = null;
        $captured_body    = null;
        add_filter('pre_http_request', function ($preempt, $args) use (&$captured_headers, &$captured_body) {
            $captured_headers = $args['headers'];
            $captured_body    = $args['body'];
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        $secret = 'testsecretvalue';
        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/sig',
            'secret'  => $secret,
            'events'  => [],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::dispatch('media.added', ['campaignId' => 1]);

        remove_all_filters('pre_http_request');

        $this->assertArrayHasKey('X-WPSG-Signature', $captured_headers);
        $expected_sig = 'sha256=' . hash_hmac('sha256', $captured_body, $secret);
        $this->assertSame($expected_sig, $captured_headers['X-WPSG-Signature']);
    }

    // ── WP action hooks ────────────────────────────────────────────────────────

    public function test_event_handlers_fire_dispatch_for_each_event() {
        $dispatched = [];
        add_filter('pre_http_request', function ($preempt, $args) use (&$dispatched) {
            $body = json_decode($args['body'], true);
            $dispatched[] = $body['event'] ?? null;
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url'     => 'https://hooks.test/all-events',
            'secret'  => 'secret',
            'events'  => [],
            'enabled' => true,
        ]]);

        WPSG_Webhooks::register();

        do_action('wpsg_campaign_created', 1, ['title' => 'T']);
        do_action('wpsg_campaign_updated', 1, ['title' => 'T2']);
        do_action('wpsg_campaign_archived', 1);
        do_action('wpsg_campaign_restored', 1);
        do_action('wpsg_campaign_deleted', 1);
        do_action('wpsg_media_added', 1, ['mediaId' => 'x']);
        do_action('wpsg_media_removed', 1, ['mediaId' => 'x']);
        do_action('wpsg_access_granted', 1, ['userId' => 2]);
        do_action('wpsg_access_revoked', 1, ['userId' => 2]);

        remove_all_filters('pre_http_request');

        $expected = [
            'campaign.created', 'campaign.updated', 'campaign.archived',
            'campaign.restored', 'campaign.deleted', 'media.added',
            'media.removed', 'access.granted', 'access.revoked',
        ];
        $this->assertSame($expected, $dispatched);
    }

    // ── REST endpoint CRUD ─────────────────────────────────────────────────────

    public function test_rest_list_endpoints_returns_empty() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/webhooks');
        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertSame([], $response->get_data());
    }

    public function test_rest_create_endpoint_returns_secret_once() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/webhooks');
        $request->set_param('url', 'https://hooks.test/new');
        $request->set_param('events', ['campaign.created']);
        $response = rest_do_request($request);
        $this->assertSame(201, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('secret', $data);
        $this->assertNotEmpty($data['secret']);
    }

    public function test_rest_create_endpoint_rejects_invalid_url() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/webhooks');
        $request->set_param('url', 'ftp://bad.url/hook');
        $response = rest_do_request($request);
        $this->assertSame(400, $response->get_status());
    }

    public function test_rest_create_endpoint_enforces_max_limit() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        $endpoints = [];
        for ($i = 0; $i < WPSG_Webhooks::MAX_ENDPOINTS; $i++) {
            $endpoints[] = ['url' => "https://hooks.test/{$i}", 'secret' => 's', 'events' => [], 'enabled' => true];
        }
        WPSG_Webhooks::save_endpoints($endpoints);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/webhooks');
        $request->set_param('url', 'https://hooks.test/overflow');
        $response = rest_do_request($request);
        $this->assertSame(400, $response->get_status());
    }

    public function test_rest_update_endpoint_changes_url() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        WPSG_Webhooks::save_endpoints([[
            'url' => 'https://old.test/hook', 'secret' => 'sec', 'events' => [], 'enabled' => true,
        ]]);

        $request = new WP_REST_Request('PUT', '/wp-super-gallery/v1/webhooks/0');
        $request->set_param('url', 'https://new.test/hook');
        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertSame('https://new.test/hook', $response->get_data()['url']);
    }

    public function test_rest_delete_endpoint_removes_it() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        WPSG_Webhooks::save_endpoints([[
            'url' => 'https://to-delete.test/hook', 'secret' => 'sec', 'events' => [], 'enabled' => true,
        ]]);

        $request  = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/webhooks/0');
        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertEmpty(WPSG_Webhooks::get_endpoints());
    }

    public function test_rest_rotate_secret_returns_new_secret() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));
        $original = WPSG_Webhooks::generate_secret();
        WPSG_Webhooks::save_endpoints([[
            'url' => 'https://hooks.test/rotate', 'secret' => $original, 'events' => [], 'enabled' => true,
        ]]);

        $request  = new WP_REST_Request('POST', '/wp-super-gallery/v1/webhooks/0/rotate-secret');
        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $new_secret = $response->get_data()['secret'];
        $this->assertNotSame($original, $new_secret);
        $this->assertSame($new_secret, WPSG_Webhooks::get_endpoints()[0]['secret']);
    }

    public function test_rest_list_deliveries_returns_log() {
        wp_set_current_user($this->factory->user->create(['role' => 'administrator']));

        add_filter('pre_http_request', function () {
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'body'     => '',
                'headers'  => [],
                'cookies'  => [],
                'filename' => null,
            ];
        }, 10, 3);

        WPSG_Webhooks::save_endpoints([[
            'url' => 'https://hooks.test/log', 'secret' => 'sec', 'events' => [], 'enabled' => true,
        ]]);
        WPSG_Webhooks::dispatch('campaign.created', ['id' => 1]);

        remove_all_filters('pre_http_request');

        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/webhooks/delivery-log');
        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());
        $this->assertCount(1, $response->get_data());
    }

    public function test_rest_endpoints_require_admin() {
        wp_set_current_user($this->factory->user->create(['role' => 'subscriber']));
        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/webhooks');
        $response = rest_do_request($request);
        $this->assertSame(403, $response->get_status());
    }
}
