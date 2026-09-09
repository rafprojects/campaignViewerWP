# Astragal — brand specification

The house brand. Astragal publishes Mullion and everything after it: WordPress plugins,
Windows and Linux utilities, web apps, and small tools.

An astragal is the moulding — or, in joinery, the vertical bar — that covers the meeting join
between two door or window leaves. It is the piece that makes a seam disappear. Kin to a
mullion without being one.

> **Astragal signs the work. It never competes with it.**
> Mullion has to win attention in a directory listing. Astragal has to be recognised without
> being noticed. Everything below follows from that one asymmetry.

---

## 1. The mark

A turned bead with a fillet above and below, on a shaft — the astragal drawn as it appears in
section. One silhouette, one colour, no gradients, no second tone.

There are **two cuts**, and they are not interchangeable:

| Cut | Use at | Geometry (96 × 96 canvas) | File |
|---|---|---|---|
| **Full** | 28 px and above | shaft 12 wide · fillets 36 × 7 · bead r 21 | `astragal-mark.svg` |
| **Reduced** | below 28 px | shaft 18 wide · bead r 22, no fillets | `astragal-mark-reduced.svg` |

The fillets are an optical-size feature, not decoration. Below roughly 28 px they stop
resolving and start muddying the silhouette, so the reduced cut drops them and thickens the
shaft and bead to hold the same visual weight. Two drawings, one mark — the way a typeface has
optical sizes. **Never scale one cut into the other's territory.**

- Ink bounding box, full cut: `x 27 → 69`, `y 4 → 92` (42 × 88 on the 96 canvas).
- Ink bounding box, reduced cut: `x 26 → 70`, `y 6 → 90` (44 × 84).
- **Clear space** on all four sides is one bead diameter, measured from the ink bounding box.
- **Minimum size** is 14 px. Below that use nothing rather than a smudge.

Both mark files use `fill="currentColor"`, so they inherit the surrounding text colour when
inlined. When used as `<img>` or a CSS background, pick the tile files or set the fill.

### Tiles

Where a container is required — GitHub organisation avatar, Windows application icon, an app
shelf — the mark sits on a rounded square whose corner radius is `56/256` of its width. That is
the same radius ratio as Mullion's tile. **The shared construction is the family resemblance.
There is deliberately no shared colour.**

`astragal-tile-dark.svg` (Graphite ground, Bone mark) is the default. Use
`astragal-tile-light.svg` only where a dark tile would sit on a dark surface.

---

## 2. Palette — Lead and Bone

Named for the two materials that hold a window together: the lead came that binds the glass,
and the bone-white of dressed stone. The ground is warm, the ink is cool, and that tension is
the only visual interest the palette permits itself.

| Token | Hex | Role |
|---|---|---|
| `--ast-lead-900` | `#191C1E` | Mark and wordmark on light grounds. Body copy. |
| `--ast-lead-700` | `#3A4043` | Secondary copy, hairline emphasis. |
| `--ast-lead-500` | `#626A6E` | Muted labels. 4.59 : 1 on Bone — the floor, do not go lighter for text. |
| `--ast-lead-300` | `#A9AFB2` | Rules and dividers only. Never text. |
| `--ast-bone`     | `#ECEAE4` | The light ground. Warm, not cream. |
| `--ast-chalk`    | `#F8F7F3` | Raised surfaces on Bone. |
| `--ast-graphite` | `#16181A` | The dark ground. Cool, near-black. |

Dark-ground inversions: `--ast-lead-900` → `#E9E7E1`, `--ast-lead-700` → `#C2C6C7`,
`--ast-lead-500` → `#98A0A4` (6.70 : 1 on Graphite), `--ast-lead-300` → `#6C7478`.

### The one deliberate contrast exception

The product accent `#007870` (Mullion's, used in the endorsement lockup) measures **4.45 : 1**
on Bone — a hair under the 4.5 text floor. It does not need correcting: the endorsement sets
the product name as a **logotype**, which WCAG 1.4.3 exempts from text-contrast requirements,
and the pairing clears 3 : 1 for 1.4.11 as a graphical object. Two rules keep this a known
exception rather than an accident:

- **Never reuse teal-on-Bone as live text.** Logotype pairing only. Teal as running text on a
  light house ground belongs on Chalk, where `#007870` measures 5.00 : 1.
- **Do not introduce a third teal to close the 0.05 gap.** A hue-identical `#00776f`
  (0.1° delta) would measure 4.51 on Bone — it is not worth having. The system already carries
  two teals (brand `#007870`, the light theme's `#006e66` fill); a third earns nothing. The
  rule that governs the colour system governs this too: a new value earns its place only when
  it does something the existing ones cannot.

### The rule that makes this scale

**The house owns no colour.** Mullion owns Rig Cyan (`#1AD1C4` on dark, `#007870` on light).
Product two will own something else. If Astragal owned a hue, every lockup would carry two
competing colours and every new product would have to negotiate with the house. Owning no
colour is what makes the house free.

Rig Cyan appears in Astragal materials **only where Mullion appears**, and only on the Mullion
half of the composition.

---

## 3. Typography

Mullion's brand layer is Archivo and its interface layer is Inter. That separation is already
decided and nothing here disturbs it. Astragal takes a third position deliberately: a serif, so
the endorsement reads as an **imprint** rather than a second product name competing in the same
voice.

| Role | Face | Setting |
|---|---|---|
| Wordmark | Spectral 500 | Uppercase, `+0.17em`, hand-kerned. Ship as outlined SVG. |
| Display | Spectral 400 / 500 | Headings, the descriptor line, pull quotes. |
| Text | IBM Plex Sans 400 / 500 / 600 | Site copy, docs, store pages, release notes. |
| Data | IBM Plex Mono 400 | Handles, versions, slugs, licence IDs, prices. |

The wordmark is a **drawn asset, not live text.** `astragal-wordmark.svg` carries the outlines
with the tracking already applied and the following pair kerns baked in (units per 1000 em):

```
T→R  −28      G→A  −22      A→G  −14
R→A  −16      A→S   −8      A→L  −10
```

Never set the wordmark in sentence case. Never track it tighter. Never substitute Archivo to
"unify" the brands — the serif is the whole point.

### Copy

- **Descriptor:** *Made to fit.*
- **Directory bio:** *Independent software for WordPress, the web, and the desktop.*

The descriptor is prose. It is **not** part of any lockup.

---

## 4. Lockups

Four, and no others.

| Lockup | File | Notes |
|---|---|---|
| Horizontal (primary) | `astragal-lockup-horizontal.svg` | Mark height = cap height × 1.9. Gap = one bead diameter. Minimum 128 px wide. |
| Stacked | `astragal-lockup-stacked.svg` | Square spaces — store cards, about boxes, footers. |
| Endorsement | `astragal-endorsement-light.svg` / `-dark.svg` | The one that matters. See below. |
| Mark alone | `astragal-mark*.svg` | Favicon, avatar, tray icon, admin footer — anywhere the name is already in the surrounding text. |

### The endorsement lockup

`Mullion` (Archivo 700, `−0.028em`, in the product's accent) · hairline rule · `BY` /
`ASTRAGAL` (Spectral caps, in lead). The product owns the colour and the larger size; the house
is a hairline away.

**The product name is always at least twice the cap height of the Astragal wordmark.** In the
shipped files the ratio is 2.5 : 1. This single composition is what the whole system exists to
make possible — swap `Mullion` for the next product and nothing else changes.

---

## 5. The rules

1. **The house owns no colour.** Lead 900 on light, Bone on dark. Never a product's accent,
   never two tones, never a gradient.
2. **The product is always larger than the house.** At least 2 × the Astragal cap height in any
   lockup containing both.
3. **Below 28 px, use the reduced mark.** Above it, the full mark. Never scale one into the
   other's range.
4. **Clear space is one bead diameter**, from the ink bounding box, on all four sides.
5. **The wordmark is always uppercase**, Spectral 500, `+0.17em`, shipped as outlines so a
   missing webfont cannot break it.
6. **The house never carries a tagline in a lockup.** *Made to fit.* is copy.

## 6. And the things not to do

- **Don't tint the mark cyan to match Mullion.** The moment product two ships, that lockup is
  wrong and every asset containing it has to be redrawn.
- **Don't put the mark inside Mullion's tile, or Mullion's panes inside Astragal's.** Shared
  radius is a family resemblance; shared shapes would be a merger.
- **Don't set the wordmark in Archivo.** The serif is what makes the endorsement read as an
  imprint instead of a competing product name.
- **Don't add a descriptor under the wordmark.** A publisher signature with a strapline stops
  being a signature and starts being an advertisement.
- **Don't use the bead alone as a standalone mark.** A circle is not ownable and will not
  survive a trademark examiner or a reverse image search.
- **Don't ship a light-only or dark-only drawing.** One silhouette, two inks — that is the
  entire colour system.

---

## 7. Files

```
astragal-mark.svg                 full cut, currentColor, 96×96
astragal-mark-reduced.svg         reduced cut, currentColor, 96×96
astragal-favicon.svg              reduced cut, 16×16, Lead 900
astragal-wordmark.svg             outlined, cap-height 100
astragal-tile-dark.svg            256×256, Graphite ground
astragal-tile-light.svg           256×256, Bone ground
astragal-lockup-horizontal.svg    primary lockup, currentColor
astragal-lockup-stacked.svg       stacked lockup, currentColor
astragal-endorsement-light.svg    Mullion, by Astragal — light ground
astragal-endorsement-dark.svg     Mullion, by Astragal — dark ground
astragal-tokens.css               palette as CSS custom properties, both themes
astragal-tokens.json              palette as JSON, for build tooling
png/                              rasterised icons 32–512, mark 16/32/48, lockup 1200
```

All SVGs are hand-written, minified-safe, and carry a `<title>` for accessibility. The wordmark
and lockups contain outlined type — no font dependency at render time.

---

## 8. Still open

The name has **not** had a trademark clearance search. Availability and collision checks were
run against WordPress.org, GitHub, npm and domain registries; the only mark found anywhere was
Astragal Press, a book publisher in class 16, which does not conflict with software in classes
9 and 42. That is not clearance. Get a knockout search before this is printed or filed.
