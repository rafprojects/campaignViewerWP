<?php

/**
 * P28-E: Campaign Filtering Enhancements
 *
 * Covers:
 *  - ?category=<slug>    returns only campaigns in that category.
 *  - ?tag=<slug>         returns only campaigns with that tag.
 *  - ?sort=title_asc     returns campaigns in alphabetical order.
 *  - ?include_archived=true  includes archived campaigns.
 *  - By default, archived campaigns are excluded.
 *  - ?template_id=<uuid> returns campaigns bound to that layout template.
 *  - Combined params work together correctly.
 */
class WPSG_P28E_Campaign_Filters_Test extends WP_UnitTestCase {

    private function create_campaign(string $title, string $status = 'active'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', $status);
        return intval($id);
    }

    private function set_category(int $campaign_id, string $slug): void {
        $term = get_term_by('slug', $slug, 'wpsg_campaign_category');
        if (!$term) {
            $result = wp_insert_term($slug, 'wpsg_campaign_category', ['slug' => $slug]);
            $term_id = $result['term_id'];
        } else {
            $term_id = $term->term_id;
        }
        wp_set_object_terms($campaign_id, [$term_id], 'wpsg_campaign_category');
    }

    private function set_tag(int $campaign_id, string $slug): void {
        $term = get_term_by('slug', $slug, 'wpsg_campaign_tag');
        if (!$term) {
            $result = wp_insert_term($slug, 'wpsg_campaign_tag', ['slug' => $slug]);
            $term_id = $result['term_id'];
        } else {
            $term_id = $term->term_id;
        }
        wp_set_object_terms($campaign_id, [$term_id], 'wpsg_campaign_tag');
    }

    private function set_template(int $campaign_id, string $uuid): void {
        update_post_meta($campaign_id, '_wpsg_layout_binding_template_id', $uuid);
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
    // Category filter
    // =========================================================================

    public function test_category_filter_returns_matching_campaigns() {
        $this->set_admin();
        $a = $this->create_campaign('Cat A');
        $b = $this->create_campaign('Cat B');
        $this->set_category($a, 'weddings');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('category', 'weddings');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $ids = array_column($data['items'], 'id');
        $this->assertContains((string) $a, $ids, 'Campaign in "weddings" should appear.');
        $this->assertNotContains((string) $b, $ids, 'Campaign not in "weddings" should not appear.');
    }

    // =========================================================================
    // Tag filter
    // =========================================================================

    public function test_tag_filter_returns_matching_campaigns() {
        $this->set_admin();
        $a = $this->create_campaign('Tagged A');
        $b = $this->create_campaign('Untagged B');
        $this->set_tag($a, '2026');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('tag', '2026');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $ids = array_column($data['items'], 'id');
        $this->assertContains((string) $a, $ids, 'Campaign with "2026" tag should appear.');
        $this->assertNotContains((string) $b, $ids, 'Campaign without tag should not appear.');
    }

    // =========================================================================
    // Sort order
    // =========================================================================

    public function test_sort_title_asc_returns_alphabetical_order() {
        $this->set_admin();
        $this->create_campaign('Zebra');
        $this->create_campaign('Apple');
        $this->create_campaign('Mango');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('sort', 'title_asc');
        $request->set_param('per_page', 50);
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $titles = array_column($data['items'], 'title');
        $sorted = $titles;
        sort($sorted);
        $this->assertEquals($sorted, $titles, 'Results should be in alphabetical order.');
    }

    public function test_sort_title_desc_returns_reverse_alphabetical() {
        $this->set_admin();
        $this->create_campaign('Alpha');
        $this->create_campaign('Omega');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('sort', 'title_desc');
        $request->set_param('per_page', 50);
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $titles = array_column($data['items'], 'title');
        $this->assertGreaterThan(
            array_search('Alpha', $titles),
            array_search('Omega', $titles),
            '"Omega" should come before "Alpha" in desc order.'
        );
    }

    // =========================================================================
    // include_archived
    // =========================================================================

    public function test_archived_campaigns_excluded_by_default() {
        $this->set_admin();
        $active   = $this->create_campaign('Active Campaign');
        $archived = $this->create_campaign('Archived Campaign', 'archived');

        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $ids = array_column($data['items'], 'id');
        $this->assertContains((string) $active, $ids, 'Active campaign should appear by default.');
        $this->assertNotContains((string) $archived, $ids, 'Archived campaign should NOT appear by default.');
    }

    public function test_include_archived_true_shows_archived_campaigns() {
        $this->set_admin();
        $active   = $this->create_campaign('Active X');
        $archived = $this->create_campaign('Archived X', 'archived');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('include_archived', 'true');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $ids = array_column($data['items'], 'id');
        $this->assertContains((string) $active, $ids);
        $this->assertContains((string) $archived, $ids, 'Archived campaign should appear when include_archived=true.');
    }

    // =========================================================================
    // template_id filter
    // =========================================================================

    public function test_template_id_filter_returns_bound_campaigns() {
        $this->set_admin();
        $uuid = wp_generate_uuid4();
        $a = $this->create_campaign('With Template');
        $b = $this->create_campaign('No Template');
        $this->set_template($a, $uuid);

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('template_id', $uuid);
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $ids = array_column($data['items'], 'id');
        $this->assertContains((string) $a, $ids, 'Campaign bound to template should appear.');
        $this->assertNotContains((string) $b, $ids, 'Campaign without template should not appear.');
    }

    // =========================================================================
    // Combined params
    // =========================================================================

    public function test_combined_category_and_tag_filters() {
        $this->set_admin();
        $a = $this->create_campaign('Cat+Tag');
        $b = $this->create_campaign('Cat only');
        $c = $this->create_campaign('Tag only');
        $this->set_category($a, 'portraits');
        $this->set_tag($a, 'featured');
        $this->set_category($b, 'portraits');
        $this->set_tag($c, 'featured');

        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/campaigns');
        $request->set_param('category', 'portraits');
        $request->set_param('tag', 'featured');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $ids = array_column($data['items'], 'id');
        $this->assertContains((string) $a, $ids, 'Campaign matching both filters should appear.');
        $this->assertNotContains((string) $b, $ids, 'Category-only match should not appear.');
        $this->assertNotContains((string) $c, $ids, 'Tag-only match should not appear.');
    }
}
