<?php
/**
 * Structured logging facade for WP Super Gallery.
 *
 * Emits one consistent JSON record per log event to two sinks in parallel:
 *   1. The PHP error log (via error_log), preserving existing server-log behavior.
 *   2. A bounded in-database ring buffer (wpsg_recent_logs option) that admins
 *      can read from the health dashboard without raw server access.
 *
 * Record schema:
 *   {
 *     "timestamp": "2026-05-22T10:00:00Z",  // UTC ISO-8601
 *     "level":     "info|warning|error",
 *     "component": "<string>",               // e.g. "rest", "oembed", "security"
 *     "message":   "<string>",
 *     "data":      { ... }                   // optional structured context
 *   }
 *
 * @package WP_Super_Gallery
 * @since   0.32.0  P32-D
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Logger {

    /**
     * WordPress option key for the in-database ring buffer.
     */
    const LOG_OPTION = 'wpsg_recent_logs';

    /**
     * Default maximum number of log entries to retain in the ring buffer.
     * Operators may override via the `wpsg_log_max_entries` filter.
     */
    const DEFAULT_MAX_ENTRIES = 200;

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Log an informational event.
     *
     * @param string $component Logical area that emitted the event (e.g. "rest").
     * @param string $message   Human-readable description.
     * @param array  $data      Optional structured context payload.
     */
    public static function info(string $component, string $message, array $data = []): void {
        self::record('info', $component, $message, $data);
    }

    /**
     * Log a warning — an operator-relevant condition that is not a hard failure.
     *
     * @param string $component Logical area that emitted the event.
     * @param string $message   Human-readable description.
     * @param array  $data      Optional structured context payload.
     */
    public static function warning(string $component, string $message, array $data = []): void {
        self::record('warning', $component, $message, $data);
    }

    /**
     * Log an error — a failure that an operator should be aware of.
     *
     * @param string $component Logical area that emitted the event.
     * @param string $message   Human-readable description.
     * @param array  $data      Optional structured context payload.
     */
    public static function error(string $component, string $message, array $data = []): void {
        self::record('error', $component, $message, $data);
    }

    /**
     * Retrieve recent log entries from the ring buffer.
     *
     * Returns entries newest-first (index 0 = most recent).
     *
     * @param int $limit Maximum number of entries to return. Defaults to 50.
     * @return array<int, array> Array of log entry arrays.
     */
    public static function get_recent_logs(int $limit = 50): array {
        $limit = max(1, $limit);
        $logs  = get_option(self::LOG_OPTION, []);
        if (!is_array($logs)) {
            return [];
        }
        return array_slice($logs, 0, $limit);
    }

    /**
     * Clear all entries from the ring buffer.
     * Intended for admin-initiated resets.
     */
    public static function clear_logs(): void {
        update_option(self::LOG_OPTION, [], false);
    }

    // =========================================================================
    // Internal
    // =========================================================================

    /**
     * Build a structured record and dispatch it to both sinks.
     *
     * @param string $level     "info"|"warning"|"error"
     * @param string $component Logical area label.
     * @param string $message   Human-readable description.
     * @param array  $data      Structured context payload.
     */
    private static function record(string $level, string $component, string $message, array $data): void {
        $entry = [
            'timestamp' => gmdate('Y-m-d\TH:i:s\Z'),
            'level'     => $level,
            'component' => $component,
            'message'   => $message,
        ];

        if (!empty($data)) {
            $entry['data'] = $data;
        }

        // Sink 1: PHP error log — keeps existing server-log observability.
        error_log('[WPSG] ' . wp_json_encode($entry));

        // Sink 2: In-database ring buffer for the admin health surface.
        self::append_to_buffer($entry);
    }

    /**
     * Prepend an entry to the ring buffer, capping at the configured maximum.
     *
     * @param array $entry Structured log record.
     */
    private static function append_to_buffer(array $entry): void {
        $max = intval(apply_filters('wpsg_log_max_entries', self::DEFAULT_MAX_ENTRIES));
        $max = max(10, min(1000, $max));

        $logs = get_option(self::LOG_OPTION, []);
        if (!is_array($logs)) {
            $logs = [];
        }

        array_unshift($logs, $entry);

        if (count($logs) > $max) {
            $logs = array_slice($logs, 0, $max);
        }

        update_option(self::LOG_OPTION, $logs, false);
    }
}
