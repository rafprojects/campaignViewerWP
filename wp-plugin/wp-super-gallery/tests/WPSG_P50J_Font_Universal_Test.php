<?php

/**
 * P50-J: Universal font visibility (fonts parity with the P50-I overlay flag).
 *
 * Covers:
 *  - A universal font is visible in a delegated space that has NO association
 *    row for it (it bypasses the P50-B per-space filter).
 *  - A non-universal, unassociated font stays hidden in that space.
 *  - Open-mode spaces (and unscoped requests) are unchanged.
 *  - WPSG_Font_Library::set_universal() round-trips and get_all() reflects it;
 *    add() persists the flag; get_all() normalizes a bool for legacy entries.
 *  - REST POST /admin/font-library/{id} toggles the flag; 404 for unknown id;
 *    400 when is_universal is absent.
 */
class WPSG_P50J_Font_Universal_Test extends WP_UnitTestCase {

    public function tear_down(): void {
        delete_option( WPSG_Font_Library::OPTION_KEY );
        parent::tear_down();
    }

    private function set_super_admin(): int {
        $user_id = self::factory()->user->create([ 'role' => 'administrator' ]);
        $user = get_user_by('id', $user_id);
        $user->add_cap('manage_wpsg');
        foreach ( WPSG_CPT::CPT_CAPS as $cap ) {
            $user->add_cap( $cap );
        }
        wp_set_current_user($user_id);
        return $user_id;
    }

    private function make_space(string $iso = 'delegated'): int {
        return WPSG_DB::insert_space([
            'name'           => 'P50J ' . $iso,
            'slug'           => 'p50j-' . wp_generate_password(6, false),
            'isolation_mode' => $iso,
        ]);
    }

    private function add_font(string $name, bool $universal = false): string {
        $entry = WPSG_Font_Library::add([
            'url'          => 'https://example.com/' . sanitize_title($name) . '.woff2',
            'name'         => $name,
            'filename'     => sanitize_title($name) . '.woff2',
            'format'       => 'woff2',
            'is_universal' => $universal,
        ]);
        $this->assertIsArray($entry);
        return $entry['id'];
    }

    private function list_font_ids(?int $space_id = null): array {
        $request = new WP_REST_Request('GET', '/wp-super-gallery/v1/admin/font-library');
        if ($space_id !== null) {
            $request->set_param('space', (string) $space_id);
        }
        $data = rest_do_request($request)->get_data();
        return array_map(fn($item) => $item['id'] ?? '', is_array($data) ? $data : []);
    }

    private function font_is_universal(string $id): bool {
        foreach ( WPSG_Font_Library::get_all() as $item ) {
            if ( ($item['id'] ?? '') === $id ) {
                return ! empty( $item['isUniversal'] );
            }
        }
        return false;
    }

    // ── Universal fonts bypass the per-space association filter ───────────────

    public function test_universal_font_visible_in_delegated_space_without_association() {
        $this->set_super_admin();
        $space     = $this->make_space('delegated');
        $universal = $this->add_font('P50J Universal Font', true);
        $regular   = $this->add_font('P50J Regular Font', false);

        $scoped = $this->list_font_ids($space);

        $this->assertContains($universal, $scoped, 'Universal font must appear without an association row.');
        $this->assertNotContains($regular, $scoped, 'Non-universal, unassociated font must stay hidden.');
    }

    public function test_open_space_unaffected_by_universal_flag() {
        $this->set_super_admin();
        $space   = $this->make_space('open');
        $regular = $this->add_font('P50J Open Regular', false);

        $scoped = $this->list_font_ids($space);
        $this->assertContains($regular, $scoped, 'Open-mode spaces still see the full font library.');
    }

    public function test_unscoped_request_returns_full_library() {
        $this->set_super_admin();
        $regular = $this->add_font('P50J Unscoped Regular', false);

        $all = $this->list_font_ids();
        $this->assertContains($regular, $all, 'Unscoped requests bypass the per-space filter.');
    }

    // ── set_universal() round-trip + add() persistence ───────────────────────

    public function test_add_persists_universal_and_get_all_normalizes_bool() {
        $this->set_super_admin();
        $universal = $this->add_font('P50J Persist Universal', true);
        $regular   = $this->add_font('P50J Persist Regular', false);

        $this->assertTrue($this->font_is_universal($universal));
        $this->assertFalse($this->font_is_universal($regular));
    }

    public function test_set_universal_round_trip() {
        $this->set_super_admin();
        $id = $this->add_font('P50J Toggle Font', false);

        $this->assertFalse($this->font_is_universal($id), 'Should start space-specific.');

        $this->assertTrue(WPSG_Font_Library::set_universal($id, true));
        $this->assertTrue($this->font_is_universal($id), 'Should now be universal.');

        $this->assertTrue(WPSG_Font_Library::set_universal($id, false));
        $this->assertFalse($this->font_is_universal($id), 'Should be space-specific again.');
    }

    public function test_set_universal_unknown_font_returns_false() {
        $this->set_super_admin();
        $this->assertFalse(WPSG_Font_Library::set_universal('00000000-0000-0000-0000-000000000000', true));
    }

    // ── REST update_font ─────────────────────────────────────────────────────

    public function test_rest_update_font_sets_universal() {
        $this->set_super_admin();
        $id = $this->add_font('P50J REST Toggle', false);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/font-library/{$id}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'is_universal' => true ]));
        $response = rest_do_request($request);

        $this->assertSame(200, $response->get_status());
        $this->assertTrue($response->get_data()['isUniversal']);
        $this->assertTrue($this->font_is_universal($id));
    }

    public function test_rest_update_font_unknown_id_404() {
        $this->set_super_admin();
        $missing = '00000000-0000-0000-0000-000000000000';

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/font-library/{$missing}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'is_universal' => true ]));
        $response = rest_do_request($request);

        $this->assertSame(404, $response->get_status());
    }

    public function test_rest_update_font_missing_field_400() {
        $this->set_super_admin();
        $id = $this->add_font('P50J REST NoField', false);

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/admin/font-library/{$id}");
        $request->set_header('Content-Type', 'application/json');
        $request->set_body(wp_json_encode([ 'foo' => 'bar' ]));
        $response = rest_do_request($request);

        $this->assertSame(400, $response->get_status());
    }
}
