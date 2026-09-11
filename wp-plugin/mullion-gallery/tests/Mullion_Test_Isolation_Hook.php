<?php
/**
 * P77-D: per-test reset of plugin-level static state.
 *
 * WP_UnitTestCase wraps every test in a transaction and rolls it back, but a
 * static PHP array survives that rollback. Mullion_DB::$space_cache kept rows
 * from earlier tests alive, so a later test that resolved the default space
 * through the cache could read a row the database no longer held (or a null
 * it no longer deserved) and fail with a 403 that never reproduced in
 * isolation. Registered as a PHPUnit extension in phpunit.xml.dist.
 *
 * @package Mullion
 */

use PHPUnit\Runner\BeforeTestHook;

final class Mullion_Test_Isolation_Hook implements BeforeTestHook {

    public function executeBeforeTest( string $test ): void {
        if ( class_exists( 'Mullion_DB' ) && method_exists( 'Mullion_DB', 'flush_space_cache' ) ) {
            Mullion_DB::flush_space_cache();
        }
    }
}
