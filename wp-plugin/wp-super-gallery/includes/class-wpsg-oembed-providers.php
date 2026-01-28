<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_OEmbed_Providers {
    public static function fetch($url, $parsed, &$attempts) {
        $handlers = [
            [self::class, 'try_rumble_oembed'],
            [self::class, 'try_wp_core_oembed'],
            [self::class, 'try_provider_oembed'],
            [self::class, 'try_og_fallback'],
        ];

        foreach ($handlers as $handler) {
            $result = call_user_func($handler, $url, $parsed, $attempts);
            if (is_array($result) && !empty($result)) {
                return $result;
            }
        }

        return null;
    }

    private static function try_wp_core_oembed($url, $parsed, &$attempts) {
        $core_endpoint = rest_url('oembed/1.0/embed?url=' . rawurlencode($url));
        $attempts[] = $core_endpoint;
        $resp = wp_remote_get($core_endpoint, [
            'timeout' => 5,
            'headers' => [ 'Accept' => 'application/json' ],
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

    private static function try_provider_oembed($url, $parsed, &$attempts) {
        $provider_endpoints = [
            'https://www.youtube.com/oembed?format=json&url=',
            'https://vimeo.com/api/oembed.json?url=',
            'https://noembed.com/embed?url=',
        ];

        foreach ($provider_endpoints as $endpoint) {
            $full = $endpoint . rawurlencode($url);
            $attempts[] = $full;
            $resp = wp_remote_get($full, [ 'timeout' => 5, 'headers' => [ 'Accept' => 'application/json' ] ]);
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

    private static function try_rumble_oembed($url, $parsed, &$attempts) {
        $host = strtolower($parsed['host'] ?? '');
        if ($host !== 'rumble.com' && $host !== 'www.rumble.com') {
            return null;
        }

        $path = $parsed['path'] ?? '';
        $matches = [];
        if (!preg_match('#/((v[0-9a-zA-Z]+))(?:-[^/]+)?(?:\.html)?$#', $path, $matches)) {
            return null;
        }

        $video_id = $matches[2] ?? $matches[1];
        $pub = '';
        $title = '';
        $thumb = '';

        $html_resp = wp_remote_get($url, [
            'timeout' => 6,
            'headers' => [
                'Accept' => 'text/html',
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
            'type' => 'video',
            'provider_name' => 'Rumble',
            'title' => $title,
            'thumbnail_url' => $thumb,
            'html' => '<iframe src="' . esc_url($embed_src) . '" width="640" height="360" frameborder="0" allowfullscreen></iframe>',
        ];
    }

    private static function try_og_fallback($url, $parsed, &$attempts) {
        try {
            $resp = wp_remote_get($url, [
                'timeout' => 6,
                'headers' => [
                    'Accept' => 'text/html',
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
