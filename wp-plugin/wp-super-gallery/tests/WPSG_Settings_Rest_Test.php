<?php

class WPSG_Settings_Rest_Test extends WP_UnitTestCase {
    public function tearDown(): void {
        delete_option(WPSG_Settings::OPTION_NAME);
        parent::tearDown();
    }

    public function test_settings_get_is_public() {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/settings');
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('theme', $data);
        $this->assertArrayHasKey('galleryLayout', $data);
        $this->assertArrayHasKey('itemsPerPage', $data);
    }

    public function test_settings_post_requires_admin() {
        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $request->set_param('theme', 'light');
        $response = rest_do_request($request);

        $this->assertEquals(403, $response->get_status());
    }

    public function test_settings_post_updates_values_for_admin() {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'theme' => 'light',
            'itemsPerPage' => 24,
            'enableLightbox' => false,
        ]));
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('light', $data['theme'] ?? null);
        $this->assertEquals(24, $data['itemsPerPage'] ?? null);
        $this->assertFalse($data['enableLightbox']);
    }
}
