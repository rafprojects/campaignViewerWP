# Mullion — colour spec (Rig Cyan)

Two separate artifacts with two different consumers. Don't merge them.

## 1. Theme tokens — what the plugin consumes

See `mullion-dark.theme.json`. Eleven roles, **one accent**. Everything else
is generated. There is no second accent hex, deliberately.

| Role          | Hex       | Use                    |
|---------------|-----------|------------------------|
| background    | `#08141b` | page ground            |
| surface       | `#102530` | cards, panels          |
| surfaceRaised | `#1a3542` | menus, popovers        |
| border        | `#22414f` | decorative dividers    |
| borderStrong  | `#648284` | input outlines, focusable edges (was `#577577` — 2.58:1 on `surfaceRaised`) |
| text          | `#eef8fb` | body copy              |
| textMuted     | `#9db4bf` | secondary copy         |
| accent        | `#1ad1c4` | brand + interactive    |
| success       | `#56b93e` | confirmations          |
| warning       | `#f5b12b` | cautions               |
| error         | `#ff6b5e` | failures               |

All 18 text/ground pairings clear WCAG AA 4.5:1. Verified, not estimated.

**Two border tokens on purpose.** `border` is 1.46:1 and that is correct —
WCAG 1.4.11 exempts decorative dividers. `borderStrong` clears 3:1 for borders
that *are* the affordance. A gate testing all borders at one threshold will be
wrong in one direction or the other.

## 2. `primaryShade` — the answer to the "ink-safe" question

Not a second hex, and **not a new field**. Use the existing `primaryShade` that every theme
JSON already carries. (An earlier revision of this spec proposed `accentFillRung`; that was a
mistake — a second field for a job an existing field already does. There is no
`accentFillRung`.) Select its value by criterion:

> the first rung from the dark end that clears 4.5:1 against the theme's
> lightest surface AND 4.5:1 under white text

Against the OKLCH ramp from `#1ad1c4` this resolves to `#007870` (your generated value):
4.76:1 on `#e8f7fc`, 5.23:1 under white. Specify the criterion, not the value —
it then survives any change to the generator.

**Caveat:** rung indices only transfer if the ramp is generated in OKLCH. An
HSL-stepped ramp puts different colours at those indices.

## 3. Brand colours — surfaces the theme system never sees

WordPress.org listing, Freemius opt-in, banners, marketing, docs.

| Role            | Hex       | Note                                    |
|-----------------|-----------|-----------------------------------------|
| brand ground    | `#08141b` | banner and icon tile                    |
| brand accent    | `#1ad1c4` | on dark grounds only                    |
| accent on light | `#007870` | hue 186.7 vs brand 186.8 — hue-truer than the earlier `#007a70` (184.9) and identical to the value the dark theme resolves to for fills |
| wordmark ink    | `#0d1b23` | wordmark on light grounds               |

The bright accent fails on white (1.92:1). Any accent-coloured text or icon on a
light ground uses `#007870`. This is a brand rule, not a theme token — but the light
theme's `accent` role is the same value, deliberately, so brand and product share one teal.

## 4. Status rule

Status must never be carried by colour alone — icon plus text, always
(WCAG 1.4.1). This holds regardless of hue separation and is the reason the
success/accent adjacency is not worth over-engineering.

## Open questions back to engineering

1. Is the ramp generated in OKLCH or HSL? Determines whether rung 600 transfers.
2. Does admin chrome re-theme with the gallery? If so, brand recognition is lost
   on the one screen agencies see daily.
3. Is Layout Builder selection drawn in the theme accent? If so, handles vanish
   against imagery in the same hue.

---

# Addendum — round 3 (engineering response)

## `ink-safe` — confirmed, nothing unmet

Text-safety on light grounds was its **entire** purpose. No fill role, no
background role. Dropping it costs nothing; the generated ramp covers every
in-product use. The only residual need is in brand assets (white surfaces the
theme engine never renders) and is already specified in §3 above as `#007870`.

## Chrome-locking toggle — name and default

Specify as **one** name with **one** default:

    applyThemeEverywhere: false

The round-2 reply described "a setting (default off) that locks chrome to brand
*by default*", which names two different settings sharing one default. As
written an implementer ships the inverse of the intent.

## Panel chrome — superseded, see round 4

The audit previously printed here measured each theme's **raw accent**. That was wrong: the code
draws `colors.primary[5]`, a ramp rung — and `[5]` is hardcoded, ignoring the `primaryShade`
each theme authors. Sunset Boulevard, flagged here as failing at 2.26:1, actually **passes** at
3.73:1 once its authored shade is used.

Correct sequence, per the design brief's Engineering follow-ups:

1. Fix the hardcoded `[5]` — a plain defect, unrelated to contrast.
2. Audit every surface (21+ further admin CSS sites, plus the front-end embed). Tracked P75-E.
3. Repair only what still fails, by criterion: keep the authored shade where it clears 3:1
   against its own surface; only where it doesn't, step to the nearest rung that does.

Classify before repairing — the 3:1 bar applies to a border that is the *sole* indicator of
state. Decorative hover borders are exempt; focus rings are non-negotiable.

## OKLCH migration — gamut-map, or it regresses

OKLCH describes colours sRGB cannot display. Holding chroma constant and
stepping lightness — the obvious implementation — puts light rungs of a
high-chroma accent out of gamut, and channel clipping **shifts hue**. HSL at
least stays in gamut by construction, so a naive OKLCH port can be *worse* than
what it replaces.

Cyberpunk `#ff2d95` (C=0.249), naive constant-chroma stepping:

| L    | naive clip | hue drift | gamut-mapped | hue drift |
|------|------------|-----------|--------------|-----------|
| 0.95 | `#ff9af0`  | **24.8°** | `#ffe7ee`    | 0.7°      |
| 0.88 | `#ff82d9`  | 17.2°     | `#ffc5d8`    | 0.2°      |
| 0.78 | `#ff5db9`  | 8.5°      | `#ff8eb8`    | 0.1°      |
| 0.68 | `#ff3499`  | 0.9°      | `#ff4199`    | 0.1°      |

**Fix (~15 lines):** before emitting a rung, test whether `oklch(L, C, H)` is
inside sRGB; if not, binary-search C downward holding L and H fixed. Keeps drift
under 1° at every rung. The chroma taper used for the Rig Cyan ramp is a
cosmetic refinement on top — optional. Gamut mapping is not.


---

# Addendum — round 5

## The OKLCH migration is NOT backwards-compatible with existing `primaryShade` values

This couples two workstreams that look sequential. A `primaryShade` index does not name a
colour — it names a position in a ramp — so **changing the ramp space silently changes what every
existing index resolves to.** 16 of 23 shipped themes set a non-default `primaryShade`. Migrating
the generator without re-deriving those values recolours every one of them.

Illustrative, same index, both spaces. **Only the Rig Cyan HSL value is measured** (from
`generateColorScale()`); the rest of the HSL column and the whole OKLCH column are modelled and
should be re-measured after P75-F — see *How to read the numbers* at the foot of this file.

| Accent | Index | HSL today | OKLCH after | Shift |
|---|---|---|---|---|
| `#1ad1c4` (Rig Cyan) | 6 | `#149f95` *(measured)* | *pending P75-F* | — |
| `#15803d` (forest-whisper) | 6 | *modelled* | *modelled* | large |
| `#fe8019` (gruvbox) | 6 | *modelled* | *modelled* | large |
| `#7aa2f7` (tokyo-night) | 6 | *modelled* | *modelled* | visible |

The exact magnitudes are not the point and were not reliable. The point is structural and holds
regardless: **an index names a position in a ramp, not a colour**, so re-deriving the ramp changes
what every stored index resolves to. That is true for any lightness stops you pick.

**Recommendation:** treat the migration as a data migration, not just an algorithm change.
Re-derive every theme's `primaryShade` by criterion against the new ramp in the same change that
swaps the generator. A regression test asserting *"for every shipped theme, the resolved
`primaryShade` colour clears its intended contrast bar"* will catch this and any future
recurrence.

Mullion's own `primaryShade` is therefore **not set** — the theme JSON carries a `_primaryShade`
note instead of a value, so nothing wrong can be copied out of it.

**Correction to an earlier revision of this file.** It claimed index 6 yields `#1ce3d5` at 1.47:1
and that the criterion resolves at index 9 under HSL. Both were wrong — they came from a
re-implementation of the ramp, not from `generateColorScale()`. Measured against the real
function:

| Index | Colour | on `#e8f7fc` | under white | Criterion |
|---|---|---|---|---|
| 6 | `#149f95` | 2.98:1 | 3.27:1 | fails |
| 7 | `#0f7971` | 4.79:1 | 5.26:1 | **clears** |

So under the current HSL generator the answer is **index 7**, not 9. The OKLCH answer is not yet
derivable at all — it depends on lightness stops that have not been chosen.

**Express the value as an array index, not a rung name.** Earlier drafts used Tailwind-style names
(50/100/…/950). Those collide with array indices at both ends — name `50` is index 0, name `950`
is index 10 — and the code indexes an array. Indices only.

## `borderStrong` must not fall back to `border`

Optional-with-fallback is the right shape, but the fallback target matters. Aliasing
`borderStrong` to `border` reinstates exactly the failure the field exists to prevent:

| | on surface `#102530` | |
|---|---|---|
| `borderStrong` `#648284` | 3.81:1 | pass (was `#577577` at 3.17:1 — still passed here, but failed on `surfaceRaised`) |
| `border` `#22414f` | **1.46:1** | **fail** — what an alias would silently give you |

`surfaceRaised` falling back to `surface` is harmless — the UI just reads flatter. `borderStrong`
falling back to `border` is an accessibility regression wearing a fallback's clothing.

**Derive it instead.** Step the surface's own lightness toward mid-grey until it clears 3:1,
holding hue and easing chroma slightly. Verified across light and dark surfaces:

| Theme surface | Derived `borderStrong` | Ratio |
|---|---|---|
| `#102530` (Rig Cyan) | `#5b707c` | 3.05 |
| `#1a1b26` (tokyo-night) | `#6e6f7c` | 3.44 |
| `#fffbeb` (sunset-blvd) | `#8c887b` | 3.42 |
| `#f3f5f4` (forest-whisper) | `#818382` | 3.49 |

Themes that author the field explicitly override the derivation; themes that don't get something
that passes rather than something that doesn't.


---

# How to read the numbers in this document

Two categories, with different reliability. Worth knowing which is which before acting on one.

**Reproduces exactly — pure colour math on fixed hex values.** Contrast ratios, ΔE, hue angles,
the derived `borderStrong` values. These depend on nothing but the hexes and the WCAG/OKLab
formulae, and every one checked against the product team's own measurements has matched to two
decimal places.

**Does not reproduce — anything that models the plugin's own code.** Ramp output, shade indices,
which colour a given theme actually draws. These require assumptions about `generateColorScale()`
and the surfaces it renders onto, and have now been wrong three times: the panel-chrome audit
(measured the raw accent; the code draws a ramp rung), the fill/stroke gap table (approximated
panel surfaces), and the HSL index claim above.

**Rule:** treat any number in this spec that depends on the generator as an illustration of the
shape of a problem, and measure it in the codebase before it becomes a value. Numbers that are
purely a function of stated hex values can be used directly.

The OKLCH-side figures still in this document — the Cyberpunk gamut-drift table and the ΔE
migration table — fall in the second category. They assume lightness stops for the new generator
that have not been chosen, so they demonstrate that the hazards are real without predicting the
values. Re-measure both once P75-F is implemented.


---

# Rig Cyan Light

Full derivation, verification and rationale in `LIGHT-THEME-SPEC.md`. Summary:

| Role | Dark | Light |
|---|---|---|
| `background` | `#08141b` | `#e9eef1` |
| `surface` | `#102530` | `#f7fafb` |
| `surfaceRaised` | `#1a3542` | `#ffffff` |
| `border` | `#22414f` | `#cddadb` |
| `borderStrong` | `#648284` | `#78898b` |
| `text` | `#eef8fb` | `#132025` |
| `textMuted` | `#9db4bf` | `#5f6c71` |
| `accent` | `#1ad1c4` | `#007870` |
| `success` | `#56b93e` | `#227b00` |
| `warning` | `#f5b12b` | `#8e6200` |
| `error` | `#ff6b5e` | `#c5342d` |

- `accent` on light is **`#007870`** — the raw brand cyan is 1.71–1.92:1 on light grounds and
  unusable as text, fill or stroke.
- Elevation reads lighter in **both** themes: `background` is the darkest of the three in each.
  Do not invert the dark stack.
- Labels on accent fills are **white** in both themes (5.36:1 light).
  The `text` token on an accent fill is 3.11:1 — do not use it.
- Status colours are hue-locked to their dark siblings (≤0.6° delta) and gamut-mapped.
- `info` / `accentGreen` / `accentPurple` authored in neither theme. Add to both or neither.

**Correction carried into §1 above:** the dark `borderStrong` was `#577577`, which measures
2.58:1 on `surfaceRaised` — below the 3:1 affordance bar. Replaced with `#648284` (same hue,
3.11:1 on `surfaceRaised`).
