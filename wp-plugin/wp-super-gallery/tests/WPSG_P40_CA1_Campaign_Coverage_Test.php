<?php

/**
 * P40-CA1: Campaign-Scoped Audit Coverage Expansion
 *
 * Regression coverage for the new campaign-scoped audit entries introduced in
 * P40-CA1: duplicate rejection, forced upload bypass, export, import, and
 * batch partial-failure severity.
 *
 * Covers:
 *  - media.duplicate_rejected written when an exact duplicate is detected and
 *    campaign_id is supplied.
 *  - media.upload_forced written when a forced upload bypasses duplicate checks.
 *  - campaign.exported written when a JSON export is requested.
 *  - campaign.imported written with summary and resource fields (JSON import).
 *  - media.batch_created carries severity='warning' when some items failed.
 */
class WPSG_P40_CA1_Campaign_Coverage_Test extends WP_UnitTestCase {

    private function set_admin(): int {
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function create_campaign(string $title): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function create_temp_gif(string $suffix = ''): string {
        $path = tempnam(sys_get_temp_dir(), 'wpsg-ca1gif' . $suffix . '-');
        file_put_contents($path, base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='));
        return $path;
    }

    private function make_upload_request(string $tmp_path, string $filename, int $campaign_id = 0, bool $force = false): WP_REST_Request {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/upload');
        $request->set_file_params([
            'file' => [
                'name'     => $filename,
                'type'     => 'image/gif',
                'tmp_name' => $tmp_path,
                'error'    => UPLOAD_ERR_OK,
                'size'     => filesize($tmp_path),
            ],
        ]);
        if ($campaign_id > 0) {
            $request->set_param('campaign_id', $campaign_id);
        }
        if ($force) {
            $request->set_param('force', true);
        }
        return $request;
    }

    private function get_audit_actions(int $campaign_id): array {
        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        return array_column(rest_do_request($req)->get_data()['items'] ?? [], 'action');
    }

    private function get_audit_entries(int $campaign_id): array {
        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        return rest_do_request($req)->get_data()['items'] ?? [];
    }

    public function setUp(): void {
        parent::setUp();
        WPSG_DB::maybe_create_audit_log_table();
        WPSG_DB::maybe_upgrade();
        add_filter('wpsg_allow_non_http_uploads', '__return_true');
    }

    public function tearDown(): void {
        global $wpdb;
        remove_all_filters('wpsg_allow_non_http_uploads');
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // media.duplicate_rejected
    // =========================================================================

    public function test_duplicate_file_with_campaign_id_writes_audit_entry() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Duplicate Audit Campaign');

        // First upload — seeds the MD5.
        $tmp1 = $this->create_temp_gif('ca1-first');
        $res1 = rest_do_request($this->make_upload_request($tmp1, 'first.gif', $campaign_id));
        $this->assertEquals(201, $res1->get_status(), 'First upload must succeed.');

        // Second upload of identical bytes — must trigger 409 and write audit entry.
        $tmp2 = $this->create_temp_gif('ca1-second');
        $res2 = rest_do_request($this->make_upload_request($tmp2, 'second.gif', $campaign_id));
        $this->assertEquals(409, $res2->get_status(), 'Duplicate upload must return 409.');

        $actions = $this->get_audit_actions($campaign_id);
        $this->assertContains('media.duplicate_rejected', $actions, 'media.duplicate_rejected must appear in campaign audit log.');
    }

    public function test_duplicate_file_without_campaign_id_does_not_write_audit_entry() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 No-Campaign Duplicate Campaign');

        $tmp1 = $this->create_temp_gif('ca1-nocampaign-first');
        rest_do_request($this->make_upload_request($tmp1, 'first.gif'));

        $tmp2 = $this->create_temp_gif('ca1-nocampaign-second');
        $res2 = rest_do_request($this->make_upload_request($tmp2, 'second.gif'));
        $this->assertEquals(409, $res2->get_status());

        // No campaign_id supplied → no campaign-scoped audit entry.
        $actions = $this->get_audit_actions($campaign_id);
        $this->assertNotContains('media.duplicate_rejected', $actions, 'Without campaign_id no audit entry should be written.');
    }

    public function test_duplicate_rejection_audit_entry_has_warning_severity_and_summary() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Duplicate Severity Campaign');

        $tmp1 = $this->create_temp_gif('ca1-sev-first');
        rest_do_request($this->make_upload_request($tmp1, 'orig.gif', $campaign_id));

        $tmp2 = $this->create_temp_gif('ca1-sev-second');
        rest_do_request($this->make_upload_request($tmp2, 'dup.gif', $campaign_id));

        $entries = $this->get_audit_entries($campaign_id);
        $dup_entries = array_values(array_filter($entries, fn($e) => $e['action'] === 'media.duplicate_rejected'));

        $this->assertNotEmpty($dup_entries, 'media.duplicate_rejected entry must exist.');
        $this->assertEquals('warning', $dup_entries[0]['severity'], 'Duplicate rejection must carry warning severity.');
        $this->assertNotEmpty($dup_entries[0]['summary'], 'Duplicate rejection entry must have a summary.');
        $this->assertStringContainsString('dup.gif', $dup_entries[0]['summary'], 'Summary must include the rejected filename.');
    }

    // =========================================================================
    // media.upload_forced
    // =========================================================================

    public function test_forced_upload_with_campaign_id_writes_upload_forced_audit_entry() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Forced Upload Campaign');

        $tmp1 = $this->create_temp_gif('ca1-force-first');
        rest_do_request($this->make_upload_request($tmp1, 'orig.gif', $campaign_id));

        $tmp2 = $this->create_temp_gif('ca1-force-second');
        $res2 = rest_do_request($this->make_upload_request($tmp2, 'forced.gif', $campaign_id, true));
        $this->assertEquals(201, $res2->get_status(), 'Forced upload must succeed.');

        $actions = $this->get_audit_actions($campaign_id);
        $this->assertContains('media.upload_forced', $actions, 'media.upload_forced must appear in campaign audit log.');
    }

    public function test_forced_upload_audit_entry_has_summary() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Forced Summary Campaign');

        $tmp1 = $this->create_temp_gif('ca1-forcesummary-first');
        rest_do_request($this->make_upload_request($tmp1, 'original.gif', $campaign_id));

        $tmp2 = $this->create_temp_gif('ca1-forcesummary-second');
        rest_do_request($this->make_upload_request($tmp2, 'bypass.gif', $campaign_id, true));

        $entries = $this->get_audit_entries($campaign_id);
        $forced = array_values(array_filter($entries, fn($e) => $e['action'] === 'media.upload_forced'));

        $this->assertNotEmpty($forced, 'media.upload_forced entry must exist.');
        $this->assertNotEmpty($forced[0]['summary'], 'Forced upload entry must have a summary.');
        $this->assertStringContainsString('bypass.gif', $forced[0]['summary']);
    }

    // =========================================================================
    // campaign.exported (JSON)
    // =========================================================================

    public function test_json_export_writes_campaign_exported_audit_entry() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Export Audit Campaign');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/export");
        $req->set_param('id', $campaign_id);
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status(), 'Export request must succeed.');

        $actions = $this->get_audit_actions($campaign_id);
        $this->assertContains('campaign.exported', $actions, 'campaign.exported must appear in campaign audit log after JSON export.');
    }

    public function test_json_export_audit_entry_carries_format_and_summary() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Export Meta Campaign');

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/export");
        $req->set_param('id', $campaign_id);
        rest_do_request($req);

        $entries = $this->get_audit_entries($campaign_id);
        $exported = array_values(array_filter($entries, fn($e) => $e['action'] === 'campaign.exported'));

        $this->assertNotEmpty($exported, 'campaign.exported entry must exist.');
        $this->assertNotEmpty($exported[0]['summary'], 'campaign.exported must have a summary.');
        $this->assertStringContainsString('json', strtolower($exported[0]['summary']));
    }

    // =========================================================================
    // campaign.imported (JSON)
    // =========================================================================

    public function test_json_import_writes_campaign_imported_with_summary() {
        $this->set_admin();

        $payload = wp_json_encode([
            'version'  => 1,
            'campaign' => [
                'title'      => 'CA1 Imported Campaign',
                'status'     => 'draft',
                'visibility' => 'private',
            ],
            'media_references' => [],
        ]);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/import');
        $req->set_header('Content-Type', 'application/json');
        $req->set_body($payload);

        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'Import request must succeed.');

        $post_id = $res->get_data()['id'] ?? 0;
        $this->assertGreaterThan(0, $post_id, 'Imported campaign must have a valid post ID.');

        $entries = $this->get_audit_entries(intval($post_id));
        $imported = array_values(array_filter($entries, fn($e) => $e['action'] === 'campaign.imported'));

        $this->assertNotEmpty($imported, 'campaign.imported must appear in the new campaign audit log.');
        $this->assertNotEmpty($imported[0]['summary'], 'campaign.imported entry must carry a summary.');
        $this->assertStringContainsString('CA1 Imported Campaign', $imported[0]['summary']);
    }

    // =========================================================================
    // media.batch_created severity
    // =========================================================================

    public function test_batch_created_with_all_valid_items_has_info_severity() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Batch Info Campaign');

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media/batch");
        $req->set_param('id', $campaign_id);
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode([
            'items' => [
                ['type' => 'image', 'source' => 'external', 'url' => 'https://example.com/a.jpg', 'order' => 1],
            ],
        ]));
        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'All-valid batch must return 201.');

        $entries = $this->get_audit_entries($campaign_id);
        $batch   = array_values(array_filter($entries, fn($e) => $e['action'] === 'media.batch_created'));

        $this->assertNotEmpty($batch, 'media.batch_created audit entry must be written on successful batch.');
        $this->assertEquals('info', $batch[0]['severity'], 'All-success batch_created must have info severity.');
    }

    public function test_batch_created_with_failures_has_warning_severity() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CA1 Batch Warning Campaign');

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media/batch");
        $req->set_param('id', $campaign_id);
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode([
            'items' => [
                ['type' => 'image', 'source' => 'external', 'url' => 'https://example.com/ok.jpg', 'order' => 1],
                ['type' => 'invalid_type', 'source' => 'external', 'url' => 'https://example.com/bad.jpg', 'order' => 2],
            ],
        ]));
        $res  = rest_do_request($req);
        $data = $res->get_data();

        $this->assertEquals(201, $res->get_status(), 'Partial-success batch must return 201.');
        $this->assertCount(1, $data['added'], 'Exactly one valid item must be added.');
        $this->assertCount(1, $data['failed'], 'Exactly one invalid item must be rejected.');

        $entries = $this->get_audit_entries($campaign_id);
        $batch   = array_values(array_filter($entries, fn($e) => $e['action'] === 'media.batch_created'));

        $this->assertNotEmpty($batch, 'media.batch_created must be written when some items succeeded.');
        $this->assertEquals('warning', $batch[0]['severity'], 'Partial-failure batch must have warning severity.');
    }
}
