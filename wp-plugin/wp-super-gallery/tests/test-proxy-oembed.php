<?php

use PHPUnit\Framework\TestCase;

// These tests assume a WordPress PHPUnit environment (WP_UnitTestCase).
// In CI, run via the standard WP test harness.

class WPSG_REST_Proxy_OEmbed_Test extends WP_UnitTestCase {
    public function test_missing_url_returns_400() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        // no url param
        $response = WPSG_REST::proxy_oembed($request);
        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('message', $data);
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
}
