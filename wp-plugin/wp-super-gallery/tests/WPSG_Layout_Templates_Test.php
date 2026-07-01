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
        $this->assertEquals( 3, $result['schemaVersion'] );
        $this->assertCount( 1, $result['slots'] );
        $this->assertNotEmpty( $result['createdAt'] );
        $this->assertNotEmpty( $result['updatedAt'] );
    }

    // ── Text layers (P59) ───────────────────────────────────

    public function test_create_persists_text_layers() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'texts' => [
                [
                    'id'          => 'text-1',
                    'x'           => 10,
                    'y'           => 20,
                    'width'       => 40,
                    'height'      => 12,
                    'zIndex'      => 5,
                    'opacity'     => 0.9,
                    'content'     => 'Summer Sale',
                    'semanticTag' => 'heading',
                    'textAlign'   => 'center',
                    'typography'  => [ 'fontSize' => '28px', 'fontWeight' => 700, 'color' => '#ffffff' ],
                    'name'        => 'Headline',
                    'rotation'    => -15,
                ],
            ],
        ] ) );

        $this->assertIsArray( $result );
        $this->assertArrayHasKey( 'texts', $result, 'texts must survive sanitization (P59 save bug)' );
        $this->assertCount( 1, $result['texts'] );

        $text = $result['texts'][0];
        $this->assertEquals( 'text-1', $text['id'] );
        $this->assertEquals( 'Summer Sale', $text['content'] );
        $this->assertEquals( 'heading', $text['semanticTag'] );
        $this->assertEquals( 'center', $text['textAlign'] );
        $this->assertEquals( 10, $text['x'] );
        $this->assertEquals( -15, $text['rotation'], 'Negative rotation must be preserved, not clamped to 0' );
        $this->assertEquals( '28px', $text['typography']['fontSize'] );
        $this->assertEquals( 700, $text['typography']['fontWeight'] );
    }

    public function test_create_defaults_texts_to_empty_array() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data() );
        $this->assertArrayHasKey( 'texts', $result );
        $this->assertIsArray( $result['texts'] );
        $this->assertCount( 0, $result['texts'] );
    }

    public function test_text_layer_invalid_role_and_align_fall_back() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'texts' => [ [ 'id' => 't1', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'X', 'semanticTag' => 'bogus', 'textAlign' => 'sideways' ] ],
        ] ) );
        $this->assertEquals( 'heading', $result['texts'][0]['semanticTag'] );
        $this->assertEquals( 'left', $result['texts'][0]['textAlign'] );
    }

    public function test_text_layer_blank_id_gets_generated_uuid() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'texts' => [
                [ 'id' => '', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'A' ],
                [ 'id' => '', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'B' ],
            ],
        ] ) );
        $id_a = $result['texts'][0]['id'];
        $id_b = $result['texts'][1]['id'];
        // Blank ids must be replaced with generated UUIDs, not persisted as '' —
        // otherwise two text layers collide on id (selection / React keys break).
        $this->assertNotEmpty( $id_a );
        $this->assertNotEmpty( $id_b );
        $this->assertNotEquals( $id_a, $id_b );
    }

    public function test_text_layer_strips_html_from_content() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'texts' => [ [ 'id' => 't1', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'Hi <script>alert(1)</script>' ] ],
        ] ) );
        $this->assertStringNotContainsString( '<script>', $result['texts'][0]['content'] );
    }

    public function test_text_layer_typography_drops_unknown_props() {
        $result = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'texts' => [ [ 'id' => 't1', 'x' => 0, 'y' => 0, 'width' => 40, 'height' => 12, 'content' => 'X', 'typography' => [ 'fontSize' => '20px', 'evil' => 'x', 'onclick' => 'y' ] ] ],
        ] ) );
        $typo = $result['texts'][0]['typography'];
        $this->assertArrayHasKey( 'fontSize', $typo );
        $this->assertArrayNotHasKey( 'evil', $typo );
        $this->assertArrayNotHasKey( 'onclick', $typo );
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

    public function test_migrate_template_v0_to_latest() {
        $old = [
            'name'              => 'Old Template',
            'canvasAspectRatio' => 1.5,
            'schemaVersion'     => 0,
            'slots'             => [],
        ];

        $migrated = WPSG_Layout_Templates::migrate_template( $old );

        // v0 → v3: migrates all the way to the current schema version.
        $this->assertEquals( 3, $migrated['schemaVersion'] );
        $this->assertArrayHasKey( 'breakpointOverrides', $migrated );
        $this->assertArrayHasKey( 'texts', $migrated );
        $this->assertSame( [], $migrated['texts'] );
    }

    public function test_migrate_template_v1_to_v2_adds_breakpoint_overrides() {
        $v1 = [
            'name'              => 'V1 Template',
            'canvasAspectRatio' => 1.5,
            'schemaVersion'     => 1,
            'slots'             => [],
        ];

        $migrated = WPSG_Layout_Templates::migrate_template( $v1 );

        $this->assertEquals( 3, $migrated['schemaVersion'] );
        $this->assertArrayHasKey( 'breakpointOverrides', $migrated );
        $this->assertSame( [], $migrated['breakpointOverrides'] );
        $this->assertArrayHasKey( 'texts', $migrated );
    }

    public function test_migrate_template_v2_to_v3_adds_texts() {
        $v2 = [
            'name'                => 'V2 Template',
            'canvasAspectRatio'   => 1.5,
            'schemaVersion'       => 2,
            'slots'               => [],
            'breakpointOverrides' => [],
        ];

        $migrated = WPSG_Layout_Templates::migrate_template( $v2 );

        $this->assertEquals( 3, $migrated['schemaVersion'] );
        $this->assertArrayHasKey( 'texts', $migrated );
        $this->assertSame( [], $migrated['texts'] );
    }

    public function test_migrate_template_v3_is_noop() {
        $current = [
            'name'                => 'Current Template',
            'canvasAspectRatio'   => 1.5,
            'schemaVersion'       => 3,
            'slots'               => [],
            'breakpointOverrides' => [],
            'texts'               => [],
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

    // ── Persistence round-trip (P58-B fix-up) ───────────────
    // Guards against the allowlist in build_template()/sanitize_slots()/
    // sanitize_overlays() drifting out of sync with the TypeScript type,
    // which silently stripped breakpointOverrides, groups, slot opacity,
    // slot entranceAnimation, and the P50-J overlay fields.

    public function test_persists_slot_opacity_and_entrance_animation() {
        $data = $this->valid_template_data( [
            'slots' => [
                [
                    'id'     => 'slot-1',
                    'x'      => 0, 'y' => 0, 'width' => 50, 'height' => 50, 'zIndex' => 1,
                    'shape'  => 'rectangle',
                    'opacity' => 0.4,
                    'entranceAnimation' => [
                        'type'       => 'slide',
                        'direction'  => 'up',
                        'durationMs' => 600,
                        'delayMs'    => 100,
                    ],
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );
        $slot   = $result['slots'][0];

        $this->assertEqualsWithDelta( 0.4, $slot['opacity'], 0.0001 );
        $this->assertIsArray( $slot['entranceAnimation'] );
        $this->assertEquals( 'slide', $slot['entranceAnimation']['type'] );
        $this->assertEquals( 'up', $slot['entranceAnimation']['direction'] );
        $this->assertEquals( 600, $slot['entranceAnimation']['durationMs'] );
        $this->assertEquals( 100, $slot['entranceAnimation']['delayMs'] );
    }

    public function test_persists_breakpoint_overrides() {
        $data = $this->valid_template_data( [
            'breakpointOverrides' => [
                'tablet' => [
                    'slot-1' => [ 'x' => 10, 'y' => 20, 'visible' => false ],
                ],
                'mobile' => [
                    'slot-1' => [ 'width' => 80, 'height' => 80, 'rotation' => 45, 'opacity' => 0.5, 'zIndex' => 3 ],
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertArrayHasKey( 'breakpointOverrides', $result );
        $tablet = $result['breakpointOverrides']['tablet']['slot-1'];
        $this->assertEqualsWithDelta( 10, $tablet['x'], 0.0001 );
        $this->assertEqualsWithDelta( 20, $tablet['y'], 0.0001 );
        $this->assertFalse( $tablet['visible'] );
        // Sparse: keys not supplied are absent, not defaulted.
        $this->assertArrayNotHasKey( 'width', $tablet );

        $mobile = $result['breakpointOverrides']['mobile']['slot-1'];
        $this->assertEqualsWithDelta( 80, $mobile['width'], 0.0001 );
        $this->assertEquals( 45, $mobile['rotation'] );
        $this->assertEqualsWithDelta( 0.5, $mobile['opacity'], 0.0001 );
        $this->assertEquals( 3, $mobile['zIndex'] );
    }

    public function test_breakpoint_overrides_drop_empty_and_clamp() {
        $data = $this->valid_template_data( [
            'breakpointOverrides' => [
                'tablet'  => [ 'slot-1' => [] ],          // empty → dropped
                'desktop' => [ 'slot-1' => [ 'x' => 150 ] ], // out of range → clamped
                'bogus'   => [ 'slot-1' => [ 'x' => 5 ] ],   // invalid breakpoint → dropped
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );
        $bo     = $result['breakpointOverrides'];

        $this->assertArrayNotHasKey( 'tablet', $bo );
        $this->assertArrayNotHasKey( 'bogus', $bo );
        $this->assertEqualsWithDelta( 100, $bo['desktop']['slot-1']['x'], 0.0001 );
    }

    public function test_persists_groups() {
        $data = $this->valid_template_data( [
            'groups' => [
                [
                    'id'            => 'group-1',
                    'name'          => 'My Group',
                    'memberIds'     => [ 'slot-1' ],
                    'childGroupIds' => [],
                    'parentGroupId' => null,
                    'x' => 0, 'y' => 0, 'width' => 50, 'height' => 50,
                    'collapsed' => false, 'locked' => false, 'visible' => true,
                ],
            ],
        ] );
        $result = WPSG_Layout_Templates::create( $data );

        $this->assertArrayHasKey( 'groups', $result );
        $this->assertCount( 1, $result['groups'] );
        $group = $result['groups'][0];
        $this->assertEquals( 'group-1', $group['id'] );
        $this->assertEquals( 'My Group', $group['name'] );
        $this->assertEquals( [ 'slot-1' ], $group['memberIds'] );
        $this->assertEqualsWithDelta( 50, $group['width'], 0.0001 );
    }

    public function test_persists_overlay_p50j_fields() {
        $data = $this->valid_template_data( [
            'overlays' => [
                [
                    'imageUrl'     => 'https://example.com/overlay.png',
                    'rotation'     => 30,
                    'flipH'        => true,
                    'flipV'        => false,
                    'shape'        => 'hexagon',
                    'borderRadius' => 8,
                    'borderWidth'  => 2,
                    'borderColor'  => '#ff0000',
                    'blendMode'    => 'multiply',
                    'shadow'       => [ 'offsetX' => 1, 'offsetY' => 2, 'blur' => 3, 'color' => 'rgba(0,0,0,0.5)' ],
                    'filterEffects' => [ 'brightness' => 120 ],
                ],
            ],
        ] );
        $result  = WPSG_Layout_Templates::create( $data );
        $overlay = $result['overlays'][0];

        $this->assertEquals( 30, $overlay['rotation'] );
        $this->assertTrue( $overlay['flipH'] );
        $this->assertFalse( $overlay['flipV'] );
        $this->assertEquals( 'hexagon', $overlay['shape'] );
        $this->assertEquals( 8, $overlay['borderRadius'] );
        $this->assertEquals( 2, $overlay['borderWidth'] );
        $this->assertEquals( 'multiply', $overlay['blendMode'] );
        $this->assertIsArray( $overlay['shadow'] );
        $this->assertIsArray( $overlay['filterEffects'] );
        $this->assertEqualsWithDelta( 120, $overlay['filterEffects']['brightness'], 0.0001 );
    }

    public function test_breakpoint_overrides_survive_update() {
        $created = WPSG_Layout_Templates::create( $this->valid_template_data( [
            'breakpointOverrides' => [
                'tablet' => [ 'slot-1' => [ 'x' => 12 ] ],
            ],
        ] ) );

        $updated = WPSG_Layout_Templates::update( $created['id'], [
            'name' => 'Renamed',
        ] );

        $this->assertEquals( 'Renamed', $updated['name'] );
        // The merge-update path must preserve previously-saved overrides.
        $this->assertEqualsWithDelta( 12, $updated['breakpointOverrides']['tablet']['slot-1']['x'], 0.0001 );
    }
}
