<?php
/**
 * P63-C — security & asset-cache headers hook-timing.
 *
 * The subsystem was inert because the header emitters were wired to hooks that
 * fire at the wrong time (send_headers vs the flag set during the_content; a
 * callback registered on an already-fired hook). These tests pin the corrected
 * wiring and the now-testable decision/emission logic.
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63C_Security_Headers_Test extends WP_UnitTestCase {

    public function tearDown(): void {
        remove_all_filters( 'wpsg_csp_header' );
        remove_all_filters( 'wpsg_x_frame_options' );
        remove_all_filters( 'wpsg_security_headers_enabled' );
        parent::tearDown();
    }

    // ── Header set (pure) ────────────────────────────────────────────────────

    public function test_header_list_contains_core_headers_by_default() {
        $headers = wpsg_security_headers_list();

        $this->assertSame( 'nosniff', $headers['X-Content-Type-Options'] );
        $this->assertSame( 'SAMEORIGIN', $headers['X-Frame-Options'] );
        $this->assertArrayHasKey( 'Referrer-Policy', $headers );
        $this->assertArrayHasKey( 'Permissions-Policy', $headers );
        // CSP is opt-in — absent unless a value is filtered in.
        $this->assertArrayNotHasKey( 'Content-Security-Policy', $headers );
    }

    public function test_csp_included_when_filtered() {
        add_filter( 'wpsg_csp_header', fn() => "default-src 'self'" );
        $headers = wpsg_security_headers_list();
        $this->assertSame( "default-src 'self'", $headers['Content-Security-Policy'] );
    }

    public function test_x_frame_options_filterable() {
        add_filter( 'wpsg_x_frame_options', fn() => 'DENY' );
        $headers = wpsg_security_headers_list();
        $this->assertSame( 'DENY', $headers['X-Frame-Options'] );
    }

    // ── Front-end shortcode detection ────────────────────────────────────────

    public function test_page_with_gallery_shortcode_is_detected() {
        $page_id = self::factory()->post->create( [
            'post_type'    => 'page',
            'post_status'  => 'publish',
            'post_content' => 'Intro copy [super-gallery campaign="x"] outro copy',
        ] );

        $this->go_to( get_permalink( $page_id ) );

        $this->assertTrue( wpsg_page_has_gallery_shortcode() );
    }

    public function test_page_without_shortcode_is_not_detected() {
        $page_id = self::factory()->post->create( [
            'post_type'    => 'page',
            'post_status'  => 'publish',
            'post_content' => 'Just some ordinary content, no gallery here.',
        ] );

        $this->go_to( get_permalink( $page_id ) );

        $this->assertFalse( wpsg_page_has_gallery_shortcode() );
    }

    // ── Corrected wiring (the actual bug) ────────────────────────────────────

    public function test_frontend_headers_hooked_on_template_redirect() {
        $this->assertNotFalse(
            has_action( 'template_redirect', 'wpsg_maybe_send_security_headers' ),
            'front-end security headers must fire on template_redirect (before output, after send_headers)'
        );
    }

    public function test_rest_headers_hooked_on_rest_pre_serve_request() {
        $this->assertNotFalse(
            has_filter( 'rest_pre_serve_request', 'wpsg_add_rest_security_headers' ),
            'REST security headers must fire on rest_pre_serve_request'
        );
    }

    public function test_dead_send_headers_hook_is_gone() {
        // The old, never-effective hook + function must no longer exist.
        $this->assertFalse( has_action( 'send_headers', 'wpsg_add_security_headers' ) );
        $this->assertFalse( function_exists( 'wpsg_add_security_headers' ) );
        $this->assertFalse( function_exists( 'wpsg_should_add_security_headers' ) );
    }

    // ── REST callback is a pass-through ──────────────────────────────────────

    public function test_rest_callback_returns_served_unchanged() {
        $wpsg_req  = new WP_REST_Request( 'GET', '/wp-super-gallery/v1/campaigns' );
        $other_req = new WP_REST_Request( 'GET', '/wp/v2/posts' );

        $this->assertTrue( wpsg_add_rest_security_headers( true, null, $wpsg_req, null ) );
        $this->assertTrue( wpsg_add_rest_security_headers( true, null, $other_req, null ) );
    }
}
