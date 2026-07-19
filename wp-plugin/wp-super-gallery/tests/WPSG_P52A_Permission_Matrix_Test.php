<?php

/**
 * P52-A1: Centralized permission map — provable baseline.
 *
 * Asserts the WPSG_Permissions action→strategy matrix and that EVERY registered
 * REST route resolves its permission through that map (no bypass, no gap). This
 * is the characterization harness for the RBAC redesign: A1 freezes the current
 * matrix here so A4/A5 reclassifications are deliberate, reviewable diffs.
 *
 * Strategy behavior itself is cross-covered by:
 *   - WPSG_P33C_Role_Enforcement_Test  (require_campaign_space_access — per-campaign mutation is role+space-scoped)
 *   - WPSG_P47_Spaces_Isolation_Test   (space-scoped read/isolation, delegated mode)
 * with the require_admin / public / authenticated strategies pinned below.
 */
class WPSG_P52A_Permission_Matrix_Test extends WP_UnitTestCase {

    /**
     * The authoritative matrix, hand-maintained INDEPENDENTLY of WPSG_Permissions::MAP
     * so an accidental edit to either side fails this test. Mirrors the 119 routes
     * enumerated in docs/PHASE52_REPORT.md › Track P52-A.
     *
     * @return array<string,string> action => strategy
     */
    private function expected_matrix(): array {
        return [
            // Analytics
            'analytics.event.record'                => 'rate_limit_public',
            'analytics.campaign.read'               => 'require_campaign_space_access',
            'analytics.campaign.media.read'         => 'require_campaign_space_access',
            'analytics.summary.read'                => 'require_system_admin',
            // Auth
            'auth.permissions.read'                 => 'require_authenticated',
            'auth.nonce.refresh'                    => 'require_authenticated',
            'auth.login'                            => '__return_true',
            'auth.logout'                           => 'require_authenticated',
            'users.search'                          => 'require_admin',
            'users.create'                          => 'rate_limit_authenticated',
            'roles.list'                            => 'require_system_admin',
            // Access
            'campaigns.access_summary.read'         => 'require_system_admin',
            'campaign.access.list'                  => 'require_campaign_space_access',
            'campaign.access.grant'                 => 'require_campaign_space_access',
            'campaign.access.revoke'                => 'require_campaign_space_access',
            'campaign.access_request.submit'        => 'rate_limit_access_request', // P64-C: own tight limit + precheck seam
            'campaign.access_request.list'          => 'require_campaign_space_access',
            'campaign.access_request.approve'       => 'require_campaign_space_access',
            'campaign.access_request.deny'          => 'require_campaign_space_access',
            'campaign.access_request.magic_approve' => 'rate_limit_magic_approve',
            'company.access.list'                   => 'require_system_admin',
            'company.access.grant'                  => 'require_system_admin',
            'company.access.revoke'                 => 'require_system_admin',
            'company.archive'                       => 'require_system_admin',
            // Media
            'media.usage_summary.read'              => 'require_system_admin',
            'media.usage.read'                      => 'require_system_admin',
            'campaign.media.list'                   => 'rate_limit_public',
            'campaign.media.create'                 => 'require_campaign_space_access',
            'campaign.media.create_batch'           => 'require_campaign_space_access',
            'campaign.media.reorder'                => 'require_campaign_space_access',
            'campaign.media.rescan'                 => 'require_campaign_space_access',
            'campaign.media.update'                 => 'require_campaign_space_access',
            'campaign.media.delete'                 => 'require_campaign_space_access',
            'media.rescan_all'                      => 'require_system_admin',
            'media.library.list'                    => 'require_system_admin',
            'media.upload'                          => 'require_admin',
            'media_tags.list'                       => 'require_admin',
            'media_tags.create'                     => 'require_admin',
            'media_tags.delete'                     => 'require_admin',
            'media.export_binary'                   => 'require_system_admin',
            'media.import_binary'                   => 'require_system_admin',
            // Content
            'categories.list'                       => 'require_admin',
            'categories.create'                     => 'require_admin',
            'categories.update'                     => 'require_admin',
            'categories.delete'                     => 'require_admin',
            'campaign_templates.list'               => 'require_admin',
            'campaign_templates.create'             => 'require_admin',
            'campaign_templates.delete'             => 'require_admin',
            'campaign_templates.instantiate'        => 'require_admin',
            'companies.list'                        => 'require_admin',
            'campaign_tags.list'                    => 'require_admin',
            'campaign_tags.create'                  => 'require_admin',
            'campaign_tags.delete'                  => 'require_admin',
            'layout_templates.list'                 => 'require_admin',
            'layout_templates.create'               => 'require_admin',
            'layout_templates.read'                 => 'require_admin',
            'layout_templates.update'               => 'require_admin',
            'layout_templates.delete'               => 'require_admin',
            'layout_templates.duplicate'            => 'require_admin',
            'assets.list'                           => 'require_admin',
            'assets.upload'                         => 'require_admin',
            'assets.update'                         => 'require_admin',
            'assets.delete'                         => 'require_admin',
            'fonts.list'                            => 'require_admin',
            'fonts.upload'                          => 'require_admin',
            'fonts.update'                          => 'require_admin',
            'fonts.delete'                          => 'require_system_admin',
            'layout_templates.read_public'          => '__return_true',
            // Settings
            'settings.read_public'                  => 'rate_limit_public',
            'settings.update'                       => 'require_admin',
            'settings.patch'                        => 'require_admin',
            // Export
            'campaigns.batch.export_binary'         => 'require_campaign_batch_space_access',
            'campaign.export'                       => 'require_campaign_space_access',
            'campaigns.import'                      => 'require_system_admin',
            'campaign.export_binary'                => 'require_campaign_space_access',
            'campaigns.import_binary'               => 'require_system_admin',
            'export_jobs.read'                      => 'require_admin',
            'export_jobs.delete'                    => 'require_admin',
            'export_jobs.download'                  => 'require_admin',
            // System
            'system.oembed_proxy'                   => '__return_true',
            'system.health.read'                    => 'require_system_admin',
            'system.oembed_failures.read'           => 'require_system_admin',
            'system.oembed_failures.reset'          => 'require_system_admin',
            'system.thumbnail_cache.read'           => 'require_system_admin',
            'system.thumbnail_cache.clear'          => 'require_system_admin',
            'system.thumbnail_cache.refresh'        => 'require_system_admin',
            'webhooks.list'                         => 'require_system_admin',
            'webhooks.create'                       => 'require_system_admin',
            'webhooks.delivery_log.read'            => 'require_system_admin',
            'webhooks.update'                       => 'require_system_admin',
            'webhooks.delete'                       => 'require_system_admin',
            'webhooks.rotate_secret'                => 'require_system_admin',
            // Space
            'spaces.list'                           => 'require_admin',
            'spaces.create'                         => 'require_system_admin',
            'space.read'                            => 'require_space_member',
            'space.update'                          => 'require_space_admin',
            'space.delete'                          => 'require_space_admin',
            'space.access.list'                     => 'require_space_admin',
            'space.access.grant'                    => 'require_space_admin',
            'space.access.revoke'                   => 'require_space_admin',
            'space.resolve_user'                    => 'require_space_admin',
            'space.settings.read'                   => 'require_space_member',
            'space.settings.update'                 => 'require_space_admin',
            'space.library.read'                    => 'require_space_member',
            'space.library.associate'               => 'require_space_admin',
            'space.library.dissociate'              => 'require_space_admin',
            // Campaign
            'campaigns.list'                        => 'rate_limit_public',
            'campaigns.create'                      => 'require_admin',
            'campaign.read'                         => 'rate_limit_public',
            'campaign.update'                       => 'require_campaign_space_access',
            'campaign.delete'                       => 'require_campaign_space_access',
            'campaign.archive'                      => 'require_campaign_space_access',
            'campaign.restore'                      => 'require_campaign_space_access',
            'campaign.duplicate'                    => 'require_campaign_space_access',
            'campaign.move'                         => 'require_campaign_space_move',
            'campaigns.batch'                       => 'require_campaign_batch_space_access',
            'campaign.audit.read'                   => 'require_campaign_space_access',
            'system.audit_log.read'                 => 'require_system_admin',
            'system.audit_log.export_binary'        => 'require_system_admin',
        ];
    }

    // ── Matrix integrity ──────────────────────────────────────────────────

    public function test_map_matches_frozen_matrix() {
        $expected = $this->expected_matrix();

        $this->assertCount(
            count($expected),
            WPSG_Permissions::MAP,
            'WPSG_Permissions::MAP size drifted from the frozen P52-A matrix'
        );

        // One assertion per row (clear failure messages on drift).
        foreach ($expected as $action => $strategy) {
            $this->assertSame(
                $strategy,
                WPSG_Permissions::strategy($action),
                "Strategy for action '{$action}' drifted from the frozen matrix"
            );
        }

        // No undocumented actions snuck into the map.
        foreach (WPSG_Permissions::MAP as $action => $strategy) {
            $this->assertArrayHasKey(
                $action,
                $expected,
                "WPSG_Permissions::MAP has action '{$action}' not present in the frozen matrix"
            );
        }
    }

    public function test_all_strategies_are_callable_primitives() {
        $strategies = array_unique(array_values(WPSG_Permissions::MAP));
        foreach ($strategies as $strategy) {
            if ($strategy === '__return_true') {
                continue;
            }
            $this->assertTrue(
                is_callable([WPSG_REST_Base::class, $strategy]),
                "Strategy '{$strategy}' is not a callable WPSG_REST_Base primitive"
            );
        }
    }

    // ── Completeness / no-bypass ──────────────────────────────────────────

    /**
     * Every registered wp-super-gallery/v1 route MUST resolve its permission
     * through WPSG_Permissions::gate() — proving the map is the single wired
     * source of truth and that no route is left public-by-omission.
     */
    public function test_every_registered_route_resolves_through_permissions() {
        $routes = rest_get_server()->get_routes();
        $found_actions = [];

        foreach ($routes as $route => $endpoints) {
            // Skip the auto-registered namespace index (`/wp-super-gallery/v1`).
            if (!preg_match('#^/wp-super-gallery/v1/.+#', $route)) {
                continue;
            }

            foreach ($endpoints as $endpoint) {
                $this->assertArrayHasKey(
                    'permission_callback',
                    $endpoint,
                    "Route {$route} has an endpoint with no permission_callback"
                );

                $pc = $endpoint['permission_callback'];
                $this->assertInstanceOf(
                    Closure::class,
                    $pc,
                    "Route {$route} permission_callback is not a WPSG_Permissions gate (got " . gettype($pc) . ')'
                );

                $ref   = new ReflectionFunction($pc);
                $scope = $ref->getClosureScopeClass();
                $this->assertNotNull($scope, "Route {$route} permission_callback has no closure scope");
                $this->assertSame(
                    'WPSG_Permissions',
                    $scope->getName(),
                    "Route {$route} permission_callback does not originate from WPSG_Permissions"
                );

                $vars = $ref->getStaticVariables();
                $this->assertArrayHasKey('action', $vars, "Route {$route} gate has no bound action");
                $this->assertTrue(
                    WPSG_Permissions::has($vars['action']),
                    "Route {$route} gate references unknown action '{$vars['action']}'"
                );
                $found_actions[$vars['action']] = true;
            }
        }

        // The set of actions wired to routes must equal the map exactly: no route
        // bypasses the map (else its pc would have failed the gate assertions above)
        // and no map entry is dead (unwired). An exact endpoint *count* is not
        // asserted because WP's REST server singleton accumulates duplicate
        // endpoint registrations across the full suite (every rest_api_init
        // re-appends), which is harmless — each duplicate is still a valid gate.
        $this->assertEqualsCanonicalizing(
            array_keys(WPSG_Permissions::MAP),
            array_keys($found_actions),
            'The set of actions wired to routes must equal the WPSG_Permissions map exactly'
        );
    }

    // ── Strategy behavior (require_admin / public / authenticated) ─────────

    private function make_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    /** A space-scoped editor: manage_wpsg but NOT manage_options (the wpsg_admin/wpsg_editor shape). */
    private function make_manage_wpsg_only(): int {
        $uid  = self::factory()->user->create(['role' => 'subscriber']);
        $user = get_user_by('id', $uid);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    public function test_require_admin_baseline_allows_manage_wpsg_denies_others() {
        // Admin (manage_options + manage_wpsg) → allowed.
        $this->make_admin();
        $this->assertTrue(
            WPSG_Permissions::check('settings.update'),
            'administrator must pass require_admin (settings.update)'
        );

        // BASELINE (pre-A4/A5): a manage_wpsg-only editor ALSO passes require_admin
        // on system actions. F2 documents this; A4/A5 will tighten it.
        $this->make_manage_wpsg_only();
        $this->assertTrue(
            WPSG_Permissions::check('settings.update'),
            'P52-A1 baseline: manage_wpsg-only currently passes require_admin'
        );

        // Plain subscriber → denied.
        $sub = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($sub);
        $this->assertFalse(
            WPSG_Permissions::check('settings.update'),
            'subscriber must fail require_admin'
        );

        // Anonymous → denied.
        wp_set_current_user(0);
        $this->assertFalse(
            WPSG_Permissions::check('settings.update'),
            'anonymous must fail require_admin'
        );
    }

    public function test_public_strategy_allows_anonymous() {
        wp_set_current_user(0);
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $this->assertTrue(
            WPSG_Permissions::check('campaigns.list', $req) === true,
            'rate_limit_public must allow an anonymous request within the limit'
        );
    }

    public function test_always_allow_strategy() {
        wp_set_current_user(0);
        $this->assertTrue(WPSG_Permissions::check('auth.login'), '__return_true action must always allow');
        $this->assertTrue(WPSG_Permissions::check('layout_templates.read_public'), 'public template read must allow');
    }

    public function test_require_authenticated_strategy() {
        wp_set_current_user(0);
        $this->assertFalse(WPSG_Permissions::check('auth.permissions.read'), 'anonymous must fail require_authenticated');

        $uid = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($uid);
        $this->assertTrue(WPSG_Permissions::check('auth.permissions.read'), 'logged-in user must pass require_authenticated');
    }

    // ── Dispatcher & gate guarantees ──────────────────────────────────────

    public function test_unknown_action_fails_closed() {
        $this->make_admin();
        $this->assertFalse(
            WPSG_Permissions::check('does.not.exist'),
            'unknown actions must fail closed even for an administrator'
        );
        $this->assertFalse(WPSG_Permissions::has('does.not.exist'));
        $this->assertSame('', WPSG_Permissions::strategy('does.not.exist'));
    }

    public function test_gate_returns_callable_matching_check() {
        $this->make_admin();
        $gate = WPSG_Permissions::gate('settings.update');
        $this->assertInstanceOf(Closure::class, $gate);
        $this->assertSame(
            WPSG_Permissions::check('settings.update'),
            $gate(null),
            'gate() closure must produce the same result as check()'
        );
    }

    public function test_gate_warns_on_unknown_action() {
        $this->setExpectedIncorrectUsage('WPSG_Permissions::gate');
        WPSG_Permissions::gate('totally.bogus.action');
    }

    // ── Capability-tier seam (single WP-coupling point) ───────────────────

    public function test_actor_has_tier_resolves_current_user() {
        // System Admin (manage_options + manage_wpsg) meets every tier.
        $this->make_admin();
        $this->assertTrue(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN));
        $this->assertTrue(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR));
        $this->assertTrue(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_VIEWER));

        // Space editor (manage_wpsg only) meets EDITOR + VIEWER, not SYSTEM_ADMIN.
        $this->make_manage_wpsg_only();
        $this->assertFalse(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN));
        $this->assertTrue(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR));
        $this->assertTrue(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_VIEWER));

        // Plain subscriber meets only VIEWER.
        wp_set_current_user(self::factory()->user->create(['role' => 'subscriber']));
        $this->assertFalse(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN));
        $this->assertFalse(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR));
        $this->assertTrue(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_VIEWER));

        // Anonymous meets nothing; unknown tier fails closed.
        wp_set_current_user(0);
        $this->assertFalse(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN));
        $this->assertFalse(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR));
        $this->assertFalse(WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_VIEWER));
        $this->assertFalse(WPSG_Permissions::actor_has_tier('nonexistent_tier'));
    }
}
