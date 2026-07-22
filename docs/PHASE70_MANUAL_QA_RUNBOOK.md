# Phase 70 — Manual QA & Validation Runbook

**Companion to:** [PHASE70_REPORT.md](PHASE70_REPORT.md). That doc is the plan and the *what/why*; this one is the detailed **HOW** for verifying each fix by hand. It follows the format of [PHASE69_MANUAL_QA_RUNBOOK.md](PHASE69_MANUAL_QA_RUNBOOK.md).

**Scope:** tracks P70-A … P70-H (P70-E and P70-I are deferred to a follow-on — see PHASE70_REPORT.md). Phase 70 is a **structure / abstraction / duplication-cleanup** phase: **nothing changes behaviour.** Every track either extracts shared code that renders identically, splits an oversized file into re-exported pieces, or collapses duplicated logic into one place.

**Golden rule (unchanged from P63–P69):** a fix's test is only meaningful if you have also seen it **fail without the fix**, *or* you understand precisely why the pre-fix and post-fix code are behaviourally equivalent. Because this phase is a pure refactor, **the second clause is usually the operative one** — for most tracks the honest, meaningful check is:

> **the existing snapshot/unit tests pass unmodified + `npx tsc -b` is clean + a diff review confirms the extraction is faithful.**

That is not a cop-out — it is the *correct* verification for a no-behaviour-change refactor, the same way Phase 69's doc used "the check is a diff review" for its documentation-only tracks. Where a track *does* have a worthwhile live check (render this gallery, exercise that field), it is called out explicitly. Where it genuinely has no runtime surface beyond "it still renders," the section says so and states the rationale instead of inventing hollow steps.

The cleanest way to watch the *equivalence* hold is to diff against the pre-phase commit:

```bash
git log --oneline | grep -iE 'p70|phase70'      # find the P70 commits
git checkout <commit-before-the-track>           # e.g. the P69 archive commit
# …render a gallery / run a suite, observe behaviour…
git checkout feature/phase70-react-hardening-3-of-4   # back to the refactor
```

---

## 1. Environment & personas

| Requirement | Why |
|---|---|
| Local `wp-env` dev site (`npx @wordpress/env start` from repo root) | Standard test host, base URL `http://localhost:8888`. Only needed for the *optional* live gallery-render checks. See the `project_phptest_wpenv_env` note: WSL nvm Node 20; use `npx @wordpress/env`. |
| Front-end dev server (`npm run dev`) or a build served via the shortcode | To eyeball a rendered gallery for the visual-equivalence checks (P70-A/B/H). |
| The Vitest suite (`npm test`) and type-checker (`npx tsc -b`) | The **primary** proof for every track — see the golden rule. |

**Personas / auth.** Unchanged from prior phases. The only track touching a privileged surface is P70-H (AdminPanel), which mounts for editor-or-above; see §2 of [PHASE63_MANUAL_QA_RUNBOOK.md](PHASE63_MANUAL_QA_RUNBOOK.md) for creating a System Admin and a `wpsg_editor`.

---

## 2. Mental model — what actually changed

| Track | The change | Observable at runtime? |
|---|---|---|
| P70-A | Extracted the per-adapter heading + lightbox JSX and the hand-rolled `ResizeObserver` into shared `_shared/AdapterHeading`, `_shared/AdapterLightbox`, `_shared/useContainerWidth`; migrated the 12 non-clipped adapters | No — identical DOM. Optional: render each gallery type and confirm heading/lightbox unchanged |
| P70-B | Collapsed `DiamondGallery` + `HexagonalGallery` (byte-identical bar ~7 constants) into one `_shared/ClippedTileGridGallery`; each adapter is now a ~45-line config wrapper | No — identical DOM. Optional: render a Diamond and a Hexagonal gallery |
| P70-C | *(pending)* | — |
| P70-D | *(pending)* | — |
| P70-F | *(pending)* | — |
| P70-G | *(pending)* | — |
| P70-H | *(pending)* | — |

---

## 3. Track-by-track

---

### P70-A — Shared adapter chrome (heading / lightbox / container-width)

**What & why.** All 14 gallery adapters hand-copied the same three chrome pieces: the `heading.visible && <Title>…</Title>` block, a `<Lightbox>` element whose five `settings.lightbox*` props were byte-identical everywhere, and (for three of them) a `ResizeObserver` effect measuring the container width. P70-A extracts these into `_shared/`:

- **`AdapterHeading`** — takes `common`, `heading`, an optional `icon` (present ⇒ the `<Group>`+icon layout, absent ⇒ the bare-label layout, matching the two heading shapes that existed) and an optional `titleStyle` (Masonry's typography style). *LayoutBuilder keeps its own `<Text>`-based heading* — it was never the `<Title>` shape, so it is intentionally not migrated.
- **`AdapterLightbox`** — owns the five `settings.lightbox*` → prop mappings; the variable props (open state, media, index, nav callbacks) stay per-adapter.
- **`useContainerWidth(ref)`** — the exact Diamond/Hexagonal effect (initial synchronous `clientWidth` read + `ResizeObserver` on `contentRect.width`), taking a consumer-supplied ref. Consumed by `ClippedTileGridGallery` (P70-B); *LayoutBuilder's* observer is **deliberately left inline* — it uses a different, no-initial-read shape whose first-render breakpoint must not shift.

**Pre-fix behaviour.** Each adapter rendered the heading/lightbox from its own inline JSX. **Post-fix behaviour must be identical** — component extraction changes the React tree's internal boundaries, not the emitted DOM.

**This is a no-behaviour-change track — the meaningful check is equivalence, not a click-through.**

**Verification (primary — automated).**
```bash
npx vitest run src/components/Galleries/Adapters/     # smoke + listing-mode snapshot suites
npx vitest run src/components/Galleries/Adapters/_shared/   # new AdapterHeading/AdapterLightbox/useContainerWidth units
npx tsc -b
```
- The adapter smoke suite (`__tests__/adapters.test.tsx`) and the `listingMode` **DOM snapshot** exercise the migrated adapters; a component-boundary refactor that preserved output leaves them green *unmodified*. That the snapshot (which serializes `data-wpsg-*` attributes + inline styles) is unchanged is the strongest single signal that the DOM did not move.
- The new unit tests pin the extracted pieces directly: `AdapterHeading` (hidden → nothing; icon shown/hidden by `showGalleryLabelIcon`; label-only variant; `titleStyle` applied), `AdapterLightbox` (all five settings props + variable props forwarded), `useContainerWidth` (initial `clientWidth` seed, `ResizeObserver` update, teardown on unmount).

**Why it proves the fix.** The extraction's *entire* contract is "same output, fewer copies." Unchanged snapshots + green smoke tests demonstrate the output is unchanged; the new unit tests demonstrate the shared pieces reproduce each per-adapter branch (icon vs no-icon, the five lightbox props, the width seed).

**Optional live check (visual equivalence).** On the dev site, render a gallery of each family — one icon-heading adapter (e.g. Circular/Masonry), one label-only adapter (e.g. Spotlight/Coverflow), and the carousel (MediaCarousel) — and confirm the heading (icon + label, or bare label) and the lightbox (open a tile, navigate, close) behave exactly as before. Toggle "show label icon" off and confirm the icon disappears but the label (and its `<Group>` wrapper) remain for the icon adapters.

**Regression checks.**
- **New:** `_shared/AdapterHeading.test.tsx`, `_shared/AdapterLightbox.test.tsx`, `_shared/useContainerWidth.test.tsx`.
- **Unchanged:** every existing adapter test (`__tests__/adapters.test.tsx`, `listingMode.test.tsx` + `.snap`, the per-adapter layout/height tests) passes without edits.

**Pitfall.** `AdapterHeading` distinguishes the two heading shapes by **whether an `icon` prop is passed**, *not* by `showGalleryLabelIcon`. The icon adapters always render the `<Group>` wrapper (icon shown/hidden inside it); the label-only adapters render the bare label with no wrapper. If you "simplify" `AdapterHeading` to always wrap in `<Group>`, the label-only adapters gain a wrapper element and the DOM diverges — the snapshot/visual check must stay honest to catch that.

---

### P70-B — `ClippedTileGridGallery` consolidation (Diamond + Hexagonal)

**What & why.** `DiamondGallery.tsx` and `HexagonalGallery.tsx` were 217-line files that differed only in ~7 constants (clip-path, vertical-overlap ratio, heading icon, CSS scope string, two icon-size ratios, and the video-badge styling). Every fix had to be applied twice — the files' own comments record a unit bug that was fixed once per file. P70-B moves the entire body into `_shared/ClippedTileGridGallery` (built on P70-A's chrome + `useContainerWidth`), driven by a `ClippedTileGridConfig`. Each adapter is now a ~45-line wrapper passing its config.

**Pre-fix behaviour.** Two independent components producing the diamond and honeycomb grids. **Post-fix must be pixel-identical** for each.

**This is a no-behaviour-change track — the meaningful check is equivalence.**

**Verification (primary — automated).**
```bash
npx vitest run src/components/Galleries/Adapters/    # Diamond & Hexagonal are in the parametrised smoke suite
npx tsc -b
```
The smoke suite renders both adapters and asserts item count, the video badge/label, lightbox trigger and empty-state handling — all green *unmodified* after the consolidation.

**Why it proves the fix.** The config object encodes exactly the ~7 constants that differed; everything else is now literally the same code path for both. A green smoke suite plus a config diff (Diamond: `clipPath` rhombus, `vOverlap: 0.5`, `IconDiamond`, ratios `0.22`/`0.2`, badge `26%`/`1px 4px`/`8`/`nowrap`; Hexagonal: hexagon `clipPath`, `vOverlap: 0.25`, `IconHexagon`, ratios `0.25`/`0.22`, badge `28%`/`1px 5px`/`9`) is a complete equivalence argument — there is no third behaviour the shared engine could introduce.

**Live check (recommended — this one is worth doing).** Because the two grids are visually intricate (offset rows, clip-paths, hover zoom, video badges), render **both** on the dev site with a mix of images and at least one video:
- Diamond tiles are rhombuses, offset half-a-tile, overlapping by half height; Hexagonal tiles are honeycombs overlapping by a quarter.
- Hover a tile → the overlay darkens and (for images) the zoom icon fades in.
- A video tile shows the play icon and the small "VIDEO" badge at the configured offset.
- Open the lightbox from a tile, navigate, close.
Confirm each matches the pre-P70-B behaviour (diff against the pre-phase commit if in doubt).

**Regression checks.**
- **Unchanged:** the parametrised adapter smoke suite covers both; no per-adapter snapshot exists for Diamond/Hexagonal, so the visual check above is the belt-and-suspenders for the pixel-level detail the smoke suite doesn't assert.
- **New:** none required beyond the shared-chrome units from P70-A (the shared engine's building blocks are unit-tested there).

**Pitfall.** Inline-style **property order** is preserved intentionally — the diamond badge appends `whiteSpace: 'nowrap'` *last*, the hexagon badge omits it. React serialises inline styles in insertion order, so the config spreads `whiteSpace` conditionally at the end to keep the emitted `style` attribute byte-identical. Do not "tidy" the badge style object by hoisting `whiteSpace` to a fixed position — it would reorder the serialized CSS.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P70-A | Adapter smoke + `listingMode` snapshot green **unmodified**; new `_shared` unit tests green; `tsc -b` clean | Existing per-adapter tests unchanged | ☐ |
| P70-B | Adapter smoke suite green **unmodified**; config diff = the ~7 constants; optional live render of Diamond + Hexagonal matches | No new tests required beyond P70-A's shared units | ☐ |
| P70-C | *(pending)* | | ☐ |
| P70-D | *(pending)* | | ☐ |
| P70-F | *(pending)* | | ☐ |
| P70-G | *(pending)* | | ☐ |
| P70-H | *(pending)* | | ☐ |

**Automated baseline (must be green alongside manual QA):** `npx tsc -b`, the front-end Vitest suite (`npm test`), and `npx eslint` on changed files. See PHASE70_REPORT.md → each track's *Implementation* block for per-track rationale.
