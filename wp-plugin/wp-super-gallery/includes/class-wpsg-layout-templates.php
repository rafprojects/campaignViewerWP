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
        $merged   = array_merge( $existing, $data );

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
            'backgroundColor'   => sanitize_text_field( $data['backgroundColor'] ?? '#1a1a2e' ),
            'slots'             => self::sanitize_slots( $data['slots'] ?? [] ),
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
                'clipPath'       => isset( $s['clipPath'] ) ? sanitize_text_field( $s['clipPath'] ) : null,
                'maskUrl'        => isset( $s['maskUrl'] ) ? esc_url_raw( $s['maskUrl'] ) : null,
                'borderRadius'   => max( 0, intval( $s['borderRadius'] ?? 4 ) ),
                'borderWidth'    => max( 0, intval( $s['borderWidth'] ?? 0 ) ),
                'borderColor'    => sanitize_text_field( $s['borderColor'] ?? '#ffffff' ),
                'objectFit'      => in_array( $s['objectFit'] ?? '', $valid_fits, true ) ? $s['objectFit'] : 'cover',
                'objectPosition' => sanitize_text_field( $s['objectPosition'] ?? '50% 50%' ),
                'mediaId'        => isset( $s['mediaId'] ) ? sanitize_text_field( $s['mediaId'] ) : null,
                'clickAction'    => in_array( $s['clickAction'] ?? '', $valid_clicks, true ) ? $s['clickAction'] : 'lightbox',
                'hoverEffect'    => in_array( $s['hoverEffect'] ?? '', $valid_hovers, true ) ? $s['hoverEffect'] : 'pop',
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

        return array_values( array_map( function ( $o ) {
            return [
                'id'            => sanitize_text_field( $o['id'] ?? wp_generate_uuid4() ),
                'imageUrl'      => esc_url_raw( $o['imageUrl'] ?? '' ),
                'x'             => self::clamp_pct( $o['x'] ?? 0 ),
                'y'             => self::clamp_pct( $o['y'] ?? 0 ),
                'width'         => self::clamp_pct( $o['width'] ?? 100 ),
                'height'        => self::clamp_pct( $o['height'] ?? 100 ),
                'zIndex'        => intval( $o['zIndex'] ?? 999 ),
                'opacity'       => max( 0, min( 1, floatval( $o['opacity'] ?? 1 ) ) ),
                'pointerEvents' => (bool) ( $o['pointerEvents'] ?? false ),
            ];
        }, $overlays ) );
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

        // Future migrations go here:
        // if ( $version < 2 ) { ... }

        return $template;
    }
}
