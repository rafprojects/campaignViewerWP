<?php

class WPSG_P28D_Batch_Media_Upload_Test extends WP_UnitTestCase {

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

    private function create_campaign(string $title = 'Batch Upload Campaign'): int {
        $campaign_id = wp_insert_post([
            'post_type' => 'wpsg_campaign',
            'post_title' => $title,
            'post_status' => 'publish',
        ]);

        update_post_meta($campaign_id, 'status', 'active');
        update_post_meta($campaign_id, 'visibility', 'private');
        update_post_meta($campaign_id, 'media_items', []);

        return (int) $campaign_id;
    }

    private function create_temp_gif(int $variant = 0): string {
        // Use a 16×9 gradient GIF so pHash (P38-MD1) produces a meaningful hash.
        // Variant 0 = left-to-right gradient  → dHash ≈ 0x0000000000000000
        // Variant 1 = right-to-left gradient  → dHash ≈ 0xffffffffffffffff
        // Hamming distance ≈ 64, well above the 10-bit threshold, so the two
        // images are never flagged as near-duplicates in batch-upload tests.
        $img = imagecreatetruecolor(16, 9);
        for ($x = 0; $x < 16; $x++) {
            $v = $variant === 0
                ? intval(($x / 15) * 255)
                : intval(((15 - $x) / 15) * 255);
            for ($y = 0; $y < 9; $y++) {
                $c = imagecolorallocate($img, $v, $v, $v);
                imagesetpixel($img, $x, $y, $c);
            }
        }
        $path = tempnam(sys_get_temp_dir(), 'wpsg-gif-');
        imagegif($img, $path);
        imagedestroy($img);
        return $path;
    }

    private function build_batch_file_params(array $files): array {
        return [
            'files' => [
                'name' => array_map(static function ($file) {
                    return $file['name'];
                }, $files),
                'type' => array_map(static function ($file) {
                    return $file['type'];
                }, $files),
                'tmp_name' => array_map(static function ($file) {
                    return $file['tmp_name'];
                }, $files),
                'error' => array_map(static function ($file) {
                    return $file['error'];
                }, $files),
                'size' => array_map(static function ($file) {
                    return $file['size'];
                }, $files),
            ],
        ];
    }

    public function test_upload_media_with_files_array_returns_result_entries() {
        $allow_non_http_uploads = static function ($allow, $file) {
            return true;
        };
        add_filter('wpsg_allow_non_http_uploads', $allow_non_http_uploads, 10, 2);

        $tmp_one = $this->create_temp_gif(0);
        $tmp_two = $this->create_temp_gif(1);
        $tmp_bad = tempnam(sys_get_temp_dir(), 'wpsg-bad-');
        file_put_contents($tmp_bad, 'not-an-image');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/upload');
        $request->set_file_params($this->build_batch_file_params([
            [
                'name' => 'one.gif',
                'type' => 'image/gif',
                'tmp_name' => $tmp_one,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmp_one),
            ],
            [
                'name' => 'two.gif',
                'type' => 'image/gif',
                'tmp_name' => $tmp_two,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmp_two),
            ],
            [
                'name' => 'bad.txt',
                'type' => 'text/plain',
                'tmp_name' => $tmp_bad,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmp_bad),
            ],
        ]));

        $response = rest_do_request($request);

        remove_filter('wpsg_allow_non_http_uploads', $allow_non_http_uploads, 10);

        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();

        $this->assertSame(3, $data['total']);
        $this->assertSame(2, $data['succeeded']);
        $this->assertSame(1, $data['failed']);
        $this->assertCount(3, $data['results']);

        $this->assertTrue($data['results'][0]['success']);
        $this->assertTrue($data['results'][1]['success']);
        $this->assertFalse($data['results'][2]['success']);
        $this->assertGreaterThan(0, $data['results'][0]['attachmentId']);
        $this->assertGreaterThan(0, $data['results'][1]['attachmentId']);
        $this->assertSame('Invalid file type', $data['results'][2]['error']);
    }

    public function test_upload_media_enforces_batch_limit_setting() {
        $allow_non_http_uploads = static function ($allow, $file) {
            return true;
        };
        $max_batch_upload_size = static function () {
            return 2;
        };
        add_filter('wpsg_allow_non_http_uploads', $allow_non_http_uploads, 10, 2);
        add_filter('wpsg_max_batch_upload_size', $max_batch_upload_size);

        $tmp_one = $this->create_temp_gif();
        $tmp_two = $this->create_temp_gif();
        $tmp_three = $this->create_temp_gif();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/upload');
        $request->set_file_params($this->build_batch_file_params([
            [
                'name' => 'one.gif',
                'type' => 'image/gif',
                'tmp_name' => $tmp_one,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmp_one),
            ],
            [
                'name' => 'two.gif',
                'type' => 'image/gif',
                'tmp_name' => $tmp_two,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmp_two),
            ],
            [
                'name' => 'three.gif',
                'type' => 'image/gif',
                'tmp_name' => $tmp_three,
                'error' => UPLOAD_ERR_OK,
                'size' => filesize($tmp_three),
            ],
        ]));

        $response = rest_do_request($request);

        remove_filter('wpsg_allow_non_http_uploads', $allow_non_http_uploads, 10);
        remove_filter('wpsg_max_batch_upload_size', $max_batch_upload_size, 10);

        $this->assertEquals(400, $response->get_status());
        $this->assertSame(
            'A maximum of 2 files can be uploaded per batch.',
            $response->as_error()->get_error_message()
        );
    }

    public function test_create_media_batch_adds_multiple_items_and_reports_failures() {
        $campaign_id = $this->create_campaign();

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/media/batch");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'items' => [
                [
                    'type' => 'image',
                    'source' => 'external',
                    'url' => 'https://example.com/photo-one.jpg',
                    'caption' => 'Photo one',
                ],
                [
                    'type' => 'video',
                    'source' => 'external',
                    'url' => 'https://www.youtube.com/watch?v=abc12345',
                    'caption' => 'Video one',
                ],
                [
                    'type' => 'video',
                    'source' => 'external',
                    'url' => 'http://invalid.example.com/nope',
                    'caption' => 'Broken item',
                ],
            ],
        ]));

        $response = rest_do_request($request);

        $this->assertEquals(201, $response->get_status());
        $data = $response->get_data();
        $this->assertCount(2, $data['added']);
        $this->assertCount(1, $data['failed']);

        $stored_media = get_post_meta($campaign_id, 'media_items', true);
        $stored_media = is_array($stored_media) ? $stored_media : [];

        $this->assertCount(2, $stored_media);
        $this->assertSame('https://example.com/photo-one.jpg', $stored_media[0]['url']);
        $this->assertSame('youtube', $stored_media[1]['provider']);
        $this->assertSame('URL must use HTTPS', $data['failed'][0]['error']);
    }
}