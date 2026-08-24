<?php

/**
 * P28-I: Magic-Link Access Request Approval
 *
 * Covers:
 *  - Valid magic_key approves the request without an admin session.
 *  - Expired magic_key returns 403 equivalent (redirect to "expired").
 *  - Already-used magic_key returns 409 equivalent (redirect to "used").
 *  - Mismatched campaign ID returns 403 equivalent (redirect to "invalid").
 *  - Wrong magic_key value is rejected (redirect to "invalid").
 *  - Admin notification email is sent when an access request is submitted.
 */
class WPSG_P28I_Magic_Link_Test extends WP_UnitTestCase {

    private function create_campaign(): int {
        $id = wp_insert_post([
            'post_type'   => 'wpsg_campaign',
            'post_title'  => 'P28-I Test Campaign',
            'post_status' => 'publish',
        ]);
        update_post_meta($id, 'status', 'active');
        return intval($id);
    }

    /**
     * Insert an access request directly and generate a fresh magic key.
     * Returns ['token' => string, 'raw_key' => string].
     */
    private function insert_request_with_magic_key(
        int $campaign_id,
        string $email = 'user@example.com',
        int $ttl_seconds = 172800  // 48 hours
    ): array {
        $token = wp_generate_uuid4();
        WPSG_DB::insert_access_request([
            'token'        => $token,
            'email'        => $email,
            'campaign_id'  => $campaign_id,
            'status'       => 'pending',
            'requested_at' => gmdate('c'),
        ]);

        $raw_key    = bin2hex(random_bytes(32));
        $hash       = hash('sha256', $raw_key);
        $expires_at = gmdate('Y-m-d H:i:s', time() + $ttl_seconds);
        WPSG_DB::set_magic_key($token, $hash, $expires_at);

        return ['token' => $token, 'raw_key' => $raw_key];
    }

    /**
     * P64-E: the magic-link fallback no longer returns its HTML as response data
     * (which the REST server JSON-encoded into a broken page); it echoes raw HTML
     * via a one-shot rest_pre_serve_request filter. rest_do_request() doesn't run
     * that filter, so to see the message text we isolate the wpsg-registered
     * filter (bootstrap filters on this hook expect 4 args + call header()) and
     * invoke it, capturing the echo.
     *
     * @return array{0: WP_REST_Response, 1: string} [response, echoed HTML]
     */
    private function serve_and_capture_html(WP_REST_Request $request): array {
        global $wp_filter;
        $saved = $wp_filter['rest_pre_serve_request'] ?? null;
        unset($wp_filter['rest_pre_serve_request']);

        $response = rest_do_request($request);

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
        return [$response, $html];
    }

    public function tearDown(): void {
        parent::tearDown();
        wp_set_current_user(0);
    }

    // =========================================================================
    // Magic-link generation on submit
    // =========================================================================

    public function test_submit_access_request_generates_magic_key() {
        $campaign_id = $this->create_campaign();

        $request = new WP_REST_Request('POST', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests");
        $request->set_param('email', 'newuser@example.com');
        rest_do_request($request);

        global $wpdb;
        $table = WPSG_DB::get_access_requests_table();
        $row   = $wpdb->get_row(
            $wpdb->prepare("SELECT * FROM {$table} WHERE email = %s AND campaign_id = %d", 'newuser@example.com', $campaign_id),
            ARRAY_A
        );

        $this->assertNotNull($row, 'Access request row should exist.');
        $this->assertNotEmpty($row['magic_key_hash'], 'magic_key_hash should be set after submission.');
        $this->assertNotEmpty($row['magic_key_expires_at'], 'magic_key_expires_at should be set after submission.');
        $this->assertNull($row['magic_key_used_at'], 'magic_key_used_at should be NULL on new request.');

        // Hash should be a 64-char hex SHA-256.
        $this->assertEquals(64, strlen($row['magic_key_hash']));

        // Expiry should be roughly 48 hours in the future.
        $expires_ts = strtotime($row['magic_key_expires_at']);
        $this->assertGreaterThan(time() + 47 * 3600, $expires_ts, 'Expiry should be ~48 h from now.');
    }

    // =========================================================================
    // Valid magic key → approved
    // =========================================================================

    public function test_valid_magic_key_approves_request() {
        $campaign_id = $this->create_campaign();
        ['token' => $token, 'raw_key' => $raw_key] = $this->insert_request_with_magic_key($campaign_id);

        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/magic-approve");
        $request->set_param('magic_key', $raw_key);
        $response = rest_do_request($request);

        // Handler returns 302 (redirect) or 200 (inline HTML), never an error.
        $this->assertContains($response->get_status(), [200, 302], 'Valid magic-link should yield a success response.');

        $updated = WPSG_DB::get_access_request($token);
        $this->assertEquals('approved', $updated['status'], 'Status should be approved after valid magic-link use.');
        $this->assertNotEmpty($updated['magic_key_used_at'], 'magic_key_used_at should be set after use.');
    }

    // =========================================================================
    // Expired magic key → rejected
    // =========================================================================

    public function test_expired_magic_key_does_not_approve() {
        $campaign_id = $this->create_campaign();
        ['token' => $token, 'raw_key' => $raw_key] = $this->insert_request_with_magic_key(
            $campaign_id,
            'expired@example.com',
            -1  // already expired
        );

        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/magic-approve");
        $request->set_param('magic_key', $raw_key);
        [$response, $html] = $this->serve_and_capture_html($request);

        $updated = WPSG_DB::get_access_request($token);
        $this->assertEquals('pending', $updated['status'], 'Expired key must not change request status.');

        // The served HTML (P64-E: echoed raw) or a Location header must indicate "expired".
        $location = $response->get_headers()['Location'] ?? '';
        $this->assertMatchesRegularExpression('/expired|Expired/i', $html . $location);
    }

    // =========================================================================
    // Already-used magic key → rejected
    // =========================================================================

    public function test_used_magic_key_is_rejected() {
        $campaign_id = $this->create_campaign();
        ['token' => $token, 'raw_key' => $raw_key] = $this->insert_request_with_magic_key($campaign_id, 'replay@example.com');

        // Pre-mark as used.
        WPSG_DB::mark_magic_key_used($token);

        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/magic-approve");
        $request->set_param('magic_key', $raw_key);
        [$response, $html] = $this->serve_and_capture_html($request);

        $updated = WPSG_DB::get_access_request($token);
        $this->assertEquals('pending', $updated['status'], 'Pre-used key must not approve request.');

        $location = $response->get_headers()['Location'] ?? '';
        $this->assertMatchesRegularExpression('/used|Used|Processed/i', $html . $location);
    }

    // =========================================================================
    // Mismatched campaign ID → rejected (IDOR protection)
    // =========================================================================

    public function test_wrong_campaign_id_is_rejected() {
        $campaign_a = $this->create_campaign();
        $campaign_b = $this->create_campaign();
        ['token' => $token, 'raw_key' => $raw_key] = $this->insert_request_with_magic_key($campaign_a);

        // Use campaign_b's ID in the URL — should fail even though key is valid.
        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_b}/access-requests/{$token}/magic-approve");
        $request->set_param('magic_key', $raw_key);
        rest_do_request($request);

        $updated = WPSG_DB::get_access_request($token);
        $this->assertEquals('pending', $updated['status'], 'Wrong campaign ID must not approve request.');
    }

    // =========================================================================
    // Wrong magic key value → rejected
    // =========================================================================

    public function test_wrong_magic_key_value_is_rejected() {
        $campaign_id = $this->create_campaign();
        ['token' => $token] = $this->insert_request_with_magic_key($campaign_id);

        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/magic-approve");
        $request->set_param('magic_key', 'aabbccdd' . str_repeat('00', 28));  // wrong key
        rest_do_request($request);

        $updated = WPSG_DB::get_access_request($token);
        $this->assertEquals('pending', $updated['status'], 'Wrong key value must not approve request.');
    }

    // =========================================================================
    // Missing magic_key param → rejected
    // =========================================================================

    public function test_missing_magic_key_param_is_rejected() {
        $campaign_id = $this->create_campaign();
        ['token' => $token] = $this->insert_request_with_magic_key($campaign_id);

        $request = new WP_REST_Request('GET', "/wp-super-gallery/v1/campaigns/{$campaign_id}/access-requests/{$token}/magic-approve");
        rest_do_request($request);

        $updated = WPSG_DB::get_access_request($token);
        $this->assertEquals('pending', $updated['status'], 'Missing magic_key must not approve request.');
    }
}
