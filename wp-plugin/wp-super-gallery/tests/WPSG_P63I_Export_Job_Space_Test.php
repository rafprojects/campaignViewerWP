<?php
/**
 * P63-I — export-job read/download re-checks per-space access.
 *
 * Follow-on to P63-E (tier) and P63-E-2 (creator-ownership). A `campaign` /
 * `multi_campaign` export job stamps the campaign space(s) its content came from;
 * `authorize_job_access()` then requires the requesting editor to *currently* have
 * access to EVERY contributing space (Key Decision D — "all contributing spaces",
 * symmetric with the require_campaign_batch_space_access create gate). System
 * Admins (owner everywhere) bypass; jobs with no stamped space skip the gate.
 *
 * Space fixtures follow the P52-A5b pattern: a delegated-mode editor is
 * manage_wpsg WITHOUT manage_options and gains space access only via an explicit
 * grant (P53-A: open mode confers no implicit editor access).
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63I_Export_Job_Space_Test extends WP_UnitTestCase {

    private int $admin_id;

    public function setUp(): void {
        parent::setUp();
        $this->admin_id = self::factory()->user->create( [ 'role' => 'administrator' ] );
        // Production administrators are granted manage_wpsg at plugin setup; add it
        // explicitly so the fixture is a true System Admin (manage_options + manage_wpsg)
        // that also satisfies the TIER_EDITOR gate on editor-tier jobs.
        get_user_by( 'id', $this->admin_id )->add_cap( 'manage_wpsg' );
    }

    public function tearDown(): void {
        wp_set_current_user( 0 );
        parent::tearDown();
    }

    /** manage_wpsg but NOT manage_options — the delegated-space boundary case. */
    private function make_editor(): int {
        $uid = self::factory()->user->create( [ 'role' => 'subscriber' ] );
        get_user_by( 'id', $uid )->add_cap( 'manage_wpsg' );
        $this->assertFalse( user_can( $uid, 'manage_options' ), 'fixture must lack manage_options' );
        return $uid;
    }

    private function make_space(): int {
        return WPSG_DB::insert_space( [
            'name'           => 'P63I ' . wp_generate_password( 6, false ),
            'slug'           => 'p63i-' . wp_generate_password( 6, false ),
            'isolation_mode' => 'open',
        ] );
    }

    private function grant_space( int $space_id, int $user_id, string $level = 'editor' ): void {
        WPSG_DB::update_space( $space_id, [
            'access_grants' => [ [ 'userId' => $user_id, 'access_level' => $level ] ],
        ] );
    }

    private function poll( int $user_id, string $job_id ) {
        wp_set_current_user( $user_id );
        $req = new WP_REST_Request( 'GET', '/wp-super-gallery/v1/export-jobs/' . $job_id );
        $req->set_param( 'job_id', $job_id );
        return WPSG_Export_Controller::get_export_job( $req );
    }

    private function assert_forbidden( $resp ): void {
        $this->assertInstanceOf( WP_Error::class, $resp );
        $this->assertSame( 403, $resp->get_error_data()['status'] );
    }

    private function assert_ok( $resp ): void {
        $this->assertInstanceOf( WP_REST_Response::class, $resp );
        $this->assertSame( 200, $resp->get_status() );
    }

    // ── Stamping ─────────────────────────────────────────────────────────────

    public function test_create_job_stamps_and_dedups_space_ids() {
        $a = $this->make_space();
        $b = $this->make_space();

        $id  = WPSG_Export_Engine::create_job( 'multi_campaign', '{}', [], space_ids: [ $a, $b, $a ] );
        $job = WPSG_Export_Engine::get_job( $id );

        $this->assertSame( [ $a, $b ], $job['space_ids'], 'duplicate space ids are collapsed, order preserved' );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_create_job_drops_non_positive_space_ids() {
        $a   = $this->make_space();
        $id  = WPSG_Export_Engine::create_job( 'campaign', '{}', [], space_ids: [ $a, 0, -3 ] );
        $job = WPSG_Export_Engine::get_job( $id );

        $this->assertSame( [ $a ], $job['space_ids'] );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_create_job_without_space_ids_is_empty() {
        $id  = WPSG_Export_Engine::create_job( 'campaign', '{}', [] );
        $job = WPSG_Export_Engine::get_job( $id );

        $this->assertSame( [], $job['space_ids'] );

        WPSG_Export_Engine::delete_job( $id );
    }

    // ── Single-space enforcement ─────────────────────────────────────────────

    public function test_owner_with_space_grant_allowed() {
        $editor = $this->make_editor();
        $space  = $this->make_space();
        $this->grant_space( $space, $editor );

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'campaign', '{}', [], space_ids: [ $space ] );

        $this->assert_ok( $this->poll( $editor, $id ) );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_owner_without_space_grant_denied() {
        // The creator no longer has (or never had) a grant to the stamped space —
        // ownership passes but the re-checked space gate denies. Least-privilege.
        $editor = $this->make_editor();
        $space  = $this->make_space(); // deliberately NOT granted to $editor

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'campaign', '{}', [], space_ids: [ $space ] );

        $this->assert_forbidden( $this->poll( $editor, $id ) );

        WPSG_Export_Engine::delete_job( $id );
    }

    // ── Batch "all contributing spaces" (Key Decision D) ─────────────────────

    public function test_batch_requires_access_to_all_spaces() {
        $editor = $this->make_editor();
        $a      = $this->make_space();
        $b      = $this->make_space();
        $this->grant_space( $a, $editor ); // access to A only, not B

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'multi_campaign', '{}', [], space_ids: [ $a, $b ] );

        $this->assert_forbidden( $this->poll( $editor, $id ) );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_batch_allowed_with_all_space_grants() {
        $editor = $this->make_editor();
        $a      = $this->make_space();
        $b      = $this->make_space();
        // Grants are per-space: A and B each get their own independent grant list.
        $this->grant_space( $a, $editor );
        $this->grant_space( $b, $editor );

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'multi_campaign', '{}', [], space_ids: [ $a, $b ] );

        $this->assert_ok( $this->poll( $editor, $id ) );

        WPSG_Export_Engine::delete_job( $id );
    }

    // ── System-Admin bypass + non-space jobs ─────────────────────────────────

    public function test_system_admin_bypasses_space_gate() {
        $editor = $this->make_editor();
        $space  = $this->make_space();
        $this->grant_space( $space, $editor );

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'campaign', '{}', [], space_ids: [ $space ] );

        // Admin has no explicit grant but is owner everywhere → allowed.
        $this->assert_ok( $this->poll( $this->admin_id, $id ) );

        WPSG_Export_Engine::delete_job( $id );
    }

    public function test_spaceless_job_skips_space_gate() {
        // created_by = editor, no space stamped → tier + ownership only, no space check.
        $editor = $this->make_editor();

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'campaign', '{}', [] );

        $this->assert_ok( $this->poll( $editor, $id ) );

        WPSG_Export_Engine::delete_job( $id );
    }

    // ── Download endpoint enforces the same gate ─────────────────────────────

    public function test_download_enforces_space_gate_before_status() {
        $editor = $this->make_editor();
        $space  = $this->make_space(); // not granted

        wp_set_current_user( $editor );
        $id = WPSG_Export_Engine::create_job( 'campaign', '{}', [], space_ids: [ $space ] );

        $req = new WP_REST_Request( 'GET', '/wp-super-gallery/v1/export-jobs/' . $id . '/download' );
        $req->set_param( 'job_id', $id );
        $resp = WPSG_Export_Controller::download_export_job( $req );

        // 403 (space), not 409 (not-complete) — the gate fires first.
        $this->assert_forbidden( $resp );

        WPSG_Export_Engine::delete_job( $id );
    }
}
