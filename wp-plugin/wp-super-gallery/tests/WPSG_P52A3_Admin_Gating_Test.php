<?php

/**
 * P52-A3: wp-admin re-gating.
 *
 * Proves the wp-admin gallery surfaces are System-Admin only:
 *   - the Spaces submenu page is registered with `manage_options`;
 *   - Settings remains `manage_options` (regression);
 *   - the admin_post create-space handler denies a space editor;
 *   - a wpsg_editor cannot `manage_options` and holds no CPT caps, so the
 *     "SuperGallery" CPT menu (and its submenus) is hidden for them.
 */
class WPSG_P52A3_Admin_Gating_Test extends WP_UnitTestCase {

    private const PARENT = 'edit.php?post_type=wpsg_campaign';

    private function set_administrator(): int {
        $uid = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($uid);
        return $uid;
    }

    private function set_editor(): int {
        wpsg_ensure_editor_role();
        $uid = self::factory()->user->create(['role' => 'wpsg_editor']);
        wp_set_current_user($uid);
        return $uid;
    }

    /** Find a registered submenu entry by slug; returns its capability or ''. */
    private function submenu_capability(string $page_slug): string {
        global $submenu;
        if (empty($submenu[self::PARENT])) {
            return '';
        }
        foreach ($submenu[self::PARENT] as $entry) {
            // add_submenu_page stores [menu_title, capability, menu_slug, page_title].
            if (($entry[2] ?? '') === $page_slug) {
                return (string) ($entry[1] ?? '');
            }
        }
        return '';
    }

    // ── Page capability registration ──────────────────────────────────────

    public function test_spaces_admin_page_registered_with_manage_options() {
        $this->set_administrator(); // add_submenu_page only records pages the user can access.
        WPSG_Space_Admin_Renderer::add_menu_page();

        $this->assertSame(
            'manage_options',
            $this->submenu_capability(WPSG_Space_Admin_Renderer::PAGE_SLUG),
            'Spaces admin page must require manage_options (System Admin only)'
        );
    }

    public function test_settings_admin_page_remains_manage_options() {
        $this->set_administrator();
        WPSG_Settings_Renderer::add_menu_page();

        $this->assertSame(
            'manage_options',
            $this->submenu_capability(WPSG_Settings::PAGE_SLUG),
            'Settings admin page must require manage_options'
        );
    }

    // ── Editor vs System Admin capability boundary ────────────────────────

    public function test_editor_lacks_manage_options_and_cpt_caps() {
        $uid = $this->set_editor();

        $this->assertTrue(user_can($uid, 'manage_wpsg'), 'editor keeps plugin access');
        $this->assertFalse(user_can($uid, 'manage_options'), 'editor must not reach wp-admin system screens');

        // No CPT caps → the "SuperGallery" (wpsg_campaign) menu is hidden for editors.
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $this->assertFalse(user_can($uid, $cap), "editor must not hold CPT cap '{$cap}'");
        }
    }

    public function test_administrator_can_manage_options_and_edit_campaigns() {
        // Ensure the administrator role has the plugin caps wired (init setup).
        wpsg_setup_roles_and_caps();
        $uid = self::factory()->user->create(['role' => 'administrator']);

        $this->assertTrue(user_can($uid, 'manage_options'), 'administrator is System Admin');
        $this->assertTrue(user_can($uid, 'edit_wpsg_campaigns'), 'administrator can use the wp-admin Campaigns UI');
    }

    // ── admin_post create-space handler ───────────────────────────────────

    public function test_create_space_handler_denies_editor() {
        $this->set_editor();

        // The cap check fails first (editor lacks manage_options), so the handler
        // wp_die()s before touching the nonce. WP's test die-handler throws.
        $this->expectException(WPDieException::class);
        WPSG_CPT::handle_create_space();
    }
}
