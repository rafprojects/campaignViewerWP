# Notes accompanying the v2 design docs — items needing your eyes

2026-08-31. We rewrote `COLOR-SPEC.md`, `LIGHT-THEME-SPEC.md`, and `DESIGN_BRIEF.md` as v2
documents describing the shipped system; every number in them is measured against the code.
Five things either changed since your last look or need a decision from you. Nothing here is
urgent for the product — it all passes the gates as shipped — but three items are
confirmations we'd rather have than assume.

## 1. The light theme's filled controls are `#006e66`, one rung darker than `#007870`

Your light spec chose `#007870` partly because it is the colour the dark theme resolves to
for fills — one teal, not two. That holds for the *token*: light `accent` and `primary` are
`#007870`, and the brand value is unchanged. But the shipped engine expands `#007870` into a
light-scheme OKLCH ramp, `#007870` itself is not a rung of that ramp, and the shade
criterion (first rung clearing 4.5:1 on the ink ground and under white) resolves to
**`#006e66`** — the next rung, `#1f867d`, fails under white at 4.41:1. So:

- dark filled buttons: `#007870`, white label 5.36:1
- light filled buttons: `#006e66`, white label 6.14:1
- ΔE between the two fills ≈ 3.5; OKLCH hue 186.1° vs 186.7°

The criterion picked this, not a hand, and the label contrast improved. **Please confirm the
one-rung split is acceptable**, or tell us what you'd rather see — noting that no authored
index can put `#007870` itself on the light ramp, so the alternatives are "accept" or
"rethink the light seed".

## 2. Optional accent roles are authored asymmetrically

Your light spec said `info` / `accentGreen` / `accentPurple` should be added "to both or
neither". The shipped state is neither of those: `default-dark` authors all three (`info`
`#1ad1c4`, `accentGreen` `#56b93e`, `accentPurple` `#a855f7`); `default-light` authors none,
and the engine's fallbacks resolve them to `#007870` / `#227b00` / `#a855f7`. Two mitigating
facts: the fallbacks land on sensible light-side values, and **no component currently reads
any of the three roles** — they are schema slots, not painted colours. We left the asymmetry
because authoring dead values felt worse than deriving them. Flag if you disagree; making
light author all three explicitly is a two-minute change.

## 3. The default hover-glow colour is now the brand teal

The per-gallery "hover glow" effect (user-configurable) previously defaulted to a periwinkle
blue; the shipped default is **`#1ad1c4`**, the brand accent. This is on brand by
construction, but since it appears over user imagery it is a taste call you may want to see
in situ. FYI unless you object.

## 4. Deferred design decision: two-tone focus ring

The focus ring now draws in the contrast-selected accent rung and clears 3:1 on all 23
bundled themes. Deferred to the backlog: adding a Chrome/Firefox/GitHub-style **two-tone
ring** (brand-coloured core + contrasting halo), which would make the ring robust for
*user-authored* themes no build-time audit can see. Engineering has it scoped; the open
question is whether the thicker two-tone footprint suits the product's restrained look.
An opinion is welcome whenever you next look at the running product — no deadline.

## 5. Confirmations we still owe each other

- **Trademark:** last word from you was "holding on trademark clearance". Any movement? It
  gates final assets and nothing else on our side.
- **Screenshot order:** the brief recommends leading with the Layout Builder; the shipped
  manifest still leads with the classic grid. Needs a sign-off one way or the other (we then
  update `readme.txt` captions and `STORE_ASSETS.md` together).
- **Freemius icon limits:** the 300×300 / ≤200KB constraint in the brief is
  community-reported, not documented by Freemius — we will confirm it against the developer
  dashboard at upload time; a 300×300 PNG under 200KB is safe regardless.

## One correction to our own v1 record

The v1 brief described caption chips as fixed black (`rgba(0,0,0,0.7)`) with white text.
The shipped chips are pill-shaped translucent mixes of the active theme's own tokens, so
chrome tints with the theme. The v2 brief's "visual signature" section now describes what
actually renders — worth a skim before banner work, since the banner should feel like the
product.
