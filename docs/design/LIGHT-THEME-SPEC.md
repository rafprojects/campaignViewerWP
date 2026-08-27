# Mullion — Rig Cyan Light

Companion to the shipped Rig Cyan dark theme. Same 11 roles as `COLOR-SPEC.md` §1.

Every value below is **pure colour math on fixed hex values** — the category that has reproduced
exactly against your measurements every time. No ramp position is named and nothing here models
`generateColorScale()`.

## The 11 roles

| Role | Dark (shipped) | Light (proposed) |
|---|---|---|
| `background` | `#08141b` | **`#e9eef1`** |
| `surface` | `#102530` | **`#f7fafb`** |
| `surfaceRaised` | `#1a3542` | **`#ffffff`** |
| `border` | `#22414f` | **`#cddadb`** |
| `borderStrong` | `#577577` | **`#78898b`** |
| `text` | `#eef8fb` | **`#132025`** |
| `textMuted` | `#9db4bf` | **`#5f6c71`** |
| `accent` | `#1ad1c4` | **`#007870`** |
| `success` | `#56b93e` | **`#227b00`** |
| `warning` | `#f5b12b` | **`#8e6200`** |
| `error` | `#ff6b5e` | **`#c5342d`** |

## Verification — text roles, gate 4.5:1

| Role | Value | background | surface | surfaceRaised |
|---|---|---|---|---|
| `text` | `#132025` | 14.25 | 15.88 | 16.65 |
| `textMuted` | `#5f6c71` | 4.64 | 5.17 | 5.43 |
| `success` | `#227b00` | 4.60 | 5.13 | 5.38 |
| `warning` | `#8e6200` | 4.61 | 5.14 | 5.39 |
| `error` | `#c5342d` | 4.60 | 5.13 | 5.38 |

## Verification — affordance roles, gate 3:1

| Role | Value | background | surface | surfaceRaised |
|---|---|---|---|---|
| `borderStrong` | `#78898b` | 3.12 | 3.48 | 3.65 |
| `accent` | `#007870` | 4.58 | 5.11 | 5.36 |

`border` is `#cddadb` at 1.37:1 on surface — **deliberately
below 3:1**, decorative dividers only, same rule as the dark theme.

## Two decisions you asked me to make explicitly

### 1. Yes — the theme's `accent` role is a dark teal on light grounds

`#1ad1c4` measures **1.71–1.92:1** on every light ground. It is unusable as text *and* as a
fill or stroke. The light theme's `accent` role is **`#007870`**.

Three reasons for that specific value:

- **It is hue-identical to the brand accent.** OKLCH hue 186.7 vs `#1ad1c4`'s 186.8. The two
  themes seed from the same hue, which is what makes them read as a pair.
- **It is already the colour your dark theme resolves to** for fills (`primaryShade.dark = 5`).
  The same teal appears as the filled-button colour in both themes — one colour, not two.
- **It is directly usable**: 4.58:1 as text on the page, 5.36:1 under a white label as a fill.

**Note a small correction to the brand table.** `COLOR-SPEC.md` §3 lists *accent on light* as
`#007a70`, which I hand-derived. Your generated `#007870` is **hue-truer** (186.7 vs 184.9) and
within ΔE ≈ 1. Align the brand token to `#007870` so brand and product use one teal. That is a
change to my §3, not to your code.

### 2. `#e8f7fc` was a stand-in — do not copy it

It was never a light surface. It was an early value for the *dark theme's text* colour, which I
reused as a measurement ground in the ink-safe table. Using it as a light background would be an
accident of that table's construction. The grounds above are chosen for this theme.

## Ground ordering — do not invert the dark theme

Elevation reads **lighter in both themes**. In the dark theme `background` is the darkest of the
three and `surfaceRaised` the lightest; the light theme keeps that ordering:

| | background | surface | surfaceRaised |
|---|---|---|---|
| Dark | `#08141b` | `#102530` | `#1a3542` |
| Light | `#e9eef1` | `#f7fafb` | `#ffffff` |

A naive "invert the dark theme" would put the page at `#ffffff` and popovers at the darkest value,
which reverses the elevation metaphor — cards would recede instead of lifting.

**Consequence worth knowing:** the light grounds sit 1.11:1 and
1.05:1 apart. That is normal for light themes but it means
`border` carries more of the separation than it does on dark. `border` was widened accordingly
(`#cddadb`, 1.37:1 on surface) — visible, still decorative.

## Sibling check — hue kinship

| Role | Light | Dark | Hue delta |
|---|---|---|---|
| `accent` | `#007870` | `#1ad1c4` | 0.1° |
| `success` | `#227b00` | `#56b93e` | 0.1° |
| `warning` | `#8e6200` | `#f5b12b` | 0.6° |
| `error` | `#c5342d` | `#ff6b5e` | 0.1° |

Status colours are hue-locked to their dark siblings and darkened only until they clear AA on the
page. Derivation is **gamut-mapped** (reduce chroma, hold L and H) — without that the amber drifts
14.8° and reads brown. Same rule you implemented in F; it applies to hand-derivation too.

## What I have not authored

`info`, `accentGreen`, `accentPurple` — deliberately omitted, so the pair stays symmetric with the
dark theme, which does not author them either. Add them to both or neither.

## Labels on accent fills

An asymmetry worth encoding, because it differs between the two themes:

- **Light:** `accent` is directly usable as a fill. White label on `#007870` = 5.36:1.
- **Dark:** `accent` is *not* usable as a fill. White on `#1ad1c4` is 1.92:1 and `text` on it is
  1.77:1. The fill must resolve through the rung — which is what `primaryShade.dark` already does.

Labels on accent fills are **white in both themes**. Do not use the `text` token on an accent fill
in the light theme; it measures 3.11:1.

---

# Separate finding — a defect in the shipped dark theme

Not part of this request, but it surfaced while cross-checking every pairing.

**`borderStrong` `#577577` is 2.58:1 on `surfaceRaised` `#1a3542`** — below the 3:1 bar you are now
gating with `auditThemeContrast`. I originally verified it against `surface` (3.17:1) and never
against `surfaceRaised`. Any input or focusable edge inside a menu or popover is under-contrast today.

| | on background | on surface | on surfaceRaised |
|---|---|---|---|
| `#577577` (current) | 3.74 | 3.17 | **2.58** ✗ |
| `#648284` (fix) | 4.50 | 3.81 | **3.11** ✓ |

`#648284` is the lightest value on the *same hue* (0.0° delta) that clears 3:1 against all three
dark grounds, and it stays distinct from `border` `#22414f` at 2.62:1 between them.

Worth checking whether the same omission affects other bundled themes — the pattern is "verified
against surface, never against surfaceRaised", and it would not show up in any test that only
samples one ground.
