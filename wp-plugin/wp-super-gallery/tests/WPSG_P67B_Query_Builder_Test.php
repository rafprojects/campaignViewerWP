<?php

/**
 * P67-B: direct unit tests for the pure builders extracted from
 * WPSG_Campaign_Controller::list_campaigns() — build_campaign_query_args() and
 * build_campaign_cache_key(). These pin the WP_Query args and cache keys so the
 * extraction is provably behavior-preserving.
 */
class WPSG_P67B_Query_Builder_Test extends WP_UnitTestCase {

    private function filters(array $overrides = []): array {
        return array_merge([
            'status'           => '',
            'visibility'       => '',
            'company'          => '',
            'search'           => '',
            'include_media'    => false,
            'page'             => 1,
            'per_page'         => 10,
            'category'         => '',
            'tag'              => '',
            'sort'             => 'created_desc',
            'include_archived' => false,
            'template_id'      => '',
            'space'            => '',
        ], $overrides);
    }

    private function build_args(array $filters, bool $is_admin, int $user_id): array {
        $m = new ReflectionMethod('WPSG_Campaign_Controller', 'build_campaign_query_args');
        $m->setAccessible(true);
        return $m->invoke(null, $filters, $is_admin, $user_id);
    }

    private function build_key(array $filters, int $user_id, bool $is_admin): string {
        $m = new ReflectionMethod('WPSG_Campaign_Controller', 'build_campaign_cache_key');
        $m->setAccessible(true);
        return $m->invoke(null, $filters, $user_id, $is_admin);
    }

    // ── build_campaign_query_args ────────────────────────────────────────────

    public function test_admin_args_have_no_scoping_or_schedule_window() {
        $args = $this->build_args($this->filters(), true, 1);

        $this->assertSame('wpsg_campaign', $args['post_type']);
        $this->assertSame('publish', $args['post_status']);
        $this->assertArrayNotHasKey('post__in', $args, 'admin is unscoped');

        // Template-exclusion clause is always first.
        $this->assertSame(WPSG_Campaign_Templates::META_IS_TEMPLATE, $args['meta_query'][0]['key']);
        $this->assertSame('NOT EXISTS', $args['meta_query'][0]['compare']);

        // No schedule-window (publish_at/unpublish_at) clauses for an admin.
        $serialized = wp_json_encode($args['meta_query']);
        $this->assertStringNotContainsString('publish_at', $serialized);
    }

    public function test_anonymous_args_add_public_visibility_and_schedule_window() {
        $args = $this->build_args($this->filters(), false, 0);

        $this->assertArrayNotHasKey('post__in', $args);
        $serialized = wp_json_encode($args['meta_query']);
        $this->assertStringContainsString('"value":"public"', $serialized);
        $this->assertStringContainsString('publish_at', $serialized);
        $this->assertStringContainsString('unpublish_at', $serialized);

        // The relation fixup marks the multi-clause meta_query as AND.
        $this->assertSame('AND', $args['meta_query']['relation']);
    }

    public function test_authenticated_nonadmin_scopes_by_post_in() {
        $user_id = self::factory()->user->create(['role' => 'subscriber']);
        $args = $this->build_args($this->filters(), false, $user_id);

        // A subscriber with no accessible campaigns collapses to post__in [0].
        $this->assertArrayHasKey('post__in', $args);
        $this->assertSame([0], $args['post__in']);
    }

    public function test_explicit_status_overrides_archived_default() {
        $args = $this->build_args($this->filters(['status' => 'active']), true, 1);
        $serialized = wp_json_encode($args['meta_query']);
        $this->assertStringContainsString('"value":"active"', $serialized);
        // With an explicit status, the default archived-exclusion clause is not added.
        $this->assertStringNotContainsString('archived', $serialized);
    }

    public function test_space_and_taxonomy_filters() {
        $args = $this->build_args(
            $this->filters(['space' => '5', 'company' => 'acme', 'category' => 'cat', 'tag' => 'tg']),
            true,
            1
        );

        $this->assertStringContainsString('_wpsg_space_id', wp_json_encode($args['meta_query']));
        $this->assertArrayHasKey('tax_query', $args);
        $this->assertSame('AND', $args['tax_query']['relation']);
    }

    public function test_sort_mapping() {
        $a = $this->build_args($this->filters(['sort' => 'title_asc']), true, 1);
        $this->assertSame('title', $a['orderby']);
        $this->assertSame('ASC', $a['order']);

        $b = $this->build_args($this->filters(['sort' => 'updated_desc']), true, 1);
        $this->assertSame('modified', $b['orderby']);
        $this->assertSame('DESC', $b['order']);

        $c = $this->build_args($this->filters(['sort' => 'anything_else']), true, 1);
        $this->assertSame('date', $c['orderby']); // default = created_desc
        $this->assertSame('DESC', $c['order']);
    }

    // ── build_campaign_cache_key ─────────────────────────────────────────────

    public function test_cache_key_is_stable_for_same_inputs() {
        $k1 = $this->build_key($this->filters(), 1, true);
        $k2 = $this->build_key($this->filters(), 1, true);
        $this->assertSame($k1, $k2);
        $this->assertStringStartsWith('wpsg_campaigns_', $k1);
    }

    public function test_cache_key_varies_by_filter_user_and_admin_flag() {
        $base = $this->build_key($this->filters(), 1, true);

        $this->assertNotSame($base, $this->build_key($this->filters(['page' => 2]), 1, true));
        $this->assertNotSame($base, $this->build_key($this->filters(['space' => '9']), 1, true));
        $this->assertNotSame($base, $this->build_key($this->filters(), 2, true), 'user id is in the key');
        $this->assertNotSame($base, $this->build_key($this->filters(), 1, false), 'admin flag is in the key');
    }
}
