<?php
/**
 * Canonical list of the WP-Cron hooks Mullion may schedule.
 *
 * Single source of truth shared by wpsg_deactivate() (clears them on
 * deactivation) and uninstall.php (clears them on delete), so the two lists can
 * no longer drift — previously deactivate cleared ten hooks while uninstall
 * cleared only four (P66-F / PHP_REVIEW_FINDINGS.md § F-1).
 *
 * Deliberately a dependency-free plain-function file using literal hook names:
 * uninstall.php runs in isolation without the plugin's classes loaded, so it
 * cannot reference the Mullion_* class constants. Mullion_Cron_Hooks_Test pins each
 * literal here against its originating constant so a rename can never silently
 * desync them.
 *
 * @package Mullion
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
            'wpsg_archive_cleanup',          // Mullion_Maintenance::CLEANUP_HOOK
            'wpsg_trash_purge',              // Mullion_Maintenance::TRASH_PURGE_HOOK
            'wpsg_analytics_purge',          // Mullion_Maintenance::ANALYTICS_PURGE_HOOK
            'wpsg_expired_grants_cleanup',   // Mullion_Maintenance::EXPIRED_GRANTS_HOOK
            'wpsg_access_requests_purge',    // Mullion_Maintenance::ACCESS_REQUESTS_PURGE_HOOK
            'wpsg_audit_log_purge',          // Mullion_Maintenance::AUDIT_LOG_PURGE_HOOK
            'wpsg_schedule_auto_archive',    // mullion-gallery.php hourly auto-archive
            'wpsg_thumbnail_cache_cleanup',  // Mullion_Thumbnail_Cache cleanup event
            'wpsg_process_alert_emails',     // Mullion_Alerts::CRON_HOOK
            'wpsg_webhook_retry',            // Mullion_Webhooks::RETRY_HOOK
            'wpsg_export_process_job',       // Mullion_Export_Engine::JOB_PROCESS_HOOK
            'wpsg_export_cleanup',           // Mullion_Export_Engine::JOB_CLEANUP_HOOK
            'wpsg_filesize_backfill',        // Mullion_DB::FILESIZE_BACKFILL_HOOK
        ];
    }
}
