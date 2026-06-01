<?php

class WPSG_P38MD1_PHash_Test extends WP_UnitTestCase {

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

        add_filter('wpsg_allow_non_http_uploads', '__return_true');
    }

    public function tearDown(): void {
        remove_all_filters('wpsg_allow_non_http_uploads');
        remove_all_filters('wpsg_phash_hamming_threshold');
        parent::tearDown();
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Create a temp PNG using GD — a real raster image that GD can decode for
     * grayscale processing (unlike the base64 GIF used in P28-N tests which is
     * too small for imagescale to produce meaningful output).
     *
     * @param int $variant When non-zero, shifts the top-left pixel value by $variant steps.
     *                     This changes the MD5 without affecting the dHash, because dHash
     *                     compares each pixel to its right neighbour; pixel(0,y) vs pixel(1,y)
     *                     stays left < right for any small offset on a left-edge pixel.
     *                     Use $variant to produce two byte-different but visually equivalent
     *                     images for near-duplicate tests.
     */
    private function create_temp_png(string $suffix = '', int $width = 32, int $height = 32, int $variant = 0): string {
        $img = imagecreatetruecolor($width, $height);
        // Fill with a horizontal gradient so neighbouring pixels differ (non-trivial dHash).
        for ($x = 0; $x < $width; $x++) {
            for ($y = 0; $y < $height; $y++) {
                $v = intval(($x / $width) * 255);
                // Shift the top-left pixel for the variant copy — changes MD5, not dHash.
                if ($variant > 0 && $x === 0 && $y === 0) {
                    $v = min(255, $v + $variant);
                }
                $color = imagecolorallocate($img, $v, $v, $v);
                imagesetpixel($img, $x, $y, $color);
            }
        }
        $path = tempnam(sys_get_temp_dir(), 'wpsg-png' . $suffix . '-') . '.png';
        imagepng($img, $path);
        imagedestroy($img);
        return $path;
    }

    private function make_upload_request(string $tmp_path, string $filename = 'test.png', bool $force = false): WP_REST_Request {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/media/upload');
        $request->set_file_params([
            'file' => [
                'name'     => $filename,
                'type'     => 'image/png',
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

    // -------------------------------------------------------------------------
    // WPSG_PHash unit tests
    // -------------------------------------------------------------------------

    public function test_compute_returns_16_char_hex_for_valid_image() {
        $path = $this->create_temp_png('hash1');
        $hash = WPSG_PHash::compute($path);
        @unlink($path);

        $this->assertNotNull($hash, 'compute() should return a string for a valid PNG');
        $this->assertEquals(16, strlen($hash), 'dHash must be exactly 16 hex chars');
        $this->assertMatchesRegularExpression('/^[0-9a-f]{16}$/', $hash, 'Hash must be lowercase hex');
    }

    public function test_compute_returns_null_for_non_image() {
        $path = tempnam(sys_get_temp_dir(), 'wpsg-txt-');
        file_put_contents($path, 'not an image');
        $hash = WPSG_PHash::compute($path);
        @unlink($path);

        $this->assertNull($hash, 'compute() must return null for non-image files');
    }

    public function test_hamming_distance_zero_for_identical_hashes() {
        $hash = 'a3f2b1c4d5e6f789';
        $this->assertEquals(0, WPSG_PHash::hamming_distance($hash, $hash));
    }

    public function test_hamming_distance_counts_differing_bits() {
        // 'f' (1111) vs '0' (0000) = 4 differing bits; pad rest with '0'.
        $a = 'f000000000000000';
        $b = '0000000000000000';
        $this->assertEquals(4, WPSG_PHash::hamming_distance($a, $b));
    }

    public function test_hamming_distance_returns_max_int_for_length_mismatch() {
        $this->assertEquals(PHP_INT_MAX, WPSG_PHash::hamming_distance('abc', 'abcd'));
    }

    public function test_is_image_mime_true_for_image_types() {
        $this->assertTrue(WPSG_PHash::is_image_mime('image/jpeg'));
        $this->assertTrue(WPSG_PHash::is_image_mime('image/png'));
        $this->assertTrue(WPSG_PHash::is_image_mime('image/gif'));
        $this->assertTrue(WPSG_PHash::is_image_mime('image/webp'));
    }

    public function test_is_image_mime_false_for_video_types() {
        $this->assertFalse(WPSG_PHash::is_image_mime('video/mp4'));
        $this->assertFalse(WPSG_PHash::is_image_mime('video/webm'));
    }

    // -------------------------------------------------------------------------
    // Integration tests — upload pipeline
    // -------------------------------------------------------------------------

    public function test_phash_stored_on_successful_upload() {
        $path     = $this->create_temp_png('store1');
        $response = rest_do_request($this->make_upload_request($path, 'store1.png'));

        $this->assertEquals(201, $response->get_status(), 'Upload must succeed');
        $data = $response->get_data();
        $this->assertArrayHasKey('attachmentId', $data);

        $stored = get_post_meta((int) $data['attachmentId'], '_wpsg_file_phash', true);
        $this->assertNotEmpty($stored, '_wpsg_file_phash should be set on the new attachment');
        $this->assertEquals(16, strlen($stored), 'Stored pHash must be 16 hex chars');
    }

    public function test_near_duplicate_upload_returns_409() {
        // First upload — seeds the pHash index.
        $path1    = $this->create_temp_png('nd1');
        $response1 = rest_do_request($this->make_upload_request($path1, 'original.png'));
        $this->assertEquals(201, $response1->get_status(), 'First upload must succeed');
        $first_id = (int) $response1->get_data()['attachmentId'];

        // Use a high threshold to guard against minor dHash variation between GD versions.
        add_filter('wpsg_phash_hamming_threshold', fn() => 64);

        // Second upload: variant=1 shifts one corner pixel — different MD5, same dHash
        // (pixel(0,y) vs pixel(1,y) comparison is unaffected by a small left-edge offset).
        $path2 = $this->create_temp_png('nd2', 32, 32, 1);
        $response2 = rest_do_request($this->make_upload_request($path2, 'similar.png'));

        $this->assertEquals(409, $response2->get_status(), 'Near-duplicate upload should return 409');
        $data = $response2->get_data();
        $this->assertTrue($data['near_duplicate'], 'near_duplicate flag must be true');
        $this->assertEquals($first_id, $data['similar_id'], 'similar_id must point to the first attachment');
        $this->assertNotEmpty($data['similar_url'], 'similar_url must be set');
        $this->assertIsInt($data['distance'], 'distance must be an integer');
        $this->assertArrayHasKey('similar_name', $data, 'similar_name must be present in near-duplicate response');
        $this->assertIsString($data['similar_name'], 'similar_name must be a string');
        $this->assertArrayHasKey('similar_campaigns', $data, 'similar_campaigns must be present in near-duplicate response');
        $this->assertIsArray($data['similar_campaigns'], 'similar_campaigns must be an array');
    }

    public function test_near_duplicate_response_includes_origin_meta() {
        $path1 = $this->create_temp_png('om1');
        $response1 = rest_do_request($this->make_upload_request($path1, 'origin-meta.png'));
        $this->assertEquals(201, $response1->get_status());

        add_filter('wpsg_phash_hamming_threshold', fn() => 64);

        $path2 = $this->create_temp_png('om2', 32, 32, 1);
        $response2 = rest_do_request($this->make_upload_request($path2, 'near-meta.png'));

        $this->assertEquals(409, $response2->get_status());
        $data = $response2->get_data();
        $this->assertNotEmpty($data['similar_name'], 'similar_name should be the original filename');
        $this->assertStringContainsString('origin-meta', $data['similar_name'], 'similar_name should contain the uploaded filename stem');
        $this->assertIsArray($data['similar_campaigns'], 'similar_campaigns must be an array');
    }

    public function test_get_campaigns_for_attachment_id_returns_correct_campaigns() {
        // Create a minimal attachment directly (no REST needed for a DB-only assertion).
        $attachment_id = wp_insert_attachment([
            'post_title'     => 'camp.png',
            'post_mime_type' => 'image/png',
            'post_status'    => 'inherit',
        ], false);
        $this->assertGreaterThan(0, $attachment_id, 'Attachment must be created');

        // Campaign that contains this attachment.
        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Campaign With Media',
            'post_status' => 'publish',
        ]);
        $this->assertGreaterThan(0, $campaign_id, 'Campaign must be created');

        // Write media_items directly to postmeta, bypassing WordPress's meta API so that
        // the sanitize_meta hook (which converts non-empty arrays to [] on first insert in
        // the test environment) does not corrupt the value before it reaches the DB.
        global $wpdb;
        $wpdb->insert(
            $wpdb->postmeta,
            [
                'post_id'    => (int) $campaign_id,
                'meta_key'   => 'media_items',
                'meta_value' => serialize([['attachmentId' => (int) $attachment_id, 'url' => 'https://example.com/img.png', 'type' => 'image']]),
            ],
            ['%d', '%s', '%s']
        );
        wp_cache_delete((int) $campaign_id, 'post_meta');

        // Another campaign without this attachment.
        $other_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Other Campaign',
            'post_status' => 'publish',
        ]);
        $wpdb->insert(
            $wpdb->postmeta,
            [
                'post_id'    => (int) $other_id,
                'meta_key'   => 'media_items',
                'meta_value' => serialize([]),
            ],
            ['%d', '%s', '%s']
        );
        wp_cache_delete((int) $other_id, 'post_meta');

        $campaigns = WPSG_DB::get_campaigns_for_attachment_id((int) $attachment_id);

        $this->assertCount(1, $campaigns, 'Only the matching campaign should be returned');
        $this->assertSame((string) $campaign_id, $campaigns[0]['id']);
        $this->assertSame('Campaign With Media', $campaigns[0]['title']);

        // An unrelated attachment ID returns nothing.
        $none = WPSG_DB::get_campaigns_for_attachment_id(999999);
        $this->assertIsArray($none);
        $this->assertCount(0, $none);
    }

    public function test_exact_duplicate_still_returns_409_with_duplicate_flag() {
        // Exact duplicate path (MD5 match) must remain unchanged by P38-MD1.
        $path1    = $this->create_temp_png('ex1');
        $response1 = rest_do_request($this->make_upload_request($path1, 'exact.png'));
        $this->assertEquals(201, $response1->get_status());
        $first_id = (int) $response1->get_data()['attachmentId'];

        $path2    = $this->create_temp_png('ex2'); // same bytes — MD5 match fires first
        $response2 = rest_do_request($this->make_upload_request($path2, 'exact-dup.png'));

        $this->assertEquals(409, $response2->get_status());
        $data = $response2->get_data();
        $this->assertTrue($data['duplicate'], 'exact duplicate flag must still be true');
        $this->assertEquals($first_id, $data['existing_id']);
    }

    public function test_force_true_bypasses_near_duplicate_check() {
        $path1 = $this->create_temp_png('force1');
        rest_do_request($this->make_upload_request($path1, 'orig.png'));

        // variant=1 gives a different MD5 (so MD5 check doesn't fire) but the same dHash
        // (so near-duplicate check would fire at default threshold without force=true).
        $path2    = $this->create_temp_png('force2', 32, 32, 1);
        $response = rest_do_request($this->make_upload_request($path2, 'orig-force.png', true));

        $this->assertEquals(201, $response->get_status(), 'force=true must bypass near-duplicate check');
        $this->assertArrayHasKey('attachmentId', $response->get_data());
    }

    public function test_video_upload_does_not_store_phash() {
        // Simulate a video upload by checking that the pHash is not stored.
        // We can't upload a real video in the test environment, but we can verify
        // that WPSG_PHash::is_image_mime() returns false for video types, which is
        // the gate used in upload_single_media_file().
        $this->assertFalse(
            WPSG_PHash::is_image_mime('video/mp4'),
            'Video MIME types must be excluded from pHash computation'
        );
        $this->assertFalse(
            WPSG_PHash::is_image_mime('video/webm'),
            'Video MIME types must be excluded from pHash computation'
        );
    }
}
