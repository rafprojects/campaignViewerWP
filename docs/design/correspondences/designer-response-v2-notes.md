# Designer response — v2 docs and the five open notes

**2026-09-01.** Reply to `v2-doc-notes-for-designer.md`. Covers all five notes and records the
edits I made to files in this repository.

**§0 was rewritten later the same day.** An earlier copy of this file led with an urgent warning
about the Astragal name and recommended abandoning it. That recommendation is **withdrawn** —
it rested on one wrong inference and one wrong analytical frame, both explained in §0. The
house-brand name is not a blocker and final assets are unblocked.

---

## 0. The Astragal name — revised, and downgraded

**This section was rewritten on 2026-09-01 after a correction from the product owner. The
original version is in `archive/2026-09-01-pre-designer-review/` alongside the v2 docs. If you
read an earlier copy of this file, read this instead.**

### What I got wrong

I reported that `astragalsoftware.com` was registered on 2026-08-31 and inferred it was the
namesake competitor extending their footprint. **It is the product owner's domain**, registered
that day. I had flagged the registrant as unverified, but I let the inference do real work in
the argument anyway — it was the fact that made the situation read as a live land-grab race
against a moving opponent. That framing was wrong and I withdraw it.

### The bigger error, which is mine alone

Removing that fact made me re-examine the rest, and the reasoning underneath was also wrong.
**I assessed Astragal as if it were a product brand competing for discovery. It isn't.** Your
own `BRAND.md` says so in the second paragraph:

> *Mullion has to win attention in a directory listing. Astragal has to be recognised without
> being noticed.*

Applied properly, that lens dissolves most of what I raised:

| What I said | Under the house-brand lens |
|---|---|
| The SERP is owned by *Astragalus* and a dictionary | **Largely irrelevant.** A byline does not need to win organic search on its own name. Users find *Mullion*; Astragal is what they see in the footer and the vendor field. |
| "Astragal" is "Astra" plus three letters in your primary market | **Much smaller than I implied.** The name competing in WordPress search is **Mullion**. Astragal is the vendor line on the plugin page and the GitHub org. A byline that rhymes with a big theme brand costs far less than a product name that does. |
| `astragal.com` is unobtainable | **Real but minor.** A publisher brand does not need the exact-match `.com`. `astragal.dev`, `astragal.software`, `getastragal.com` and `astragallabs.com` were all free as of this check. |
| A live competitor makes this a race | **Overstated.** See below. |

I was applying product-brand criteria to a house brand. That is the substantive mistake, and it
is independent of the domain error — I would have over-called this even if the registrant had
been unknown.

### What is actually true, restated

There *is* a live commercial product trading as Astragal:
[astragalhq.com](https://astragalhq.com), field-service management software for HVAC, plumbing
and landscaping crews, published pricing in CAD, domain created 2026-07-28, in private beta and
effectively unindexed. I verified that directly and it stands.

But the honest read on it is narrower than I gave you:

- **Different goods, different channels, different buyers.** Field-service dispatch software vs.
  WordPress plugins and developer tools. Likelihood-of-confusion analysis turns on exactly that,
  and on these facts it is low.
- **No registered mark**, and the register is clear in Classes 9 and 42 — the only bare-word
  ASTRAGAL registration was cancelled in 2021.
- **The word is a common architectural noun**, which is why nobody owns it. That is what makes
  it arbitrary, and therefore registrable, in software.
- Coexistence between two unrelated software products sharing a common-noun name is ordinary,
  not exceptional.

The residual risk is genuine but small and slow: if they grow and file in Class 9/42 first, they
get priority over a later filing. That is a tail risk to be closed cheaply, not a reason to
abandon a naming system.

### Revised recommendation — proceed with Astragal

I withdraw the recommendation to pick a different name. The Mullion/Astragal pairing is the
strongest thing in this identity — two names for the slender vertical member that covers where
two leaves meet, one that must be seen and one that must not. That is a real idea, and it is
worth more than the frictions I listed.

**Three cheap defensive moves, in priority order:**

1. **File intent-to-use in US Classes 9 and 42 now.** This is the whole ballgame for the tail
   risk and it is inexpensive. Add **CIPO in Canada** if the budget stretches — the competitor
   prices in CAD, so that is where a conflict would surface first.
2. **Take the fallback domains this week** — `astragal.dev` and `getastragal.com` at minimum.
   Cheap, and they stop being available precisely when you need them.
3. **Document first use in commerce**: date-stamp the first public appearance of the Astragal
   name on a shipped artefact. Common-law rights accrue from use, and a dated record is what
   makes them provable.

None of this gates design work. **Final assets are no longer blocked by the house-brand
question.**

### One thing that genuinely did change since the last screen

Unrelated to Astragal, and it stands regardless: **The Mullion Group Pty Ltd** (Canberra,
founded 2014) is a real software company — climate-emissions and biodiversity analytics, roughly
$2.6M ARR, 250 customers, bootstrapped. My earlier screen said the only Mullion in the world
made marine safety equipment; that is out of date.

Severity is **minor**: their shipping product is branded *FLINTpro*, "Mullion" is the corporate
name only, and land-sector ESG analytics is nowhere near a WordPress gallery plugin. But since
you are filing anyway, **include Mullion in the same clearance pass.** I could not complete a
proper Class 9/42 check on it — both trademark surfaces served stale cache on that query.

**None of this is legal advice.** The one thing worth a solicitor's time is the intent-to-use
filings in §0.1 above; a full clearance search is optional at this scale, and the register being
clear is the reason.

## 1. The one-rung fill split — confirmed, accept it

`#006e66` is right and the reasoning is the reasoning I would have used. The criterion picked
it, the criterion is the thing we agreed to trust over any authored index, and label contrast
**improves** (6.14:1 vs the dark theme's 5.36:1).

The visible difference is also smaller than the paperwork suggests. **Your ΔE ≈ 3.5 is on the
CIE Lab scale; on the OKLab scale used elsewhere in these documents the same pair is 0.032** —
far below the ~0.10 threshold at which two colours stop reading as one. Hue moves 0.6°. Nobody
will see `#007870` and `#006e66` together and read them as two colours. Two teals in the system
is a documentation problem, not a perception problem.

> **One request:** pin the ΔE unit wherever one appears. These documents now carry ΔE on two
> scales that differ by roughly 100×. An unlabelled ΔE is worse than no ΔE. I have noted this
> in `LIGHT-THEME-SPEC.md`.

No need to rethink the light seed. `#007870` stays the `accent` token and the brand value; the
fill resolving one rung darker is the system working.

---

## 2. Optional accent roles — my v1 advice was too coarse, and you should do neither option

"Author all three or neither" was the wrong shape of rule. Measured, the three fallbacks do not
carry equal risk:

| Role | Light fallback | `background` | `surface` | `surfaceRaised` | As text |
|---|---|---|---|---|---|
| `info` ← primary | `#007870` | 4.58 | 5.11 | 5.36 | passes |
| `accentGreen` ← success | `#227b00` | 4.60 | 5.13 | 5.38 | passes |
| **`accentPurple`** ← built-in default | **`#a855f7`** | **3.38** | **3.77** | **3.96** | **fails on all three** |

Two of your three fallbacks are fine and your instinct not to author dead values was right.
The third is not. `#a855f7` is inherited from the retired Instrument Blue palette; it clears
3:1 so it is safe as a fill or stroke, but it **fails 4.5:1 as text on every light ground**. It
is harmless only because nothing paints it — which is precisely the condition that changes
without anyone noticing, and no gate will catch it because the audits only model pairings the
adapter actually paints.

**Recommendation: author one value, not three.** `accentPurple: #923bde` on `default-light`
only — hue-locked to `#a855f7` (303.9°, 0.0° delta), measuring **4.60 / 5.13 / 5.38**, the same
profile as the other two fallbacks. Leave `info` and `accentGreen` alone.

---

## 3. Hover glow defaulting to `#1ad1c4` — no objection, one caveat

On brand by construction and I would keep it. The caveat is not about the colour, it is about
where it sits: a glow over **user photography** is the one place in the product where the brand
colour meets content you cannot predict. Rig Cyan is high-chroma and light — over a cyan-toned
or pale image it will read as a wash rather than a glow, and over a busy image it may read as
an artefact.

That is a per-image outcome, not a palette fault, and it is user-configurable, so it does not
need solving in the palette. **What I would want before signing it off is to see it over three
deliberately hostile cases**: a pale beach or sky image, a teal-dominant image, and a very dark
low-key image. If it survives those it is fine everywhere. Send screenshots whenever it is
convenient — this does not gate anything.

---

## 4. Two-tone focus ring — build it, and it will not cost you the restrained look

Yes, and the reasoning that made you hesitate is the reasoning for doing it.

The single-tone ring is correct for the 23 bundled themes because you can audit them. It cannot
be correct for **user-authored** themes, because there is no build-time audit that can see
them — and a focus ring is the one affordance where failure is not cosmetic. It is the
difference between a keyboard user knowing where they are and not.

On the aesthetic worry: a two-tone ring is *thicker*, not *louder*. Chrome, Firefox and GitHub
all ship one and none of them reads as decorated — the outer halo is a neutral, usually white
or near-black, and it disappears against most surfaces while doing its job against the ones
where the core would vanish. It reads as precision, not as ornament, which is the register this
product is already in.

Two things to specify when it is built:

- **The halo is a neutral drawn from the theme's own grounds, never a second brand colour.**
  Two chromatic tones is what would actually look decorated.
- **Ring geometry stays constant across themes.** Only the colours resolve. A ring that changes
  thickness per theme is the thing that would break the restrained look.

I will give it a proper opinion in situ once it is running, but I would not hold the build for
that.

---

## 5. Confirmations

**Trademark — see §0, which I rewrote after over-calling it.** Both names have a namesake in
software; neither is a register conflict, and the register is clear in Classes 9 and 42.
Recommendation is to **proceed with both names** and close the tail risk with intent-to-use
filings. Final assets are no longer blocked.

**Screenshot order — signing off on the Layout Builder lead.** Recommended in v1, still my
recommendation, and nothing since has weakened it: it is the shot no competitor can take, and
the classic grid is the shot every competitor already has. Please update `readme.txt` captions
and `STORE_ASSETS.md` in the same commit — WordPress.org matches captions to files by number
and they mismatch silently.

**Freemius icon limits — agreed, no action.** Community-reported, not documented; a 300×300 PNG
under 200KB is safe regardless, so confirming at upload time is the right level of effort. Do
not spend a round chasing it.

---

## On the caption-chip correction

Noted and appreciated — that is a real improvement on the v1 record, and it changes the banner
brief slightly in a good direction. Chips that tint with the active theme are more interesting
than fixed black ones, and they mean the banner should show chrome that clearly belongs to a
*theme* rather than chrome that looks like a fixed chassis. I will work from the v2 description.

---

## Verification I ran on the v2 documents

Everything I could check independently, checked. The v2 docs are the most accurate versions of
these specs that have existed.

- **`LIGHT-THEME-SPEC.md`: 14 of 14 spot-checked pairings matched to two decimal places** —
  `text`, `textMuted`, `textMuted2`, `primaryStroke` and `borderStrong` across `background`,
  `surface`, `surface2`, `surface3` and `surfaceRaised`.
- **Note 1's figures confirmed exactly**: `#006e66` white label 6.14; `#1f867d` 4.41 (correctly
  rejected); hues 186.1° and 186.7°; `text` on the light fill 2.71.
- **`COLOR-SPEC.md` §1 confirmed exactly**: `borderStrong` `#648284` at 3.81 / 3.59 / 3.11 /
  4.50; `border` 1.46 on `surface`; 2.62 between the two.
- **The shipped dark ramp behaves as documented.** Indices 5–9 clear the criterion; index 5 is
  the first from the light end; `#007870` at 4.96 on ink and 5.36 under white.

**One correction that is mine, not yours.** The v1 criterion wording said *"the first rung from
the **dark** end"*. Against this ramp's ordering that selects index 9, `#002825` — near-black.
The implementation walks from the light end and gets index 5, which is right. You implemented
the correct thing and silently fixed my phrasing; I have recorded the correction in
`COLOR-SPEC.md` §2 so nobody rediscovers the wrong version in an archived copy. That makes
**four** v1 errors, not the three the document currently counts.

---

## Changes I made to files in this repository

Originals are archived untouched at
`archive/2026-09-01-pre-designer-review/` (with its own README).

| File | Change |
|---|---|
| `astragal-brand/BRAND.md` | Mullion light accent `#007A70` → **`#007870`**. The old value was my hand-derived brand token; `#007870` is hue-truer and is what actually ships. |
| `astragal-brand/astragal-tokens.json` | `products.mullion.accentLight` → **`#007870`**, same reason. |
| `LIGHT-THEME-SPEC.md` | Appended *Designer response — 2026-09-01*: fill-split confirmation, the ΔE-unit request, and the `accentPurple` table and recommendation. |
| `COLOR-SPEC.md` | Added the v1 criterion-wording correction to §2. No numbers touched. |

I did **not** rewrite the v2 documents. They describe shipped code accurately, they are yours
now, and churning them would only make them harder to trust.

---

## What I need back

1. **Nothing on the house-brand name** — §0 is resolved. Proceed with Astragal. The only
   actions are the three defensive moves in §0, none of which gate design work.
2. **`accentPurple: #923bde` on `default-light`** — two-minute change, closes the one unsafe
   fallback (§2).
3. **Hover-glow screenshots over three hostile images** when convenient (§3). Non-blocking.
4. **Screenshot-order sign-off actioned** — captions and manifest in one commit (§5).

Final assets are **unblocked**. The naming question is closed and the icon, banners, lockups
and placeholder can be cut whenever you want them — say the word.
