<?php
/**
 * P63-E — export-job read/download gated by the creator's tier.
 *
 * Jobs created under a System-Admin gate (audit / media-library export) must not
 * be readable/downloadable by a lower-tier (manage_wpsg) user who obtains the job
 * ID. create_job() stamps `created_by` + `required_tier`; the three job endpoints
 * re-check the stamped tier.
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63E_Export_Job_Tier_Test extends WP_UnitTestCase {

    private int $admin_id;
    private int $editor_id;

    public function setUp(): void {
        parent::setUp();
        $this->admin_id  = self::factory()->user->create( [ 'role' => 'administrator' ] );
        $this->editor_id = self::factory()->user->create( [ 'role' => 'subscriber' ] );
        // A manage_wpsg editor that is NOT a System Admin (no manage_options).
        get_user_by( 'id', $this->editor_id )->add_cap( 'manage_wpsg' );
    }

    public function tearDown(): void {
        wp_set_current_user( 0 );
        parent::tearDown();
    }

    private function poll_job( int $user_id, string $job_id ) {
        wp_set_current_user( $user_id );
        $req = new WP_REST_Request( 'GET', '/wp-super-gallery/v1/export-jobs/' . $job_id );
        $req->set_param( 'job_id', $job_id );
        return WPSG_Export_Controller::get_export_job( $req );
    }

    // ── Stamping ─────────────────────────────────────────────────────────────

    public function test_create_job_stamps_creator_and_required_tier() {
        wp_set_current_user( $this->admin_id );
        $id  = WPSG_Export_Engine::create_job( 'audit', '{}', [], required_tier: WPSG_Permissions::TIER_SYSTEM_ADMIN );
        $job = WPSG_Export_Engine::get_job( $id );

        $this->assertSame( $this->admin_id, $job['created_by'] );
        $this->assertSame( WPSG_Permissions::TIER_SYSTEM_ADMIN, $job['required_tier'] );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_create_job_defaults_to_editor_tier() {
        $id  = WPSG_Export_Engine::create_job( 'campaign', '{}', [] );
        $job = WPSG_Export_Engine::get_job( $id );

        $this->assertSame( WPSG_Permissions::TIER_EDITOR, $job['required_tier'] );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_invalid_required_tier_falls_back_to_editor() {
        $id  = WPSG_Export_Engine::create_job( 'campaign', '{}', [], required_tier: 'nonsense' );
        $job = WPSG_Export_Engine::get_job( $id );

        $this->assertSame( WPSG_Permissions::TIER_EDITOR, $job['required_tier'] );

        WPSG_Export_Engine::delete_job( $id );
    }

    // ── Enforcement ──────────────────────────────────────────────────────────

    public function test_system_admin_job_rejected_for_editor() {
        $id = WPSG_Export_Engine::create_job( 'audit', '{}', [], required_tier: WPSG_Permissions::TIER_SYSTEM_ADMIN );

        $resp = $this->poll_job( $this->editor_id, $id );

        $this->assertInstanceOf( WP_Error::class, $resp );
        $this->assertSame( 403, $resp->get_error_data()['status'] );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_system_admin_job_allowed_for_admin() {
        $id = WPSG_Export_Engine::create_job( 'audit', '{}', [], required_tier: WPSG_Permissions::TIER_SYSTEM_ADMIN );

        $resp = $this->poll_job( $this->admin_id, $id );

        $this->assertInstanceOf( WP_REST_Response::class, $resp );
        $this->assertSame( 200, $resp->get_status() );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_editor_tier_job_accessible_by_editor() {
        $id = WPSG_Export_Engine::create_job( 'campaign', '{}', [] );

        $resp = $this->poll_job( $this->editor_id, $id );

        $this->assertInstanceOf( WP_REST_Response::class, $resp );
        $this->assertSame( 200, $resp->get_status() );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_download_rejected_for_editor_on_system_admin_job() {
        // Tier check must fire before the "not complete" status check.
        $id = WPSG_Export_Engine::create_job( 'audit', '{}', [], required_tier: WPSG_Permissions::TIER_SYSTEM_ADMIN );

        wp_set_current_user( $this->editor_id );
        $req = new WP_REST_Request( 'GET', '/wp-super-gallery/v1/export-jobs/' . $id . '/download' );
        $req->set_param( 'job_id', $id );
        $resp = WPSG_Export_Controller::download_export_job( $req );

        $this->assertInstanceOf( WP_Error::class, $resp );
        $this->assertSame( 403, $resp->get_error_data()['status'] );

        WPSG_Export_Engine::delete_job( $id );
    }
}
