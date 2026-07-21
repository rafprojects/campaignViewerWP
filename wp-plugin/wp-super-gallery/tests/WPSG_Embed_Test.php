<?php
/**
 * Tests for WPSG_Embed class.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Embed_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        // Reset the static manifest cache so each test starts clean.
        $ref = new ReflectionProperty( WPSG_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, null );
        unset( $GLOBALS['wpsg_has_shortcode'] );
        // P47-E emits window.__WPSG_CONFIG__ once per page, guarded by this global.
        // Reset it so each test's render_shortcode() re-emits the config script.
        unset( $GLOBALS['wpsg_config_emitted'] );
        delete_option( WPSG_Settings::OPTION_NAME );
    }

    public function tearDown(): void {
        unset( $GLOBALS['wpsg_has_shortcode'] );
        unset( $GLOBALS['wpsg_config_emitted'] );
        delete_option( WPSG_Settings::OPTION_NAME );
        // Reset manifest cache.
        $ref = new ReflectionProperty( WPSG_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, null );
        parent::tearDown();
    }

    // ------------------------------------------------------- render_shortcode()

    public function test_render_shortcode_returns_string() {
        $output = WPSG_Embed::render_shortcode();

        $this->assertIsString( $output );
        $this->assertNotEmpty( $output );
    }

    public function test_render_shortcode_contains_gallery_div() {
        $output = WPSG_Embed::render_shortcode();

        $this->assertStringContainsString( 'class="wp-super-gallery"', $output );
        $this->assertStringContainsString( 'data-wpsg-props=', $output );
    }

    public function test_render_shortcode_includes_config_script() {
        $output = WPSG_Embed::render_shortcode();

        $this->assertStringContainsString( 'window.__WPSG_CONFIG__', $output );
    }

    /**
     * P68-B: an anonymous visitor's page config must NOT carry a REST nonce —
     * a guest nonce authenticates nothing but its presence as X-WP-Nonce made
     * the service worker treat every public request as authenticated, disabling
     * the anonymous stale-while-revalidate cache. WP_UnitTestCase runs with no
     * current user by default, so this render is the logged-out case.
     */
    public function test_render_shortcode_omits_rest_nonce_for_anonymous_visitor() {
        wp_set_current_user( 0 );

        $output = WPSG_Embed::render_shortcode();

        $this->assertStringContainsString( 'window.__WPSG_CONFIG__', $output );
        $this->assertStringNotContainsString( '"restNonce"', $output );
    }

    /**
     * P68-B: a logged-in user still gets a REST nonce so their authenticated
     * requests keep working (and the SW correctly treats them as authenticated).
     */
    public function test_render_shortcode_includes_rest_nonce_for_logged_in_user() {
        $user_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
        wp_set_current_user( $user_id );

        $output = WPSG_Embed::render_shortcode();

        $this->assertStringContainsString( '"restNonce"', $output );

        wp_set_current_user( 0 );
    }

    public function test_render_shortcode_embeds_campaign_attribute() {
        $output = WPSG_Embed::render_shortcode( [ 'campaign' => 'my-campaign' ] );

        $decoded_props = null;
        if ( preg_match( '/data-wpsg-props="([^"]+)"/', $output, $m ) ) {
            $decoded_props = json_decode( html_entity_decode( $m[1] ), true );
        }

        $this->assertNotNull( $decoded_props, 'data-wpsg-props should be valid JSON' );
        $this->assertEquals( 'my-campaign', $decoded_props['campaign'] );
    }

    public function test_render_shortcode_embeds_company_attribute() {
        $output = WPSG_Embed::render_shortcode( [ 'company' => 'acme-corp' ] );

        $decoded_props = null;
        if ( preg_match( '/data-wpsg-props="([^"]+)"/', $output, $m ) ) {
            $decoded_props = json_decode( html_entity_decode( $m[1] ), true );
        }

        $this->assertNotNull( $decoded_props );
        $this->assertEquals( 'acme-corp', $decoded_props['company'] );
    }

    public function test_render_shortcode_compact_true_adds_modifier_class() {
        $output = WPSG_Embed::render_shortcode( [ 'compact' => 'true' ] );

        $this->assertStringContainsString( 'wp-super-gallery--compact', $output );
    }

    public function test_render_shortcode_compact_false_omits_modifier_class() {
        $output = WPSG_Embed::render_shortcode( [ 'compact' => 'false' ] );

        $this->assertStringNotContainsString( 'wp-super-gallery--compact', $output );
    }

    public function test_render_shortcode_sets_wpsg_has_shortcode_global() {
        $this->assertArrayNotHasKey( 'wpsg_has_shortcode', $GLOBALS );

        WPSG_Embed::render_shortcode();

        $this->assertTrue( $GLOBALS['wpsg_has_shortcode'] ?? false );
    }

    public function test_render_shortcode_reflects_theme_from_settings() {
        update_option( WPSG_Settings::OPTION_NAME, [ 'theme' => 'nord' ] );

        $output = WPSG_Embed::render_shortcode();

        // P47-E: theme is emitted per-node in the (HTML-encoded) data-wpsg-config.
        $decoded_config = null;
        if ( preg_match( '/data-wpsg-config="([^"]+)"/', $output, $m ) ) {
            $decoded_config = json_decode( html_entity_decode( $m[1] ), true );
        }
        $this->assertNotNull( $decoded_config, 'data-wpsg-config should be valid JSON' );
        $this->assertEquals( 'nord', $decoded_config['theme'] );
    }

    public function test_render_shortcode_reflects_debug_component_markers_setting() {
        update_option( WPSG_Settings::OPTION_NAME, [ 'debug_component_markers' => false ] );

        $output = WPSG_Embed::render_shortcode();

        $this->assertStringContainsString( '"debugComponentMarkers":false', $output );
    }

    public function test_render_shortcode_full_bleed_desktop_emits_style() {
        update_option( WPSG_Settings::OPTION_NAME, [
            'wp_full_bleed_desktop' => true,
            'wp_full_bleed_tablet'  => false,
            'wp_full_bleed_mobile'  => false,
        ] );

        $output = WPSG_Embed::render_shortcode();

        $this->assertStringContainsString( 'wpsg-full-bleed', $output );
        $this->assertStringContainsString( '<style>', $output );
    }

    public function test_render_shortcode_full_bleed_css_is_space_scoped() {
        update_option( WPSG_Settings::OPTION_NAME, [
            'wp_full_bleed_desktop' => true,
            'wp_full_bleed_tablet'  => false,
            'wp_full_bleed_mobile'  => false,
        ] );

        $output = WPSG_Embed::render_shortcode();

        // Wrapper div must carry a data-space attribute.
        $this->assertMatchesRegularExpression( '/wpsg-full-bleed[^"]*"\s+data-space="[^"]+"/', $output );
        // Emitted CSS selector must be scoped — not the bare class alone.
        $this->assertStringContainsString( '.wpsg-full-bleed[data-space=', $output );
        // The bare unscoped selector must NOT appear.
        $this->assertStringNotContainsString( '{.wpsg-full-bleed{', $output );
    }

    public function test_render_shortcode_no_bleed_when_all_disabled() {
        update_option( WPSG_Settings::OPTION_NAME, [
            'wp_full_bleed_desktop' => false,
            'wp_full_bleed_tablet'  => false,
            'wp_full_bleed_mobile'  => false,
        ] );

        $output = WPSG_Embed::render_shortcode();

        $this->assertStringNotContainsString( 'wpsg-full-bleed', $output );
    }

    // --------------------------------------------------------- add_module_type()

    public function test_add_module_type_modifies_app_handle() {
        $tag    = '<script src="test.js"></script>';
        $result = WPSG_Embed::add_module_type( $tag, 'wp-super-gallery-app', 'test.js' );

        $this->assertStringContainsString( 'type="module"', $result );
    }

    public function test_add_module_type_does_not_modify_other_handles() {
        $tag    = '<script src="other.js"></script>';
        $result = WPSG_Embed::add_module_type( $tag, 'some-other-script', 'other.js' );

        $this->assertEquals( $tag, $result );
        $this->assertStringNotContainsString( 'type="module"', $result );
    }

    public function test_register_assets_uses_versionless_manifest_entry_script() {
        wp_deregister_script( 'wp-super-gallery-app' );

        // Inject a fake manifest so the manifest-entry (versionless) path is exercised.
        // Without this the code falls back to wp_register_script(..., WPSG_VERSION, ...).
        $ref = new ReflectionProperty( WPSG_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, [
            'index.html' => [ 'file' => 'assets/index-abc123.js' ],
        ] );

        WPSG_Embed::register_assets();

        $registered = wp_scripts()->registered['wp-super-gallery-app'] ?? null;

        $this->assertNotNull( $registered );
        $this->assertNull( $registered->ver );
    }
}
