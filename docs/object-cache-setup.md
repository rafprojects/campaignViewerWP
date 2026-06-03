# Object-Cache Setup for WP Super Gallery

WP Super Gallery works correctly with WordPress' default non-persistent object
cache. However, on higher-traffic sites or deployments with automation-heavy
workflows (batch exports, webhook delivery retries, frequent admin operations),
a persistent external object cache reduces database load and improves
response times.

This document describes the recommended cache deployment shapes and the
plugin's internal cache policy.

---

## When to add a persistent cache

Consider a persistent object cache when:

- You have sustained > ~50 admin API requests per minute
- You run multiple concurrent webhook endpoints with retry queues active
- You run binary media exports on a schedule alongside live gallery traffic
- Multiple WP processes share the same site (e.g., PHP-FPM with > 4 workers)
- You notice `wpsg_rest_error_rate` rising in the health dashboard without a
  clear application cause (a saturated database cache is a common hidden factor)

With the default non-persistent cache, values are cached only for the lifetime
of the current request. Every cold `get_option()` or `wp_cache_get()` miss on
a subsequent request hits the database. Under load this can cascade.

---

## Option A — Redis (recommended for most deployments)

**1. Install and start Redis:**

```bash
sudo apt-get install -y redis-server
sudo service redis-server start   # use `service` on WSL; `systemctl` may not work
```

To start Redis automatically on each WSL session, add the `service` line to your
`~/.bashrc`. On a native Linux server, enable the unit instead:

```bash
sudo systemctl enable redis-server
```

**2. Install the drop-in via WP-CLI:**

```bash
wp plugin install redis-cache --activate
wp redis enable
```

`wp redis enable` copies the object-cache drop-in into `wp-content/` and flushes
the cache. No manual file copy is needed.

**3. Optional wp-config.php constants** (add before `/* That's all, stop editing! */`):

```php
define('WP_REDIS_HOST', '127.0.0.1');   // or your Redis host/socket
define('WP_REDIS_PORT', 6379);
define('WP_REDIS_DATABASE', 0);
// Optional: namespace your site's keys to avoid collisions on shared Redis
define('WP_REDIS_PREFIX', 'wpsg_site1_');
```

**Verify:**

```bash
wp redis status
redis-cli ping   # should return PONG
```

Expected plugin output: `Status: Connected`.

---

## Option B — Memcached

**1. Install and start the Memcached daemon and PHP extension:**

```bash
sudo apt-get install -y memcached php8.x-memcached
sudo service memcached start
```

> The plugin docs refer to the "PECL memcache extension" but the plugin actually
> uses the `Memcached` PHP class (with a `d`). `php8.x-memcached` is the correct
> package. The older `memcache` extension (no `d`) is deprecated — ignore it.

**2. Add server config to `wp-config.php`** (before `/* That's all, stop editing! */`):

```php
global $memcached_servers;
$memcached_servers = ['127.0.0.1:11211'];
```

> **Important:** Memcached Redux expects server entries as `'host:port'` strings. The older format
> `[['127.0.0.1', 11211]]` (array-of-arrays) was used by the deprecated `memcache` (no `d`) plugin
> and will cause a `TypeError` on PHP 8 with Memcached Redux.

**3. Install the WordPress integration plugin:**

Use **Memcached Redux** (slug `memcached-redux`) — a maintained fork of the
original Memcached Object Cache plugin, updated for current PHP and WordPress
versions. The original `memcached` plugin (4.0.0) is only tested up to WP 6.1
and uses the deprecated `Memcache` extension (no `d`); avoid it on WP 7+.

This plugin is a drop-in only — do **not** activate it as a normal plugin
(activation will fatal-error because the drop-in redefines functions already
loaded from `wp-includes/cache.php`). Just install it and copy the drop-in:

```bash
wp plugin install memcached-redux
cp ~/wordpress/wp-content/plugins/memcached-redux/object-cache.php \
   ~/wordpress/wp-content/object-cache.php
```

WordPress picks up the drop-in automatically on the next request — no activation
step required.

**4. Optional: add a cache key salt to `wp-config.php`:**

```php
define( 'WP_CACHE_KEY_SALT', 'replace-with-a-long-random-string' );
```

This namespaces all cache keys so that two WordPress installs sharing the same
Memcached server don't collide. Not required for a single-site local setup, but
should be set in any environment where the Memcached instance is shared.

**Verify:**

```bash
wp cache type
```

---

## Option C — APCu (single-server only)

APCu stores the cache in shared memory on the PHP process. It is fast but
does not survive PHP-FPM restarts, is not shared between servers in a
multi-node deployment, and the cache is per-process on some FPM
configurations.

Use APCu only for single-server, low-traffic deployments where Redis/Memcached
is not available.

**1. Install the PHP extension** (replace `8.x` with your PHP version, e.g. `8.4`):

```bash
sudo apt-get install -y php8.x-apcu
```

If you are running Apache2 + PHP-FPM and haven't already enabled the FPM
connector, also run:

```bash
sudo a2enmod proxy_fcgi setenvif
sudo a2enconf php8.x-fpm
sudo systemctl restart apache2
```

Confirm APCu is available to the web PHP process:

```bash
wp eval 'echo extension_loaded("apcu") ? "apcu: yes" : "apcu: no";'
```

**2. Install the WordPress integration plugin:**

Install **Object Cache for APCu – ZapCu** from the WordPress plugin directory
(search "ZapCu" in the admin, or use WP-CLI). Activating it automatically
copies the object-cache drop-in into `wp-content/` — no manual file copy needed.

> **Note:** "APCu Manager" (a different plugin) is a stats and management UI
> for the APCu extension itself. It does **not** wire APCu into WordPress's
> object-cache layer and will not make `wp_using_ext_object_cache()` return
> true. You need ZapCu (or an equivalent drop-in plugin) for that.

**Verify:**

```bash
wp cache type   # should return something other than "Default"
```

---

## Switching between backends

WordPress only supports one `wp-content/object-cache.php` drop-in at a time.
To swap backends:

1. **Redis → other:** `wp redis disable` removes the drop-in cleanly.
2. **APCu/Memcached → other:** delete `wp-content/object-cache.php` directly,
   then deactivate the old plugin before activating the new one.
3. Verify the old drop-in is gone: `wp cache type` should return `Default`
   before enabling the new backend.

---

## Plugin cache groups

WP Super Gallery uses two named object-cache groups:

| Group | Purpose | TTL |
|---|---|---|
| `wpsg_settings` | Plugin settings option — warmed on `init` at priority 20 | 1 hour |
| `wpsg_rate_limit` | Per-IP/user rate-limit counters | Per-window (default 60 s) |

Cache groups are isolated: flushing `wpsg_rate_limit` (e.g., via
`wp wpsg cache flush-rate-limits`) does not affect settings.

---

## Access-control cache policy

Access-control reads (grant lookups, role checks) use a **maximum TTL of 60 s**
or bypass the cache entirely. This ensures that grant revocations propagate to
all in-flight requests within one minute.

**Do not** cache access decisions with `WPSG_REST::CACHE_TTL_SETTINGS` (1 hour).
Use `WPSG_REST::CACHE_TTL_ACCESS` (60 s) or skip the cache for any check whose
result determines whether a user is allowed to perform an action.

---

## Health surface

The plugin's `/wp-json/wp-super-gallery/v1/admin/health` endpoint includes an
`objectCache` key:

```json
{
  "objectCache": {
    "persistent": false,
    "backend": null,
    "stats_available": false,
    "stats": null
  }
}
```

| Field | Meaning |
|---|---|
| `persistent` | `true` if a persistent external object-cache drop-in is active |
| `backend` | Detected backend slug: `redis`, `memcached`, `apcu`, `unknown`, or `null` |
| `stats_available` | `true` if the backend exposes hit/miss stats via `stats()` |
| `stats` | Raw stats array when `stats_available` is `true`, otherwise `null` |

This data is also surfaced in the admin panel under
**System & Admin → Object Cache** (requires `advancedSettingsEnabled`).
