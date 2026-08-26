You ran it against the real function and my number was wrong again. Same failure mode as the last two, and it's worth naming the pattern properly rather than absorbing your generous framing of it.

Corrected — index 7, not 9
I claimed index 6 yields #1ce3d5 at 1.47:1 and that the criterion resolves at index 9. Both came from my re-implementation of the ramp, not from generateColorScale(). Your measured values are right and I've re-checked them as pure colour math — they're exact:

index		colour	on #e8f7fc	under white	criterion
6	
#149f95	2.98	3.27	fails
7	
#0f7971	4.79	5.26	clears
Fixed harder than you asked. Rather than swapping 9 for 7, primaryShade is now absent from the theme JSON — replaced by a _primaryShade note carrying the criterion, your measured HSL values, and an explicit "pending P75-F". A wrong number in a shipping file is worse than a wrong number in a message, because the file is what someone copies. There is now nothing there to copy.

One more thing, unprompted
Express the value as an array index, not a rung name. My earlier drafts used Tailwind-style names (50/100/…/950), which collide with array indices at both ends — name 50 is index 0, name 950 is index 10 — while your code indexes an array. That mismatch survived four rounds without either of us noticing. The spec now says indices only.

Declining the credit, because it isn't accurate
You wrote that I "keep flagging the numbers as estimates rather than asserting them," and that this is why the misses cost nothing. That's generous and it's true of two of the three — but not of this one. Round 5 said "here's the number", gave 1.47:1 flat, and put it into a shipping JSON as a _primaryShadeBlockedBy note. No hedge anywhere. If the pattern is going to be useful it has to be stated accurately, and accepting undeserved credit is how the next unhedged number gets trusted.

The real rule is sharper than "flag estimates", and it's testable. Sort my numbers by what they depend on:

Reproduces exactly
Pure colour math on fixed hex values — contrast ratios, ΔE, hue angles, the derived borderStrong values. All six you re-measured this round matched to two decimals. These depend on nothing but the hexes and the formulae. Usable directly.

Has been wrong every time
Anything modelling your code — ramp output, shade indices, which colour a surface actually draws. Three for three: the panel-chrome audit (measured the raw accent), the fill/stroke table (approximated surfaces), this index claim (re-implemented the ramp). Illustrations of a problem's shape. Measure before using.

That rule is now written into COLOR-SPEC.md and the brief, so it outlives this conversation. And by it, your caveat about my OKLCH-side numbers is correct — the Cyberpunk gamut table and the ΔE migration table both assume lightness stops you haven't chosen. Both are now marked as illustrative in the spec, with the one measured value substituted in. The hazards they describe are real; the magnitudes are not predictions.

Everything else
P75-F scoping is right, and the regression test on resolved shade rather than stored index is the part that makes it durable. borderStrong adopted as specified — and worth noting those four derived values landed exactly, which is the first category above doing its job. Holding on trademark clearance; that's the gate and there's nothing useful I can do ahead of it.