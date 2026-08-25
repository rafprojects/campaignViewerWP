<?php

class Mullion_Capability_Test extends WP_UnitTestCase {
    public function setUp(): void {
        parent::setUp();
        // Nonce bypass handled via MULLION_ALLOW_NONCE_BYPASS constant in bootstrap.php.
    }

    public function tearDown(): void {
        parent::tearDown();
    }

    public function test_admin_required_for_campaign_create() {
        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/mullion-gallery/v1/campaigns');
        $request->set_param('title', 'Forbidden Campaign');

        $response = rest_do_request($request);
        $this->assertEquals(403, $response->get_status());
    }

    public function test_manage_mullion_allows_campaign_create() {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_mullion');
        // Grant CPT caps introduced in J-4.
        foreach ( Mullion_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/mullion-gallery/v1/campaigns');
        $request->set_param('title', 'Allowed Campaign');

        $response = rest_do_request($request);
        $this->assertEquals(201, $response->get_status());

        $data = $response->get_data();
        $this->assertEquals('Allowed Campaign', $data['title'] ?? null);
    }

    public function test_manage_mullion_required_for_settings_update() {
        $user_id = self::factory()->user->create([ 'role' => 'subscriber' ]);
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/mullion-gallery/v1/settings');
        $request->set_param('theme', 'dark');

        $response = rest_do_request($request);
        $this->assertEquals(403, $response->get_status());
    }
}
