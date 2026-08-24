<?php

/**
 * P39-OC1: Object-cache health surface and warm-settings utility tests.
 */
class WPSG_P39OC1_CacheHealth_Test extends WP_UnitTestCase {

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
        wp_cache_delete('wpsg_settings', 'wpsg_settings');
        parent::tearDown();
    }

    // ── get_object_cache_health() ─────────────────────────────────────────────

    public function test_object_cache_health_non_persistent(): void {
        $health = WPSG_Monitoring::get_object_cache_health();

        $this->assertIsArray($health);
        $this->assertArrayHasKey('persistent', $health);
        $this->assertArrayHasKey('backend', $health);
        $this->assertArrayHasKey('stats_available', $health);
        $this->assertArrayHasKey('stats', $health);

        // The WP unit-test environment uses the non-persistent in-memory cache.
        $this->assertFalse($health['persistent'], 'WP test env should report non-persistent cache');
        $this->assertNull($health['backend']);
        $this->assertFalse($health['stats_available']);
        $this->assertNull($health['stats']);
    }

    public function test_object_cache_health_shape_matches_expected_keys(): void {
        $health = WPSG_Monitoring::get_object_cache_health();

        $this->assertSame(
            ['persistent', 'backend', 'stats_available', 'stats'],
            array_keys($health),
            'objectCache array must have exactly the four expected keys in order'
        );
    }

    // ── get_health_data() includes objectCache ────────────────────────────────

    public function test_health_data_includes_object_cache_key(): void {
        $data = WPSG_Monitoring::get_health_data();

        $this->assertIsArray($data);
        $this->assertArrayHasKey('objectCache', $data, 'get_health_data() must include an objectCache key');

        $oc = $data['objectCache'];
        $this->assertIsArray($oc);
        $this->assertArrayHasKey('persistent', $oc);
        $this->assertArrayHasKey('backend', $oc);
        $this->assertArrayHasKey('stats_available', $oc);
        $this->assertArrayHasKey('stats', $oc);
    }

    public function test_health_endpoint_includes_object_cache(): void {
        $request  = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/health');
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $body = $response->get_data();
        $this->assertIsArray($body);
        $this->assertArrayHasKey('objectCache', $body);
    }

    // ── warm_settings() ───────────────────────────────────────────────────────

    public function test_warm_settings_primes_cache(): void {
        // Ensure the cache group is cold.
        wp_cache_delete('wpsg_settings', 'wpsg_settings');

        // Seed the option so warm_settings has something to cache.
        update_option('wpsg_settings', ['theme' => 'default'], true);

        WPSG_Monitoring::warm_settings();

        $cached = wp_cache_get('wpsg_settings', 'wpsg_settings');
        $this->assertNotFalse($cached, 'warm_settings() should prime the wpsg_settings cache group');
        $this->assertIsArray($cached);
    }

    public function test_warm_settings_is_idempotent(): void {
        update_option('wpsg_settings', ['theme' => 'test'], true);

        // Call twice — second call should be a no-op (cache already warm).
        WPSG_Monitoring::warm_settings();
        WPSG_Monitoring::warm_settings();

        $cached = wp_cache_get('wpsg_settings', 'wpsg_settings');
        $this->assertNotFalse($cached);
        $this->assertSame('test', $cached['theme'] ?? null);
    }
}
