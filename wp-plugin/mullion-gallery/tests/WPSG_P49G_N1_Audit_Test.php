<?php
/**
 * P49-G: N+1 audit harness for get_campaigns_for_attachment_id().
 *
 * Asserts the O(N) query bound and verifies the performance-cliff warning fires
 * when more than 50 campaigns are scanned. The O(1) rewrite is deferred to
 * Phase 50+ and requires extending wpsg_media_refs with an attachment-ID index.
 */

class WPSG_P49G_N1_Audit_Test extends WP_UnitTestCase {

    private const ATTACHMENT_ID = 9001;

    /**
     * Create N campaigns each containing ATTACHMENT_ID in their media_items meta.
     *
     * @return int[] Created campaign post IDs.
     */
    private function create_campaigns_with_attachment(int $n): array {
        $ids = [];
        for ($i = 1; $i <= $n; $i++) {
            $campaign_id = wp_insert_post([
                'post_type'   => 'wpsg_campaign',
                'post_title'  => "P49G Test Campaign $i",
                'post_status' => 'publish',
            ]);
            update_post_meta((int) $campaign_id, 'media_items', [
                [
                    'id'           => "p49g-media-$i",
                    'attachmentId' => self::ATTACHMENT_ID,
                ],
            ]);
            $ids[] = (int) $campaign_id;
        }
        return $ids;
    }

    // ── Correctness ───────────────────────────────────────────────────────────

    public function test_returns_all_matching_campaigns_n10(): void {
        $this->create_campaigns_with_attachment(10);

        $result = WPSG_DB::get_campaigns_for_attachment_id(self::ATTACHMENT_ID);

        $this->assertCount(10, $result);
        $this->assertArrayHasKey('id', $result[0]);
        $this->assertArrayHasKey('title', $result[0]);
    }

    public function test_returns_empty_for_unknown_attachment(): void {
        $this->create_campaigns_with_attachment(5);

        $result = WPSG_DB::get_campaigns_for_attachment_id(999999);

        $this->assertSame([], $result);
    }

    public function test_does_not_return_trashed_campaigns(): void {
        $campaign_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'Trashed',
            'post_status' => 'trash',
        ]);
        update_post_meta((int) $campaign_id, 'media_items', [
            ['id' => 'x', 'attachmentId' => self::ATTACHMENT_ID],
        ]);

        $result = WPSG_DB::get_campaigns_for_attachment_id(self::ATTACHMENT_ID);

        $this->assertSame([], $result);
    }

    // ── Query-count (O(N) bound) ───────────────────────────────────────────────

    /**
     * With N=10 campaigns, the function should issue ≤ 2N+2 SQL queries.
     *
     * Actual breakdown (worst-case, cache cleared): 1 SELECT campaigns + N
     * get_post_meta queries + N get_post/get_the_title queries = 2N+1.
     * wp_cache_flush() is called to prevent WP's per-request object cache from
     * hiding the real O(N) behaviour behind 0-query cache hits.
     *
     * TODO(P50): the O(1) rewrite replaces this O(N) scan with a DB join.
     */
    public function test_query_bound_n10(): void {
        global $wpdb;
        $this->create_campaigns_with_attachment(10);
        wp_cache_flush();

        $before = $wpdb->num_queries;
        WPSG_DB::get_campaigns_for_attachment_id(self::ATTACHMENT_ID);
        $query_count = $wpdb->num_queries - $before;

        // Bound: 2N+2 (2*10+2 = 22).
        $this->assertLessThanOrEqual(
            22,
            $query_count,
            "Expected ≤ 2N+2 queries for N=10, got $query_count"
        );
    }

    /**
     * With N=50 campaigns, the function should issue ≤ 2N+2 SQL queries (102).
     */
    public function test_query_bound_n50(): void {
        global $wpdb;
        $this->create_campaigns_with_attachment(50);
        wp_cache_flush();

        $before = $wpdb->num_queries;
        WPSG_DB::get_campaigns_for_attachment_id(self::ATTACHMENT_ID);
        $query_count = $wpdb->num_queries - $before;

        // Bound: 2N+2 (2*50+2 = 102).
        $this->assertLessThanOrEqual(
            102,
            $query_count,
            "Expected ≤ 2N+2 queries for N=50, got $query_count"
        );
    }

    // ── Performance-cliff warning ─────────────────────────────────────────────

    /**
     * With N=100 campaigns, the function exceeds the 50-campaign threshold and
     * should emit a _doing_it_wrong() warning (tracked by WP_UnitTestCase).
     * Bound: 2N+2 (2*100+2 = 202).
     */
    public function test_warning_fires_at_n100(): void {
        global $wpdb;
        $this->create_campaigns_with_attachment(100);
        wp_cache_flush();

        $this->setExpectedIncorrectUsage('WPSG_DB::get_campaigns_for_attachment_id');

        $before = $wpdb->num_queries;
        $result = WPSG_DB::get_campaigns_for_attachment_id(self::ATTACHMENT_ID);
        $query_count = $wpdb->num_queries - $before;

        $this->assertCount(100, $result);
        $this->assertLessThanOrEqual(
            202,
            $query_count,
            "Expected ≤ 2N+2 queries for N=100, got $query_count"
        );
    }

    /**
     * With N=50 campaigns (exactly at threshold), no warning should fire.
     * The test passes if tearDown does not detect an unexpected doing_it_wrong call.
     */
    public function test_no_warning_at_n50(): void {
        $this->create_campaigns_with_attachment(50);

        $result = WPSG_DB::get_campaigns_for_attachment_id(self::ATTACHMENT_ID);

        $this->assertCount(50, $result);
    }
}
