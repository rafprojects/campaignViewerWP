<?php

/**
 * P40-SA1: System-Scope Audit Coverage Expansion
 *
 * Regression coverage for the new system-scope audit entries introduced in
 * P40-SA1: auth login/logout, settings updates, layout template CRUD,
 * and taxonomy term CRUD.
 *
 * All entries in this suite use scope='system' and campaign_id=0.
 *
 * Covers:
 *  - auth.login_success written on successful login.
 *  - auth.login_failed (warning) written on failed login attempt.
 *  - auth.logout written before session is destroyed.
 *  - settings.updated written when settings change via PUT or PATCH.
 *  - layout_template.created/updated/deleted/duplicated on template CRUD.
 *  - taxonomy.term_created/updated/deleted on campaign category and tag CRUD.
 */
class WPSG_P40_SA1_System_Coverage_Test extends WP_UnitTestCase {

    private $admin_id;
    private $test_user_id;
    private $test_user_pass = 'TestPass123!';

    private function set_admin(): void {
        $user = get_user_by('id', $this->admin_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($this->admin_id);
    }

    private function get_system_audit_actions(): array {
        return array_column($this->get_system_audit_entries(), 'action');
    }

    private function get_system_audit_entries(): array {
        $this->set_admin();
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/audit-log');
        return rest_do_request($req)->get_data()['items'] ?? [];
    }

    private function get_entries_by_action(string $action): array {
        return array_values(array_filter($this->get_system_audit_entries(), fn($e) => $e['action'] === $action));
    }

    public function setUp(): void {
        parent::setUp();

        $this->admin_id = self::factory()->user->create(['role' => 'administrator']);
        $this->test_user_id = self::factory()->user->create([
            'user_login' => 'sa1testlogin',
            'user_pass'  => $this->test_user_pass,
            'role'       => 'subscriber',
        ]);

        WPSG_DB::maybe_create_audit_log_table();
        WPSG_DB::maybe_upgrade();

        // Same-origin CSRF bypass for login endpoint.
        $_SERVER['HTTP_ORIGIN'] = home_url();
    }

    public function tearDown(): void {
        global $wpdb;
        unset($_SERVER['HTTP_ORIGIN']);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $wpdb->query('DELETE FROM ' . WPSG_DB::get_audit_log_table());
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // Auth audit entries
    // =========================================================================

    public function test_successful_login_writes_auth_login_success() {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $req->set_param('username', 'sa1testlogin');
        $req->set_param('password', $this->test_user_pass);
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status(), 'Login must succeed.');

        $actions = $this->get_system_audit_actions();
        $this->assertContains('auth.login_success', $actions, 'auth.login_success must appear in global audit log.');
    }

    public function test_login_success_entry_has_summary_and_system_scope() {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $req->set_param('username', 'sa1testlogin');
        $req->set_param('password', $this->test_user_pass);
        rest_do_request($req);

        $entries = $this->get_entries_by_action('auth.login_success');
        $this->assertNotEmpty($entries, 'auth.login_success entry must exist.');
        $this->assertEquals('system', $entries[0]['scope'] ?? '', 'Login audit entry must have scope=system.');
        $this->assertNotEmpty($entries[0]['summary'], 'Login audit entry must have a summary.');
        $this->assertStringContainsString('sa1testlogin', $entries[0]['summary']);
    }

    public function test_failed_login_writes_auth_login_failed_with_warning() {
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $req->set_param('username', 'sa1testlogin');
        $req->set_param('password', 'wrongpassword!');
        $res = rest_do_request($req);

        $this->assertEquals(401, $res->get_status(), 'Failed login must return 401.');

        $entries = $this->get_entries_by_action('auth.login_failed');
        $this->assertNotEmpty($entries, 'auth.login_failed must appear in global audit log.');
        $this->assertEquals('warning', $entries[0]['severity'] ?? '', 'Login failure must have warning severity.');
        $this->assertEquals('system', $entries[0]['scope'] ?? '', 'Login failure must have scope=system.');
        $this->assertStringContainsString('sa1testlogin', $entries[0]['summary'] ?? '');
    }

    public function test_logout_writes_auth_logout_before_session_is_destroyed() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/logout');
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status(), 'Logout must succeed.');

        $entries = $this->get_entries_by_action('auth.logout');
        $this->assertNotEmpty($entries, 'auth.logout must appear in global audit log.');
        $this->assertEquals('system', $entries[0]['scope'] ?? '', 'Logout entry must have scope=system.');
        $this->assertNotEmpty($entries[0]['summary'], 'Logout entry must have a summary.');
    }

    // =========================================================================
    // Settings audit entries
    // =========================================================================

    public function test_settings_post_writes_settings_updated_entry() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['theme' => 'default-light']));
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status(), 'Settings POST must succeed.');

        $actions = $this->get_system_audit_actions();
        $this->assertContains('settings.updated', $actions, 'settings.updated must appear after POST /settings.');
    }

    public function test_settings_post_entry_includes_changed_key_in_summary() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['theme' => 'default-light']));
        rest_do_request($req);

        $entries = $this->get_entries_by_action('settings.updated');
        $this->assertNotEmpty($entries, 'settings.updated entry must exist.');
        $this->assertStringContainsString('theme', $entries[0]['summary'] ?? '');
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
    }

    public function test_settings_patch_writes_settings_updated_entry() {
        $this->set_admin();

        $req = new WP_REST_Request('PATCH', '/wp-super-gallery/v1/settings');
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['enableLightbox' => false]));
        $res = rest_do_request($req);

        $this->assertEquals(200, $res->get_status(), 'Settings PATCH must succeed.');

        $actions = $this->get_system_audit_actions();
        $this->assertContains('settings.updated', $actions, 'settings.updated must appear after PATCH /settings.');
    }

    public function test_settings_with_no_effective_change_does_not_write_audit_entry() {
        $this->set_admin();

        // Read current value and re-send it unchanged.
        $get_req = new WP_REST_Request('GET', '/wp-super-gallery/v1/settings');
        $current = rest_do_request($get_req)->get_data();
        $current_theme = $current['theme'] ?? 'default-dark';

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['theme' => $current_theme]));
        rest_do_request($req);

        $actions = $this->get_system_audit_actions();
        $this->assertNotContains('settings.updated', $actions, 'No-op settings update must not write an audit entry.');
    }

    // =========================================================================
    // Layout template CRUD audit entries
    // =========================================================================

    public function test_create_layout_template_writes_audit_entry() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/layout-templates');
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode([
            'name'  => 'SA1 Test Template',
            'slots' => [],
        ]));
        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'Template create must succeed.');

        $actions = $this->get_system_audit_actions();
        $this->assertContains('layout_template.created', $actions);
    }

    public function test_create_layout_template_entry_has_system_scope_and_summary() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/layout-templates');
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['name' => 'SA1 Summary Template', 'slots' => []]));
        rest_do_request($req);

        $entries = $this->get_entries_by_action('layout_template.created');
        $this->assertNotEmpty($entries);
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
        $this->assertStringContainsString('SA1 Summary Template', $entries[0]['summary'] ?? '');
    }

    public function test_update_layout_template_writes_audit_entry() {
        $this->set_admin();
        $template = WPSG_Layout_Templates::create(['name' => 'SA1 Update Source', 'slots' => []]);
        $this->assertFalse(is_wp_error($template), 'Template must be created successfully.');

        $req = new WP_REST_Request('PUT', "/wp-super-gallery/v1/admin/layout-templates/{$template['id']}");
        $req->set_param('templateId', $template['id']);
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['name' => 'SA1 Update Renamed', 'slots' => []]));
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status(), 'Template update must succeed.');

        $actions = $this->get_system_audit_actions();
        $this->assertContains('layout_template.updated', $actions);
    }

    public function test_delete_layout_template_writes_audit_entry() {
        $this->set_admin();
        $template = WPSG_Layout_Templates::create(['name' => 'SA1 Delete Target', 'slots' => []]);
        $this->assertFalse(is_wp_error($template));

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/admin/layout-templates/{$template['id']}");
        $req->set_param('templateId', $template['id']);
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status(), 'Template delete must succeed.');

        $entries = $this->get_entries_by_action('layout_template.deleted');
        $this->assertNotEmpty($entries);
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
        $this->assertStringContainsString('SA1 Delete Target', $entries[0]['summary'] ?? '');
    }

    public function test_duplicate_layout_template_writes_audit_entry() {
        $this->set_admin();
        $template = WPSG_Layout_Templates::create(['name' => 'SA1 Dupe Source', 'slots' => []]);
        $this->assertFalse(is_wp_error($template));

        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/layout-templates/{$template['id']}/duplicate");
        $req->set_param('templateId', $template['id']);
        $req->add_header('Content-Type', 'application/json');
        $req->set_body(wp_json_encode(['name' => 'SA1 Dupe Copy']));
        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'Template duplicate must succeed.');

        $entries = $this->get_entries_by_action('layout_template.duplicated');
        $this->assertNotEmpty($entries);
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
        $this->assertStringContainsString('SA1 Dupe Copy', $entries[0]['summary'] ?? '');
    }

    // =========================================================================
    // Taxonomy audit entries
    // =========================================================================

    public function test_create_campaign_category_writes_taxonomy_term_created() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-categories');
        $req->set_param('name', 'SA1 Test Category');
        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'Category create must succeed.');

        $entries = $this->get_entries_by_action('taxonomy.term_created');
        $this->assertNotEmpty($entries);
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
        $this->assertStringContainsString('SA1 Test Category', $entries[0]['summary'] ?? '');
    }

    public function test_update_campaign_category_writes_taxonomy_term_updated() {
        $this->set_admin();
        $result = wp_insert_term('SA1 Cat To Update', 'wpsg_campaign_category');
        $term_id = $result['term_id'];

        $req = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaign-categories/{$term_id}");
        $req->set_param('id', $term_id);
        $req->set_param('name', 'SA1 Cat Updated');
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status(), 'Category update must succeed.');

        $entries = $this->get_entries_by_action('taxonomy.term_updated');
        $this->assertNotEmpty($entries);
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
        $this->assertStringContainsString('SA1 Cat Updated', $entries[0]['summary'] ?? '');
    }

    public function test_delete_campaign_category_writes_taxonomy_term_deleted() {
        $this->set_admin();
        $result = wp_insert_term('SA1 Cat To Delete', 'wpsg_campaign_category');
        $term_id = $result['term_id'];

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/campaign-categories/{$term_id}");
        $req->set_param('id', $term_id);
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status(), 'Category delete must succeed.');

        $entries = $this->get_entries_by_action('taxonomy.term_deleted');
        $this->assertNotEmpty($entries);
        $this->assertEquals('system', $entries[0]['scope'] ?? '');
        $this->assertStringContainsString('SA1 Cat To Delete', $entries[0]['summary'] ?? '');
    }

    public function test_create_campaign_tag_writes_taxonomy_term_created() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/campaign');
        $req->set_param('name', 'sa1-campaign-tag');
        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'Campaign tag create must succeed.');

        $entries = $this->get_entries_by_action('taxonomy.term_created');
        $this->assertNotEmpty($entries);

        $tag_entry = array_values(array_filter($entries, fn($e) => str_contains($e['summary'] ?? '', 'sa1-campaign-tag')));
        $this->assertNotEmpty($tag_entry, 'taxonomy.term_created must include the new campaign tag name.');
    }

    public function test_delete_campaign_tag_writes_taxonomy_term_deleted() {
        $this->set_admin();
        $result  = wp_insert_term('sa1-tag-to-delete', 'wpsg_campaign_tag');
        $term_id = $result['term_id'];

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/tags/campaign/{$term_id}");
        $req->set_param('id', $term_id);
        $res = rest_do_request($req);
        $this->assertEquals(200, $res->get_status(), 'Campaign tag delete must succeed.');

        $entries = $this->get_entries_by_action('taxonomy.term_deleted');
        $this->assertNotEmpty($entries);
        $this->assertStringContainsString('sa1-tag-to-delete', $entries[0]['summary'] ?? '');
    }

    public function test_create_media_tag_writes_taxonomy_term_created() {
        $this->set_admin();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/media');
        $req->set_param('name', 'sa1-media-tag');
        $res = rest_do_request($req);
        $this->assertEquals(201, $res->get_status(), 'Media tag create must succeed.');

        $entries = $this->get_entries_by_action('taxonomy.term_created');
        $this->assertNotEmpty($entries);

        $tag_entry = array_values(array_filter($entries, fn($e) => str_contains($e['summary'] ?? '', 'sa1-media-tag')));
        $this->assertNotEmpty($tag_entry, 'taxonomy.term_created must include the new media tag name.');
    }
}
