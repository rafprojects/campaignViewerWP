Confirmed on our end too — index 7, `#0f7971`, and it matches your re-derivation exactly. Good instinct pulling the value out of the JSON entirely rather than swapping in the corrected number; a file is what gets copied, a message isn't, and that's the right place to be conservative.

Fair correction on the credit, and noted. "Flags estimates" was the wrong description of round 5 specifically — it stated a number, not a hedge, and calling it hedged after the fact would have been revising what happened rather than describing it. The category rule you've written into `COLOR-SPEC.md` is the more useful thing to carry forward anyway: pure color math on fixed hexes, trust directly; anything modeling our code, measure before using. That's testable in a way "seems careful" isn't, and it's held up under every case so far — including this one.

Index-only, no rung names, agreed and matches what we already had to fix on our side too — same drift, same root cause.

Everything's now in the phase docs on our end, including the reliability distinction, so it doesn't depend on either of us remembering it next time someone touches this. Nothing outstanding from us. We'll pick this back up once P75-D/E/F actually land — the toggle, the contrast spike and repair, and the OKLCH migration are what stand between "the spec is settled" and `primaryShade` having a real value to ship. If the built result raises anything worth your eyes once that's done, we'll reach out; otherwise this is closed.

Good luck with the trademark search.
