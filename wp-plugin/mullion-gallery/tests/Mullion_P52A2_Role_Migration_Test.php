<?php

/**
 * P52-A2: `mullion_editor` role definition and /users contract.
 *
 * Proves:
 *   - the mullion_editor role carries exactly the intended caps (manage_mullion +
 *     read + upload_files; NO custom CPT caps, NO manage_options);
 *   - the /users create contract accepts mullion_editor and rejects unknown roles.
 */
class Mullion_P52A2_Role_Migration_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_mullion');
        wp_set_current_user($uid);
        return $uid;
    }

    // ── Role definition ───────────────────────────────────────────────────

    public function test_editor_role_has_expected_caps() {
        mullion_ensure_editor_role();
        $role = get_role('mullion_editor');

        $this->assertNotNull($role, 'mullion_editor role must exist');
        $this->assertTrue($role->has_cap('manage_mullion'), 'editor must have manage_mullion');
        $this->assertTrue($role->has_cap('read'), 'editor must have read');
        $this->assertTrue($role->has_cap('upload_files'), 'editor must have upload_files');
    }

    public function test_editor_role_has_no_admin_or_cpt_caps() {
        mullion_ensure_editor_role();
        $role = get_role('mullion_editor');

        $this->assertFalse($role->has_cap('manage_options'), 'editor must NOT have manage_options (no WP dashboard)');

        // No custom CPT caps → no wp-admin "Campaigns" menu for editors.
        foreach (Mullion_CPT::CPT_CAPS as $cap) {
            $this->assertFalse(
                $role->has_cap($cap),
                "editor must NOT hold CPT cap '{$cap}'"
            );
        }
    }

    public function test_ensure_editor_role_strips_legacy_cpt_caps() {
        // Simulate a mullion_editor role left over from a build that granted CPT caps.
        $caps = ['read' => true, 'upload_files' => true, 'manage_mullion' => true];
        foreach (Mullion_CPT::CPT_CAPS as $cap) {
            $caps[$cap] = true;
        }
        remove_role('mullion_editor');
        add_role('mullion_editor', 'Gallery Editor', $caps);

        mullion_ensure_editor_role();

        $role = get_role('mullion_editor');
        foreach (Mullion_CPT::CPT_CAPS as $cap) {
            $this->assertFalse($role->has_cap($cap), "ensure_editor_role must strip CPT cap '{$cap}'");
        }
        $this->assertTrue($role->has_cap('manage_mullion'));
    }

    // ── /users create contract ────────────────────────────────────────────

    public function test_create_user_accepts_mullion_editor() {
        mullion_ensure_editor_role();
        $this->set_admin_user();
        add_filter('pre_wp_mail', '__return_true', 10, 0);

        $req = new WP_REST_Request('POST', '/mullion-gallery/v1/users');
        $req->set_param('email', 'editor-' . uniqid() . '@example.com');
        $req->set_param('displayName', 'New Editor');
        $req->set_param('role', 'mullion_editor');
        $res = rest_do_request($req);

        $this->assertContains($res->get_status(), [200, 201], 'mullion_editor must be an accepted role');
        $created = get_user_by('id', $res->get_data()['userId']);
        $this->assertContains('mullion_editor', $created->roles);
    }

    public function test_create_user_rejects_unknown_role() {
        $this->set_admin_user();
        add_filter('pre_wp_mail', '__return_true', 10, 0);

        $req = new WP_REST_Request('POST', '/mullion-gallery/v1/users');
        $req->set_param('email', 'unknown-' . uniqid() . '@example.com');
        $req->set_param('displayName', 'Unknown Role');
        $req->set_param('role', 'not_a_role');
        $res = rest_do_request($req);

        $this->assertSame(400, $res->get_status(), 'unknown roles must be rejected by the role enum');
    }

    public function test_list_roles_exposes_mullion_editor() {
        $this->set_admin_user();
        $req = new WP_REST_Request('GET', '/mullion-gallery/v1/roles');
        $res = rest_do_request($req);
        $values = array_column($res->get_data()['items'], 'value');

        $this->assertContains('mullion_editor', $values, 'roles list must offer mullion_editor');
    }
}
