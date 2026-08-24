<?php
/**
 * Tests for CSS value sanitization (P20-C).
 *
 * Validates WPSG_Layout_Templates::sanitize_css_value() against both
 * legitimate CSS values and known injection vectors.
 *
 * @package WP_Super_Gallery
 * @since   0.18.0
 */

class WPSG_CSS_Sanitization_Test extends WP_UnitTestCase {

    // ── Color type ────────────────────────────────────────

    public function test_color_allows_hex_3() {
        $this->assertEquals( '#f00', WPSG_Layout_Templates::sanitize_css_value( '#f00', 'color' ) );
    }

    public function test_color_allows_hex_6() {
        $this->assertEquals( '#ff0000', WPSG_Layout_Templates::sanitize_css_value( '#ff0000', 'color' ) );
    }

    public function test_color_allows_hex_8() {
        $this->assertEquals( '#ff0000cc', WPSG_Layout_Templates::sanitize_css_value( '#ff0000cc', 'color' ) );
    }

    public function test_color_allows_rgb() {
        $this->assertEquals( 'rgb(255, 0, 0)', WPSG_Layout_Templates::sanitize_css_value( 'rgb(255, 0, 0)', 'color' ) );
    }

    public function test_color_allows_rgba() {
        $this->assertEquals( 'rgba(255, 0, 0, 0.5)', WPSG_Layout_Templates::sanitize_css_value( 'rgba(255, 0, 0, 0.5)', 'color' ) );
    }

    public function test_color_allows_hsl() {
        $this->assertEquals( 'hsl(120, 100%, 50%)', WPSG_Layout_Templates::sanitize_css_value( 'hsl(120, 100%, 50%)', 'color' ) );
    }

    public function test_color_allows_named_color() {
        $this->assertEquals( 'red', WPSG_Layout_Templates::sanitize_css_value( 'red', 'color' ) );
        $this->assertEquals( 'cornflowerblue', WPSG_Layout_Templates::sanitize_css_value( 'cornflowerblue', 'color' ) );
    }

    public function test_color_allows_transparent() {
        $this->assertEquals( 'transparent', WPSG_Layout_Templates::sanitize_css_value( 'transparent', 'color' ) );
    }

    public function test_color_allows_currentColor() {
        $this->assertEquals( 'currentColor', WPSG_Layout_Templates::sanitize_css_value( 'currentColor', 'color' ) );
    }

    public function test_color_rejects_url_injection() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'red; background-image: url(https://evil.com)', 'color' ) );
    }

    public function test_color_rejects_expression() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'expression(alert(1))', 'color' ) );
    }

    public function test_color_rejects_javascript_uri() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'javascript:alert(1)', 'color' ) );
    }

    public function test_color_rejects_semicolon_breakout() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'red; } body { display:none } .x {', 'color' ) );
    }

    // ── Clip-path type ────────────────────────────────────

    public function test_clip_path_allows_none() {
        $this->assertEquals( 'none', WPSG_Layout_Templates::sanitize_css_value( 'none', 'clip-path' ) );
    }

    public function test_clip_path_allows_polygon() {
        $value = 'polygon(50% 0%, 100% 100%, 0% 100%)';
        $this->assertEquals( $value, WPSG_Layout_Templates::sanitize_css_value( $value, 'clip-path' ) );
    }

    public function test_clip_path_allows_circle() {
        $value = 'circle(50% at 50% 50%)';
        $this->assertEquals( $value, WPSG_Layout_Templates::sanitize_css_value( $value, 'clip-path' ) );
    }

    public function test_clip_path_allows_ellipse() {
        $value = 'ellipse(50% 25% at 50% 50%)';
        $this->assertEquals( $value, WPSG_Layout_Templates::sanitize_css_value( $value, 'clip-path' ) );
    }

    public function test_clip_path_allows_inset() {
        $value = 'inset(10% 20% 30% 40%)';
        $this->assertEquals( $value, WPSG_Layout_Templates::sanitize_css_value( $value, 'clip-path' ) );
    }

    public function test_clip_path_rejects_url_function() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'url(#myClip)', 'clip-path' ) );
    }

    public function test_clip_path_rejects_expression() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'expression(alert(1))', 'clip-path' ) );
    }

    public function test_clip_path_rejects_unbalanced_parens() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'polygon(50% 0%, 100% 100%', 'clip-path' ) );
    }

    // ── Position type ─────────────────────────────────────

    public function test_position_allows_center() {
        $this->assertEquals( 'center', WPSG_Layout_Templates::sanitize_css_value( 'center', 'position' ) );
    }

    public function test_position_allows_keyword() {
        $this->assertEquals( 'top', WPSG_Layout_Templates::sanitize_css_value( 'top', 'position' ) );
        $this->assertEquals( 'bottom', WPSG_Layout_Templates::sanitize_css_value( 'bottom', 'position' ) );
        $this->assertEquals( 'left', WPSG_Layout_Templates::sanitize_css_value( 'left', 'position' ) );
        $this->assertEquals( 'right', WPSG_Layout_Templates::sanitize_css_value( 'right', 'position' ) );
    }

    public function test_position_allows_percentage() {
        $this->assertEquals( '50%', WPSG_Layout_Templates::sanitize_css_value( '50%', 'position' ) );
    }

    public function test_position_allows_two_percentages() {
        $this->assertEquals( '50% 50%', WPSG_Layout_Templates::sanitize_css_value( '50% 50%', 'position' ) );
    }

    public function test_position_allows_px_values() {
        $this->assertEquals( '10px', WPSG_Layout_Templates::sanitize_css_value( '10px', 'position' ) );
    }

    public function test_position_allows_em_values() {
        $this->assertEquals( '2.5em', WPSG_Layout_Templates::sanitize_css_value( '2.5em', 'position' ) );
    }

    public function test_position_rejects_url_injection() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'center; background-image: url(evil.com)', 'position' ) );
    }

    public function test_position_rejects_expression() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'expression(document.cookie)', 'position' ) );
    }

    // ── Universal blocklist ───────────────────────────────

    public function test_blocks_backslash_escape() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( '\\75 rl(evil.com)', 'color' ) );
    }

    public function test_blocks_at_import() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( '@import url(evil.css)', 'generic' ) );
    }

    public function test_blocks_behavior_property() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'behavior: url(script.htc)', 'generic' ) );
    }

    public function test_blocks_moz_binding() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( '-moz-binding: url(xbl.xml#xss)', 'generic' ) );
    }

    public function test_blocks_var_function() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( 'var(--evil)', 'color' ) );
    }

    // ── Generic type ──────────────────────────────────────

    public function test_generic_passes_safe_text() {
        $this->assertEquals( 'Untitled Layout', WPSG_Layout_Templates::sanitize_css_value( 'Untitled Layout', 'generic' ) );
    }

    public function test_generic_strips_html_tags() {
        $this->assertEquals( 'bold', WPSG_Layout_Templates::sanitize_css_value( '<b>bold</b>', 'generic' ) );
    }

    // ── Edge cases ────────────────────────────────────────

    public function test_empty_string_returns_empty() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( '', 'color' ) );
    }

    public function test_whitespace_only_returns_empty() {
        $this->assertEquals( '', WPSG_Layout_Templates::sanitize_css_value( '   ', 'color' ) );
    }

    public function test_trims_whitespace_from_valid_value() {
        $this->assertEquals( '#ff0000', WPSG_Layout_Templates::sanitize_css_value( '  #ff0000  ', 'color' ) );
    }
}
