<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__ . '/class-wpsg-oembed-providers.php';
require_once __DIR__ . '/rest/class-wpsg-rest-base.php';
require_once __DIR__ . '/rest/class-wpsg-campaign-controller.php';
require_once __DIR__ . '/rest/class-wpsg-export-controller.php';
require_once __DIR__ . '/rest/class-wpsg-media-controller.php';
require_once __DIR__ . '/rest/class-wpsg-analytics-controller.php';
require_once __DIR__ . '/rest/class-wpsg-access-controller.php';
require_once __DIR__ . '/rest/class-wpsg-auth-controller.php';
require_once __DIR__ . '/rest/class-wpsg-settings-controller.php';
// require_once __DIR__ . '/rest/class-wpsg-content-controller.php';     // DC8
// require_once __DIR__ . '/rest/class-wpsg-system-controller.php';      // DC9

class WPSG_REST extends WPSG_REST_Base {
    // Route ordering (when DC tracks activate, WPSG_REST::register_routes() will
    // delegate to each controller in this sequence):
    //   1. WPSG_Campaign_Controller::register_routes()   — DC1
    //   2. WPSG_Export_Controller::register_routes()     — DC2
    //   3. WPSG_Media_Controller::register_routes()      — DC3
    //   4. WPSG_Analytics_Controller::register_routes()  — DC4
    //   5. WPSG_Access_Controller::register_routes()     — DC5
    //   6. WPSG_Auth_Controller::register_routes()       — DC6
    //   7. WPSG_Settings_Controller::register_routes()   — DC7
    //   8. WPSG_Content_Controller::register_routes()    — DC8
    //   9. WPSG_System_Controller::register_routes()     — DC9

    public static function register_routes() {
        WPSG_Campaign_Controller::register_routes();
        WPSG_Export_Controller::register_routes();
        WPSG_Media_Controller::register_routes();
        WPSG_Analytics_Controller::register_routes();
        WPSG_Access_Controller::register_routes();
        WPSG_Auth_Controller::register_routes();
        WPSG_Settings_Controller::register_routes();
        // P18-H: Campaign categories
        register_rest_route('wp-super-gallery/v1', '/campaign-categories', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_campaign_categories'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign_category'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'slug' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_title',
                    ],
                    'parent_id' => [
                        'type'    => 'integer',
                        'default' => 0,
                        'minimum' => 0,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-categories/(?P<id>\d+)', [
            [
                'methods'             => 'PUT',
                'callback'            => [self::class, 'update_campaign_category'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'slug' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_title',
                    ],
                    'parent_id' => [
                        'type'    => 'integer',
                        'minimum' => 0,
                    ],
                ],
            ],
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_campaign_category'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P28-O: Campaign Templates
        register_rest_route('wp-super-gallery/v1', '/campaign-templates', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_campaign_templates'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_campaign_template'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'description' => [
                        'type'              => 'string',
                        'default'           => '',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'from_campaign_id' => [
                        'type'    => 'integer',
                        'minimum' => 1,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-templates/(?P<id>[a-zA-Z0-9_]+)', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_campaign_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaign-templates/(?P<id>[a-zA-Z0-9_]+)/instantiate', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'instantiate_campaign_template'],
                'permission_callback' => [self::class, 'require_admin'],
                'args'                => [
                    'name' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);
        // Company management routes
        register_rest_route('wp-super-gallery/v1', '/companies', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_companies'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
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

        // P14-G / P28-C: Campaign tags.
        register_rest_route('wp-super-gallery/v1', '/tags/campaign', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_campaign_tags'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_campaign_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/tags/campaign/(?P<id>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_campaign_tag'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // ── P15-B: Layout Template CRUD (admin) ──────────────────
        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_layout_templates'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'POST',
                'callback' => [self::class, 'create_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'PUT',
                'callback' => [self::class, 'update_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'delete_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/layout-templates/(?P<templateId>[a-f0-9\-]{36})/duplicate', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'duplicate_layout_template'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P15-H: Overlay image library (admin, campaign-agnostic).
        register_rest_route('wp-super-gallery/v1', '/admin/overlay-library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_overlay_library'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_overlay'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/overlay-library/(?P<id>[a-f0-9\-]{36})', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_overlay'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P22-L5: Custom font library (admin, campaign-agnostic).
        register_rest_route('wp-super-gallery/v1', '/admin/font-library', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'list_font_library'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'upload_font'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/admin/font-library/(?P<id>[a-f0-9\-]{36})', [
            [
                'methods'             => 'DELETE',
                'callback'            => [self::class, 'delete_font'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        // P15-B: Public read-only endpoint for rendering (no auth, ID-based only).
        register_rest_route('wp-super-gallery/v1', '/layout-templates/(?P<templateId>[a-f0-9\-]{36})', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_layout_template_public'],
                'permission_callback' => '__return_true',
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

    /**
     * List all companies with their campaign counts and statistics
     */
    public static function list_companies($request) {
        $page = max(1, intval($request->get_param('page') ?? 1));
        $per_page = max(1, min(100, intval($request->get_param('per_page') ?? 50)));
        $offset = ($page - 1) * $per_page;

        // Transient cache (same invalidation strategy as list_campaigns).
        $cache_version = get_option('wpsg_cache_version', 0);
        $cache_key = "wpsg_companies_{$page}_{$per_page}_{$cache_version}";
        $cached = get_transient($cache_key);
        if ($cached !== false) {
            $response = new WP_REST_Response($cached, 200);
            $total = wp_count_terms('wpsg_company', ['hide_empty' => false]);
            $response->header('X-WPSG-Total', (string) $total);
            $response->header('X-WPSG-Page', (string) $page);
            $response->header('X-WPSG-Per-Page', (string) $per_page);
            return $response;
        }

        $terms = get_terms([
            'taxonomy' => 'wpsg_company',
            'hide_empty' => false,
            'number' => $per_page,
            'offset' => $offset,
        ]);

        if (is_wp_error($terms)) {
            return new WP_Error('wpsg_internal_error', 'Failed to fetch companies', ['status' => 500]);
        }

        $companies = [];
        $term_ids = wp_list_pluck($terms, 'term_id');

        // Single query: fetch ALL campaigns assigned to ANY of the returned companies,
        // avoiding an N+1 get_posts call per company term.
        $all_campaigns = [];
        if (!empty($term_ids)) {
            $all_campaigns = get_posts([
                'post_type'      => 'wpsg_campaign',
                'posts_per_page' => -1,
                'tax_query'      => [
                    [
                        'taxonomy' => 'wpsg_company',
                        'field'    => 'term_id',
                        'terms'    => $term_ids,
                    ],
                ],
            ]);
        }

        // Prime meta + term caches in batch to eliminate N+1 queries in the loop.
        if (!empty($all_campaigns)) {
            $campaign_ids = wp_list_pluck($all_campaigns, 'ID');
            update_meta_cache('post', $campaign_ids);
            update_object_term_cache($campaign_ids, 'wpsg_company');
        }

        // Index campaigns by company term_id for O(1) lookup per company.
        $campaigns_by_term = [];
        foreach ($all_campaigns as $campaign) {
            $campaign_terms = wp_get_object_terms($campaign->ID, 'wpsg_company', ['fields' => 'ids']);
            foreach ($campaign_terms as $tid) {
                $campaigns_by_term[$tid][] = $campaign;
            }
        }

        foreach ($terms as $term) {
            $campaigns = $campaigns_by_term[$term->term_id] ?? [];

            $active_count = 0;
            $archived_count = 0;
            $campaign_list = [];

            foreach ($campaigns as $campaign) {
                $status = get_post_meta($campaign->ID, 'status', true) ?: 'active';
                if ($status === 'archived') {
                    $archived_count++;
                } else {
                    $active_count++;
                }
                $campaign_list[] = [
                    'id' => $campaign->ID,
                    'title' => $campaign->post_title,
                    'status' => $status,
                ];
            }

            // Get company-level access grants
            $company_grants = get_term_meta($term->term_id, 'access_grants', true);
            $company_grants = is_array($company_grants) ? $company_grants : [];

            $companies[] = [
                'id' => $term->term_id,
                'name' => $term->name,
                'slug' => $term->slug,
                'campaignCount' => count($campaigns),
                'activeCampaigns' => $active_count,
                'archivedCampaigns' => $archived_count,
                'accessGrantCount' => count($company_grants),
                'campaigns' => $campaign_list,
            ];
        }

        $total       = (int) wp_count_terms('wpsg_company', ['hide_empty' => false]);
        $total_pages = $per_page > 0 ? max(1, (int) ceil($total / $per_page)) : 1;
        $response_data = [
            'items'       => $companies,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => $total_pages,
        ];

        $ttl = 300;
        if (class_exists('WPSG_Settings')) {
            $ttl = intval(WPSG_Settings::get_setting('cache_ttl') ?: 300);
        }
        set_transient($cache_key, $response_data, $ttl);

        $response = new WP_REST_Response($response_data, 200);
        $response->header('X-WPSG-Total', (string) $total);
        $response->header('X-WPSG-Page', (string) $page);
        $response->header('X-WPSG-Per-Page', (string) $per_page);
        return $response;
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
                    if (WPSG_REST::check_private_ip($ip)) {
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

    // --- P14-G: Tag endpoints ---

    public static function list_campaign_tags($request) {
        [$page, $per_page, $offset] = self::parse_pagination($request);

        $total = (int) wp_count_terms('wpsg_campaign_tag', ['hide_empty' => false]);

        $terms = get_terms([
            'taxonomy'   => 'wpsg_campaign_tag',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
            'number'     => $per_page,
            'offset'     => $offset,
        ]);

        if (is_wp_error($terms)) {
            return self::paginated_response([], 0, $page, $per_page);
        }

        $items = array_map(function ($term) {
            return [
                'id'    => $term->term_id,
                'name'  => $term->name,
                'slug'  => $term->slug,
                'count' => $term->count,
            ];
        }, $terms);

        return self::paginated_response($items, $total, $page, $per_page);
    }

    public static function list_campaign_templates($request) {
        $builtins = WPSG_Campaign_Templates::get_builtins();
        $user     = WPSG_Campaign_Templates::get_user_templates();
        return new WP_REST_Response(['items' => array_merge($builtins, $user)], 200);
    }

    public static function create_campaign_template($request) {
        $name        = sanitize_text_field($request->get_param('name'));
        $description = sanitize_text_field($request->get_param('description') ?? '');
        $from_id     = intval($request->get_param('from_campaign_id') ?? 0);

        $meta = [
            'visibility'       => 'private',
            'gallery_overrides' => null,
            'layout_template_id' => null,
        ];

        if ($from_id > 0) {
            $source = get_post($from_id);
            if (!$source || $source->post_type !== 'wpsg_campaign') {
                return new WP_Error('wpsg_campaign_not_found', 'Source campaign not found', ['status' => 404]);
            }
            $meta['visibility']           = get_post_meta($from_id, 'visibility', true) ?: 'private';
            $meta['gallery_overrides']    = get_post_meta($from_id, '_wpsg_gallery_overrides', true) ?: null;
            $meta['layout_template_id']   = get_post_meta($from_id, '_wpsg_layout_binding_template_id', true) ?: null;
        }

        $post_id = wp_insert_post([
            'post_type'    => 'wpsg_campaign',
            'post_title'   => $name,
            'post_content' => $description,
            'post_status'  => 'publish',
        ], true);

        if (is_wp_error($post_id)) {
            return new WP_Error('wpsg_internal_error', $post_id->get_error_message(), ['status' => 500]);
        }

        update_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, '1');
        update_post_meta($post_id, 'visibility', $meta['visibility']);
        if ($meta['gallery_overrides'] !== null) {
            update_post_meta($post_id, '_wpsg_gallery_overrides', $meta['gallery_overrides']);
        }
        if ($meta['layout_template_id'] !== null) {
            update_post_meta($post_id, '_wpsg_layout_binding_template_id', $meta['layout_template_id']);
        }

        $post = get_post($post_id);
        return new WP_REST_Response(WPSG_Campaign_Templates::post_to_template($post), 201);
    }

    public static function delete_campaign_template($request) {
        $id = sanitize_text_field($request->get_param('id'));

        if (WPSG_Campaign_Templates::is_builtin($id)) {
            return new WP_Error('wpsg_forbidden', 'Built-in templates cannot be deleted', ['status' => 403]);
        }

        $post_id = intval($id);
        $post    = get_post($post_id);
        if (!$post || $post->post_type !== 'wpsg_campaign') {
            return new WP_Error('wpsg_not_found', 'Template not found', ['status' => 404]);
        }
        if (!get_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, true)) {
            return new WP_Error('wpsg_not_found', 'Template not found', ['status' => 404]);
        }

        wp_delete_post($post_id, true);
        return new WP_REST_Response(['deleted' => true, 'id' => $id], 200);
    }

    public static function instantiate_campaign_template($request) {
        $id   = sanitize_text_field($request->get_param('id'));
        $name = sanitize_text_field($request->get_param('name'));

        if (WPSG_Campaign_Templates::is_builtin($id)) {
            $tpl = WPSG_Campaign_Templates::get_builtin($id);
        } else {
            $post_id = intval($id);
            $post    = get_post($post_id);
            if (!$post || $post->post_type !== 'wpsg_campaign' || !get_post_meta($post_id, WPSG_Campaign_Templates::META_IS_TEMPLATE, true)) {
                return new WP_Error('wpsg_not_found', 'Template not found', ['status' => 404]);
            }
            $tpl = WPSG_Campaign_Templates::post_to_template($post);
        }

        $settings = $tpl['settings'] ?? [];

        $new_id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => $name,
            'post_status' => 'publish',
        ], true);

        if (is_wp_error($new_id)) {
            return new WP_Error('wpsg_internal_error', $new_id->get_error_message(), ['status' => 500]);
        }

        update_post_meta($new_id, 'visibility', $settings['visibility'] ?? 'private');
        update_post_meta($new_id, 'status', 'draft');
        if (!empty($settings['galleryOverrides'])) {
            update_post_meta($new_id, '_wpsg_gallery_overrides', $settings['galleryOverrides']);
        }
        if (!empty($settings['layoutTemplateId'])) {
            update_post_meta($new_id, '_wpsg_layout_binding_template_id', $settings['layoutTemplateId']);
        }

        return new WP_REST_Response(self::format_campaign(get_post($new_id)), 201);
    }

    private static function format_term($term) {
        return [
            'id'        => strval($term->term_id),
            'name'      => $term->name,
            'slug'      => $term->slug,
            'count'     => (int) $term->count,
            'parent_id' => (int) $term->parent,
        ];
    }

    private static function taxonomy_label(string $taxonomy): string {
        $labels = [
            'wpsg_campaign_category' => 'Campaign category',
            'wpsg_campaign_tag'      => 'Campaign tag',
            'wpsg_media_tag'         => 'Media tag',
        ];
        return $labels[$taxonomy] ?? $taxonomy;
    }

    private static function handle_term_insert($name, $slug, $taxonomy, $created_status = 201, $parent_id = 0) {
        $name = sanitize_text_field($name ?? '');
        if ($name === '') {
            return new WP_Error('wpsg_missing_name', 'name is required', ['status' => 400]);
        }
        $args = [];
        if ($slug !== null && $slug !== '') {
            $args['slug'] = sanitize_title($slug);
        }
        if ($parent_id > 0) {
            $args['parent'] = $parent_id;
        }
        $result = wp_insert_term($name, $taxonomy, $args);
        if (is_wp_error($result)) {
            $code = $result->get_error_code();
            if ($code === 'term_exists' || $code === 'duplicate_term_slug') {
                return new WP_Error('wpsg_term_exists', 'A term with that name or slug already exists', ['status' => 409]);
            }
            return new WP_Error('wpsg_internal_error', $result->get_error_message(), ['status' => 500]);
        }
        $label = self::taxonomy_label($taxonomy);
        self::add_audit_entry(0, 'taxonomy.term_created', [
            'taxonomy' => $taxonomy,
            'name'     => $name,
            'termId'   => strval($result['term_id']),
        ], [
            'scope'          => 'system',
            'summary'        => "{$label} created: {$name}",
            'resource_type'  => 'taxonomy',
            'resource_id'    => strval($result['term_id']),
            'resource_label' => $name,
        ]);
        $term = get_term($result['term_id'], $taxonomy);
        return new WP_REST_Response(self::format_term($term), $created_status);
    }

    private static function handle_term_delete($term_id, $taxonomy) {
        $term_id = intval($term_id);
        $term = get_term($term_id, $taxonomy);
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_not_found', 'Term not found', ['status' => 404]);
        }
        $term_name = $term->name;
        $result = wp_delete_term($term_id, $taxonomy);
        if (is_wp_error($result) || $result === false) {
            return new WP_Error('wpsg_internal_error', 'Failed to delete term', ['status' => 500]);
        }
        $label = self::taxonomy_label($taxonomy);
        self::add_audit_entry(0, 'taxonomy.term_deleted', [
            'taxonomy' => $taxonomy,
            'name'     => $term_name,
            'termId'   => strval($term_id),
        ], [
            'scope'          => 'system',
            'summary'        => "{$label} deleted: {$term_name}",
            'resource_type'  => 'taxonomy',
            'resource_id'    => strval($term_id),
            'resource_label' => $term_name,
        ]);
        return new WP_REST_Response(['deleted' => true, 'id' => strval($term_id)], 200);
    }

    public static function create_campaign_category(WP_REST_Request $request) {
        return self::handle_term_insert(
            $request->get_param('name'),
            $request->get_param('slug'),
            'wpsg_campaign_category',
            201,
            (int) ($request->get_param('parent_id') ?? 0),
        );
    }

    public static function update_campaign_category(WP_REST_Request $request) {
        $term_id = intval($request->get_param('id'));
        $term    = get_term($term_id, 'wpsg_campaign_category');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_not_found', 'Category not found', ['status' => 404]);
        }
        $args = [];
        $name      = $request->get_param('name');
        $slug      = $request->get_param('slug');
        $parent_id = $request->get_param('parent_id');
        if ($name !== null) {
            $args['name'] = sanitize_text_field($name);
        }
        if ($slug !== null) {
            $args['slug'] = sanitize_title($slug);
        }
        if ($parent_id !== null) {
            $args['parent'] = (int) $parent_id;
        }
        if (empty($args)) {
            return new WP_Error('wpsg_bad_request', 'Provide name, slug, or parent_id to update', ['status' => 400]);
        }
        $result = wp_update_term($term_id, 'wpsg_campaign_category', $args);
        if (is_wp_error($result)) {
            $code = $result->get_error_code();
            if ($code === 'term_exists' || $code === 'duplicate_term_slug') {
                return new WP_Error('wpsg_term_exists', 'A category with that name or slug already exists', ['status' => 409]);
            }
            return new WP_Error('wpsg_internal_error', $result->get_error_message(), ['status' => 500]);
        }
        $updated_term = get_term($result['term_id'], 'wpsg_campaign_category');
        $updated_name = $updated_term ? $updated_term->name : ($args['name'] ?? '');
        self::add_audit_entry(0, 'taxonomy.term_updated', [
            'taxonomy' => 'wpsg_campaign_category',
            'name'     => $updated_name,
            'termId'   => strval($term_id),
        ], [
            'scope'          => 'system',
            'summary'        => "Campaign category updated: {$updated_name}",
            'resource_type'  => 'taxonomy',
            'resource_id'    => strval($term_id),
            'resource_label' => $updated_name,
        ]);
        return new WP_REST_Response(self::format_term($updated_term), 200);
    }

    public static function delete_campaign_category(WP_REST_Request $request) {
        return self::handle_term_delete($request->get_param('id'), 'wpsg_campaign_category');
    }

    public static function create_campaign_tag(WP_REST_Request $request) {
        return self::handle_term_insert(
            $request->get_param('name'),
            $request->get_param('slug'),
            'wpsg_campaign_tag',
        );
    }

    public static function delete_campaign_tag(WP_REST_Request $request) {
        return self::handle_term_delete($request->get_param('id'), 'wpsg_campaign_tag');
    }
    public static function list_layout_templates($request) {
        $templates = WPSG_Layout_Templates::get_all();
        return new WP_REST_Response(array_values($templates), 200);
    }

    /**
     * Create a new layout template (admin).
     */
    public static function create_layout_template($request) {
        $data   = $request->get_json_params();
        $result = WPSG_Layout_Templates::create($data);

        if (is_wp_error($result)) {
            return $result;
        }

        $tmpl_name = $result['name'] ?? '';
        self::add_audit_entry(0, 'layout_template.created', [
            'templateId' => $result['id'] ?? '',
            'name'       => $tmpl_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template created: {$tmpl_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $result['id'] ?? '',
            'resource_label' => $tmpl_name,
        ]);

        return new WP_REST_Response($result, 201);
    }

    /**
     * Get a single layout template (admin).
     */
    public static function get_layout_template($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);

        if (!$template) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }

        return new WP_REST_Response($template, 200);
    }

    /**
     * Update a layout template (admin).
     */
    public static function update_layout_template($request) {
        $id     = $request->get_param('templateId');
        $data   = $request->get_json_params();
        $result = WPSG_Layout_Templates::update($id, $data);

        if (is_wp_error($result)) {
            return $result;
        }
        self::bump_cache_version();

        $tmpl_name = $result['name'] ?? '';
        self::add_audit_entry(0, 'layout_template.updated', [
            'templateId' => $id,
            'name'       => $tmpl_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template updated: {$tmpl_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $id,
            'resource_label' => $tmpl_name,
        ]);

        return new WP_REST_Response($result, 200);
    }

    /**
     * Delete a layout template (admin).
     */
    public static function delete_layout_template($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);
        $tmpl_name = $template ? ($template['name'] ?? $id) : $id;

        $deleted = WPSG_Layout_Templates::delete($id);

        if (!$deleted) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }
        self::bump_cache_version();

        self::add_audit_entry(0, 'layout_template.deleted', [
            'templateId' => $id,
            'name'       => $tmpl_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template deleted: {$tmpl_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $id,
            'resource_label' => $tmpl_name,
        ]);

        return new WP_REST_Response(['deleted' => true], 200);
    }

    /**
     * Duplicate a layout template (admin).
     */
    public static function duplicate_layout_template($request) {
        $id       = $request->get_param('templateId');
        $data     = $request->get_json_params();
        $new_name = sanitize_text_field($data['name'] ?? '');
        $result   = WPSG_Layout_Templates::duplicate($id, $new_name);

        if (is_wp_error($result)) {
            return $result;
        }

        $dup_name = $result['name'] ?? '';
        self::add_audit_entry(0, 'layout_template.duplicated', [
            'sourceId'   => $id,
            'templateId' => $result['id'] ?? '',
            'name'       => $dup_name,
        ], [
            'scope'          => 'system',
            'summary'        => "Layout template duplicated: {$dup_name}",
            'resource_type'  => 'layout_template',
            'resource_id'    => $result['id'] ?? '',
            'resource_label' => $dup_name,
        ]);

        return new WP_REST_Response($result, 201);
    }

    // ── Overlay Library (P15-H) ──────────────────────────────

    /**
     * List all overlay library items.
     */
    public static function list_overlay_library( $request ) {
        $items = WPSG_Overlay_Library::get_all();
        return new WP_REST_Response( $items, 200 );
    }

    /**
     * Upload a new overlay image (file upload) or register a URL.
     *
     * Accepts multipart/form-data with a 'file' field, or a JSON body
     * with { url, name } to register an external URL.
     */
    public static function upload_overlay( $request ) {
        // File upload path.
        if ( ! empty( $_FILES['file'] ) ) {
            $url = WPSG_Overlay_Library::handle_upload( $_FILES['file'] );
            if ( is_wp_error( $url ) ) {
                return new WP_Error( 'wpsg_upload_failed', $url->get_error_message(), [ 'status' => 400 ] );
            }
            $name = sanitize_text_field( $request->get_param( 'name' ) ?? basename( $_FILES['file']['name'] ) );
        } else {
            // URL-only path.
            $data = $request->get_json_params() ?? [];
            $url  = esc_url_raw( $data['url'] ?? '' );
            $name = sanitize_text_field( $data['name'] ?? '' );
            if ( empty( $url ) ) {
                return new WP_Error( 'wpsg_missing_file_or_url', 'A file or URL is required.', [ 'status' => 400 ] );
            }
        }

        $entry = WPSG_Overlay_Library::add( [ 'url' => $url, 'name' => $name ] );
        if ( is_wp_error( $entry ) ) {
            return new WP_Error( 'wpsg_overlay_save_failed', $entry->get_error_message(), [ 'status' => 500 ] );
        }
        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * Remove an overlay library entry.
     */
    public static function delete_overlay( $request ) {
        $id      = $request->get_param( 'id' );
        $deleted = WPSG_Overlay_Library::remove( $id );
        if ( ! $deleted ) {
            return new WP_Error( 'wpsg_overlay_not_found', 'Overlay not found.', [ 'status' => 404 ] );
        }
        return new WP_REST_Response( [ 'deleted' => true ], 200 );
    }

    // ── Font Library (P22-L5) ───────────────────────────────────

    /**
     * List all uploaded custom fonts.
     */
    public static function list_font_library( $request ) {
        $items = WPSG_Font_Library::get_all();
        return new WP_REST_Response( $items, 200 );
    }

    /**
     * Upload a new custom font file.
     */
    public static function upload_font( $request ) {
        $files = $request->get_file_params();
        if ( empty( $files['file'] ) ) {
            return new WP_Error( 'wpsg_missing_file', 'A font file is required.', [ 'status' => 400 ] );
        }

        $file = $files['file'];
        if ( isset( $file['error'] ) && UPLOAD_ERR_OK !== $file['error'] ) {
            $message = 'Upload failed.';
            $status  = 400;
            switch ( $file['error'] ) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $message = 'Uploaded file exceeds the allowed size.';
                    $status  = 413;
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $message = 'The uploaded file was only partially uploaded.';
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $message = 'No file was uploaded.';
                    break;
                case UPLOAD_ERR_NO_TMP_DIR:
                case UPLOAD_ERR_CANT_WRITE:
                case UPLOAD_ERR_EXTENSION:
                    $message = 'Server error while processing upload.';
                    $status  = 500;
                    break;
            }
            return new WP_Error( 'wpsg_font_upload_failed', $message, [ 'status' => $status ] );
        }

        if ( ! isset( $file['tmp_name'] ) || ! is_uploaded_file( $file['tmp_name'] ) ) {
            return new WP_Error( 'wpsg_invalid_upload', 'Invalid upload.', [ 'status' => 400 ] );
        }

        $result = WPSG_Font_Library::handle_upload( $file );
        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'wpsg_font_upload_failed', $result->get_error_message(), [ 'status' => 400 ] );
        }

        $name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
        if ( empty( $name ) ) {
            // Derive name from filename: "BrandSans-Bold.woff2" → "BrandSans Bold"
            $name = pathinfo( sanitize_file_name( $file['name'] ), PATHINFO_FILENAME );
            $name = str_replace( [ '-', '_' ], ' ', $name );
        }

        $entry = WPSG_Font_Library::add( [
            'url'      => $result['url'],
            'name'     => $name,
            'filename' => sanitize_file_name( $file['name'] ),
            'format'   => $result['format'],
        ] );

        return new WP_REST_Response( $entry, 201 );
    }

    /**
     * Remove a custom font entry and its file.
     */
    public static function delete_font( $request ) {
        $id      = $request->get_param( 'id' );
        $deleted = WPSG_Font_Library::remove( $id );
        if ( ! $deleted ) {
            return new WP_Error( 'wpsg_font_not_found', 'Font not found.', [ 'status' => 404 ] );
        }
        return new WP_REST_Response( [ 'deleted' => true ], 200 );
    }

    /**
     * Public read-only endpoint for rendering (no auth, ID-based only).
     */
    public static function get_layout_template_public($request) {
        $id       = $request->get_param('templateId');
        $template = WPSG_Layout_Templates::get($id);

        if (!$template) {
            return new WP_Error('wpsg_template_not_found', 'Template not found.', ['status' => 404]);
        }

        return new WP_REST_Response($template, 200);
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
