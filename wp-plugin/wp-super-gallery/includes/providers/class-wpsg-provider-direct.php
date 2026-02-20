<?php
/**
 * Direct oEmbed Endpoint Provider Handler
 *
 * Tries well-known oEmbed endpoints for major providers (YouTube, Vimeo)
 * and the noembed.com aggregator as a catch-all.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Provider_Direct implements WPSG_Provider_Handler {
    /**
     * Provider oEmbed endpoints to try in order.
     */
    private const ENDPOINTS = [
        'https://www.youtube.com/oembed?format=json&url=',
        'https://vimeo.com/api/oembed.json?url=',
        'https://noembed.com/embed?url=',
    ];

    public function get_name(): string {
        return 'Direct oEmbed';
    }

    public function get_priority(): int {
        return 30;
    }

    /**
     * Always eligible — tries multiple endpoints as a broad sweep.
     */
    public function can_handle(string $url, array $parsed): bool {
        return true;
    }

    public function fetch(string $url, array $parsed, array &$attempts): ?array {
        foreach (self::ENDPOINTS as $endpoint) {
            $full = $endpoint . rawurlencode($url);
            $attempts[] = $full;

            $resp = wp_remote_get($full, [
                'timeout' => 5,
                'headers' => ['Accept' => 'application/json'],
            ]);

            $code = wp_remote_retrieve_response_code($resp);
            $body = wp_remote_retrieve_body($resp);

            if ($code >= 200 && $code < 300 && !empty($body)) {
                $json = json_decode($body, true);
                if (is_array($json)) {
                    if (!empty($json['error'])) {
                        continue;
                    }
                    return $json;
                }
            }
        }

        return null;
    }
}
