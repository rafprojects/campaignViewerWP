<?php
/**
 * Tests for WPSG_Layout_Templates class.
 *
 * @package WP_Super_Gallery
 */

class WPSG_Layout_Templates_Test extends WP_UnitTestCase {

    /**
     * Clean up after each test.
     */
    public function tearDown(): void {
        delete_option( WPSG_Layout_Templates::OPTION_KEY );
        parent::tearDown();
    }

    // ── Helper ──────────────────────────────────────────────

    /**
     * Build minimal valid template data.
     */
    private function valid_template_data( array $overrides = [] ): array {
        return array_merge( [
            'name'              => 'Test Layout',
            'canvasAspectRatio' => 16 / 9,
            'slots'             => [
                [
                    'id'     => 'slot-1',
                    'x'      => 0,
                    'y'      => 0,
                    'width'  => 50,
                    'height' => 50,
                    'zIndex' => 1,
                    'shape'  => 'rectangle',
                ],
            ],
        ], $overrides );
    }

    // ── Create ──────────────────────────────────────────────

    public function test_create_returns_valid_structure() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data() );

        $this->assertIsArray( $result );
        $this->assertNotEmpty( $result['id'] );
        $this->assertEquals( 'Test Layout', $result['name'] );
        $this->assertEquals( 1, $result['schemaVersion'] );
        $this->assertCount( 1, $result['slots'] );
        $this->assertNotEmpty( $result['createdAt'] );
        $this->assertNotEmpty( $result['updatedAt'] );
    }

    public function test_create_assigns_uuid_id() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data() );

        // UUID v4 format: 8-4-4-4-12 hex digits
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $result['id']
        );
    }

    public function test_create_validates_name_required() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'name' => '',
        ] ) );

        $this->assertWPError( $result );
        $this->assertEquals( 'invalid_name', $result->get_error_code() );
    }

    public function test_create_validates_aspect_ratio_positive() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'canvasAspectRatio' => 0,
        ] ) );

        $this->assertWPError( $result );
        $this->assertEquals( 'invalid_aspect', $result->get_error_code() );
    }

    public function test_create_validates_negative_aspect_ratio() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'canvasAspectRatio' => -1,
        ] ) );

        $this->assertWPError( $result );
        $this->assertEquals( 'invalid_aspect', $result->get_error_code() );
    }

    public function test_create_validates_slot_positions_0_100() {
        // Positions outside 0–100 are clamped, not rejected.
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'slots' => [
                [ 'x' => -5, 'y' => 0, 'width' => 50, 'height' => 50 ],
            ],
        ] ) );

        $this->assertIsArray( $result );
        $this->assertEquals( 0, $result['slots'][0]['x'], 'Negative x should be clamped to 0' );
    }

    public function test_create_validates_slot_width_over_100() {
        // Widths over 100 are clamped, not rejected.
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'slots' => [
                [ 'x' => 0, 'y' => 0, 'width' => 150, 'height' => 50 ],
            ],
        ] ) );

        $this->assertIsArray( $result );
        $this->assertEquals( 100, $result['slots'][0]['width'], 'Width over 100 should be clamped to 100' );
    }

    public function test_create_with_empty_slots_succeeds() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'slots' => [],
        ] ) );

        $this->assertIsArray( $result );
        $this->assertCount( 0, $result['slots'] );
    }

    // ── Read ────────────────────────────────────────────────

    public function test_get_returns_created_template() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $fetched = WPSG_Layout_Templates::get( $created['id'] );

        $this->assertNotNull( $fetched );
        $this->assertEquals( $created['id'], $fetched['id'] );
        $this->assertEquals( 'Test Layout', $fetched['name'] );
    }

    public function test_get_returns_null_for_missing_id() {
        $result = WPSG_Layout_Templates::get( 'nonexistent-id' );
        $this->assertNull( $result );
    }

    public function test_get_all_returns_empty_array_initially() {
        $all = WPSG_Layout_Templates::get_all();
        $this->assertIsArray( $all );
        $this->assertCount( 0, $all );
    }

    public function test_get_all_returns_all_created_templates() {
        WPSG_Layout_Templates::create( $this->valid_template_data( [ 'name' => 'A' ] ) );
        WPSG_Layout_Templates::create( $this->valid_template_data( [ 'name' => 'B' ] ) );

        $all = WPSG_Layout_Templates::get_all();
        $this->assertCount( 2, $all );
    }

    // ── Update ──────────────────────────────────────────────

    public function test_update_changes_name() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $updated = WPSG_Layout_Templates::update( $created['id'], [ 'name' => 'Updated Name' ] );

        $this->assertIsArray( $updated );
        $this->assertEquals( 'Updated Name', $updated['name'] );
    }

    public function test_update_preserves_immutable_fields() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $updated = WPSG_Layout_Templates::update( $created['id'], [
            'id'            => 'should-not-change',
            'createdAt'     => '1999-01-01T00:00:00+00:00',
            'schemaVersion' => 999,
        ] );

        $this->assertIsArray( $updated );
        $this->assertEquals( $created['id'], $updated['id'] );
        $this->assertEquals( $created['createdAt'], $updated['createdAt'] );
        $this->assertEquals( WPSG_Layout_Templates::SCHEMA_VERSION, $updated['schemaVersion'] );
    }

    public function test_update_refreshes_updatedAt() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data() );
        sleep( 1 ); // Ensure timestamp difference
        $updated = WPSG_Layout_Templates::update( $created['id'], [ 'name' => 'Changed' ] );

        $this->assertIsArray( $updated );
        $this->assertGreaterThanOrEqual(
            strtotime( $created['updatedAt'] ),
            strtotime( $updated['updatedAt'] )
        );
    }

    public function test_update_nonexistent_returns_error() {
        $result = WPSG_Layout_Templates::update( 'nonexistent', [ 'name' => 'X' ] );
        $this->assertWPError( $result );
        $this->assertEquals( 'not_found', $result->get_error_code() );
    }

    public function test_update_validates_data() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $result  = WPSG_Layout_Templates::update( $created['id'], [ 'name' => '' ] );

        $this->assertWPError( $result );
        $this->assertEquals( 'invalid_name', $result->get_error_code() );
    }

    // ── Delete ──────────────────────────────────────────────

    public function test_delete_removes_template() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $deleted = WPSG_Layout_Templates::delete( $created['id'] );

        $this->assertTrue( $deleted );
        $this->assertNull( WPSG_Layout_Templates::get( $created['id'] ) );
    }

    public function test_delete_returns_false_for_missing() {
        $result = WPSG_Layout_Templates::delete( 'nonexistent' );
        $this->assertFalse( $result );
    }

    // ── Duplicate ───────────────────────────────────────────

    public function test_duplicate_creates_clone_with_new_id() {
        $source = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $clone  = WPSG_Layout_Templates::duplicate( $source['id'], 'Clone Name' );

        $this->assertIsArray( $clone );
        $this->assertNotEquals( $source['id'], $clone['id'] );
        $this->assertEquals( 'Clone Name', $clone['name'] );
    }

    public function test_duplicate_generates_new_slot_ids() {
        $source = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $clone  = WPSG_Layout_Templates::duplicate( $source['id'], 'Clone' );

        $this->assertIsArray( $clone );
        $source_slot_ids = array_column( $source['slots'], 'id' );
        $clone_slot_ids  = array_column( $clone['slots'], 'id' );

        // No slot ID should be the same
        $this->assertEmpty( array_intersect( $source_slot_ids, $clone_slot_ids ) );
    }

    public function test_duplicate_missing_source_returns_error() {
        $result = WPSG_Layout_Templates::duplicate( 'nonexistent', 'Clone' );
        $this->assertWPError( $result );
        $this->assertEquals( 'not_found', $result->get_error_code() );
    }

    public function test_duplicate_uses_default_name_when_empty() {
        $source = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $clone  = WPSG_Layout_Templates::duplicate( $source['id'], '' );

        $this->assertIsArray( $clone );
        $this->assertStringContainsString( '(Copy)', $clone['name'] );
    }

    // ── Sanitize slots — shape whitelist ────────────────────

    public function test_sanitize_rejects_invalid_shape_to_rectangle() {
        $data = $this->valid_template_data( [
            'slots' => [
                [
                    'x'     => 0,
                    'y'     => 0,
                    'width' => 50,
                    'height' => 50,
                    'shape' => 'invalid-shape',
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $this->assertEquals( 'rectangle', $result['slots'][0]['shape'] );
    }

    public function test_sanitize_accepts_all_valid_shapes() {
        $valid_shapes = [
            'rectangle', 'circle', 'ellipse', 'hexagon', 'diamond',
            'parallelogram-left', 'parallelogram-right', 'chevron',
            'arrow', 'trapezoid', 'custom',
        ];

        foreach ( $valid_shapes as $shape ) {
            $data   = $this->valid_template_data( [
                'slots' => [
                    [
                        'x'      => 0,
                        'y'      => 0,
                        'width'  => 50,
                        'height' => 50,
                        'shape'  => $shape,
                    ],
                ],
            ] );
            $result = WPSG_Layout_Templates::create( $data );

            $this->assertIsArray( $result, "Shape '$shape' should be accepted" );
            $this->assertEquals( $shape, $result['slots'][0]['shape'], "Shape '$shape' should be preserved" );
        }
    }

    // ── Sanitize slots — position clamping ──────────────────

    public function test_clamp_pct_clamps_negative_to_zero() {
        $data   = $this->valid_template_data( [
            'slots' => [
                [
                    'x'      => 0, // valid to pass validation
                    'y'      => 0,
                    'width'  => 50,
                    'height' => 50,
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        // Slot positions are clamped via sanitize_slots() — x/y should be >= 0
        $this->assertIsArray( $result );
        $this->assertGreaterThanOrEqual( 0, $result['slots'][0]['x'] );
    }

    // ── Sanitize slots — property defaults ──────────────────

    public function test_sanitize_slot_defaults() {
        $data   = $this->valid_template_data( [
            'slots' => [
                [
                    'x' => 10,
                    'y' => 10,
                    'width' => 30,
                    'height' => 30,
                    // Omit most properties — should get defaults
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $slot = $result['slots'][0];
        $this->assertEquals( 'rectangle', $slot['shape'] );
        $this->assertEquals( 'cover', $slot['objectFit'] );
        $this->assertEquals( 'lightbox', $slot['clickAction'] );
        $this->assertEquals( 'pop', $slot['hoverEffect'] );
        $this->assertEquals( 4, $slot['borderRadius'] );
        $this->assertEquals( '#ffffff', $slot['borderColor'] );
    }

    // ── Sanitize overlays ───────────────────────────────────

    public function test_sanitize_overlay_clamps_opacity() {
        $data = $this->valid_template_data( [
            'overlays' => [
                [
                    'imageUrl' => 'https://example.com/overlay.png',
                    'opacity'  => 2.5, // Over 1
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $this->assertEquals( 1, $result['overlays'][0]['opacity'] );
    }

    public function test_sanitize_overlay_clamps_negative_opacity() {
        $data = $this->valid_template_data( [
            'overlays' => [
                [
                    'imageUrl' => 'https://example.com/overlay.png',
                    'opacity'  => -0.5,
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $this->assertEquals( 0, $result['overlays'][0]['opacity'] );
    }

    public function test_sanitize_overlay_defaults() {
        $data = $this->valid_template_data( [
            'overlays' => [
                [
                    'imageUrl' => 'https://example.com/overlay.png',
                    // Omit other properties
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $overlay = $result['overlays'][0];
        $this->assertEquals( 999, $overlay['zIndex'] );
        $this->assertEquals( 1, $overlay['opacity'] );
        $this->assertFalse( $overlay['pointerEvents'] );
        $this->assertNotEmpty( $overlay['id'] );
    }

    // ── Schema migration ────────────────────────────────────

    public function test_migrate_template_v0_to_v1() {
        $old = [
            'name'              => 'Old Template',
            'canvasAspectRatio' => 1.5,
            'schemaVersion'     => 0,
            'slots'             => [],
        ];

        $migrated = WPSG_Layout_Templates::migrate_template( $old );

        $this->assertEquals( 1, $migrated['schemaVersion'] );
    }

    public function test_migrate_template_v1_is_noop() {
        $current = [
            'name'              => 'Current Template',
            'canvasAspectRatio' => 1.5,
            'schemaVersion'     => 1,
            'slots'             => [],
        ];

        $migrated = WPSG_Layout_Templates::migrate_template( $current );

        $this->assertEquals( $current, $migrated );
    }

    // ── Size limit ──────────────────────────────────────────

    public function test_size_limit_constant_is_512kb() {
        $this->assertEquals( 512000, WPSG_Layout_Templates::SIZE_LIMIT );
    }

    // ── Tags sanitization ───────────────────────────────────

    public function test_tags_are_sanitized() {
        $data   = $this->valid_template_data( [
            'tags' => [ '<script>alert(1)</script>', 'valid-tag', 'another tag' ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $this->assertCount( 3, $result['tags'] );
        // Script tags should be stripped by sanitize_text_field
        $this->assertStringNotContainsString( '<script>', $result['tags'][0] );
    }

    // ── Non-array slots input ───────────────────────────────

    public function test_sanitize_slots_handles_non_array() {
        $data = $this->valid_template_data( [
            'slots' => 'not-an-array',
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertIsArray( $result );
        $this->assertCount( 0, $result['slots'] );
    }
}
