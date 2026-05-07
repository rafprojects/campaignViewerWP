<?php
/**
 * Tests for sanitize_card_config_payload() in WPSG_Settings_Sanitizer.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Card_Config_Sanitizer_Test extends WP_UnitTestCase {

    // ── Invalid / empty inputs ────────────────────────────────────────────

    public function test_returns_default_for_non_array_non_string() {
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload(42);
        // Default param is [] so fallback returns [].
        $this->assertEquals([], $result);
    }

    public function test_returns_default_for_invalid_json_string() {
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload('{bad json');
        $this->assertEquals([], $result);
    }

    public function test_returns_empty_breakpoints_for_missing_breakpoints_key() {
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload(['foo' => 'bar']);
        $this->assertEquals(['breakpoints' => []], $result);
    }

    public function test_returns_empty_breakpoints_for_null_input() {
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload(null);
        $this->assertEquals([], $result);
    }

    public function test_returns_custom_default_when_provided() {
        $custom = ['breakpoints' => ['desktop' => ['cardScale' => 1.5]]];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload(false, $custom);
        $this->assertEquals($custom, $result);
    }

    // ── Valid inputs ──────────────────────────────────────────────────────

    public function test_accepts_valid_integer_override() {
        $input = [
            'breakpoints' => [
                'tablet' => ['cardGridColumns' => 2],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertArrayHasKey('tablet', $result['breakpoints']);
        $this->assertEquals(2, $result['breakpoints']['tablet']['cardGridColumns']);
    }

    public function test_accepts_valid_float_override() {
        $input = [
            'breakpoints' => [
                'mobile' => ['cardScale' => 0.75],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertArrayHasKey('mobile', $result['breakpoints']);
        $this->assertEquals(0.75, $result['breakpoints']['mobile']['cardScale']);
    }

    public function test_accepts_valid_enum_override() {
        $input = [
            'breakpoints' => [
                'tablet' => ['cardDisplayMode' => 'paginated'],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertEquals('paginated', $result['breakpoints']['tablet']['cardDisplayMode']);
    }

    public function test_accepts_valid_unit_override() {
        $input = [
            'breakpoints' => [
                'tablet' => ['cardGapHUnit' => 'rem', 'cardGapH' => 2],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertEquals('rem', $result['breakpoints']['tablet']['cardGapHUnit']);
        $this->assertEquals(2, $result['breakpoints']['tablet']['cardGapH']);
    }

    public function test_accepts_json_string_input() {
        $json = json_encode([
            'breakpoints' => [
                'tablet' => ['cardRowsPerPage' => 3],
            ],
        ]);
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($json);

        $this->assertEquals(3, $result['breakpoints']['tablet']['cardRowsPerPage']);
    }

    public function test_accepts_extended_presentation_and_visibility_overrides() {
        $input = [
            'breakpoints' => [
                'mobile' => [
                    'cardPageDotNav' => true,
                    'cardPageTransitionOpacity' => 0.4,
                    'cardBorderMode' => 'single',
                    'cardBorderColor' => '#112233',
                    'showCardInfoPanel' => false,
                    'showCardThumbnailFade' => false,
                    'cardLockIconSize' => 40,
                    'cardAutoColumnsBreakpoints' => '0:1,768:2',
                ],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertTrue($result['breakpoints']['mobile']['cardPageDotNav']);
        $this->assertEquals(0.4, $result['breakpoints']['mobile']['cardPageTransitionOpacity']);
        $this->assertEquals('single', $result['breakpoints']['mobile']['cardBorderMode']);
        $this->assertEquals('#112233', $result['breakpoints']['mobile']['cardBorderColor']);
        $this->assertFalse($result['breakpoints']['mobile']['showCardInfoPanel']);
        $this->assertFalse($result['breakpoints']['mobile']['showCardThumbnailFade']);
        $this->assertEquals(40, $result['breakpoints']['mobile']['cardLockIconSize']);
        $this->assertEquals('0:1,768:2', $result['breakpoints']['mobile']['cardAutoColumnsBreakpoints']);
    }

    // ── Unknown keys / breakpoints ────────────────────────────────────────

    public function test_drops_unknown_override_keys() {
        $input = [
            'breakpoints' => [
                'tablet' => [
                    'cardGridColumns' => 2,
                    'unknownField'    => 'bad',
                ],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertArrayHasKey('cardGridColumns', $result['breakpoints']['tablet']);
        $this->assertArrayNotHasKey('unknownField', $result['breakpoints']['tablet']);
    }

    public function test_drops_unknown_breakpoint_names() {
        $input = [
            'breakpoints' => [
                'ultrawide'  => ['cardGridColumns' => 6],
                'tablet'     => ['cardGridColumns' => 2],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertArrayNotHasKey('ultrawide', $result['breakpoints']);
        $this->assertArrayHasKey('tablet', $result['breakpoints']);
    }

    // ── Unit-only rejection ───────────────────────────────────────────────

    public function test_rejects_orphaned_unit_override() {
        $input = [
            'breakpoints' => [
                'mobile' => [
                    'cardGapHUnit' => 'rem',
                    // No cardGapH value — unit is orphaned.
                ],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        // The entire mobile layer should be empty (stripped), so breakpoints should not have mobile.
        $this->assertArrayNotHasKey('mobile', $result['breakpoints']);
    }

    public function test_keeps_unit_when_value_is_present() {
        $input = [
            'breakpoints' => [
                'tablet' => [
                    'cardBorderRadius'     => 8,
                    'cardBorderRadiusUnit' => 'rem',
                ],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertEquals(8, $result['breakpoints']['tablet']['cardBorderRadius']);
        $this->assertEquals('rem', $result['breakpoints']['tablet']['cardBorderRadiusUnit']);
    }

    public function test_rejects_multiple_orphaned_units() {
        $input = [
            'breakpoints' => [
                'tablet' => [
                    'cardGapHUnit'          => 'rem',
                    'cardGapVUnit'          => 'em',
                    'cardMaxWidthUnit'      => '%',
                    // None have matching values.
                ],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertArrayNotHasKey('tablet', $result['breakpoints']);
    }

    // ── Range clamping ────────────────────────────────────────────────────

    public function test_clamps_integer_to_field_range() {
        // cardGridColumns registry default is 0 with range [0, 12].
        $input = [
            'breakpoints' => [
                'tablet' => ['cardGridColumns' => 999],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        // Should be clamped to max (12).
        $this->assertLessThanOrEqual(12, $result['breakpoints']['tablet']['cardGridColumns']);
    }

    // ── Invalid enum ──────────────────────────────────────────────────────

    public function test_rejects_invalid_enum_without_fallback() {
        $input = [
            'breakpoints' => [
                'mobile' => [
                    'cardDisplayMode' => 'not-a-valid-mode',
                ],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        // Invalid enum with no fallback => not accepted => layer empty.
        $this->assertArrayNotHasKey('mobile', $result['breakpoints']);
    }

    // ── Multiple breakpoints ──────────────────────────────────────────────

    public function test_handles_multiple_breakpoints() {
        $input = [
            'breakpoints' => [
                'tablet' => ['cardGridColumns' => 3],
                'mobile' => ['cardGridColumns' => 1],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertEquals(3, $result['breakpoints']['tablet']['cardGridColumns']);
        $this->assertEquals(1, $result['breakpoints']['mobile']['cardGridColumns']);
    }

    public function test_desktop_breakpoint_is_accepted() {
        $input = [
            'breakpoints' => [
                'desktop' => ['cardScale' => 1.2],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertEquals(1.2, $result['breakpoints']['desktop']['cardScale']);
    }

    // ── Empty layers stripped ─────────────────────────────────────────────

    public function test_strips_empty_layers() {
        $input = [
            'breakpoints' => [
                'tablet' => ['unknownField' => 'val'],
            ],
        ];
        $result = WPSG_Settings_Sanitizer::sanitize_card_config_payload($input);

        $this->assertArrayNotHasKey('tablet', $result['breakpoints']);
    }

    // ── Integration: full round‑trip through sanitize_settings ────────────

    public function test_sanitize_settings_preserves_card_config() {
        $input = [
            'card_config' => [
                'breakpoints' => [
                    'tablet' => [
                        'cardGridColumns' => 2,
                        'cardGapH'        => 10,
                        'cardGapHUnit'    => 'px',
                    ],
                ],
            ],
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);

        $this->assertArrayHasKey('card_config', $sanitized);
        $cc = $sanitized['card_config'];
        $this->assertEquals(2, $cc['breakpoints']['tablet']['cardGridColumns']);
        $this->assertEquals(10, $cc['breakpoints']['tablet']['cardGapH']);
        $this->assertEquals('px', $cc['breakpoints']['tablet']['cardGapHUnit']);
    }

    public function test_sanitize_settings_card_config_json_string() {
        $input = [
            'card_config' => json_encode([
                'breakpoints' => [
                    'mobile' => ['cardRowsPerPage' => 2],
                ],
            ]),
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);

        $this->assertEquals(2, $sanitized['card_config']['breakpoints']['mobile']['cardRowsPerPage']);
    }

    public function test_sanitize_settings_preserves_extended_card_config_fields() {
        $input = [
            'card_config' => [
                'breakpoints' => [
                    'tablet' => [
                        'cardPageDotNav' => true,
                        'cardBorderMode' => 'single',
                        'cardBorderColor' => '#445566',
                        'showCardInfoPanel' => false,
                        'cardPageTransitionOpacity' => 0.55,
                        'cardCompanyBadgeMaxWidth' => 220,
                        'cardAutoColumnsBreakpoints' => '0:1,900:2',
                    ],
                ],
            ],
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);

        $this->assertArrayHasKey('card_config', $sanitized);
        $cc = $sanitized['card_config'];
        $this->assertTrue($cc['breakpoints']['tablet']['cardPageDotNav']);
        $this->assertEquals('single', $cc['breakpoints']['tablet']['cardBorderMode']);
        $this->assertEquals('#445566', $cc['breakpoints']['tablet']['cardBorderColor']);
        $this->assertFalse($cc['breakpoints']['tablet']['showCardInfoPanel']);
        $this->assertEquals(0.55, $cc['breakpoints']['tablet']['cardPageTransitionOpacity']);
        $this->assertEquals(220, $cc['breakpoints']['tablet']['cardCompanyBadgeMaxWidth']);
        $this->assertEquals('0:1,900:2', $cc['breakpoints']['tablet']['cardAutoColumnsBreakpoints']);
    }

    public function test_sanitize_settings_normalizes_legacy_desktop_card_config_into_flat_values() {
        $input = [
            'card_grid_columns' => 1,
            'card_gap_h' => 12,
            'card_gap_h_unit' => 'px',
            'card_config' => [
                'breakpoints' => [
                    'desktop' => [
                        'cardGridColumns' => 4,
                        'cardGapH' => 2,
                        'cardGapHUnit' => 'rem',
                    ],
                    'tablet' => [
                        'cardRowsPerPage' => 2,
                    ],
                ],
            ],
        ];
        $sanitized = WPSG_Settings::sanitize_settings($input);

        $this->assertEquals(4, $sanitized['card_grid_columns']);
        $this->assertEquals(2, $sanitized['card_gap_h']);
        $this->assertEquals('rem', $sanitized['card_gap_h_unit']);
        $this->assertArrayNotHasKey('desktop', $sanitized['card_config']['breakpoints']);
        $this->assertEquals(2, $sanitized['card_config']['breakpoints']['tablet']['cardRowsPerPage']);
    }

    public function test_sanitize_settings_without_card_config() {
        // sanitize_settings only includes keys present in $input.
        $input = ['theme' => 'default-dark'];
        $sanitized = WPSG_Settings::sanitize_settings($input);

        // card_config was not in input, so it should not appear in output.
        $this->assertArrayNotHasKey('card_config', $sanitized);
    }
}
