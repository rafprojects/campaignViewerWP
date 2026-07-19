<?php

/**
 * P66-B: one-time backfill that seeds archived_at for campaigns archived before
 * this release, so the maintenance auto-purge has a value to key off.
 *
 * archived_at is derived from the most recent `campaign.archived` audit record —
 * the DB audit-log table first, then the legacy `audit_log` post meta — falling
 * back to "now" only when no archival record exists at all.
 */
class WPSG_P66B_Archived_At_Backfill_Test extends WP_UnitTestCase {

    public function setUp(): void {
        // DDL before the WP transaction (see WPSG_P28H_Analytics_Test rationale).
        WPSG_DB::maybe_create_audit_log_table();
        parent::setUp();
        // The backfill ran once at bootstrap and set this guard; clear it so the
        // reflection-invoked run below actually executes.
        delete_option('wpsg_archived_at_backfilled');
    }

    public function tearDown(): void {
        global $wpdb;
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
        parent::tearDown();
    }

    private function run_backfill(): void {
        $method = new ReflectionMethod('WPSG_DB', 'maybe_backfill_archived_at');
        $method->setAccessible(true);
        $method->invoke(null);
    }

    private function create_archived_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P66-B Archived',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'archived');
        return intval($id);
    }

    public function test_backfill_derives_archived_at_from_db_audit_entry() {
        $id = $this->create_archived_campaign();
        WPSG_DB::insert_audit_entry([
            'campaign_id' => $id,
            'action'      => 'campaign.archived',
            'details'     => [],
            'created_at'  => '2025-01-15 10:00:00',
        ]);

        $this->run_backfill();

        $this->assertSame('2025-01-15 10:00:00', get_post_meta($id, 'archived_at', true));
    }

    public function test_backfill_uses_the_most_recent_archived_entry() {
        $id = $this->create_archived_campaign();
        // Archived, restored, archived again — the latest archival wins.
        foreach (['2024-02-01 08:00:00', '2025-06-01 09:30:00'] as $ts) {
            WPSG_DB::insert_audit_entry([
                'campaign_id' => $id,
                'action'      => 'campaign.archived',
                'details'     => [],
                'created_at'  => $ts,
            ]);
        }

        $this->run_backfill();

        $this->assertSame('2025-06-01 09:30:00', get_post_meta($id, 'archived_at', true));
    }

    public function test_backfill_falls_back_to_legacy_post_meta() {
        $id = $this->create_archived_campaign();
        // No DB audit row — only the pre-P28-G legacy audit_log post meta.
        update_post_meta($id, 'audit_log', [
            ['action' => 'campaign.created',  'createdAt' => '2023-01-01 00:00:00'],
            ['action' => 'campaign.archived', 'createdAt' => '2023-03-03 12:00:00'],
        ]);

        $this->run_backfill();

        $this->assertSame('2023-03-03 12:00:00', get_post_meta($id, 'archived_at', true));
    }

    public function test_backfill_falls_back_to_now_when_no_record_exists() {
        $id     = $this->create_archived_campaign();
        $before = strtotime(gmdate('Y-m-d H:i:s')) - 5;

        $this->run_backfill();

        $stamp = get_post_meta($id, 'archived_at', true);
        $this->assertNotEmpty($stamp);
        $this->assertGreaterThanOrEqual($before, strtotime($stamp), 'Fallback should be ~now');
    }

    public function test_backfill_leaves_existing_archived_at_untouched() {
        $id = $this->create_archived_campaign();
        update_post_meta($id, 'archived_at', '2022-12-12 12:12:12');
        WPSG_DB::insert_audit_entry([
            'campaign_id' => $id,
            'action'      => 'campaign.archived',
            'details'     => [],
            'created_at'  => '2025-01-15 10:00:00',
        ]);

        $this->run_backfill();

        $this->assertSame(
            '2022-12-12 12:12:12',
            get_post_meta($id, 'archived_at', true),
            'A campaign that already has archived_at must be skipped'
        );
    }

    public function test_backfill_ignores_non_archived_campaigns() {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Active',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');

        $this->run_backfill();

        $this->assertSame('', get_post_meta($id, 'archived_at', true));
    }
}
