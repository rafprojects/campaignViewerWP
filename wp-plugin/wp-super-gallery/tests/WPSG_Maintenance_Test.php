<?php

class WPSG_Maintenance_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        remove_all_filters('wpsg_archive_retention_days');
        wp_clear_scheduled_hook(WPSG_Maintenance::CLEANUP_HOOK);
    }

    public function tearDown(): void {
        remove_all_filters('wpsg_archive_retention_days');
        wp_clear_scheduled_hook(WPSG_Maintenance::CLEANUP_HOOK);
        parent::tearDown();
    }

    private function create_archived_campaign(string $date_gmt): int {
        $id = wp_insert_post([
            'post_type'     => 'wpsg_campaign',
            'post_title'    => 'Old Campaign',
            'post_status'   => 'publish',
            'post_date_gmt' => $date_gmt,
            'post_date'     => $date_gmt,
        ]);
        update_post_meta($id, 'status', 'archived');
        return $id;
    }

    // ── register ───────────────────────────────────────────────────────────

    public function test_register_schedules_cron_when_retention_set() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        WPSG_Maintenance::register();

        $next = wp_next_scheduled(WPSG_Maintenance::CLEANUP_HOOK);
        $this->assertNotFalse($next);
    }

    public function test_register_skips_cron_when_retention_zero() {
        add_filter('wpsg_archive_retention_days', function () { return 0; });

        WPSG_Maintenance::register();

        $next = wp_next_scheduled(WPSG_Maintenance::CLEANUP_HOOK);
        $this->assertFalse($next);
    }

    public function test_register_skips_cron_when_retention_negative() {
        add_filter('wpsg_archive_retention_days', function () { return -5; });

        WPSG_Maintenance::register();

        $next = wp_next_scheduled(WPSG_Maintenance::CLEANUP_HOOK);
        $this->assertFalse($next);
    }

    // ── purge_archived_campaigns ───────────────────────────────────────────

    public function test_purge_deletes_old_archived_campaigns() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        $old_date = gmdate('Y-m-d H:i:s', strtotime('-60 days'));
        $old_id = $this->create_archived_campaign($old_date);

        WPSG_Maintenance::purge_archived_campaigns();

        $this->assertNull(get_post($old_id));
    }

    public function test_purge_keeps_recent_archived_campaigns() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        $recent_date = gmdate('Y-m-d H:i:s', strtotime('-10 days'));
        $recent_id = $this->create_archived_campaign($recent_date);

        WPSG_Maintenance::purge_archived_campaigns();

        $this->assertNotNull(get_post($recent_id));
    }

    public function test_purge_keeps_active_campaigns_even_if_old() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        $old_date = gmdate('Y-m-d H:i:s', strtotime('-60 days'));
        $id = wp_insert_post([
            'post_type'     => 'wpsg_campaign',
            'post_title'    => 'Active Old',
            'post_status'   => 'publish',
            'post_date_gmt' => $old_date,
            'post_date'     => $old_date,
        ]);
        update_post_meta($id, 'status', 'active');

        WPSG_Maintenance::purge_archived_campaigns();

        $this->assertNotNull(get_post($id));
    }

    public function test_purge_noop_when_retention_zero() {
        add_filter('wpsg_archive_retention_days', function () { return 0; });

        $old_date = gmdate('Y-m-d H:i:s', strtotime('-365 days'));
        $id = $this->create_archived_campaign($old_date);

        WPSG_Maintenance::purge_archived_campaigns();

        // Should not delete because retention is disabled.
        $this->assertNotNull(get_post($id));
    }

    public function test_purge_respects_custom_retention_days() {
        add_filter('wpsg_archive_retention_days', function () { return 7; });

        $eight_days = gmdate('Y-m-d H:i:s', strtotime('-8 days'));
        $six_days   = gmdate('Y-m-d H:i:s', strtotime('-6 days'));

        $old_id   = $this->create_archived_campaign($eight_days);
        $fresh_id = $this->create_archived_campaign($six_days);

        WPSG_Maintenance::purge_archived_campaigns();

        $this->assertNull(get_post($old_id));
        $this->assertNotNull(get_post($fresh_id));
    }
}
