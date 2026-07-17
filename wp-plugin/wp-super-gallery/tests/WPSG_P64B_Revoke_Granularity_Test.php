<?php

/**
 * P64-B: campaign-scoped revoke must not silently revoke company-wide access.
 *
 * `DELETE /campaigns/{id}/access/{userId}` used to delete the user's grants from
 * campaign postmeta, campaign overrides, AND company termmeta in one shot — so
 * revoking one campaign wiped every campaign of that company, and a space editor
 * (who can reach this endpoint) could destroy System-Admin-tier company grants.
 *
 * The fix: the campaign endpoint never touches company termmeta. For a
 * company-sourced user it writes a per-campaign deny override (block THIS
 * campaign only); for a campaign-sourced user it removes the campaign grant.
 */
class WPSG_P64B_Revoke_Granularity_Test extends WP_UnitTestCase {

    private function set_system_admin(): int {
        $uid  = self::factory()->user->create(['role' => 'administrator']);
        get_user_by('id', $uid)->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    /** Space editor: manage_wpsg but NOT manage_options. */
    private function make_editor(): int {
        $uid = self::factory()->user->create(['role' => 'subscriber']);
        get_user_by('id', $uid)->add_cap('manage_wpsg');
        return $uid;
    }

    private function make_company(string $name): int {
        $term = wp_insert_term($name . ' ' . wp_generate_password(6, false), 'wpsg_company');
        return intval($term['term_id']);
    }

    private function make_space(): int {
        return WPSG_DB::insert_space([
            'name'           => 'B ' . wp_generate_password(6, false),
            'slug'           => 'b-' . wp_generate_password(6, false),
            'isolation_mode' => 'delegated',
        ]);
    }

    private function grant_space(int $space_id, int $user_id): void {
        WPSG_DB::update_space($space_id, [
            'access_grants' => [['userId' => $user_id, 'access_level' => 'editor']],
        ]);
    }

    /**
     * Campaign with NO explicit space, so get_effective_campaign_level's space
     * gate (which reads _wpsg_space_id directly, no default fallback) stays out
     * of the way. Pass a $space_id to attach one for the permission-gate tests.
     */
    private function campaign(int $company_term_id = 0, int $space_id = 0): int {
        $id = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => 'C', 'post_status' => 'publish']);
        update_post_meta($id, 'status', 'active');
        if ($company_term_id > 0) {
            wp_set_object_terms($id, [$company_term_id], 'wpsg_company');
        }
        if ($space_id > 0) {
            update_post_meta($id, '_wpsg_space_id', $space_id);
        }
        return intval($id);
    }

    /**
     * Effective level for a user, evaluated as a logged-out observer so the
     * `current_user_can('manage_wpsg')` admin short-circuit (which keys off the
     * CURRENT user, not $user_id) doesn't mask the grant/override resolution.
     */
    private function effective_level(int $user_id, int $campaign_id): string {
        $prev = get_current_user_id();
        wp_set_current_user(0);
        $m = new ReflectionMethod('WPSG_Access_Controller', 'get_effective_campaign_level');
        $m->setAccessible(true);
        $level = $m->invoke(null, $user_id, $campaign_id);
        wp_set_current_user($prev);
        return $level;
    }

    private function revoke_campaign_access(int $campaign_id, int $user_id): WP_REST_Response {
        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access/{$user_id}");
        return rest_do_request($req);
    }

    // ── Campaign-sourced user: only the campaign grant is removed ───────────────

    public function test_campaign_sourced_revoke_removes_only_the_campaign_grant() {
        $this->set_system_admin();
        $company = $this->make_company('Acme');
        $cid     = $this->campaign($company);
        $user    = self::factory()->user->create(['role' => 'subscriber']);

        // Campaign-level grant, no company grant.
        update_post_meta($cid, 'access_grants', [[
            'userId' => $user, 'campaignId' => $cid, 'source' => 'campaign',
            'grantedAt' => gmdate('c'), 'access_level' => 'viewer',
        ]]);
        $this->assertSame('viewer', $this->effective_level($user, $cid), 'granted before revoke');

        $res = $this->revoke_campaign_access($cid, $user);
        $this->assertSame(200, $res->get_status());
        $this->assertSame('campaign_grant', $res->get_data()['removed']);

        // Grant gone; no deny override written; effective access gone.
        $this->assertSame([], get_post_meta($cid, 'access_grants', true));
        $this->assertSame([], get_post_meta($cid, 'access_overrides', true), 'no redundant deny override');
        $this->assertSame('', $this->effective_level($user, $cid));
    }

    // ── Company-sourced user: deny override, company grant + other campaigns kept ─

    public function test_company_sourced_revoke_blocks_one_campaign_and_keeps_the_rest() {
        $this->set_system_admin();
        $company = $this->make_company('Globex');
        $camp_a  = $this->campaign($company);
        $camp_b  = $this->campaign($company);
        $user    = self::factory()->user->create(['role' => 'subscriber']);

        // Company-wide grant propagates to every campaign of the company.
        update_term_meta($company, 'access_grants', [[
            'userId' => $user, 'companyId' => $company, 'source' => 'company',
            'grantedAt' => gmdate('c'), 'access_level' => 'viewer',
        ]]);
        $this->assertSame('viewer', $this->effective_level($user, $camp_a), 'company grant reaches campaign A');
        $this->assertSame('viewer', $this->effective_level($user, $camp_b), 'company grant reaches campaign B');

        // Revoke from campaign A only.
        $res = $this->revoke_campaign_access($camp_a, $user);
        $this->assertSame(200, $res->get_status());
        $this->assertSame('deny_override_added', $res->get_data()['removed']);

        // Company grant is untouched.
        $company_grants = get_term_meta($company, 'access_grants', true);
        $this->assertCount(1, $company_grants);
        $this->assertSame($user, intval($company_grants[0]['userId']), 'company grant preserved');

        // Campaign A blocked via deny override; campaign B still accessible.
        $overrides = get_post_meta($camp_a, 'access_overrides', true);
        $this->assertCount(1, $overrides);
        $this->assertSame('deny', $overrides[0]['action']);
        $this->assertSame('', $this->effective_level($user, $camp_a), 'blocked on campaign A');
        $this->assertSame('viewer', $this->effective_level($user, $camp_b), 'still has campaign B via company grant');
    }

    // ── Tier fix: a space editor cannot destroy company grants via this endpoint ──

    public function test_space_editor_campaign_revoke_cannot_touch_company_grants() {
        $this->set_system_admin();
        $company = $this->make_company('Initech');
        // A delegated editor with access to the campaign's space — the exact
        // "side door" this track closes: reachable via require_campaign_space_access.
        $editor  = $this->make_editor();
        $space   = $this->make_space();
        $this->grant_space($space, $editor);
        $cid     = $this->campaign($company, $space);
        $target  = self::factory()->user->create(['role' => 'subscriber']);

        // Target has System-Admin-tier company-wide access.
        update_term_meta($company, 'access_grants', [[
            'userId' => $target, 'companyId' => $company, 'source' => 'company',
            'grantedAt' => gmdate('c'), 'access_level' => 'viewer',
        ]]);

        wp_set_current_user($editor);

        $res = $this->revoke_campaign_access($cid, $target);
        $this->assertSame(200, $res->get_status(), 'editor may revoke on a campaign they can manage');
        $this->assertSame('deny_override_added', $res->get_data()['removed']);

        // The company grant SURVIVES — pre-fix the editor would have wiped it.
        $company_grants = get_term_meta($company, 'access_grants', true);
        $this->assertCount(1, $company_grants, 'company grant untouched by a campaign-scoped revoke');
        $this->assertSame($target, intval($company_grants[0]['userId']));
    }

    // ── The System-Admin company-wide revoke endpoint is unchanged ──────────────

    public function test_company_wide_revoke_endpoint_still_removes_the_company_grant() {
        $this->set_system_admin();
        $company = $this->make_company('Umbrella');
        $cid     = $this->campaign($company);
        $user    = self::factory()->user->create(['role' => 'subscriber']);

        update_term_meta($company, 'access_grants', [[
            'userId' => $user, 'companyId' => $company, 'source' => 'company',
            'grantedAt' => gmdate('c'), 'access_level' => 'viewer',
        ]]);

        $req = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/companies/{$company}/access/{$user}");
        $res = rest_do_request($req);
        $this->assertSame(200, $res->get_status());
        $this->assertSame([], get_term_meta($company, 'access_grants', true), 'company-wide revoke clears the company grant');
    }
}
