<?php

/**
 * P52-A5a: system endpoints require manage_options.
 *
 * Closes most of F1: a space-scoped wpsg_editor (manage_wpsg only) is denied
 * every system/global REST action (health, caches, webhooks, global audit log,
 * media library, binary import/export, role assignment, cross-space aggregates,
 * company management, space creation, user creation), while a System Admin is
 * allowed. Editor-tier global content actions (categories/tags/templates/assets/
 * fonts create/edit, media upload) are unaffected.
 */
class WPSG_P52A5a_System_Admin_Gating_Test extends WP_UnitTestCase {

    /** require_system_admin actions (manage_options). */
    private const SYSTEM_ACTIONS = [
        'roles.list',
        'campaigns.access_summary.read',
        'company.access.list', 'company.access.grant', 'company.access.revoke', 'company.archive',
        'media.usage_summary.read', 'media.usage.read', 'media.rescan_all', 'media.library.list',
        'media.export_binary', 'media.import_binary',
        'analytics.summary.read',
        'campaigns.import', 'campaigns.import_binary',
        'system.health.read', 'system.oembed_failures.read', 'system.oembed_failures.reset',
        'system.thumbnail_cache.read', 'system.thumbnail_cache.clear', 'system.thumbnail_cache.refresh',
        'webhooks.list', 'webhooks.create', 'webhooks.delivery_log.read',
        'webhooks.update', 'webhooks.delete', 'webhooks.rotate_secret',
        'system.audit_log.read', 'system.audit_log.export_binary',
        'spaces.create',
    ];

    /** Global content actions a space editor must keep (still manage_wpsg). */
    private const EDITOR_RETAINED_ACTIONS = [
        'categories.create', 'campaign_tags.create', 'media_tags.create', 'media.upload',
        'companies.list', 'layout_templates.create', 'assets.upload', 'fonts.upload',
        'campaign_templates.create',
    ];

    private function make_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    /** Space editor: manage_wpsg but NOT manage_options. */
    private function make_editor(): int {
        wpsg_ensure_editor_role();
        $uid = self::factory()->user->create(['role' => 'wpsg_editor']);
        wp_set_current_user($uid);
        return $uid;
    }

    public function test_editor_denied_every_system_action() {
        $this->make_editor();
        foreach (self::SYSTEM_ACTIONS as $action) {
            $this->assertFalse(
                (bool) WPSG_Permissions::check($action),
                "wpsg_editor must be denied system action '{$action}'"
            );
        }
    }

    public function test_system_admin_allowed_every_system_action() {
        $this->make_system_admin();
        foreach (self::SYSTEM_ACTIONS as $action) {
            $this->assertTrue(
                WPSG_Permissions::check($action) === true,
                "System Admin must be allowed system action '{$action}'"
            );
        }
    }

    public function test_editor_retains_global_content_actions() {
        $this->make_editor();
        foreach (self::EDITOR_RETAINED_ACTIONS as $action) {
            $this->assertTrue(
                WPSG_Permissions::check($action) === true,
                "wpsg_editor must retain content action '{$action}'"
            );
        }
    }

    public function test_users_create_requires_system_admin() {
        $this->make_editor();
        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $this->assertFalse(
            (bool) WPSG_Permissions::check('users.create', $req),
            'wpsg_editor must not create users'
        );

        $this->make_system_admin();
        $req2 = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $this->assertTrue(
            WPSG_Permissions::check('users.create', $req2) === true,
            'System Admin may create users'
        );
    }

    public function test_require_system_admin_primitive() {
        $this->make_editor();
        $this->assertFalse(WPSG_REST_Base::require_system_admin(), 'editor fails require_system_admin');

        $this->make_system_admin();
        $this->assertTrue(WPSG_REST_Base::require_system_admin() === true, 'admin passes require_system_admin');
    }
}
