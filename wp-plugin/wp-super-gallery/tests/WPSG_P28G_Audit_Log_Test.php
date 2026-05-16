<?php

/**
 * P28-G: Audit Log Improvements
 *
 * Covers:
 *  - wpsg_audit_log table created by WPSG_DB::maybe_create_audit_log_table().
 *  - GET /campaigns/{id}/audit?from=&to= returns date-filtered entries.
 *  - GET /campaigns/{id}/audit?action= returns action-filtered entries.
 *  - Backfill from post meta runs on first query when table is empty.
 *  - GET /admin/audit-log returns entries across all campaigns.
 *  - GET /admin/audit-log with Accept: text/csv returns Content-Type: text/csv.
 *  - PHPUnit: pagination, date filter, action filter, CSV export header.
 */
class WPSG_P28G_Audit_Log_Test extends WP_UnitTestCase {

    private function set_admin(): void {
        $admin_id = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin_id);
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
    }

    public function tearDown(): void {
        global $wpdb;
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // Table creation
    // =========================================================================

    public function test_audit_log_table_exists() {
        global $wpdb;
        $table  = WPSG_DB::get_audit_log_table();
        $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
        $this->assertEquals($table, $exists, 'wpsg_audit_log table must exist after maybe_create_audit_log_table().');
    }

    // =========================================================================
    // Backfill from post meta
    // =========================================================================

    public function test_backfill_from_post_meta_on_first_query() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Backfill Campaign');

        // Seed legacy post meta entries.
        $legacy = [
            ['id' => 'u1', 'action' => 'media.created', 'details' => [], 'userId' => 1, 'createdAt' => '2026-01-10T10:00:00Z'],
            ['id' => 'u2', 'action' => 'campaign.updated', 'details' => [], 'userId' => 1, 'createdAt' => '2026-01-11T10:00:00Z'],
        ];
        update_post_meta($campaign_id, 'audit_log', $legacy);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertCount(2, $data['items'], 'Backfill must populate both post-meta entries into the DB.');
        $actions = array_column($data['items'], 'action');
        $this->assertContains('media.created', $actions);
        $this->assertContains('campaign.updated', $actions);
    }

    // =========================================================================
    // Date range filter
    // =========================================================================

    public function test_audit_date_range_filter() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Date Filter Campaign');

        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'early.event', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-05 09:00:00']);
        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'mid.event', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-02-15 09:00:00']);
        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'late.event', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-03-20 09:00:00']);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        $req->set_param('from', '2026-02-01');
        $req->set_param('to', '2026-02-28');
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertCount(1, $data['items'], 'Only the February entry should be returned.');
        $this->assertEquals('mid.event', $data['items'][0]['action']);
    }

    // =========================================================================
    // Action filter
    // =========================================================================

    public function test_audit_action_filter() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Action Filter Campaign');

        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'media.added', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-01 10:00:00']);
        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'access.granted', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-02 10:00:00']);
        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'media.added', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-03 10:00:00']);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        $req->set_param('action', 'media.added');
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertCount(2, $data['items'], 'Only media.added entries should be returned.');
        foreach ($data['items'] as $item) {
            $this->assertEquals('media.added', $item['action']);
        }
    }

    // =========================================================================
    // Pagination on filtered results
    // =========================================================================

    public function test_audit_pagination_with_action_filter() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Paginated Audit Campaign');

        for ($i = 1; $i <= 5; $i++) {
            WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'media.added', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => gmdate('Y-m-d H:i:s', strtotime("2026-01-0{$i} 10:00:00"))]);
        }
        WPSG_DB::insert_audit_entry(['campaign_id' => $campaign_id, 'action' => 'access.granted', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-06 10:00:00']);

        $req1 = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req1->set_param('id', $campaign_id);
        $req1->set_param('action', 'media.added');
        $req1->set_param('per_page', 3);
        $req1->set_param('page', 1);
        $data1 = rest_do_request($req1)->get_data();

        $this->assertCount(3, $data1['items']);
        $this->assertEquals(5, $data1['total']);
        $this->assertEquals(2, $data1['total_pages']);

        $req2 = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req2->set_param('id', $campaign_id);
        $req2->set_param('action', 'media.added');
        $req2->set_param('per_page', 3);
        $req2->set_param('page', 2);
        $data2 = rest_do_request($req2)->get_data();

        $this->assertCount(2, $data2['items']);
    }

    // =========================================================================
    // GET /admin/audit-log — cross-campaign
    // =========================================================================

    public function test_global_audit_returns_entries_across_campaigns() {
        $this->set_admin();
        $c1 = $this->create_campaign('Global Audit C1');
        $c2 = $this->create_campaign('Global Audit C2');

        WPSG_DB::insert_audit_entry(['campaign_id' => $c1, 'action' => 'media.created', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-01 10:00:00']);
        WPSG_DB::insert_audit_entry(['campaign_id' => $c2, 'action' => 'access.granted', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-02 10:00:00']);

        $req  = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertGreaterThanOrEqual(2, $data['total'], 'Global audit must return entries from all campaigns.');

        $campaign_ids = array_column($data['items'], 'campaignId');
        $this->assertContains(strval($c1), $campaign_ids);
        $this->assertContains(strval($c2), $campaign_ids);
    }

    public function test_global_audit_campaign_id_filter() {
        $this->set_admin();
        $c1 = $this->create_campaign('Global Filter C1');
        $c2 = $this->create_campaign('Global Filter C2');

        WPSG_DB::insert_audit_entry(['campaign_id' => $c1, 'action' => 'media.created', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-01 10:00:00']);
        WPSG_DB::insert_audit_entry(['campaign_id' => $c2, 'action' => 'access.granted', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-02 10:00:00']);

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        $req->set_param('campaign_id', $c1);
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        foreach ($data['items'] as $item) {
            $this->assertEquals(strval($c1), $item['campaignId'], 'campaign_id filter must restrict to one campaign.');
        }
    }

    // =========================================================================
    // CSV export header
    // =========================================================================

    public function test_global_audit_csv_content_type_header() {
        $this->set_admin();
        $c1 = $this->create_campaign('CSV Campaign');
        WPSG_DB::insert_audit_entry(['campaign_id' => $c1, 'action' => 'media.created', 'actor_id' => 1, 'actor_login' => 'admin', 'details' => [], 'created_at' => '2026-01-01 10:00:00']);

        // Simulate the Accept: text/csv header via $_SERVER.
        $_SERVER['HTTP_ACCEPT'] = 'text/csv';

        $req      = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        $response = rest_do_request($req);

        unset($_SERVER['HTTP_ACCEPT']);

        $content_type = $response->get_header('Content-Type');
        $this->assertNotEmpty($content_type, 'Content-Type header must be set for CSV response.');
        $this->assertStringContainsString('text/csv', $content_type);
    }
}
