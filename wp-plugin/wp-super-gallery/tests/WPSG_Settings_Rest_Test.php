<?php

class WPSG_Settings_Rest_Test extends WP_UnitTestCase {
    public function setUp(): void {
        parent::setUp();
        // Nonce bypass handled via WPSG_ALLOW_NONCE_BYPASS constant in bootstrap.php.
    }

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
        $this->assertArrayHasKey('galleryConfig', $data);
        $this->assertArrayHasKey('itemsPerPage', $data);
        $this->assertArrayNotHasKey('gallerySectionPadding', $data);
        $this->assertArrayNotHasKey('masonryColumns', $data);
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
        // Grant CPT caps introduced in J-4.
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'theme' => 'github-light',   // valid theme ID
            'itemsPerPage' => 24,
            'enableLightbox' => false,
        ]));
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('github-light', $data['theme'] ?? null);
        $this->assertEquals(24, $data['itemsPerPage'] ?? null);
        $this->assertFalse($data['enableLightbox']);
    }

    public function test_settings_post_round_trips_gallery_config_for_admin() {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'galleryConfig' => [
                'mode' => 'unified',
                'breakpoints' => [
                    'desktop' => [
                        'unified' => [
                            'adapterId' => 'masonry',
                            'common' => [
                                'sectionPadding' => 24,
                                'viewportBgType' => 'solid',
                                'viewportBgColor' => '#112233',
                            ],
                            'adapterSettings' => [
                                'masonryColumns' => 5,
                            ],
                        ],
                    ],
                ],
            ],
        ]));
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertEquals('unified', $data['galleryConfig']['mode'] ?? null);
        $this->assertArrayNotHasKey('unifiedGalleryEnabled', $data);
        $this->assertArrayNotHasKey('unifiedGalleryAdapterId', $data);
        $this->assertArrayNotHasKey('gallerySelectionMode', $data);
        $this->assertArrayNotHasKey('gallerySectionPadding', $data);
        $this->assertArrayNotHasKey('unifiedBgType', $data);
        $this->assertArrayNotHasKey('unifiedBgColor', $data);
        $this->assertArrayNotHasKey('masonryColumns', $data);
        $this->assertEquals('masonry', $data['galleryConfig']['breakpoints']['desktop']['unified']['adapterId'] ?? null);
        $this->assertEquals(24, $data['galleryConfig']['breakpoints']['desktop']['unified']['common']['sectionPadding'] ?? null);
        $this->assertEquals('solid', $data['galleryConfig']['breakpoints']['desktop']['unified']['common']['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $data['galleryConfig']['breakpoints']['desktop']['unified']['common']['viewportBgColor'] ?? null);
        $this->assertEquals(5, $data['galleryConfig']['breakpoints']['desktop']['unified']['adapterSettings']['masonryColumns'] ?? null);

        $stored = get_option(WPSG_Settings::OPTION_NAME, []);
        $this->assertEquals('unified', $stored['gallery_config']['mode'] ?? null);
        $this->assertEquals('masonry', $stored['gallery_config']['breakpoints']['desktop']['unified']['adapterId'] ?? null);
        $this->assertEquals('solid', $stored['gallery_config']['breakpoints']['desktop']['unified']['common']['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $stored['gallery_config']['breakpoints']['desktop']['unified']['common']['viewportBgColor'] ?? null);
        $this->assertEquals(5, $stored['gallery_config']['breakpoints']['desktop']['unified']['adapterSettings']['masonryColumns'] ?? null);
        $this->assertArrayNotHasKey('unified_gallery_adapter_id', $stored);
        $this->assertArrayNotHasKey('gallery_section_padding', $stored);
        $this->assertArrayNotHasKey('unified_bg_type', $stored);
    }

    public function test_settings_post_ignores_flat_nested_only_gallery_fields_for_admin() {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/settings');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'gallerySectionPadding' => 28,
            'unifiedBgType' => 'solid',
            'masonryColumns' => 5,
        ]));
        $response = rest_do_request($request);

        $this->assertEquals(200, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('galleryConfig', $data);
        $this->assertArrayNotHasKey('gallerySectionPadding', $data);
        $this->assertArrayNotHasKey('unifiedBgType', $data);
        $this->assertArrayNotHasKey('masonryColumns', $data);

        $stored = get_option(WPSG_Settings::OPTION_NAME, []);
        $this->assertArrayNotHasKey('gallery_section_padding', $stored);
        $this->assertArrayNotHasKey('unified_bg_type', $stored);
        $this->assertArrayNotHasKey('masonry_columns', $stored);
    }
}
