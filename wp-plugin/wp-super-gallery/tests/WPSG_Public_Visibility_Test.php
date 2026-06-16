<?php

/**
 * Public campaigns are world-viewable.
 *
 * Regression guard for the bug where a logged-in user without access to a
 * campaign's space saw LESS than an anonymous visitor: the space-isolation gate
 * in can_view_campaign() ran before the `public` check and hid public campaigns
 * from non-members. Public campaigns (in schedule window, not draft) must now be
 * viewable by everyone; private/draft/out-of-window content stays space-gated.
 */
class WPSG_Public_Visibility_Test extends WP_UnitTestCase {

    /** A delegated space the test users have no grant on (so the space gate denies them). */
    private function delegated_space(): int {
        return WPSG_DB::insert_space([
            'name'           => 'PV',
            'slug'           => 'pv-' . wp_generate_password(6, false),
            'isolation_mode' => 'delegated',
        ]);
    }

    private function campaign(int $space_id, string $visibility, string $status = 'active', array $meta = []): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'PV campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', $status);
        update_post_meta($id, 'visibility', $visibility);
        update_post_meta($id, '_wpsg_space_id', $space_id);
        foreach ($meta as $k => $v) {
            update_post_meta($id, $k, $v);
        }
        return intval($id);
    }

    private function get_status(int $campaign_id): int {
        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        return rest_do_request($req)->get_status();
    }

    // ── Public = viewable by everyone, even in an inaccessible space ──────────

    public function test_logged_in_non_member_can_view_public_campaign() {
        $space = $this->delegated_space();
        $cid   = $this->campaign($space, 'public');
        wp_set_current_user(self::factory()->user->create(['role' => 'subscriber']));

        $this->assertSame(200, $this->get_status($cid), 'a logged-in non-member must see a public campaign');
    }

    public function test_anonymous_can_view_public_campaign() {
        $space = $this->delegated_space();
        $cid   = $this->campaign($space, 'public');
        wp_set_current_user(0);

        $this->assertSame(200, $this->get_status($cid), 'an anonymous visitor must see a public campaign');
    }

    // ── Private content stays space-gated ────────────────────────────────────

    public function test_logged_in_non_member_cannot_view_private_campaign() {
        $space = $this->delegated_space();
        $cid   = $this->campaign($space, 'private');
        wp_set_current_user(self::factory()->user->create(['role' => 'subscriber']));

        $this->assertSame(403, $this->get_status($cid), 'a private campaign stays hidden from a non-member');
    }

    public function test_anonymous_cannot_view_private_campaign() {
        $space = $this->delegated_space();
        $cid   = $this->campaign($space, 'private');
        wp_set_current_user(0);

        $this->assertSame(403, $this->get_status($cid));
    }

    // ── Schedule window still applies to public ──────────────────────────────

    public function test_out_of_window_public_not_universally_visible() {
        $space = $this->delegated_space();
        // unpublish_at in the past → outside the schedule window.
        $cid   = $this->campaign($space, 'public', 'active', ['unpublish_at' => '2000-01-01 00:00:00']);
        wp_set_current_user(self::factory()->user->create(['role' => 'subscriber']));

        $this->assertSame(403, $this->get_status($cid), 'an out-of-window public campaign does not get the universal pass');
    }
}
