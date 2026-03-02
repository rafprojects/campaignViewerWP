# Phase 19 — Builder Power Tools, Coverage Recovery & Dev Toolchain

**Status:** 🔄 In Progress  
**Version:** v0.17.0  
**Created:** March 1, 2026  
**Last updated:** March 1, 2026 — P19-QA complete (102 tests, functions 79.91%)

### Completed

| Track | Commit | Result |
|-------|--------|--------|
| P19-QA — Coverage Recovery Sprint | `9963400` | ✅ 102 tests across 11 files; functions coverage 79.91%; threshold raised 60% → 65% |

---

## Table of Contents

- [Phase 19 — Builder Power Tools, Coverage Recovery \& Dev Toolchain](#phase-19--builder-power-tools-coverage-recovery--dev-toolchain)
    - [Completed](#completed)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
  - [Architecture Decisions](#architecture-decisions)
  - [Track P19-QA — Coverage Recovery Sprint](#track-p19-qa--coverage-recovery-sprint)
    - [Components to cover](#components-to-cover)
    - [Hooks to cover](#hooks-to-cover)
    - [Coverage target](#coverage-target)
    - [Expected effort](#expected-effort)
  - [Track P19-A — Builder Keyboard Shortcuts](#track-p19-a--builder-keyboard-shortcuts)
    - [Shortcut map](#shortcut-map)
    - [Implementation](#implementation)
    - [Open questions](#open-questions)
  - [Track P19-B — Builder Undo/Redo Improvements](#track-p19-b--builder-undoredo-improvements)
    - [Goals for P19-B](#goals-for-p19-b)
    - [Data model](#data-model)
    - [Open questions](#open-questions-1)
  - [Track P19-C — WP-CLI Command Surface](#track-p19-c--wp-cli-command-surface)
    - [Command surface](#command-surface)
    - [Implementation](#implementation-1)
    - [Security model](#security-model)
    - [Open questions](#open-questions-2)
  - [Track P19-D — Pre-Commit Toolchain \& Conventional Commits](#track-p19-d--pre-commit-toolchain--conventional-commits)
    - [Sub-tasks](#sub-tasks)
      - [D-1 — husky + lint-staged (pre-commit hook)](#d-1--husky--lint-staged-pre-commit-hook)
      - [D-2 — commitlint (commit message validation)](#d-2--commitlint-commit-message-validation)
      - [D-3 — pre-push test gate](#d-3--pre-push-test-gate)
      - [D-4 — Update CONTRIBUTING.md (or create if absent)](#d-4--update-contributingmd-or-create-if-absent)
    - [New dev dependencies](#new-dev-dependencies)
    - [Open questions](#open-questions-3)
  - [Track P19-E — SettingsPanel Full Coverage](#track-p19-e--settingspanel-full-coverage)
    - [If proceeding — planned test scope](#if-proceeding--planned-test-scope)
    - [If NOT proceeding](#if-not-proceeding)
  - [Execution Priority](#execution-priority)
  - [Testing Strategy](#testing-strategy)
  - [Risk Register](#risk-register)
  - [Modified File Inventory (projected)](#modified-file-inventory-projected)
    - [New files](#new-files)
    - [Modified files](#modified-files)

---

## Rationale

Phase 18 completed 10 tracks spanning access requests, analytics, campaign categories, media usage tracking, bulk operations, and a major code-size reduction. That sprint added approximately 12 new components and 8 new hooks — all without dedicated unit tests. Phase 19 addresses the resulting gaps:

**1 — Coverage has degraded.** Phase 18 unambiguously added uncovered code. The threshold configuration in `vite.config.ts` has not been revised since P18-QA established the 60/70 % floor. A targeted coverage sprint is needed to bring the new components to baseline and prevent threshold drift becoming structural.

**2 — The builder lacks keyboard power-user features.** P18-E added admin-panel shortcuts. The builder — a design tool — still has no keyboard shortcuts beyond what Mantine provides by default. `Ctrl+Z` is the single most expected shortcut for any canvas editor. Shipping P19-A unblocks non-mouse workflows for all layout template editing.

**3 — The undo/redo stack needs hardening.** P15-C implemented a basic undo/redo stack in `useLayoutBuilderState`. It currently tracks some operations but not all (graphic layer mutations, overlay CRUD, lock/visibility toggles added in P16 are partial). P19-B audits and completes the tracked operation set, then adds a visual history panel.

**4 — Operators need a scripting surface.** Gallery managers who run WordPress programmatically have no `wp wpsg` commands. WP-CLI integration is the standard expectation for production-grade WP plugins and would unblock scheduled/scripted maintenance workflows (orphan cleanup, bulk export, cache clear).

**5 — The commit/lint pipeline is fragile.** There is currently no enforcement layer between a developer typing `git commit` and bad code landing on the branch. Pre-commit hooks (ESLint + `tsc --noEmit` on staged files) and conventional commit linting are the standard guard rails that prevent regressions.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | P19-E execution decision | **Deferred — see prominent note in P19-E section before starting.** SettingsPanel testing has historically been problematic; this track requires an explicit go/no-go decision before implementation begins. |
| B | Builder shortcut scope in P19-A | Builder-specific shortcuts only (`Ctrl+Z`, `Ctrl+S`, arrows, `H`, `V`, `0`, `+/-`). Admin-panel shortcuts (P18-E) are not changed. |
| C | Undo/redo history panel style | Compact list drawer in the builder left panel, not a full undo tree. Each entry shows a short action description. Max 50 entries, oldest dropped when exceeded. |
| D | WP-CLI scope | Read + lifecycle operations only (`list`, `archive`, `duplicate`, `export`, `import`, `orphans`, `cache clear`). No destructive `delete` in P19 — add after further security review. |
| E | Pre-commit tooling blocking policy | Block on lint + type errors only; test failures gate on pre-push, not pre-commit (30–60 s test run is too slow for commit). |
| F | Coverage threshold targets for P19-QA | Raise functions threshold from 60 % → 65 % after recovering coverage for Phase 18 additions. All other thresholds unchanged. |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | Builder shortcuts via `useHotkeys` scoped to builder modal mount | Same library as P18-E (`@mantine/hooks`). Activate on modal `onOpened`; deactivate on `onClose`. Prevents conflicts with admin-panel shortcuts that are active simultaneously. |
| AD-2 | Undo/redo history stored in `useLayoutBuilderState` reducer, not a separate context | State already lives there; exposing `history: HistoryEntry[]` and `historyIndex: number` from the same hook keeps consumers simple. Adding a separate context would introduce over-coupling. |
| AD-3 | WP-CLI commands registered via `WP_CLI::add_command` in a loader class, not inline in main plugin file | A `WPSG_CLI` class in `includes/class-wpsg-cli.php`, loaded conditionally on `defined('WP_CLI') && WP_CLI`. Keeps non-CLI paths zero-overhead. |
| AD-4 | `husky` + `lint-staged` for pre-commit; `commitlint` with `@commitlint/config-conventional` for commit message validation | Industry standard, minimal config, works with the existing `package.json` scripts. |
| AD-5 | P19-E SettingsPanel tests — if green-lit, use Mantine's `MantineProvider` test wrapper with overridden `defaultProps` to suppress accordion animation, which was the root cause of previous flakiness | Animation timing was the primary failure mode in prior attempts; suppressing it at the provider level is the simplest fix short of mocking. |

---

## Track P19-QA — Coverage Recovery Sprint

**Status:** Not started  
**Priority:** 🔴 High — do first, establishes baseline for all other tracks

Phase 18 added the following components/hooks with zero or near-zero test coverage:

### Components to cover

| Component | File | Key scenarios to test |
|-----------|------|----------------------|
| `AccessRequestForm` | `src/components/Admin/Access/AccessRequestForm.tsx` | Renders; email input; submit calls API; shows success/error state |
| `PendingRequestsPanel` | `src/components/Admin/Access/PendingRequestsPanel.tsx` | Renders requests list; approve button calls API; deny button calls API; empty-state message |
| `QuickAddUserModal` | `src/components/Admin/QuickAddUserModal.tsx` | Opens/closes; email + name + role inputs; campaign select; submit triggers handler; test-mode toggle |
| `AnalyticsDashboard` | `src/components/Admin/AnalyticsDashboard.tsx` | Renders with mocked data; date range change calls API; disabled state shows notice when analytics off |
| `MediaUsageBadge` | `src/components/Admin/MediaUsageBadge.tsx` | Renders count; orphan (0) styled differently; click opens popover with campaign names |
| `CampaignDuplicateModal` | `src/components/Admin/CampaignDuplicateModal.tsx` | Renders with source; name pre-filled; copy-media toggle; confirm calls handler; cancel closes |
| `CampaignImportModal` | `src/components/Admin/CampaignImportModal.tsx` | File picker renders; invalid JSON shows error; valid payload calls handler |
| `KeyboardShortcutsModal` | `src/components/Admin/KeyboardShortcutsModal.tsx` | Renders shortcut table; closes on button |
| `BulkActionsBar` | `src/components/Admin/BulkActionsBar.tsx` | Archive button calls handler; restore button calls handler; count shown; clear calls handler |

### Hooks to cover

| Hook | File | Key scenarios |
|------|------|--------------|
| `useEditCampaignModal` | `src/hooks/useEditCampaignModal.ts` | Open/close cycle; form state mutation; save dispatch; media management handlers |
| `useArchiveModal` | `src/hooks/useArchiveModal.ts` | Open with campaign; confirm triggers callback; cancel closes |
| `useAdminCampaignActions` | `src/hooks/useAdminCampaignActions.ts` | `handleCreate`; `saveCampaign` success/error paths; `archiveCampaign`; bulk archive/restore |
| `useAdminAccessState` | `src/hooks/useAdminAccessState.ts` | `handleGrantAccess`; `handleRevokeAccess`; `handleQuickAddUser`; user search debounce |

### Coverage target

After P19-QA, raise the functions threshold in `vite.config.ts` from 60 % → 65 %.

### Expected effort

~2–3 days. Most tests follow the established pattern from AdminPanel.test.tsx and AccessTab.test.tsx.

---

## Track P19-A — Builder Keyboard Shortcuts

**Status:** Not started  
**Promoted from:** `FUTURE_TASKS.md`

The Layout Builder is a design tool. Every professional canvas editor ships `Ctrl+Z`. P18-E covered admin-panel shortcuts; P19-A covers builder-specific shortcuts using the same `useHotkeys` primitive.

### Shortcut map

| Shortcut | Action | Notes |
|----------|--------|-------|
| `Ctrl/⌘+Z` | Undo last builder operation | Calls `undo()` from `useLayoutBuilderState` |
| `Ctrl/⌘+Shift+Z` | Redo | Calls `redo()` from `useLayoutBuilderState` |
| `Ctrl/⌘+S` | Save template | Calls existing `handleSaveTemplate()`; calls `e.preventDefault()` |
| `Escape` | Deselect active slot/layer | Clears selection; if no selection, no-op |
| `Arrow keys` | Nudge selected slot/layer 1 px | Dispatches `MOVE_SLOT` / `MOVE_GRAPHIC` action |
| `Shift+Arrow` | Nudge selected slot/layer 10 px | Same dispatch with 10× step |
| `Delete` / `Backspace` | Remove selected slot/layer | Opens existing confirmation if slot has media |
| `[` | Send backward (z-order) | Calls `sendBackward()` — already in P15-G |
| `]` | Bring forward (z-order) | Calls `bringForward()` — already in P15-G |
| `H` | Toggle hand/pan tool | Already implemented in P18-A; shortcut not yet wired |
| `V` | Return to select tool | Turns off hand tool |
| `0` | Reset canvas zoom to 100 % | Calls `resetTransform()` from `react-zoom-pan-pinch` ref |
| `+` / `=` | Zoom in | Calls `zoomIn()` |
| `-` | Zoom out | Calls `zoomOut()` |
| `?` | Open builder shortcuts help | Opens a `KeyboardShortcutsModal` variant for the builder |

### Implementation

```typescript
// In LayoutBuilderModal.tsx, scoped to modal mount:
useHotkeys([
  ['mod+z',         () => dispatch({ type: 'UNDO' })],
  ['mod+shift+z',   () => dispatch({ type: 'REDO' })],
  ['mod+s',         (e) => { e.preventDefault(); handleSaveTemplate(); }],
  ['ArrowLeft',     () => nudgeSelected(-1, 0)],
  ['ArrowRight',    () => nudgeSelected(1, 0)],
  // …
], { tagsToIgnore: ['INPUT', 'TEXTAREA', 'SELECT'] });
```

**Scope control:** Shortcuts activate on builder modal open (`onOpened`) and deactivate on close (`onClose`) via a `useEffect` that toggles a `hotkeysEnabled` flag checked by each handler. This prevents conflicts with admin-panel shortcuts that remain mounted.

### Open questions

- Q1: Should shortcut help (`?`) open the P18-E admin shortcuts modal or a separate builder-specific one? (Proposed: separate builder modal — different shortcut sets, different context.)
- Q2: Arrow nudge should be disabled when focus is in a text input inside the builder (slot label, search bar). Does Mantine's `tagsToIgnore` cover custom `contenteditable` fields? (Needs testing.)

---

## Track P19-B — Builder Undo/Redo Improvements

**Status:** Not started

P15-C shipped a basic undo/redo stack in `useLayoutBuilderState`. Post-P16/P17 audits reveal that several operation categories are not fully tracked:

| Operation | Tracked? | Gap |
|-----------|----------|-----|
| Slot drag / resize | ✅ | — |
| Slot create / delete | ✅ | — |
| Slot property change (shape, border, focal) | ✅ | — |
| Graphic layer create / delete | ⚠️ Partial | Delete not tracked |
| Graphic layer property change (P17-D) | ❌ | Not tracked |
| Slot lock / visibility toggle (P16) | ❌ | Not tracked |
| Slot z-index change (P15-G) | ⚠️ Partial | `bringForward/sendBackward` not tracked |
| Layout template name edit | ❌ | Not tracked |

### Goals for P19-B

1. **Audit and fill gaps** — add `UNDO` / `REDO` dispatch points for the missing operations listed above.
2. **History panel** — a compact list in the left panel drawer showing the last N actions, with the current position highlighted. Clicking an entry jumps to that state.
3. **Max history size** — cap at 50 entries; drop oldest on overflow. Document in state comments.
4. **Keyboard integration** — P19-A wires `Ctrl+Z` / `Ctrl+Shift+Z`; P19-B ensures the underlying stack is complete enough that those keys work for all tracked operations.

### Data model

```typescript
interface HistoryEntry {
  id: string;         // unique per-entry for React key
  label: string;      // human-readable: "Move slot", "Add layer", "Change border"
  timestamp: number;  // Date.now() — used for display only
}
```

The full state snapshot (current approach) is kept. `label` is added as a parallel array alongside the existing history stack in `useLayoutBuilderState`.

### Open questions

- Q1: Should the history panel be accessible from a dedicated "History" button in the builder toolbar, or as a tab in the left panel? (Proposed: tab in the left panel alongside Slots and Assets — consistent with the existing tabbed structure.)
- Q2: Should undo/redo persist across builder sessions (localStorage)? (Proposed: no — history is in-memory only; cleared on modal close or save.)

---

## Track P19-C — WP-CLI Command Surface

**Status:** Not started  
**Promoted from:** `FUTURE_TASKS.md`

Site operators managing WordPress programmatically (CI/CD pipelines, SSH-based workflows) have no `wp wpsg` commands. This track adds a first-party WP-CLI integration covering the most automation-relevant operations.

### Command surface

```
wp wpsg campaign list [--status=<status>] [--format=<format>]
wp wpsg campaign archive <id>
wp wpsg campaign restore <id>
wp wpsg campaign duplicate <id> [--name=<name>] [--copy-media]
wp wpsg campaign export <id>        # JSON to stdout
wp wpsg campaign import <file>      # import from JSON file

wp wpsg media list <campaign-id>    # media items for a campaign
wp wpsg media orphans               # items with zero campaign associations

wp wpsg cache clear                 # clear all wpsg_* transients
wp wpsg analytics clear <campaign-id>  # delete analytics events for a campaign
wp wpsg rate-limit reset <ip>       # reset rate-limit counters for an IP
```

### Implementation

New class `WPSG_CLI` in `wp-plugin/wp-super-gallery/includes/class-wpsg-cli.php`, registered in `wp-super-gallery.php`:

```php
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    require_once WPSG_PLUGIN_DIR . 'includes/class-wpsg-cli.php';
    WP_CLI::add_command( 'wpsg', 'WPSG_CLI' );
}
```

Each command method uses the same service logic as the REST endpoints (calls `WPSG_REST` instance methods directly or re-uses `WPSG_DB` helpers), avoiding duplication. `WP_CLI::success()`, `WP_CLI::error()`, and `WP_CLI::line()` for output.

### Security model

All commands run as the CLI process owner (typically `www-data` or a deploy user). The `manage_wpsg` capability check is skipped for CLI context — document this decision in the class docblock.

### Open questions

- Q1: Should `wp wpsg campaign delete` be included? (Proposed: no for P19 — the REST endpoint enforces confirmation; CLI delete without confirmation is too destructive. Add in a follow-up with a `--yes` flag.)
- Q2: Should commands be bundled into the plugin or a companion plugin? (Proposed: bundled — the class is gated behind `defined('WP_CLI')` so non-CLI paths carry zero overhead.)

---

## Track P19-D — Pre-Commit Toolchain & Conventional Commits

**Status:** Not started  
**Promoted from:** `FUTURE_TASKS.md` (Contributor Tooling sub-tasks)

No enforcement layer currently exists between authoring and committing. ESLint errors, TypeScript errors, and non-conventional commit messages all slip through silently.

### Sub-tasks

#### D-1 — husky + lint-staged (pre-commit hook)

```json
// .lintstagedrc.json (new file)
{
  "*.{ts,tsx}": ["eslint --fix --max-warnings 0", "tsc --noEmit --skipLibCheck"],
  "*.{js,cjs,mjs}": ["eslint --fix --max-warnings 0"]
}
```

**Blocking policy:** Block on ESLint errors and type errors. Test failures gate on pre-push (not pre-commit) to avoid the 30–60 s test run on every commit.

#### D-2 — commitlint (commit message validation)

```js
// commitlint.config.cjs (new file)
module.exports = { extends: ['@commitlint/config-conventional'] };
```

Enforces: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`, `perf:`, `build:` prefix. Scope optional but encouraged: `feat(P19-A): ...`.

#### D-3 — pre-push test gate

```json
// In .husky/pre-push (new file)
#!/bin/sh
npm run test -- --run
```

Blocks push if any test fails.

#### D-4 — Update CONTRIBUTING.md (or create if absent)

Document the hook setup steps for contributors: `npm install` (hooks auto-activate via `prepare` script), commit message convention, how to bypass (`--no-verify`) for emergency hotfixes.

### New dev dependencies

```
husky ^9.x
lint-staged ^15.x
@commitlint/cli ^19.x
@commitlint/config-conventional ^19.x
```

### Open questions

- Q1: Should `tsc --noEmit` in lint-staged be project-wide or file-scoped? File-scoped `tsc` is unsupported — the check must run project-wide, adding ~5–10 s to every staged-file commit. Acceptable? (Proposed: yes — P19 establishes this baseline; if too slow in practice, cache via `ts-jest` incremental mode.)
- Q2: Should existing non-conventional commits in the history cause any issues? (`commitlint` only validates new commits, not history — no migration needed.)

---

## Track P19-E — SettingsPanel Full Coverage

> ⚠️ **DECISION REQUIRED BEFORE STARTING THIS TRACK**
>
> `SettingsPanel.tsx` was intentionally **excluded from the coverage denominator** during P18-QA because it contains ~182 uncovered functions and previous test attempts produced flaky, hard-to-maintain tests. Before implementing this track, explicitly decide:
>
> 1. **Are the previous failures resolved?** The primary failure mode was accordion animation timing in JSDOM. If `MantineProvider` test config with `defaultProps: { Accordion: { transitionDuration: 0 } }` has been confirmed to fix the flakiness, proceed.
> 2. **Is the coverage gain worth the maintenance cost?** SettingsPanel is a very large, complex component (~20+ accordion sections, ~70+ settings) with high change frequency. Tests that tightly couple to its structure become a drag on future changes.
> 3. **Scope limit:** If the decision is "yes, proceed," limit to smoke tests for each top-level tab + a subset of critical setting fields (not exhaustive per-field coverage). Full per-field coverage would produce hundreds of fragile tests for marginal safety gain.
>
> **Recommendation:** Proceed only if animation-timing fix is verified. Use parameterised smoke tests per accordion section rather than per-field tests.

**Blocked on:** Decision to proceed + animation-timing root cause fix verified.

### If proceeding — planned test scope

| Test area | Coverage expected |
|-----------|------------------|
| General tab renders | ≥90 % statements in General section |
| Advanced tab hidden by default; visible when toggle on | Branch coverage for `advancedSettingsEnabled` |
| `handleSave()` called with correct payload on submit | Function hit |
| Each Accordion section renders without crashing (smoke) | Functions x8 = significant gain |
| Error toast shown on save failure | Branch coverage |

### If NOT proceeding

Keep `SettingsPanel.tsx` in the coverage exclude list. Document the decision explicitly in `vite.config.ts` with a comment referencing this section of the Phase 19 report.

---

## Execution Priority

| Sprint | Track | Prerequisite | Risk | Status |
|--------|-------|-------------|------|--------|
| 1 | **P19-QA** — Coverage recovery sprint | None | Low | ✅ Complete (`9963400`) |
| 2 | **P19-D** — Pre-commit toolchain | None | Low | ✅ Complete (`e604ff6`) |
| 3 | **P19-A** — Builder keyboard shortcuts | None | Medium (scope conflicts) | ✅ Complete (`5685249`) |
| 3 | **P19-B** — Builder undo/redo improvements | P19-A (Ctrl+Z wiring) | Medium | ✅ Complete (`12e0155`) |
| 4 | **P19-C** — WP-CLI command surface | None | Low | ✅ Complete (`P19-C`) |
| 5 | **P19-E** — SettingsPanel coverage | **⚠️ Explicit go/no-go decision first** | High | ⛔ Blocked |

Tracks in the same sprint row can be parallelised. Run `npx vitest run`, `npx tsc --noEmit`, and `npm run build:wp` after every sprint.

---

## Testing Strategy

| Track | New test files | Key scenarios |
|-------|----------------|---------------|
| P19-QA | `AccessRequestForm.test.tsx`, `PendingRequestsPanel.test.tsx`, `QuickAddUserModal.test.tsx`, `AnalyticsDashboard.test.tsx`, `MediaUsageBadge.test.tsx`, `CampaignDuplicateModal.test.tsx`, `CampaignImportModal.test.tsx`, `KeyboardShortcutsModal.test.tsx`, `BulkActionsBar.test.tsx` | Per-component smoke + interaction + loading/error states |
| P19-QA hooks | Extend `useAdminCampaignActions.test.ts`, `useAdminAccessState.test.ts` (new) | Handler dispatch, API call, error path |
| P19-A | `BuilderKeyboardShortcuts.test.tsx` | `Ctrl+Z` calls undo; `Ctrl+S` calls save + preventDefault; arrow nudge dispatches; `H` toggles hand tool |
| P19-B | Extend `LayoutBuilderState.test.ts` | All operation types tracked; history array updates; history panel renders entries; click jumps to state |
| P19-C | `WPSG_CLI_Test.php` | campaign list, archive, export; orphan media detection; cache clear; CLI-only flag |
| P19-D | CI smoke only | Lint-staged runs on changed `.ts` files; commitlint rejects non-conventional message |
| P19-E | `SettingsPanel.test.tsx` (extend) | **Proceed only if go/no-go passed** — accordion smoke per section |

---

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| P19-A shortcut conflicts with admin-panel shortcuts (P18-E) — both `useHotkeys` scopes mounted simultaneously | Medium | Medium | Scope builder shortcuts to a `hotkeysEnabled` flag toggled on builder modal open/close; test in integration |
| P19-A `Ctrl+S` conflicts with browser save-page shortcut | Medium | Medium | Call `e.preventDefault()` in handler; test across Chrome/Firefox/Safari |
| P19-B history panel UI complexity delays track | Low | Medium | Hard cap: max 3 days on P19-B; if overrunning, ship without the history panel (just the operation-coverage audit) |
| P19-E SettingsPanel tests re-introduce flakiness | High | High | See the ⚠️ note in P19-E — decision gate prevents this if properly enforced |
| P19-D `tsc --noEmit` in lint-staged too slow | Low | Medium | Add a `// husky: skip tsc` escape hatch for WIP commits; document in CONTRIBUTING |
| P19-QA coverage threshold raise (60→65 % functions) fails | Low | Low | Raise threshold only after coverage numbers are confirmed; revert if unable to meet in one sprint |
| WP-CLI (P19-C) capability check skipped without documentation | Medium | Low | Class docblock explicitly notes the skip; include in security review checklist |

---

## Modified File Inventory (projected)

### New files

| File | Track |
|------|-------|
| `src/components/Admin/Access/AccessRequestForm.test.tsx` | P19-QA |
| `src/components/Admin/Access/PendingRequestsPanel.test.tsx` | P19-QA |
| `src/components/Admin/QuickAddUserModal.test.tsx` | P19-QA |
| `src/components/Admin/AnalyticsDashboard.test.tsx` | P19-QA |
| `src/components/Admin/MediaUsageBadge.test.tsx` | P19-QA |
| `src/components/Admin/CampaignDuplicateModal.test.tsx` | P19-QA |
| `src/components/Admin/CampaignImportModal.test.tsx` | P19-QA |
| `src/components/Admin/KeyboardShortcutsModal.test.tsx` | P19-QA |
| `src/components/Admin/BulkActionsBar.test.tsx` | P19-QA |
| `src/hooks/useAdminCampaignActions.test.ts` | P19-QA |
| `src/hooks/useAdminAccessState.test.ts` | P19-QA |
| `src/components/Admin/LayoutBuilder/BuilderKeyboardShortcuts.test.tsx` | P19-A |
| `wp-plugin/.../tests/WPSG_CLI_Test.php` | P19-C |
| `wp-plugin/.../includes/class-wpsg-cli.php` | P19-C |
| `.husky/pre-commit` | P19-D |
| `.husky/pre-push` | P19-D |
| `.lintstagedrc.json` | P19-D |
| `commitlint.config.cjs` | P19-D |
| `CONTRIBUTING.md` | P19-D |

### Modified files

| File | Track | Change summary |
|------|-------|---------------|
| `src/components/Admin/LayoutBuilder/LayoutBuilderModal.tsx` | P19-A | Wire `useHotkeys` for all builder shortcuts |
| `src/hooks/useLayoutBuilderState.ts` | P19-A, P19-B | Add `HistoryEntry.label`; fill missing dispatch points; expose `historyStack` for panel |
| `src/components/Admin/LayoutBuilder/LayerPanel.tsx` | P19-B | Add History tab/section showing `historyStack` |
| `wp-plugin/.../wp-super-gallery.php` | P19-C | Register `WPSG_CLI` class under `WP_CLI` guard |
| `vite.config.ts` | P19-QA | Raise functions threshold 60 → 65 % (after coverage confirmed) |
| `package.json` | P19-D | Add `husky`, `lint-staged`, `@commitlint/*` dev deps; add `prepare` + `lint-staged` scripts |

---

*Plan written: March 1, 2026. Pending Phase 18 PR review completion before execution begins.*
