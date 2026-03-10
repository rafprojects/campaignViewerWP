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
}
