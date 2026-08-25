# Mullion — design brief

This is the creative brief for the plugin's visual identity: icon, banner, and supporting marks.
It is the companion to [`README.md`](README.md) in this directory, which holds the hard
**filename and dimension spec**. Read that one for *what files to produce*; read this one for
*what they should look like and why*.

> **Status: name and default palette closed; engineering is now the pacing item.** The product
> name is **Mullion** (WordPress.org slug `mullion-gallery`) — a mullion is the bar that divides
> a window into framed panes, which is exactly what the Layout Builder lets someone do by hand.
> The default theme's colors are final: the full **Rig Cyan** spec (11 roles, every pairing
> WCAG AA-verified) lives in [`COLOR-SPEC.md`](COLOR-SPEC.md), the product of a six-round
> collaboration with the designer that also surfaced and fixed two real engineering defects
> along the way — a hardcoded ramp index ignoring each theme's own authored shade, and an
> unsafe fallback that would have silently reinstated a contrast failure. That collaboration
> is now closed pending our side: `primaryShade` can't be set until the ramp generator's
> HSL→OKLCH migration lands (tracked in [`docs/PHASE75_REPORT.md`](../docs/PHASE75_REPORT.md),
> tracks P75-D/E/F), and the designer separately is holding on trademark clearance for
> "Mullion" before cutting final assets. Icon, banner, and screenshots are still undecided
> and unblocked by any of the above — this document previously described the product under
> its old working name, "WP Super Gallery"; renamed throughout.

---

## What is Mullion

Mullion is a WordPress plugin for building and embedding image galleries. That
sentence undersells it, so here is the fuller version:

Most WordPress gallery plugins give you a grid and a handful of settings. Mullion
gives you **a visual layout builder** — a canvas with layers, masks, overlays, rulers, snapping
guides, and drag-and-drop composition — plus **fourteen different gallery layout engines** and
**twenty-three visual themes**. You can produce something as restrained as a plain justified
grid, or something with hexagonal tiles, neon glow on hover, and hand-composed overlapping
layers. The range is the point.

The second thing that makes it unusual is technical but matters commercially: galleries render
inside a **Shadow DOM**, which means they are completely isolated from the host theme's CSS.
The gallery looks the way you designed it regardless of what WordPress theme the site is
running, and it cannot break the surrounding page. Galleries can also be embedded on external
sites entirely outside WordPress.

Underneath, it is a substantial piece of software: a React 19 single-page application mounted
inside WordPress, roughly 118,000 lines of TypeScript and 28,000 lines of PHP, with about 5,000
automated tests, WCAG AA accessibility enforced as a blocking build gate across every shipped
theme, and five translated languages. It is at version 0.90.0 and approaching its first paid
release.

### What a user actually does with it

1. Creates a **campaign** — the plugin's word for a gallery, carrying its own media, settings, categories, tags and access rules.
2. Adds media, either uploaded or embedded from YouTube, Vimeo, Spotify, SoundCloud and others.
3. Picks a **layout adapter** — or opens the **Layout Builder** and composes the arrangement by hand.
4. Themes it, from twenty-three presets or their own custom theme.
5. Drops it on a page with a shortcode, or embeds it on an external site.

### The fourteen layouts

Classic (carousel) · Compact Grid · Justified · Masonry · Hexagonal · Circular · Diamond ·
Scroll Snap · Coverflow · Pinterest · Stacked · Filterable Grid · Spotlight · Layout Builder

This list is the single best summary of the product's personality. It is not one gallery with
options; it is fourteen genuinely different ways of showing pictures, plus a blank canvas.

---

## Who it is for

Four audiences, roughly in order of how much they'll pay:

| Audience | What they care about |
|---|---|
| **Agencies & developers** | Control, multi-client management, access permissions, audit logs. The pricing model assumes them — there is an agency/unlimited tier. |
| **Photographers & creatives** | Image fidelity and layouts that don't upstage the work. |
| **E-commerce / product galleries** | Product imagery, catalogues, conversion. |
| **Small business & general WP users** | Something good-looking, fast, without hiring anyone. |

The brand needs to earn the agency buyer's trust without alienating the small-business user.
Practically: **credible and design-led rather than cute**.

### Business model

Freemium. A free edition ("lite") on the WordPress.org directory, and a Pro edition sold
through Freemius. The core gallery *and the entire Layout Builder* are free and fully
functional — Pro unlocks exactly three additional Layout Builder capabilities (text layers,
per-breakpoint responsive editing, and a starter template library).

**Design implication:** Pro is a small accent on the same product, not a different product.
The Pro mark should be a badge or lockup variant on one brand — not a separate premium identity.

---

## Positioning

> **Mullion is a builder that makes galleries.**

The competitive set is Envira, FooGallery, Modula, and NextGEN. They all do galleries. None of
them has a real visual layout builder. That is the differentiator, and the artwork should lead
with it rather than showing yet another neat grid of stock photos.

Two hero claims, in priority order:

1. **A visual, layer-based layout builder** — compose galleries by hand, not by dropdown.
2. **Embeds anywhere without breaking your theme** — Shadow DOM isolation.

### Tagline

Lead candidate:

> **Design galleries visually. Embed anywhere.**

Two short beats, one for each hero claim, and legible at banner size. **This is not locked** —
alternatives are welcome and expected as part of the design pass. Prior candidates for
reference: *"Embeddable galleries with a visual layout builder"* and *"The visual layout builder
for WordPress galleries"* (the plainest, and the best for search intent).

---

## Creative direction

These are decided. Everything under [What's open](#whats-open) is not.

### One confident mark, range in the banner

The product's defining quality is configurability — it can look minimalist or chaotic, corners
sharp or rounded, typography heavily customised. It is tempting to make the *icon* express that
range. Don't. An icon that tries to say "this can be anything" says nothing, and it will not
survive 16px.

**The icon is one disciplined mark. The banner and screenshots carry the range story.**

### Icon motif: aperture / frame

A photographic frame or aperture form, executed with precision. It is the most direct signifier
in the category, which is both its strength (instantly legible, no explanation needed) and its
risk (the most crowded visual space in gallery plugins).

The way to win with it is **execution and restraint, not novelty** — a mark that is
geometrically exact, confident at every size, and paired with a palette that isn't the
category-standard blue. Think precision instrument rather than clip-art camera.

Optional geometry to draw on, if it helps the mark feel specific to this product rather than
generic-photographic — these are the actual shapes the plugin renders:

```
hexagonal tile:  polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)
diamond tile:    polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)
```

An aperture whose blades echo those angles would tie the mark to the product without
sacrificing legibility.

---

## Deliverables

### WordPress.org listing — filenames must match exactly

WordPress.org keys off these names. The deploy workflow uploads this directory automatically;
a typo means the asset silently doesn't appear.

| File | Dimensions | Format | Notes |
|---|---|---|---|
| `banner-1544x500.png` | 1544 × 500 | PNG or JPG | Design here, then downscale |
| `banner-772x250.png` | 772 × 250 | PNG or JPG | Must stay legible at this size |
| `icon-256x256.png` | 256 × 256 | PNG | High-DPI |
| `icon-128x128.png` | 128 × 128 | PNG | Standard |
| `icon.svg` | vector | SVG | Optional, but WP.org prefers it when present |
| `screenshot-1.png` … `screenshot-5.png` | ≥ 1200px wide | PNG | Captured by the product owner — see [Screenshots](#screenshots) |

### Freemius listing

| Asset | Spec |
|---|---|
| Product icon | Max **300 × 300**, JPG/PNG/GIF, **≤ 200KB** |

> Freemius's public documentation only says "optionally upload a product icon" without stating
> limits. The above is the widely-reported constraint and should be **confirmed against the
> Freemius developer dashboard at upload time**. Supplying a 300×300 PNG under 200KB is safe
> regardless.

### Additional marks

| Deliverable | Why | Constraints |
|---|---|---|
| **wp-admin menu icon** (SVG) | Currently the stock `dashicons-images-alt2`. This is the mark users see every single day — the cheapest high-visibility upgrade available. | Single colour, legible at **~20px**, must work in both light and dark admin colour schemes. WordPress recolours it, so build it to inherit fill. |
| **Pro / Lite lockup variants** | For the Freemius listing and the in-app upgrade panels. | One brand, two states. A badge or accent, not a redesign. |
| **Favicon** | `index.html` still ships Vite's default logo. | Derived from the icon; must read at 16px. |
| **"No image" placeholder** | The current fallback is grey Arial text on a grey gradient, visible whenever media fails to load. | Should feel like the brand, quietly. Not attention-grabbing. |
| **Colour palette + type spec** | Written, so the brand survives past this engagement and can be applied by others. | Include hex values, roles, and contrast notes. |

---

## Hard constraints

None of these are in the original spec file, and all of them will make artwork look broken if
missed.

1. **The Freemius opt-in screen circle-crops the icon at 80×80.** The bundled SDK applies
   `border-radius: 50%` with `overflow: hidden` to an 80×80 box, on a **white** background with a
   1px `#efefef` border and 3px padding. The mark must sit safely inside a circle, must not rely
   on its square corners, and **must not assume a dark background**.

2. **16px is a real, shipped size.** The icon appears as a favicon in the WordPress admin plugin
   list. No fine detail. No hairline strokes. Test at 16px before considering the mark finished.

3. **Keep banner text clear of the extreme edges.** The WordPress.org listing page overlays an
   author avatar and badges on the banner.

4. **Design the banner at 1544×500 and downscale to 772×250** — then verify. Most banners that
   fail, fail at the small size.

5. **The icon must work on light and dark.** WordPress admin has both colour schemes, the
   Freemius screen is white, and the product itself is dark-first.

---

## Visual context — raw material, not a mandate

The palette is **deliberately open**. What follows is what the product looks like today, so the
brand can either build on it or knowingly depart from it.

### The de-facto current palette

The flagship `default-dark` theme, which is what most users see:

| Role | Hex |
|---|---|
| Background | `#0f172a` |
| Surface | `#1e293b` |
| Surface (raised) | `#334155` |
| Border | `#334155` |
| Text | `#ffffff` |
| Text muted | `#c0c9d5` |
| **Primary / accent** | **`#3b82f6`** |
| Success | `#22c55e` |
| Warning | `#f59e0b` |
| Error | `#ef4444` |
| Secondary accent | `#a855f7` |

`#3b82f6` is the one colour that survives both the light and dark default themes, so it is the
closest thing to an existing brand colour.

**The open question is whether to keep it.** Envira, FooGallery, Modula and NextGEN all live in
blue and green. A directory listing page is a grid of small icons, most of them blue. There is a
real argument for a deliberately non-blue brand — and the product's own chrome stays themeable
regardless, so the brand colour does not have to match the UI.

### Range material — the shipped themes

Twenty-three themes ship with the plugin, many borrowed from the code-editor world. Useful both
as evidence of range and as a palette source:

| Theme | Background | Primary |
|---|---|---|
| Cyberpunk | `#0a0a0f` | `#ff2d95` |
| Synthwave '84 | `#191928` | `#f97e72` |
| Tokyo Night | `#1a1b26` | `#7aa2f7` |
| Gruvbox Dark | `#282828` | `#fe8019` |
| Material Dark | `#121212` | `#bb86fc` |
| Nord | `#2e3440` | `#88c0d0` |
| Catppuccin Mocha | `#1e1e2e` | `#89b4fa` |
| Solarized Dark | `#002b36` | `#268bd2` |
| Sunset Boulevard | `#fffbeb` | `#f97316` |
| Ocean Breeze | `#f0f9ff` | `#0284c7` |
| Forest Whisper | `#f3f5f4` | `#15803d` |
| High Contrast | `#000000` | `#6ec1ff` |

Also shipped: Default Light/Dark, GitHub Light, Material Light, Catppuccin Latte, Solarized
Light, Darcula, Midnight Rose, Crimson Canvas, Halloween, Reverse Halloween.

### Typography

**Inter** for everything — body and headings. **JetBrains Mono** for code. Weights in use: 400
regular, 500 medium, 600 semibold, 700 bold. Buttons and badges are 600; badges are uppercase
with `0.02em` letter-spacing.

The product also exposes about 45 Google Fonts to end users, so the brand typeface is a brand
decision, not a technical constraint.

### The product's visual signature

Worth absorbing before designing the banner, because the banner should feel like the product:

- **Dark-first**, and deliberately *not* WordPress admin blue — there is no `#007cba` or
  `#2271b1` anywhere in the codebase, and there is a stylesheet whose only job is to override
  WordPress's native control styling.
- Media tiles at **8px radius** on a subtle **135° dark gradient** shell.
- A **frosted, blurred sticky header** (`backdrop-filter: blur(12px)`).
- Caption chips in `rgba(0, 0, 0, 0.7)` with white 600-weight text.
- On hover: a springy scale-bounce (1.0 → 1.07 → 0.97 → 1.0 over 380ms) and a periwinkle
  `#7c9ef8` glow.
- Soft, layered shadows. Nothing harsh.
- All motion is **150–380ms `ease`** — there is not a single `cubic-bezier` in the codebase.
  `prefers-reduced-motion` is honoured everywhere.
- Iconography is **Tabler Icons** throughout: thin 2px rounded strokes. That is the house line
  weight, and a mark drawn in that spirit will sit naturally alongside the UI.

### Voice

Terse, technical, sentence-case, second person. No exclamation marks, no jokes, no mascot —
close to WordPress core's own admin voice. Empty states read *"No layout templates yet."*, not
*"Nothing here yet! 🎨"*.

**The artwork should not be more playful than the product.**

---

## Color system — what a palette submission needs

This section exists because of a specific gap: the Rig Cyan palette's fifth swatch, "ink-safe"
(`#0f857c`), doesn't clear this plugin's own accessibility bar as submitted, and understanding
*why* requires understanding how the plugin actually consumes a palette. Worth reading before
sending a revision.

**How a theme is built.** Every theme the plugin ships — 23 of them today, including whatever
custom ones users author against the documented JSON schema — supplies one thing: a handful of
color roles (background, surface, text, a single accent, a few status colors). It does **not**
supply ten hand-picked shades of the accent. The system generates those itself: from one accent
hex, it produces a full light-to-dark ramp automatically (stepped lightness, slightly
desaturated at the extremes so nothing blows out neon), and a separate setting just names *which
rung of that ramp* gets used for things like filled buttons. That's the mechanism a second,
hand-picked swatch is competing with.

**What "ink-safe" ran into.** Checked as text against the three backgrounds it would plausibly
sit on:

| Pairing | Contrast | WCAG AA (4.5:1 min) |
|---|---|---|
| ink-safe `#0f857c` on ground `#08141b` | 4.14:1 | Fails |
| ink-safe `#0f857c` on surface `#102530` | 3.51:1 | Fails |
| ink-safe `#0f857c` on form `#e8f7fc` | 4.10:1 | Fails |
| *for comparison —* accent `#1ad1c4` on ground | 9.73:1 | Passes comfortably |
| *for comparison —* accent `#1ad1c4` on surface | 8.25:1 | Passes comfortably |

The plugin runs this exact check — automatically, against every theme, as a blocking test — so
a color that doesn't clear it can't ship as submitted. The odd part: the *brighter* accent color
already reads fine as text on both dark surfaces without any darker "safe" variant. So the open
question is really **what ink-safe was for**. Two real possibilities, and the answer changes
what we need back:

1. **It's a specific rung of the automatic ramp** — a shade the accent should hit when used for
   a filled button or other higher-contrast fill, not for text at all. If so, we don't need a
   second hex — just a sense of where on the light↔dark spectrum that rung should sit (e.g. "the
   shade you'd put a white label on top of").
2. **It's a genuinely different role** — text specifically, like a link color distinct from the
   UI accent, which is a legitimate pattern the schema doesn't currently model. If that's the
   intent, we'd want a value that actually clears 4.5:1 against ground and surface (roughly:
   similar hue, but lighter/less saturated than `#0f857c` — something closer to the accent's own
   lightness while keeping a distinguishable hue would likely clear it).

Either way: **one accent hex is normally enough.** Extra swatches earn their place only when
they're doing something the automatic ramp genuinely can't — a different hue, not just a
different lightness of the same hue.

---

## Screenshots

The product owner captures these; the designer is invited to art-direct and to push back on the
selection. Five slots, and their order matters — WordPress.org gives the first one the most
prominence.

Suggested order, reflecting the builder-led positioning:

| # | Subject | Notes |
|---|---|---|
| 1 | **Layout Builder canvas, layer panels docked** | Rulers and smart guides visible, a layout mid-composition. This is the shot no competitor can take. |
| 2 | **Front-end gallery, a visually distinctive adapter** | Hexagonal or justified rather than plain grid — proves the range immediately. |
| 3 | **Admin campaign management panel** | Campaigns tab, a populated list. Shows a real management tool, not a widget. |
| 4 | **Lightbox viewer** | Open over a gallery, navigation controls visible. |
| 5 | **Theme / adapter variety** | The theme selector, or a composite of one gallery across several adapters. Sells configurability better than a settings panel does. |

> **Note:** this reorders the manifest currently recorded in [`README.md`](README.md), which
> leads with the classic grid. The reorder is a recommendation pending sign-off. If it is
> adopted, the captions in `readme.txt` and the manifest table in `README.md` **must be updated
> together** — WordPress.org matches captions to files by number, and they will silently
> mismatch otherwise.

Capture rules: real UI, real-looking media, **no Lorem or placeholder art**, no visible debug
chrome, clean wide viewport.

---

## What's open

Deliberately unresolved, and expected to take iteration:

- **The brand palette.** No obligation to match any shipped theme. If one of them works, use it;
  if a departure works better, propose it. Expect a couple of rounds before this is pinned down.
- **The tagline.** A lead candidate exists; alternatives are welcome.
- **Whether the mark carries "Super".** The name contains it and nothing in the product currently
  acknowledges it. Worth a look, but not at the cost of the serious tone.
- **Wordmark treatment.** Whether the product name is set in Inter alongside the mark or gets its
  own lettering.

Useful to propose as options rather than a single answer: two or three palette directions on the
same mark would make the decision much easier.

---

## Practical notes

- Finished WordPress.org assets drop straight into this directory (`.wordpress-org/`) with the
  exact filenames above. The directory is **not** shipped inside the plugin ZIP; a GitHub Action
  publishes it to the WordPress.org listing.
- The same source graphics serve both the free WordPress.org listing and the Freemius premium
  listing. Design once.
- Compress the PNGs. Keep total asset weight sensible.
- **Implementation follow-up (not a design task):** the Freemius SDK locates the product icon by
  globbing `vendor/freemius/wordpress-sdk/assets/img/{slug}.*`, or accepts a `plugin_icon` filter
  override. Wiring the delivered icon into that path is an engineering step after handoff.
