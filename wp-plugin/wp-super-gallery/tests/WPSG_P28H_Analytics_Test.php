<?php

/**
 * P28-H: Analytics Expansion
 *
 * Covers:
 *  - POST /analytics/event with media_id stores it in the DB.
 *  - POST /analytics/event without media_id stores NULL.
 *  - POST /analytics/event with event_type=lightbox_open is accepted.
 *  - wpsg_analytics_event action fires for every recorded event.
 *  - GET /analytics/campaigns/{id}/media returns per-media breakdown.
 *  - GET /analytics/summary returns cross-campaign totals and top campaigns.
 *  - Date-range params respected by both new endpoints.
 */
class WPSG_P28H_Analytics_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function create_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P28-H Test Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function enable_analytics(): void {
        update_option('wpsg_settings', [ 'enable_analytics' => true ]);
    }

    public function setUp(): void {
        // DDL must run before parent::setUp() starts WP's transaction.
        // If it runs after, the implicit commit from CREATE TABLE would
        // commit update_option too, preventing parent::tearDown()'s ROLLBACK
        // from cleaning it up.
        WPSG_DB::maybe_create_analytics_table();
        parent::setUp();
        $this->enable_analytics();
    }

    public function tearDown(): void {
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();
        $wpdb->query("DELETE FROM {$table}");
        parent::tearDown();
        // delete_option after parent::tearDown() runs outside any WP transaction,
        // ensuring it commits immediately regardless of autocommit state.
        delete_option('wpsg_settings');
        wp_set_current_user(0);
    }

    // =========================================================================
    // record_analytics_event — media_id
    // =========================================================================

    public function test_event_with_media_id_stores_media_id() {
        $campaign_id = $this->create_campaign();
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $request->set_param('campaign_id', $campaign_id);
        $request->set_param('event_type', 'view');
        $request->set_param('media_id', 'media-abc-123');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status(), 'Event with media_id should be recorded.');

        $row = $wpdb->get_row("SELECT * FROM {$table} WHERE campaign_id = {$campaign_id} LIMIT 1", ARRAY_A);
        $this->assertNotNull($row, 'Row should exist.');
        $this->assertEquals('media-abc-123', $row['media_id'], 'media_id should be stored.');
    }

    public function test_event_without_media_id_stores_null() {
        $campaign_id = $this->create_campaign();
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $request->set_param('campaign_id', $campaign_id);
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());

        $row = $wpdb->get_row("SELECT * FROM {$table} WHERE campaign_id = {$campaign_id} LIMIT 1", ARRAY_A);
        $this->assertNull($row['media_id'], 'media_id should be NULL when not provided.');
    }

    public function test_event_type_lightbox_open_is_accepted() {
        $campaign_id = $this->create_campaign();
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $request->set_param('campaign_id', $campaign_id);
        $request->set_param('event_type', 'lightbox_open');
        $request->set_param('media_id', 'media-xyz');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status(), 'lightbox_open event should be accepted.');

        $row = $wpdb->get_row("SELECT * FROM {$table} WHERE campaign_id = {$campaign_id} LIMIT 1", ARRAY_A);
        $this->assertEquals('lightbox_open', $row['event_type']);
        $this->assertEquals('media-xyz', $row['media_id']);
    }

    public function test_action_hook_fires_on_event_record() {
        $campaign_id = $this->create_campaign();

        $fired_args = [];
        add_action('wpsg_analytics_event', function (...$args) use (&$fired_args) {
            $fired_args = $args;
        }, 10, 4);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $request->set_param('campaign_id', $campaign_id);
        $request->set_param('event_type', 'view');
        $request->set_param('media_id', 'hook-test-media');
        rest_do_request($request);

        $this->assertNotEmpty($fired_args, 'wpsg_analytics_event action must have fired.');
        $this->assertEquals($campaign_id, $fired_args[0], 'campaign_id should be arg 0.');
        $this->assertEquals('hook-test-media', $fired_args[1], 'media_id should be arg 1.');
        $this->assertEquals('view', $fired_args[2], 'event_type should be arg 2.');
        $this->assertNotEmpty($fired_args[3], 'visitor_hash should be arg 3.');
    }

    // =========================================================================
    // GET /analytics/campaigns/{id}/media
    // =========================================================================

    public function test_get_campaign_media_analytics_returns_breakdown() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        // Insert test rows directly.
        $now = current_time('mysql', true);
        $wpdb->insert($table, [ 'campaign_id' => $campaign_id, 'event_type' => 'view', 'visitor_hash' => 'a', 'occurred_at' => $now, 'media_id' => 'img-1' ]);
        $wpdb->insert($table, [ 'campaign_id' => $campaign_id, 'event_type' => 'view', 'visitor_hash' => 'b', 'occurred_at' => $now, 'media_id' => 'img-1' ]);
        $wpdb->insert($table, [ 'campaign_id' => $campaign_id, 'event_type' => 'lightbox_open', 'visitor_hash' => 'c', 'occurred_at' => $now, 'media_id' => 'img-1' ]);
        $wpdb->insert($table, [ 'campaign_id' => $campaign_id, 'event_type' => 'view', 'visitor_hash' => 'd', 'occurred_at' => $now, 'media_id' => 'img-2' ]);
        // Row with NULL media_id should NOT appear.
        $wpdb->insert($table, [ 'campaign_id' => $campaign_id, 'event_type' => 'view', 'visitor_hash' => 'e', 'occurred_at' => $now ]);

        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/analytics/campaigns/{$campaign_id}/media");
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $items = $response->get_data()['items'] ?? [];
        $this->assertCount(2, $items, 'Should return 2 media items.');

        $img1 = array_values(array_filter($items, fn($i) => $i['media_id'] === 'img-1'))[0] ?? null;
        $this->assertNotNull($img1);
        $this->assertEquals(2, $img1['views'], 'img-1 should have 2 view events.');
        $this->assertEquals(1, $img1['lightbox_opens'], 'img-1 should have 1 lightbox_open.');
    }

    public function test_get_campaign_media_analytics_404_for_missing_campaign() {
        $this->set_admin_user();

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/analytics/campaigns/999999/media');
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }

    // =========================================================================
    // GET /analytics/summary
    // =========================================================================

    public function test_get_analytics_summary_returns_totals_and_top_campaigns() {
        $this->set_admin_user();
        $campaign_a = $this->create_campaign();
        $campaign_b = $this->create_campaign();
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $now = current_time('mysql', true);
        // Campaign A: 3 view events, 2 unique visitors.
        $wpdb->insert($table, [ 'campaign_id' => $campaign_a, 'event_type' => 'view', 'visitor_hash' => 'v1', 'occurred_at' => $now ]);
        $wpdb->insert($table, [ 'campaign_id' => $campaign_a, 'event_type' => 'view', 'visitor_hash' => 'v1', 'occurred_at' => $now ]);
        $wpdb->insert($table, [ 'campaign_id' => $campaign_a, 'event_type' => 'view', 'visitor_hash' => 'v2', 'occurred_at' => $now ]);
        // Campaign B: 1 view event.
        $wpdb->insert($table, [ 'campaign_id' => $campaign_b, 'event_type' => 'view', 'visitor_hash' => 'v3', 'occurred_at' => $now ]);

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/analytics/summary');
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();

        $this->assertEquals(4, $data['totalViews'], 'totalViews should be 4.');
        $this->assertEquals(3, $data['uniqueVisitors'], 'uniqueVisitors should be 3.');
        $this->assertIsArray($data['topCampaigns']);
        $this->assertGreaterThanOrEqual(2, count($data['topCampaigns']));

        // Campaign A should rank first (3 views > 1 view).
        $this->assertEquals(strval($campaign_a), $data['topCampaigns'][0]['id']);
        $this->assertEquals(3, $data['topCampaigns'][0]['views']);
        $this->assertArrayHasKey('title', $data['topCampaigns'][0]);
    }

    public function test_get_analytics_summary_respects_date_range() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        // Insert an old event (more than 7 days ago).
        $old_date = gmdate('Y-m-d 00:00:00', strtotime('-10 days'));
        $wpdb->insert($table, [ 'campaign_id' => $campaign_id, 'event_type' => 'view', 'visitor_hash' => 'old', 'occurred_at' => $old_date ]);

        // Request for last 7 days only — the old event should not count.
        $from = gmdate('Y-m-d', strtotime('-7 days'));
        $to   = gmdate('Y-m-d');
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/analytics/summary');
        $request->set_param('from', $from);
        $request->set_param('to', $to);
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $this->assertEquals(0, $response->get_data()['totalViews'], 'Old events should not appear in the date range.');
    }
}
