<?php
/**
 * Tests for WPSG_Rate_Limiter class.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Rate_Limiter_Test extends WP_UnitTestCase {

    private string $test_ip   = '10.0.0.1';
    private string $endpoint  = 'test_ep';

    /** Derive the transient key the way the class does. */
    private function transient_key( string $ip, string $endpoint ): string {
        return WPSG_Rate_Limiter::TRANSIENT_PREFIX . $endpoint . '_' . md5( $ip );
    }

    public function tearDown(): void {
        delete_transient( $this->transient_key( $this->test_ip, $this->endpoint ) );
        delete_transient( $this->transient_key( '10.0.0.2', $this->endpoint ) );
        // Restore $_SERVER superglobal state modified by IP tests.
        unset( $_SERVER['HTTP_X_FORWARDED_FOR'], $_SERVER['HTTP_X_REAL_IP'] );
        remove_all_filters( 'wpsg_rate_limit_max' );
        remove_all_filters( 'wpsg_rate_limit_window' );
        remove_all_filters( 'wpsg_rate_limiter_trusted_proxies' );
        parent::tearDown();
    }

    // ------------------------------------------------------------------ check()

    public function test_check_allows_first_request() {
        $result = WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint );

        $this->assertTrue( $result['allowed'] );
        $this->assertEquals( WPSG_Rate_Limiter::DEFAULT_LIMIT - 1, $result['remaining'] );
        $this->assertArrayNotHasKey( 'retry_after', $result );
    }

    public function test_check_remaining_decrements_on_subsequent_calls() {
        WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint ); // 1st
        $result = WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint ); // 2nd

        $this->assertTrue( $result['allowed'] );
        $this->assertEquals( WPSG_Rate_Limiter::DEFAULT_LIMIT - 2, $result['remaining'] );
    }

    public function test_check_blocks_when_limit_exceeded() {
        $limit = 3;
        add_filter( 'wpsg_rate_limit_max', fn() => $limit );

        // Exhaust the allowance.
        for ( $i = 0; $i < $limit; $i++ ) {
            WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint );
        }

        // Next call should be blocked.
        $result = WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint );

        $this->assertFalse( $result['allowed'] );
        $this->assertEquals( 0, $result['remaining'] );
        $this->assertArrayHasKey( 'retry_after', $result );
        $this->assertGreaterThan( 0, $result['retry_after'] );
    }

    public function test_check_resets_after_window_expiry() {
        // Seed a bucket that looks like it started long ago (elapsed > window).
        $key = $this->transient_key( $this->test_ip, $this->endpoint );
        set_transient( $key, [ 'count' => 99, 'started' => time() - 999 ], 60 );

        $result = WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint );

        // Should have reset: count should be 1, remaining = limit - 1.
        $this->assertTrue( $result['allowed'] );
        $this->assertEquals( WPSG_Rate_Limiter::DEFAULT_LIMIT - 1, $result['remaining'] );
    }

    public function test_check_isolates_different_ips() {
        $limit = 2;
        add_filter( 'wpsg_rate_limit_max', fn() => $limit );

        // Exhaust IP A.
        for ( $i = 0; $i <= $limit; $i++ ) {
            WPSG_Rate_Limiter::check( $this->test_ip, $this->endpoint );
        }

        // IP B should still be allowed.
        $result_b = WPSG_Rate_Limiter::check( '10.0.0.2', $this->endpoint );
        $this->assertTrue( $result_b['allowed'] );
    }

    public function test_check_isolates_different_endpoints() {
        $limit = 1;
        add_filter( 'wpsg_rate_limit_max', fn() => $limit );

        // Exhaust endpoint A.
        WPSG_Rate_Limiter::check( $this->test_ip, 'endpoint_a' );
        $blocked = WPSG_Rate_Limiter::check( $this->test_ip, 'endpoint_a' );
        $this->assertFalse( $blocked['allowed'] );

        // Endpoint B should still be fine.
        $result_b = WPSG_Rate_Limiter::check( $this->test_ip, 'endpoint_b' );
        $this->assertTrue( $result_b['allowed'] );

        // Clean up extras.
        delete_transient( $this->transient_key( $this->test_ip, 'endpoint_a' ) );
        delete_transient( $this->transient_key( $this->test_ip, 'endpoint_b' ) );
    }

    // ---------------------------------------------------------- get_client_ip()

    public function test_get_client_ip_returns_remote_addr() {
        $_SERVER['REMOTE_ADDR'] = '203.0.113.5';

        $ip = WPSG_Rate_Limiter::get_client_ip();

        $this->assertEquals( '203.0.113.5', $ip );
    }

    public function test_get_client_ip_ignores_forwarded_header_for_untrusted_proxy() {
        $_SERVER['REMOTE_ADDR']          = '203.0.113.5';
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '1.2.3.4';
        // No trusted proxies registered — forwarded header must be ignored.

        $ip = WPSG_Rate_Limiter::get_client_ip();

        $this->assertEquals( '203.0.113.5', $ip );
    }

    public function test_get_client_ip_uses_x_forwarded_for_when_proxy_trusted() {
        $proxy_ip = '10.10.0.1';
        $_SERVER['REMOTE_ADDR']          = $proxy_ip;
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.7';

        add_filter( 'wpsg_rate_limiter_trusted_proxies', fn() => [ $proxy_ip ] );

        $ip = WPSG_Rate_Limiter::get_client_ip();

        $this->assertEquals( '198.51.100.7', $ip );
    }

    public function test_get_client_ip_takes_first_from_comma_list() {
        $proxy_ip = '10.10.0.1';
        $_SERVER['REMOTE_ADDR']          = $proxy_ip;
        $_SERVER['HTTP_X_FORWARDED_FOR'] = '198.51.100.7, 172.16.0.1, 10.0.0.1';

        add_filter( 'wpsg_rate_limiter_trusted_proxies', fn() => [ $proxy_ip ] );

        $ip = WPSG_Rate_Limiter::get_client_ip();

        $this->assertEquals( '198.51.100.7', $ip );
    }

    public function test_get_client_ip_falls_back_to_x_real_ip() {
        $proxy_ip = '10.10.0.2';
        $_SERVER['REMOTE_ADDR']   = $proxy_ip;
        $_SERVER['HTTP_X_REAL_IP'] = '203.0.113.99';
        // No X-Forwarded-For set.

        add_filter( 'wpsg_rate_limiter_trusted_proxies', fn() => [ $proxy_ip ] );

        $ip = WPSG_Rate_Limiter::get_client_ip();

        $this->assertEquals( '203.0.113.99', $ip );
    }

    public function test_get_client_ip_returns_fallback_for_invalid_remote_addr() {
        $_SERVER['REMOTE_ADDR'] = 'not-an-ip';

        $ip = WPSG_Rate_Limiter::get_client_ip();

        $this->assertEquals( '0.0.0.0', $ip );
    }
}
