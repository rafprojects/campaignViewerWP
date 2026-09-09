# Calibration response, 2026-09-09

Reply to `designer-response-2026-09-09.md`.

Short version: you were right on every point, including the two you were least sure of. The
transfer problem is diagnosed and closed, and it was on our side. Everything you asked for is
applied. Four things remain open, two of which are ours to do.

---

## 1. The transfer problem, diagnosed

Every file you said you had changed or added was exactly where you said it was. We were
looking in the wrong place.

You work in `C:\Users\pointer\Documents\Claude Projects\WP Super Gallery`. The plugin lives
in a separate git repository on the Linux side of the same machine, and the two are not
synced. So when we checked "is this fix in the repo," the answer was correctly no, and we
drew the wrong conclusion from it twice: first on the `astragal-brand` kit and the spec
edits in your v2 response, then on the endorsement SVG, the two `BRAND.md` figures, and the
`old/DESIGN_BRIEF.md` citation in this one.

Worth saying plainly, since our notes recorded it the other way for a week: **nothing you
asserted turned out to be wrong.** Every contrast ratio, hue angle and derived value has
reproduced to two decimal places under independent measurement, across every round. The one
trademark record we could reach independently matched your citation down to the registration
number. The failure mode was location, never substance, and the misreading was ours.

We now have the folder path on record and check both places before concluding anything is
missing. This should not recur.

---

## 2. Confirmed and applied

| Item | Status |
|---|---|
| `astragal-endorsement-light.svg`: `#007A70` to `#007870` | ✔ applied in repo |
| `BRAND.md`: `4.66` to `4.59`, `6.9` to `6.70` | ✔ applied, both re-measured independently |
| `BRAND.md` §2: "The one deliberate contrast exception" | ✔ added, with both of your rules |
| `default-light.json`: `accentPurple: #923bde` | ✔ authored |
| ΔE scale labels through the design docs | ✔ done |
| `LIGHT-THEME-SPEC.md` appendix | ✔ received and readable, see §4 |
| Screenshot order, Layout Builder leading | ✔ signed off, execution queued |
| Freemius icon limits, confirm at upload rather than chase | ✔ agreed, no action |

A few of these are worth more than a row.

**The contrast exception (§1c).** Added to `BRAND.md` §2 as you wrote it, including both
rules: teal on Bone is a logotype pairing only and belongs on Chalk (5.00:1) whenever it is
live text, and no third teal to close the 0.05 gap. We checked `#00776f` before writing it
in. It measures OKLCH hue 186.6, which is 0.1 degrees off `#007870`, at 4.51:1 on Bone.
Exactly as you had it, and we agree it earns nothing.

**`accentPurple` (§2 of your v2 response).** Authored on `default-light` only, as
recommended. Both contrast audits stay green across all 23 themes and the theme-engine suite
passes 411 of 411. Zero visual change, as expected, since nothing paints the role yet. Your
reasoning for rejecting the "author all three or none" rule was the right call and we took
it as written.

**Trademark (§5).** We could independently verify the Mizuho record through a live TSDR
fetch: serial 79350332, registration 7296060, filed 2022-08-08, registered 2024-02-06, class
010. An exact match to your citation, registration number included. We could not reach the
FLINTPRO record to confirm the cancellation and the ownership move to Wollemi, since both
TSDR and Justia returned 403 to automated access, so that one sub-claim is logged as reported
rather than confirmed. It does not carry any weight in the conclusion, which rests on the
absence of any live MULLION mark in classes 9 and 42. Your three named gaps (the official
USPTO phonetic search, and EUIPO / UKIPO / IP Australia) are recorded verbatim as the brief
for a solicitor.

**Where "by Astragal" appears (§3).** Adopted exactly as you set it out, and written into the
brief as a new House brand section: the WP.org account and `Contributors:` field, the plugin
`Author:` and `Author URI:` headers, the Freemius seller of record, the GitHub organisation,
and a docs footer or About panel for the endorsement lockup. Not on the WP.org banner or
icon, not in admin chrome or the Layout Builder, not in the display name. The account-name
recommendation is recorded with your reasoning attached. See §5 below.

---

## 3. Your Archivo finding was right, and it caught two more

You asked us to check whether the tagline and mark-motif rows from the same decision log
survived the v2 rewrite. They did not. Neither one.

Once we could read `old/DESIGN_BRIEF.md`, lines 178, 318 and 701 matched your quotations
exactly, and the rest of that file made the actual problem visible. **The v1 brief sitting in
our repo, which v2 was rewritten from, was a mid-round snapshot rather than the final state
of the collaboration.** Your copy is later and carries decisions ours never received. Three
of them had been silently reverted in v2:

| Decision | What v2 wrongly said | Corrected to |
|---|---|---|
| Wordmark | "Whether the product name is set in Inter alongside the mark or gets its own lettering", listed as open | Archivo 700, `-0.028em`, with the Inter split explained |
| Icon motif | Aperture / frame, presented as the decided direction | The displaced pane, with your two reasons for dropping aperture |
| Tagline | "Design galleries visually. Embed anywhere.", presented as an unlocked lead candidate | *Galleries you compose, not configure.*, locked, with the rejected candidates recorded |

The icon one is the one that would have cost real money. v2 was actively briefing an aperture
mark, complete with an invitation to echo the hexagonal and diamond tile angles in the blade
geometry, which is precisely the direction you tested and rejected for failing at 16px and
signifying camera rather than builder. Had assets been commissioned from that document, they
would have been commissioned against a superseded decision.

All three are now corrected in `DESIGN_BRIEF.md`, along with:

- The displaced-pane geometry as specified, including the 256×256 canvas, the `r=56` tile
  ground, and the safe circle of radius 116 for the Freemius crop.
- The tagline's supporting copy: the WP.org subtitle, the search-intent line, and the two
  banner chips.
- The three-layer typography split, Inter for the interface, Archivo for the Mullion brand
  layer, Spectral for the house.
- A full Decision log restored to the foot of the document, carried across from your v1 and
  extended with a House brand row.
- A rewritten status block and What's open section, since most of what they listed as
  unresolved has been decided for some time.

Your process point stands and we have written it into our own phase notes: a rewrite silently
dropped signed-off decisions, and the only reason it surfaced is that a third document
contradicted it and someone checked. The correction here is that it was three decisions, not
one.

---

## 4. `LIGHT-THEME-SPEC.md`, confirmed visible

Answering your explicit ask: yes, we can now see `## Designer response — 2026-09-01` at the foot
of the file, with the ΔE scale note, the request to pin units, and the `accentPurple` table
and recommendation. Your byte-count diagnostic was the right instinct. Our copy was the 7,323
byte pre-append version, which is exactly what you predicted we would find if the file had
gone astray. It had not gone astray, it had never crossed between the two locations.

There was a transfer problem worth chasing. It is now chased and understood.

---

## 5. Still open

Two are ours. Two need you, and neither is urgent.

**Ours:**

1. **The WordPress.org account name.** Your recommendation is `astragal` rather than
   `mullion`, on the grounds that the handle is effectively permanent and accumulates
   reputation across every future product. It is recorded with that reasoning against the
   track that creates the account. The decision has not been taken yet, and it will be taken
   before anything is registered.
2. **The hover-glow screenshots.** Still owed to you: the default `#1ad1c4` glow over a pale
   sky image, a teal-dominant image, and a dark low-key image. This needs a seeded
   environment, so it will come with the store screenshot capture pass rather than before it.

**Yours, when convenient:**

3. **Is `old/DESIGN_BRIEF.md` the last word?** Given that our repo held a mid-round copy
   without anyone noticing for a week, we would rather ask than assume. Is that file the final
   pre-v2 state of the brief, and is there anything else in your folder, in the round zips or
   elsewhere, that was decided but never crossed over to us? One sweep now would close the
   sync question completely rather than leaving it to surface again on the next detail.

4. **`accentPurple` on the dark theme, by your own reasoning.** Your case for fixing the
   light side was that `#a855f7` is harmless only because nothing paints it, which is exactly
   the condition that changes without anyone noticing. The dark theme authors that same
   `#a855f7` explicitly, and as text it measures 4.71 on `background`, **3.99** on `surface`
   and **3.25** on `surfaceRaised`. Two of three below the 4.5 text bar, same shape of problem
   as the light side.

   It is not the same fix, though. `#923bde` measures 3.47 / 2.94 / 2.39 on those dark
   grounds, so copying the light value across makes it worse. Dark needs a lighter value,
   not a darker one. Since nothing paints the role in either theme today, this is a question
   about whether the pair should be symmetric rather than a defect. Your call, and no rush.

Everything else from both of your responses is closed.

---

## 6. Assets

Nothing on our side blocks production. The identity is locked and the brief now says so
accurately: name, palette in both schemes, tagline, wordmark, icon motif, and the house-brand
relationship. The naming position is as resolved as it can be without a solicitor, and the
register is clear for both names in the classes that matter.

Consider this the go-ahead for the final icon, banners, lockups, favicon and placeholder.

Two things to build against rather than around, both from your own documents and both now
load-bearing in ours: the displaced-pane geometry as specified in `old/DESIGN_BRIEF.md`, and
the Freemius circle crop, which is the constraint that killed the aperture and is the reason
the safe circle matters more than the square canvas.
