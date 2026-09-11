# Focus ring — signed off. Ship it as built.

**2026-09-11.** Reply to `focus-ring-notes-for-designer-2026-09-10.md`.

**Verdict: signed off, no changes.** All three of your questions resolve the same way — keep what
you built. On question 2 I am asking you *not* to make the change you were leaning toward, and the
rest of this document is the evidence for that, because your instinct is reasonable and the reason
it is wrong is not visible from the table you sent.

Seen in situ on the dev site, in the shadow root, on the default dark theme.

---

## 0. Your table reproduces exactly, and so does everything under it

**All 23 `halo:core` pairs: zero mismatches.** Computed from your hex values, WCAG 2.1 relative
luminance. Nothing in the table needed correcting.

I then went further, because questions 1 and 2 both turn on surface values that are not in your
table. Each row gives two independent ratios against the same surface — `halo:surf` and
`core:surf` — so the surface luminance is over-determined and can be solved for. **It solves to
within 0.0009 on 22 of 23 rows**, and the two I can check against the locked palette land on the
nose:

| Theme | solved surface luminance | palette value | its luminance |
|---|---|---|---|
| default-light | 0.95102 | `#f7fafb` | 0.95110 |
| default-dark | 0.01646 | `#102530` | 0.01647 |

So the cost figures below are derived from *your* numbers, not from a model of your code. That
distinction matters given my record in this engagement — every time I have modelled what the
engine does rather than measured it, I have been wrong.

---

## 1. The five dark themes that flip to a dark halo — leave them. Your rule is better than mine.

**Signed off, and I want to be precise about why, because this is a case where you corrected me
without either of us noticing.**

My original instruction said: *light pole on dark themes, dark pole on light ones.* That is
wrong. It ties the pole to the colour scheme, and the pole is not a function of the scheme — it is
a function of **the core's lightness**. Darcula, Nord, Catppuccin Mocha, Tokyo Night and Gruvbox
Dark all have accents light enough that a white halo cannot separate from the core. Had you
implemented my rule literally, those five would have shipped with a halo that fails the pair
guarantee outright.

You implemented the correct generalisation — step toward whichever pole clears — and then
described it as "the fallback behaviour working exactly as designed," which undersells it. It is
not a fallback. It is the rule; my version was a special case of it that happened to hold on the
themes I had in front of me.

**On whether to close the inconsistency: no.** Three reasons.

**It is self-compensating, and the table shows it.** Those five carry `core:surf` of 4.10, 4.28,
4.34, 4.98 and 5.72 — the strongest core separation anywhere in the set, against a median of about
4.4 and a floor of 3.64. The themes where the halo does least against the surface are exactly the
themes where the core does most. The ring's visibility does not dip on those five; its *character*
changes, from bright-outline to dark-edge-plus-bright-core.

**There is no lever that closes it.** You are right that per-theme overrides reintroduce the
failure mode the derived halo exists to close, and I would reject them for that reason alone. The
only other derivation-level move would be to darken the core on those themes — but the core is
`primaryStroke`, a contrast-audited token the inputs and tabs already draw. Moving it to tidy the
focus ring would be the tail wagging the dog.

**Consistency across themes was never the promise.** The promise is that the ring is *always
visible*, on 23 shipped themes and on user-authored ones no audit can see. A user runs one theme.
They never see the comparison. What they would notice is a ring that fails on their theme — which
is what the flip prevents.

---

## 2. Do not raise the floor to 4:1. It makes the ring worse, and I can show you where.

This is the one I am pushing back on. Your framing is that the eight floor themes are *"the ramp
stopping at the first step that passes rather than continuing to a comfortable margin."* The
mechanism is right. The conclusion does not follow, because on those themes **there is no
comfortable margin to continue to.** They are not stopping early. They are near the end of the
ramp.

### The pole runs out

The most a halo can ever reach is pure white or pure black against that theme's core. Here is each
floor theme's actual ceiling on the pole it is currently using:

| Theme | pair now | ceiling on its pole | headroom |
|---|---|---|---|
| catppuccin-latte | 3.04 | **3.07** | **+0.03** |
| solarized-dark | 3.00 | 3.20 | +0.20 |
| solarized-light | 3.03 | 3.28 | +0.25 |
| ocean-breeze | 3.01 | 3.28 | +0.27 |
| synthwave | 3.13 | 3.45 | +0.32 |
| default-light | 3.02 | 3.42 | +0.40 |
| forest-whisper | 3.00 | 3.45 | +0.45 |
| material-light | 3.12 | 4.01 | +0.89 |

Seven of the eight cannot reach 4:1 at all on their current pole. Catppuccin Latte cannot reach
3.1.

**The highest global target reachable with zero pole flips is 3.07:1** — Catppuccin Latte is the
binding constraint. Any target above 3.07 forces at least one theme to change poles. That is not a
tuning parameter with room in it; 3:1 is sitting almost exactly on the system's ceiling, and the
one-line change has no quiet version.

### What the flips cost

At a 4:1 target, **eight of twenty-three themes are forced off their pole** — and it goes in both
directions, which is the part the table cannot show. Five light themes flip from a dark halo to a
white one:

| Theme | flip | `halo:surf` now | `halo:surf` after |
|---|---|---|---|
| default-light | dark → light | 17.66 | **1.05** |
| ocean-breeze | dark → light | 16.76 | **1.15** |
| catppuccin-latte | dark → light | 17.05 | **1.22** |
| forest-whisper | dark → light | 14.65 | **1.25** |
| solarized-light | dark → light | 15.86 | **1.23** |
| synthwave | light → dark | 14.83 | **1.28** |
| crimson-canvas | light → dark | 14.26 | **1.34** |
| solarized-dark | light → dark | 12.21 | **1.62** |

The default light theme's halo goes from 17.66 against its surface to **1.05** — a white halo on a
near-white surface. It stops being an edge. And it does that *while the pair contrast goes up*,
which is the whole trap: the number you would be optimising improves and the ring gets worse.

Even 3.5:1 costs seven flips. There is no safe increment.

**I rendered it rather than asserting it.** Attached: `focus-ring-proofs-2026-09-11.png`, second
half — the default-light chip as it ships, beside the same chip at a 4:1 target, at true size and
at 4×. On the right the outer boundary is simply gone; what survives is a single teal band floating
with no edge.

### The conceptual point underneath

`halo:core` is a **floor for function**, not a target for appearance. It guarantees the two tones
resolve as two tones. Once the pole is exhausted, pushing that number higher can only come out of
`halo:surf` — the number that actually makes the ring findable. Past 3.07 the two trade directly
against each other, and `halo:surf` is the one users experience.

One more thing worth saying plainly: **3.00 is not a thin pass.** These are fixed hex values in
exact arithmetic. There is no measurement error, no device variance, no rounding at the boundary.
3.00 is as compliant as 6.59 is. "Thin" is a word for measured quantities, and this is not one.

**Leave the target at 3:1.** If you ever do want more separation on the floor themes, the only
remaining lever is the core rung rather than the halo — and that is a change I would want to
measure before recommending, not one I would offer from here.

---

## 3. 2 / 2 / 2 — keep it. Measured on the tightest control you ship.

You asked me to judge weight in situ. I did.

**What it actually renders as**, read off the focused chip in the gallery header:

```
core   outline: 2px solid rgb(0,142,133)   = #008e85   ← spec'd default-dark core ✓
offset outline-offset: 2px                              ← 2 halo / 2 core / 2 halo ✓
halo   box-shadow: 0 0 0 6px rgb(237,245,251) = #edf5fb ← spec'd default-dark halo ✓
control  28 × 102 px
```

Geometry and both colours match the spec exactly. The chip is **28px tall**, which makes it the
tightest thing the ring has to sit on; 6px of ring on each side means the focused control occupies
40px against an unfocused 28px.

**On weight: it is at the top of the acceptable range and it should stay there.** I rendered the
alternatives at true size — see the first half of the attached proof sheet.

- **1/2/1** — the two-tone character is lost. At true size the inner band is not resolvable and the
  outer band is a hairline; it reads as a single teal ring with a light fringe, which is the
  ordinary single-tone ring you already had.
- **3/2/3** — reads as a white outline with a teal seam in it. The halo becomes the ring and the
  core becomes a detail.
- **2/2/2** — both bands resolve, and the core is still the dominant tone.

Two further reasons not to thin the halo:

**Fractional device pixel ratios.** Windows display scaling at 125% and 150% is the common case, not
the edge case. A 2px band lands on 2.5 or 3 device pixels and survives. A 1px band lands on 1.25 and
antialiases toward the surface behind it — it is the first thing to disappear, on exactly the
machines most of your users are on.

**The thing your own last section names.** You close by saying a control sitting on a user-chosen
gallery border or tile colour is outside what the halo can guarantee. Agreed — and that is precisely
what the *outer* halo band is for. It is the band that meets arbitrary colour. It is also the band
that gets thinned first in any weight reduction. Those two facts point the same way: 2px is the floor.

Note the trap in the proof sheet: at 4× the thinned ring looks perfectly fine. Ring weight cannot be
judged magnified. That is the same failure mode as the aperture icon at 16px, and it is why I
rendered both at true size.

---

## 4. One near-miss on my side, reported

While inspecting the ring I swept the page's stylesheets for the halo rule and found nothing — no
rule mentioning a halo, no two-layer focus shadow, every `:focus-visible` rule a stock Mantine 2px
outline. I was one step from writing to you that the ring was not deployed on the front end.

It is deployed. **The gallery mounts into a shadow root**, and I had been reading the host
document. Caught it on the sizes: the controls I could measure were tripling correctly under a zoom
I had applied to the host, which meant the host had children I could not see.

Reporting it because it would have been my fourth error of the same species — reasoning about your
code from outside it instead of measuring inside it — and because the near-miss says something
useful for anyone else auditing this plugin: **the gallery's CSS is not in the page.** Worth a line
in the dev notes.

---

## 5. Summary

| | |
|---|---|
| **Pole flip on five dark themes** | **Sign off.** Your derivation rule is correct and mine was not. Do not close the inconsistency. |
| **Raise pair floor to 4:1** | **Do not.** Ceiling is 3.07:1; at 4:1 eight themes flip and `halo:surf` collapses to 1.05–1.62. |
| **2 / 2 / 2 geometry** | **Sign off.** Verified in situ, exact match to spec. 2px is the floor on both bands. |

**The ring ships as built.** Nothing on my side is outstanding on it.

One note on method, since it applied twice here: both of my answers above came from taking your
figures and solving for something you had not sent — the surfaces in §0, the pole ceilings in §2.
Your table was checkable in a way that made that possible. That is what has kept this engagement
honest, and it is worth keeping when the next detail comes up.

---

**Attached:** `focus-ring-proofs-2026-09-11.png` — true-size and 4× renders of the three ring
weights on `default-dark`, and of the 4:1 cost on `default-light`.
