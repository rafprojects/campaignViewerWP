<?php
/**
 * P63-D — CSV formula-injection neutralization in the audit-log CSV export.
 *
 * Unit-tests the WPSG_Campaign_Controller::csv_cell() helper (via reflection)
 * that quotes/escapes each cell AND neutralizes leading formula characters
 * (=, +, -, @, TAB, CR) so a crafted actor_login / value cannot execute as a
 * formula when the CSV is opened in a spreadsheet.
 *
 * @package WP_Super_Gallery
 */
class WPSG_P63D_Audit_Csv_Injection_Test extends WP_UnitTestCase {

    private function cell( $value ): string {
        $m = new ReflectionMethod( WPSG_Campaign_Controller::class, 'csv_cell' );
        $m->setAccessible( true );
        return $m->invoke( null, $value );
    }

    /** @dataProvider dangerous_prefixes */
    public function test_neutralizes_formula_prefixes( string $input ) {
        // Neutralized cells carry a leading single-quote *inside* the quotes.
        $this->assertSame( '"\'' . $input . '"', $this->cell( $input ) );
    }

    public function dangerous_prefixes(): array {
        return [
            'equals'      => [ '=1+1' ],
            'plus'        => [ '+1+1' ],
            'minus'       => [ '-2+3' ],
            'at'          => [ '@SUM(1)' ],
            'tab'         => [ "\tcmd" ],
            'carriage'    => [ "\rcmd" ],
            'excel calc'  => [ "=cmd|'/c calc'!A1" ],
            'username -'  => [ "-2+3+cmd|'/C calc'!A1" ],
        ];
    }

    public function test_leaves_safe_values_unchanged() {
        // Only quoting is applied; the content between the quotes is unchanged.
        $this->assertSame( '"hello"', $this->cell( 'hello' ) );
        $this->assertSame( '"a=b+c"', $this->cell( 'a=b+c' ) );      // '=' not first char
        $this->assertSame( '"123"', $this->cell( '123' ) );
        $this->assertSame( '""', $this->cell( '' ) );                 // empty stays empty
        // JSON details cell starts with '{' (safe); its embedded quotes are doubled per RFC 4180.
        $this->assertSame( '"{""k"":1}"', $this->cell( '{"k":1}' ) );
    }

    public function test_doubles_embedded_quotes() {
        $this->assertSame( '"he said ""hi"""', $this->cell( 'he said "hi"' ) );
    }

    public function test_neutralizes_and_escapes_together() {
        // A value that both starts dangerously and contains a quote.
        $this->assertSame( '"\'=""x"""', $this->cell( '="x"' ) );
    }
}
