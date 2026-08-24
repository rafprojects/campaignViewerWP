<?php

/**
 * P40-BS1: Campaign Audit Baseline Stabilization
 *
 * Regression coverage for the full REST-mutation → REST-audit-retrieval path.
 *
 * Covers:
 *  - A known-audited REST mutation (campaign archive) produces an entry visible
 *    through GET /campaigns/{id}/audit.
 *  - The same entry is visible through GET /admin/audit-log?campaign_id={id}.
 *  - Both routes agree on the set of actions for the same campaign.
 */
class WPSG_P40_BS1_Audit_Baseline_Test extends WP_UnitTestCase {

    private function set_admin(): int {
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function create_campaign(string $title): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    public function setUp(): void {
        parent::setUp();
        WPSG_DB::maybe_create_audit_log_table();
        WPSG_DB::maybe_upgrade();
    }

    public function tearDown(): void {
        global $wpdb;
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // P40-BS1: full REST write-then-read regression tests
    // =========================================================================

    public function test_archive_mutation_appears_in_campaign_audit_endpoint() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('P40-BS1 Archive Audit Campaign');

        $archive_req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $archive_res = rest_do_request($archive_req);
        $this->assertEquals(200, $archive_res->get_status(), 'Archive mutation must succeed before checking audit.');

        $audit_req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $audit_req->set_param('id', $campaign_id);
        $data = rest_do_request($audit_req)->get_data();

        $this->assertArrayHasKey('items', $data, 'Campaign audit endpoint must return an items array.');
        $this->assertGreaterThanOrEqual(1, count($data['items']), 'At least one audit entry must appear after archive mutation.');
        $this->assertContains(
            'campaign.archived',
            array_column($data['items'], 'action'),
            'campaign.archived entry must be visible through GET /campaigns/{id}/audit.'
        );
    }

    public function test_archive_mutation_appears_in_global_audit_with_campaign_filter() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('P40-BS1 Global Audit Campaign');

        $archive_req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $this->assertEquals(200, rest_do_request($archive_req)->get_status());

        $global_req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        $global_req->set_param('campaign_id', $campaign_id);
        $data = rest_do_request($global_req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertContains(
            'campaign.archived',
            array_column($data['items'], 'action'),
            'campaign.archived entry must be visible through /admin/audit-log?campaign_id={id}.'
        );
        foreach ($data['items'] as $item) {
            $this->assertEquals(
                strval($campaign_id),
                $item['campaignId'],
                'campaign_id filter must scope all returned entries to the target campaign.'
            );
        }
    }

    public function test_campaign_route_and_global_route_agree_for_same_mutation() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('P40-BS1 Route Agreement Campaign');

        $archive_req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $this->assertEquals(200, rest_do_request($archive_req)->get_status());

        $campaign_req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $campaign_req->set_param('id', $campaign_id);
        $campaign_data = rest_do_request($campaign_req)->get_data();

        $global_req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        $global_req->set_param('campaign_id', $campaign_id);
        $global_data = rest_do_request($global_req)->get_data();

        $campaign_actions = array_column($campaign_data['items'] ?? [], 'action');
        $global_actions   = array_column($global_data['items'] ?? [], 'action');
        sort($campaign_actions);
        sort($global_actions);

        $this->assertEquals(
            $campaign_actions,
            $global_actions,
            'GET /campaigns/{id}/audit and GET /admin/audit-log?campaign_id={id} must agree on all actions for the same campaign.'
        );
    }
}
