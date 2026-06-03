<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * P39-IN1: Webhook support for campaign events.
 *
 * Stores endpoint configs in their own option, dispatches signed HMAC-SHA256
 * payloads, retries on failure via WP-Cron (up to MAX_ATTEMPTS times), and
 * keeps a bounded ring-buffer delivery log for operator visibility.
 */
class WPSG_Webhooks {

    const VALID_EVENTS = [
        'campaign.created',
        'campaign.updated',
        'campaign.archived',
        'campaign.restored',
        'campaign.deleted',
        'media.added',
        'media.removed',
        'access.granted',
        'access.revoked',
    ];

    const MAX_ENDPOINTS = 5;
    const MAX_ATTEMPTS  = 3;
    const RETRY_HOOK    = 'wpsg_webhook_retry';
    const OPTION_NAME   = 'wpsg_webhook_endpoints';
    const LOG_OPTION    = 'wpsg_webhook_delivery_log';
    const MAX_LOG       = 50;

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    public static function register() {
        add_action('wpsg_campaign_created',  [self::class, 'on_campaign_created'],  10, 2);
        add_action('wpsg_campaign_updated',  [self::class, 'on_campaign_updated'],  10, 2);
        add_action('wpsg_campaign_archived', [self::class, 'on_campaign_archived'], 10, 1);
        add_action('wpsg_campaign_restored', [self::class, 'on_campaign_restored'], 10, 1);
        add_action('wpsg_campaign_deleted',  [self::class, 'on_campaign_deleted'],  10, 1);
        add_action('wpsg_media_added',       [self::class, 'on_media_added'],       10, 2);
        add_action('wpsg_media_removed',     [self::class, 'on_media_removed'],     10, 2);
        add_action('wpsg_access_granted',    [self::class, 'on_access_granted'],    10, 2);
        add_action('wpsg_access_revoked',    [self::class, 'on_access_revoked'],    10, 2);
        add_action(self::RETRY_HOOK,         [self::class, 'retry_delivery'],       10, 4);
    }

    // ── Event handlers ─────────────────────────────────────────────────────────

    public static function on_campaign_created(int $id, array $data) {
        self::dispatch('campaign.created', array_merge(['id' => $id], $data));
    }

    public static function on_campaign_updated(int $id, array $data) {
        self::dispatch('campaign.updated', array_merge(['id' => $id], $data));
    }

    public static function on_campaign_archived(int $id) {
        self::dispatch('campaign.archived', ['id' => $id]);
    }

    public static function on_campaign_restored(int $id) {
        self::dispatch('campaign.restored', ['id' => $id]);
    }

    public static function on_campaign_deleted(int $id) {
        self::dispatch('campaign.deleted', ['id' => $id]);
    }

    public static function on_media_added(int $campaign_id, array $data) {
        self::dispatch('media.added', array_merge(['campaignId' => $campaign_id], $data));
    }

    public static function on_media_removed(int $campaign_id, array $data) {
        self::dispatch('media.removed', array_merge(['campaignId' => $campaign_id], $data));
    }

    public static function on_access_granted(int $campaign_id, array $data) {
        self::dispatch('access.granted', array_merge(['campaignId' => $campaign_id], $data));
    }

    public static function on_access_revoked(int $campaign_id, array $data) {
        self::dispatch('access.revoked', array_merge(['campaignId' => $campaign_id], $data));
    }

    // ── Dispatch ───────────────────────────────────────────────────────────────

    public static function dispatch(string $event, array $payload) {
        $endpoints = self::get_endpoints_for_event($event);
        if (empty($endpoints)) {
            return;
        }

        $full_payload = [
            'event'     => $event,
            'timestamp' => gmdate('c'),
            'data'      => $payload,
        ];

        foreach ($endpoints as $idx => $endpoint) {
            self::deliver($idx, $endpoint, $event, $full_payload, 1);
        }
    }

    // ── Delivery ───────────────────────────────────────────────────────────────

    public static function deliver(int $idx, array $endpoint, string $event, array $full_payload, int $attempt) {
        $url    = $endpoint['url'] ?? '';
        $secret = $endpoint['secret'] ?? '';

        if (empty($url)) {
            return;
        }

        $body = wp_json_encode($full_payload);
        if ($body === false) {
            self::log_delivery($event, $url, $attempt, false, 0, wp_generate_uuid4());
            return;
        }
        $signature   = 'sha256=' . hash_hmac('sha256', $body, $secret);
        $delivery_id = wp_generate_uuid4();

        $response = wp_remote_post($url, [
            'timeout'   => 10,
            'headers'   => [
                'Content-Type'     => 'application/json',
                'X-WPSG-Signature' => $signature,
                'X-WPSG-Event'     => $event,
                'X-WPSG-Delivery'  => $delivery_id,
                'X-WPSG-Attempt'   => (string) $attempt,
            ],
            'body'      => $body,
            'sslverify' => true,
        ]);

        $is_wp_error = is_wp_error($response);
        $status_code = $is_wp_error ? 0 : intval(wp_remote_retrieve_response_code($response));
        $success     = !$is_wp_error && $status_code >= 200 && $status_code < 300;

        self::log_delivery($event, $url, $attempt, $success, $status_code, $delivery_id);

        if (!$success && $attempt < self::MAX_ATTEMPTS) {
            self::schedule_retry($idx, $event, $full_payload, $attempt + 1);
        }
    }

    private static function schedule_retry(int $idx, string $event, array $payload, int $attempt) {
        // Attempt 2: +5 min. Attempt 3: +30 min.
        // Only $idx (not the endpoint array) is persisted in WP-Cron to avoid
        // storing the HMAC secret in plain-text option storage. The endpoint is
        // reloaded from the option at retry time.
        $delays = [0, 300, 1800];
        $delay  = $delays[$attempt - 1] ?? 1800;
        wp_schedule_single_event(
            time() + $delay,
            self::RETRY_HOOK,
            [$idx, $event, $payload, $attempt]
        );
    }

    public static function retry_delivery(int $idx, string $event, array $payload, int $attempt) {
        $endpoints = self::get_endpoints();
        if (!isset($endpoints[$idx])) {
            return; // Endpoint was removed between schedule and retry — skip silently.
        }
        self::deliver($idx, $endpoints[$idx], $event, $payload, $attempt);
    }

    // ── Endpoint storage ───────────────────────────────────────────────────────

    private static function get_endpoints_for_event(string $event): array {
        $filtered = [];
        foreach (self::get_endpoints() as $idx => $endpoint) {
            if (empty($endpoint['enabled'])) {
                continue;
            }
            $events = $endpoint['events'] ?? [];
            if (!empty($events) && !in_array($event, $events, true)) {
                continue;
            }
            $filtered[$idx] = $endpoint;
        }
        return $filtered;
    }

    public static function get_endpoints(): array {
        $endpoints = get_option(self::OPTION_NAME, []);
        return is_array($endpoints) ? $endpoints : [];
    }

    public static function save_endpoints(array $endpoints): void {
        update_option(self::OPTION_NAME, array_values($endpoints), false);
    }

    // ── Delivery log ───────────────────────────────────────────────────────────

    private static function log_delivery(string $event, string $url, int $attempt, bool $success, int $status_code, string $delivery_id) {
        $log = get_option(self::LOG_OPTION, []);
        if (!is_array($log)) {
            $log = [];
        }
        array_unshift($log, [
            'deliveryId' => $delivery_id,
            'event'      => $event,
            'url'        => $url,
            'attempt'    => $attempt,
            'success'    => $success,
            'statusCode' => $status_code,
            'timestamp'  => time(),
        ]);
        $log = array_slice($log, 0, self::MAX_LOG);
        update_option(self::LOG_OPTION, $log, false);
    }

    public static function get_delivery_log(): array {
        $log = get_option(self::LOG_OPTION, []);
        return is_array($log) ? $log : [];
    }

    // ── Secret helpers ─────────────────────────────────────────────────────────

    public static function generate_secret(): string {
        return bin2hex(random_bytes(32));
    }

    public static function mask_secret(string $secret): string {
        if (strlen($secret) <= 8) {
            return str_repeat('*', strlen($secret));
        }
        return str_repeat('*', strlen($secret) - 8) . substr($secret, -8);
    }

    public static function sign(string $body, string $secret): string {
        return 'sha256=' . hash_hmac('sha256', $body, $secret);
    }

    // ── API helpers ────────────────────────────────────────────────────────────

    public static function format_endpoint_for_api(int $idx, array $endpoint): array {
        return [
            'index'      => $idx,
            'url'        => $endpoint['url'] ?? '',
            'secretHint' => self::mask_secret($endpoint['secret'] ?? ''),
            'events'     => $endpoint['events'] ?? [],
            'enabled'    => (bool) ($endpoint['enabled'] ?? true),
        ];
    }

    public static function sanitize_url(string $url): string {
        $url    = esc_url_raw(trim($url));
        $parsed = wp_parse_url($url);

        if (empty($parsed['scheme']) || !in_array(strtolower($parsed['scheme']), ['http', 'https'], true)) {
            return '';
        }

        if (empty($parsed['host'])) {
            return '';
        }

        return $url;
    }

    public static function sanitize_events(array $raw): array {
        $valid = [];
        foreach ($raw as $ev) {
            $ev = sanitize_text_field($ev);
            if (in_array($ev, self::VALID_EVENTS, true)) {
                $valid[] = $ev;
            }
        }
        return $valid;
    }
}
