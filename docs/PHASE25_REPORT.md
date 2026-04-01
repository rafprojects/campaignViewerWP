# Phase 25 - Modal Reliability, Shared Media Entry, and Backlog Cleanup

**Status:** In Progress
**Created:** March 31, 2026
**Last updated:** March 31, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P25-A | Fix broken gallery-config dropdowns inside modal stacks | Implemented, QA confirmed | Small-Medium (0.5 day) |
| P25-B | Unify campaign media add flows around one shared entry surface | Implemented, QA follow-up tracked in P25-G | Medium-Large (1-2 days) |
| P25-C | Raise Settings panel above campaign/card modal stacks | Implemented, QA confirmed | Small (0.25 day) |
| P25-D | Reorganize `FUTURE_TASKS.md` and promote/prune backlog items | Implemented | Medium (0.5-1 day) |
| P25-E | Add live gallery-config preview with cancel-to-revert and save-to-persist semantics | Implemented, pending QA | Medium (0.5-1 day) |
| P25-F | Restore true per-breakpoint adapter selection in the shared gallery-config editor | Implemented, pending QA | Medium (0.5 day) |
| P25-G | Raise the shared Manage Media modal above the campaign viewer stack | Implemented, pending QA | Small (0.25 day) |

---

## Rationale

Phase 24 closed the responsive gallery parity work, but it left a few high-friction issues in the modal stack and campaign-admin workflow that now block QA:

1. Gallery-config dropdowns in the campaign flow are not usable.
2. The card/menu Add Media path is weaker than the Admin Panel flow because it cannot upload files.
3. Settings can open behind an already-open campaign/card modal.
4. `FUTURE_TASKS.md` has drifted into a mixed document of active work, historical work, and genuine deferred work.

This phase is intentionally focused. The first goal is to restore reliable QA surfaces, then unify the duplicate media-entry UX, then normalize backlog hygiene so future phase planning is based on current reality instead of stale carryover notes.

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Dropdown fix strategy | Use a shared modal-scoped `Select` wrapper that forces `comboboxProps.withinPortal = false` so dropdowns stay inside the active modal tree. |
| B | Settings stacking fix | Keep the Settings modal root-mounted, but explicitly raise its modal `zIndex` above the campaign/edit modal layer. |
| C | Add Media unification scope | Unify the upload + external URL entry flow first. Library-picking can remain attached to the full campaign media tab if keeping it separate reduces complexity. |
| D | `FUTURE_TASKS` cleanup policy | Normalize structure first, mark prune candidates instead of silently deleting them, and move clearly completed work into the appropriate historical phase docs. |

## Execution Priority

1. **P25-A** Fix gallery-config dropdown behavior in modal contexts.
2. **P25-C** Ensure Settings always opens above campaign/card modals.
3. **P25-B** Extract or share the campaign media add surface so upload and external URL entry behave consistently.
4. **P25-D** Normalize and prune `FUTURE_TASKS.md`, then promote high-value work into active planning.

## QA Follow-On Bugs

Manual QA after the first implementation pass confirmed that dropdowns and Settings stacking were fixed, but it also surfaced three follow-on issues that still belonged in Phase 25 rather than a later phase:

1. Gallery-config changes inside the campaign viewer did not preview live, which made responsive tuning slow and opaque.
2. The shared responsive editor was still flattening unified adapter choices across breakpoints even though the runtime resolver supports per-breakpoint unified adapters.
3. The shared Manage Media modal still opened below the campaign viewer stack because it was using the default modal layer.

These became P25-E through P25-G.

## Track P25-E - Live Campaign Gallery Preview

### Problem

Campaign viewer gallery-config edits only became visible after a save roundtrip, which prevented fast visual iteration and made it harder to tell whether responsive gallery choices were actually taking effect.

### Fix

Keep a viewer-local preview copy of the campaign gallery overrides while the responsive editor is open. Draft changes now update the rendered viewer immediately, cancel restores the last saved campaign state, and only Save persists the draft through the campaign API.

### Acceptance criteria

- Viewer gallery changes preview immediately while editing.
- Cancel reverts the viewer back to the last saved campaign state.
- Save remains the only action that persists responsive gallery changes to the backend.

## Track P25-F - Breakpoint-Specific Unified Adapters

### Problem

The shared responsive editor supported breakpoint-specific settings but still exposed unified adapter selection as one cross-breakpoint control, which effectively forced the desktop unified adapter onto tablet and mobile too.

### Fix

Move unified adapter selection into each breakpoint tab so the editor writes to `galleryConfig.breakpoints[breakpoint].unified.adapterId` instead of copying one unified adapter to every breakpoint.

### Acceptance criteria

- Unified gallery adapters can differ across desktop, tablet, and mobile.
- Editing one unified breakpoint does not overwrite sibling breakpoints.
- Runtime resolution continues to use the active breakpoint-specific unified adapter.

## Track P25-G - Manage Media Modal Layering

### Problem

After the shared media-entry modal replaced the card-menu external-only dialog, the campaign viewer could still sit above Manage Media because the shared modal kept Mantine's default layer.

### Fix

Pass an explicit high `zIndex` through the campaign Manage Media wrapper so the shared media-entry modal consistently opens above the campaign viewer and nested gallery-config editor stack.

### Acceptance criteria

- Manage Media always opens above the campaign viewer.
- The admin Media tab can continue using the shared modal without inheriting campaign-viewer-specific stacking assumptions.

## Follow-On Candidates After Core QA

These are not active implementation tracks yet, but they were promoted out of the general backlog as the next most defensible Phase 25 follow-ons once the current modal and QA blockers are verified.

| Candidate | Why it was surfaced |
|-----------|---------------------|
| Final legacy gallery bridge removal | Explicit carryover from Phase 24; legacy flat-field reads and bridge helpers still exist in the current codebase |
| Builder template deep clone | Solves a real duplication surprise with contained scope |
| Time-limited access grants | High user value for event-style galleries with a clear implementation path |
| Admin tab data reuse / SWR cache hardening | Medium user impact with a bounded audit-first implementation path |

## Track P25-A - Gallery Config Dropdown Reliability

### Problem

The shared gallery-config editor is opened inside other modal flows (`CampaignViewer`, campaign edit, and settings). Mantine `Select` dropdowns currently escape the active modal tree, which makes them unreliable or effectively unusable when layered inside nested dialogs.

### Fix

Introduce a shared modal-safe `Select` wrapper and use it for the gallery-config editor plus the other campaign modal surfaces that rely on the same select behavior.

### Acceptance criteria

- Gallery-config dropdowns open and can be selected inside the campaign modal flow.
- The fix is shared, not duplicated ad hoc across individual controls.
- Existing settings/theme select behavior remains intact.

## Track P25-B - Shared Add Media Entry

### Problem

The card/menu Add Media flow only supports external URLs, while the Admin Panel media flow already supports upload plus external URLs. That split creates a weaker UX in the place where admins often need the action most.

### Fix

Move toward one shared media-entry surface for campaign-level add-media actions, starting with the common upload and external-URL behaviors. The Admin Panel can keep any additional library-management affordances that are specifically admin-workspace oriented.

### Acceptance criteria

- The card/menu flow supports upload as well as external URLs.
- Shared upload and external-add UI/logic is reused instead of copy-pasted.
- Campaign media add success/error handling stays consistent across entry points.

## Track P25-C - Settings Modal Layering

### Problem

When a campaign/card modal is already open, launching Settings from the admin menu can place the Settings dialog behind the active modal stack.

### Fix

Raise the Settings modal layer above the campaign modal layer while preserving the existing nested responsive gallery editor behavior.

### Acceptance criteria

- Settings always opens above campaign/card/edit modals.
- The nested responsive gallery editor still opens above Settings.

## Track P25-D - `FUTURE_TASKS.md` Cleanup

### Problem

`FUTURE_TASKS.md` currently mixes genuine deferred work with historical items that were already implemented, phase-specific work that belongs in report docs, and exploratory notes that should be separated from actionable backlog items.

### Fix

Reorganize the backlog into a cleaner schema, identify prune candidates for confirmation, move finished items into the correct historical phase docs or an archival/details note, and promote high-value items into active planning where warranted.

### Acceptance criteria

- One consistent structure for remaining deferred work.
- Clear prune-candidate marking instead of silent removal.
- Completed items moved out of the active backlog.
- High-value items surfaced into active phase planning rather than buried in a catch-all list.

## Current Implementation Notes

- P25-A implementation now uses a shared modal-safe `Select` wrapper so gallery-config and campaign modal dropdowns stay in the active modal tree.
- P25-B implementation now routes the card-menu manage-media action through the same richer media-entry modal used in the admin campaign media flow, including upload plus external URL support.
- P25-C implementation now raises the Settings modal above the campaign/edit modal layer and keeps nested responsive gallery editors above both.
- P25-D backlog cleanup is now reflected in `docs/FUTURE_TASKS.md`, with active follow-on candidates separated from prune candidates and already-completed work.
- P25-E implementation now keeps a viewer-local draft of campaign gallery overrides so responsive edits preview immediately and cancel restores the last saved viewer state.
- P25-F implementation now exposes unified adapter selection inside each breakpoint tab instead of flattening one unified adapter across desktop, tablet, and mobile.
- P25-G implementation now raises the campaign Manage Media wrapper above the viewer stack without changing the admin Media tab's default modal layer.
- Targeted validation passed for `src/App.test.tsx`, `src/components/Common/ModalSelect.test.tsx`, `src/components/Common/GalleryConfigEditorModal.test.tsx`, `src/components/Campaign/UnifiedCampaignModal.test.tsx`, `src/components/CardViewer/CampaignViewer.test.tsx`, and `src/components/Admin/SettingsPanel.test.tsx`.
- Follow-up targeted validation is required for the new preview/revert flow, breakpoint-specific unified adapter edits, and Manage Media stacking.
- `docs/FUTURE_TASKS.md` already has live worktree edits; cleanup there should be patched carefully and remain candidate-based.
- The existing modal tests are useful for regression coverage, but they do not fully simulate Mantine portal behavior, so this phase should keep at least one explicit test around modal-scoped select props.