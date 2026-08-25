<?php
/**
 * Mullion — Uninstall handler.
 *
 * Fired when the plugin is deleted through the WordPress admin.
 * Removes all plugin data unless the user opted to preserve it.
 *
 * @package Mullion
 * @since   0.18.0
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

/**
 * Recursively delete a directory and its contents. Uninstall-only helper —
 * uses native FS calls after wp_delete_file() because WP_Filesystem init can
 * silently no-op on some hosts during uninstall.
 *
 * @param string $dir Absolute directory path.
 */
function mullion_uninstall_remove_dir( $dir ) {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	$files = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $dir, RecursiveDirectoryIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);
	foreach ( $files as $file ) {
		if ( $file->isDir() ) {
			rmdir( $file->getRealPath() ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
		} else {
			wp_delete_file( $file->getRealPath() );
		}
	}
	rmdir( $dir ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_rmdir
}

// ── P66-F / Key Decision C: remove mullion-exports/ regardless of the
// preserve-data preference — its 24-hour export-job TTL makes preserving ZIPs
// past uninstall backwards. Must run BEFORE the preserve-data early return
// below. Migrators are told (packaging docs) to move ZIPs out of
// uploads/mullion-exports/ before uninstalling.
$uninstall_uploads = trailingslashit( wp_upload_dir()['basedir'] );
mullion_uninstall_remove_dir( $uninstall_uploads . 'mullion-exports' );

// ── Respect user preference to preserve data ────────────────
$settings = get_option( 'mullion_settings', [] );
if ( is_array( $settings ) && ! empty( $settings['preserve_data_on_uninstall'] ) ) {
	return;
}

// ── 1. Delete all mullion_campaign posts + meta ────────────────
$campaign_ids = $wpdb->get_col(
	"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'mullion_campaign'"
);
foreach ( $campaign_ids as $id ) {
	wp_delete_post( (int) $id, true ); // force delete, bypasses trash
}

// ── 2. Delete all mullion_layout_tpl posts + meta ─────────────
$template_ids = $wpdb->get_col(
	"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'mullion_layout_tpl'"
);
foreach ( $template_ids as $id ) {
	wp_delete_post( (int) $id, true );
}
// Also clean up legacy layout template option and backup.
delete_option( 'mullion_layout_templates' );
delete_option( 'mullion_layout_templates_backup' );

// ── 3. Delete taxonomy terms ────────────────────────────────
$taxonomies = [
	'mullion_company', 'mullion_campaign_category', 'mullion_campaign_tag', 'mullion_media_tag',
];
foreach ( $taxonomies as $taxonomy ) {
	$terms = get_terms( [
		'taxonomy'   => $taxonomy,
		'hide_empty' => false,
		'fields'     => 'ids',
	] );
	if ( is_array( $terms ) ) {
		foreach ( $terms as $term_id ) {
			wp_delete_term( (int) $term_id, $taxonomy );
		}
	}
}

// ── 4. Delete options ───────────────────────────────────────
$options = [
	'mullion_settings',
	'mullion_db_version',
	'mullion_overlay_library',
	'mullion_thumbnail_cache_index',
	'mullion_oembed_provider_failures',
	'mullion_oembed_failure_count',       // P66-F: distinct from _provider_failures above
	'mullion_needs_setup',
	'mullion_roles_migrated_editor', // leftover P52-A2 flag, no longer written
	'mullion_rebrand_migration_version', // leftover P74-E/F flag, migrator dropped in P74-Q
	'mullion_cache_version',
	'mullion_layout_templates',
	'mullion_media_refs_backfilled',
	'mullion_media_refs_backfill_offset',
	'mullion_access_requests_migrated',
	'mullion_access_request_index',
	'mullion_overlays_migrated',
	'mullion_preserve_data_on_uninstall', // legacy key, if ever set directly
	// P47-A: Gallery Spaces
	'mullion_default_space_id',
	'mullion_spaces_backfill_complete',
	'mullion_spaces_backfill_offset',
	// ── P66-F: options the plugin writes but uninstall never removed ──
	'mullion_webhook_endpoints',          // contains webhook SECRETS
	'mullion_webhook_delivery_log',
	'mullion_recent_logs',
	'mullion_rest_request_count',
	'mullion_rest_error_count',
	'mullion_alert_email_queue',
	'mullion_export_job_index',
	'mullion_font_library',
	'mullion_campaign_tables_innodb_v15',
	'mullion_space_library_assoc_backfilled',
	// P66-B / P66-C: one-time migration guard flags introduced this phase
	'mullion_scoped_space_id_backfilled',
	'mullion_archived_at_backfilled',
	// P67-I: one-time filesize backfill guard.
	'mullion_filesize_backfilled',
];
foreach ( $options as $option ) {
	delete_option( $option );
}

// P66-F: per-hash thumbnail cache rows (mullion_thumb_<sha256>); the loop above
// only removed the legacy singular mullion_thumbnail_cache_index.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE 'mullion\_thumb\_%'"
);

// Clean up any legacy per-request options from pre-D-9 wp_options storage.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE 'mullion\_access\_request\_%'
	   AND option_name != 'mullion_access_request_index'
	   AND option_name != 'mullion_access_requests_migrated'"
);

// ── 5. Delete transients matching mullion_* ────────────────────
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '_transient_mullion_%'
	    OR option_name LIKE '_transient_timeout_mullion_%'"
);

// ── 6. Drop custom tables ───────────────────────────────────
$tables = [
	$wpdb->prefix . 'mullion_analytics_events',
	$wpdb->prefix . 'mullion_access_requests',
	$wpdb->prefix . 'mullion_media_refs',
	$wpdb->prefix . 'mullion_overlays',
	$wpdb->prefix . 'mullion_assets',
	$wpdb->prefix . 'mullion_audit_log',
	$wpdb->prefix . 'mullion_spaces',
	$wpdb->prefix . 'mullion_space_library_assoc',
];
foreach ( $tables as $table ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange
	$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" );
}

// ── 6b. Drop custom indexes added to CORE WP tables ─────────
// P66-F: Mullion_DB::add_indexes() adds these to wp_postmeta / wp_termmeta; they
// must be removed on uninstall or they outlive the plugin. Guarded via
// INFORMATION_SCHEMA so a DROP on an absent index is a no-op, not an error.
$core_indexes = [
	[ 'table' => $wpdb->postmeta, 'index' => 'mullion_postmeta_postid_key' ],
	[ 'table' => $wpdb->termmeta, 'index' => 'mullion_termmeta_termid_key' ],
];
foreach ( $core_indexes as $ci ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching, WordPress.DB.DirectDatabaseQuery.SchemaChange
	$exists = $wpdb->get_var(
		$wpdb->prepare(
			"SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
			 WHERE TABLE_SCHEMA = DATABASE()
			   AND TABLE_NAME = %s
			   AND INDEX_NAME = %s",
			$ci['table'],
			$ci['index']
		)
	);
	if ( intval( $exists ) > 0 ) {
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$wpdb->query( "ALTER TABLE `{$ci['table']}` DROP INDEX `{$ci['index']}`" );
	}
}

// ── 7. Remove roles and capabilities ────────────────────────
remove_role( 'mullion_editor' );

$admin_role = get_role( 'administrator' );
if ( $admin_role ) {
	$admin_role->remove_cap( 'manage_mullion' );
	// Remove custom CPT capabilities
	$cpt_caps = [
		'edit_mullion_campaigns',
		'edit_others_mullion_campaigns',
		'publish_mullion_campaigns',
		'read_private_mullion_campaigns',
		'delete_mullion_campaigns',
		'delete_private_mullion_campaigns',
		'delete_published_mullion_campaigns',
		'delete_others_mullion_campaigns',
		'edit_private_mullion_campaigns',
		'edit_published_mullion_campaigns',
	];
	foreach ( $cpt_caps as $cap ) {
		$admin_role->remove_cap( $cap );
	}
}

// ── 8. Clear cron hooks ─────────────────────────────────────
// P66-F: clear the single canonical hook list shared with mullion_deactivate(),
// instead of the stale 4-of-10 subset this file used to hardcode. This file
// runs in isolation, so pull the dependency-free helper in directly.
require_once __DIR__ . '/includes/mullion-cron-hooks.php';
foreach ( mullion_get_cron_hooks() as $hook ) {
	wp_clear_scheduled_hook( $hook );
}

// ── 9. Delete uploaded files ────────────────────────────────
// P66-F: mullion-fonts/ was previously left behind. mullion-exports/ is handled
// earlier (before the preserve-data return) per Key Decision C.
$upload_basedir = trailingslashit( wp_upload_dir()['basedir'] );
mullion_uninstall_remove_dir( $upload_basedir . 'mullion-thumbnails' );
mullion_uninstall_remove_dir( $upload_basedir . 'mullion-overlays' );
mullion_uninstall_remove_dir( $upload_basedir . 'mullion-fonts' );
