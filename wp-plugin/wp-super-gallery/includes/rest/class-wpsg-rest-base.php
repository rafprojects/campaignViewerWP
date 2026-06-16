<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Abstract base class for all WPSG REST controllers.
 *
 * Provides shared HTTP helpers, rate limiting, auth gates, pagination,
 * cache version management, and campaign/access utility methods that
 * every domain controller needs.
 */
abstract class WPSG_REST_Base {

    // Populated by rate_limit_check(); read by inject_rate_limit_headers filter.
    private static $rate_limit_headers = [];

    /**
     * Object-cache TTL (seconds) for general plugin settings.
     * Use this when caching settings that do not affect access control.
     */
    const CACHE_TTL_SETTINGS = 3600;

    /**
     * Object-cache TTL (seconds) for access-control reads.
     *
     * Kept short (60 s) so that grant revocations propagate quickly.
     * Access-control checks (grant lookups, role checks) MUST use this TTL
     * or bypass the cache entirely — never use CACHE_TTL_SETTINGS for them.
     */
    const CACHE_TTL_ACCESS = 60;

    // ── HTTP utilities ────────────────────────────────────────────────────────

    protected static function respond_with_etag($request, $payload, $status = 200, $salt = '') {
        $etag = '"' . md5(wp_json_encode($payload) . $salt) . '"';
        $if_none_match = $request ? $request->get_header('if-none-match') : '';

        if (!empty($if_none_match) && trim($if_none_match) === $etag) {
            $response = new WP_REST_Response(null, 304);
            $response->header('ETag', $etag);
            return $response;
        }

        $response = new WP_REST_Response($payload, $status);
        $response->header('ETag', $etag);
        return $response;
    }

    protected static function error_response($message, $status, $code = 'wpsg_error') {
        return new WP_REST_Response([
            'code' => $code,
            'message' => $message,
        ], $status);
    }

    // ── Rate limiting ─────────────────────────────────────────────────────────

    public static function rate_limit_public($request) {
        $limit = intval(apply_filters('wpsg_rate_limit_public', 60));
        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        return self::rate_limit_check($request, 'public', $limit, $window);
    }

    /**
     * Rate-limit authenticated endpoints (admin actions).
     *
     * Default: 120 requests per minute per IP. Per-space override via
     * `rate_limit_requests_per_minute` in settings_overrides (P48-D).
     * Global floor override via `wpsg_rate_limit_authenticated` filter.
     *
     * P52-A5: this primitive exclusively guards user creation (POST /users),
     * a System Admin action, so it requires `manage_options` (not merely
     * `manage_wpsg`). Keep that in mind if it is ever reused for another route.
     *
     * @since 0.18.0 P20-A
     */
    public static function rate_limit_authenticated($request) {
        if (!WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN)) {
            return false;
        }

        $global_limit = intval(apply_filters('wpsg_rate_limit_authenticated', 120));

        // Resolve per-space quota when the request targets a known space.
        $space_id = intval($request->get_param('id') ?: $request->get_param('space_id'));
        $limit = $global_limit;
        if ($space_id > 0 && class_exists('WPSG_Settings')) {
            $space_settings = WPSG_Settings::get_effective_settings($space_id);
            $space_rpm = intval($space_settings['rate_limit_requests_per_minute'] ?? 0);
            if ($space_rpm > 0) {
                $limit = $space_rpm;
            }
        }

        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        $result = self::rate_limit_check($request, 'authenticated', $limit, $window, $space_id);

        if (is_wp_error($result)) {
            return $result;
        }

        // Delegate the rest of the admin permission check (nonce, etc.)
        return self::verify_admin_auth();
    }

    /**
     * Rate-limit the magic-link approve endpoint.
     *
     * Default: 10 requests per minute per IP. Override via
     * `wpsg_rate_limit_magic_approve` filter.
     */
    public static function rate_limit_magic_approve($request) {
        $limit  = intval(apply_filters('wpsg_rate_limit_magic_approve', 10));
        $window = intval(apply_filters('wpsg_rate_limit_window', 60));
        return self::rate_limit_check($request, 'magic_approve', $limit, $window);
    }

    private static function rate_limit_check($request, $scope, $limit, $window, $space_id = 0) {
        if ($limit <= 0) {
            return true;
        }

        $ip = isset($_SERVER['REMOTE_ADDR']) ? sanitize_text_field(wp_unslash($_SERVER['REMOTE_ADDR'])) : 'unknown';
        $user_id = get_current_user_id();
        $route = $request->get_route();
        // Include space_id in the key when set so each space has its own bucket (P48-D).
        $space_seg = $space_id > 0 ? '_s' . $space_id : '';
        $key = sprintf('wpsg_rl_%s%s_%s_%s', $scope, $space_seg, $user_id ?: 'anon', md5($ip . '|' . $route));

        if (function_exists('wp_cache_incr')) {
            $cache_key = $key . '_count';
            $reset_key = $key . '_reset';

            $current = wp_cache_incr($cache_key, 1, 'wpsg_rate_limit');
            if ($current === false) {
                wp_cache_add($cache_key, 1, 'wpsg_rate_limit', $window);
                $current = 1;
            }

            $reset = wp_cache_get($reset_key, 'wpsg_rate_limit');
            if ($reset === false) {
                $reset = time() + $window;
                wp_cache_add($reset_key, $reset, 'wpsg_rate_limit', $window);
            }

            self::$rate_limit_headers = [
                'X-RateLimit-Limit'     => $limit,
                'X-RateLimit-Remaining' => max(0, $limit - $current),
                'X-RateLimit-Reset'     => (int) $reset,
            ];

            if ($current > $limit) {
                return new WP_Error(
                    'wpsg_rate_limited',
                    'Rate limit exceeded. Please try again later.',
                    ['status' => 429]
                );
            }

            return true;
        }

        $data = get_transient($key);
        if (!is_array($data)) {
            $data = [
                'count' => 0,
                'start' => time(),
            ];
        }

        $elapsed = time() - intval($data['start']);
        if ($elapsed > $window) {
            $data = [
                'count' => 0,
                'start' => time(),
            ];
        }

        $data['count']++;
        set_transient($key, $data, $window);

        self::$rate_limit_headers = [
            'X-RateLimit-Limit'     => $limit,
            'X-RateLimit-Remaining' => max(0, $limit - $data['count']),
            'X-RateLimit-Reset'     => intval($data['start']) + $window,
        ];

        if ($data['count'] > $limit) {
            return new WP_Error(
                'wpsg_rate_limited',
                'Rate limit exceeded. Please try again later.',
                ['status' => 429]
            );
        }

        return true;
    }

    public static function inject_rate_limit_headers($response, $handler, $request) {
        if (empty(self::$rate_limit_headers)) {
            return $response;
        }
        // rest_request_after_callbacks may receive a WP_Error (e.g. 429 rate-limit
        // denial from permission_callback). Convert it to WP_REST_Response so we
        // can attach the rate-limit headers before WP Core calls error_to_response.
        if (is_wp_error($response)) {
            $error_data = $response->get_error_data();
            $status     = isset($error_data['status']) ? (int) $error_data['status'] : 500;
            $response   = new WP_REST_Response([
                'code'    => $response->get_error_code(),
                'message' => $response->get_error_message(),
                'data'    => $error_data,
            ], $status);
        }
        if (method_exists($response, 'header')) {
            foreach (self::$rate_limit_headers as $header => $value) {
                $response->header($header, $value);
            }
            self::$rate_limit_headers = [];
        }
        return $response;
    }

    // ── Auth gates ────────────────────────────────────────────────────────────

    public static function require_admin() {
        if (!WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR)) {
            return false;
        }

        return self::verify_admin_auth();
    }

    /**
     * P52-A5: System Admin gate — requires `manage_options` (WordPress admin),
     * not merely `manage_wpsg`. Used for system/global surfaces that a
     * space-scoped `wpsg_editor` must never reach (health, caches, webhooks,
     * global audit log, media library, binary import/export, role assignment,
     * cross-space aggregates, company management, space creation).
     */
    public static function require_system_admin() {
        if (!WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_SYSTEM_ADMIN)) {
            return false;
        }

        return self::verify_admin_auth();
    }

    /**
     * P33-B: Sanitize and validate an access_level value.
     *
     * Returns the value unchanged if it is one of the accepted levels;
     * falls back to 'viewer' for any other input (including null or empty).
     * This implements the migration-default behaviour: legacy grant entries
     * without an explicit access_level are treated as 'viewer'.
     *
     * @param mixed $level
     * @return string 'viewer' | 'editor' | 'owner'
     */
    protected static function validate_access_level($level): string {
        return in_array($level, ['viewer', 'editor', 'owner'], true)
            ? (string) $level
            : 'viewer';
    }

    // ── P47-B: Space-level permission helpers ────────────────────────────────

    /**
     * Resolves the user's access level within a space.
     *
     * In open mode, manage_wpsg is treated as 'owner'. In delegated mode only
     * manage_options (super-admin) and explicit space grants confer access.
     *
     * @return string 'owner'|'editor'|'viewer'|'' (empty = no access)
     */
    protected static function get_effective_space_level(int $user_id, int $space_id): string {
        $space = WPSG_DB::get_space($space_id);
        if (!$space) {
            return '';
        }

        if (user_can($user_id, 'manage_options')) {
            return 'owner';
        }

        if ($space->isolation_mode === 'open' && user_can($user_id, 'manage_wpsg')) {
            return 'owner';
        }

        $grants = json_decode($space->access_grants, true);
        if (is_array($grants)) {
            foreach ($grants as $grant) {
                if (intval($grant['userId'] ?? 0) !== $user_id) {
                    continue;
                }
                $expires_at = $grant['expires_at'] ?? null;
                if ($expires_at !== null && strtotime($expires_at) < time()) {
                    continue; // expired grant confers no access
                }
                return self::validate_access_level($grant['access_level'] ?? 'viewer');
            }
        }

        return '';
    }

    /**
     * Returns true if the user has any access level inside the given space.
     */
    protected static function can_access_space(int $space_id, ?int $user_id): bool {
        $space = WPSG_DB::get_space($space_id);
        if (!$space || $space->archived) {
            return false;
        }
        return self::get_effective_space_level(intval($user_id), $space_id) !== '';
    }

    // ── P33-C: Role-Aware Permission Helpers ─────────────────────────────────

    /**
     * Resolve the effective access level for a user on a specific campaign.
     *
     * Precedence (highest → lowest):
     *   1. manage_wpsg capability → implicitly 'owner' (site-wide admin override)
     *   2. Explicit deny override → '' (no access)
     *   3. Campaign-level grant (overrides company grant for this campaign)
     *   4. Company-level grant (propagated to all company campaigns)
     *   5. No grant found → '' (no access)
     *
     * Expired grants are ignored in all cases.
     *
     * @param int $user_id     WordPress user ID.
     * @param int $campaign_id Post ID of the campaign.
     * @return string 'viewer' | 'editor' | 'owner' | '' (no access)
     */
    private static function get_effective_campaign_level(int $user_id, int $campaign_id): string {
        if ($user_id <= 0 || $campaign_id <= 0) {
            return '';
        }

        // P47-B: Delegated spaces can deny manage_wpsg users; must check before the admin short-circuit.
        $space_id = intval(get_post_meta($campaign_id, '_wpsg_space_id', true));
        if ($space_id > 0 && !self::can_access_space($space_id, $user_id)) {
            return '';
        }

        // 1. Site-wide admin always wins — they are treated as owner.
        if (current_user_can('manage_wpsg')) {
            return 'owner';
        }

        // 2. Explicit deny override beats every grant.
        $overrides = get_post_meta($campaign_id, 'access_overrides', true);
        $overrides = is_array($overrides) ? $overrides : [];
        foreach ($overrides as $entry) {
            if (intval($entry['userId'] ?? 0) === $user_id && ($entry['action'] ?? '') === 'deny') {
                return '';
            }
        }

        $now = time();

        // 3. Campaign-level grant (most specific, overrides company grant).
        $campaign_grants = get_post_meta($campaign_id, 'access_grants', true);
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        foreach ($campaign_grants as $entry) {
            if (intval($entry['userId'] ?? 0) !== $user_id) {
                continue;
            }
            // Expired grants do not confer access.
            if (!empty($entry['expires_at']) && strtotime($entry['expires_at']) < $now) {
                continue;
            }
            return self::validate_access_level($entry['access_level'] ?? 'viewer');
        }

        // 4. Company-level grant (falls back to this when no campaign grant exists).
        $company_term = self::get_company_term($campaign_id);
        if ($company_term) {
            $company_grants = get_term_meta($company_term->term_id, 'access_grants', true);
            $company_grants = is_array($company_grants) ? $company_grants : [];
            foreach ($company_grants as $entry) {
                if (intval($entry['userId'] ?? 0) !== $user_id) {
                    continue;
                }
                if (!empty($entry['expires_at']) && strtotime($entry['expires_at']) < $now) {
                    continue;
                }
                return self::validate_access_level($entry['access_level'] ?? 'viewer');
            }
        }

        // 5. No grant.
        return '';
    }

    /**
     * P33-C: Permission callback — requires at least 'editor' role on the
     * campaign identified by the request's `id` parameter.
     *
     * Site-wide manage_wpsg capability always satisfies this check.
     * Both `editor` and `owner` campaign roles satisfy this check.
     *
     * @param WP_REST_Request $request
     * @return bool
     */
    public static function require_campaign_editor(WP_REST_Request $request): bool {
        // Auth integrity check (nonce or Bearer token).
        if (!self::verify_admin_auth()) {
            return false;
        }

        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }

        // Site-wide admin is always allowed.
        if (WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR)) {
            return true;
        }

        $campaign_id = intval($request->get_param('id'));
        if ($campaign_id <= 0) {
            return false;
        }

        $level = self::get_effective_campaign_level($user_id, $campaign_id);
        return in_array($level, ['editor', 'owner'], true);
    }

    /**
     * P33-C: Permission callback — requires at least 'owner' role on the
     * campaign identified by the request's `id` parameter.
     *
     * Site-wide manage_wpsg capability always satisfies this check.
     * Only the `owner` campaign role (or site admin) satisfies this check.
     *
     * @param WP_REST_Request $request
     * @return bool
     */
    public static function require_campaign_owner(WP_REST_Request $request): bool {
        // Auth integrity check (nonce or Bearer token).
        if (!self::verify_admin_auth()) {
            return false;
        }

        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }

        // Site-wide admin is always allowed.
        if (WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR)) {
            return true;
        }

        $campaign_id = intval($request->get_param('id'));
        if ($campaign_id <= 0) {
            return false;
        }

        $level = self::get_effective_campaign_level($user_id, $campaign_id);
        return $level === 'owner';
    }

    // ── P47-C: Space permission callbacks ────────────────────────────────────

    /**
     * Permission callback — requires 'owner' level within the space identified
     * by the request's `id` parameter. manage_wpsg satisfies this in open mode
     * (via get_effective_space_level); manage_options always satisfies it.
     */
    public static function require_space_owner(WP_REST_Request $request): bool {
        if (!self::verify_admin_auth()) {
            return false;
        }
        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }
        $space_id = intval($request->get_param('id'));
        if ($space_id <= 0) {
            return false;
        }
        return self::get_effective_space_level($user_id, $space_id) === 'owner';
    }

    /**
     * Permission callback — requires any access level (viewer or above) within
     * the space identified by the request's `id` parameter.
     */
    public static function require_space_member(WP_REST_Request $request): bool {
        if (!self::verify_admin_auth()) {
            return false;
        }
        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }
        $space_id = intval($request->get_param('id'));
        if ($space_id <= 0) {
            return false;
        }
        return self::can_access_space($space_id, $user_id);
    }

    /**
     * P50-A: Permission callback for cross-space campaign moves — requires
     * 'owner' level on BOTH the campaign's current space and the target space.
     *
     * manage_options users resolve to 'owner' everywhere (the super-admin
     * bypass); manage_wpsg users resolve to 'owner' only in open-mode spaces,
     * so a manage_wpsg-only user cannot move campaigns into or out of a
     * delegated space they are not explicitly granted owner on.
     */
    public static function require_campaign_space_move(WP_REST_Request $request): bool {
        if (!self::verify_admin_auth()) {
            return false;
        }
        $user_id = get_current_user_id();
        if ($user_id <= 0) {
            return false;
        }
        $campaign_id     = intval($request->get_param('id'));
        $target_space_id = intval($request->get_param('target_space_id'));
        if ($campaign_id <= 0 || $target_space_id <= 0) {
            return false;
        }

        $source_space_id = intval(get_post_meta($campaign_id, '_wpsg_space_id', true));
        if ($source_space_id <= 0) {
            // Campaign predates the spaces backfill — treat the default space as its source.
            $source_space_id = intval(get_option('wpsg_default_space_id'));
        }
        if ($source_space_id > 0 && self::get_effective_space_level($user_id, $source_space_id) !== 'owner') {
            return false;
        }

        return self::get_effective_space_level($user_id, $target_space_id) === 'owner';
    }

    /**
     * P52-A5b: does the user have access to the space that owns this campaign?
     *
     * Mirrors the space gate in get_effective_campaign_level(): a campaign with
     * no space (pre-spaces install) is accessible to any manage_wpsg holder;
     * otherwise the user must have a level in its space (manage_options ⇒ owner
     * everywhere; open-mode manage_wpsg ⇒ owner; delegated ⇒ explicit grant).
     */
    private static function user_can_access_campaign_space(int $campaign_id, int $user_id): bool {
        $space_id = intval(get_post_meta($campaign_id, '_wpsg_space_id', true));
        if ($space_id <= 0) {
            $space_id = intval(get_option('wpsg_default_space_id'));
        }
        if ($space_id <= 0) {
            return true;
        }
        return self::can_access_space($space_id, $user_id);
    }

    /**
     * P52-A5b: per-campaign admin gate — requires manage_wpsg AND access to the
     * space that owns the campaign in the request's `id` param. Closes F2: a
     * manage_wpsg editor cannot act on campaigns in delegated spaces they were
     * not granted. Subscribers (no manage_wpsg) are denied, preserving the
     * admin-tier nature of these endpoints (analytics, audit, per-campaign export).
     */
    public static function require_campaign_space_access(WP_REST_Request $request): bool {
        if (!self::verify_admin_auth()) {
            return false;
        }
        $user_id = get_current_user_id();
        if ($user_id <= 0 || !WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR)) {
            return false;
        }
        $campaign_id = intval($request->get_param('id'));
        if ($campaign_id <= 0) {
            return false;
        }
        return self::user_can_access_campaign_space($campaign_id, $user_id);
    }

    /**
     * P52-A5b: batch variant — requires manage_wpsg AND access to the space of
     * EVERY campaign in the request's `ids` param. Any inaccessible campaign
     * denies the whole batch (no cross-space batch actions).
     */
    public static function require_campaign_batch_space_access(WP_REST_Request $request): bool {
        if (!self::verify_admin_auth()) {
            return false;
        }
        $user_id = get_current_user_id();
        if ($user_id <= 0 || !WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_EDITOR)) {
            return false;
        }
        $ids = $request->get_param('ids');
        if (!is_array($ids) || empty($ids)) {
            // Empty/malformed → let the handler return its own validation error.
            return true;
        }
        foreach ($ids as $cid) {
            $cid = intval($cid);
            if ($cid <= 0) {
                continue;
            }
            if (!self::user_can_access_campaign_space($cid, $user_id)) {
                return false;
            }
        }
        return true;
    }

    /**
     * @since 0.18.0 P20-A
     */
    private static function verify_admin_auth() {
        // For token-based auth (e.g., JWT Bearer), WordPress nonce is not required.
        // Nonce verification is only needed for cookie-authenticated REST requests.
        // HTTP_AUTHORIZATION may be absent on some Apache + PHP-FPM setups.
        // Check REDIRECT_HTTP_AUTHORIZATION (common with AllowOverride) and fall
        // back to reconstructing from PHP_AUTH_USER/PHP_AUTH_PW (PHP FastCGI).
        if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth_header = sanitize_text_field(wp_unslash($_SERVER['HTTP_AUTHORIZATION']));
        } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $auth_header = sanitize_text_field(wp_unslash($_SERVER['REDIRECT_HTTP_AUTHORIZATION']));
        } elseif (isset($_SERVER['PHP_AUTH_USER'])) {
            $auth_header = 'Basic ' . base64_encode(
                wp_unslash($_SERVER['PHP_AUTH_USER']) . ':' . wp_unslash($_SERVER['PHP_AUTH_PW'] ?? '')
            );
        } else {
            $auth_header = '';
        }
        if (!empty($auth_header) && stripos($auth_header, 'Bearer ') === 0) {
            return true;
        }

        // Application Password auth uses HTTP Basic. WP authenticates it before this
        // callback runs — no CSRF nonce is needed (nonces protect cookie sessions only).
        if (!empty($auth_header) && stripos($auth_header, 'Basic ') === 0) {
            return is_user_logged_in();
        }

        // Allow nonce bypass ONLY when the explicit WPSG_ALLOW_NONCE_BYPASS
        // constant is set AND we are in a recognised test/debug environment.
        // wp-env's test container sets WP_DEBUG=false in wp-config.php, so we
        // also accept the WP_TESTS_DOMAIN constant (defined by the WP PHPUnit
        // bootstrap) as a secondary indicator.
        if ( defined( 'WPSG_ALLOW_NONCE_BYPASS' ) && WPSG_ALLOW_NONCE_BYPASS ) {
            $is_test_env = ( defined( 'WP_DEBUG' ) && WP_DEBUG ) || defined( 'WP_TESTS_DOMAIN' );
            if ( ! $is_test_env ) {
                // Log a critical warning — this should never be active in production.
                WPSG_Logger::warning( 'security', 'WPSG_ALLOW_NONCE_BYPASS is enabled outside a recognized test environment', [ 'constant' => 'WPSG_ALLOW_NONCE_BYPASS' ] );
            }
            if ( $is_test_env ) {
                return true;
            }
        }

        return self::verify_rest_nonce();
    }

    private static function verify_rest_nonce() {
        $nonce = isset($_SERVER['HTTP_X_WP_NONCE']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_X_WP_NONCE'])) : '';
        return (bool) wp_verify_nonce($nonce, 'wp_rest');
    }

    public static function require_authenticated() {
        return WPSG_Permissions::actor_has_tier(WPSG_Permissions::TIER_VIEWER);
    }

    // ── Cache version ─────────────────────────────────────────────────────────

    /**
     * Get the current cache version counter.
     *
     * Included in all transient cache keys so that bumping the version
     * invalidates every key without expensive LIKE-based DELETEs.
     * Stale keys expire naturally via their TTL.
     *
     * @since 0.18.0 P20-I-3
     * @return int
     */
    public static function get_cache_version(): int {
        return intval(get_option('wpsg_cache_version', 1));
    }

    /**
     * Bump the cache version counter, effectively invalidating all caches.
     *
     * @since 0.18.0 P20-I-3
     */
    public static function bump_cache_version(): void {
        $v = self::get_cache_version();
        update_option('wpsg_cache_version', $v + 1, true);
    }

    // ── Pagination ────────────────────────────────────────────────────────────

    // ── P28-F: Pagination helpers ────────────────────────────────────────────

    protected static function parse_pagination($request, int $default_per_page = 50, int $max_per_page = 200): array {
        $page     = max(1, intval($request->get_param('page') ?? 1));
        $per_page = max(1, min($max_per_page, intval($request->get_param('per_page') ?? $default_per_page)));
        return [$page, $per_page, ($page - 1) * $per_page];
    }

    protected static function paginated_response(array $items, int $total, int $page, int $per_page): WP_REST_Response {
        $total_pages = $per_page > 0 ? (int) ceil($total / $per_page) : 1;
        return new WP_REST_Response([
            'items'       => $items,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => max(1, $total_pages),
        ], 200);
    }

    // ── Param coercion ────────────────────────────────────────────────────────

    protected static function is_truthy_param($value): bool {
        if (is_bool($value)) {
            return $value;
        }
        if (is_string($value)) {
            $normalized = strtolower(trim($value));
            return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
        }
        return (bool) $value;
    }

    // ── Campaign existence / visibility ───────────────────────────────────────

    protected static function campaign_exists($post_id) {
        $post = get_post($post_id);
        return $post && $post->post_type === 'wpsg_campaign';
    }

    protected static function can_view_campaign($post_id, $user_id) {
        $campaign_status = (string) get_post_meta($post_id, 'status', true);
        $visibility      = get_post_meta($post_id, 'visibility', true) ?: 'private';

        // Public campaigns are world-viewable (in schedule window, not draft)
        // regardless of space isolation or grants — "public" means public. A
        // logged-in user must never see less than an anonymous visitor does.
        if (
            $visibility === 'public'
            && $campaign_status !== 'draft'
            && self::is_campaign_within_schedule_window($post_id)
        ) {
            return true;
        }

        // P47-B: Space gate — delegated spaces deny ungranted admins before the
        // admin short-circuit below. Applies to non-public / draft / out-of-window
        // content only; in-window public campaigns already returned above.
        $space_id = intval(get_post_meta($post_id, '_wpsg_space_id', true));
        if ($space_id > 0 && !self::can_access_space($space_id, intval($user_id))) {
            return false;
        }

        if ($user_id && (user_can($user_id, 'manage_wpsg') || user_can($user_id, 'manage_options'))) {
            return true;
        }

        if (!self::is_campaign_within_schedule_window($post_id)) {
            return false;
        }

        // P36-C: Draft campaigns are only visible to their author.
        if ($campaign_status === 'draft') {
            if (!$user_id) {
                return false;
            }
            $post = get_post($post_id);
            return $post && intval($post->post_author) === $user_id;
        }

        // Private campaign within window: explicit deny-list, then grants.
        if (!$user_id) {
            return false;
        }

        $deny_user_ids = self::get_campaign_deny_ids($post_id);
        if (in_array($user_id, $deny_user_ids, true)) {
            return false;
        }

        $grants = self::get_effective_grants($post_id);
        foreach ($grants as $entry) {
            if (intval($entry['userId'] ?? 0) === $user_id) {
                return true;
            }
        }

        return false;
    }

    private static function is_campaign_within_schedule_window($post_id) {
        $now = gmdate('Y-m-d H:i:s');

        $publish_at = (string) get_post_meta($post_id, 'publish_at', true);
        if ($publish_at !== '' && $publish_at > $now) {
            return false;
        }

        $unpublish_at = (string) get_post_meta($post_id, 'unpublish_at', true);
        if ($unpublish_at !== '' && $unpublish_at <= $now) {
            return false;
        }

        return true;
    }

    private static function get_campaign_deny_ids($post_id) {
        $overrides = get_post_meta($post_id, 'access_overrides', true);
        $overrides = is_array($overrides) ? $overrides : [];
        return array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, array_filter($overrides, function ($entry) {
            return ($entry['action'] ?? '') === 'deny';
        }));
    }

    private static function get_effective_grants($post_id) {
        $company_term = self::get_company_term($post_id);
        $company_grants = $company_term ? get_term_meta($company_term->term_id, 'access_grants', true) : [];
        $campaign_grants = get_post_meta($post_id, 'access_grants', true);

        $company_grants = is_array($company_grants) ? $company_grants : [];
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];

        return array_values(array_merge($company_grants, $campaign_grants));
    }

    // ── Accessible campaign cache ─────────────────────────────────────────────

    protected static function get_accessible_campaign_ids($user_id) {
        $sanitized_user_id = absint($user_id);
        $cv = self::get_cache_version();
        $cache_key = 'wpsg_acc_v' . $cv . '_' . $sanitized_user_id;
        $cached = get_transient($cache_key);
        if (false !== $cached && is_array($cached)) {
            return $cached;
        }

        $per_page = max(1, intval(apply_filters('wpsg_permissions_page_size', 200)));
        $page = 1;
        $campaign_ids = [];

        do {
            $query = new WP_Query([
                'post_type' => 'wpsg_campaign',
                'post_status' => 'publish',
                'posts_per_page' => $per_page,
                'paged' => $page,
                'fields' => 'ids',
                'no_found_rows' => true,
            ]);

            foreach ($query->posts as $post_id) {
                if (self::can_view_campaign($post_id, $user_id)) {
                    $campaign_ids[] = (string) $post_id;
                }
            }

            $page += 1;
        } while (count($query->posts) === $per_page);

        $ttl = max(1, intval(apply_filters('wpsg_permissions_cache_ttl', 15 * MINUTE_IN_SECONDS)));
        set_transient($cache_key, $campaign_ids, $ttl);
        return $campaign_ids;
    }

    protected static function clear_accessible_campaigns_cache() {
        self::bump_cache_version();
    }

    // ── Company term ──────────────────────────────────────────────────────────

    protected static function get_company_term($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_company');
        if (!empty($terms) && !is_wp_error($terms)) {
            return $terms[0];
        }
        return null;
    }

    // ── Network / SSRF ────────────────────────────────────────────────────────

    /**
     * Check if an IP address is private/reserved (SSRF protection).
     *
     * Handles both IPv4 and IPv6 addresses, including:
     * - IPv4 private ranges (10.x, 172.16-31.x, 192.168.x)
     * - IPv4 loopback (127.x)
     * - IPv4 link-local (169.254.x)
     * - IPv6 loopback (::1)
     * - IPv6 unique local (fc00::/7)
     * - IPv6 link-local (fe80::/10)
     * - IPv6-mapped IPv4 (::ffff:x.x.x.x)
     * - IPv6 documentation (2001:db8::/32)
     * - IPv6 discard (100::/64)
     *
     * @param string $ip The IP address to check.
     * @return bool True if the IP is private/reserved, false otherwise.
     */
    protected static function is_private_ip($ip) {
        // Normalize the IP - remove brackets if present (common in URL parsing)
        $ip = trim($ip, '[]');

        // Check IPv4 first
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $long = sprintf('%u', ip2long($ip));
            $ranges = [
                ['10.0.0.0', '10.255.255.255'],         // Private (RFC 1918)
                ['172.16.0.0', '172.31.255.255'],       // Private (RFC 1918)
                ['192.168.0.0', '192.168.255.255'],     // Private (RFC 1918)
                ['127.0.0.0', '127.255.255.255'],       // Loopback (RFC 1122)
                ['169.254.0.0', '169.254.255.255'],     // Link-local (RFC 3927)
                ['0.0.0.0', '0.255.255.255'],           // "This" network (RFC 1122)
                ['100.64.0.0', '100.127.255.255'],      // Shared address space (RFC 6598)
                ['192.0.0.0', '192.0.0.255'],           // IETF Protocol Assignments (RFC 6890)
                ['192.0.2.0', '192.0.2.255'],           // TEST-NET-1 (RFC 5737)
                ['198.51.100.0', '198.51.100.255'],     // TEST-NET-2 (RFC 5737)
                ['203.0.113.0', '203.0.113.255'],       // TEST-NET-3 (RFC 5737)
            ];
            foreach ($ranges as $r) {
                $from = sprintf('%u', ip2long($r[0]));
                $to = sprintf('%u', ip2long($r[1]));
                if ($long >= $from && $long <= $to) {
                    return true;
                }
            }
            return false;
        }

        // Check IPv6
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            // Expand the IPv6 address to full notation for consistent checking
            $expanded = self::expand_ipv6($ip);
            if (!$expanded) {
                // Invalid IPv6 - treat as private for safety
                return true;
            }

            $lower = strtolower($expanded);

            // Loopback (::1)
            if ($lower === '0000:0000:0000:0000:0000:0000:0000:0001') {
                return true;
            }

            // Unspecified (::)
            if ($lower === '0000:0000:0000:0000:0000:0000:0000:0000') {
                return true;
            }

            // IPv4-mapped IPv6 (::ffff:x.x.x.x) - check the embedded IPv4
            if (substr($lower, 0, 30) === '0000:0000:0000:0000:0000:ffff:') {
                $ipv4_hex = substr($lower, 30);
                $parts = explode(':', $ipv4_hex);
                if (count($parts) === 2) {
                    $oct1 = hexdec(substr($parts[0], 0, 2));
                    $oct2 = hexdec(substr($parts[0], 2, 2));
                    $oct3 = hexdec(substr($parts[1], 0, 2));
                    $oct4 = hexdec(substr($parts[1], 2, 2));
                    $ipv4 = "$oct1.$oct2.$oct3.$oct4";
                    return self::is_private_ip($ipv4);
                }
            }

            // Get the first 16 bits (first group) for prefix checking
            $first_group = substr($lower, 0, 4);
            $first_byte = hexdec(substr($first_group, 0, 2));

            // Unique local addresses fc00::/7 (fc00-fdff)
            if ($first_byte >= 0xfc && $first_byte <= 0xfd) {
                return true;
            }

            // Link-local fe80::/10 (fe80-febf)
            if ($first_byte === 0xfe) {
                $second_nibble = hexdec(substr($first_group, 2, 1));
                // fe80-febf: second nibble is 8, 9, a, or b
                if ($second_nibble >= 0x8 && $second_nibble <= 0xb) {
                    return true;
                }
            }

            // Documentation 2001:db8::/32
            if (substr($lower, 0, 9) === '2001:0db8') {
                return true;
            }

            // Discard prefix 100::/64
            if (substr($lower, 0, 4) === '0100' && substr($lower, 0, 19) === '0100:0000:0000:0000') {
                return true;
            }

            // Multicast ff00::/8
            if ($first_byte === 0xff) {
                return true;
            }

            return false;
        }

        // If we can't validate the IP format, treat as private for safety
        return true;
    }

    /**
     * Public wrapper for is_private_ip() — used by the pre_http_request SSRF filter
     * closure in proxy_oembed() (H-2 DNS rebinding protection).
     *
     * @param string $ip The IP address to check.
     * @return bool True if the IP is private/reserved.
     */
    public static function check_private_ip($ip) {
        return self::is_private_ip($ip);
    }

    /**
     * Expand an IPv6 address to full notation (8 groups of 4 hex digits).
     *
     * @param string $ip The IPv6 address to expand.
     * @return string|false The expanded address or false on failure.
     */
    private static function expand_ipv6($ip) {
        // Use inet_pton and inet_ntop to normalize, then expand
        $packed = @inet_pton($ip);
        if ($packed === false) {
            return false;
        }

        // Convert to hex string
        $hex = bin2hex($packed);
        if (strlen($hex) !== 32) {
            return false;
        }

        // Format as 8 groups of 4 hex digits
        $groups = str_split($hex, 4);
        return implode(':', $groups);
    }

    // ── Campaign formatting ───────────────────────────────────────────────────
    // Shared by WPSG_Campaign_Controller, WPSG_Export_Controller, and any future
    // controller that needs to serialise a campaign post into a REST response.

    private static function meta_to_iso8601($post_id, $meta_key) {
        $value = (string) get_post_meta($post_id, $meta_key, true);
        if ($value === '') {
            return '';
        }
        $ts = strtotime($value . ' UTC');
        return $ts !== false ? gmdate('c', $ts) : '';
    }

    protected static function format_campaign($post) {
        $company_term = self::get_company_term($post->ID);
        $company_id = $company_term ? $company_term->slug : '';
        $thumbnail_id = get_post_thumbnail_id($post->ID);
        $thumbnail_url = $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : '';

        return [
            'id' => (string) $post->ID,
            'companyId' => $company_id,
            'companyName' => $company_term ? $company_term->name : '',
            'title' => $post->post_title,
            'description' => $post->post_content,
            'thumbnail' => $thumbnail_url,
            'coverImage' => (string) get_post_meta($post->ID, 'cover_image', true),
            'status' => (string) get_post_meta($post->ID, 'status', true) ?: 'draft',
            'visibility' => (string) get_post_meta($post->ID, 'visibility', true) ?: 'private',
            'tags' => get_post_meta($post->ID, 'tags', true) ?: [],
            'categories' => self::get_campaign_category_ids($post->ID),
            'publishAt' => self::meta_to_iso8601($post->ID, 'publish_at'),
            'unpublishAt' => self::meta_to_iso8601($post->ID, 'unpublish_at'),
            'layoutTemplateId' => get_post_meta($post->ID, '_wpsg_layout_binding_template_id', true) ?: null,
            'layoutBinding' => get_post_meta($post->ID, '_wpsg_layout_binding', true) ?: null,
            'galleryOverrides' => self::get_campaign_gallery_overrides($post->ID),
            'createdAt' => get_post_time('c', true, $post),
            'updatedAt' => get_post_modified_time('c', true, $post),
        ];
    }

    private static function get_campaign_category_names($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_campaign_category', ['fields' => 'names']);
        return is_array($terms) && !is_wp_error($terms) ? array_values($terms) : [];
    }

    private static function get_campaign_category_ids($post_id) {
        $terms = wp_get_object_terms($post_id, 'wpsg_campaign_category', ['fields' => 'ids']);
        return is_array($terms) && !is_wp_error($terms) ? array_values(array_map('strval', $terms)) : [];
    }

    private static function get_campaign_gallery_overrides($post_id) {
        $raw = get_post_meta($post_id, '_wpsg_gallery_overrides', true);
        $decoded = null;

        if (is_array($raw)) {
            $decoded = $raw;
        } elseif (is_string($raw) && $raw !== '') {
            $candidate = json_decode($raw, true);
            $decoded = is_array($candidate) ? $candidate : null;
        }

        return self::promote_campaign_gallery_overrides($decoded);
    }

    public static function promote_campaign_gallery_overrides($gallery_overrides) {
        $sanitized = WPSG_Settings_Sanitizer::sanitize_gallery_overrides($gallery_overrides);
        return !empty($sanitized) ? $sanitized : null;
    }

    // ── Audit ─────────────────────────────────────────────────────────────────
    // Shared by all controllers that write audit log entries.

    public static function add_audit_entry($post_id, $action, $details = [], array $ctx = []) {
        // Back-compat: legacy callers (e.g. WP-CLI) pass source inside $details.
        if (!isset($ctx['source']) && isset($details['source']) && is_string($details['source'])) {
            $ctx['source'] = $details['source'];
            unset($details['source']);
        }
        $user = wp_get_current_user();
        WPSG_DB::insert_audit_entry([
            'campaign_id'    => intval($post_id),
            'action'         => $action,
            'actor_id'       => $user->ID ?? 0,
            'actor_login'    => $user->user_login ?? '',
            'details'        => self::sanitize_audit_details($details),
            'created_at'     => gmdate('Y-m-d H:i:s'),
            'severity'       => $ctx['severity'] ?? 'info',
            'scope'          => $ctx['scope'] ?? 'campaign',
            'summary'        => $ctx['summary'] ?? '',
            'resource_type'  => $ctx['resource_type'] ?? '',
            'resource_id'    => $ctx['resource_id'] ?? '',
            'resource_label' => $ctx['resource_label'] ?? '',
            'source'         => $ctx['source'] ?? 'rest',
        ]);
    }

    private static function sanitize_audit_details($details, int $depth = 0) {
        if (!is_array($details)) {
            return [];
        }

        // Cap nesting depth to prevent stack overflow from crafted payloads.
        if ($depth > 5) {
            return [];
        }

        $sanitized = [];
        foreach ($details as $key => $value) {
            $safe_key = sanitize_text_field($key);
            if (is_array($value)) {
                $sanitized[$safe_key] = self::sanitize_audit_details($value, $depth + 1);
            } elseif (is_numeric($value)) {
                $sanitized[$safe_key] = $value + 0;
            } elseif (is_bool($value)) {
                $sanitized[$safe_key] = (bool) $value;
            } elseif (is_string($value)) {
                $sanitized[$safe_key] = sanitize_text_field($value);
            } else {
                $sanitized[$safe_key] = '';
            }
        }
        return $sanitized;
    }

    // ── Media deduplication ───────────────────────────────────────────────────
    // Shared by WPSG_Export_Controller (binary import) and WPSG_Media_Controller
    // (single-file upload).

    protected static function find_attachment_by_md5(string $md5): int {
        global $wpdb;
        $id = $wpdb->get_var($wpdb->prepare(
            "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wpsg_file_md5' AND meta_value = %s LIMIT 1",
            $md5
        ));
        return $id ? intval($id) : 0;
    }

    // ── Logging ───────────────────────────────────────────────────────────────

    protected static function log_slow_rest($label, $start_time, $context = []) {
        $elapsed_ms = (microtime(true) - $start_time) * 1000;
        $threshold_ms = intval(apply_filters('wpsg_slow_query_threshold_ms', 500));

        if ($elapsed_ms < $threshold_ms) {
            return;
        }

        $payload = [
            'label' => $label,
            'elapsedMs' => round($elapsed_ms, 2),
            'context' => $context,
        ];

        WPSG_Logger::warning('rest', 'Slow REST request detected', $payload);
        do_action('wpsg_slow_rest', $payload);
    }

    // -------------------------------------------------------------------------
    // Media helpers — shared by Campaign and Media controllers
    // -------------------------------------------------------------------------

    protected static function infer_media_type_from_url($url) {
        $image_extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'ico'];
        $video_extensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'wmv', 'flv'];

        $parsed = wp_parse_url($url);
        $path = isset($parsed['path']) ? strtolower($parsed['path']) : '';
        $extension = pathinfo($path, PATHINFO_EXTENSION);

        if (in_array($extension, $image_extensions, true)) {
            return 'image';
        }
        if (in_array($extension, $video_extensions, true)) {
            return 'video';
        }

        $video_providers = ['youtube.com', 'youtu.be', 'vimeo.com', 'rumble.com', 'bitchute.com', 'odysee.com', 'dailymotion.com'];
        $host = isset($parsed['host']) ? strtolower($parsed['host']) : '';
        foreach ($video_providers as $provider) {
            if (strpos($host, $provider) !== false) {
                return 'video';
            }
        }

        return null;
    }

    /**
     * Normalize media item types, including legacy records missing/incorrect type fields.
     *
     * @param array $media_items
     * @return array{items: array, updated: int}
     */
    protected static function normalize_media_items_types(array $media_items) {
        $updated_count = 0;

        foreach ($media_items as &$media_item) {
            $url = $media_item['url'] ?? '';
            $current_type = $media_item['type'] ?? '';
            $inferred_type = self::infer_media_type_from_url($url);

            if (!empty($media_item['embedUrl'])) {
                $inferred_type = 'video';
            }

            if ($inferred_type && $inferred_type !== $current_type) {
                $media_item['type'] = $inferred_type;
                $updated_count++;
            }
        }
        unset($media_item);

        return [
            'items' => $media_items,
            'updated' => $updated_count,
        ];
    }

    /**
     * Enrich media items with server-derived metadata: pixel dimensions,
     * upload date, filesize, and taxonomy tags.
     *
     * @param array $items          Raw media-item arrays from post_meta.
     * @param bool  $dimensions_only When true, skip date/filesize/tag enrichment.
     * @return array                 Same items with additional fields populated.
     */
    protected static function enrich_media_with_metadata(array $items, bool $dimensions_only = false): array {
        $terms_by_attachment = [];
        if (!$dimensions_only) {
            $attachment_ids = [];
            foreach ($items as $item) {
                $aid = intval($item['attachmentId'] ?? 0);
                if ($aid > 0 && ($item['source'] ?? '') === 'upload') {
                    $attachment_ids[$aid] = $aid;
                }
            }
            $attachment_ids = array_values($attachment_ids);

            if (!empty($attachment_ids)) {
                update_meta_cache('post', $attachment_ids);

                $all_terms = wp_get_object_terms(
                    $attachment_ids,
                    'wpsg_media_tag',
                    ['fields' => 'all_with_object_id'],
                );
                if (!is_wp_error($all_terms)) {
                    foreach ($all_terms as $t) {
                        $terms_by_attachment[(int) $t->object_id][] = [
                            'id'   => (int) $t->term_id,
                            'name' => (string) $t->name,
                            'slug' => (string) $t->slug,
                        ];
                    }
                }
            }
        }

        foreach ($items as &$item) {
            $source = $item['source'] ?? '';
            $aid    = intval($item['attachmentId'] ?? 0);

            if (empty($item['width']) || empty($item['height'])) {
                if ($aid > 0 && ($item['type'] ?? '') === 'image') {
                    $meta = wp_get_attachment_metadata($aid);
                    if (!empty($meta['width']) && !empty($meta['height'])) {
                        $item['width']  = intval($meta['width']);
                        $item['height'] = intval($meta['height']);
                    }
                }
            }

            if ($dimensions_only || $source !== 'upload' || $aid <= 0) {
                continue;
            }

            $post = get_post($aid);
            if ($post instanceof WP_Post) {
                $item['dateUploaded'] = $post->post_date;
            }

            $meta = wp_get_attachment_metadata($aid) ?: [];
            if (!empty($meta['filesize'])) {
                $item['filesize'] = intval($meta['filesize']);
            } else {
                $file = get_attached_file($aid);
                if ($file && file_exists($file)) {
                    $item['filesize'] = (int) filesize($file);
                }
            }

            if (isset($terms_by_attachment[$aid])) {
                $item['tags'] = $terms_by_attachment[$aid];
            }
        }
        unset($item);

        return $items;
    }

    // ── Taxonomy term helpers (used by WPSG_Content_Controller and WPSG_Media_Controller) ──

    protected static function format_term($term) {
        return [
            'id'        => strval($term->term_id),
            'name'      => $term->name,
            'slug'      => $term->slug,
            'count'     => (int) $term->count,
            'parent_id' => (int) $term->parent,
        ];
    }

    protected static function taxonomy_label(string $taxonomy): string {
        $labels = [
            'wpsg_campaign_category' => 'Campaign category',
            'wpsg_campaign_tag'      => 'Campaign tag',
            'wpsg_media_tag'         => 'Media tag',
        ];
        return $labels[$taxonomy] ?? $taxonomy;
    }

    protected static function handle_term_insert($name, $slug, $taxonomy, $created_status = 201, $parent_id = 0) {
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

    protected static function handle_term_delete($term_id, $taxonomy) {
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
}
