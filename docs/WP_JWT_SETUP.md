# WP JWT Plugin Setup

This guide explains how to configure the "JWT Authentication for WP REST API" plugin for WP Super Gallery.

---

## 1) Install & Activate

1. In WordPress Admin, go to **Plugins → Add New**.
2. Search for **JWT Authentication for WP REST API**.
3. Install and activate the plugin.

---

## 2) Configure JWT Secret

Add the following to your `wp-config.php`:

```php
define('JWT_AUTH_SECRET_KEY', 'replace-with-a-strong-secret');
```

Use a long random string (32+ chars). Do not commit this secret to source control.

**Clarification:** This secret is defined by you in `wp-config.php` (it is not provided by the plugin). The plugin reads this value to sign and verify JWTs used by your app.

---

## 3) Enable CORS (if SPA runs on a different origin)

If your SPA runs on a different domain/port than WordPress, add this to `wp-config.php`:

```php
define('JWT_AUTH_CORS_ENABLE', true);
```

For stricter control, configure allowed origins in your web server (recommended for production).

**Clarification:** If the app is served from the same WordPress origin, you typically do **not** need to enable CORS.

**More detail on CORS in this context:**

- **Same origin (no CORS needed):**
  - The SPA is served from the same scheme, host, and port as WordPress.
  - Examples: `https://example.com` serves both WP and the SPA, or WP hosts the SPA assets.
- **Different origin (CORS needed):**
  - The SPA runs on a different scheme, host, or port.
  - Examples: `http://localhost:5173` → `http://localhost:8080`, or `https://app.example.com` → `https://wp.example.com`.
- **Subdomains (CORS needed):**
  - Even if both are HTTPS, subdomains are different origins.
- **Server‑to‑server calls (CORS not applicable):**
  - CORS is a browser restriction only. If a backend server calls WP directly, CORS doesn’t apply.

**Development note:**

- Local dev commonly hits CORS when the SPA runs on `localhost:5173` and WP runs on a different port or host. Enable CORS for dev or proxy the API through the SPA dev server.

---

## 4) Verify Token Endpoint

Use this endpoint to obtain a JWT:

- `POST /wp-json/jwt-auth/v1/token`

Example payload:

```json
{
  "username": "admin@example.com",
  "password": "your_password"
}
```

Expected response includes:

- `token`
- `user_email`
- `user_id`

**Clarification:** You can test this endpoint with Postman or Bruno using the JSON payload above.

---

## 5) Use Token with WP Super Gallery

Pass the JWT in the `Authorization` header:

```text
Authorization: Bearer <token>
```

The app will use this to call:

- `/wp-json/wp-super-gallery/v1/permissions`
- other admin endpoints

---

## 6) Security Considerations

### Token Storage

**Important:** The WP Super Gallery app stores JWT tokens **in memory only**, not in localStorage or cookies. This provides the following security benefits:

- **XSS Protection**: Even if an attacker injects malicious JavaScript, they cannot steal credentials from localStorage.
- **Automatic Expiration**: Tokens are automatically cleared when the user closes the tab or refreshes the page.
- **Reduced Attack Surface**: No persistent storage means fewer opportunities for token theft.

**Trade-offs:**

- Users must re-authenticate after page refresh or when opening a new tab.
- This is a deliberate security choice prioritizing protection over convenience.

### XSS Protection Requirements

While in-memory token storage mitigates localStorage-based XSS attacks, your application must still implement comprehensive XSS protection:

1. **Content Security Policy (CSP)**: Configure strict CSP headers to prevent script injection.
2. **Input Validation**: Sanitize all user inputs on both client and server side.
3. **Output Encoding**: Properly encode data before rendering in the DOM.
4. **Dependency Management**: Keep all dependencies up-to-date to patch known vulnerabilities.

**WordPress-specific recommendations:**

- Use WordPress escaping functions: `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses()`.
- Enable WordPress security headers via plugins or web server configuration.
- Regularly update WordPress core, plugins, and themes.

### Token Validation

The app validates tokens before use:

- Expiration is checked before every API call that uses the token.
- Expired tokens trigger automatic logout.
- Malformed tokens are rejected during login.

---

## 7) Troubleshooting

- **401 Unauthorized**: Ensure the secret key is set and the token endpoint works.
- **CORS errors**: Ensure CORS is enabled for your SPA origin.
- **Token endpoint missing**: Verify the JWT plugin is installed and activated.

---

## 8) Apache + WordPress Requirements (JWT)

Some Apache setups require explicit authorization header forwarding for JWT.

1. Add this to the top of your `.htaccess` (before `# BEGIN WordPress`):

```apache
<IfModule mod_rewrite.c>
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
</IfModule>
```

1. Ensure Apache `mod_rewrite` is enabled:

```bash
sudo a2query -m rewrite
sudo a2enmod rewrite
sudo systemctl restart apache2
```

---

Document created: January 21, 2026.

