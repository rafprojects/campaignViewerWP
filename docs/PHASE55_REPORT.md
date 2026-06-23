# Phase 55 - Code Quality & Refactoring

**Status:** Planned
**Created:** 2026-06-23
**Last updated:** 2026-06-23

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P55-A | Extract `SETTING_GROUP_DEFINITIONS` (~830 lines of data) out of `adapterRegistry.ts` into a data module | Planned | Medium |
| P55-B | Registration-seam decision — document `GalleryAdapterId` as an internal closed union | Planned | Small |
| P55-C | Unify the dual field-map via a **runtime shared schema** (single TS + PHP source of truth) | Planned | Medium-High |
| P55-D | Decompose `LayoutBuilderModal.tsx` (~1055 → ~600) into extracted hooks | Planned | Medium |
| P55-E | Decompose `useLayoutBuilderState.ts` (~1259 → ~700) into extracted hooks | Planned | Medium |
| P55-F | Decompose `MediaTab.tsx` (~1007 → ~500) into extracted hooks | Planned | Medium |

---

## Rationale

The Phase 54 production-readiness review confirmed the adapter pattern (Registry + Factory + Strategy) and the LayoutBuilder/media architecture are sound, and explicitly parked the *maintainability* cleanups in `docs/FUTURE_TASKS.md` rather than gating the release on them. This phase promotes the entire **Code Quality & Refactoring** backlog section as one coherent unit.

1. **What triggered it.** The review recorded three concrete adapter "footguns" — ~830 lines of *data* embedded in `adapterRegistry.ts`, a closed `GalleryAdapterId` union that fights the runtime `registerAdapter()` seam, and a dual TS/PHP field-map that is a single-source-of-truth violation ("add a field, edit two files") — plus three files carrying heavy orchestration load (`LayoutBuilderModal.tsx`, `useLayoutBuilderState.ts`, `MediaTab.tsx`).
2. **Why it belongs together.** Every track is a **no-user-visible-behavior** refactor guarded by existing tests, and they share one risk profile and one acceptance bar: a zero net behavior diff. Grouping them gives a single "structure is healthier, nothing changed for users" checkpoint.
3. **Success.** `adapterRegistry.ts` holds only registration/resolution logic; the camelCase↔snake_case field contract has exactly one source consumed by both TS and PHP; the three large files are decomposed into focused, separately testable hooks — with the full vitest + PHPUnit suites still green and no observable change in the app.

> **Pre-release — clean breaks, no back-compat.** The plugin is not shipped, so tracks delete dead paths rather than preserving them. P55-C specifically prunes the known-legacy orphan field entries instead of carrying them into the new schema.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Phase shape | **One combined Code Quality phase**, not two. Both backlog items are the same FUTURE_TASKS section and share the no-behavior-change profile; combining keeps room in the 2–3-phase budget for two feature phases (55→56→57). (User direction, 2026-06-23.) |
| B | Field-map unification approach | **Runtime shared schema** — one canonical schema file consumed by TS (build-time import) and PHP (runtime load). Chosen over codegen and over a hardened-parity-test-only guard as the truest single source of truth, accepting the larger blast radius. (User direction, 2026-06-23.) |
| C | Registration seam | **Document, don't widen.** No third-party adapter authors exist today, so widening `GalleryAdapterId` to arbitrary strings is YAGNI. Mark the union and `registerAdapter()` internal-only. |
| D | Legacy handling | **None.** Pre-release: prune dead field entries and the parity test's legacy-orphan allowlist rather than migrating them. (User direction, 2026-06-23.) |

## Execution Priority

1. **P55-A (data extraction)** — first; it relocates the field data that P55-C then promotes to the shared schema, so doing it first avoids touching `adapterRegistry.ts` twice.
2. **P55-B (registration seam)** — trivial doc-only change; land alongside A.
3. **P55-C (shared schema)** — highest risk (touches the PHP settings load path); land behind the parity test and a full TS + PHP suite run. Its schema also feeds Phase 56's client-side validation.
4. **P55-D / P55-E / P55-F (decomposition)** — independent of each other and of A–C; can run in parallel. E before D is convenient since D's keyboard handlers consume the state hook E reshapes.

---

## Track P55-A - Extract adapter setting-group data

### Problem

`src/components/Galleries/Adapters/adapterRegistry.ts` is ~1189 lines, of which `SETTING_GROUP_DEFINITIONS` (11 groups, ~100+ field definitions, ~830 lines) and the `BUILTIN_ADAPTERS` array (14 adapters) are pure *data*. Registration/resolution logic (`registerAdapter`, `normalizeAdapterId`, the `registry` Map, the select-option builders) is buried under the data, making the file's actual responsibility hard to see and the data hard to diff.

### Fix

- Move `SETTING_GROUP_DEFINITIONS` (and `BUILTIN_ADAPTERS`) into a data module under the existing `src/data/` convention — e.g. `src/data/adapterSettingGroups.ts` exporting an ALL-CAPS const plus its interface, mirroring `src/data/layoutPresets.ts`.
- `adapterRegistry.ts` retains only registration/resolution and re-exports as needed for existing import sites.
- Reuse the existing types in `GalleryAdapter.ts` (`AdapterRegistration`, `AdapterSettingGroupDefinition`); do not duplicate them.
- Keep UI grouping/layout metadata (`layout`, `placement`, `scopeMode`, group membership) co-located with the data here; only the field-level *contract* later moves to P55-C's schema.

### Acceptance criteria

- `adapterRegistry.ts` no longer contains the inline `SETTING_GROUP_DEFINITIONS` / `BUILTIN_ADAPTERS` literals; it imports them from the data module.
- No import site elsewhere in the app breaks (registry public API unchanged).
- `adapterRegistry.test.ts` and `adapterSettingsParity.test.ts` pass unchanged.

### Validation

- `npm run test` (vitest) — `adapterRegistry.test.ts`, `adapterSettingsParity.test.ts` green.
- `tsc --noEmit` + `npm run lint` clean.
- Net behavior diff zero (data moved, not changed).

## Track P55-B - Registration-seam decision

### Problem

`GalleryAdapterId` (`GalleryAdapter.ts:25`) is a closed TS union, but `registerAdapter()` is a runtime seam that *looks* extensible. A third party cannot actually register a new adapter id because the union won't accept it — the seam is effectively internal-only, and that contract is undocumented.

### Fix

- Treat the seam as **internal-only** (no third-party adapter authors exist today — widening the type is YAGNI).
- Add a doc comment on `GalleryAdapterId` marking it a closed internal union, and a doc comment on `registerAdapter()` stating it is internal-only (built-ins only) with a one-line note on what widening would entail if that ever changes.
- No runtime change.

### Acceptance criteria

- `GalleryAdapterId` and `registerAdapter()` carry clear internal-only doc comments.
- No type or runtime change; all suites pass unchanged.

### Validation

- `tsc --noEmit` + `npm run lint` clean; `adapterRegistry.test.ts` green.

## Track P55-C - Runtime shared field-map schema

### Problem

The camelCase↔snake_case field contract, plus field ranges and valid-options, is maintained **twice**:

- **TS** — field `key`s + `min`/`max`/`fallback`/`options` inside `SETTING_GROUP_DEFINITIONS`.
- **PHP** — `$nested_adapter_field_map` (96 entries) + `$nested_common_field_map` (31) in `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`, with ranges from `class-wpsg-settings-registry.php`.

Adding or renaming a field requires editing both sides in lockstep; `adapterSettingsParity.test.ts` catches drift but does not prevent the "edit two files" footgun. This is the single-source-of-truth violation flagged in the P54 review.

### Fix

- Introduce a canonical schema file (e.g. `schema/adapter-fields.json` or `src/data/adapter-fields.schema.json`) carrying per-field facts: `camelKey`, `snakeSlug`, `control`, `valueType`, `min`/`max`, `fallback`, `validOptions`, and `scope`/`appliesTo`.
- **TS** imports the schema at build time (Vite JSON import) and derives the P55-A data module's field-level facts and the camelCase↔snake_case map from it — no hand-maintained TS field keys.
- **PHP** reads the schema at runtime via a small loader (e.g. `WPSG_Adapter_Field_Schema` — `file_get_contents` + `json_decode`, statically cached) and sources `$nested_adapter_field_map`, ranges, and valid-options from it.
- Convert `adapterSettingsParity.test.ts` into the **contract guard**: assert both sides resolve to the same schema and the camelCase→snake_case transform still matches.
- **Clean break:** drop the known-legacy orphan field entries and the parity test's legacy allowlist; prune dead `$nested_adapter_field_map` slugs rather than carrying them into the schema.

### Acceptance criteria

- Exactly one source defines the field contract; the TS data module and the PHP sanitizer both derive from it.
- The PHP loader is statically cached (schema read once per request) and resolves the same map the sanitizer enforced before.
- No legacy-orphan field entries remain on either side.
- The parity test passes with both sides reading from the single schema; sanitizer behavior for valid input is unchanged.

### Validation

- `npm run test` — `adapterSettingsParity.test.ts` (rewritten as the contract guard) and `adapterRegistry.test.ts` green.
- PHPUnit — sanitizer/registry suites green, including a new case asserting the schema loader resolves the expected map and that an unknown/foreign field key is still rejected. PHP execution delegated to a Haiku subagent.
- `build:wp` smoke — confirm the schema file ships to `wp-plugin/.../assets` (or wherever PHP reads it) and the runtime loader finds it.
- Net sanitizer behavior diff zero for valid settings payloads.

## Track P55-D - Decompose LayoutBuilderModal.tsx

### Problem

`src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` (~1055 lines) carries modal lifecycle, ~24 keyboard-handler callbacks, asset-library handlers, JSON import/export, dock-layout persistence, and the context-provider assembly all inline. Panels are already extracted to siblings, but the orchestration logic remains a single dense file.

### Fix

No-behavior-change extraction following repo convention (1 hook per file in `src/hooks/`; inline UI helpers stay as function declarations with `setWpsgDebugDisplayName`). Extract pure logic into hooks, leaving the modal's public props and rendered output unchanged:

- `useLayoutBuilderKeyboardHandlers.ts` — the keydown listener + the ~24 action callbacks.
- `useLayoutBuilderAssets.ts` — upload/delete/tag/visibility/background/mask handlers + their loading state.
- `useLayoutBuilderFileIO.ts` — `handleExportJson` / `handleImportJson` + the import file ref.
- `useBuilderDockLayout.ts` — `handleDockReady`, localStorage key/version logic, default panel layout.

### Acceptance criteria

- `LayoutBuilderModal.tsx` drops to roughly ~600 lines; extracted hooks own the moved logic.
- The modal's external API (props) and rendered DOM are unchanged.
- Existing builder tests (`BuilderKeyboardShortcuts.test.tsx`, panel tests) pass unchanged.

### Validation

- `npm run test` (builder suites) green; `tsc --noEmit` + lint clean.
- Manual smoke of the LayoutBuilder (open, keyboard shortcuts, export/import, dock reset) via the `see-wp` flow.

## Track P55-E - Decompose useLayoutBuilderState.ts

### Problem

`src/hooks/useLayoutBuilderState.ts` (~1259 lines) bundles template mutations, slot CRUD, z-index reordering (P15-G), overlay CRUD (P15-H), the layer system, selection, undo/redo history, persistence, and the P30-G group hierarchy into one hook returning ~70 actions.

### Fix

Extract cohesive logic groups into sub-hooks composed back into the returned state object by the parent (public hook API and return shape unchanged):

- `useLayoutBuilderZIndex.ts` — `bringToFront`/`sendToBack`/`bringForward`/`sendBackward`/`normalizeZIndices`.
- `useLayoutBuilderOverlays.ts` — overlay add/remove/update/move/resize.
- `useLayoutBuilderGroups.ts` — the P30-G group hierarchy actions (create/wrap/dissolve/update/select/move/reparent + migration).
- `useLayoutBuilderHistory.ts` — past/future stacks, `pushHistory`, undo/redo/jump, trim tracking.

### Acceptance criteria

- `useLayoutBuilderState.ts` drops to roughly ~700 lines and recomposes the sub-hooks; its returned actions/state are identical.
- `useLayoutBuilderState.test.ts` and `useLayoutBuilderState.coverage.test.tsx` pass unchanged.

### Validation

- `npm run test` — `useLayoutBuilderState.test.ts` (and coverage) green; `tsc --noEmit` + lint clean.
- Net behavior diff zero (logic relocated, mutations identical).

## Track P55-F - Decompose MediaTab.tsx

### Problem

`src/components/Admin/MediaTab.tsx` (~1007 lines) holds the upload + near-duplicate flow, external/oEmbed media addition, edit/delete/rescan CRUD, and reorder/filter/sort display logic inline alongside the view JSX. Modals and sortable items are already extracted, but the handler/state load remains in one file.

### Fix

Extract handler+state groups into hooks (component props/output unchanged):

- `useMediaUpload.ts` — file select/remove/clear, the batch upload flow, and the near-duplicate resolution handlers + their state.
- `useMediaExternal.ts` — oEmbed fetch/preview, URL validation, add-external + state.
- `useMediaCrud.ts` — delete/confirm, edit open/save, rescan + state.
- `useMediaDisplay.ts` — `reorderMediaItems`, the `displayedMedia`/paged-list memos, filter/sort wiring.

### Acceptance criteria

- `MediaTab.tsx` drops to roughly ~500 lines; the four hooks own the moved logic.
- `MediaTab.test.tsx` passes unchanged (view behavior, upload errors, sort/filter/pagination).

### Validation

- `npm run test` — `MediaTab.test.tsx` green; `tsc --noEmit` + lint clean.
- Manual smoke of the Media tab (upload, near-dup, external add, edit/delete, reorder, sort/filter) via `see-wp`.

## Follow-On Candidates

| Candidate | Why it is deferred |
|-----------|--------------------|
| Widen `GalleryAdapterId` to arbitrary string ids for true third-party adapters | No third-party authors today; revisit only if a concrete external-adapter requirement appears (P55-B documents the seam additively). |
| Build-time codegen of the PHP map (instead of runtime schema load) | The runtime shared schema (Decision B) already removes the SSOT violation; codegen would be an optimization, not a correctness gain. |
| Further decomposition of the extracted hooks (e.g. background setters, selection) | Borderline-small; extract only if a future feature makes them grow. |
| Shared async-with-notifications helper across the decomposed handlers | Cross-cutting cleanup surfaced during D/E/F; only worth it if the pattern repeats enough. |

## Implementation Notes

- Record completed work here as tracks land; keep it factual.
- All tracks are refactor-only — the bar is a **zero net behavior diff**; existing suites are the regression net.
- PHP test/build execution is delegated to Haiku subagents; tests are authored in this repo.

## Outcome

_To be completed when the phase lands._
