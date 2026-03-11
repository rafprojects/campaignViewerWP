<?php
/**
 * Tests for the cookie-based auth/login and auth/logout REST endpoints (P20-K).
 *
 * @package WP_Super_Gallery
 * @since   0.18.0
 */

class WPSG_Cookie_Auth_Test extends WP_UnitTestCase {

    private $test_user_id;
    private $test_user_email = 'testuser@example.com';
    private $test_user_pass  = 'SecurePass123!';

    public function setUp(): void {
        parent::setUp();

        // Create a subscriber test user for login tests.
        $this->test_user_id = self::factory()->user->create([
            'user_login' => 'testuser',
            'user_email' => $this->test_user_email,
            'user_pass'  => $this->test_user_pass,
            'role'       => 'subscriber',
        ]);

        // Simulate same-origin request for CSRF validation.
        $_SERVER['HTTP_ORIGIN'] = home_url();

        // Ensure REST routes are registered.
        do_action('rest_api_init');
    }

    public function tearDown(): void {
        unset($_SERVER['HTTP_ORIGIN']);
        parent::tearDown();
    }

    // ── Login endpoint ────────────────────────────────────

    public function test_login_succeeds_with_valid_credentials() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');
        $request->set_param('password', $this->test_user_pass);

        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertEquals(200, $response->get_status());
        $this->assertArrayHasKey('user', $data);
        $this->assertArrayHasKey('nonce', $data);
        $this->assertArrayHasKey('permissions', $data);
        $this->assertEquals((string) $this->test_user_id, $data['user']['id']);
        $this->assertEquals($this->test_user_email, $data['user']['email']);
    }

    public function test_login_returns_admin_role_for_admin_users() {
        // Promote the test user to admin with WPSG capability.
        $user = get_user_by('id', $this->test_user_id);
        $user->set_role('administrator');
        $user->add_cap('manage_wpsg');

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');
        $request->set_param('password', $this->test_user_pass);

        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertEquals(200, $response->get_status());
        $this->assertEquals('admin', $data['user']['role']);
        $this->assertTrue($data['isAdmin']);
    }

    public function test_login_returns_viewer_role_for_non_admin() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');
        $request->set_param('password', $this->test_user_pass);

        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertEquals(200, $response->get_status());
        $this->assertEquals('viewer', $data['user']['role']);
        $this->assertFalse($data['isAdmin']);
    }

    public function test_login_fails_with_wrong_password() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');
        $request->set_param('password', 'WrongPassword!');

        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertEquals(401, $response->get_status());
        $this->assertEquals('invalid_credentials', $data['code']);
    }

    public function test_login_fails_with_nonexistent_user() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'nobody_here');
        $request->set_param('password', 'anything');

        $response = rest_do_request($request);

        $this->assertEquals(401, $response->get_status());
    }

    public function test_login_returns_fresh_nonce() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');
        $request->set_param('password', $this->test_user_pass);

        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertNotEmpty($data['nonce']);
        // The nonce should verify against 'wp_rest' for the logged-in user.
        wp_set_current_user($this->test_user_id);
        $this->assertNotFalse(wp_verify_nonce($data['nonce'], 'wp_rest'));
    }

    public function test_login_requires_username_parameter() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('password', $this->test_user_pass);

        $response = rest_do_request($request);

        $this->assertEquals(400, $response->get_status());
    }

    public function test_login_requires_password_parameter() {
        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');

        $response = rest_do_request($request);

        $this->assertEquals(400, $response->get_status());
    }

    // ── Logout endpoint ───────────────────────────────────

    public function test_logout_succeeds_when_authenticated() {
        wp_set_current_user($this->test_user_id);

        $request  = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/logout');
        $response = rest_do_request($request);
        $data     = $response->get_data();

        $this->assertEquals(200, $response->get_status());
        $this->assertTrue($data['loggedOut']);
        $this->assertArrayHasKey('nonce', $data);
    }

    public function test_logout_requires_authentication() {
        // Ensure no user is logged in.
        wp_set_current_user(0);

        $request  = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/logout');
        $response = rest_do_request($request);

        // Should be rejected by require_authenticated permission callback.
        $this->assertEquals(401, $response->get_status());
    }

    // ── wp_login_failed hook ──────────────────────────────

    public function test_login_fires_wp_login_failed_hook_on_bad_credentials() {
        $fired = false;
        $hook  = function () use (&$fired) { $fired = true; };
        add_action('wp_login_failed', $hook);

        $request = new WP_REST_Request('POST', '/wp-super-gallery/v1/auth/login');
        $request->set_param('username', 'testuser');
        $request->set_param('password', 'BadPassword!');

        rest_do_request($request);

        remove_action('wp_login_failed', $hook);
        $this->assertTrue($fired, 'wp_login_failed hook should fire on invalid credentials');
    }
}
