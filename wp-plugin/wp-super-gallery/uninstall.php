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

// ── Respect user preference to preserve data ────────────────
$settings = get_option( 'wpsg_settings', [] );
if ( ! empty( $settings['preserve_data_on_uninstall'] ) ) {
	return;
}

global $wpdb;

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
$taxonomies = [ 'wpsg_company', 'wpsg_campaign_category' ];
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
	'wpsg_needs_setup',
	'wpsg_cache_version',
	'wpsg_layout_templates',
	'wpsg_media_refs_backfilled',
	'wpsg_preserve_data_on_uninstall', // legacy key, if ever set directly
];
foreach ( $options as $option ) {
	delete_option( $option );
}

// ── 5. Delete transients matching wpsg_* ────────────────────
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
];
foreach ( $tables as $table ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.SchemaChange
	$wpdb->query( "DROP TABLE IF EXISTS `{$table}`" );
}

// ── 7. Remove roles and capabilities ────────────────────────
remove_role( 'wpsg_admin' );

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
$cron_hooks = [
	'wpsg_archive_cleanup',
	'wpsg_schedule_auto_archive',
	'wpsg_thumbnail_cache_cleanup',
	'wpsg_process_alert_emails',
];
foreach ( $cron_hooks as $hook ) {
	wp_clear_scheduled_hook( $hook );
}

// ── 9. Delete uploaded files ────────────────────────────────
$upload_dir = wp_upload_dir();
$dirs_to_remove = [
	trailingslashit( $upload_dir['basedir'] ) . 'wpsg-thumbnails',
	trailingslashit( $upload_dir['basedir'] ) . 'wpsg-overlays',
];
foreach ( $dirs_to_remove as $dir ) {
	if ( is_dir( $dir ) ) {
		// Recursively delete directory contents.
		$files = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $dir, RecursiveDirectoryIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $files as $file ) {
			if ( $file->isDir() ) {
				rmdir( $file->getRealPath() );
			} else {
				wp_delete_file( $file->getRealPath() );
			}
		}
		rmdir( $dir );
	}
}
