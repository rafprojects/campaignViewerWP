<?php
/**
 * Tests for Mullion_Embed class.
 *
 * @package Mullion
 */

class Mullion_Embed_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        // Reset the static manifest cache so each test starts clean.
        $ref = new ReflectionProperty( Mullion_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, null );
        unset( $GLOBALS['mullion_has_shortcode'] );
        // P47-E emits window.__MULLION_CONFIG__ once per page, guarded by this global.
        // Reset it so each test's render_shortcode() re-emits the config script.
        unset( $GLOBALS['mullion_config_emitted'] );
        delete_option( Mullion_Settings::OPTION_NAME );
    }

    public function tearDown(): void {
        unset( $GLOBALS['mullion_has_shortcode'] );
        unset( $GLOBALS['mullion_config_emitted'] );
        delete_option( Mullion_Settings::OPTION_NAME );
        // Reset manifest cache.
        $ref = new ReflectionProperty( Mullion_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, null );
        parent::tearDown();
    }

    // ------------------------------------------------------- render_shortcode()

    public function test_render_shortcode_returns_string() {
        $output = Mullion_Embed::render_shortcode();

        $this->assertIsString( $output );
        $this->assertNotEmpty( $output );
    }

    public function test_render_shortcode_contains_gallery_div() {
        $output = Mullion_Embed::render_shortcode();

        $this->assertStringContainsString( 'class="mullion-gallery"', $output );
        $this->assertStringContainsString( 'data-mullion-props=', $output );
    }

    public function test_render_shortcode_includes_config_script() {
        $output = Mullion_Embed::render_shortcode();

        $this->assertStringContainsString( 'window.__MULLION_CONFIG__', $output );
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

        $output = Mullion_Embed::render_shortcode();

        $this->assertStringContainsString( 'window.__MULLION_CONFIG__', $output );
        $this->assertStringNotContainsString( '"restNonce"', $output );
    }

    /**
     * P68-B: a logged-in user still gets a REST nonce so their authenticated
     * requests keep working (and the SW correctly treats them as authenticated).
     */
    public function test_render_shortcode_includes_rest_nonce_for_logged_in_user() {
        $user_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
        wp_set_current_user( $user_id );

        $output = Mullion_Embed::render_shortcode();

        $this->assertStringContainsString( '"restNonce"', $output );

        wp_set_current_user( 0 );
    }

    public function test_render_shortcode_embeds_campaign_attribute() {
        $output = Mullion_Embed::render_shortcode( [ 'campaign' => 'my-campaign' ] );

        $decoded_props = null;
        if ( preg_match( '/data-mullion-props="([^"]+)"/', $output, $m ) ) {
            $decoded_props = json_decode( html_entity_decode( $m[1] ), true );
        }

        $this->assertNotNull( $decoded_props, 'data-mullion-props should be valid JSON' );
        $this->assertEquals( 'my-campaign', $decoded_props['campaign'] );
    }

    public function test_render_shortcode_embeds_company_attribute() {
        $output = Mullion_Embed::render_shortcode( [ 'company' => 'acme-corp' ] );

        $decoded_props = null;
        if ( preg_match( '/data-mullion-props="([^"]+)"/', $output, $m ) ) {
            $decoded_props = json_decode( html_entity_decode( $m[1] ), true );
        }

        $this->assertNotNull( $decoded_props );
        $this->assertEquals( 'acme-corp', $decoded_props['company'] );
    }

    public function test_render_shortcode_compact_true_adds_modifier_class() {
        $output = Mullion_Embed::render_shortcode( [ 'compact' => 'true' ] );

        $this->assertStringContainsString( 'mullion-gallery--compact', $output );
    }

    public function test_render_shortcode_compact_false_omits_modifier_class() {
        $output = Mullion_Embed::render_shortcode( [ 'compact' => 'false' ] );

        $this->assertStringNotContainsString( 'mullion-gallery--compact', $output );
    }

    public function test_render_shortcode_sets_mullion_has_shortcode_global() {
        $this->assertArrayNotHasKey( 'mullion_has_shortcode', $GLOBALS );

        Mullion_Embed::render_shortcode();

        $this->assertTrue( $GLOBALS['mullion_has_shortcode'] ?? false );
    }

    public function test_render_shortcode_reflects_theme_from_settings() {
        update_option( Mullion_Settings::OPTION_NAME, [ 'theme' => 'nord' ] );

        $output = Mullion_Embed::render_shortcode();

        // P47-E: theme is emitted per-node in the (HTML-encoded) data-mullion-config.
        $decoded_config = null;
        if ( preg_match( '/data-mullion-config="([^"]+)"/', $output, $m ) ) {
            $decoded_config = json_decode( html_entity_decode( $m[1] ), true );
        }
        $this->assertNotNull( $decoded_config, 'data-mullion-config should be valid JSON' );
        $this->assertEquals( 'nord', $decoded_config['theme'] );
    }

    public function test_render_shortcode_reflects_debug_component_markers_setting() {
        update_option( Mullion_Settings::OPTION_NAME, [ 'debug_component_markers' => false ] );

        $output = Mullion_Embed::render_shortcode();

        $this->assertStringContainsString( '"debugComponentMarkers":false', $output );
    }

    public function test_render_shortcode_full_bleed_desktop_emits_style() {
        update_option( Mullion_Settings::OPTION_NAME, [
            'wp_full_bleed_desktop' => true,
            'wp_full_bleed_tablet'  => false,
            'wp_full_bleed_mobile'  => false,
        ] );

        $output = Mullion_Embed::render_shortcode();

        $this->assertStringContainsString( 'mullion-full-bleed', $output );
        $this->assertStringContainsString( '<style>', $output );
    }

    public function test_render_shortcode_full_bleed_css_is_space_scoped() {
        update_option( Mullion_Settings::OPTION_NAME, [
            'wp_full_bleed_desktop' => true,
            'wp_full_bleed_tablet'  => false,
            'wp_full_bleed_mobile'  => false,
        ] );

        $output = Mullion_Embed::render_shortcode();

        // Wrapper div must carry a data-space attribute.
        $this->assertMatchesRegularExpression( '/mullion-full-bleed[^"]*"\s+data-space="[^"]+"/', $output );
        // Emitted CSS selector must be scoped — not the bare class alone.
        $this->assertStringContainsString( '.mullion-full-bleed[data-space=', $output );
        // The bare unscoped selector must NOT appear.
        $this->assertStringNotContainsString( '{.mullion-full-bleed{', $output );
    }

    public function test_render_shortcode_no_bleed_when_all_disabled() {
        update_option( Mullion_Settings::OPTION_NAME, [
            'wp_full_bleed_desktop' => false,
            'wp_full_bleed_tablet'  => false,
            'wp_full_bleed_mobile'  => false,
        ] );

        $output = Mullion_Embed::render_shortcode();

        $this->assertStringNotContainsString( 'mullion-full-bleed', $output );
    }

    // ------------------------------------- P72-D: unresolved-space admin notice

    /** System admin: administrator + manage_mullion. */
    private function set_manage_mullion_admin(): int {
        $uid  = self::factory()->user->create( [ 'role' => 'administrator' ] );
        $user = get_user_by( 'id', $uid );
        $user->add_cap( 'manage_mullion' );
        wp_set_current_user( $uid );
        return $uid;
    }

    public function test_unresolved_explicit_space_shows_admin_notice() {
        $this->set_manage_mullion_admin();

        // An explicit space= that does not resolve to any space.
        $output = Mullion_Embed::render_shortcode( [ 'space' => 'deleted-space-xyz' ] );

        $this->assertStringContainsString( 'mullion-shortcode-notice', $output, 'admin should see the fallback notice' );
        // The stale reference is named in the notice.
        $this->assertStringContainsString( 'deleted-space-xyz', $output );
        // The gallery still renders normally alongside the notice.
        $this->assertStringContainsString( 'class="mullion-gallery"', $output );

        wp_set_current_user( 0 );
    }

    public function test_unresolved_explicit_space_hidden_from_visitor() {
        wp_set_current_user( 0 ); // anonymous visitor, no manage_mullion

        $output = Mullion_Embed::render_shortcode( [ 'space' => 'deleted-space-xyz' ] );

        $this->assertStringNotContainsString( 'mullion-shortcode-notice', $output, 'visitors must never see the notice' );
        // The gallery still renders normally (falls back to the default space).
        $this->assertStringContainsString( 'class="mullion-gallery"', $output );
    }

    public function test_omitted_space_reference_shows_no_notice_even_for_admin() {
        $this->set_manage_mullion_admin();

        // No explicit space/campaign/company: the default is intentional, not an error.
        $output = Mullion_Embed::render_shortcode();

        $this->assertStringNotContainsString( 'mullion-shortcode-notice', $output, 'the intentional-default case must not warn' );

        wp_set_current_user( 0 );
    }

    public function test_resolved_explicit_space_shows_no_notice() {
        $this->set_manage_mullion_admin();

        $space_id = Mullion_DB::insert_space( [
            'name'           => 'P72D Real Space',
            'slug'           => 'p72d-real-' . wp_generate_password( 6, false ),
            'isolation_mode' => 'open',
        ] );
        $space = Mullion_DB::get_space( $space_id );

        // An explicit space= that DOES resolve must not trigger the notice.
        $output = Mullion_Embed::render_shortcode( [ 'space' => $space->slug ] );

        $this->assertStringNotContainsString( 'mullion-shortcode-notice', $output, 'a valid reference must not warn' );

        wp_set_current_user( 0 );
    }

    // P72-D review follow-up: "the named entity exists but carries no space" is
    // NOT a stale reference — a campaign/company with no `_mullion_space_id` legitimately
    // inherits the default space (the common case on a single-space install).
    // Only a reference naming something that does not exist is worth a notice.

    public function test_campaign_without_space_meta_shows_no_notice() {
        $this->set_manage_mullion_admin();

        $post_id = self::factory()->post->create( [
            'post_type'  => 'mullion_campaign',
            'post_name'  => 'p72d-inherits-default',
            'post_status' => 'publish',
        ] );
        $this->assertNotEmpty( get_post( $post_id ) );
        // Deliberately no _mullion_space_id meta — inherits the default space.

        $output = Mullion_Embed::render_shortcode( [ 'campaign' => 'p72d-inherits-default' ] );

        $this->assertStringNotContainsString(
            'mullion-shortcode-notice',
            $output,
            'a campaign that exists but has no space assignment must not be reported as stale'
        );

        wp_set_current_user( 0 );
    }

    public function test_company_without_space_meta_shows_no_notice() {
        $this->set_manage_mullion_admin();

        $term = wp_insert_term( 'P72D Co', 'mullion_company', [ 'slug' => 'p72d-co' ] );
        $this->assertNotWPError( $term );
        // Deliberately no _mullion_space_id term meta.

        $output = Mullion_Embed::render_shortcode( [ 'company' => 'p72d-co' ] );

        $this->assertStringNotContainsString(
            'mullion-shortcode-notice',
            $output,
            'a company that exists but has no space assignment must not be reported as stale'
        );

        wp_set_current_user( 0 );
    }

    public function test_nonexistent_campaign_reference_shows_notice() {
        $this->set_manage_mullion_admin();

        $output = Mullion_Embed::render_shortcode( [ 'campaign' => 'no-such-campaign-xyz' ] );

        $this->assertStringContainsString( 'mullion-shortcode-notice', $output );
        $this->assertStringContainsString( 'no-such-campaign-xyz', $output );

        wp_set_current_user( 0 );
    }

    public function test_notice_names_only_the_reference_that_failed() {
        $this->set_manage_mullion_admin();

        $post_id = self::factory()->post->create( [
            'post_type'   => 'mullion_campaign',
            'post_name'   => 'p72d-real-campaign',
            'post_status' => 'publish',
        ] );
        $this->assertNotEmpty( get_post( $post_id ) );

        // space= is stale; campaign= resolves (it just inherits the default space).
        $output = Mullion_Embed::render_shortcode( [
            'space'    => 'deleted-space-xyz',
            'campaign' => 'p72d-real-campaign',
        ] );

        // Scope the assertion to the notice itself — the mount node's
        // data-mullion-props legitimately echoes every attribute back.
        $this->assertSame( 1, preg_match( '/<div class="mullion-shortcode-notice".*?<\/div>/s', $output, $m ) );
        $notice = $m[0];

        $this->assertStringContainsString( 'deleted-space-xyz', $notice, 'the stale ref is named' );
        $this->assertStringNotContainsString(
            'p72d-real-campaign',
            $notice,
            'a reference that resolved must not be named in the notice'
        );

        wp_set_current_user( 0 );
    }

    // --------------------------------------------------------- add_module_type()

    public function test_add_module_type_modifies_app_handle() {
        $tag    = '<script src="test.js"></script>';
        $result = Mullion_Embed::add_module_type( $tag, 'mullion-gallery-app', 'test.js' );

        $this->assertStringContainsString( 'type="module"', $result );
    }

    public function test_add_module_type_does_not_modify_other_handles() {
        $tag    = '<script src="other.js"></script>';
        $result = Mullion_Embed::add_module_type( $tag, 'some-other-script', 'other.js' );

        $this->assertEquals( $tag, $result );
        $this->assertStringNotContainsString( 'type="module"', $result );
    }

    public function test_register_assets_uses_versionless_manifest_entry_script() {
        wp_deregister_script( 'mullion-gallery-app' );

        // Inject a fake manifest so the manifest-entry (versionless) path is exercised.
        // Without this the code falls back to wp_register_script(..., MULLION_VERSION, ...).
        $ref = new ReflectionProperty( Mullion_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, [
            'index.html' => [ 'file' => 'assets/index-abc123.js' ],
        ] );

        Mullion_Embed::register_assets();

        $registered = wp_scripts()->registered['mullion-gallery-app'] ?? null;

        $this->assertNotNull( $registered );
        $this->assertNull( $registered->ver );
    }

    // ------------------------------------------------- chunk CSS (P77-G)

    /** A manifest shaped like the real build: vendor CSS hangs off imported chunks. */
    private function chunked_manifest() {
        return [
            'index.html' => [
                'file'    => 'assets/index-abc123.js',
                'isEntry' => true,
                'css'     => [ 'assets/index-abc123.css' ],
                'imports' => [ '_vendor-query.js', '_vendor-mantine-core.js', '_vendor-dockview.js' ],
            ],
            '_vendor-query.js'        => [ 'file' => 'assets/vendor-query.js' ],
            '_vendor-mantine-core.js' => [
                'file'    => 'assets/vendor-mantine-core.js',
                'css'     => [ 'assets/vendor-mantine-core.css' ],
                'imports' => [ '_vendor-mantine-helpers.js', '_vendor-query.js' ],
            ],
            '_vendor-mantine-helpers.js' => [ 'file' => 'assets/vendor-mantine-helpers.js' ],
            '_vendor-dockview.js'     => [
                'file'    => 'assets/vendor-dockview.js',
                'css'     => [ 'assets/vendor-dockview.css' ],
                // Cycle on purpose: chunk graphs can have them and the walk must terminate.
                'imports' => [ '_vendor-mantine-core.js', '_vendor-dockview.js' ],
            ],
            // A dynamic-only chunk: its CSS is Vite's preload helper's job, not ours.
            '_AdminPanel.js'          => [ 'file' => 'assets/AdminPanel.js', 'css' => [ 'assets/AdminPanel.css' ], 'isDynamicEntry' => true ],
        ];
    }

    public function test_get_entry_css_files_walks_static_imports_in_vite_order() {
        $files = Mullion_Embed::get_entry_css_files( $this->chunked_manifest() );

        // Imported chunks' CSS first (depth first, each chunk once), entry CSS last.
        $this->assertSame(
            [ 'assets/vendor-mantine-core.css', 'assets/vendor-dockview.css', 'assets/index-abc123.css' ],
            $files
        );
        $this->assertNotContains( 'assets/AdminPanel.css', $files );
    }

    public function test_get_entry_css_files_handles_missing_or_bare_manifest() {
        $this->assertSame( [], Mullion_Embed::get_entry_css_files( [] ) );
        $this->assertSame( [], Mullion_Embed::get_entry_css_files( null ) );
        $this->assertSame(
            [ 'assets/only.css' ],
            Mullion_Embed::get_entry_css_files( [ 'index.html' => [ 'file' => 'a.js', 'css' => [ 'assets/only.css' ] ] ] )
        );
    }

    public function test_register_assets_registers_a_style_handle_for_every_entry_stylesheet() {
        foreach ( [ 0, 1, 2, 3 ] as $i ) {
            wp_deregister_style( 'mullion-gallery-app-style-' . $i );
        }
        $ref = new ReflectionProperty( Mullion_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, $this->chunked_manifest() );

        Mullion_Embed::register_assets();

        $styles = wp_styles()->registered;
        $this->assertStringEndsWith( 'assets/vendor-mantine-core.css', $styles['mullion-gallery-app-style-0']->src );
        $this->assertStringEndsWith( 'assets/vendor-dockview.css', $styles['mullion-gallery-app-style-1']->src );
        $this->assertStringEndsWith( 'assets/index-abc123.css', $styles['mullion-gallery-app-style-2']->src );
        $this->assertArrayNotHasKey( 'mullion-gallery-app-style-3', $styles );
    }

    public function test_render_shortcode_enqueues_every_entry_stylesheet() {
        foreach ( [ 0, 1, 2 ] as $i ) {
            wp_dequeue_style( 'mullion-gallery-app-style-' . $i );
            wp_deregister_style( 'mullion-gallery-app-style-' . $i );
        }
        $ref = new ReflectionProperty( Mullion_Embed::class, 'manifest_cache' );
        $ref->setAccessible( true );
        $ref->setValue( null, $this->chunked_manifest() );

        Mullion_Embed::register_assets();
        Mullion_Embed::render_shortcode( [] );

        foreach ( [ 0, 1, 2 ] as $i ) {
            $this->assertTrue( wp_style_is( 'mullion-gallery-app-style-' . $i, 'enqueued' ), "style handle $i should be enqueued" );
        }
    }
}
