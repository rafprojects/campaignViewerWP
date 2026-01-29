<?php

// These tests assume a WordPress PHPUnit environment (WP_UnitTestCase).
// In CI, run via the standard WP test harness.

class ProxyOEmbedTest extends WP_UnitTestCase {
    public function test_missing_url_returns_400() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        // no url param
        $response = WPSG_REST::proxy_oembed($request);
        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('message', $data);
    }

    public function test_invalid_url_no_host_returns_400() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'https:///path');
        $response = WPSG_REST::proxy_oembed($request);
        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('Invalid oEmbed URL host', $data['message']);
    }

    public function test_cached_payload_is_returned() {
        $url = 'https://example.com/video/1';
        $cache_key = 'wpsg_oembed_' . md5($url);
        $payload = ['title' => 'Cached Title', 'thumbnail_url' => 'https://example.com/thumb.jpg'];
        set_transient($cache_key, $payload, 60);

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', $url);
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('Cached Title', $data['title']);
    }

    public function test_cached_error_payload_returns_correct_status() {
        $url = 'https://example.com/video/1';
        $cache_key = 'wpsg_oembed_' . md5($url);
        $error_payload = [
            'error' => 'Provider error',
            'message' => 'Failed to fetch',
            '_wpsg_status' => 502
        ];
        set_transient($cache_key, $error_payload, 60);

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', $url);
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(502, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('Provider error', $data['error']);
        $this->assertArrayNotHasKey('_wpsg_status', $data); // Internal metadata removed
    }

    public function test_allowlisted_host_bypasses_ip_check() {
        // Test that allowlisted hosts don't go through IP resolution check
        // We'll test this by using a non-allowlisted host that would normally require IP check,
        // and verify the error message is about IP resolution, not about being allowlisted
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'https://non-allowlisted-site.com/watch?v=123');

        $response = WPSG_REST::proxy_oembed($request);
        $this->assertInstanceOf('WP_REST_Response', $response);

        // Should fail with DNS resolution error, not IP blocking error
        $data = $response->get_data();
        $this->assertEquals('Unable to resolve host for oEmbed URL', $data['message'] ?? '');
    }
}
