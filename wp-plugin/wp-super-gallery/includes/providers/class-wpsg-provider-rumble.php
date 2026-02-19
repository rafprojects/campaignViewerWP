<?php
/**
 * Rumble Provider Handler
 *
 * Handles Rumble video URLs by scraping the page for embed ID, OG tags,
 * and constructing an iframe embed.
 *
 * @package WP_Super_Gallery
 * @since   0.10.0
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Provider_Rumble implements WPSG_Provider_Handler {
    public function get_name(): string {
        return 'Rumble';
    }

    public function get_priority(): int {
        return 10;
    }

    public function can_handle(string $url, array $parsed): bool {
        $host = strtolower($parsed['host'] ?? '');
        return $host === 'rumble.com' || $host === 'www.rumble.com';
    }

    public function fetch(string $url, array $parsed, array &$attempts): ?array {
        $path = $parsed['path'] ?? '';
        $matches = [];
        if (!preg_match('#/((v[0-9a-zA-Z]+))(?:-[^/]+)?(?:\.html)?$#', $path, $matches)) {
            return null;
        }

        $video_id = $matches[2] ?? $matches[1];
        $pub   = '';
        $title = '';
        $thumb = '';

        $attempts[] = $url;
        $html_resp = wp_remote_get($url, [
            'timeout' => 6,
            'headers' => [
                'Accept'     => 'text/html',
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.109 Safari/537.36',
            ],
        ]);

        $html_code = wp_remote_retrieve_response_code($html_resp);
        $html_body = wp_remote_retrieve_body($html_resp);

        if ($html_code >= 200 && $html_code < 300 && !empty($html_body)) {
            if (preg_match('#https?://rumble\.com/embed/' . preg_quote($video_id, '#') . '/\?pub=([a-zA-Z0-9]+)#', $html_body, $m)) {
                $pub = $m[1];
            }
            if (empty($pub) && preg_match('#embedJS/u([a-zA-Z0-9]+)#', $html_body, $m)) {
                $pub = $m[1];
            }
            if (preg_match('/<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']+)["\']/i', $html_body, $m)) {
                $title = html_entity_decode(trim($m[1]));
            }
            if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']/i', $html_body, $m)) {
                $thumb = esc_url_raw(trim($m[1]));
            }
        }

        if (empty($pub)) {
            $pub = '4';
        }

        $embed_src = 'https://rumble.com/embed/' . esc_attr($video_id) . '/?pub=' . esc_attr($pub);

        return [
            'type'          => 'video',
            'provider_name' => 'Rumble',
            'title'         => $title,
            'thumbnail_url' => $thumb,
            'html'          => '<iframe src="' . esc_url($embed_src) . '" width="640" height="360" frameborder="0" allowfullscreen></iframe>',
        ];
    }
}
