<?php

/**
 * P53-A: the /permissions endpoint exposes two tier signals so the React app
 * can distinguish a system admin (manage_options) from a space editor
 * (manage_wpsg). isAdmin = editor-or-above; isSystemAdmin = system admin only.
 *
 * Tiers (matching WPSG_Permissions::actor_has_tier):
 *   - viewer       : logged in, no manage_wpsg
 *   - editor       : manage_wpsg, NOT manage_options
 *   - system admin : manage_options (administrator; also carries manage_wpsg)
 */
class WPSG_P53A_Tier_Signal_Test extends WP_UnitTestCase {

    private function make_viewer(): int {
        return self::factory()->user->create(['role' => 'subscriber']);
    }

    private function make_editor(): int {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        return $uid;
    }

    private function make_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg'); // matches wpsg_setup_roles_and_caps()
        return $uid;
    }

    private function permissions_for(int $uid): array {
        wp_set_current_user($uid);
        $res = rest_do_request(new WP_REST_Request('GET', '/wp-super-gallery/v1/permissions'));
        $this->assertSame(200, $res->get_status());
        return $res->get_data();
    }

    public function test_system_admin_is_admin_and_system_admin() {
        $data = $this->permissions_for($this->make_system_admin());
        $this->assertTrue($data['isAdmin'], 'a system admin is editor-or-above');
        $this->assertTrue($data['isSystemAdmin'], 'a system admin has manage_options');
    }

    public function test_editor_is_admin_but_not_system_admin() {
        $data = $this->permissions_for($this->make_editor());
        $this->assertTrue($data['isAdmin'], 'a wpsg_editor is editor-or-above');
        $this->assertFalse($data['isSystemAdmin'], 'a wpsg_editor lacks manage_options');
    }

    public function test_viewer_is_neither() {
        $data = $this->permissions_for($this->make_viewer());
        $this->assertFalse($data['isAdmin']);
        $this->assertFalse($data['isSystemAdmin']);
    }

    public function test_guest_payload_carries_both_flags_false() {
        // The REST route requires auth (a guest is 401'd by the permission
        // callback), so exercise the guest early-return branch directly: its
        // shape must still declare both flags so the frontend never reads
        // undefined if it is ever reached.
        wp_set_current_user(0);
        $data = WPSG_Auth_Controller::list_permissions()->get_data();
        $this->assertArrayHasKey('isAdmin', $data);
        $this->assertArrayHasKey('isSystemAdmin', $data);
        $this->assertFalse($data['isAdmin']);
        $this->assertFalse($data['isSystemAdmin']);
    }
}
