<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_DB {
    const DB_VERSION = '4';

    public static function maybe_upgrade() {
        $current = get_option('wpsg_db_version', '0');
        if (version_compare($current, self::DB_VERSION, '>=')) {
            return;
        }

        self::add_indexes();
        self::maybe_create_analytics_table();
        self::maybe_create_media_refs_table();
        self::maybe_create_access_requests_table();
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

    // ── D-9: Access requests table ──────────────────────────────────────

    public static function maybe_create_access_requests_table() {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $table   = self::get_access_requests_table();
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE {$table} (
            id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            token        VARCHAR(36) NOT NULL,
            campaign_id  BIGINT UNSIGNED NOT NULL,
            email        VARCHAR(255) NOT NULL,
            status       VARCHAR(20) NOT NULL DEFAULT 'pending',
            requested_at DATETIME NOT NULL,
            resolved_at  DATETIME DEFAULT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY token (token),
            KEY campaign_status (campaign_id, status),
            KEY email_campaign (email, campaign_id)
        ) {$charset};";

        dbDelta($sql);

        // One-time migration from wp_options to custom table.
        if (!get_option('wpsg_access_requests_migrated')) {
            self::migrate_access_requests_from_options();
            update_option('wpsg_access_requests_migrated', '1');
        }
    }

    public static function get_access_requests_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'wpsg_access_requests';
    }

    /**
     * Migrate access request data from wp_options to the custom table.
     *
     * Reads the legacy wpsg_access_request_index option and each per-request
     * option, inserts rows into the new table, then deletes the old options.
     */
    private static function migrate_access_requests_from_options(): void {
        global $wpdb;
        $table = self::get_access_requests_table();
        $index = get_option('wpsg_access_request_index', []);

        if (!is_array($index) || empty($index)) {
            return;
        }

        foreach ($index as $token) {
            $token = (string) $token;
            $option_name = 'wpsg_access_request_' . $token;
            $data = get_option($option_name, null);

            if (!is_array($data)) {
                delete_option($option_name);
                continue;
            }

            $wpdb->insert($table, [
                'token'        => $token,
                'campaign_id'  => intval($data['campaign_id'] ?? 0),
                'email'        => sanitize_email($data['email'] ?? ''),
                'status'       => sanitize_text_field($data['status'] ?? 'pending'),
                'requested_at' => gmdate('Y-m-d H:i:s', strtotime($data['requested_at'] ?? 'now')),
                'resolved_at'  => !empty($data['resolved_at'])
                    ? gmdate('Y-m-d H:i:s', strtotime($data['resolved_at']))
                    : null,
            ], ['%s', '%d', '%s', '%s', '%s', '%s']);

            delete_option($option_name);
        }

        delete_option('wpsg_access_request_index');
    }

    // ── Access request query helpers ─────────────────────────────────────

    /**
     * Get a single access request by token.
     *
     * @return array|null Request row as associative array, or null.
     */
    public static function get_access_request(string $token): ?array {
        global $wpdb;
        $table = self::get_access_requests_table();
        $row = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$table} WHERE token = %s", $token),
            ARRAY_A
        );
        return $row ?: null;
    }

    /**
     * Insert a new access request.
     *
     * @return string The token of the inserted request.
     */
    public static function insert_access_request(array $data): string {
        global $wpdb;
        $table = self::get_access_requests_table();
        $wpdb->insert($table, [
            'token'        => $data['token'],
            'campaign_id'  => intval($data['campaign_id']),
            'email'        => $data['email'],
            'status'       => $data['status'] ?? 'pending',
            'requested_at' => gmdate('Y-m-d H:i:s', strtotime($data['requested_at'])),
            'resolved_at'  => null,
        ], ['%s', '%d', '%s', '%s', '%s', '%s']);
        return $data['token'];
    }

    /**
     * Update the status of an access request.
     */
    public static function update_access_request_status(string $token, string $status): void {
        global $wpdb;
        $table = self::get_access_requests_table();
        $wpdb->update(
            $table,
            [
                'status'      => $status,
                'resolved_at' => gmdate('Y-m-d H:i:s'),
            ],
            ['token' => $token],
            ['%s', '%s'],
            ['%s']
        );
    }

    /**
     * Delete an access request by token.
     */
    public static function delete_access_request(string $token): void {
        global $wpdb;
        $table = self::get_access_requests_table();
        $wpdb->delete($table, ['token' => $token], ['%s']);
    }

    /**
     * List access requests for a campaign, optionally filtered by status.
     *
     * @return array Array of associative arrays, newest first.
     */
    public static function list_access_requests(int $campaign_id, string $status = ''): array {
        global $wpdb;
        $table = self::get_access_requests_table();

        if ($status) {
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE campaign_id = %d AND status = %s ORDER BY requested_at DESC",
                    $campaign_id,
                    $status
                ),
                ARRAY_A
            );
        } else {
            $rows = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE campaign_id = %d ORDER BY requested_at DESC",
                    $campaign_id
                ),
                ARRAY_A
            );
        }

        return $rows ?: [];
    }

    /**
     * Find an existing request by email + campaign (for duplicate/cooldown checks).
     *
     * @return array|null Request row or null.
     */
    public static function find_access_request_by_email(string $email, int $campaign_id): ?array {
        global $wpdb;
        $table = self::get_access_requests_table();
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table} WHERE LOWER(email) = LOWER(%s) AND campaign_id = %d LIMIT 1",
                $email,
                $campaign_id
            ),
            ARRAY_A
        );
        return $row ?: null;
    }

    /**
     * Delete all access requests for a campaign (cleanup on campaign delete).
     */
    public static function delete_access_requests_for_campaign(int $campaign_id): void {
        global $wpdb;
        $table = self::get_access_requests_table();
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