# P25-X Settings and Card Grid Regression Audit

**Track context:** Phase 25 follow-on QA regression audit with direct overlap into in-progress P25-X work  
**Author:** GPT-5.4  
**Date:** 2026-04-04  
**Status:** Actionable investigation with recommended fix plan  
**Primary scope:**

1. Missing popup color picker when clicking the current color circle in settings surfaces such as `Campaign Gallery Config > Viewport Backgrounds` and `Page & Theme > Page Background > Background Color`.
2. `Settings > Campaign Cards > Card Grid & Pagination`: `Cards Per Row` and `Max Columns` do not produce visible layout changes, and `Max Columns` is placed too far away from `Cards Per Row` when it is shown.

---

## Investigation Process

This section leads the document because the two bugs sit at the intersection of recent Settings Drawer work, earlier modal containment fixes, and the in-progress P25-X card breakpoint model. The fastest way to make the write-up actionable was to narrow likely regression windows first, then trace the full code path for each issue from UI control to runtime behavior.

### 1. Narrow the likely regression window

The first pass was a review of the recent planning and implementation documents most likely to explain the current failures.

Documents reviewed:

- `docs/PHASE25_REPORT.md`
- `docs/P25X_GPT54_IMPLEMENTATION_REVIEW.md`
- `docs/P25X_GPT54_PHASES5_8_DEEP_PLAN.md`

Why these mattered:

- `PHASE25_REPORT.md` identifies the highest-risk recent changes: the Settings `Modal -> Drawer` conversion in P25-U, the earlier modal-safe `Select` fix in P25-A, and the ongoing P25-X card breakpoint work.
- `P25X_GPT54_IMPLEMENTATION_REVIEW.md` already documents that parts of the new multi-unit and card-layout work are in a mixed state.
- `P25X_GPT54_PHASES5_8_DEEP_PLAN.md` explicitly recommends that flat desktop card settings remain the canonical source of truth, with `cardConfig` used only as a sparse override surface for breakpoint-specific behavior.

That last point became important later, because the current runtime still supports nested desktop card overrides even though the desktop settings UI edits only the flat top-level fields.

### 2. Trace the color picker problem from working pattern to failing pattern

The second pass focused on popover-based controls because this codebase already has one known containment fix: the modal-safe `Select` wrapper created for dropdowns inside modal stacks.

Files and symbols reviewed:

- `src/components/Common/ModalSelect.tsx`
- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Common/GalleryConfigEditorModal.tsx`
- `src/components/Settings/GeneralSettingsSection.tsx`
- all direct `ColorInput` usage sites under `src/components/**`
- Mantine `ColorInput` API and local installed type definitions

What this established:

- `ModalSelect` already forces `comboboxProps.withinPortal = false`, which is the correct containment pattern for dropdowns rendered inside this app's modal and drawer stack.
- The Settings drawer in `SettingsPanel.tsx` is explicitly rendered with `withinPortal={false}` and has a body with `overflow: 'hidden'` plus an inner scrolling container. That is correct for live theme preview, but it also means popovers that escape the current tree are especially likely to be clipped, hidden behind overlays, or otherwise inaccessible.
- None of the current `ColorInput` call sites apply the same containment rule.
- Mantine `ColorInput` supports `popoverProps`, including `withinPortal`, so there is a direct equivalent to the existing `ModalSelect` fix.

This strongly suggests a global regression pattern: `Select` was hardened for nested modal and drawer contexts, but `ColorInput` was not.

### 3. Audit the scope of the color picker regression

After identifying the likely containment gap, the next step was to determine whether the problem was limited to the two user-reported screens or broader.

Representative `ColorInput` usage sites found:

- `src/components/Common/GalleryConfigEditorModal.tsx`
- `src/components/Settings/GeneralSettingsSection.tsx`
- `src/components/Settings/CampaignViewerSettingsSection.tsx`
- `src/components/Settings/MediaDisplaySettingsSection.tsx`
- `src/components/Settings/GalleryPresentationSections.tsx`
- `src/components/Settings/GalleryAdapterSettingsSection.tsx`
- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/components/Common/TypographyEditor.tsx`
- `src/components/Common/GradientEditor.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/Admin/LayoutBuilder/BackgroundPropertiesPanel.tsx`
- `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`

Conclusion from this pass:

- The issue should be treated as a shared infrastructure bug affecting all color inputs that appear inside the drawer, modal, campaign, in-context editor, or layout-builder surfaces.
- Fixing only the two reported screens would almost certainly leave the same regression in other places.

### 4. Trace the card controls from Settings UI through persistence into runtime

The fourth pass followed the full data path for `Cards Per Row` and `Max Columns`.

Files and symbols reviewed:

- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/components/Admin/SettingsPanel.tsx`
- `src/utils/mergeSettingsWithDefaults.ts`
- `src/utils/cardConfig.ts`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/CampaignGallery/CampaignCard.tsx`
- `src/utils/resolveColumnsFromWidth.ts`
- `src/services/apiClient.ts`
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-utils.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-sanitizer.php`
- `wp-plugin/wp-super-gallery/includes/settings/class-wpsg-settings-registry.php`

This pass was used to answer four specific questions:

1. Does the desktop UI actually write the two fields?
2. Does save/load preserve them across REST and PHP sanitization?
3. Does the runtime card grid use them when computing layout?
4. Is there any mismatch between what the UI implies and what the runtime actually does?

### 5. Check for older state shapes that can mask desktop edits

The final pass focused on a likely migration-state problem introduced by the new `cardConfig` model.

Key documents and code reviewed:

- `docs/P25X_GPT54_PHASES5_8_DEEP_PLAN.md`
- `src/utils/cardConfig.ts`
- `src/utils/cardConfig.test.ts`
- `src/types/index.ts`

This part of the audit was necessary because the desktop card UI edits top-level flat settings, but the resolver still applies `cardConfig.breakpoints.desktop` if it exists. That creates a split model where old or experimental nested desktop overrides can continue to win over newly edited flat values.

---

## Issues at Hand

### Issue 1. Color picker popup no longer opens from the color swatch

**User-visible symptom**

- Clicking the current color circle in settings fields such as `Campaign Gallery Config > Viewport Backgrounds` and `Page & Theme > Page Background > Background Color` does not open the expected popup color picker.

**Expected behavior**

- Clicking the color swatch should open Mantine's color picker popover directly in the active drawer or modal context.
- This should work anywhere the application exposes a `ColorInput`, not just in the two example screens.

### Issue 2. `Cards Per Row` and `Max Columns` do not visibly change the card grid

**User-visible symptom**

- Changing `Cards Per Row` and `Max Columns` under `Settings > Campaign Cards > Card Grid & Pagination` does not produce a visible layout change.
- The problem persists during editing, after save, and after reload.
- `Max Columns` also feels disconnected in the UI because it is rendered far below `Cards Per Row` rather than adjacent to it.

**Expected behavior**

- `Cards Per Row` should visibly change the number of card columns when fixed-column mode is selected.
- `Max Columns` should visibly clamp the auto-layout result when auto mode is selected.
- The UI should make the relationship between those two controls obvious.

---

## Findings

## Finding 1. The color picker regression is a shared popover containment bug

**Confidence:** High  
**Status:** Confirmed  
**Recommended priority:** High

### Evidence

The current codebase already contains a working pattern for modal-safe dropdowns:

```tsx
export function ModalSelect(props: SelectProps) {
  const { comboboxProps, ...restSelectProps } = props;

  return (
    <Select
      comboboxProps={{ ...comboboxProps, withinPortal: false }}
      {...restSelectProps}
    />
  );
}
```

At the same time:

- `SettingsPanel.tsx` now uses a right-side `Drawer` with `withinPortal={false}`.
- The drawer body is explicitly styled with `overflow: 'hidden'`.
- The main content area is inside a scrolling wrapper.
- `GalleryConfigEditorModal.tsx` and the Settings sections still render raw `ColorInput` instances without any `popoverProps` containment.

Mantine's `ColorInput` does support `popoverProps`, and its popover is exactly the mechanism that would need to be kept inside the active modal or drawer tree.

### Why this likely regressed now

Phase 25 explicitly hardened `Select` behavior inside nested modal stacks, but that hardening was not generalized to other popover-based inputs. The later `Modal -> Drawer` conversion made containment and clipping more sensitive, which likely turned an already-fragile `ColorInput` setup into a clear user-facing regression.

### Scope assessment

This should not be treated as a one-off bug in two fields. Any unwrapped `ColorInput` inside the following contexts is at risk:

- Settings drawer tabs
- shared gallery config drawer
- campaign and unified campaign modals
- in-context editors
- layout builder panels
- typography and gradient helper editors

### Recommended fix

Create a shared wrapper, for example `ModalColorInput` or `ContainedColorInput`, that mirrors the existing `ModalSelect` pattern and forces `popoverProps.withinPortal = false`.

Recommended implementation shape:

```tsx
export function ModalColorInput(props: ColorInputProps) {
  const { popoverProps, ...restProps } = props;

  return (
    <ColorInput
      {...restProps}
      popoverProps={{ ...popoverProps, withinPortal: false }}
    />
  );
}
```

Important detail:

- `withinPortal: false` should be applied after spreading caller props so a caller cannot accidentally or intentionally re-enable portal rendering.

### Why a shared wrapper is the right fix

- It matches the successful containment strategy already used for `Select`.
- It prevents future regressions when new color controls are added.
- It avoids a brittle one-off prop scatter across many files.

---

## Finding 2. The `Max Columns` UI semantics and runtime semantics are currently inconsistent

**Confidence:** High  
**Status:** Confirmed  
**Recommended priority:** High

### Evidence in the settings UI

In `CampaignCardSettingsSection.tsx`, `Max Columns` is only shown when `resolved.cardGridColumns === 0`:

```tsx
{resolved.cardGridColumns === 0 && (
  <>
    <NumberInput
      label="Max Columns (auto mode)"
      ...
    />
  </>
)}
```

That clearly communicates that `Max Columns` is an auto-mode control.

### Evidence in the runtime

In `CardGallery.tsx`, the runtime still clamps fixed column counts with `cardMaxColumns`:

```tsx
const effectiveColumns = useMemo((): number => {
  const cols = s.cardGridColumns;
  const max = s.cardMaxColumns || 0;
  if (cols > 0) return max > 0 ? Math.min(cols, max) : cols;
  ...
}, ...);
```

and:

```tsx
const maxCols = useMemo((): number => {
  const cols = s.cardGridColumns;
  const max = s.cardMaxColumns || 0;
  if (cols > 0) return max > 0 ? Math.min(cols, max) : cols;
  ...
}, ...);
```

### Why this is a bug even before considering persistence

The UI says one thing and the runtime does another:

- UI meaning: `Max Columns` is only relevant in auto mode.
- Runtime meaning: `Max Columns` can still clamp fixed column layouts.

That mismatch creates a failure mode where a previously saved `cardMaxColumns` value continues affecting fixed layouts even when the UI hides the control.

### User-facing consequence

This mismatch can make `Cards Per Row` appear ineffective:

- user selects a fixed column count,
- hidden saved `cardMaxColumns` still clamps it,
- runtime uses the clamp,
- UI does not reveal that the clamp is still in effect.

### Recommended fix

The smallest and cleanest fix is to align runtime semantics to the existing UI contract:

- `Max Columns` remains an auto-mode control.
- fixed `Cards Per Row` values should not be clamped by `cardMaxColumns`.

That means the fixed-branch runtime should use the explicit `cardGridColumns` value directly when it is greater than zero.

### UX follow-up

`Max Columns` should be rendered immediately adjacent to `Cards Per Row` when it is shown, not far down the section after several unrelated sizing and positioning controls.

That adjacency matters because the two fields describe the same conceptual behavior: column count selection versus auto-mode column cap.

---

## Finding 3. Desktop nested `cardConfig` overrides can mask desktop settings edits

**Confidence:** High that the design mismatch exists, medium-to-high that it is contributing to the current saved no-op report  
**Status:** Strongly likely  
**Recommended priority:** High

### Evidence in the resolver

`resolveCardBreakpointSettings()` still overlays `cardConfig.breakpoints.desktop` onto the flat settings object when resolving the desktop breakpoint:

```ts
const resolved = { ...settings };
const bp = settings.cardConfig?.breakpoints;
if (!bp) return resolved;

applyOverrides(resolved, bp.desktop);
```

### Evidence in the desktop settings UI

In `CampaignCardSettingsSection.tsx`, the desktop tab does **not** write nested desktop overrides. Desktop writes go directly to the flat top-level settings:

```tsx
if (isDesktop) {
  updateSetting(key, value);
  return;
}
```

Tablet and mobile use `cardConfig`, but desktop does not.

### Why this matters

If any saved settings payload contains `cardConfig.breakpoints.desktop`, then:

1. the desktop settings UI edits the flat value,
2. the resolver still overlays the older nested desktop value afterward,
3. the runtime sees the nested desktop value,
4. the visible result does not change,
5. save appears to succeed but the active desktop behavior remains masked.

That lines up with the reported symptom that the controls appear to do nothing even after save and reload.

### Why this is especially important in this codebase

The planning note in `P25X_GPT54_PHASES5_8_DEEP_PLAN.md` explicitly recommends keeping flat desktop card settings as the canonical base in v1:

- desktop edits should stay flat,
- `cardConfig` should be sparse,
- tablet and mobile should layer on top of the flat base,
- desktop nested state should not become a second active source of truth.

The current runtime support for nested desktop overrides is therefore a hazard unless the application also intentionally authors and normalizes that state.

### Recommended fix

Add a small normalization step that:

1. reads any `cardConfig.breakpoints.desktop` values,
2. applies them once onto the flat top-level settings,
3. removes the nested desktop node,
4. preserves tablet and mobile overrides exactly as they are.

Where to apply normalization:

- when loading or merging settings from the API,
- before saving settings back to the API,
- and in tests that verify desktop edits are not masked by legacy nested data.

### Why this is the safer fix than embracing nested desktop immediately

If the team wants nested desktop as canonical in a later phase, that should be a deliberate migration with matching UI behavior. It should not remain as a partially supported shadow state while the desktop UI continues to edit flat fields.

---

## Finding 4. There is one secondary layout edge worth checking if the main fixes do not fully resolve the card issue

**Confidence:** Medium  
**Status:** Secondary follow-up, not primary root cause  
**Recommended priority:** Conditional

### Evidence

`CardGallery.tsx` has a separate fixed-width branch:

```tsx
const hasFixedCardWidth = s.cardMaxWidth > 0;
```

and later:

```tsx
...(hasFixedCardWidth && s.cardMaxWidthUnit !== '%' ? {
  maxWidth: `calc(...)`,
  marginInline: 'auto',
} : {}),
```

That means percentage-based fixed card widths skip the container `maxWidth` clamp path.

### Why this matters

If the current live settings payload uses a nonzero `cardMaxWidth` with `%` units, column changes may have less visible effect than expected because the container-width enforcement path is bypassed.

### Recommended handling

Do **not** treat this as the first fix.

Instead:

1. fix the confirmed semantics mismatch,
2. normalize away any desktop nested state,
3. retest the real user scenario,
4. only then decide whether the `%` fixed-width branch needs its own adjustment.

---

## Root Cause Summary

| Finding | Confidence | Root cause type | Recommended action |
|---|---|---|---|
| Missing color picker popup | High | Shared popover containment regression | Add shared modal-safe `ColorInput` wrapper and replace direct usages globally |
| `Cards Per Row` / `Max Columns` mismatch | High | UI/runtime semantic inconsistency | Make runtime treat `Max Columns` as auto-only and move it adjacent to `Cards Per Row` |
| Desktop card edits masked after save/reload | Medium-High | Split source of truth between flat desktop fields and nested desktop `cardConfig` overrides | Normalize nested desktop overrides into flat settings and strip the desktop node |
| Fixed-width `%` branch may reduce visible column changes | Medium | Secondary layout edge case | Re-test after the primary fixes, patch only if still needed |

---

## Recommended Fix Plan

## Phase 1. Restore color picker popovers everywhere

### Goal

Make every settings and modal color field behave the same way as the previously hardened modal-safe selects.

### Implementation

1. Add a shared wrapper component, for example `src/components/Common/ModalColorInput.tsx`.
2. Force `popoverProps.withinPortal = false` inside the wrapper.
3. Migrate direct `ColorInput` usage sites to the wrapper instead of only patching the two reported screens.
4. Add a regression test mirroring `ModalSelect.test.tsx` to ensure callers cannot re-enable portal rendering.

### Minimum migration set

At minimum, replace direct `ColorInput` usage in:

- `src/components/Common/GalleryConfigEditorModal.tsx`
- `src/components/Settings/GeneralSettingsSection.tsx`
- `src/components/Settings/CampaignViewerSettingsSection.tsx`
- `src/components/Settings/MediaDisplaySettingsSection.tsx`
- `src/components/Settings/GalleryPresentationSections.tsx`
- `src/components/Settings/GalleryAdapterSettingsSection.tsx`
- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/components/Common/TypographyEditor.tsx`
- `src/components/Common/GradientEditor.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/Admin/LayoutBuilder/BackgroundPropertiesPanel.tsx`
- `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`

### Acceptance criteria

- Clicking a color swatch opens a picker in the current drawer or modal.
- The picker is not clipped by drawer overflow.
- The behavior is consistent across settings, campaign flows, typography editors, and layout builder panels.

---

## Phase 2. Align card-grid runtime behavior with the UI contract

### Goal

Make `Cards Per Row` and `Max Columns` behave exactly as the settings UI implies.

### Recommended product interpretation

Keep `Max Columns` as an auto-layout control only.

Why this is the best fit:

- the existing label already says `Max Columns (auto mode)`,
- the existing conditional rendering already treats it as auto-only,
- this is the smallest change with the least product ambiguity.

### Implementation

1. Move `Max Columns` so it renders immediately under `Cards Per Row` when auto mode is active.
2. Update `CardGallery.tsx` so fixed `cardGridColumns > 0` uses the explicit fixed value directly.
3. Keep `cardMaxColumns` only in the auto-layout branch.
4. Add runtime tests to prove the new semantics:
   - fixed columns ignore `cardMaxColumns`,
   - auto mode still honors `cardMaxColumns`.

### Acceptance criteria

- Fixed `Cards Per Row` visibly changes the grid after save and reload.
- Auto mode is still clamped by `Max Columns`.
- `Max Columns` is visually adjacent to `Cards Per Row` when shown.

---

## Phase 3. Normalize away nested desktop `cardConfig` state

### Goal

Restore one clear desktop source of truth: the flat top-level card settings.

### Implementation

1. Add a normalization helper in `src/utils/cardConfig.ts` that folds `cardConfig.breakpoints.desktop` into the flat settings object.
2. Remove the nested desktop node after the fold.
3. Apply normalization when loading merged settings.
4. Apply normalization again before save so old payloads do not keep reintroducing the problem.
5. Add tests proving that legacy nested desktop overrides do not mask desktop UI edits.

### Acceptance criteria

- Desktop edits remain effective after save and reload.
- Tablet and mobile sparse overrides continue working.
- Saved payloads no longer preserve a conflicting nested desktop card state.

---

## Phase 4. Re-test the real user configuration and only then decide on the percent-width edge

### Goal

Avoid widening the patch unnecessarily before the confirmed root causes are removed.

### Implementation

1. Re-test the same user scenario after phases 1 through 3.
2. Inspect whether `cardMaxWidth > 0` and `cardMaxWidthUnit === '%'` are part of the current settings payload.
3. If the grid is still visually resistant to column changes, patch the fixed-width percent branch in `CardGallery.tsx` as a separate targeted follow-up.

---

## Suggested Verification Matrix

## Manual verification

### Color picker verification

1. Open `Campaign Gallery Config > Viewport Backgrounds` and click the current color swatch.
2. Open `Page & Theme > Page Background > Background Color` and click the current color swatch.
3. Repeat in at least one other settings tab, one layout builder panel, and one in-context editor.

Expected result:

- the color picker popup opens reliably in each context,
- it is visually above the active drawer or modal,
- it is not clipped or rendered off-context.

### Card grid verification

1. Set `Cards Per Row` to a fixed value such as `4`, save, reload, and confirm the visible card grid changes.
2. Set `Cards Per Row` to `Auto`, then set `Max Columns` to a cap such as `2`, save, reload, and confirm the grid does not exceed the cap.
3. If there is legacy data in the current environment, confirm the same desktop edit works after reload and is not silently reverted or masked.

## Automated verification

Add or extend targeted tests in:

- `src/components/Common/ModalColorInput.test.tsx` or equivalent wrapper test file
- `src/components/CampaignGallery/CardGallery.test.tsx`
- `src/components/Admin/SettingsPanel.test.tsx`
- `src/utils/cardConfig.test.ts`

Recommended assertions:

- wrapper always forces `withinPortal = false`, even if caller tries to override it,
- fixed `cardGridColumns` is not clamped by `cardMaxColumns`,
- auto layout still respects `cardMaxColumns`,
- nested desktop `cardConfig` is normalized into flat settings and does not block desktop edits.

---

## Files Most Likely To Change

### Shared input containment

- `src/components/Common/ModalColorInput.tsx` or equivalent new wrapper
- `src/components/Common/ModalSelect.tsx` (reference only)
- `src/components/Common/ModalSelect.test.tsx` (reference only)

### Settings and modal color input migrations

- `src/components/Common/GalleryConfigEditorModal.tsx`
- `src/components/Settings/GeneralSettingsSection.tsx`
- `src/components/Settings/CampaignViewerSettingsSection.tsx`
- `src/components/Settings/MediaDisplaySettingsSection.tsx`
- `src/components/Settings/GalleryPresentationSections.tsx`
- `src/components/Settings/GalleryAdapterSettingsSection.tsx`
- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/components/Common/TypographyEditor.tsx`
- `src/components/Common/GradientEditor.tsx`
- `src/components/Campaign/UnifiedCampaignModal.tsx`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/components/Admin/LayoutBuilder/BackgroundPropertiesPanel.tsx`
- `src/components/Admin/LayoutBuilder/SlotPropertiesPanel.tsx`

### Card grid logic and normalization

- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/components/CampaignGallery/CardGallery.tsx`
- `src/utils/cardConfig.ts`
- `src/utils/mergeSettingsWithDefaults.ts`
- `src/components/Admin/SettingsPanel.tsx`

### Tests

- `src/components/CampaignGallery/CardGallery.test.tsx`
- `src/components/Admin/SettingsPanel.test.tsx`
- `src/utils/cardConfig.test.ts`

---

## Final Recommendation

Treat the two reported bugs as part of one broader stabilization pass rather than two isolated UI fixes.

The cleanest implementation order is:

1. harden `ColorInput` globally with a shared contained-popover wrapper,
2. align `Cards Per Row` and `Max Columns` semantics so the UI and runtime describe the same behavior,
3. normalize away nested desktop `cardConfig` state so desktop edits cannot be masked by older data,
4. retest the real environment before widening the patch to any percentage-width edge cases.

That approach solves the confirmed problems first, matches the earlier Phase 25 containment strategy, and keeps the in-progress P25-X card breakpoint work aligned with its own design guidance instead of deepening the current split model.