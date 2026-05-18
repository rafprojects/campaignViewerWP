<?php

/**
 * P28-C: Taxonomy CRUD — campaign categories + tags (create/update/delete)
 *
 * Covers:
 *  - POST /campaign-categories creates term; returns { id, name, slug, count }.
 *  - PUT  /campaign-categories/{id} renames; returns updated term.
 *  - DELETE /campaign-categories/{id} removes term.
 *  - Duplicate-name on POST returns 409.
 *  - Not-found on PUT / DELETE returns 404.
 *  - POST /tags/campaign creates term; DELETE /tags/campaign/{id} removes it.
 *  - POST /tags/media creates term; DELETE /tags/media/{id} removes it.
 *  - Unauthenticated (non-admin) requests return 401/403.
 */
class WPSG_P28C_Taxonomy_CRUD_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function set_subscriber_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($user_id);
        return $user_id;
    }

    public function setUp(): void {
        parent::setUp();
    }

    public function tearDown(): void {
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // Campaign Category CRUD
    // =========================================================================

    public function test_create_campaign_category_returns_201_with_term_data() {
        $this->set_admin_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-categories');
        $request->set_param('name', 'Weddings');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status(), 'Create should return 201.');
        $data = $response->get_data();
        $this->assertArrayHasKey('id', $data);
        $this->assertEquals('Weddings', $data['name']);
        $this->assertArrayHasKey('slug', $data);
        $this->assertArrayHasKey('count', $data);

        // Term actually exists in the taxonomy.
        $term = get_term_by('name', 'Weddings', 'wpsg_campaign_category');
        $this->assertNotFalse($term, 'Term must exist after creation.');
    }

    public function test_create_campaign_category_with_custom_slug() {
        $this->set_admin_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-categories');
        $request->set_param('name', 'Corporate Events');
        $request->set_param('slug', 'corp-events');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $this->assertEquals('corp-events', $response->get_data()['slug']);
    }

    public function test_create_campaign_category_duplicate_returns_409() {
        $this->set_admin_user();
        wp_insert_term('Portraits', 'wpsg_campaign_category');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-categories');
        $request->set_param('name', 'Portraits');
        $response = rest_do_request($request);

        $this->assertEquals(409, $response->get_status(), 'Duplicate name must return 409.');
    }

    public function test_create_campaign_category_missing_name_returns_400() {
        $this->set_admin_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-categories');
        // No name param.
        $response = rest_do_request($request);

        $this->assertEquals(400, $response->get_status(), 'Missing name must return 400.');
    }

    public function test_update_campaign_category_renames_term() {
        $this->set_admin_user();
        $result  = wp_insert_term('Old Name', 'wpsg_campaign_category');
        $term_id = $result['term_id'];

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaign-categories/{$term_id}");
        $request->set_param('name', 'New Name');
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status(), 'Update should return 200.');
        $this->assertEquals('New Name', $response->get_data()['name']);

        $term = get_term($term_id, 'wpsg_campaign_category');
        $this->assertEquals('New Name', $term->name);
    }

    public function test_update_campaign_category_not_found_returns_404() {
        $this->set_admin_user();

        $request = new WP_REST_Request('PUT', '/wp-super-gallery/v1/campaign-categories/999999');
        $request->set_param('name', 'Ghost');
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }

    public function test_update_campaign_category_no_fields_returns_400() {
        $this->set_admin_user();
        $result  = wp_insert_term('SomeCategory', 'wpsg_campaign_category');
        $term_id = $result['term_id'];

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaign-categories/{$term_id}");
        // No name or slug supplied.
        $response = rest_do_request($request);

        $this->assertEquals(400, $response->get_status(), 'Empty update body must return 400.');
    }

    public function test_delete_campaign_category_removes_term() {
        $this->set_admin_user();
        $result  = wp_insert_term('ToDelete', 'wpsg_campaign_category');
        $term_id = $result['term_id'];

        $request  = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/campaign-categories/{$term_id}");
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status(), 'Delete should return 200.');
        $this->assertTrue($response->get_data()['deleted']);

        $term = get_term($term_id, 'wpsg_campaign_category');
        $this->assertNull($term, 'Term must not exist after deletion.');
    }

    public function test_delete_campaign_category_not_found_returns_404() {
        $this->set_admin_user();

        $request  = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/campaign-categories/999999');
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }

    public function test_create_campaign_category_non_admin_returns_403() {
        $this->set_subscriber_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-categories');
        $request->set_param('name', 'Forbidden');
        $response = rest_do_request($request);

        $this->assertContains($response->get_status(), [401, 403], 'Non-admin must be rejected.');
    }

    // =========================================================================
    // Campaign Tag CRUD
    // =========================================================================

    public function test_create_campaign_tag_returns_201() {
        $this->set_admin_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/campaign');
        $request->set_param('name', 'Summer 2026');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status(), 'Create campaign tag should return 201.');
        $data = $response->get_data();
        $this->assertEquals('Summer 2026', $data['name']);

        $term = get_term_by('name', 'Summer 2026', 'wpsg_campaign_tag');
        $this->assertNotFalse($term);
    }

    public function test_create_campaign_tag_duplicate_returns_409() {
        $this->set_admin_user();
        wp_insert_term('Existing Tag', 'wpsg_campaign_tag');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/campaign');
        $request->set_param('name', 'Existing Tag');
        $response = rest_do_request($request);

        $this->assertEquals(409, $response->get_status());
    }

    public function test_delete_campaign_tag_removes_term() {
        $this->set_admin_user();
        $result  = wp_insert_term('DeleteableTag', 'wpsg_campaign_tag');
        $term_id = $result['term_id'];

        $request  = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/tags/campaign/{$term_id}");
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $this->assertTrue($response->get_data()['deleted']);

        $term = get_term($term_id, 'wpsg_campaign_tag');
        $this->assertNull($term);
    }

    public function test_delete_campaign_tag_not_found_returns_404() {
        $this->set_admin_user();

        $request  = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/tags/campaign/999999');
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }

    public function test_create_campaign_tag_non_admin_returns_403() {
        $this->set_subscriber_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/campaign');
        $request->set_param('name', 'Nope');
        $response = rest_do_request($request);

        $this->assertContains($response->get_status(), [401, 403]);
    }

    // =========================================================================
    // Media Tag CRUD
    // =========================================================================

    public function test_create_media_tag_returns_201() {
        $this->set_admin_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/media');
        $request->set_param('name', 'Portrait');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status(), 'Create media tag should return 201.');
        $this->assertEquals('Portrait', $response->get_data()['name']);

        $term = get_term_by('name', 'Portrait', 'wpsg_media_tag');
        $this->assertNotFalse($term);
    }

    public function test_create_media_tag_duplicate_returns_409() {
        $this->set_admin_user();
        wp_insert_term('DupeMediaTag', 'wpsg_media_tag');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/media');
        $request->set_param('name', 'DupeMediaTag');
        $response = rest_do_request($request);

        $this->assertEquals(409, $response->get_status());
    }

    public function test_delete_media_tag_removes_term() {
        $this->set_admin_user();
        $result  = wp_insert_term('RemovableMediaTag', 'wpsg_media_tag');
        $term_id = $result['term_id'];

        $request  = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/tags/media/{$term_id}");
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $this->assertTrue($response->get_data()['deleted']);

        $term = get_term($term_id, 'wpsg_media_tag');
        $this->assertNull($term);
    }

    public function test_delete_media_tag_not_found_returns_404() {
        $this->set_admin_user();

        $request  = new WP_REST_Request('DELETE', '/wp-super-gallery/v1/tags/media/999999');
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }

    public function test_create_media_tag_non_admin_returns_403() {
        $this->set_subscriber_user();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/tags/media');
        $request->set_param('name', 'Blocked');
        $response = rest_do_request($request);

        $this->assertContains($response->get_status(), [401, 403]);
    }
}
