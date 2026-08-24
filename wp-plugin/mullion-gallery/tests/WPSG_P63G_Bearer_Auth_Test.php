<?php
/**
 * P63-G — Bearer-auth branch hardening (defense-in-depth).
 *
 * verify_admin_auth() previously honored the mere PRESENCE of an
 * `Authorization: Bearer …` header, skipping the nonce check. The extracted
 * predicate bearer_auth_is_verified() now requires BOTH a real logged-in user AND
 * an explicit `wpsg_bearer_auth_verified` filter assertion (default false).
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63G_Bearer_Auth_Test extends WP_UnitTestCase {

    public function tearDown(): void {
        wp_set_current_user( 0 );
        remove_all_filters( 'wpsg_bearer_auth_verified' );
        parent::tearDown();
    }

    public function test_bare_bearer_header_not_honored_by_default() {
        // No authenticated user + no integration filter → the pre-P63-G bug case.
        $this->assertFalse( WPSG_REST_Base::bearer_auth_is_verified( 'Bearer garbage' ) );
    }

    public function test_non_bearer_or_empty_header_not_honored() {
        $this->assertFalse( WPSG_REST_Base::bearer_auth_is_verified( 'Basic abc' ) );
        $this->assertFalse( WPSG_REST_Base::bearer_auth_is_verified( '' ) );
    }

    public function test_logged_in_user_alone_is_insufficient() {
        wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
        // Filter still defaults to false → not honored.
        $this->assertFalse( WPSG_REST_Base::bearer_auth_is_verified( 'Bearer token' ) );
    }

    public function test_filter_alone_without_user_is_insufficient() {
        add_filter( 'wpsg_bearer_auth_verified', '__return_true' );
        // No logged-in user → not honored even with the filter asserting true.
        $this->assertFalse( WPSG_REST_Base::bearer_auth_is_verified( 'Bearer token' ) );
    }

    public function test_honored_only_when_user_and_integration_confirm() {
        wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
        add_filter( 'wpsg_bearer_auth_verified', '__return_true' );
        $this->assertTrue( WPSG_REST_Base::bearer_auth_is_verified( 'Bearer valid-token' ) );
    }

    public function test_filter_receives_the_header_value() {
        wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
        $seen = null;
        add_filter( 'wpsg_bearer_auth_verified', function ( $verified, $header ) use ( &$seen ) {
            $seen = $header;
            return true;
        }, 10, 2 );

        WPSG_REST_Base::bearer_auth_is_verified( 'Bearer abc123' );
        $this->assertSame( 'Bearer abc123', $seen );
    }
}
