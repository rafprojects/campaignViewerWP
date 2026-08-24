<?php

/**
 * P52-B: Asset Admin Renderer.
 *
 * Proves the WP-admin "Asset Library" page is correctly gated:
 *   - registered with manage_options (System Admin only);
 *   - render_page() outputs the #wpsg-assets-admin mount div;
 *   - a wpsg_editor lacks manage_options and cannot access the page.
 */
class WPSG_P52B_Asset_Admin_Renderer_Test extends WP_UnitTestCase {

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

    /** Find the capability required for a registered submenu entry by slug. */
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

    public function test_asset_library_page_registered_with_manage_options() {
        $this->set_administrator(); // add_submenu_page only records pages the current user can access.
        WPSG_Asset_Admin_Renderer::add_menu_page();

        $this->assertSame(
            'manage_options',
            $this->submenu_capability(WPSG_Asset_Admin_Renderer::PAGE_SLUG),
            'Asset Library admin page must require manage_options (System Admin only)'
        );
    }

    public function test_render_page_outputs_mount_div() {
        ob_start();
        WPSG_Asset_Admin_Renderer::render_page();
        $html = ob_get_clean();

        $this->assertStringContainsString('id="wpsg-assets-admin"', $html);
    }

    public function test_editor_lacks_manage_options_cannot_access_asset_library_page() {
        $uid = $this->set_editor();

        $this->assertFalse(
            user_can($uid, 'manage_options'),
            'wpsg_editor must not have manage_options and therefore cannot reach the WP-admin Asset Library page'
        );
        // The editor still keeps plugin access (manage_wpsg) so the REST API works.
        $this->assertTrue(user_can($uid, 'manage_wpsg'), 'editor retains plugin access');
    }
}
