<?php

/**
 * P64-D/E/F: three small auth-correctness fixes.
 *
 *  D — do_approve_request() provisions a WP user with a random password but never
 *      sent them a way to log in. Now it calls wp_new_user_notification(…, 'user')
 *      (a password-set link) for freshly created users only.
 *  E — magic_link_redirect()'s inline-HTML fallback was passed as WP_REST_Response
 *      *data*, which the REST server JSON-encodes → a broken, escaped page. Now it
 *      echoes raw HTML via a one-shot rest_pre_serve_request filter (data is null).
 *  F — create_user()'s email-failure fallback was gated on a try/catch, but wp_mail()
 *      returns false rather than throwing, so it was unreachable. Now it listens for
 *      wp_mail_failed, so a real send failure yields emailSent=false + a resetUrl.
 */
class WPSG_P64DEF_Auth_Correctness_Test extends WP_UnitTestCase {

    public function setUp(): void {
        parent::setUp();
        WPSG_DB::maybe_upgrade();
    }

    private function admin(): int {
        $uid = self::factory()->user->create(['role' => 'administrator']);
        get_user_by('id', $uid)->add_cap('manage_wpsg');
        wp_set_current_user($uid);
        return $uid;
    }

    private function campaign(): int {
        $id = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => 'C', 'post_status' => 'publish']);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function submit_request(int $cid, string $email): string {
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => $email]);
        return rest_do_request($req)->get_data()['token'];
    }

    // ── P64-D ───────────────────────────────────────────────────────────────────

    public function test_approving_a_brand_new_email_sends_a_password_setup_notification() {
        $cid   = $this->campaign();
        $token = $this->submit_request($cid, 'firsttimer@example.com');

        $notified = [];
        add_filter('wp_new_user_notification_email', function ($mail, $user) use (&$notified) {
            $notified[] = (int) $user->ID;
            return $mail;
        }, 10, 2);

        $this->admin();
        $approve = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/approve");
        $this->assertSame(200, rest_do_request($approve)->get_status());

        $new_user = get_user_by('email', 'firsttimer@example.com');
        $this->assertInstanceOf(WP_User::class, $new_user);
        $this->assertContains((int) $new_user->ID, $notified, 'a first-time approved requester receives the password-set notification');
    }

    public function test_approving_an_existing_user_sends_no_setup_notification() {
        $existing = self::factory()->user->create(['role' => 'subscriber', 'user_email' => 'known@example.com']);
        $cid      = $this->campaign();
        $token    = $this->submit_request($cid, 'known@example.com');

        $notified = [];
        add_filter('wp_new_user_notification_email', function ($mail, $user) use (&$notified) {
            $notified[] = (int) $user->ID;
            return $mail;
        }, 10, 2);

        $this->admin();
        $approve = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/approve");
        $this->assertSame(200, rest_do_request($approve)->get_status());

        $this->assertNotContains((int) $existing, $notified, 'an existing user gets no spurious password-set notification');
    }

    // ── P64-E ───────────────────────────────────────────────────────────────────

    /**
     * Invoke the private magic_link_redirect() fallback with the one-shot serve
     * filter isolated, and capture what it echoes. Isolation matters: other
     * (bootstrap) rest_pre_serve_request filters — e.g. the P63-C security-header
     * filter — expect 4 args and call header(), so running the whole chain here
     * would error. We snapshot + clear the hook, let magic_link_redirect register
     * only its own closure, invoke it, then restore.
     *
     * @return array{0: WP_REST_Response, 1: string} [response, echoed HTML]
     */
    private function invoke_magic_link_and_capture(string $result): array {
        global $wp_filter;
        $saved = $wp_filter['rest_pre_serve_request'] ?? null;
        unset($wp_filter['rest_pre_serve_request']);

        $m = new ReflectionMethod('WPSG_Access_Controller', 'magic_link_redirect');
        $m->setAccessible(true);
        /** @var WP_REST_Response $resp */
        $resp = $m->invoke(null, $result);

        $html = '';
        if (!empty($wp_filter['rest_pre_serve_request'])) {
            ob_start();
            apply_filters('rest_pre_serve_request', false);
            $html = (string) ob_get_clean();
        }

        if ($saved !== null) {
            $wp_filter['rest_pre_serve_request'] = $saved;
        } else {
            unset($wp_filter['rest_pre_serve_request']);
        }
        return [$resp, $html];
    }

    public function test_magic_link_fallback_serves_raw_html_not_json_encoded_data() {
        update_option('wpsg_settings', []); // no magic_link_landing_page_id → inline fallback path

        [$resp, $html] = $this->invoke_magic_link_and_capture('approved');

        // The HTML must NOT be the response data (that path is what got JSON-encoded).
        $this->assertNull($resp->get_data(), 'HTML is no longer passed as response data');
        $this->assertSame(200, $resp->get_status());

        // Instead a one-shot rest_pre_serve_request filter echoes it raw.
        $this->assertStringStartsWith('<!DOCTYPE', ltrim($html), 'raw HTML, not a JSON-quoted string');
        $this->assertStringContainsString('Access Approved', $html);
        $this->assertStringNotContainsString('\/', $html, 'no JSON backslash-escaping of the markup');
    }

    // ── P64-F ───────────────────────────────────────────────────────────────────

    public function test_create_user_reports_failure_and_returns_reset_url_on_mail_failure() {
        $this->admin();

        // Simulate the real failure mode: wp_mail() fires wp_mail_failed and
        // returns false (rather than throwing). A pre_wp_mail short-circuit that
        // also fires wp_mail_failed reproduces exactly what the fix must detect.
        $fail = static function () {
            do_action('wp_mail_failed', new WP_Error('wpsg_test_forced', 'forced failure'));
            return false;
        };
        add_filter('pre_wp_mail', $fail, 10, 1);

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $req->set_body_params(['email' => 'failmail@example.com', 'displayName' => 'Fail Mail', 'role' => 'subscriber']);
        $res  = rest_do_request($req);
        $data = $res->get_data();

        remove_filter('pre_wp_mail', $fail, 10);

        $this->assertSame(201, $res->get_status());
        $this->assertFalse($data['emailSent'], 'a real mail failure is now detected');
        $this->assertArrayHasKey('resetUrl', $data, 'the reset-URL fallback is now reachable');
        $this->assertNotEmpty($data['resetUrl']);
    }

    public function test_create_user_reports_email_sent_on_success() {
        $this->admin();

        // Force a clean send: pre_wp_mail returning true short-circuits wp_mail to
        // success WITHOUT firing wp_mail_failed. (The bare test-suite mailer fires
        // wp_mail_failed, so we can't rely on the default to represent "success".)
        add_filter('pre_wp_mail', '__return_true');

        $req = new WP_REST_Request('POST', '/wp-super-gallery/v1/users');
        $req->set_body_params(['email' => 'okmail@example.com', 'displayName' => 'Ok Mail', 'role' => 'subscriber']);
        $data = rest_do_request($req)->get_data();

        remove_filter('pre_wp_mail', '__return_true');

        $this->assertTrue($data['emailSent'], 'a successful send reports emailSent=true');
        $this->assertArrayNotHasKey('resetUrl', $data, 'no fallback reset URL when mail succeeds');
    }
}
