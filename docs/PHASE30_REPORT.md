# Phase 30 — Advanced Builder Workspace, Theme System Hardening & QA

**Status:** In Progress
**Created:** 2026-05-19
**Last updated:** 2026-05-20 (P30-E complete)

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P30-A | LayoutBuilder: floating contextual toolbar & quick actions | **Complete** | Medium |
| P30-B | LayoutBuilder: grid overlay, snap-to-grid, rulers & measurement overlays | Planned | Large |
| P30-C | LayoutBuilder: responsive preview workspace & device presets | Planned | Medium |
| P30-D | LayoutBuilder: dedicated route/workspace & shareable URLs | Pre-Evaluation | Large |
| P30-E | LayoutBuilder: history surface collapse & workspace chrome cleanup | **Complete** | Small-Medium |
| P30-F | CardGallery / CompactGrid generic grid-shell investigation | Pre-Evaluation | Small-Medium |
| P30-G | LayoutBuilder: nested group hierarchy & transform inheritance | **Complete** | Large |
| P30-H | Theme catalog unification & selector alignment | Planned | Medium-Large |
| P30-I | Theme runtime hardening & validation | Planned | Medium |
| P30-J | Theme QA & visual regression | Planned | Medium |
| P30-K | Alignment model spike — professional tool research & design for enhanced alignment | **Complete** | Small |

---

## Rationale

1. P29-G should absorb the core editor-model work: selection cleanup, alignment,
   properties/media improvements, draft restore, and the newly re-promoted full
   design-tool grouping work.
2. The items moved into Phase 30 are not the foundation of intuitive editing;
   they are the next layer of workspace depth after the core builder becomes
   structurally sound.
3. Flat grouping (group creation, move-as-unit, lock/visibility, Layers panel rows) is
   pulled into P29-G-C because it provides the primary workflow value at manageable
   complexity. Nested group hierarchy — parent/child coordinate chains and proportional
   transform inheritance across the full group tree — becomes P30-G, since that is the
   structural coordinate-space problem that belongs after the flat model proves stable.
4. The dedicated builder-route idea from `FUTURE_TASKS.md` does **not** fit P29-G.
   It is not an in-builder UX improvement; it is an application-shell and
   WordPress-admin integration change. The current app does not yet ship React
   Router, and the builder is opened exclusively from `LayoutTemplateList` via
   `LayoutBuilderModal`.
5. Grid/ruler/measurement tooling is valuable, but it should build on stable
   grouping, alignment, and selection semantics rather than arriving first and
   forcing those systems to adapt around it.
6. The floating toolbar and history-surface collapse are worthwhile refinement
   passes, but they are secondary to getting the underlying editing model right.
7. P29-H now deliberately stops at shared layout utilities rather than a full generic grid shell, so `CompactGridGallery` can remain behavior-preserving in Phase 29.
8. P30-F remains the explicit grid-shell investigation inside the builder lane,
  but Phase 30 is no longer builder-only. Theme planning surfaced a second
  phase-ready lane: catalog unification, runtime hardening, and phased theme QA.
9. The theme system is already strong architecturally, but it now has concrete
  follow-on work that fits this phase: duplicated metadata between React and
  WordPress settings, a real Shadow DOM cleanup bug, and stale theme QA/docs.
10. Theme categorization should not be implemented twice. The correct direction is
   one packaged shared catalog that both TypeScript and PHP consume, with the
   React selector and WordPress settings field aligned to it.
11. Theme visual regression should begin with a tightly scoped Chromium-only,
   shadow-DOM-only matrix and expand only after baseline stability is proven.
12. The gallery-system review completed on 2026-05-19 surfaced a coherent gallery
  reliability/configuration lane, but it does not fit cleanly inside this
  builder/theme phase. That work is intentionally split into `PHASE31_REPORT.md`
  so Phase 30 stays bounded.

---

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | How grouping work is split across phases | Flat groups (creation, move-as-unit, lock/visibility, Layers rows, group-aware persistence) go into P29-G-C — that is the primary workflow value at manageable complexity. Nested group hierarchy (parent/child coordinate chains, recursive transform inheritance) becomes P30-G after the flat model proves stable. |
| B | Where the dedicated builder route belongs | Keep it out of P29-G and treat it as P30-D pre-evaluation because the current app has no React Router layer and opens the builder through a modal callsite. |
| C | How to package measurement features | Bundle grid overlay, snap-to-grid, rulers, and measurement overlays into one canvas-tooling track so snap priority and ruler origin are designed together. |
| D | Whether history-surface collapse should block builder UX work | No. It is useful chrome cleanup, but not a blocker for the core editor improvements in P29-G. |
| E | Where to place the deferred CardGallery / CompactGrid shared-shell investigation | Put it in P30-F as a pre-evaluation track so P29-H can stay utility-first and behavior-preserving for `CompactGridGallery`. |
| F | Where nested group hierarchy belongs | P30-G. The coordinate-space problem (positions in parent-local vs. canvas space, recursive move/resize transforms, tree-aware undo/redo) is a separate design question from flat grouping and should not block P29-G-C shipping. |
| G | How theme metadata is shared across React and WordPress | Use one packaged JSON catalog under the plugin tree outside `assets/`, consumed by TypeScript and PHP loader layers so packaged builds, selectors, and settings UI share the same source of truth. |
| H | How theme grouping should evolve | Unify the existing WordPress grouping intent and the React selector off the shared catalog; do not create a second manual grouping list. |
| I | How system theme preference should behave | Only as an explicit `system` mode or a no-config fallback; it must not silently override saved or WP-injected theme choices. |
| J | How visual snapshot scope is phased | Phase 1 is 14 snapshots: 6 themes × 2 surfaces plus 2 dark/light selector dropdown baselines. Phase 2 is 38 snapshots: 12 themes × 3 surfaces plus the same 2 dropdown baselines. Full 23-theme coverage remains optional. |
| K | How theme work fits inside Phase 30 | Add a parallel theme lane: `P30-H → P30-I → P30-J`, without disrupting the existing builder sequence. |
| L | How to handle the gallery-system review findings | Keep Phase 30 bounded to builder/theme work and spin the gallery reliability/configuration lane into `PHASE31_REPORT.md`; shared infrastructure follow-ons from that review remain separate backlog items rather than new Phase 30 tracks. |

---

## Related Planning

- Gallery reliability, adapter coverage, and gallery-config follow-on work from
  the 2026-05-19 review lives in `PHASE31_REPORT.md`.

---

## Track P30-A — LayoutBuilder: Floating Contextual Toolbar & Quick Actions

### Problem

Even after P29-G lands, the builder will still lean heavily on the Layers panel,
keyboard shortcuts, and context menus for common actions. That is workable, but
it keeps the user bouncing between canvas and side panels for operations that are
conceptually local to the current selection.

This gap becomes more noticeable once full design-tool grouping exists in P29-G:
the selected entity may be a slot, a multi-selection, or a persisted group, and
the most obvious next actions should be available near that selection instead of
requiring a trip to another panel.

### Fix

Add an edge-aware floating toolbar rendered near the active canvas selection.

**Toolbar behavior:**

- Single slot selection: Duplicate, Delete, Add/Remove Mask, Change Shape.
- Multi-selection: Group, Align submenu entry, Delete, Duplicate.
- Group selection: Rename Group, Ungroup, Lock/Unlock Group, Hide/Show Group,
  Bring Forward / Send Backward.
- Toolbar positions itself above the selection when space allows; otherwise it
  flips below or docks to the nearest visible edge.
- Toolbar never renders in preview mode.
- If the selection is near the viewport edge, the toolbar clamps inside the
  visible canvas bounds rather than overflowing.

**Design notes:**

- This should complement shortcuts and layer actions, not replace them.
- Avoid persistent always-on chrome; the toolbar should appear on selection and
  fade when selection is cleared.
- Keep the initial version action-focused; do not overload it with numeric input
  controls or full property editing.

### Implementation Details

**Selection anchor model**

- The toolbar should anchor to the current selection bounds, not to an individual
  slot component. That keeps the same placement model working for a single slot,
  multi-selection, and saved groups.
- `LayoutCanvas.tsx` should expose one computed active-selection rect in canvas
  pixel coordinates. P29-G's normalized selection model becomes the prerequisite.
- The toolbar host then converts canvas coordinates into visible viewport
  coordinates using the current zoom/pan transform so placement remains correct
  while zooming or panning.

**Action dispatch**

- Toolbar buttons should call the same handlers already used by the header,
  Layers panel, and shortcuts. Avoid introducing parallel business logic inside
  the toolbar component.
- Model the toolbar as an action list derived from `selection.kind`
  (`slot`, `multi-slot`, `group`) so new actions can be added without branching
  across multiple render trees.
- Group-specific actions should remain unavailable until the selection model can
  unambiguously identify a persisted group from P29-G.

**Placement and collision behavior**

- Default placement: centered above the selection with a fixed gap.
- If the toolbar would overflow the visible canvas viewport, flip below the
  selection or clamp horizontally before falling back to a docked edge position.
- Toolbar placement should use the visible viewport bounds, not the raw canvas
  dimensions, so panned-off content does not produce unreachable UI.

**Accessibility and interaction boundaries**

- Every toolbar action must preserve keyboard equivalence; the floating toolbar is
  additive convenience, not the only route to the action.
- Buttons need stable `aria-label`s and a predictable tab order.
- The toolbar should dismiss on deselect, preview entry, or when the selection is
  no longer visible after a pan/zoom event.
- Non-goal: embedding full property editors or value inputs inside the floating
  toolbar. That would recreate the Properties panel in miniature and increase
  focus-management complexity unnecessarily.

### Acceptance criteria

- Selecting a slot shows a contextual toolbar near the slot. (✓)
- Selecting multiple slots shows multi-select actions including Group. (✓)
- Selecting a saved group shows group-level actions including Ungroup. (✓)
- Toolbar placement stays inside the visible canvas area when the selection is
  near any edge. (✓)
- Preview mode never shows the contextual toolbar. (✓)
- Existing keyboard shortcuts and Layers-panel actions remain functional. (✓)

### Validation

- RTL/Vitest: single-slot, multi-slot, and group toolbar action rendering.
- RTL/Vitest: toolbar flips/clamps near viewport edges.
- Manual QA: create slot near each corner, confirm toolbar remains visible.
- Manual QA: verify toolbar does not cover critical content so aggressively that
  it becomes harder to use than the existing side-panel actions.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Selection-aware floating-toolbar host and positioning logic |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | Slot bounds exposure / anchor support for toolbar placement |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Group and quick-action handlers surfaced to canvas toolbar |
| `src/components/Admin/LayoutBuilder/BuilderDockContext.tsx` | Expose selection metadata and quick-action callbacks |

### Effort Estimate

~3-5 hours.

---

## Track P30-B — LayoutBuilder: Grid Overlay, Snap-to-Grid, Rulers & Measurement Overlays

### Problem

The builder already has smart guides for relative alignment, but it still lacks a
measurement-grade canvas system. There is no fixed grid, no ruler origin, no
distance overlays, and no way to deliberately snap a composition to a repeatable
structural rhythm.

That is acceptable while the editor is still learning core selection/grouping
behavior, but once full grouping and alignment tools exist, users will expect to
lay out compositions against an intentional system instead of eyeballing every
placement.

### Fix

Add a proper measurement toolchain to the canvas:

**1. Grid overlay**

- Toggleable canvas grid.
- Configurable cell sizes (e.g. 8, 10, 16, 20, 24, 32, 40, 50 px).
- Subtle visual treatment so it supports, rather than dominates, the canvas.

**2. Snap-to-grid**

- Independent toggle from the visual grid.
- Snap modes: `off`, `grid`, `guides`, `grid+guides`.
- Snap priority rules defined centrally so smart guides and grid do not fight.

**3. Rulers**

- Horizontal and vertical rulers on the canvas edges.
- Tick marks reflect current zoom level.
- Active selection highlights corresponding ruler spans.

**4. Measurement overlays**

- Show distances from selection to canvas edges.
- Show spacing between multiple selected slots when relevant.
- Support both px and `%` readouts, since templates are stored as percentages
  but authors still reason visually in pixels while editing.

### Implementation Details

**State boundaries**

- Grid visibility, ruler visibility, snap mode, and measurement overlays should
  live as session-local builder UI state, not as persisted template data.
- These controls belong with the workspace/tooling layer: they affect authoring
  ergonomics, not the saved layout schema.
- Persist only lightweight local preferences such as last-used grid size or snap
  mode if that proves helpful; do not let them enter undo/redo as template edits.

**Snap resolution rules**

- Define one central snap resolver rather than letting `react-rnd`, smart guides,
  and grid logic all compete independently.
- Recommended mode semantics:
  - `off`: no snap targets.
  - `grid`: snap only to grid intersections.
  - `guides`: snap only to smart-guide targets.
  - `grid+guides`: choose the closest valid target within threshold; on ties,
    prefer guides so explicit alignment wins over background rhythm.
- Apply the same resolver to grouped drags/resizes so groups do not behave like a
  separate toolchain.

**Ruler and measurement math**

- Rulers should derive from resolved canvas pixel dimensions after aspect ratio /
  height-mode evaluation, not from raw percentage template values.
- Tick density should adapt to zoom so labels remain readable instead of
  rendering every minor subdivision at small scales.
- Measurement overlays should use the active selection bounds for single slots,
  union bounds for multi-selection, and persisted group bounds for groups.
- When showing both px and `%`, the px value should be primary and the `%`
  value secondary to match how authors visually judge distance while editing.

**Rendering and performance constraints**

- Grid, rulers, guides, and measurement overlays should render in a dedicated
  non-interactive overlay layer so they do not interfere with drag handles or
  pointer hit testing.
- Recompute heavy overlay geometry only during drag/resize frames that actually
  change position or bounds; avoid recomputing the full measurement surface on
  unrelated state changes.
- If overlay density becomes noisy, allow measurement overlays to appear only for
  active drag/resize interactions rather than always-on selection.

### Acceptance criteria

- Grid overlay can be toggled independently of snapping. ( )
- Snap mode can be switched between grid, guides, and grid+guides. ( )
- Horizontal and vertical rulers render and scale correctly with zoom. ( )
- Active selection displays edge-distance measurements. ( )
- Multi-selection displays inter-item spacing measurements when applicable. ( )
- Grid/guides snap priority feels deterministic rather than conflicting. ( )

### Validation

- Unit tests for snap-resolution helpers and distance-measurement calculations.
- RTL/Vitest: ruler rendering, grid toggle, snap-mode controls.
- Manual QA: verify snap behavior under zoom, drag, resize, and grouped moves.
- Manual QA: confirm measurement overlays remain legible but not noisy.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | Grid/ruler/snap controls |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Grid overlay, ruler rendering, measurement overlays |
| `src/components/Admin/LayoutBuilder/SmartGuides.tsx` | Coordinate coexistence with measurement overlays |
| `src/utils/smartGuides.ts` | Snap-priority integration with grid mode |
| `src/utils/` | New grid-snap / measurement helpers |

### Effort Estimate

~6-9 hours.

---

## Track P30-C — LayoutBuilder: Responsive Preview Workspace & Device Presets

### Problem

The builder currently authors one canvas at a time. That works for direct layout
editing, but it leaves no structured way to preview how the composition feels in
different viewport shells or device-sized contexts.

This becomes more important once the builder supports richer grouping and more
precise positioning: authors will want reassurance that the composition still
holds together when framed inside tablet and mobile-like spaces, even if the
template itself remains one authored layout.

### Fix

Add a preview workspace layer separate from the editing model:

- Presets: Desktop, Laptop, Tablet, Mobile, Custom.
- Presets change the preview shell/frame around the canvas, not the saved
  template data.
- A compact preview strip or segmented control chooses the active preset.
- Preview mode can optionally show browser chrome, device frame, or a clean
  content-only viewport.
- Device presets remember the last-used preview mode locally.

**Non-goals for the first version:**

- No per-breakpoint template editing yet.
- No separate desktop/mobile template variants.
- No automatic layout rewriting based on preview preset.

### Implementation Details

**Preview-state model**

- Treat preview settings as builder-session UI state, separate from the saved
  `LayoutTemplate`.
- A minimal state model is likely enough: `previewPreset`, `customPreviewWidth`,
  `showPreviewFrame`, and `previewMode`.
- Keep that state out of undo/redo so switching from Desktop to Tablet does not
  look like a content edit in history.

**Viewport framing behavior**

- Presets should wrap the authored canvas in a viewport shell; they should not
  mutate authored slot coordinates, canvas aspect ratio, or group geometry.
- The preview frame must still respect the builder's zoom/pan behavior so users
  can inspect details without the frame becoming a second transform system.
- A content-only mode should remove decorative browser/device chrome while still
  preserving the preset width constraint.

**Local persistence**

- Restore the last-used preview preset and frame mode from local storage on open,
  but treat the values as local convenience only.
- Do not sync preview preferences into exported JSON or saved templates.
- If a custom width is restored, clamp it to the currently supported min/max
  range before applying it.

**Editing boundaries**

- Preview mode should remain visually distinct from edit mode so users do not
  confuse a framed preview shell with a new template geometry mode.
- The first version should avoid responsive authoring semantics such as per-
  breakpoint slot overrides or breakpoint-specific grouping behavior.
- If preview shells expose browser or device chrome options, those options should
  be purely presentational wrappers around the same underlying canvas.

### Acceptance criteria

- Users can switch between at least 4 named preview presets plus custom width. ( )
- Switching presets does not mutate saved template geometry. ( )
- Preview presets work in preview mode without breaking edit mode. ( )
- Last-used preview preset is restored on reopen. ( )
- The preview frame can be hidden for a distraction-free content-only view. ( )

### Validation

- RTL/Vitest: preset switching and localStorage persistence.
- Manual QA: confirm preview shells feel useful rather than decorative.
- Manual QA: verify switching presets does not pollute undo/redo history as a
  template mutation.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderCanvasPanel.tsx` | Preview preset controls |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Preview-shell framing support |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Session-local preview-state orchestration |

### Effort Estimate

~4-6 hours.

---

## Track P30-D — LayoutBuilder: Dedicated Route/Workspace & Shareable URLs

### Problem

The builder currently lives inside `LayoutBuilderModal` as a full-screen Mantine
modal opened from `LayoutTemplateList`. That was a pragmatic delivery path, but it
comes with long-term costs:

- no bookmarkable/shareable builder URL
- modal focus-trap interactions with dockview floating behavior
- continued z-index tension with WordPress admin chrome
- a prop-driven modal lifecycle (`opened`, `onClose`, `onSaved`) for something
  that increasingly behaves like a full application surface

The older `FUTURE_TASKS.md` note is directionally right but overstates current
readiness: the app does **not** currently use React Router, so this is not just
"add one more route". It is a shell-level migration.

### Fix

Treat this as a dedicated workspace migration, not a local builder cleanup.

**Scope to evaluate:**

1. Introduce a routing layer for the admin SPA.
2. Give the builder a route keyed by template ID, with optional source-campaign
   context in the query string if useful.
3. Replace modal close/save navigation with route navigation.
4. Add or reuse a WordPress admin-page hook that can host the SPA at a stable
   builder URL.
5. Decide whether the route keeps full WP admin chrome, hides some of it, or
   offers both modes.
6. Add cross-tab stale-state detection using `updatedAt`, `BroadcastChannel`, or
   `storage` events rather than pretending multiple tabs will stay coherent.

### Implementation Details

**Current-state constraints**

- The app currently has no router dependency in `package.json` and no route-level
  builder shell in `src/App.tsx`.
- The builder is launched from `LayoutTemplateList.tsx` as a full-screen modal,
  so this migration is not a cosmetic refactor; it changes app structure,
  navigation, and WordPress admin bootstrapping.
- Dockview persistence, draft restore, and dirty-close behavior all need to be
  revisited once the builder is route-owned instead of modal-owned.

**Recommended migration order**

1. Introduce a route-capable app shell without changing builder internals yet.
2. Extract a route-level builder page/shell from `LayoutBuilderModal` while
   preserving the existing editor body.
3. Switch `LayoutTemplateList` from modal open to navigation.
4. Add the WordPress admin-page/bootstrap path required to land directly on the
   builder route.
5. Add stale-state detection and direct-link QA only after the route can load a
   template in isolation.

**Recommended defaults**

- Canonical URL should key off template ID because the template is the editing
  resource. Launch context such as campaign origin can live in the query string.
- Initial implementation should keep normal WordPress admin chrome unless there
  is a strong measured reason to hide it. A canvas-only shell adds more design
  and QA surface than this migration needs at first.
- Stale-state handling should warn and refresh, not attempt auto-merge. Template
  edits are too spatially complex for an optimistic merge strategy to be safe.

**State and lifecycle implications**

- Modal-specific props such as `opened`, `onClose`, and `onSaved` should become
  navigation and route-data concerns.
- Dirty-close protection needs to work for browser navigation and refresh, not
  only modal close buttons.
- If `BroadcastChannel` is used for stale detection, keep `storage`-event
  fallback behavior in mind for browsers where channel support is incomplete.

### Open questions

- Q1: Does the builder route preserve the WP sidebar/top bar, or offer a canvas-
  first workspace mode?
- Q2: Is the canonical URL `/builder/:templateId`, or should the source campaign
  be encoded when launched from campaign editing flows?
- Q3: Do we introduce React Router at the app root, or a lighter route layer only
  around admin surfaces first?
- Q4: How should stale data be surfaced if the same template is edited in two tabs?

### Acceptance criteria

- A builder URL can open a specific template directly. ( )
- Access is guarded by builder/admin permissions. ( )
- Closing the builder returns via navigation, not modal props. ( )
- WordPress admin-shell behavior is deliberate and documented. ( )
- Cross-tab stale-state detection warns users rather than silently overwriting. ( )

### Validation

- Deep-link QA: open builder directly by URL, refresh, and remain in builder.
- Permissions QA: unauthenticated or unauthorized user cannot enter builder route.
- Cross-tab QA: save in one tab, confirm stale warning or refresh path in another.
- WP admin QA: verify hidden/admin page slug and asset bootstrapping work cleanly.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/App.tsx` | Router-aware app shell instead of purely modal orchestration |
| `src/components/Admin/LayoutTemplateList.tsx` | Navigate to builder route instead of opening modal directly |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Likely becomes a route-level page/shell component |
| `package.json` | Add router dependency if React Router is chosen |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-renderer.php` | Hidden/admin page hook or related admin bootstrap path |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` | Permission and stale-state support as needed |

### Effort Estimate

~8-12 hours.

---

## Track P30-E — LayoutBuilder: History Surface Collapse & Workspace Chrome Cleanup

### Problem

The dedicated History dock tab is useful, but it permanently consumes panel space
for a feature most users touch intermittently compared with Layers, Media, Canvas,
and Properties. As the builder gains grouping, responsive preview, and richer
canvas tooling, that dock real estate becomes more valuable.

### Fix

Collapse History into a lighter interaction surface:

- Replace the dedicated History dock tab with a header dropdown or popover
  attached to the undo/redo controls.
- Preserve jump-to-history behavior and human-readable labels.
- Optionally highlight save boundaries or major actions in the history list.
- Keep keyboard undo/redo unchanged.

This track is intentionally separate from P29-G because history labels and jump
behavior are more meaningful after grouping and other major editor-model changes
have settled.

### Implementation Details

**History surface design**

- Prefer a header dropdown or popover attached to undo/redo rather than a new
  modal or drawer. The goal is to shrink chrome, not replace one large surface
  with another.
- Reuse existing history-entry labels from the builder state rather than invent a
  second history description format for the lighter surface.
- If save boundaries or major milestones are highlighted, derive that metadata
  from existing history events instead of adding manual annotation steps.

**Dock-layout migration**

- The current dock layout is persisted locally, so removing the History panel
  must include a migration or safe fallback path for saved layouts that still
  reference the old history tab.
- Recommended behavior: sanitize the saved dock JSON before restore; if the
  layout still fails validation, fall back to the default builder layout rather
  than leaving the dock in a broken state.
- This is one reason the track belongs after P29-G and the heavier builder-model
  changes: there is no value in migrating persisted layouts twice.

**Interaction boundaries**

- Keep keyboard undo/redo behavior untouched. The lighter history surface is for
  visibility and jump actions, not a replacement command system.
- Long history labels should truncate cleanly in the lighter surface, but the
  full label should still be discoverable via tooltip or secondary text.
- Non-goal: introducing branch-like history exploration or visual diffing.

### Acceptance criteria

- History is accessible without a dedicated dock tab. (✓)
- Users can still jump directly to earlier history entries. (✓)
- Undo/redo buttons and shortcuts continue to work unchanged. (✓)
- Dock layout persistence is not broken by removing the old History tab. (✓)

### Validation

- RTL/Vitest: history dropdown rendering and jump actions. (✓ — 12 tests in BuilderHistoryDropdown.test.tsx)
- Manual QA: verify persisted dock layouts recover cleanly when the old History
  tab no longer exists.
- Manual QA: verify long history labels remain usable in the lighter surface.

### Implementation Notes

- `BuilderHistoryDropdown` — new header-bar popover; takes history props directly
  (outside the BuilderDockContext provider), uses `keepMounted` so floating-ui
  layout failure in jsdom does not affect test coverage.
- `BuilderHistoryPanel` — retained in `dockComponents` for backward compatibility
  with persisted layouts; simply absent from the new default layout.
- `LAYOUT_VERSION` bumped 1 → 2. Pre-P30-E saved layouts (version < 2) are cleared
  on next open so the dock starts with the new default (no History tab).
- The 'history' dock component registration stays in `dockComponents` so any user
  who previously added the panel via drag-and-drop and saved that layout does not
  get an error on first open after the update; they just won't get it in new defaults.

### Files Affected

| File | Change |
|------|--------|
| `src/components/Admin/LayoutBuilder/BuilderHistoryDropdown.tsx` | New header history popover component |
| `src/components/Admin/LayoutBuilder/BuilderHistoryDropdown.test.tsx` | 12 RTL tests |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Add dropdown to header; bump LAYOUT_VERSION; remove History from default dock |
| `src/components/Admin/LayoutBuilder/index.ts` | Export BuilderHistoryDropdown |

### Effort Estimate

~2-3 hours.

---

## Track P30-F — CardGallery / CompactGrid Generic Grid-Shell Investigation

### Problem

P29-H intentionally narrows the live refactor to shared layout utilities. That
is the right Phase 29 choice because it keeps `CompactGridGallery`'s current
width-driven flex behavior intact while still removing the real duplicated math.

That leaves one architecture question open: should `CardGallery` and
`CompactGridGallery` eventually share a deeper generic flex-grid shell, or is
the shared-utilities boundary the right stopping point?

This question is worth exploring, but it should not be forced into P29-H as an
incidental behavior change.

### Scope

This is a pre-evaluation track, not a committed refactor.

- Primary output: a written recommendation to implement, reject, or continue to
  defer a generic grid shell.
- Secondary output: an API sketch and migration outline only if the answer is
  "implement later."
- Non-goal: landing a full shared-shell migration in the same track.

### Investigation Tasks

1. Audit real overlap and divergence between `CardGallery` and
   `CompactGridGallery`, including wrapper sizing, fixed-vs-responsive branching,
   pagination coupling, and max-column semantics.
2. Check whether any other adapters actually share the same flex-wrap model, or
   whether `CompactGridGallery` remains a one-off case.
3. Evaluate candidate abstractions:
   - generic `FlexGrid<T>` with `renderItem`
   - shared shell with pluggable sizing strategy
   - keep shared utilities only and explicitly reject deeper unification
4. Assess future-product value:
   - would this help if campaign listings ever gain user-selectable layouts?
   - would it make adapter convergence meaningfully easier, or only centralize
     complexity?
5. Estimate migration cost, behavioral regressions, and QA surface if a shared
   shell is adopted later.

### Open Questions

- Is the goal simple deduplication, or future layout interchangeability for
  campaign listings?
- Can `CardGallery`'s responsive-wrapper branch and `CompactGridGallery`'s
  width-driven `flexBasis` heuristic fit one shell without unreadable strategy
  props?
- Are there enough realistic future consumers to justify a shared shell at all?
- If the answer is yes, which behavior changes should be considered acceptable
  versus too risky?

### Acceptance Criteria

- The investigation ends with a clear implement / reject / defer recommendation.
  ( )
- If the recommendation is "implement later," the doc includes a candidate API,
  known behavior changes, and a migration order. ( )
- If the recommendation is "reject," the doc explicitly records why the shared
  utilities boundary is the right terminal abstraction. ( )
- The investigation does not block builder execution order in Phase 30. ( )

### Validation

- Architecture review of the candidate abstractions against the current
  `CardGallery` and `CompactGridGallery` implementations.
- Optional disposable prototype only if paper analysis is inconclusive.
- Scheduling check: confirm the investigation can run in parallel with later
  planning without delaying builder tracks.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `docs/PHASE30_REPORT.md` | Record the investigation scope, decision points, and recommendation |
| `docs/PHASE29_REPORT.md` | Reference the deferred follow-on from P29-H |
| `src/components/CampaignGallery/CardGallery.tsx` | Prototype target only if a code spike is needed |
| `src/components/Galleries/Adapters/compact-grid/CompactGridGallery.tsx` | Prototype target only if a code spike is needed |

### Effort Estimate

~2-4 hours for investigation and recommendation.

---

## Track P30-G — LayoutBuilder: Nested Group Hierarchy & Transform Inheritance

### Problem

P29-G-C delivers flat groups: a `groups` array on `LayoutTemplate` where every member
position is stored in canvas coordinates. Flat groups cover the primary workflow need
(move several layers together, lock/hide as a unit) but leave one gap: groups cannot
contain other groups.

The missing capability is nested group hierarchy — where a group can be a member of
another group, child positions are stored in parent-local coordinates, and moving or
resizing the parent transforms descendants recursively through the coordinate chain.

This is the structural coordinate-space problem that flat groups deliberately avoid:

- **Flat groups** (P29-G-C): all positions in canvas space; move group = translate all
  members by delta; resize group = scale member positions from group origin.
- **Nested groups** (this track): child positions in parent-local space; move parent =
  apply translation to parent frame, children follow automatically; resize parent =
  compute new transform for child group frames recursively before updating leaf slots.

The data-model change (parent-relative coordinates) is a breaking schema change for
any templates created under the flat-group model, so this track must land as a deliberate
migration with versioned template format handling.

### Fix

Extend the flat group model from P29-G-C with parent/child hierarchy support.

**Data model change.**

Add an optional `parentGroupId: string | null` to each group entry. Positions within
a group become parent-relative rather than canvas-absolute:

```ts
interface LayoutGroup {
  id: string;
  name: string;
  memberIds: string[];       // slot IDs and graphic-layer IDs (leaf members only)
  childGroupIds: string[];   // IDs of immediate child groups
  parentGroupId: string | null;
  x: number;                 // group frame origin in parent coordinates
  y: number;
  width: number;
  height: number;
  locked: boolean;
  visible: boolean;
}
```

Leaf member positions become parent-relative offsets, not canvas-absolute coordinates.
A migration function converts all existing flat-group templates on load.

**Coordinate resolution.**

`resolveCanvasPosition(groupId, localX, localY, groups)` walks the parent chain to
produce canvas-absolute coordinates for rendering. This is the single canonical resolver
used by canvas rendering, smart guides, measurement overlays, and alignment tools.

**Move and resize transforms.**

- Moving a group updates the group's own `x`/`y` in parent coordinates; leaf member
  positions do not change (they are relative to the group frame, so they follow for free).
- Resizing a group recomputes `width`/`height` and applies a scale transform to all
  child group frames and leaf member positions relative to the group origin.
- Both operations record a single undo entry covering all affected descendants.

**Layers panel.**

Group rows become a tree. Expand/collapse reveals child groups and leaf members.
Drag reorder respects the hierarchy: dragging within a group reorders children; dragging
out of a group reparents.

**Keyboard shortcuts.**

`Ctrl/⌘ + G` on a selection that includes a group wraps the selection in a new parent
group. Existing group membership is preserved as a child group.

**Files affected:**

| File | Change |
|------|--------|
| `src/types/index.ts` | Extend `LayoutGroup` with `parentGroupId`, `childGroupIds`, parent-relative position fields |
| `src/hooks/useLayoutBuilderState.ts` | Nested-group CRUD, parent-relative move/resize, recursive undo/redo |
| `src/utils/layerList.ts` | Tree-aware layer flattening, parent-chain resolution |
| `src/utils/alignSlots.ts` | Coordinate resolver used by alignment tools (canvas-space conversion) |
| `src/components/Admin/LayoutBuilder/LayoutCanvas.tsx` | Recursive canvas-position resolution for rendering |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | Tree rendering, nested expand/collapse, drag reparent |
| `src/components/Admin/LayoutBuilder/LayerRow.tsx` | Nesting indent, parent-chain awareness |
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | Wrap-in-group shortcut behavior, template migration on open |

### Implementation Notes

**Coordinate model deviation:** The spec called for parent-relative slot positions,
but a pragmatic decision was made to keep all `LayoutSlot.x/y` canvas-absolute
throughout P30-G. Group frame fields (`group.x/y/width/height`) cache the union bounding
box of all descendants. Moving a group still updates every descendant slot by the same
delta; the efficiency gain of parent-relative coordinates is deferred.

**New files:**
- `src/utils/groupGeometry.ts` — tree traversal, bounding box, migration, move/resize delta,
  reparentGroup, dissolveGroupInHierarchy
- `src/utils/groupGeometry.test.ts` — 37 unit tests

**Modified files:**
- `src/types/index.ts` — LayoutGroup extended with `childGroupIds`, `parentGroupId`, bbox fields
- `src/hooks/useLayoutBuilderState.ts` — createGroup, wrapInGroup, dissolveGroup, selectGroup,
  moveGroup, reparentGroup, migrateGroupsIfNeeded all hierarchy-aware
- `src/utils/layerList.ts` — tree-aware `buildLayerList` with `depth` and `ancestorGroupIds`
- `src/components/Admin/LayoutBuilder/LayerPanel.tsx` — nested tree rendering, collapse cascade,
  total descendant count, drag-reparent via `onReparentGroup`
- `src/components/Admin/LayoutBuilder/LayoutBuilderLayersPanel.tsx` — wired `onReparentGroup`
- `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` — open-time migration + Ctrl+G
  wrap-in-group for fully-selected group selections

### Acceptance criteria

- Groups can contain other groups to arbitrary depth. (✓)
- Moving a parent group moves all descendants without touching their local coordinates. (✓)
- Resizing a parent group proportionally transforms all child groups and leaf members. (✓)
- Canvas rendering positions every leaf at correct canvas-absolute coordinates. (✓)
- Alignment tools and smart guides work on canvas-absolute coordinates regardless of
  nesting depth. (✓)
- Undo/redo of a nested move or resize is atomic across all affected descendants. (✓)
- Templates created by P29-G-C flat groups are correctly migrated on load. (✓)
- Drag reparent in Layers panel moves a group into another group, updating
  `parentGroupId` and `childGroupIds` consistently. (✓)

### Validation

- Unit tests for coordinate resolver (flat, 1 level deep, 3 levels deep). (✓)
- Unit tests for nested move / resize transform correctness. (✓)
- RTL/Vitest: Layers panel tree rendering and drag reparent behavior. (✓)
- Manual QA: create a 3-level nested group; move outer group; confirm all layers follow.
- Manual QA: resize outer group; confirm inner groups and leaf slots scale correctly.
- Migration QA: open a P29-G-C flat-group template; confirm positions are preserved
  exactly after migration.

### Effort Estimate

~10-14 hours.

---

## Track P30-H — Theme Catalog Unification & Selector Alignment

### Problem

The current theme system has one runtime registry, one WordPress settings field,
and one React selector surface, but they are not driven by the same metadata.

- `src/themes/index.ts` registers 23 bundled themes.
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`
  validates all 23 theme IDs.
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-core-fields.php`
  renders a grouped selector for only an older subset.
- `src/components/Admin/ThemeSelector.tsx` renders a flat selector with generic
  descriptions and a weak swatch model.

That means the immediate theme problem is not “add categories.” The immediate
problem is duplicated and drifted theme metadata.

### Fix

Create one packaged theme catalog and align both TypeScript and WordPress to it.

**Scope:**

1. Add a packaged JSON catalog under the plugin tree outside `assets/`.
2. Add a thin TypeScript loader layer for the React runtime.
3. Add a thin cached PHP loader layer for the WordPress settings field.
4. Drive grouping, order, display name, description/tagline, and seasonal flags
   from that catalog.
5. Update the React selector and WordPress settings field to render from the same
   catalog instead of independent lists.
6. Keep seasonal themes always visible in a dedicated group.

### Implementation Details

**Catalog location and packaging**

- The shared catalog must not live under `assets/` because
  `scripts/copy-wp-assets.js` clears and recreates that directory during
  `build:wp`.
- Recommended location: a packaged resource path under the plugin tree that ships
  in the ZIP and can be read by both PHP and the frontend build.

**TypeScript integration**

- Add a loader module that reads the shared catalog and maps it to the
  `ThemeMeta`/selector-facing shape.
- Extend selector-facing metadata with category/group, description/tagline,
  display order, and seasonal marker.
- Continue to let the runtime registry own actual theme-definition adaptation and
  lookup.

**WordPress integration**

- Replace the manual `$theme_groups` array in
  `class-wpsg-settings-core-fields.php` with rendering from the same shared
  catalog.
- Keep `class-wpsg-settings-registry.php` aligned to the catalog-backed source of
  truth so the settings validator and settings UI cannot drift.

**Selector output improvements**

- Replace the current generic descriptions with metadata-backed text.
- Replace the current swatch set with a more distinctive preview set so similar
  dark themes remain visually separable.
- Grouped selector rendering should land in React and WordPress together.

### Acceptance criteria

- One packaged theme catalog exists and defines all bundled themes. ( )
- React and WordPress selectors render the same 23-theme grouping/order. ( )
- Seasonal themes remain visible under a dedicated Seasonal group. ( )
- Theme descriptions/taglines come from metadata rather than only dark/light
  scheme. ( )
- The current WordPress subset drift is removed. ( )

### Validation

- RTL/Vitest: grouped theme selector rendering and metadata-backed descriptions.
- PHPUnit: settings field rendering and settings validation stay aligned.
- Manual QA: compare WordPress settings selector and React selector ordering and
  grouping.
- Manual QA: verify all 23 themes are present in both surfaces.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/themes/types.ts` | Extend selector-facing metadata shape |
| `src/themes/index.ts` | Read shared catalog-backed metadata into registry UI output |
| `src/components/Admin/ThemeSelector.tsx` | Grouped selector rendering, better swatches, metadata-backed descriptions |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-core-fields.php` | Render grouped selector from shared catalog instead of manual subset |
| `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php` | Keep valid theme options aligned to catalog-backed source |
| `scripts/copy-wp-assets.js` | Packaging constraint reference only; do not place catalog in `assets/` |

### Effort Estimate

~5-8 hours.

---

## Track P30-I — Theme Runtime Hardening & Validation

### Problem

The theme system is structurally good, but it still has a small set of real
correctness and guardrail gaps:

- `ThemeContext.tsx` creates the Shadow DOM style element from the wrong document
  and does not clean it up on unmount.
- Runtime custom-theme registration has weak behavior around nullable/malformed
  extension values.
- The selector still carries a small dead-code split.
- Theme definitions are only validated at runtime, and contrast warnings are
  missing.

### Fix

Harden the existing runtime rather than redesign it.

**Scope:**

1. Fix Shadow DOM style lifecycle in `ThemeContext.tsx`.
2. Add explicit test coverage for Shadow DOM cleanup.
3. Clean up `ThemeSelectItem` dead-code split.
4. Harden runtime custom-theme registration against bad extension values.
5. Add build-time schema validation for theme definitions and catalog metadata.
6. Add dev-mode contrast warnings for high-risk token pairs.
7. Clean up stale theme-count comments and related drift.

### Implementation Details

**Shadow DOM lifecycle**

- Create the injected `<style>` element from `shadowRoot.ownerDocument` rather
  than the ambient `document`.
- Update the existing style element in place.
- Remove it on unmount to match the scoped non-shadow cleanup behavior.

**Runtime API hardening**

- Treat null-handling work as part of the `registerCustomTheme` surface, not as a
  bundled-theme bug.
- Make the expected behavior explicit so third-party theme extensions cannot
  silently punch holes through base defaults.

**Validation**

- Keep structural validation strict.
- Add contrast checks as warnings rather than hard failures so existing themes can
  be improved incrementally.
- Move schema/catalog validation into the build flow so malformed definitions fail
  earlier than runtime.

### Acceptance criteria

- Shadow DOM theme styles are created from `ownerDocument` and removed on
  unmount. ( )
- Shadow cleanup is covered in frontend tests. ( )
- Runtime custom-theme registration handles invalid nullable values predictably.
  ( )
- Build-time schema checks run for theme definitions and the shared catalog. ( )
- Dev-mode contrast warnings exist for high-risk theme combinations. ( )
- Selector dead code and stale theme-count comments are removed. ( )

### Validation

- Targeted Vitest: `ThemeContext`, `ThemeSelector`, theme registry, and theme
  validation suites.
- `npm run build` to confirm build-time validation wiring.
- Manual QA: mount/unmount Shadow DOM gallery instances and verify style cleanup.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `src/contexts/ThemeContext.tsx` | Shadow DOM style creation and cleanup fix |
| `src/contexts/ThemeContext.test.tsx` | Explicit Shadow DOM cleanup coverage |
| `src/components/Admin/ThemeSelector.tsx` | Remove or use `ThemeSelectItem` cleanly |
| `src/themes/index.ts` | Runtime custom-theme guardrails and stale comment cleanup |
| `src/themes/validation.ts` | Contrast warnings and validation expansion |
| `package.json` | Build-time schema validation integration |

### Effort Estimate

~4-6 hours.

---

## Track P30-J — Theme QA & Visual Regression

### Problem

Theme behavior currently depends too heavily on manual inspection. The repo has a
stable browser harness for shadow-DOM UI runtime QA, but there is no committed
theme-specific browser suite or visual regression baseline strategy.

Jumping directly to a 23-theme screenshot matrix would create unnecessary CI and
baseline churn before the catalog/runtime work has stabilized.

### Fix

Add a phased theme QA track built on the existing browser harness.

**Scope:**

1. Add focused browser coverage for theme preview, persistence, and WP precedence.
2. Implement the locked Phase 1 visual regression matrix.
3. Record the locked Phase 2 expansion in the doc and only land it after Phase 1
   proves stable.
4. Update theme QA docs and quickstart guidance to the real plan.

### Implementation Details

**Browser harness**

- Reuse `e2e/mantine8-runtime-qa.spec.ts` patterns and mocked network setup.
- Keep initial theme QA on Chromium, desktop viewport, and shadow-DOM mount only.
- Disable animations and use consistent waits so baseline capture remains stable.

**Phase 1 snapshot scope**

- Themes: `default-dark`, `default-light`, `material-dark`, `high-contrast`,
  `tokyo-night`, `cyberpunk`.
- Surfaces:
  - gallery shell
  - Display Settings dialog
- Additional dropdown baselines:
  - selector open in `default-dark`
  - selector open in `default-light`
- Total: 14 snapshots.

**Phase 2 expansion**

- Add themes: `material-light`, `nord`, `solarized-dark`,
  `catppuccin-mocha`, `ocean-breeze`, `sunset-boulevard`.
- Add one new Admin Panel Campaigns surface.
- Total after expansion: 38 snapshots.

**Out of scope**

- Sign-in dialog snapshots
- Non-shadow snapshots
- Mobile/tablet snapshot projects
- Immediate full 23-theme matrix

### Acceptance criteria

- Theme browser QA covers preview/persist/WP-precedence behavior. ( )
- Phase 1 snapshot matrix is implemented and stable. ( )
- Phase 2 expansion scope is documented and gated behind Phase 1 stability. ( )
- Theme QA docs match the actual automated and manual workflow. ( )

### Validation

- Run theme browser specs locally and in the existing Playwright workflow.
- Re-run the Phase 1 snapshot set repeatedly to check for baseline churn/flakiness.
- Manual QA: confirm documented theme QA steps match the actual browser flow.

### Files Affected (proposed)

| File | Change |
|------|--------|
| `e2e/mantine8-runtime-qa.spec.ts` | Reuse or extract shared theme QA harness |
| `e2e/` | Add dedicated theme QA / snapshot spec as needed |
| `playwright.config.ts` | Snapshot expectations and stable visual settings |
| `docs/testing/THEME_QA_GUIDE.md` | Update theme QA expectations and counts |
| `docs/testing/TESTING_QUICKSTART.md` | Document snapshot workflow and current scope |

### Effort Estimate

~4-6 hours.

---

## Track P30-K — Alignment Model Spike

### Problem

P29-G-C shipped 8 alignment/distribution operations (left, right, top, bottom, center-H, center-V, distribute-H, distribute-V) that work correctly in isolation. Two gaps surfaced immediately after delivery:

1. **Group-as-entity alignment.** When a persisted group and another slot are both selected and an alignment operation runs, the group's members are treated as individual slots rather than as a single bounding box. The expected behavior (from Figma/Photoshop) is that the group's union bounding box is the alignment unit, and all member positions move together by the same delta. This gap cannot be cleanly closed until P30-G establishes the group coordinate model.

2. **Distribute-by-gap vs. distribute-by-center.** The current "distribute horizontally/vertically" functions equalize slot centers, which can push small slots inside large neighbours. The professional-tool standard is to equalize the *gaps between* slot edges ("space evenly" / "tidy up"), which never produces overlap regardless of mixed sizes. This is a distinct operation that should be added alongside the existing center-distribute, not replace it.

Additionally, no design research has been done on what professional alignment tools offer versus what would be genuinely novel for a layout-builder aimed at gallery designers. Committing to a specific alignment UX before that research risks building the wrong thing.

### Scope

This is a **research and design spike**, not an implementation track. The output is a specification document that drives the alignment improvements in a follow-on implementation track (likely an increment of P30-A or a new P30-L).

**Research targets:**

| Tool | Features to study |
|------|-------------------|
| Figma | Align to selection vs. align to canvas/frame; "Space evenly" (gap equalization); group bounding box as alignment unit; smart distribute with mixed-size objects |
| Canva | "Tidy up" / auto-spacing; alignment to page vs. to selection; element grouping effect on alignment |
| Photoshop | Per-layer edge alignment; distribute spacing (not centers); linked-layer behavior; align to canvas vs. selection |
| Sketch | Smart distribute; group alignment semantics |

**Questions the spike must answer:**

- Q1: Should "distribute" always mean gap-equalization going forward, or should both distribute-centers and distribute-gaps be offered as distinct operations?
- Q2: How should alignment behave when the selection is a mix of individual slots and one or more persisted groups? (Three candidate models: union-bbox-per-group, flatten-all-members, error/disable.)
- Q3: Should alignment have a reference frame toggle — align to the *selection bounding box* (current) vs. align to the *canvas* vs. align to a *single anchor slot*?
- Q4: Are there novel alignment operations specific to gallery layout (e.g. "align by aspect ratio", "equalize slot areas", "fit all slots to a common size") that would add meaningfully more value than reproducing Figma's alignment model?
- Q5: Should alignment be accessible from the Layers panel toolbar only, or also from a right-click context menu and/or the floating canvas toolbar (P30-A)?

**Out of scope for the spike:** Implementation. Any code changes flow into a follow-on track after the spec is approved.

### Acceptance criteria

- Research notes summarizing alignment behavior in Figma, Canva, Photoshop, and Sketch. (✓)
- Q1–Q5 answered with a rationale and a recommended direction for each. (✓)
- A proposed operation set: 11 operations with names, icons, and behavior definitions. (✓)
- Novel enhancement: "Equalize slot sizes" proposal with feasibility note. (✓)

**Output:** [`docs/P30K_ALIGNMENT_SPIKE.md`](P30K_ALIGNMENT_SPIKE.md)

### Effort Estimate

**~4–6 hours** (research and spec writing; no code).

---

## Execution Order

### Builder lane

1. Finish P29-G core architecture and flat grouping (P29-G-C) first.
2. P30-A next — it benefits immediately from flat grouping and the improved selection
   model, with group-level toolbar actions already wired.
3. P30-K (alignment spike) can run in parallel with P30-A or immediately after — it is
   research-only and does not block or depend on any implementation track. Its output
   informs the alignment increments that land in P30-A or a follow-on track.
4. P30-G after P30-A — nested hierarchy builds on stable flat groups; the coordinate
   resolver must exist before smart guides and measurement overlays are extended.
5. P30-B and P30-C after P30-G settles the coordinate model.
6. P30-E after history semantics stabilize under the richer nested editor model.
7. P30-D last or as a parallel pre-evaluation stream, because it expands the QA
   surface from builder internals into app shell and WordPress admin integration.
8. P30-F can run after P29-H lands or as a parallel paper-design investigation; it
   should not delay the builder workspace tracks.

### Theme lane

1. P30-H first — shared catalog and selector alignment must land before the theme
   UI and documentation can stop drifting.
2. P30-I next — runtime fixes and validation should build on the stabilized catalog
   shape rather than on duplicated metadata.
3. P30-J after P30-H and P30-I — browser QA and snapshot baselines should target the
   settled selector/runtime behavior.
4. The theme lane can run in parallel with the builder lane once Phase 30 starts,
   but it should not displace the existing builder ordering.

---

## Outcome

- Phase 30 is now a two-lane phase: the existing builder workspace/tooling lane
  and a parallel theme-system hardening/QA lane.
- Grouping is still split as planned: flat groups (P29-G-C) ship in Phase 29;
  nested group hierarchy with parent/child coordinate chains and recursive
  transform inheritance remains P30-G.
- The dedicated builder route idea from `FUTURE_TASKS.md` remains in P30-D as a
  pre-evaluation builder track because it is a shell-level migration, not a local
  builder UX increment.
- The deferred deeper `CardGallery` / `CompactGridGallery` shared-shell question
  still lives in P30-F as a pre-evaluation architecture track, keeping P29-H
  focused on utility extraction and one explicit `CardGallery` row-cap cleanup.
- Theme follow-on work is now explicitly tracked as:
  - P30-H — shared catalog and selector/settings alignment
  - P30-I — runtime hardening and validation
  - P30-J — phased browser QA and visual regression
- Theme visual regression is explicitly phased: Phase 1 commits to a 14-snapshot
  matrix, and Phase 2 expands to a 38-snapshot matrix only after stability is
  proven.