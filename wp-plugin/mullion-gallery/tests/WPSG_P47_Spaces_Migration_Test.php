<?php

/**
 * P47-G: Gallery Spaces — Migration Hardening
 *
 * Locks in the P47-A migration correctness so future schema changes cannot
 * silently break the spaces foundation.
 *
 * Covers:
 *  - wp_wpsg_spaces table is created by maybe_upgrade().
 *  - space_id column is present on all four campaign-scoped tables.
 *  - Default Space is seeded exactly once; wpsg_default_space_id option is set.
 *  - Backfill assigns the Default Space to campaigns that have no _wpsg_space_id.
 *  - Backfill does NOT overwrite a campaign already assigned to a different space.
 *  - Backfill is idempotent: running it twice never creates duplicate meta.
 *  - wpsg_spaces_backfill_complete is set '1' after a full batch completes.
 *
 * Approach: each test that exercises maybe_upgrade() deletes wpsg_db_version
 * to bypass the version guard, then restores it after the call.  All option
 * and post-meta writes happen inside WP_UnitTestCase's transaction wrapper and
 * are rolled back automatically; DDL (CREATE TABLE) is a no-op because the
 * bootstrap already ran maybe_upgrade() once.
 */
class WPSG_P47_Spaces_Migration_Test extends WP_UnitTestCase {

    // ── Schema assertions ─────────────────────────────────────────────────────

    public function test_spaces_table_exists(): void {
        global $wpdb;
        $result = $wpdb->get_var( "SHOW TABLES LIKE '{$wpdb->prefix}wpsg_spaces'" );
        $this->assertNotNull( $result, 'wp_wpsg_spaces table must exist after upgrade' );
    }

    public function test_space_id_column_exists_on_all_campaign_scoped_tables(): void {
        global $wpdb;
        $tables = [
            WPSG_DB::get_analytics_table(),
            WPSG_DB::get_audit_log_table(),
            WPSG_DB::get_media_refs_table(),
            WPSG_DB::get_access_requests_table(),
        ];
        foreach ( $tables as $table ) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
            $count = (int) $wpdb->get_var(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME   = '{$table}'
                   AND COLUMN_NAME  = 'space_id'"
            );
            $this->assertSame( 1, $count, "space_id column missing from {$table}" );
        }
    }

    // ── Default space seeding ─────────────────────────────────────────────────

    public function test_default_space_option_is_set(): void {
        $id = (int) get_option( 'wpsg_default_space_id' );
        $this->assertGreaterThan( 0, $id );
    }

    public function test_default_space_row_exists_with_correct_defaults(): void {
        $id    = (int) get_option( 'wpsg_default_space_id' );
        $space = WPSG_DB::get_space( $id );

        $this->assertNotNull( $space );
        $this->assertEquals( 'default', $space->slug );
        $this->assertEquals( 'Default', $space->name );
        $this->assertEquals( 'open', $space->isolation_mode );
        $this->assertSame( '0', (string) $space->archived );
    }

    // ── Backfill: assigns Default Space to unassigned campaigns ───────────────

    public function test_backfill_assigns_default_space_to_unassigned_campaign(): void {
        $default_id = (int) get_option( 'wpsg_default_space_id' );

        $post_id = self::factory()->post->create( [ 'post_type' => 'wpsg_campaign', 'post_status' => 'publish' ] );
        delete_post_meta( $post_id, '_wpsg_space_id' );

        // Reset backfill state and re-run.
        delete_option( 'wpsg_spaces_backfill_complete' );
        delete_option( 'wpsg_db_version' );
        WPSG_DB::maybe_upgrade();

        $assigned = (int) get_post_meta( $post_id, '_wpsg_space_id', true );
        $this->assertSame( $default_id, $assigned );
    }

    // ── Backfill: does NOT overwrite a pre-assigned space ─────────────────────

    public function test_backfill_does_not_overwrite_existing_space_assignment(): void {
        $other_space_id = WPSG_DB::insert_space( [
            'name'           => 'Other Space',
            'slug'           => 'other-' . wp_generate_password( 6, false ),
            'isolation_mode' => 'open',
        ] );
        $this->assertGreaterThan( 0, $other_space_id );

        $post_id = self::factory()->post->create( [ 'post_type' => 'wpsg_campaign' ] );
        delete_post_meta( $post_id, '_wpsg_space_id' );
        add_post_meta( $post_id, '_wpsg_space_id', $other_space_id, true );

        // Reset backfill state and re-run.
        delete_option( 'wpsg_spaces_backfill_complete' );
        delete_option( 'wpsg_db_version' );
        WPSG_DB::maybe_upgrade();

        $assigned = (int) get_post_meta( $post_id, '_wpsg_space_id', true );
        $this->assertSame( $other_space_id, $assigned, 'Pre-assigned space must not be overwritten by backfill' );
    }

    // ── Backfill: idempotent — no duplicate meta ───────────────────────────────

    public function test_backfill_is_idempotent_no_duplicate_meta(): void {
        $post_id = self::factory()->post->create( [ 'post_type' => 'wpsg_campaign' ] );
        delete_post_meta( $post_id, '_wpsg_space_id' );

        // First run.
        delete_option( 'wpsg_spaces_backfill_complete' );
        delete_option( 'wpsg_db_version' );
        WPSG_DB::maybe_upgrade();

        // Second run (simulate e.g. a force-re-run scenario).
        delete_option( 'wpsg_spaces_backfill_complete' );
        delete_option( 'wpsg_db_version' );
        WPSG_DB::maybe_upgrade();

        $all_values = get_post_meta( $post_id, '_wpsg_space_id' );
        $this->assertCount( 1, $all_values, 'Backfill must not create duplicate _wpsg_space_id meta entries' );
    }

    // ── Backfill: completion flag ─────────────────────────────────────────────

    public function test_backfill_sets_completion_flag(): void {
        delete_option( 'wpsg_spaces_backfill_complete' );
        delete_option( 'wpsg_db_version' );
        WPSG_DB::maybe_upgrade();

        $this->assertEquals( '1', get_option( 'wpsg_spaces_backfill_complete' ) );
    }
}
