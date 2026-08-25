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

        // P74-F fills migrate_persisted_keys() and bumps VERSION_KEYS.
        if ($current < self::VERSION_KEYS && method_exists(self::class, 'migrate_persisted_keys')) {
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
}
