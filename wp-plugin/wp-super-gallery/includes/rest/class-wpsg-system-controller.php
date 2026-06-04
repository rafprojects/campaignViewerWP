<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_System_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // Allow oEmbed proxy as public endpoint to avoid auth/cors issues for previews.
        // If you prefer restricting this, change permission_callback accordingly.
        //
        // SECURITY NOTE: This endpoint is publicly accessible (permission_callback: '__return_true')
        // which could allow anyone to use your server as a proxy for fetching external content.
        // While SSRF mitigations are in place (HTTPS requirement, IP blocking, allowlist), this could
        // still be abused for reconnaissance or as a component in attack chains. Consider requiring
        // authentication for this endpoint or implementing rate limiting to prevent abuse. If public
        // access is intentional for preview functionality, document this security tradeoff prominently.
        register_rest_route('wp-super-gallery/v1', '/oembed', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'proxy_oembed'],
                'permission_callback' => [self::class, 'rate_limit_public'],
            ],
        ]);

        // P14-D/E: Health & monitoring endpoints (admin only).
        register_rest_route('wp-super-gallery/v1', '/admin/health', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_health_data'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/oembed-failures', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_oembed_failures'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'reset_oembed_failures'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P14-C: Thumbnail cache management (admin only).
        register_rest_route('wp-super-gallery/v1', '/admin/thumbnail-cache', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_thumbnail_cache_stats'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'clear_thumbnail_cache'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/thumbnail-cache/refresh', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'refresh_thumbnail_cache'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P39-IN1: Webhook endpoint management.
        register_rest_route('wp-super-gallery/v1', '/webhooks', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_webhook_endpoints'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_webhook_endpoint'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/webhooks/delivery-log', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_webhook_deliveries'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/webhooks/(?P<index>\d+)', [
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_webhook_endpoint'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_webhook_endpoint'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/webhooks/(?P<index>\d+)/rotate-secret', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'rotate_webhook_secret'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
    }

    public static function proxy_oembed($request) {

        // P14-D: Rate limiting — exempt authenticated admins.
        if (!current_user_can('manage_options')) {
            $ip = WPSG_Rate_Limiter::get_client_ip();
            $rate_check = WPSG_Rate_Limiter::check($ip, 'oembed');
            if (!$rate_check['allowed']) {
                $response = new WP_REST_Response(['message' => 'Too many requests'], 429);
                $response->header('Retry-After', (string) ($rate_check['retry_after'] ?? 60));
                return $response;
            }
        }

        $url = esc_url_raw($request->get_param('url') ?? '');
        if (empty($url)) {
            return self::error_response('url is required', 400, 'wpsg_missing_url');
        }

        $parsed = wp_parse_url($url);
        if (!is_array($parsed)) {
            return self::error_response('Invalid oEmbed URL', 400, 'wpsg_invalid_oembed_url');
        }

        // Basic SSRF mitigations: require HTTPS and block private/internal IPs.
        $host = isset($parsed['host']) ? $parsed['host'] : '';
        $scheme = isset($parsed['scheme']) ? strtolower($parsed['scheme']) : '';
        if (empty($host)) {
            return self::error_response('Invalid oEmbed URL host', 400, 'wpsg_invalid_oembed_host');
        }

        // Normalize IPv6 literals wrapped in brackets (e.g. [::1])
        if (strlen($host) > 2 && $host[0] === '[' && substr($host, -1) === ']') {
            $host = substr($host, 1, -1);
        }

        if ($scheme !== 'https') {
            return self::error_response('Only HTTPS oEmbed URLs are allowed', 400, 'wpsg_oembed_https_required');
        }

        // Allowlist of well-known oEmbed providers (allows subdomains).
        $allowlist = [
            'youtube.com', 'youtu.be', 'vimeo.com', 'twitter.com', 'x.com', 'instagram.com',
            'soundcloud.com', 'flickr.com', 'dailymotion.com', 'noembed.com', 'rumble.com', 'odysee.com'
        ];

        $allowed = false;
        foreach ($allowlist as $a) {
            if ($host === $a || substr($host, -strlen('.' . $a)) === '.' . $a) {
                $allowed = true;
                break;
            }
        }

        if (!$allowed) {
            // Resolve host and ensure it doesn't resolve to private/internal IP ranges.
            // Check both IPv4 (A) and IPv6 (AAAA) records to prevent SSRF bypass.
            $ips_to_check = [];

            // If host is already an IP address, check it directly
            if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6)) {
                $ips_to_check[] = $host;
            } else {
                // For hostnames, try DNS resolution first (includes IPv6 support)
                $dns_records = dns_get_record($host, DNS_A | DNS_AAAA);
                if ($dns_records !== false && is_array($dns_records) && count($dns_records) > 0) {
                    foreach ($dns_records as $record) {
                        if (isset($record['ip'])) {
                            $ips_to_check[] = $record['ip']; // IPv4
                        }
                        if (isset($record['ipv6'])) {
                            $ips_to_check[] = $record['ipv6']; // IPv6
                        }
                    }
                }

                // Fallback to gethostbynamel() for IPv4 if DNS resolution failed
                if (empty($ips_to_check)) {
                    $ipv4_ips = gethostbynamel($host);
                    if ($ipv4_ips !== false && is_array($ipv4_ips)) {
                        $ips_to_check = array_merge($ips_to_check, $ipv4_ips);
                    }
                }

                if (empty($ips_to_check)) {
                    return self::error_response('Unable to resolve host for oEmbed URL', 400, 'wpsg_oembed_dns_failed');
                }
            }

            foreach ($ips_to_check as $ip) {
                if (self::is_private_ip($ip)) {
                    return self::error_response('oEmbed host resolves to a private or disallowed IP', 400, 'wpsg_oembed_ssrf_blocked');
                }
            }
        }

        $cache_key = 'wpsg_oembed_' . md5($url);
        $cached = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            // If we cached a previous error result include its status if present.
            $cached_status = isset($cached['_wpsg_status']) ? intval($cached['_wpsg_status']) : 200;
            // Remove internal status marker before returning to clients.
            $out = $cached;
            if (isset($out['_wpsg_status'])) {
                unset($out['_wpsg_status']);
            }
            return new WP_REST_Response($out, $cached_status);
        }

        // H-2: DNS rebinding SSRF protection.
        // The pre-flight DNS check above validates the IP *before* the HTTP request,
        // but a DNS rebinding attack can return a public IP for the validation lookup
        // and a private IP for the actual request (TOCTOU gap). This filter re-validates
        // the resolved IP at connection time inside wp_remote_get().
        $wpsg_ssrf_filter = null;
        $wpsg_ssrf_blocked = false;
        if (!$allowed) {
            $wpsg_ssrf_filter = function ($preempt, $args, $request_url) use (&$wpsg_ssrf_blocked) {
                $req_host = wp_parse_url($request_url, PHP_URL_HOST);
                if (empty($req_host)) {
                    return $preempt;
                }

                // Collect all resolved IPs for the host
                $ips = [];
                if (filter_var($req_host, FILTER_VALIDATE_IP)) {
                    $ips[] = $req_host;
                } else {
                    $dns = dns_get_record($req_host, DNS_A | DNS_AAAA);
                    if ($dns !== false && is_array($dns)) {
                        foreach ($dns as $record) {
                            if (isset($record['ip'])) {
                                $ips[] = $record['ip'];
                            }
                            if (isset($record['ipv6'])) {
                                $ips[] = $record['ipv6'];
                            }
                        }
                    }
                    if (empty($ips)) {
                        $ipv4 = gethostbynamel($req_host);
                        if ($ipv4 !== false && is_array($ipv4)) {
                            $ips = $ipv4;
                        }
                    }
                }

                foreach ($ips as $ip) {
                    if (self::check_private_ip($ip)) {
                        $wpsg_ssrf_blocked = true;
                        return new WP_Error(
                            'ssrf_dns_rebind',
                            'DNS rebinding detected: host resolved to a private IP at request time'
                        );
                    }
                }

                return $preempt;
            };
            add_filter('pre_http_request', $wpsg_ssrf_filter, 10, 3);
        }

        $attempts = [];
        try {
            $result = WPSG_OEmbed_Providers::fetch($url, $parsed, $attempts);
        } finally {
            // Always remove the SSRF filter — even if fetch() throws.
            if ($wpsg_ssrf_filter !== null) {
                remove_filter('pre_http_request', $wpsg_ssrf_filter, 10);
            }
        }

        // H-2: If the SSRF filter blocked the request due to DNS rebinding,
        // return a clear 400 instead of a generic 502 failure.
        if ($wpsg_ssrf_blocked) {
            return self::error_response('DNS rebinding detected: oEmbed host resolved to a private IP', 400, 'wpsg_oembed_dns_rebind');
        }

        if (is_array($result) && !empty($result)) {
            // If provider returned an error payload, cache it for a short TTL
            // to avoid hammering external services on repeated requests.
            if (!empty($result['error'])) {
                $error_payload = $result;
                $error_payload['_wpsg_status'] = 502;
                // Log and metric: record repeated oEmbed failures
                WPSG_Logger::warning('oembed', 'oEmbed fetch returned error payload', ['url' => $url, 'attempts' => $attempts]);
                do_action('wpsg_oembed_failure', $url, $attempts);
                $count = intval(get_option('wpsg_oembed_failure_count', 0));
                update_option('wpsg_oembed_failure_count', $count + 1);
                set_transient($cache_key, $error_payload, 5 * MINUTE_IN_SECONDS);
                return new WP_REST_Response($result, 502);
            }

            // Successful fetch: cache for longer TTL
            set_transient($cache_key, $result, 6 * HOUR_IN_SECONDS);
            // P14-C/D: Fire success hook for thumbnail caching.
            do_action('wpsg_oembed_success', $url, $result);
            return new WP_REST_Response($result, 200);
        }

        // Cache generic failure to avoid repeated immediate retries
        $fallback = [
            'message' => 'Unable to fetch oEmbed',
        ];
        $fallback['_wpsg_status'] = 502;
        // Log and metric: record generic fallback cache
        WPSG_Logger::warning('oembed', 'oEmbed fetch failed, caching generic fallback', ['url' => $url, 'attempts' => $attempts]);
        do_action('wpsg_oembed_failure', $url, $attempts);
        $count = intval(get_option('wpsg_oembed_failure_count', 0));
        update_option('wpsg_oembed_failure_count', $count + 1);
        set_transient($cache_key, $fallback, 5 * MINUTE_IN_SECONDS);
        // Do not expose internal cache metadata to clients.
        $out_fallback = $fallback;
        unset($out_fallback['_wpsg_status']);
        return new WP_REST_Response($out_fallback, 502);
    }

    public static function get_thumbnail_cache_stats() {
        $stats = WPSG_Thumbnail_Cache::get_stats();
        return new WP_REST_Response($stats, 200);
    }

    public static function clear_thumbnail_cache() {
        $removed = WPSG_Thumbnail_Cache::clear_all();
        return new WP_REST_Response(['cleared' => $removed], 200);
    }

    public static function refresh_thumbnail_cache() {
        $result = WPSG_Thumbnail_Cache::refresh_all();
        return new WP_REST_Response($result, 200);
    }

    // --- P14-D/E: Health & monitoring endpoints ---

    public static function get_health_data() {
        $health = WPSG_Monitoring::get_health_data();
        return new WP_REST_Response($health, 200);
    }

    public static function get_oembed_failures() {
        $failures = WPSG_Monitoring::get_oembed_failures();
        return new WP_REST_Response($failures, 200);
    }

    public static function reset_oembed_failures($request) {
        $provider = sanitize_text_field($request->get_param('provider') ?? '');
        WPSG_Monitoring::reset_oembed_failures($provider ?: null);
        return new WP_REST_Response(['reset' => true], 200);
    }

    // ── P39-IN1: Webhook endpoint management ─────────────────────────────────

    public static function list_webhook_endpoints($request) {
        $endpoints = WPSG_Webhooks::get_endpoints();
        $items = [];
        foreach ($endpoints as $idx => $endpoint) {
            $items[] = WPSG_Webhooks::format_endpoint_for_api($idx, $endpoint);
        }
        return new WP_REST_Response($items, 200);
    }

    public static function create_webhook_endpoint($request) {
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (count($endpoints) >= WPSG_Webhooks::MAX_ENDPOINTS) {
            return new WP_Error(
                'wpsg_webhook_limit',
                sprintf('Maximum of %d webhook endpoints allowed.', WPSG_Webhooks::MAX_ENDPOINTS),
                ['status' => 400]
            );
        }

        $raw_url = $request->get_param('url');
        $url = WPSG_Webhooks::sanitize_url(is_string($raw_url) ? $raw_url : '');
        if (empty($url)) {
            return new WP_Error('wpsg_invalid_url', 'A valid HTTP(S) URL is required.', ['status' => 400]);
        }

        $raw_events = $request->get_param('events');
        $events = WPSG_Webhooks::sanitize_events(is_array($raw_events) ? $raw_events : []);
        if (is_array($raw_events) && !empty($raw_events) && empty($events)) {
            return new WP_Error('wpsg_invalid_events', 'No recognised event names in the provided list.', ['status' => 400]);
        }
        $raw_enabled = $request->get_param('enabled');
        $enabled     = $raw_enabled === null ? true : self::is_truthy_param($raw_enabled);
        $secret = WPSG_Webhooks::generate_secret();

        $endpoint = [
            'id'      => wp_generate_uuid4(),
            'url'     => $url,
            'secret'  => $secret,
            'events'  => $events,
            'enabled' => $enabled,
        ];

        $endpoints[] = $endpoint;
        WPSG_Webhooks::save_endpoints($endpoints);

        $idx = count($endpoints) - 1;
        $response = WPSG_Webhooks::format_endpoint_for_api($idx, $endpoint);
        $response['secret'] = $secret; // One-time full secret exposure on creation.

        return new WP_REST_Response($response, 201);
    }

    public static function update_webhook_endpoint($request) {
        $idx       = intval($request->get_param('index'));
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (!isset($endpoints[$idx])) {
            return new WP_Error('wpsg_not_found', 'Webhook endpoint not found.', ['status' => 404]);
        }

        $existing = $endpoints[$idx];

        if ($request->get_param('url') !== null) {
            $raw_url = $request->get_param('url');
            $url = WPSG_Webhooks::sanitize_url(is_string($raw_url) ? $raw_url : '');
            if (empty($url)) {
                return new WP_Error('wpsg_invalid_url', 'A valid HTTP(S) URL is required.', ['status' => 400]);
            }
            $existing['url'] = $url;
        }

        if ($request->get_param('events') !== null) {
            $raw_events      = $request->get_param('events');
            $sanitized_events = WPSG_Webhooks::sanitize_events(is_array($raw_events) ? $raw_events : []);
            if (is_array($raw_events) && !empty($raw_events) && empty($sanitized_events)) {
                return new WP_Error('wpsg_invalid_events', 'No recognised event names in the provided list.', ['status' => 400]);
            }
            $existing['events'] = $sanitized_events;
        }

        if ($request->get_param('enabled') !== null) {
            $existing['enabled'] = self::is_truthy_param($request->get_param('enabled'));
        }

        $endpoints[$idx] = $existing;
        WPSG_Webhooks::save_endpoints($endpoints);

        return new WP_REST_Response(WPSG_Webhooks::format_endpoint_for_api($idx, $existing), 200);
    }

    public static function delete_webhook_endpoint($request) {
        $idx       = intval($request->get_param('index'));
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (!isset($endpoints[$idx])) {
            return new WP_Error('wpsg_not_found', 'Webhook endpoint not found.', ['status' => 404]);
        }

        array_splice($endpoints, $idx, 1);
        WPSG_Webhooks::save_endpoints($endpoints);

        return new WP_REST_Response(['deleted' => true], 200);
    }

    public static function rotate_webhook_secret($request) {
        $idx       = intval($request->get_param('index'));
        $endpoints = WPSG_Webhooks::get_endpoints();

        if (!isset($endpoints[$idx])) {
            return new WP_Error('wpsg_not_found', 'Webhook endpoint not found.', ['status' => 404]);
        }

        $new_secret           = WPSG_Webhooks::generate_secret();
        $endpoints[$idx]['secret'] = $new_secret;
        WPSG_Webhooks::save_endpoints($endpoints);

        return new WP_REST_Response(['secret' => $new_secret], 200);
    }

    public static function list_webhook_deliveries($request) {
        $log   = WPSG_Webhooks::get_delivery_log();
        $limit = max(0, min(intval($request->get_param('limit') ?? 50), 50));
        return new WP_REST_Response(array_slice($log, 0, $limit), 200);
    }

}
