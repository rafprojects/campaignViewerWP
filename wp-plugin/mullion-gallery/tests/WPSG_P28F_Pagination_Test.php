<?php

/**
 * P28-F: Pagination on Unbounded List Endpoints
 *
 * Covers:
 *  - GET /campaign-categories — page + per_page, over-bounds returns empty items.
 *  - GET /tags/campaign       — page + per_page, paginated shape.
 *  - GET /tags/media          — page + per_page, paginated shape.
 *  - GET /roles               — paginated shape.
 *  - GET /campaigns/{id}/access   — page + per_page.
 *  - GET /companies/{id}/access   — page + per_page.
 *  - GET /campaigns/{id}/audit    — page + per_page.
 *  - GET /companies               — page/per_page/total_pages in body.
 */
class WPSG_P28F_Pagination_Test extends WP_UnitTestCase {

    private function set_admin(): void {
        $admin_id = self::factory()->user->create(['role' => 'administrator']);
        wp_set_current_user($admin_id);
    }

    private function make_user(): int {
        return self::factory()->user->create(['role' => 'subscriber']);
    }

    private function create_campaign(string $title): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function assert_paginated_shape(array $data, string $context = ''): void {
        $this->assertArrayHasKey('items', $data, "$context: missing 'items'");
        $this->assertArrayHasKey('total', $data, "$context: missing 'total'");
        $this->assertArrayHasKey('page', $data, "$context: missing 'page'");
        $this->assertArrayHasKey('per_page', $data, "$context: missing 'per_page'");
        $this->assertArrayHasKey('total_pages', $data, "$context: missing 'total_pages'");
        $this->assertIsArray($data['items'], "$context: items must be an array");
    }

    public function tearDown(): void {
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // GET /campaign-categories
    // =========================================================================

    public function test_campaign_categories_page1_vs_page2() {
        $this->set_admin();

        for ($i = 1; $i <= 3; $i++) {
            wp_insert_term("Cat $i", 'wpsg_campaign_category', ['slug' => "cat-$i"]);
        }

        $req1 = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-categories');
        $req1->set_param('per_page', 2);
        $req1->set_param('page', 1);
        $data1 = rest_do_request($req1)->get_data();

        $this->assert_paginated_shape($data1, 'campaign-categories page 1');
        $this->assertCount(2, $data1['items'], 'Page 1 should have 2 items.');
        $this->assertGreaterThanOrEqual(3, $data1['total']);
        $this->assertGreaterThanOrEqual(2, $data1['total_pages']);

        $req2 = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-categories');
        $req2->set_param('per_page', 2);
        $req2->set_param('page', 2);
        $data2 = rest_do_request($req2)->get_data();

        $this->assert_paginated_shape($data2, 'campaign-categories page 2');
        $this->assertGreaterThanOrEqual(1, count($data2['items']), 'Page 2 should have at least 1 item.');

        $ids1 = array_column($data1['items'], 'id');
        $ids2 = array_column($data2['items'], 'id');
        $this->assertEmpty(array_intersect($ids1, $ids2), 'Page 1 and page 2 must not overlap.');
    }

    public function test_campaign_categories_over_bounds_returns_empty() {
        $this->set_admin();
        wp_insert_term('Solo Cat', 'wpsg_campaign_category', ['slug' => 'solo-cat']);

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-categories');
        $req->set_param('per_page', 50);
        $req->set_param('page', 999);
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'campaign-categories over-bounds');
        $this->assertEmpty($data['items'], 'Over-bounds page must return an empty items array.');
    }

    // =========================================================================
    // GET /tags/campaign
    // =========================================================================

    public function test_campaign_tags_pagination() {
        $this->set_admin();

        for ($i = 1; $i <= 3; $i++) {
            wp_insert_term("Tag $i", 'wpsg_campaign_tag', ['slug' => "ctag-$i"]);
        }

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/campaign');
        $req->set_param('per_page', 2);
        $req->set_param('page', 1);
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'tags/campaign page 1');
        $this->assertCount(2, $data['items']);

        $req2 = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/campaign');
        $req2->set_param('per_page', 2);
        $req2->set_param('page', 2);
        $data2 = rest_do_request($req2)->get_data();

        $this->assert_paginated_shape($data2, 'tags/campaign page 2');
        $this->assertGreaterThanOrEqual(1, count($data2['items']));
    }

    public function test_campaign_tags_over_bounds_returns_empty() {
        $this->set_admin();
        wp_insert_term('One Tag', 'wpsg_campaign_tag', ['slug' => 'one-tag']);

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/campaign');
        $req->set_param('page', 999);
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'tags/campaign over-bounds');
        $this->assertEmpty($data['items']);
    }

    // =========================================================================
    // GET /tags/media
    // =========================================================================

    public function test_media_tags_pagination() {
        $this->set_admin();

        for ($i = 1; $i <= 3; $i++) {
            wp_insert_term("MTag $i", 'wpsg_media_tag', ['slug' => "mtag-$i"]);
        }

        $req = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/media');
        $req->set_param('per_page', 2);
        $req->set_param('page', 1);
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'tags/media page 1');
        $this->assertCount(2, $data['items']);

        $req2 = new WP_REST_Request('GET', '/wp-super-gallery/v1/tags/media');
        $req2->set_param('per_page', 2);
        $req2->set_param('page', 999);
        $data2 = rest_do_request($req2)->get_data();

        $this->assert_paginated_shape($data2, 'tags/media over-bounds');
        $this->assertEmpty($data2['items']);
    }

    // =========================================================================
    // GET /roles
    // =========================================================================

    public function test_roles_returns_paginated_shape() {
        $this->set_admin();

        $req  = new WP_REST_Request('GET', '/wp-super-gallery/v1/roles');
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'roles');
        $this->assertGreaterThan(0, count($data['items']), 'Roles list must not be empty.');
        $this->assertGreaterThan(0, $data['total']);
    }

    // =========================================================================
    // GET /campaigns/{id}/access
    // =========================================================================

    public function test_campaign_access_pagination() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Access Test Campaign');

        $grants = [];
        for ($i = 0; $i < 5; $i++) {
            $uid      = $this->make_user();
            $grants[] = ['userId' => $uid, 'source' => 'campaign', 'grantedAt' => gmdate('c')];
        }
        update_post_meta($campaign_id, 'access_grants', $grants);

        $req1 = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $req1->set_param('id', $campaign_id);
        $req1->set_param('per_page', 3);
        $req1->set_param('page', 1);
        $data1 = rest_do_request($req1)->get_data();

        $this->assert_paginated_shape($data1, 'campaign access page 1');
        $this->assertCount(3, $data1['items']);
        $this->assertEquals(5, $data1['total']);
        $this->assertEquals(2, $data1['total_pages']);

        $req2 = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $req2->set_param('id', $campaign_id);
        $req2->set_param('per_page', 3);
        $req2->set_param('page', 2);
        $data2 = rest_do_request($req2)->get_data();

        $this->assert_paginated_shape($data2, 'campaign access page 2');
        $this->assertCount(2, $data2['items']);
    }

    public function test_campaign_access_over_bounds_returns_empty() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Access OOB Campaign');
        $uid = $this->make_user();
        update_post_meta($campaign_id, 'access_grants', [['userId' => $uid, 'source' => 'campaign', 'grantedAt' => gmdate('c')]]);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access");
        $req->set_param('id', $campaign_id);
        $req->set_param('page', 999);
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'campaign access over-bounds');
        $this->assertEmpty($data['items']);
    }

    // =========================================================================
    // GET /companies/{id}/access
    // =========================================================================

    public function test_company_access_pagination() {
        $this->set_admin();
        $result  = wp_insert_term('Acme Corp', 'wpsg_company', ['slug' => 'acme-p28f']);
        $term_id = intval($result['term_id']);

        $grants = [];
        for ($i = 0; $i < 4; $i++) {
            $uid      = $this->make_user();
            $grants[] = ['userId' => $uid, 'companyId' => $term_id, 'source' => 'company', 'grantedAt' => gmdate('c')];
        }
        update_term_meta($term_id, 'access_grants', $grants);

        $req1 = new WP_REST_Request('GET', "/wp-super-gallery/v1/companies/{$term_id}/access");
        $req1->set_param('id', $term_id);
        $req1->set_param('per_page', 2);
        $req1->set_param('page', 1);
        $data1 = rest_do_request($req1)->get_data();

        $this->assert_paginated_shape($data1, 'company access page 1');
        $this->assertCount(2, $data1['items']);
        $this->assertEquals(4, $data1['total']);

        $req2 = new WP_REST_Request('GET', "/wp-super-gallery/v1/companies/{$term_id}/access");
        $req2->set_param('id', $term_id);
        $req2->set_param('per_page', 2);
        $req2->set_param('page', 2);
        $data2 = rest_do_request($req2)->get_data();

        $this->assert_paginated_shape($data2, 'company access page 2');
        $this->assertCount(2, $data2['items']);
    }

    // =========================================================================
    // GET /campaigns/{id}/audit
    // =========================================================================

    public function test_audit_pagination() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Audit Test Campaign');

        $entries = [];
        for ($i = 1; $i <= 5; $i++) {
            $entries[] = [
                'id'        => wp_generate_uuid4(),
                'action'    => "action.$i",
                'details'   => [],
                'userId'    => 1,
                'createdAt' => gmdate('c'),
            ];
        }
        update_post_meta($campaign_id, 'audit_log', $entries);

        $req1 = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req1->set_param('id', $campaign_id);
        $req1->set_param('per_page', 3);
        $req1->set_param('page', 1);
        $data1 = rest_do_request($req1)->get_data();

        $this->assert_paginated_shape($data1, 'audit page 1');
        $this->assertCount(3, $data1['items']);
        $this->assertEquals(5, $data1['total']);

        $req2 = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req2->set_param('id', $campaign_id);
        $req2->set_param('per_page', 3);
        $req2->set_param('page', 2);
        $data2 = rest_do_request($req2)->get_data();

        $this->assert_paginated_shape($data2, 'audit page 2');
        $this->assertCount(2, $data2['items']);
    }

    public function test_audit_over_bounds_returns_empty() {
        $this->set_admin();
        $campaign_id = $this->create_campaign('Audit OOB Campaign');
        update_post_meta($campaign_id, 'audit_log', [
            ['id' => wp_generate_uuid4(), 'action' => 'test', 'details' => [], 'userId' => 1, 'createdAt' => gmdate('c')],
        ]);

        $req = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/audit");
        $req->set_param('id', $campaign_id);
        $req->set_param('page', 999);
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'audit over-bounds');
        $this->assertEmpty($data['items']);
    }

    // =========================================================================
    // GET /companies
    // =========================================================================

    public function test_companies_response_includes_pagination_fields() {
        $this->set_admin();
        wp_insert_term('P28F Corp', 'wpsg_company', ['slug' => 'p28f-corp']);

        $req  = new WP_REST_Request('GET', '/wp-super-gallery/v1/companies');
        $data = rest_do_request($req)->get_data();

        $this->assert_paginated_shape($data, 'companies');
        $this->assertGreaterThan(0, $data['total']);
    }
}
