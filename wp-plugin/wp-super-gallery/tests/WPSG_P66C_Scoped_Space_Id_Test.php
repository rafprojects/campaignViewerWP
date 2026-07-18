<?php

/**
 * P66-C: the three campaign-scoped writers that never stamped space_id
 * (analytics_events, media_refs, access_requests) now do, so space-filtered
 * queries — most visibly the analytics summary — see real, non-zero numbers.
 * A one-time backfill corrects historical rows.
 */
class WPSG_P66C_Scoped_Space_Id_Test extends WP_UnitTestCase {

    public function setUp(): void {
        WPSG_DB::maybe_create_analytics_table();
        WPSG_DB::maybe_create_media_refs_table();
        WPSG_DB::maybe_create_access_requests_table();
        parent::setUp();
        update_option('wpsg_settings', ['enable_analytics' => true]);
    }

    public function tearDown(): void {
        global $wpdb;
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_analytics_table());
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_media_refs_table());
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_access_requests_table());
        parent::tearDown();
        delete_option('wpsg_settings');
        wp_set_current_user(0);
    }

    private function set_admin_user(): void {
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);
    }

    private function create_campaign_in_space(int $space_id): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P66-C Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, '_wpsg_space_id', $space_id);
        return intval($id);
    }

    private function make_space(): int {
        return WPSG_DB::insert_space([
            'slug'           => 'delegated-' . wp_generate_password(6, false),
            'name'           => 'Delegated',
            'isolation_mode' => 'delegated',
        ]);
    }

    // ── Writer stamping ───────────────────────────────────────────────────────

    public function test_analytics_event_is_stamped_with_space_id() {
        $space_id    = $this->make_space();
        $campaign_id = $this->create_campaign_in_space($space_id);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
        $request->set_param('campaign_id', $campaign_id);
        $request->set_param('event_type', 'view');
        $this->assertSame(201, rest_do_request($request)->get_status());

        global $wpdb;
        $stored = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT space_id FROM ' . WPSG_DB::get_analytics_table() . ' WHERE campaign_id = %d LIMIT 1',
            $campaign_id
        ));
        $this->assertSame($space_id, $stored);
    }

    public function test_sync_media_refs_stamps_space_id() {
        $space_id    = $this->make_space();
        $campaign_id = $this->create_campaign_in_space($space_id);

        WPSG_DB::sync_media_refs($campaign_id, [['id' => 'm1'], ['id' => 'm2']]);

        global $wpdb;
        $rows = $wpdb->get_col($wpdb->prepare(
            'SELECT space_id FROM ' . WPSG_DB::get_media_refs_table() . ' WHERE campaign_id = %d',
            $campaign_id
        ));
        $this->assertNotEmpty($rows);
        foreach ($rows as $sid) {
            $this->assertSame($space_id, (int) $sid);
        }
    }

    public function test_insert_access_request_stamps_space_id() {
        $space_id    = $this->make_space();
        $campaign_id = $this->create_campaign_in_space($space_id);

        WPSG_DB::insert_access_request([
            'token'        => 'tok-p66c',
            'campaign_id'  => $campaign_id,
            'email'        => 'req@example.com',
            'requested_at' => gmdate('Y-m-d H:i:s'),
        ]);

        global $wpdb;
        $stored = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT space_id FROM ' . WPSG_DB::get_access_requests_table() . ' WHERE token = %s',
            'tok-p66c'
        ));
        $this->assertSame($space_id, $stored);
    }

    // ── The user-visible payoff: space-filtered summary is non-zero ───────────

    public function test_space_filtered_summary_counts_events() {
        $this->set_admin_user();
        $space_id    = $this->make_space();
        $campaign_id = $this->create_campaign_in_space($space_id);

        for ($i = 0; $i < 3; $i++) {
            $ev = new WP_REST_Request('POST', '/wp-super-gallery/v1/analytics/event');
            $ev->set_param('campaign_id', $campaign_id);
            $ev->set_param('event_type', 'view');
            rest_do_request($ev);
        }

        $summary = new WP_REST_Request('GET', '/wp-super-gallery/v1/analytics/summary');
        $summary->set_param('space', $space_id);
        $data = rest_do_request($summary)->get_data();

        $this->assertSame(3, $data['totalViews'], 'Space-filtered summary must count the events (was always 0 pre-fix)');
        $this->assertGreaterThanOrEqual(1, $data['uniqueVisitors']);
    }

    // ── Backfill of historical rows ───────────────────────────────────────────

    public function test_backfill_stamps_historical_zero_space_rows() {
        $space_id    = $this->make_space();
        $campaign_id = $this->create_campaign_in_space($space_id);

        global $wpdb;
        // Simulate a pre-fix analytics row (space_id defaulted to 0).
        $wpdb->insert(WPSG_DB::get_analytics_table(), [
            'campaign_id'  => $campaign_id,
            'event_type'   => 'view',
            'visitor_hash' => 'legacy-hash',
            'occurred_at'  => gmdate('Y-m-d H:i:s'),
            'space_id'     => 0,
        ], ['%d', '%s', '%s', '%s', '%d']);

        delete_option('wpsg_scoped_space_id_backfilled');
        $method = new ReflectionMethod('WPSG_DB', 'maybe_backfill_scoped_space_ids');
        $method->setAccessible(true);
        $method->invoke(null);

        $stored = (int) $wpdb->get_var($wpdb->prepare(
            'SELECT space_id FROM ' . WPSG_DB::get_analytics_table() . ' WHERE campaign_id = %d LIMIT 1',
            $campaign_id
        ));
        $this->assertSame($space_id, $stored, 'Backfill must set space_id from the campaign meta');
    }
}
