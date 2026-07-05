# Store assets — spec & manifest (`.wordpress-org/`)

This directory holds the **marketplace/listing graphics** (banner, icon, screenshots).
It is **not** shipped inside the plugin ZIP. The WordPress.org deploy workflow
(`.github/workflows/svn-deploy.yml`, via `10up/action-wordpress-plugin-deploy@v2`) reads
this directory automatically and publishes its contents to the SVN **`/assets/`** area of
the listing. For a premium/Freemius or CodeCanyon listing, reuse the same source graphics.

> **Status: slots specified, artwork pending.** The image files below are graphic-design
> deliverables. This README defines the exact filenames, dimensions, and content brief so a
> designer (or a later screenshot-capture pass) can drop finals straight in — no further
> spec work needed. Filenames must match **exactly**; WordPress.org keys off them.

---

## Required files & dimensions

| File | Dimensions (px) | Format | Notes |
|------|-----------------|--------|-------|
| `banner-772x250.png` | 772 × 250 | PNG or JPG | Standard listing banner |
| `banner-1544x500.png` | 1544 × 500 | PNG or JPG | High-DPI (retina) banner |
| `icon-128x128.png` | 128 × 128 | PNG | Standard plugin icon |
| `icon-256x256.png` | 256 × 256 | PNG | High-DPI plugin icon |
| `icon.svg` | vector | SVG | Optional; if present WP.org prefers it |
| `screenshot-1.png` … `screenshot-5.png` | ≥ 1200 wide recommended | PNG | Order **must** match the readme captions below |

Keep total asset weight reasonable (compress PNGs). Banners should keep text clear of the
extreme edges (avatar/badge overlap on the listing page).

---

## Screenshot manifest — MUST stay in sync with `readme.txt`

The `== Screenshots ==` section of
[`wp-plugin/wp-super-gallery/readme.txt`](../wp-plugin/wp-super-gallery/readme.txt) lists
captions in numbered order; each number maps to `screenshot-N.png` here. **If you add,
remove, or reorder a screenshot, update both places.**

| File | readme caption | Capture guidance |
|------|----------------|------------------|
| `screenshot-1.png` | Campaign gallery with classic grid adapter | Front-end gallery, classic grid, a few real tiles |
| `screenshot-2.png` | Visual layout builder with layer panels | Admin Layout Builder with the layer/panels docked |
| `screenshot-3.png` | Admin campaign management panel | Admin panel, campaigns tab, a list of campaigns |
| `screenshot-4.png` | Lightbox viewer with keyboard navigation | Open lightbox over a gallery, nav controls visible |
| `screenshot-5.png` | Advanced settings accordion | Settings → Advanced, an accordion section expanded |

Capture at a clean, wide viewport with representative (non-placeholder) content and a
neutral theme. Screenshots can be produced later by booting a seeded wp-env instance and
driving the app; that pass is out of scope for the content track that created this spec.

---

## Content brief

- **Banner:** product name "WP Super Gallery" + a one-line value prop (e.g. *"Embeddable
  campaign galleries with a visual layout builder"*). Show a hint of a gallery/grid. Keep
  it legible at the small (772×250) size — design at 1544×500 and downscale.
- **Icon:** a simple, high-contrast mark that reads at 128px (and as a 16px favicon in the
  admin list). Avoid fine detail.
- **Screenshots:** real UI, real-looking media, no Lorem/placeholder art, no visible debug
  chrome. Prefer the default shipped theme for consistency.

---

## Branding note (hybrid free/Pro)

The same source graphics serve both the free WordPress.org listing and the premium
(Freemius/CodeCanyon) listing. If Pro-only features get their own screenshots later, add
them as higher-numbered `screenshot-N.png` and label the caption (e.g. "(Pro)") — keep the
free-tier shots first.
