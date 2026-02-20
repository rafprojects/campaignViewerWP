<?php
/**
 * OG Fallback Provider Handler
 *
 * Last-resort handler that scrapes Open Graph meta tags from the
 * target page to extract title and thumbnail.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Provider_OG_Fallback implements WPSG_Provider_Handler {
    public function get_name(): string {
        return 'OG Fallback';
    }

    public function get_priority(): int {
        return 90;
    }

    /**
     * Always eligible — this is the last-resort handler.
     */
    public function can_handle(string $url, array $parsed): bool {
        return true;
    }

    public function fetch(string $url, array $parsed, array &$attempts): ?array {
        try {
            $attempts[] = $url;
            $resp = wp_remote_get($url, [
                'timeout'     => 6,
                'redirection' => 0,
                'headers'     => [
                    'Accept'     => 'text/html',
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.109 Safari/537.36',
                ],
            ]);

            $code = wp_remote_retrieve_response_code($resp);
            $body = wp_remote_retrieve_body($resp);

            if ($code >= 200 && $code < 300 && !empty($body)) {
                $og = [];
                if (preg_match('/<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']/i', $body, $m)) {
                    $og['title'] = html_entity_decode(trim($m[1]));
                }
                if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $body, $m)) {
                    $og['thumbnail_url'] = esc_url_raw(trim($m[1]));
                }

                if (!empty($og)) {
                    $host_label = !empty($parsed['host']) ? explode('.', $parsed['host'])[0] : 'external';
                    $og['provider_name'] = ucfirst($host_label);
                    return $og;
                }
            }
        } catch (Exception $e) {
            // ignore
        }

        return null;
    }
}
