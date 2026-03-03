<?php
/**
 * PHPUnit tests for WPSG_CLI command class.
 *
 * Tests cover the full command surface:
 *   - campaign list (all / filtered by status)
 *   - campaign archive / restore
 *   - campaign export / import round-trip
 *   - media list / orphans
 *   - cache clear
 *   - analytics clear (single campaign + all)
 *   - rate-limit reset
 *   - CLI-only guard (class not loaded when WP_CLI constant is absent)
 *
 * @package WP_Super_Gallery
 */

/**
 * Minimal WP_CLI stub — keeps tests runnable without the real WP-CLI package.
 */
if ( ! class_exists( 'WP_CLI' ) ) {
    class WP_CLI {
        public static array $messages = [];
        public static ?string $last_error = null;

        public static function success( string $msg ): void {
            self::$messages[] = [ 'type' => 'success', 'msg' => $msg ];
        }
        public static function error( string $msg ): void {
            self::$last_error = $msg;
            throw new RuntimeException( 'WP_CLI::error — ' . $msg );
        }
        public static function line( string $msg ): void {
            self::$messages[] = [ 'type' => 'line', 'msg' => $msg ];
        }
        public static function warning( string $msg ): void {
            self::$messages[] = [ 'type' => 'warning', 'msg' => $msg ];
        }
        public static function add_command( string $name, string $class ): void {}

        public static function reset(): void {
            self::$messages   = [];
            self::$last_error = null;
        }
    }
}

/**
 * Minimal WP_CLI\Utils stub for format_items.
 * Define the stub class first, then alias — class_alias() requires the source class to exist.
 */
if ( ! class_exists( 'WP_CLI_Utils_Stub' ) ) {
    class WP_CLI_Utils_Stub {
        public static array $formatted = [];
        public static function format_items( string $format, array $items, array $fields ): void {
            self::$formatted[] = [ 'format' => $format, 'items' => $items, 'fields' => $fields ];
            // Also write to WP_CLI::$messages for assertion convenience.
            WP_CLI::$messages[] = [ 'type' => 'format', 'items' => $items ];
        }
        public static function reset(): void {
            self::$formatted = [];
        }
    }
}

if ( ! class_exists( 'WP_CLI\Utils' ) ) {
    // phpcs:ignore
    class_alias( 'WP_CLI_Utils_Stub', 'WP_CLI\Utils' );
}

// Load the CLI class directly — it is normally gated on the WP_CLI constant in
// the main plugin file, so the test suite must require it explicitly.
require_once __DIR__ . '/../includes/class-wpsg-cli.php';

/**
 * @covers WPSG_CLI
 */
class WPSG_CLI_Test extends WP_UnitTestCase {

    private WPSG_CLI $cli;

    public function setUp(): void {
        parent::setUp();
        WP_CLI::reset();
        WP_CLI_Utils_Stub::reset();
        $this->cli = new WPSG_CLI();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helper
    // ─────────────────────────────────────────────────────────────────────────

    private function create_campaign( string $title = 'Test Campaign', string $status = 'active' ): int {
        $id = wp_insert_post( [
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $title,
            'post_status' => 'publish',
        ] );
        update_post_meta( $id, 'status', $status );
        return $id;
    }

    private function last_success(): string {
        foreach ( array_reverse( WP_CLI::$messages ) as $msg ) {
            if ( $msg['type'] === 'success' ) {
                return $msg['msg'];
            }
        }
        return '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // campaign list
    // ─────────────────────────────────────────────────────────────────────────

    public function test_campaign_list_returns_all_campaigns(): void {
        $id1 = $this->create_campaign( 'Alpha' );
        $id2 = $this->create_campaign( 'Beta', 'archived' );

        $this->cli->campaign_list( [], [] );

        $found = false;
        foreach ( WP_CLI::$messages as $msg ) {
            if ( $msg['type'] === 'format' ) {
                $titles = array_column( $msg['items'], 'title' );
                $found  = in_array( 'Alpha', $titles, true ) && in_array( 'Beta', $titles, true );
                break;
            }
        }
        $this->assertTrue( $found, 'Both campaigns should appear in list output' );
    }

    public function test_campaign_list_filters_by_status(): void {
        $id1 = $this->create_campaign( 'Active One', 'active' );
        $id2 = $this->create_campaign( 'Archived One', 'archived' );

        $this->cli->campaign_list( [], [ 'status' => 'archived' ] );

        $found = false;
        foreach ( WP_CLI::$messages as $msg ) {
            if ( $msg['type'] === 'format' ) {
                $titles = array_column( $msg['items'], 'title' );
                $found  = in_array( 'Archived One', $titles, true ) && ! in_array( 'Active One', $titles, true );
                break;
            }
        }
        $this->assertTrue( $found, 'Status filter should restrict results' );
    }

    public function test_campaign_list_empty_outputs_line(): void {
        $this->cli->campaign_list( [], [] );
        $lines = array_filter( WP_CLI::$messages, fn( $m ) => $m['type'] === 'line' );
        $this->assertNotEmpty( $lines );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // campaign archive & restore
    // ─────────────────────────────────────────────────────────────────────────

    public function test_campaign_archive_sets_status_meta(): void {
        $id = $this->create_campaign( 'To Archive', 'active' );
        $this->cli->campaign_archive( [ (string) $id ], [] );
        $this->assertEquals( 'archived', get_post_meta( $id, 'status', true ) );
    }

    public function test_campaign_archive_outputs_success(): void {
        $id = $this->create_campaign();
        $this->cli->campaign_archive( [ (string) $id ], [] );
        $this->assertStringContainsString( (string) $id, $this->last_success() );
    }

    public function test_campaign_archive_404_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->campaign_archive( [ '99999' ], [] );
    }

    public function test_campaign_restore_sets_status_meta(): void {
        $id = $this->create_campaign( 'To Restore', 'archived' );
        $this->cli->campaign_restore( [ (string) $id ], [] );
        $this->assertEquals( 'active', get_post_meta( $id, 'status', true ) );
    }

    public function test_campaign_restore_404_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->campaign_restore( [ '99999' ], [] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // campaign duplicate
    // ─────────────────────────────────────────────────────────────────────────

    public function test_campaign_duplicate_creates_new_post(): void {
        $id = $this->create_campaign( 'Original' );
        update_post_meta( $id, 'visibility', 'private' );

        $this->cli->campaign_duplicate( [ (string) $id ], [] );
        $success = $this->last_success();
        $this->assertStringContainsString( 'New ID:', $success );

        // Extract new ID from "Campaign duplicated. New ID: 5"
        preg_match( '/New ID: (\d+)/', $success, $m );
        $new_id = intval( $m[1] ?? 0 );
        $this->assertGreaterThan( 0, $new_id );
        $this->assertEquals( 'draft', get_post_meta( $new_id, 'status', true ) );
        $this->assertEquals( 'private', get_post_meta( $new_id, 'visibility', true ) );
    }

    public function test_campaign_duplicate_respects_custom_name(): void {
        $id = $this->create_campaign( 'Source' );
        $this->cli->campaign_duplicate( [ (string) $id ], [ 'name' => 'Custom Name' ] );

        preg_match( '/New ID: (\d+)/', $this->last_success(), $m );
        $new_id = intval( $m[1] ?? 0 );
        $post   = get_post( $new_id );
        $this->assertEquals( 'Custom Name', $post->post_title );
    }

    public function test_campaign_duplicate_copy_media_flag(): void {
        $id          = $this->create_campaign( 'With Media' );
        $media_items = [ [ 'id' => 'abc', 'url' => 'https://example.com/img.jpg', 'title' => 'Img' ] ];
        update_post_meta( $id, 'media_items', $media_items );

        $this->cli->campaign_duplicate( [ (string) $id ], [ 'copy-media' => true ] );

        preg_match( '/New ID: (\d+)/', $this->last_success(), $m );
        $new_id   = intval( $m[1] ?? 0 );
        $new_media = get_post_meta( $new_id, 'media_items', true );
        $this->assertSame( $media_items, $new_media );
    }

    public function test_campaign_duplicate_without_copy_media_does_not_copy(): void {
        $id          = $this->create_campaign( 'With Media 2' );
        $media_items = [ [ 'id' => 'def', 'url' => 'https://example.com/img2.jpg', 'title' => 'Img2' ] ];
        update_post_meta( $id, 'media_items', $media_items );

        $this->cli->campaign_duplicate( [ (string) $id ], [] );

        preg_match( '/New ID: (\d+)/', $this->last_success(), $m );
        $new_id   = intval( $m[1] ?? 0 );
        $new_media = get_post_meta( $new_id, 'media_items', true );
        $this->assertEmpty( $new_media );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // campaign export / import round-trip
    // ─────────────────────────────────────────────────────────────────────────

    public function test_campaign_export_outputs_json_with_version(): void {
        $id = $this->create_campaign( 'Export Me' );

        ob_start();
        $this->cli->campaign_export( [ (string) $id ], [] );
        $output = ob_get_clean();

        // The JSON is written via WP_CLI::line; collect from messages.
        $json_msg = '';
        foreach ( WP_CLI::$messages as $msg ) {
            if ( $msg['type'] === 'line' ) {
                $json_msg = $msg['msg'];
                break;
            }
        }
        $payload = json_decode( $json_msg, true );
        $this->assertIsArray( $payload );
        $this->assertEquals( 1, $payload['version'] );
        $this->assertArrayHasKey( 'campaign', $payload );
        $this->assertArrayHasKey( 'media_references', $payload );
    }

    public function test_campaign_export_404_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->campaign_export( [ '99999' ], [] );
    }

    public function test_campaign_import_creates_draft_from_json_file(): void {
        // Create a temp JSON export file.
        $payload = json_encode( [
            'version'          => 1,
            'exported_at'      => gmdate( 'c' ),
            'campaign'         => [
                'title'       => 'Imported From CLI',
                'description' => 'Hello',
                'visibility'  => 'public',
                'tags'        => [ 'tagA', 'tagB' ],
            ],
            'layout_template'  => null,
            'media_references' => [],
        ] );
        $file = get_temp_dir() . 'wpsg-cli-test-import.json';
        file_put_contents( $file, $payload );

        $this->cli->campaign_import( [ $file ], [] );
        unlink( $file );

        $success = $this->last_success();
        preg_match( '/New ID: (\d+)/', $success, $m );
        $new_id = intval( $m[1] ?? 0 );

        $this->assertGreaterThan( 0, $new_id );
        $post = get_post( $new_id );
        $this->assertEquals( 'Imported From CLI', $post->post_title );
        $this->assertEquals( 'draft', get_post_meta( $new_id, 'status', true ) );
    }

    public function test_campaign_import_missing_file_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->campaign_import( [ '/tmp/does-not-exist-wpsg.json' ], [] );
    }

    public function test_campaign_import_unsupported_version_throws(): void {
        $file = get_temp_dir() . 'wpsg-bad-version.json';
        file_put_contents( $file, json_encode( [ 'version' => 9, 'campaign' => [] ] ) );

        try {
            $this->cli->campaign_import( [ $file ], [] );
            $thrown = false;
        } catch ( RuntimeException $e ) {
            $thrown = true;
        }
        unlink( $file );
        $this->assertTrue( $thrown );
    }

    public function test_campaign_export_import_round_trip(): void {
        // Create source campaign with tags.
        $source_id = $this->create_campaign( 'Round-trip Source' );
        update_post_meta( $source_id, 'visibility', 'private' );
        update_post_meta( $source_id, 'tags', [ 'alpha', 'beta' ] );

        // Export.
        $this->cli->campaign_export( [ (string) $source_id ], [] );
        $json_msg = '';
        foreach ( WP_CLI::$messages as $msg ) {
            if ( $msg['type'] === 'line' ) {
                $json_msg = $msg['msg'];
                break;
            }
        }

        // Write to file and import.
        $file = get_temp_dir() . 'wpsg-roundtrip.json';
        file_put_contents( $file, $json_msg );
        WP_CLI::reset();
        $this->cli->campaign_import( [ $file ], [] );
        unlink( $file );

        preg_match( '/New ID: (\d+)/', $this->last_success(), $m );
        $new_id = intval( $m[1] ?? 0 );
        $this->assertGreaterThan( 0, $new_id );
        $post = get_post( $new_id );
        $this->assertEquals( 'Round-trip Source', $post->post_title );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // media list
    // ─────────────────────────────────────────────────────────────────────────

    public function test_media_list_outputs_items(): void {
        $id          = $this->create_campaign( 'Media Test' );
        $media_items = [
            [ 'id' => 'x1', 'title' => 'Img 1', 'url' => 'https://example.com/1.jpg', 'type' => 'image', 'source' => 'url' ],
            [ 'id' => 'x2', 'title' => 'Img 2', 'url' => 'https://example.com/2.jpg', 'type' => 'image', 'source' => 'url' ],
        ];
        update_post_meta( $id, 'media_items', $media_items );

        $this->cli->media_list( [ (string) $id ], [] );

        $found = false;
        foreach ( WP_CLI::$messages as $msg ) {
            if ( $msg['type'] === 'format' && count( $msg['items'] ) === 2 ) {
                $found = true;
                break;
            }
        }
        $this->assertTrue( $found );
    }

    public function test_media_list_empty_outputs_line(): void {
        $id = $this->create_campaign( 'Empty Media' );
        $this->cli->media_list( [ (string) $id ], [] );
        $lines = array_filter( WP_CLI::$messages, fn( $m ) => $m['type'] === 'line' );
        $this->assertNotEmpty( $lines );
    }

    public function test_media_list_404_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->media_list( [ '99999' ], [] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // media orphans
    // ─────────────────────────────────────────────────────────────────────────

    public function test_media_orphans_success_when_none(): void {
        $this->cli->media_orphans( [], [] );
        $successes = array_filter( WP_CLI::$messages, fn( $m ) => $m['type'] === 'success' );
        $this->assertNotEmpty( $successes );
        $found = false;
        foreach ( $successes as $s ) {
            if ( strpos( $s['msg'], 'No orphaned' ) !== false ) {
                $found = true;
                break;
            }
        }
        $this->assertTrue( $found );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // cache clear
    // ─────────────────────────────────────────────────────────────────────────

    public function test_cache_clear_calls_thumbnail_cache(): void {
        // WPSG_Thumbnail_Cache::clear_all() returns an integer count.
        // In test env without real thumbnails, it will return 0 — just verify success output.
        $this->cli->cache_clear( [], [] );
        $success = $this->last_success();
        $this->assertStringContainsString( 'Thumbnail cache cleared', $success );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // analytics clear
    // ─────────────────────────────────────────────────────────────────────────

    public function test_analytics_clear_campaign_outputs_success(): void {
        $id = $this->create_campaign( 'Analytics Campaign' );
        $this->cli->analytics_clear( [ (string) $id ], [] );
        $success = $this->last_success();
        $this->assertStringContainsString( 'Analytics cleared', $success );
        $this->assertStringContainsString( (string) $id, $success );
    }

    public function test_analytics_clear_all_on_zero_id(): void {
        $this->cli->analytics_clear( [ '0' ], [] );
        $success = $this->last_success();
        $this->assertStringContainsString( 'All analytics events cleared', $success );
    }

    public function test_analytics_clear_404_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->analytics_clear( [ '99999' ], [] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // rate-limit reset
    // ─────────────────────────────────────────────────────────────────────────

    public function test_rate_limit_reset_outputs_success(): void {
        $this->cli->rate_limit_reset( [ '10.0.0.1' ], [] );
        $success = $this->last_success();
        $this->assertStringContainsString( '10.0.0.1', $success );
    }

    public function test_rate_limit_reset_empty_ip_throws(): void {
        $this->expectException( RuntimeException::class );
        $this->cli->rate_limit_reset( [ '' ], [] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CLI-only guard
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Verify the CLI class file exists and is loadable only when
     * WP_CLI is defined (our stub satisfies that condition here).
     */
    public function test_cli_class_is_loadable_when_wp_cli_is_defined(): void {
        $this->assertTrue( class_exists( 'WPSG_CLI' ), 'WPSG_CLI class must exist' );
    }

    /**
     * Verify WPSG_CLI is NOT auto-loaded without explicit require by checking
     * that the main plugin file gates the include on defined('WP_CLI').
     */
    public function test_main_plugin_guards_cli_on_wp_cli_constant(): void {
        $plugin_file = WPSG_PLUGIN_DIR . 'wp-super-gallery.php';
        $source      = file_get_contents( $plugin_file );
        $this->assertStringContainsString( "defined( 'WP_CLI' )", $source, "Main plugin must guard CLI include on WP_CLI constant" );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Audit log
    // ─────────────────────────────────────────────────────────────────────────

    public function test_archive_writes_audit_entry(): void {
        $id = $this->create_campaign( 'Audit Test' );
        $this->cli->campaign_archive( [ (string) $id ], [] );

        $log = get_post_meta( $id, 'audit_log', true );
        $this->assertIsArray( $log );
        $events = array_column( $log, 'event' );
        $this->assertContains( 'campaign.archived', $events );
    }

    public function test_restore_writes_audit_entry(): void {
        $id = $this->create_campaign( 'Audit Restore', 'archived' );
        $this->cli->campaign_restore( [ (string) $id ], [] );

        $log    = get_post_meta( $id, 'audit_log', true );
        $events = array_column( is_array( $log ) ? $log : [], 'event' );
        $this->assertContains( 'campaign.restored', $events );
    }

    public function test_duplicate_writes_audit_entry_on_new_campaign(): void {
        $id = $this->create_campaign( 'Audit Dup Source' );
        $this->cli->campaign_duplicate( [ (string) $id ], [] );

        preg_match( '/New ID: (\d+)/', $this->last_success(), $m );
        $new_id = intval( $m[1] ?? 0 );

        $log    = get_post_meta( $new_id, 'audit_log', true );
        $events = array_column( is_array( $log ) ? $log : [], 'event' );
        $this->assertContains( 'campaign.duplicated', $events );
    }
}
