<?php

/**
 * P52-A2: Role rename wpsg_admin → wpsg_editor.
 *
 * Proves:
 *   - the wpsg_editor role carries exactly the intended caps (manage_wpsg +
 *     read + upload_files; NO custom CPT caps, NO manage_options);
 *   - the one-time migration reassigns legacy wpsg_admin users to wpsg_editor
 *     with their plugin access (manage_wpsg) intact, and removes the old role;
 *   - the /users create contract now accepts wpsg_editor and rejects wpsg_admin.
 */
class WPSG_P52A2_Role_Migration_Test extends WP_UnitTestCase {

    public function tearDown(): void {
        // Defensive: never let a re-added legacy role leak into other suites.
        if (get_role('wpsg_admin')) {
            remove_role('wpsg_admin');
        }
        parent::tearDown();
    }

    private function set_admin_user(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    // ── Role definition ───────────────────────────────────────────────────

    public function test_editor_role_has_expected_caps() {
        wpsg_ensure_editor_role();
        $role = get_role('wpsg_editor');

        $this->assertNotNull($role, 'wpsg_editor role must exist');
        $this->assertTrue($role->has_cap('manage_wpsg'), 'editor must have manage_wpsg');
        $this->assertTrue($role->has_cap('read'), 'editor must have read');
        $this->assertTrue($role->has_cap('upload_files'), 'editor must have upload_files');
    }

    public function test_editor_role_has_no_admin_or_cpt_caps() {
        wpsg_ensure_editor_role();
        $role = get_role('wpsg_editor');

        $this->assertFalse($role->has_cap('manage_options'), 'editor must NOT have manage_options (no WP dashboard)');

        // No custom CPT caps → no wp-admin "Campaigns" menu for editors.
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $this->assertFalse(
                $role->has_cap($cap),
                "editor must NOT hold CPT cap '{$cap}'"
            );
        }
    }

    public function test_ensure_editor_role_strips_legacy_cpt_caps() {
        // Simulate a wpsg_editor role left over from a build that granted CPT caps.
        $caps = ['read' => true, 'upload_files' => true, 'manage_wpsg' => true];
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $caps[$cap] = true;
        }
        remove_role('wpsg_editor');
        add_role('wpsg_editor', 'Gallery Editor', $caps);

        wpsg_ensure_editor_role();

        $role = get_role('wpsg_editor');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $this->assertFalse($role->has_cap($cap), "ensure_editor_role must strip CPT cap '{$cap}'");
        }
        $this->assertTrue($role->has_cap('manage_wpsg'));
    }

    // ── Migration ─────────────────────────────────────────────────────────

    public function test_migration_converts_legacy_user_and_removes_role() {
        // Arrange: a pre-P52-A2 install with the legacy role and a user on it.
        delete_option('wpsg_roles_migrated_editor');
        $legacy_caps = ['read' => true, 'upload_files' => true, 'manage_wpsg' => true];
        add_role('wpsg_admin', 'Gallery Admin', $legacy_caps);
        $uid = self::factory()->user->create(['role' => 'wpsg_admin']);

        $this->assertContains('wpsg_admin', get_user_by('id', $uid)->roles, 'precondition: user is wpsg_admin');

        // Act.
        wpsg_maybe_migrate_roles();

        // Assert: user moved to wpsg_editor, access (manage_wpsg) intact.
        $migrated = get_user_by('id', $uid);
        $this->assertContains('wpsg_editor', $migrated->roles, 'user must be reassigned to wpsg_editor');
        $this->assertNotContains('wpsg_admin', $migrated->roles, 'user must no longer hold wpsg_admin');
        $this->assertTrue(user_can($uid, 'manage_wpsg'), 'migrated user keeps plugin access');
        $this->assertFalse(user_can($uid, 'manage_options'), 'migrated user does not gain WP admin');

        // Legacy role removed; flag set so it does not re-run.
        $this->assertNull(get_role('wpsg_admin'), 'legacy wpsg_admin role must be removed');
        $this->assertNotNull(get_role('wpsg_editor'), 'wpsg_editor role must exist after migration');
        $this->assertNotEmpty(get_option('wpsg_roles_migrated_editor'), 'migration flag must be set');
    }

    public function test_migration_is_noop_when_flag_set() {
        update_option('wpsg_roles_migrated_editor', '1');
        add_role('wpsg_admin', 'Gallery Admin', ['read' => true]);

        wpsg_maybe_migrate_roles();

        // Flag was already set → migration returns early, legacy role untouched.
        $this->assertNotNull(get_role('wpsg_admin'), 'migration must not run when flag is set');
        remove_role('wpsg_admin');
    }

    // ── /users create contract ────────────────────────────────────────────

    public function test_create_user_accepts_wpsg_editor() {
        wpsg_ensure_editor_role();
        $this->set_admin_user();
        add_filter('pre_wp_mail', '__return_true', 10, 0);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $req->set_param('email', 'editor-' . uniqid() . '@example.com');
        $req->set_param('displayName', 'New Editor');
        $req->set_param('role', 'wpsg_editor');
        $res = rest_do_request($req);

        $this->assertContains($res->get_status(), [200, 201], 'wpsg_editor must be an accepted role');
        $created = get_user_by('id', $res->get_data()['userId']);
        $this->assertContains('wpsg_editor', $created->roles);
    }

    public function test_create_user_rejects_legacy_wpsg_admin() {
        $this->set_admin_user();
        add_filter('pre_wp_mail', '__return_true', 10, 0);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $req->set_param('email', 'legacy-' . uniqid() . '@example.com');
        $req->set_param('displayName', 'Legacy Admin');
        $req->set_param('role', 'wpsg_admin');
        $res = rest_do_request($req);

        $this->assertSame(400, $res->get_status(), 'legacy wpsg_admin must be rejected by the role enum');
    }

    public function test_list_roles_exposes_wpsg_editor_not_legacy() {
        $this->set_admin_user();
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/roles');
        $res = rest_do_request($req);
        $values = array_column($res->get_data()['items'], 'value');

        $this->assertContains('wpsg_editor', $values, 'roles list must offer wpsg_editor');
        $this->assertNotContains('wpsg_admin', $values, 'roles list must not offer legacy wpsg_admin');
    }
}
