<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Maintenance {
    const CLEANUP_HOOK          = 'wpsg_archive_cleanup';
    const TRASH_PURGE_HOOK      = 'wpsg_trash_purge';
    const ANALYTICS_PURGE_HOOK  = 'wpsg_analytics_purge';

    /**
     * Hook cron actions and schedule events based on settings.
     */
    public static function register() {
        add_action(self::CLEANUP_HOOK, [self::class, 'trash_archived_campaigns']);
        add_action(self::TRASH_PURGE_HOOK, [self::class, 'purge_trashed_campaigns']);
        add_action(self::ANALYTICS_PURGE_HOOK, [self::class, 'purge_old_analytics']);

        // Register a weekly interval — core only ships hourly/twicedaily/daily.
        add_filter('cron_schedules', [self::class, 'add_weekly_schedule']);

        $archive_days = self::get_setting('archive_purge_days');
        if ($archive_days > 0) {
            if (!wp_next_scheduled(self::CLEANUP_HOOK)) {
                wp_schedule_event(time(), 'daily', self::CLEANUP_HOOK);
            }
        } else {
            wp_clear_scheduled_hook(self::CLEANUP_HOOK);
        }

        // Schedule trash purge independently — it depends on grace_days, not archive_purge_days.
        $grace_days = self::get_setting('archive_purge_grace_days');
        if ($grace_days > 0) {
            if (!wp_next_scheduled(self::TRASH_PURGE_HOOK)) {
                wp_schedule_event(time(), 'daily', self::TRASH_PURGE_HOOK);
            }
        } else {
            wp_clear_scheduled_hook(self::TRASH_PURGE_HOOK);
        }

        $analytics_days = self::get_setting('analytics_retention_days');
        if ($analytics_days > 0) {
            if (!wp_next_scheduled(self::ANALYTICS_PURGE_HOOK)) {
                wp_schedule_event(time(), 'weekly', self::ANALYTICS_PURGE_HOOK);
            }
        } else {
            wp_clear_scheduled_hook(self::ANALYTICS_PURGE_HOOK);
        }
    }

    // ── D-4: Trash archived campaigns (phase 1) ─────────────────────────────

    /**
     * Move archived campaigns past the retention threshold to the trash.
     *
     * Previously this permanently deleted them — now it uses wp_trash_post()
     * so they sit in trash for a grace period before permanent deletion.
     */
    public static function trash_archived_campaigns() {
        $days = self::get_setting('archive_purge_days');
        if ($days <= 0) {
            return;
        }

        $before = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));

        $query = new WP_Query([
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'any',
            'posts_per_page' => 100,
            'date_query'     => [
                [
                    'before'    => $before,
                    'inclusive' => true,
                    'column'    => 'post_date_gmt',
                ],
            ],
            'meta_query' => [
                [
                    'key'   => 'status',
                    'value' => 'archived',
                ],
            ],
        ]);

        foreach ($query->posts as $post) {
            do_action('wpsg_before_trash_campaign', $post->ID);
            wp_trash_post($post->ID);
        }
    }

    // ── D-4: Permanently delete trashed campaigns (phase 2) ─────────────────

    /**
     * Permanently delete trashed campaigns that have been in the trash
     * longer than the grace period.
     */
    public static function purge_trashed_campaigns() {
        $grace_days = self::get_setting('archive_purge_grace_days');
        if ($grace_days <= 0) {
            return;
        }

        $before = gmdate('Y-m-d H:i:s', strtotime("-{$grace_days} days"));

        $query = new WP_Query([
            'post_type'      => 'wpsg_campaign',
            'post_status'    => 'trash',
            'posts_per_page' => 100,
            'date_query'     => [
                [
                    'before'    => $before,
                    'inclusive' => true,
                    'column'    => 'post_modified_gmt',
                ],
            ],
        ]);

        foreach ($query->posts as $post) {
            do_action('wpsg_before_purge_campaign', $post->ID);
            self::cleanup_campaign_data($post->ID);
            wp_delete_post($post->ID, true);
        }
    }

    // ── D-20: Purge old analytics events ────────────────────────────────────

    /**
     * Delete analytics events older than the configured retention period.
     * Runs in batches of 1000 to limit memory usage.
     */
    public static function purge_old_analytics() {
        $days = self::get_setting('analytics_retention_days');
        if ($days <= 0) {
            return;
        }

        if (!class_exists('WPSG_DB')) {
            return;
        }

        global $wpdb;
        $table = WPSG_DB::get_analytics_table();
        $before = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));

        // Delete in batches to avoid locking the table for too long.
        $batch_size = 1000;
        do {
            // phpcs:ignore WordPress.DB.DirectDatabaseQuery
            $deleted = $wpdb->query(
                $wpdb->prepare(
                    "DELETE FROM {$table} WHERE occurred_at < %s LIMIT %d",
                    $before,
                    $batch_size
                )
            );
        } while ($deleted === $batch_size);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Clean up associated data (analytics, media refs) when permanently
     * deleting a campaign.
     */
    private static function cleanup_campaign_data($campaign_id) {
        if (!class_exists('WPSG_DB')) {
            return;
        }

        global $wpdb;

        // Remove analytics events for this campaign.
        $analytics_table = WPSG_DB::get_analytics_table();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->delete($analytics_table, ['campaign_id' => $campaign_id], ['%d']);

        // Remove media refs for this campaign.
        $media_table = WPSG_DB::get_media_refs_table();
        // phpcs:ignore WordPress.DB.DirectDatabaseQuery
        $wpdb->delete($media_table, ['campaign_id' => $campaign_id], ['%d']);

        // Remove access requests for this campaign.
        WPSG_DB::delete_access_requests_for_campaign($campaign_id);
    }

    /**
     * Register a weekly cron interval (core only ships hourly/twicedaily/daily).
     */
    public static function add_weekly_schedule(array $schedules): array {
        if (!isset($schedules['weekly'])) {
            $schedules['weekly'] = [
                'interval' => WEEK_IN_SECONDS,
                'display'  => 'Once Weekly',
            ];
        }
        return $schedules;
    }

    /**
     * Read a maintenance setting, falling back to the wpsg_archive_retention_days
     * filter for backward compatibility.
     */
    private static function get_setting($key) {
        if (class_exists('WPSG_Settings')) {
            $settings = WPSG_Settings::get_settings();
            if (isset($settings[$key]) && intval($settings[$key]) > 0) {
                return intval($settings[$key]);
            }
        }

        // Backward compat: honor the legacy filter for archive_purge_days.
        if ($key === 'archive_purge_days') {
            return intval(apply_filters('wpsg_archive_retention_days', 0));
        }

        return 0;
    }
}