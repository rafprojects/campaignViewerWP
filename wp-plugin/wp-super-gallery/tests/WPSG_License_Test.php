<?php
/**
 * Tests for WPSG_License — entitlement seam (P62-A).
 *
 * In the test environment wpsg_fs() returns null (no Freemius credentials), so
 * every check falls back to its filter. These tests exercise the stub/filter
 * paths; the real-SDK path is validated only against a Freemius sandbox (M1-M3,
 * blocked pre-account).
 *
 * @package WP_Super_Gallery
 */

class WPSG_License_Test extends WP_UnitTestCase {

    public function tearDown(): void {
        remove_filter( 'wpsg_license_is_pro', '__return_true' );
        remove_all_filters( 'wpsg_license_feature_enabled' );
        remove_all_filters( 'wpsg_license_tier' );
        remove_all_filters( 'wpsg_license_upgrade_url' );
        remove_all_filters( 'wpsg_freemius_config' );
        parent::tearDown();
    }

    public function test_class_exists() {
        $this->assertTrue( class_exists( 'WPSG_License' ) );
    }

    public function test_is_sdk_active_false_without_credentials() {
        // wpsg_fs() returns null in the test env (empty wpsg_freemius_config).
        $this->assertFalse( WPSG_License::is_sdk_active() );
    }

    public function test_can_use_premium_code_defaults_false() {
        $this->assertFalse( WPSG_License::can_use_premium_code() );
    }

    public function test_can_use_premium_code_true_with_filter() {
        add_filter( 'wpsg_license_is_pro', '__return_true' );
        $this->assertTrue( WPSG_License::can_use_premium_code() );
    }

    public function test_can_use_feature_follows_premium_by_default() {
        $this->assertFalse( WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_TEXT_LAYERS ) );

        add_filter( 'wpsg_license_is_pro', '__return_true' );
        $this->assertTrue( WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_TEXT_LAYERS ) );
        $this->assertTrue( WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_BREAKPOINT_OVERRIDES ) );
        $this->assertTrue( WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_STARTER_LIBRARY ) );
    }

    public function test_can_use_feature_per_feature_override() {
        // Globally free, but enable ONLY the starter library.
        add_filter( 'wpsg_license_feature_enabled', function ( $enabled, $feature ) {
            return WPSG_License::FEATURE_LAYOUT_STARTER_LIBRARY === $feature ? true : $enabled;
        }, 10, 2 );

        $this->assertTrue( WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_STARTER_LIBRARY ) );
        $this->assertFalse( WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_TEXT_LAYERS ) );
    }

    public function test_feature_constants_are_distinct() {
        $constants = [
            WPSG_License::FEATURE_LAYOUT_TEXT_LAYERS,
            WPSG_License::FEATURE_LAYOUT_BREAKPOINT_OVERRIDES,
            WPSG_License::FEATURE_LAYOUT_STARTER_LIBRARY,
        ];
        $this->assertCount( 3, array_unique( $constants ) );
    }

    public function test_get_tier_defaults_null() {
        $this->assertNull( WPSG_License::get_tier() );
    }

    public function test_get_tier_from_filter() {
        add_filter( 'wpsg_license_tier', function () {
            return 'agency';
        } );
        $this->assertSame( 'agency', WPSG_License::get_tier() );
    }

    public function test_get_tier_ignores_empty_filter_value() {
        add_filter( 'wpsg_license_tier', function () {
            return '';
        } );
        $this->assertNull( WPSG_License::get_tier() );
    }

    public function test_get_upgrade_url_default_and_filter() {
        $this->assertNotEmpty( WPSG_License::get_upgrade_url() );

        add_filter( 'wpsg_license_upgrade_url', function () {
            return 'https://example.test/buy';
        } );
        $this->assertSame( 'https://example.test/buy', WPSG_License::get_upgrade_url() );
    }

    public function test_get_config_defaults_empty_credentials() {
        $config = WPSG_License::get_config();
        $this->assertIsArray( $config );
        $this->assertSame( '', $config['id'] );
        $this->assertSame( '', $config['public_key'] );
        $this->assertFalse( $config['is_premium'] );
    }

    public function test_get_config_from_filter() {
        add_filter( 'wpsg_freemius_config', function () {
            return [ 'id' => '12345', 'public_key' => 'pk_test', 'is_premium' => true ];
        } );
        $config = WPSG_License::get_config();
        $this->assertSame( '12345', $config['id'] );
        $this->assertSame( 'pk_test', $config['public_key'] );
        $this->assertTrue( $config['is_premium'] );
    }
}
