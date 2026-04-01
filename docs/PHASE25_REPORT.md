# Phase 25 - Modal Reliability, Shared Media Entry, and Backlog Cleanup

**Status:** In Progress
**Created:** March 31, 2026
**Last updated:** April 1, 2026

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
| P25-H | Reorganize Campaign Gallery Config into accordions and only expose adapter settings for explicit overrides | Implemented, pending QA | Medium (0.5 day) |
| P25-I | Add campaign card image-resolution controls for thumbnail imagery | Planned | Medium (0.5-1 day) |
| P25-J | Stabilize carousel multi-card focus and smooth small-set looping | Implemented, pending QA | Medium (0.5 day) |
| P25-K | Audit remaining carousel autoplay and advanced loop behavior in modal contexts | Planned | Medium (0.5 day) |
| P25-L | Add carousel card aspect-ratio and image-fit controls for image slides | Planned | Medium-Large (1-2 days) |
| P25-M | Fix WordPress settings sync so gallery settings saves no longer reset to defaults | Implemented, pending QA | Medium (0.5-1 day) |

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

## Second QA Follow-On Set

The next QA pass surfaced a more UX-oriented batch that still fits Phase 25 because it sits directly on top of the responsive gallery-config and carousel work already in flight:

1. Campaign Gallery Config is too flat and needs accordion structure so sections can be collapsed while tuning breakpoints.
2. The campaign override editor should only surface adapter-specific controls for explicit adapter choices on the active breakpoint instead of defaulting inherited scopes to carousel controls.
3. Card image settings need a focused image-resolution control path for thumbnail imagery.
4. Carousel multi-card behavior still needs cleanup around centered focus, visible-card counts, looping, autoplay, and image-specific fit/aspect-ratio controls.

These became P25-H through P25-L.

## Critical Settings Sync Follow-On

While verifying the new carousel behavior in the WordPress-hosted app, a more serious regression surfaced: saving app settings could make the WordPress side appear to reset gallery configuration back to defaults.

That issue belongs in the same phase because it blocks safe QA of the newly added gallery-config/editor work. It also exposed a second hardening gap: the plugin still lacks export/import for full settings snapshots.

The destructive reset bug became P25-M. Export/import remains a follow-on candidate once the sync fix is verified in a full WordPress test environment.

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

## Track P25-H - Campaign Gallery Config UX Cleanup

### Problem

Campaign Gallery Config has become hard to scan because every shared setting block stays expanded, and inherited breakpoint scopes were still surfacing carousel controls even when that breakpoint did not actually define an explicit adapter override.

### Fix

Reorganize the shared campaign gallery editor into accordion sections and only expose adapter-specific controls when the active breakpoint has an explicit adapter override for the relevant scope.

### Acceptance criteria

- Campaign Gallery Config sections can be collapsed while editing.
- Inherited scopes no longer masquerade as explicit classic/carousel overrides.
- Adapter-specific settings reflect the adapter actually selected on the active breakpoint.

## Track P25-I - Card Image Resolution Controls

### Problem

Card thumbnail tuning still lacks a dedicated image-resolution control path, which makes it harder to intentionally trade off fidelity against payload size for image-heavy galleries.

### Proposed direction

Add an image-only card-thumbnail resolution selector with common presets plus a custom path, scoped to card imagery rather than videos.

## Track P25-J - Carousel Multi-Card Focus and Small-Set Looping

### Problem

Carousel multi-card mode was still tracking the leftmost snap as the active item, which made captions and dot state feel off-center in multi-card layouts. Small multi-card sets also needed a safer looping path because Embla can fall back or jump abruptly when there are not enough distinct slides for a clean native loop.

### Fix

Treat the centered slide as the active item in multi-card mode, keep arrow/dot navigation aligned to that centered focus, and use a synthetic three-band loop fallback for small multi-card sets. The synthetic loop now waits for Embla `settle` before the invisible recenter so the last-to-first wrap remains visually smooth.

### Acceptance criteria

- Multi-card captions and dot state track the centered slide rather than the leftmost snap.
- Small multi-card sets can still wrap cleanly without exposing empty trailing frames.
- The synthetic last-to-first wrap completes with a smooth visible transition before the invisible recenter occurs.

## Track P25-K - Carousel Autoplay Audit

### Problem

QA still reports autoplay inconsistency in some modal/tablet contexts, which needs an isolated pass now that breakpoint resolution and basic multi-card guardrails are in better shape.

### Proposed direction

Audit Embla autoplay behavior with the current modal viewer lifecycle, hover handling, and drag interaction settings before making additional runtime changes.

## Track P25-L - Carousel Image Fit / Aspect Ratio Controls

### Problem

The classic carousel still lacks targeted image-card aspect-ratio and fit controls, which limits visual polish for image-dominant campaigns.

### Proposed direction

Add image-focused aspect-ratio and fit controls so carousel cards can be tuned more like image tiles, without forcing the same constraints onto videos.

## Track P25-M - WordPress Settings Sync / Reset Bug

### Problem

The WordPress-hosted settings flow was treating nested `gallery_config` as canonical on save, but legacy flat gallery settings were no longer being reconstructed on PHP reads or REST responses. That made subsequent settings loads look like they had snapped back to defaults even though the nested config had been saved.

### Fix

Keep nested `gallery_config` canonical in storage, continue stripping legacy gallery fields on save, and add a PHP-side bridge that reconstructs the legacy flat gallery settings from `gallery_config` whenever `WPSG_Settings::get_settings()` or the settings REST response is used.

### Acceptance criteria

- Saving WordPress app settings no longer makes gallery configuration appear to reset to defaults.
- The stored option keeps nested `gallery_config` as the canonical persisted representation.
- PHP callers and REST responses still receive legacy flat gallery fields projected from the nested config so existing consumers stay in sync.

## Follow-On Candidates After Core QA

These are not active implementation tracks yet, but they were promoted out of the general backlog as the next most defensible Phase 25 follow-ons once the current modal and QA blockers are verified.

| Candidate | Why it was surfaced |
|-----------|---------------------|
| Final legacy gallery bridge removal | Explicit carryover from Phase 24; legacy flat-field reads and bridge helpers still exist in the current codebase |
| Builder template deep clone | Solves a real duplication surprise with contained scope |
| Global settings export/import | Adds a recovery path for destructive config regressions and makes settings migration safer across environments |
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
- P25-H implementation now organizes the campaign gallery editor into accordion sections and only exposes adapter-specific controls for explicit active-breakpoint adapter overrides.
- P25-J implementation now treats the centered slide as the active multi-card focus, routes arrow/dot navigation through that centered focus, and uses a settle-based synthetic loop fallback for small multi-card sets so last-to-first wraps stay smooth.
- P25-M implementation now keeps nested `gallery_config` canonical in WordPress storage while reconstructing legacy flat gallery settings on PHP reads and REST responses so settings saves no longer appear to wipe gallery configuration.
- Targeted validation passed for `src/App.test.tsx`, `src/components/Common/ModalSelect.test.tsx`, `src/components/Common/GalleryConfigEditorModal.test.tsx`, `src/components/Campaign/UnifiedCampaignModal.test.tsx`, `src/components/CardViewer/CampaignViewer.test.tsx`, and `src/components/Admin/SettingsPanel.test.tsx`.
- Additional targeted validation passed for `src/components/Galleries/Adapters/carouselBehavior.test.ts`, `src/components/Galleries/Adapters/MediaCarouselAdapter.test.tsx`, `src/components/Common/GalleryConfigEditorModal.test.tsx`, `src/components/Admin/SettingsPanel.test.tsx`, and `npm run build:wp`.
- WordPress phpunit coverage was expanded for the P25-M bridge, but it could not be executed in this workspace because the local `wordpress-tests-lib` environment is not installed.
- Follow-up targeted validation is required for the new preview/revert flow, breakpoint-specific unified adapter edits, Manage Media stacking, the new campaign-editor/carousel quick wins, and in-browser verification of the WordPress settings reset fix.
- `docs/FUTURE_TASKS.md` already has live worktree edits; cleanup there should be patched carefully and remain candidate-based.
- The existing modal tests are useful for regression coverage, but they do not fully simulate Mantine portal behavior, so this phase should keep at least one explicit test around modal-scoped select props.