<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Analytics_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // P18-F: Analytics
        register_rest_route('wp-super-gallery/v1', '/analytics/event', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'record_analytics_event'],
                'permission_callback' => WPSG_Permissions::gate('analytics.event.record'),
                'args'                => [
                    'campaign_id' => [
                        'required' => true,
                        'type'     => 'integer',
                        'minimum'  => 1,
                    ],
                    'event_type'  => [
                        'type'    => 'string',
                        'enum'    => ['view', 'lightbox_open'],
                        'default' => 'view',
                    ],
                    'media_id'    => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);
        register_rest_route('wp-super-gallery/v1', '/analytics/campaigns/(?P<id>\d+)', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_campaign_analytics'],
                'permission_callback' => WPSG_Permissions::gate('analytics.campaign.read'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/analytics/campaigns/(?P<id>\d+)/media', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_campaign_media_analytics'],
                'permission_callback' => WPSG_Permissions::gate('analytics.campaign.media.read'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/analytics/summary', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'get_analytics_summary'],
                'permission_callback' => WPSG_Permissions::gate('analytics.summary.read'),
            ],
        ]);
    }

    public static function record_analytics_event($request) {

        // Respect the enable_analytics setting (default: disabled).
        $settings = get_option('wpsg_settings', []);
        if (empty($settings['enable_analytics'])) {
            return new WP_Error('wpsg_analytics_disabled', 'Analytics disabled', ['status' => 403]);
        }

        $campaign_id = intval($request->get_param('campaign_id'));
        $event_type  = sanitize_text_field($request->get_param('event_type') ?? 'view');

        if ($campaign_id <= 0) {
            return new WP_Error('wpsg_invalid_campaign_id', 'Invalid campaignId', ['status' => 400]);
        }
        if (!self::campaign_exists($campaign_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $allowed_events = ['view', 'lightbox_open'];
        if (!in_array($event_type, $allowed_events, true)) {
            $event_type = 'view';
        }

        $media_id_raw = $request->get_param('media_id') ?? null;
        $media_id     = ($media_id_raw !== null && $media_id_raw !== '')
            ? sanitize_text_field($media_id_raw)
            : null;

        global $wpdb;
        $ip   = $_SERVER['REMOTE_ADDR'] ?? '';
        $salt = wp_salt('auth');
        $hash = hash('sha256', $ip . $salt);

        $table = WPSG_DB::get_analytics_table();
        $row   = [
            'campaign_id'  => $campaign_id,
            'event_type'   => $event_type,
            'visitor_hash' => $hash,
            'occurred_at'  => current_time('mysql', true),
        ];
        $fmts = ['%d', '%s', '%s', '%s'];
        if ($media_id !== null) {
            $row['media_id'] = $media_id;
            $fmts[]          = '%s';
        }
        $wpdb->insert($table, $row, $fmts);

        do_action('wpsg_analytics_event', $campaign_id, $media_id, $event_type, $hash);

        return new WP_REST_Response(['recorded' => true], 201);
    }

    /**
     * GET /analytics/campaigns/{id}?from=YYYY-MM-DD&to=YYYY-MM-DD
     * Admin-only. Returns totalViews, uniqueVisitors, daily breakdown.
     */
    public static function get_campaign_analytics($request) {
        $campaign_id = intval($request->get_param('id'));

        if (!self::campaign_exists($campaign_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $range = self::parse_analytics_date_range($request);
        if (is_wp_error($range)) {
            return $range;
        }
        [$from_str, $to_str] = $range;

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        // Aggregate per day.
        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT
                    DATE(occurred_at) AS date,
                    COUNT(*) AS views,
                    COUNT(DISTINCT visitor_hash) AS unique_visitors
                FROM {$table}
                WHERE campaign_id = %d
                  AND event_type = 'view'
                  AND occurred_at BETWEEN %s AND %s
                GROUP BY DATE(occurred_at)
                ORDER BY date ASC",
                $campaign_id,
                $from_str,
                $to_str
            ),
            ARRAY_A
        );

        $total_views   = array_sum(array_column($rows, 'views'));
        $total_unique  = 0;
        if (!empty($rows)) {
            $total_unique = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(DISTINCT visitor_hash) FROM {$table}
                     WHERE campaign_id = %d AND event_type = 'view'
                       AND occurred_at BETWEEN %s AND %s",
                    $campaign_id,
                    $from_str,
                    $to_str
                )
            );
        }

        return new WP_REST_Response([
            'totalViews'       => (int) $total_views,
            'uniqueVisitors'   => $total_unique,
            'daily'            => array_map(function ($row) {
                return [
                    'date'    => $row['date'],
                    'views'   => (int) $row['views'],
                    'unique'  => (int) $row['unique_visitors'],
                ];
            }, $rows),
        ], 200);
    }

    /**
     * Shared date-range parser for analytics endpoints.
     * Returns [from_str, to_str] or WP_Error on invalid range.
     */
    private static function parse_analytics_date_range($request) {
        $from = sanitize_text_field($request->get_param('from') ?? '');
        $to   = sanitize_text_field($request->get_param('to') ?? '');

        $to_ts   = $to   ? strtotime($to)   : time();
        $from_ts = $from ? strtotime($from) : strtotime('-30 days', $to_ts);
        if (!$from_ts || !$to_ts || $from_ts > $to_ts) {
            return new WP_Error('wpsg_invalid_date_range', 'Invalid date range', ['status' => 400]);
        }

        return [gmdate('Y-m-d 00:00:00', $from_ts), gmdate('Y-m-d 23:59:59', $to_ts)];
    }

    /**
     * GET /analytics/campaigns/{id}/media
     * Admin-only. Returns per-media view/lightbox_open breakdown.
     */
    public static function get_campaign_media_analytics($request) {
        $campaign_id = intval($request->get_param('id'));
        if (!self::campaign_exists($campaign_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $range = self::parse_analytics_date_range($request);
        if (is_wp_error($range)) {
            return $range;
        }
        [$from_str, $to_str] = $range;

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT
                    media_id,
                    SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) AS views,
                    SUM(CASE WHEN event_type = 'lightbox_open' THEN 1 ELSE 0 END) AS lightbox_opens
                FROM {$table}
                WHERE campaign_id = %d
                  AND media_id IS NOT NULL
                  AND occurred_at BETWEEN %s AND %s
                GROUP BY media_id
                ORDER BY views DESC",
                $campaign_id,
                $from_str,
                $to_str,
            ),
            ARRAY_A,
        );

        $items = array_map(function ($row) {
            return [
                'media_id'      => $row['media_id'],
                'views'         => (int) $row['views'],
                'lightbox_opens' => (int) $row['lightbox_opens'],
            ];
        }, $rows);

        return new WP_REST_Response(['items' => $items], 200);
    }

    /**
     * GET /analytics/summary
     * Admin-only. Cross-campaign totals and top-10 campaigns by views.
     */
    public static function get_analytics_summary($request) {
        $range = self::parse_analytics_date_range($request);
        if (is_wp_error($range)) {
            return $range;
        }
        [$from_str, $to_str] = $range;

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();

        $space_param    = sanitize_text_field($request->get_param('space') ?? '');
        $space_id       = (is_numeric($space_param) && intval($space_param) > 0) ? intval($space_param) : 0;
        $space_clause   = $space_id > 0 ? $wpdb->prepare(' AND space_id = %d', $space_id) : '';

        $total_views = (int) $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                "SELECT COUNT(*) FROM {$table}
                 WHERE event_type = 'view' AND occurred_at BETWEEN %s AND %s{$space_clause}",
                $from_str,
                $to_str,
            )
        );

        $unique_visitors = (int) $wpdb->get_var(
            $wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                "SELECT COUNT(DISTINCT visitor_hash) FROM {$table}
                 WHERE occurred_at BETWEEN %s AND %s{$space_clause}",
                $from_str,
                $to_str,
            )
        );

        $top_rows = $wpdb->get_results(
            $wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                "SELECT campaign_id, COUNT(*) AS views
                 FROM {$table}
                 WHERE event_type = 'view' AND occurred_at BETWEEN %s AND %s{$space_clause}
                 GROUP BY campaign_id
                 ORDER BY views DESC
                 LIMIT 10",
                $from_str,
                $to_str,
            ),
            ARRAY_A,
        );

        $top_campaigns = array_map(function ($row) {
            return [
                'id'    => strval($row['campaign_id']),
                'title' => get_post_field('post_title', intval($row['campaign_id'])) ?: sprintf('Campaign #%d', $row['campaign_id']),
                'views' => (int) $row['views'],
            ];
        }, $top_rows);

        return new WP_REST_Response([
            'totalViews'     => $total_views,
            'uniqueVisitors' => $unique_visitors,
            'topCampaigns'   => $top_campaigns,
        ], 200);
    }

}
