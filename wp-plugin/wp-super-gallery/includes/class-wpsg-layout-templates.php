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
     */
    const SCHEMA_VERSION = 1;

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
     * Retrieve all templates.
     *
     * @return array<string, array> Keyed by template ID.
     */
    public static function get_all(): array {
        $templates = get_option( self::OPTION_KEY, [] );
        if ( ! is_array( $templates ) ) {
            return [];
        }
        // Ensure every template is at the current schema version.
        $migrated = false;
        foreach ( $templates as $id => &$tpl ) {
            $before = $tpl;
            $tpl    = self::migrate_template( $tpl );
            if ( $tpl !== $before ) {
                $migrated = true;
            }
        }
        unset( $tpl );
        if ( $migrated ) {
            update_option( self::OPTION_KEY, $templates, false );
        }
        return $templates;
    }

    /**
     * Get a single template by ID.
     *
     * @param  string $id UUID.
     * @return array|null  Template data or null.
     */
    public static function get( string $id ): ?array {
        $all = self::get_all();
        return $all[ $id ] ?? null;
    }

    /**
     * Create a new template.
     *
     * @param  array $data Partial template data.
     * @return array|WP_Error Created template or error.
     */
    public static function create( array $data ) {
        $id  = wp_generate_uuid4();
        $now = gmdate( 'c' );

        $template = self::build_template( $id, $data, $now );

        $validation = self::validate_template( $template );
        if ( is_wp_error( $validation ) ) {
            return $validation;
        }

        $all         = self::get_all();
        $all[ $id ]  = $template;

        $size_error = self::check_size_limit( $all );
        if ( is_wp_error( $size_error ) ) {
            return $size_error;
        }

        update_option( self::OPTION_KEY, $all, false );
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
        $all = self::get_all();
        if ( ! isset( $all[ $id ] ) ) {
            return new WP_Error( 'not_found', 'Template not found.', [ 'status' => 404 ] );
        }

        $existing = $all[ $id ];

        // Rebuild through build_template() so all fields (including new
        // slot sub-fields like shadow, filterEffects, tilt, etc.) are
        // consistently sanitized — same as the create path.
        $merged = self::build_template( $id, array_merge( $existing, $data ), $existing['createdAt'] );

        // Preserve immutable fields.
        $merged['id']            = $id;
        $merged['createdAt']     = $existing['createdAt'];
        $merged['updatedAt']     = gmdate( 'c' );
        $merged['schemaVersion'] = self::SCHEMA_VERSION;

        $validation = self::validate_template( $merged );
        if ( is_wp_error( $validation ) ) {
            return $validation;
        }

        $all[ $id ] = $merged;

        $size_error = self::check_size_limit( $all );
        if ( is_wp_error( $size_error ) ) {
            return $size_error;
        }

        update_option( self::OPTION_KEY, $all, false );
        return $merged;
    }

    /**
     * Delete a template.
     *
     * @param  string $id Template UUID.
     * @return bool True on success.
     */
    public static function delete( string $id ): bool {
        $all = self::get_all();
        if ( ! isset( $all[ $id ] ) ) {
            return false;
        }
        unset( $all[ $id ] );
        update_option( self::OPTION_KEY, $all, false );
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

        // Generate new IDs for slots and overlays to avoid collisions.
        if ( ! empty( $clone['slots'] ) && is_array( $clone['slots'] ) ) {
            foreach ( $clone['slots'] as &$slot ) {
                $slot['id'] = wp_generate_uuid4();
            }
            unset( $slot );
        }
        if ( ! empty( $clone['overlays'] ) && is_array( $clone['overlays'] ) ) {
            foreach ( $clone['overlays'] as &$overlay ) {
                $overlay['id'] = wp_generate_uuid4();
            }
            unset( $overlay );
        }

        return self::create( $clone );
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
            'createdAt'         => $data['createdAt'] ?? $now,
            'updatedAt'         => $now,
            'tags'              => array_map( 'sanitize_text_field', (array) ( $data['tags'] ?? [] ) ),
        ];
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

        return array_values( array_filter( array_map( function ( $o ) {
            $image_url = esc_url_raw( $o['imageUrl'] ?? '' );

            // Never persist blob URLs; they are local-tab only and break
            // when viewed later in campaign rendering.
            if ( strpos( $image_url, 'blob:' ) === 0 ) {
                return null;
            }

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
            ];
        }, $overlays ), static function ( $o ) {
            return is_array( $o );
        } ) );
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
     * Check if the serialized template library exceeds the size limit.
     *
     * @param  array $all All templates.
     * @return true|WP_Error
     */
    private static function check_size_limit( array $all ) {
        $size = strlen( serialize( $all ) );
        if ( $size > self::SIZE_LIMIT ) {
            return new WP_Error(
                'storage_limit',
                sprintf(
                    'Layout template library size (%s KB) exceeds the %s KB limit. Consider removing unused templates or migrating to a dedicated database table.',
                    round( $size / 1024, 1 ),
                    round( self::SIZE_LIMIT / 1024, 1 )
                ),
                [ 'status' => 413 ]
            );
        }
        return true;
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

        // Future migrations go here:
        // if ( $version < 2 ) { ... }

        return $template;
    }
}
