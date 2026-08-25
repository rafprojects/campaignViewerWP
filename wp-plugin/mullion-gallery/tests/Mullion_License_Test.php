<?php
/**
 * Tests for Mullion_License — entitlement seam (P62-A).
 *
 * In the test environment mullion_fs() returns null (no Freemius credentials), so
 * every check falls back to its filter. These tests exercise the stub/filter
 * paths; the real-SDK path is validated only against a Freemius sandbox (M1-M3,
 * blocked pre-account).
 *
 * @package Mullion
 */

class Mullion_License_Test extends WP_UnitTestCase {

    public function tearDown(): void {
        remove_filter( 'mullion_license_is_pro', '__return_true' );
        remove_all_filters( 'mullion_license_feature_enabled' );
        remove_all_filters( 'mullion_license_tier' );
        remove_all_filters( 'mullion_license_upgrade_url' );
        remove_all_filters( 'mullion_freemius_config' );
        parent::tearDown();
    }

    public function test_class_exists() {
        $this->assertTrue( class_exists( 'Mullion_License' ) );
    }

    public function test_is_sdk_active_false_without_credentials() {
        // mullion_fs() returns null in the test env (empty mullion_freemius_config).
        $this->assertFalse( Mullion_License::is_sdk_active() );
    }

    public function test_can_use_premium_code_defaults_false() {
        $this->assertFalse( Mullion_License::can_use_premium_code() );
    }

    public function test_can_use_premium_code_true_with_filter() {
        add_filter( 'mullion_license_is_pro', '__return_true' );
        $this->assertTrue( Mullion_License::can_use_premium_code() );
    }

    public function test_can_use_feature_follows_premium_by_default() {
        $this->assertFalse( Mullion_License::can_use_feature( Mullion_License::FEATURE_LAYOUT_TEXT_LAYERS ) );

        add_filter( 'mullion_license_is_pro', '__return_true' );
        $this->assertTrue( Mullion_License::can_use_feature( Mullion_License::FEATURE_LAYOUT_TEXT_LAYERS ) );
        $this->assertTrue( Mullion_License::can_use_feature( Mullion_License::FEATURE_LAYOUT_BREAKPOINT_OVERRIDES ) );
        $this->assertTrue( Mullion_License::can_use_feature( Mullion_License::FEATURE_LAYOUT_STARTER_LIBRARY ) );
    }

    public function test_can_use_feature_per_feature_override() {
        // Globally free, but enable ONLY the starter library.
        add_filter( 'mullion_license_feature_enabled', function ( $enabled, $feature ) {
            return Mullion_License::FEATURE_LAYOUT_STARTER_LIBRARY === $feature ? true : $enabled;
        }, 10, 2 );

        $this->assertTrue( Mullion_License::can_use_feature( Mullion_License::FEATURE_LAYOUT_STARTER_LIBRARY ) );
        $this->assertFalse( Mullion_License::can_use_feature( Mullion_License::FEATURE_LAYOUT_TEXT_LAYERS ) );
    }

    public function test_feature_constants_are_distinct() {
        $constants = [
            Mullion_License::FEATURE_LAYOUT_TEXT_LAYERS,
            Mullion_License::FEATURE_LAYOUT_BREAKPOINT_OVERRIDES,
            Mullion_License::FEATURE_LAYOUT_STARTER_LIBRARY,
        ];
        $this->assertCount( 3, array_unique( $constants ) );
    }

    public function test_get_tier_defaults_null() {
        $this->assertNull( Mullion_License::get_tier() );
    }

    public function test_get_tier_from_filter() {
        add_filter( 'mullion_license_tier', function () {
            return 'agency';
        } );
        $this->assertSame( 'agency', Mullion_License::get_tier() );
    }

    public function test_get_tier_ignores_empty_filter_value() {
        add_filter( 'mullion_license_tier', function () {
            return '';
        } );
        $this->assertNull( Mullion_License::get_tier() );
    }

    public function test_get_upgrade_url_default_and_filter() {
        // Stub path (no SDK in the test env): default is the placeholder pricing URL.
        // When the SDK is live, get_upgrade_url() prefers mullion_fs()->get_upgrade_url()
        // (P62-K) — validated against a Freemius sandbox, not here.
        $this->assertSame( 'https://your-site.tld/pricing', Mullion_License::get_upgrade_url() );

        add_filter( 'mullion_license_upgrade_url', function () {
            return 'https://example.test/buy';
        } );
        $this->assertSame( 'https://example.test/buy', Mullion_License::get_upgrade_url() );
    }

    public function test_get_config_defaults_empty_credentials() {
        $config = Mullion_License::get_config();
        $this->assertIsArray( $config );
        $this->assertSame( '', $config['id'] );
        $this->assertSame( '', $config['public_key'] );
        $this->assertFalse( $config['is_premium'] );
    }

    public function test_get_config_from_filter() {
        add_filter( 'mullion_freemius_config', function () {
            return [ 'id' => '12345', 'public_key' => 'pk_test', 'is_premium' => true ];
        } );
        $config = Mullion_License::get_config();
        $this->assertSame( '12345', $config['id'] );
        $this->assertSame( 'pk_test', $config['public_key'] );
        $this->assertTrue( $config['is_premium'] );
    }
}
