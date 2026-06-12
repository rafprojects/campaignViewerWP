<?php
/**
 * Tests for WPSG_Asset_Library class (P41-OL1: DB-backed storage).
 *
 * @package WP_Super_Gallery
 */

class WPSG_Asset_Library_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        // Ensure the overlays table exists for each test.
        WPSG_DB::maybe_create_assets_table();
    }

    public function tearDown(): void {
        global $wpdb;
        $table = WPSG_DB::get_assets_table();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->query( "TRUNCATE TABLE {$table}" );
        parent::tearDown();
    }

    // ── get_all ─────────────────────────────────────────────────

    public function test_get_all_returns_empty_array_when_no_entries() {
        $all = WPSG_Asset_Library::get_all();
        $this->assertIsArray( $all );
        $this->assertCount( 0, $all );
    }

    public function test_get_all_returns_newest_first() {
        global $wpdb;
        $table = WPSG_DB::get_assets_table();
        $id1   = wp_generate_uuid4();
        $id2   = wp_generate_uuid4();

        // Insert two entries with distinct uploaded_at values.
        $wpdb->insert( $table, [
            'overlay_id'  => $id1,
            'url'         => 'https://example.com/a.png',
            'name'        => 'A',
            'uploaded_at' => '2024-01-01 00:00:00',
        ], [ '%s', '%s', '%s', '%s' ] );
        $wpdb->insert( $table, [
            'overlay_id'  => $id2,
            'url'         => 'https://example.com/b.png',
            'name'        => 'B',
            'uploaded_at' => '2024-01-02 00:00:00',
        ], [ '%s', '%s', '%s', '%s' ] );

        $all = WPSG_Asset_Library::get_all();
        $this->assertCount( 2, $all );
        // Newest first: id2 ('2024-01-02') before id1 ('2024-01-01').
        $this->assertEquals( $id2, $all[0]['id'] );
        $this->assertEquals( $id1, $all[1]['id'] );
    }

    public function test_get_all_maps_uploaded_at_to_uploadedAt_key() {
        WPSG_Asset_Library::add( [ 'url' => 'https://example.com/o.png', 'name' => 'Test' ] );
        $all = WPSG_Asset_Library::get_all();
        $this->assertArrayHasKey( 'uploadedAt', $all[0] );
    }

    // ── add ─────────────────────────────────────────────────────

    public function test_add_returns_entry_with_id_url_name_uploadedAt() {
        $entry = WPSG_Asset_Library::add( [
            'url'  => 'https://example.com/overlay.png',
            'name' => 'Test Overlay',
        ] );

        $this->assertArrayHasKey( 'id', $entry );
        $this->assertArrayHasKey( 'url', $entry );
        $this->assertArrayHasKey( 'name', $entry );
        $this->assertArrayHasKey( 'uploadedAt', $entry );
        $this->assertEquals( 'https://example.com/overlay.png', $entry['url'] );
        $this->assertEquals( 'Test Overlay', $entry['name'] );
        $this->assertNotEmpty( $entry['id'] );
    }

    public function test_add_generates_uuid_id() {
        $entry = WPSG_Asset_Library::add( [
            'url'  => 'https://example.com/overlay.png',
            'name' => 'UUID Test',
        ] );

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $entry['id']
        );
    }

    public function test_add_sanitizes_name() {
        $entry = WPSG_Asset_Library::add( [
            'url'  => 'https://example.com/overlay.png',
            'name' => '<script>alert("xss")</script>',
        ] );

        $this->assertStringNotContainsString( '<script>', $entry['name'] );
    }

    public function test_add_sanitizes_url() {
        $entry = WPSG_Asset_Library::add( [
            'url'  => '  javascript:alert(1)  ',
            'name' => 'Malicious',
        ] );

        // esc_url_raw should strip javascript: scheme.
        $this->assertStringNotContainsString( 'javascript:', $entry['url'] );
    }

    public function test_add_defaults_name_to_empty_string_when_missing() {
        $entry = WPSG_Asset_Library::add( [ 'url' => 'https://example.com/o.png' ] );
        $this->assertEquals( '', $entry['name'] );
    }

    public function test_add_persists_to_db() {
        WPSG_Asset_Library::add( [ 'url' => 'https://example.com/p.png', 'name' => 'Persist' ] );
        $all = WPSG_Asset_Library::get_all();
        $this->assertCount( 1, $all );
    }

    public function test_add_multiple_entries_are_all_returned() {
        WPSG_Asset_Library::add( [ 'url' => 'https://example.com/1.png', 'name' => 'One' ] );
        WPSG_Asset_Library::add( [ 'url' => 'https://example.com/2.png', 'name' => 'Two' ] );
        WPSG_Asset_Library::add( [ 'url' => 'https://example.com/3.png', 'name' => 'Three' ] );

        $this->assertCount( 3, WPSG_Asset_Library::get_all() );
    }

    // ── remove ──────────────────────────────────────────────────

    public function test_remove_returns_true_and_deletes_entry() {
        $entry = WPSG_Asset_Library::add( [ 'url' => 'https://example.com/r.png', 'name' => 'Removable' ] );

        $result = WPSG_Asset_Library::remove( $entry['id'] );

        $this->assertTrue( $result );
        $this->assertCount( 0, WPSG_Asset_Library::get_all() );
    }

    public function test_remove_returns_false_for_nonexistent_id() {
        $result = WPSG_Asset_Library::remove( 'nonexistent-id' );
        $this->assertFalse( $result );
    }

    public function test_remove_only_deletes_targeted_entry() {
        $e1 = WPSG_Asset_Library::add( [ 'url' => 'https://example.com/a.png', 'name' => 'Keep' ] );
        $e2 = WPSG_Asset_Library::add( [ 'url' => 'https://example.com/b.png', 'name' => 'Remove' ] );

        WPSG_Asset_Library::remove( $e2['id'] );

        $remaining = WPSG_Asset_Library::get_all();
        $this->assertCount( 1, $remaining );
        $this->assertEquals( $e1['id'], $remaining[0]['id'] );
    }

    public function test_remove_returns_false_when_table_is_empty() {
        $result = WPSG_Asset_Library::remove( 'any-id' );
        $this->assertFalse( $result );
    }

    // ── migration ────────────────────────────────────────────────

    public function test_maybe_create_assets_table_is_idempotent() {
        // Calling it twice should not throw or create duplicate tables.
        WPSG_DB::maybe_create_assets_table();
        WPSG_DB::maybe_create_assets_table();
        // If we reach here without a DB error, the test passes.
        $this->assertTrue( true );
    }
}
