<?php
/**
 * P75-A: package edition self-identification (build-emitted marker → Freemius
 * is_premium / has_premium_version / is_org_compliant).
 *
 * @package Mullion
 */

class Mullion_Package_Edition_Test extends WP_UnitTestCase {

    /** @var string|null */
    private $fixture_path;

    public function tearDown(): void {
        remove_all_filters( 'mullion_edition_marker_path' );
        if ( is_string( $this->fixture_path ) && file_exists( $this->fixture_path ) ) {
            unlink( $this->fixture_path );
        }
        $this->fixture_path = null;
        parent::tearDown();
    }

    private function write_fixture( string $contents ): void {
        $this->fixture_path = sys_get_temp_dir() . '/mullion-edition-' . uniqid( '', true ) . '.json';
        file_put_contents( $this->fixture_path, $contents );
        $path = $this->fixture_path;
        add_filter(
            'mullion_edition_marker_path',
            static function () use ( $path ) {
                return $path;
            }
        );
    }

    public function test_default_marker_path_points_at_the_build_output() {
        $this->assertStringEndsWith( 'assets/mullion-edition.json', mullion_edition_marker_path() );
    }

    public function test_defaults_premium_without_marker_file() {
        // P77-D: point the lookup at a path that cannot exist instead of
        // asserting the real build output is absent. `npm run build:wp` writes
        // assets/mullion-edition.json, so the old assertion failed on any host
        // that had built the plugin, which is every developer machine.
        $missing = sys_get_temp_dir() . '/mullion-edition-missing-' . uniqid( '', true ) . '.json';
        add_filter(
            'mullion_edition_marker_path',
            static function () use ( $missing ) {
                return $missing;
            }
        );
        $this->assertFileDoesNotExist( $missing );
        $this->assertTrue( mullion_is_premium_package() );
    }

    public function test_reads_free_from_marker_file() {
        $this->write_fixture( '{"premium":false}' );
        $this->assertFalse( mullion_is_premium_package() );
    }

    public function test_reads_premium_from_marker_file() {
        $this->write_fixture( '{"premium":true}' );
        $this->assertTrue( mullion_is_premium_package() );
    }

    public function test_malformed_marker_falls_back_to_premium() {
        $this->write_fixture( '{not-json' );
        $this->assertTrue( mullion_is_premium_package() );
    }

    public function test_missing_premium_key_falls_back_to_premium() {
        $this->write_fixture( '{}' );
        $this->assertTrue( mullion_is_premium_package() );
    }

    public function test_non_boolean_premium_falls_back_to_premium() {
        // A string "false" would be true under a naive (bool) cast. Only a JSON
        // boolean is accepted as an explicit edition.
        $this->write_fixture( '{"premium":"false"}' );
        $this->assertTrue( mullion_is_premium_package() );
    }

    public function test_freemius_init_args_sets_fixed_freemium_flags() {
        $args = mullion_freemius_init_args( [] );
        $this->assertTrue( $args['has_premium_version'] );
        $this->assertTrue( $args['is_org_compliant'] );
        $this->assertSame( 'mullion-gallery', $args['slug'] );
        $this->assertSame( 'mullion-gallery', $args['menu']['slug'] );
        $this->assertSame( mullion_is_premium_package(), $args['is_premium'] );
    }

    public function test_freemius_init_args_config_overrides_marker() {
        $args = mullion_freemius_init_args(
            [
                'is_premium' => false,
                'id'         => '123',
            ]
        );
        $this->assertFalse( $args['is_premium'] );
        $this->assertSame( '123', $args['id'] );
        $this->assertTrue( $args['has_premium_version'] );
        $this->assertTrue( $args['is_org_compliant'] );
    }
}
