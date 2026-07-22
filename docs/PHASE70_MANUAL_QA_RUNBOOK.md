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
| P70-C | Extracted the "GET nonce endpoint, parse" logic into one pure `services/http/fetchNonce.ts`; the transport, `wpNonce.fetchFreshNonce`, and the heartbeat now share it; heartbeat no longer touches the nonce globals | No — same fetch, same store. Optional: watch the heartbeat's `/v1/nonce` request |
| P70-D | `GALLERY_BREAKPOINTS` now defined once in `utils/galleryConfig.ts` and re-exported from `components/Common/galleryConfigUtils.ts`; boundary docs added | No — same exported value from one source |
| P70-F | The 15 one-line `set*` template setters collapsed into one generic `builder.setTemplateField(key, value)` (label from a map); `setBackgroundImage`/`setCanvasHeightVh` kept as transform wrappers; ~23 call sites updated | No — same mutations, same undo/redo labels. Optional: exercise Layout Builder fields + undo/redo |
| P70-G | Split `types/index.ts` (1811 lines) into `types/{gallerySettings,media,access,campaign,layoutTemplate}.ts`, all re-exported from `types/index.ts` | No — every `@/types` import resolves to the same type. `tsc -b` is the proof |
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

### P70-C — Nonce-refresh consolidation

**What & why.** "GET the nonce endpoint (presenting the current nonce as `X-WP-Nonce`), parse the `nonce` field, store it" was implemented three times: `HttpTransportImpl.refreshNonce` (the 403-retry path), `useNonceHeartbeat`'s inline `refresh()` (which bypassed the P51-D helpers and read/wrote `window.__WPSG_*` directly), and — for the store half — `wpNonce.ts`. P70-C extracts the **fetch-and-parse** into one pure `services/http/fetchNonce.ts::fetchNonceFrom(url, currentNonce?)` (WordPress-agnostic — takes URL + nonce as args, touches no globals). The transport calls it directly; `wpNonce.fetchFreshNonce(apiBase)` wraps it with `getWpNonce()` + `WP_NONCE_PATH`; the heartbeat calls `fetchFreshNonce` + `setWpNonce`, so it no longer reads or writes the nonce globals. The transport stays decoupled from WordPress (it imports the pure helper from its own `http/` layer, never `wpNonce.ts`).

**Pre-fix behaviour.** Three separate fetch/parse copies; the heartbeat read `window.__WPSG_CONFIG__.restNonce`/`__WPSG_REST_NONCE__` and wrote both globals inline.

**This is a no-behaviour-change track — the meaningful check is equivalence, backed by the thorough existing coverage.**

**Verification (primary — automated).**
```bash
npx vitest run src/services/http/HttpTransportImpl.test.ts src/services/http/fetchNonce.test.ts src/services/wpNonce.test.ts src/hooks/useNonceHeartbeat.test.ts
npx tsc -b
```
The pre-existing transport tests (`403 nonce refresh and retry`, `persists via injected setNonce`, `hits baseUrl+noncePath / skips when omitted`, `does NOT retry on non-403`) and heartbeat tests (fetch URL+headers, global updated, network-error, non-OK, no-`nonce`-field) pass **unmodified** — they pin the exact behaviour the shared helper must reproduce. The new `fetchNonce.test.ts` covers the pure helper directly (fresh nonce + `X-WP-Nonce` header; header omitted when no current nonce; null on non-OK / missing field / thrown error).

**Why it proves the fix.** The transport and heartbeat tests assert the *observable* contract (same URL, same header, same stored result, same retry semantics); their passing unmodified means the extraction changed no behaviour. The new unit test pins the single shared implementation so a future regression localises to one place.

**Optional live check.** On a nonce-only (non-JWT) dev site, open DevTools → Network and confirm the heartbeat fires a `…/wp-json/wp-super-gallery/v1/nonce` GET on mount (and every interval) carrying an `X-WP-Nonce` header, and that `window.__WPSG_CONFIG__.restNonce` updates to the returned value — identical to pre-fix.

**Regression checks.** New: `src/services/http/fetchNonce.test.ts`. Unchanged: transport / wpNonce / heartbeat suites all green without edits.

**Pitfall.** The pure helper lives in `services/http/` (transport layer), **not** in `wpNonce.ts`. That is deliberate: the transport must remain publishable without dragging WordPress along (P51-D), so it cannot import `wpNonce.ts` (which touches `window.__WPSG_*`). If you "consolidate" further by moving `fetchNonceFrom` into `wpNonce.ts` and importing it from the transport, you re-couple the transport to WordPress. Also note the heartbeat still reads `enableJwt` and `apiBase` from `window.__WPSG_CONFIG__` — those are non-nonce config the hook legitimately owns; only the *nonce* read/write moved to the helpers.

---

### P70-D — `GALLERY_BREAKPOINTS` deduplication

**What & why.** `src/utils/galleryConfig.ts` (pure config transforms) and `src/components/Common/galleryConfigUtils.ts` (editor helpers) each defined `GALLERY_BREAKPOINTS = ['desktop','tablet','mobile']` independently. P70-D makes `utils/galleryConfig.ts` the single home and has the editor module import + re-export it, and adds a top-of-file doc comment to each stating its side of the boundary (pure transforms vs editor helpers). The files stay split (they have a real boundary; `galleryConfigUtils` already imports from `galleryConfig`, never the reverse).

**This is a no-runtime-surface track — the meaningful check is `tsc -b` + a diff review.** `GALLERY_BREAKPOINTS` is a static `['desktop','tablet','mobile']`; there is nothing to observe at runtime, and both the old duplicate and the new single source produce the identical array.

**Verification (the whole proof).**
```bash
npx tsc -b
npx vitest run src/utils/galleryConfig.test.ts src/components/Common   # gallery-config coverage
```
Plus a diff review confirming: the editor module no longer *defines* `GALLERY_BREAKPOINTS` (it imports it from `@/utils/galleryConfig` and re-exports), and every existing importer (`GalleryAdapterSettingsSection`, and any editor-side consumer) still resolves the same value.

**Why it proves the fix.** The only risk in a "define once, re-export" move is a broken import or a changed value; `tsc -b` catches the former and the value is a literal array reviewable by eye. The gallery-config test suites exercise the breakpoint iteration paths in both modules.

**Regression checks.** None new — existing gallery-config tests pass unmodified from the single source of truth.

**Pitfall.** The dependency only ever points editor → pure (`galleryConfigUtils` imports from `galleryConfig`). Do **not** add an import the other way (pure transforms must not depend on editor helpers) — it would create a cycle and violate the documented boundary.

---

### P70-F — Generic `setTemplateField`

**What & why.** `useLayoutBuilderState` defined 17 near-identical one-line template-field setters — `mutate((d) => { d.<field> = v; }, '<label>')`. P70-F replaces the 15 pure ones with a single generic `setTemplateField<K extends keyof LayoutTemplate>(key, value)` that looks the undo/redo label up in a module-level `TEMPLATE_FIELD_LABELS` map (so the labels are byte-identical to before). The two setters with a real value transform stay as thin named wrappers over it: `setBackgroundImage` (`'' → undefined`) and `setCanvasHeightVh` (clamp 1–100). The ~23 builder-UI call sites now call `builder.setTemplateField('backgroundColor', c)` etc.

**Pre-fix behaviour.** Each field had its own named setter (`builder.setBackgroundColor(c)`) with an inline `mutate` + hard-coded label.

**This is a no-behaviour-change track — but it has a real interactive surface (undo/redo labels), so exercise it.**

**Verification (primary — automated).**
```bash
npx vitest run src/hooks/useLayoutBuilderState.test.ts src/hooks/useLayoutBuilderState.coverage.test.tsx src/components/Admin/LayoutBuilder/BuilderHistory.test.tsx
npx tsc -b
```
The builder-history tests assert the undo/redo label produced by a rename etc.; because the label map preserves the exact strings (`'Rename template'`, `'Change background color'`, …), those assertions pass after the call sites were switched to `setTemplateField`. `tsc -b` guarantees every `setTemplateField('field', value)` uses a real `keyof LayoutTemplate` with a correctly-typed value — a wrong field name or value type is a compile error, which is the safety net for the ~23 mechanical call-site rewrites.

**Why it proves the fix.** The generic setter's only job is "set `d[key] = value` under a per-field history label." The history tests prove the label is unchanged; `tsc` proves each call site targets the right field/type; the coverage test drives `setTemplateField` across every field. Together they show the collapse changed nothing observable.

**Manual check (recommended).** In the Layout Builder, change a handful of the affected fields — template **name**, **aspect ratio**, **background color/mode/gradient**, **canvas height mode**, **image opacity** — and confirm: (1) each edit applies exactly as before; (2) the undo/redo history entry is labelled the same as pre-fix (e.g. "Change background color"); (3) undo/redo steps through them correctly. Also verify the two transform wrappers still behave: clearing the background image (`'' → undefined`) removes it, and a height-vh outside 1–100 is clamped.

**Regression checks.** Updated test call sites (source removal of the named setters required switching test call sites to `setTemplateField`); no assertions changed because behaviour and labels are identical. New: none.

**Pitfall.** `setTemplateField` is generic over *all* `keyof LayoutTemplate`, so it *could* set structural fields (`slots`, `id`) — callers must only use it for scalar template fields (the label map documents the intended set; unmapped keys fall back to a generic "Update template" label). The two transform wrappers must **stay** wrappers — inlining `setBackgroundImage('')` as `setTemplateField('backgroundImage', '')` would store an empty string instead of `undefined` (a behaviour change), and dropping the `setCanvasHeightVh` clamp would allow out-of-range heights.

---

### P70-G — `types/index.ts` split into per-domain files

**What & why.** `src/types/index.ts` was a 1,811-line barrel with 73 exports spanning unrelated domains — every edit invalidated a very wide TS dependency graph and finding a type meant scrolling a huge file. P70-G moves the definitions into five per-domain files — `types/gallerySettings.ts` (gallery config/runtime + behaviour/card settings), `types/media.ts`, `types/access.ts` (user + RBAC), `types/campaign.ts` (Company + Campaign), `types/layoutTemplate.ts` (Layout Builder model) — and `types/index.ts` becomes a five-line re-export barrel. Cross-domain references use `import type` (a clean DAG: `campaign → media + gallerySettings`, `layoutTemplate → gallerySettings`; the rest self-contained).

**This is a no-runtime-surface track — the meaningful check is `tsc -b`, and that is the correct check.** A barrel split either resolves for *every* consumer or it fails loudly at compile time; there is no partial/subtle runtime failure mode to click through. Inventing a browser step here would be theatre.

**Verification (the whole proof).**
```bash
npx tsc -b        # every @/types import site re-resolves; a missed export or bad cross-import errors here
npx vitest run    # the full suite imports @/types transitively everywhere — green = the barrel is complete
npx eslint src/types/
```
Plus a **diff review** confirming: (1) `index.ts` is now only `export * from './…'` lines; (2) the sum of exported names across the five files equals the original 73 with no duplicates (checked mechanically during implementation); (3) no import site anywhere changed (the whole point).

**Why it proves the fix.** "Zero import-site changes" means the observable surface is identical by construction — the only thing that could break is a mis-split (a type that lost a needed import, or an export that vanished), and `tsc -b` over the whole project catches exactly that. A green full-suite run additionally exercises every module that imports `@/types`.

**Regression checks.** None new. The proof *is* the existing type-check + full suite passing unmodified.

**Pitfall.** The split relies on `import type` for cross-domain references; TypeScript erases these so even a cyclic type reference would be harmless — but this split is acyclic by design. If a future edit adds a *value* (not type) cross-dependency between domain files, use a normal `import` and watch for a real runtime cycle. Also: the three non-exported helper consts/functions (`DEFAULT_GALLERY_COMMON_SETTINGS`, `createDefaultGalleryScopeConfig`, `createDefaultGalleryConfig`) stayed in `gallerySettings.ts` alongside their only consumer (`DEFAULT_GALLERY_BEHAVIOR_SETTINGS`) — don't "promote" them to the barrel; they are intentionally module-private.

---

## 4. Sign-off checklist

| Track | Primary assertion | Regression assertion | Done |
|---|---|---|---|
| P70-A | Adapter smoke + `listingMode` snapshot green **unmodified**; new `_shared` unit tests green; `tsc -b` clean | Existing per-adapter tests unchanged | ☐ |
| P70-B | Adapter smoke suite green **unmodified**; config diff = the ~7 constants; optional live render of Diamond + Hexagonal matches | No new tests required beyond P70-A's shared units | ☐ |
| P70-C | Transport + heartbeat + wpNonce tests green **unmodified**; new `fetchNonce.test.ts` green; `tsc -b` clean; optional Network check shows heartbeat GET unchanged | Existing transport/heartbeat/wpNonce suites unchanged | ☐ |
| P70-D | `tsc -b` clean; gallery-config suites green; `GALLERY_BREAKPOINTS` defined once, re-exported, boundary docs present | Existing gallery-config coverage unchanged | ☐ |
| P70-F | Builder-state/history + coverage suites green (labels unchanged); `tsc -b` clean; manual Layout Builder field edits + undo/redo behave identically | Test call sites switched to `setTemplateField`, no assertion changes | ☐ |
| P70-G | `tsc -b` clean + full Vitest suite green **unmodified**; `index.ts` is a re-export barrel; 73 exports preserved, zero import-site changes | Proof = existing type-check + suite passing | ☐ |
| P70-H | *(pending)* | | ☐ |

**Automated baseline (must be green alongside manual QA):** `npx tsc -b`, the front-end Vitest suite (`npm test`), and `npx eslint` on changed files. See PHASE70_REPORT.md → each track's *Implementation* block for per-track rationale.
