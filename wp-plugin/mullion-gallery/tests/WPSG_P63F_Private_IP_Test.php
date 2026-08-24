<?php
/**
 * P63-F — is_private_ip() reserved-range completeness.
 *
 * Exercises the public wrapper WPSG_REST_Base::check_private_ip() directly (no DNS)
 * to assert the newly-covered ranges are blocked and that no regression was
 * introduced on adjacent public space.
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63F_Private_IP_Test extends WP_UnitTestCase {

    // ── Newly-covered IPv4 ranges ────────────────────────────────────────────

    /** @dataProvider newly_blocked_ipv4 */
    public function test_newly_covered_ipv4_ranges_are_private( string $ip ) {
        $this->assertTrue(
            WPSG_REST_Base::check_private_ip( $ip ),
            "$ip should be treated as private/reserved"
        );
    }

    public function newly_blocked_ipv4(): array {
        return [
            'benchmarking low'   => [ '198.18.0.1' ],
            'benchmarking high'  => [ '198.19.255.255' ],
            'multicast low'      => [ '224.0.0.1' ],
            'multicast high'     => [ '239.255.255.255' ],
            'reserved 240/4'     => [ '240.0.0.1' ],
            'limited broadcast'  => [ '255.255.255.255' ],
        ];
    }

    // ── NAT64 well-known prefix 64:ff9b::/96 ─────────────────────────────────

    public function test_nat64_wrapping_link_local_metadata_is_private() {
        // 64:ff9b::169.254.169.254 — NAT64-embedded cloud-metadata address.
        $this->assertTrue( WPSG_REST_Base::check_private_ip( '64:ff9b::a9fe:a9fe' ) );
    }

    public function test_nat64_wrapping_rfc1918_is_private() {
        // 64:ff9b::10.0.0.1  → embedded 10.0.0.1 (0a00:0001).
        $this->assertTrue( WPSG_REST_Base::check_private_ip( '64:ff9b::a00:1' ) );
    }

    public function test_nat64_wrapping_public_ipv4_is_not_private() {
        // 64:ff9b::8.8.8.8 → embedded public IPv4 must NOT be blocked (legit target).
        $this->assertFalse( WPSG_REST_Base::check_private_ip( '64:ff9b::808:808' ) );
    }

    // ── Regression: adjacent public space still resolves as public ───────────

    /** @dataProvider still_public */
    public function test_adjacent_public_ranges_not_flagged( string $ip ) {
        $this->assertFalse(
            WPSG_REST_Base::check_private_ip( $ip ),
            "$ip should remain public (no false positive from the new ranges)"
        );
    }

    public function still_public(): array {
        return [
            'below benchmarking' => [ '198.17.255.255' ],
            'above benchmarking' => [ '198.20.0.1' ],
            'below multicast'    => [ '223.255.255.255' ],
            'ordinary public'    => [ '93.184.216.34' ],
            'google dns'         => [ '8.8.8.8' ],
        ];
    }

    // ── Regression: pre-existing ranges still blocked ────────────────────────

    /** @dataProvider previously_blocked */
    public function test_existing_ranges_still_private( string $ip ) {
        $this->assertTrue( WPSG_REST_Base::check_private_ip( $ip ), "$ip should still be private" );
    }

    public function previously_blocked(): array {
        return [
            'rfc1918 10'    => [ '10.0.0.1' ],
            'rfc1918 172'   => [ '172.16.0.1' ],
            'rfc1918 192'   => [ '192.168.1.1' ],
            'loopback'      => [ '127.0.0.1' ],
            'link-local'    => [ '169.254.169.254' ],
            'ipv6 loopback' => [ '::1' ],
            'ipv6 ula'      => [ 'fc00::1' ],
        ];
    }
}
