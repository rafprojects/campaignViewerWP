<?php

/**
 * P72-B: WordPress core privacy integration (DSAR export/erase).
 *
 * Access requests (visitor emails): full export + erase.
 * Audit log (staff usernames): export ONLY — a legitimate-interest record that
 * must not be erasable by a self-service request. These tests lock that
 * asymmetry and exercise each callback against seeded rows.
 */
class WPSG_P72B_Privacy_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_access_requests_table());
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
    }

    private function seed_access_request(string $email): void {
        WPSG_DB::insert_access_request([
            'token'        => wp_generate_uuid4(),
            'campaign_id'  => 0,
            'email'        => $email,
            'status'       => 'pending',
            'requested_at' => gmdate('Y-m-d H:i:s'),
        ]);
    }

    private function seed_audit_entry(int $actor_id, string $actor_login): void {
        WPSG_DB::insert_audit_entry([
            'campaign_id' => 0,
            'action'      => 'settings.updated',
            'actor_id'    => $actor_id,
            'actor_login' => $actor_login,
            'details'     => [],
            'created_at'  => gmdate('Y-m-d H:i:s'),
            'scope'       => 'system',
            'summary'     => 'Test action',
        ]);
    }

    // ── Registration asymmetry (the core P72-B decision) ────────────────────

    public function test_both_exporters_are_registered() {
        $exporters = WPSG_Privacy::register_exporters([]);
        $this->assertArrayHasKey('wpsg-access-requests', $exporters);
        $this->assertArrayHasKey('wpsg-audit-log', $exporters, 'audit log IS exportable');
    }

    public function test_only_access_requests_eraser_is_registered() {
        $erasers = WPSG_Privacy::register_erasers([]);
        $this->assertArrayHasKey('wpsg-access-requests', $erasers);
        $this->assertArrayNotHasKey(
            'wpsg-audit-log',
            $erasers,
            'audit log must NOT be erasable — it is a legitimate-interest record (export-only)'
        );
    }

    // ── Access-request exporter ─────────────────────────────────────────────

    public function test_export_access_requests_returns_matching_rows() {
        $this->seed_access_request('subject@example.com');
        $this->seed_access_request('subject@example.com');
        $this->seed_access_request('someone-else@example.com');

        $result = WPSG_Privacy::export_access_requests('subject@example.com');

        $this->assertTrue($result['done']);
        $this->assertCount(2, $result['data'], 'only the subject email\'s two rows are exported');
        $this->assertSame('wpsg-access-requests', $result['data'][0]['group_id']);
        // The email value is present in the exported data.
        $emails = array_column($result['data'][0]['data'], 'value', 'name');
        $this->assertSame('subject@example.com', $emails['Email'] ?? null);
    }

    public function test_export_access_requests_is_case_insensitive() {
        $this->seed_access_request('Subject@Example.com');

        $result = WPSG_Privacy::export_access_requests('subject@example.com');

        $this->assertCount(1, $result['data'], 'email match must be case-insensitive');
    }

    // ── Access-request eraser ───────────────────────────────────────────────

    public function test_erase_access_requests_removes_only_the_subject_rows() {
        $this->seed_access_request('subject@example.com');
        $this->seed_access_request('someone-else@example.com');

        $result = WPSG_Privacy::erase_access_requests('subject@example.com');

        $this->assertTrue($result['items_removed']);
        $this->assertTrue($result['done']);

        // The subject's row is gone; the other email's row remains.
        $this->assertCount(0, WPSG_DB::get_access_requests_by_email('subject@example.com', 100, 0));
        $this->assertCount(1, WPSG_DB::get_access_requests_by_email('someone-else@example.com', 100, 0));
    }

    public function test_erase_access_requests_reports_nothing_removed_for_unknown_email() {
        $result = WPSG_Privacy::erase_access_requests('nobody@example.com');
        $this->assertFalse($result['items_removed']);
        $this->assertTrue($result['done']);
    }

    // ── Audit-log exporter ──────────────────────────────────────────────────

    public function test_export_audit_log_returns_rows_for_the_matching_user() {
        $uid  = self::factory()->user->create(['role' => 'administrator', 'user_email' => 'staff@example.com']);
        $user = get_user_by('id', $uid);
        $this->seed_audit_entry($uid, $user->user_login);
        $this->seed_audit_entry($uid, $user->user_login);

        $result = WPSG_Privacy::export_audit_log('staff@example.com');

        $this->assertTrue($result['done']);
        $this->assertCount(2, $result['data']);
        $this->assertSame('wpsg-audit-log', $result['data'][0]['group_id']);
    }

    public function test_export_audit_log_matches_by_actor_login_when_id_absent() {
        $uid  = self::factory()->user->create(['role' => 'administrator', 'user_email' => 'legacy@example.com']);
        $user = get_user_by('id', $uid);
        // Legacy-shaped row: actor_id 0, only actor_login recorded.
        $this->seed_audit_entry(0, $user->user_login);

        $result = WPSG_Privacy::export_audit_log('legacy@example.com');

        $this->assertCount(1, $result['data'], 'a login-only row must still match');
    }

    public function test_export_audit_log_empty_for_email_with_no_user() {
        $this->seed_audit_entry(999, 'ghost');
        $result = WPSG_Privacy::export_audit_log('no-such-user@example.com');
        $this->assertSame([], $result['data']);
        $this->assertTrue($result['done']);
    }
}
