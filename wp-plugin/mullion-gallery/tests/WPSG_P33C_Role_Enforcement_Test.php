<?php

/**
 * P33-C: Role-Aware Server-Side Enforcement
 *
 * ── UPDATED for P53-D (2026-06-15) ────────────────────────────────────────
 * The per-campaign editor/owner GRANT levels no longer confer mutation or
 * management. Editing/managing a campaign now requires the `wpsg_editor` role
 * (`manage_wpsg`) + access to the campaign's space (`require_campaign_space_access`);
 * per-campaign grants are viewer-only (read). So a non-admin holding a legacy
 * `editor`/`owner` grant can still VIEW the campaign but is denied every mutation.
 *
 * Resulting matrix asserted here:
 *  - viewer / editor / owner GRANT (non-admin):  all mutations → 403
 *  - site-wide admin (`manage_wpsg`):            mutations → allowed
 *  - explicit deny override + no-grant:          → 403
 *
 * Affirmative coverage of the role-based path (manage_wpsg editor allowed; a
 * delegated-space editor without access denied — F2) lives in
 * WPSG_P52A5b_Campaign_Space_Scoping_Test and WPSG_P53D_Grant_Model_Test.
 */
class WPSG_P33C_Role_Enforcement_Test extends WP_UnitTestCase {

    // ── Helpers ────────────────────────────────────────────────────────────────

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap($cap);
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    /**
     * Create a WP subscriber and give them a campaign-level grant.
     */
    private function create_user_with_level(int $campaign_id, string $level): int {
        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        $grants = get_post_meta($campaign_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];
        $grants[] = [
            'userId'       => $user_id,
            'campaignId'   => $campaign_id,
            'source'       => 'campaign',
            'grantedAt'    => gmdate('c'),
            'access_level' => $level,
        ];
        update_post_meta($campaign_id, 'access_grants', $grants);
        return $user_id;
    }

    private function create_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P33-C Test Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    // ── Viewer is denied all mutations ────────────────────────────────────────

    public function test_viewer_denied_update_campaign() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $viewer_id   = $this->create_user_with_level($campaign_id, 'viewer');
        wp_set_current_user($viewer_id);

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'New Title');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'viewer should be denied PUT /campaigns/{id}');
    }

    public function test_viewer_denied_create_media() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $viewer_id   = $this->create_user_with_level($campaign_id, 'viewer');
        wp_set_current_user($viewer_id);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media");
        $request->set_param('type', 'image');
        $request->set_param('source', 'external');
        $request->set_param('url', 'https://example.com/img.jpg');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'viewer should be denied POST /campaigns/{id}/media');
    }

    public function test_viewer_denied_archive_campaign() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $viewer_id   = $this->create_user_with_level($campaign_id, 'viewer');
        wp_set_current_user($viewer_id);

        $request  = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'viewer should be denied POST /campaigns/{id}/archive');
    }

    public function test_viewer_denied_list_access() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $viewer_id   = $this->create_user_with_level($campaign_id, 'viewer');
        wp_set_current_user($viewer_id);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'viewer should be denied GET /campaigns/{id}/access');
    }

    // ── Editor is allowed metadata + media mutations, denied owner actions ───

    public function test_editor_grant_no_longer_allows_update_campaign() {
        // P53-D: a per-campaign 'editor' grant on a non-admin no longer confers
        // edit rights — editing requires the wpsg_editor role (manage_wpsg).
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $editor_id   = $this->create_user_with_level($campaign_id, 'editor');
        wp_set_current_user($editor_id);

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Editor Updated Title');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'editor grant must NOT allow PUT /campaigns/{id} (role required)');
    }

    public function test_editor_denied_archive_campaign() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $editor_id   = $this->create_user_with_level($campaign_id, 'editor');
        wp_set_current_user($editor_id);

        $request  = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'editor should be denied POST /campaigns/{id}/archive');
    }

    public function test_editor_denied_grant_access() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $editor_id   = $this->create_user_with_level($campaign_id, 'editor');
        $target_id   = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($editor_id);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $target_id);
        $request->set_param('source', 'campaign');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'editor should be denied POST /campaigns/{id}/access');
    }

    public function test_editor_denied_list_access() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $editor_id   = $this->create_user_with_level($campaign_id, 'editor');
        wp_set_current_user($editor_id);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'editor should be denied GET /campaigns/{id}/access');
    }

    // ── P53-D: an 'owner' grant no longer confers mutation/management ─────────
    // Editing, archiving, and access management now require the wpsg_editor role
    // (manage_wpsg) + access to the campaign's space — not a per-campaign grant.

    public function test_owner_grant_no_longer_allows_update_campaign() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $owner_id    = $this->create_user_with_level($campaign_id, 'owner');
        wp_set_current_user($owner_id);

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Owner Updated Title');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'owner grant must NOT allow PUT /campaigns/{id}');
    }

    public function test_owner_grant_no_longer_allows_archive_campaign() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $owner_id    = $this->create_user_with_level($campaign_id, 'owner');
        wp_set_current_user($owner_id);

        $request  = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'owner grant must NOT allow POST /campaigns/{id}/archive');
    }

    public function test_owner_grant_no_longer_allows_list_access() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $owner_id    = $this->create_user_with_level($campaign_id, 'owner');
        wp_set_current_user($owner_id);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'owner grant must NOT allow GET /campaigns/{id}/access');
    }

    public function test_owner_grant_no_longer_allows_grant_access() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $owner_id    = $this->create_user_with_level($campaign_id, 'owner');
        $target_id   = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($owner_id);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $target_id);
        $request->set_param('source', 'campaign');
        $request->set_param('access_level', 'viewer');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'owner grant must NOT allow POST /campaigns/{id}/access');
    }

    // ── Site-wide admin overrides all campaign roles ──────────────────────────

    public function test_site_admin_always_allowed_regardless_of_no_campaign_grant() {
        // Site admin has no explicit campaign grant at all.
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        // Do NOT add admin to access_grants.

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status(), 'site admin must bypass campaign role checks');
    }

    // ── Explicit deny overrides all grants ────────────────────────────────────

    public function test_deny_override_blocks_user_with_viewer_grant() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $user_id     = $this->create_user_with_level($campaign_id, 'viewer');

        // Add an explicit deny override for this user.
        update_post_meta($campaign_id, 'access_overrides', [[
            'userId'    => $user_id,
            'action'    => 'deny',
            'grantedAt' => gmdate('c'),
        ]]);

        wp_set_current_user($user_id);

        // Viewer is already blocked, but deny override should still result in 403.
        $request  = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Should Fail');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'deny override must block even a viewer-granted user');
    }

    public function test_deny_override_blocks_user_who_had_editor_grant() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $editor_id   = $this->create_user_with_level($campaign_id, 'editor');

        // Override the editor grant with an explicit deny.
        update_post_meta($campaign_id, 'access_overrides', [[
            'userId'    => $editor_id,
            'action'    => 'deny',
            'grantedAt' => gmdate('c'),
        ]]);

        wp_set_current_user($editor_id);

        $request  = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Should Still Fail');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'deny override must trump editor grant');
    }

    // ── No grant at all ──────────────────────────────────────────────────────

    public function test_user_with_no_grant_denied_all_mutations() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $no_grant_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($no_grant_id);

        $request  = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Should Fail');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'user with no grant must be denied');
    }

    // ── Company-level grant propagation ──────────────────────────────────────

    public function test_company_editor_grant_no_longer_allows_update() {
        // P53-D: a company-level 'editor' grant no longer confers edit rights.
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();

        // Create a company and attach the campaign.
        $company_result = wp_insert_term('P33-C Company', 'wpsg_company');
        $company_id     = intval($company_result['term_id']);
        wp_set_object_terms($campaign_id, $company_id, 'wpsg_company');

        // Grant editor access at the company level.
        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        update_term_meta($company_id, 'access_grants', [[
            'userId'       => $user_id,
            'companyId'    => $company_id,
            'source'       => 'company',
            'grantedAt'    => gmdate('c'),
            'access_level' => 'editor',
        ]]);

        wp_set_current_user($user_id);

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Company Editor Title');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'company editor grant must NOT allow campaign update (role required)');
    }

    public function test_campaign_grant_overrides_company_grant_downgrade() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();

        // Company grant: editor.
        $company_result = wp_insert_term('P33-C Override Company', 'wpsg_company');
        $company_id     = intval($company_result['term_id']);
        wp_set_object_terms($campaign_id, $company_id, 'wpsg_company');

        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        update_term_meta($company_id, 'access_grants', [[
            'userId'       => $user_id,
            'companyId'    => $company_id,
            'source'       => 'company',
            'grantedAt'    => gmdate('c'),
            'access_level' => 'editor',
        ]]);

        // Campaign grant (more specific): viewer — should override the company editor grant.
        $grants = [[
            'userId'       => $user_id,
            'campaignId'   => $campaign_id,
            'source'       => 'campaign',
            'grantedAt'    => gmdate('c'),
            'access_level' => 'viewer',
        ]];
        update_post_meta($campaign_id, 'access_grants', $grants);

        wp_set_current_user($user_id);

        // Viewer cannot edit metadata — even though company says editor.
        $request  = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $request->set_param('title', 'Should Fail — viewer via campaign override');
        $response = rest_do_request($request);

        $this->assertSame(403, $response->get_status(), 'campaign-level viewer grant must override company editor grant');
    }
}
