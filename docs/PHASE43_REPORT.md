# Phase 43 — SettingsPanel Splitting, CSS Injection & Error Handling Standardization

**Status:** Not started
**Created:** 2026-06-03
**Last updated:** 2026-06-04

### Tracks

| Track    | Description                                                          | Status      | Effort |
|----------|----------------------------------------------------------------------|-------------|--------|
| P43-SP1  | Extract tab panel contents into named, memoized tab components       | Not started | M      |
| P43-SP2  | Remove redundant activeTab guards; add tab component tests           | Not started | S      |
| P43-SP3  | RD-9: LayoutBuilderGallery inline style → CSS injection              | Not started | S      |
| P43-SP4  | RD-21: Standardize error handling patterns                           | Not started | M      |

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
- Body is the JSX currently inside the matching `{activeTab === '...' && (...)}` block.
- Inner `activeTab` guard is kept for now (removed in P43-SP2).
- `setWpsgDebugDisplayName` applied to each, e.g.
  `setWpsgDebugDisplayName(SettingsCardsTab, 'SettingsPanel:CardsTab')`.

**`src/components/Admin/SettingsPanel.tsx`**
- `SettingsPanelTabsContentProps` interface shrinks: remove tab-specific props that are now handled
  directly by each tab component's own interface.
- Each `Tabs.Panel` body replaced with a single `<SettingsXxxTab .../>` call.
- Import all 9 tab components at the top.

### Result

`SettingsPanelTabsContent` drops from 11 props to the minimum needed to thread the right sub-set
to each tab: `activeTab`, `setActiveTab`, `settings`, `updateSetting`, `updateGallerySetting`,
`apiClient`, `customFonts`, `setCustomFonts`, `updateTypoOverride`, `tooltipLabel`,
`cardSettingsBreakpoint`, `setCardSettingsBreakpoint`, `setGalleryConfigEditorOpen`.

> Note: the prop count does not shrink dramatically at this level because SettingsPanelTabsContent
> is just a passthrough shell. The win is inside each tab: a `SettingsTypographyTab` that takes
> 5 props is far more readable than a monolith that takes 13.

---

## Track P43-SP2 — Remove Redundant Guards + Tests

### Goal

Now that each tab's content is isolated in its own component and Mantine's `keepMounted={false}`
already prevents inactive panels from mounting, the `{activeTab === '...' && (...)}` guards
inside each `Tabs.Panel` are redundant. Remove them and add component-level Vitest tests for
the extracted tab components.

### Changes

**`src/components/Settings/tabs/Settings*.tsx`**
- Remove the `activeTab ===` conditional wrapping from each component's body.

**`src/components/Settings/tabs/SettingsAppearanceTab.test.tsx`** (and 1–2 more, prioritise the complex tabs)
- Smoke-test: renders without errors given valid settings + update mock.
- Spot-check a key prop: e.g. `SettingsCardsTab` renders the breakpoint `SegmentedControl`.

### Verification

```bash
npx vitest run src/components/Settings/tabs/
```

Full Vitest suite passes. No snapshot churn expected (these components produce the same DOM
as the inline JSX they replaced).

---

---

## Track P43-SP3 — RD-9: LayoutBuilderGallery Inline Style → CSS Injection

### Goal

`LayoutBuilderGallery.tsx` currently uses dynamic `style={{...}}` props on slot elements to
apply per-slot dimensions and positions. Convert these to injected CSS class names (via
`useInsertionEffect` that writes a `<style>` element, or `adoptedStyleSheets` where supported).

### Why

Inline styles require `style-src 'unsafe-inline'` in the Content Security Policy. The rest of
the app uses CSS injection patterns; LayoutBuilderGallery is the outlier. Aligning it also makes
slot styling easier to inspect and override via DevTools.

### Changes

**`src/components/Galleries/Adapters/layout-builder/LayoutBuilderGallery.tsx`**
- Generate a stable CSS class name per slot (e.g. `wpsg-slot-${slotId}`) and inject
  `.[class] { width: ...; height: ...; top: ...; left: ...; }` via `useInsertionEffect`.
- Remove the `style={...}` attribute from the slot element.
- Verify the Shadow DOM host already has an `adoptedStyleSheets`-compatible path; fall back
  to a `<style>` tag appended to the shadow root if not.

### Verification

```bash
npx vitest run src/components/Galleries/Adapters/layout-builder/
```

Visual: Layout Builder preview still renders slots at their correct positions.

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

### Changes

**`src/hooks/`** (multiple files)
- Find `try/catch` blocks that silently swallow errors (no `console.error`, no user feedback).
- Replace with either a `notifications.show` call or a rethrow to the nearest error boundary.

**`src/components/`** (targeted files)
- React Query `useMutation` callbacks with missing `onError` — add consistent handlers.
- Components that render `null` or nothing on error — add a minimal fallback message.

**`src/services/monitoring/`** — no changes needed; Sentry wrapper already in place.

No new dependencies. No infrastructure changes.

### Verification

```bash
npx vitest run
```

Manual: trigger an API error (disconnect network or hit an invalid endpoint); verify a Mantine
notification appears with a human-readable message rather than a blank state or console-only log.

---

## Scope note

Phase 43 total estimated effort: ~7–11 hours across four tracks (comfortably full phase).

P43-SP3 (S, 1-2h) and P43-SP4 (M, 3-4h) were drawn from the FUTURE_TASKS.md backlog items
RD-9 and RD-21, both of which are now graduated to this phase plan.
