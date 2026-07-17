<?php

/**
 * P64-C: the public access-request endpoint must not be a mail-amplification
 * primitive, and must carry its own tight abuse controls.
 *
 * Pre-fix, POST /campaigns/{id}/access-requests (unauthenticated) emailed the
 * caller-supplied address a "your request was received" message without ever
 * verifying the caller owned it — so an attacker could loop a victim list and
 * make the site email each one. It also rode the generic 60/min public limiter.
 *
 * Fix: (1) no requester-facing email on submit — the admin (fixed recipient) is
 * still notified, and the requester hears back only at approve/deny; (2) a
 * dedicated, tighter rate limit; (3) a `wpsg_access_request_precheck` seam for
 * CAPTCHA/honeypot.
 */
class WPSG_P64C_Access_Request_Abuse_Test extends WP_UnitTestCase {

    /** @var string[] every address wp_mail() was asked to send to */
    private array $mailed_to = [];

    public function setUp(): void {
        parent::setUp();
        WPSG_DB::maybe_upgrade();
        $this->mailed_to = [];
        add_filter('wp_mail', [$this, 'capture_mail']);
    }

    public function capture_mail($args) {
        $to = $args['to'] ?? [];
        foreach ((array) $to as $addr) {
            $this->mailed_to[] = $addr;
        }
        return $args;
    }

    private function campaign(string $title = 'AR'): int {
        $id = wp_insert_post(['post_type' => 'wpsg_campaign', 'post_title' => $title, 'post_status' => 'publish']);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    private function submit(int $cid, string $email): WP_REST_Response {
        $req = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests");
        $req->set_body_params(['email' => $email]);
        return rest_do_request($req);
    }

    // ── Structural fix: no requester email on submit ────────────────────────────

    public function test_submit_emails_admin_but_never_the_requester() {
        $cid = $this->campaign();
        $res = $this->submit($cid, 'victim@example.com');

        $this->assertSame(201, $res->get_status());
        $this->assertContains(get_option('admin_email'), $this->mailed_to, 'admin notification still fires');
        $this->assertNotContains('victim@example.com', $this->mailed_to, 'the caller-supplied address is never emailed on submit');
    }

    public function test_submit_message_defers_notification_to_review() {
        $cid = $this->campaign();
        $res = $this->submit($cid, 'someone@example.com');

        $this->assertSame(201, $res->get_status());
        // Copy no longer promises an immediate confirmation email.
        $this->assertStringContainsStringIgnoringCase('reviews it', $res->get_data()['message']);
        $this->assertStringNotContainsStringIgnoringCase('check your email', $res->get_data()['message']);
    }

    public function test_requester_is_still_notified_on_approval() {
        $cid   = $this->campaign();
        $token = $this->submit($cid, 'approve-me@example.com')->get_data()['token'];
        $this->mailed_to = []; // ignore the submit-time admin mail

        // Approve as System Admin.
        $admin = self::factory()->user->create(['role' => 'administrator']);
        get_user_by('id', $admin)->add_cap('manage_wpsg');
        wp_set_current_user($admin);

        $approve = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$cid}/access-requests/{$token}/approve");
        $this->assertSame(200, rest_do_request($approve)->get_status());
        $this->assertContains('approve-me@example.com', $this->mailed_to, 'requester IS emailed once the request is approved');
    }

    // ── Abuse controls: precheck seam + dedicated rate limit ────────────────────

    public function test_precheck_filter_can_reject_before_processing() {
        $cid = $this->campaign();
        add_filter('wpsg_access_request_precheck', '__return_false');

        $res = $this->submit($cid, 'blocked@example.com');
        $this->assertSame(403, $res->get_status());
        $this->assertSame('wpsg_access_request_rejected', $res->get_data()['code']);
        // Rejected before the handler ran → no mail, no DB row.
        $this->assertNotContains(get_option('admin_email'), $this->mailed_to);
        $this->assertNull(WPSG_DB::find_access_request_by_email('blocked@example.com', $cid));

        remove_filter('wpsg_access_request_precheck', '__return_false');
    }

    public function test_precheck_wp_error_is_surfaced_verbatim() {
        $cid = $this->campaign();
        $cb  = static function () {
            return new WP_Error('wpsg_captcha_failed', 'CAPTCHA failed', ['status' => 400]);
        };
        add_filter('wpsg_access_request_precheck', $cb);

        $res = $this->submit($cid, 'captcha@example.com');
        $this->assertSame(400, $res->get_status());
        $this->assertSame('wpsg_captcha_failed', $res->get_data()['code']);

        remove_filter('wpsg_access_request_precheck', $cb);
    }

    public function test_endpoint_has_its_own_rate_limit_distinct_from_public() {
        $cid = $this->campaign();
        // Tighten only the access-request limit; the generic public limit stays 60.
        $cap = static fn() => 2;
        add_filter('wpsg_rate_limit_access_request', $cap);

        $this->assertSame(201, $this->submit($cid, 'a@example.com')->get_status(), '1st under limit');
        $this->assertSame(201, $this->submit($cid, 'b@example.com')->get_status(), '2nd at limit');
        $third = $this->submit($cid, 'c@example.com');
        $this->assertSame(429, $third->get_status(), '3rd trips the dedicated 2/min limit (not the 60/min public one)');

        remove_filter('wpsg_rate_limit_access_request', $cap);
    }
}
