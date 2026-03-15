<?php
/**
 * Stub for WP_CLI\Utils\format_items().
 *
 * Loaded by WPSG_CLI_Test.php so the namespaced function resolves at runtime
 * without using eval().
 */

namespace WP_CLI\Utils;

function format_items( string $format, array $items, array $fields ): void {
    \WP_CLI::$messages[] = [ 'type' => 'format', 'items' => $items ];
}
