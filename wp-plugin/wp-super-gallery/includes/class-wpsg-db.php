<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_DB {
    const DB_VERSION = '3';

    public static function maybe_upgrade() {
        $current = get_option('wpsg_db_version', '0');
        if (version_compare($current, self::DB_VERSION, '>=')) {
            return;
        }

        self::add_indexes();
        self::maybe_create_analytics_table();
        self::maybe_create_media_refs_table();
        update_option('wpsg_db_version', self::DB_VERSION);
    }

    // ── P18-F: Analytics events table ─────────────────────────────────────
    public static function maybe_create_analytics_table() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $table   = $wpdb->prefix . 'wpsg_analytics_events';
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            campaign_id  BIGINT UNSIGNED NOT NULL,
            event_type   VARCHAR(32) NOT NULL DEFAULT 'view',
            visitor_hash CHAR(64) NOT NULL,
            occurred_at  DATETIME NOT NULL,
            PRIMARY KEY  (id),
            KEY campaign_occurred (campaign_id, occurred_at)
        ) {$charset};";

        dbDelta($sql);
    }

    // ── P18-F: Analytics helpers ───────────────────────────────────────────
    public static function get_analytics_table() {
        global $wpdb;
        return $wpdb->prefix . 'wpsg_analytics_events';
    }

    // ── P20-I-2: Media usage reverse index ────────────────────────────────

    /**
     * Create the wpsg_media_refs table for O(1) media usage lookups.
     *
     * @since 0.18.0 P20-I-2
     */
    public static function maybe_create_media_refs_table() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $table   = self::get_media_refs_table();
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            media_id     VARCHAR(191) NOT NULL,
            campaign_id  BIGINT UNSIGNED NOT NULL,
            created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY  (id),
            UNIQUE KEY media_campaign (media_id, campaign_id),
            KEY campaign_id (campaign_id)
        ) {$charset};";

        dbDelta($sql);

        // One-time backfill from existing campaign meta.
        if (!get_option('wpsg_media_refs_backfilled')) {
            self::backfill_media_refs();
            update_option('wpsg_media_refs_backfilled', '1');
        }
    }

    /**
     * Get the media refs table name.
     *
     * @since 0.18.0 P20-I-2
     */
    public static function get_media_refs_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'wpsg_media_refs';
    }

    /**
     * Backfill media_refs from existing campaign media_items meta.
     *
     * @since 0.18.0 P20-I-2
     */
    private static function backfill_media_refs(): void {
        global $wpdb;
        $table = self::get_media_refs_table();

        $campaigns = get_posts([
            'post_type'      => 'wpsg_campaign',
            'posts_per_page' => -1,
            'post_status'    => ['publish', 'draft', 'private'],
            'fields'         => 'ids',
        ]);

        foreach ($campaigns as $campaign_id) {
            $items = get_post_meta($campaign_id, 'media_items', true);
            if (!is_array($items)) {
                continue;
            }
            $seen = [];
            foreach ($items as $item) {
                $mid = $item['id'] ?? '';
                if ($mid === '' || in_array($mid, $seen, true)) {
                    continue;
                }
                $seen[] = $mid;
                $wpdb->query($wpdb->prepare(
                    "INSERT IGNORE INTO {$table} (media_id, campaign_id) VALUES (%s, %d)",
                    $mid,
                    $campaign_id
                ));
            }
        }
    }

    /**
     * Sync media_refs for a campaign after its media_items are updated.
     *
     * Call this whenever a campaign's media_items meta changes.
     *
     * @since 0.18.0 P20-I-2
     *
     * @param int   $campaign_id Campaign post ID.
     * @param array $media_items Array of media item arrays (each must have 'id' key).
     */
    public static function sync_media_refs(int $campaign_id, array $media_items): void {
        global $wpdb;
        $table = self::get_media_refs_table();

        // Delete existing refs for this campaign.
        $wpdb->delete($table, ['campaign_id' => $campaign_id], ['%d']);

        // Insert current refs.
        $seen = [];
        foreach ($media_items as $item) {
            $mid = $item['id'] ?? '';
            if ($mid === '' || in_array($mid, $seen, true)) {
                continue;
            }
            $seen[] = $mid;
            $wpdb->insert($table, [
                'media_id'    => $mid,
                'campaign_id' => $campaign_id,
            ], ['%s', '%d']);
        }
    }

    /**
     * Find which campaigns reference a given media ID.
     *
     * @since 0.18.0 P20-I-2
     *
     * @param string $media_id Media item ID.
     * @return array Array of ['id' => campaign_id, 'title' => post_title].
     */
    public static function get_media_usage(string $media_id): array {
        global $wpdb;
        $table = self::get_media_refs_table();

        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT r.campaign_id, p.post_title
             FROM {$table} r
             INNER JOIN {$wpdb->posts} p ON p.ID = r.campaign_id
             WHERE r.media_id = %s",
            $media_id
        ));

        return array_map(function ($row) {
            return [
                'id'    => strval($row->campaign_id),
                'title' => $row->post_title,
            ];
        }, $rows ?: []);
    }

    /**
     * Get usage counts for multiple media IDs at once.
     *
     * @since 0.18.0 P20-I-2
     *
     * @param array $media_ids Array of media ID strings.
     * @return array Associative map { media_id => count }.
     */
    public static function get_media_usage_summary(array $media_ids): array {
        global $wpdb;
        $table = self::get_media_refs_table();

        if (empty($media_ids)) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($media_ids), '%s'));
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT media_id, COUNT(*) as cnt FROM {$table}
             WHERE media_id IN ({$placeholders})
             GROUP BY media_id",
            ...$media_ids
        ));

        $result = array_fill_keys($media_ids, 0);
        foreach ($rows ?: [] as $row) {
            $result[$row->media_id] = (int) $row->cnt;
        }
        return $result;
    }

    /**
     * Remove all media_refs for a campaign (e.g., on delete).
     *
     * @since 0.18.0 P20-I-2
     *
     * @param int $campaign_id Campaign post ID.
     */
    public static function delete_media_refs(int $campaign_id): void {
        global $wpdb;
        $table = self::get_media_refs_table();
        $wpdb->delete($table, ['campaign_id' => $campaign_id], ['%d']);
    }

    private static function add_indexes() {
        global $wpdb;

        self::ensure_index(
            $wpdb->postmeta,
            'wpsg_postmeta_postid_key',
            '(post_id, meta_key(191))'
        );

        self::ensure_index(
            $wpdb->termmeta,
            'wpsg_termmeta_termid_key',
            '(term_id, meta_key(191))'
        );
    }

    private static function ensure_index($table, $index_name, $columns_sql) {
        // Validate identifiers to prevent SQL injection.
        // prepare() cannot be used for DDL identifiers (table/index/column names).
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $index_name)) {
            return;
        }
        if (!preg_match('/^\([a-zA-Z0-9_,\s\(\)]+\)$/', $columns_sql)) {
            return;
        }

        global $wpdb;

        $existing = $wpdb->get_var(
            $wpdb->prepare(
                "SHOW INDEX FROM {$table} WHERE Key_name = %s",
                $index_name
            )
        );

        if ($existing) {
            return;
        }

        $wpdb->query("ALTER TABLE {$table} ADD INDEX {$index_name} {$columns_sql}");
    }
}