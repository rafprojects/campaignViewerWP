<?php
/**
 * Tests for WPSG_Overlay_Library class.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Overlay_Library_Test extends WP_UnitTestCase {

    public function tearDown(): void {
        delete_option( WPSG_Overlay_Library::OPTION_KEY );
        parent::tearDown();
    }

    // ── get_all ─────────────────────────────────────────────────

    public function test_get_all_returns_empty_array_when_no_entries() {
        $all = WPSG_Overlay_Library::get_all();
        $this->assertIsArray( $all );
        $this->assertCount( 0, $all );
    }

    public function test_get_all_returns_empty_array_when_option_is_corrupt() {
        update_option( WPSG_Overlay_Library::OPTION_KEY, 'corrupted-string' );
        $all = WPSG_Overlay_Library::get_all();
        $this->assertIsArray( $all );
        $this->assertCount( 0, $all );
    }

    public function test_get_all_returns_newest_first() {
        $e1 = WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/a.png', 'name' => 'A' ] );
        // Small sleep to get different uploadedAt timestamps.
        sleep( 1 );
        $e2 = WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/b.png', 'name' => 'B' ] );

        $all = WPSG_Overlay_Library::get_all();
        $this->assertCount( 2, $all );
        // Newest first: e2 uploadedAt > e1 uploadedAt.
        $this->assertEquals( $e2['id'], $all[0]['id'] );
        $this->assertEquals( $e1['id'], $all[1]['id'] );
    }

    // ── add ─────────────────────────────────────────────────────

    public function test_add_returns_entry_with_id_url_name_uploadedAt() {
        $entry = WPSG_Overlay_Library::add( [
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
        $entry = WPSG_Overlay_Library::add( [
            'url'  => 'https://example.com/overlay.png',
            'name' => 'UUID Test',
        ] );

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $entry['id']
        );
    }

    public function test_add_sanitizes_name() {
        $entry = WPSG_Overlay_Library::add( [
            'url'  => 'https://example.com/overlay.png',
            'name' => '<script>alert("xss")</script>',
        ] );

        $this->assertStringNotContainsString( '<script>', $entry['name'] );
    }

    public function test_add_sanitizes_url() {
        $entry = WPSG_Overlay_Library::add( [
            'url'  => '  javascript:alert(1)  ',
            'name' => 'Malicious',
        ] );

        // esc_url_raw should strip javascript: scheme.
        $this->assertStringNotContainsString( 'javascript:', $entry['url'] );
    }

    public function test_add_defaults_name_to_empty_string_when_missing() {
        $entry = WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/o.png' ] );
        $this->assertEquals( '', $entry['name'] );
    }

    public function test_add_persists_to_option() {
        WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/p.png', 'name' => 'Persist' ] );
        $all = WPSG_Overlay_Library::get_all();
        $this->assertCount( 1, $all );
    }

    public function test_add_multiple_entries_are_all_returned() {
        WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/1.png', 'name' => 'One' ] );
        WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/2.png', 'name' => 'Two' ] );
        WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/3.png', 'name' => 'Three' ] );

        $this->assertCount( 3, WPSG_Overlay_Library::get_all() );
    }

    // ── remove ──────────────────────────────────────────────────

    public function test_remove_returns_true_and_deletes_entry() {
        $entry = WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/r.png', 'name' => 'Removable' ] );

        $result = WPSG_Overlay_Library::remove( $entry['id'] );

        $this->assertTrue( $result );
        $this->assertCount( 0, WPSG_Overlay_Library::get_all() );
    }

    public function test_remove_returns_false_for_nonexistent_id() {
        $result = WPSG_Overlay_Library::remove( 'nonexistent-id' );
        $this->assertFalse( $result );
    }

    public function test_remove_only_deletes_targeted_entry() {
        $e1 = WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/a.png', 'name' => 'Keep' ] );
        $e2 = WPSG_Overlay_Library::add( [ 'url' => 'https://example.com/b.png', 'name' => 'Remove' ] );

        WPSG_Overlay_Library::remove( $e2['id'] );

        $remaining = WPSG_Overlay_Library::get_all();
        $this->assertCount( 1, $remaining );
        $this->assertEquals( $e1['id'], $remaining[0]['id'] );
    }

    public function test_remove_returns_false_when_option_is_unset() {
        delete_option( WPSG_Overlay_Library::OPTION_KEY );
        $result = WPSG_Overlay_Library::remove( 'any-id' );
        $this->assertFalse( $result );
    }
}
