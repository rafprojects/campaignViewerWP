<?php

/**
 * P52-A5c: per-resource delete policy.
 *
 *  - fonts.delete is System-Admin-only (manage_options).
 *  - layout-template / asset delete carry a server-side in-use guard: deletion
 *    is blocked (409) while the resource is referenced, unless the caller
 *    explicitly passes force=true (the confirm-modal path).
 */
class WPSG_P52A5c_Delete_Policy_Test extends WP_UnitTestCase {

    private function set_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    /** manage_wpsg but NOT manage_options. */
    private function set_editor(): int {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    private function make_template(): string {
        $tpl = WPSG_Layout_Templates::create(['name' => 'A5c Template', 'canvasAspectRatio' => 1.5]);
        $this->assertIsArray($tpl, 'fixture template must be created');
        return $tpl['id'];
    }

    private function make_asset(): string {
        $asset = WPSG_Asset_Library::add(['url' => 'https://example.com/a5c.svg', 'name' => 'A5c Asset']);
        $this->assertIsArray($asset, 'fixture asset must be created');
        return $asset['id'];
    }

    // ── fonts.delete is admin-only ────────────────────────────────────────

    public function test_fonts_delete_denies_editor() {
        $this->set_editor();
        $req = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/admin/font-library/' . wp_generate_uuid4());
        $this->assertSame(403, rest_do_request($req)->get_status(), 'editor must not delete fonts');
    }

    public function test_fonts_delete_allows_system_admin() {
        $this->set_system_admin();
        // A well-formed but non-existent id: 404 proves the System Admin passed the gate.
        $req = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/admin/font-library/' . wp_generate_uuid4());
        $this->assertSame(404, rest_do_request($req)->get_status(), 'System Admin passes the font-delete gate');
    }

    // ── layout-template in-use guard ──────────────────────────────────────

    public function test_template_delete_blocked_while_in_use() {
        $this->set_system_admin();
        $tid      = $this->make_template();
        $campaign = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => 'Bound', 'post_status' => 'publish']);
        update_post_meta($campaign, '_wpsg_layout_binding_template_id', $tid);

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/layout-templates/{$tid}");
        $res = rest_do_request($req);

        $this->assertSame(409, $res->get_status(), 'in-use template must not delete without force');
        $this->assertSame('wpsg_template_in_use', $res->get_data()['code'] ?? null);
        $this->assertNotNull(WPSG_Layout_Templates::get($tid), 'template must still exist after a blocked delete');
    }

    public function test_template_delete_force_overrides_in_use() {
        $this->set_system_admin();
        $tid      = $this->make_template();
        $campaign = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => 'Bound', 'post_status' => 'publish']);
        update_post_meta($campaign, '_wpsg_layout_binding_template_id', $tid);

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/layout-templates/{$tid}");
        $req->set_param('force', true);
        $res = rest_do_request($req);

        $this->assertSame(200, $res->get_status(), 'force=true overrides the in-use guard');
        $this->assertNull(WPSG_Layout_Templates::get($tid), 'template must be gone after a forced delete');
    }

    public function test_template_delete_succeeds_when_unused() {
        $this->set_system_admin();
        $tid = $this->make_template();

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/layout-templates/{$tid}");
        $this->assertSame(200, rest_do_request($req)->get_status(), 'an unused template deletes freely');
    }

    // ── asset in-use guard ────────────────────────────────────────────────

    public function test_asset_delete_blocked_while_associated() {
        $this->set_system_admin();
        $aid   = $this->make_asset();
        $space = WPSG_DB::insert_space(['name' => 'A5c', 'slug' => 'a5c-' . wp_generate_password(6, false), 'isolation_mode' => 'open']);
        WPSG_DB::associate_asset($space, 'asset', $aid);

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/asset-library/{$aid}");
        $res = rest_do_request($req);

        $this->assertSame(409, $res->get_status(), 'associated asset must not delete without force');
        $this->assertSame('wpsg_asset_in_use', $res->get_data()['code'] ?? null);
        $this->assertContains($aid, array_column(WPSG_Asset_Library::get_all(), 'id'), 'asset must still exist');
    }

    public function test_asset_delete_force_overrides_association() {
        $this->set_system_admin();
        $aid   = $this->make_asset();
        $space = WPSG_DB::insert_space(['name' => 'A5c', 'slug' => 'a5c-' . wp_generate_password(6, false), 'isolation_mode' => 'open']);
        WPSG_DB::associate_asset($space, 'asset', $aid);

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/asset-library/{$aid}");
        $req->set_param('force', true);
        $this->assertSame(200, rest_do_request($req)->get_status(), 'force=true overrides the asset in-use guard');
    }

    public function test_asset_delete_succeeds_when_unassociated() {
        $this->set_system_admin();
        $aid = $this->make_asset();

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/asset-library/{$aid}");
        $this->assertSame(200, rest_do_request($req)->get_status(), 'an unassociated asset deletes freely');
    }
}
