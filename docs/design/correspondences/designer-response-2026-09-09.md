# Designer response — open items of 2026-09-09

**2026-09-09.** Reply to `open-items-for-designer-2026-09-09.md`.

Two items are fixed in the repo. Two are answered with evidence. One was never missing — it is
in the file, and I can tell you which line. One clearance check is now complete.

Originals of every file I touched are archived untouched at
`archive/2026-09-09-pre-designer-corrections/`.

---

## 1. Astragal brand kit — all three of your findings are right. (a) and (b) fixed.

I re-measured all three independently. **You are correct on every one**, including the two
contrast figures, which I had not caught. These are exactly the kind of numbers that should
reproduce — pure colour math on fixed hexes — so being wrong in a shipped doc is not excusable
by "it still clears the bar."

### (a) `astragal-endorsement-light.svg` — fixed

It carried `#007A70` in a single `fill` attribute. Now `#007870`. The dark endorsement was
already correct (`#1AD1C4`, the dark-ground accent). You were right that the visual difference
is invisible and right that it matters anyway: an SVG is a file people copy from, and a wrong
value in an asset propagates further than a wrong value in prose.

### (b) Both figures corrected in `BRAND.md`

| Claim | Was | Now | Measured |
|---|---|---|---|
| `--ast-lead-500` `#626A6E` on Bone `#ECEAE4` | 4.66 : 1 | **4.59 : 1** | 4.59 |
| dark `#98A0A4` on Graphite `#16181A` | 6.9 : 1 | **6.70 : 1** | 6.70 |

While I was in there I re-measured the rest of the palette. **Everything else holds**, and it is
worth having the numbers on record since they were not all stated:

| Pairing | Ratio | |
|---|---|---|
| lead-900 `#191C1E` on Bone | 14.24 | AA |
| lead-700 `#3A4043` on Bone | 8.75 | AA |
| lead-900 on Chalk `#F8F7F3` | 15.98 | AA |
| lead-300 `#A9AFB2` on Bone | 1.84 | rules only, correctly sub-3:1 |
| Bone ink `#E9E7E1` on Graphite | 14.40 | AA |
| lead-700 dark `#C2C6C7` on Graphite | 10.34 | AA |
| lead-300 dark `#6C7478` on Graphite | 3.74 | rules only |

### (c) Agreed — and I have written it into `BRAND.md` as a named exception

Your read is right on both counts: `#007870` on Bone is **4.45 : 1**, and it does not matter,
because the endorsement sets the product name as a **logotype** and WCAG 1.4.3 exempts logotypes
from text contrast. It clears 3 : 1, so 1.4.11 is satisfied for it as a graphical object.

Your instinct to flag it rather than ignore it was the right one, so I have added a short
*"The one deliberate contrast exception"* section to `BRAND.md` §2 recording it, with two rules
attached:

- **Never reuse teal-on-Bone as live text.** Logotype pairing only. Teal as running text on a
  light house ground belongs on **Chalk**, where `#007870` measures **5.00 : 1**.
- **Do not introduce a third teal to close the 0.05 gap.** I checked: a hue-identical `#00776f`
  (0.1° delta) would measure 4.51 on Bone. It is not worth having. The system already carries
  two teals — brand `#007870` and the light theme's `#006e66` fill — and a third earns nothing.
  The rule that governs the colour system governs this too: a new value earns its place only
  when it does something the existing ones cannot.

That is the difference between a known exception and an accident, which is what you were asking
for.

---

## 2. Archivo — it was decided, it was signed off, and your v2 rewrite dropped it

Neither of your two possibilities is quite what happened. `BRAND.md` is not stating a
recommendation as settled. The decision was made, approved, and written into the brief — and
then lost when the brief was rewritten as v2.

**The paper trail, in the repo right now:**

Your archived copy of the v1 brief — `old/DESIGN_BRIEF.md`, which is the version I delivered —
records it in three separate places:

| Line | Content |
|---|---|
| 178 | A dedicated `### Wordmark` section: *"**Archivo**, weight 700, letter-spacing `-0.028em`… Archivo is deliberately not Inter. Inter remains the product typeface — nothing in the application changes."* |
| 318 | The typography section, split explicitly into *"In the product: Inter… **None of this changes.**"* and *"In the brand: **Archivo** 700 for the wordmark…"* |
| 701 | A row in the decision log: *"\| **Wordmark** \| Archivo 700, `-0.028em` \| Architectural-signage grotesque; deliberately distinct from the product's Inter. \|"* |

**The v2 brief has zero occurrences of "Archivo"**, still lists typography as Inter for
everything, and still carries *"Wordmark treatment"* under What's Open at line 375. So the two
docs disagree because v2 reverted to the v1-original text for that section rather than carrying
forward the v1-updated text.

**The approval:** it was signed off in the same message that approved the tagline — the reply to
round 1 read *"proposed tagline works for me"* and *"wordmark choice looks good"*. Archivo was
the wordmark proposal in that round. That is the "when/how" you asked for.

**So: close the open question, and update the typography section.** `BRAND.md` is right.
Concretely, v2's typography section should say:

- **Product interface:** Inter (400/500/600/700), JetBrains Mono for code. **Unchanged.**
- **Mullion brand layer:** Archivo 700, `-0.028em`, for the wordmark and marketing headlines.
- **Astragal house layer:** Spectral, per `BRAND.md` §3.

Three faces across three layers, deliberately. Archivo is not Inter because the brand layer and
the interface layer should be legibly separate; Spectral is a serif because the house should read
as an imprint rather than as a second product name competing in the same voice.

**And this is a process finding worth more than the typography.** A v2 rewrite silently dropped
a signed-off decision, and the only reason we caught it is that a *third* document
(`BRAND.md`) contradicted it and someone checked. Two other decisions from the same round live
in that same decision-log table — the tagline and the mark motif. Worth confirming those
survived the rewrite too.

---

## 3. Where "by Astragal" appears — my expectation

This is your call, as you say, but here is what the lockup was built for. The governing line is
your own, from `BRAND.md`: *Astragal has to be recognised without being noticed.* That means
**provenance surfaces, not attention surfaces.**

**Astragal appears:**

| Surface | Form | Why |
|---|---|---|
| **WordPress.org account / `Contributors:`** | `astragal` | The most important one — see below. |
| Plugin header `Author:` | `Astragal` | WP renders this as "By Astragal" in the plugin list. Correct: the house is the vendor, the plugin is the product. |
| Plugin header `Author URI:` | the Astragal site | Same reason. |
| Freemius account / seller of record | Astragal | It is the business, and it is what appears on receipts. |
| GitHub organisation | `astragal`, repos named per product | So product two does not need a new org. |
| Documentation site footer, About panel | Endorsement lockup | The one in-product place the lockup belongs. |

**Astragal does not appear:**

- **Not on the WordPress.org banner or icon.** Those exist to win attention in a directory
  listing, which is Mullion's job. Adding a house mark there spends Mullion's space on a name
  nobody is searching for.
- **Not in the admin chrome, the Layout Builder, or any working screen.** A byline in a tool
  someone uses daily stops being a byline and becomes noise.
- **Not in the plugin's display name.** The name stays `Mullion — Visual Gallery Builder`.

**The one with real consequences: the WordPress.org contributor account.** That username is
effectively permanent, it is the identity every future plugin inherits, and it is the thing that
accumulates reputation across products. `wpsupergallery` is a placeholder from two names ago;
whatever replaces it should be **the house, not the product** — `astragal`, not `mullion`.
Registering it per-product would mean product two starts from zero reputation and the two
plugins look unrelated on the directory, which is precisely the value the house brand exists to
create.

Since you said the WP.org account is a near-term task, that is the decision to settle first, and
it is the one that is expensive to reverse.

---

## 4. The `LIGHT-THEME-SPEC.md` appendix — it is there

Nothing was lost in transfer. The section is in the copy in this repo right now:

- **Heading:** `## Designer response — 2026-09-01`, at the foot of the file (currently around
  line 160).
- **Line 169** — the ΔE-scale note, including the CIE Lab 3.5 vs OKLab 0.032 comparison.
- **Lines 176–178** — the request to label every ΔE with its scale.
- **Lines 179–196** — the `accentPurple` heading, the contrast table, and the `#923bde`
  recommendation.

The file is **9,822 bytes**; before I appended it, it was 7,323. If your working copy is 7,323
bytes or has no `Designer response` heading, you are looking at a pre-append copy — the
untouched original is in `archive/2026-09-01-pre-designer-review/` if you want to diff the two.
Since you say you have already verified `#923bde` and are implementing it, I suspect you got the
content and only the file went astray.

---

## 5. Mullion trademark — check now complete. **Clear with caveats.**

I re-ran it. The cache problem did not recur: both aggregators returned genuine
mullion-topic results this time and agreed with TSDR on serial numbers, and I cross-checked
every record against **TSDR** (`tsdr.uspto.gov/statusview/sn<serial>`), which is authoritative
per serial.

### Every exact-word MULLION record on the US register

| Serial | Owner | Filed | Status | Class | Goods |
|---|---|---|---|---|---|
| 79350332 (Reg 7296060) | Mizuho Corporation, Tokyo | 2022-08-08 | **LIVE** | **010** | Catheters, guidewires, stents |
| 77259007 | Mullion Trust Co., Tokyo | 2007-08-20 | DEAD — cancelled 2015 | 036 | Banking, securities |
| 77226539 | Mullion Trust Co., Tokyo | 2007-07-11 | DEAD — abandoned 2008 | 036 | Banking |

**Class 9: zero MULLION marks. Class 42: zero.** Live or dead. MULLION-formatives are all
architectural hardware (MULLION MATE, Class 20, live; MULLIONFLEX, Class 6, pending) or the dead
Japanese banking family. The only live exact mark is Mizuho's Class 10 catheter registration —
remote goods, no plausible confusion with a gallery plugin.

### The Mullion Group question, answered

Better news than expected:

- **"Mullion" is a corporate name only, never a product brand.** Their own site says "Mullion
  Group's FLINTpro platform."
- **They hold no MULLION mark anywhere I could reach.** Their single US filing was FLINTPRO
  (serial 79242181, Class 42, registered 2019) — and it was **cancelled 2025-12-12** for failure
  to file the §71 declaration.
- **Ownership has moved.** TSDR shows the current owner as **Wollemi Natural Capital
  Developments, Sydney**; Justia's owner field still says The Mullion Group and is stale.
- They did move US operations to Fort Collins, Colorado — but **rebranded to FLINTpro for the US
  market**, not to Mullion.

### WordPress namespace

`mullion`, `mullion-gallery` and the `mullion` theme slug are all **404 — free**. Control-tested
against `akismet`, which returns a full SVN listing, so the 404s are meaningful.

### The one real US risk, and it is small

**Mullion, Inc. of Bedford, New Hampshire** — a US company literally named Mullion that sold
software. Its only registration was **SAFELANE** (Class 9, email/usage monitoring), not MULLION,
and it was **cancelled in 2016**. Whether the entity still trades is **unverified**. Common-law
rights would attach to actual use, and there is no evidence of any.

### What I could not do

Stated plainly, because it is the gap that matters:

- **I could not run the official USPTO search.** `tmsearch.uspto.gov` is a JavaScript-only app
  and returned an empty shell. Every US finding above comes from TSDR (authoritative but
  per-serial) plus two aggregators that agreed with it. **A proper TESS/tmsearch phonetic and
  near-miss search is the one gap I cannot close from here** — ask specifically for MULLIN,
  MULLEN, MULION and MULLION-formatives.
- **EUIPO, UKIPO and IP Australia are all JavaScript-gated** and returned no data. **Unverified.**
  One flag: Mullion Survival Technology (UK) trades under "Mullion" for lifejackets, and
  personal protective equipment sits in **Class 9** under Nice — the same class as software. A
  UK/EU MULLION Class 9 registration for safety gear plausibly exists. It would not block
  gallery software on confusion grounds, but a naive "is Class 9 clear?" check in Europe could
  come back looking worse than it is.

### Verdict

**CLEAR WITH CAVEATS**, and materially cleaner than Astragal. Nothing in Class 9 or 42, the only
live exact mark is in medical devices, the Australian company never claimed the name as a brand
and has let its one US mark lapse, and all three WordPress slugs are free. "Mullion" is also a
common architectural noun and a Cornish place name, which weakens anyone's exclusivity claim
outside their own goods.

**Do not treat this as legal clearance** — it is a register check with a named gap. For a
solicitor, the priorities are: (1) the official USPTO phonetic search I could not run; (2)
whether Mullion, Inc. of New Hampshire is dissolved or still using the name; (3) whether any
common-law rights travelled with the FLINTPRO assignment to Wollemi. Then file Classes 9 and 42
— both are empty for MULLION, and MULLIONFLEX filing in September 2025 shows the formative space
is being actively worked.

---

## Changes I made to files in this repository

Originals archived untouched at `archive/2026-09-09-pre-designer-corrections/`.

| File | Change |
|---|---|
| `astragal-brand/astragal-endorsement-light.svg` | `#007A70` → **`#007870`** (one `fill` attribute). |
| `astragal-brand/BRAND.md` | `4.66 : 1` → **`4.59 : 1`**; `6.9 : 1` → **`6.70 : 1`**. Added *"The one deliberate contrast exception"* to §2 documenting the 4.45:1 logotype pairing and the two rules that keep it from becoming a precedent. |

I did not touch `DESIGN_BRIEF.md`, `COLOR-SPEC.md` or `LIGHT-THEME-SPEC.md` — the typography
change in §2 is yours to make, and the other two are correct as they stand.

---

## What I need back

1. **Confirm the typography section gets updated** and *"Wordmark treatment"* comes off What's
   Open (§2). And please check whether the tagline and mark-motif rows from the same decision log
   survived the v2 rewrite — I would rather know now than find another one this way.
2. **A decision on the WordPress.org account name** before you register it (§3). `astragal`, not
   `mullion`, is my strong recommendation, and it is the item on this list that is expensive to
   reverse.
3. **Confirm you can see the `Designer response — 2026-09-01` section** in your copy of
   `LIGHT-THEME-SPEC.md` (§4), so we know whether there is a transfer problem worth chasing.

Nothing here blocks asset production. The naming position is now as resolved as I can make it
without a solicitor: **Astragal clear on the register with a live unregistered namesake in an
unrelated vertical; Mullion clear on the register with no namesake claiming the name as a
brand.** Say the word and I will cut the final icon, banners, lockups, favicon and placeholder.
