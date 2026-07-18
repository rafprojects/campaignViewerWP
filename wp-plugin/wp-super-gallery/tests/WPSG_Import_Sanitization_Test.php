<?php
/**
 * P20-B — Import payload deep sanitization tests.
 *
 * Verifies that import_campaign() routes slot, overlay, background,
 * and layout-binding data through the same sanitizers used by the
 * normal save path, stripping <script> tags, javascript: URIs,
 * CSS injection payloads, and other malicious content.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Import_Sanitization_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        // Ensure we have an admin user with the WPSG capability.
        $user_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
        $user    = get_user_by( 'id', $user_id );
        $user->add_cap( 'manage_wpsg' );
        wp_set_current_user( $user_id );
    }

    public function tearDown(): void {
        // P62-A: never leak a simulated-license filter into the next test.
        remove_filter( 'wpsg_license_is_pro', '__return_true' );
        parent::tearDown();
    }

    /**
     * Build a minimal valid import payload, optionally injecting overrides.
     */
    private function build_payload( array $overrides = [] ): array {
        $base = [
            'version'  => 1,
            'campaign' => [
                'title'       => 'Test Campaign',
                'description' => 'Test',
                'visibility'  => 'public',
                'tags'        => [ 'test' ],
            ],
            'layout_template' => [
                'title' => 'Test Template',
                'name'  => 'Test Template',
                'slots' => [
                    [
                        'id'     => 'slot-1',
                        'x'     => 10,
                        'y'     => 10,
                        'width' => 40,
                        'height' => 40,
                        'shape' => 'rectangle',
                    ],
                ],
                'overlays'      => [],
                'graphicLayers' => [],
            ],
        ];

        return array_replace_recursive( $base, $overrides );
    }

    // ── Slot sanitization ──────────────────────────────────────

    public function test_script_tag_in_slot_name_is_stripped() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'  => 'Template',
            'slots' => [
                [
                    'id'     => 'slot-1',
                    'x'     => 10,
                    'y'     => 10,
                    'width' => 40,
                    'height' => 40,
                    'name'  => '<script>alert("xss")</script>Hello',
                    'shape' => 'rectangle',
                ],
            ],
        ] );

        // sanitize_text_field strips tags.
        $this->assertStringNotContainsString( '<script>', $result['slots'][0]['name'] );
        $this->assertStringContainsString( 'Hello', $result['slots'][0]['name'] );
    }

    public function test_javascript_uri_in_slot_mediaUrl_is_stripped() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'  => 'Template',
            'slots' => [
                [
                    'id'       => 'slot-1',
                    'x'       => 0,
                    'y'       => 0,
                    'width'   => 50,
                    'height'  => 50,
                    'mediaUrl' => 'javascript:alert(1)',
                    'shape'   => 'rectangle',
                ],
            ],
        ] );

        // esc_url_raw rejects javascript: scheme.
        $url = $result['slots'][0]['mediaUrl'];
        $this->assertStringNotContainsString( 'javascript:', $url );
    }

    public function test_css_injection_in_slot_borderColor_is_rejected() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'  => 'Template',
            'slots' => [
                [
                    'id'          => 'slot-1',
                    'x'          => 0,
                    'y'          => 0,
                    'width'      => 50,
                    'height'     => 50,
                    'borderColor' => 'red; background-image: url(https://evil.com)',
                    'shape'      => 'rectangle',
                ],
            ],
        ] );

        $color = $result['slots'][0]['borderColor'];
        // The CSS sanitizer should reject the injection (contains ; and url).
        $this->assertStringNotContainsString( 'url(', $color );
        $this->assertStringNotContainsString( ';', $color );
    }

    public function test_css_expression_in_clipPath_is_rejected() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'  => 'Template',
            'slots' => [
                [
                    'id'       => 'slot-1',
                    'x'       => 0,
                    'y'       => 0,
                    'width'   => 50,
                    'height'  => 50,
                    'clipPath' => 'expression(alert(1))',
                    'shape'   => 'custom',
                ],
            ],
        ] );

        $clip = $result['slots'][0]['clipPath'];
        $this->assertStringNotContainsString( 'expression', $clip );
    }

    // ── Overlay sanitization ───────────────────────────────────

    public function test_script_in_overlay_imageUrl_is_sanitized() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'     => 'Template',
            'slots'    => [],
            'overlays' => [
                [
                    'id'       => 'ol-1',
                    'imageUrl' => 'javascript:alert(document.cookie)',
                    'x'       => 0,
                    'y'       => 0,
                    'width'   => 100,
                    'height'  => 100,
                ],
            ],
        ] );

        foreach ( $result['overlays'] as $overlay ) {
            $this->assertStringNotContainsString( 'javascript:', $overlay['imageUrl'] );
        }
    }

    public function test_blob_url_overlay_is_filtered_out() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'     => 'Template',
            'slots'    => [],
            'overlays' => [
                [
                    'id'       => 'ol-1',
                    'imageUrl' => 'blob:http://localhost/some-blob-id',
                    'x'       => 0,
                    'y'       => 0,
                    'width'   => 100,
                    'height'  => 100,
                ],
            ],
        ] );

        // Blob URLs should be filtered out entirely.
        $this->assertEmpty( $result['overlays'] );
    }

    // ── Background sanitization ────────────────────────────────

    public function test_background_color_injection_is_rejected() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'            => 'Template',
            'slots'           => [],
            'backgroundMode'  => 'color',
            'backgroundColor' => '#fff; } body { display:none } .x {',
        ] );

        $bg = $result['backgroundColor'];
        $this->assertStringNotContainsString( ';', $bg );
        $this->assertStringNotContainsString( 'display', $bg );
    }

    public function test_background_image_javascript_uri_rejected() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'            => 'Template',
            'slots'           => [],
            'backgroundMode'  => 'image',
            'backgroundImage' => 'javascript:alert(1)',
        ] );

        $img = $result['backgroundImage'] ?? '';
        $this->assertStringNotContainsString( 'javascript:', $img );
    }

    // ── Clean payloads still succeed ───────────────────────────

    public function test_clean_payload_passes_through_unchanged() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'              => 'My Template',
            'canvasAspectRatio' => 1.7778,
            'backgroundMode'    => 'color',
            'backgroundColor'   => '#1a1a2e',
            'slots'             => [
                [
                    'id'          => 'slot-a',
                    'x'          => 5,
                    'y'          => 5,
                    'width'      => 45,
                    'height'     => 45,
                    'shape'      => 'rectangle',
                    'borderColor' => '#ff0000',
                    'objectFit'  => 'cover',
                    'mediaUrl'   => 'https://example.com/photo.jpg',
                ],
            ],
            'overlays' => [
                [
                    'id'       => 'ol-a',
                    'imageUrl' => 'https://example.com/overlay.png',
                    'x'       => 0,
                    'y'       => 0,
                    'width'   => 100,
                    'height'  => 100,
                ],
            ],
        ] );

        $this->assertEquals( 'My Template', $result['name'] );
        $this->assertEquals( '#1a1a2e', $result['backgroundColor'] );
        $this->assertCount( 1, $result['slots'] );
        $this->assertEquals( '#ff0000', $result['slots'][0]['borderColor'] );
        $this->assertEquals( 'https://example.com/photo.jpg', $result['slots'][0]['mediaUrl'] );
        $this->assertCount( 1, $result['overlays'] );
        $this->assertEquals( 'https://example.com/overlay.png', $result['overlays'][0]['imageUrl'] );
    }

    // ── P62-A: import strips pro-gated fields when unlicensed ───

    public function test_import_strips_text_layers_when_unlicensed() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'  => 'Imported',
            'slots' => [],
            'texts' => [
                [ 'id' => 't1', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'Imported text' ],
            ],
        ] );

        $this->assertSame( [], $result['texts'], 'Unlicensed import must strip text layers.' );
    }

    public function test_import_strips_breakpoint_overrides_when_unlicensed() {
        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'                => 'Imported',
            'slots'               => [ [ 'id' => 'slot-1', 'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50 ] ],
            'breakpointOverrides' => [ 'tablet' => [ 'slot-1' => [ 'x' => 10, 'y' => 20 ] ] ],
        ] );

        $this->assertSame( [], $result['breakpointOverrides'], 'Unlicensed import must strip breakpoint overrides.' );
    }

    public function test_import_keeps_pro_fields_when_licensed() {
        add_filter( 'wpsg_license_is_pro', '__return_true' );

        $result = WPSG_Layout_Templates::sanitize_template_data( [
            'name'  => 'Imported',
            'slots' => [],
            'texts' => [
                [ 'id' => 't1', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'Imported text' ],
            ],
        ] );

        $this->assertCount( 1, $result['texts'], 'Licensed import must keep text layers.' );
        $this->assertEquals( 'Imported text', $result['texts'][0]['content'] );
    }

    // ── P65-A: import_campaign() controller-path layout-template round-trip ─────

    /**
     * A-4 regression: the REST JSON import path must create the layout template
     * under the REGISTERED CPT (wpsg_layout_tpl) and bind by UUID, so it is
     * retrievable via WPSG_Layout_Templates::get(). Before P65-A this path built
     * a post of the unregistered `wpsg_layout_template` type and bound a numeric
     * ID — an orphan the template library never saw. Every existing test in this
     * file exercised sanitize_template_data() directly and so never caught it.
     */
    public function test_import_campaign_creates_layout_template_under_registered_cpt() {
        WPSG_CPT::register();

        $payload = $this->build_payload();
        $request = new WP_REST_Request( 'POST', '/wp-super-gallery/v1/campaigns/import' );
        $request->set_body( wp_json_encode( $payload ) );
        $request->set_header( 'Content-Type', 'application/json' );

        $response = WPSG_Export_Controller::import_campaign( $request );
        $this->assertInstanceOf( WP_REST_Response::class, $response );
        $this->assertSame( 201, $response->get_status() );

        $new_id   = $response->get_data()['id'];
        $bound_id = get_post_meta( $new_id, '_wpsg_layout_binding_template_id', true );
        $this->assertNotEmpty( $bound_id );

        // Retrievable through the CRUD class → lives under the registered CPT.
        $fetched = WPSG_Layout_Templates::get( $bound_id );
        $this->assertIsArray( $fetched, 'Imported template must be retrievable via WPSG_Layout_Templates::get().' );

        // The unregistered post type must never be created.
        $orphans = get_posts( [ 'post_type' => 'wpsg_layout_template', 'post_status' => 'any', 'posts_per_page' => -1 ] );
        $this->assertCount( 0, $orphans );
    }

    /**
     * G-4 regression: URL-only (JSON) media import writes `source: 'external'`,
     * not the historical `'url'` (which the frontend mislabeled as an upload).
     */
    public function test_import_campaign_media_source_is_external() {
        WPSG_CPT::register();

        $payload = $this->build_payload( [
            'media_references' => [
                [ 'id' => 'ref-1', 'url' => 'https://example.com/x.jpg', 'title' => 'X' ],
            ],
        ] );
        $request = new WP_REST_Request( 'POST', '/wp-super-gallery/v1/campaigns/import' );
        $request->set_body( wp_json_encode( $payload ) );
        $request->set_header( 'Content-Type', 'application/json' );

        $response = WPSG_Export_Controller::import_campaign( $request );
        $new_id   = $response->get_data()['id'];

        $media = get_post_meta( $new_id, 'media_items', true );
        $this->assertSame( 'external', $media[0]['source'] );
    }
}
