<?php

/**
 * P28-B: Time-Limited Access Grants
 *
 * Covers:
 *  - POST /campaigns/{id}/access stores expires_at in post meta.
 *  - GET  /campaigns/{id}/access returns is_expired correctly.
 *  - GET  /campaigns/{id}/access hides expired grants by default.
 *  - GET  /campaigns/{id}/access?include_expired=true shows them.
 *  - WPSG_Maintenance::purge_expired_grants() removes stale entries.
 *  - Invalid expires_at format returns 400.
 *  - Grant with no expires_at is permanent (is_expired = false).
 */
class WPSG_P28B_Access_Expiry_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function create_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P28-B Test Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    public function setUp(): void {
        parent::setUp();
    }

    public function tearDown(): void {
        parent::tearDown();
    }

    // -------------------------------------------------------------------------
    // Grant with a FUTURE expiry — grant is active, is_expired = false.
    // -------------------------------------------------------------------------

    public function test_grant_with_future_expiry_is_stored_and_not_expired() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);
        $future      = gmdate('c', strtotime('+7 days'));

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('source', 'campaign');
        $request->set_param('expires_at', $future);
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status(), 'Grant with future expiry should succeed.');

        // Verify persisted in post meta.
        $grants = get_post_meta($campaign_id, 'access_grants', true);
        $this->assertIsArray($grants);
        $stored = array_filter($grants, fn($g) => intval($g['userId'] ?? 0) === $grantee_id);
        $this->assertCount(1, $stored, 'Grant should be stored.');
        $stored = array_values($stored)[0];
        $this->assertNotNull($stored['expires_at'], 'expires_at should be persisted.');

        // GET returns is_expired = false.
        $get = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $get_response = rest_do_request($get);
        $data  = $get_response->get_data();
        $items = $data['items'] ?? [];
        $match = array_values(array_filter($items, fn($g) => intval($g['userId'] ?? 0) === $grantee_id));
        $this->assertCount(1, $match, 'Active (non-expired) grant should appear in default list.');
        $this->assertFalse($match[0]['is_expired'], 'is_expired should be false for a future expiry.');
        $this->assertNotNull($match[0]['expires_at'], 'expires_at should be present in response.');
    }

    // -------------------------------------------------------------------------
    // Grant with a PAST expiry — is_expired = true, hidden by default.
    // -------------------------------------------------------------------------

    public function test_grant_with_past_expiry_is_hidden_by_default_and_is_expired_true() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        // Manually write a grant with a past expires_at directly into post meta
        // (simulates a grant that was issued and has since lapsed).
        $past   = gmdate('c', strtotime('-1 hour'));
        $grants = [
            [
                'userId'     => $grantee_id,
                'campaignId' => $campaign_id,
                'source'     => 'campaign',
                'grantedAt'  => gmdate('c', strtotime('-2 days')),
                'expires_at' => $past,
            ],
        ];
        update_post_meta($campaign_id, 'access_grants', $grants);

        // Default GET should NOT include the expired grant.
        $get = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $get_response = rest_do_request($get);
        $items = $get_response->get_data()['items'] ?? [];
        $match = array_filter($items, fn($g) => intval($g['userId'] ?? 0) === $grantee_id);
        $this->assertCount(0, $match, 'Expired grant should be hidden from default list.');

        // With include_expired=true it should appear and is_expired should be true.
        $get_expired = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $get_expired->set_param('include_expired', 'true');
        $get_expired_response = rest_do_request($get_expired);
        $items_with = $get_expired_response->get_data()['items'] ?? [];
        $match_with = array_values(array_filter($items_with, fn($g) => intval($g['userId'] ?? 0) === $grantee_id));
        $this->assertCount(1, $match_with, 'Expired grant should appear when include_expired=true.');
        $this->assertTrue($match_with[0]['is_expired'], 'is_expired must be true for a past expiry.');
    }

    // -------------------------------------------------------------------------
    // Grant with NO expiry — permanent, is_expired = false.
    // -------------------------------------------------------------------------

    public function test_grant_with_no_expiry_is_permanent() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('source', 'campaign');
        // No expires_at supplied.
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());

        $get = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $items = rest_do_request($get)->get_data()['items'] ?? [];
        $match = array_values(array_filter($items, fn($g) => intval($g['userId'] ?? 0) === $grantee_id));
        $this->assertCount(1, $match, 'Permanent grant should appear.');
        $this->assertFalse($match[0]['is_expired'], 'Permanent grant must not be expired.');
        $this->assertNull($match[0]['expires_at'], 'expires_at should be null for a permanent grant.');
    }

    // -------------------------------------------------------------------------
    // Invalid expires_at returns 400.
    // -------------------------------------------------------------------------

    public function test_grant_with_invalid_expires_at_returns_400() {
        $admin_id    = $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $request->set_param('userId', $grantee_id);
        $request->set_param('source', 'campaign');
        $request->set_param('expires_at', 'not-a-date');
        $response = rest_do_request($request);

        $this->assertEquals(400, $response->get_status(), 'Invalid expires_at should return 400.');
    }

    // -------------------------------------------------------------------------
    // WP-Cron: purge_expired_grants() removes entries past their expiry.
    // -------------------------------------------------------------------------

    public function test_purge_expired_grants_removes_past_expiry_entries() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_a   = self::factory()->user->create([ 'role' => 'subscriber' ]);
        $grantee_b   = self::factory()->user->create([ 'role' => 'subscriber' ]);

        update_post_meta($campaign_id, 'access_grants', [
            [
                'userId'     => $grantee_a,
                'campaignId' => $campaign_id,
                'source'     => 'campaign',
                'grantedAt'  => gmdate('c'),
                'expires_at' => gmdate('c', strtotime('-1 hour')), // EXPIRED
            ],
            [
                'userId'     => $grantee_b,
                'campaignId' => $campaign_id,
                'source'     => 'campaign',
                'grantedAt'  => gmdate('c'),
                'expires_at' => gmdate('c', strtotime('+7 days')), // ACTIVE
            ],
        ]);

        WPSG_Maintenance::purge_expired_grants();

        $remaining = get_post_meta($campaign_id, 'access_grants', true);
        $this->assertIsArray($remaining);
        $ids = array_column($remaining, 'userId');
        $this->assertNotContains($grantee_a, $ids, 'Expired grant should have been removed.');
        $this->assertContains($grantee_b, $ids, 'Active grant should have been preserved.');
    }

    // -------------------------------------------------------------------------
    // purge_expired_grants() preserves grants with no expiry.
    // -------------------------------------------------------------------------

    public function test_purge_expired_grants_keeps_permanent_grants() {
        $this->set_admin_user();
        $campaign_id = $this->create_campaign();
        $grantee_id  = self::factory()->user->create([ 'role' => 'subscriber' ]);

        update_post_meta($campaign_id, 'access_grants', [
            [
                'userId'     => $grantee_id,
                'campaignId' => $campaign_id,
                'source'     => 'campaign',
                'grantedAt'  => gmdate('c'),
                'expires_at' => null, // permanent
            ],
        ]);

        WPSG_Maintenance::purge_expired_grants();

        $remaining = get_post_meta($campaign_id, 'access_grants', true);
        $this->assertIsArray($remaining);
        $this->assertCount(1, $remaining, 'Permanent grant must not be removed by cron.');
    }
}
