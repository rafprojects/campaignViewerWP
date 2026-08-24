<?php

/**
 * P47-K: Gallery Spaces — Settings Inheritance + Allowlist Enforcement
 *
 * Locks in the per-space settings behavior so a future change cannot silently
 * widen the overridable surface or break the inherit-from-global fallback.
 *
 * Covers:
 *  - get_effective_settings(): override wins; unset keys fall back to global.
 *  - get_effective_settings(0) and a missing space id both return global.
 *  - A non-overridable (admin-only) key stored in settings_overrides is ignored
 *    by the effective merge (allowlist filter at read time).
 *  - PUT /spaces/{id}/settings persists only allowlisted keys (admin-only dropped).
 *  - PUT with a null value clears an existing override (restores global).
 *  - Out-of-range numeric overrides are clamped by the sanitizer.
 *
 * PUT assertions read both the persisted DB row and the endpoint response body.
 * P47-L promoted get_space()'s static cache to a class property busted by every
 * write, so the endpoint response now reflects the just-saved values.
 */
class WPSG_P47_Spaces_Settings_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function make_space(array $overrides = [], string $iso = 'open'): int {
        return WPSG_DB::insert_space([
            'name'               => 'P47 Settings Space',
            'slug'               => 'p47-settings-' . wp_generate_password(6, false),
            'isolation_mode'     => $iso,
            'settings_overrides' => $overrides,
        ]);
    }

    private function put_space_settings(int $space_id, array $body): WP_REST_Response {
        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/spaces/{$space_id}/settings");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode($body));
        return rest_do_request($request);
    }

    /** Read the persisted overrides straight from the DB, bypassing the get_space() static cache. */
    private function persisted_overrides(int $space_id): array {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $json = $wpdb->get_var($wpdb->prepare(
            'SELECT settings_overrides FROM ' . WPSG_DB::get_spaces_table() . ' WHERE id = %d',
            $space_id
        ));
        $arr = json_decode((string) $json, true);
        return is_array($arr) ? $arr : [];
    }

    // -------------------------------------------------------------------------
    // Inheritance: override wins, everything else falls back to global.
    // -------------------------------------------------------------------------

    public function test_effective_settings_override_wins_and_unset_falls_back() {
        $global   = WPSG_Settings::get_settings();
        $space_id = $this->make_space([ 'theme' => 'p47-custom-theme' ]);

        $eff = WPSG_Settings::get_effective_settings($space_id);

        $this->assertSame('p47-custom-theme', $eff['theme'], 'Space override should win for theme.');
        $this->assertSame(
            $global['items_per_page'],
            $eff['items_per_page'],
            'An un-overridden key must fall back to the global default.'
        );
    }

    public function test_effective_settings_for_space_zero_returns_global() {
        $this->assertSame(
            WPSG_Settings::get_settings(),
            WPSG_Settings::get_effective_settings(0),
            'space_id 0 must return global settings verbatim.'
        );
    }

    public function test_effective_settings_for_missing_space_returns_global() {
        $eff = WPSG_Settings::get_effective_settings(99999999);
        $this->assertSame(
            WPSG_Settings::get_settings()['theme'],
            $eff['theme'],
            'A non-existent space must fall back to global settings.'
        );
    }

    // -------------------------------------------------------------------------
    // Allowlist enforcement at the merge level: a non-overridable key that
    // somehow lands in settings_overrides must NOT leak into effective settings.
    // -------------------------------------------------------------------------

    public function test_non_overridable_key_in_overrides_is_ignored() {
        $global   = WPSG_Settings::get_settings();
        // cache_ttl is admin-only (global). Smuggle it into the JSON overrides.
        $space_id = $this->make_space([ 'theme' => 'p47-x', 'cache_ttl' => 99 ]);

        $eff = WPSG_Settings::get_effective_settings($space_id);

        $this->assertSame('p47-x', $eff['theme'], 'Allowlisted override (theme) should apply.');
        $this->assertSame(
            $global['cache_ttl'],
            $eff['cache_ttl'],
            'Admin-only cache_ttl must stay global even when present in overrides.'
        );
        $this->assertNotSame(99, $eff['cache_ttl']);
    }

    public function test_overridable_keys_is_the_registry_allowlist() {
        $keys = WPSG_Settings::get_overridable_keys();
        $this->assertContains('theme', $keys);
        $this->assertContains('gallery_layout', $keys);
        $this->assertNotContains('cache_ttl', $keys, 'Admin-only keys must never be overridable.');
        $this->assertNotContains('auth_provider', $keys);
    }

    // -------------------------------------------------------------------------
    // Allowlist enforcement at the PUT endpoint (asserted on the persisted row).
    // -------------------------------------------------------------------------

    public function test_put_settings_persists_only_allowlisted_keys() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        // camelCase body: theme is overridable; cacheTtl maps to admin-only cache_ttl.
        // 'github-light' is a valid theme id (sanitizer validates against valid_options).
        $response = $this->put_space_settings($space_id, [ 'theme' => 'github-light', 'cacheTtl' => 99 ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertArrayHasKey('theme', $overrides, 'Overridable theme should be stored.');
        $this->assertSame('github-light', $overrides['theme']);
        $this->assertArrayNotHasKey('cache_ttl', $overrides, 'Admin-only cache_ttl must be dropped.');
    }

    public function test_put_settings_null_clears_an_existing_override() {
        $this->set_admin_user();
        $space_id = $this->make_space([ 'theme' => 'github-light' ]);

        $response = $this->put_space_settings($space_id, [ 'theme' => null ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertArrayNotHasKey('theme', $overrides, 'null must clear the override.');
    }

    // -------------------------------------------------------------------------
    // Sanitizer clamps out-of-range overrides (items_per_page range is [1,100]).
    // -------------------------------------------------------------------------

    public function test_sanitizer_clamps_out_of_range_value() {
        $sanitized = WPSG_Settings::sanitize_settings([ 'items_per_page' => 999 ]);
        $this->assertArrayHasKey('items_per_page', $sanitized);
        $this->assertLessThanOrEqual(100, $sanitized['items_per_page'], 'items_per_page must be clamped to its max.');
        $this->assertGreaterThanOrEqual(1, $sanitized['items_per_page']);
        $this->assertNotSame(999, $sanitized['items_per_page']);
    }

    public function test_put_settings_clamps_out_of_range_override() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [ 'itemsPerPage' => 999 ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertArrayHasKey('items_per_page', $overrides);
        $this->assertLessThanOrEqual(100, $overrides['items_per_page'], 'Stored override must be clamped.');
    }

    // -------------------------------------------------------------------------
    // P47-L: cache-bust — PUT response must reflect the saved value, not the
    // stale row that was in the request-level get_space() cache before the write.
    // -------------------------------------------------------------------------

    public function test_put_settings_response_reflects_saved_values_not_stale_cache() {
        $this->set_admin_user();
        // Space starts with theme=nord. Warm the cache before the write so the
        // stale-cache bug would have returned 'nord' from the response.
        $space_id = $this->make_space([ 'theme' => 'nord' ]);
        WPSG_DB::get_space($space_id);

        $response = $this->put_space_settings($space_id, [ 'theme' => 'github-light' ]);
        $this->assertSame(200, $response->get_status());

        $data = $response->get_data();

        // 'overrides' → snake_case persisted overrides.
        $this->assertArrayHasKey('overrides', $data);
        $this->assertSame(
            'github-light',
            $data['overrides']['theme'] ?? null,
            'Response overrides.theme must be the saved value, not the pre-PUT cached row.'
        );

        // 'settings' → camelCase effective settings (includes the override).
        $this->assertArrayHasKey('settings', $data);
        $this->assertSame(
            'github-light',
            $data['settings']['theme'] ?? null,
            'Response settings.theme must reflect the new override.'
        );
    }

    // -------------------------------------------------------------------------
    // P47-M: representative per-group assertions — one field per group confirms
    // the key is allowlisted and survives the PUT → effective-settings pipeline.
    // -------------------------------------------------------------------------

    public function test_p47m_branding_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'campaignAboutHeadingText' => 'About This Space',
            'galleryImageLabel'        => 'Photos',
            'galleryVideoLabel'        => 'Clips',
            'galleryLabelJustification' => 'center',
            'showGalleryLabelIcon'     => true,
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('About This Space', $overrides['campaign_about_heading_text']);
        $this->assertSame('Photos', $overrides['gallery_image_label']);
        $this->assertSame('Clips', $overrides['gallery_video_label']);
        $this->assertSame('center', $overrides['gallery_label_justification']);
        $this->assertTrue($overrides['show_gallery_label_icon']);
    }

    public function test_p47m_background_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'imageBgType'    => 'solid',
            'imageBgColor'   => '#ff0000',
            'videoBgType'    => 'gradient',
            'unifiedBgType'  => 'none',
            'viewerBgType'   => 'transparent',
            'modalBgType'    => 'theme',
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('solid', $overrides['image_bg_type']);
        $this->assertSame('#ff0000', $overrides['image_bg_color']);
        $this->assertSame('gradient', $overrides['video_bg_type']);
        $this->assertSame('none', $overrides['unified_bg_type']);
        $this->assertSame('transparent', $overrides['viewer_bg_type']);
        $this->assertSame('theme', $overrides['modal_bg_type']);
    }

    public function test_p47m_nav_dot_nav_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'navArrowPosition'   => 'bottom',
            'navArrowColor'      => '#aabbcc',
            'dotNavEnabled'      => false,
            'dotNavShape'        => 'pill',
            'dotNavActiveColor'  => '#ff0000',
            'dotNavInactiveColor' => 'rgba(0,0,0,0.2)',
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('bottom', $overrides['nav_arrow_position']);
        $this->assertSame('#aabbcc', $overrides['nav_arrow_color']);
        $this->assertFalse($overrides['dot_nav_enabled']);
        $this->assertSame('pill', $overrides['dot_nav_shape']);
        $this->assertSame('#ff0000', $overrides['dot_nav_active_color']);
        $this->assertSame('rgba(0,0,0,0.2)', $overrides['dot_nav_inactive_color']);
    }

    public function test_p47m_shadows_and_borders_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'imageShadowPreset' => 'strong',
            'cardShadowPreset'  => 'dramatic',
            'cardBorderRadius'  => 16,
            'cardBorderColor'   => '#123456',
            'tileBorderWidth'   => 2,
            'tileBorderColor'   => '#ffffff',
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('strong', $overrides['image_shadow_preset']);
        $this->assertSame('dramatic', $overrides['card_shadow_preset']);
        $this->assertSame(16, $overrides['card_border_radius']);
        $this->assertSame('#123456', $overrides['card_border_color']);
        $this->assertSame(2, $overrides['tile_border_width']);
        $this->assertSame('#ffffff', $overrides['tile_border_color']);
    }

    public function test_p47m_display_toggles_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'showViewerBorder'          => false,
            'showCampaignCoverImage'    => false,
            'showCampaignTags'          => false,
            'showCampaignGalleryLabels' => false,
            'transitionFadeEnabled'     => false,
            'campaignOpenMode'          => 'galleries-only',
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertFalse($overrides['show_viewer_border']);
        $this->assertFalse($overrides['show_campaign_cover_image']);
        $this->assertFalse($overrides['show_campaign_tags']);
        $this->assertFalse($overrides['show_campaign_gallery_labels']);
        $this->assertFalse($overrides['transition_fade_enabled']);
        $this->assertSame('galleries-only', $overrides['campaign_open_mode']);
    }

    // -------------------------------------------------------------------------
    // P47-N: tier-2 layout/composition fields — one representative per group.
    // -------------------------------------------------------------------------

    public function test_p47n_card_layout_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'cardGapH'               => 24,
            'cardGapHUnit'           => 'em',
            'cardGapV'               => 20,
            'cardAspectRatio'        => '16:9',
            'cardGridColumns'        => 3,
            'cardScale'              => 1.2,
            'cardDisplayMode'        => 'paginated',
            'cardThumbnailHeight'    => 250,
            'cardThumbnailFit'       => 'contain',
            'cardGradientEndOpacity' => 0.7,
            'gridCardWidth'          => 200,
            'gridCardWidthUnit'      => 'px',
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame(24, $overrides['card_gap_h']);
        $this->assertSame('em', $overrides['card_gap_h_unit']);
        $this->assertSame(20, $overrides['card_gap_v']);
        $this->assertSame('16:9', $overrides['card_aspect_ratio']);
        $this->assertSame(3, $overrides['card_grid_columns']);
        $this->assertSame(1.2, $overrides['card_scale']);
        $this->assertSame('paginated', $overrides['card_display_mode']);
        $this->assertSame(250, $overrides['card_thumbnail_height']);
        $this->assertSame('contain', $overrides['card_thumbnail_fit']);
        $this->assertSame(0.7, $overrides['card_gradient_end_opacity']);
        $this->assertSame(200, $overrides['grid_card_width']);
        $this->assertSame('px', $overrides['grid_card_width_unit']);
    }

    public function test_p47n_tile_mosaic_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'tileSize'              => 200,
            'tileSizeUnit'          => 'px',
            'tileGapX'              => 12,
            'tileGapY'              => 12,
            'mosaicTargetRowHeight' => 300,
            'masonryColumns'        => 4,
            'photoNormalizeHeight'  => 400,
            'hexVerticalOverlapRatio'     => 0.3,
            'diamondVerticalOverlapRatio' => 0.5,
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame(200, $overrides['tile_size']);
        $this->assertSame('px', $overrides['tile_size_unit']);
        $this->assertSame(12, $overrides['tile_gap_x']);
        $this->assertSame(12, $overrides['tile_gap_y']);
        $this->assertSame(300, $overrides['mosaic_target_row_height']);
        $this->assertSame(4, $overrides['masonry_columns']);
        $this->assertSame(400, $overrides['photo_normalize_height']);
        $this->assertSame(0.3, $overrides['hex_vertical_overlap_ratio']);
        $this->assertSame(0.5, $overrides['diamond_vertical_overlap_ratio']);
    }

    public function test_p47n_carousel_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'carouselAutoplay'      => true,
            'carouselAutoplaySpeed' => 5000,
            'carouselLoop'          => false,
            'carouselGap'           => 24,
            'carouselGapUnit'       => 'px',
            'carouselVisibleCards'  => 2,
            'carouselDarkenUnfocused' => true,
            'carouselDarkenOpacity'   => 0.4,
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertTrue($overrides['carousel_autoplay']);
        $this->assertSame(5000, $overrides['carousel_autoplay_speed']);
        $this->assertFalse($overrides['carousel_loop']);
        $this->assertSame(24, $overrides['carousel_gap']);
        $this->assertSame('px', $overrides['carousel_gap_unit']);
        $this->assertSame(2, $overrides['carousel_visible_cards']);
        $this->assertTrue($overrides['carousel_darken_unfocused']);
        $this->assertSame(0.4, $overrides['carousel_darken_opacity']);
    }

    public function test_p47n_modal_lightbox_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'modalTransition'         => 'fade',
            'modalTransitionDuration' => 400,
            'modalMaxWidth'           => 900,
            'modalMaxWidthUnit'       => 'px',
            'modalCoverHeight'        => 300,
            'lightboxTransitionMs'    => 300,
            'lightboxEntryScale'      => 0.85,
            'lightboxVideoMaxWidth'   => 800,
            'campaignModalFullscreen' => true,
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('fade', $overrides['modal_transition']);
        $this->assertSame(400, $overrides['modal_transition_duration']);
        $this->assertSame(900, $overrides['modal_max_width']);
        $this->assertSame('px', $overrides['modal_max_width_unit']);
        $this->assertSame(300, $overrides['modal_cover_height']);
        $this->assertSame(300, $overrides['lightbox_transition_ms']);
        $this->assertSame(0.85, $overrides['lightbox_entry_scale']);
        $this->assertSame(800, $overrides['lightbox_video_max_width']);
        $this->assertTrue($overrides['campaign_modal_fullscreen']);
    }

    public function test_p47n_gallery_section_adapter_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'gallerySizingMode'   => 'viewport',
            'appMaxWidth'         => 1600,
            'appMaxWidthUnit'     => 'px',
            // section_scale/item_scale default to int 1 → sanitizer casts to int; use int test values.
            'sectionScale'        => 2,
            'itemScale'           => 2,
            'adapterSizingMode'   => 'manual',
            'adapterItemGap'      => 24,
            'adapterItemGapUnit'  => 'px',
            'adapterJustifyContent' => 'center',
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('viewport', $overrides['gallery_sizing_mode']);
        $this->assertSame(1600, $overrides['app_max_width']);
        $this->assertSame('px', $overrides['app_max_width_unit']);
        $this->assertSame(2, $overrides['section_scale']);
        $this->assertSame(2, $overrides['item_scale']);
        $this->assertSame('manual', $overrides['adapter_sizing_mode']);
        $this->assertSame(24, $overrides['adapter_item_gap']);
        $this->assertSame('px', $overrides['adapter_item_gap_unit']);
        $this->assertSame('center', $overrides['adapter_justify_content']);
    }

    public function test_p47n_viewport_responsive_fields_are_overridable() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'videoViewportHeight'       => 500,
            'videoViewportHeightUnit'   => 'px',
            'imageViewportHeight'       => 480,
            'viewportHeightMobileRatio' => 0.7,
            'viewportHeightTabletRatio' => 0.85,
            'modalMobileBreakpoint'     => 640,
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame(500, $overrides['video_viewport_height']);
        $this->assertSame('px', $overrides['video_viewport_height_unit']);
        $this->assertSame(480, $overrides['image_viewport_height']);
        $this->assertSame(0.7, $overrides['viewport_height_mobile_ratio']);
        $this->assertSame(0.85, $overrides['viewport_height_tablet_ratio']);
        $this->assertSame(640, $overrides['modal_mobile_breakpoint']);
    }

    /**
     * Unit-parity check: every _unit field in the allowlist must have its base
     * also allowlisted, and every allowlisted base field that has a *_unit
     * companion in $defaults must also have that unit allowlisted.
     */
    public function test_p47n_unit_parity_in_overridable_allowlist() {
        $keys     = WPSG_Settings::get_overridable_keys();
        $key_set  = array_flip($keys);
        $defaults = WPSG_Settings::get_defaults();

        // Every *_unit in the allowlist → its base must also be allowlisted.
        foreach ($keys as $key) {
            if (str_ends_with($key, '_unit')) {
                $base = substr($key, 0, -5);
                $this->assertArrayHasKey(
                    $base,
                    $key_set,
                    "Unit field '{$key}' is allowlisted but its base '{$base}' is not."
                );
            }
        }

        // Every allowlisted base field whose *_unit companion exists in defaults
        // must also have that unit allowlisted.
        foreach ($keys as $key) {
            if (str_ends_with($key, '_unit')) {
                continue;
            }
            $unit_key = $key . '_unit';
            if (array_key_exists($unit_key, $defaults)) {
                $this->assertArrayHasKey(
                    $unit_key,
                    $key_set,
                    "Base field '{$key}' is allowlisted but its unit companion '{$unit_key}' is not."
                );
            }
        }
    }
}
