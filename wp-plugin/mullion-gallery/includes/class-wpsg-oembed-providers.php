<?php
/**
 * OEmbed Providers — Registry Facade
 *
 * This class now delegates to the modular WPSG_Provider_Registry.
 * The public fetch() method is preserved for backwards compatibility
 * with existing call sites (e.g. class-wpsg-rest.php::proxy_oembed).
 *
 * Individual provider handlers live in includes/providers/.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/providers/class-wpsg-provider-registry.php';

class WPSG_OEmbed_Providers {
    /**
     * Resolve oEmbed data for a URL via the provider registry.
     *
     * @param string   $url      The original media URL.
     * @param array    $parsed   Result of parse_url($url).
     * @param string[] $attempts Passed by reference — endpoint URLs tried.
     * @return array|null oEmbed data array on success, null on failure.
     */
    public static function fetch($url, $parsed, &$attempts) {
        return WPSG_Provider_Registry::resolve($url, $parsed, $attempts);
    }
}
