<?php

class WPSG_Campaign_Rest_Test extends WP_UnitTestCase {
    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        // Grant CPT caps introduced in J-4 so REST + wp_insert_post pass.
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    public function setUp(): void {
        parent::setUp();
        // Nonce bypass handled via WPSG_ALLOW_NONCE_BYPASS constant in bootstrap.php.
    }

    public function tearDown(): void {
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

        // Permission callback denies access when the post does not exist;
        // WP REST returns 403 for authenticated users, 401 for unauthenticated.
        $this->assertContains( $response->get_status(), [ 401, 403 ] );
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

    public function test_campaign_gallery_overrides_round_trip() {
        $this->set_admin_user();

        $create = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $create->set_param('title', 'Campaign Overrides');
        $create->set_param('status', 'active');
        $create->set_param('galleryOverrides', [
            'mode' => 'per-type',
            'breakpoints' => [
                'desktop' => [
                    'image' => [
                        'adapterId' => 'masonry',
                        'common' => [
                            'sectionPadding' => 24,
                        ],
                    ],
                ],
                'tablet' => [
                    'image' => [
                        'adapterId' => 'masonry',
                    ],
                ],
                'mobile' => [
                    'image' => [
                        'adapterId' => 'masonry',
                    ],
                ],
            ],
        ]);

        $create_response = rest_do_request($create);
        $this->assertEquals(201, $create_response->get_status());

        $created = $create_response->get_data();
        $campaign_id = intval($created['id'] ?? 0);
        $this->assertEquals('masonry', $created['galleryOverrides']['breakpoints']['desktop']['image']['adapterId'] ?? null);
        $this->assertEquals('per-type', $created['galleryOverrides']['mode'] ?? null);

        $stored = json_decode(get_post_meta($campaign_id, '_wpsg_gallery_overrides', true), true);
        $this->assertEquals('masonry', $stored['breakpoints']['desktop']['image']['adapterId'] ?? null);
        $this->assertEquals(24, $stored['breakpoints']['desktop']['image']['common']['sectionPadding'] ?? null);

        $update = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$campaign_id}");
        $update->set_param('galleryOverrides', []);
        $update_response = rest_do_request($update);

        $this->assertEquals(200, $update_response->get_status());
        $updated = $update_response->get_data();
        $this->assertNull($updated['galleryOverrides'] ?? null);
        $this->assertEmpty(get_post_meta($campaign_id, '_wpsg_gallery_overrides', true));
    }

    public function test_campaign_gallery_overrides_round_trip_from_json_body() {
        $this->set_admin_user();

        $create = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns');
        $create->set_header('Content-Type', 'application/json');
        $create->set_body(wp_json_encode([
            'title' => 'Campaign Overrides JSON',
            'status' => 'active',
            'galleryOverrides' => [
                'mode' => 'per-type',
                'breakpoints' => [
                    'desktop' => [
                        'image' => [
                            'adapterId' => 'not-a-real-adapter',
                            'common' => [
                                'sectionPadding' => 240,
                                'adapterMaxWidthPct' => 10,
                                'adapterJustifyContent' => 'invalid-option',
                                'galleryManualHeight' => 'calc(100vh)',
                                'viewportBgType' => 'solid',
                                'viewportBgColor' => '<b>#112233</b>',
                                'viewportBgGradient' => '<b>linear-gradient(135deg, #111111 0%, #222222 100%)</b>',
                                'viewportBgImageUrl' => 'https://example.com/image-bg.jpg',
                                'galleryImageLabel' => '<b>Photos</b>',
                                'galleryVideoLabel' => '<i>Clips</i>',
                                'galleryLabelJustification' => 'invalid-option',
                                'showGalleryLabelIcon' => '1',
                                'showCampaignGalleryLabels' => '0',
                                'theme' => 'nord',
                                'headline<script>' => '<b>Unsafe</b>',
                            ],
                        ],
                        'video' => [
                            'adapterId' => 'classic',
                            'adapterSettings' => [
                                'imageViewportHeight' => 9999,
                                'videoBorderRadius' => 99,
                                'thumbnailGap' => 99,
                                'navArrowPosition' => 'bottom',
                                'navArrowSize' => 999,
                                'dotNavShape' => 'triangle',
                                'dotNavActiveScale' => 9,
                                'imageShadowPreset' => 'custom',
                                'imageShadowCustom' => '<b>0 0 12px rgba(0,0,0,0.4)</b>',
                                'modalTransition' => 'not-a-real-transition',
                            ],
                        ],
                    ],
                    'watch' => [
                        'image' => [
                            'adapterId' => 'classic',
                        ],
                    ],
                ],
            ],
        ]));

        $response = rest_do_request($create);
        $this->assertEquals(201, $response->get_status());

        $created = $response->get_data();
        $campaign_id = intval($created['id'] ?? 0);
        $this->assertEquals('per-type', $created['galleryOverrides']['mode'] ?? null);
        $this->assertArrayNotHasKey('adapterId', $created['galleryOverrides']['breakpoints']['desktop']['image'] ?? []);
        $this->assertEquals(60, $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['sectionPadding'] ?? null);
        $this->assertEquals(50, $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['adapterMaxWidthPct'] ?? null);
        $this->assertArrayNotHasKey('adapterJustifyContent', $created['galleryOverrides']['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertArrayNotHasKey('galleryManualHeight', $created['galleryOverrides']['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertEquals('solid', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['viewportBgColor'] ?? null);
        $this->assertEquals('linear-gradient(135deg, #111111 0%, #222222 100%)', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['viewportBgGradient'] ?? null);
        $this->assertEquals('https://example.com/image-bg.jpg', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['viewportBgImageUrl'] ?? null);
        $this->assertEquals('Photos', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['galleryImageLabel'] ?? null);
        $this->assertEquals('Clips', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['galleryVideoLabel'] ?? null);
        $this->assertArrayNotHasKey('galleryLabelJustification', $created['galleryOverrides']['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertTrue($created['galleryOverrides']['breakpoints']['desktop']['image']['common']['showGalleryLabelIcon'] ?? false);
        $this->assertFalse($created['galleryOverrides']['breakpoints']['desktop']['image']['common']['showCampaignGalleryLabels'] ?? true);
        $this->assertArrayNotHasKey('theme', $created['galleryOverrides']['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertEquals('Unsafe', $created['galleryOverrides']['breakpoints']['desktop']['image']['common']['headlinescript'] ?? null);
        $this->assertEquals('classic', $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterId'] ?? null);
        $this->assertEquals(900, $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['imageViewportHeight'] ?? null);
        $this->assertEquals(48, $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['videoBorderRadius'] ?? null);
        $this->assertEquals(24, $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['thumbnailGap'] ?? null);
        $this->assertEquals('bottom', $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['navArrowPosition'] ?? null);
        $this->assertEquals(64, $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['navArrowSize'] ?? null);
        $this->assertArrayNotHasKey('dotNavShape', $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings'] ?? []);
        $this->assertEquals(2.0, $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['dotNavActiveScale'] ?? null);
        $this->assertEquals('custom', $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['imageShadowPreset'] ?? null);
        $this->assertEquals('0 0 12px rgba(0,0,0,0.4)', $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings']['imageShadowCustom'] ?? null);
        $this->assertArrayNotHasKey('modalTransition', $created['galleryOverrides']['breakpoints']['desktop']['video']['adapterSettings'] ?? []);
        $this->assertArrayNotHasKey('watch', $created['galleryOverrides']['breakpoints'] ?? []);

        $stored = json_decode(get_post_meta($campaign_id, '_wpsg_gallery_overrides', true), true);
        $this->assertEquals(60, $stored['breakpoints']['desktop']['image']['common']['sectionPadding'] ?? null);
        $this->assertEquals(50, $stored['breakpoints']['desktop']['image']['common']['adapterMaxWidthPct'] ?? null);
        $this->assertArrayNotHasKey('adapterJustifyContent', $stored['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertArrayNotHasKey('galleryManualHeight', $stored['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertEquals('solid', $stored['breakpoints']['desktop']['image']['common']['viewportBgType'] ?? null);
        $this->assertEquals('#112233', $stored['breakpoints']['desktop']['image']['common']['viewportBgColor'] ?? null);
        $this->assertEquals('linear-gradient(135deg, #111111 0%, #222222 100%)', $stored['breakpoints']['desktop']['image']['common']['viewportBgGradient'] ?? null);
        $this->assertEquals('https://example.com/image-bg.jpg', $stored['breakpoints']['desktop']['image']['common']['viewportBgImageUrl'] ?? null);
        $this->assertEquals('Photos', $stored['breakpoints']['desktop']['image']['common']['galleryImageLabel'] ?? null);
        $this->assertEquals('Clips', $stored['breakpoints']['desktop']['image']['common']['galleryVideoLabel'] ?? null);
        $this->assertArrayNotHasKey('galleryLabelJustification', $stored['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertTrue($stored['breakpoints']['desktop']['image']['common']['showGalleryLabelIcon'] ?? false);
        $this->assertFalse($stored['breakpoints']['desktop']['image']['common']['showCampaignGalleryLabels'] ?? true);
        $this->assertArrayNotHasKey('theme', $stored['breakpoints']['desktop']['image']['common'] ?? []);
        $this->assertEquals('Unsafe', $stored['breakpoints']['desktop']['image']['common']['headlinescript'] ?? null);
        $this->assertEquals(900, $stored['breakpoints']['desktop']['video']['adapterSettings']['imageViewportHeight'] ?? null);
        $this->assertEquals(48, $stored['breakpoints']['desktop']['video']['adapterSettings']['videoBorderRadius'] ?? null);
        $this->assertEquals(24, $stored['breakpoints']['desktop']['video']['adapterSettings']['thumbnailGap'] ?? null);
        $this->assertEquals('bottom', $stored['breakpoints']['desktop']['video']['adapterSettings']['navArrowPosition'] ?? null);
        $this->assertEquals(64, $stored['breakpoints']['desktop']['video']['adapterSettings']['navArrowSize'] ?? null);
        $this->assertArrayNotHasKey('dotNavShape', $stored['breakpoints']['desktop']['video']['adapterSettings'] ?? []);
        $this->assertEquals(2.0, $stored['breakpoints']['desktop']['video']['adapterSettings']['dotNavActiveScale'] ?? null);
        $this->assertEquals('custom', $stored['breakpoints']['desktop']['video']['adapterSettings']['imageShadowPreset'] ?? null);
        $this->assertEquals('0 0 12px rgba(0,0,0,0.4)', $stored['breakpoints']['desktop']['video']['adapterSettings']['imageShadowCustom'] ?? null);
        $this->assertArrayNotHasKey('modalTransition', $stored['breakpoints']['desktop']['video']['adapterSettings'] ?? []);
        $this->assertArrayNotHasKey('watch', $stored['breakpoints'] ?? []);
    }

    public function test_update_campaign_returns_404_for_unknown_id() {
        $this->set_admin_user();

        $req = new WP_REST_Request('PUT', '/wp-super-gallery/v1/campaigns/999999999');
        $req->set_param('title', 'Ghost Update');
        $response = rest_do_request($req);

        // require_admin passes for the admin user; update_campaign() returns
        // 404 when the campaign post does not exist.
        $this->assertEquals( 404, $response->get_status() );
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

        // Restore without prior archive — restore_campaign() sets status=active
        // unconditionally, so the endpoint must always return 200.
        $this->assertEquals( 200, $response->get_status() );
    }

    // ─────────────────────────── P20-D: Post meta sanitize callbacks

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_visibility_whitelists_values() {
        $this->assertEquals( 'public', WPSG_CPT::sanitize_visibility( 'public' ) );
        $this->assertEquals( 'private', WPSG_CPT::sanitize_visibility( 'private' ) );
        // Invalid value falls back to the safer private default.
        $this->assertEquals( 'private', WPSG_CPT::sanitize_visibility( 'evil_visibility' ) );
        $this->assertEquals( 'private', WPSG_CPT::sanitize_visibility( '<script>alert(1)</script>' ) );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_status_whitelists_values() {
        $this->assertEquals( 'draft', WPSG_CPT::sanitize_status( 'draft' ) );
        $this->assertEquals( 'active', WPSG_CPT::sanitize_status( 'active' ) );
        $this->assertEquals( 'archived', WPSG_CPT::sanitize_status( 'archived' ) );
        // Invalid value falls back to 'draft'
        $this->assertEquals( 'draft', WPSG_CPT::sanitize_status( 'malicious' ) );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_media_items_sanitizes_urls() {
        $input = [
            [
                'id'        => 'item-1',
                'type'      => 'image',
                'source'    => 'wp',
                'url'       => 'javascript:alert(1)',
                'thumbnail' => 'https://example.com/thumb.jpg',
                'caption'   => '<script>alert("xss")</script>',
                'order'     => 0,
            ],
        ];

        $result = WPSG_CPT::sanitize_media_items( $input );
        $this->assertCount( 1, $result );
        // javascript: URI should be stripped by esc_url_raw
        $this->assertStringNotContainsString( 'javascript', $result[0]['url'] );
        // Script tags stripped from caption
        $this->assertStringNotContainsString( '<script>', $result[0]['caption'] );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_media_items_rejects_invalid_types() {
        $input = [
            [
                'id'     => 'item-1',
                'type'   => 'malware',
                'source' => 'hacker',
            ],
        ];

        $result = WPSG_CPT::sanitize_media_items( $input );
        $this->assertCount( 1, $result );
        // Invalid type defaults to 'image'
        $this->assertEquals( 'image', $result[0]['type'] );
        // Invalid source defaults to 'wp'
        $this->assertEquals( 'wp', $result[0]['source'] );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_media_items_drops_entries_without_id() {
        $input = [
            [ 'type' => 'image' ], // Missing 'id'
            [ 'id' => 'valid-1', 'type' => 'image' ],
        ];

        $result = WPSG_CPT::sanitize_media_items( $input );
        $this->assertCount( 1, $result );
        $this->assertEquals( 'valid-1', $result[0]['id'] );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_tags_strips_html() {
        $input = [ 'clean', '<b>bold</b>', '<script>alert(1)</script>' ];
        $result = WPSG_CPT::sanitize_tags( $input );
        // <script> blocks (including content) are stripped by wp_strip_all_tags
        // inside sanitize_text_field(), yielding an empty string that
        // array_filter drops — so only 2 tags survive.
        $this->assertCount( 2, $result );
        $this->assertEquals( 'clean', $result[0] );
        $this->assertEquals( 'bold', $result[1] );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_datetime_accepts_valid_iso8601() {
        $this->assertEquals( '2026-03-05T14:30:00', WPSG_CPT::sanitize_datetime( '2026-03-05T14:30:00' ) );
        $this->assertEquals( '2026-03-05T14:30:00+05:30', WPSG_CPT::sanitize_datetime( '2026-03-05T14:30:00+05:30' ) );
        $this->assertEquals( '2026-03-05T14:30:00Z', WPSG_CPT::sanitize_datetime( '2026-03-05T14:30:00Z' ) );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_datetime_rejects_invalid_format() {
        $this->assertEquals( '', WPSG_CPT::sanitize_datetime( 'not-a-date' ) );
        $this->assertEquals( '', WPSG_CPT::sanitize_datetime( '03/05/2026' ) );
        $this->assertEquals( '', WPSG_CPT::sanitize_datetime( '<script>alert(1)</script>' ) );
    }

    /**
     * @since 0.18.0 P20-D
     */
    public function test_sanitize_datetime_accepts_empty_string() {
        $this->assertEquals( '', WPSG_CPT::sanitize_datetime( '' ) );
    }
}
