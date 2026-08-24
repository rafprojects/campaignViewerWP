<?php

/**
 * P36-C: Draft Visibility Permission Matrix
 *
 * Desired rule: campaigns with status = 'draft' are visible only to their
 * WordPress post_author and to site admins (manage_options). Granted-access
 * non-admin users and anonymous users must not see drafts.
 *
 * Matrix:
 *  role                       | list | single-fetch | list_media
 *  ---------------------------|------|--------------|----------
 *  admin (manage_options)     | yes  | yes          | yes
 *  author (post_author)       | yes  | yes          | yes
 *  granted-access non-admin   | no   | 403          | 403
 *  granted-access admin       | yes  | yes          | yes (admin bypass)
 *  anonymous                  | no   | 403          | 403
 */
class WPSG_P36C_Draft_Permissions_Test extends WP_UnitTestCase {

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function create_subscriber(): int {
        return (int) self::factory()->user->create(['role' => 'subscriber']);
    }

    /**
     * Create a draft campaign owned by $author_id.
     */
    private function create_draft_campaign(int $author_id = 0): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Draft Campaign',
            'post_status' => 'publish',
            'post_author' => $author_id,
        ]);
        update_post_meta($id, 'status', 'draft');
        update_post_meta($id, 'visibility', 'public'); // public visibility so only status gates it
        return (int) $id;
    }

    /**
     * Create an active (non-draft) public campaign.
     */
    private function create_active_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Active Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, 'visibility', 'public');
        return (int) $id;
    }

    private function grant_user(int $campaign_id, int $user_id): void {
        $grants   = get_post_meta($campaign_id, 'access_grants', true);
        $grants   = is_array($grants) ? $grants : [];
        $grants[] = [
            'userId'       => $user_id,
            'campaignId'   => $campaign_id,
            'source'       => 'campaign',
            'grantedAt'    => gmdate('c'),
            'access_level' => 'viewer',
        ];
        update_post_meta($campaign_id, 'access_grants', $grants);
    }

    private function list_request(): array {
        $req  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $resp = rest_do_request($req);
        return (array) ($resp->get_data()['items'] ?? []);
    }

    private function fetch_campaign(int $campaign_id): WP_REST_Response {
        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        return rest_do_request($req);
    }

    private function list_media(int $campaign_id): WP_REST_Response {
        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media");
        return rest_do_request($req);
    }

    private function campaign_ids_in_list(): array {
        return array_map(fn($item) => (int) ($item['id'] ?? 0), $this->list_request());
    }

    // ── Admin sees all drafts ─────────────────────────────────────────────────

    public function test_admin_sees_draft_in_list() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_draft_campaign($admin_id);

        $this->assertContains($campaign_id, $this->campaign_ids_in_list());
    }

    public function test_admin_can_single_fetch_draft() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_draft_campaign($admin_id);

        $resp = $this->fetch_campaign($campaign_id);
        $this->assertEquals(200, $resp->get_status());
        $this->assertEquals($campaign_id, (int) ($resp->get_data()['id'] ?? 0));
    }

    public function test_admin_can_list_media_for_draft() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_draft_campaign($admin_id);

        $resp = $this->list_media($campaign_id);
        $this->assertEquals(200, $resp->get_status());
    }

    // ── Author sees their own draft ───────────────────────────────────────────

    public function test_author_sees_own_draft_in_list() {
        $admin_id    = $this->set_admin_user();
        $author_id   = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($author_id);

        wp_set_current_user($author_id);
        $this->assertContains($campaign_id, $this->campaign_ids_in_list());
    }

    public function test_author_can_single_fetch_own_draft() {
        $admin_id    = $this->set_admin_user();
        $author_id   = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($author_id);

        wp_set_current_user($author_id);
        $resp = $this->fetch_campaign($campaign_id);
        $this->assertEquals(200, $resp->get_status());
    }

    public function test_author_cannot_see_another_users_draft_in_list() {
        $admin_id    = $this->set_admin_user();
        $author_id   = $this->create_subscriber();
        $other_id    = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($author_id);

        wp_set_current_user($other_id);
        $this->assertNotContains($campaign_id, $this->campaign_ids_in_list());
    }

    public function test_author_cannot_single_fetch_another_users_draft() {
        $admin_id    = $this->set_admin_user();
        $author_id   = $this->create_subscriber();
        $other_id    = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($author_id);

        wp_set_current_user($other_id);
        $resp = $this->fetch_campaign($campaign_id);
        $this->assertEquals(403, $resp->get_status());
    }

    // ── Granted-access non-admin: drafts hidden ───────────────────────────────

    public function test_granted_non_admin_draft_excluded_from_list() {
        $admin_id    = $this->set_admin_user();
        $viewer_id   = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($admin_id);
        $this->grant_user($campaign_id, $viewer_id);

        wp_set_current_user($viewer_id);
        $this->assertNotContains($campaign_id, $this->campaign_ids_in_list());
    }

    public function test_granted_non_admin_denied_single_fetch_of_draft() {
        $admin_id    = $this->set_admin_user();
        $viewer_id   = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($admin_id);
        $this->grant_user($campaign_id, $viewer_id);

        wp_set_current_user($viewer_id);
        $resp = $this->fetch_campaign($campaign_id);
        $this->assertEquals(403, $resp->get_status());
    }

    public function test_granted_non_admin_denied_list_media_for_draft() {
        $admin_id    = $this->set_admin_user();
        $viewer_id   = $this->create_subscriber();
        $campaign_id = $this->create_draft_campaign($admin_id);
        $this->grant_user($campaign_id, $viewer_id);

        wp_set_current_user($viewer_id);
        $resp = $this->list_media($campaign_id);
        $this->assertEquals(403, $resp->get_status());
    }

    // ── Anonymous: drafts hidden ──────────────────────────────────────────────

    public function test_anonymous_draft_excluded_from_list() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_draft_campaign($admin_id);

        wp_set_current_user(0);
        $this->assertNotContains($campaign_id, $this->campaign_ids_in_list());
    }

    public function test_anonymous_denied_single_fetch_of_draft() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_draft_campaign($admin_id);

        wp_set_current_user(0);
        $resp = $this->fetch_campaign($campaign_id);
        $this->assertEquals(403, $resp->get_status());
    }

    public function test_anonymous_denied_list_media_for_draft() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_draft_campaign($admin_id);

        wp_set_current_user(0);
        $resp = $this->list_media($campaign_id);
        $this->assertEquals(403, $resp->get_status());
    }

    // ── Regression: active campaigns are unaffected ───────────────────────────

    public function test_anonymous_sees_public_active_campaign_in_list() {
        $this->set_admin_user();
        $campaign_id = $this->create_active_campaign();

        wp_set_current_user(0);
        $this->assertContains($campaign_id, $this->campaign_ids_in_list());
    }

    public function test_granted_user_sees_active_campaign_in_list() {
        $admin_id    = $this->set_admin_user();
        $viewer_id   = $this->create_subscriber();
        $campaign_id = $this->create_active_campaign();
        update_post_meta($campaign_id, 'visibility', 'private');
        $this->grant_user($campaign_id, $viewer_id);

        wp_set_current_user($viewer_id);
        $this->assertContains($campaign_id, $this->campaign_ids_in_list());
    }
}
