<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Access_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        // P28-J: Access totals summary — specific name before (?P<id>\d+) siblings.
        register_rest_route('wp-super-gallery/v1', '/campaigns/access-summary', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'access_summary'],
                'permission_callback' => WPSG_Permissions::gate('campaigns.access_summary.read'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access', [
            [
                'methods'             => 'GET',
                // P33-C: owner can read the access list for their campaign.
                'callback'            => [self::class, 'list_access'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access.list'),
            ],
            [
                'methods'             => 'POST',
                // P33-C: only owner can grant access.
                'callback'            => [self::class, 'grant_access'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access.grant'),
                'args'                => [
                    'userId'     => [
                        'required' => true,
                        'type'     => 'integer',
                        'minimum'  => 1,
                    ],
                    'source'     => [
                        'required' => true,
                        'type'     => 'string',
                        'enum'     => ['company', 'campaign'],
                    ],
                    'action'     => [
                        'type'    => 'string',
                        'enum'    => ['grant', 'deny'],
                        'default' => 'grant',
                    ],
                    'expires_at' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    // P33-B: per-campaign role level.
                    'access_level' => [
                        'type'    => 'string',
                        // P53-D: editing/managing comes from the wpsg_editor role; grants are viewer-only.
                        'enum'    => ['viewer'],
                        'default' => 'viewer',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access/(?P<userId>\d+)', [
            [
                'methods' => 'DELETE',
                // P33-C: only owner can revoke access.
                'callback' => [self::class, 'revoke_access'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access.revoke'),
            ],
        ]);

        // P18-I: Access Request Workflow
        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'submit_access_request'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access_request.submit'),
                'args'                => [
                    'email' => [
                        'required'          => true,
                        'type'              => 'string',
                        'format'            => 'email',
                        'sanitize_callback' => 'sanitize_email',
                    ],
                ],
            ],
            [
                'methods'             => 'GET',
                // P33-C: owner can list pending access requests for their campaign.
                'callback'            => [self::class, 'list_access_requests'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access_request.list'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/approve', [
            [
                'methods'             => 'POST',
                // P33-C: only owner can approve access requests.
                'callback'            => [self::class, 'approve_access_request'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access_request.approve'),
                'args'                => [
                    // P33-B: role to assign on approval. Defaults to 'viewer'.
                    'access_level' => [
                        'type'    => 'string',
                        // P53-D: editing/managing comes from the wpsg_editor role; grants are viewer-only.
                        'enum'    => ['viewer'],
                        'default' => 'viewer',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/deny', [
            [
                'methods' => 'POST',
                // P33-C: only owner can deny access requests.
                'callback' => [self::class, 'deny_access_request'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access_request.deny'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/campaigns/(?P<id>\d+)/access-requests/(?P<token>[a-f0-9\-]{36})/magic-approve', [
            [
                'methods'             => 'GET',
                'callback'            => [self::class, 'magic_approve_access_request'],
                'permission_callback' => WPSG_Permissions::gate('campaign.access_request.magic_approve'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/companies/(?P<id>\d+)/access', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_company_access'],
                'permission_callback' => WPSG_Permissions::gate('company.access.list'),
            ],
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'grant_company_access'],
                'permission_callback' => WPSG_Permissions::gate('company.access.grant'),
                'args'                => [
                    // P33-B: per-company role level propagated to all company campaigns.
                    'access_level' => [
                        'type'    => 'string',
                        // P53-D: editing/managing comes from the wpsg_editor role; grants are viewer-only.
                        'enum'    => ['viewer'],
                        'default' => 'viewer',
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/companies/(?P<id>\d+)/access/(?P<userId>\d+)', [
            [
                'methods' => 'DELETE',
                'callback' => [self::class, 'revoke_company_access'],
                'permission_callback' => WPSG_Permissions::gate('company.access.revoke'),
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/companies/(?P<id>\d+)/archive', [
            [
                'methods' => 'POST',
                'callback' => [self::class, 'archive_company'],
                'permission_callback' => WPSG_Permissions::gate('company.archive'),
            ],
        ]);
    }

    public static function list_access($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        // P28-B: include_expired=true shows grants past their expiry (hidden by default).
        $include_expired = filter_var($request->get_param('include_expired'), FILTER_VALIDATE_BOOLEAN);

        $company_term = self::get_company_term($post_id);
        $company_grants = $company_term ? get_term_meta($company_term->term_id, 'access_grants', true) : [];
        $campaign_grants = get_post_meta($post_id, 'access_grants', true);
        $overrides = get_post_meta($post_id, 'access_overrides', true);

        $company_grants = is_array($company_grants) ? $company_grants : [];
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        $overrides = is_array($overrides) ? $overrides : [];

        $deny_user_ids = array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, array_filter($overrides, function ($entry) {
            return ($entry['action'] ?? '') === 'deny';
        }));

        $now = time();
        $effective = array_values(array_filter(array_merge($company_grants, $campaign_grants), function ($entry) use ($deny_user_ids, $include_expired, $now) {
            $user_id = intval($entry['userId'] ?? 0);
            if ($user_id <= 0 || in_array($user_id, $deny_user_ids, true)) {
                return false;
            }
            // P28-B: skip expired grants unless caller asks for them.
            if (!$include_expired && !empty($entry['expires_at']) && strtotime($entry['expires_at']) < $now) {
                return false;
            }
            return true;
        }));

        // P28-F: paginate before enrichment.
        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total = count($effective);
        $page_items = array_slice($effective, $offset, $per_page);

        // Enrich only the current page with user details.
        $user_ids = array_unique(array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $page_items));

        $user_map = [];
        if (!empty($user_ids)) {
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'user_email', 'display_name', 'user_login']]);
            foreach ($users as $user) {
                $user_map[$user->ID] = [
                    'displayName' => $user->display_name,
                    'email' => $user->user_email,
                    'login' => $user->user_login,
                ];
            }
        }

        $enriched = array_map(function ($entry) use ($user_map, $now) {
            $user_id = intval($entry['userId'] ?? 0);
            if (isset($user_map[$user_id])) {
                $entry['user'] = $user_map[$user_id];
            }
            // P28-B: compute is_expired on the fly.
            $expires_at = $entry['expires_at'] ?? null;
            $entry['expires_at'] = $expires_at;
            $entry['is_expired'] = $expires_at !== null && strtotime($expires_at) < $now;
            // P33-B: normalize legacy grants that pre-date RBAC.
            $entry['access_level'] = self::validate_access_level($entry['access_level'] ?? 'viewer');
            return $entry;
        }, $page_items);

        return self::paginated_response($enriched, $total, $page, $per_page);
    }

    public static function grant_access($request) {
        $post_id = intval($request->get_param('id'));
        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $user_id = intval($request->get_param('userId'));
        $source = sanitize_text_field($request->get_param('source'));
        $action = sanitize_text_field($request->get_param('action')) ?: 'grant';

        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }

        if (!in_array($source, ['company', 'campaign'], true)) {
            return new WP_Error('wpsg_invalid_source', 'Invalid source', ['status' => 400]);
        }

        // P28-B: optional expiry — validate ISO 8601 datetime if provided.
        $expires_at_raw = $request->get_param('expires_at');
        $expires_at = null;
        if ($expires_at_raw !== null && $expires_at_raw !== '') {
            $ts = strtotime(sanitize_text_field($expires_at_raw));
            if ($ts === false) {
                return new WP_Error('wpsg_invalid_expires_at', 'expires_at must be a valid ISO 8601 datetime', ['status' => 400]);
            }
            $expires_at = gmdate('c', $ts);
        }

        // P33-B: access_level for RBAC (deny entries carry no role).
        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');

        $entry = [
            'userId'       => $user_id,
            'campaignId'   => $post_id,
            'source'       => $source,
            'grantedAt'    => gmdate('c'),
            'expires_at'   => $expires_at,
            'access_level' => $access_level,
        ];

        if ($source === 'company') {
            $company_term = self::get_company_term($post_id);
            if (!$company_term) {
                return new WP_Error('wpsg_company_not_set', 'Company not set for campaign', ['status' => 400]);
            }
            $grants = get_term_meta($company_term->term_id, 'access_grants', true);
            $grants = is_array($grants) ? $grants : [];
            $grants = self::upsert_grant($grants, $entry);
            update_term_meta($company_term->term_id, 'access_grants', $grants);
        } else {
            if ($action === 'deny') {
                $overrides = get_post_meta($post_id, 'access_overrides', true);
                $overrides = is_array($overrides) ? $overrides : [];
                $overrides = self::upsert_override($overrides, [
                    'userId' => $user_id,
                    'action' => 'deny',
                    'grantedAt' => gmdate('c'),
                ]);
                update_post_meta($post_id, 'access_overrides', $overrides);
            } else {
                $grants = get_post_meta($post_id, 'access_grants', true);
                $grants = is_array($grants) ? $grants : [];
                $grants = self::upsert_grant($grants, $entry);
                update_post_meta($post_id, 'access_grants', $grants);
            }
        }

        $audit_action = $source === 'company' ? 'access.company.granted' : ($action === 'deny' ? 'access.denied' : 'access.granted');
        self::add_audit_entry($post_id, $audit_action, [
            'userId' => $user_id,
            'source' => $source,
            'action' => $action,
        ]);

        if ($action !== 'deny') {
            do_action('wpsg_access_granted', $post_id, ['userId' => $user_id, 'source' => $source]);
        }
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Access updated'], 200);
    }

    public static function revoke_access($request) {
        $post_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));
        if (!self::campaign_exists($post_id) || $user_id <= 0) {
            return new WP_Error('wpsg_invalid_request', 'Invalid request', ['status' => 400]);
        }

        $company_term = self::get_company_term($post_id);
        if ($company_term) {
            $company_grants = get_term_meta($company_term->term_id, 'access_grants', true);
            $company_grants = is_array($company_grants) ? $company_grants : [];
            $company_grants = array_values(array_filter($company_grants, function ($entry) use ($user_id) {
                return intval($entry['userId'] ?? 0) !== $user_id;
            }));
            update_term_meta($company_term->term_id, 'access_grants', $company_grants);
        }

        $campaign_grants = get_post_meta($post_id, 'access_grants', true);
        $campaign_grants = is_array($campaign_grants) ? $campaign_grants : [];
        $campaign_grants = array_values(array_filter($campaign_grants, function ($entry) use ($user_id) {
            return intval($entry['userId'] ?? 0) !== $user_id;
        }));
        update_post_meta($post_id, 'access_grants', $campaign_grants);

        $overrides = get_post_meta($post_id, 'access_overrides', true);
        $overrides = is_array($overrides) ? $overrides : [];
        $overrides = array_values(array_filter($overrides, function ($entry) use ($user_id) {
            return intval($entry['userId'] ?? 0) !== $user_id;
        }));
        update_post_meta($post_id, 'access_overrides', $overrides);

        self::add_audit_entry($post_id, 'access.revoked', [
            'userId' => $user_id,
        ]);
        do_action('wpsg_access_revoked', $post_id, ['userId' => $user_id]);
        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Access revoked'], 200);
    }

    // -------------------------------------------------------------------------
    // P18-I: Access Request Workflow helpers  (D-9: now backed by custom table)
    // -------------------------------------------------------------------------

    /**
     * Format a DB row into the REST response shape expected by the frontend.
     */
    private static function format_access_request(array $row): array {
        return [
            'token'       => $row['token'],
            'email'       => $row['email'],
            'campaignId'  => (int) $row['campaign_id'],
            'campaign_id' => (int) $row['campaign_id'],
            'status'      => $row['status'],
            'requestedAt' => gmdate('c', strtotime($row['requested_at'])),
            'requested_at' => gmdate('c', strtotime($row['requested_at'])),
            'resolvedAt'  => $row['resolved_at']
                ? gmdate('c', strtotime($row['resolved_at']))
                : null,
            'resolved_at' => $row['resolved_at']
                ? gmdate('c', strtotime($row['resolved_at']))
                : null,
        ];
    }

    // -------------------------------------------------------------------------
    // P18-I: Handler methods
    // -------------------------------------------------------------------------

    /**
     * POST /campaigns/{id}/access-requests
     * Public (rate-limited) — submit an access request by email.
     */
    public static function submit_access_request($request) {
        $post_id    = intval($request->get_param('id'));
        $email      = sanitize_email($request->get_param('email') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }
        if (!is_email($email)) {
            return new WP_Error('wpsg_invalid_email', 'A valid email address is required', ['status' => 400]);
        }

        // Check for existing request (duplicate / cooldown)
        $existing = WPSG_DB::find_access_request_by_email($email, $post_id);
        if ($existing) {
            if ($existing['status'] === 'pending') {
                return new WP_Error('wpsg_request_pending', 'A request for this email is already pending.', ['status' => 409]);
            }
            if ($existing['status'] === 'denied') {
                $cooldown_seconds = 24 * 60 * 60;
                $elapsed = time() - strtotime($existing['requested_at']);
                if ($elapsed < $cooldown_seconds) {
                    return new WP_Error('wpsg_rate_limited', 'Please wait 24 hours before submitting another request.', ['status' => 429]);
                }
                // Remove stale denied request so a fresh one can be created
                WPSG_DB::delete_access_request($existing['token']);
            }
        }

        $token = wp_generate_uuid4();
        $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
        $now    = gmdate('c');

        WPSG_DB::insert_access_request([
            'token'        => $token,
            'email'        => $email,
            'campaign_id'  => $post_id,
            'status'       => 'pending',
            'requested_at' => $now,
        ]);

        // Generate magic key for one-click admin approval (P28-I).
        // 256 bits of random entropy — hash stored in DB, raw key sent in email.
        $raw_magic_key  = bin2hex(random_bytes(32));
        $magic_key_hash = hash('sha256', $raw_magic_key);
        $expires_at     = gmdate('Y-m-d H:i:s', time() + 48 * 3600);
        WPSG_DB::set_magic_key($token, $magic_key_hash, $expires_at);

        $site_name = get_bloginfo('name');

        // One-click magic link for the admin email.
        $magic_link = rest_url(
            sprintf(
                'wp-super-gallery/v1/campaigns/%d/access-requests/%s/magic-approve?magic_key=%s',
                $post_id,
                rawurlencode($token),
                rawurlencode($raw_magic_key)
            )
        );

        // Admin notification with one-click approval link.
        wp_mail(
            get_option('admin_email'),
            sprintf('[%s] Access Request — %s', $site_name, $campaign_title),
            sprintf(
                "Hello,\n\nA new access request for \"%s\" has been received from: %s\n\nClick to approve instantly (valid 48 hours):\n%s\n\nOr log in to review requests manually:\n%s\n\nThank you,\n%s",
                $campaign_title,
                $email,
                $magic_link,
                admin_url(),
                $site_name
            )
        );

        // Confirmation email to the requester.
        wp_mail(
            $email,
            sprintf('[%s] Access Request Received — %s', $site_name, $campaign_title),
            sprintf(
                "Hello,\n\nYour access request for \"%s\" has been received.\nAn administrator will review your request shortly.\n\nThank you,\n%s",
                $campaign_title,
                $site_name
            )
        );

        return new WP_REST_Response([
            'message' => 'Request submitted. Check your email for confirmation.',
            'token'   => $token,
        ], 201);
    }

    /**
     * GET /campaigns/{id}/access-requests
     * Admin — list all access requests for a campaign.
     */
    public static function list_access_requests($request) {
        $post_id = intval($request->get_param('id'));
        $status  = sanitize_text_field($request->get_param('status') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $rows = WPSG_DB::list_access_requests($post_id, $status);
        $result = array_map([self::class, 'format_access_request'], $rows);

        return new WP_REST_Response($result, 200);
    }

    /**
     * POST /campaigns/{id}/access-requests/{token}/approve
     * Admin — approve a pending access request.
     */
    public static function approve_access_request($request) {
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $data = WPSG_DB::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return new WP_Error('wpsg_request_not_found', 'Request not found', ['status' => 404]);
        }
        if ($data['status'] !== 'pending') {
            return new WP_Error('wpsg_request_resolved', 'Request already resolved', ['status' => 409]);
        }

        // P33-B: admin may specify a role; default to 'viewer'.
        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');
        $result = self::do_approve_request($post_id, $token, $data, $access_level);
        if (is_wp_error($result)) {
            return $result;
        }

        return new WP_REST_Response(['message' => 'Access request approved'], 200);
    }

    /**
     * Shared approval logic used by both the admin POST and the magic-link GET endpoints.
     *
     * Provisions or looks up the WP user, grants campaign access, updates request
     * status, fires the audit entry, and sends the requester notification email.
     *
     * @param string $access_level P33-B: role to assign ('viewer' | 'editor' | 'owner'). Defaults to 'viewer'.
     * @return true|WP_Error
     */
    private static function do_approve_request(int $post_id, string $token, array $data, string $access_level = 'viewer') {
        // Provision access: look up or create a WP user for this email.
        $user = get_user_by('email', $data['email']);
        if (!$user) {
            $username = sanitize_user(explode('@', $data['email'])[0], true);
            $base     = $username ?: 'user';
            $username = $base;
            $suffix   = 1;
            while (username_exists($username)) {
                $username = $base . $suffix++;
            }
            $user_id = wp_create_user($username, wp_generate_password(), $data['email']);
            if (is_wp_error($user_id)) {
                return new WP_Error(
                    'wpsg_user_creation_failed',
                    'Failed to create user: ' . $user_id->get_error_message(),
                    ['status' => 500]
                );
            }
            $user = get_user_by('ID', $user_id);
        }

        // Grant access (campaign-level). P33-B: persist the approved role.
        $grants = get_post_meta($post_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];
        $grants = self::upsert_grant($grants, [
            'userId'       => $user->ID,
            'campaignId'   => $post_id,
            'source'       => 'campaign',
            'grantedAt'    => gmdate('c'),
            'access_level' => self::validate_access_level($access_level),
        ]);
        update_post_meta($post_id, 'access_grants', $grants);
        self::clear_accessible_campaigns_cache();

        // Update request status.
        WPSG_DB::update_access_request_status($token, 'approved');

        self::add_audit_entry($post_id, 'access.request.approved', [
            'email'  => $data['email'],
            'userId' => $user->ID,
            'token'  => $token,
        ]);

        // Notify the requester.
        $site_name      = get_bloginfo('name');
        $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
        wp_mail(
            $data['email'],
            sprintf('[%s] Access Approved — %s', $site_name, $campaign_title),
            sprintf(
                "Hello,\n\nYour access request for \"%s\" has been approved!\nYou can now view the campaign at: %s\n\nThank you,\n%s",
                $campaign_title,
                home_url(),
                $site_name
            )
        );

        return true;
    }

    /**
     * GET /campaigns/{id}/access-requests/{token}/magic-approve?magic_key=…
     * Public (rate-limited at 10/min) — one-click approval from admin email.
     *
     * Validates the magic key, approves the request, then redirects to the
     * configured landing page or returns inline HTML if no page is set.
     */
    public static function magic_approve_access_request($request) {
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');
        $raw_key = sanitize_text_field($request->get_param('magic_key') ?? '');

        if (!self::campaign_exists($post_id)) {
            return self::magic_link_redirect('invalid');
        }

        $data = WPSG_DB::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return self::magic_link_redirect('invalid');
        }

        if ($raw_key === '' || empty($data['magic_key_hash'])) {
            return self::magic_link_redirect('invalid');
        }

        // Constant-time hash comparison prevents timing attacks.
        $expected_hash = hash('sha256', $raw_key);
        if (!hash_equals($data['magic_key_hash'], $expected_hash)) {
            return self::magic_link_redirect('invalid');
        }

        // Check TTL.
        if (!empty($data['magic_key_expires_at']) && strtotime($data['magic_key_expires_at']) < time()) {
            return self::magic_link_redirect('expired');
        }

        // Check replay (key already consumed).
        if (!empty($data['magic_key_used_at'])) {
            return self::magic_link_redirect('used');
        }

        // Request already resolved by another means.
        if ($data['status'] !== 'pending') {
            return self::magic_link_redirect('used');
        }

        // Mark consumed BEFORE processing to close the replay window.
        WPSG_DB::mark_magic_key_used($token);

        $result = self::do_approve_request($post_id, $token, $data);
        if (is_wp_error($result)) {
            return self::magic_link_redirect('invalid');
        }

        return self::magic_link_redirect('approved');
    }

    /**
     * Build a WP_REST_Response for the magic-link result. When a landing page is
     * configured a 302 redirect is returned; otherwise a 200 HTML response is
     * returned. Returns rather than calling header()/exit() so the handler is
     * testable and compatible with rest_do_request().
     */
    private static function magic_link_redirect(string $result): WP_REST_Response {
        $settings = get_option('wpsg_settings', []);
        $page_id  = intval($settings['magic_link_landing_page_id'] ?? 0);
        $page_url = $page_id ? get_permalink($page_id) : null;

        if ($page_url) {
            $redirect_url = add_query_arg('wpsg_result', rawurlencode($result), $page_url);
            $response = new WP_REST_Response(null, 302);
            $response->header('Location', $redirect_url);
            return $response;
        }

        // Inline HTML fallback — used when no landing page is configured.
        $labels = [
            'approved' => ['Access Approved',   'The access request has been approved. The user will receive a notification email.', '#16a34a'],
            'expired'  => ['Link Expired',       'This magic link has expired (valid for 48 hours). Please log in to approve requests manually.', '#d97706'],
            'used'     => ['Already Processed',  'This magic link has already been used or the request was already resolved.', '#d97706'],
            'invalid'  => ['Invalid Link',       'This magic link is invalid or the request could not be found.', '#dc2626'],
        ];
        [$title, $message, $color] = $labels[$result] ?? $labels['invalid'];

        $site_name  = esc_html(get_bloginfo('name'));
        $title_e    = esc_html($title);
        $message_e  = esc_html($message);
        $admin_url  = esc_url(admin_url());

        // phpcs:disable
        $html = "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
<title>{$title_e} — {$site_name}</title>
<style>*{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f5}.card{max-width:420px;width:100%;margin:1rem;padding:2rem;background:#fff;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center}h1{margin:0 0 .75rem;font-size:1.4rem;color:{$color}}p{margin:0 0 1.5rem;color:#555;line-height:1.5}a{color:#3b82f6;text-decoration:none;font-weight:500}a:hover{text-decoration:underline}</style>
</head><body><div class=\"card\"><h1>{$title_e}</h1><p>{$message_e}</p><a href=\"{$admin_url}\">Go to Admin Panel</a></div></body></html>";
        // phpcs:enable
        $response = new WP_REST_Response($html, 200);
        $response->header('Content-Type', 'text/html; charset=utf-8');
        return $response;
    }

    /**
     * POST /campaigns/{id}/access-requests/{token}/deny
     * Admin — deny a pending access request.
     */
    public static function deny_access_request($request) {
        $post_id = intval($request->get_param('id'));
        $token   = sanitize_text_field($request->get_param('token') ?? '');

        if (!self::campaign_exists($post_id)) {
            return new WP_Error('wpsg_campaign_not_found', 'Campaign not found', ['status' => 404]);
        }

        $data = WPSG_DB::get_access_request($token);
        if (!$data || intval($data['campaign_id']) !== $post_id) {
            return new WP_Error('wpsg_request_not_found', 'Request not found', ['status' => 404]);
        }
        if ($data['status'] !== 'pending') {
            return new WP_Error('wpsg_request_resolved', 'Request already resolved', ['status' => 409]);
        }

        WPSG_DB::update_access_request_status($token, 'denied');

        self::add_audit_entry($post_id, 'access.request.denied', [
            'email' => $data['email'],
            'token' => $token,
        ]);

        // Optional denial email
        $send_denial = apply_filters('wpsg_send_denial_email', true);
        if ($send_denial) {
            $site_name      = get_bloginfo('name');
            $campaign_title = get_the_title($post_id) ?: 'Campaign #' . $post_id;
            wp_mail(
                $data['email'],
                sprintf('[%s] Access Request Update — %s', $site_name, $campaign_title),
                sprintf(
                    "Hello,\n\nUnfortunately your access request for \"%s\" has not been approved at this time.\n\nThank you,\n%s",
                    $campaign_title,
                    $site_name
                )
            );
        }

        return new WP_REST_Response(['message' => 'Access request denied'], 200);
    }

    /**
     * List all companies with their campaign counts and statistics
     */
    public static function list_company_access($request) {
        $start = microtime(true);
        $term_id = intval($request->get_param('id'));
        $include_campaigns = $request->get_param('include_campaigns') === 'true';

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        // Get company-level grants
        $company_grants = get_term_meta($term_id, 'access_grants', true);
        $company_grants = is_array($company_grants) ? $company_grants : [];

        // Mark each grant with its source
        $all_grants = array_map(function ($entry) use ($term) {
            $entry['source'] = 'company';
            $entry['companyId'] = $term->term_id;
            $entry['companyName'] = $term->name;
            return $entry;
        }, $company_grants);

        // If requested, also include campaign-level grants for all campaigns under this company
        if ($include_campaigns) {
            $campaigns = get_posts([
                'post_type' => 'wpsg_campaign',
                'posts_per_page' => -1,
                'tax_query' => [
                    [
                        'taxonomy' => 'wpsg_company',
                        'field' => 'term_id',
                        'terms' => $term_id,
                    ],
                ],
            ]);

            $campaign_ids = array_map(function ($campaign) {
                return intval($campaign->ID);
            }, $campaigns);

            $campaign_meta = self::get_campaign_meta_maps($campaign_ids);
            $campaign_grants_map = $campaign_meta['grants'];
            $campaign_status_map = $campaign_meta['status'];

            foreach ($campaigns as $campaign) {
                $campaign_id = intval($campaign->ID);
                $campaign_grants = $campaign_grants_map[$campaign_id] ?? [];

                foreach ($campaign_grants as $entry) {
                    $entry['source'] = 'campaign';
                    $entry['campaignId'] = $campaign_id;
                    $entry['campaignTitle'] = $campaign->post_title;
                    $entry['campaignStatus'] = $campaign_status_map[$campaign_id] ?? 'active';
                    $all_grants[] = $entry;
                }
            }
        }

        // P28-F: paginate before enrichment.
        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total      = count($all_grants);
        $page_slice = array_slice($all_grants, $offset, $per_page);

        $user_ids = array_unique(array_filter(array_map(function ($entry) {
            return intval($entry['userId'] ?? 0);
        }, $page_slice)));

        $user_map = [];
        if (!empty($user_ids)) {
            $users = get_users(['include' => $user_ids, 'fields' => ['ID', 'user_email', 'display_name', 'user_login']]);
            foreach ($users as $user) {
                $user_map[$user->ID] = [
                    'displayName' => $user->display_name,
                    'email' => $user->user_email,
                    'login' => $user->user_login,
                ];
            }
        }

        $enriched = array_map(function ($entry) use ($user_map) {
            $user_id = intval($entry['userId'] ?? 0);
            if (isset($user_map[$user_id])) {
                $entry['user'] = $user_map[$user_id];
            }
            // P33-B: normalize legacy grants that pre-date RBAC.
            $entry['access_level'] = self::validate_access_level($entry['access_level'] ?? 'viewer');
            return $entry;
        }, $page_slice);

        $response = self::paginated_response($enriched, $total, $page, $per_page);
        self::log_slow_rest('companies.access', $start, [
            'companyId' => $term_id,
            'entries' => $total,
            'includeCampaigns' => $include_campaigns,
        ]);
        return $response;
    }

    /**
     * Grant company-wide access to a user
     */
    public static function grant_company_access($request) {
        $term_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }

        // P28-B: optional expiry.
        $expires_at_raw = $request->get_param('expires_at');
        $expires_at = null;
        if ($expires_at_raw !== null && $expires_at_raw !== '') {
            $ts = strtotime(sanitize_text_field($expires_at_raw));
            if ($ts === false) {
                return new WP_Error('wpsg_invalid_expires_at', 'expires_at must be a valid ISO 8601 datetime', ['status' => 400]);
            }
            $expires_at = gmdate('c', $ts);
        }

        // P33-B: access_level for RBAC.
        $access_level = self::validate_access_level($request->get_param('access_level') ?? 'viewer');

        $grants = get_term_meta($term_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];

        $entry = [
            'userId'       => $user_id,
            'companyId'    => $term_id,
            'source'       => 'company',
            'grantedAt'    => gmdate('c'),
            'expires_at'   => $expires_at,
            'access_level' => $access_level,
        ];

        $grants = self::upsert_grant($grants, $entry);
        update_term_meta($term_id, 'access_grants', $grants);

        // Get first campaign for audit log (if any)
        $campaigns = get_posts([
            'post_type' => 'wpsg_campaign',
            'posts_per_page' => 1,
            'tax_query' => [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'term_id',
                    'terms' => $term_id,
                ],
            ],
        ]);

        if (!empty($campaigns)) {
            self::add_audit_entry($campaigns[0]->ID, 'access.company.granted', [
                'userId' => $user_id,
                'companyId' => $term_id,
                'companyName' => $term->name,
            ]);
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Company access granted'], 200);
    }

    /**
     * Revoke company-wide access for a user
     */
    public static function revoke_company_access($request) {
        $term_id = intval($request->get_param('id'));
        $user_id = intval($request->get_param('userId'));

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        if ($user_id <= 0) {
            return new WP_Error('wpsg_missing_user_id', 'userId is required', ['status' => 400]);
        }

        $grants = get_term_meta($term_id, 'access_grants', true);
        $grants = is_array($grants) ? $grants : [];
        $grants = array_values(array_filter($grants, function ($entry) use ($user_id) {
            return intval($entry['userId'] ?? 0) !== $user_id;
        }));
        update_term_meta($term_id, 'access_grants', $grants);

        // Get first campaign for audit log (if any)
        $campaigns = get_posts([
            'post_type' => 'wpsg_campaign',
            'posts_per_page' => 1,
            'tax_query' => [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'term_id',
                    'terms' => $term_id,
                ],
            ],
        ]);

        if (!empty($campaigns)) {
            self::add_audit_entry($campaigns[0]->ID, 'access.company.revoked', [
                'userId' => $user_id,
                'companyId' => $term_id,
                'companyName' => $term->name,
            ]);
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response(['message' => 'Company access revoked'], 200);
    }

    /**
     * Archive all campaigns under a company
     */
    public static function archive_company($request) {
        $term_id = intval($request->get_param('id'));
        $revoke_access = $request->get_param('revokeAccess') === true || $request->get_param('revokeAccess') === 'true';

        $term = get_term($term_id, 'wpsg_company');
        if (!$term || is_wp_error($term)) {
            return new WP_Error('wpsg_company_not_found', 'Company not found', ['status' => 404]);
        }

        // Get all non-archived campaigns for this company
        $campaigns = get_posts([
            'post_type' => 'wpsg_campaign',
            'posts_per_page' => -1,
            'meta_query' => [
                [
                    'key' => 'status',
                    'value' => 'archived',
                    'compare' => '!=',
                ],
            ],
            'tax_query' => [
                [
                    'taxonomy' => 'wpsg_company',
                    'field' => 'term_id',
                    'terms' => $term_id,
                ],
            ],
        ]);

        $archived_count = 0;
        foreach ($campaigns as $campaign) {
            update_post_meta($campaign->ID, 'status', 'archived');
            self::add_audit_entry($campaign->ID, 'campaign.archived', [
                'bulkAction' => true,
                'companyId' => $term_id,
                'companyName' => $term->name,
            ]);
            $archived_count++;
        }

        // Optionally revoke company-level access grants
        if ($revoke_access) {
            update_term_meta($term_id, 'access_grants', []);
            if (!empty($campaigns)) {
                self::add_audit_entry($campaigns[0]->ID, 'access.company.bulk_revoked', [
                    'companyId' => $term_id,
                    'companyName' => $term->name,
                ]);
            }
        }

        self::clear_accessible_campaigns_cache();
        return new WP_REST_Response([
            'message' => "Archived {$archived_count} campaigns",
            'archivedCount' => $archived_count,
            'accessRevoked' => $revoke_access,
        ], 200);
    }

    private static function get_campaign_meta_maps($campaign_ids) {
        $campaign_ids = array_values(array_filter(array_map('intval', $campaign_ids)));
        if (empty($campaign_ids)) {
            return [
                'grants' => [],
                'status' => [],
            ];
        }

        global $wpdb;
        $placeholders = implode(', ', array_fill(0, count($campaign_ids), '%d'));
        $params = array_merge($campaign_ids, ['access_grants', 'status']);
        $sql = $wpdb->prepare(
            "SELECT post_id, meta_key, meta_value FROM {$wpdb->postmeta} WHERE post_id IN ({$placeholders}) AND meta_key IN (%s, %s)",
            $params
        );

        $rows = $wpdb->get_results($sql); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared -- $sql is $wpdb->prepare() output with %d/%s placeholders + params.
        $grants = [];
        $status = [];

        foreach ($rows as $row) {
            $post_id = intval($row->post_id);
            if ($row->meta_key === 'access_grants') {
                $value = maybe_unserialize($row->meta_value);
                $grants[$post_id] = is_array($value) ? $value : [];
            } elseif ($row->meta_key === 'status') {
                $status_value = is_string($row->meta_value) && $row->meta_value !== '' ? $row->meta_value : 'active';
                $status[$post_id] = $status_value;
            }
        }

        return [
            'grants' => $grants,
            'status' => $status,
        ];
    }

    private static function upsert_grant($grants, $entry) {
        $user_id = intval($entry['userId']);
        $filtered = array_filter($grants, function ($item) use ($user_id) {
            return intval($item['userId'] ?? 0) !== $user_id;
        });
        $filtered[] = $entry;
        return array_values($filtered);
    }

    private static function upsert_override($overrides, $entry) {
        $user_id = intval($entry['userId']);
        $filtered = array_filter($overrides, function ($item) use ($user_id) {
            return intval($item['userId'] ?? 0) !== $user_id;
        });
        $filtered[] = $entry;
        return array_values($filtered);
    }

    public static function access_summary($request) {
        global $wpdb;

        $per_page = max(1, min(100, intval($request->get_param('per_page') ?: 50)));
        $page     = max(1, intval($request->get_param('page') ?: 1));
        $offset   = ($page - 1) * $per_page;

        $space_param  = sanitize_text_field($request->get_param('space') ?? '');
        $space_id     = (is_numeric($space_param) && intval($space_param) > 0) ? intval($space_param) : 0;
        $space_join   = $space_id > 0
            ? $wpdb->prepare(
                " INNER JOIN {$wpdb->postmeta} pm_space ON (pm_space.post_id = p.ID AND pm_space.meta_key = '_wpsg_space_id' AND pm_space.meta_value = %d)",
                $space_id
            )
            : '';
        // Count all campaigns (any post_status that "exists").
        if ($space_id > 0) {
            $total = intval($wpdb->get_var(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p{$space_join} WHERE p.post_type = 'wpsg_campaign' AND p.post_status NOT IN ('trash','auto-draft')"
            ));
        } else {
            $total = intval($wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'wpsg_campaign' AND post_status NOT IN ('trash','auto-draft')"
            ));
        }

        $total_pages = max(1, (int) ceil($total / $per_page));

        // Fetch this page of campaigns.
        if ($space_id > 0) {
            $ids = $wpdb->get_col($wpdb->prepare(
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                "SELECT DISTINCT p.ID FROM {$wpdb->posts} p{$space_join}
                 WHERE p.post_type = 'wpsg_campaign'
                   AND p.post_status NOT IN ('trash','auto-draft')
                 ORDER BY p.post_title ASC
                 LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ));
        } else {
            $ids = $wpdb->get_col($wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts}
                 WHERE post_type = 'wpsg_campaign'
                   AND post_status NOT IN ('trash','auto-draft')
                 ORDER BY post_title ASC
                 LIMIT %d OFFSET %d",
                $per_page,
                $offset
            ));
        }

        if (empty($ids)) {
            return new WP_REST_Response([
                'items'      => [],
                'page'       => $page,
                'perPage'    => $per_page,
                'total'      => $total,
                'totalPages' => $total_pages,
            ], 200);
        }

        // Batch-load post meta to avoid N+1 queries.
        update_meta_cache('post', $ids);

        // Load titles in one query.
        $id_placeholders = implode(',', array_fill(0, count($ids), '%d'));
        // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        $posts = $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_title FROM {$wpdb->posts} WHERE ID IN ({$id_placeholders})",
            ...$ids
        ), ARRAY_A);
        $title_map = array_column($posts, 'post_title', 'ID');

        // Pending request counts for these campaigns in one SQL query.
        $pending_map = [];
        $table       = WPSG_DB::get_access_requests_table();
        // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.UnfinishedPrepare
        $pending_rows = $wpdb->get_results($wpdb->prepare(
            "SELECT campaign_id, COUNT(*) AS cnt FROM {$table}
             WHERE status = 'pending' AND campaign_id IN ({$id_placeholders})
             GROUP BY campaign_id",
            ...$ids
        ), ARRAY_A);
        foreach ($pending_rows as $row) {
            $pending_map[intval($row['campaign_id'])] = intval($row['cnt']);
        }

        $now   = time();
        $items = [];
        foreach ($ids as $id) {
            $id    = intval($id);
            $grants = get_post_meta($id, 'access_grants', true);
            $grants = is_array($grants) ? $grants : [];

            // Count only non-expired grants.
            $active_count = 0;
            foreach ($grants as $grant) {
                if (!empty($grant['expires_at']) && strtotime($grant['expires_at']) < $now) {
                    continue;
                }
                if (!empty($grant['userId'])) {
                    $active_count++;
                }
            }

            $items[] = [
                'id'                  => $id,
                'title'               => $title_map[$id] ?? '',
                'grantCount'          => $active_count,
                'pendingRequestCount' => $pending_map[$id] ?? 0,
                'capacity'            => null,
            ];
        }

        return new WP_REST_Response([
            'items'      => $items,
            'page'       => $page,
            'perPage'    => $per_page,
            'total'      => $total,
            'totalPages' => $total_pages,
        ], 200);
    }

    /**
     * Public read-only endpoint for rendering (no auth, ID-based only).
     */
}
