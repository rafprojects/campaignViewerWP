<?php

/**
 * P50-A: Cross-Space Campaign Move
 *
 * Covers:
 *  - POST /campaigns/{id}/move re-stamps space_id in all four campaign-scoped
 *    custom tables and the _wpsg_space_id post meta.
 *  - The source space's campaign list no longer includes the campaign and the
 *    target space's list does.
 *  - A simulated mid-transaction failure (after the second table) rolls every
 *    table back and leaves the post meta unchanged.
 *  - A manage_wpsg-only user is denied when the target space is delegated.
 *  - Moving a campaign already in the target space is a no-op (200, moved=false).
 *  - Moving into an archived space is rejected.
 *
 * NOTE: move_campaign_to_space() opens a real transaction, which implicitly
 * commits the WP test framework's per-test wrapper transaction. Fixtures
 * created before the move therefore outlive the automatic teardown rollback;
 * every test that invokes the move path calls cleanup_move_fixtures() (with an
 * explicit COMMIT) so no rows leak into later tests.
 */
class WPSG_P50A_Campaign_Move_Test extends WP_UnitTestCase {

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

    private function make_space(string $iso = 'open'): int {
        return WPSG_DB::insert_space([
            'name'           => 'P50A ' . $iso,
            'slug'           => 'p50a-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
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

    private function campaign_ids_for_space(int $space_id): array {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('space', (string) $space_id);
        $data  = rest_do_request($request)->get_data();
        $items = $data['items'] ?? [];
        return array_map(fn($c) => intval($c['id'] ?? 0), $items);
    }

    private function move_tables(): array {
        return [
            WPSG_DB::get_analytics_table(),
            WPSG_DB::get_audit_log_table(),
            WPSG_DB::get_media_refs_table(),
            WPSG_DB::get_access_requests_table(),
        ];
    }

    /** Insert one row per campaign-scoped table, stamped with $space_id. */
    private function seed_campaign_rows(int $campaign_id, int $space_id): void {
        global $wpdb;
        $now = gmdate('Y-m-d H:i:s');

        $wpdb->insert(WPSG_DB::get_analytics_table(), [
            'campaign_id'  => $campaign_id,
            'event_type'   => 'view',
            'visitor_hash' => str_repeat('a', 64),
            'occurred_at'  => $now,
            'space_id'     => $space_id,
        ]);
        $wpdb->insert(WPSG_DB::get_audit_log_table(), [
            'campaign_id' => $campaign_id,
            'action'      => 'p50a.seed',
            'details'     => '{}',
            'created_at'  => $now,
            'space_id'    => $space_id,
        ]);
        $wpdb->insert(WPSG_DB::get_media_refs_table(), [
            // Random suffix: post IDs can repeat across runs (auto-increment
            // resets after rollbacks), and media_id+campaign_id is unique.
            'media_id'    => 'p50a-media-' . $campaign_id . '-' . wp_generate_password(6, false),
            'campaign_id' => $campaign_id,
            'space_id'    => $space_id,
        ]);
        $wpdb->insert(WPSG_DB::get_access_requests_table(), [
            'token'        => wp_generate_uuid4(),
            'campaign_id'  => $campaign_id,
            'email'        => 'p50a@example.com',
            'status'       => 'pending',
            'requested_at' => $now,
            'space_id'     => $space_id,
        ]);
    }

    /** space_id values per table for the campaign, keyed by table name. */
    private function space_ids_by_table(int $campaign_id): array {
        global $wpdb;
        $out = [];
        foreach ($this->move_tables() as $table) {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $out[$table] = array_map('intval', $wpdb->get_col($wpdb->prepare(
                "SELECT space_id FROM {$table} WHERE campaign_id = %d",
                $campaign_id
            )));
        }
        return $out;
    }

    private function do_move(int $campaign_id, int $target_space_id): WP_REST_Response {
        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/move");
        $request->set_param('target_space_id', $target_space_id);
        return rest_do_request($request);
    }

    /**
     * Remove fixtures that the move's real transaction committed past the test
     * wrapper, then COMMIT so the deletes themselves survive teardown rollback.
     */
    private function cleanup_move_fixtures(array $campaign_ids, array $space_ids): void {
        global $wpdb;
        foreach ($campaign_ids as $campaign_id) {
            foreach ($this->move_tables() as $table) {
                $wpdb->delete($table, ['campaign_id' => $campaign_id], ['%d']);
            }
            wp_delete_post($campaign_id, true);
        }
        foreach ($space_ids as $space_id) {
            WPSG_DB::delete_space($space_id);
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->query('COMMIT');
    }

    // -------------------------------------------------------------------------
    // Happy path: every table and the post meta land in the target space.
    // -------------------------------------------------------------------------

    public function test_move_restamps_all_tables_and_post_meta() {
        $this->set_super_admin();
        $space_a  = $this->make_space();
        $space_b  = $this->make_space();
        $campaign = $this->create_campaign_in_space($space_a, 'P50A Move Me');
        $this->seed_campaign_rows($campaign, $space_a);

        $response = $this->do_move($campaign, $space_b);

        $this->assertSame(200, $response->get_status());
        $this->assertTrue($response->get_data()['moved']);
        $this->assertSame($space_b, intval(get_post_meta($campaign, '_wpsg_space_id', true)));

        foreach ($this->space_ids_by_table($campaign) as $table => $space_ids) {
            $this->assertNotEmpty($space_ids, "{$table} must have a seeded row.");
            foreach ($space_ids as $space_id) {
                $this->assertSame($space_b, $space_id, "{$table} row must be re-stamped to the target space.");
            }
        }

        $this->assertNotContains($campaign, $this->campaign_ids_for_space($space_a), 'Source space must no longer list the campaign.');
        $this->assertContains($campaign, $this->campaign_ids_for_space($space_b), 'Target space must list the campaign.');

        $this->cleanup_move_fixtures([$campaign], [$space_a, $space_b]);
    }

    // -------------------------------------------------------------------------
    // Rollback: simulated failure after the second table leaves no changes.
    // -------------------------------------------------------------------------

    public function test_mid_transaction_failure_rolls_back_all_tables() {
        $this->set_super_admin();
        $space_a  = $this->make_space();
        $space_b  = $this->make_space();
        $campaign = $this->create_campaign_in_space($space_a, 'P50A Rollback');
        $this->seed_campaign_rows($campaign, $space_a);

        // Fail on the third table (media refs) — after two successful updates.
        $fail_table = WPSG_DB::get_media_refs_table();
        $simulate   = fn($fail, $table) => $table === $fail_table ? true : $fail;
        add_filter('wpsg_move_campaign_simulate_failure', $simulate, 10, 2);

        $response = $this->do_move($campaign, $space_b);

        remove_filter('wpsg_move_campaign_simulate_failure', $simulate, 10);

        $this->assertSame(500, $response->get_status());
        $this->assertSame('wpsg_move_failed', $response->get_data()['code']);

        $this->assertSame($space_a, intval(get_post_meta($campaign, '_wpsg_space_id', true)), 'Post meta must be unchanged after rollback.');
        foreach ($this->space_ids_by_table($campaign) as $table => $space_ids) {
            foreach ($space_ids as $space_id) {
                $this->assertSame($space_a, $space_id, "{$table} row must be rolled back to the source space.");
            }
        }

        $this->cleanup_move_fixtures([$campaign], [$space_a, $space_b]);
    }

    // -------------------------------------------------------------------------
    // Authorization: manage_wpsg-only user cannot move into a delegated space.
    // -------------------------------------------------------------------------

    public function test_manage_wpsg_only_user_denied_for_delegated_target() {
        $uid      = $this->make_wpsg_only_admin();
        $space_a  = $this->make_space('open');
        $space_b  = $this->make_space('delegated');
        $campaign = $this->create_campaign_in_space($space_a, 'P50A Denied');

        wp_set_current_user($uid);
        $response = $this->do_move($campaign, $space_b);

        $this->assertSame(403, $response->get_status(), 'manage_wpsg-only user must not move a campaign into a delegated space.');
        $this->assertSame($space_a, intval(get_post_meta($campaign, '_wpsg_space_id', true)));
    }

    // -------------------------------------------------------------------------
    // No-op: moving to the current space performs no writes.
    // -------------------------------------------------------------------------

    public function test_move_to_same_space_is_a_noop() {
        $this->set_super_admin();
        $space_a  = $this->make_space();
        $campaign = $this->create_campaign_in_space($space_a, 'P50A Same Space');

        $response = $this->do_move($campaign, $space_a);

        $this->assertSame(200, $response->get_status());
        $this->assertFalse($response->get_data()['moved']);
        $this->assertSame($space_a, intval(get_post_meta($campaign, '_wpsg_space_id', true)));
    }

    // -------------------------------------------------------------------------
    // Archived target space is rejected.
    // -------------------------------------------------------------------------

    public function test_move_to_archived_space_is_rejected() {
        $this->set_super_admin();
        $space_a  = $this->make_space();
        $space_b  = $this->make_space();
        $campaign = $this->create_campaign_in_space($space_a, 'P50A Archived Target');
        WPSG_DB::archive_space($space_b);

        $response = $this->do_move($campaign, $space_b);

        $this->assertSame(404, $response->get_status());
        $this->assertSame($space_a, intval(get_post_meta($campaign, '_wpsg_space_id', true)));
    }
}
