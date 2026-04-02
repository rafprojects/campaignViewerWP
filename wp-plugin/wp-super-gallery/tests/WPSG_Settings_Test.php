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

        $input = ['theme' => 'github-light'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('github-light', $sanitized['theme']);

        $input = ['theme' => 'catppuccin-latte'];
        $sanitized = WPSG_Settings::sanitize_settings($input);
        $this->assertEquals('catppuccin-latte', $sanitized['theme']);
    }

    /**
     * Test deprecated flat gallery settings still sanitize through the generic handler.
     */
    public function test_sanitize_settings_legacy_gallery_fields_use_generic_handler() {
        $defaults = WPSG_Settings::get_defaults();

        $input = [
            'image_gallery_adapter_id' => 'masonry',
            'gallery_selection_mode' => 'per-breakpoint',
            'grid_card_width' => 999,
            'tile_glow_color' => '<b>#112233</b>',
            'gallery_manual_height' => 'calc(100vh)',
        ];

        $sanitized = WPSG_Settings::sanitize_settings($input);

        $this->assertEquals('masonry', $sanitized['image_gallery_adapter_id']);
        $this->assertEquals('per-breakpoint', $sanitized['gallery_selection_mode']);
        $this->assertEquals(400, $sanitized['grid_card_width']);
        $this->assertEquals('#112233', $sanitized['tile_glow_color']);
        $this->assertEquals($defaults['gallery_manual_height'], $sanitized['gallery_manual_height']);
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
        // With no stored option, absent keys should not be synthesized into the
        // sanitized output.
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
     * Test partial classic admin saves preserve the stored nested gallery config.
     */
    public function test_sanitize_settings_preserves_gallery_config_on_partial_admin_save() {
        update_option(WPSG_Settings::OPTION_NAME, [
            'theme' => 'default-dark',
            'gallery_config' => [
                'mode' => 'unified',
                'breakpoints' => [
                    'desktop' => [
                        'unified' => [
                            'adapterId' => 'masonry',
                        ],
                    ],
                ],
            ],
        ]);

        $sanitized = WPSG_Settings::sanitize_settings([
            'theme' => 'nord',
        ]);

        $this->assertEquals('nord', $sanitized['theme']);
        $this->assertEquals('unified', $sanitized['gallery_config']['mode'] ?? null);
        $this->assertEquals('masonry', $sanitized['gallery_config']['breakpoints']['desktop']['unified']['adapterId'] ?? null);
    }

    /**
     * Test explicit hidden checkbox values persist false in the classic admin flow.
     */
    public function test_sanitize_settings_persists_false_for_classic_checkbox_hidden_inputs() {
        update_option(WPSG_Settings::OPTION_NAME, [
            'enable_lightbox' => true,
            'enable_animations' => true,
            'allow_user_theme_override' => true,
            'gallery_config' => [
                'mode' => 'unified',
            ],
        ]);

        $sanitized = WPSG_Settings::sanitize_settings([
            'enable_lightbox' => '0',
            'enable_animations' => '0',
            'allow_user_theme_override' => '0',
        ]);

        $this->assertFalse($sanitized['enable_lightbox']);
        $this->assertFalse($sanitized['enable_animations']);
        $this->assertFalse($sanitized['allow_user_theme_override']);
        $this->assertEquals('unified', $sanitized['gallery_config']['mode'] ?? null);
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
                                'viewportBgType' => 'solid',
                                'viewportBgColor' => '#112233',
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
        $this->assertEquals('solid', $sanitized['gallery_config']['breakpoints']['desktop']['unified']['common']['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $sanitized['gallery_config']['breakpoints']['desktop']['unified']['common']['viewportBgColor'] ?? null);
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
                            'viewportBgType' => 'solid',
                            'viewportBgColor' => '<b>#112233</b>',
                            'viewportBgGradient' => '<b>linear-gradient(135deg, #111111 0%, #222222 100%)</b>',
                            'viewportBgImageUrl' => 'https://example.com/image-bg.jpg',
                            'perTypeSectionEqualHeight' => '1',
                            'galleryImageLabel' => '<b>Photos</b>',
                            'galleryVideoLabel' => '<i>Clips</i>',
                            'galleryLabelJustification' => 'invalid-option',
                            'showGalleryLabelIcon' => '1',
                            'showCampaignGalleryLabels' => '0',
                            'theme' => 'nord',
                            'headline<script>' => '<b>Allowed</b>',
                        ],
                        'adapterSettings' => [
                            'masonryColumns' => 99,
                            'imageViewportHeight' => 9999,
                            'videoBorderRadius' => 99,
                            'thumbnailGap' => 99,
                            'navArrowPosition' => 'bottom',
                            'navArrowSize' => 999,
                            'dotNavShape' => 'triangle',
                            'dotNavActiveScale' => 9,
                            'imageShadowPreset' => 'custom',
                            'imageShadowCustom' => '<b>0 0 12px rgba(0,0,0,0.4)</b>',
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
        $this->assertEquals('solid', $common['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $common['viewportBgColor'] ?? null);
        $this->assertEquals('linear-gradient(135deg, #111111 0%, #222222 100%)', $common['viewportBgGradient'] ?? null);
        $this->assertEquals('https://example.com/image-bg.jpg', $common['viewportBgImageUrl'] ?? null);
        $this->assertTrue($common['perTypeSectionEqualHeight'] ?? false);
        $this->assertEquals('Photos', $common['galleryImageLabel'] ?? null);
        $this->assertEquals('Clips', $common['galleryVideoLabel'] ?? null);
        $this->assertEquals('left', $common['galleryLabelJustification'] ?? null);
        $this->assertTrue($common['showGalleryLabelIcon'] ?? false);
        $this->assertFalse($common['showCampaignGalleryLabels'] ?? true);
        $this->assertArrayNotHasKey('theme', $common);
        $this->assertEquals('Allowed', $common['headlinescript'] ?? null);
        $this->assertEquals(8, $adapter_settings['masonryColumns'] ?? null);
        $this->assertEquals(900, $adapter_settings['imageViewportHeight'] ?? null);
        $this->assertEquals(48, $adapter_settings['videoBorderRadius'] ?? null);
        $this->assertEquals(24, $adapter_settings['thumbnailGap'] ?? null);
        $this->assertEquals('bottom', $adapter_settings['navArrowPosition'] ?? null);
        $this->assertEquals(64, $adapter_settings['navArrowSize'] ?? null);
        $this->assertEquals('circle', $adapter_settings['dotNavShape'] ?? null);
        $this->assertEquals(2.0, $adapter_settings['dotNavActiveScale'] ?? null);
        $this->assertEquals('custom', $adapter_settings['imageShadowPreset'] ?? null);
        $this->assertEquals('0 0 12px rgba(0,0,0,0.4)', $adapter_settings['imageShadowCustom'] ?? null);
        $this->assertEquals('full', $adapter_settings['layoutBuilderScope'] ?? null);
        $this->assertEquals(60, $adapter_settings['tileSize'] ?? null);
        $this->assertEquals(60, $adapter_settings['tileGlowSpread'] ?? null);
        $this->assertEquals('ltr', $adapter_settings['carouselAutoplayDirection'] ?? null);
        $this->assertArrayNotHasKey('modalTransition', $adapter_settings);
        $this->assertEquals('Keep', $adapter_settings['customMarkup'] ?? null);
    }

    /**
     * Test invalid nested scalar/color values are rejected for global gallery config payloads.
     */
    public function test_sanitize_gallery_config_payload_rejects_invalid_nested_scalar_and_color_values() {
        $defaults = WPSG_Settings::get_defaults();

        $sanitized = WPSG_Settings_Sanitizer::sanitize_gallery_config_payload([
            'mode' => 'per-type',
            'breakpoints' => [
                'desktop' => [
                    'image' => [
                        'common' => [
                            'viewportBgColor' => 'bad color',
                            'viewportBgImageUrl' => ['https://example.com/not-allowed.jpg'],
                        ],
                        'adapterSettings' => [
                            'tileGlowColor' => 'bad color',
                            'masonryAutoColumnBreakpoints' => ['480:2'],
                        ],
                    ],
                ],
            ],
        ], $defaults['gallery_config']);

        $common = $sanitized['breakpoints']['desktop']['image']['common'] ?? [];
        $adapter_settings = $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? [];

        $this->assertEquals($defaults['image_bg_color'], $common['viewportBgColor'] ?? null);
        $this->assertEquals($defaults['image_bg_image_url'], $common['viewportBgImageUrl'] ?? null);
        $this->assertEquals($defaults['tile_glow_color'], $adapter_settings['tileGlowColor'] ?? null);
        $this->assertEquals($defaults['masonry_auto_column_breakpoints'], $adapter_settings['masonryAutoColumnBreakpoints'] ?? null);
    }

    /**
     * Test invalid nested scalar/color values are rejected for campaign overrides.
     */
    public function test_sanitize_gallery_overrides_rejects_invalid_nested_scalar_and_color_values() {
        $sanitized = WPSG_Settings_Sanitizer::sanitize_gallery_overrides([
            'mode' => 'per-type',
            'breakpoints' => [
                'desktop' => [
                    'image' => [
                        'common' => [
                            'viewportBgColor' => 'bad color',
                            'viewportBgImageUrl' => ['https://example.com/not-allowed.jpg'],
                        ],
                        'adapterSettings' => [
                            'tileGlowColor' => 'bad color',
                            'masonryAutoColumnBreakpoints' => ['480:2'],
                        ],
                    ],
                ],
            ],
        ]);

        $common = $sanitized['breakpoints']['desktop']['image']['common'] ?? [];
        $adapter_settings = $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? [];

        $this->assertArrayNotHasKey('viewportBgColor', $common);
        $this->assertArrayNotHasKey('viewportBgImageUrl', $common);
        $this->assertArrayNotHasKey('tileGlowColor', $adapter_settings);
        $this->assertArrayNotHasKey('masonryAutoColumnBreakpoints', $adapter_settings);
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
                            'viewportBgType' => 'solid',
                            'viewportBgColor' => '<b>#112233</b>',
                            'viewportBgGradient' => '<b>linear-gradient(135deg, #111111 0%, #222222 100%)</b>',
                            'viewportBgImageUrl' => 'https://example.com/image-bg.jpg',
                            'galleryImageLabel' => '<b>Photos</b>',
                            'galleryVideoLabel' => '<i>Clips</i>',
                            'galleryLabelJustification' => 'invalid-option',
                            'showGalleryLabelIcon' => '1',
                            'showCampaignGalleryLabels' => '0',
                            'theme' => 'nord',
                            'headline<script>' => '<b>Unsafe</b>',
                        ],
                        'adapterSettings' => [
                            'imageViewportHeight' => 9999,
                            'videoBorderRadius' => 99,
                            'thumbnailGap' => 99,
                            'masonryAutoColumnBreakpoints' => '<b>480:2,768:3,1024:4,1280:5</b>',
                            'navArrowPosition' => 'invalid-option',
                            'navArrowSize' => 999,
                            'dotNavMaxVisibleDots' => 99,
                            'navArrowEdgeInset' => 999,
                            'navArrowMinHitTarget' => 5,
                            'navArrowFadeDurationMs' => 5000,
                            'navArrowScaleTransitionMs' => -1,
                            'viewportHeightMobileRatio' => 2,
                            'viewportHeightTabletRatio' => 0.1,
                            'dotNavShape' => 'triangle',
                            'dotNavActiveScale' => 9,
                            'imageShadowPreset' => 'invalid-option',
                            'imageShadowCustom' => '<b>0 0 12px rgba(0,0,0,0.4)</b>',
                            'modalTransition' => 'not-a-real-transition',
                        ],
                    ],
                    'video' => [
                        'adapterId' => 'classic',
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
        $this->assertEquals('solid', $sanitized['breakpoints']['desktop']['image']['common']['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $sanitized['breakpoints']['desktop']['image']['common']['viewportBgColor'] ?? null);
        $this->assertEquals('linear-gradient(135deg, #111111 0%, #222222 100%)', $sanitized['breakpoints']['desktop']['image']['common']['viewportBgGradient'] ?? null);
        $this->assertEquals('https://example.com/image-bg.jpg', $sanitized['breakpoints']['desktop']['image']['common']['viewportBgImageUrl'] ?? null);
        $this->assertEquals('Photos', $sanitized['breakpoints']['desktop']['image']['common']['galleryImageLabel'] ?? null);
        $this->assertEquals('Clips', $sanitized['breakpoints']['desktop']['image']['common']['galleryVideoLabel'] ?? null);
        $this->assertArrayNotHasKey('galleryLabelJustification', $sanitized['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertTrue($sanitized['breakpoints']['desktop']['image']['common']['showGalleryLabelIcon'] ?? false);
        $this->assertFalse($sanitized['breakpoints']['desktop']['image']['common']['showCampaignGalleryLabels'] ?? true);
        $this->assertArrayNotHasKey('theme', $sanitized['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertEquals('Unsafe', $sanitized['breakpoints']['desktop']['image']['common']['headlinescript'] ?? null);
        $this->assertEquals(900, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['imageViewportHeight'] ?? null);
        $this->assertEquals(48, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['videoBorderRadius'] ?? null);
        $this->assertEquals(24, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['thumbnailGap'] ?? null);
        $this->assertEquals('480:2,768:3,1024:4,1280:5', $sanitized['breakpoints']['desktop']['image']['adapterSettings']['masonryAutoColumnBreakpoints'] ?? null);
        $this->assertArrayNotHasKey('navArrowPosition', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertEquals(64, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['navArrowSize'] ?? null);
        $this->assertEquals(20, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['dotNavMaxVisibleDots'] ?? null);
        $this->assertEquals(48, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['navArrowEdgeInset'] ?? null);
        $this->assertEquals(24, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['navArrowMinHitTarget'] ?? null);
        $this->assertEquals(1000, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['navArrowFadeDurationMs'] ?? null);
        $this->assertEquals(0, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['navArrowScaleTransitionMs'] ?? null);
        $this->assertEquals(1.0, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['viewportHeightMobileRatio'] ?? null);
        $this->assertEquals(0.3, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['viewportHeightTabletRatio'] ?? null);
        $this->assertArrayNotHasKey('dotNavShape', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertEquals(2.0, $sanitized['breakpoints']['desktop']['image']['adapterSettings']['dotNavActiveScale'] ?? null);
        $this->assertArrayNotHasKey('imageShadowPreset', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertEquals('0 0 12px rgba(0,0,0,0.4)', $sanitized['breakpoints']['desktop']['image']['adapterSettings']['imageShadowCustom'] ?? null);
        $this->assertArrayNotHasKey('modalTransition', $sanitized['breakpoints']['desktop']['image']['adapterSettings'] ?? []);
        $this->assertEquals('classic', $sanitized['breakpoints']['desktop']['video']['adapterId'] ?? null);
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
