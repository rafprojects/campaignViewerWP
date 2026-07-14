# WP Super Gallery — Privacy & GDPR Statement

**Applies to:** WP Super Gallery plugin, all editions (free and Pro).
**Last reviewed:** 2026-07-11 (plugin 0.90.0; added Freemius Pro-licensing §8)

This document describes exactly what data the plugin collects, where it is stored,
whether any of it leaves your server, and how to satisfy data-subject (GDPR/CCPA)
requests. It is written for the **site owner** who installs the plugin — you are the
data controller for any personal data your visitors submit; the plugin is a
processor running entirely on your own WordPress hosting.

> **Summary in one line:** WP Super Gallery stores its data in your own WordPress
> database and sends **nothing to us or any analytics service**. The only personal
> data it can hold is (a) pseudonymized visitor counts *if you turn analytics on*
> and (b) email addresses *if you enable the access-request feature*. Both are
> off by default.
>
> _Pro edition:_ the plugin's own code still sends us nothing, but the paid build bundles the
> **Freemius** licensing SDK — checkout/billing runs through Freemius, and diagnostic sharing is
> **opt-in** during activation. See **§8**.

---

## 1. What personal data the plugin can store

All data lives in your site's own MySQL/MariaDB database and `wp-content/uploads`.
Nothing below is transmitted to the plugin author.

| Data | Where | When it's collected | Personal? |
|------|-------|--------------------|-----------|
| **Pseudonymized visitor hash** | `wp_wpsg_analytics_events.visitor_hash` | Only when **Analytics is enabled** (off by default) and a visitor views/opens a gallery | Pseudonymized — see §2 |
| **Requester email address** | `wp_wpsg_access_requests.email` | Only when a visitor submits an **access request** for a private campaign | **Yes — direct PII** |
| **Admin/editor username & user ID** | `wp_wpsg_audit_log` (`actor_login`, `actor_id`, `details`) | When a logged-in admin/editor performs an auditable action, or on a failed login attempt (the attempted username is recorded) | Yes — but only your own staff / login attempts |
| **Access grants by user ID** | Campaign postmeta / company term-meta (`access_grants`) | When you grant a WordPress user access to a campaign or company | By reference (WP user ID) |
| **UI preferences** | Browser `localStorage` (see §4) | As the admin/visitor uses the UI | No |

**Not collected anywhere:** raw IP addresses (see §2), user-agent strings, referrers,
device fingerprints, geolocation. The plugin sets **no tracking cookies** of its own.

---

## 2. Analytics — how visitor counting works (and why it's privacy-preserving)

- Analytics is **disabled by default** (`enable_analytics = false`). No analytics rows
  are written until you explicitly enable it in **Settings → Advanced**.
- When enabled, each gallery view or lightbox-open records only: the campaign ID, the
  event type, an optional media ID, a timestamp, and a **`visitor_hash`**.
- The `visitor_hash` is a **salted SHA-256** of the visitor's IP address
  (`sha256( IP + wp_salt('auth') )`). **The raw IP address is never written to the
  database** — only the irreversible hash is stored, and only for the purpose of
  approximate unique-visitor counts.
- No referrer, user-agent, cookie, or logged-in identity is recorded with an analytics
  event.

**Honest limitations to be aware of:**
- The hash uses your site's static `auth` salt, so the same IP always produces the same
  hash. That's what enables "unique visitors" counts — but it also means the hash is a
  *stable pseudonym*, not fully anonymous data. For a small (IPv4) address space a
  determined party with database access and the salt could attempt to correlate a hash
  back to an IP. Treat the analytics table as pseudonymized personal data under GDPR.
- **Retention defaults to "keep forever"** (`analytics_retention_days = 0`). If you
  enable analytics, set a retention window (Settings → Advanced, 1–730 days) so old
  rows are purged automatically by the `wpsg_analytics_purge` cron job.

**Recommendation:** if you enable analytics, (1) set a finite retention period and
(2) mention pseudonymized gallery analytics in your site's own privacy policy.

---

## 3. Data that leaves your server (third parties)

By default, **no personal data leaves your server.** The plugin makes outbound requests
only in these cases, none of which send visitor PII to the plugin author:

- **oEmbed / media providers** (YouTube, Vimeo, etc.): the plugin fetches embed metadata
  *by media URL* from the provider you embedded. These requests contain the media URL and
  your server's own IP — standard for any oEmbed — not your visitors' data.
- **Email (`wp_mail`)**: when the access-request feature is used, the plugin emails the
  site admin (the message includes the requester's email address) and sends the requester
  a confirmation / magic-approval link. Mail is sent through **your own** WordPress mail
  configuration (SMTP/host), not a third-party API.
- **Webhooks (optional, admin-configured)**: if you configure a webhook URL, campaign-event
  payloads are POSTed to *the URL you chose*. Review that payload and endpoint if it could
  include grantee information — it goes wherever you point it.
- **Error monitoring (Sentry) — off by default**: error reporting is inert unless you
  supply a Sentry DSN. If you enable it:
  - The **browser/React** side redacts `Authorization` headers and strips
    `user.ip_address` before sending.
  - The **PHP** side does **not** currently scrub context automatically — only enable a
    server-side DSN if you are comfortable with the error context (which may include
    request details) being sent to your Sentry instance.

The plugin contains **no analytics beacons, telemetry, or "phone-home" to the author.** (The **Pro
edition** additionally bundles the Freemius licensing SDK — a separate, opt-in data flow covered in §8.)

---

## 4. Browser storage (localStorage / cookies)

The plugin sets **no cookies of its own.** Standard WordPress login cookies
(HttpOnly, same-origin) handle authentication in the default configuration.

`localStorage` is used only for UI state and preferences. None of it holds personal data
**except** in the optional JWT-auth mode:

- **Default (cookie/nonce) auth:** no tokens or personal data in `localStorage`.
- **Optional JWT auth** (`WPSG_ENABLE_JWT_AUTH`, off by default): stores an access token
  and a small `{ id, email, role }` profile in `localStorage` under `wpsg_access_token` /
  `wpsg_user` / `wpsg_permissions`. These are cleared on logout. Only enable JWT mode if
  you understand this trade-off.
- **Everything else** (`wpsg_admin_active_tab`, `wpsg_debug`, media/builder/settings view
  preferences, theme id, scroll position) is non-personal UI state.

---

## 5. Data-subject requests (access / erasure / portability)

> **Important:** this version of the plugin does **not** yet integrate with WordPress's
> built-in **Tools → Export/Erase Personal Data** exporters and erasers. Data-subject
> requests are fulfilled **manually** as described here. Automated integration is a
> planned enhancement (see Follow-Ons).

**To locate a person's data:**
- **Access requests (email):** search `wp_wpsg_access_requests` for the address
  (`email` column, indexed). This is the primary place a visitor email is stored.
- **Analytics:** analytics stores only irreversible hashes — you cannot look up an
  individual, and there is no raw IP to return. If asked, you can disclose that only a
  salted hash for counting was stored, and delete the relevant rows by date range.
- **Access grants:** search campaign postmeta / company term-meta `access_grants` for the
  person's WordPress user ID.
- **Audit log:** search `wp_wpsg_audit_log` `actor_login` / `actor_id` / `details` for a
  staff member's username.

**To erase a person's data:**
- Delete the matching row(s) from `wp_wpsg_access_requests` and/or `wp_wpsg_audit_log`,
  and remove their user ID from any `access_grants` entries. WP-CLI or a direct SQL
  `DELETE` (with a backup) is the current path.
- A full site erasure removes everything on **uninstall** — see §6.

**Consent:** the plugin does not present a consent banner. Because analytics is off by
default and stores only pseudonymized hashes, most deployments do not require one; if you
enable analytics or the access-request/email features, disclose them in your own site
privacy policy and obtain consent as your jurisdiction requires.

---

## 6. Retention & deletion

| Data | Automatic cleanup | Action needed |
|------|-------------------|--------------|
| Analytics events | `wpsg_analytics_purge` cron, but **only if** `analytics_retention_days > 0` | Set a retention window; default 0 = never |
| Expired access grants | `wpsg_expired_grants_cleanup` (daily) removes expired grants | None |
| Rate-limit counters | Self-expire via transient TTL; no IP stored | None |
| **Access requests (emails)** | **No automatic purge** | Delete manually / periodically |
| **Audit log (usernames)** | **No automatic purge** | Delete manually / periodically |
| Thumbnail cache | `wpsg_thumbnail_cache` cron cleanup | None |

**On uninstall:** unless you tick **"Preserve data on uninstall"** in Settings, deleting
the plugin drops its custom tables (analytics, access requests, audit log, media refs,
overlays, spaces), removes campaign/layout posts and meta, plugin options, transients,
custom roles/caps, cron hooks, and uploaded overlay/thumbnail directories. Ticking
"Preserve data on uninstall" leaves everything in place for reinstall.

---

## 7. Security posture (context)

- Default authentication uses WordPress's own HttpOnly, same-origin cookies plus REST
  nonces — no bearer tokens in the browser.
- Access-request "magic approval" links store only a **SHA-256 hash** of a 256-bit random
  key in the database; the raw key is emailed, compared with `hash_equals`, expires after
  48 hours, and is single-use.
- SVG uploads are sanitized (server + client) and the overlay directory is hardened with a
  restrictive `.htaccess`.
- The oEmbed proxy enforces a provider allowlist with SSRF protection.

---

## 8. Freemius (Pro edition) — licensing, checkout & opt-in diagnostics

The **free** edition and the plugin's own code send us nothing (§1–§4). The **Pro** edition — and any
build configured with Freemius credentials — additionally bundles the **Freemius** SDK for licensing,
secure updates, and checkout. Freemius acts as our **merchant of record**.

- **Checkout & billing (Freemius):** when you buy or renew a Pro license, **Freemius** collects the data
  needed to sell and support it — e.g. name, email, billing/tax location, and payment details (card data
  is handled by the payment processor, not stored by us). This happens on Freemius's checkout, governed
  by **[Freemius's privacy policy](https://freemius.com/privacy/)**, not by this plugin. We (the seller)
  receive order/license metadata (e.g. your email and license status), not full card numbers.
- **Opt-in diagnostics (Freemius SDK):** on activation the SDK shows an **opt-in** dialog. **Only if you
  opt in**, it shares environment/usage data with Freemius to improve the product — typically the site
  URL, WordPress/PHP versions, plugin version, the admin email, and the list of active plugins/theme. If
  you **skip**, no usage data is sent; the SDK still performs the minimal license-validation and update
  checks the paid features require. You can opt out later, and **deactivating** the license or
  **uninstalling** stops it.
- **Only where credentials are configured:** a build with no Freemius credentials (e.g. the plugin
  before go-live, or a self-hosted copy without a key) makes **zero** Freemius network calls —
  `wpsg_fs()` is a no-op.

Buyer-facing view: [guides/LICENSE_ACTIVATION.md](guides/LICENSE_ACTIVATION.md); commercial terms:
[EULA.md](EULA.md).

---

## Follow-Ons (planned privacy enhancements)

These are known gaps documented for transparency; they are tracked as future work, not
claimed as present features:

1. **WordPress core privacy integration** — register `wp_privacy_personal_data_exporters`
   and `..._erasers` so admins can fulfill DSAR requests from **Tools → Export/Erase
   Personal Data** instead of manual SQL.
2. **Retention jobs for emails & audit log** — optional auto-purge windows for
   `wp_wpsg_access_requests` and `wp_wpsg_audit_log`, mirroring the analytics retention
   setting.
3. **Server-side Sentry PII scrubber** — bring the PHP error-reporting path to parity with
   the browser side's redaction.
4. **Per-day salt rotation for analytics hashing** — reduce re-identifiability of the
   visitor hash.

---

*Questions about data handling: see the plugin support channel documented in the store
listing. This statement reflects plugin 0.90.0 and should be re-reviewed each release.*
