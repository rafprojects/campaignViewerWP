<?php

/**
 * P52-A4: system-vs-display settings split.
 *
 * Writing settings requires manage_wpsg (route gate). Writing a *system-level*
 * key ($admin_only_fields — cache, uploads, auth provider, retention, …) ALSO
 * requires manage_options. A space editor (manage_wpsg only) may write
 * display/campaign keys but is denied (403) on system keys, with no partial
 * write of the rest of a mixed payload.
 */
class WPSG_P52A4_Settings_Split_Test extends WP_UnitTestCase {

    private function set_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
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

    private function post_settings(array $camel_body): WP_REST_Response {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($camel_body));
        return rest_do_request($req);
    }

    private function patch_settings(array $camel_body): WP_REST_Response {
        $req = new WP_REST_Request('PATCH', '/wp-super-gallery/v1/settings');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode($camel_body));
        return rest_do_request($req);
    }

    // ── Editor: display keys allowed ──────────────────────────────────────

    public function test_editor_can_write_display_setting() {
        $this->set_editor();

        $res = $this->post_settings(['theme' => 'github-light', 'itemsPerPage' => 24]);

        $this->assertSame(200, $res->get_status(), 'editor may write display settings');
        $this->assertSame('github-light', $res->get_data()['theme'] ?? null);
        $this->assertSame(24, $res->get_data()['itemsPerPage'] ?? null);
    }

    // ── Editor: system keys denied ────────────────────────────────────────

    public function test_editor_cannot_write_system_setting_via_post() {
        $before = WPSG_Settings::get_settings()['cache_ttl'];
        $this->set_editor();

        $res = $this->post_settings(['cacheTtl' => (int) $before + 123]);

        $this->assertSame(403, $res->get_status(), 'editor must be denied a system setting');
        $this->assertSame('wpsg_forbidden_settings', $res->get_data()['code'] ?? null);
        $this->assertSame($before, WPSG_Settings::get_settings()['cache_ttl'], 'system value must be unchanged');
    }

    public function test_editor_cannot_write_system_setting_via_patch() {
        $before = WPSG_Settings::get_settings()['cache_ttl'];
        $this->set_editor();

        $res = $this->patch_settings(['cacheTtl' => (int) $before + 123]);

        $this->assertSame(403, $res->get_status(), 'editor must be denied a system setting on PATCH');
        $this->assertSame($before, WPSG_Settings::get_settings()['cache_ttl'], 'system value must be unchanged');
    }

    public function test_editor_mixed_payload_is_rejected_atomically() {
        $theme_before = WPSG_Settings::get_settings()['theme'] ?? '';
        $this->set_editor();

        // A legal display key bundled with an illegal system key → whole request denied.
        $res = $this->post_settings(['theme' => 'github-light', 'cacheTtl' => 99999]);

        $this->assertSame(403, $res->get_status());
        $this->assertSame(
            $theme_before,
            WPSG_Settings::get_settings()['theme'] ?? '',
            'no partial write: the display key must not be applied when a system key is rejected'
        );
    }

    // ── System admin: system keys allowed ─────────────────────────────────

    public function test_system_admin_can_write_system_setting() {
        $this->set_system_admin();

        $res = $this->post_settings(['cacheTtl' => 777]);

        $this->assertSame(200, $res->get_status(), 'system admin may write system settings');
        $this->assertSame(777, WPSG_Settings::get_settings()['cache_ttl']);
    }
}
