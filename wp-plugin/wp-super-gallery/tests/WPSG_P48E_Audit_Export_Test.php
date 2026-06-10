<?php

/**
 * P48-E: Audit log binary export REST endpoint tests.
 */
class WPSG_P48E_Audit_Export_Test extends WP_UnitTestCase {

    private int $admin_id;

    public function setUp(): void {
        parent::setUp();
        $this->admin_id = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $this->admin_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($this->admin_id);
        WPSG_CPT::register();
    }

    public function tearDown(): void {
        delete_option(WPSG_Export_Engine::JOB_INDEX_OPT);
        parent::tearDown();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function insert_audit_entry(int $campaign_id, string $action = 'campaign.updated'): void {
        WPSG_DB::insert_audit_entry([
            'campaign_id'    => $campaign_id,
            'actor_id'       => $this->admin_id,
            'actor_login'    => 'admin',
            'action'         => $action,
            'details'        => '{}',
            'scope'          => 'campaign',
            'severity'       => 'info',
            'summary'        => 'Test entry',
            'resource_type'  => 'campaign',
            'resource_id'    => (string) $campaign_id,
            'resource_label' => 'Test Campaign',
            'source'         => 'rest',
        ]);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /** Route returns 503 when ZipArchive is unavailable. */
    public function test_returns_503_when_zip_unavailable(): void {
        if (WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ZipArchive is available; 503 path not reachable in this environment.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/audit-log/export/binary');
        $res = rest_do_request($req);
        $this->assertSame(503, $res->get_status());
    }

    /** POST /admin/audit-log/export/binary returns 202 with a jobId. */
    public function test_returns_job_id_with_audit_entries(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required for this test.');
        }

        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Audit Campaign',
            'post_status' => 'publish',
        ]);
        $this->insert_audit_entry($campaign_id);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/audit-log/export/binary');
        $res = rest_do_request($req);

        $this->assertSame(202, $res->get_status(), 'Expected 202 Accepted.');
        $data = $res->get_data();
        $this->assertIsArray($data);
        $this->assertArrayHasKey('jobId', $data);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $data['jobId']);
        $this->assertSame('pending', $data['status']);
    }

    /** POST with date-range filter creates a job containing only matching entries. */
    public function test_date_range_filter_accepted(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required for this test.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/audit-log/export/binary');
        $req->set_param('from', '2020-01-01');
        $req->set_param('to', '2020-01-31');
        $res = rest_do_request($req);

        // Even with no matching entries the route should succeed (empty ZIP).
        $this->assertSame(202, $res->get_status(), 'Expected 202 even for empty result set.');
        $data = $res->get_data();
        $this->assertArrayHasKey('jobId', $data);
    }

    /** The job transient is stored and retrievable after enqueueing. */
    public function test_job_is_retrievable_after_enqueue(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required for this test.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/audit-log/export/binary');
        $res = rest_do_request($req);

        $this->assertSame(202, $res->get_status());
        $job_id = $res->get_data()['jobId'];
        $job    = WPSG_Export_Engine::get_job($job_id);

        $this->assertIsArray($job);
        $this->assertSame('audit', $job['type']);
        $this->assertContains($job['status'], ['pending', 'processing', 'complete']);
    }

    /** Non-admin gets 403. */
    public function test_requires_admin_permission(): void {
        $subscriber = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($subscriber);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/audit-log/export/binary');
        $res = rest_do_request($req);

        $this->assertSame(403, $res->get_status());
        wp_set_current_user($this->admin_id);
    }
}
