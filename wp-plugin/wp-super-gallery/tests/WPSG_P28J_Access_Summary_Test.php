<?php

/**
 * P28-J: Access Totals Summary Endpoint
 *
 * Covers:
 *  - Campaign with active grants appears with correct grantCount.
 *  - Campaign with no grants appears with grantCount = 0.
 *  - Expired grants are NOT counted.
 *  - Pending access requests are counted in pendingRequestCount.
 *  - Pagination: page + per_page params are respected.
 */
class WPSG_P28J_Access_Summary_Test extends WP_UnitTestCase {

    private function create_campaign(string $title = 'Test Campaign'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function set_grants(int $campaign_id, array $grants): void {
        update_post_meta($campaign_id, 'access_grants', $grants);
    }

    private function add_pending_request(int $campaign_id, string $email): void {
        WPSG_DB::insert_access_request([
            'token'        => wp_generate_uuid4(),
            'email'        => $email,
            'campaign_id'  => $campaign_id,
            'status'       => 'pending',
            'requested_at' => gmdate('c'),
        ]);
    }

    private function set_admin(): void {
        $admin_id = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin_id);
    }

    public function tearDown(): void {
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // Campaign with grants
    // =========================================================================

    public function test_campaign_with_grants_shows_correct_count() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Has Grants');

        $this->set_grants($campaign_id, [
            ['userId' => 10, 'expires_at' => ''],
            ['userId' => 11, 'expires_at' => ''],
        ]);

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $item = $this->find_item($data['items'], $campaign_id);
        $this->assertNotNull($item, 'Campaign should appear in summary.');
        $this->assertEquals(2, $item['grantCount'], 'grantCount should be 2.');
        $this->assertNull($item['capacity'], 'capacity should be null.');
    }

    // =========================================================================
    // Campaign with no grants
    // =========================================================================

    public function test_campaign_with_no_grants_shows_zero() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('No Grants');

        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $item = $this->find_item($data['items'], $campaign_id);
        $this->assertNotNull($item, 'Campaign should appear in summary.');
        $this->assertEquals(0, $item['grantCount'], 'grantCount should be 0 when no grants.');
    }

    // =========================================================================
    // Expired grants are excluded
    // =========================================================================

    public function test_expired_grants_are_not_counted() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Expired Grants');

        $past = gmdate('Y-m-d H:i:s', time() - 3600);
        $this->set_grants($campaign_id, [
            ['userId' => 20, 'expires_at' => $past],  // expired — should not count
            ['userId' => 21, 'expires_at' => ''],       // active
        ]);

        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $item = $this->find_item($data['items'], $campaign_id);
        $this->assertNotNull($item);
        $this->assertEquals(1, $item['grantCount'], 'Only the non-expired grant should be counted.');
    }

    // =========================================================================
    // Pending request count
    // =========================================================================

    public function test_pending_request_count_is_correct() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Pending Requests');

        $this->add_pending_request($campaign_id, 'a@example.com');
        $this->add_pending_request($campaign_id, 'b@example.com');

        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $item = $this->find_item($data['items'], $campaign_id);
        $this->assertNotNull($item);
        $this->assertEquals(2, $item['pendingRequestCount'], 'pendingRequestCount should reflect two pending requests.');
    }

    // =========================================================================
    // Pagination
    // =========================================================================

    public function test_pagination_limits_results() {
        $this->set_admin();

        // Create three campaigns.
        $this->create_campaign('Paginate A');
        $this->create_campaign('Paginate B');
        $this->create_campaign('Paginate C');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $request->set_param('per_page', 2);
        $request->set_param('page', 1);
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertCount(2, $data['items'], 'Page 1 should return 2 items.');
        $this->assertGreaterThanOrEqual(3, $data['total'], 'Total should reflect all campaigns.');
        $this->assertGreaterThanOrEqual(2, $data['totalPages'], 'Should have at least 2 pages.');
        $this->assertEquals(2, $data['perPage']);
        $this->assertEquals(1, $data['page']);
    }

    public function test_pagination_second_page() {
        $this->set_admin();

        $this->create_campaign('Page2 A');
        $this->create_campaign('Page2 B');
        $this->create_campaign('Page2 C');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $request->set_param('per_page', 2);
        $request->set_param('page', 2);
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertGreaterThanOrEqual(1, count($data['items']), 'Page 2 should have at least one item.');
        $this->assertEquals(2, $data['page']);
    }

    // =========================================================================
    // Non-admin is rejected
    // =========================================================================

    public function test_non_admin_is_rejected() {
        $user_id = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($user_id);

        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns/access-summary');
        $response = rest_do_request($request);

        $this->assertEquals(403, $response->get_status(), 'Non-admin should receive 403.');
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private function find_item(array $items, int $campaign_id): ?array {
        foreach ($items as $item) {
            if (intval($item['id']) === $campaign_id) {
                return $item;
            }
        }
        return null;
    }
}
