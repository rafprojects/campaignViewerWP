<?php
/**
 * WP Super Gallery — Layout Templates CRUD
 *
 * Manages globally-stored layout templates via the
 * `wpsg_layout_templates` WP option. Each template defines
 * a canvas with positioned media slots.
 *
 * @package WP_Super_Gallery
 * @since   0.13.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WPSG_Layout_Templates {

    /**
     * WP option key storing the global template library.
     */
    const OPTION_KEY = 'wpsg_layout_templates';

    /**
     * Current schema version for templates.
     *
     * v2 (P58-B): per-breakpoint slot overrides (`breakpointOverrides`).
     * v3 (P59):   first-class text layers (`texts`).
     */
    const SCHEMA_VERSION = 3;

    /**
     * Maximum serialized size (bytes) before emitting an admin notice.
     * 500 KB — beyond this, recommend migrating to a dedicated table.
     */
    const SIZE_LIMIT = 512000;

    // ── CSS Sanitization (P20-C) ─────────────────────────────

    /**
     * Allowlist-based CSS value sanitizer.
     *
     * Rejects any value containing known CSS-injection vectors (url(), expression(),
     * javascript:, semicolons, backslashes). Then validates the value against a
     * type-specific pattern allowing only safe CSS constructs.
     *
     * @since 0.18.0 P20-C
     *
     * @param  string $value Raw CSS value.
     * @param  string $type  One of 'color', 'clip-path', 'position', or 'generic'.
     * @return string Sanitized value, or empty string if unsafe.
     */
    public static function sanitize_css_value( string $value, string $type = 'generic' ): string {
        $value = trim( $value );

        if ( $value === '' ) {
            return '';
        }

        // ── Universal blocklist ──
        // Reject values with injection patterns regardless of declared type.
        if ( preg_match( '/[;\\\\]|url\s*\(|expression\s*\(|javascript\s*:|@import|behavior\s*:|var\s*\(|-moz-binding/i', $value ) ) {
            return '';
        }

        // Reject unbalanced parentheses (potential truncation attacks).
        if ( substr_count( $value, '(' ) !== substr_count( $value, ')' ) ) {
            return '';
        }

        switch ( $type ) {
            case 'color':
                // Hex (#RGB, #RRGGBB, #RRGGBBAA), rgb/rgba/hsl/hsla functions,
                // named CSS colors (3-20 alpha chars), transparent, currentColor.
                if ( preg_match( '/^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.,\s%]+\)|hsla?\(\s*[\d.,\s%deg]+\)|transparent|currentColor|[a-zA-Z]{3,20})$/', $value ) ) {
                    return $value;
                }
                return '';

            case 'clip-path':
                // Standard CSS shapes, none, or path().
                if ( preg_match( '/^(none|polygon\([^)]+\)|circle\([^)]+\)|ellipse\([^)]+\)|inset\([^)]+\)|path\([^)]+\))$/i', $value ) ) {
                    return $value;
                }
                return '';

            case 'position':
                // Keywords, percentages, px/em/rem values, or two-value combos.
                if ( preg_match( '/^(center|top|bottom|left|right|(\d+(\.\d+)?(%|px|em|rem)\s*){1,2})$/i', $value ) ) {
                    return $value;
                }
                return '';

            case 'generic':
            default:
                // Fall back to sanitize_text_field for any unknown type, but only
                // after the universal blocklist above has passed.
                return sanitize_text_field( $value );
        }
    }

    // ── CRUD ──────────────────────────────────────────────────

    /**
     * Layout template CPT name.
     *
     * @since 0.18.0 P20-I-1
     */
    const CPT = 'wpsg_layout_tpl';

    /**
     * Post meta key for template data blob.
     *
     * @since 0.18.0 P20-I-1
     */
    const META_KEY = '_wpsg_template_data';

    /**
     * Retrieve all templates.
     *
     * @return array<string, array> Keyed by template UUID.
     */
    public static function get_all(): array {
        // Migrate legacy wp_options storage on first call.
        self::maybe_migrate_from_options();

        $posts = get_posts([
            'post_type'      => self::CPT,
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ]);

        $templates = [];
        foreach ( $posts as $post ) {
            $data = get_post_meta( $post->ID, self::META_KEY, true );
            if ( ! is_array( $data ) ) {
                continue;
            }
            $id = $data['id'] ?? $post->post_name;
            $data['id']   = $id;
            $data['name']  = $post->post_title;
            $templates[ $id ] = $data;
        }

        return $templates;
    }

    /**
     * Get a single template by UUID.
     *
     * @param  string $id UUID.
     * @return array|null  Template data or null.
     */
    public static function get( string $id ): ?array {
        self::maybe_migrate_from_options();

        $posts = get_posts([
            'post_type'      => self::CPT,
            'name'           => $id,
            'post_status'    => 'publish',
            'posts_per_page' => 1,
        ]);

        if ( empty( $posts ) ) {
            return null;
        }

        $post = $posts[0];
        $data = get_post_meta( $post->ID, self::META_KEY, true );
        if ( ! is_array( $data ) ) {
            return null;
        }
        $data['id']   = $id;
        $data['name']  = $post->post_title;
        return $data;
    }

    /**
     * Create a new template.
     *
     * @param  array $data Partial template data.
     * @return array|WP_Error Created template or error.
     */
    public static function create( array $data ) {
        self::maybe_migrate_from_options();

        $id  = wp_generate_uuid4();
        $now = gmdate( 'c' );

        // P62-A: strip pro-gated fields on create when unlicensed (no prior
        // state to preserve, so strip-to-empty).
        $data = self::enforce_license_gates( $data );

        $template = self::build_template( $id, $data, $now );

        $validation = self::validate_template( $template );
        if ( is_wp_error( $validation ) ) {
            return $validation;
        }

        $post_id = wp_insert_post([
            'post_type'   => self::CPT,
            'post_status' => 'publish',
            'post_title'  => $template['name'],
            'post_name'   => $id,
        ], true);

        if ( is_wp_error( $post_id ) ) {
            return $post_id;
        }

        update_post_meta( $post_id, self::META_KEY, $template );
        return $template;
    }

    /**
     * Update an existing template (merge-update).
     *
     * @param  string $id   Template UUID.
     * @param  array  $data Fields to update.
     * @return array|WP_Error Updated template or error.
     */
    public static function update( string $id, array $data ) {
        self::maybe_migrate_from_options();

        $posts = get_posts([
            'post_type'      => self::CPT,
            'name'           => $id,
            'post_status'    => 'publish',
            'posts_per_page' => 1,
        ]);

        if ( empty( $posts ) ) {
            return new WP_Error( 'not_found', 'Template not found.', [ 'status' => 404 ] );
        }

        $post     = $posts[0];
        $existing = get_post_meta( $post->ID, self::META_KEY, true );
        if ( ! is_array( $existing ) ) {
            $existing = [];
        }

        // P62-A: freeze pro-gated fields to their last-saved value when
        // unlicensed, so a lapsed/absent license never destroys already-saved
        // pro data — it only blocks new/edited pro content on save.
        $data = self::enforce_license_gates( $data, $existing );

        // Rebuild through build_template() so all fields (including new
        // slot sub-fields like shadow, filterEffects, tilt, etc.) are
        // consistently sanitized — same as the create path.
        $merged = self::build_template( $id, array_merge( $existing, $data ), $existing['createdAt'] ?? gmdate( 'c' ) );

        // Preserve immutable fields.
        $merged['id']            = $id;
        $merged['createdAt']     = $existing['createdAt'] ?? gmdate( 'c' );
        $merged['updatedAt']     = gmdate( 'c' );
        $merged['schemaVersion'] = self::SCHEMA_VERSION;

        $validation = self::validate_template( $merged );
        if ( is_wp_error( $validation ) ) {
            return $validation;
        }

        wp_update_post([
            'ID'         => $post->ID,
            'post_title' => $merged['name'],
        ]);
        update_post_meta( $post->ID, self::META_KEY, $merged );
        return $merged;
    }

    /**
     * Delete a template.
     *
     * @param  string $id Template UUID.
     * @return bool True on success.
     */
    public static function delete( string $id ): bool {
        self::maybe_migrate_from_options();

        $posts = get_posts([
            'post_type'      => self::CPT,
            'name'           => $id,
            'post_status'    => 'publish',
            'posts_per_page' => 1,
        ]);

        if ( empty( $posts ) ) {
            return false;
        }

        wp_delete_post( $posts[0]->ID, true );
        return true;
    }

    /**
     * Duplicate a template with a new ID and name.
     *
     * @param  string $id       Source template UUID.
     * @param  string $new_name Name for the clone.
     * @return array|WP_Error   Cloned template or error.
     */
    public static function duplicate( string $id, string $new_name ) {
        $source = self::get( $id );
        if ( ! $source ) {
            return new WP_Error( 'not_found', 'Source template not found.', [ 'status' => 404 ] );
        }

        $clone = $source;
        unset( $clone['id'] );
        $clone['name'] = $new_name ?: ( $source['name'] . ' (Copy)' );

        // Regenerate IDs for every layer/group so the copy cannot collide with
        // its source, recording old→new in a single map. Structures that
        // *reference* those IDs (group membership, per-breakpoint overrides) are
        // rewritten through the map in a second pass so the copy stays internally
        // consistent — without this, a copied template's groups orphan and its
        // breakpoint overrides silently drop (P59-E).
        //
        // memberIds today only ever hold slot IDs and childGroupIds/parentGroupId
        // only group IDs (selection is per-type), but the map unions slots,
        // overlays, texts and groups so any cross-reference remaps correctly and
        // this stays robust if member types ever broaden. All IDs are UUIDs, so
        // the union cannot alias across categories.
        $id_map = [];

        // First pass — assign fresh IDs and record old→new. Groups are included
        // here (before any rewriting) so childGroupIds/parentGroupId, which may
        // point at a group appearing later in the array, resolve in pass two.
        foreach ( [ 'slots', 'overlays', 'texts', 'groups' ] as $collection ) {
            if ( empty( $clone[ $collection ] ) || ! is_array( $clone[ $collection ] ) ) {
                continue;
            }
            foreach ( $clone[ $collection ] as &$item ) {
                if ( ! is_array( $item ) ) {
                    continue;
                }
                $old_id     = isset( $item['id'] ) ? (string) $item['id'] : '';
                $new_id     = wp_generate_uuid4();
                $item['id'] = $new_id;
                if ( $old_id !== '' ) {
                    $id_map[ $old_id ] = $new_id;
                }
            }
            unset( $item );
        }

        // Rewrite a single ID through the map, leaving unknown IDs untouched
        // rather than dropping them (an already-orphaned reference in the source
        // stays as-is instead of silently vanishing).
        $remap_id = static function ( $id ) use ( $id_map ) {
            $id = (string) $id;
            return $id_map[ $id ] ?? $id;
        };

        // Second pass — rewrite group references now that the map is complete.
        if ( ! empty( $clone['groups'] ) && is_array( $clone['groups'] ) ) {
            foreach ( $clone['groups'] as &$group ) {
                if ( ! is_array( $group ) ) {
                    continue;
                }
                if ( isset( $group['memberIds'] ) && is_array( $group['memberIds'] ) ) {
                    $group['memberIds'] = array_map( $remap_id, $group['memberIds'] );
                }
                if ( isset( $group['childGroupIds'] ) && is_array( $group['childGroupIds'] ) ) {
                    $group['childGroupIds'] = array_map( $remap_id, $group['childGroupIds'] );
                }
                if ( isset( $group['parentGroupId'] ) && $group['parentGroupId'] !== null ) {
                    $group['parentGroupId'] = $remap_id( $group['parentGroupId'] );
                }
            }
            unset( $group );
        }

        // Rekey per-breakpoint overrides from old slot ID → new slot ID. Unknown
        // keys are kept as-is (consistent with group references); the client
        // resolves overrides by slot lookup, so a stale key is simply never read.
        if ( ! empty( $clone['breakpointOverrides'] ) && is_array( $clone['breakpointOverrides'] ) ) {
            foreach ( $clone['breakpointOverrides'] as $bp => $slot_overrides ) {
                if ( ! is_array( $slot_overrides ) ) {
                    continue;
                }
                $rekeyed = [];
                foreach ( $slot_overrides as $slot_id => $override ) {
                    $rekeyed[ $remap_id( $slot_id ) ] = $override;
                }
                $clone['breakpointOverrides'][ $bp ] = $rekeyed;
            }
        }

        return self::create( $clone );
    }

    // ── Migration from wp_options ─────────────────────────────

    /**
     * One-time migration from legacy wp_options storage to CPT posts.
     *
     * Runs automatically on first CRUD call after upgrade. The old option
     * is renamed to `wpsg_layout_templates_backup` for rollback safety.
     *
     * @since 0.18.0 P20-I-1
     */
    private static function maybe_migrate_from_options(): void {
        static $migrated = false;
        if ( $migrated ) {
            return;
        }
        $migrated = true;

        $legacy = get_option( self::OPTION_KEY );
        if ( ! is_array( $legacy ) || empty( $legacy ) ) {
            return;
        }

        // Check if any CPT posts already exist to avoid double-migration.
        $existing = get_posts([
            'post_type'      => self::CPT,
            'post_status'    => 'publish',
            'posts_per_page' => 1,
            'fields'         => 'ids',
        ]);
        if ( ! empty( $existing ) ) {
            // CPT posts exist — migration already completed.
            delete_option( self::OPTION_KEY );
            return;
        }

        // Migrate each template to a CPT post.
        foreach ( $legacy as $id => $tpl ) {
            if ( ! is_array( $tpl ) ) {
                continue;
            }

            $tpl = self::migrate_template( $tpl );
            $tpl['id'] = $id;

            $post_id = wp_insert_post([
                'post_type'   => self::CPT,
                'post_status' => 'publish',
                'post_title'  => $tpl['name'] ?? 'Untitled',
                'post_name'   => $id,
            ], true);

            if ( ! is_wp_error( $post_id ) ) {
                update_post_meta( $post_id, self::META_KEY, $tpl );
            }
        }

        // Backup and remove legacy option.
        update_option( 'wpsg_layout_templates_backup', $legacy, false );
        delete_option( self::OPTION_KEY );
    }

    // ── Validation ────────────────────────────────────────────

    /**
     * Validate a full template array.
     *
     * @param  array $template Template data.
     * @return true|WP_Error
     */
    private static function validate_template( array $template ) {
        if ( empty( $template['name'] ) || ! is_string( $template['name'] ) ) {
            return new WP_Error( 'invalid_name', 'Template name is required.', [ 'status' => 400 ] );
        }

        if ( ! isset( $template['canvasAspectRatio'] ) || $template['canvasAspectRatio'] <= 0 ) {
            return new WP_Error( 'invalid_aspect', 'Canvas aspect ratio must be positive.', [ 'status' => 400 ] );
        }

        if ( ! empty( $template['slots'] ) && is_array( $template['slots'] ) ) {
            foreach ( $template['slots'] as $i => $slot ) {
                $slot_error = self::validate_slot( $slot, $i );
                if ( is_wp_error( $slot_error ) ) {
                    return $slot_error;
                }
            }
        }

        return true;
    }

    /**
     * Validate a single slot.
     *
     * @param  array $slot  Slot data.
     * @param  int   $index Slot index (for error messages).
     * @return true|WP_Error
     */
    private static function validate_slot( array $slot, int $index ) {
        $pct_fields = [ 'x', 'y', 'width', 'height' ];
        foreach ( $pct_fields as $field ) {
            $val = $slot[ $field ] ?? -1;
            if ( ! is_numeric( $val ) || $val < 0 || $val > 100 ) {
                return new WP_Error(
                    'invalid_slot',
                    sprintf( 'Slot %d: %s must be a number between 0 and 100.', $index, $field ),
                    [ 'status' => 400 ]
                );
            }
        }
        // Warn (but don't reject) if slot extends beyond canvas.
        if ( ( $slot['x'] ?? 0 ) + ( $slot['width'] ?? 0 ) > 100.5 ||
             ( $slot['y'] ?? 0 ) + ( $slot['height'] ?? 0 ) > 100.5 ) {
            // Log it for the admin but allow save.
            if ( function_exists( 'do_action' ) ) {
                do_action( 'wpsg_layout_slot_out_of_bounds', $slot, $index );
            }
        }
        return true;
    }

    // ── Helpers ───────────────────────────────────────────────

    /**
     * Sanitize raw template data for external callers (e.g., import_campaign).
     *
     * Runs the same sanitization pipeline as the create/update paths so
     * imported payloads receive identical validation and escaping.
     *
     * @param  array $data Raw template data (slots, overlays, background, etc.).
     * @return array Sanitized template data.
     */
    public static function sanitize_template_data( array $data ): array {
        // P62-A: strip pro-gated fields on import when unlicensed. Import has
        // no prior "existing" state to freeze against, so strip-to-empty (same
        // as the create path).
        $data = self::enforce_license_gates( $data );

        $id  = wp_generate_uuid4();
        $now = gmdate( 'c' );
        return self::build_template( $id, $data, $now );
    }

    /**
     * Strip or freeze license-gated fields (P62-A) on the write path.
     *
     * Entitlement enforcement is deliberately server-side and orthogonal to
     * WPSG_Permissions: a permission failure 403s the request, but an
     * unlicensed save SUCCEEDS with the pro fields degraded. This closes the
     * gap where a direct REST POST could bypass the client-side UI gate.
     *
     * When $existing is null (create/import) gated fields are stripped to
     * empty. When $existing is provided (update) they are FROZEN to their
     * last-saved value, so an absent/lapsed license never destroys
     * already-saved pro data — it only discards new/edited pro content.
     *
     * Currently gates two persisted pro fields: `texts` (P59 text layers) and
     * `breakpointOverrides` (P58-B per-breakpoint responsive). The starter
     * template library (P58-C) has no gated persisted field — its presets
     * carry only `slots` — so it is gated client-side only; if a future preset
     * ever embeds `texts`/`breakpointOverrides`, this guard already catches it.
     *
     * @param array      $data     Incoming (partial) template data.
     * @param array|null $existing Stored template (update path) or null (create/import).
     * @return array Adjusted data.
     */
    private static function enforce_license_gates( array $data, ?array $existing = null ): array {
        if ( ! WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_TEXT_LAYERS ) ) {
            $data['texts'] = $existing === null ? [] : ( $existing['texts'] ?? [] );
        }
        if ( ! WPSG_License::can_use_feature( WPSG_License::FEATURE_LAYOUT_BREAKPOINT_OVERRIDES ) ) {
            $data['breakpointOverrides'] = $existing === null ? [] : ( $existing['breakpointOverrides'] ?? [] );
        }
        return $data;
    }

    /**
     * Build a complete template array from partial input.
     *
     * @param  string $id   UUID.
     * @param  array  $data Partial fields.
     * @param  string $now  ISO 8601 timestamp.
     * @return array
     */
    private static function build_template( string $id, array $data, string $now ): array {
        return [
            'id'                => $id,
            'name'              => sanitize_text_field( $data['name'] ?? 'Untitled Layout' ),
            'schemaVersion'     => self::SCHEMA_VERSION,
            'canvasAspectRatio' => floatval( $data['canvasAspectRatio'] ?? ( 16 / 9 ) ),
            'canvasMinWidth'    => max( 0, intval( $data['canvasMinWidth'] ?? 320 ) ),
            'canvasMaxWidth'    => max( 0, intval( $data['canvasMaxWidth'] ?? 0 ) ),
            'canvasHeightMode'  => in_array( $data['canvasHeightMode'] ?? '', [ 'aspect-ratio', 'fixed-vh' ], true )
                ? $data['canvasHeightMode']
                : 'aspect-ratio',
            'canvasHeightVh'    => isset( $data['canvasHeightVh'] )
                ? max( 1, min( 100, intval( $data['canvasHeightVh'] ) ) )
                : 50,
            'backgroundMode'       => in_array( $data['backgroundMode'] ?? '', [ 'none', 'color', 'gradient', 'image' ], true )
                ? $data['backgroundMode']
                : 'color',
            'backgroundColor'      => self::sanitize_css_value( $data['backgroundColor'] ?? '#1a1a2e', 'color' ),
            'backgroundGradientDirection' => in_array( $data['backgroundGradientDirection'] ?? '', [ 'horizontal', 'vertical', 'diagonal-right', 'diagonal-left', 'radial' ], true )
                ? $data['backgroundGradientDirection']
                : 'horizontal',
            'backgroundGradientStops' => self::sanitize_gradient_stops( $data['backgroundGradientStops'] ?? [] ),
            'backgroundGradientType' => in_array( $data['backgroundGradientType'] ?? '', [ 'linear', 'radial', 'conic' ], true )
                ? $data['backgroundGradientType']
                : 'linear',
            'backgroundGradientAngle' => isset( $data['backgroundGradientAngle'] )
                ? max( 0, min( 360, floatval( $data['backgroundGradientAngle'] ) ) )
                : null,
            'backgroundRadialShape' => in_array( $data['backgroundRadialShape'] ?? '', [ 'ellipse', 'circle' ], true )
                ? $data['backgroundRadialShape']
                : 'ellipse',
            'backgroundRadialSize' => in_array( $data['backgroundRadialSize'] ?? '', [ 'closest-side', 'closest-corner', 'farthest-side', 'farthest-corner' ], true )
                ? $data['backgroundRadialSize']
                : 'farthest-corner',
            'backgroundGradientCenterX' => isset( $data['backgroundGradientCenterX'] )
                ? max( 0, min( 100, floatval( $data['backgroundGradientCenterX'] ) ) )
                : 50,
            'backgroundGradientCenterY' => isset( $data['backgroundGradientCenterY'] )
                ? max( 0, min( 100, floatval( $data['backgroundGradientCenterY'] ) ) )
                : 50,
            'backgroundImage'      => isset( $data['backgroundImage'] ) && $data['backgroundImage'] !== ''
                ? esc_url_raw( $data['backgroundImage'] )
                : null,
            'backgroundImageFit'   => in_array( $data['backgroundImageFit'] ?? '', [ 'cover', 'contain', 'fill' ], true )
                ? $data['backgroundImageFit']
                : 'cover',
            'backgroundImageOpacity' => isset( $data['backgroundImageOpacity'] )
                ? max( 0, min( 1, floatval( $data['backgroundImageOpacity'] ) ) )
                : 1,
            'slots'                => self::sanitize_slots( $data['slots'] ?? [] ),
            'overlays'          => self::sanitize_overlays( $data['overlays'] ?? [] ),
            // ── First-class text layers (P59) ──
            'texts'             => self::sanitize_texts( $data['texts'] ?? [] ),
            'guides'            => self::sanitize_guides( $data['guides'] ?? [] ),
            // ── Nested groups (P30-G) ──
            'groups'            => self::sanitize_groups( $data['groups'] ?? [] ),
            // ── Per-breakpoint slot overrides (P58-B) ──
            'breakpointOverrides' => self::sanitize_breakpoint_overrides( $data['breakpointOverrides'] ?? [] ),
            'createdAt'         => $data['createdAt'] ?? $now,
            'updatedAt'         => $now,
            'tags'              => array_map( 'sanitize_text_field', (array) ( $data['tags'] ?? [] ) ),
        ];
    }

    /**
     * Sanitize an array of persistent guide lines (P57-E).
     *
     * @param  mixed $guides Raw guide data.
     * @return array
     */
    private static function sanitize_guides( $guides ): array {
        if ( ! is_array( $guides ) ) {
            return [];
        }
        return array_values( array_filter( array_map( function ( $g ) {
            if ( ! is_array( $g ) ) {
                return null;
            }
            $axis = $g['axis'] ?? '';
            if ( ! in_array( $axis, [ 'x', 'y' ], true ) ) {
                return null;
            }
            return [
                'id'       => sanitize_text_field( $g['id'] ?? wp_generate_uuid4() ),
                'axis'     => $axis,
                'position' => max( 0, min( 100, floatval( $g['position'] ?? 50 ) ) ),
                'locked'   => (bool) ( $g['locked'] ?? false ),
            ];
        }, $guides ), static function ( $g ) {
            return is_array( $g );
        } ) );
    }

    /**
     * Sanitize an array of slots.
     *
     * @param  mixed $slots Raw slot data.
     * @return array
     */
    private static function sanitize_slots( $slots ): array {
        if ( ! is_array( $slots ) ) {
            return [];
        }

        $valid_shapes  = [ 'rectangle', 'circle', 'ellipse', 'hexagon', 'diamond', 'parallelogram-left', 'parallelogram-right', 'chevron', 'arrow', 'trapezoid', 'custom' ];
        $valid_fits    = [ 'cover', 'contain', 'fill' ];
        $valid_clicks  = [ 'lightbox', 'none' ];
        $valid_hovers  = [ 'pop', 'glow', 'none' ];

        return array_values( array_map( function ( $s ) use ( $valid_shapes, $valid_fits, $valid_clicks, $valid_hovers ) {
            return [
                'id'             => sanitize_text_field( $s['id'] ?? wp_generate_uuid4() ),
                'x'              => self::clamp_pct( $s['x'] ?? 0 ),
                'y'              => self::clamp_pct( $s['y'] ?? 0 ),
                'width'          => self::clamp_pct( $s['width'] ?? 25 ),
                'height'         => self::clamp_pct( $s['height'] ?? 25 ),
                'zIndex'         => intval( $s['zIndex'] ?? 0 ),
                'shape'          => in_array( $s['shape'] ?? '', $valid_shapes, true ) ? $s['shape'] : 'rectangle',
                'clipPath'       => isset( $s['clipPath'] ) ? self::sanitize_css_value( $s['clipPath'], 'clip-path' ) : null,
                'maskUrl'        => isset( $s['maskUrl'] ) ? esc_url_raw( $s['maskUrl'] ) : null,
                'maskMode'       => in_array( $s['maskMode'] ?? '', [ 'luminance', 'alpha' ], true ) ? $s['maskMode'] : 'luminance',
                'borderRadius'   => max( 0, intval( $s['borderRadius'] ?? 4 ) ),
                'borderWidth'    => max( 0, intval( $s['borderWidth'] ?? 0 ) ),
                'borderColor'    => self::sanitize_css_value( $s['borderColor'] ?? '#ffffff', 'color' ),
                'objectFit'      => in_array( $s['objectFit'] ?? '', $valid_fits, true ) ? $s['objectFit'] : 'cover',
                'objectPosition' => self::sanitize_css_value( $s['objectPosition'] ?? '50% 50%', 'position' ),
                'mediaId'        => isset( $s['mediaId'] ) ? sanitize_text_field( $s['mediaId'] ) : null,
                'mediaAttachmentId' => isset( $s['mediaAttachmentId'] ) ? intval( $s['mediaAttachmentId'] ) : null,
                'mediaUrl'       => isset( $s['mediaUrl'] ) ? esc_url_raw( $s['mediaUrl'] ) : null,
                'clickAction'    => in_array( $s['clickAction'] ?? '', $valid_clicks, true ) ? $s['clickAction'] : 'lightbox',
                'hoverEffect'    => in_array( $s['hoverEffect'] ?? '', $valid_hovers, true ) ? $s['hoverEffect'] : 'pop',
                'glowColor'      => isset( $s['glowColor'] ) ? ( sanitize_hex_color( $s['glowColor'] ) ?: '#7c9ef8' ) : null,
                'glowSpread'     => isset( $s['glowSpread'] ) ? max( 2, min( 60, intval( $s['glowSpread'] ) ) ) : null,
                // ── Layer system (P16) ──
                'name'           => isset( $s['name'] ) && is_string( $s['name'] ) ? sanitize_text_field( $s['name'] ) : null,
                'visible'        => isset( $s['visible'] ) ? (bool) $s['visible'] : true,
                'locked'         => isset( $s['locked'] ) ? (bool) $s['locked'] : false,
                'lockAspectRatio' => isset( $s['lockAspectRatio'] ) ? (bool) $s['lockAspectRatio'] : false,
                // ── Mask layer (P20) ──
                'maskLayer'      => self::sanitize_mask_layer( $s['maskLayer'] ?? null ),
                // ── Image effects (P20) ──
                'filterEffects'  => self::sanitize_filter_effects( $s['filterEffects'] ?? null ),
                'shadow'         => self::sanitize_shadow( $s['shadow'] ?? null ),
                'tilt'           => self::sanitize_tilt( $s['tilt'] ?? null ),
                'blendMode'      => self::sanitize_blend_mode( $s['blendMode'] ?? null ),
                'overlayEffect'  => self::sanitize_overlay_effect( $s['overlayEffect'] ?? null ),
                // ── Rotation (P57-F) ──
                'rotation'       => isset( $s['rotation'] ) ? max( 0, min( 359, intval( $s['rotation'] ) ) ) : null,
                // ── Render opacity (P58-A) ──
                'opacity'        => isset( $s['opacity'] ) ? max( 0, min( 1, floatval( $s['opacity'] ) ) ) : null,
                // ── Entrance animation (P58-E) ──
                'entranceAnimation' => self::sanitize_entrance_animation( $s['entranceAnimation'] ?? null ),
            ];
        }, $slots ) );
    }

    /**
     * Sanitize an array of overlay layers.
     *
     * @param  mixed $overlays Raw overlay data.
     * @return array
     */
    private static function sanitize_overlays( $overlays ): array {
        if ( ! is_array( $overlays ) ) {
            return [];
        }

        $valid_shapes = [ 'rectangle', 'circle', 'ellipse', 'hexagon', 'diamond', 'parallelogram-left', 'parallelogram-right', 'chevron', 'arrow', 'trapezoid', 'custom' ];

        return array_values( array_filter( array_map( function ( $o ) use ( $valid_shapes ) {
            $raw_url = $o['imageUrl'] ?? '';

            // Never persist blob URLs; they are local-tab only and break
            // when viewed later in campaign rendering.  Check the raw
            // value *before* esc_url_raw() (which mangles the blob: scheme).
            if ( is_string( $raw_url ) && strpos( $raw_url, 'blob:' ) === 0 ) {
                return null;
            }

            $image_url = esc_url_raw( $raw_url );

            return [
                'id'            => sanitize_text_field( $o['id'] ?? wp_generate_uuid4() ),
                'imageUrl'      => $image_url,
                'x'             => self::clamp_pct( $o['x'] ?? 0 ),
                'y'             => self::clamp_pct( $o['y'] ?? 0 ),
                'width'         => self::clamp_pct( $o['width'] ?? 100 ),
                'height'        => self::clamp_pct( $o['height'] ?? 100 ),
                'zIndex'        => intval( $o['zIndex'] ?? 999 ),
                'opacity'       => max( 0, min( 1, floatval( $o['opacity'] ?? 1 ) ) ),
                'pointerEvents' => (bool) ( $o['pointerEvents'] ?? false ),
                // ── Layer system (P16) ──
                'name'          => isset( $o['name'] ) && is_string( $o['name'] ) ? sanitize_text_field( $o['name'] ) : null,
                'visible'       => isset( $o['visible'] ) ? (bool) $o['visible'] : true,
                'locked'        => isset( $o['locked'] ) ? (bool) $o['locked'] : false,
                // ── Transform (P50-J asset-layer parity) ──
                'rotation'      => isset( $o['rotation'] ) ? max( 0, min( 359, intval( $o['rotation'] ) ) ) : null,
                'flipH'         => isset( $o['flipH'] ) ? (bool) $o['flipH'] : null,
                'flipV'         => isset( $o['flipV'] ) ? (bool) $o['flipV'] : null,
                // ── Shape & geometry (P50-J) ──
                'shape'         => in_array( $o['shape'] ?? '', $valid_shapes, true ) ? $o['shape'] : null,
                'clipPath'      => isset( $o['clipPath'] ) ? self::sanitize_css_value( $o['clipPath'], 'clip-path' ) : null,
                'maskLayer'     => self::sanitize_mask_layer( $o['maskLayer'] ?? null ),
                // ── Border (P50-J) ──
                'borderRadius'  => isset( $o['borderRadius'] ) ? max( 0, intval( $o['borderRadius'] ) ) : null,
                'borderWidth'   => isset( $o['borderWidth'] ) ? max( 0, intval( $o['borderWidth'] ) ) : null,
                'borderColor'   => isset( $o['borderColor'] ) ? self::sanitize_css_value( $o['borderColor'], 'color' ) : null,
                // ── Effects (P50-J) ──
                'filterEffects' => self::sanitize_filter_effects( $o['filterEffects'] ?? null ),
                'shadow'        => self::sanitize_shadow( $o['shadow'] ?? null ),
                'blendMode'     => self::sanitize_blend_mode( $o['blendMode'] ?? null ),
            ];
        }, $overlays ), static function ( $o ) {
            return is_array( $o );
        } ) );
    }

    /**
     * Sanitize an array of first-class text layers (P59).
     *
     * @param  mixed $texts Raw text-layer data.
     * @return array
     */
    private static function sanitize_texts( $texts ): array {
        if ( ! is_array( $texts ) ) {
            return [];
        }

        $valid_tags   = [ 'heading', 'subheading', 'paragraph', 'caption' ];
        $valid_aligns = [ 'left', 'center', 'right' ];

        return array_values( array_filter( array_map( function ( $t ) use ( $valid_tags, $valid_aligns ) {
            if ( ! is_array( $t ) ) {
                return null;
            }
            // Fall back to a generated UUID when the id is missing OR blank —
            // `??` alone keeps an empty string, which would collide across layers
            // and break selection / React keys on the client.
            $id = isset( $t['id'] ) ? sanitize_text_field( (string) $t['id'] ) : '';
            return [
                'id'          => '' !== $id ? $id : wp_generate_uuid4(),
                'x'           => self::clamp_pct( $t['x'] ?? 0 ),
                'y'           => self::clamp_pct( $t['y'] ?? 0 ),
                'width'       => self::clamp_pct( $t['width'] ?? 40 ),
                'height'      => self::clamp_pct( $t['height'] ?? 12 ),
                'zIndex'      => intval( $t['zIndex'] ?? 999 ),
                'opacity'     => max( 0, min( 1, floatval( $t['opacity'] ?? 1 ) ) ),
                // Plain user text — rendered as escaped React text content on the
                // frontend; sanitize_textarea_field strips tags but keeps newlines.
                'content'     => sanitize_textarea_field( (string) ( $t['content'] ?? '' ) ),
                'semanticTag' => in_array( $t['semanticTag'] ?? '', $valid_tags, true ) ? $t['semanticTag'] : 'heading',
                'textAlign'   => in_array( $t['textAlign'] ?? '', $valid_aligns, true ) ? $t['textAlign'] : 'left',
                'typography'  => self::sanitize_text_typography( $t['typography'] ?? [] ),
                // ── Layer system (P16 parity) ──
                'name'        => isset( $t['name'] ) && is_string( $t['name'] ) ? sanitize_text_field( $t['name'] ) : null,
                'visible'     => isset( $t['visible'] ) ? (bool) $t['visible'] : true,
                'locked'      => isset( $t['locked'] ) ? (bool) $t['locked'] : false,
                // Panel rotation is -180..180; clamp to that range so negative
                // rotations are not clipped to 0 on save.
                'rotation'    => isset( $t['rotation'] ) ? max( -180, min( 180, intval( $t['rotation'] ) ) ) : null,
            ];
        }, $texts ), static function ( $t ) {
            return is_array( $t );
        } ) );
    }

    /**
     * Sanitize a single text-layer typography override (the TypographyOverride
     * shape shared with the settings typography system).
     *
     * @param  mixed $typo Raw typography object.
     * @return array
     */
    private static function sanitize_text_typography( $typo ): array {
        if ( ! is_array( $typo ) ) {
            return [];
        }

        $allowed_props = [
            'fontFamily', 'fontFallback1', 'fontFallback2',
            'fontSize', 'fontWeight', 'fontStyle',
            'textTransform', 'textDecoration', 'lineHeight',
            'letterSpacing', 'wordSpacing', 'color',
            'textStrokeWidth', 'textStrokeColor',
            'textShadowOffsetX', 'textShadowOffsetY', 'textShadowBlur', 'textShadowColor',
            'textGlowColor', 'textGlowBlur',
        ];
        $color_props = [ 'color', 'textStrokeColor', 'textShadowColor', 'textGlowColor' ];

        $clean = [];
        foreach ( $typo as $prop => $val ) {
            if ( ! in_array( $prop, $allowed_props, true ) ) {
                continue;
            }
            if ( 'fontWeight' === $prop ) {
                $clean[ $prop ] = max( 100, min( 900, intval( $val ) ) );
            } elseif ( 'lineHeight' === $prop ) {
                $clean[ $prop ] = max( 0.5, min( 5.0, floatval( $val ) ) );
            } elseif ( in_array( $prop, $color_props, true ) ) {
                $clean[ $prop ] = self::sanitize_css_value( (string) $val, 'color' );
            } else {
                $clean[ $prop ] = sanitize_text_field( (string) $val );
            }
        }
        return $clean;
    }

    /**
     * Clamp a percentage value to 0–100.
     *
     * @param  mixed $val Input value.
     * @return float
     */
    private static function clamp_pct( $val ): float {
        return max( 0, min( 100, floatval( $val ) ) );
    }

    /**
     * Sanitize gradient color stops (2–3 entries).
     *
     * @param  mixed $stops Raw stops data.
     * @return array Sanitized stops.
     */
    private static function sanitize_gradient_stops( $stops ): array {
        if ( ! is_array( $stops ) ) {
            return [];
        }
        $result = [];
        foreach ( array_slice( $stops, 0, 3 ) as $s ) {
            if ( ! is_array( $s ) || ! isset( $s['color'] ) || ! is_string( $s['color'] ) ) {
                continue;
            }
            $color = self::sanitize_css_value( $s['color'], 'color' );
            if ( empty( $color ) ) {
                continue; // Skip invalid colors entirely
            }
            $entry = [ 'color' => $color ];
            if ( isset( $s['position'] ) && is_numeric( $s['position'] ) ) {
                $entry['position'] = max( 0, min( 100, floatval( $s['position'] ) ) );
            }
            $result[] = $entry;
        }
        return $result;
    }

    /**
     * Sanitize a mask layer object.
     *
     * @param  mixed $ml Raw mask layer data.
     * @return array|null
     */
    private static function sanitize_mask_layer( $ml ) {
        if ( ! is_array( $ml ) || empty( $ml['url'] ) ) {
            return null;
        }
        return [
            'url'     => esc_url_raw( $ml['url'] ),
            'mode'    => in_array( $ml['mode'] ?? '', [ 'luminance', 'alpha' ], true ) ? $ml['mode'] : 'luminance',
            'x'       => floatval( $ml['x'] ?? 0 ),
            'y'       => floatval( $ml['y'] ?? 0 ),
            'width'   => max( 1, floatval( $ml['width'] ?? 100 ) ),
            'height'  => max( 1, floatval( $ml['height'] ?? 100 ) ),
            'feather' => max( 0, min( 50, floatval( $ml['feather'] ?? 0 ) ) ),
        ];
    }

    /**
     * Sanitize filter effects object (8 numeric fields with defaults).
     *
     * @param  mixed $fx Raw filter effects data.
     * @return array|null
     */
    private static function sanitize_filter_effects( $fx ) {
        if ( ! is_array( $fx ) ) {
            return null;
        }
        // Values are percentages matching the JS SlotFilterEffects type:
        // brightness/contrast/saturate: 0–300 (100 = identity, slider max 200)
        // blur: px 0–20
        // grayscale/sepia/invert: 0–100 %
        // hueRotate: 0–360 degrees
        return [
            'brightness' => max( 0, min( 300, floatval( $fx['brightness'] ?? 100 ) ) ),
            'contrast'   => max( 0, min( 300, floatval( $fx['contrast'] ?? 100 ) ) ),
            'saturate'   => max( 0, min( 300, floatval( $fx['saturate'] ?? 100 ) ) ),
            'blur'       => max( 0, min( 20, floatval( $fx['blur'] ?? 0 ) ) ),
            'grayscale'  => max( 0, min( 100, floatval( $fx['grayscale'] ?? 0 ) ) ),
            'sepia'      => max( 0, min( 100, floatval( $fx['sepia'] ?? 0 ) ) ),
            'hueRotate'  => max( 0, min( 360, floatval( $fx['hueRotate'] ?? 0 ) ) ),
            'invert'     => max( 0, min( 100, floatval( $fx['invert'] ?? 0 ) ) ),
        ];
    }

    /**
     * Sanitize drop-shadow settings.
     *
     * @param  mixed $sh Raw shadow data.
     * @return array|null
     */
    private static function sanitize_shadow( $sh ) {
        if ( ! is_array( $sh ) ) {
            return null;
        }
        return [
            'offsetX' => max( -50, min( 50, intval( $sh['offsetX'] ?? 0 ) ) ),
            'offsetY' => max( -50, min( 50, intval( $sh['offsetY'] ?? 2 ) ) ),
            'blur'    => max( 0, min( 50, intval( $sh['blur'] ?? 4 ) ) ),
            'color'   => self::sanitize_css_value( $sh['color'] ?? 'rgba(0,0,0,0.5)', 'color' ),
        ];
    }

    /**
     * Sanitize 3D tilt effect settings.
     *
     * @param  mixed $t Raw tilt data.
     * @return array|null
     */
    private static function sanitize_tilt( $t ) {
        if ( ! is_array( $t ) ) {
            return null;
        }
        return [
            'enabled'    => (bool) ( $t['enabled'] ?? false ),
            'maxAngle'   => max( 1, min( 45, floatval( $t['maxAngle'] ?? 15 ) ) ),
            'perspective' => max( 100, min( 5000, intval( $t['perspective'] ?? 1000 ) ) ),
            'resetSpeed' => max( 50, min( 2000, intval( $t['resetSpeed'] ?? 300 ) ) ),
        ];
    }

    /**
     * Sanitize blend mode (allowlist of 16 CSS blend modes).
     *
     * @param  mixed $bm Raw blend mode.
     * @return string|null
     */
    private static function sanitize_blend_mode( $bm ) {
        if ( ! is_string( $bm ) ) {
            return null;
        }
        $valid = [
            'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
            'color-dodge', 'color-burn', 'hard-light', 'soft-light',
            'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
        ];
        return in_array( $bm, $valid, true ) ? $bm : null;
    }

    /**
     * Sanitize overlay effect (darken/lighten with intensity).
     *
     * @param  mixed $oe Raw overlay effect data.
     * @return array|null
     */
    private static function sanitize_overlay_effect( $oe ) {
        if ( ! is_array( $oe ) ) {
            return null;
        }
        $mode = in_array( $oe['mode'] ?? '', [ 'none', 'darken', 'lighten' ], true )
            ? $oe['mode']
            : 'none';
        if ( $mode === 'none' ) {
            return null;
        }
        return [
            'mode'        => $mode,
            'intensity'   => max( 0, min( 1, floatval( $oe['intensity'] ?? 0.3 ) ) ),
            'onHoverOnly' => (bool) ( $oe['onHoverOnly'] ?? false ),
        ];
    }

    /**
     * Sanitize a slot entrance (scroll-reveal) animation (P58-E).
     *
     * @param  mixed $anim Raw entrance-animation data.
     * @return array|null
     */
    private static function sanitize_entrance_animation( $anim ) {
        if ( ! is_array( $anim ) ) {
            return null;
        }
        $type = in_array( $anim['type'] ?? '', [ 'fade', 'slide', 'zoom' ], true ) ? $anim['type'] : null;
        if ( $type === null ) {
            return null;
        }
        $result = [ 'type' => $type ];
        if ( isset( $anim['direction'] ) && in_array( $anim['direction'], [ 'up', 'down', 'left', 'right' ], true ) ) {
            $result['direction'] = $anim['direction'];
        }
        if ( isset( $anim['durationMs'] ) ) {
            $result['durationMs'] = max( 0, min( 10000, intval( $anim['durationMs'] ) ) );
        }
        if ( isset( $anim['delayMs'] ) ) {
            $result['delayMs'] = max( 0, min( 10000, intval( $anim['delayMs'] ) ) );
        }
        return $result;
    }

    /**
     * Sanitize nested slot/overlay groups (P30-G).
     *
     * @param  mixed $groups Raw group data.
     * @return array
     */
    private static function sanitize_groups( $groups ): array {
        if ( ! is_array( $groups ) ) {
            return [];
        }
        $clean_ids = static function ( $ids ): array {
            return array_values( array_filter(
                array_map( 'sanitize_text_field', (array) $ids ),
                static function ( $v ) {
                    return $v !== '';
                }
            ) );
        };
        return array_values( array_filter( array_map( function ( $g ) use ( $clean_ids ) {
            if ( ! is_array( $g ) ) {
                return null;
            }
            $result = [
                'id'            => sanitize_text_field( $g['id'] ?? wp_generate_uuid4() ),
                'name'          => isset( $g['name'] ) && is_string( $g['name'] ) ? sanitize_text_field( $g['name'] ) : null,
                'memberIds'     => $clean_ids( $g['memberIds'] ?? [] ),
                'childGroupIds' => $clean_ids( $g['childGroupIds'] ?? [] ),
                'parentGroupId' => isset( $g['parentGroupId'] ) && $g['parentGroupId'] !== null
                    ? sanitize_text_field( $g['parentGroupId'] )
                    : null,
                'collapsed'     => isset( $g['collapsed'] ) ? (bool) $g['collapsed'] : null,
                'locked'        => isset( $g['locked'] ) ? (bool) $g['locked'] : null,
                'visible'       => isset( $g['visible'] ) ? (bool) $g['visible'] : null,
            ];
            // Bounding-box cache (P30-G) — optional, only persisted when present.
            foreach ( [ 'x', 'y', 'width', 'height' ] as $k ) {
                if ( isset( $g[ $k ] ) ) {
                    $result[ $k ] = floatval( $g[ $k ] );
                }
            }
            return $result;
        }, $groups ), static function ( $g ) {
            return is_array( $g );
        } ) );
    }

    /**
     * Sanitize per-breakpoint slot overrides (P58-B).
     *
     * Shape: { desktop|tablet|mobile: { slotId: { x?, y?, width?, height?,
     * visible?, rotation?, opacity?, zIndex? } } }. Sparse — only present
     * sub-fields are emitted; empty breakpoints/slots are dropped.
     *
     * @param  mixed $overrides Raw breakpoint-override data.
     * @return array
     */
    private static function sanitize_breakpoint_overrides( $overrides ): array {
        if ( ! is_array( $overrides ) ) {
            return [];
        }
        $result = [];
        foreach ( [ 'desktop', 'tablet', 'mobile' ] as $bp ) {
            if ( ! isset( $overrides[ $bp ] ) || ! is_array( $overrides[ $bp ] ) ) {
                continue;
            }
            $slot_map = [];
            foreach ( $overrides[ $bp ] as $slot_id => $ov ) {
                if ( ! is_array( $ov ) ) {
                    continue;
                }
                $clean = [];
                if ( isset( $ov['x'] ) ) {
                    $clean['x'] = self::clamp_pct( $ov['x'] );
                }
                if ( isset( $ov['y'] ) ) {
                    $clean['y'] = self::clamp_pct( $ov['y'] );
                }
                if ( isset( $ov['width'] ) ) {
                    $clean['width'] = self::clamp_pct( $ov['width'] );
                }
                if ( isset( $ov['height'] ) ) {
                    $clean['height'] = self::clamp_pct( $ov['height'] );
                }
                if ( isset( $ov['visible'] ) ) {
                    $clean['visible'] = (bool) $ov['visible'];
                }
                if ( isset( $ov['rotation'] ) ) {
                    $clean['rotation'] = max( 0, min( 359, intval( $ov['rotation'] ) ) );
                }
                if ( isset( $ov['opacity'] ) ) {
                    $clean['opacity'] = max( 0, min( 1, floatval( $ov['opacity'] ) ) );
                }
                if ( isset( $ov['zIndex'] ) ) {
                    $clean['zIndex'] = intval( $ov['zIndex'] );
                }
                if ( ! empty( $clean ) ) {
                    $slot_map[ sanitize_text_field( (string) $slot_id ) ] = $clean;
                }
            }
            if ( ! empty( $slot_map ) ) {
                $result[ $bp ] = $slot_map;
            }
        }
        return $result;
    }

    /**
     * Migrate a template to the current schema version.
     *
     * @param  array $template Raw template data.
     * @return array Migrated template.
     */
    public static function migrate_template( array $template ): array {
        $version = intval( $template['schemaVersion'] ?? 0 );

        // v0 → v1: no-op (initial version).
        if ( $version < 1 ) {
            $template['schemaVersion'] = 1;
        }

        // Sanitize persisted overlays from older editor states where blob URLs
        // may have been saved. Blob URLs are tab-local and invalid for later
        // campaign rendering.
        if ( isset( $template['overlays'] ) && is_array( $template['overlays'] ) ) {
            $template['overlays'] = self::sanitize_overlays( $template['overlays'] );
        }

        // v1 → v2 (P58-B): per-breakpoint slot overrides. No structural change —
        // older templates simply have no overrides; the field defaults to an
        // empty map on the client. Bump the version label.
        if ( $version < 2 ) {
            $template['schemaVersion'] = 2;
            if ( ! isset( $template['breakpointOverrides'] ) || ! is_array( $template['breakpointOverrides'] ) ) {
                $template['breakpointOverrides'] = [];
            }
        }

        // v2 → v3 (P59): first-class text layers. Older templates simply have no
        // text layers; default the field to an empty array and bump the label.
        if ( $version < 3 ) {
            $template['schemaVersion'] = 3;
            if ( ! isset( $template['texts'] ) || ! is_array( $template['texts'] ) ) {
                $template['texts'] = [];
            }
        }

        return $template;
    }
}
