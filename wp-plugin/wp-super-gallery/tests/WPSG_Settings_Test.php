<?php
/**
 * Tests for WPSG_Settings class.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Settings_Test extends WP_UnitTestCase {

    /**
     * Clean up after each test.
     */
    public function tearDown(): void {
        delete_option(WPSG_Settings::OPTION_NAME);
        parent::tearDown();
    }

    /**
     * Test that get_settings returns defaults when no options are saved.
     */
    public function test_get_settings_returns_defaults() {
        delete_option(WPSG_Settings::OPTION_NAME);

        $settings = WPSG_Settings::get_settings();

        $this->assertEquals('wp-jwt', $settings['auth_provider']);
        $this->assertEquals('', $settings['api_base']);
        $this->assertEquals('dark', $settings['theme']);
        $this->assertEquals('grid', $settings['gallery_layout']);
        $this->assertEquals(12, $settings['items_per_page']);
        $this->assertTrue($settings['enable_lightbox']);
        $this->assertTrue($settings['enable_animations']);
        $this->assertEquals(3600, $settings['cache_ttl']);
    }

    /**
     * Test that get_setting returns individual values correctly.
     */
    public function test_get_setting_returns_individual_value() {
        update_option(WPSG_Settings::OPTION_NAME, [
            'theme' => 'light',
            'items_per_page' => 24,
        ]);

        $this->assertEquals('light', WPSG_Settings::get_setting('theme'));
        $this->assertEquals(24, WPSG_Settings::get_setting('items_per_page'));
        // Unset value should return default.
        $this->assertEquals('wp-jwt', WPSG_Settings::get_setting('auth_provider'));
    }

    /**
     * Test that get_setting respects custom default.
     */
    public function test_get_setting_respects_custom_default() {
        delete_option(WPSG_Settings::OPTION_NAME);

        $value = WPSG_Settings::get_setting('nonexistent_key', 'custom_default');
        $this->assertEquals('custom_default', $value);
    }

    /**
     * Test sanitize_settings validates auth_provider.
     */
    public function test_sanitize_settings_validates_auth_provider() {
        $input = ['auth_provider' => 'invalid-provider'];
        $sanitized = WPSG_Settings::sanitize_settings($input);

        // Should fall back to default.
        $this->assertEquals('wp-jwt', $sanitized['auth_provider']);

        // Valid values should pass.
        $input = ['auth_provider' => 'none'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('none', $sanitized['auth_provider']);
    }

    /**
     * Test sanitize_settings validates theme option.
     */
    public function test_sanitize_settings_validates_theme() {
        $input = ['theme' => 'invalid-theme'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('dark', $sanitized['theme']);

        $input = ['theme' => 'light'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('light', $sanitized['theme']);

        $input = ['theme' => 'auto'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('auto', $sanitized['theme']);
    }

    /**
     * Test sanitize_settings validates gallery_layout.
     */
    public function test_sanitize_settings_validates_gallery_layout() {
        $input = ['gallery_layout' => 'invalid'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('grid', $sanitized['gallery_layout']);

        $input = ['gallery_layout' => 'masonry'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('masonry', $sanitized['gallery_layout']);
    }

    /**
     * Test sanitize_settings clamps items_per_page to valid range.
     */
    public function test_sanitize_settings_clamps_items_per_page() {
        // Below minimum.
        $input = ['items_per_page' => 0];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals(1, $sanitized['items_per_page']);

        // Above maximum.
        $input = ['items_per_page' => 500];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals(100, $sanitized['items_per_page']);

        // Valid value.
        $input = ['items_per_page' => 25];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals(25, $sanitized['items_per_page']);
    }

    /**
     * Test sanitize_settings handles boolean fields.
     */
    public function test_sanitize_settings_handles_booleans() {
        // Empty values = false.
        $input = [];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertFalse($sanitized['enable_lightbox']);
        $this->assertFalse($sanitized['enable_animations']);

        // Truthy values = true.
        $input = [
            'enable_lightbox' => '1',
            'enable_animations' => 'yes',
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertTrue($sanitized['enable_lightbox']);
        $this->assertTrue($sanitized['enable_animations']);
    }

    /**
     * Test sanitize_settings sanitizes api_base URL.
     */
    public function test_sanitize_settings_sanitizes_api_base() {
        $input = ['api_base' => '  https://example.com/api  '];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('https://example.com/api', $sanitized['api_base']);

        // Empty is allowed.
        $input = ['api_base' => ''];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('', $sanitized['api_base']);
    }

    /**
     * Test sanitize_settings clamps cache_ttl to valid range.
     */
    public function test_sanitize_settings_clamps_cache_ttl() {
        // Negative value.
        $input = ['cache_ttl' => -100];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals(0, $sanitized['cache_ttl']);

        // Above maximum (1 week).
        $input = ['cache_ttl' => 999999999];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals(604800, $sanitized['cache_ttl']);

        // Valid value.
        $input = ['cache_ttl' => 3600];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals(3600, $sanitized['cache_ttl']);
    }

    /**
     * Test filter_auth_provider returns setting value.
     */
    public function test_filter_auth_provider_returns_setting() {
        update_option(WPSG_Settings::OPTION_NAME, ['auth_provider' => 'none']);

        $result = WPSG_Settings::filter_auth_provider('wp-jwt');
        $this->assertEquals('none', $result);
    }

    /**
     * Test filter_api_base returns setting or falls back to default.
     */
    public function test_filter_api_base_returns_setting_or_default() {
        // Empty api_base should return the passed default.
        delete_option(WPSG_Settings::OPTION_NAME);
        $result = WPSG_Settings::filter_api_base('https://default.com');
        $this->assertEquals('https://default.com', $result);

        // Non-empty api_base should override.
        update_option(WPSG_Settings::OPTION_NAME, ['api_base' => 'https://custom.com']);
        $result = WPSG_Settings::filter_api_base('https://default.com');
        $this->assertEquals('https://custom.com', $result);
    }
}
