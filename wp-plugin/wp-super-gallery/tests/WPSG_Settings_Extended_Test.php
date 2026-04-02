<?php

/**
 * Extended Settings tests covering utility methods and filters.
 */
class WPSG_Settings_Extended_Test extends WP_UnitTestCase {

    // ── snake_to_camel ─────────────────────────────────────────────────────

    public function test_snake_to_camel_basic() {
        $this->assertEquals('videoViewportHeight', WPSG_Settings::snake_to_camel('video_viewport_height'));
    }

    public function test_snake_to_camel_single_word() {
        $this->assertEquals('theme', WPSG_Settings::snake_to_camel('theme'));
    }

    public function test_snake_to_camel_two_words() {
        $this->assertEquals('authProvider', WPSG_Settings::snake_to_camel('auth_provider'));
    }

    // ── get_defaults ───────────────────────────────────────────────────────

    public function test_get_defaults_returns_array() {
        $defaults = WPSG_Settings::get_defaults();
        $this->assertIsArray($defaults);
        $this->assertNotEmpty($defaults);
    }

    public function test_get_defaults_has_auth_provider() {
        $defaults = WPSG_Settings::get_defaults();
        $this->assertArrayHasKey('auth_provider', $defaults);
    }

    // ── get_setting ────────────────────────────────────────────────────────

    public function test_get_setting_returns_default_for_missing() {
        $val = WPSG_Settings::get_setting('nonexistent_key_xyz', 'fallback');
        $this->assertEquals('fallback', $val);
    }

    public function test_get_setting_returns_stored_value() {
        $settings = WPSG_Settings::get_settings();
        $settings['theme'] = 'dark-mode-custom';
        update_option('wpsg_settings', $settings);

        $val = WPSG_Settings::get_setting('theme');
        $this->assertEquals('dark-mode-custom', $val);

        // Restore.
        delete_option('wpsg_settings');
    }

    // ── to_js ──────────────────────────────────────────────────────────────

    public function test_to_js_returns_camel_case_keys() {
        $settings = WPSG_Settings::get_settings();
        $js = WPSG_Settings::to_js($settings, true);

        $this->assertIsArray($js);
        // Verify at least one camelCase conversion (auth_provider is admin-only).
        $this->assertArrayHasKey('authProvider', $js);
    }

    public function test_to_js_excludes_admin_fields_when_not_admin() {
        $settings = WPSG_Settings::get_settings();
        $public = WPSG_Settings::to_js($settings, false);
        $admin = WPSG_Settings::to_js($settings, true);

        // Admin version should have >= as many keys as public.
        $this->assertGreaterThanOrEqual(count($public), count($admin));
    }

    // ── from_js ────────────────────────────────────────────────────────────

    public function test_from_js_converts_camel_to_snake() {
        $body = ['authProvider' => 'jwt', 'theme' => 'modern'];
        $result = WPSG_Settings::from_js($body);

        $this->assertArrayHasKey('auth_provider', $result);
        $this->assertEquals('jwt', $result['auth_provider']);
    }

    public function test_from_js_ignores_unknown_keys() {
        $body = ['unknownCamelKey' => 'test'];
        $result = WPSG_Settings::from_js($body);

        $this->assertArrayNotHasKey('unknown_camel_key', $result);
    }

    public function test_from_js_includes_gallery_config_payload() {
        $body = [
            'galleryConfig' => [
                'mode' => 'unified',
            ],
        ];
        $result = WPSG_Settings::from_js($body);

        $this->assertArrayHasKey('gallery_config', $result);
        $this->assertEquals('unified', $result['gallery_config']['mode'] ?? null);
    }

    // ── filter_auth_provider ───────────────────────────────────────────────

    public function test_filter_auth_provider_returns_stored_value() {
        update_option('wpsg_settings', ['auth_provider' => 'jwt']);
        $result = WPSG_Settings::filter_auth_provider('cookie');
        $this->assertEquals('jwt', $result);
        delete_option('wpsg_settings');
    }

    // ── filter_api_base ────────────────────────────────────────────────────

    public function test_filter_api_base_returns_default_when_empty() {
        delete_option('wpsg_settings');
        $result = WPSG_Settings::filter_api_base('http://default.test');
        // Should return the stored or default API base.
        $this->assertIsString($result);
    }

    // ── get_settings ───────────────────────────────────────────────────────

    public function test_get_settings_merges_with_defaults() {
        delete_option('wpsg_settings');
        $settings = WPSG_Settings::get_settings();

        $defaults = WPSG_Settings::get_defaults();
        foreach ($defaults as $key => $val) {
            $this->assertArrayHasKey($key, $settings, "Missing default key: $key");
        }
    }

    public function test_get_settings_bridges_gallery_config_back_to_legacy_fields() {
        update_option('wpsg_settings', [
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
                        ],
                    ],
                ],
            ],
        ]);

        $settings = WPSG_Settings::get_settings();

        $this->assertTrue($settings['unified_gallery_enabled'] ?? false);
        $this->assertEquals('masonry', $settings['unified_gallery_adapter_id'] ?? null);
        $this->assertEquals('unified', $settings['gallery_selection_mode'] ?? null);
        $this->assertEquals(24, $settings['gallery_section_padding'] ?? null);
        $this->assertEquals('solid', $settings['unified_bg_type'] ?? null);
        $this->assertEquals('#112233', $settings['unified_bg_color'] ?? null);
    }

    // ── sanitize_settings ──────────────────────────────────────────────────

    public function test_sanitize_settings_rejects_invalid_auth_provider() {
        $result = WPSG_Settings::sanitize_settings(['auth_provider' => 'hacked']);
        // Should either not include it or default to a valid value.
        if (isset($result['auth_provider'])) {
            $this->assertNotEquals('hacked', $result['auth_provider']);
        } else {
            $this->assertArrayNotHasKey('auth_provider', $result);
        }
    }

    public function test_sanitize_settings_sanitizes_numeric_fields() {
        $result = WPSG_Settings::sanitize_settings([
            'items_per_page' => 'not-a-number',
            'cache_ttl'      => '-5',
        ]);

        if (isset($result['items_per_page'])) {
            $this->assertIsNumeric($result['items_per_page']);
        }
    }

    // ── add_menu_page ──────────────────────────────────────────────────────

    public function test_add_menu_page_does_not_error() {
        // Must be admin to add menu pages.
        $admin_id = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin_id);
        set_current_screen('edit-wpsg_campaign');

        WPSG_Settings::add_menu_page();
        $this->assertTrue(true); // No exception = pass.
    }

    // ── register_settings ──────────────────────────────────────────────────

    public function test_register_settings_registers_option() {
        // Reset global to allow re-registration.
        global $new_allowed_options;
        unset($new_allowed_options['wpsg_settings_group']);

        WPSG_Settings::register_settings();

        // Verify the setting was registered.
        $registered = get_registered_settings();
        $this->assertArrayHasKey('wpsg_settings', $registered);
    }

    // ── render section helpers ─────────────────────────────────────────────

    public function test_render_auth_section_outputs_html() {
        ob_start();
        WPSG_Settings::render_auth_section();
        $html = ob_get_clean();
        $this->assertStringContainsString('<p>', $html);
    }

    public function test_render_display_section_outputs_html() {
        ob_start();
        WPSG_Settings::render_display_section();
        $html = ob_get_clean();
        $this->assertStringContainsString('<p>', $html);
    }

    public function test_render_performance_section_outputs_html() {
        ob_start();
        WPSG_Settings::render_performance_section();
        $html = ob_get_clean();
        $this->assertStringContainsString('<p>', $html);
    }

    // ── render field helpers ───────────────────────────────────────────────

    public function test_render_auth_provider_field_outputs_select() {
        ob_start();
        WPSG_Settings::render_auth_provider_field();
        $html = ob_get_clean();
        $this->assertStringContainsString('<select', $html);
    }

    public function test_render_api_base_field_outputs_input() {
        ob_start();
        WPSG_Settings::render_api_base_field();
        $html = ob_get_clean();
        $this->assertStringContainsString('<input', $html);
    }

    public function test_render_theme_field_outputs_markup() {
        ob_start();
        WPSG_Settings::render_theme_field();
        $html = ob_get_clean();
        $this->assertNotEmpty($html);
    }

    public function test_render_allow_user_theme_override_field() {
        ob_start();
        WPSG_Settings::render_allow_user_theme_override_field();
        $html = ob_get_clean();
        $this->assertNotEmpty($html);
        $this->assertStringContainsString('type="hidden"', $html);
        $this->assertStringContainsString('[allow_user_theme_override]', $html);
    }

    public function test_render_layout_field_outputs_markup() {
        ob_start();
        WPSG_Settings::render_layout_field();
        $html = ob_get_clean();
        $this->assertNotEmpty($html);
    }

    public function test_render_items_per_page_field_outputs_input() {
        ob_start();
        WPSG_Settings::render_items_per_page_field();
        $html = ob_get_clean();
        $this->assertStringContainsString('<input', $html);
    }

    public function test_render_lightbox_field_outputs_markup() {
        ob_start();
        WPSG_Settings::render_lightbox_field();
        $html = ob_get_clean();
        $this->assertNotEmpty($html);
        $this->assertStringContainsString('type="hidden"', $html);
        $this->assertStringContainsString('[enable_lightbox]', $html);
    }

    public function test_render_animations_field_outputs_markup() {
        ob_start();
        WPSG_Settings::render_animations_field();
        $html = ob_get_clean();
        $this->assertNotEmpty($html);
        $this->assertStringContainsString('type="hidden"', $html);
        $this->assertStringContainsString('[enable_animations]', $html);
    }

    public function test_render_cache_ttl_field_outputs_select() {
        ob_start();
        WPSG_Settings::render_cache_ttl_field();
        $html = ob_get_clean();
        $this->assertStringContainsString('<select', $html);
    }

    public function test_render_settings_page_outputs_form() {
        // Must be admin.
        $admin_id = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin_id);

        // register_settings must be called first for settings_fields().
        WPSG_Settings::register_settings();

        // Suppress PHP 8.3 deprecation in WP core settings_fields().
        $prev = error_reporting(E_ALL & ~E_DEPRECATED);
        ob_start();
        WPSG_Settings::render_settings_page();
        $html = ob_get_clean();
        error_reporting($prev);
        $this->assertStringContainsString('options.php', $html);
    }
}
