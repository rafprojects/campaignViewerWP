# Service Worker Manual Testing Guide (P52-D)

End-to-end verification procedure for the WPSG service worker: registration,
shell caching, offline fallback, deploy-time cache busting, and admin
pass-through. All tests use Chrome or Edge DevTools (the Application tab).

---

## Prerequisites

### 1. Production build

The SW is only registered in production mode (`!import.meta.env.DEV`). You
must build and deploy before any of these tests will work.

```bash
npm run build:wp      # builds + copies assets to wp-plugin/.../assets/
```

After a successful build, confirm the hash placeholder was replaced:

```bash
grep 'BUILD_HASH' dist/sw.js
# Expected: BUILD_HASH = '<8-char hex>', NOT __WPSG_BUILD_HASH__
```

If you see `__WPSG_BUILD_HASH__` the Vite plugin didn't run — re-run the
full build.

### 2. WordPress environment

The built assets must be served by WordPress. Either:

- **Local wp-env:** `npx wp-env start` with the plugin activated, then visit
  `http://localhost:8888`.
- **Staging/production:** deploy `wp-plugin/` as usual.

Verify the plugin is active and a page with the `[super-gallery]` shortcode
is reachable.

### 3. Browser

Use Chrome or Edge. Firefox handles SW slightly differently in DevTools. All
panel paths below refer to Chrome DevTools.

Open DevTools: `F12` or right-click → **Inspect**.

---

## Test 1 — SW registration

**Goal:** confirm the SW file is fetched and the SW is active.

1. Open DevTools → **Application** → **Service Workers**.
2. Navigate to any gallery page (a page with the shortcode).
3. The panel should show:
   - **Source:** `sw.js`
   - **Status:** `activated and is running` (green dot)
   - **Scope:** `/` (root scope)

**Confirm the injected hash:**

4. Click the `sw.js` link next to **Source** — the script source opens in a
   new DevTools tab.
5. Search for `BUILD_HASH`. The value should be an 8-char hex string
   (`'3e613417'` or similar) — **not** the placeholder `__WPSG_BUILD_HASH__`.

**Expected:** green dot, correct scope, hex hash in source.

---

## Test 2 — Shell cache populated on visit

**Goal:** confirm a visited gallery page is stored in `wpsg-shell-*`.

1. DevTools → **Application** → **Cache Storage**.
2. Expand the list. You should see:
   - `wpsg-runtime-wpsg-v3`
   - `wpsg-meta-v1`
   - `wpsg-shell-<hash>` ← new in P52-D
3. Click `wpsg-shell-<hash>`. The right panel lists cached entries. After
   visiting a gallery page you should see at least one row with the page
   URL (e.g. `http://localhost:8888/`).
4. Click that row. The **Preview** tab shows the full HTML response that
   was cached.

**Expected:** `wpsg-shell-<hash>` cache exists; the gallery page URL is
listed inside it.

---

## Test 3 — Offline reload serves cached shell

**Goal:** confirm the app shell is served when the browser goes offline.

1. Visit a gallery page and let it fully load (assets, metadata, etc.).
2. Open DevTools → **Network** → check the **Offline** checkbox.
   _(Or use Application → Service Workers → **Offline** checkbox there.)_
3. Reload the page (`Ctrl+R` / `Cmd+R`).

**Expected:**
- The page loads — you see the gallery shell (possibly without live data
  depending on metadata cache state). The browser does **not** show
  `ERR_INTERNET_DISCONNECTED`.
- In the **Network** panel, the document request (`(index)` or the page
  path) shows **`(ServiceWorker)`** in the **Type** column, confirming the
  SW served it.

**Negative control:**
- Uncheck **Offline**. Hard-reload (`Ctrl+Shift+R` / `Cmd+Shift+R`).
  Confirm the page loads normally from the network.

---

## Test 4 — Offline fallback for unvisited pages

**Goal:** confirm the branded fallback is served for pages never visited
while online.

1. Think of a gallery page URL the browser has **not** visited in this
   session, or clear the shell cache manually:
   - DevTools → **Application** → **Cache Storage** → right-click
     `wpsg-shell-<hash>` → **Delete**.
2. Re-enable **Offline** mode.
3. Navigate to that gallery page URL.

**Expected:**
- A minimal branded page renders with the heading **"You're offline"** and
  the subtext *"Check your connection and reload to view the gallery."*
- No raw browser error screen.

---

## Test 5 — wp-admin navigations are NOT intercepted

**Goal:** confirm the SW does not cache or intercept wp-admin.

1. Log in as administrator. Stay online.
2. Visit `/wp-admin/` — it loads normally.
3. Enable **Offline** mode.
4. Reload `/wp-admin/`.

**Expected:**
- The browser shows its own network error (`ERR_INTERNET_DISCONNECTED`
  or similar). The gallery offline fallback does **not** appear on
  wp-admin pages.

Also verify wp-admin is absent from Cache Storage:

5. Check **Application → Cache Storage → `wpsg-shell-<hash>`**. No
   `/wp-admin/` URL should appear in the entries list.

---

## Test 6 — Deploy-time cache busting

**Goal:** confirm a new build invalidates the old shell cache.

### 6a. Record the current hash

1. In DevTools → **Application** → **Cache Storage**, note the full name
   of the current shell cache (e.g. `wpsg-shell-3e613417`).

### 6b. Produce a new build

Make a trivial change to trigger different chunk hashes — or just
force-rebuild to get a new manifest hash:

```bash
# Touch a source file to guarantee the manifest hash changes
touch src/main.tsx
npm run build:wp
```

After the build:

```bash
grep 'BUILD_HASH' dist/sw.js
# Should show a DIFFERENT 8-char hex than before
```

### 6c. Reload and let the new SW activate

2. Deploy the new assets (copy `assets/` to WP, or rebuild wp-env).
3. Back in the browser (**online** mode), reload the gallery page once
   (this fetches the new `sw.js`).
4. If the new SW is waiting: DevTools → **Application → Service Workers**
   → click **skipWaiting**, or close all gallery tabs and reopen.
5. Reload one more time.

### 6d. Verify old cache is gone

6. DevTools → **Application** → **Cache Storage**. Expand the list.

**Expected:**
- The old `wpsg-shell-3e613417` (previous hash) is **gone**.
- A new `wpsg-shell-<new-hash>` is present.
- `wpsg-runtime-wpsg-v3` and `wpsg-meta-v1` are still present (they are
  not tied to the build hash).

---

## Test 7 — Metadata SWR cache unaffected

**Goal:** confirm the P50 stale-while-revalidate metadata cache still works
after the P52-D restructure.

1. Go online. Visit a public gallery page (not logged in, no auth cookies).
2. DevTools → **Network** → filter by `campaigns`. You should see a
   `campaigns` request.
3. Reload. The second request should show **`(ServiceWorker)`** as the
   initiator (served from `wpsg-meta-v1` SWR cache).
4. DevTools → **Application** → **Cache Storage** → `wpsg-meta-v1`.
   The campaigns URL should appear as a cached entry.

**Expected:** metadata SWR behaves identically to before P52-D; the cache
entry is present and network requests are served from cache on subsequent
loads within the TTL window.

---

## Quick checklist

| # | Test | Pass |
|---|------|------|
| 1 | SW registers, status = activated, scope = `/`, hex hash in source | ☐ |
| 2 | `wpsg-shell-<hash>` appears in Cache Storage after visiting gallery | ☐ |
| 3 | Offline reload of visited page → shell loads, no browser error, type = `ServiceWorker` | ☐ |
| 4 | Offline visit to unvisited page → branded "You're offline" fallback | ☐ |
| 5 | wp-admin offline → browser error (not gallery fallback); absent from shell cache | ☐ |
| 6 | New build → old `wpsg-shell-*` cache gone; new hash present | ☐ |
| 7 | Metadata SWR cache (`wpsg-meta-v1`) still populated and served by SW | ☐ |
