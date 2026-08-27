<?php

/**
 * P75-J: creating a space whose slug is already taken.
 *
 * The spaces table has UNIQUE KEY slug, and the admin "delete" button archives
 * rather than hard-deletes — so the archived row kept the slug and re-creating a
 * space with the same name failed the INSERT, which create_space() reported as a
 * bare "Failed to create space" with no mention of the slug.
 *
 * Covers:
 *  - archived holder  → 201, slug suffixed (-2, -3, …), archived row untouched.
 *  - active holder    → 409 mullion_space_slug_exists, naming the existing space.
 *  - over-long name   → 201 with a slug clamped to the varchar(100) column.
 *  - empty-ish name   → 201 with a non-empty fallback slug.
 */
class Mullion_P75J_Space_Slug_Reuse_Test extends WP_UnitTestCase {

    private function set_admin_user(): int {
        $user_id = self::factory()->user->create(['role' => 'administrator']);
        $user    = get_user_by('id', $user_id);
        $user->add_cap('manage_mullion');
        wp_set_current_user($user_id);
        return $user_id;
    }

    public function setUp(): void {
        parent::setUp();
        $this->set_admin_user();
    }

    private function create(string $name, ?string $slug = null): WP_REST_Response {
        $request = new WP_REST_Request('POST', '/mullion-gallery/v1/spaces');
        $request->set_header('Content-Type', 'application/json');
        $body = ['name' => $name];
        if ($slug !== null) {
            $body['slug'] = $slug;
        }
        $request->set_body(wp_json_encode($body));
        return rest_do_request($request);
    }

    private function archive(int $space_id): WP_REST_Response {
        return rest_do_request(new WP_REST_Request('DELETE', "/mullion-gallery/v1/spaces/{$space_id}"));
    }

    /** Read a slug straight from the DB, bypassing the get_space() cache. */
    private function persisted_slug(int $space_id): string {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL
        return (string) $wpdb->get_var($wpdb->prepare(
            'SELECT slug FROM ' . Mullion_DB::get_spaces_table() . ' WHERE id = %d',
            $space_id
        ));
    }

    // ── The reported bug ──────────────────────────────────────────────────────

    public function test_recreating_an_archived_spaces_name_succeeds_with_a_suffixed_slug() {
        $first = $this->create('P75J Reuse');
        $this->assertSame(201, $first->get_status());
        $first_id = $first->get_data()['id'];
        $this->assertSame('p75j-reuse', $first->get_data()['slug']);

        $this->assertSame(200, $this->archive($first_id)->get_status());

        $second = $this->create('P75J Reuse');
        $this->assertSame(201, $second->get_status(), 're-creating an archived space\'s name must succeed');
        $this->assertSame('p75j-reuse-2', $second->get_data()['slug'], 'the slug is suffixed, not rejected');
        $this->assertSame('P75J Reuse', $second->get_data()['name'], 'the name the user typed is kept verbatim');
    }

    public function test_the_archived_row_is_left_untouched_by_the_re_create() {
        $first_id = $this->create('P75J Untouched')->get_data()['id'];
        $this->archive($first_id);
        $this->create('P75J Untouched');

        // Mullion_Embed resolves spaces by slug (space="…"), so the archived
        // row's slug must not be rewritten to free the name.
        $this->assertSame('p75j-untouched', $this->persisted_slug($first_id));
        $archived = Mullion_DB::get_space($first_id);
        $this->assertSame(1, intval($archived->archived), 'the archived row stays archived');
    }

    public function test_suffix_increments_across_repeated_archive_and_recreate() {
        $ids = [];
        foreach (['p75j-repeat', 'p75j-repeat-2'] as $expected) {
            $res = $this->create('P75J Repeat');
            $this->assertSame(201, $res->get_status());
            $this->assertSame($expected, $res->get_data()['slug']);
            $ids[] = $res->get_data()['id'];
            $this->archive(end($ids));
        }

        $third = $this->create('P75J Repeat');
        $this->assertSame(201, $third->get_status());
        $this->assertSame('p75j-repeat-3', $third->get_data()['slug']);
    }

    // ── An active holder is a hard error, not a silent suffix ─────────────────

    public function test_colliding_with_an_active_space_returns_409_naming_it() {
        $this->assertSame(201, $this->create('P75J Active')->get_status());

        $second = $this->create('P75J Active');
        $this->assertSame(409, $second->get_status(), 'a visible collision must not be silently suffixed');
        $data = $second->get_data();
        $this->assertSame('mullion_space_slug_exists', $data['code']);
        $this->assertStringContainsString('p75j-active', $data['message'], 'the message names the slug');
        $this->assertStringContainsString('P75J Active', $data['message'], 'the message names the existing space');
    }

    public function test_an_explicit_slug_colliding_with_an_active_space_returns_409() {
        $this->create('P75J Explicit Original', 'p75j-explicit');

        $second = $this->create('Some Other Name', 'p75j-explicit');
        $this->assertSame(409, $second->get_status());
        $this->assertSame('mullion_space_slug_exists', $second->get_data()['code']);
    }

    // ── The other failures the generic 500 used to swallow ────────────────────

    public function test_a_long_name_creates_with_a_clamped_slug() {
        $long = str_repeat('Mullion Space ', 18); // 252 chars: fits `name`, slug far past varchar(100)
        $res  = $this->create($long);

        $this->assertSame(201, $res->get_status(), 'a long name must not fail the INSERT');
        $slug = $res->get_data()['slug'];
        $this->assertLessThanOrEqual(100, strlen($slug));
        $this->assertNotSame('', $slug);
        $this->assertSame($slug, $this->persisted_slug($res->get_data()['id']));
    }

    public function test_a_name_past_the_column_width_is_rejected_with_a_readable_400() {
        // `name` is varchar(255). Unlike the slug this is the user's own text, so
        // it is reported rather than truncated — and never reaches the INSERT.
        $res = $this->create(str_repeat('Mullion Space ', 20)); // 280 chars

        $this->assertSame(400, $res->get_status());
        $this->assertSame('mullion_space_name_too_long', $res->get_data()['code']);
        $this->assertStringContainsString('255', $res->get_data()['message']);
    }

    public function test_a_name_that_sanitises_to_nothing_still_gets_a_slug() {
        $res = $this->create('!!! ???');
        $this->assertSame(201, $res->get_status());
        $this->assertNotSame('', $res->get_data()['slug']);
    }

    // ── Helper-level checks ───────────────────────────────────────────────────

    public function test_clamp_space_slug_fits_the_column_and_never_returns_empty() {
        $this->assertSame('space', Mullion_DB::clamp_space_slug('!!!'));
        $this->assertSame('already-short', Mullion_DB::clamp_space_slug('Already Short'));

        $clamped = Mullion_DB::clamp_space_slug(str_repeat('a', 150));
        $this->assertSame(100, strlen($clamped));
    }

    public function test_unique_space_slug_leaves_a_free_slug_alone() {
        $this->assertSame('p75j-free', Mullion_DB::unique_space_slug('p75j-free'));
    }

    public function test_unique_space_slug_suffix_still_fits_the_column() {
        $base = str_repeat('b', 100);
        Mullion_DB::insert_space(['name' => 'Long', 'slug' => $base, 'isolation_mode' => 'open']);

        $next = Mullion_DB::unique_space_slug($base);
        $this->assertNotSame($base, $next);
        $this->assertLessThanOrEqual(100, strlen($next));
        $this->assertStringEndsWith('-2', $next);
    }
}
