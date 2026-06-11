<?php

/**
 * P48-F: Media library binary export/import REST endpoint tests.
 */
class WPSG_P48F_Media_Export_Test extends WP_UnitTestCase {

    private int $admin_id;

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

    public function tearDown(): void {
        delete_option(WPSG_Export_Engine::JOB_INDEX_OPT);
        parent::tearDown();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    /** POST /admin/media/export/binary returns 503 when ZipArchive unavailable. */
    public function test_export_returns_503_when_zip_unavailable(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
            $res = rest_do_request($req);
            $this->assertSame(503, $res->get_status());
        } else {
            $this->markTestSkipped('ZipArchive is available; 503 path not reachable.');
        }
    }

    /** POST /admin/media/export/binary returns 202 with a jobId. */
    public function test_export_returns_job_id(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required for this test.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
        $res = rest_do_request($req);

        $this->assertSame(202, $res->get_status(), 'Expected 202 Accepted.');
        $data = $res->get_data();
        $this->assertIsArray($data);
        $this->assertArrayHasKey('jobId', $data);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{32}$/', $data['jobId']);
        $this->assertSame('pending', $data['status']);
    }

    /** mime_type filter param is accepted without error. */
    public function test_export_with_mime_filter(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
        $req->set_param('mime_type', 'image');
        $res = rest_do_request($req);

        $this->assertSame(202, $res->get_status());
    }

    /** campaign_id filter restricts export to that campaign's media. */
    public function test_export_with_campaign_filter(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required.');
        }

        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Media Test Campaign',
            'post_status' => 'publish',
        ]);
        // No WP-attachment media items — export should succeed with empty item list.
        update_post_meta($campaign_id, 'media_items', []);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
        $req->set_param('campaign_id', $campaign_id);
        $res = rest_do_request($req);

        $this->assertSame(202, $res->get_status());
    }

    /** The enqueued job has type 'media_library' and is retrievable. */
    public function test_export_job_type_is_media_library(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
        $res = rest_do_request($req);

        $job_id = $res->get_data()['jobId'];
        $job    = WPSG_Export_Engine::get_job($job_id);

        $this->assertIsArray($job);
        $this->assertSame('media_library', $job['type']);
    }

    /** Non-admin gets 403 on export. */
    public function test_export_requires_admin(): void {
        $subscriber = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($subscriber);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
        $res = rest_do_request($req);

        $this->assertSame(403, $res->get_status());
        wp_set_current_user($this->admin_id);
    }

    /** POST /media/import/binary returns 400 when no file is provided. */
    public function test_import_returns_400_without_file(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required.');
        }

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/import/binary');
        $res = rest_do_request($req);

        $this->assertSame(400, $res->get_status());
    }

    /** Non-admin gets 403 on import. */
    public function test_import_requires_admin(): void {
        $subscriber = self::factory()->user->create(['role' => 'subscriber']);
        wp_set_current_user($subscriber);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/import/binary');
        $res = rest_do_request($req);

        $this->assertSame(403, $res->get_status());
        wp_set_current_user($this->admin_id);
    }
}
