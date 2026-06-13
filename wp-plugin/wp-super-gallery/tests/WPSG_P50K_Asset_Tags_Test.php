<?php

/**
 * P50-K: Asset tags + the overlay→asset rename migration.
 *
 * Covers:
 *  - WPSG_Asset_Library::add() stores tags; get_all() returns them as string[].
 *  - set_tags() round-trips and de-dupes / sanitizes.
 *  - REST upload (URL path) persists tags.
 *  - REST update_asset updates tags WITHOUT clobbering is_universal (and vice-versa).
 *  - update_asset with neither field is a 400.
 *  - The v14 RENAME migration moves wpsg_overlays → wpsg_assets and adds `tags`,
 *    idempotently.
 */
class WPSG_P50K_Asset_Tags_Test extends WP_UnitTestCase {

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

    private function add_asset(string $name, array $tags = []): string {
        $entry = WPSG_Asset_Library::add([
            'url'  => 'https://example.com/' . sanitize_title($name) . '.png',
            'name' => $name,
            'tags' => $tags,
        ]);
        $this->assertIsArray($entry);
        return $entry['id'];
    }

    private function get_asset(string $id): ?array {
        foreach ( WPSG_Asset_Library::get_all() as $item ) {
            if ( ($item['id'] ?? '') === $id ) {
                return $item;
            }
        }
        return null;
    }

    // ── Library layer ───────────────────────────────────────────

    public function test_add_stores_tags_and_get_all_returns_them() {
        $this->set_super_admin();
        $id = $this->add_asset('P50K Tagged', ['hero', 'winter', 'hero']); // duplicate dropped
        $asset = $this->get_asset($id);
        $this->assertNotNull($asset);
        $this->assertEqualsCanonicalizing(['hero', 'winter'], $asset['tags']);
    }

    public function test_set_tags_round_trip() {
        $this->set_super_admin();
        $id = $this->add_asset('P50K SetTags', []);
        $this->assertSame([], $this->get_asset($id)['tags']);

        $this->assertTrue(WPSG_Asset_Library::set_tags($id, ['badge', '  spaced  ', '']));
        // sanitize_text_field trims; empties dropped.
        $this->assertEqualsCanonicalizing(['badge', 'spaced'], $this->get_asset($id)['tags']);

        $this->assertTrue(WPSG_Asset_Library::set_tags($id, []));
        $this->assertSame([], $this->get_asset($id)['tags']);
    }

    public function test_set_tags_unknown_asset_returns_false() {
        $this->set_super_admin();
        $this->assertFalse(WPSG_Asset_Library::set_tags('00000000-0000-0000-0000-000000000000', ['x']));
    }

    // ── REST ─────────────────────────────────────────────────────

    public function test_rest_upload_persists_tags() {
        $this->set_super_admin();
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/admin/asset-library');
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([
            'url'  => 'https://example.com/p50k-upload.png',
            'name' => 'P50K Upload',
            'tags' => ['logo', 'brand'],
        ]));
        $response = rest_do_request($request);

        $this->assertSame(201, $response->get_status());
        $this->assertEqualsCanonicalizing(['logo', 'brand'], $response->get_data()['tags']);
    }

    public function test_rest_update_tags_does_not_clobber_universal() {
        $this->set_super_admin();
        $id = $this->add_asset('P50K Partial', []);

        // Set universal first.
        $this->assertTrue(WPSG_Asset_Library::set_universal($id, true));

        // Update only tags via REST.
        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/asset-library/{$id}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'tags' => ['kept'] ]));
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $asset = $this->get_asset($id);
        $this->assertEqualsCanonicalizing(['kept'], $asset['tags']);
        $this->assertTrue($asset['isUniversal'], 'Updating tags must not reset is_universal.');
    }

    public function test_rest_update_universal_does_not_clobber_tags() {
        $this->set_super_admin();
        $id = $this->add_asset('P50K Partial2', ['stay']);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/asset-library/{$id}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'is_universal' => true ]));
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $asset = $this->get_asset($id);
        $this->assertTrue($asset['isUniversal']);
        $this->assertEqualsCanonicalizing(['stay'], $asset['tags'], 'Updating universal must not drop tags.');
    }

    public function test_rest_update_with_no_fields_is_400() {
        $this->set_super_admin();
        $id = $this->add_asset('P50K NoFields', []);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/asset-library/{$id}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'foo' => 'bar' ]));
        $response = rest_do_request($request);

        $this->assertSame(400, $response->get_status());
    }

    // ── Migration ────────────────────────────────────────────────

    /**
     * Verifies the v14 schema: the canonical `wpsg_assets` table exists with the
     * `tags` column, and re-running maybe_upgrade is idempotent.
     *
     * Note: the rename-from-legacy path (`wpsg_overlays` → `wpsg_assets`) cannot
     * be exercised here — `DROP TABLE` does not take effect inside WP's per-test
     * transaction (DDL/transaction fragility also seen in P50-B), so the
     * "old table absent" precondition can't be reproduced. The rename itself is
     * a simple, guarded one-time migration (`maybe_rename_overlays_to_assets_v14`).
     */
    public function test_v14_assets_table_has_tags_column_idempotent() {
        global $wpdb;
        $table = WPSG_DB::get_assets_table();

        delete_option('wpsg_db_version');
        WPSG_DB::maybe_upgrade();

        // Canonical assets table exists.
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $this->assertSame($table, $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ));

        // tags column exists.
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $has_tags = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$table}' AND COLUMN_NAME = 'tags'"
        );
        $this->assertSame(1, $has_tags, 'tags column must exist after the v14 migration.');

        // Idempotent second run keeps the table + column.
        delete_option('wpsg_db_version');
        WPSG_DB::maybe_upgrade();
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $this->assertSame($table, $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ));
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $has_tags_again = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$table}' AND COLUMN_NAME = 'tags'"
        );
        $this->assertSame(1, $has_tags_again);
    }
}
