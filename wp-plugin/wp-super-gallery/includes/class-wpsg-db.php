<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_DB {
    const DB_VERSION = '2';

    public static function maybe_upgrade() {
        $current = get_option('wpsg_db_version', '0');
        if (version_compare($current, self::DB_VERSION, '>=')) {
            return;
        }

        self::add_indexes();
        self::maybe_create_analytics_table();
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