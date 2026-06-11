<?php

/**
 * P50-B: Per-Space Library Isolation (overlays / fonts)
 *
 * Covers:
 *  - A delegated space with no association rows sees an empty overlay/font
 *    list when the list endpoints are scoped with ?space=ID.
 *  - Associating an asset makes it visible to that space; dissociating hides it.
 *  - Open-mode spaces (and unscoped requests) always see the full library.
 *  - GET /spaces/{id}/library returns both association lists.
 *  - A manage_wpsg-only user without a grant cannot modify a delegated
 *    space's library (403).
 *  - The one-time migration associates all pre-existing assets with all
 *    pre-existing delegated spaces.
 */
class WPSG_P50B_Space_Library_Test extends WP_UnitTestCase {

    /**
     * test_migration_backfills_existing_assets_into_delegated_spaces calls
     * WPSG_DB::maybe_upgrade() which runs dbDelta() (DDL) → implicit MySQL
     * COMMIT. Any overlay rows inserted before that call are permanently
     * committed and won't be undone by WP's per-test ROLLBACK. Truncate the
     * table after the whole class finishes to prevent cross-suite contamination.
     */
    public static function tearDownAfterClass(): void {
        global $wpdb;
        $table = WPSG_DB::get_overlays_table();
        if ($table) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $wpdb->query( "TRUNCATE TABLE {$table}" );
        }
        parent::tearDownAfterClass();
    }

    private function set_super_admin(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function make_wpsg_only_admin(): int {
        $user_id = self::factory()->user->create([ 'role' => 'editor' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        $this->assertFalse(user_can($user_id, 'manage_options'), 'Fixture must lack manage_options.');
        return $user_id;
    }

    private function make_space(string $iso = 'delegated'): int {
        return WPSG_DB::insert_space([
            'name'           => 'P50B ' . $iso,
            'slug'           => 'p50b-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
        ]);
    }

    private function add_overlay(string $name): string {
        $entry = WPSG_Overlay_Library::add([
            'url'  => 'https://example.com/' . sanitize_title($name) . '.png',
            'name' => $name,
        ]);
        $this->assertIsArray($entry);
        return $entry['id'];
    }

    private function add_font(string $name): string {
        $entry = WPSG_Font_Library::add([
            'url'  => 'https://example.com/' . sanitize_title($name) . '.woff2',
            'name' => $name,
        ]);
        return $entry['id'];
    }

    private function list_asset_ids(string $route, ?int $space_id = null): array {
        $request = new WP_REST_Request('GET', $route);
        if ($space_id !== null) {
            $request->set_param('space', (string) $space_id);
        }
        $data = rest_do_request($request)->get_data();
        return array_map(fn($item) => $item['id'] ?? '', is_array($data) ? $data : []);
    }

    // -------------------------------------------------------------------------
    // Delegated space: empty until associated; associate/dissociate round-trip.
    // -------------------------------------------------------------------------

    public function test_delegated_space_sees_only_associated_overlays() {
        $this->set_super_admin();
        $space      = $this->make_space('delegated');
        $overlay_a  = $this->add_overlay('P50B Overlay A');
        $overlay_b  = $this->add_overlay('P50B Overlay B');

        // No associations: scoped list is empty, unscoped list has both.
        $this->assertSame([], $this->list_asset_ids('/wp-super-gallery/v1/admin/overlay-library', $space));
        $unscoped = $this->list_asset_ids('/wp-super-gallery/v1/admin/overlay-library');
        $this->assertContains($overlay_a, $unscoped);
        $this->assertContains($overlay_b, $unscoped);

        // Associate one overlay via REST.
        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/library");
        $request->set_param('assetType', 'overlay');
        $request->set_param('assetId', $overlay_a);
        $this->assertSame(200, rest_do_request($request)->get_status());

        $scoped = $this->list_asset_ids('/wp-super-gallery/v1/admin/overlay-library', $space);
        $this->assertSame([$overlay_a], $scoped, 'Scoped list must contain exactly the associated overlay.');

        // Dissociate it again.
        $request = new WP_REST_Request('DELETE', "/wp-super-gallery/v1/spaces/{$space}/library");
        $request->set_param('assetType', 'overlay');
        $request->set_param('assetId', $overlay_a);
        $this->assertSame(200, rest_do_request($request)->get_status());

        $this->assertSame([], $this->list_asset_ids('/wp-super-gallery/v1/admin/overlay-library', $space));
    }

    public function test_delegated_space_sees_only_associated_fonts() {
        $this->set_super_admin();
        $space  = $this->make_space('delegated');
        $font_a = $this->add_font('P50B Font A');
        $this->add_font('P50B Font B');

        $this->assertSame([], $this->list_asset_ids('/wp-super-gallery/v1/admin/font-library', $space));

        WPSG_DB::associate_asset($space, 'font', $font_a);

        $this->assertSame([$font_a], $this->list_asset_ids('/wp-super-gallery/v1/admin/font-library', $space));
    }

    // -------------------------------------------------------------------------
    // Open-mode spaces and unscoped requests bypass the association table.
    // -------------------------------------------------------------------------

    public function test_open_space_sees_all_assets_regardless_of_associations() {
        $this->set_super_admin();
        $space   = $this->make_space('open');
        $overlay = $this->add_overlay('P50B Open Overlay');

        $scoped = $this->list_asset_ids('/wp-super-gallery/v1/admin/overlay-library', $space);
        $this->assertContains($overlay, $scoped, 'Open-mode spaces must see the full global library.');
    }

    // -------------------------------------------------------------------------
    // GET /spaces/{id}/library returns both association lists.
    // -------------------------------------------------------------------------

    public function test_space_library_endpoint_returns_both_lists() {
        $this->set_super_admin();
        $space   = $this->make_space('delegated');
        $overlay = $this->add_overlay('P50B Lib Overlay');
        $font    = $this->add_font('P50B Lib Font');
        WPSG_DB::associate_asset($space, 'overlay', $overlay);
        WPSG_DB::associate_asset($space, 'font', $font);

        $response = rest_do_request(new WP_REST_Request('GET', "/wp-super-gallery/v1/spaces/{$space}/library"));
        $this->assertSame(200, $response->get_status());
        $data = $response->get_data();
        $this->assertSame([$overlay], $data['overlay']);
        $this->assertSame([$font], $data['font']);
    }

    // -------------------------------------------------------------------------
    // Authorization: non-owner of a delegated space cannot modify its library.
    // -------------------------------------------------------------------------

    public function test_non_owner_cannot_modify_delegated_space_library() {
        $this->set_super_admin();
        $space   = $this->make_space('delegated');
        $overlay = $this->add_overlay('P50B Denied Overlay');

        wp_set_current_user($this->make_wpsg_only_admin());
        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/spaces/{$space}/library");
        $request->set_param('assetType', 'overlay');
        $request->set_param('assetId', $overlay);

        $this->assertSame(403, rest_do_request($request)->get_status());
        $this->assertSame([], WPSG_DB::get_space_library_assets($space, 'overlay'));
    }

    // -------------------------------------------------------------------------
    // Migration backfill: pre-existing assets reach pre-existing delegated spaces.
    // -------------------------------------------------------------------------

    public function test_migration_backfills_existing_assets_into_delegated_spaces() {
        $this->set_super_admin();
        $delegated = $this->make_space('delegated');
        $open      = $this->make_space('open');
        $overlay   = $this->add_overlay('P50B Backfill Overlay');
        $font      = $this->add_font('P50B Backfill Font');

        // Re-run the migration as if upgrading from a pre-P50B install.
        delete_option('wpsg_space_library_assoc_backfilled');
        delete_option('wpsg_db_version');
        WPSG_DB::maybe_upgrade();

        $this->assertContains($overlay, WPSG_DB::get_space_library_assets($delegated, 'overlay'));
        $this->assertContains($font, WPSG_DB::get_space_library_assets($delegated, 'font'));
        $this->assertSame([], WPSG_DB::get_space_library_assets($open, 'overlay'), 'Open spaces need no association rows.');
    }
}
