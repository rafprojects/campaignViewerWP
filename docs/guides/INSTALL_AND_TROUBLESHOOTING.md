# WP Super Gallery — Install & Troubleshooting Guide

A buyer-facing guide to installing, configuring, and troubleshooting WP Super Gallery.
For data-handling details see [PRIVACY.md](../PRIVACY.md). For translating the plugin see
[TRANSLATING.md](TRANSLATING.md).

---

## Requirements

| | Minimum | Notes |
|---|---|---|
| WordPress | **6.4+** | Tested against current stable |
| PHP | **8.2+** | 8.3 recommended |
| Database | MySQL 5.7+ / MariaDB 10.3+ | |
| Browser (visitors) | Any modern evergreen browser | Galleries render in a Shadow DOM |

The plugin ships with its front-end assets **pre-built** — you do **not** need Node.js,
Composer, or a build step to run it. (Those are only needed if you build from source.)

---

## Installation

### From a ZIP (marketplace / direct download)

1. In WordPress admin go to **Plugins → Add New → Upload Plugin**.
2. Choose the `wp-super-gallery.zip` file and click **Install Now**.
3. Click **Activate**.
4. A new **WP Super Gallery** menu appears in the admin sidebar.

### Manual install

1. Unzip and upload the `wp-super-gallery` folder to `/wp-content/plugins/`.
2. Activate it from **Plugins**.

### First run

1. Open **WP Super Gallery** in the admin menu.
2. Create your first **campaign** and add media (upload, or embed external media via URL).
3. Publish the campaign.
4. Embed it on any page/post using the shortcode below.

---

## Embedding a gallery

Use the **`[super-gallery]`** shortcode (block-editor: add a *Shortcode* block).

> ⚠️ The tag is `super-gallery`, and campaigns are addressed by **slug or ID via the
> `campaign` attribute** — there is no `id=` attribute.

```text
[super-gallery campaign="my-campaign-slug"]
[super-gallery campaign="123"]
```

**Supported attributes**

| Attribute | Values | Purpose |
|-----------|--------|---------|
| `campaign` | campaign **slug** or numeric **ID** | Show a single campaign's gallery |
| `company` | company **slug** or numeric **ID** | Show all campaigns for a company |
| `space` | space **slug** or numeric **ID** | Target a specific Gallery Space |
| `compact` | `true` / `false` (default `false`) | Compact rendering variant |
| `auth_bar_mode` | (mode string) | Override the auth-bar display for this embed |

Omitting `campaign`/`company` renders the default gallery listing for the resolved space.

**External / cross-site embed:** each campaign also provides an iframe/JS embed snippet
from the admin panel for placing a gallery on a non-WordPress site.

---

## Configuration essentials

- **Settings → Appearance / Layout:** choose the tile adapter (classic grid, masonry,
  justified, hexagonal, carousel, etc.), lightbox behavior, and responsive breakpoints.
- **Themes:** pick a built-in theme or author your own (see
  [THEME_AUTHORING_GUIDE.md](THEME_AUTHORING_GUIDE.md)).
- **Access control:** campaigns can be public, or restricted with per-campaign /
  per-company access grants and time-limited viewer grants.
- **Analytics (optional, off by default):** enable in **Settings → Advanced** to record
  pseudonymized view counts. If you enable it, also set a **retention window** (default is
  "never purge"). See [PRIVACY.md](../PRIVACY.md).
- **Authentication:** the default is WordPress's own cookie + REST nonce (nothing to
  configure). JWT auth is an advanced opt-in behind the `WPSG_ENABLE_JWT_AUTH` constant —
  see [WP_JWT_SETUP.md](WP_JWT_SETUP.md).

---

## Troubleshooting

### The gallery shows nothing / "No media available"
- Confirm the **campaign is published** and has media assigned.
- Confirm the shortcode uses the **correct tag and attribute**:
  `[super-gallery campaign="…"]` — **not** `[wp_super_gallery id="…"]`.
- Check the `campaign` value matches an existing campaign **slug or ID**.
- If the campaign has **access controls**, an unauthorized visitor sees the access-gated
  state rather than the media — verify grants or view while logged in.

### The gallery renders unstyled or clashes with my theme
- Galleries render inside a **Shadow DOM** specifically to avoid theme CSS bleed; if
  styling looks wrong, hard-refresh to clear cached assets and confirm the plugin's built
  assets loaded (see below).
- Check the browser console for a failed asset request (a caching/CDN plugin can serve a
  stale bundle after an update — purge your page cache).

### Assets 404 / blank admin panel after an update
- The plugin ships pre-built assets under `assets/`. After updating, **purge any page/CDN
  cache** and hard-refresh. Asset filenames are content-hashed, so a stale HTML cache can
  reference an old bundle.
- If you installed from **source** rather than a release ZIP, you must run the build
  (`npm run build:wp`) — a source checkout has no compiled `assets/`.

### External media (YouTube/Vimeo/…) won't embed
- The oEmbed proxy uses a **provider allowlist**; confirm the provider is enabled in
  settings.
- Outbound HTTP must be allowed from your server (some hosts block it) — the proxy fetches
  embed metadata server-side.

### SVG upload rejected
- SVGs are sanitized on upload; files containing scripts, event handlers, or external
  references are stripped/blocked by design. Re-export a clean SVG.

### Access-request emails not arriving
- The plugin sends mail via WordPress `wp_mail` (your site's mail config). If email is
  unreliable site-wide, install/configure an SMTP plugin — this is a WordPress mail-delivery
  issue, not plugin-specific.

### REST / permission errors in the admin panel
- The admin UI uses REST with a nonce that refreshes on a heartbeat. If you see 401/403
  after leaving a tab open a long time, reload the page to refresh the session.
- Confirm the logged-in user has the required capability (System-Admin vs Editor tier).

### Pro license won't activate / Pro features stay locked
- Confirm the license key is entered on the plugin's licensing screen and shows as active.
- Pro features (LayoutBuilder text layers, per-breakpoint responsive editing, the starter
  template library) unlock only while a valid license is active; when locked they show a
  clear "Pro feature" upsell rather than breaking. Content you already saved keeps working
  regardless of license state.
- Full activation / deactivation / troubleshooting steps are in
  [LICENSE_ACTIVATION.md](LICENSE_ACTIVATION.md).
- Selling the plugin yourself? The owner go-live runbook is
  [MARKETPLACE_READINESS.md](MARKETPLACE_READINESS.md), and the pro/free boundary + developer
  guide is [PRO_FEATURES.md](PRO_FEATURES.md).

### Enabling debug logging
- Set the `wpsg_debug` flag (see [DEBUG_TOGGLE.md](DEBUG_TOGGLE.md)) to surface verbose
  front-end diagnostics in the console when reporting an issue.

---

## Uninstalling

Deleting the plugin runs a full cleanup (custom tables, campaigns, options, roles, cron,
uploaded overlay/thumbnail dirs) **unless** you enable **"Preserve data on uninstall"** in
Settings first. See [PRIVACY.md §6](../PRIVACY.md) for the exact list of what is removed.

---

## Getting help

Support channels and SLA are described in the store listing. When reporting an issue,
include your WordPress version, PHP version, the plugin version (**Settings** shows it),
the shortcode you used, and any relevant browser-console or PHP error-log output.
