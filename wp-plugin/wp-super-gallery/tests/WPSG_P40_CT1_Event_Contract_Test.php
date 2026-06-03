<?php

/**
 * P40-CT1: Canonical Audit Event Contract
 *
 * Regression coverage for the expanded audit log schema:
 *  - All seven new columns are present in the table after migration.
 *  - insert_audit_entry stores new fields; format_audit_entry returns them.
 *  - list_audit_entries correctly filters by scope and severity.
 *  - REST endpoints forward scope/severity query params to the DB layer.
 */
class WPSG_P40_CT1_Event_Contract_Test extends WP_UnitTestCase {

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

    private function insert(int $campaign_id, string $action, array $extra = []): void {
        WPSG_DB::insert_audit_entry(array_merge([
            'campaign_id' => $campaign_id,
            'action'      => $action,
            'details'     => [],
        ], $extra));
    }

    public function setUp(): void {
        parent::setUp();
        WPSG_DB::maybe_create_audit_log_table();
        WPSG_DB::maybe_upgrade();
    }

    public function tearDown(): void {
        global $wpdb;
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // Schema presence
    // =========================================================================

    public function test_new_columns_exist_in_audit_log_table() {
        global $wpdb;
        $table   = WPSG_DB::get_audit_log_table();
        $columns = $wpdb->get_col("SHOW COLUMNS FROM `{$table}`", 0); // phpcs:ignore

        foreach (['severity', 'scope', 'summary', 'resource_type', 'resource_id', 'resource_label', 'source'] as $col) {
            $this->assertContains($col, $columns, "Column '{$col}' must be present after CT1 migration.");
        }
    }

    // =========================================================================
    // Round-trip: insert → format returns all new fields
    // =========================================================================

    public function test_insert_and_format_round_trip_new_fields() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CT1 Round-Trip Campaign');

        $this->insert($campaign_id, 'media.created', [
            'details'        => ['filename' => 'photo.jpg'],
            'severity'       => 'info',
            'scope'          => 'campaign',
            'summary'        => 'Photo uploaded',
            'resource_type'  => 'media',
            'resource_id'    => '999',
            'resource_label' => 'photo.jpg',
            'source'         => 'rest',
        ]);

        $result = WPSG_DB::list_audit_entries(['campaign_id' => $campaign_id]);
        $this->assertCount(1, $result['items'], 'One entry should exist after insert.');

        $entry = $result['items'][0];
        $this->assertEquals('info', $entry['severity']);
        $this->assertEquals('campaign', $entry['scope']);
        $this->assertEquals('Photo uploaded', $entry['summary']);
        $this->assertEquals('media', $entry['resourceType']);
        $this->assertEquals('999', $entry['resourceId']);
        $this->assertEquals('photo.jpg', $entry['resourceLabel']);
        $this->assertEquals('rest', $entry['source']);
    }

    // =========================================================================
    // Filtering: scope
    // =========================================================================

    public function test_list_filters_by_scope() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CT1 Scope Filter Campaign');

        $this->insert($campaign_id, 'campaign.archived', ['scope' => 'campaign']);
        $this->insert(0, 'plugin.settings_updated', ['scope' => 'system']);

        $campaign_only = WPSG_DB::list_audit_entries(['scope' => 'campaign']);
        $this->assertGreaterThanOrEqual(1, count($campaign_only['items']));
        foreach ($campaign_only['items'] as $item) {
            $this->assertEquals('campaign', $item['scope'], 'scope=campaign filter must only return campaign entries.');
        }

        $system_only = WPSG_DB::list_audit_entries(['scope' => 'system']);
        $this->assertGreaterThanOrEqual(1, count($system_only['items']));
        foreach ($system_only['items'] as $item) {
            $this->assertEquals('system', $item['scope'], 'scope=system filter must only return system entries.');
        }
    }

    // =========================================================================
    // Filtering: severity
    // =========================================================================

    public function test_list_filters_by_severity() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CT1 Severity Filter Campaign');

        $this->insert($campaign_id, 'campaign.archived', ['severity' => 'info']);
        $this->insert($campaign_id, 'access.denied', ['severity' => 'warning']);

        $info_only = WPSG_DB::list_audit_entries(['campaign_id' => $campaign_id, 'severity' => 'info']);
        $this->assertCount(1, $info_only['items'], 'severity=info should return exactly the info entry.');
        $this->assertEquals('info', $info_only['items'][0]['severity']);

        $warning_only = WPSG_DB::list_audit_entries(['campaign_id' => $campaign_id, 'severity' => 'warning']);
        $this->assertCount(1, $warning_only['items'], 'severity=warning should return exactly the warning entry.');
        $this->assertEquals('warning', $warning_only['items'][0]['severity']);
    }

    // =========================================================================
    // REST endpoints forward scope/severity params
    // =========================================================================

    public function test_campaign_audit_endpoint_filters_by_scope() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CT1 REST Scope Campaign');

        $this->insert($campaign_id, 'campaign.archived', ['scope' => 'campaign']);
        $this->insert($campaign_id, 'plugin.settings_updated', ['scope' => 'system']);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        $req->set_param('scope', 'campaign');
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertGreaterThanOrEqual(1, count($data['items']));
        foreach ($data['items'] as $item) {
            $this->assertEquals('campaign', $item['scope'], 'scope=campaign filter must scope REST response entries.');
        }
    }

    public function test_global_audit_endpoint_filters_by_severity() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('CT1 REST Severity Campaign');

        $this->insert($campaign_id, 'campaign.archived', ['severity' => 'info']);
        $this->insert($campaign_id, 'access.failed', ['severity' => 'warning']);

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        $req->set_param('campaign_id', $campaign_id);
        $req->set_param('severity', 'warning');
        $data = rest_do_request($req)->get_data();

        $this->assertArrayHasKey('items', $data);
        $this->assertGreaterThanOrEqual(1, count($data['items']), 'At least one warning entry must be returned.');
        foreach ($data['items'] as $item) {
            $this->assertEquals('warning', $item['severity'], 'severity=warning filter must scope REST response entries.');
        }
    }

    // =========================================================================
    // Default values for legacy rows (no new fields stored)
    // =========================================================================

    public function test_format_audit_entry_defaults_for_legacy_rows() {
        global $wpdb;
        $table = WPSG_DB::get_audit_log_table();
        $this->set_admin();
        $campaign_id = $this->create_campaign('CT1 Legacy Defaults Campaign');

        // Insert directly with only pre-CT1 columns to simulate a legacy row.
        $wpdb->insert($table, [ // phpcs:ignore
            'campaign_id' => $campaign_id,
            'action'      => 'legacy.event',
            'details'     => '{}',
            'actor_id'    => 1,
            'actor_login' => 'admin',
            'created_at'  => current_time('mysql', true),
        ]);

        $result = WPSG_DB::list_audit_entries(['campaign_id' => $campaign_id]);
        $this->assertCount(1, $result['items']);

        $entry = $result['items'][0];
        $this->assertEquals('info', $entry['severity'], 'Legacy rows must default severity to "info".');
        $this->assertEquals('campaign', $entry['scope'], 'Legacy rows must default scope to "campaign".');
        $this->assertEquals('', $entry['summary']);
        $this->assertEquals('', $entry['resourceType']);
        $this->assertEquals('', $entry['resourceId']);
        $this->assertEquals('', $entry['resourceLabel']);
        $this->assertEquals('', $entry['source']);
    }
}
