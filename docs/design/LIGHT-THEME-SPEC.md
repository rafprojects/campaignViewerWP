# Mullion — Rig Cyan Light, v2

**v2, 2026-08-31.** v1 was the designer's proposal for a light companion to the shipped Rig
Cyan dark theme. The proposal shipped in P75-G as theme **`default-light`** ("Mullion Light",
[`packages/theme-engine/src/definitions/default-light.json`](../../packages/theme-engine/src/definitions/default-light.json)),
so v2 describes the built theme. All values below are re-measured against the shipped hexes
and the shipped `resolveColors()` — nothing is proposed, and nothing is modelled.

## The roles as authored

| Role | Dark (`default-dark`) | Light (`default-light`) |
|---|---|---|
| `background` | `#08141b` | `#e9eef1` |
| `surface` | `#102530` | `#f7fafb` |
| `surfaceRaised` | `#1a3542` | `#ffffff` |
| `border` | `#22414f` | `#cddadb` |
| `borderStrong` | `#648284` | `#78898b` |
| `text` | `#eef8fb` | `#132025` |
| `textMuted` | `#9db4bf` | `#5f6c71` |
| `primary` (accent seed) | `#1ad1c4` | `#007870` |
| `primaryShade` | `{light: 6, dark: 5}` | `{light: 6, dark: 5}` |
| `success` | `#56b93e` | `#227b00` |
| `warning` | `#f5b12b` | `#8e6200` |
| `error` | `#ff6b5e` | `#c5342d` |
| `accent` | `#1ad1c4` | `#007870` |

Engine-derived roles (not authored; resolved at startup):

| Derived role | Dark resolves to | Light resolves to |
|---|---|---|
| `surface2` | `#132a36` | `#fafcfc` |
| `surface3` | `#17303c` | `#fcfdfe` |
| `textMuted2` | `#b9cbd4` | `#435055` |
| `primaryFill` | `#007870` (ramp index 5) | `#006e66` (ramp index 6) |
| `primaryStroke` | `#008e85` (index 4) | `#006e66` (= fill; it already clears 3:1) |
| `primaryOnFill` | `#ffffff` | `#ffffff` |

Optional accents: `default-dark` authors `info` `#1ad1c4`, `accentGreen` `#56b93e`,
`accentPurple` `#a855f7`. `default-light` authors none of the three; the engine's fallbacks
resolve them to `#007870` (info ← primary), `#227b00` (accentGreen ← success), and `#a855f7`
(accentPurple ← its built-in default). No component currently reads any of the three — the
JSON's own comment records this as the reason light leaves them to the fallbacks. This
asymmetry is flagged in the open note to the designer.

## Verification — as gated in CI, measured

Both blocking audits pass with zero failures. The pairings below are the ones the audits
model (i.e. the ones the adapter actually paints), measured on `default-light`:

**Text (WCAG AA, 4.5:1 gate):**

| Pairing | Ratio |
|---|---|
| text on background / surface / surface2 / surface3 | 14.25 / 15.88 / 16.17 / 16.35 |
| textMuted on surface / surface3 | 5.17 / 5.33 |
| textMuted2 on surface / surface2 | 7.95 / 8.10 |
| white button label on primaryFill `#006e66` | 6.14 |

**Non-text affordances (WCAG 1.4.11, 3:1 gate):**

| Pairing | Ratio |
|---|---|
| primaryStroke on surface / surface2 / surfaceRaised | 5.85 / 5.96 / 6.14 |
| borderStrong on surface / surface2 / surfaceRaised | 3.48 / 3.55 / 3.65 |

Additional pure-math checks (not audit pairs, still true): `text` clears 14.25 on the page;
`textMuted` `#5f6c71` is 4.64 on `background`; the status colours `#227b00` / `#8e6200` /
`#c5342d` measure 4.60–4.61 on `background` and 5.13–5.14 on `surface` as text. `border`
`#cddadb` is 1.37:1 on `surface` — **deliberately below 3:1**, decorative dividers only,
same rule as the dark theme.

## The accent on light grounds

`#1ad1c4` measures 1.64:1 on the light `background` and 1.92:1 on white — unusable as text,
fill, or stroke. The light theme therefore seeds from **`#007870`**, and the reasons v1 gave
still hold, measured:

- **Hue-identical to the brand accent**: OKLCH 186.7° vs `#1ad1c4`'s 186.8°. The two themes
  read as a pair because they seed from one hue.
- **It is the dark theme's own fill**: dark `primaryShade` index 5 resolves to exactly
  `#007870`.
- **Directly usable**: 4.58:1 as text on `background`, 5.11 on `surface`, 5.36 on white.

**One nuance v1 could not have known** (the light ramp did not exist yet): the light theme's
*filled controls* do not paint `#007870` itself. The seed expands to a light-scheme OKLCH
ramp, `#007870` is not one of its rungs, and the shade criterion — first rung clearing 4.5:1
on the ink ground *and* under white — resolves to index 6, **`#006e66`** (rung 5, `#1f867d`,
fails at 4.41 under white). So dark buttons are `#007870` and light buttons `#006e66`:
ΔE ≈ 3.5, hue 186.1° vs 186.7°, and *better* label contrast (6.14 vs 5.36). The `accent`
token and the brand value remain `#007870`. Flagged for the designer's confirmation in the
open note; the criterion, not a hand, picked the value.

## Ground ordering — do not invert the dark theme

Elevation reads **lighter in both themes**. In the dark theme `background` is the darkest of
the three grounds and `surfaceRaised` the lightest; the light theme keeps that ordering:

| | background | surface | surfaceRaised |
|---|---|---|---|
| Dark | `#08141b` | `#102530` | `#1a3542` |
| Light | `#e9eef1` | `#f7fafb` | `#ffffff` |

A naive "invert the dark theme" would put the page at `#ffffff` and popovers at the darkest
value, reversing the elevation metaphor — cards would recede instead of lifting.

**Consequence worth knowing:** the light grounds sit 1.11:1 and 1.05:1 apart. That is
normal for light themes, but it means `border` carries more of the separation than it does
on dark. `border` was widened accordingly (`#cddadb`, 1.37:1 on surface) — visible, still
decorative.

## Sibling check — hue kinship (OKLCH, measured)

| Role | Light | Dark | Hue delta |
|---|---|---|---|
| `accent` | `#007870` (186.7°) | `#1ad1c4` (186.8°) | 0.1° |
| `success` | `#227b00` (140.1°) | `#56b93e` (140.0°) | 0.1° |
| `warning` | `#8e6200` (78.0°) | `#f5b12b` (78.6°) | 0.6° |
| `error` | `#c5342d` (27.8°) | `#ff6b5e` (27.7°) | 0.1° |

Status colours are hue-locked to their dark siblings and darkened only until they clear AA
on the page. Derivation is gamut-mapped (reduce chroma, hold L and H) — without that the
amber drifts ~15° and reads brown. The shipped generator applies the same rule to every ramp
rung (`mapOklchToSrgbHex()`).

## Labels on accent fills

An asymmetry worth encoding, because it differs between the two themes:

- **Light:** the fill is `#006e66`; white label = 6.14:1.
- **Dark:** the raw accent is *not* usable as a fill — white on `#1ad1c4` is 1.92:1 and
  `text` on it is 1.77:1. The fill resolves through the shade to `#007870`; white label =
  5.36:1.

Labels on accent fills are **white in both themes** (`primaryOnFill` resolves to white in
both). Do not use the `text` token on an accent fill — on the light fill it measures 2.71:1.

## The v1 defect report — resolved

v1 surfaced a real defect in the then-shipped dark theme: `borderStrong` `#577577` measured
2.58:1 on `surfaceRaised`, below the 3:1 bar, because it had only ever been verified against
`surface`. All three parts of the fix shipped in P75-G:

| | on background | on surface | on surfaceRaised |
|---|---|---|---|
| `#577577` (old) | 3.74 | 3.17 | **2.58** ✗ |
| `#648284` (shipped) | 4.50 | 3.81 | **3.11** ✓ |

The pattern — "verified against surface, never against surfaceRaised" — was also closed
structurally: `deriveBorderStrong()` and the `auditUiContrast` CI gate both sample
`surface2` and `surfaceRaised` alongside `surface`, for all 23 bundled themes.


---

## Designer response — 2026-09-01

Reviewed against the shipped values. **Every number in this document was re-measured
independently and all 14 spot-checked pairings matched to two decimal places.** Two additions.

### The one-rung fill split is confirmed — accept it

`#006e66` for light filled controls is right, and the reasoning in the section above is the
reasoning I would have used. Three things settle it:

- The criterion selected it, and the criterion is the thing we agreed to trust over any
  authored index.
- Label contrast **improves**: 6.14:1 against the dark theme's 5.36:1.
- The visible difference is smaller than the paperwork suggests. ΔE ≈ 3.5 is on the **CIE Lab**
  scale; on the OKLab scale used elsewhere in these documents the same pair is **0.032** — far
  below the ~0.10 threshold where two colours stop reading as one. Hue moves 0.6°.

Two teals in the system is a documentation problem, not a perception problem. Nobody will see
`#007870` and `#006e66` side by side and read them as different colours.

> **Pin the ΔE unit wherever one appears.** These documents now carry ΔE figures on two
> different scales — CIE Lab here, OKLab in `COLOR-SPEC.md`'s migration table. They differ by
> roughly 100×. An unlabelled ΔE is worse than no ΔE.

### `accentPurple` is not a symmetric omission — it is the one unsafe fallback

The v1 advice ("author all three or none") was too coarse. Measured, the three fallbacks do not
carry equal risk on light grounds:

| Role | Light fallback | on `background` | on `surface` | on `surfaceRaised` | As text |
|---|---|---|---|---|---|
| `info` ← primary | `#007870` | 4.58 | 5.11 | 5.36 | passes |
| `accentGreen` ← success | `#227b00` | 4.60 | 5.13 | 5.38 | passes |
| **`accentPurple`** ← built-in | **`#a855f7`** | **3.38** | **3.77** | **3.96** | **fails 4.5:1 on all three** |

`#a855f7` is a value inherited from the retired Instrument Blue palette. It clears 3:1, so it is
safe as a fill or a stroke, but it fails as text on every light ground. It is only harmless
because nothing paints it — which is exactly the condition that changes without anyone noticing.

**Recommendation:** leave `info` and `accentGreen` to the fallbacks, and author
`accentPurple: #923bde` on `default-light` only. That value is hue-locked to `#a855f7`
(303.9°, 0.0° delta) and measures **4.60 / 5.13 / 5.38** — the same profile as the other two.
One authored value, not three, and it closes the only real gap.
