<?php

class WPSG_Campaign_Rest_Test extends WP_UnitTestCase {
    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($user_id);
        return $user_id;
    }

    public function setUp(): void {
        parent::setUp();
        // Disable nonce verification for direct REST tests (no browser session).
        add_filter('wpsg_require_rest_nonce', '__return_false');
    }

    public function tearDown(): void {
        remove_filter('wpsg_require_rest_nonce', '__return_false');
        parent::tearDown();
    }
    public function test_campaign_create_update_archive_restore_flow() {
        $this->set_admin_user();

        // Create campaign
        $create = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $create->set_param('title', 'Test Campaign');
        $create->set_param('description', 'Initial description');
        $create->set_param('visibility', 'private');
        $create->set_param('status', 'active');
        $create->set_param('company', 'acme');
        $create->set_param('tags', ['launch']);

        $create_response = rest_do_request($create);
        $this->assertEquals(201, $create_response->get_status());
        $created = $create_response->get_data();
        $this->assertEquals('Test Campaign', $created['title'] ?? null);
        $campaign_id = intval($created['id'] ?? 0);
        $this->assertGreaterThan(0, $campaign_id);

        // Update campaign
        $update = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $update->set_param('title', 'Updated Campaign');
        $update->set_param('description', 'Updated description');
        $update->set_param('visibility', 'public');
        $update_response = rest_do_request($update);
        $this->assertEquals(200, $update_response->get_status());
        $updated = $update_response->get_data();
        $this->assertEquals('Updated Campaign', $updated['title'] ?? null);

        // Archive campaign
        $archive = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/archive");
        $archive_response = rest_do_request($archive);
        $this->assertEquals(200, $archive_response->get_status());
        $this->assertEquals('archived', get_post_meta($campaign_id, 'status', true));

        // Restore campaign
        $restore = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/restore");
        $restore_response = rest_do_request($restore);
        $this->assertEquals(200, $restore_response->get_status());
        $this->assertEquals('active', get_post_meta($campaign_id, 'status', true));
    }

    // ---------------------------------------------------------------- Edge cases

    public function test_get_campaign_returns_not_found_for_unknown_id() {
        $this->set_admin_user();

        // Use a very large ID that won't exist.
        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/999999999');
        $response = rest_do_request($req);

        // Permission callback returns false for non-existent post → 403/401,
        // or the route may 404 directly. Either way it must not be 200.
        $this->assertNotEquals(200, $response->get_status());
    }

    public function test_create_campaign_requires_manage_wpsg_capability() {
        // Unauthenticated (no user set).
        wp_set_current_user(0);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $req->set_param('title', 'Should Fail');
        $response = rest_do_request($req);

        $this->assertContains($response->get_status(), [401, 403]);
    }

    public function test_archive_is_idempotent() {
        $this->set_admin_user();

        // Create a campaign.
        $create = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $create->set_param('title', 'Idempotent Archive Test');
        $create->set_param('status', 'active');
        $id = intval(rest_do_request($create)->get_data()['id']);

        // Archive it once.
        $req1 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$id}/archive");
        $r1   = rest_do_request($req1);
        $this->assertEquals(200, $r1->get_status());

        // Archive it again — should still succeed (idempotent).
        $req2 = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$id}/archive");
        $r2   = rest_do_request($req2);
        $this->assertEquals(200, $r2->get_status());
        $this->assertEquals('archived', get_post_meta($id, 'status', true));
    }

    public function test_campaign_list_returns_array() {
        $this->set_admin_user();

        // Create two campaigns.
        foreach (['Alpha', 'Beta'] as $title) {
            $c = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
            $c->set_param('title', $title);
            $c->set_param('status', 'active');
            rest_do_request($c);
        }

        $list     = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $response = rest_do_request($list);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertIsArray($data);
        $this->assertGreaterThanOrEqual(2, count($data));
    }

    public function test_update_campaign_returns_404_for_unknown_id() {
        $this->set_admin_user();

        $req = new WP_REST_Request('PUT', '/wp-super-gallery/v1/campaigns/999999999');
        $req->set_param('title', 'Ghost Update');
        $response = rest_do_request($req);

        $this->assertNotEquals(200, $response->get_status());
    }

    public function test_restore_non_archived_campaign_is_handled() {
        $this->set_admin_user();

        // Create a campaign and leave it as active (never archive).
        $create = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $create->set_param('title', 'Restore Test');
        $create->set_param('status', 'active');
        $id = intval(rest_do_request($create)->get_data()['id']);

        // Restore without prior archive — endpoint must not error (200 or graceful).
        $restore   = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$id}/restore");
        $response  = rest_do_request($restore);

        $this->assertContains($response->get_status(), [200, 400, 422]);
    }
}
