<?php
/**
 * P63-A / P63-B — REST-base rate limiter correctness.
 *
 * P63-A: the limiter must actually throttle on hosts WITHOUT a persistent object
 *        cache (the common case). Previously it keyed the backend choice on
 *        function_exists('wp_cache_incr') — always true — so the transient
 *        fallback was unreachable and the object-cache counter reset every request.
 *
 * P63-B: the limiter must bucket per real client IP (via the trusted-proxy-aware
 *        WPSG_Rate_Limiter::get_client_ip()), not per raw REMOTE_ADDR, so visitors
 *        behind a shared reverse proxy/CDN don't collapse into one site-wide bucket.
 *        It must also tune its window via the distinct `wpsg_rest_rate_limit_window`
 *        filter (not the oEmbed proxy's `wpsg_rate_limit_window`).
 *
 * These exercise the private rate_limit_check() through the public
 * rate_limit_public() permission callback.
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63A_B_Rest_Rate_Limit_Test extends WP_UnitTestCase {

    private $orig_remote_addr = null;
    private ?bool $orig_ext_cache = null;

    public function setUp(): void {
        parent::setUp();
        $this->orig_remote_addr = $_SERVER['REMOTE_ADDR'] ?? null;
        // Force the "no persistent object cache" host profile for these tests so
        // the transient backend is exercised (the majority-host case).
        $this->orig_ext_cache = wp_using_ext_object_cache( false );
    }

    public function tearDown(): void {
        wp_using_ext_object_cache( $this->orig_ext_cache );
        if ( $this->orig_remote_addr !== null ) {
            $_SERVER['REMOTE_ADDR'] = $this->orig_remote_addr;
        } else {
            unset( $_SERVER['REMOTE_ADDR'] );
        }
        unset( $_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['HTTP_X_REAL_IP'] );
        remove_all_filters( 'wpsg_rate_limit_public' );
        remove_all_filters( 'wpsg_rest_rate_limit_window' );
        remove_all_filters( 'wpsg_rate_limiter_trusted_proxies' );
        parent::tearDown();
    }

    /** Transient key the way rate_limit_check() derives it for the public scope. */
    private function public_key( string $ip, string $route ): string {
        return sprintf( 'wpsg_rl_public_anon_%s', md5( $ip . '|' . $route ) );
    }

    // ── P63-A ────────────────────────────────────────────────────────────────

    public function test_transient_backend_throttles_without_persistent_cache() {
        $ip    = '198.51.100.10';
        $route = '/wp-super-gallery/v1/p63a-throttle';
        $_SERVER['REMOTE_ADDR'] = $ip;
        add_filter( 'wpsg_rate_limit_public', fn() => 2 );

        $request = new WP_REST_Request( 'GET', $route );

        $r1 = WPSG_REST_Base::rate_limit_public( $request );
        $r2 = WPSG_REST_Base::rate_limit_public( $request );
        $r3 = WPSG_REST_Base::rate_limit_public( $request );

        $this->assertTrue( $r1, 'first request under the limit is allowed' );
        $this->assertTrue( $r2, 'second request at the limit is allowed' );
        $this->assertInstanceOf( WP_Error::class, $r3, 'third request over the limit is blocked' );
        $this->assertSame( 429, $r3->get_error_data()['status'] );

        // Prove the *transient* backend was actually used (the fix's whole point:
        // this branch was previously dead on non-persistent-cache hosts).
        $this->assertIsArray(
            get_transient( $this->public_key( $ip, $route ) ),
            'the transient counter bucket must exist when no persistent object cache is present'
        );

        delete_transient( $this->public_key( $ip, $route ) );
    }

    // ── P63-B ────────────────────────────────────────────────────────────────

    public function test_buckets_per_client_ip_behind_trusted_proxy() {
        $proxy = '10.10.0.9';
        $route = '/wp-super-gallery/v1/p63b-proxy';
        $_SERVER['REMOTE_ADDR'] = $proxy;
        add_filter( 'wpsg_rate_limiter_trusted_proxies', fn() => [ $proxy ] );
        add_filter( 'wpsg_rate_limit_public', fn() => 1 ); // one request allowed per window

        $request = new WP_REST_Request( 'GET', $route );

        // Client A behind the proxy: exhaust its single-request allowance.
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.11';
        $a1 = WPSG_REST_Base::rate_limit_public( $request );
        $a2 = WPSG_REST_Base::rate_limit_public( $request );

        // Client B behind the SAME proxy: must have an independent bucket.
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '203.0.113.22';
        $b1 = WPSG_REST_Base::rate_limit_public( $request );

        $this->assertTrue( $a1, 'client A first request allowed' );
        $this->assertInstanceOf( WP_Error::class, $a2, 'client A second request blocked (limit 1)' );
        $this->assertTrue( $b1, 'client B is not throttled by client A — separate per-visitor bucket' );

        // Buckets are keyed by the real client IP, not the proxy IP.
        $this->assertIsArray( get_transient( $this->public_key( '203.0.113.11', $route ) ) );
        $this->assertIsArray( get_transient( $this->public_key( '203.0.113.22', $route ) ) );
        $this->assertFalse(
            get_transient( $this->public_key( $proxy, $route ) ),
            'no bucket should be keyed to the proxy IP itself'
        );

        delete_transient( $this->public_key( '203.0.113.11', $route ) );
        delete_transient( $this->public_key( '203.0.113.22', $route ) );
    }

    public function test_window_uses_distinct_rest_filter_with_scope_arg() {
        $seen_scopes = [];
        add_filter( 'wpsg_rest_rate_limit_window', function ( $window, $scope ) use ( &$seen_scopes ) {
            $seen_scopes[] = $scope;
            return $window;
        }, 10, 2 );

        $_SERVER['REMOTE_ADDR'] = '198.51.100.30';
        WPSG_REST_Base::rate_limit_public( new WP_REST_Request( 'GET', '/wp-super-gallery/v1/p63b-filter' ) );

        $this->assertContains( 'public', $seen_scopes, 'REST-base window is tuned via wpsg_rest_rate_limit_window with a scope arg' );

        delete_transient( $this->public_key( '198.51.100.30', '/wp-super-gallery/v1/p63b-filter' ) );
    }
}
