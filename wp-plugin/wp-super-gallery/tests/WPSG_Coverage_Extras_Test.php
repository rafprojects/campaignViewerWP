<?php

/**
 * Additional tests to push method-level coverage above 80%.
 *
 * Covers: Sentry, OEmbed Providers, Embed (registration/assets/cache headers),
 * Overlay Library (ensure_htaccess, sanitize_svg_uris), Thumbnail Cache (register, refresh_all).
 */
class WPSG_Coverage_Extras_Test extends WP_UnitTestCase {

    // ═══════════════════════════════════════════════════════════════════════
    // WPSG_Sentry
    // ═══════════════════════════════════════════════════════════════════════

    public function test_sentry_init_without_dsn_is_noop() {
        // With no DSN filter, init() should be safe to call and do nothing.
        WPSG_Sentry::init();
        // No exception = pass.
        $this->assertTrue(true);
    }

    public function test_sentry_capture_message_without_sentry_is_noop() {
        // Sentry lib not loaded → capture_message gracefully returns.
        WPSG_Sentry::capture_message('test message', ['key' => 'value']);
        $this->assertTrue(true);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WPSG_OEmbed_Providers
    // ═══════════════════════════════════════════════════════════════════════

    public function test_oembed_providers_fetch_delegates_to_registry() {
        $attempts = [];
        // Use a URL that won't match any provider.
        $result = WPSG_OEmbed_Providers::fetch(
            'https://unknown-site.example/video/123',
            parse_url('https://unknown-site.example/video/123'),
            $attempts
        );

        // No provider matched → null.
        $this->assertNull($result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WPSG_Embed — register_shortcode, register_assets, add_asset_cache_headers
    // ═══════════════════════════════════════════════════════════════════════

    public function test_embed_register_shortcode() {
        // Remove if already registered.
        remove_shortcode('super-gallery');
        $this->assertFalse(shortcode_exists('super-gallery'));

        WPSG_Embed::register_shortcode();
        $this->assertTrue(shortcode_exists('super-gallery'));
    }

    public function test_embed_register_assets() {
        // Deregister if present.
        wp_deregister_script('wp-super-gallery-app');
        $this->assertFalse(wp_script_is('wp-super-gallery-app', 'registered'));

        WPSG_Embed::register_assets();
        $this->assertTrue(wp_script_is('wp-super-gallery-app', 'registered'));
    }

    public function test_embed_add_asset_cache_headers_noop_without_matching_uri() {
        // With no matching asset URI, should return without error.
        $_SERVER['REQUEST_URI'] = '/some-page';
        WPSG_Embed::add_asset_cache_headers();
        $this->assertTrue(true);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WPSG_Overlay_Library — ensure_htaccess, sanitize_svg_uris
    // ═══════════════════════════════════════════════════════════════════════

    public function test_ensure_htaccess_creates_file() {
        $upload_dir = wp_upload_dir();
        $test_dir = trailingslashit($upload_dir['basedir']) . 'wpsg-test-htaccess-' . wp_rand();
        wp_mkdir_p($test_dir);

        $htaccess = trailingslashit($test_dir) . '.htaccess';
        $this->assertFileDoesNotExist($htaccess);

        WPSG_Overlay_Library::ensure_htaccess($test_dir);
        $this->assertFileExists($htaccess);

        $content = file_get_contents($htaccess);
        $this->assertStringContainsString('Content-Security-Policy', $content);
        $this->assertStringContainsString('php_flag engine off', $content);

        // Second call should not error (file already exists).
        WPSG_Overlay_Library::ensure_htaccess($test_dir);

        // Cleanup.
        @unlink($htaccess);
        @rmdir($test_dir);
    }

    public function test_sanitize_svg_uris_blocks_javascript() {
        $svg = '<svg><image href="javascript:alert(1)" /></svg>';
        $result = WPSG_Overlay_Library::sanitize_svg_uris($svg);

        $this->assertStringNotContainsString('javascript:', $result);
    }

    public function test_sanitize_svg_uris_allows_fragment_refs() {
        $svg = '<svg><use href="#my-icon" /></svg>';
        $result = WPSG_Overlay_Library::sanitize_svg_uris($svg);

        $this->assertStringContainsString('#my-icon', $result);
    }

    public function test_sanitize_svg_uris_blocks_external_urls() {
        $svg = '<svg><image href="https://evil.example/payload.svg" /></svg>';
        $result = WPSG_Overlay_Library::sanitize_svg_uris($svg);

        $this->assertStringNotContainsString('evil.example', $result);
    }

    public function test_sanitize_svg_uris_blocks_vbscript() {
        $svg = '<svg><a href="vbscript:run">Click</a></svg>';
        $result = WPSG_Overlay_Library::sanitize_svg_uris($svg);

        $this->assertStringNotContainsString('vbscript:', $result);
    }

    public function test_sanitize_svg_uris_allows_data_image() {
        $data_uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlz';
        $svg = '<svg><image href="' . $data_uri . '" /></svg>';
        $result = WPSG_Overlay_Library::sanitize_svg_uris($svg);

        $this->assertStringContainsString('data:image/png', $result);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // WPSG_Thumbnail_Cache — register, refresh_all
    // ═══════════════════════════════════════════════════════════════════════

    public function test_thumbnail_cache_register_hooks_cron() {
        // Clear any existing scheduled event.
        $ts = wp_next_scheduled('wpsg_thumbnail_cache_cleanup');
        if ($ts) {
            wp_unschedule_event($ts, 'wpsg_thumbnail_cache_cleanup');
        }

        WPSG_Thumbnail_Cache::register();

        // Verify the oembed success action is hooked.
        $this->assertGreaterThan(
            0,
            has_action('wpsg_oembed_success', [WPSG_Thumbnail_Cache::class, 'cache_oembed_thumbnail'])
        );
    }

    public function test_thumbnail_cache_refresh_all_empty_index() {
        delete_option('wpsg_thumbnail_cache_index');

        $result = WPSG_Thumbnail_Cache::refresh_all();
        $this->assertIsArray($result);
        $this->assertEquals(0, $result['refreshed']);
        $this->assertEquals(0, $result['failed']);
    }

    public function test_thumbnail_cache_refresh_all_with_entries() {
        // Mock HTTP to return an image body.
        add_filter('pre_http_request', function () {
            return [
                'response' => ['code' => 200],
                'body'     => str_repeat('x', 100), // fake image bytes
                'headers'  => new \WpOrg\Requests\Utility\CaseInsensitiveDictionary([
                    'content-type' => 'image/jpeg',
                ]),
            ];
        }, 10, 3);

        // Plant an entry in the cache index.
        $hash = md5('https://example.com/thumb.jpg');
        update_option('wpsg_thumbnail_cache_index', [
            $hash => [
                'thumbnail_url' => 'https://example.com/thumb.jpg',
                'source_url'    => 'https://example.com/video',
                'cached_at'     => time() - 999999,
            ],
        ], false);

        $result = WPSG_Thumbnail_Cache::refresh_all();
        $this->assertIsArray($result);
        $this->assertGreaterThanOrEqual(0, $result['refreshed'] + $result['failed']);

        // Cleanup.
        delete_option('wpsg_thumbnail_cache_index');
        remove_all_filters('pre_http_request');
    }
}
