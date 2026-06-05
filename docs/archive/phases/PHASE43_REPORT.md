# Phase 43 — SettingsPanel Splitting, CSS Injection & Error Handling Standardization

**Status:** Complete
**Created:** 2026-06-03
**Last updated:** 2026-06-04

### Tracks

| Track    | Description                                                          | Status   | Effort |
|----------|----------------------------------------------------------------------|----------|--------|
| P43-SP1  | Extract tab panel contents into named, memoized tab components       | Complete | M      |
| P43-SP2  | Remove redundant activeTab guards; add tab component tests           | Complete | S      |
| P43-SP3  | RD-9: LayoutBuilderGallery inline style → CSS injection              | Complete | S      |
| P43-SP4  | RD-21: Standardize error handling patterns                           | Complete | M      |

---

## Rationale

`SettingsPanel.tsx` contains a `SettingsPanelTabsContent` component that renders all 9 tabs and
takes 11 props, most of which are only relevant to 1–2 tabs. This creates unnecessary prop
threading: adding or modifying a prop for just the Typography tab currently requires touching the
`SettingsPanelTabsContentProps` interface and the full component signature even though 8 other
tabs don't use it.

A secondary issue: each `Tabs.Panel` already wraps its content in `{activeTab === 'X' && (...)}`.
The outer Mantine `Tabs` is configured with `keepMounted={false}`, which already unmounts inactive
panels — making the inner `activeTab` guards redundant noise.

> **Note on original scope:** `FUTURE_TASKS.md` cited `~1822 lines` for this file. As of Phase 43,
> `SettingsPanel.tsx` is 736 lines — the heavy per-tab section components (`GeneralSettingsSection`,
> `CampaignCardSettingsSection`, etc.) were already extracted to `src/components/Settings/` during
> earlier phases. The remaining work is splitting the thin shell — `SettingsPanelTabsContent` and
> its 11-prop interface — into per-tab sub-components with narrower interfaces.

---

## Architecture

### Current structure

```
SettingsPanelTabsContent (11 props)
├── <Tabs.Panel value="appearance">
│     {activeTab === 'appearance' && <GeneralSettingsSection .../>}
├── <Tabs.Panel value="cards">
│     {activeTab === 'cards' && <CampaignCardSettingsSection .../>}
├── ... 7 more panels, same pattern
```

### Target structure

```
SettingsPanelTabsContent (unchanged outer shell)
├── <Tabs.Panel value="appearance">
│     <SettingsAppearanceTab settings={…} updateSetting={…} />
├── <Tabs.Panel value="cards">
│     <SettingsCardsTab settings={…} updateSetting={…} apiClient={…}
│                       cardSettingsBreakpoint={…} setCardSettingsBreakpoint={…} />
├── ... each tab has its own component with only the props it needs
```

Each tab component is `React.memo`-wrapped. No props from sibling tabs appear in its interface.
The inner `activeTab` guard is removed from each panel (deferred to P43-SP2 cleanup).

### File layout

All tab components live in a new `src/components/Settings/tabs/` subdirectory:

```
src/components/Settings/tabs/
├── SettingsAppearanceTab.tsx
├── SettingsCardsTab.tsx
├── SettingsGalleryLayoutTab.tsx
├── SettingsGalleryStyleTab.tsx
├── SettingsGalleryNavigationTab.tsx
├── SettingsViewerTab.tsx
├── SettingsTypographyTab.tsx
├── SettingsIntegrationsTab.tsx
└── SettingsSystemAdminTab.tsx
```

---

## Track P43-SP1 — Extract Tab Components

### Goal

Create one named, `React.memo`-wrapped component per tab. Each component declares only the props
its content actually uses. Update `SettingsPanelTabsContent` to render the new components.

### Per-tab prop interfaces

| Tab | Component | Props |
|-----|-----------|-------|
| appearance | `SettingsAppearanceTab` | `settings`, `updateSetting` |
| cards | `SettingsCardsTab` | `settings`, `updateSetting` (as `updateGallerySetting`), `apiClient`, `cardSettingsBreakpoint`, `setCardSettingsBreakpoint` |
| gallery-layout | `SettingsGalleryLayoutTab` | `settings`, `updateSetting` (gallery), `onOpenResponsiveConfig` |
| gallery-style | `SettingsGalleryStyleTab` | `settings`, `updateSetting`, `tooltipLabel` |
| gallery-navigation | `SettingsGalleryNavigationTab` | `settings`, `updateSetting`, `tooltipLabel` |
| viewer | `SettingsViewerTab` | `settings`, `updateSetting` (gallery) |
| typography | `SettingsTypographyTab` | `apiClient`, `customFonts`, `setCustomFonts`, `typographyOverrides`, `updateTypoOverride` |
| integrations | `SettingsIntegrationsTab` | `apiClient` |
| system-admin | `SettingsSystemAdminTab` | `settings`, `updateSetting`, `updateGallerySetting`, `apiClient`, `tooltipLabel` |

### Changes

**`src/components/Settings/tabs/Settings*.tsx`** (9 new files)
- Each file exports one `React.memo`-wrapped functional component.
- Body is the JSX previously inside the matching `{activeTab === '...' && (...)}` block.
- `setWpsgDebugDisplayName` applied to each, e.g.
  `setWpsgDebugDisplayName(SettingsCardsTab, 'SettingsPanel:CardsTab')`.

**`src/components/Admin/SettingsPanel.tsx`**
- `SettingsPanelTabsContentProps` interface is unchanged at this level — still passes all props
  down to the tab shell. The narrowing happens inside each tab component.
- Each `Tabs.Panel` body replaced with a single `<SettingsXxxTab .../>` call.
- Import all 9 tab components at the top.
- Removed: `CARD_SETTINGS_BREAKPOINT_OPTIONS` (moved to `SettingsCardsTab.tsx`),
  `MagicLinkPageSelector` (moved to `SettingsSystemAdminTab.tsx`),
  `usePersistentAccordion` import and call (moved to `SettingsCardsTab.tsx`).
- Removed Mantine imports that were only used in moved code: `Accordion`, `SegmentedControl`, `Paper`, `Select`.
- Removed `useQuery` import (was only used in the moved `MagicLinkPageSelector`).

### Decisions (M43-A)

**Types not shared via a common file.** `SettingsPanelUpdateSetting` and `SettingsPanelTooltipRenderer` are local types in `SettingsPanel.tsx`. Rather than creating a shared types file, tab components declare equivalent types inline (`<K extends keyof SettingsData>(key: K, value: SettingsData[K]) => void` and `ReactNode`) — they're trivially simple one-liners and don't benefit from a shared declaration.

**`SettingsTypographyTab` needs `updateSetting`.** The phase doc's per-tab interface omitted it, but `TypographySettingsSection` receives `onResetAll={() => updateSetting('typographyOverrides', {})}`. Added `updateSetting` to the tab's props.

### Result

`SettingsPanelTabsContent` retains its current prop count (it is a passthrough shell). The win is inside each tab: `SettingsTypographyTab` takes 6 focused props instead of 13, `SettingsIntegrationsTab` takes 1.

---

## Track P43-SP2 — Remove Redundant Guards + Tests

### Goal

Now that each tab's content is isolated in its own component and Mantine's `keepMounted={false}`
already prevents inactive panels from mounting, the `{activeTab === '...' && (...)}` guards
inside each `Tabs.Panel` are redundant. Remove them and add component-level Vitest tests for
the extracted tab components.

### Changes

**`src/components/Admin/SettingsPanel.tsx`**
- Removed the `{activeTab === '...' && (...)}` guard wrappers from all 9 `Tabs.Panel` bodies.
- `activeTab` prop remains — it is still used for `<Tabs value={activeTab}>`.

**`src/components/Settings/tabs/SettingsAppearanceTab.test.tsx`** (new)
- Smoke-test: renders without errors; asserts "Theme & Layout" accordion control is present.

**`src/components/Settings/tabs/SettingsCardsTab.test.tsx`** (new)
- Smoke-test: renders without errors.
- Asserts the breakpoint `SegmentedControl` is present with all three options.

### Decisions (M43-B)

**Guards moved from `SettingsPanelTabsContent`, not from inside tab components.** The original plan was ambiguous about _where_ the `activeTab` guards lived after SP1. In practice, SP1 extracted the JSX _inside_ the conditional; the guards remained in `SettingsPanelTabsContent`. SP2 removes them there, not from inside tab components (which had no guards to remove). The result is cleaner: tab components are now purely props-in → JSX-out with no knowledge of tab routing.

### Verification

```bash
npx vitest run src/components/Settings/tabs/
# 2 test files, 3 tests — all pass
```

---

---

## Track P43-SP3 — RD-9: LayoutBuilderGallery Inline Style → CSS Injection

### Goal

`LayoutBuilderGallery.tsx` currently uses dynamic `style={{...}}` props on slot elements to
apply per-slot dimensions and positions. Convert these to injected CSS class names (via
`useInsertionEffect` that writes a `<style>` element, or `adoptedStyleSheets` where supported).

### Why

Inline `style` props clutter the Elements panel — slot positions appear as per-element inline
rules instead of named classes, making DevTools inspection harder. Extracting to CSS classes
improves inspectability. The rest of the gallery adapters already inject a `<style>` block for
hover effects; this brings slot positions into the same pattern.

### Changes

**`src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`**
- Added `slotCssClass(instanceId, slotId)` helper: produces `wpsg-lb-slot-<instanceId>-<slotId>`
  with CSS-safe char substitution. The `instanceId` parameter scopes CSS to a single gallery
  instance (see decision M43-D below).
- In `LayoutBuilderGalleryInner`: derives `instanceId` via `useId()` (React 18), strips non-alphanumeric
  chars to produce a CSS-safe token.
- Added `slotPositionCss` `useMemo`: iterates `template.slots` and generates one scoped CSS rule per
  slot. `instanceId` included in memo deps.
- Renders `<style>{slotPositionCss}</style>` alongside the existing `<style>{hoverStylesCss}</style>`.
- `GallerySlotView`: receives `positionClassName` prop; applies it to the outer wrapper div;
  removes `position`, `left`, `top`, `width`, `height`, `zIndex` from all three inline style objects
  (empty slot, clip-path `outerStyle`, rectangle `rectStyle`). Mask, filter, clip-path, and
  blend-mode styles stay inline (they contain dynamic/URL-based values).
- Listing mode (in parent): removes the same 5 properties from `containerStyle`; applies
  `className={slotCssClass(instanceId, rawSlot.id)}` to the container div / `TiltWrapper`.
- `pxX` and `pxY` removed from `GallerySlotView` (no longer used there; `pxW`/`pxH` stay for
  mask position computation).

### Decisions (M43-C)

**`<style>` tag, not `useInsertionEffect`.** No `useInsertionEffect` usage exists anywhere in
this codebase; all gallery adapters use `<style>{css}</style>` as a React element. Using the
same pattern keeps the codebase consistent.

**CSP note.** The phase doc claimed inline `style` props require `style-src 'unsafe-inline'` while
`<style>` injection does not. This is incorrect — both require `'unsafe-inline'`. The real benefit
is DevTools inspectability only.

**M43-E (PR review r2): Scope `useQuery` key in `MagicLinkPageSelector` to `apiClient.getBaseUrl()`.** Copilot identified that `queryKey: ['wpPages']` is too generic — if multiple gallery roots with different API base URLs are mounted in the same app, React Query would serve the stale pages list from one root to another. Fix: changed to `queryKey: ['wpPages', apiClient.getBaseUrl()]`, matching the pattern used elsewhere (e.g. `src/services/settingsQuery.ts`).

**M43-D (PR review r1): Per-instance CSS scoping via `useId()`.** Copilot identified that the
original `slotCssClass(slotId)` generated global selectors. Two `LayoutBuilderGallery` instances
on the same page sharing the same template but different container widths would collide — the last
`<style>` block wins, breaking positioning in earlier instances. Fix: `slotCssClass` now takes
`instanceId` as its first parameter. `LayoutBuilderGalleryInner` derives a stable per-mount ID
via `useId()` (React 18), strips non-alphanumeric chars, and passes it to every `slotCssClass`
call and the `slotPositionCss` memo deps array.

**Scope: position/size only.** Mask URL styles, filter expressions, clip-path values, and blend
modes all contain dynamic or sanitized values and stay as inline styles. Converting only the
position/size rectangle is sufficient to achieve the inspectability goal without adding complexity.

### Verification

```bash
npx vitest run src/components/Galleries/Adapters/layout-builder/
# 22 tests — all pass
```

---

## Track P43-SP4 — RD-21: Standardize Error Handling Patterns

### Goal

Audit and normalize error handling across `src/components/`, `src/hooks/`, and `src/services/`.
Establish a consistent three-layer pattern so all errors reach the user in a predictable,
human-readable form.

### Target pattern

| Layer | Error type | Target behavior |
|-------|-----------|-----------------|
| Service layer | API / network errors | Caught in mutation `onError`; forwarded to notification layer |
| UI layer | API errors reaching components | `notifications.show(...)` via Mantine (existing infra) |
| Form layer | Validation errors | Inline field-level feedback via Mantine form `error` props |
| Unexpected errors | Unhandled exceptions | Sentry capture (existing `src/services/monitoring/`) + graceful fallback UI |

### Audit findings

The existing error handling was mostly solid. All React Query `useMutation` calls in components
had `onError` handlers or were called via `mutateAsync` inside a `try/catch` with `onNotify`.
Silent catch patterns were mostly intentional (localStorage, URL parsing, history API).

### Changes

**`src/hooks/useUnifiedCampaignModal.ts`** — User-visible fix:
- Campaign media fetch on modal open silently set an empty list on failure. Added
  `onNotify({ type: 'error', text: 'Failed to load campaign media.' })` in the catch block.

**`src/hooks/useAdminCampaignActions.ts`** — Annotation:
- Two `.catch(() => {})` on `deleteExportJob` (post-download cleanup). Added
  `/* non-fatal: cleanup failure doesn't affect the export result */` comment.

**`src/hooks/useRecentFonts.ts`** — Annotation:
- Unannotated `catch { return cachedSnapshot; }` in localStorage snapshot reader.
  Added `// non-fatal: localStorage unavailable or JSON parse error — fall back to in-memory cache`.

**`src/hooks/useReloadSafeView.ts`** — Annotation:
- Unannotated `catch { return defaultValue; }` in init read.
  Added `// non-fatal: localStorage unavailable or stale JSON — use default`.

**`src/hooks/useShortcutConfig.ts`** — Annotation:
- Unannotated `catch { return {}; }` in `loadOverrides` parse path.
  Added `// non-fatal: localStorage unavailable or JSON parse error — use empty overrides`.

**`src/services/monitoring/`** — no changes needed; Sentry wrapper already in place.

No new dependencies. No infrastructure changes.

### Verification

```bash
npx vitest run
# 146 test files, 2006 tests — all pass
```

---

## Scope note

Phase 43 total estimated effort: ~7–11 hours across four tracks (comfortably full phase).

P43-SP3 (S, 1-2h) and P43-SP4 (M, 3-4h) were drawn from the FUTURE_TASKS.md backlog items
RD-9 and RD-21, both of which are now graduated to this phase plan.
