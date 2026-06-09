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
}
