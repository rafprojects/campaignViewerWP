<?php

/**
 * P57-A: split-save of global settings written from a space-scoped panel.
 *
 * The settings panel sends one payload to PUT /spaces/{id}/settings, but its
 * "System & Admin" tab holds *global* (non-space-overridable) settings such as
 * settings_panel_animation. update_space_settings() must:
 *   - keep space-overridable keys in the per-space override (as before);
 *   - route the remaining global-only keys that actually changed to the GLOBAL
 *     option, subject to the shared settings guard (P72-C):
 *       · non-admin-only globals (e.g. settings_panel_animation) may be written
 *         by an editor (manage_wpsg) — the same keys they can write via /settings;
 *       · admin-only globals (e.g. cache_ttl) require manage_options and return
 *         an explicit 403 for editors (no longer silently dropped).
 *
 * Also locks the registry contract: settings_panel_animation is a validated
 * global enum and is NOT space-overridable.
 */
class WPSG_P57A_Settings_Split_Save_Test extends WP_UnitTestCase {

    /** System admin: administrator + manage_wpsg (administrators hold manage_options). */
    private function set_admin_user(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($uid);
        return $uid;
    }

    /** Space editor: manage_wpsg but NOT manage_options. */
    private function set_editor(): int {
        wpsg_ensure_editor_role();
        $uid = self::factory()->user->create(['role' => 'wpsg_editor']);
        wp_set_current_user($uid);
        return $uid;
    }

    private function make_space(array $overrides = []): int {
        return WPSG_DB::insert_space([
            'name'               => 'P57 Split-Save Space',
            'slug'               => 'p57-split-' . wp_generate_password(6, false),
            'isolation_mode'     => 'open',
            'settings_overrides' => $overrides,
        ]);
    }

    private function put_space_settings(int $space_id, array $body): WP_REST_Response {
        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/spaces/{$space_id}/settings");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode($body));
        return rest_do_request($request);
    }

    /** Read persisted overrides straight from the DB (bypasses the get_space() cache). */
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
    // Registry contract
    // -------------------------------------------------------------------------

    public function test_settings_panel_animation_is_a_global_validated_enum() {
        $defaults      = WPSG_Settings::get_defaults();
        $valid_options = WPSG_Settings_Registry::get_valid_options();
        $overridable   = WPSG_Settings::get_overridable_keys();

        $this->assertSame('slide-left', $defaults['settings_panel_animation'] ?? null, 'default must be slide-left');
        $this->assertSame(
            ['slide-left', 'fade', 'scale', 'none'],
            $valid_options['settings_panel_animation'] ?? null,
            'must validate against the four variants'
        );
        $this->assertNotContains(
            'settings_panel_animation',
            $overridable,
            'animation is a global setting and must NOT be space-overridable'
        );
    }

    // -------------------------------------------------------------------------
    // Split-save: global-only keys routed to the global option (manage_options)
    // -------------------------------------------------------------------------

    public function test_global_only_key_from_space_panel_routes_to_global_option() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, ['settingsPanelAnimation' => 'fade']);
        $this->assertSame(200, $response->get_status());

        // Not stored as a per-space override (it isn't overridable)…
        $this->assertArrayNotHasKey(
            'settings_panel_animation',
            $this->persisted_overrides($space_id),
            'global key must not be stored in the space override'
        );
        // …but written to the global option.
        $this->assertSame(
            'fade',
            WPSG_Settings::get_settings()['settings_panel_animation'],
            'global key must be routed to the global option'
        );
        // And the response (effective settings) reflects the new global value.
        $this->assertSame('fade', $response->get_data()['settings']['settingsPanelAnimation'] ?? null);
    }

    public function test_split_routes_overridable_to_space_and_global_to_option() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, [
            'theme'                 => 'github-light', // overridable → space
            'settingsPanelAnimation' => 'scale',       // global → global option
        ]);
        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('github-light', $overrides['theme'] ?? null, 'overridable key → space override');
        $this->assertArrayNotHasKey('settings_panel_animation', $overrides, 'global key must not land in the space override');
        $this->assertSame('scale', WPSG_Settings::get_settings()['settings_panel_animation'], 'global key → global option');
    }

    public function test_invalid_global_value_is_rejected_by_the_sanitizer() {
        $this->set_admin_user();
        $space_id = $this->make_space();

        $response = $this->put_space_settings($space_id, ['settingsPanelAnimation' => 'bogus-value']);
        $this->assertSame(200, $response->get_status());

        $this->assertNotSame(
            'bogus-value',
            WPSG_Settings::get_settings()['settings_panel_animation'],
            'an invalid enum value must not be persisted globally'
        );
        $this->assertSame(
            'slide-left',
            WPSG_Settings::get_settings()['settings_panel_animation'],
            'invalid value falls back to the registered default'
        );
    }

    // -------------------------------------------------------------------------
    // Permission (P72-C): the space panel shares /settings' guard exactly.
    //   · non-admin-only globals → an editor may write them (same as /settings);
    //   · admin-only globals     → an editor gets an explicit 403 (was silently
    //     dropped before P72-C).
    // -------------------------------------------------------------------------

    /** Space-admin editor (manage_wpsg + space grant, no manage_options). */
    private function make_editor_space(): array {
        $editor_id = $this->set_editor();
        $space_id  = WPSG_DB::insert_space([
            'name'           => 'P57 Editor Space',
            'slug'           => 'p57-editor-' . wp_generate_password(6, false),
            'isolation_mode' => 'open',
            'access_grants'  => [['userId' => $editor_id, 'access_level' => 'admin']],
        ]);
        return [$editor_id, $space_id];
    }

    public function test_editor_may_write_a_non_admin_global_key_via_space_panel() {
        // settings_panel_animation is a global (non-overridable) key that is NOT
        // admin-only, so an editor can write it via /settings — and, since P72-C
        // unified the guard, via the space panel too.
        $this->assertNotContains('settings_panel_animation', WPSG_Settings_Registry::get_admin_only_fields());

        [, $space_id] = $this->make_editor_space();

        // Mixed payload: an overridable key (theme) + a non-admin global (animation).
        $response = $this->put_space_settings($space_id, [
            'theme'                  => 'github-light',
            'settingsPanelAnimation' => 'none',
        ]);

        $this->assertSame(200, $response->get_status());

        $overrides = $this->persisted_overrides($space_id);
        $this->assertSame('github-light', $overrides['theme'] ?? null, 'editor may still write the overridable key');
        $this->assertArrayNotHasKey('settings_panel_animation', $overrides, 'global key must not land in the space override');

        // The non-admin global IS written now (consistency with /settings).
        $this->assertSame(
            'none',
            WPSG_Settings::get_settings()['settings_panel_animation'],
            'editor may write a non-admin-only global via the space panel (P72-C)'
        );
    }

    public function test_editor_gets_403_on_admin_only_global_via_space_panel() {
        // cache_ttl is an admin-only (system) global — writing it requires
        // manage_options. Before P72-C the space panel silently dropped it; now
        // it returns the same explicit 403 as /settings, and applies nothing.
        $this->assertContains('cache_ttl', WPSG_Settings_Registry::get_admin_only_fields());
        $cache_ttl_before = WPSG_Settings::get_settings()['cache_ttl'];

        [, $space_id] = $this->make_editor_space();

        // Mixed payload: an overridable key (theme) + an admin-only global (cacheTtl).
        $response = $this->put_space_settings($space_id, [
            'theme'    => 'github-light',
            'cacheTtl' => 999,
        ]);

        // Explicit 403 — the whole request is rejected, matching /settings.
        $this->assertSame(403, $response->get_status());
        $this->assertSame('wpsg_forbidden_settings', $response->get_data()['code'] ?? null);

        // Nothing was applied: neither the admin-only global nor the overridable
        // key (guard runs before any write, so the request is atomic).
        $this->assertSame(
            $cache_ttl_before,
            WPSG_Settings::get_settings()['cache_ttl'],
            'admin-only global must not change for a non-manage_options user'
        );
        $this->assertArrayNotHasKey(
            'theme',
            $this->persisted_overrides($space_id),
            'a rejected request applies no partial override write'
        );
    }
}
