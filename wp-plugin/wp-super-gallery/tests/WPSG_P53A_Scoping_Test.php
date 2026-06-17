<?php

/**
 * P53-A: surfacing the editor tier exposed two cross-space scoping gaps that
 * are closed here.
 *
 *  1. GET /campaigns gave ANY manage_wpsg user the unscoped "see all" view, so a
 *     delegated-space editor saw campaign metadata for spaces it cannot access.
 *     Now only a System Admin (manage_options) gets the bypass; a wpsg_editor is
 *     scoped to public campaigns (everywhere, per P53-B) + everything in the
 *     spaces it can access.
 *  2. The page-spaces list / admin-bar nodes were emitted for every manage_wpsg
 *     user without scoping. Now they are filtered to accessible spaces via
 *     WPSG_REST_Base::current_actor_can_access_space().
 */
class WPSG_P53A_Scoping_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        do_action('rest_api_init');
    }

    public function tearDown(): void {
        unset($GLOBALS['wpsg_spaces_on_page']);
        parent::tearDown();
    }

    /** Space editor: manage_wpsg but NOT manage_options. */
    private function make_editor(): int {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        return $uid;
    }

    private function make_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg'); // matches wpsg_setup_roles_and_caps()
        return $uid;
    }

    private function make_space(string $iso): int {
        return WPSG_DB::insert_space([
            'name'           => 'S ' . $iso . ' ' . wp_generate_password(5, false),
            'slug'           => 's-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
        ]);
    }

    private function grant_space(int $space_id, int $user_id): void {
        WPSG_DB::update_space($space_id, [
            'access_grants' => [['userId' => $user_id, 'access_level' => 'viewer']],
        ]);
    }

    private function campaign(int $space_id, string $visibility, string $title): int {
        $id = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => $title, 'post_status' => 'publish']);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, 'visibility', $visibility);
        update_post_meta($id, 'media_items', []);
        update_post_meta($id, '_wpsg_space_id', $space_id);
        return intval($id);
    }

    /** @return string[] campaign ids returned by GET /campaigns for the current user */
    private function list_campaign_ids(): array {
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $req->set_param('per_page', 50);
        $res = rest_do_request($req);
        $this->assertSame(200, $res->get_status());
        return array_map(static fn($c) => (string) $c['id'], $res->get_data()['items']);
    }

    // ── Campaign list scoping ─────────────────────────────────────────────

    public function test_editor_list_excludes_private_campaigns_in_any_ungranted_space() {
        $editor = $this->make_editor();
        $open   = $this->make_space('open');      // editor has NO explicit grant here
        $deleg  = $this->make_space('delegated'); // editor has NO grant here

        $a_priv = $this->campaign($open,  'private', 'A private (open)');
        $b_priv = $this->campaign($deleg, 'private', 'B private (delegated)');
        $b_pub  = $this->campaign($deleg, 'public',  'B public (delegated)');

        wp_set_current_user($editor);
        $ids = $this->list_campaign_ids();

        // P53-A (two-tier): open-mode spaces no longer grant implicit editor access.
        $this->assertNotContains((string) $a_priv, $ids, 'editor must NOT see private campaigns in an ungranted open space');
        $this->assertContains((string) $b_pub, $ids, 'editor still sees PUBLIC campaigns everywhere (P53-B)');
        $this->assertNotContains((string) $b_priv, $ids, 'editor must NOT see private campaigns in an ungranted delegated space');
    }

    public function test_system_admin_list_includes_all_campaigns() {
        $admin = $this->make_system_admin();
        $open  = $this->make_space('open');
        $deleg = $this->make_space('delegated');

        $a_priv = $this->campaign($open,  'private', 'A private');
        $b_priv = $this->campaign($deleg, 'private', 'B private');

        wp_set_current_user($admin);
        $ids = $this->list_campaign_ids();

        $this->assertContains((string) $a_priv, $ids);
        $this->assertContains((string) $b_priv, $ids, 'a System Admin keeps the unscoped view');
    }

    public function test_editor_with_grant_sees_private_campaigns_in_that_space() {
        $editor = $this->make_editor();
        $deleg  = $this->make_space('delegated');
        $this->grant_space($deleg, $editor);
        $b_priv = $this->campaign($deleg, 'private', 'B private (granted)');

        wp_set_current_user($editor);
        $this->assertContains((string) $b_priv, $this->list_campaign_ids(), 'a granted editor sees the delegated space private campaign');
    }

    // ── current_actor_can_access_space helper ─────────────────────────────

    public function test_actor_space_access_for_editor() {
        $editor = $this->make_editor();
        $open   = $this->make_space('open');
        $deleg  = $this->make_space('delegated');
        $granted = $this->make_space('delegated');
        $this->grant_space($granted, $editor);

        wp_set_current_user($editor);
        // P53-A: open-mode no longer confers implicit access; editors need explicit grants.
        $this->assertFalse(WPSG_REST_Base::current_actor_can_access_space($open), 'editor cannot access an ungranted open space');
        $this->assertFalse(WPSG_REST_Base::current_actor_can_access_space($deleg), 'editor cannot access an ungranted delegated space');
        $this->assertTrue(WPSG_REST_Base::current_actor_can_access_space($granted), 'editor accesses a space it was explicitly granted');
    }

    public function test_actor_space_access_for_system_admin() {
        $admin = $this->make_system_admin();
        $deleg = $this->make_space('delegated');
        wp_set_current_user($admin);
        $this->assertTrue(WPSG_REST_Base::current_actor_can_access_space($deleg), 'a System Admin accesses every space');
    }

    // ── Page-spaces emit filtering ────────────────────────────────────────

    private function set_page_spaces(int $a, int $b): void {
        $GLOBALS['wpsg_spaces_on_page'] = [
            'inst-a' => ['id' => $a, 'slug' => 'alpha', 'name' => 'Alpha Space'],
            'inst-b' => ['id' => $b, 'slug' => 'beta',  'name' => 'Beta Space'],
        ];
    }

    public function test_page_spaces_scoped_to_editor() {
        $editor  = $this->make_editor();
        $open    = $this->make_space('open');      // ungranted — editor should NOT see
        $deleg   = $this->make_space('delegated'); // ungranted — editor should NOT see
        $granted = $this->make_space('delegated'); // explicit grant — editor SHOULD see
        $this->grant_space($granted, $editor);

        $GLOBALS['wpsg_spaces_on_page'] = [
            'inst-a' => ['id' => $open,    'slug' => 'alpha',  'name' => 'Alpha Space'],
            'inst-b' => ['id' => $deleg,   'slug' => 'beta',   'name' => 'Beta Space'],
            'inst-c' => ['id' => $granted, 'slug' => 'gamma',  'name' => 'Gamma Space'],
        ];

        wp_set_current_user($editor);
        ob_start();
        WPSG_Embed::emit_page_spaces_js();
        $out = (string) ob_get_clean();

        // P53-A: open-mode no longer confers implicit access; only explicitly granted spaces appear.
        $this->assertStringNotContainsString('Alpha Space', $out, 'ungranted open space filtered out');
        $this->assertStringNotContainsString('Beta Space',  $out, 'ungranted delegated space filtered out');
        $this->assertStringContainsString('Gamma Space',    $out, 'explicitly granted space is offered');
    }

    public function test_page_spaces_shows_all_for_system_admin() {
        $admin = $this->make_system_admin();
        $open  = $this->make_space('open');
        $deleg = $this->make_space('delegated');
        $this->set_page_spaces($open, $deleg);

        wp_set_current_user($admin);
        ob_start();
        WPSG_Embed::emit_page_spaces_js();
        $out = (string) ob_get_clean();

        $this->assertStringContainsString('Alpha Space', $out);
        $this->assertStringContainsString('Beta Space', $out, 'a System Admin sees every page space');
    }
}
