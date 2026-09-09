# Open items for the designer — Mullion / Astragal

**2026-09-09.** Everything below is still open as of today. Two corrections need to go into
files you already shipped, two things need your confirmation before we update our docs to
match yours, one deliverable seems to have not made it into the copy we received, and one
clearance check was left incomplete. Nothing here blocks your side from cutting final
assets.

---

## 1. Three corrections needed in the Astragal brand kit

We checked every measurable claim in `astragal-brand/BRAND.md` and the SVGs against the
actual hex values. Three didn't hold up:

**a. `astragal-endorsement-light.svg` still sets "Mullion" in the retired accent.**
It uses `#007A70`. BRAND.md and `astragal-tokens.json` both correctly carry the current
value, `#007870` — only this one file missed the update. The visual difference is
negligible (ΔE around 1, invisible), but it's the file someone will actually copy from, so
it's worth a fix rather than a footnote. `astragal-endorsement-dark.svg` is correct.

**b. Two contrast figures in BRAND.md don't reproduce.**

| Stated | Measured | Pairing |
|---|---|---|
| 4.66 : 1 | **4.59 : 1** | `--ast-lead-500` `#626A6E` on Bone `#ECEAE4` |
| 6.9 : 1 | **6.70 : 1** | dark-mode `#98A0A4` on Graphite `#16181A` |

Both still clear the bars you set for them, so nothing about the palette needs to change.
The numbers themselves just need correcting in the doc.

**c. FYI, not a defect: your product-accent-on-Bone pairing is 4.45 : 1, just under 4.5.**
`#007870` (Mullion's accent, used in the endorsement lockup) measures 4.45:1 on your Bone
ground `#ECEAE4` — on your Chalk `#F8F7F3` it's 5.00. The endorsement is a logotype, which
WCAG's text-contrast rule doesn't apply to, so no action is required. Flagging it only so
it's a known, deliberate exception rather than a surprise if it comes up later (e.g. if the
same teal-on-Bone pairing is ever reused as live text rather than as the lockup).

---

## 2. Confirmation needed: was "Archivo for Mullion's brand layer" actually decided?

`BRAND.md` §3 states as settled fact: *"Mullion's brand layer is Archivo and its interface
layer is Inter. That separation is already decided and nothing here disturbs it."*

Our own brief has never recorded that decision. It still lists **typography as Inter for
everything** (body and headings) and carries **"Wordmark treatment"** as an open question
under What's Open — whether the product name is set in Inter alongside the mark or gets its
own lettering.

We're not disputing it, just missing the paper trail. Two possibilities:

- It was agreed in a conversation that didn't make it into either doc, in which case: tell
  us when/how, and we'll close the open question on our side and update the typography
  section to match.
- Or BRAND.md is stating your recommendation as though it were already settled, in which
  case we should talk it through before treating it as locked.

Either way we'd like our two docs to agree before anyone builds against them.

---

## 3. Confirmation needed: does the Astragal endorsement change the plugin's vendor line?

The plugin header currently reads `Author: Mullion`, and the WordPress.org readme still has
`Contributors: wpsupergallery` (a placeholder, already tracked as its own item on our side).
Now that the endorsement lockup exists ("Mullion · BY ASTRAGAL"), there's a real question of
where else that relationship should surface: the plugin author field, the WordPress.org
listing's vendor identity, the Freemius account, GitHub org, etc.

This is ultimately our call to make, but since you built the lockup with a specific intent
in mind, we'd rather hear your expectation of where "by Astragal" is meant to appear before
we lock in the WordPress.org account (that's a separate near-term task on our end and a good
moment to settle this alongside it).

---

## 4. Missing: the `LIGHT-THEME-SPEC.md` appendix

Your write-up of the response to our v2 docs said you appended a "Designer response —
2026-09-01" section directly to `LIGHT-THEME-SPEC.md`, covering three things:

- confirming the light theme's one-rung-darker fill (`#006e66`) is correct and intentional
- the request to label every ΔE figure with its scale (CIE Lab vs. OKLab — you noted the
  two differ by roughly 100x for the same colour pair, so an unlabelled ΔE is worse than
  none)
- the `accentPurple` contrast table and the recommended fix (`#923bde` on the light theme,
  which we've verified and are implementing)

That section isn't in the copy of the repo we have. Everything else you described (the
`COLOR-SPEC.md` criterion-wording note, the full `astragal-brand/` kit) arrived correctly,
so this looks like one file that didn't make it into the transfer rather than anything
wrong on our end. Could you resend just that section, or confirm it exists somewhere we
should be looking?

---

## 5. Trademark clearance: the Mullion check was left incomplete

In the naming review, you completed a register check for Astragal (clear in Classes 9 and
42; the only bare-word ASTRAGAL registration was cancelled in 2021) but noted that the
equivalent check for **Mullion** — prompted by the unrelated Australian company, The Mullion
Group Pty Ltd — couldn't be completed because "both trademark surfaces served stale cache on
that query." You recommended including Mullion in the same intent-to-use filing pass as
Astragal, which we've noted as a task for us, but that's a filing, not a substitute for the
clearance check itself.

Could you re-run that check (or confirm you have and it's clear) before we treat Mullion as
cleared the same way Astragal is?

---

## For your awareness, not action

- **Screenshot order:** your sign-off on leading with the Layout Builder screenshot is
  being actioned on our side (`readme.txt` captions and the store-assets manifest, updated
  together). Nothing needed from you.
- **Hover-glow over hostile imagery:** we still owe you the three verification screenshots
  (pale/sky image, teal-dominant image, dark low-key image) you asked for in your response.
  Coming once we have a seeded environment up for the screenshot capture pass generally —
  no need to chase it.
- **`accentPurple` fix:** implementing `#923bde` on the light theme as you specified. No
  input needed.
