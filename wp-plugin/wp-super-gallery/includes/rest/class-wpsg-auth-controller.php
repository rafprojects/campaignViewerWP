<?php

if (!defined('ABSPATH')) {
    exit;
}

class WPSG_Auth_Controller extends WPSG_REST_Base {

    public static function register_routes(): void {
        register_rest_route('wp-super-gallery/v1', '/permissions', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_permissions'],
                'permission_callback' => [self::class, 'require_authenticated'],
            ],
        ]);

        // P20-K: Lightweight nonce refresh endpoint for long-running tabs.
        // Returns a fresh wp_rest nonce so the client can update its header
        // without a full page reload. Requires existing valid cookie auth.
        register_rest_route('wp-super-gallery/v1', '/nonce', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'refresh_nonce'],
                'permission_callback' => [self::class, 'require_authenticated'],
            ],
        ]);

        // P20-K: Cookie-based login endpoint so the React LoginForm modal works
        // without JWT and without redirecting to wp-login.php.
        register_rest_route('wp-super-gallery/v1', '/auth/login', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'handle_cookie_login'],
                'permission_callback' => '__return_true',
                'args'                => [
                    'username' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'password' => [
                        'required'          => true,
                        'type'              => 'string',
                    ],
                    'remember' => [
                        'type'    => 'boolean',
                        'default' => false,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/auth/logout', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'handle_cookie_logout'],
                'permission_callback' => [self::class, 'require_authenticated'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/users/search', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'search_users'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/users', [
            [
                'methods'             => 'POST',
                'callback'            => [self::class, 'create_user'],
                'permission_callback' => [self::class, 'rate_limit_authenticated'],
                'args'                => [
                    'email'       => [
                        'required'          => true,
                        'type'              => 'string',
                        'format'            => 'email',
                        'sanitize_callback' => 'sanitize_email',
                    ],
                    'displayName' => [
                        'required'          => true,
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'role'        => [
                        'type'    => 'string',
                        'enum'    => ['subscriber', 'wpsg_admin'],
                        'default' => 'subscriber',
                    ],
                    'campaignId'  => [
                        'type'    => 'integer',
                        'minimum' => 1,
                    ],
                ],
            ],
        ]);

        register_rest_route('wp-super-gallery/v1', '/roles', [
            [
                'methods' => 'GET',
                'callback' => [self::class, 'list_roles'],
                'permission_callback' => [self::class, 'require_admin'],
            ],
        ]);
    }

    public static function list_permissions() {
        $user_id = get_current_user_id();
        if (!$user_id) {
            return new WP_REST_Response(['campaignIds' => [], 'isAdmin' => false], 200);
        }

        $campaign_ids = self::get_accessible_campaign_ids($user_id);
        $is_admin = current_user_can('manage_wpsg');
        $user = get_user_by('id', $user_id);

        // P20-K: Include userId and userEmail so the nonce-only auth path
        // (no JWT provider) can detect the current user without localStorage.
        return new WP_REST_Response([
            'campaignIds' => $campaign_ids,
            'isAdmin'     => $is_admin,
            'userId'      => $user_id,
            'userEmail'   => $user ? $user->user_email : '',
        ], 200);
    }

    /**
     * Return a fresh wp_rest nonce for long-running browser tabs.
     *
     * The client's useNonceHeartbeat hook calls this endpoint periodically
     * to refresh its X-WP-Nonce before the default 24-hour expiry window.
     *
     * @since 0.18.0 P20-K
     * @return WP_REST_Response
     */
    public static function refresh_nonce() {
        return new WP_REST_Response([
            'nonce' => wp_create_nonce('wp_rest'),
        ], 200);
    }

    /**
     * Cookie-based login via wp_signon().
     *
     * Allows the React LoginForm modal to authenticate without JWT and
     * without redirecting to wp-login.php. On success the response sets
     * the WordPress auth cookie (HttpOnly, same-origin) and returns a
     * fresh wp_rest nonce so the client can make authenticated REST
     * requests immediately.
     *
     * Rate-limited via rate_limit_public (default 60 req/min).
     *
     * @since 0.18.0 P20-K
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public static function handle_cookie_login($request) {
        // Rate-limit like any public endpoint.
        $rate_check = self::rate_limit_public($request);
        if (is_wp_error($rate_check)) {
            return $rate_check;
        }

        // CSRF protection: verify Origin or Referer header matches the site URL.
        // Without this, an attacker could craft a cross-origin form POST that
        // logs a victim into an attacker-controlled account (login CSRF).
        $site_host = wp_parse_url(home_url(), PHP_URL_HOST);
        $origin    = isset($_SERVER['HTTP_ORIGIN']) ? wp_parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST) : '';
        $referer   = isset($_SERVER['HTTP_REFERER']) ? wp_parse_url($_SERVER['HTTP_REFERER'], PHP_URL_HOST) : '';
        if ( $origin !== $site_host && $referer !== $site_host ) {
            return new WP_REST_Response([
                'code'    => 'csrf_failed',
                'message' => 'Cross-origin login requests are not allowed.',
            ], 403);
        }

        $username = $request->get_param('username');
        $password = $request->get_param('password');
        $remember = (bool) $request->get_param('remember');

        $creds = [
            'user_login'    => $username,
            'user_password' => $password,
            'remember'      => $remember,
        ];

        // Capture the new logged-in cookie into $_COOKIE within this request.
        // wp_set_auth_cookie() (called by wp_signon) sends Set-Cookie headers
        // to the browser but does NOT update the $_COOKIE superglobal. Without
        // this, wp_create_nonce('wp_rest') generates a nonce tied to the wrong
        // session token, causing "Cookie check failed" 403s on subsequent calls.
        add_action('set_logged_in_cookie', static function ($cookie_value) {
            $_COOKIE[ LOGGED_IN_COOKIE ] = $cookie_value;
        });

        // wp_signon() validates credentials and sets the auth cookie via Set-Cookie headers.
        $user = wp_signon($creds, is_ssl());

        if (is_wp_error($user)) {
            // Fire the standard hook so brute-force plugins can act.
            /** This action is documented in wp-includes/user.php */
            do_action('wp_login_failed', $username, $user);

            self::add_audit_entry(0, 'auth.login_failed', [
                'login' => sanitize_text_field($username ?? ''),
            ], [
                'scope'         => 'system',
                'severity'      => 'warning',
                'summary'       => 'Failed login attempt: ' . sanitize_text_field($username ?? '(unknown)'),
                'resource_type' => 'user',
            ]);

            return new WP_REST_Response([
                'code'    => 'invalid_credentials',
                'message' => 'Invalid username or password.',
            ], 401);
        }

        // Explicitly set the current user so subsequent calls
        // (wp_create_nonce, current_user_can, etc.) work in this request.
        wp_set_current_user($user->ID);

        self::add_audit_entry(0, 'auth.login_success', [
            'userId' => $user->ID,
            'login'  => $user->user_login,
        ], [
            'scope'          => 'system',
            'summary'        => "Login: {$user->user_login}",
            'resource_type'  => 'user',
            'resource_id'    => (string) $user->ID,
            'resource_label' => $user->user_login,
        ]);

        $is_admin = current_user_can('manage_wpsg');
        $campaign_ids = self::get_accessible_campaign_ids($user->ID);

        return new WP_REST_Response([
            'user'        => [
                'id'    => (string) $user->ID,
                'email' => $user->user_email,
                'role'  => $is_admin ? 'admin' : 'viewer',
            ],
            'permissions' => $campaign_ids,
            'isAdmin'     => $is_admin,
            'nonce'       => wp_create_nonce('wp_rest'),
        ], 200);
    }

    /**
     * Cookie-based logout. Clears WordPress auth cookies and destroys
     * the session. Returns a guest-level nonce for subsequent requests.
     *
     * @since 0.18.0 P20-K
     * @return WP_REST_Response
     */
    public static function handle_cookie_logout() {
        $logout_user    = wp_get_current_user();
        $logout_user_id = $logout_user->ID ?? 0;
        $logout_login   = $logout_user->user_login ?? '';

        if ($logout_user_id > 0) {
            self::add_audit_entry(0, 'auth.logout', [
                'userId' => $logout_user_id,
                'login'  => $logout_login,
            ], [
                'scope'          => 'system',
                'summary'        => "Logout: {$logout_login}",
                'resource_type'  => 'user',
                'resource_id'    => (string) $logout_user_id,
                'resource_label' => $logout_login,
            ]);
        }

        wp_logout();

        // wp_logout() calls wp_clear_auth_cookie() which sends Set-Cookie
        // headers to expire browser cookies, but $_COOKIE still holds the old
        // values within this request. Clear them so wp_create_nonce('wp_rest')
        // generates a valid guest-level nonce (UID 0, empty session token).
        $_COOKIE[ LOGGED_IN_COOKIE ]  = ' ';
        $_COOKIE[ AUTH_COOKIE ]       = ' ';
        $_COOKIE[ SECURE_AUTH_COOKIE ] = ' ';

        return new WP_REST_Response([
            'loggedOut' => true,
            'nonce'     => wp_create_nonce('wp_rest'),
        ], 200);
    }

    /**
     * Search WordPress users for the access management UI.
     * Returns matching users with id, email, and display name.
     *
     * @return WP_REST_Response List of matching users.
     */
    public static function search_users($request) {
        $search = sanitize_text_field($request->get_param('search') ?? '');
        $per_page = min(intval($request->get_param('per_page') ?? 20), 50);

        $args = [
            'number' => $per_page,
            'orderby' => 'display_name',
            'order' => 'ASC',
        ];

        if (!empty($search)) {
            $args['search'] = '*' . $search . '*';
            $args['search_columns'] = ['user_login', 'user_email', 'display_name'];
        }

        $user_query = new WP_User_Query($args);
        $users = [];

        foreach ($user_query->get_results() as $user) {
            $users[] = [
                'id' => $user->ID,
                'email' => $user->user_email,
                'displayName' => $user->display_name,
                'login' => $user->user_login,
                'isAdmin' => user_can($user->ID, 'manage_wpsg'),
            ];
        }

        return new WP_REST_Response([
            'users' => $users,
            'total' => $user_query->get_total(),
        ], 200);
    }

    /**
     * Create a new WordPress user.
     * Sends password setup email to the user.
     *
     * @return WP_REST_Response User creation result.
     */
    public static function create_user($request) {
        $email = sanitize_email($request->get_param('email') ?? '');
        $display_name = sanitize_text_field($request->get_param('displayName') ?? '');
        $role = sanitize_text_field($request->get_param('role') ?? 'subscriber');
        $campaign_id = intval($request->get_param('campaignId') ?? 0);

        // Validate required fields
        if (empty($email) || !is_email($email)) {
            return new WP_Error('wpsg_invalid_email', 'Valid email is required.', ['status' => 400]);
        }

        if (empty($display_name)) {
            return new WP_Error('wpsg_missing_display_name', 'Display name is required.', ['status' => 400]);
        }

        // Check if email already exists
        if (email_exists($email)) {
            return new WP_Error('wpsg_user_exists', 'A user with this email already exists.', ['status' => 409]);
        }

        // Validate role exists and prevent privilege escalation
        $allowed_roles = ['subscriber', 'wpsg_admin'];
        if (!in_array($role, $allowed_roles, true)) {
            return new WP_Error('wpsg_invalid_role', 'Invalid role. Allowed: subscriber, wpsg_admin.', ['status' => 400]);
        }

        // Generate username from email (before @)
        $username = sanitize_user(explode('@', $email)[0], true);
        $base_username = $username;
        $counter = 1;
        while (username_exists($username)) {
            $username = $base_username . $counter;
            $counter++;
        }

        // Generate temporary password (required by WordPress, but user will set their own via reset link)
        // This password is never exposed or used - it's immediately superseded by the password reset flow
        $password = wp_generate_password(24, true, true);

        // Create user account
        $user_id = wp_insert_user([
            'user_login' => $username,
            'user_email' => $email,
            'user_pass' => $password,
            'display_name' => $display_name,
            'role' => $role,
        ]);

        if (is_wp_error($user_id)) {
            return new WP_Error('wpsg_internal_error', $user_id->get_error_message(), ['status' => 500]);
        }

        // Send password reset email so user can set their own password
        // Note: wp_new_user_notification() with 'user' param sends a password reset link, not the password
        $email_sent = false;

        // Allow testing email failure scenario via request param (debug only)
        $simulate_email_failure = false;
        if (defined('WP_DEBUG') && WP_DEBUG) {
            $simulate_param = $request->get_param('simulateEmailFailure');
            $simulate_email_failure = ($simulate_param === true || $simulate_param === 'true');
        }

        if (!$simulate_email_failure) {
            try {
                // Send password reset email to user
                wp_new_user_notification($user_id, null, 'user');
                $email_sent = true;
            } catch (Exception $e) {
                $email_sent = false;
            }
        }

        // If campaign_id provided, grant access
        $access_granted = false;
        if ($campaign_id > 0 && self::campaign_exists($campaign_id)) {
            $grants = get_post_meta($campaign_id, 'access_grants', true);
            if (!is_array($grants)) {
                $grants = [];
            }
            // Check if not already granted
            $already_granted = false;
            foreach ($grants as $grant) {
                if (isset($grant['userId']) && intval($grant['userId']) === $user_id) {
                    $already_granted = true;
                    break;
                }
            }
            if (!$already_granted) {
                $grants[] = [
                    'userId' => $user_id,
                    'grantedAt' => current_time('mysql'),
                    'grantedBy' => get_current_user_id(),
                ];
                update_post_meta($campaign_id, 'access_grants', $grants);
                self::add_audit_entry($campaign_id, 'access.granted', [
                    'userId' => $user_id,
                    'email' => $email,
                    'source' => 'quick_add_user',
                ]);
                self::clear_accessible_campaigns_cache();
                $access_granted = true;
            }
        }

        // Add audit entry for user creation
        if ($campaign_id > 0) {
            self::add_audit_entry($campaign_id, 'user.created', [
                'userId' => $user_id,
                'email' => $email,
                'role' => $role,
            ]);
        }

        $response = [
            'message' => 'User created successfully.',
            'userId' => $user_id,
            'username' => $username,
            'email' => $email,
            'emailSent' => $email_sent,
            'accessGranted' => $access_granted,
        ];

        // If email failed, generate password reset link instead of exposing password
        if (!$email_sent) {
            // Generate a password reset key
            $reset_key = get_password_reset_key(new WP_User($user_id));

            if (!is_wp_error($reset_key)) {
                // Build password reset URL
                $reset_url = network_site_url("wp-login.php?action=rp&key=$reset_key&login=" . rawurlencode($username), 'login');

                $response['resetUrl'] = $reset_url;
                $response['message'] = 'User created but email failed. Use the password reset link to set up the account.';
                $response['emailFailed'] = true;
            } else {
                // If reset key generation also fails, we have a bigger problem
                $response['message'] = 'User created but email and password reset failed. Please use WordPress admin to reset password.';
                $response['emailFailed'] = true;
                $response['resetFailed'] = true;
            }
        }

        return new WP_REST_Response($response, 201);
    }

    /**
     * List available roles for user creation.
     *
     * @return WP_REST_Response Available roles.
     */
    public static function list_roles($request) {
        // Only return roles that can be assigned via quick add
        $roles = [
            [
                'value' => 'subscriber',
                'label' => 'Viewer',
                'description' => 'Can view campaigns they are granted access to.',
            ],
            [
                'value' => 'wpsg_admin',
                'label' => 'Gallery Admin',
                'description' => 'Can manage campaigns and access in this plugin, but not WordPress admin.',
            ],
        ];

        // P28-F: paginated shape for consistency.
        [$page, $per_page, $offset] = self::parse_pagination($request);
        $total      = count($roles);
        $page_items = array_slice($roles, $offset, $per_page);

        return self::paginated_response($page_items, $total, $page, $per_page);
    }

}
