<?php

class WPSG_DB_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        // Reset db version so maybe_upgrade runs fresh.
        delete_option('wpsg_db_version');
        delete_option('wpsg_media_refs_backfilled');
    }

    public function tearDown(): void {
        global $wpdb;
        // Clean up custom tables after each test.
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}wpsg_analytics_events");
        $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}wpsg_media_refs");
        delete_option('wpsg_db_version');
        delete_option('wpsg_media_refs_backfilled');
        parent::tearDown();
    }

    // ── maybe_upgrade ──────────────────────────────────────────────────────

    public function test_maybe_upgrade_creates_tables_and_sets_version() {
        WPSG_DB::maybe_upgrade();

        $this->assertEquals(WPSG_DB::DB_VERSION, get_option('wpsg_db_version'));

        // Analytics table should exist.
        global $wpdb;
        $analytics = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}wpsg_analytics_events'");
        $this->assertNotNull($analytics);

        // Media refs table should exist.
        $refs = $wpdb->get_var("SHOW TABLES LIKE '{$wpdb->prefix}wpsg_media_refs'");
        $this->assertNotNull($refs);
    }

    public function test_maybe_upgrade_is_idempotent() {
        WPSG_DB::maybe_upgrade();
        $v1 = get_option('wpsg_db_version');

        // Second call should be a no-op.
        WPSG_DB::maybe_upgrade();
        $v2 = get_option('wpsg_db_version');

        $this->assertEquals($v1, $v2);
    }

    public function test_maybe_upgrade_skips_when_version_current() {
        update_option('wpsg_db_version', WPSG_DB::DB_VERSION);

        WPSG_DB::maybe_upgrade();

        // Tables won't exist because upgrade was skipped.
        global $wpdb;
        // We only assert the option wasn't changed.
        $this->assertEquals(WPSG_DB::DB_VERSION, get_option('wpsg_db_version'));
    }

    // ── Table name helpers ─────────────────────────────────────────────────

    public function test_get_analytics_table_returns_prefixed_name() {
        global $wpdb;
        $this->assertEquals($wpdb->prefix . 'wpsg_analytics_events', WPSG_DB::get_analytics_table());
    }

    public function test_get_media_refs_table_returns_prefixed_name() {
        global $wpdb;
        $this->assertEquals($wpdb->prefix . 'wpsg_media_refs', WPSG_DB::get_media_refs_table());
    }

    // ── Analytics table ────────────────────────────────────────────────────

    public function test_maybe_create_analytics_table_has_expected_columns() {
        WPSG_DB::maybe_create_analytics_table();

        global $wpdb;
        $cols = $wpdb->get_results("DESCRIBE {$wpdb->prefix}wpsg_analytics_events");
        $col_names = array_map(function ($c) { return $c->Field; }, $cols);

        $this->assertContains('id', $col_names);
        $this->assertContains('campaign_id', $col_names);
        $this->assertContains('event_type', $col_names);
        $this->assertContains('visitor_hash', $col_names);
        $this->assertContains('occurred_at', $col_names);
    }

    // ── Media refs: sync, lookup, delete ───────────────────────────────────

    private function create_refs_table(): void {
        WPSG_DB::maybe_create_media_refs_table();
    }

    private function create_campaign(string $title = 'Test', array $media = []): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        if (!empty($media)) {
            update_post_meta($id, 'media_items', $media);
        }
        return $id;
    }

    public function test_sync_media_refs_inserts_rows() {
        $this->create_refs_table();
        $cid = $this->create_campaign();

        WPSG_DB::sync_media_refs($cid, [
            ['id' => 'media-1'],
            ['id' => 'media-2'],
        ]);

        $usage = WPSG_DB::get_media_usage('media-1');
        $this->assertCount(1, $usage);
        $this->assertEquals(strval($cid), $usage[0]['id']);
    }

    public function test_sync_media_refs_deduplicates_ids() {
        $this->create_refs_table();
        $cid = $this->create_campaign();

        WPSG_DB::sync_media_refs($cid, [
            ['id' => 'dup-1'],
            ['id' => 'dup-1'],
            ['id' => 'dup-1'],
        ]);

        $summary = WPSG_DB::get_media_usage_summary(['dup-1']);
        $this->assertEquals(1, $summary['dup-1']);
    }

    public function test_sync_media_refs_skips_empty_ids() {
        $this->create_refs_table();
        $cid = $this->create_campaign();

        WPSG_DB::sync_media_refs($cid, [
            ['id' => ''],
            ['id' => 'valid-1'],
            ['foo' => 'bar'],
        ]);

        global $wpdb;
        $count = $wpdb->get_var(
            $wpdb->prepare("SELECT COUNT(*) FROM " . WPSG_DB::get_media_refs_table() . " WHERE campaign_id = %d", $cid)
        );
        $this->assertEquals(1, intval($count));
    }

    public function test_sync_media_refs_replaces_previous_refs() {
        $this->create_refs_table();
        $cid = $this->create_campaign();

        WPSG_DB::sync_media_refs($cid, [
            ['id' => 'old-1'],
            ['id' => 'old-2'],
        ]);
        $this->assertCount(1, WPSG_DB::get_media_usage('old-1'));

        // Replace with new set.
        WPSG_DB::sync_media_refs($cid, [
            ['id' => 'new-1'],
        ]);

        $this->assertCount(0, WPSG_DB::get_media_usage('old-1'));
        $this->assertCount(0, WPSG_DB::get_media_usage('old-2'));
        $this->assertCount(1, WPSG_DB::get_media_usage('new-1'));
    }

    public function test_get_media_usage_returns_campaign_title() {
        $this->create_refs_table();
        $cid = $this->create_campaign('My Gallery');

        WPSG_DB::sync_media_refs($cid, [['id' => 'title-check']]);

        $usage = WPSG_DB::get_media_usage('title-check');
        $this->assertEquals('My Gallery', $usage[0]['title']);
    }

    public function test_get_media_usage_returns_empty_for_unknown_id() {
        $this->create_refs_table();
        $usage = WPSG_DB::get_media_usage('nonexistent');
        $this->assertIsArray($usage);
        $this->assertEmpty($usage);
    }

    public function test_get_media_usage_across_multiple_campaigns() {
        $this->create_refs_table();
        $c1 = $this->create_campaign('Camp A');
        $c2 = $this->create_campaign('Camp B');

        WPSG_DB::sync_media_refs($c1, [['id' => 'shared']]);
        WPSG_DB::sync_media_refs($c2, [['id' => 'shared']]);

        $usage = WPSG_DB::get_media_usage('shared');
        $this->assertCount(2, $usage);
    }

    public function test_get_media_usage_summary_returns_counts() {
        $this->create_refs_table();
        $c1 = $this->create_campaign('S1');
        $c2 = $this->create_campaign('S2');

        WPSG_DB::sync_media_refs($c1, [['id' => 'a'], ['id' => 'b']]);
        WPSG_DB::sync_media_refs($c2, [['id' => 'a']]);

        $summary = WPSG_DB::get_media_usage_summary(['a', 'b', 'c']);
        $this->assertEquals(2, $summary['a']);
        $this->assertEquals(1, $summary['b']);
        $this->assertEquals(0, $summary['c']);
    }

    public function test_get_media_usage_summary_handles_empty_array() {
        $this->create_refs_table();
        $summary = WPSG_DB::get_media_usage_summary([]);
        $this->assertIsArray($summary);
        $this->assertEmpty($summary);
    }

    public function test_delete_media_refs_removes_only_target_campaign() {
        $this->create_refs_table();
        $c1 = $this->create_campaign('Del1');
        $c2 = $this->create_campaign('Del2');

        WPSG_DB::sync_media_refs($c1, [['id' => 'x']]);
        WPSG_DB::sync_media_refs($c2, [['id' => 'x']]);

        WPSG_DB::delete_media_refs($c1);

        $usage = WPSG_DB::get_media_usage('x');
        $this->assertCount(1, $usage);
        $this->assertEquals(strval($c2), $usage[0]['id']);
    }

    public function test_delete_media_refs_noop_for_unknown_campaign() {
        $this->create_refs_table();
        // Should not throw.
        WPSG_DB::delete_media_refs(99999);
        $this->assertTrue(true);
    }

    // ── Backfill ───────────────────────────────────────────────────────────

    public function test_backfill_populates_refs_from_existing_campaigns() {
        // Create campaign with media_items BEFORE creating refs table.
        $cid = $this->create_campaign('Backfill Test', [
            ['id' => 'bf-1'],
            ['id' => 'bf-2'],
        ]);

        // Now create the refs table — backfill should run.
        $this->create_refs_table();

        $usage = WPSG_DB::get_media_usage('bf-1');
        $this->assertCount(1, $usage);
        $this->assertEquals(strval($cid), $usage[0]['id']);

        $usage2 = WPSG_DB::get_media_usage('bf-2');
        $this->assertCount(1, $usage2);
    }

    public function test_backfill_runs_only_once() {
        $this->create_refs_table();
        $this->assertEquals('1', get_option('wpsg_media_refs_backfilled'));

        // Reset and recreate — should not backfill because flag is set.
        // We test by checking the flag is still set after second call.
        WPSG_DB::maybe_create_media_refs_table();
        $this->assertEquals('1', get_option('wpsg_media_refs_backfilled'));
    }
}
