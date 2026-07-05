<?php
/**
 * P55-C: Adapter field schema loader.
 *
 * Single source of truth for the camelCase (JS) <-> snake_case (PHP) adapter
 * field-map contract. Reads adapter-fields.json once per request and caches
 * the result statically so subsequent calls pay no I/O cost.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Adapter_Field_Schema {

    /** @var array<string, string>|null Cached camelKey => snakeSlug map. */
    private static $map = null;

    /**
     * Return the camelKey => snakeSlug adapter field map derived from the
     * canonical schema JSON. Result is statically cached for the request lifetime.
     *
     * @return array<string, string>
     * @throws RuntimeException If the schema file cannot be read or decoded.
     */
    public static function get_map() {
        if (self::$map !== null) {
            return self::$map;
        }

        $schema_path = __DIR__ . '/adapter-fields.json';
        $json = file_get_contents($schema_path);

        if ($json === false) {
            throw new RuntimeException(
                '[WPSG] Could not read adapter field schema: ' . $schema_path  // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Exception message from a trusted __DIR__ constant path; not echoed output.
            );
        }

        $schema = json_decode($json, true);

        if (!is_array($schema) || !isset($schema['fields']) || !is_array($schema['fields'])) {
            throw new RuntimeException(
                '[WPSG] Invalid adapter field schema format: ' . $schema_path  // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- Exception message from a trusted __DIR__ constant path; not echoed output.
            );
        }

        self::$map = [];
        foreach ($schema['fields'] as $field) {
            if (isset($field['camelKey'], $field['snakeSlug'])) {
                self::$map[$field['camelKey']] = $field['snakeSlug'];
            }
        }

        return self::$map;
    }
}
