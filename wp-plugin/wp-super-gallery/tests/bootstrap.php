<?php
/**
 * PHPUnit bootstrap file.
 *
 * @package Wp_Super_Gallery
 */

// Load local vendor autoload for polyfills and other dependencies.
require_once __DIR__ . '/../vendor/autoload.php';

// Set PHPUnit Polyfills path.
define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', __DIR__ . '/../vendor/yoast/phpunit-polyfills/src/' );

$_tests_dir = getenv( 'WP_TESTS_DIR' );

if ( ! $_tests_dir ) {
	$_tests_dir = rtrim( sys_get_temp_dir(), '/\\' ) . '/wordpress-tests-lib';
}

// Forward custom PHPUnit Polyfills configuration to PHPUnit bootstrap file.
$_phpunit_polyfills_path = getenv( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' );
if ( false !== $_phpunit_polyfills_path ) {
	define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', $_phpunit_polyfills_path );
}

if ( ! file_exists( "{$_tests_dir}/includes/functions.php" ) ) {
	echo "Could not find {$_tests_dir}/includes/functions.php - WordPress test environment not properly set up." . PHP_EOL;
	exit( 1 );
}

// Give access to tests_add_filter() function.
require_once "{$_tests_dir}/includes/functions.php";

/**
 * Manually load the plugin being tested.
 */
function _manually_load_plugin() {
	require dirname( dirname( __FILE__ ) ) . '/wp-super-gallery.php';
}

tests_add_filter( 'muplugins_loaded', '_manually_load_plugin' );

// If the test dependencies are installed locally for the plugin (composer), load them first.
$local_autoload = dirname( __FILE__ ) . '/vendor/autoload.php';
if ( file_exists( $local_autoload ) ) {
	require $local_autoload;
}

// If installed locally, point WP test bootstrap at the PHPUnit Polyfills package.
$polyfill_autoload = dirname( __FILE__ ) . '/vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
$polyfill_dir = dirname( $polyfill_autoload );
if ( file_exists( $polyfill_autoload ) && ! defined( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH' ) ) {
	define( 'WP_TESTS_PHPUNIT_POLYFILLS_PATH', $polyfill_dir );
}
if ( file_exists( $polyfill_autoload ) ) {
	require_once $polyfill_autoload;
}

// Start up the WP testing environment.
require_once __DIR__ . '/../vendor/yoast/phpunit-polyfills/phpunitpolyfills-autoload.php';
require "{$_tests_dir}/includes/bootstrap.php";
