<?php

class WPSG_P28N_Duplicate_Detection_Test extends WP_UnitTestCase {

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

        // Allow non-HTTP uploads so tests can use temp files directly.
        add_filter('wpsg_allow_non_http_uploads', '__return_true');
    }

    public function tearDown(): void {
        remove_all_filters('wpsg_allow_non_http_uploads');
        parent::tearDown();
    }

    private function create_temp_gif(string $suffix = ''): string {
        $path = tempnam(sys_get_temp_dir(), 'wpsg-gif' . $suffix . '-');
        file_put_contents($path, base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='));
        return $path;
    }

    private function make_request(string $tmp_path, string $filename = 'test.gif', bool $force = false): WP_REST_Request {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/upload');
        $request->set_file_params([
            'file' => [
                'name'     => $filename,
                'type'     => 'image/gif',
                'tmp_name' => $tmp_path,
                'error'    => UPLOAD_ERR_OK,
                'size'     => filesize($tmp_path),
            ],
        ]);
        if ($force) {
            $request->set_param('force', true);
        }
        return $request;
    }

    public function test_unique_file_returns_201_and_stores_md5() {
        $tmp = $this->create_temp_gif();
        $expected_md5 = md5_file($tmp);

        $request  = $this->make_request($tmp);
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status(), 'Unique upload should return 201');
        $data = $response->get_data();
        $this->assertArrayHasKey('attachmentId', $data);

        $stored_md5 = get_post_meta((int) $data['attachmentId'], '_wpsg_file_md5', true);
        $this->assertEquals($expected_md5, $stored_md5, '_wpsg_file_md5 should be stored on the attachment');
    }

    public function test_duplicate_file_returns_409() {
        // First upload — should succeed.
        $tmp1 = $this->create_temp_gif('first');
        $response1 = rest_do_request($this->make_request($tmp1, 'first.gif'));
        $this->assertEquals(201, $response1->get_status(), 'First upload must succeed');
        $first_id = (int) $response1->get_data()['attachmentId'];

        // Second upload of identical file content — should be rejected.
        $tmp2 = $this->create_temp_gif('second'); // same bytes, different tmp path
        $response2 = rest_do_request($this->make_request($tmp2, 'second.gif'));

        $this->assertEquals(409, $response2->get_status(), 'Duplicate upload should return 409');
        $data = $response2->get_data();
        $this->assertTrue($data['duplicate']);
        $this->assertEquals($first_id, $data['existing_id']);
        $this->assertNotEmpty($data['existing_url']);
        $this->assertArrayHasKey('existing_name', $data, 'existing_name must be present in duplicate response');
        $this->assertNotEmpty($data['existing_name'], 'existing_name must be a non-empty string');
        $this->assertArrayHasKey('existing_campaigns', $data, 'existing_campaigns must be present in duplicate response');
        $this->assertIsArray($data['existing_campaigns'], 'existing_campaigns must be an array');
    }

    public function test_force_true_bypasses_duplicate_check() {
        // First upload.
        $tmp1 = $this->create_temp_gif('force1');
        rest_do_request($this->make_request($tmp1, 'orig.gif'));

        // Second upload of same content with force=true — should succeed.
        $tmp2 = $this->create_temp_gif('force2');
        $response = rest_do_request($this->make_request($tmp2, 'orig.gif', true));

        $this->assertEquals(201, $response->get_status(), 'Forced re-upload should return 201');
        $this->assertArrayHasKey('attachmentId', $response->get_data());
    }

    public function test_duplicate_in_batch_includes_duplicate_flag() {
        // First upload to seed the MD5.
        $tmp1 = $this->create_temp_gif('batch1');
        rest_do_request($this->make_request($tmp1, 'batch.gif'));

        // Batch upload with the same file content.
        $tmp2 = $this->create_temp_gif('batch2');
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/upload');
        $request->set_file_params([
            'files' => [
                'name'     => ['batch_dup.gif'],
                'type'     => ['image/gif'],
                'tmp_name' => [$tmp2],
                'error'    => [UPLOAD_ERR_OK],
                'size'     => [filesize($tmp2)],
            ],
        ]);
        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status()); // batch always 201
        $results = $response->get_data()['results'];
        $this->assertCount(1, $results);
        $this->assertFalse($results[0]['success']);
        $this->assertTrue($results[0]['duplicate']);
        $this->assertArrayHasKey('existing_id', $results[0]);
        $this->assertArrayHasKey('existing_url', $results[0]);
    }
}
