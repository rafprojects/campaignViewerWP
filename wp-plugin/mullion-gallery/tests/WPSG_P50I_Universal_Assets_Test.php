<?php

/**
 * P50-I: Universal asset visibility + unified upload backend.
 *
 * Covers:
 *  - A universal overlay is visible in a delegated space that has NO
 *    association row for it (it bypasses the P50-B per-space filter).
 *  - A non-universal, unassociated overlay stays hidden in that space.
 *  - Open-mode spaces (and unscoped requests) are unchanged.
 *  - WPSG_Asset_Library::set_universal() round-trips and get_all() reflects it.
 *  - set_universal() on a missing overlay returns false.
 *  - REST POST /admin/asset-library/{id} toggles the flag; 404 for unknown id.
 *  - upload_overlay() (URL path) persists the is_universal flag.
 *  - The v13 migration adds the is_universal column idempotently.
 */
class WPSG_P50I_Universal_Assets_Test extends WP_UnitTestCase {

    /**
     * The migration test calls WPSG_DB::maybe_upgrade() which runs DDL → an
     * implicit MySQL COMMIT, so overlay rows inserted beforehand survive WP's
     * per-test ROLLBACK. Truncate after the class to avoid cross-suite leakage.
     */
    public static function tearDownAfterClass(): void {
        global $wpdb;
        $table = WPSG_DB::get_assets_table();
        if ( $table ) {
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

    private function make_space(string $iso = 'delegated'): int {
        return WPSG_DB::insert_space([
            'name'           => 'P50I ' . $iso,
            'slug'           => 'p50i-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
        ]);
    }

    private function add_overlay(string $name, bool $universal = false): string {
        $entry = WPSG_Asset_Library::add([
            'url'          => 'https://example.com/' . sanitize_title($name) . '.png',
            'name'         => $name,
            'is_universal' => $universal,
        ]);
        $this->assertIsArray($entry);
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
    // Universal overlays bypass the per-space association filter.
    // -------------------------------------------------------------------------

    public function test_universal_overlay_visible_in_delegated_space_without_association() {
        $this->set_super_admin();
        $space     = $this->make_space('delegated');
        $universal = $this->add_overlay('P50I Universal Overlay', true);
        $regular   = $this->add_overlay('P50I Regular Overlay', false);

        $scoped = $this->list_asset_ids('/wp-super-gallery/v1/admin/asset-library', $space);

        $this->assertContains($universal, $scoped, 'Universal overlay must appear without an association row.');
        $this->assertNotContains($regular, $scoped, 'Non-universal, unassociated overlay must stay hidden.');
    }

    public function test_open_space_unaffected_by_universal_flag() {
        $this->set_super_admin();
        $space   = $this->make_space('open');
        $regular = $this->add_overlay('P50I Open Regular', false);

        $scoped = $this->list_asset_ids('/wp-super-gallery/v1/admin/asset-library', $space);
        $this->assertContains($regular, $scoped, 'Open-mode spaces still see the full library.');
    }

    // -------------------------------------------------------------------------
    // set_universal() round-trip.
    // -------------------------------------------------------------------------

    public function test_set_universal_round_trip() {
        $this->set_super_admin();
        $id = $this->add_overlay('P50I Toggle Overlay', false);

        $this->assertFalse($this->overlay_is_universal($id), 'Should start space-specific.');

        $this->assertTrue(WPSG_Asset_Library::set_universal($id, true));
        $this->assertTrue($this->overlay_is_universal($id), 'Should now be universal.');

        $this->assertTrue(WPSG_Asset_Library::set_universal($id, false));
        $this->assertFalse($this->overlay_is_universal($id), 'Should be space-specific again.');
    }

    public function test_set_universal_unknown_overlay_returns_false() {
        $this->set_super_admin();
        $this->assertFalse(WPSG_Asset_Library::set_universal('00000000-0000-0000-0000-000000000000', true));
    }

    private function overlay_is_universal(string $id): bool {
        foreach ( WPSG_Asset_Library::get_all() as $item ) {
            if ( ($item['id'] ?? '') === $id ) {
                return ! empty( $item['isUniversal'] );
            }
        }
        $this->fail("Overlay {$id} not found in library.");
    }

    // -------------------------------------------------------------------------
    // REST: POST /admin/asset-library/{id} toggles the flag.
    // -------------------------------------------------------------------------

    public function test_rest_update_overlay_sets_universal() {
        $this->set_super_admin();
        $id = $this->add_overlay('P50I Rest Toggle', false);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/asset-library/{$id}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'is_universal' => true ]));
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $this->assertTrue($response->get_data()['isUniversal']);
        $this->assertTrue($this->overlay_is_universal($id));
    }

    public function test_rest_update_overlay_unknown_id_404() {
        $this->set_super_admin();
        $missing = '11111111-1111-1111-1111-111111111111';

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/asset-library/{$missing}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'is_universal' => true ]));
        $response = rest_do_request($request);

        $this->assertSame(404, $response->get_status());
    }

    // -------------------------------------------------------------------------
    // REST upload (URL path) persists the universal flag.
    // -------------------------------------------------------------------------

    public function test_rest_upload_overlay_persists_universal_flag() {
        $this->set_super_admin();

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/asset-library');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'url'          => 'https://example.com/p50i-upload-universal.png',
            'name'         => 'P50I Upload Universal',
            'is_universal' => true,
        ]));
        $response = rest_do_request($request);

        $this->assertSame(201, $response->get_status());
        $data = $response->get_data();
        $this->assertTrue($data['isUniversal']);
        $this->assertTrue($this->overlay_is_universal($data['id']));
    }

    // -------------------------------------------------------------------------
    // Migration: is_universal column exists and re-running maybe_upgrade is safe.
    // -------------------------------------------------------------------------

    public function test_v13_migration_adds_is_universal_column_idempotently() {
        global $wpdb;
        $table = WPSG_DB::get_assets_table();

        // Re-run the upgrade as if from an older schema version.
        delete_option('wpsg_db_version');
        WPSG_DB::maybe_upgrade();

        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $has_col = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = '{$table}'
               AND COLUMN_NAME = 'is_universal'"
        );
        $this->assertSame(1, $has_col, 'is_universal column must exist after migration.');

        // A second run must not error and must keep the column.
        delete_option('wpsg_db_version');
        WPSG_DB::maybe_upgrade();
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $has_col_again = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = '{$table}'
               AND COLUMN_NAME = 'is_universal'"
        );
        $this->assertSame(1, $has_col_again, 'Migration must be idempotent.');
    }
}
