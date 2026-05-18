<?php

class WPSG_P28O_Campaign_Templates_Test extends WP_UnitTestCase {

    private $admin_id;

    public function setUp(): void {
        parent::setUp();

        $this->admin_id = self::factory()->user->create(['role' => 'administrator']);
        $user = get_user_by('id', $this->admin_id);
        $user->add_cap('manage_wpsg');
        foreach (WPSG_CPT::CPT_CAPS as $cap) {
            $user->add_cap($cap);
        }
        wp_set_current_user($this->admin_id);

        WPSG_CPT::register();
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private function make_template(string $name = 'My Template', array $overrides = []): int {
        $post_id = wp_insert_post(array_merge([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $name,
            'post_status' => 'publish',
        ], $overrides));
        update_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, '1');
        update_post_meta($post_id, 'visibility', 'private');
        return (int) $post_id;
    }

    private function make_campaign(string $title = 'Source Campaign'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'visibility', 'public');
        return (int) $id;
    }

    // ── GET /campaign-templates ───────────────────────────────────────────────

    public function test_list_includes_builtins() {
        $response = rest_do_request(new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-templates'));
        $this->assertEquals(200, $response->get_status());
        $items = $response->get_data()['items'];
        $ids   = array_column($items, 'id');
        $this->assertContains('builtin_blank', $ids);
        $this->assertContains('builtin_public_showcase', $ids);
    }

    public function test_list_includes_user_templates() {
        $tpl_id = $this->make_template('User Template');

        $response = rest_do_request(new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-templates'));
        $items    = $response->get_data()['items'];
        $ids      = array_column($items, 'id');
        $this->assertContains(strval($tpl_id), $ids);

        wp_delete_post($tpl_id, true);
    }

    public function test_list_builtin_has_correct_shape() {
        $response = rest_do_request(new WP_REST_Request('GET', '/wp-super-gallery/v1/campaign-templates'));
        $items    = $response->get_data()['items'];
        $blank    = array_values(array_filter($items, fn($i) => $i['id'] === 'builtin_blank'))[0];

        $this->assertEquals('builtin', $blank['source']);
        $this->assertFalse($blank['editable']);
        $this->assertArrayHasKey('settings', $blank);
        $this->assertNull($blank['createdAt']);
    }

    // ── POST /campaign-templates ──────────────────────────────────────────────

    public function test_create_template_from_scratch() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-templates');
        $request->set_param('name', 'Scratch Template');
        $request->set_param('description', 'Created in test');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('Scratch Template', $data['name']);
        $this->assertEquals('user', $data['source']);
        $this->assertTrue($data['editable']);

        wp_delete_post((int) $data['id'], true);
    }

    public function test_create_template_from_existing_campaign() {
        $campaign_id = $this->make_campaign();
        update_post_meta($campaign_id, 'visibility', 'public');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-templates');
        $request->set_param('name', 'From Campaign');
        $request->set_param('from_campaign_id', $campaign_id);
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('public', $data['settings']['visibility'], 'Visibility should be copied from source');

        wp_delete_post((int) $data['id'], true);
        wp_delete_post($campaign_id, true);
    }

    public function test_create_template_from_missing_campaign_returns_404() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-templates');
        $request->set_param('name', 'Bad Source');
        $request->set_param('from_campaign_id', 999999);
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }

    // ── DELETE /campaign-templates/{id} ───────────────────────────────────────

    public function test_delete_user_template_succeeds() {
        $tpl_id  = $this->make_template('To Delete');
        $request = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/campaign-templates/{$tpl_id}");
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $this->assertTrue($response->get_data()['deleted']);
        $this->assertNull(get_post($tpl_id)); // actually deleted
    }

    public function test_delete_builtin_returns_403() {
        $response = rest_do_request(
            new WP_REST_Request('DELETE', '/wp-super-gallery/v1/campaign-templates/builtin_blank')
        );
        $this->assertEquals(403, $response->get_status());
    }

    public function test_delete_nonexistent_template_returns_404() {
        $response = rest_do_request(
            new WP_REST_Request('DELETE', '/wp-super-gallery/v1/campaign-templates/999999')
        );
        $this->assertEquals(404, $response->get_status());
    }

    // ── POST /campaign-templates/{id}/instantiate ─────────────────────────────

    public function test_instantiate_builtin_template_creates_campaign() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-templates/builtin_blank/instantiate');
        $request->set_param('name', 'From Blank');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('From Blank', $data['title']);
        $this->assertEquals('private', $data['visibility']);

        wp_delete_post((int) $data['id'], true);
    }

    public function test_instantiate_public_showcase_sets_public_visibility() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-templates/builtin_public_showcase/instantiate');
        $request->set_param('name', 'From Showcase');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $this->assertEquals('public', $response->get_data()['visibility']);

        wp_delete_post((int) $response->get_data()['id'], true);
    }

    public function test_instantiate_user_template_creates_campaign() {
        $tpl_id = $this->make_template('User TPL');

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaign-templates/{$tpl_id}/instantiate");
        $request->set_param('name', 'From User TPL');
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('From User TPL', $data['title']);
        // Instantiated campaign must NOT have the is_template meta.
        $this->assertEmpty(get_post_meta((int) $data['id'], WPSG_Campaign_Templates::META_IS_TEMPLATE, true));

        wp_delete_post((int) $data['id'], true);
        wp_delete_post($tpl_id, true);
    }

    public function test_instantiate_nonexistent_template_returns_404() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaign-templates/999999/instantiate');
        $request->set_param('name', 'Ghost');
        $response = rest_do_request($request);

        $this->assertEquals(404, $response->get_status());
    }
}
