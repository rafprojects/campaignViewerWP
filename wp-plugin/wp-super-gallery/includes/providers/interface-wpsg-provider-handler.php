<?php
/**
 * Provider Handler Contract
 *
 * All embed provider handlers implement this interface. The registry
 * iterates registered handlers in priority order, calling can_handle()
 * then fetch() on the first match.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

interface WPSG_Provider_Handler {
    /**
     * Determine whether this handler can service the given URL.
     *
     * Must be a fast, synchronous check (e.g. host-matching).
     * No HTTP requests should be made here.
     *
     * @param string $url    The original media URL.
     * @param array  $parsed Result of parse_url($url).
     * @return bool
     */
    public function can_handle(string $url, array $parsed): bool;

    /**
     * Fetch oEmbed / metadata for the URL.
     *
     * @param string   $url      The original media URL.
     * @param array    $parsed   Result of parse_url($url).
     * @param string[] $attempts Passed by reference — append endpoint URLs tried.
     * @return array|null Associative array on success, null to fall through.
     */
    public function fetch(string $url, array $parsed, array &$attempts): ?array;

    /**
     * Human-readable provider name (e.g. "YouTube", "Vimeo").
     *
     * @return string
     */
    public function get_name(): string;

    /**
     * Priority (lower = tried first). Default should be 50.
     *
     * @return int
     */
    public function get_priority(): int;
}
