<?php

class WPSG_Thumbnail_Cache_Test extends WP_UnitTestCase {

    private $cache_dir;

    public function setUp(): void {
        parent::setUp();
        delete_option('wpsg_thumbnail_cache_index');
        $this->cache_dir = WPSG_Thumbnail_Cache::get_cache_dir();
    }

    public function tearDown(): void {
        // Clean up cache files.
        if ($this->cache_dir && is_dir($this->cache_dir)) {
            $files = glob($this->cache_dir . '/*');
            if (is_array($files)) {
                foreach ($files as $f) {
                    if (is_file($f) && basename($f) !== 'index.php') {
                        @unlink($f);
                    }
                }
            }
        }
        delete_option('wpsg_thumbnail_cache_index');
        parent::tearDown();
    }

    // ── get_cache_dir ──────────────────────────────────────────────────────

    public function test_get_cache_dir_returns_path_under_uploads() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $this->assertIsString($dir);
        $this->assertStringContainsString(WPSG_Thumbnail_Cache::UPLOAD_DIR, $dir);
    }

    public function test_get_cache_dir_creates_directory() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $this->assertTrue(is_dir($dir));
    }

    public function test_get_cache_dir_creates_index_php() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $this->assertFileExists($dir . '/index.php');
    }

    // ── get_cache_url ──────────────────────────────────────────────────────

    public function test_get_cache_url_returns_url_string() {
        $url = WPSG_Thumbnail_Cache::get_cache_url();
        $this->assertIsString($url);
        $this->assertStringContainsString(WPSG_Thumbnail_Cache::UPLOAD_DIR, $url);
    }

    // ── cache_thumbnail ────────────────────────────────────────────────────

    public function test_cache_thumbnail_rejects_empty_url() {
        $result = WPSG_Thumbnail_Cache::cache_thumbnail('', 'https://example.com/media/1');
        $this->assertFalse($result['cached']);
        $this->assertStringContainsString('Invalid', $result['error']);
    }

    public function test_cache_thumbnail_rejects_invalid_url() {
        $result = WPSG_Thumbnail_Cache::cache_thumbnail('not-a-url', 'https://example.com/media/1');
        $this->assertFalse($result['cached']);
    }

    public function test_cache_thumbnail_stores_metadata_on_success() {
        // Use pre_http_request filter to mock the download.
        add_filter('pre_http_request', function ($preempt, $args, $url) {
            return [
                'response' => ['code' => 200, 'message' => 'OK'],
                'headers'  => new \WpOrg\Requests\Utility\CaseInsensitiveDictionary(['content-type' => 'image/jpeg']),
                'body'     => str_repeat('X', 100),
                'cookies'  => [],
                'filename' => '',
            ];
        }, 10, 3);

        $result = WPSG_Thumbnail_Cache::cache_thumbnail(
            'https://img.example.com/thumb.jpg',
            'https://example.com/media/1'
        );

        $this->assertTrue($result['cached']);
        $this->assertArrayHasKey('local_url', $result);

        // Check index was updated.
        $index = get_option('wpsg_thumbnail_cache_index', []);
        $hash = hash('sha256', 'https://example.com/media/1');
        $this->assertArrayHasKey($hash, $index);
        $this->assertEquals('https://example.com/media/1', $index[$hash]['source_url']);
    }

    // ── get_cached_url ─────────────────────────────────────────────────────

    public function test_get_cached_url_returns_null_for_uncached() {
        $result = WPSG_Thumbnail_Cache::get_cached_url('https://example.com/never-cached');
        $this->assertNull($result);
    }

    public function test_get_cached_url_returns_null_for_expired() {
        $hash = md5('https://example.com/expired');
        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'source_url'    => 'https://example.com/expired',
                'local_url'     => 'https://example.com/uploads/wpsg-thumbnails/test.jpg',
                'local_path'    => '/nonexistent/path.jpg',
                'cached_at'     => time() - 999999, // Very old
                'file_size'     => 100,
            ],
        ]);

        $result = WPSG_Thumbnail_Cache::get_cached_url('https://example.com/expired');
        $this->assertNull($result);
    }

    public function test_get_cached_url_returns_null_if_file_missing() {
        $hash = md5('https://example.com/missing-file');
        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'source_url'    => 'https://example.com/missing-file',
                'local_url'     => 'https://example.com/uploads/wpsg-thumbnails/missing.jpg',
                'local_path'    => '/tmp/nonexistent-file-wpsg-test.jpg',
                'cached_at'     => time(),
                'file_size'     => 100,
            ],
        ]);

        $result = WPSG_Thumbnail_Cache::get_cached_url('https://example.com/missing-file');
        $this->assertNull($result);
    }

    public function test_get_cached_url_returns_url_for_valid_entry() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $hash = md5('https://example.com/valid');
        $path = $dir . '/' . $hash . '.jpg';
        file_put_contents($path, 'fake-image-data');

        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'source_url'    => 'https://example.com/valid',
                'local_url'     => WPSG_Thumbnail_Cache::get_cache_url() . '/' . $hash . '.jpg',
                'local_path'    => $path,
                'cached_at'     => time(),
                'file_size'     => 15,
            ],
        ]);

        $result = WPSG_Thumbnail_Cache::get_cached_url('https://example.com/valid');
        $this->assertNotNull($result);
        $this->assertStringContainsString($hash, $result);
    }

    // ── cache_oembed_thumbnail ─────────────────────────────────────────────

    public function test_cache_oembed_thumbnail_skips_empty_thumbnail() {
        // Should not crash or create cache entries.
        WPSG_Thumbnail_Cache::cache_oembed_thumbnail('https://example.com/video', []);
        $index = get_option('wpsg_thumbnail_cache_index', []);
        $this->assertEmpty($index);
    }

    // ── cache_campaign_thumbnails ──────────────────────────────────────────

    public function test_cache_campaign_thumbnails_returns_zero_for_no_media() {
        $cid = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Empty',
            'post_status' => 'publish',
        ]);

        $result = WPSG_Thumbnail_Cache::cache_campaign_thumbnails($cid);
        $this->assertEquals(0, $result['cached']);
        $this->assertEquals(0, $result['skipped']);
        $this->assertEquals(0, $result['failed']);
    }

    public function test_cache_campaign_thumbnails_skips_local_attachments() {
        $cid = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Local',
            'post_status' => 'publish',
        ]);
        update_post_meta($cid, 'media_items', [
            [
                'id'           => 'img-1',
                'url'          => 'https://example.com/img.jpg',
                'thumbnail'    => 'https://example.com/thumb.jpg',
                'attachmentId' => 123,
            ],
        ]);

        $result = WPSG_Thumbnail_Cache::cache_campaign_thumbnails($cid);
        $this->assertEquals(1, $result['skipped']);
        $this->assertEquals(0, $result['cached']);
    }

    public function test_cache_campaign_thumbnails_skips_missing_thumbnail() {
        $cid = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'No Thumb',
            'post_status' => 'publish',
        ]);
        update_post_meta($cid, 'media_items', [
            ['id' => 'v1', 'url' => 'https://example.com/video'],
        ]);

        $result = WPSG_Thumbnail_Cache::cache_campaign_thumbnails($cid);
        $this->assertEquals(1, $result['skipped']);
    }

    // ── get_stats ──────────────────────────────────────────────────────────

    public function test_get_stats_returns_expected_keys() {
        $stats = WPSG_Thumbnail_Cache::get_stats();
        $this->assertArrayHasKey('totalFiles', $stats);
        $this->assertArrayHasKey('totalSize', $stats);
        $this->assertArrayHasKey('oldest', $stats);
        $this->assertArrayHasKey('newest', $stats);
        $this->assertArrayHasKey('ttl', $stats);
    }

    public function test_get_stats_counts_valid_files() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $hash1 = md5('s1');
        $hash2 = md5('s2');
        $path1 = $dir . '/' . $hash1 . '.jpg';
        $path2 = $dir . '/' . $hash2 . '.jpg';
        file_put_contents($path1, 'data1');
        file_put_contents($path2, 'data2data2');

        update_option('wpsg_thumbnail_cache_index', [
            $hash1 => ['local_path' => $path1, 'cached_at' => time() - 100, 'file_size' => 5],
            $hash2 => ['local_path' => $path2, 'cached_at' => time(), 'file_size' => 10],
        ]);

        $stats = WPSG_Thumbnail_Cache::get_stats();
        $this->assertEquals(2, $stats['totalFiles']);
        $this->assertEquals(15, $stats['totalSize']);
    }

    // ── cleanup_expired ────────────────────────────────────────────────────

    public function test_cleanup_expired_removes_old_entries() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $hash = md5('cleanup-test');
        $path = $dir . '/' . $hash . '.jpg';
        file_put_contents($path, 'old-data');

        // Cached very long ago (well beyond 2× TTL).
        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'local_path' => $path,
                'cached_at'  => time() - (WPSG_Thumbnail_Cache::DEFAULT_TTL * 3),
                'file_size'  => 8,
            ],
        ]);

        WPSG_Thumbnail_Cache::cleanup_expired();

        $this->assertFileDoesNotExist($path);
        $index = get_option('wpsg_thumbnail_cache_index', []);
        $this->assertArrayNotHasKey($hash, $index);
    }

    public function test_cleanup_expired_keeps_fresh_entries() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $hash = md5('fresh-test');
        $path = $dir . '/' . $hash . '.jpg';
        file_put_contents($path, 'fresh-data');

        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'local_path' => $path,
                'cached_at'  => time(),
                'file_size'  => 10,
            ],
        ]);

        WPSG_Thumbnail_Cache::cleanup_expired();

        $this->assertFileExists($path);
        $index = get_option('wpsg_thumbnail_cache_index', []);
        $this->assertArrayHasKey($hash, $index);
    }

    // ── clear_all ──────────────────────────────────────────────────────────

    public function test_clear_all_removes_files_and_resets_index() {
        $dir = WPSG_Thumbnail_Cache::get_cache_dir();
        $hash = md5('clear-test');
        $path = $dir . '/' . $hash . '.jpg';
        file_put_contents($path, 'to-delete');

        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'local_path' => $path,
                'cached_at'  => time(),
                'file_size'  => 9,
            ],
        ]);

        $removed = WPSG_Thumbnail_Cache::clear_all();
        $this->assertEquals(1, $removed);
        $this->assertFileDoesNotExist($path);

        $index = get_option('wpsg_thumbnail_cache_index', []);
        $this->assertEmpty($index);
    }

    public function test_clear_all_returns_zero_when_empty() {
        delete_option('wpsg_thumbnail_cache_index');
        $removed = WPSG_Thumbnail_Cache::clear_all();
        $this->assertEquals(0, $removed);
    }
}
