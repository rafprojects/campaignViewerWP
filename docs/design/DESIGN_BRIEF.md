# Mullion — design brief, v2

**v2, 2026-08-31, corrected 2026-09-09.** Supersedes the v1 brief. This is the creative
brief for the plugin's visual identity: icon, banner, and supporting marks. It is the
companion to [`STORE_ASSETS.md`](STORE_ASSETS.md), which holds the hard **filename and
dimension spec**. Read that one for *what files to produce*; read this one for *what they
should look like and why*.

**The 2026-09-09 correction matters:** the v1 brief this document was originally rewritten
from turned out to be a mid-round snapshot, not the collaboration's final state. A later v1
round — recovered from the designer's own working files — rejected the aperture/frame icon
motif after testing (it fails at 16px and signifies the wrong product) in favour of a
"displaced pane" builder motif, locked the tagline to *"Galleries you compose, not
configure,"* and decided the wordmark typeface (Archivo). All three are corrected below and
in the [Decision log](#decision-log). Every product fact in this document has been
re-verified against the codebase or the designer's own source files.

> **Status: the whole identity is decided. What remains is production.** The product is
> **Mullion** (WordPress.org slug `mullion-gallery`) throughout the shipped code, catalogs,
> and translations — a mullion is the bar that divides a window into framed panes, which is
> exactly what the Layout Builder lets someone do by hand. Name, palette, tagline, wordmark,
> and icon motif are all locked (see [Creative direction](#creative-direction) and the
> [Decision log](#decision-log)); the **Rig Cyan** palette ships as the default dark *and*
> light themes with every pairing enforced by two blocking CI contrast gates (see
> [`COLOR-SPEC.md`](COLOR-SPEC.md) v2 and [`LIGHT-THEME-SPEC.md`](LIGHT-THEME-SPEC.md) v2).
> Mullion also now publishes under a house brand, **Astragal** — see
> [House brand](#house-brand). What remains: cutting the artwork itself (icon, banner,
> screenshots, lockups, favicon, placeholder), which are now in production with the designer.
> **Trademark:** both names were searched on the official US register on 2026-09-09 and are
> clear in Classes 9 and 42, with named gaps remaining (EU/UK/Australia, design marks, and
> two namesake questions worth a solicitor's time). Full reference card in
> [`BRAND-CLEARANCE.md`](BRAND-CLEARANCE.md). **WordPress.org account:** registered as
> [`astragal`](https://profiles.wordpress.org/astragal/), the house handle, per the
> recommendation in [House brand](#house-brand); the plugin's `Contributors:` field credits
> it.

---

## What is Mullion

Mullion is a WordPress plugin for building and embedding image galleries. That sentence
undersells it, so here is the fuller version:

Most WordPress gallery plugins give you a grid and a handful of settings. Mullion gives you
**a visual layout builder** — a canvas with layers, masks, overlays, rulers, snapping guides,
and drag-and-drop composition — plus **fourteen different gallery layout engines** and
**twenty-three visual themes**. You can produce something as restrained as a plain justified
grid, or something with hexagonal tiles, neon glow on hover, and hand-composed overlapping
layers. The range is the point.

The second thing that makes it unusual is technical but matters commercially: galleries
render inside a **Shadow DOM**, which means they are completely isolated from the host
theme's CSS. The gallery looks the way you designed it regardless of what WordPress theme the
site is running, and it cannot break the surrounding page. Galleries can also be embedded on
external sites entirely outside WordPress.

Underneath, it is a substantial piece of software: a React 19 single-page application mounted
inside WordPress — roughly 121,000 lines of TypeScript and 28,000 lines of plugin PHP (plus
another 25,000 lines of PHP tests), with about 5,500 automated tests across Vitest, PHPUnit,
and Playwright. WCAG AA text contrast **and** WCAG 1.4.11 non-text contrast are enforced as
blocking CI gates across every shipped theme, and the UI ships in five translated languages
(German, Spanish, French, Russian, Simplified Chinese). It is at version 0.90.0 and
approaching its first paid release; the Freemius SDK and the dual free/premium release
pipeline are already integrated.

### What a user actually does with it

1. Creates a **campaign** — the plugin's word for a gallery, carrying its own media, settings, categories, tags and access rules.
2. Adds media, either uploaded or embedded from YouTube, Vimeo, Spotify, SoundCloud and others.
3. Picks a **layout adapter** — or opens the **Layout Builder** and composes the arrangement by hand.
4. Themes it, from twenty-three presets or their own custom theme.
5. Drops it on a page with a shortcode, or embeds it on an external site.

### The fourteen layouts

Classic (carousel) · Compact Grid · Justified · Masonry · Hexagonal · Circular · Diamond ·
Scroll Snap · Coverflow · Pinterest · Stacked · Filterable Grid · Spotlight · Layout Builder

This list is the single best summary of the product's personality. It is not one gallery
with options; it is fourteen genuinely different ways of showing pictures, plus a blank
canvas.

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
per-breakpoint responsive editing, and a starter template library). Saved Pro content still
*renders* in the free build; only the authoring UI is gated.

**Design implication:** Pro is a small accent on the same product, not a different product.
The Pro mark should be a badge or lockup variant on one brand — not a separate premium
identity.

---

## Positioning

> **Mullion is a builder that makes galleries.**

The competitive set is Envira, FooGallery, Modula, and NextGEN. They all do galleries. None
of them has a real visual layout builder. That is the differentiator, and the artwork should
lead with it rather than showing yet another neat grid of stock photos.

Two hero claims, in priority order:

1. **A visual, layer-based layout builder** — compose galleries by hand, not by dropdown.
2. **Embeds anywhere without breaking your theme** — Shadow DOM isolation.

### Tagline

**Locked:**

> **Galleries you compose, not configure.**

One beat, and it names the category difference rather than the feature — every builder
claims to be visual, so spending a beat on "visually" says what competitors also say.
"Compose, not configure" states what only this product lets you do.

The second hero claim (embeds anywhere) lives in supporting copy instead, where it does not
have to survive banner downscaling:

- **WP.org display name / subtitle:** *Mullion — Visual Gallery Builder*
- **Search-intent line**, for the WP.org short description: *The visual layout builder for
  WordPress galleries.*
- **Banner support chips:** *visual layout builder* · *embeds anywhere*

Rejected, for the record: *"Design galleries visually. Embed anywhere."* (both beats spent
on features — this was the v1 lead candidate), *"Every tile where you put it."* (most
concrete, but drops the embedding claim), *"Fourteen layouts, or build your own."* (ages
badly if the count changes).

---

## Creative direction

These are decided. Everything under [What's open](#whats-open) is not.

### One confident mark, range in the banner

The product's defining quality is configurability — it can look minimalist or chaotic,
corners sharp or rounded, typography heavily customised. It is tempting to make the *icon*
express that range. Don't. An icon that tries to say "this can be anything" says nothing,
and it will not survive 16px.

**The icon is one disciplined mark. The banner and screenshots carry the range story.**

### Icon motif: the displaced pane

**Decided: a builder motif, not a photographic one.**

The mark is three panes: one tall, one seated, and one lifted clear of the grid and set at a
slight angle. It reads as *a layout* and *a piece moved by hand* in the same shape, which is
the positioning exactly — a builder that makes galleries. It also inherits the product's own
8px-radius tile language rather than importing a camera from stock-icon land.

```
tall pane    x=46  y=52  w=70 h=152  r=12   form colour
seated pane  x=130 y=140 w=80 h=64   r=12   form colour
lifted pane  x=130 y=52  w=80 h=64   r=12   accent, rotate(-10deg about 170,84)
```

Drawn on a 256×256 canvas with a rounded tile ground (`r=56`). All geometry sits inside a
safe circle of radius ~116 so it survives the Freemius circle crop.

#### Why not an aperture

An earlier round of this brief specified an aperture or photographic frame. That direction
was tested and dropped, for two reasons:

1. **It fails constraint 2 of this document.** Aperture blades are, by definition, several
   thin converging shapes. Rendered at a true 16px they merge and the hexagonal opening
   rounds off; what survives is a ring indistinguishable from a loading spinner. Every
   aperture variant tested did this. The pane marks, built from filled blocks rather than
   blades, held.
2. **It signifies the wrong product.** An aperture says *camera*. The positioning says
   *builder*. Competing on the photographic axis also means competing on the most crowded
   visual ground in the category.

The hexagonal and diamond tile geometry the plugin renders —

```
hexagonal tile:  polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)
diamond tile:    polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)
```

— is still available as a secondary marketing mark; two overlapping hexes read beautifully
at large sizes. It degrades to an ambiguous lozenge at 16px, though, so it is not the icon.

### Brand palette — closed

The brand is **Rig Cyan**: ground `#08141b`, accent `#1ad1c4` on dark, `#007870` on light,
wordmark ink `#0d1b23`. The full token spec, the contrast maths, and the brand-vs-theme
distinction live in [`COLOR-SPEC.md`](COLOR-SPEC.md) §5. The deliberately-non-blue argument
from v1 won: the directory competitors live in blue and green, and Mullion's teal-on-near-black
is its own. The bright accent is for dark grounds only — it fails on white at 1.92:1 — so any
accent-coloured element on a light ground uses `#007870`.

### Wordmark — closed

<a id="wordmark-closed"></a>

**Archivo**, weight 700, letter-spacing `-0.028em`. A grotesque with the flat terminals and
slightly condensed proportions of architectural signage; it sits beside the mark without
competing. Archivo is deliberately *not* Inter — Inter remains the product typeface and
nothing in the application changes. Keeping the brand layer and the interface layer on
different faces keeps them legibly separate. See [Typography](#typography) for how this
sits alongside the product's own Inter and the house's Spectral.

### House brand — Astragal

<a id="house-brand"></a>

Mullion publishes under a house brand, **Astragal**, which will also carry future products.
Full spec, palette, mark, lockups, and rules in
[`astragal-brand/BRAND.md`](astragal-brand/BRAND.md) — the summary that matters for this
brief:

- **The house owns no colour.** Astragal is Lead-and-Bone (near-black/near-white), never a
  product's accent. Rig Cyan appears in Astragal materials only where Mullion appears.
- **The product is always at least twice the house's size** in any lockup containing both,
  and the house wordmark is set in Spectral (a serif), deliberately distinct from both
  Mullion's Archivo and the product's Inter — so the house reads as an imprint, not a
  competing name.
- **Where Astragal appears:** the WordPress.org account / `Contributors:` field, the plugin
  `Author:` / `Author URI:` header, the Freemius seller of record, the GitHub organisation,
  and a documentation-site footer or about panel (as the endorsement lockup, "Mullion · by
  Astragal").
- **Where it does not:** the WordPress.org banner or icon (that space is Mullion's job), any
  in-product admin screen, or the plugin's display name.

The WordPress.org account was the one decision here with real consequences, since the handle
is effectively permanent and accumulates a plugin portfolio across every future product. It
went to the house brand: [`astragal`](https://profiles.wordpress.org/astragal/), registered
2026-09-09, and the plugin's `Contributors:` field credits it. See
[`PHASE76_REPORT.md`](../PHASE76_REPORT.md) track P76-C.

The plugin header's `Author:` and `Author URI:` still read `Mullion` and the GitHub repo
URL. Moving them to Astragal follows from the same decision but has not been done, since
`Author URI:` needs a live destination to point at.

---

## Deliverables

### WordPress.org listing — filenames must match exactly

WordPress.org keys off these names. The deploy workflow uploads the `.wordpress-org/`
directory automatically; a typo means the asset silently doesn't appear.

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

> Freemius's public documentation only says "optionally upload a product icon" without
> stating limits. The above is the widely-reported constraint and should be **confirmed
> against the Freemius developer dashboard at upload time**. Supplying a 300×300 PNG under
> 200KB is safe regardless.

### Additional marks

| Deliverable | Why | Constraints |
|---|---|---|
| **wp-admin menu icon** (SVG) | Still the stock `dashicons-images-alt2` today. This is the mark users see every single day — the cheapest high-visibility upgrade available. | Single colour, legible at **~20px**, must work in both light and dark admin colour schemes. WordPress recolours it, so build it to inherit fill. |
| **Pro / Lite lockup variants** | For the Freemius listing and the in-app upgrade panels. | One brand, two states. A badge or accent, not a redesign. |
| **Favicon** | `index.html` still ships Vite's default logo. | Derived from the icon; must read at 16px. |
| **"No image" placeholder** | The current fallback (shown whenever media fails to load) is a grey gradient SVG with the word "Mullion" in small grey Arial — correctly named now, but still not designed. | Should feel like the brand, quietly. Not attention-grabbing. |
| **Colour palette + type spec** | Largely done — `COLOR-SPEC.md` v2 carries hexes, roles, and verified contrast. A designer-facing one-pager derived from it is welcome but optional. | Include hex values, roles, and contrast notes. |

---

## Hard constraints

None of these are in the store-asset spec file, and all of them will make artwork look broken
if missed.

1. **The Freemius opt-in screen circle-crops the icon at 80×80.** The bundled SDK applies
   `border-radius: 50%` with `overflow: hidden` to an 80×80 box, on a **white** background
   with a 1px `#efefef` border and 3px padding. The mark must sit safely inside a circle,
   must not rely on its square corners, and **must not assume a dark background**.

2. **16px is a real, shipped size.** The icon appears as a favicon in the WordPress admin
   plugin list. No fine detail. No hairline strokes. Test at 16px before considering the
   mark finished.

3. **Keep banner text clear of the extreme edges.** The WordPress.org listing page overlays
   an author avatar and badges on the banner.

4. **Design the banner at 1544×500 and downscale to 772×250** — then verify. Most banners
   that fail, fail at the small size.

5. **The icon must work on light and dark.** WordPress admin has both colour schemes, the
   Freemius screen is white, and the product ships both a dark and a light default theme.
   On light grounds the accent is `#007870`, never `#1ad1c4`.

---

## Visual context

### The default palette — no longer open

v1 presented the then-default palette (slate `#0f172a`, blue `#3b82f6`) as "the de-facto
current palette" and asked whether to keep the blue. That question is closed: the old
Instrument Blue theme is retired, and the shipped defaults are **Mullion** (Rig Cyan dark,
`#08141b` / `#1ad1c4`) and **Mullion Light** (`#e9eef1` / `#007870`). The product's chrome
remains themeable by the end user, but the Settings Panel and Layout Builder lock to the
Mullion brand palette by default — so the brand colour is now also the colour agencies see
daily in the editor.

### Range material — the shipped themes

Twenty-three themes ship with the plugin, many borrowed from the code-editor world. Useful
both as evidence of range and as a palette source (values verified against the shipped theme
JSON):

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

Also shipped: **Mullion** and **Mullion Light** (the brand default pair, above), plus GitHub
Light, Material Light, Catppuccin Latte, Solarized Light, Darcula, Midnight Rose, Crimson
Canvas, Halloween, and Reverse Halloween.

### Typography

Three faces across three layers, deliberately kept apart so each reads as what it is:

- **Product interface:** **Inter** for everything — body and headings — with a system-font
  fallback stack. **JetBrains Mono** for code. Weights in use: 400 regular, 500 medium, 600
  semibold, 700 bold. Buttons and badges are 600; badges are uppercase with `0.02em`
  letter-spacing. Unchanged by any of the below.
- **Mullion brand layer:** **Archivo** 700, `-0.028em`, for the wordmark and marketing
  headlines. See [Wordmark](#wordmark-closed). Archivo is not Inter because the brand layer
  and the interface layer should be legibly separate.
- **Astragal house layer:** **Spectral**, per
  [`astragal-brand/BRAND.md`](astragal-brand/BRAND.md) §3 — a serif so the house reads as
  an imprint rather than a second product name competing in the same voice.

The product also exposes 44 Google Fonts to end users, so the interface typeface is a brand
decision, not a technical constraint — the point above is that the *brand* layer stays off
that list entirely.

### The product's visual signature

Worth absorbing before designing the banner, because the banner should feel like the
product (each item re-verified against the code for v2):

- **Dark-first**, and deliberately *not* WordPress admin blue — there is no `#007cba` or
  `#2271b1` anywhere in the codebase.
- Media tiles at **8px radius** (the default radius token) on a subtle **135° gradient**
  shell drawn from the theme's own background and surface colours.
- A **frosted, blurred sticky header** — `backdrop-filter: blur(12px)` over a 92%-opacity
  theme-background wash.
- Tile-count and stat chips are pill-shaped, built from translucent mixes of the theme's own
  tokens (`color-mix` of background and muted-text colours) — chrome tints with the theme
  rather than sitting in fixed black.
- On hover: tiles play a springy scale-bounce (1.0 → 1.07 → 0.97 → 1.0 over 380ms); cards
  lift 2px and scale to 1.02. The optional hover glow defaults to the **brand teal
  `#1ad1c4`** and is user-configurable per gallery.
- Soft, layered shadows. Nothing harsh.
- Motion is short and understated — mostly **150–380ms `ease`**, with a handful of card
  adapters (Stacked, Coverflow, Filterable Grid) using a standard material easing curve for
  their slide transitions. `prefers-reduced-motion` is honoured.
- Iconography is **Tabler Icons** throughout: thin 2px rounded strokes. That is the house
  line weight, and a mark drawn in that spirit will sit naturally alongside the UI.
- Focus rings and interactive outlines draw in the theme's contrast-audited accent rung
  (`primaryStroke`) — visible, WCAG 1.4.11-clearing, on every shipped theme.

### Voice

Terse, technical, sentence-case, second person. No exclamation marks, no jokes, no mascot —
close to WordPress core's own admin voice. Empty states read *"No layout templates yet."*,
not *"Nothing here yet! 🎨"*.

**The artwork should not be more playful than the product.**

---

## How the plugin consumes a palette

Kept from v1 in condensed form, because it is the context any future palette submission
needs — and it now describes shipped code rather than a plan.

Every theme — the 23 bundled ones and any user-authored one — supplies a handful of colour
roles: grounds, text, borders, **one accent seed**, and status colours. It does *not* supply
hand-picked shades of the accent. The engine expands the seed into a 10-rung OKLCH lightness
ramp (gamut-mapped so neon seeds don't drift hue), and a criterion — not a person — selects
which rung becomes the filled-control colour: the first rung clearing 4.5:1 against the
theme's ink ground *and* under white text. A second, independently-selected rung serves
strokes and focus rings at the 3:1 non-text bar. Two blocking CI audits enforce both bars on
every bundled theme.

The practical consequence for brand work: **one accent hex is enough, and a second lightness
of the same hue will lose to the ramp.** Extra swatches earn a place only by doing something
the ramp can't — a genuinely different hue. (This is how v1's "ink-safe" swatch resolved: its
job is done by the criterion-selected rung, and its only surviving use is the brand-side
`#007870` for light grounds.)

---

## Screenshots

The product owner captures these; the designer is invited to art-direct and to push back on
the selection. Five slots, and their order matters — WordPress.org gives the first one the
most prominence.

Suggested order, reflecting the builder-led positioning:

| # | Subject | Notes |
|---|---|---|
| 1 | **Layout Builder canvas, layer panels docked** | Rulers and smart guides visible, a layout mid-composition. This is the shot no competitor can take. |
| 2 | **Front-end gallery, a visually distinctive adapter** | Hexagonal or justified rather than plain grid — proves the range immediately. |
| 3 | **Admin campaign management panel** | Campaigns tab, a populated list. Shows a real management tool, not a widget. |
| 4 | **Lightbox viewer** | Open over a gallery, navigation controls visible. |
| 5 | **Theme / adapter variety** | The theme selector, or a composite of one gallery across several adapters. Sells configurability better than a settings panel does. |

> **Approved.** This reorder is signed off. Execution — updating the `readme.txt` captions
> and the `STORE_ASSETS.md` manifest table together, since WordPress.org matches captions to
> files by number and they mismatch silently otherwise — is tracked as
> [P76-K](../PHASE76_REPORT.md).

Capture rules: real UI, real-looking media, **no Lorem or placeholder art**, no visible
debug chrome, clean wide viewport. Prefer the default Mullion theme for consistency.

---

## What's open

The identity is decided — name, palette, tagline, wordmark, and icon motif are all locked
(see the [Decision log](#decision-log)). What remains:

- **Cutting the artwork itself.** Direction is set (displaced pane, Rig Cyan, Archivo) and
  the files are in production with the designer: icon, banners, lockups, favicon, and the
  "no image" placeholder.
- **Full trademark clearance**, beyond the register check already done. See
  [`BRAND-CLEARANCE.md`](BRAND-CLEARANCE.md) for exactly what is and is not covered.

No longer open: the name, the palette (both schemes, CI-gated), the tagline, the wordmark,
the icon motif, the screenshot order (signed off and applied), and the WordPress.org account
handle (`astragal`, registered).
Every colour-engineering question from v1 is also closed (see `COLOR-SPEC.md` §7).

---

## Decision log

<a id="decision-log"></a>

| Decision | Outcome | Why |
|---|---|---|
| **Name** | **Mullion**, slug `mullion-gallery` | "WP Super Gallery" collided with WP Super Cache on every search; `wp-` slug prefixes are blocked by WP.org's automated trademark check; the slug is permanent once approved. A mullion divides a plane into framed panes — the thing the builder does. |
| **Display name** | *Mullion — Visual Gallery Builder* | Brand carries recall, keyword carries WP.org search. Changeable later; the slug is not. |
| **Icon motif** | Displaced pane (builder) | The aperture direction failed the brief's own 16px constraint and signified *camera* where the positioning says *builder*. |
| **Mark variant** | Tilted, not offset | Reads as hand-placed rather than machine-snapped. |
| **Palette** | Rig Cyan, accent `#1ad1c4` | Teal-cyan is unoccupied in the gallery-plugin category; green is crowded (Envira, NextGEN/Imagely, Meow all different greens — the first two are both Awesome Motive properties), violet was freshly taken by FooPlugins, orange is Modula's. |
| **Tagline** | *Galleries you compose, not configure.* | Names the category difference rather than the feature. |
| **Wordmark** | Archivo 700, `-0.028em` | Architectural-signage grotesque; deliberately distinct from the product's Inter. |
| **`ink-safe` swatch** | Dropped | It was a rung of the generated ramp, not a distinct hue. Expressed as a criterion on the existing `primaryShade` field (see `COLOR-SPEC.md` §2). |
| **Screenshot order** | Layout Builder leads | The shot no competitor can take. |
| **House brand** | Astragal | Publishes Mullion and future products; owns no colour of its own. See [House brand](#house-brand). |

---

## Practical notes

- Finished WordPress.org assets go into a top-level **`.wordpress-org/`** directory with the
  exact filenames above. That directory **does not exist yet** — create it when the first
  finals arrive. It is not shipped inside the plugin ZIP; the deploy workflow publishes its
  contents to the WordPress.org listing, and *everything* in it becomes publicly browsable —
  image files only, never docs (see the warning in `STORE_ASSETS.md`).
- The same source graphics serve both the free WordPress.org listing and the Freemius
  premium listing. Design once.
- Compress the PNGs. Keep total asset weight sensible.
- **Implementation follow-ups (not design tasks):** the Freemius SDK locates the product
  icon by globbing `vendor/freemius/wordpress-sdk/assets/img/{slug}.*`, or accepts a
  `plugin_icon` filter override — wiring the delivered icon into that path is an engineering
  step after handoff. Likewise the wp-admin menu icon (`menu_icon` in the CPT registration)
  and the `index.html` favicon each need a one-line swap once the mark exists.
