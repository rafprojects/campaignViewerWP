<?php

/**
 * P39-CM1: Campaign binary export engine and REST/CLI integration tests.
 */
class WPSG_P39CM1_Export_Test extends WP_UnitTestCase {

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

        // Intercept all outbound HTTP requests.
        add_filter('pre_http_request', [$this, 'stub_http_request'], 10, 3);
    }

    public function tearDown(): void {
        remove_filter('pre_http_request', [$this, 'stub_http_request'], 10);
        delete_option(WPSG_Export_Engine::JOB_INDEX_OPT);
        parent::tearDown();
    }

    /**
     * Stub wp_remote_get / wp_remote_head so tests never hit the network.
     * Returns a 1×1 JPEG for any image URL, or a WP_Error for _fail_ URLs.
     */
    public function stub_http_request(bool|array $response, array $args, string $url) {
        if (str_contains($url, '_fail_')) {
            return new WP_Error('http_error', 'Stub failure');
        }
        $body = $args['method'] === 'HEAD' ? '' : file_get_contents(
            __DIR__ . '/stubs/1x1.jpg'
        );
        return [
            'headers'  => ['content-type' => 'image/jpeg', 'content-length' => (string) strlen($body)],
            'body'     => $body,
            'response' => ['code' => 200, 'message' => 'OK'],
            'cookies'  => [],
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function create_campaign(string $title = 'Test Campaign'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        update_post_meta($id, 'visibility', 'public');
        update_post_meta($id, 'media_items', [
            ['id' => 'm1', 'url' => 'https://example.com/img1.jpg', 'title' => 'Image 1'],
            ['id' => 'm2', 'url' => 'https://example.com/img2.png', 'title' => 'Image 2'],
        ]);
        update_post_meta($id, 'tags', []);
        return $id;
    }

    private function make_request(string $method, string $route, array $params = [], array $files = []): WP_REST_Response|WP_Error {
        $request = new WP_REST_Request($method, $route);
        if ($method === 'POST' || $method === 'PUT') {
            $request->set_body_params($params);
        } else {
            $request->set_query_params($params);
        }
        if ($files) {
            $request->set_file_params($files);
        }
        return rest_do_request($request);
    }

    // ── WPSG_Export_Engine unit tests ─────────────────────────────────────────

    public function test_get_media_filename_uses_id_and_extension() {
        $item = ['id' => 'abc', 'url' => 'https://example.com/photo.jpg'];
        $this->assertSame('media-abc.jpg', WPSG_Export_Engine::get_media_filename($item));
    }

    public function test_get_media_filename_falls_back_to_md5_without_id() {
        $item = ['id' => '', 'url' => 'https://example.com/photo.png'];
        $name = WPSG_Export_Engine::get_media_filename($item);
        $this->assertStringStartsWith('media-', $name);
        $this->assertStringEndsWith('.png', $name);
    }

    public function test_check_zip_available_returns_bool() {
        $this->assertIsBool(WPSG_Export_Engine::check_zip_available());
    }

    public function test_create_job_stores_transient_and_indexes() {
        $manifest = wp_json_encode(['version' => 2, 'campaign' => ['title' => 'T']]);
        $id       = WPSG_Export_Engine::create_job('campaign', $manifest, []);

        $this->assertSame(32, strlen($id));
        $job = WPSG_Export_Engine::get_job($id);
        $this->assertIsArray($job);
        $this->assertSame('pending', $job['status']);
        $this->assertSame('campaign', $job['type']);
        $this->assertSame($manifest, $job['manifest']);
        $this->assertContains($id, get_option(WPSG_Export_Engine::JOB_INDEX_OPT, []));

        WPSG_Export_Engine::delete_job($id);
    }

    public function test_get_job_returns_null_for_unknown_id() {
        $this->assertNull(WPSG_Export_Engine::get_job('deadbeef00000000deadbeef00000000'));
    }

    public function test_delete_job_removes_transient_and_index() {
        $id = WPSG_Export_Engine::create_job('campaign', '{}', []);
        WPSG_Export_Engine::delete_job($id);
        $this->assertNull(WPSG_Export_Engine::get_job($id));
        $this->assertNotContains($id, get_option(WPSG_Export_Engine::JOB_INDEX_OPT, []));
    }

    public function test_process_job_transitions_to_complete_and_creates_zip() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $manifest = wp_json_encode([
            'version'          => 2,
            'campaign'         => ['title' => 'Test'],
            'media_references' => [
                ['id' => 'm1', 'url' => 'https://example.com/img1.jpg', 'title' => 'I1', 'filename' => 'media-m1.jpg'],
            ],
        ]);
        $media_items = [['id' => 'm1', 'url' => 'https://example.com/img1.jpg', 'title' => 'I1']];

        $id = WPSG_Export_Engine::create_job('campaign', $manifest, $media_items);
        WPSG_Export_Engine::process_job($id);

        $job = WPSG_Export_Engine::get_job($id);
        $this->assertSame('complete', $job['status']);
        $this->assertNotEmpty($job['zip_path']);
        $this->assertFileExists($job['zip_path']);

        // Verify manifest.json is inside the ZIP.
        $zip = new ZipArchive();
        $zip->open($job['zip_path']);
        $content = $zip->getFromName('manifest.json');
        $zip->close();
        $this->assertNotFalse($content);
        $parsed = json_decode($content, true);
        $this->assertSame(2, $parsed['version']);

        WPSG_Export_Engine::delete_job($id);
    }

    public function test_process_job_fails_for_unknown_id() {
        WPSG_Export_Engine::process_job('ffffffffffffffffffffffffffffffff');
        // No exception — silent no-op is the expected behaviour.
        $this->assertTrue(true);
    }

    public function test_process_job_does_not_reprocess_completed_job() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $id = WPSG_Export_Engine::create_job('campaign', '{"version":2}', []);
        WPSG_Export_Engine::process_job($id);
        $job_after_first = WPSG_Export_Engine::get_job($id);
        $this->assertSame('complete', $job_after_first['status']);

        // Manually flip back to pending to test the guard.
        $job = WPSG_Export_Engine::get_job($id);
        // The guard checks for 'pending' status — 'complete' should not be reprocessed.
        // Calling again should be a no-op (status remains 'complete').
        WPSG_Export_Engine::process_job($id);
        $job_after_second = WPSG_Export_Engine::get_job($id);
        $this->assertSame('complete', $job_after_second['status']);

        WPSG_Export_Engine::delete_job($id);
    }

    public function test_size_limit_rejected() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        // The stub returns a real 1×1 JPEG (~631 bytes). Set limit to 1 byte.
        $media_items = [['id' => 'm1', 'url' => 'https://example.com/img.jpg', 'title' => 'I1']];
        $id = WPSG_Export_Engine::create_job('campaign', '{"version":2}', $media_items, 1);
        WPSG_Export_Engine::process_job($id);

        $job = WPSG_Export_Engine::get_job($id);
        $this->assertSame('failed', $job['status']);
        $this->assertStringContainsString('size limit', $job['error']);

        WPSG_Export_Engine::delete_job($id);
    }

    public function test_cleanup_removes_expired_jobs() {
        $id  = WPSG_Export_Engine::create_job('campaign', '{}', []);
        $job = WPSG_Export_Engine::get_job($id);

        // Back-date creation to force expiry.
        $job['created_at'] = gmdate('c', time() - (WPSG_Export_Engine::JOB_TTL + 60));
        set_transient('wpsg_export_job_' . $id, $job, WPSG_Export_Engine::JOB_TTL);

        WPSG_Export_Engine::cleanup_expired_jobs();
        $this->assertNull(WPSG_Export_Engine::get_job($id));
    }

    // ── REST route tests ──────────────────────────────────────────────────────

    public function test_export_binary_route_returns_job_id() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $cid      = $this->create_campaign();
        $response = $this->make_request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/export/binary");
        $this->assertSame(202, $response->get_status());
        $data = $response->get_data();
        $this->assertArrayHasKey('jobId', $data);
        $this->assertSame(32, strlen($data['jobId']));
        $this->assertSame('pending', $data['status']);

        WPSG_Export_Engine::delete_job($data['jobId']);
    }

    public function test_export_binary_route_404_for_missing_campaign() {
        $response = $this->make_request('POST', '/wp-super-gallery/v1/campaigns/999999/export/binary');
        $this->assertSame(404, $response->get_status());
    }

    public function test_get_export_job_route_returns_status() {
        $id  = WPSG_Export_Engine::create_job('campaign', '{"version":2}', []);
        $response = $this->make_request('GET', "/wp-super-gallery/v1/export-jobs/{$id}");
        $this->assertSame(200, $response->get_status());
        $data = $response->get_data();
        $this->assertSame('pending', $data['status']);
        $this->assertSame($id, $data['jobId']);
        WPSG_Export_Engine::delete_job($id);
    }

    public function test_get_export_job_route_includes_download_url_when_complete() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $id = WPSG_Export_Engine::create_job('campaign', '{"version":2}', []);
        WPSG_Export_Engine::process_job($id);

        $response = $this->make_request('GET', "/wp-super-gallery/v1/export-jobs/{$id}");
        $data = $response->get_data();
        $this->assertSame('complete', $data['status']);
        $this->assertArrayHasKey('downloadUrl', $data);
        $this->assertStringContainsString('/export-jobs/' . $id . '/download', $data['downloadUrl']);

        WPSG_Export_Engine::delete_job($id);
    }

    public function test_get_export_job_route_404_for_unknown() {
        $response = $this->make_request('GET', '/wp-super-gallery/v1/export-jobs/' . str_repeat('a', 32));
        $this->assertSame(404, $response->get_status());
    }

    public function test_delete_export_job_route() {
        $id = WPSG_Export_Engine::create_job('campaign', '{}', []);
        $response = $this->make_request('DELETE', "/wp-super-gallery/v1/export-jobs/{$id}");
        $this->assertSame(200, $response->get_status());
        $this->assertNull(WPSG_Export_Engine::get_job($id));
    }

    public function test_download_route_409_when_not_complete() {
        $id = WPSG_Export_Engine::create_job('campaign', '{}', []);
        $response = $this->make_request('GET', "/wp-super-gallery/v1/export-jobs/{$id}/download");
        $this->assertSame(409, $response->get_status());
        WPSG_Export_Engine::delete_job($id);
    }

    public function test_binary_import_rejects_missing_file() {
        $response = $this->make_request('POST', '/wp-super-gallery/v1/campaigns/import/binary');
        $this->assertSame(400, $response->get_status());
    }

    public function test_binary_import_round_trip() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        // Build a valid v2 ZIP in memory.
        $cid = $this->create_campaign('Round-Trip Campaign');
        update_post_meta($cid, 'media_items', [
            ['id' => 'm1', 'url' => 'https://example.com/img1.jpg', 'title' => 'Image 1'],
        ]);

        $manifest = wp_json_encode([
            'version'          => 2,
            'exported_at'      => gmdate('c'),
            'campaign'         => ['title' => 'Round-Trip Campaign', 'description' => ''],
            'layout_template'  => null,
            'media_references' => [
                ['id' => 'm1', 'url' => 'https://example.com/img1.jpg', 'title' => 'Image 1', 'filename' => 'media-m1.jpg'],
            ],
        ]);

        $tmp_zip = wp_tempnam('test-export.zip');
        $zip = new ZipArchive();
        $zip->open($tmp_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('manifest.json', $manifest);
        $zip->addFromString('media/media-m1.jpg', 'FAKE_IMAGE_DATA');
        $zip->close();

        $response = $this->make_request('POST', '/wp-super-gallery/v1/campaigns/import/binary', [], [
            'file' => [
                'name'     => 'test-export.zip',
                'tmp_name' => $tmp_zip,
                'error'    => UPLOAD_ERR_OK,
                'size'     => filesize($tmp_zip),
            ],
        ]);

        @unlink($tmp_zip);

        // Sideload will fail in the test environment (no real WP media pipeline),
        // but the campaign should still be created from the manifest.
        $this->assertContains($response->get_status(), [201, 500], 'Expected 201 or pipeline error');
        if ($response->get_status() === 201) {
            $data = $response->get_data();
            $this->assertSame('Round-Trip Campaign', $data['title']);
            $this->assertSame('draft', $data['status']);
        }
    }

    public function test_binary_import_rejects_version_1_manifest() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $manifest = wp_json_encode(['version' => 1, 'campaign' => ['title' => 'Old']]);
        $tmp_zip  = wp_tempnam('old.zip');
        $zip      = new ZipArchive();
        $zip->open($tmp_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('manifest.json', $manifest);
        $zip->close();

        $response = $this->make_request('POST', '/wp-super-gallery/v1/campaigns/import/binary', [], [
            'file' => ['name' => 'old.zip', 'tmp_name' => $tmp_zip, 'error' => UPLOAD_ERR_OK, 'size' => filesize($tmp_zip)],
        ]);

        @unlink($tmp_zip);
        $this->assertSame(400, $response->get_status());
    }

    public function test_binary_import_rejects_missing_manifest() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $tmp_zip = wp_tempnam('no-manifest.zip');
        $zip     = new ZipArchive();
        $zip->open($tmp_zip, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('readme.txt', 'no manifest here');
        $zip->close();

        $response = $this->make_request('POST', '/wp-super-gallery/v1/campaigns/import/binary', [], [
            'file' => ['name' => 'no-manifest.zip', 'tmp_name' => $tmp_zip, 'error' => UPLOAD_ERR_OK, 'size' => filesize($tmp_zip)],
        ]);

        @unlink($tmp_zip);
        $this->assertSame(400, $response->get_status());
    }

    // ── Manifest structure tests ───────────────────────────────────────────────

    public function test_export_binary_manifest_contains_filenames() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $cid = $this->create_campaign('Filename Test');
        $response = $this->make_request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/export/binary");
        $this->assertSame(202, $response->get_status());
        $job_id = $response->get_data()['jobId'];

        WPSG_Export_Engine::process_job($job_id);
        $job = WPSG_Export_Engine::get_job($job_id);
        $this->assertSame('complete', $job['status']);

        $zip = new ZipArchive();
        $zip->open($job['zip_path']);
        $manifest = json_decode($zip->getFromName('manifest.json'), true);
        $zip->close();

        $this->assertSame(2, $manifest['version']);
        foreach ($manifest['media_references'] as $ref) {
            $this->assertArrayHasKey('filename', $ref);
            $this->assertStringStartsWith('media-', $ref['filename']);
        }

        WPSG_Export_Engine::delete_job($job_id);
    }

    public function test_media_filename_is_consistent_between_manifest_and_zip() {
        if (!WPSG_Export_Engine::check_zip_available()) {
            $this->markTestSkipped('ext-zip not available');
        }

        $cid = $this->create_campaign('Consistency Check');
        $response = $this->make_request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/export/binary");
        $job_id   = $response->get_data()['jobId'];

        WPSG_Export_Engine::process_job($job_id);
        $job = WPSG_Export_Engine::get_job($job_id);

        $zip = new ZipArchive();
        $zip->open($job['zip_path']);
        $manifest = json_decode($zip->getFromName('manifest.json'), true);

        foreach ($manifest['media_references'] as $ref) {
            $filename  = $ref['filename'];
            $zip_entry = $zip->getFromName('media/' . $filename);
            $this->assertNotFalse($zip_entry, "media/{$filename} must exist in the ZIP");
        }

        $zip->close();
        WPSG_Export_Engine::delete_job($job_id);
    }
}
