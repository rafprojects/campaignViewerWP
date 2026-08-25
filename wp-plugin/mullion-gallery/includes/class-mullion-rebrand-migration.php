<?php
/**
 * One-time WP Super Gallery → Mullion data-shape migration (P74-E / P74-F).
 *
 * Source strings in this file stay `wpsg_*` on purpose. A mechanical prefix
 * sweep of the rest of the plugin must not rewrite this map, or the migrator
 * would look for rows that no longer match the on-disk names.
 *
 * Versioned flag so E and F can land as independent green commits:
 *   0 → 1  CPT / taxonomies / caps / roles   (P74-E)
 *   1 → 2  options / transients / meta / tables / upload dirs  (P74-F)
 *
 * @package Mullion
 */

if (!defined('ABSPATH')) {
    exit;
}

class Mullion_Rebrand_Migration {
    const VERSION_OPTION = 'mullion_rebrand_migration_version';
    const VERSION_CPT    = 1;
    const VERSION_KEYS   = 2;

    /** @var array<string,string> old post_type => new post_type */
    const POST_TYPES = [
        'wpsg_campaign'   => 'mullion_campaign',
        'wpsg_layout_tpl' => 'mullion_layout_tpl',
    ];

    /** @var array<string,string> old taxonomy => new taxonomy */
    const TAXONOMIES = [
        'wpsg_company'            => 'mullion_company',
        'wpsg_campaign_tag'       => 'mullion_campaign_tag',
        'wpsg_campaign_category'  => 'mullion_campaign_category',
        'wpsg_media_tag'          => 'mullion_media_tag',
    ];

    /** @var array<string,string> old cap => new cap */
    const CAPS = [
        'manage_wpsg'                    => 'manage_mullion',
        'edit_wpsg_campaigns'            => 'edit_mullion_campaigns',
        'edit_others_wpsg_campaigns'     => 'edit_others_mullion_campaigns',
        'publish_wpsg_campaigns'         => 'publish_mullion_campaigns',
        'read_private_wpsg_campaigns'    => 'read_private_mullion_campaigns',
        'delete_wpsg_campaigns'          => 'delete_mullion_campaigns',
        'delete_private_wpsg_campaigns'  => 'delete_private_mullion_campaigns',
        'delete_published_wpsg_campaigns'=> 'delete_published_mullion_campaigns',
        'delete_others_wpsg_campaigns'   => 'delete_others_mullion_campaigns',
        'edit_private_wpsg_campaigns'    => 'edit_private_mullion_campaigns',
        'edit_published_wpsg_campaigns'  => 'edit_published_mullion_campaigns',
    ];

    const OLD_EDITOR_ROLE = 'wpsg_editor';
    const OLD_ADMIN_ROLE  = 'wpsg_admin';
    const NEW_EDITOR_ROLE = 'mullion_editor';

    /**
     * Run any pending rebrand steps. Safe to call more than once.
     */
    public static function maybe_run(): void {
        $current = (int) get_option(self::VERSION_OPTION, 0);

        if ($current < self::VERSION_CPT) {
            self::migrate_object_types();
            update_option(self::VERSION_OPTION, self::VERSION_CPT, true);
            $current = self::VERSION_CPT;
        }

        if ($current < self::VERSION_KEYS) {
            self::migrate_persisted_keys();
            update_option(self::VERSION_OPTION, self::VERSION_KEYS, true);
        }
    }

    /**
     * P74-E: remap post types, taxonomies, roles, and capabilities.
     */
    public static function migrate_object_types(): void {
        self::migrate_post_types();
        self::migrate_taxonomies();
        self::migrate_roles_and_caps();
        // Direct $wpdb UPDATEs skip wp_insert_post / wp_update_term, so the
        // in-request object cache still holds the old post_type / taxonomy.
        wp_cache_flush();
    }

    public static function migrate_post_types(): void {
        global $wpdb;
        foreach (self::POST_TYPES as $old => $new) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->query(
                $wpdb->prepare(
                    "UPDATE {$wpdb->posts} SET post_type = %s WHERE post_type = %s",
                    $new,
                    $old
                )
            );
        }
    }

    public static function migrate_taxonomies(): void {
        global $wpdb;
        foreach (self::TAXONOMIES as $old => $new) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->query(
                $wpdb->prepare(
                    "UPDATE {$wpdb->term_taxonomy} SET taxonomy = %s WHERE taxonomy = %s",
                    $new,
                    $old
                )
            );
        }
    }

    public static function migrate_roles_and_caps(): void {
        self::ensure_new_editor_role();
        self::reassign_legacy_roles();
        self::remap_role_caps();
        self::remap_user_extra_caps();
        self::remove_legacy_roles();
    }

    private static function ensure_new_editor_role(): void {
        $caps = [
            'read'            => true,
            'upload_files'    => true,
            'manage_mullion'  => true,
        ];

        $role = get_role(self::NEW_EDITOR_ROLE);
        if (!$role) {
            add_role(
                self::NEW_EDITOR_ROLE,
                __('Gallery Editor', 'mullion-gallery'),
                $caps
            );
            $role = get_role(self::NEW_EDITOR_ROLE);
        }
        if (!$role) {
            return;
        }

        foreach (array_keys($caps) as $cap) {
            $role->add_cap($cap);
        }
        foreach (array_values(self::CAPS) as $new_cap) {
            if ($new_cap === 'manage_mullion') {
                continue;
            }
            if ($role->has_cap($new_cap)) {
                $role->remove_cap($new_cap);
            }
        }
        foreach (array_keys(self::CAPS) as $old_cap) {
            if ($role->has_cap($old_cap)) {
                $role->remove_cap($old_cap);
            }
        }
    }

    private static function reassign_legacy_roles(): void {
        foreach ([self::OLD_EDITOR_ROLE, self::OLD_ADMIN_ROLE] as $old_role) {
            $user_ids = get_users([
                'role'   => $old_role,
                'fields' => 'ID',
                'number' => 0,
            ]);
            foreach ($user_ids as $uid) {
                $user = get_user_by('id', (int) $uid);
                if (!$user instanceof WP_User) {
                    continue;
                }
                $user->add_role(self::NEW_EDITOR_ROLE);
                $user->remove_role($old_role);
            }
        }
    }

    private static function remap_role_caps(): void {
        $roles = wp_roles();
        if (!$roles instanceof WP_Roles) {
            return;
        }
        foreach ($roles->role_objects as $role) {
            foreach (self::CAPS as $old => $new) {
                if ($role->has_cap($old)) {
                    $role->add_cap($new);
                    $role->remove_cap($old);
                }
            }
        }
    }

    /**
     * Caps added via WP_User::add_cap() live in usermeta, not in the role.
     */
    private static function remap_user_extra_caps(): void {
        $user_ids = get_users([
            'fields' => 'ID',
            'number' => 0,
        ]);
        foreach ($user_ids as $uid) {
            $user = get_user_by('id', (int) $uid);
            if (!$user instanceof WP_User) {
                continue;
            }
            $changed = false;
            foreach (self::CAPS as $old => $new) {
                if (!empty($user->caps[$old])) {
                    $user->add_cap($new);
                    $user->remove_cap($old);
                    $changed = true;
                }
            }
            unset($changed);
        }
    }

    private static function remove_legacy_roles(): void {
        if (get_role(self::OLD_EDITOR_ROLE)) {
            remove_role(self::OLD_EDITOR_ROLE);
        }
        if (get_role(self::OLD_ADMIN_ROLE)) {
            remove_role(self::OLD_ADMIN_ROLE);
        }
    }

    /**
     * P74-F: remap option names, transients, meta keys, custom tables,
     * core-table indexes, upload dirs, and CSS-var strings inside settings.
     */
    public static function migrate_persisted_keys(): void {
        self::migrate_option_names();
        self::migrate_transient_names();
        self::migrate_meta_keys();
        self::migrate_tables();
        self::migrate_core_indexes();
        self::migrate_upload_dirs();
        self::rewrite_settings_css_vars();
        wp_cache_flush();
    }

    /** @var array<string,string> old unprefixed table suffix => new suffix */
    const TABLES = [
        'wpsg_analytics_events'     => 'mullion_analytics_events',
        'wpsg_media_refs'           => 'mullion_media_refs',
        'wpsg_access_requests'      => 'mullion_access_requests',
        'wpsg_audit_log'            => 'mullion_audit_log',
        'wpsg_spaces'               => 'mullion_spaces',
        'wpsg_space_library_assoc'  => 'mullion_space_library_assoc',
        'wpsg_assets'               => 'mullion_assets',
        'wpsg_overlays'             => 'mullion_assets',
    ];

    const UPLOAD_DIRS = [
        'wpsg-exports'     => 'mullion-exports',
        'wpsg-fonts'       => 'mullion-fonts',
        'wpsg-thumbnails'  => 'mullion-thumbnails',
    ];

    private static function migrate_option_names(): void {
        self::rename_options_matching('wpsg_', 'mullion_');
    }

    private static function migrate_transient_names(): void {
        self::rename_options_matching('_transient_wpsg_', '_transient_mullion_');
        self::rename_options_matching('_transient_timeout_wpsg_', '_transient_timeout_mullion_');
    }

    /**
     * Rename wp_options rows whose names start with $old_prefix by swapping
     * that prefix for $new_prefix. If the destination name already exists,
     * drop the source.
     */
    private static function rename_options_matching(string $old_prefix, string $new_prefix): void {
        global $wpdb;
        $like = $wpdb->esc_like($old_prefix) . '%';
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $names = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE %s",
                $like
            )
        );
        if (!is_array($names)) {
            return;
        }
        foreach ($names as $old) {
            if (!is_string($old) || strpos($old, $old_prefix) !== 0) {
                continue;
            }
            $new = $new_prefix . substr($old, strlen($old_prefix));
            if ($new === $old) {
                continue;
            }
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $dest_exists = (int) $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM {$wpdb->options} WHERE option_name = %s",
                    $new
                )
            );
            if ($dest_exists > 0) {
                delete_option($old);
                continue;
            }
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
            $wpdb->update(
                $wpdb->options,
                ['option_name' => $new],
                ['option_name' => $old]
            );
        }
    }

    private static function migrate_meta_keys(): void {
        global $wpdb;
        $tables = [
            $wpdb->postmeta,
            $wpdb->termmeta,
            $wpdb->usermeta,
        ];
        foreach ($tables as $table) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->query(
                "UPDATE `{$table}` SET meta_key = REPLACE(meta_key, '_wpsg_', '_mullion_') WHERE meta_key LIKE '_wpsg\\_%'"
            );
        }
    }

    private static function migrate_tables(): void {
        global $wpdb;
        // Overlays first so a leftover pre-v14 table lands on mullion_assets
        // without colliding with a later wpsg_assets rename.
        foreach (self::TABLES as $old_suffix => $new_suffix) {
            $old = $wpdb->prefix . $old_suffix;
            $new = $wpdb->prefix . $new_suffix;
            if (!self::table_exists($old)) {
                continue;
            }
            if (self::table_exists($new)) {
                // Upgrade already created an empty dest (PHPUnit bootstrap, or
                // maybe_upgrade racing ahead). Prefer the legacy table's rows.
                // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                $new_rows = (int) $wpdb->get_var("SELECT COUNT(*) FROM `{$new}`");
                if ($new_rows === 0) {
                    // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                    $wpdb->query("DROP TABLE `{$new}`");
                } else {
                    continue;
                }
            }
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->query("RENAME TABLE `{$old}` TO `{$new}`");
        }
    }

    private static function table_exists(string $table): bool {
        global $wpdb;
        // INFORMATION_SCHEMA + exact TABLE_NAME, not SHOW TABLES LIKE — `_` is a
        // LIKE wildcard, so esc_like/`SHOW TABLES` misses or over-matches prefixes.
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $count = (int) $wpdb->get_var(
            $wpdb->prepare(
                'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s',
                $table
            )
        );
        return $count > 0;
    }

    private static function migrate_core_indexes(): void {
        global $wpdb;
        self::rename_index_if_present($wpdb->postmeta, 'wpsg_postmeta_postid_key', 'mullion_postmeta_postid_key');
        self::rename_index_if_present($wpdb->termmeta, 'wpsg_termmeta_termid_key', 'mullion_termmeta_termid_key');
    }

    private static function rename_index_if_present(string $table, string $old, string $new): void {
        global $wpdb;
        if (!self::index_exists($table, $old)) {
            return;
        }
        if (self::index_exists($table, $new)) {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $wpdb->query("ALTER TABLE `{$table}` DROP INDEX `{$old}`");
            return;
        }
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query("ALTER TABLE `{$table}` RENAME INDEX `{$old}` TO `{$new}`");
    }

    private static function index_exists(string $table, string $index): bool {
        global $wpdb;
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = %s
                   AND INDEX_NAME = %s",
                $table,
                $index
            )
        );
        return (int) $exists > 0;
    }

    private static function migrate_upload_dirs(): void {
        $uploads = wp_upload_dir();
        if (!empty($uploads['error']) || empty($uploads['basedir'])) {
            return;
        }
        $base = trailingslashit($uploads['basedir']);
        foreach (self::UPLOAD_DIRS as $old_name => $new_name) {
            $old = $base . $old_name;
            $new = $base . $new_name;
            if (is_dir($old) && !is_dir($new)) {
                // phpcs:ignore WordPress.WP.AlternativeFunctions.rename_rename
                @rename($old, $new);
            }
        }
    }

    private static function rewrite_settings_css_vars(): void {
        $settings = get_option('mullion_settings', null);
        if (!is_array($settings)) {
            $settings = get_option('wpsg_settings', null);
        }
        if (!is_array($settings)) {
            return;
        }
        $rewritten = self::rewrite_css_var_strings($settings);
        if ($rewritten !== $settings) {
            update_option('mullion_settings', $rewritten);
        }
    }

    /**
     * @param mixed $value
     * @return mixed
     */
    private static function rewrite_css_var_strings($value) {
        if (is_string($value)) {
            return str_replace('var(--wpsg-', 'var(--mullion-', $value);
        }
        if (is_array($value)) {
            foreach ($value as $k => $v) {
                $value[$k] = self::rewrite_css_var_strings($v);
            }
        }
        return $value;
    }
}
