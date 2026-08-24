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

    // ── P65-B ──────────────────────────────────────────────────────────────────

    /**
     * A-5 regression: a campaign-filtered export of a campaign with REAL media
     * items (uniqid `id`, WP post ID in `attachmentId`) must include those files.
     * Before the fix, the filter mapped `intval($item['id'])` → 0 for every item,
     * collapsing to [0] and exporting nothing even for media-rich campaigns.
     */
    public function test_export_campaign_filter_includes_referenced_attachment(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required.');
        }

        $att_id = self::factory()->attachment->create_upload_object(__DIR__ . '/stubs/1x1.jpg');
        $this->assertGreaterThan(0, $att_id);

        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Media-Rich Campaign',
            'post_status' => 'publish',
        ]);
        // Realistic shape: `id` is a uniqid string, `attachmentId` is the WP post ID.
        update_post_meta($campaign_id, 'media_items', [
            [
                'id'           => 'uuid-abc-123',
                'attachmentId' => $att_id,
                'type'         => 'image',
                'source'       => 'upload',
                'url'          => wp_get_attachment_url($att_id),
            ],
        ]);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/media/export/binary');
        $req->set_param('campaign_id', $campaign_id);
        $res = rest_do_request($req);
        $this->assertSame(202, $res->get_status());

        $job_id = $res->get_data()['jobId'];
        WPSG_Export_Engine::process_job($job_id);
        $job = WPSG_Export_Engine::get_job($job_id);
        $this->assertSame('complete', $job['status']);

        $zip = new ZipArchive();
        $zip->open($job['zip_path']);
        $manifest = json_decode($zip->getFromName('manifest.json'), true);
        $zip->close();

        $this->assertSame(1, $manifest['item_count'], 'Campaign-filtered export must include the referenced attachment.');
        $this->assertSame((string) $att_id, $manifest['items'][0]['id']);

        // P65-C: within the cap, the true total is surfaced and truncated is false.
        $this->assertSame(1, $manifest['total_available']);
        $this->assertFalse($manifest['truncated']);
    }

    /**
     * E-4: the media-library ZIP import streams entries to disk. Round-trip a
     * real media entry to confirm the streaming swap still imports correctly.
     */
    public function test_import_binary_streams_media_round_trip(): void {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip required.');
        }

        $manifest = wp_json_encode([
            'version'    => 1,
            'type'       => 'media_library',
            'item_count' => 1,
            'items'      => [
                ['id' => '1', 'filename' => 'media-1.jpg', 'title' => 'Streamed'],
            ],
        ]);
        $tmp_zip = wp_tempnam('mlib-import.zip');
        $zip = new ZipArchive();
        $zip->open($tmp_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('manifest.json', $manifest);
        $zip->addFromString('media/media-1.jpg', file_get_contents(__DIR__ . '/stubs/1x1.jpg'));
        $zip->close();

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/import/binary');
        $req->set_file_params([
            'file' => ['name' => 'mlib-import.zip', 'tmp_name' => $tmp_zip, 'error' => UPLOAD_ERR_OK, 'size' => filesize($tmp_zip)],
        ]);
        $res = rest_do_request($req);
        @unlink($tmp_zip);

        $this->assertSame(201, $res->get_status());
        $data = $res->get_data();
        $this->assertCount(1, $data['imported'], 'Streamed media entry must import.');
        $this->assertEmpty($data['skipped']);
    }
}
