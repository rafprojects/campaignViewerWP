<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * P66-A: Single source of truth for campaign status transitions.
 *
 * Before this class the `status` post meta was written independently at seven
 * call sites (single/batch REST, the generic create-update setter, company-level
 * bulk archive, WP-CLI, and the auto-archive cron batch). Each site separately
 * remembered — or forgot — its audit entry, hook, and cache bump, and *none*
 * recorded when the transition happened. That missing timestamp is the direct
 * root cause of P66-B (WPSG_Maintenance keyed its auto-purge off the campaign's
 * creation date because no `archived_at` existed to key off instead).
 *
 * set() owns the two things that must never drift again: the `status` write and
 * the `archived_at`/`restored_at` bookkeeping, applied atomically. The audit
 * entry, action hook, and cache invalidation stay opt-in via $ctx so each caller
 * reproduces its established side-effects exactly — the bulk cron path, for
 * instance, must not emit a per-campaign audit entry or hook.
 */
class WPSG_Campaign_Status {

    const STATUSES = ['draft', 'active', 'archived'];

    const META_STATUS      = 'status';
    const META_ARCHIVED_AT = 'archived_at';
    const META_RESTORED_AT = 'restored_at';

    /**
     * Write a campaign's status plus its lifecycle bookkeeping.
     *
     * @param int    $post_id Campaign post ID.
     * @param string $status  One of self::STATUSES.
     * @param array  $ctx     Optional side-effects, all default off:
     *   - 'audit' => array{action:string, details?:array, ctx?:array}
     *       Log an audit entry via WPSG_REST::add_audit_entry().
     *   - 'hook'  => string  Fire this action hook with the post ID
     *       (e.g. 'wpsg_campaign_archived'). Passed explicitly — rather than
     *       derived — so each caller keeps its exact current firing behavior.
     *   - 'cache' => bool  Bump the accessible-campaigns cache version.
     * @return true|WP_Error True on success, WP_Error on an invalid status.
     */
    public static function set(int $post_id, string $status, array $ctx = []) {
        if (!in_array($status, self::STATUSES, true)) {
            return new WP_Error(
                'wpsg_invalid_status',
                'Invalid status value',
                ['status' => 400]
            );
        }

        $old = (string) get_post_meta($post_id, self::META_STATUS, true);
        update_post_meta($post_id, self::META_STATUS, $status);
        self::stamp_transition($post_id, $old, $status);

        if (!empty($ctx['audit']) && is_array($ctx['audit']) && !empty($ctx['audit']['action'])) {
            WPSG_REST::add_audit_entry(
                $post_id,
                (string) $ctx['audit']['action'],
                $ctx['audit']['details'] ?? [],
                $ctx['audit']['ctx'] ?? []
            );
        }

        if (!empty($ctx['hook']) && is_string($ctx['hook'])) {
            do_action($ctx['hook'], $post_id);
        }

        if (!empty($ctx['cache'])) {
            WPSG_REST::bump_cache_version();
        }

        return true;
    }

    /**
     * Record the archived_at/restored_at timestamps for a status transition.
     *
     * Only writes when the campaign actually enters or leaves the archived
     * state — re-archiving an already-archived campaign leaves its original
     * archived_at intact, so the purge clock is not reset. On restore the
     * archived_at is cleared so a later re-archive starts a fresh clock.
     *
     * @param int    $post_id    Campaign post ID.
     * @param string $old_status Status before the write.
     * @param string $new_status Status after the write.
     */
    public static function stamp_transition(int $post_id, string $old_status, string $new_status): void {
        if ($new_status === 'archived' && $old_status !== 'archived') {
            update_post_meta($post_id, self::META_ARCHIVED_AT, self::now());
            delete_post_meta($post_id, self::META_RESTORED_AT);
        } elseif ($new_status !== 'archived' && $old_status === 'archived') {
            update_post_meta($post_id, self::META_RESTORED_AT, self::now());
            delete_post_meta($post_id, self::META_ARCHIVED_AT);
        }
    }

    /**
     * Batch-stamp archived_at for campaigns the cron path just archived.
     *
     * The auto-archive cron (wpsg_archive_campaign_status_batch) writes `status`
     * in bulk SQL for performance; its selection query only ever returns
     * campaigns whose status is not already 'archived', so every id in the batch
     * is a genuine fresh archival. Clears any stale archived_at/restored_at and
     * inserts exactly one archived_at = now per campaign in two queries, keeping
     * the cron path O(1) queries per batch.
     *
     * @param int[] $post_ids Campaign IDs just archived.
     * @return int Number of campaigns stamped.
     */
    public static function stamp_archived_batch(array $post_ids): int {
        global $wpdb;

        $post_ids = array_values(array_filter(
            array_map('intval', $post_ids),
            static function ($id) {
                return $id > 0;
            }
        ));
        if (empty($post_ids)) {
            return 0;
        }

        $now          = self::now();
        $placeholders = implode(', ', array_fill(0, count($post_ids), '%d'));

        // Clear any prior archived_at/restored_at rows so each campaign ends up
        // with exactly one archived_at reflecting this archival.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->postmeta}
             WHERE meta_key IN ('archived_at', 'restored_at')
               AND post_id IN ({$placeholders})",
            $post_ids
        ));

        $value_placeholders = implode(', ', array_fill(0, count($post_ids), '(%d, %s, %s)'));
        $insert_args        = [];
        foreach ($post_ids as $post_id) {
            $insert_args[] = $post_id;
            $insert_args[] = self::META_ARCHIVED_AT;
            $insert_args[] = $now;
        }
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
        $wpdb->query($wpdb->prepare(
            "INSERT INTO {$wpdb->postmeta} (post_id, meta_key, meta_value) VALUES {$value_placeholders}",
            $insert_args
        ));

        // Direct SQL bypasses the object cache — invalidate the affected posts.
        foreach ($post_ids as $post_id) {
            wp_cache_delete($post_id, 'post_meta');
        }

        return count($post_ids);
    }

    /**
     * Current time as a UTC `Y-m-d H:i:s` string, matching every other WPSG
     * datetime column/meta (audit created_at, publish_at, etc.).
     */
    public static function now(): string {
        return gmdate('Y-m-d H:i:s');
    }
}
