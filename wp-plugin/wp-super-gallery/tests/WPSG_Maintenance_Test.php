<?php

class WPSG_Maintenance_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        remove_all_filters('wpsg_archive_retention_days');
        wp_clear_scheduled_hook(WPSG_Maintenance::CLEANUP_HOOK);
        wp_clear_scheduled_hook(WPSG_Maintenance::TRASH_PURGE_HOOK);
        wp_clear_scheduled_hook(WPSG_Maintenance::ANALYTICS_PURGE_HOOK);
    }

    public function tearDown(): void {
        remove_all_filters('wpsg_archive_retention_days');
        wp_clear_scheduled_hook(WPSG_Maintenance::CLEANUP_HOOK);
        wp_clear_scheduled_hook(WPSG_Maintenance::TRASH_PURGE_HOOK);
        wp_clear_scheduled_hook(WPSG_Maintenance::ANALYTICS_PURGE_HOOK);
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

        $this->assertNotFalse(wp_next_scheduled(WPSG_Maintenance::CLEANUP_HOOK));
        $this->assertNotFalse(wp_next_scheduled(WPSG_Maintenance::TRASH_PURGE_HOOK));
    }

    public function test_register_skips_cron_when_retention_zero() {
        add_filter('wpsg_archive_retention_days', function () { return 0; });

        WPSG_Maintenance::register();

        $this->assertFalse(wp_next_scheduled(WPSG_Maintenance::CLEANUP_HOOK));
    }

    public function test_register_skips_cron_when_retention_negative() {
        add_filter('wpsg_archive_retention_days', function () { return -5; });

        WPSG_Maintenance::register();

        $this->assertFalse(wp_next_scheduled(WPSG_Maintenance::CLEANUP_HOOK));
    }

    // ── trash_archived_campaigns (phase 1) ─────────────────────────────────

    public function test_trash_moves_old_archived_campaigns_to_trash() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        $old_date = gmdate('Y-m-d H:i:s', strtotime('-60 days'));
        $old_id = $this->create_archived_campaign($old_date);

        WPSG_Maintenance::trash_archived_campaigns();

        $post = get_post($old_id);
        $this->assertNotNull($post, 'Post should still exist (in trash)');
        $this->assertEquals('trash', $post->post_status);
    }

    public function test_trash_keeps_recent_archived_campaigns() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        $recent_date = gmdate('Y-m-d H:i:s', strtotime('-10 days'));
        $recent_id = $this->create_archived_campaign($recent_date);

        WPSG_Maintenance::trash_archived_campaigns();

        $post = get_post($recent_id);
        $this->assertNotNull($post);
        $this->assertEquals('publish', $post->post_status);
    }

    public function test_trash_keeps_active_campaigns_even_if_old() {
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

        WPSG_Maintenance::trash_archived_campaigns();

        $post = get_post($id);
        $this->assertNotNull($post);
        $this->assertEquals('publish', $post->post_status);
    }

    public function test_trash_noop_when_retention_zero() {
        add_filter('wpsg_archive_retention_days', function () { return 0; });

        $old_date = gmdate('Y-m-d H:i:s', strtotime('-365 days'));
        $id = $this->create_archived_campaign($old_date);

        WPSG_Maintenance::trash_archived_campaigns();

        $post = get_post($id);
        $this->assertNotNull($post);
        $this->assertEquals('publish', $post->post_status);
    }

    public function test_trash_respects_custom_retention_days() {
        add_filter('wpsg_archive_retention_days', function () { return 7; });

        $eight_days = gmdate('Y-m-d H:i:s', strtotime('-8 days'));
        $six_days   = gmdate('Y-m-d H:i:s', strtotime('-6 days'));

        $old_id   = $this->create_archived_campaign($eight_days);
        $fresh_id = $this->create_archived_campaign($six_days);

        WPSG_Maintenance::trash_archived_campaigns();

        $this->assertEquals('trash', get_post($old_id)->post_status);
        $this->assertEquals('publish', get_post($fresh_id)->post_status);
    }

    // ── purge_trashed_campaigns (phase 2) ──────────────────────────────────

    public function test_purge_trashed_deletes_campaigns_past_grace_period() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        // Create a campaign and trash it with an old modified date.
        $old_date = gmdate('Y-m-d H:i:s', strtotime('-60 days'));
        $id = $this->create_archived_campaign($old_date);
        wp_trash_post($id);

        // Backdate the modified time to simulate a campaign trashed 60 days ago.
        global $wpdb;
        $wpdb->update(
            $wpdb->posts,
            ['post_modified_gmt' => $old_date],
            ['ID' => $id]
        );
        clean_post_cache($id);

        WPSG_Maintenance::purge_trashed_campaigns();

        $this->assertNull(get_post($id), 'Campaign trashed >30 days ago should be permanently deleted');
    }

    public function test_purge_trashed_keeps_recently_trashed_campaigns() {
        add_filter('wpsg_archive_retention_days', function () { return 30; });

        $recent_date = gmdate('Y-m-d H:i:s', strtotime('-5 days'));
        $id = $this->create_archived_campaign($recent_date);
        wp_trash_post($id);

        // The modified date is ~now (just trashed), well within grace period.
        WPSG_Maintenance::purge_trashed_campaigns();

        $this->assertNotNull(get_post($id), 'Recently trashed campaign should be kept');
    }
}
