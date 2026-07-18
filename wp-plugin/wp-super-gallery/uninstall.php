<?php
/**
 * WP Super Gallery — Uninstall handler.
 *
 * Fired when the plugin is deleted through the WordPress admin.
 * Removes all plugin data unless the user opted to preserve it.
 *
 * @package WP_Super_Gallery
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
function wpsg_uninstall_remove_dir( $dir ) {
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

// ── P66-F / Key Decision C: remove wpsg-exports/ regardless of the
// preserve-data preference — its 24-hour export-job TTL makes preserving ZIPs
// past uninstall backwards. Must run BEFORE the preserve-data early return
// below. Migrators are told (packaging docs) to move ZIPs out of
// uploads/wpsg-exports/ before uninstalling.
wpsg_uninstall_remove_dir( trailingslashit( wp_upload_dir()['basedir'] ) . 'wpsg-exports' );

// ── Respect user preference to preserve data ────────────────
$settings = get_option( 'wpsg_settings', [] );
if ( ! empty( $settings['preserve_data_on_uninstall'] ) ) {
	return;
}

// ── 1. Delete all wpsg_campaign posts + meta ────────────────
$campaign_ids = $wpdb->get_col(
	"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'wpsg_campaign'"
);
foreach ( $campaign_ids as $id ) {
	wp_delete_post( (int) $id, true ); // force delete, bypasses trash
}

// ── 2. Delete all wpsg_layout_tpl posts + meta ─────────────
$template_ids = $wpdb->get_col(
	"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'wpsg_layout_tpl'"
);
foreach ( $template_ids as $id ) {
	wp_delete_post( (int) $id, true );
}
// Also clean up legacy layout template option and backup.
delete_option( 'wpsg_layout_templates' );
delete_option( 'wpsg_layout_templates_backup' );

// ── 3. Delete taxonomy terms ────────────────────────────────
$taxonomies = [ 'wpsg_company', 'wpsg_campaign_category', 'wpsg_campaign_tag', 'wpsg_media_tag' ];
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
	'wpsg_settings',
	'wpsg_db_version',
	'wpsg_overlay_library',
	'wpsg_thumbnail_cache_index',
	'wpsg_oembed_provider_failures',
	'wpsg_oembed_failure_count',       // P66-F: distinct from _provider_failures above
	'wpsg_needs_setup',
	'wpsg_roles_migrated_editor', // P52-A2: wpsg_admin → wpsg_editor migration flag
	'wpsg_cache_version',
	'wpsg_layout_templates',
	'wpsg_media_refs_backfilled',
	'wpsg_media_refs_backfill_offset',
	'wpsg_access_requests_migrated',
	'wpsg_access_request_index',
	'wpsg_overlays_migrated',
	'wpsg_preserve_data_on_uninstall', // legacy key, if ever set directly
	// P47-A: Gallery Spaces
	'wpsg_default_space_id',
	'wpsg_spaces_backfill_complete',
	'wpsg_spaces_backfill_offset',
	// ── P66-F: options the plugin writes but uninstall never removed ──
	'wpsg_webhook_endpoints',          // contains webhook SECRETS
	'wpsg_webhook_delivery_log',
	'wpsg_recent_logs',
	'wpsg_rest_request_count',
	'wpsg_rest_error_count',
	'wpsg_alert_email_queue',
	'wpsg_export_job_index',
	'wpsg_font_library',
	'wpsg_campaign_tables_innodb_v15',
	'wpsg_space_library_assoc_backfilled',
	// P66-B / P66-C: one-time migration guard flags introduced this phase
	'wpsg_scoped_space_id_backfilled',
	'wpsg_archived_at_backfilled',
];
foreach ( $options as $option ) {
	delete_option( $option );
}

// P66-F: per-hash thumbnail cache rows (wpsg_thumb_<sha256>); the loop above
// only removed the legacy singular wpsg_thumbnail_cache_index.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options} WHERE option_name LIKE 'wpsg\_thumb\_%'"
);

// Clean up any legacy per-request options from pre-D-9 wp_options storage.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE 'wpsg\_access\_request\_%'
	   AND option_name != 'wpsg_access_request_index'
	   AND option_name != 'wpsg_access_requests_migrated'"
);

// ── 5. Delete transients matching wpsg_* ────────────────────
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	"DELETE FROM {$wpdb->options}
	 WHERE option_name LIKE '_transient_wpsg_%'
	    OR option_name LIKE '_transient_timeout_wpsg_%'"
);

// ── 6. Drop custom tables ───────────────────────────────────
$tables = [
	$wpdb->prefix . 'wpsg_analytics_events',
	$wpdb->prefix . 'wpsg_access_requests',
	$wpdb->prefix . 'wpsg_media_refs',
	$wpdb->prefix . 'wpsg_overlays',            // legacy pre-P48 name
	$wpdb->prefix . 'wpsg_assets',              // P66-F: current name (renamed from wpsg_overlays in v14)
	$wpdb->prefix . 'wpsg_audit_log',           // P40
	$wpdb->prefix . 'wpsg_spaces',              // P47-A
	$wpdb->prefix . 'wpsg_space_library_assoc', // P66-F
];
foreach ( $tables as $table ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange
	$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" );
}

// ── 6b. Drop custom indexes added to CORE WP tables ─────────
// P66-F: WPSG_DB::add_indexes() adds these to wp_postmeta / wp_termmeta; they
// must be removed on uninstall or they outlive the plugin. Guarded via
// INFORMATION_SCHEMA so a DROP on an absent index is a no-op, not an error.
$core_indexes = [
	[ 'table' => $wpdb->postmeta, 'index' => 'wpsg_postmeta_postid_key' ],
	[ 'table' => $wpdb->termmeta, 'index' => 'wpsg_termmeta_termid_key' ],
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
remove_role( 'wpsg_editor' );          // P52-A2 (Space Editor)
remove_role( 'wpsg_admin' );           // legacy pre-P52-A2 role — remove if still present

$admin_role = get_role( 'administrator' );
if ( $admin_role ) {
	$admin_role->remove_cap( 'manage_wpsg' );
	// Remove custom CPT capabilities
	$cpt_caps = [
		'edit_wpsg_campaigns',
		'edit_others_wpsg_campaigns',
		'publish_wpsg_campaigns',
		'read_private_wpsg_campaigns',
		'delete_wpsg_campaigns',
		'delete_private_wpsg_campaigns',
		'delete_published_wpsg_campaigns',
		'delete_others_wpsg_campaigns',
		'edit_private_wpsg_campaigns',
		'edit_published_wpsg_campaigns',
	];
	foreach ( $cpt_caps as $cap ) {
		$admin_role->remove_cap( $cap );
	}
}

// ── 8. Clear cron hooks ─────────────────────────────────────
// P66-F: clear the single canonical hook list shared with wpsg_deactivate(),
// instead of the stale 4-of-10 subset this file used to hardcode. This file
// runs in isolation, so pull the dependency-free helper in directly.
require_once __DIR__ . '/includes/wpsg-cron-hooks.php';
foreach ( wpsg_get_cron_hooks() as $hook ) {
	wp_clear_scheduled_hook( $hook );
}

// ── 9. Delete uploaded files ────────────────────────────────
// P66-F: wpsg-fonts/ was previously left behind. wpsg-exports/ is handled
// earlier (before the preserve-data return) per Key Decision C.
$upload_basedir = trailingslashit( wp_upload_dir()['basedir'] );
wpsg_uninstall_remove_dir( $upload_basedir . 'wpsg-thumbnails' );
wpsg_uninstall_remove_dir( $upload_basedir . 'wpsg-overlays' );
wpsg_uninstall_remove_dir( $upload_basedir . 'wpsg-fonts' );
