<?php

/**
 * P47-K: Gallery Spaces — Cross-Space Isolation Enforcement
 *
 * The isolation boundary is security-shaped: this suite must fail if any read
 * path leaks one space's data/settings into another, or if delegated-mode
 * gating regresses.
 *
 * Covers:
 *  - GET /campaigns?space=ID returns only that space's campaigns.
 *  - GET /settings?space=ID returns that space's effective theme (A != B).
 *  - open mode: a manage_wpsg admin (no manage_options) is admitted.
 *  - delegated mode: that same manage_wpsg-only admin is denied (403).
 *  - delegated mode: a manage_options super-admin is always admitted (escape hatch).
 *  - delegated mode: an explicit space grantee is admitted.
 */
class WPSG_P47_Spaces_Isolation_Test extends WP_UnitTestCase {

    private function set_super_admin(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    /** manage_wpsg but NOT manage_options — the delegated-mode boundary case. */
    private function make_wpsg_only_admin(): int {
        $user_id = self::factory()->user->create([ 'role' => 'editor' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        $this->assertFalse(user_can($user_id, 'manage_options'), 'Fixture must lack manage_options.');
        return $user_id;
    }

    private function make_space(string $iso = 'open', array $overrides = []): int {
        return WPSG_DB::insert_space([
            'name'               => 'P47 Iso ' . $iso,
            'slug'               => 'p47-iso-' . wp_generate_password(6, false),
            'isolation_mode'     => $iso,
            'settings_overrides' => $overrides,
        ]);
    }

    private function create_campaign_in_space(int $space_id, string $title): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, '_wpsg_space_id', $space_id);
        return intval($id);
    }

    private function campaign_ids_for_space($space_id): array {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('space', (string) $space_id);
        $data  = rest_do_request($request)->get_data();
        $items = $data['items'] ?? [];
        return array_map(fn($c) => intval($c['id'] ?? 0), $items);
    }

    // -------------------------------------------------------------------------
    // Campaign read isolation.
    // -------------------------------------------------------------------------

    public function test_campaigns_are_filtered_by_space() {
        $this->set_super_admin();
        $space_a = $this->make_space();
        $space_b = $this->make_space();
        $camp_a  = $this->create_campaign_in_space($space_a, 'Campaign in A');
        $camp_b  = $this->create_campaign_in_space($space_b, 'Campaign in B');

        $ids_a = $this->campaign_ids_for_space($space_a);
        $this->assertContains($camp_a, $ids_a, 'Space A list must include its own campaign.');
        $this->assertNotContains($camp_b, $ids_a, 'Space A list must NOT include space B campaign.');

        $ids_b = $this->campaign_ids_for_space($space_b);
        $this->assertContains($camp_b, $ids_b);
        $this->assertNotContains($camp_a, $ids_b, 'Space B list must NOT include space A campaign.');
    }

    // -------------------------------------------------------------------------
    // Public settings isolation: distinct theme per space.
    // -------------------------------------------------------------------------

    public function test_public_settings_are_isolated_between_spaces() {
        $space_a = $this->make_space('open', [ 'theme' => 'theme-aaa' ]);
        $space_b = $this->make_space('open', [ 'theme' => 'theme-bbb' ]);

        $req_a = new WP_REST_Request('GET', '/wp-super-gallery/v1/settings');
        $req_a->set_param('space', (string) $space_a);
        $theme_a = rest_do_request($req_a)->get_data()['theme'] ?? null;

        $req_b = new WP_REST_Request('GET', '/wp-super-gallery/v1/settings');
        $req_b->set_param('space', (string) $space_b);
        $theme_b = rest_do_request($req_b)->get_data()['theme'] ?? null;

        $this->assertSame('theme-aaa', $theme_a);
        $this->assertSame('theme-bbb', $theme_b);
        $this->assertNotSame($theme_a, $theme_b, 'Per-space themes must not bleed across spaces.');
    }

    // -------------------------------------------------------------------------
    // open mode: manage_wpsg admin is admitted.
    // -------------------------------------------------------------------------

    public function test_open_space_denies_manage_wpsg_without_grant() {
        // P53-A: open-mode no longer grants implicit access to manage_wpsg editors.
        // Editors need an explicit space grant regardless of isolation mode.
        $uid   = $this->make_wpsg_only_admin();
        $space = $this->make_space('open');
        wp_set_current_user($uid);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/spaces/{$space}/settings");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'manage_wpsg without an explicit grant must be denied even an open space.');
    }

    // -------------------------------------------------------------------------
    // delegated mode: manage_wpsg-only admin is denied; super-admin escapes.
    // -------------------------------------------------------------------------

    public function test_delegated_space_denies_manage_wpsg_only_admin() {
        $uid   = $this->make_wpsg_only_admin();
        $space = $this->make_space('delegated');
        wp_set_current_user($uid);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/spaces/{$space}/settings");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'Delegated space must deny a manage_wpsg-only admin.');
    }

    public function test_delegated_space_admits_manage_options_escape_hatch() {
        $this->set_super_admin(); // administrator => manage_options
        $space = $this->make_space('delegated');

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/spaces/{$space}/settings");
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status(), 'manage_options must always reach a delegated space.');
    }

    public function test_delegated_space_admits_explicit_grantee() {
        $grantee = self::factory()->user->create([ 'role' => 'subscriber' ]);
        $space   = $this->make_space('delegated');
        WPSG_DB::update_space($space, [
            'access_grants' => [ [ 'userId' => $grantee, 'access_level' => 'viewer' ] ],
        ]);

        wp_set_current_user($grantee);
        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/spaces/{$space}/settings");
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status(), 'An explicit grantee must reach a delegated space.');
    }
}
