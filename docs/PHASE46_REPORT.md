# Phase 46 - Header-Anchored Actions + Library Decoupling

**Status:** Complete
**Created:** 2026-06-07
**Last updated:** 2026-06-07

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P46-A | UnifiedCampaignModal — Save/Cancel to header | Done | Small |
| P46-B | SettingsPanel — Save/Cancel to header | Done | Small |
| P46-C | GalleryConfigEditorModal — header actions + reset consolidation | Done | Medium |
| P46-D | Auth components — finish WPSG decoupling | Done | Small |
| P46-E | Lightbox — finish WPSG decoupling + migrate generic utils to `src/lib/` | Done | Small |

---

## Rationale

1. Save/Cancel buttons are buried inside tab panels or at the bottom of long drawers, forcing users to scroll or switch tabs to act on their changes.
2. In `UnifiedCampaignModal`, the buttons are duplicated per tab panel — each tab re-renders its own Save/Cancel group — and the Media tab has no buttons at all.
3. Moving Save/Cancel to the modal or drawer header creates a consistent, always-visible action bar across the app's panels and modals.

## Key Decisions

| # | Decision | Resolution |
|---|----------|------------|
| A | Where to place Reset in SettingsPanel | Move Reset to the header alongside Save/Cancel; remove `SettingsPanelFooter` entirely. |
| B | Gallery Config has too many reset buttons for the header | Consolidate all reset variants into a single `Reset ▾` Mantine Menu in the header; move "Preview Inherited" to the intro section. |
| C | Cancel vs. X close button in modals | Add an explicit Cancel button in the header alongside Save; keep the native X button — both call `onClose`. |

## Execution Priority

1. P46-A — Isolated modal, no shared components, low risk. Quick win to establish the header-button pattern.
2. P46-B — Drawer pattern. Removes `SettingsPanelFooter` component.
3. P46-C — Most complex. Involves Menu consolidation, section restructure, and removing `GalleryConfigEditorFooterActions`.

---

## Track P46-A — UnifiedCampaignModal Header Actions

### Problem

`UnifiedCampaignDetailsPanel` and `UnifiedCampaignSettingsPanel` each contain a duplicate `<Group justify="flex-end">` with Cancel and Save buttons. The Media tab has no buttons at all. Users must be on the Details or Settings tab to save.

### Fix

- Change the Mantine `<Modal>` `title` prop to a ReactNode: a `<Group w="100%" justify="space-between">` with the modal title on the left and `[Cancel] [Save Changes / Create Campaign]` on the right.
- Remove the duplicated button `<Group>` from both `UnifiedCampaignDetailsPanel` (~lines 228–233) and `UnifiedCampaignSettingsPanel` (~lines 499–504).
- Save label stays dynamic: `isEdit ? 'Save Changes' : 'Create Campaign'`.
- `isSaving` drives the loading/disabled state on the header Save button.
- Keep the native X close button (`withCloseButton` unchanged) — it calls `onClose` the same as Cancel.

**File:** `src/components/Campaign/UnifiedCampaignModal.tsx`

### Acceptance criteria

- Save and Cancel are visible in the modal header regardless of the active tab.
- Media tab now has access to header-level Save/Cancel.
- No duplicate button groups remain inside the tab panels.
- Dirty-guard prompt still fires when closing with unsaved changes (verify `useDirtyGuard` still triggers via `onClose`).

### Implementation

- Modal `title` prop changed to a `<Group w="100%" justify="space-between">` ReactNode with the
  campaign name on the left and `[Cancel] [Save Changes / Create Campaign]` on the right.
- `onClose`, `onSave`, `isSaving` removed from `UnifiedCampaignDetailsPanelProps` and
  `UnifiedCampaignSettingsPanelProps` — panels no longer own the save/cancel interaction.
- Duplicate `<Group justify="flex-end">` button groups removed from both tab panels.
- Also removed all remaining `wpsgDebug` prop spreads and `setWpsgDebugDisplayName` calls
  from the file (replaced with `Component.displayName`).
- `AdminPanel.test.tsx` heading query updated from exact string to `/New Campaign/` regex
  (heading accessible name now includes button text from the title ReactNode).

### Validation

- Open Edit Campaign modal; switch through all three tabs — confirm buttons visible on each.
- Make a change, click Cancel — confirm dirty-guard prompt appears.
- Create Campaign flow: confirm label reads "Create Campaign" not "Save Changes".
- Run `npm test` targeting UnifiedCampaignModal.

---

## Track P46-B — SettingsPanel Header Actions

### Problem

`SettingsPanelFooter` is a sticky bottom bar (with Reset + Save) positioned outside the scroll area. There is no explicit Cancel button — closing is via the Drawer X only. With 8–9 tabs, users must scroll past all content to find Save.

### Fix

- Change the Drawer `title` prop to a ReactNode: `[Settings] ··· [Cancel] [Reset (conditional)] [Save Changes]`.
  - Cancel calls `onClose` explicitly (clearer than relying on X alone).
  - Reset remains conditional on `hasChanges`.
  - Save disabled when `!hasChanges || isSaving`.
- Remove `SettingsPanelFooter` component and its call site.
- Simplify Drawer body layout: remove the `flex: 1, overflowY: auto` wrapper that existed to push the footer down.

**File:** `src/components/Admin/SettingsPanel.tsx`

### Acceptance criteria

- Save, Cancel, and (conditional) Reset visible in the Drawer header from any of the 8–9 tabs.
- `SettingsPanelFooter` component is deleted.
- `hasChanges` and `isSaving` correctly gate Save and show/hide Reset.
- `closeOnClickOutside={!hasChanges}` behavior unchanged.

### Implementation

- Drawer `title` prop replaced with a full ReactNode: Settings icon + "Display Settings" title on
  the left, `[Cancel] [Reset (conditional)] [Save Changes]` on the right.
- `handleClose` helper created to call both `revertThemePreview()` and `onClose()` — Cancel and
  the Drawer X both use it.
- `SettingsPanelTitle` component deleted; its content inlined into the title ReactNode.
- `SettingsPanelFooter` component and its call site deleted.
- Scroll body `<Box>` retained (still needed for `useScrollRestore` tab position restoration).
- Also removed `wpsgDebug` imports and replaced `setWpsgDebugDisplayName` calls.

### Validation

- Open Settings Panel; switch all tabs — confirm header buttons visible throughout.
- Make a change: Save enables, Reset appears; discard change: Save disables, Reset hides.
- Click outside drawer with unsaved changes — confirm panel does not close.
- Run `npm test` targeting SettingsPanel.

---

## Track P46-C — GalleryConfigEditorModal Header Actions + Reset Consolidation

### Problem

The sticky footer of `GalleryConfigEditorModal` currently contains up to 8 controls: Reset Image, Reset Video, Reset Unified (mode-dependent), Reset {activeBreakpoint}, Reset All Changes, Preview Inherited Gallery Settings / Clear Overrides, Cancel, and Save. Moving all of these to the header would bloat and break the header UX.

### Fix

**Header** (Drawer `title` prop as ReactNode):

`[Campaign Gallery Config] ··· [Reset ▾] [Cancel] [Save Campaign Gallery Config]`

- `Reset ▾` is a Mantine `<Menu>` dropdown with items:
  - Reset {activeBreakpoint} (e.g., "Reset Desktop") — always visible
  - Reset Image — per-type mode only
  - Reset Video — per-type mode only
  - Reset Unified — unified mode only
  - Divider
  - Reset All Changes — always visible, red label (destructive)

**Intro section** (`GalleryConfigEditorIntro`):

- "Preview Inherited Gallery Settings / Clear Overrides" button moves here as a contextual action.
- Semantically belongs near the gallery mode selector (it compares against inherited defaults), not in a save/cancel action bar.
- Retains red/destructive color.

**Footer removal:**

- `GalleryConfigEditorFooterActions` component removed.
- Sticky footer `<Box>` removed from the Drawer layout.

**Files:** `src/components/Common/GalleryConfigEditorModal.tsx`, `src/components/CardViewer/CampaignViewer.tsx`

### Acceptance criteria

- Cancel and Save in header, accessible from any scroll position.
- Reset dropdown shows correct mode-dependent items (per-type vs. unified).
- Reset {activeBreakpoint} updates label correctly when switching breakpoint tabs.
- "Preview Inherited" / "Clear Overrides" button in intro section has equivalent behavior to the former footer button.
- No sticky footer remains.
- CampaignViewer integration unchanged (external props/handlers not modified).

### Implementation

- Drawer `title` changed to ReactNode: truncating title text on the left, `[Reset ▾] [Cancel] [Save]`
  on the right.
- `Reset ▾` is a Mantine `<Menu>` with: Reset {Breakpoint} (active breakpoint, always), then scope
  reset items (mode-dependent via `getEditableScopes`), a divider, and "Reset All Changes" (red).
- Clear/preview button ("Preview Inherited Gallery Settings", "Clear Campaign Overrides", etc.) moved
  into `GalleryConfigEditorIntro` as a red subtle Button below the Gallery Mode selector.
  `GalleryConfigEditorIntroProps` extended with optional `clearMode`, `clearLabel`, `onClear`,
  `onClearDraft` props; button renders only when `(clearMode === 'draft' || onClear) && clearLabel`.
- `GalleryConfigEditorFooterActions` component deleted; its call site in the Stack removed.
- `wpsgDebug` imports removed; `setWpsgDebugDisplayName` calls replaced with `.displayName`.
- `GalleryConfigEditorModal.test.tsx`: two tests updated to open the Reset menu
  (`getByRole('button', { name: /^Reset$/ })`) before querying menu items
  (`findByRole('menuitem', { name: '...' })`).

### Validation

- Open Gallery Config panel from CampaignViewer; scroll to bottom — confirm no footer.
- Switch unified ↔ per-type mode; open Reset menu — confirm correct items visible.
- Switch Desktop / Tablet / Mobile tabs; open Reset menu — confirm breakpoint label updates.
- Click "Preview Inherited" in intro — confirm live preview reverts to inherited settings.
- Save a config; close; reopen — confirm saved state loaded correctly.
- Run `npm test` targeting CampaignViewer and GalleryConfigEditorModal.

---

## Track P46-D — Auth Components: Finish WPSG Decoupling

### Problem

Phase 45 (P45-A7) removed `useCampaignContext` from `AuthBarFloating` and replaced WPSG CSS
variables with Mantine tokens. However, three files still imported from WPSG-specific modules:
- All three Auth files: `getWpsgDebugProps` / `setWpsgDebugDisplayName` from `@/utils/wpsgDebug`
  (references `window.__WPSG_CONFIG__`, emits `data-wpsg-*` HTML attributes)
- `AuthBarFloating.tsx`: `Campaign` type from `@/types` (WPSG domain type, only `title` was read)
- `AuthBarFloating.tsx`: `safeLocalStorage` from `@/utils/safeLocalStorage` (generic utility,
  not yet in `src/lib/`)

### Fix

- All three Auth files: removed `wpsgDebug` import; replaced `setWpsgDebugDisplayName(Foo, 'Foo')`
  with idiomatic `Foo.displayName = 'Foo'`; removed `{...getWpsgDebugProps(...)}` JSX spreads.
- `AuthBarFloating.tsx`: replaced `Campaign` import with a locally defined generic interface
  `AuthBarCampaignItem { title: string }`. Made `AuthBarFloatingProps` and
  `AuthBarFloatingMenuContentProps` generic over `TCampaign extends AuthBarCampaignItem` so
  `AuthBar.tsx` (the WPSG-coupled orchestrator) can still pass full `Campaign` objects and
  `(campaign: Campaign) => void` callbacks without type errors (TypeScript infers
  `TCampaign = Campaign` at the call site).
- Moved `src/utils/safeLocalStorage.ts` → `src/lib/safeLocalStorage.ts` alongside
  `sanitizeCss.ts` and `cssUnits.ts`. Updated 6 import sites:
  `AuthBarFloating.tsx`, `WpJwtProvider.ts`, `LayoutBuilderCanvasPanel.tsx`,
  `useMediaViewPrefs.ts`, `useBuilderWorkspacePrefs.ts`, `useBuilderCampaignMedia.ts`.
  Moved `src/utils/safeLocalStorage.test.ts` → `src/lib/safeLocalStorage.test.ts`.

### Acceptance criteria

- `LoginForm.tsx`, `AuthBarFloating.tsx`, `AuthBarMinimal.tsx` import nothing from
  `@/utils/wpsgDebug`, `@/types`, or `@/utils/safeLocalStorage`
- All existing Auth component tests pass
- `npm run build:wp` TypeScript clean

---

## Track P46-E — Lightbox: Finish WPSG Decoupling + Generic Utils to `src/lib/`

### Problem

Phase 45 (P45-A13) removed `MediaItem` and WPSG CSS variable usage from `Lightbox.tsx`.
Remaining WPSG-internal imports:
- Both files: `setWpsgDebugDisplayName` from `@/utils/wpsgDebug`
- `Lightbox.tsx`: `useSwipe` from `@/hooks/useSwipe` and `scrollLock` utils from
  `@/utils/scrollLock` — both purely generic, no WPSG deps, not yet in `src/lib/`
- `KeyboardHintOverlay.tsx`: `SESSION_KEY = 'wpsg-lightbox-hint-shown'` (WPSG-prefixed key)

### Fix

- Both files: removed `wpsgDebug` import; replaced `setWpsgDebugDisplayName(Foo, 'Foo')` with
  `Foo.displayName = 'Foo'`.
- Moved `src/hooks/useSwipe.ts` → `src/lib/useSwipe.ts`; moved `src/hooks/useSwipe.test.ts`
  → `src/lib/useSwipe.test.ts`. Updated 1 import site (`Lightbox.tsx`).
- Moved `src/utils/scrollLock.ts` → `src/lib/scrollLock.ts`. Updated 2 import sites
  (`Lightbox.tsx`, `useLightbox.ts`).
- `KeyboardHintOverlay.tsx`: renamed `SESSION_KEY` from `'wpsg-lightbox-hint-shown'` →
  `'lightbox-hint-shown'`.

### Acceptance criteria

- `Lightbox.tsx` and `KeyboardHintOverlay.tsx` import nothing from `@/utils/wpsgDebug`,
  `@/hooks/useSwipe`, or `@/utils/scrollLock`
- `SESSION_KEY` no longer contains `wpsg-` prefix
- All existing Lightbox tests pass
- `npm run build:wp` TypeScript clean

---

## Follow-On Candidates

- Audit other modals/panels in the app for the same buried-buttons pattern and apply the same header treatment.
- Consider a shared `ModalHeaderActions` utility component to avoid repeating the `title`-as-ReactNode pattern across all three components.
- Monorepo workspace setup (`packages/shared-utils/`, `packages/shared-ui/`) to complete the actual npm package extraction — `src/lib/` is now the staging area; all five utilities and three component sets are decoupled and ready.
