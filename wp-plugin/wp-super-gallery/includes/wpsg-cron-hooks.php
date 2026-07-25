<?php
/**
 * Canonical list of the WP-Cron hooks WP Super Gallery may schedule.
 *
 * Single source of truth shared by wpsg_deactivate() (clears them on
 * deactivation) and uninstall.php (clears them on delete), so the two lists can
 * no longer drift — previously deactivate cleared ten hooks while uninstall
 * cleared only four (P66-F / PHP_REVIEW_FINDINGS.md § F-1).
 *
 * Deliberately a dependency-free plain-function file using literal hook names:
 * uninstall.php runs in isolation without the plugin's classes loaded, so it
 * cannot reference the WPSG_* class constants. WPSG_Cron_Hooks_Test pins each
 * literal here against its originating constant so a rename can never silently
 * desync them.
 *
 * @package WP_Super_Gallery
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('wpsg_get_cron_hooks')) {
    /**
     * Every WP-Cron hook the plugin registers across its lifetime.
     *
     * @return string[]
     */
    function wpsg_get_cron_hooks(): array {
        return [
            'wpsg_archive_cleanup',          // WPSG_Maintenance::CLEANUP_HOOK
            'wpsg_trash_purge',              // WPSG_Maintenance::TRASH_PURGE_HOOK
            'wpsg_analytics_purge',          // WPSG_Maintenance::ANALYTICS_PURGE_HOOK
            'wpsg_expired_grants_cleanup',   // WPSG_Maintenance::EXPIRED_GRANTS_HOOK
            'wpsg_access_requests_purge',    // WPSG_Maintenance::ACCESS_REQUESTS_PURGE_HOOK
            'wpsg_audit_log_purge',          // WPSG_Maintenance::AUDIT_LOG_PURGE_HOOK
            'wpsg_schedule_auto_archive',    // wp-super-gallery.php hourly auto-archive
            'wpsg_thumbnail_cache_cleanup',  // WPSG_Thumbnail_Cache cleanup event
            'wpsg_process_alert_emails',     // WPSG_Alerts::CRON_HOOK
            'wpsg_webhook_retry',            // WPSG_Webhooks::RETRY_HOOK
            'wpsg_export_process_job',       // WPSG_Export_Engine::JOB_PROCESS_HOOK
            'wpsg_export_cleanup',           // WPSG_Export_Engine::JOB_CLEANUP_HOOK
            'wpsg_filesize_backfill',        // WPSG_DB::FILESIZE_BACKFILL_HOOK
        ];
    }
}
