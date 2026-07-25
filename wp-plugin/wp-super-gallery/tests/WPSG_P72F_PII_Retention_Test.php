<?php

/**
 * P72-F: opt-in retention purge for the two PII tables
 * (wp_wpsg_access_requests — visitor emails; wp_wpsg_audit_log — staff logins).
 *
 * Both retention windows default to 0 (never purge) so existing installs are
 * never surprised by data loss. A non-zero window purges rows older than the
 * window on the weekly cron, mirroring the analytics purge job.
 */
class WPSG_P72F_PII_Retention_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        $this->reset();
    }

    public function tearDown(): void {
        $this->reset();
        parent::tearDown();
    }

    private function reset(): void {
        global $wpdb;
        delete_option(WPSG_Settings::OPTION_NAME);
        wp_clear_scheduled_hook(WPSG_Maintenance::ACCESS_REQUESTS_PURGE_HOOK);
        wp_clear_scheduled_hook(WPSG_Maintenance::AUDIT_LOG_PURGE_HOOK);
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_access_requests_table());
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
    }

    private function set_retention(string $key, int $days): void {
        update_option(WPSG_Settings::OPTION_NAME, [$key => $days]);
    }

    private function seed_access_request(string $email, string $requested_at): void {
        WPSG_DB::insert_access_request([
            'token'        => wp_generate_uuid4(),
            'campaign_id'  => 0,
            'email'        => $email,
            'status'       => 'pending',
            'requested_at' => $requested_at,
        ]);
    }

    private function seed_audit_entry(string $actor_login, string $created_at): void {
        WPSG_DB::insert_audit_entry([
            'campaign_id' => 0,
            'action'      => 'test.event',
            'actor_id'    => 0,
            'actor_login' => $actor_login,
            'details'     => [],
            'created_at'  => $created_at,
            'scope'       => 'system',
        ]);
    }

    private function count_access_requests(): int {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        return (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . WPSG_DB::get_access_requests_table());
    }

    private function count_audit_entries(): int {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        return (int) $wpdb->get_var('SELECT COUNT(*) FROM ' . WPSG_DB::get_audit_log_table());
    }

    // ── access_requests purge ───────────────────────────────────────────────

    public function test_purge_access_requests_removes_only_rows_past_window() {
        $this->set_retention('access_requests_retention_days', 30);
        $this->seed_access_request('old@example.com', gmdate('Y-m-d H:i:s', strtotime('-90 days')));
        $this->seed_access_request('recent@example.com', gmdate('Y-m-d H:i:s', strtotime('-5 days')));

        $this->assertSame(2, $this->count_access_requests());

        WPSG_Maintenance::purge_old_access_requests();

        $this->assertSame(1, $this->count_access_requests(), 'only the row older than 30 days should be purged');

        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $remaining = $wpdb->get_var('SELECT email FROM ' . WPSG_DB::get_access_requests_table());
        $this->assertSame('recent@example.com', $remaining, 'the recent row must survive');
    }

    public function test_purge_access_requests_noop_when_window_zero() {
        $this->set_retention('access_requests_retention_days', 0);
        $this->seed_access_request('old@example.com', gmdate('Y-m-d H:i:s', strtotime('-9999 days')));

        WPSG_Maintenance::purge_old_access_requests();

        $this->assertSame(1, $this->count_access_requests(), 'a zero window purges nothing (opt-in)');
    }

    // ── audit_log purge ─────────────────────────────────────────────────────

    public function test_purge_audit_log_removes_only_rows_past_window() {
        $this->set_retention('audit_log_retention_days', 30);
        $this->seed_audit_entry('olduser', gmdate('Y-m-d H:i:s', strtotime('-90 days')));
        $this->seed_audit_entry('recentuser', gmdate('Y-m-d H:i:s', strtotime('-5 days')));

        $this->assertSame(2, $this->count_audit_entries());

        WPSG_Maintenance::purge_old_audit_log();

        $this->assertSame(1, $this->count_audit_entries(), 'only the row older than 30 days should be purged');

        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $remaining = $wpdb->get_var('SELECT actor_login FROM ' . WPSG_DB::get_audit_log_table());
        $this->assertSame('recentuser', $remaining, 'the recent row must survive');
    }

    public function test_purge_audit_log_noop_when_window_zero() {
        $this->set_retention('audit_log_retention_days', 0);
        $this->seed_audit_entry('olduser', gmdate('Y-m-d H:i:s', strtotime('-9999 days')));

        WPSG_Maintenance::purge_old_audit_log();

        $this->assertSame(1, $this->count_audit_entries(), 'a zero window purges nothing (opt-in)');
    }

    // ── scheduling ──────────────────────────────────────────────────────────

    public function test_register_schedules_purge_hooks_when_windows_set() {
        update_option(WPSG_Settings::OPTION_NAME, [
            'access_requests_retention_days' => 30,
            'audit_log_retention_days'       => 60,
        ]);

        WPSG_Maintenance::register();

        $this->assertNotFalse(wp_next_scheduled(WPSG_Maintenance::ACCESS_REQUESTS_PURGE_HOOK));
        $this->assertNotFalse(wp_next_scheduled(WPSG_Maintenance::AUDIT_LOG_PURGE_HOOK));
    }

    public function test_register_clears_purge_hooks_when_windows_zero() {
        // Pre-schedule, then register with zero windows — must clear.
        wp_schedule_event(time() + 3600, 'weekly', WPSG_Maintenance::ACCESS_REQUESTS_PURGE_HOOK);
        wp_schedule_event(time() + 3600, 'weekly', WPSG_Maintenance::AUDIT_LOG_PURGE_HOOK);
        update_option(WPSG_Settings::OPTION_NAME, [
            'access_requests_retention_days' => 0,
            'audit_log_retention_days'       => 0,
        ]);

        WPSG_Maintenance::register();

        $this->assertFalse(wp_next_scheduled(WPSG_Maintenance::ACCESS_REQUESTS_PURGE_HOOK));
        $this->assertFalse(wp_next_scheduled(WPSG_Maintenance::AUDIT_LOG_PURGE_HOOK));
    }
}
