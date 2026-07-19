<?php

class WPSG_Auto_Archive_Cron_Test extends WP_UnitTestCase {

	public function setUp(): void {
		parent::setUp();
		delete_option( 'wpsg_cache_version' );
	}

	public function tearDown(): void {
		delete_option( 'wpsg_cache_version' );
		parent::tearDown();
	}

	private function create_campaign( string $title, string $unpublish_at, ?string $status = 'active' ): int {
		$post_id = wp_insert_post( [
			'post_type'   => 'wpsg_campaign',
			'post_title'  => $title,
			'post_status' => 'publish',
		] );

		update_post_meta( $post_id, 'unpublish_at', $unpublish_at );

		if ( null !== $status ) {
			update_post_meta( $post_id, 'status', $status );
		}

		return $post_id;
	}

	public function test_auto_archive_updates_existing_and_missing_status_meta(): void {
		$expired_at = gmdate( 'Y-m-d H:i:s', strtotime( '-1 hour' ) );
		$future_at  = gmdate( 'Y-m-d H:i:s', strtotime( '+1 day' ) );

		$active_id   = $this->create_campaign( 'Expired Active', $expired_at, 'active' );
		$missing_id  = $this->create_campaign( 'Expired Missing Status', $expired_at, null );
		$future_id   = $this->create_campaign( 'Future Campaign', $future_at, 'active' );
		$archived_id = $this->create_campaign( 'Already Archived', $expired_at, 'archived' );

		$before = WPSG_REST::get_cache_version();

		wpsg_run_schedule_auto_archive();

		$this->assertSame( 'archived', get_post_meta( $active_id, 'status', true ) );
		$this->assertSame( 'archived', get_post_meta( $missing_id, 'status', true ) );
		$this->assertSame( [ 'archived' ], get_post_meta( $missing_id, 'status', false ) );
		$this->assertSame( 'active', get_post_meta( $future_id, 'status', true ) );
		$this->assertSame( 'archived', get_post_meta( $archived_id, 'status', true ) );
		$this->assertSame( $before + 1, WPSG_REST::get_cache_version() );
	}

	public function test_auto_archive_processes_multiple_batches_and_bumps_cache_once(): void {
		$expired_at = gmdate( 'Y-m-d H:i:s', strtotime( '-1 hour' ) );
		$post_ids   = [];

		for ( $i = 0; $i < 105; $i++ ) {
			$status     = 0 === $i % 2 ? 'active' : null;
			$post_ids[] = $this->create_campaign( "Expired {$i}", $expired_at, $status );
		}

		$before = WPSG_REST::get_cache_version();

		wpsg_run_schedule_auto_archive();

		foreach ( $post_ids as $post_id ) {
			$this->assertSame( 'archived', get_post_meta( $post_id, 'status', true ) );
		}

		$this->assertSame( $before + 1, WPSG_REST::get_cache_version() );
	}

	public function test_auto_archive_does_not_bump_cache_when_no_campaigns_are_archived(): void {
		$future_at = gmdate( 'Y-m-d H:i:s', strtotime( '+1 day' ) );
		$post_id   = $this->create_campaign( 'Future Campaign', $future_at, 'active' );

		$before = WPSG_REST::get_cache_version();

		wpsg_run_schedule_auto_archive();

		$this->assertSame( 'active', get_post_meta( $post_id, 'status', true ) );
		$this->assertSame( $before, WPSG_REST::get_cache_version() );
	}

	// P66-A/B: the batched auto-archive path must also stamp archived_at so the
	// maintenance auto-purge can key off it.
	public function test_auto_archive_stamps_archived_at_on_batched_campaigns(): void {
		$expired_at = gmdate( 'Y-m-d H:i:s', strtotime( '-1 hour' ) );

		$existing_id = $this->create_campaign( 'Expired Active', $expired_at, 'active' );
		$missing_id  = $this->create_campaign( 'Expired No Status', $expired_at, null );

		wpsg_run_schedule_auto_archive();

		foreach ( [ $existing_id, $missing_id ] as $post_id ) {
			$stamp = get_post_meta( $post_id, 'archived_at', true );
			$this->assertNotEmpty( $stamp, "archived_at must be stamped for campaign {$post_id}" );
			$this->assertMatchesRegularExpression(
				'/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/',
				$stamp
			);
			// Exactly one archived_at row — no duplicate meta from the batch insert.
			$this->assertCount( 1, get_post_meta( $post_id, 'archived_at', false ) );
		}
	}
}