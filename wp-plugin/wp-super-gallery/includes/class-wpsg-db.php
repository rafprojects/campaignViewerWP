<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_DB {
    const DB_VERSION = '1';

    public static function maybe_upgrade() {
        $current = get_option('wpsg_db_version', '0');
        if (version_compare($current, self::DB_VERSION, '>=')) {
            return;
        }

        self::add_indexes();
        update_option('wpsg_db_version', self::DB_VERSION);
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