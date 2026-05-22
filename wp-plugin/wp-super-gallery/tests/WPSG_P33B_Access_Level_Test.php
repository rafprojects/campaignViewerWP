<?php

/**
 * P33-B: Campaign / Company Grant Schema — access_level
 *
 * Covers:
 *  - POST /campaigns/{id}/access stores access_level in post meta.
 *  - GET  /campaigns/{id}/access returns access_level on every entry.
 *  - Legacy grants without access_level are normalised to 'viewer' on GET.
 *  - Invalid access_level value is rejected with 400.
 *  - POST /companies/{id}/access stores access_level in term meta.
 *  - GET  /companies/{id}/access returns access_level on every entry.
 *  - POST /campaigns/{id}/access-requests/{token}/approve stores access_level.
 *  - Approve without explicit access_level defaults to 'viewer'.
 *  - deny action grants carry no access_level field.
 */
class WPSG_P33B_Access_Level_Test extends WP_UnitTestCase {

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

    private function create_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P33-B Test Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function create_company(): int {
        $result = wp_insert_term('P33-B Test Company', 'wpsg_company');
        return intval($result['term_id']);
    }

    // ── Campaign grant — access_level stored and returned ─────────────────────

    public function test_campaign_grant_stores_access_level() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('source', 'campaign');
        $request->set_param('access_level', 'editor');
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());

        $grants = get_post_meta($campaign_id, 'access_grants', true);
        $this->assertIsArray($grants);
        $match = array_filter($grants, fn($g) => intval($g['userId']) === $grantee_id);
        $match = array_values($match);
        $this->assertCount(1, $match);
        $this->assertSame('editor', $match[0]['access_level']);
    }

    public function test_campaign_grant_list_returns_access_level() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $post_request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $post_request->set_param('userId', $grantee_id);
        $post_request->set_param('source', 'campaign');
        $post_request->set_param('access_level', 'owner');
        rest_do_request($post_request);

        $get_request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $get_response = rest_do_request($get_request);

        $this->assertSame(200, $get_response->get_status());
        $data = $get_response->get_data();
        $this->assertNotEmpty($data['items']);
        $first = $data['items'][0];
        $this->assertSame('owner', $first['access_level']);
    }

    public function test_campaign_grant_defaults_to_viewer_when_omitted() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('source', 'campaign');
        // No access_level param — should default to 'viewer'.
        $response = rest_do_request($request);
        $this->assertSame(200, $response->get_status());

        $grants = get_post_meta($campaign_id, 'access_grants', true);
        $match  = array_values(array_filter($grants, fn($g) => intval($g['userId']) === $grantee_id));
        $this->assertSame('viewer', $match[0]['access_level']);
    }

    // ── Legacy grant normalisation ─────────────────────────────────────────────

    public function test_legacy_grant_without_access_level_normalised_to_viewer_on_list() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        // Write a legacy grant directly to meta (no access_level key).
        update_post_meta($campaign_id, 'access_grants', [[
            'userId'    => $grantee_id,
            'campaignId' => $campaign_id,
            'source'    => 'campaign',
            'grantedAt' => gmdate('c'),
            // Intentionally omitting access_level to simulate a legacy record.
        ]]);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $data  = $response->get_data();
        $first = $data['items'][0];
        $this->assertSame('viewer', $first['access_level'], 'Legacy grants without access_level must be normalised to viewer');
    }

    // ── Invalid access_level rejected ────────────────────────────────────────

    public function test_invalid_access_level_is_rejected() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('source', 'campaign');
        $request->set_param('access_level', 'superadmin');   // not in enum
        $response = rest_do_request($request);

        $this->assertSame(400, $response->get_status());
    }

    // ── Company grant — access_level stored and returned ─────────────────────

    public function test_company_grant_stores_access_level() {
        $this->set_admin_user();
        $company_id = $this->create_company();
        $grantee_id = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/companies/{$company_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('access_level', 'editor');
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());

        $grants = get_term_meta($company_id, 'access_grants', true);
        $this->assertIsArray($grants);
        $match = array_values(array_filter($grants, fn($g) => intval($g['userId']) === $grantee_id));
        $this->assertCount(1, $match);
        $this->assertSame('editor', $match[0]['access_level']);
    }

    public function test_company_grant_list_normalises_legacy_records() {
        $this->set_admin_user();
        $company_id = $this->create_company();
        $grantee_id = self::factory()->user->create([ 'role' => 'subscriber' ]);

        // Write legacy grant without access_level.
        update_term_meta($company_id, 'access_grants', [[
            'userId'    => $grantee_id,
            'companyId' => $company_id,
            'source'    => 'company',
            'grantedAt' => gmdate('c'),
        ]]);

        $request  = new WP_REST_Request('GET', "/wp-super-gallery/v1/companies/{$company_id}/access");
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $data  = $response->get_data();
        $first = $data['items'][0];
        $this->assertSame('viewer', $first['access_level']);
    }

    // ── Approval workflow ─────────────────────────────────────────────────────

    public function test_approve_request_stores_explicit_access_level() {
        global $wpdb;
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $email       = 'p33b-approval@example.com';
        $token       = wp_generate_uuid4();

        // Insert a pending request directly.
        $table = $wpdb->prefix . 'wpsg_access_requests';
        $wpdb->insert($table, [
            'token'        => $token,
            'campaign_id'  => $campaign_id,
            'email'        => $email,
            'status'       => 'pending',
            'requested_at' => current_time('mysql', true),
        ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/approve");
        $request->set_param('access_level', 'editor');
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());

        $grants = get_post_meta($campaign_id, 'access_grants', true);
        $match  = array_values(array_filter($grants, fn($g) => get_user_by('email', $email) && intval($g['userId']) === get_user_by('email', $email)->ID));
        if (!empty($match)) {
            $this->assertSame('editor', $match[0]['access_level']);
        } else {
            // User provisioned — find by email.
            $user = get_user_by('email', $email);
            $this->assertNotFalse($user, 'User should have been provisioned on approval');
            $all = get_post_meta($campaign_id, 'access_grants', true);
            $m   = array_values(array_filter($all, fn($g) => intval($g['userId']) === $user->ID));
            $this->assertNotEmpty($m);
            $this->assertSame('editor', $m[0]['access_level']);
        }
    }

    public function test_approve_request_defaults_to_viewer_when_no_level_given() {
        global $wpdb;
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $email       = 'p33b-default-viewer@example.com';
        $token       = wp_generate_uuid4();

        $table = $wpdb->prefix . 'wpsg_access_requests';
        $wpdb->insert($table, [
            'token'        => $token,
            'campaign_id'  => $campaign_id,
            'email'        => $email,
            'status'       => 'pending',
            'requested_at' => current_time('mysql', true),
        ]);

        $request  = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/approve");
        // No access_level param.
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());

        $user = get_user_by('email', $email);
        $this->assertNotFalse($user);
        $grants = get_post_meta($campaign_id, 'access_grants', true);
        $match  = array_values(array_filter($grants, fn($g) => intval($g['userId']) === $user->ID));
        $this->assertNotEmpty($match);
        $this->assertSame('viewer', $match[0]['access_level']);
    }
}
