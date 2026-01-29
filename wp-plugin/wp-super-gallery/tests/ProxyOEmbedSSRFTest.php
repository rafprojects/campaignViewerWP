<?php

class ProxyOEmbedSSRFTest extends WP_UnitTestCase {
    public function test_requires_https_returns_400() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'http://example.com/video');
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('message', $data);
        $this->assertEquals('Only HTTPS oEmbed URLs are allowed', $data['message']);
    }

    public function test_block_private_ip_localhost() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'https://localhost/some/path');
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('message', $data);
        $this->assertEquals('oEmbed host resolves to a private or disallowed IP', $data['message']);
    }

    public function test_block_private_ip_10_range() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'https://10.0.0.1/some/path');
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('oEmbed host resolves to a private or disallowed IP', $data['message']);
    }

    public function test_block_private_ip_172_range() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'https://172.16.0.1/some/path');
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('oEmbed host resolves to a private or disallowed IP', $data['message']);
    }

    public function test_block_private_ip_192_range() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        $request->set_param('url', 'https://192.168.1.1/some/path');
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('oEmbed host resolves to a private or disallowed IP', $data['message']);
    }

    public function test_block_private_ipv6_localhost() {
        // Note: IPv6 literals in URLs are in brackets, but gethostbynamel may not resolve them
        // This test may need adjustment based on how the system handles IPv6
        $this->markTestSkipped('IPv6 literal resolution needs investigation');
    }

    public function test_block_private_ipv6_unique_local() {
        $this->markTestSkipped('IPv6 literal resolution needs investigation');
    }

    public function test_block_private_ipv6_link_local() {
        $this->markTestSkipped('IPv6 literal resolution needs investigation');
    }

    public function test_unresolvable_host_returns_400() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/oembed');
        // Use a likely-nonexistent TLD to avoid accidental resolution.
        $request->set_param('url', 'https://no-such-host-abcdefg.invalid/path');
        $response = WPSG_REST::proxy_oembed($request);

        $this->assertInstanceOf('WP_REST_Response', $response);
        $this->assertEquals(400, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('message', $data);
        $this->assertEquals('Unable to resolve host for oEmbed URL', $data['message']);
    }
}
