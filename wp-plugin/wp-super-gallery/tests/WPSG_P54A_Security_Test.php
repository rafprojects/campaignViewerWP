<?php
/**
 * P54-A security hardening tests — box-shadow sanitizer.
 *
 * Exercises the `image_shadow_custom` / `video_shadow_custom` sanitization
 * path via the public gallery-overrides API. Values land in React inline
 * style objects on the front end (no concatenated stylesheet string), so
 * the PHP layer is defence-in-depth: it must reject CSS injection vectors
 * while accepting valid box-shadow strings.
 *
 * @package WP_Super_Gallery
 * @since   0.55.0
 */
class WPSG_P54A_Security_Test extends WP_UnitTestCase {

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Build a minimal gallery-overrides payload containing one adapterSetting.
     *
     * @param string $camel_key  camelCase key (e.g. 'imageShadowCustom').
     * @param mixed  $value      Value to test.
     * @return array             Sanitized result from sanitize_gallery_overrides().
     */
    private function sanitize_adapter_setting( $camel_key, $value ) {
        $raw = [
            'breakpoints' => [
                'desktop' => [
                    'unified' => [
                        'adapterSettings' => [
                            $camel_key => $value,
                        ],
                    ],
                ],
            ],
        ];
        return WPSG_Settings_Sanitizer::sanitize_gallery_overrides( $raw );
    }

    /**
     * Extract the sanitized adapter setting value from the result, or null if absent.
     *
     * @param array  $result    Return value of sanitize_gallery_overrides().
     * @param string $camel_key camelCase key that was set.
     * @return mixed
     */
    private function extract_adapter_value( $result, $camel_key ) {
        return $result['breakpoints']['desktop']['unified']['adapterSettings'][ $camel_key ] ?? null;
    }

    // ── image_shadow_custom — valid values ───────────────────────────────────

    public function test_image_shadow_custom_accepts_none() {
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', 'none' );
        $this->assertEquals( 'none', $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_accepts_standard_shadow() {
        $value  = '0 2px 8px rgba(0,0,0,0.15)';
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', $value );
        $this->assertEquals( $value, $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_accepts_multiple_layers() {
        $value  = '0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.20)';
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', $value );
        $this->assertEquals( $value, $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_accepts_inset_shadow() {
        $value  = 'inset 0 2px 4px rgba(0,0,0,0.06)';
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', $value );
        $this->assertEquals( $value, $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    // ── image_shadow_custom — injection payloads ─────────────────────────────

    public function test_image_shadow_custom_rejects_closing_brace() {
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', '0 2px 8px red}body{display:none' );
        $this->assertNull( $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_rejects_semicolon_breakout() {
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', '0 2px 8px red; color:red' );
        $this->assertNull( $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_rejects_url_function() {
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', 'url(https://evil.com/steal)' );
        $this->assertNull( $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_rejects_expression() {
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', 'expression(alert(1))' );
        $this->assertNull( $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    public function test_image_shadow_custom_rejects_at_import() {
        $result = $this->sanitize_adapter_setting( 'imageShadowCustom', '@import url(evil.css)' );
        $this->assertNull( $this->extract_adapter_value( $result, 'imageShadowCustom' ) );
    }

    // ── video_shadow_custom mirrors same rules ────────────────────────────────

    public function test_video_shadow_custom_accepts_standard_shadow() {
        $value  = '0 4px 16px rgba(0,0,0,0.25)';
        $result = $this->sanitize_adapter_setting( 'videoShadowCustom', $value );
        $this->assertEquals( $value, $this->extract_adapter_value( $result, 'videoShadowCustom' ) );
    }

    public function test_video_shadow_custom_rejects_closing_brace() {
        $result = $this->sanitize_adapter_setting( 'videoShadowCustom', '0 2px 8px red}' );
        $this->assertNull( $this->extract_adapter_value( $result, 'videoShadowCustom' ) );
    }

    public function test_video_shadow_custom_rejects_url_with_spaces() {
        $result = $this->sanitize_adapter_setting( 'videoShadowCustom', 'url  (https://evil.com)' );
        $this->assertNull( $this->extract_adapter_value( $result, 'videoShadowCustom' ) );
    }
}
