<?php

/**
 * P52-A5b: per-campaign endpoints are space-scoped (closes F2).
 *
 * Previously `require_admin` (bare manage_wpsg) let a space editor act on ANY
 * campaign — including campaigns in delegated spaces they were never granted.
 * Now per-campaign admin endpoints (analytics, audit, per-campaign export) and
 * the batch endpoints require manage_wpsg AND access to the target campaign's
 * space. System Admins (manage_options) keep the escape hatch; plain
 * subscribers (no manage_wpsg) remain denied. `GET /spaces` is filtered to the
 * caller's accessible spaces.
 */
class WPSG_P52A5b_Campaign_Space_Scoping_Test extends WP_UnitTestCase {

    private function set_super_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    /** manage_wpsg but NOT manage_options — the delegated-mode boundary case. */
    private function make_editor(): int {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        $this->assertFalse(user_can($uid, 'manage_options'), 'fixture must lack manage_options');
        return $uid;
    }

    private function make_space(string $iso = 'open'): int {
        return WPSG_DB::insert_space([
            'name'           => 'A5b ' . $iso,
            'slug'           => 'a5b-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
        ]);
    }

    private function grant_space(int $space_id, int $user_id, string $level = 'editor'): void {
        WPSG_DB::update_space($space_id, [
            'access_grants' => [['userId' => $user_id, 'access_level' => $level]],
        ]);
    }

    private function campaign_in_space(int $space_id): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'A5b campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, '_wpsg_space_id', $space_id);
        return intval($id);
    }

    /** GET /campaigns/{id}/audit — a per-campaign admin endpoint (campaign.audit.read). */
    private function audit_status(int $campaign_id): int {
        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        return rest_do_request($req)->get_status();
    }

    // ── Single-campaign space scoping ─────────────────────────────────────

    public function test_open_space_editor_allowed() {
        $space    = $this->make_space('open');
        $campaign = $this->campaign_in_space($space);
        wp_set_current_user($this->make_editor());

        $this->assertSame(200, $this->audit_status($campaign), 'open-mode editor may read campaign audit');
    }

    public function test_delegated_space_editor_without_grant_denied() {
        $space    = $this->make_space('delegated');
        $campaign = $this->campaign_in_space($space);
        wp_set_current_user($this->make_editor());

        // F2: previously this returned 200 (bare manage_wpsg). Must be 403 now.
        $this->assertSame(403, $this->audit_status($campaign), 'delegated-space editor without grant must be denied');
    }

    public function test_delegated_space_editor_with_grant_allowed() {
        $editor   = $this->make_editor();
        $space    = $this->make_space('delegated');
        $this->grant_space($space, $editor, 'editor');
        $campaign = $this->campaign_in_space($space);
        wp_set_current_user($editor);

        $this->assertSame(200, $this->audit_status($campaign), 'granted editor may act in a delegated space');
    }

    public function test_delegated_space_super_admin_allowed() {
        $this->set_super_admin();
        $space    = $this->make_space('delegated');
        $campaign = $this->campaign_in_space($space);

        $this->assertSame(200, $this->audit_status($campaign), 'manage_options is the escape hatch');
    }

    public function test_subscriber_with_grant_still_denied_admin_endpoint() {
        // A plain subscriber granted into the space is NOT an admin — per-campaign
        // admin endpoints stay manage_wpsg-tier.
        $sub   = self::factory()->user->create(['role' => 'subscriber']);
        $space = $this->make_space('open');
        $this->grant_space($space, $sub, 'owner');
        $campaign = $this->campaign_in_space($space);
        wp_set_current_user($sub);

        $this->assertSame(403, $this->audit_status($campaign), 'subscriber (no manage_wpsg) denied admin endpoint');
    }

    // ── Batch space scoping ───────────────────────────────────────────────

    public function test_batch_denied_when_any_campaign_is_cross_space() {
        $editor   = $this->make_editor();
        $open     = $this->make_space('open');           // editor has access (open)
        $foreign  = $this->make_space('delegated');      // editor has NO grant
        $mine     = $this->campaign_in_space($open);
        $theirs   = $this->campaign_in_space($foreign);
        wp_set_current_user($editor);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/batch');
        $req->set_param('action', 'archive');
        $req->set_param('ids', [$mine, $theirs]);
        $this->assertSame(403, rest_do_request($req)->get_status(), 'a cross-space id must deny the whole batch');
    }

    public function test_batch_allowed_when_all_campaigns_accessible() {
        $editor = $this->make_editor();
        $open   = $this->make_space('open');
        $a      = $this->campaign_in_space($open);
        $b      = $this->campaign_in_space($open);
        wp_set_current_user($editor);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/batch');
        $req->set_param('action', 'archive');
        $req->set_param('ids', [$a, $b]);
        $this->assertSame(200, rest_do_request($req)->get_status(), 'batch within accessible spaces proceeds');
    }

    // ── spaces.list filtering ─────────────────────────────────────────────

    public function test_spaces_list_is_filtered_for_editor() {
        $editor    = $this->make_editor();
        $open      = $this->make_space('open');        // accessible (open + manage_wpsg)
        $delegated = $this->make_space('delegated');   // not accessible (no grant)
        wp_set_current_user($editor);

        $req  = new WP_REST_Request('GET', '/wp-super-gallery/v1/spaces');
        $ids  = array_map(fn($s) => intval($s['id']), rest_do_request($req)->get_data());

        $this->assertContains($open, $ids, 'editor sees accessible (open) space');
        $this->assertNotContains($delegated, $ids, 'editor must NOT see a delegated space they cannot access');
    }

    public function test_spaces_list_unfiltered_for_super_admin() {
        $open      = $this->make_space('open');
        $delegated = $this->make_space('delegated');
        $this->set_super_admin();

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/spaces');
        $ids = array_map(fn($s) => intval($s['id']), rest_do_request($req)->get_data());

        $this->assertContains($open, $ids);
        $this->assertContains($delegated, $ids, 'System Admin sees every space');
    }
}
