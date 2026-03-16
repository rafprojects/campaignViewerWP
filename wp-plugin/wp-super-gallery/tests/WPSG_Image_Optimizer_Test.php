<?php

class WPSG_Image_Optimizer_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        remove_all_filters('wp_handle_upload');
        remove_all_filters('upload_mimes');
    }

    public function tearDown(): void {
        remove_all_filters('wp_handle_upload');
        remove_all_filters('upload_mimes');
        parent::tearDown();
    }

    // ── register_image_sizes ───────────────────────────────────────────────

    public function test_register_image_sizes_adds_wpsg_sizes() {
        WPSG_Image_Optimizer::register_image_sizes();

        global $_wp_additional_image_sizes;
        $this->assertArrayHasKey('wpsg_gallery', $_wp_additional_image_sizes);
        $this->assertArrayHasKey('wpsg_thumb', $_wp_additional_image_sizes);
    }

    public function test_register_image_sizes_uses_defaults() {
        WPSG_Image_Optimizer::register_image_sizes();

        global $_wp_additional_image_sizes;
        $gallery = $_wp_additional_image_sizes['wpsg_gallery'];
        $this->assertEquals(WPSG_Image_Optimizer::MAX_WIDTH_DEFAULT, $gallery['width']);
        $this->assertEquals(WPSG_Image_Optimizer::MAX_HEIGHT_DEFAULT, $gallery['height']);
        $this->assertFalse($gallery['crop']);

        $thumb = $_wp_additional_image_sizes['wpsg_thumb'];
        $this->assertEquals(400, $thumb['width']);
        $this->assertEquals(400, $thumb['height']);
    }

    // ── optimize_on_upload ─────────────────────────────────────────────────

    public function test_optimize_on_upload_skips_non_images() {
        $upload = [
            'file' => '/tmp/test.pdf',
            'url'  => 'http://example.com/test.pdf',
            'type' => 'application/pdf',
        ];

        $result = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
        $this->assertEquals($upload, $result);
    }

    public function test_optimize_on_upload_skips_svg() {
        $upload = [
            'file' => '/tmp/test.svg',
            'url'  => 'http://example.com/test.svg',
            'type' => 'image/svg+xml',
        ];

        $result = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
        $this->assertEquals($upload, $result);
    }

    public function test_optimize_on_upload_skips_gif() {
        $upload = [
            'file' => '/tmp/test.gif',
            'url'  => 'http://example.com/test.gif',
            'type' => 'image/gif',
        ];

        $result = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
        $this->assertEquals($upload, $result);
    }

    public function test_optimize_on_upload_skips_when_disabled() {
        // With no settings class or optimize_on_upload setting, it returns early.
        $upload = [
            'file' => '/tmp/test.jpg',
            'url'  => 'http://example.com/test.jpg',
            'type' => 'image/jpeg',
        ];

        $result = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
        $this->assertEquals($upload, $result);
    }

    public function test_optimize_on_upload_skips_missing_file() {
        // Even if settings were configured, a nonexistent file returns early.
        $upload = [
            'file' => '/tmp/nonexistent-wpsg-test-' . uniqid() . '.jpg',
            'url'  => 'http://example.com/test.jpg',
            'type' => 'image/jpeg',
        ];

        $result = WPSG_Image_Optimizer::optimize_on_upload($upload, 'upload');
        $this->assertEquals($upload, $result);
    }

    // ── constrain_image ────────────────────────────────────────────────────

    public function test_constrain_image_returns_true_for_small_image() {
        // Create a small actual image for testing.
        $file = $this->create_test_image(100, 100);
        if (!$file) {
            $this->markTestSkipped('Could not create test image (GD not available)');
        }

        $result = WPSG_Image_Optimizer::constrain_image($file, 1920, 1920, 82);
        $this->assertTrue($result);

        @unlink($file);
    }

    public function test_constrain_image_resizes_large_image() {
        $file = $this->create_test_image(3000, 2000);
        if (!$file) {
            $this->markTestSkipped('Could not create test image (GD not available)');
        }

        $result = WPSG_Image_Optimizer::constrain_image($file, 1920, 1920, 82);
        $this->assertTrue($result);

        // Verify the file was resized.
        $size = getimagesize($file);
        $this->assertLessThanOrEqual(1920, $size[0]);
        $this->assertLessThanOrEqual(1920, $size[1]);

        @unlink($file);
    }

    public function test_constrain_image_returns_wp_error_for_invalid_file() {
        $result = WPSG_Image_Optimizer::constrain_image('/tmp/nonexistent-' . uniqid(), 1920, 1920, 82);
        $this->assertInstanceOf(WP_Error::class, $result);
    }

    // ── generate_webp ──────────────────────────────────────────────────────

    public function test_generate_webp_creates_webp_file() {
        if (!function_exists('imagewebp')) {
            $this->markTestSkipped('WebP support not available in GD');
        }

        $file = $this->create_test_image(200, 200);
        if (!$file) {
            $this->markTestSkipped('Could not create test image');
        }

        $result = WPSG_Image_Optimizer::generate_webp($file, 82);

        if (is_wp_error($result)) {
            // Some environments don't support WebP saving.
            $this->markTestSkipped('WP image editor cannot save WebP: ' . $result->get_error_message());
        }

        $this->assertIsString($result);
        $this->assertStringEndsWith('.webp', $result);
        $this->assertFileExists($result);

        @unlink($file);
        @unlink($result);
    }

    public function test_generate_webp_returns_wp_error_for_invalid_file() {
        $result = WPSG_Image_Optimizer::generate_webp('/tmp/nonexistent-' . uniqid(), 82);
        $this->assertInstanceOf(WP_Error::class, $result);
    }

    // ── add_webp_mime ──────────────────────────────────────────────────────

    public function test_add_webp_mime_adds_webp_type() {
        $mimes = WPSG_Image_Optimizer::add_webp_mime([]);
        $this->assertArrayHasKey('webp', $mimes);
        $this->assertEquals('image/webp', $mimes['webp']);
    }

    public function test_add_webp_mime_preserves_existing_mimes() {
        $mimes = WPSG_Image_Optimizer::add_webp_mime(['jpg' => 'image/jpeg']);
        $this->assertArrayHasKey('jpg', $mimes);
        $this->assertArrayHasKey('webp', $mimes);
    }

    // ── get_stats ──────────────────────────────────────────────────────────

    public function test_get_stats_returns_expected_keys() {
        $stats = WPSG_Image_Optimizer::get_stats();
        $this->assertArrayHasKey('optimizedCount', $stats);
        $this->assertArrayHasKey('webpCount', $stats);
        $this->assertArrayHasKey('totalImages', $stats);
    }

    public function test_get_stats_returns_zero_when_no_attachments() {
        $stats = WPSG_Image_Optimizer::get_stats();
        $this->assertEquals(0, $stats['totalImages']);
        $this->assertEquals(0, $stats['optimizedCount']);
        $this->assertEquals(0, $stats['webpCount']);
    }

    // ── Constants ──────────────────────────────────────────────────────────

    public function test_default_constants() {
        $this->assertEquals(1920, WPSG_Image_Optimizer::MAX_WIDTH_DEFAULT);
        $this->assertEquals(1920, WPSG_Image_Optimizer::MAX_HEIGHT_DEFAULT);
        $this->assertEquals(82, WPSG_Image_Optimizer::QUALITY_DEFAULT);
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private function create_test_image(int $width, int $height): ?string {
        if (!function_exists('imagecreatetruecolor')) {
            return null;
        }

        $img = imagecreatetruecolor($width, $height);
        $color = imagecolorallocate($img, 255, 0, 0);
        imagefill($img, 0, 0, $color);

        $file = tempnam(sys_get_temp_dir(), 'wpsg_test_') . '.jpg';
        imagejpeg($img, $file, 90);
        imagedestroy($img);

        return $file;
    }
}
