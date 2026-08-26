P75-D/E/F have landed, so this is the follow-up we said we'd send once the spec was actually built rather than planned.

## What shipped (measured, not modelled)

**Chrome lock (D).** `applyThemeEverywhere` defaults to false. Settings Panel and Layout Builder chrome stay on Mullion / Rig Cyan. The public gallery still follows the selected theme. Your question 2 is answered: admin chrome does not re-theme with the gallery unless someone turns that on.

**OKLCH ramp (F).** `generateColorScale` now steps OKLCH lightness and gamut-maps by reducing chroma, holding L and H. The Cyberpunk L=0.95 clip case is `#ffe7ee` (0.7°), not the naive `#ff9af0` (24.8°). Rig Cyan `primaryShade` is a live index against that ramp, not a note: `{ light: 6, dark: 5 }`, dark fill `#007870`. ΔE against brand `#007a70` is about 1. Criterion, not a copied rung name. Your question 1 is answered: OKLCH, so the criterion transfers; we still do not store Tailwind-style 50/100/…/950 names.

**1.4.11 (E + H).** Hardcoded `primary[5]` is gone — fills use the authored shade. Checkbox / Switch outlines use `borderStrong`. The fill-vs-stroke split is real: `primaryShade` answers 4.5:1 under white text; that same rung often fails 3:1 as a thin stroke on a dark panel. Two roles, not one. Rig Cyan fill `#007870` on surface `#102530` is **2.95:1**; stroke steps one rung to `#008e85`. 13 of 23 bundled themes need that split after the OKLCH ramp; light themes mostly already pass. Hover borders that also move/shadow stayed decorative. Builder active-panel outline and drag-over border use the stroke token, not the raw accent.

Nothing from the built result looks like it needs a re-review of the dark palette. Holding as you were on trademark.

## The remaining ask — Rig Cyan light

The Default group in the theme picker is **Mullion (Rig Cyan dark)** next to **Default Light**, which is still the retired Instrument Blue (`text` `#0f172a`, `primary`/`accent` `#3b82f6`). Switching default dark ↔ light is a brand change, not a scheme change. We left `default-light.json` untouched on purpose in P74-N rather than guess a light companion.

**Please send a light 11-role spec**, same roles as COLOR-SPEC.md §1:

| Role | Dark (already shipped) | Light (needed) |
|---|---|---|
| background | `#08141b` | |
| surface | `#102530` | |
| surfaceRaised | `#1a3542` | |
| border | `#22414f` | |
| borderStrong | `#577577` | |
| text | `#eef8fb` | |
| textMuted | `#9db4bf` | |
| accent | `#1ad1c4` | |
| success | `#56b93e` | |
| warning | `#f5b12b` | |
| error | `#ff6b5e` | |

Optional, only if you want them authored rather than derived/fallen-back: `info`, `accentGreen`, `accentPurple`.

## What not to send

- **No `primaryShade` index.** We derive it from the criterion against the OKLCH ramp in the same commit as the overwrite. An index you pick against a modelled ramp will be wrong the same way the dark one was before F.
- **No Tailwind rung names** (50/100/…/950). Array indices only if you mention a ramp position at all, and even then we will re-derive.
- **§3 brand rules are not enough on their own.** `accent on light` `#007a70` and `wordmark ink` `#0d1b23` stay brand/marketing tokens. They do not fill a theme. If you want the *theme's* `accent` role to be `#007a70` on light grounds (because `#1ad1c4` is 1.92:1 on white), say so explicitly — that is a theme decision, not something we should infer from the brand table.
- **`#e8f7fc`** appeared in the dark-theme ink-safe table as a measurement ground. If that is a real light surface you already had in mind, use it. If it was only a stand-in, ignore it; we will not copy it into the file.

Same constraints as the dark spec: all text/ground pairings 4.5:1 (we will gate `auditThemeContrast`); `border` may sit below 3:1 for decorative dividers; `borderStrong` must clear 3:1 for affordance edges. Status still icon plus text.

## If you'd rather not

Say so. We will stop calling Default Light the flagship counterpart, leave the Instrument Blue file as just another light theme, and close P75-G as won't-fix. We will not invent a Rig Cyan light and put it in git.

Either way is a complete answer. Hexes we can ship; a decline we can document. A guess we cannot.
