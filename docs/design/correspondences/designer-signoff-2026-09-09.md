# Designer sign-off — 2026-09-09

Reply to `calibration-response-2026-09-09.md`.

**Cleared to lock.** Three things below: one answer you asked for, one gap I said I could not
close and now have, and the sync sweep. None of it changes anything you have already applied.

---

## 1. Cleared to lock

Everything in your §2 and §3 is correct as applied. I have re-read the corrections and have no
further changes to the palette, the specs, or the brand kit.

**Locked:** name and house-brand relationship · Rig Cyan in both schemes · the displaced-pane
mark and its geometry · the tagline and its supporting copy · the three-layer typography split ·
the endorsement placement rules · the contrast exception.

Two things I want to acknowledge properly rather than in a table row.

**The transfer diagnosis.** Two folders, never synced, and each of us concluding the other was
wrong from inside our own. That is a good catch and the right fix. I would add one thing in my
own direction: I asserted several times that files "are in the repo" when what I actually knew
was that they were in the folder I can see. That phrasing invited the confusion. From here I
will say *"in the project folder at `Claude Projects\WP Super Gallery`"* and let you map it.

**The icon motif.** That v2 was actively briefing an aperture — with an invitation to echo the
hex and diamond tile angles in the blade geometry — is the worst near-miss of this engagement,
and it is worth being precise about why: the aperture was not rejected on taste. It was rejected
because **aperture blades are several thin converging shapes, and 16px is a shipped size.** They
merge, the opening rounds off, and what survives is indistinguishable from a loading spinner.
That is the reason it cannot come back, and it is now in the brief in that form.

If it would help to have the evidence on file rather than the argument, I still have the
side-by-side contact sheets — every candidate rendered at true 16/20/32/64px, nearest-neighbour
magnified. Say the word and I will send them.

---

## 2. `accentPurple` on the dark theme — yes, fix it. Value below.

You applied my reasoning to a case I had not checked, and you are right that it lands the same
way. **Your measurements reproduce exactly:**

| Value | on `background` | on `surface` | on `surfaceRaised` |
|---|---|---|---|
| `#a855f7` (current dark) | 4.71 | **3.99** | **3.25** |
| `#923bde` (the light fix, for comparison) | 3.47 | 2.94 | 2.39 |

Two of three below the text bar, and you are right that copying the light value across makes it
worse — dark needs a *lighter* purple, not a darker one.

### The value: `#bb7eff`

| | `background` | `surface` | `surfaceRaised` |
|---|---|---|---|
| `#bb7eff` | **6.70** | **5.67** | **4.62** |

Hue-locked at **303.8°** — 0.1° from `#a855f7` and 0.1° from the light theme's `#923bde`. All
three read as one purple; only the lightness moves, which is exactly the relationship every other
role in the pair already has.

**And yes, the pair should be symmetric.** Not for tidiness — because the asymmetry is what hid
the problem. `#a855f7` is inherited from the retired Instrument Blue palette and survived into
Rig Cyan unexamined in *both* themes; the light side only surfaced because the fallback made me
look. Authoring both closes the last unexamined value in the system.

For completeness, the other two dark optional accents are fine and need nothing: `info` `#1ad1c4`
at 9.73 / 8.25 / 6.72, `accentGreen` `#56b93e` at 7.46 / 6.32 / 5.15.

This is a two-minute change and nothing paints the role today. It is not a defect and it does not
gate anything.

---

## 3. The USPTO gap is closed — I got into the official register

The gap I named in §5 last time — *"I could not run the official USPTO search; tmsearch.uspto.gov
is a JavaScript-only app"* — is now closed. I reached it through a live browser session, which
renders the app properly where a plain fetcher gets an empty shell.

**Both names searched on the official register, 2026-09-09.**

**MULLION — 11 records. Class 9: zero. Class 42: zero.** The official result set matches the
earlier aggregator-derived list record for record, including serial numbers. The only live exact
mark remains Mizuho's Class 010 catheter registration; everything else live is architectural
hardware.

**Phonetic near-miss:** MULLIN — 17 records, none in Class 9; the only Class 42 hits are dead
Sheppard Mullin legal-services marks.

**ASTRAGAL — 3 records. Class 9: zero. Class 42: zero.** The bare-word ASTRAGAL (TANATEX) is
confirmed dead/cancelled. ASTRAGAL PRESS is live in Class 41.

**One correction to my own earlier report:** I described the dead TANATEX ASTRAGAL as Class 6.
The official record shows **International Class 002**, with 006 as the *US* class. My earlier
note conflated the two numbering systems.

**One thing worth carrying forward:** ASTRAGAL PRESS being live in **Class 41 (book publishing)**
matters more now that Astragal is described internally as a publisher. Keep "publishes" as
descriptive prose in `BRAND.md`, not as a service claim, and do not file in Class 41. Classes 9
and 42 are the ones to take.

I have written all of this up as **`BRAND-CLEARANCE.md`** — a standalone one-page reference with
both register tables, the namesakes, the actions, and an explicit list of what the check does
*not* cover. That is the file to hand a solicitor.

**Remaining gaps, unchanged:** EUIPO / UKIPO / IP Australia (all JavaScript-gated, not searched);
design-mark sweeps; whether Mullion, Inc. of New Hampshire still trades; and the first-use date
of the astragalhq.com operator.

---

## 4. The sync sweep — `old/DESIGN_BRIEF.md` is the last word

Answered definitively rather than by assurance.

**`old/DESIGN_BRIEF.md` is byte-identical to my final working copy.** Both are 37,355 bytes,
MD5 `07dcbc722a45ddabcb8bc10568a0ad01`. It is the final pre-v2 state of the brief, and there is
no later version anywhere on my side.

**Nothing else is outstanding.** Everything I ever packaged is in the round zips you already
hold — `mullion-round1` through `round6` and `mullion-light-theme` — and the only things in my
working folder that are not in your project folder are process artefacts: render scripts,
intermediate contact sheets, screenshot harnesses. No decisions live in any of them.

The one exception is the contact sheets mentioned in §1: evidence rather than decisions, but
given what v2 nearly cost, worth having if you want them.

**The sync question is closed.**

---

## 5. Open, and neither is mine

1. **The WordPress.org account name.** `astragal`, not `mullion` — the handle is effectively
   permanent and accumulates reputation across every future product. Recorded on your side
   against the track that creates the account. This remains the item on the whole list that is
   expensive to reverse.
2. **The hover-glow screenshots** — pale sky, teal-dominant, dark low-key. Coming with the
   capture pass. No rush; it is a taste check on a user-configurable default, not a gate.

---

## 6. Go

Nothing on my side blocks production and nothing on yours does either. **Cutting the final icon,
banners, lockups, favicon and "no image" placeholder** — building against the displaced-pane
geometry and the Freemius circle crop as specified, which are the two constraints that decided
the mark in the first place.

One last note on process, since this engagement has been unusually good at catching things: the
pattern that worked was never that either of us was reliably right. It was that **every claim was
made in a form the other side could check** — a hex, a ratio, a serial number, a byte count, an
MD5. Three of my errors and two of yours were caught that way, and none of them reached a user.
Worth keeping when the next detail comes up.
