<?php

/**
 * P66-A: WPSG_Campaign_Status — the single source of truth for campaign status
 * transitions and their archived_at / restored_at bookkeeping.
 *
 * Covers:
 *  - set() validates the status enum.
 *  - set() stamps archived_at on archive and restored_at (clearing archived_at)
 *    on restore; a redundant re-archive does not reset the archived_at clock.
 *  - The opt-in side-effects (audit / hook / cache) fire only when requested.
 *  - stamp_archived_batch() stamps a batch and clears any stale restored_at.
 *  - Every archive/restore entry point (single REST, batch REST, generic
 *    update, auto-archive cron) leaves an archived_at behind.
 */
class WPSG_P66A_Campaign_Status_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function create_campaign(string $status = 'active'): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P66-A Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', $status);
        return intval($id);
    }

    public function tearDown(): void {
        wp_set_current_user(0);
        parent::tearDown();
    }

    // ── set(): enum validation ────────────────────────────────────────────────

    public function test_set_rejects_invalid_status() {
        $id     = $this->create_campaign();
        $result = WPSG_Campaign_Status::set($id, 'bogus');

        $this->assertInstanceOf('WP_Error', $result);
        $this->assertSame('wpsg_invalid_status', $result->get_error_code());
        // The invalid write must not have touched the stored status.
        $this->assertSame('active', get_post_meta($id, 'status', true));
    }

    public function test_set_accepts_each_valid_status() {
        $id = $this->create_campaign('draft');
        foreach ( ['draft', 'active', 'archived'] as $status ) {
            $this->assertTrue(WPSG_Campaign_Status::set($id, $status));
            $this->assertSame($status, get_post_meta($id, 'status', true));
        }
    }

    // ── set(): archived_at / restored_at bookkeeping ──────────────────────────

    public function test_archive_stamps_archived_at() {
        $id = $this->create_campaign('active');

        WPSG_Campaign_Status::set($id, 'archived');

        $archived_at = get_post_meta($id, 'archived_at', true);
        $this->assertNotEmpty($archived_at, 'archived_at must be stamped on archive');
        $this->assertMatchesRegularExpression(
            '/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/',
            $archived_at,
            'archived_at must be a Y-m-d H:i:s string'
        );
        $this->assertSame('', get_post_meta($id, 'restored_at', true));
    }

    public function test_restore_stamps_restored_at_and_clears_archived_at() {
        $id = $this->create_campaign('active');
        WPSG_Campaign_Status::set($id, 'archived');
        $this->assertNotEmpty(get_post_meta($id, 'archived_at', true));

        WPSG_Campaign_Status::set($id, 'active');

        $this->assertSame('', get_post_meta($id, 'archived_at', true), 'archived_at must be cleared on restore');
        $this->assertNotEmpty(get_post_meta($id, 'restored_at', true), 'restored_at must be stamped on restore');
    }

    public function test_re_archive_does_not_reset_the_clock() {
        $id = $this->create_campaign('active');
        WPSG_Campaign_Status::set($id, 'archived');
        $first = get_post_meta($id, 'archived_at', true);

        // A redundant archive of an already-archived campaign must leave the
        // original archived_at intact (do not restart the purge clock).
        WPSG_Campaign_Status::set($id, 'archived');
        $second = get_post_meta($id, 'archived_at', true);

        $this->assertSame($first, $second);
    }

    public function test_draft_active_transition_touches_no_timestamp() {
        $id = $this->create_campaign('draft');

        WPSG_Campaign_Status::set($id, 'active');

        $this->assertSame('', get_post_meta($id, 'archived_at', true));
        $this->assertSame('', get_post_meta($id, 'restored_at', true));
    }

    // ── set(): opt-in side effects ────────────────────────────────────────────

    public function test_set_without_ctx_fires_no_side_effects() {
        $id = $this->create_campaign('active');

        $hook_fired = false;
        add_action('wpsg_campaign_archived', function () use (&$hook_fired) { $hook_fired = true; });
        $cache_before = WPSG_REST::get_cache_version();

        WPSG_Campaign_Status::set($id, 'archived');

        $this->assertFalse($hook_fired, 'No hook should fire without ctx[hook]');
        $this->assertSame($cache_before, WPSG_REST::get_cache_version(), 'Cache must not bump without ctx[cache]');
        $audit = WPSG_DB::list_audit_entries(['campaign_id' => $id, 'per_page' => 10, 'page' => 1]);
        $this->assertSame(0, $audit['total'], 'No audit entry should be written without ctx[audit]');
    }

    public function test_set_with_ctx_fires_audit_hook_and_cache() {
        $id = $this->create_campaign('active');

        $hook_id = 0;
        add_action('wpsg_campaign_archived', function ($cid) use (&$hook_id) { $hook_id = $cid; });
        $cache_before = WPSG_REST::get_cache_version();

        WPSG_Campaign_Status::set($id, 'archived', [
            'audit' => ['action' => 'campaign.archived', 'details' => []],
            'hook'  => 'wpsg_campaign_archived',
            'cache' => true,
        ]);

        $this->assertSame($id, $hook_id, 'ctx[hook] must fire with the post ID');
        $this->assertSame($cache_before + 1, WPSG_REST::get_cache_version(), 'ctx[cache] must bump the cache version once');
        $audit = WPSG_DB::list_audit_entries(['campaign_id' => $id, 'per_page' => 10, 'page' => 1]);
        $this->assertSame(1, $audit['total'], 'ctx[audit] must write one audit entry');
        $this->assertSame('campaign.archived', $audit['items'][0]['action']);
    }

    // ── stamp_archived_batch() ────────────────────────────────────────────────

    public function test_stamp_archived_batch_stamps_all_and_clears_restored_at() {
        $a = $this->create_campaign('active');
        $b = $this->create_campaign('active');
        // b carries a stale restored_at that must be cleared by a fresh archival.
        update_post_meta($b, 'restored_at', '2020-01-01 00:00:00');

        $count = WPSG_Campaign_Status::stamp_archived_batch([$a, $b, 0, -3]);

        $this->assertSame(2, $count, 'Only the two positive IDs are stamped');
        $this->assertNotEmpty(get_post_meta($a, 'archived_at', true));
        $this->assertNotEmpty(get_post_meta($b, 'archived_at', true));
        $this->assertSame('', get_post_meta($b, 'restored_at', true), 'stale restored_at must be cleared');
    }

    public function test_stamp_archived_batch_writes_exactly_one_row() {
        $a = $this->create_campaign('active');
        // Pre-existing archived_at that must be replaced, not duplicated.
        update_post_meta($a, 'archived_at', '2019-06-06 06:06:06');

        WPSG_Campaign_Status::stamp_archived_batch([$a]);

        $rows = get_post_meta($a, 'archived_at', false);
        $this->assertCount(1, $rows, 'Exactly one archived_at row must remain');
        $this->assertNotSame('2019-06-06 06:06:06', $rows[0], 'The old value must be overwritten with now');
    }

    // ── Entry-point integration: every path leaves an archived_at ─────────────

    public function test_archive_endpoint_stamps_archived_at() {
        $this->set_admin_user();
        $id = $this->create_campaign('active');

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$id}/archive");
        $request->set_param('id', $id);
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $this->assertNotEmpty(get_post_meta($id, 'archived_at', true));
    }

    public function test_restore_endpoint_clears_archived_at() {
        $this->set_admin_user();
        $id = $this->create_campaign('active');
        WPSG_Campaign_Status::set($id, 'archived');

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$id}/restore");
        $request->set_param('id', $id);
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $this->assertSame('', get_post_meta($id, 'archived_at', true));
        $this->assertNotEmpty(get_post_meta($id, 'restored_at', true));
    }

    public function test_batch_archive_endpoint_stamps_archived_at() {
        $this->set_admin_user();
        $a = $this->create_campaign('active');
        $b = $this->create_campaign('active');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/campaigns/batch');
        $request->set_param('action', 'archive');
        $request->set_param('ids', [$a, $b]);
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $this->assertNotEmpty(get_post_meta($a, 'archived_at', true));
        $this->assertNotEmpty(get_post_meta($b, 'archived_at', true));
    }

    public function test_update_endpoint_to_archived_stamps_archived_at() {
        $this->set_admin_user();
        $id = $this->create_campaign('active');

        $request = new WP_REST_Request('PUT', "/wp-super-gallery/v1/campaigns/{$id}");
        $request->set_param('id', $id);
        $request->set_param('status', 'archived');
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $this->assertNotEmpty(
            get_post_meta($id, 'archived_at', true),
            'Setting status=archived via the update endpoint must stamp archived_at'
        );
    }
}
