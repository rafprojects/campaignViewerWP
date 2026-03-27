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
        $this->assertEquals('default-dark', $settings['theme']);
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
        $this->assertEquals('default-dark', $sanitized['theme']);

        $input = ['theme' => 'default-light'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('default-light', $sanitized['theme']);

        $input = ['theme' => 'nord'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('nord', $sanitized['theme']);
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
        // Absent keys must not appear in the sanitized output — callers that
        // merge $sanitized over existing settings rely on this to avoid
        // inadvertently resetting values (e.g. the REST partial-update path).
        $input = [];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertArrayNotHasKey('enable_lightbox',   $sanitized);
        $this->assertArrayNotHasKey('enable_animations', $sanitized);

        // Truthy values = true.
        $input = [
            'enable_lightbox' => '1',
            'enable_animations' => 'yes',
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertTrue($sanitized['enable_lightbox']);
        $this->assertTrue($sanitized['enable_animations']);

        // Explicit falsy values = false.
        $input = [
            'enable_lightbox'   => '0',
            'enable_animations' => '',
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertFalse($sanitized['enable_lightbox']);
        $this->assertFalse($sanitized['enable_animations']);
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
     * Test sanitize_settings preserves nested gallery_config payloads.
     */
    public function test_sanitize_settings_handles_nested_gallery_config() {
        $input = [
            'gallery_config' => [
                'mode' => 'unified',
                'breakpoints' => [
                    'desktop' => [
                        'unified' => [
                            'adapterId' => 'masonry',
                            'common' => [
                                'sectionPadding' => 24,
                            ],
                            'adapterSettings' => [
                                'masonryColumns' => 4,
                            ],
                        ],
                    ],
                ],
            ],
        ];

        $sanitized = WPSG_Settings::sanitize_settings($input);

        $this->assertEquals('unified', $sanitized['gallery_config']['mode'] ?? null);
        $this->assertEquals('masonry', $sanitized['gallery_config']['breakpoints']['desktop']['unified']['adapterId'] ?? null);
        $this->assertEquals(24, $sanitized['gallery_config']['breakpoints']['desktop']['unified']['common']['sectionPadding'] ?? null);
        $this->assertEquals(4, $sanitized['gallery_config']['breakpoints']['desktop']['unified']['adapterSettings']['masonryColumns'] ?? null);
    }

    /**
     * Test shared global nested gallery sanitization applies field-level metadata rules.
     */
    public function test_sanitize_gallery_config_payload_applies_field_level_rules() {
        $defaults = WPSG_Settings::get_defaults();

        $sanitized = WPSG_Settings_Sanitizer::sanitize_gallery_config_payload([
            'mode' => 'per-type',
            'breakpoints' => [
                'desktop' => [
                    'image' => [
                        'common' => [
                            'sectionPadding' => 999,
                            'adapterMaxWidthPct' => 10,
                            'adapterJustifyContent' => 'invalid-option',
                            'galleryManualHeight' => 'calc(100vh)',
                            'perTypeSectionEqualHeight' => '1',
                            'theme' => 'nord',
                            'headline<script>' => '<b>Allowed</b>',
                        ],
                        'adapterSettings' => [
                            'masonryColumns' => 99,
                            'layoutBuilderScope' => 'invalid-option',
                            'tileSize' => 10,
                            'tileGlowSpread' => 999,
                            'carouselAutoplayDirection' => 'invalid-option',
                            'modalTransition' => 'not-a-real-transition',
                            'customMarkup' => '<b>Keep</b>',
                        ],
                    ],
                ],
            ],
        ], $defaults['gallery_config']);

        $common = $sanitized['breakpoints']['desktop']['image']['common'] ?? [];
        $adapter_settings = $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? [];

        $this->assertEquals('per-type', $sanitized['mode'] ?? null);
        $this->assertEquals(60, $common['sectionPadding'] ?? null);
        $this->assertEquals(50, $common['adapterMaxWidthPct'] ?? null);
        $this->assertEquals('center', $common['adapterJustifyContent'] ?? null);
        $this->assertEquals('420px', $common['galleryManualHeight'] ?? null);
        $this->assertTrue($common['perTypeSectionEqualHeight'] ?? false);
        $this->assertArrayNotHasKey('theme', $common);
        $this->assertEquals('Allowed', $common['headlinescript'] ?? null);
        $this->assertEquals(8, $adapter_settings['masonryColumns'] ?? null);
        $this->assertEquals('full', $adapter_settings['layoutBuilderScope'] ?? null);
        $this->assertEquals(60, $adapter_settings['tileSize'] ?? null);
        $this->assertEquals(60, $adapter_settings['tileGlowSpread'] ?? null);
        $this->assertEquals('ltr', $adapter_settings['carouselAutoplayDirection'] ?? null);
        $this->assertArrayNotHasKey('modalTransition', $adapter_settings);
        $this->assertEquals('Keep', $adapter_settings['customMarkup'] ?? null);
    }

    /**
     * Test shared campaign gallery override sanitization reuses the nested gallery payload rules.
     */
    public function test_sanitize_gallery_overrides_handles_campaign_payloads() {
        $sanitized = WPSG_Settings_Sanitizer::sanitize_gallery_overrides(wp_json_encode([
            'mode' => 'per-type',
            'breakpoints' => [
                'desktop' => [
                    'image' => [
                        'adapterId' => 'not-a-real-adapter',
                        'common' => [
                            'sectionPadding' => 999,
                            'adapterMaxWidthPct' => 10,
                            'adapterJustifyContent' => 'invalid-option',
                            'galleryManualHeight' => 'calc(100vh)',
                            'theme' => 'nord',
                            'headline<script>' => '<b>Unsafe</b>',
                        ],
                        'adapterSettings' => [
                            'masonryColumns' => 99,
                            'layoutBuilderScope' => 'invalid-option',
                            'tileGlowSpread' => 999,
                            'carouselAutoplayDirection' => 'invalid-option',
                            'modalTransition' => 'not-a-real-transition',
                        ],
                    ],
                    'video' => [
                        'adapterId' => 'masonry',
                    ],
                ],
            ],
        ]));

        $this->assertEquals('per-type', $sanitized['mode'] ?? null);
        $this->assertArrayNotHasKey('adapterId', $sanitized['breakpoints']['desktop']['image'] ?? []);
        $this->assertEquals(60, $sanitized['breakpoints']['desktop']['image']['common']['sectionPadding'] ?? null);
        $this->assertEquals(50, $sanitized['breakpoints']['desktop']['image']['common']['adapterMaxWidthPct'] ?? null);
        $this->assertArrayNotHasKey('adapterJustifyContent', $sanitized['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertArrayNotHasKey('galleryManualHeight', $sanitized['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertArrayNotHasKey('theme', $sanitized['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertEquals('Unsafe', $sanitized['breakpoints']['desktop']['image']['common']['headlinescript'] ?? null);
        $this->assertEquals(8, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['masonryColumns'] ?? null);
        $this->assertArrayNotHasKey('layoutBuilderScope', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertEquals(60, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['tileGlowSpread'] ?? null);
        $this->assertArrayNotHasKey('carouselAutoplayDirection', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertArrayNotHasKey('modalTransition', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertEquals('masonry', $sanitized['breakpoints']['desktop']['video']['adapterId'] ?? null);
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
