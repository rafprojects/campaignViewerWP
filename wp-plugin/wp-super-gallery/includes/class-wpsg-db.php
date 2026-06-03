<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_DB {
    const DB_VERSION = '9';

    public static function maybe_upgrade() {
        $current = get_option('wpsg_db_version', '0');
        if (version_compare($current, self::DB_VERSION, '>=')) {
            return;
        }

        self::add_indexes();
        self::maybe_create_analytics_table();
        self::maybe_create_media_refs_table();
        self::maybe_create_access_requests_table();
        self::maybe_create_audit_log_table();
        self::maybe_upgrade_audit_log_v9();
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
            media_id     VARCHAR(191) NULL DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY campaign_occurred (campaign_id, occurred_at),
            KEY media_id (media_id)
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
     * This runs in batches to avoid time/memory issues on large sites and
     * stores progress (offset) so it can safely resume if interrupted.
     *
     * @since 0.18.0 P20-I-2
     */
    private static function backfill_media_refs(): void {
        global $wpdb;
        $table = self::get_media_refs_table();

        // Process campaigns in batches to limit memory/time usage.
        $batch_size = 100;

        // Track progress so we can resume if the process is interrupted.
        $offset_option = 'wpsg_media_refs_backfill_offset';
        $offset        = (int) get_option($offset_option, 0);

        while (true) {
            $campaigns = get_posts([
                'post_type'      => 'wpsg_campaign',
                'posts_per_page' => $batch_size,
                'offset'         => $offset,
                'post_status'    => ['publish', 'draft', 'private'],
                'fields'         => 'ids',
            ]);

            $count = is_array($campaigns) ? count($campaigns) : 0;

            if ($count === 0) {
                delete_option($offset_option);
                break;
            }

            foreach ($campaigns as $campaign_id) {
                $items = get_post_meta($campaign_id, 'media_items', true);
                if (!is_array($items)) {
                    continue;
                }

                $seen         = [];
                $placeholders = [];
                $values       = [];

                foreach ($items as $item) {
                    $mid = $item['id'] ?? '';
                    if ($mid === '' || in_array($mid, $seen, true)) {
                        continue;
                    }
                    $seen[]         = $mid;
                    $placeholders[] = '(%s, %d)';
                    $values[]       = $mid;
                    $values[]       = $campaign_id;
                }

                if (!empty($placeholders)) {
                    $sql = "INSERT IGNORE INTO {$table} (media_id, campaign_id) VALUES " . implode(', ', $placeholders);
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.NotPrepared
                    $wpdb->query($wpdb->prepare($sql, $values));
                }
            }

            // Advance offset and persist progress.
            $offset += $count;
            update_option($offset_option, $offset);

            // If we fetched fewer than a full batch, we've reached the end.
            if ($count < $batch_size) {
                delete_option($offset_option);
                break;
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
     * Find which campaigns contain a WordPress attachment by its post ID.
     *
     * P38-MD1: Used to surface campaign context in duplicate/near-duplicate upload warnings.
     * The wp_wpsg_media_refs lookup table uses media UUIDs, not WordPress attachment IDs, so
     * this method scans campaign media_items postmeta directly. Only called when a duplicate
     * is actually detected (infrequent), so the O(campaigns) scan is acceptable.
     *
     * @param int $attachment_id WordPress attachment post ID.
     * @return array Array of ['id' => string, 'title' => string].
     */
    public static function get_campaigns_for_attachment_id(int $attachment_id): array {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $campaign_ids = $wpdb->get_col(
            "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'wpsg_campaign' AND post_status NOT IN ('trash', 'auto-draft')"
        );

        $result = [];
        foreach ($campaign_ids as $campaign_id) {
            $items = get_post_meta((int) $campaign_id, 'media_items', true);
            if (!is_array($items)) {
                continue;
            }
            foreach ($items as $item) {
                if (isset($item['attachmentId']) && intval($item['attachmentId']) === $attachment_id) {
                    $result[] = [
                        'id'    => strval($campaign_id),
                        'title' => get_the_title((int) $campaign_id),
                    ];
                    break; // One entry per campaign — stop scanning this campaign's items.
                }
            }
        }
        return $result;
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
            id                   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            token                VARCHAR(36)  NOT NULL,
            campaign_id          BIGINT UNSIGNED NOT NULL,
            email                VARCHAR(255) NOT NULL,
            status               VARCHAR(20)  NOT NULL DEFAULT 'pending',
            requested_at         DATETIME     NOT NULL,
            resolved_at          DATETIME     DEFAULT NULL,
            magic_key_hash       VARCHAR(64)  NULL DEFAULT NULL,
            magic_key_expires_at DATETIME     NULL DEFAULT NULL,
            magic_key_used_at    DATETIME     NULL DEFAULT NULL,
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
     * Store a magic key hash and expiry against an access request token.
     * Resets used_at so a freshly generated key is treated as unused.
     */
    public static function set_magic_key(string $token, string $hash, string $expires_at): void {
        global $wpdb;
        $table = self::get_access_requests_table();
        $wpdb->update(
            $table,
            [
                'magic_key_hash'       => $hash,
                'magic_key_expires_at' => $expires_at,
                'magic_key_used_at'    => null,
            ],
            ['token' => $token],
            ['%s', '%s', null],
            ['%s']
        );
    }

    /**
     * Mark the magic key for a request as consumed.
     * Called immediately before processing approval to prevent replay.
     */
    public static function mark_magic_key_used(string $token): void {
        global $wpdb;
        $table = self::get_access_requests_table();
        $wpdb->update(
            $table,
            ['magic_key_used_at' => current_time('mysql', true)],
            ['token' => $token],
            ['%s'],
            ['%s']
        );
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

    // ── P28-G: Audit log table ──────────────────────────────────────────────

    public static function maybe_create_audit_log_table(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $table   = self::get_audit_log_table();
        $charset = $wpdb->get_charset_collate();

        // P40-CT1: expanded canonical event contract. campaign_id=0 denotes
        // system-scope events (no campaign owner). New columns have safe
        // defaults so legacy rows are always readable.
        $sql = "CREATE TABLE {$table} (
            id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            campaign_id    BIGINT UNSIGNED NOT NULL DEFAULT 0,
            action         VARCHAR(128) NOT NULL,
            actor_id       BIGINT UNSIGNED NOT NULL DEFAULT 0,
            actor_login    VARCHAR(60) NOT NULL DEFAULT '',
            details        LONGTEXT NOT NULL,
            created_at     DATETIME NOT NULL,
            severity       VARCHAR(16) NOT NULL DEFAULT 'info',
            scope          VARCHAR(16) NOT NULL DEFAULT 'campaign',
            summary        VARCHAR(255) NOT NULL DEFAULT '',
            resource_type  VARCHAR(64) NOT NULL DEFAULT '',
            resource_id    VARCHAR(128) NOT NULL DEFAULT '',
            resource_label VARCHAR(255) NOT NULL DEFAULT '',
            source         VARCHAR(64) NOT NULL DEFAULT '',
            PRIMARY KEY  (id),
            KEY campaign_created (campaign_id, created_at),
            KEY action (action),
            KEY created_at (created_at),
            KEY scope (scope)
        ) {$charset};";

        dbDelta($sql);
    }

    /**
     * P40-CT1: Idempotent migration — adds the seven new audit columns
     * (severity, scope, summary, resource_type, resource_id, resource_label,
     * source) when upgrading from a pre-v9 schema. dbDelta handles ADD COLUMN
     * for any missing columns. The presence of `severity` is used as the guard
     * because it is the first of the new columns; if it exists the full
     * migration has already run.
     */
    private static function maybe_upgrade_audit_log_v9(): void {
        global $wpdb;
        $table = self::get_audit_log_table();

        // Guard: if the severity column is already present the migration ran.
        $has_severity = $wpdb->get_var(
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$table}' AND COLUMN_NAME = 'severity'"
        );
        if (intval($has_severity) > 0) {
            return;
        }

        // Re-run dbDelta with the full updated schema; it will ADD missing columns.
        self::maybe_create_audit_log_table();
    }

    public static function get_audit_log_table(): string {
        global $wpdb;
        return $wpdb->prefix . 'wpsg_audit_log';
    }

    public static function insert_audit_entry(array $data): void {
        global $wpdb;
        $table = self::get_audit_log_table();
        $wpdb->insert($table, [
            'campaign_id'    => intval($data['campaign_id']),
            'action'         => sanitize_text_field($data['action']),
            'actor_id'       => intval($data['actor_id'] ?? 0),
            'actor_login'    => sanitize_text_field($data['actor_login'] ?? ''),
            'details'        => is_array($data['details']) ? wp_json_encode($data['details']) : '{}',
            'created_at'     => $data['created_at'] ?? gmdate('Y-m-d H:i:s'),
            'severity'       => in_array($data['severity'] ?? '', ['info', 'warning', 'error'], true) ? $data['severity'] : 'info',
            'scope'          => in_array($data['scope'] ?? '', ['campaign', 'system'], true) ? $data['scope'] : 'campaign',
            'summary'        => sanitize_text_field($data['summary'] ?? ''),
            'resource_type'  => sanitize_text_field($data['resource_type'] ?? ''),
            'resource_id'    => sanitize_text_field($data['resource_id'] ?? ''),
            'resource_label' => sanitize_text_field($data['resource_label'] ?? ''),
            'source'         => sanitize_text_field($data['source'] ?? ''),
        ], ['%d', '%s', '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s']);
    }

    /**
     * Backfill audit entries from post meta into the DB table for a campaign.
     * Called on first `list_audit` request when the table has no entries for that campaign.
     */
    public static function backfill_audit_entries(int $campaign_id, array $legacy_entries): void {
        foreach ($legacy_entries as $entry) {
            $created_raw = $entry['createdAt'] ?? $entry['created_at'] ?? '';
            $created_at  = $created_raw
                ? gmdate('Y-m-d H:i:s', strtotime($created_raw))
                : gmdate('Y-m-d H:i:s');

            self::insert_audit_entry([
                'campaign_id' => $campaign_id,
                'action'      => $entry['action'] ?? 'unknown',
                'actor_id'    => intval($entry['userId'] ?? 0),
                'actor_login' => '',
                'details'     => $entry['details'] ?? [],
                'created_at'  => $created_at,
            ]);
        }
    }

    /**
     * Query audit log entries with filtering and pagination.
     *
     * @param array $args {
     *   campaign_id?: int,
     *   from?: string  (ISO date string),
     *   to?:   string  (ISO date string),
     *   action?: string,
     *   scope?: 'campaign'|'system',
     *   severity?: 'info'|'warning'|'error',
     *   page?: int,
     *   per_page?: int,
     * }
     * @return array { total: int, items: array }
     */
    public static function list_audit_entries(array $args): array {
        global $wpdb;
        $table = self::get_audit_log_table();

        $where  = ['1=1'];
        $values = [];

        if (!empty($args['campaign_id'])) {
            $where[]  = 'campaign_id = %d';
            $values[] = intval($args['campaign_id']);
        }
        if (!empty($args['from'])) {
            $where[]  = 'created_at >= %s';
            $values[] = gmdate('Y-m-d H:i:s', strtotime($args['from']));
        }
        if (!empty($args['to'])) {
            $where[]  = 'created_at <= %s';
            $values[] = gmdate('Y-m-d H:i:s', strtotime($args['to'] . ' 23:59:59'));
        }
        if (!empty($args['action'])) {
            $where[]  = 'action = %s';
            $values[] = $args['action'];
        }
        if (!empty($args['scope']) && in_array($args['scope'], ['campaign', 'system'], true)) {
            $where[]  = 'scope = %s';
            $values[] = $args['scope'];
        }
        if (!empty($args['severity']) && in_array($args['severity'], ['info', 'warning', 'error'], true)) {
            $where[]  = 'severity = %s';
            $values[] = $args['severity'];
        }

        $where_sql = implode(' AND ', $where);
        $page      = max(1, intval($args['page'] ?? 1));
        $per_page  = max(1, intval($args['per_page'] ?? 50));
        $offset    = ($page - 1) * $per_page;

        $count_sql = "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}";
        $total     = empty($values)
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            ? (int) $wpdb->get_var($count_sql)
            : (int) $wpdb->get_var($wpdb->prepare($count_sql, $values));

        $items_sql      = "SELECT * FROM {$table} WHERE {$where_sql} ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $items_values   = array_merge($values, [$per_page, $offset]);
        // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
        $rows = $wpdb->get_results($wpdb->prepare($items_sql, $items_values), ARRAY_A);

        return [
            'total' => $total,
            'items' => array_map([self::class, 'format_audit_entry'], $rows ?: []),
        ];
    }

    public static function format_audit_entry(array $row): array {
        return [
            'id'            => strval($row['id']),
            'campaignId'    => strval($row['campaign_id']),
            'action'        => $row['action'],
            'userId'        => intval($row['actor_id']),
            'actorLogin'    => $row['actor_login'],
            'details'       => json_decode($row['details'], true) ?? [],
            'createdAt'     => str_replace(' ', 'T', $row['created_at']) . 'Z',
            // P40-CT1: canonical event contract fields. Defaults handle legacy rows
            // written before the v9 schema migration.
            'severity'      => $row['severity'] ?? 'info',
            'scope'         => $row['scope'] ?? 'campaign',
            'summary'       => $row['summary'] ?? '',
            'resourceType'  => $row['resource_type'] ?? '',
            'resourceId'    => $row['resource_id'] ?? '',
            'resourceLabel' => $row['resource_label'] ?? '',
            'source'        => $row['source'] ?? '',
        ];
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