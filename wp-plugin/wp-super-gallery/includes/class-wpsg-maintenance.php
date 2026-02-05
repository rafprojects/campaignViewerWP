<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Maintenance {
    const CLEANUP_HOOK = 'wpsg_archive_cleanup';

    public static function register() {
        add_action(self::CLEANUP_HOOK, [self::class, 'purge_archived_campaigns']);

        $days = intval(apply_filters('wpsg_archive_retention_days', 0));
        if ($days <= 0) {
            return;
        }

        if (!wp_next_scheduled(self::CLEANUP_HOOK)) {
            wp_schedule_event(time(), 'daily', self::CLEANUP_HOOK);
        }
    }

    public static function purge_archived_campaigns() {
        $days = intval(apply_filters('wpsg_archive_retention_days', 0));
        if ($days <= 0) {
            return;
        }

        $before = gmdate('Y-m-d H:i:s', strtotime("-{$days} days"));

        $query = new WP_Query([
            'post_type' => 'wpsg_campaign',
            'post_status' => 'any',
            'posts_per_page' => 100,
            'date_query' => [
                [
                    'before' => $before,
                    'inclusive' => true,
                    'column' => 'post_date_gmt',
                ],
            ],
            'meta_query' => [
                [
                    'key' => 'status',
                    'value' => 'archived',
                ],
            ],
        ]);

        foreach ($query->posts as $post) {
            wp_delete_post($post->ID, true);
        }
    }
}