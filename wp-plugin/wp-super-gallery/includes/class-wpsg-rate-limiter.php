<?php
/**
 * oEmbed Rate Limiting — P14-D
 *
 * Per-IP rate limiting for the public oEmbed proxy endpoint using
 * WordPress transients. Lightweight, no external dependencies.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Rate_Limiter {
    const DEFAULT_LIMIT   = 30;   // requests per window
    const DEFAULT_WINDOW  = 60;   // seconds
    const TRANSIENT_PREFIX = 'wpsg_rl_';

    /**
     * Check if a request should be rate-limited.
     *
     * @param string $ip        Client IP address.
     * @param string $endpoint  Endpoint identifier (e.g., 'oembed').
     * @return array{allowed: bool, remaining: int, retry_after?: int}
     */
    public static function check($ip, $endpoint = 'oembed') {
        $limit  = intval(apply_filters('wpsg_rate_limit_max', self::DEFAULT_LIMIT, $endpoint));
        $window = intval(apply_filters('wpsg_rate_limit_window', self::DEFAULT_WINDOW, $endpoint));

        $key = self::TRANSIENT_PREFIX . $endpoint . '_' . md5($ip);
        $bucket = get_transient($key);

        if (!is_array($bucket)) {
            $bucket = ['count' => 0, 'started' => time()];
        }

        $elapsed = time() - intval($bucket['started']);

        // Window expired — reset.
        if ($elapsed >= $window) {
            $bucket = ['count' => 1, 'started' => time()];
            set_transient($key, $bucket, $window);
            return ['allowed' => true, 'remaining' => $limit - 1];
        }

        $bucket['count']++;

        if ($bucket['count'] > $limit) {
            $retry_after = $window - $elapsed;
            set_transient($key, $bucket, $window);
            return [
                'allowed'     => false,
                'remaining'   => 0,
                'retry_after' => $retry_after,
            ];
        }

        set_transient($key, $bucket, $window);
        return ['allowed' => true, 'remaining' => $limit - $bucket['count']];
    }

    /**
     * Get user's real IP address, accounting for trusted proxies.
     *
     * Only honours forwarded headers (X-Forwarded-For, X-Real-IP) when
     * REMOTE_ADDR is in the trusted-proxies list. This prevents trivial
     * IP spoofing by untrusted clients.
     *
     * @return string
     */
    public static function get_client_ip() {
        $remote_addr = isset($_SERVER['REMOTE_ADDR'])
            ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR']))
            : '0.0.0.0';

        /**
         * Filter the list of trusted proxy IPs.
         *
         * When REMOTE_ADDR matches an entry, forwarded headers are used
         * to determine the real client IP.
         *
         * @param string[] $proxies Array of trusted proxy IPs.
         */
        $trusted_proxies = (array) apply_filters('wpsg_rate_limiter_trusted_proxies', []);

        // Only check forwarded headers when behind a trusted proxy.
        if (in_array($remote_addr, $trusted_proxies, true)) {
            $forwarded_headers = ['HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP'];
            foreach ($forwarded_headers as $header) {
                if (!empty($_SERVER[$header])) {
                    $ip = sanitize_text_field(wp_unslash($_SERVER[$header]));
                    // X-Forwarded-For may contain multiple IPs; take the first.
                    if (strpos($ip, ',') !== false) {
                        $ip = trim(explode(',', $ip)[0]);
                    }
                    if (filter_var($ip, FILTER_VALIDATE_IP)) {
                        return $ip;
                    }
                }
            }
        }

        return filter_var($remote_addr, FILTER_VALIDATE_IP) ? $remote_addr : '0.0.0.0';
    }
}
