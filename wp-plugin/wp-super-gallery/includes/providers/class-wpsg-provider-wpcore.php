<?php
/**
 * WordPress Core oEmbed Provider Handler
 *
 * Delegates to WordPress's built-in oembed/1.0 endpoint.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Provider_WPCore implements WPSG_Provider_Handler {
    public function get_name(): string {
        return 'WordPress Core';
    }

    public function get_priority(): int {
        return 20;
    }

    /**
     * Always eligible — WP core is a universal fallback before direct endpoints.
     */
    public function can_handle(string $url, array $parsed): bool {
        return true;
    }

    public function fetch(string $url, array $parsed, array &$attempts): ?array {
        $core_endpoint = rest_url('oembed/1.0/embed?url=' . rawurlencode($url));
        $attempts[] = $core_endpoint;

        $resp = wp_remote_get($core_endpoint, [
            'timeout' => 5,
            'headers' => ['Accept' => 'application/json'],
        ]);

        $code = wp_remote_retrieve_response_code($resp);
        $body = wp_remote_retrieve_body($resp);

        if ($code >= 200 && $code < 300 && !empty($body)) {
            $json = json_decode($body, true);
            if (is_array($json)) {
                return $json;
            }
        }

        return null;
    }
}
