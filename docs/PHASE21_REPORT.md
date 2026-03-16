# Phase 21 — UX Overhaul: Bugs, Campaign Cards, Viewer, Typography & In-Context Settings

**Status:** In Progress
**Version:** v0.19.0 (projected)
**Created:** March 15, 2026
**Last updated:** March 16, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P21-A | Bug fixes (theme persistence, modal unification, thumbnail upload freeze) | Complete ✅ | Medium (1–2 days) |
| P21-B | Campaign card visibility toggles | Complete ✅ | Small (3–4 hours) |
| P21-C | Card aspect ratio & max cards per row | Not started | Small (2–3 hours) |
| P21-D | Viewer background & border controls | Complete ✅ | Small (2–3 hours) |
| P21-E | Auth bar display modes (bar, floating, draggable, minimal, auto-hide) | Not started | Medium (4–6 hours) |
| P21-F | CampaignViewer enhancements (fullscreen, toggles, galleries-only mode) | Not started | Medium (4–6 hours) |
| P21-G | Gallery label editing & justification | Not started | Small (2–3 hours) |
| P21-H | Settings tooltips infrastructure | Not started | Small (2–3 hours) |
| P21-I | Typography system & in-context settings popups | Not started | Large (2–3 days) |

---

## Table of Contents

- [Rationale](#rationale)
- [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
- [Architecture Decisions](#architecture-decisions)
- [Settings Pipeline Reference](#settings-pipeline-reference)
- [Track P21-A — Bug Fixes](#track-p21-a--bug-fixes)
- [Track P21-B — Campaign Card Visibility Toggles](#track-p21-b--campaign-card-visibility-toggles)
- [Track P21-C — Card Aspect Ratio & Max Cards Per Row](#track-p21-c--card-aspect-ratio--max-cards-per-row)
- [Track P21-D — Viewer Background & Border Controls](#track-p21-d--viewer-background--border-controls)
- [Track P21-E — Auth Bar Display Modes](#track-p21-e--auth-bar-display-modes)
- [Track P21-F — CampaignViewer Enhancements](#track-p21-f--campaignviewer-enhancements)
- [Track P21-G — Gallery Label Editing & Justification](#track-p21-g--gallery-label-editing--justification)
- [Track P21-H — Settings Tooltips Infrastructure](#track-p21-h--settings-tooltips-infrastructure)
- [Track P21-I — Typography System & In-Context Settings Popups](#track-p21-i--typography-system--in-context-settings-popups)
- [Execution Priority](#execution-priority)
- [Testing Strategy](#testing-strategy)
- [Modified File Inventory](#modified-file-inventory)

---

## Rationale

Phase 20 completed production hardening, CI/CD, and distribution readiness. A subsequent review cycle against a live deployment identified three bugs (theme persistence, dual campaign edit modals with divergent fields, thumbnail upload freeze) and a substantial wishlist of UX improvements centered on campaign card configurability, viewer customization, auth bar flexibility, and typography control.

The common thread: the plugin's visual presentation layer has limited admin controls. Campaign cards always show all elements (title, description, company, media counts, access badge) with no ability to toggle them off. The viewer background is baked into SCSS with no transparency option. The auth bar takes up vertical space with no alternative layouts. Gallery labels are hardcoded strings with hardcoded icons. And there is no per-element typography control beyond what the theme system provides at the font-family level.

Phase 21 addresses all of these systematically, grouped into 9 tracks that progress from bug fixes through incremental feature additions to the foundational typography and in-context settings systems.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Theme persistence approach | **Change on Save only.** ThemeSelector previews in real-time via local state but only persists to the server when the user clicks Save in SettingsPanel. No more direct `localStorage` writes bypassing the settings flow. |
| B | Campaign edit modal unification | **Single unified modal.** Merge `EditCampaignModal` (card-facing) and `CampaignFormModal` (admin panel) into one tabbed modal with all options. Used from both CampaignViewer and AdminPanel. |
| C | Campaign fullscreen mode | **Toggle setting**, not a replacement. Admins choose between the current `xl` Modal and true `fullScreen`. |
| D | Auth bar default mode | Default to `'floating'`. All 5 modes selectable (bar, floating, draggable, minimal, auto-hide). |
| E | Typography scope | **Gallery labels first** (Phase 21-G), then full per-element typography system (Phase 21-I). |
| F | In-context settings popups | Admin-only floating icon buttons near user-facing elements open popovers for live editing. Scoped to Phase 21-I alongside typography. |

---

## Architecture Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| AD-1 | Theme preview via a `previewThemeId` prop on `ThemeProvider`, distinct from the saved `theme` setting | Keeps the save-on-click behavior clean. The provider renders the preview theme when set, falls back to the saved setting. On save, the preview value writes to settings. On cancel/close, preview resets to null and the saved theme re-applies. |
| AD-2 | Unified campaign modal lives in `src/components/shared/` | It's consumed by both `CampaignViewer` (in `components/Campaign/`) and `AdminPanel` (in `components/Admin/`). A shared location avoids circular import paths. |
| AD-3 | Auth bar draggable mode uses CSS `position: fixed` + pointer event handlers with `requestAnimationFrame` | No external drag library needed. Clamp coordinates to a configurable margin (default 16px) from viewport edges. Persist position to `localStorage` via `safeLocalStorage`. |
| AD-4 | Typography overrides stored as a flat settings map with dotted keys | e.g., `typographyOverrides.cardTitle.fontSize`, `typographyOverrides.galleryLabel.fontWeight`. Stored as a JSON object in the `wpsg_settings` option, serialized alongside existing settings. Avoids a separate table or option. |
| AD-5 | In-context settings popups use Mantine `Popover` anchored to a floating `ActionIcon` | The icon is absolutely positioned relative to each target element's container. Only rendered when the user has `isAdmin` capability. Changes write to settings via `apiClient.updateSettings()` and take effect immediately (optimistic update via SWR `mutate`). |

---

## Settings Pipeline Reference

All new settings follow the established pipeline. For reference:

1. **PHP defaults:** Add `snake_case` key + default to `WPSG_Settings::$defaults` in `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` ~L38–250
2. **PHP validation:** Add to `$valid_options` (enums) or `$field_ranges` (numerics) in the same file ~L305–490
3. **TypeScript type:** Add `camelCase` field to `GalleryBehaviorSettings` in `src/types/index.ts` ~L445–673
4. **TypeScript default:** Add default value to `DEFAULT_GALLERY_BEHAVIOR_SETTINGS` in `src/types/index.ts` ~L674–900
5. **UI control:** Add to appropriate tab/accordion in `src/components/Admin/SettingsPanel.tsx`

The `snake_to_camel()` / `camel_to_snake()` conversion in `WPSG_Settings::to_js()` / `from_js()` handles the naming automatically.

---

## Track P21-A — Bug Fixes

**Priority:** 🔴 High — fix before feature work
**Effort:** Medium (1–2 days)

### A-1. Theme selection not persisting on reload

**Problem**

`ThemeSelector` (in `src/components/Admin/ThemeSelector.tsx` ~L111–114) calls `useTheme().setTheme(id)` directly, which:
1. Updates React context state (instant preview — good)
2. Writes to `localStorage('wpsg-theme-id')` (bypasses settings save flow — bad)
3. Does NOT call `updateSetting('theme', id)` in SettingsPanel

On reload, `ThemeProvider` (in `src/contexts/ThemeContext.tsx` ~L52–91) resolves theme ID with this priority:
1. `forcedThemeId` prop
2. `localStorage('wpsg-theme-id')` (if `allowPersistence` is true)
3. `window.__WPSG_CONFIG__.theme` (from PHP settings)
4. `DEFAULT_THEME_ID` ('default-dark')

The server-side theme (priority 3) never gets updated, so the selection only persists via localStorage which is unreliable (cleared by browser, doesn't sync across devices/users).

**Root cause:** ThemeSelector sits inside SettingsPanel but bypasses the settings save flow.

**Fix**

1. **ThemeProvider:** Add a `previewThemeId` state/prop. When set, it overrides the resolved theme without writing to localStorage or settings. Expose `setPreviewTheme(id: string | null)` via context.

2. **ThemeSelector:** Instead of calling `setTheme()`:
   - Call `setPreviewTheme(id)` for instant visual preview
   - Call `updateSetting('theme', id)` to stage the change in SettingsPanel's local state
   - The theme only persists to the server when Save is clicked

3. **SettingsPanel save handler:** On save success, call `setPreviewTheme(null)` to clear the preview (the saved value now takes effect via `window.__WPSG_CONFIG__.theme` after reload, or via the settings state immediately).

4. **SettingsPanel close/cancel:** Call `setPreviewTheme(null)` to revert to the saved theme.

5. **Remove** the `localStorage('wpsg-theme-id')` write from `ThemeProvider.setTheme()`. The localStorage path was a legacy mechanism that is no longer needed once theme goes through settings.

**Files to modify:**
- `src/contexts/ThemeContext.tsx` — Add `previewThemeId` state, expose `setPreviewTheme` in context value, remove localStorage write from `setTheme`
- `src/contexts/themeContextDef.ts` — Add `setPreviewTheme` to `ThemeContextValue` interface
- `src/components/Admin/ThemeSelector.tsx` — Call `setPreviewTheme` + `updateSetting` instead of `setTheme`
- `src/components/Admin/SettingsPanel.tsx` — Clear preview on save/close

**Acceptance criteria:**
- [x] Selecting a theme in the picker instantly previews it
- [x] Closing settings without saving reverts to the previous theme
- [x] Saving persists the theme to the server (`wpsg_settings.theme`)
- [x] Reloading the page shows the server-saved theme
- [x] localStorage write retained as cache (only written on successful save, always in sync with server)

**Completed:** commit 98a7ad7 — Added `setPreviewTheme()` to ThemeContext. ThemeSelector calls preview for instant switch; SettingsPanel commits on save, reverts on close/reset.

---

### A-2. Unify campaign edit modals

**Problem**

Two separate modals exist with non-overlapping field sets:

| Feature | EditCampaignModal (card) | CampaignFormModal (admin) |
|---------|--------------------------|---------------------------|
| File | `src/components/Campaign/EditCampaignModal.tsx` | `src/components/Admin/CampaignFormModal.tsx` |
| Thumbnail upload | ✅ (select from media + FileButton) | ❌ |
| Media management | ✅ (list, add, remove, upload, external URL) | ❌ (link to "Go to Media") |
| Company slug | ❌ | ✅ |
| Status | ❌ | ✅ (draft/active/archived) |
| Visibility | ❌ | ✅ (private/public) |
| Tags | ❌ | ✅ |
| Categories | ❌ | ✅ |
| Publish/unpublish dates | ❌ | ✅ |
| Gallery adapter overrides | ❌ | ✅ |
| Layout template | ❌ | ✅ |
| Border color | ❌ | ✅ (conditional) |

Users encounter different editing experiences depending on whether they click "Edit Campaign" from the card detail view vs. the admin panel table.

**Fix — Create `UnifiedCampaignModal`**

Create `src/components/shared/UnifiedCampaignModal.tsx` with 3 tabs:

| Tab | Fields |
|-----|--------|
| **Details** | Title (required), Description (textarea), Company Slug (required), Thumbnail section (preview + select from existing media + FileButton upload) |
| **Media** | Media item grid with remove buttons, Add section (MediaLibraryPicker, file upload with progress, external URL with type/URL/caption) |
| **Settings** | Status (draft/active/archived), Visibility (private/public), Tags (comma-separated), Categories (TagsInput with autocomplete), Publish At / Unpublish At (datetime-local), Card Border Color (conditional on `cardBorderMode === 'individual'`), Image Gallery / Video Gallery adapter overrides (Select), Layout Template (Select + "Edit Layout" button) |

**Implementation steps:**

1. Create `src/components/shared/UnifiedCampaignModal.tsx`:
   - Accept a superset of props from both existing modals
   - `mode: 'create' | 'edit'` — determines which fields are shown (e.g., adapter overrides only on edit)
   - `campaign?: Campaign` — existing campaign data for edit mode
   - Tabs: `Tabs` component with `Details`, `Media`, `Settings`
   - Media tab only shown in edit mode (creating a campaign before adding media)
   - Re-use the existing thumbnail upload, media grid, and media add logic from `EditCampaignModal`
   - Re-use the form fields and validation from `CampaignFormModal`

2. Create `src/hooks/useUnifiedCampaignModal.ts`:
   - Consolidate the form state, save handler, thumbnail upload handler, media mutation handlers
   - Currently split across `useAdminCampaignActions` (admin panel) and inline handlers in `CampaignViewer`/`App.tsx`
   - Single hook returns: `{ formState, updateField, save, isSaving, uploadThumbnail, mediaItems, addMedia, removeMedia, ... }`

3. Update consumers:
   - `src/components/Campaign/CampaignViewer.tsx` — Replace `EditCampaignModal` usage with `UnifiedCampaignModal`
   - `src/components/Admin/AdminPanel.tsx` — Replace `CampaignFormModal` usage with `UnifiedCampaignModal`
   - `src/hooks/useAdminCampaignActions.ts` — Simplify: modal state management moves to the unified hook

4. Delete old files:
   - `src/components/Campaign/EditCampaignModal.tsx`
   - `src/components/Admin/CampaignFormModal.tsx`

**Files to modify:**
- New: `src/components/shared/UnifiedCampaignModal.tsx`, `src/hooks/useUnifiedCampaignModal.ts`
- Modify: `src/components/Campaign/CampaignViewer.tsx`, `src/components/Admin/AdminPanel.tsx`, `src/hooks/useAdminCampaignActions.ts`
- Delete: `src/components/Campaign/EditCampaignModal.tsx`, `src/components/Admin/CampaignFormModal.tsx`

**Acceptance criteria:**
- [x] Single modal with 3 tabs used from both CampaignViewer and AdminPanel
- [x] All fields from both old modals are present
- [x] Create mode shows Details + Settings tabs only (no Media tab)
- [x] Edit mode shows all 3 tabs
- [x] Thumbnail upload, media management, and all admin fields work correctly
- [x] Old modal files deleted with no remaining imports

**Completed:** commit 0cb2460 — Created `UnifiedCampaignModal.tsx` (3-tab modal: Details, Media, Settings) and `useUnifiedCampaignModal.ts` hook. Updated `App.tsx`, `AdminPanel.tsx`, `useAdminCampaignActions.ts`. Deleted `EditCampaignModal.tsx`, `CampaignFormModal.tsx`, `useEditCampaignModal.ts`. Fixed test queries to handle Mantine `required` label `*` suffix.

---

### A-3. Thumbnail upload freezes page ✅ (subsumed by A-2)

**Problem**

In `EditCampaignModal`, after uploading a custom thumbnail via `FileButton`:
1. The image uploads and displays in the preview — this works
2. After upload completes, scrolling, clicking, and exiting the modal all break
3. On reload, the thumbnail is not saved

**Root cause (probable):** The `FileButton` triggers the native file picker, which temporarily removes focus from the Mantine `Modal`. When the file picker closes, the Modal's focus trap attempts to restore focus, but the upload callback triggers a state update (setting `editCoverImage`) that causes a re-render during focus restoration. This can lock the Modal's internal scroll and pointer event handlers.

Additionally, the upload sets local state (`editCoverImage`) but this value is never written to the server because the save flow for the card-facing modal doesn't include thumbnail as a persisted field — it was only visual.

**Fix:** This is subsumed by A-2 (unified modal). The new modal will:
1. Use `FileButton` with `resetRef` to properly clear the input after upload
2. Wrap the upload callback in `requestAnimationFrame` to defer the state update past the focus-trap restoration cycle
3. Include `thumbnail` in the save payload so it actually persists
4. If the focus-trap issue persists in the unified modal, use `Modal` prop `trapFocus={false}` during upload and restore after

**Acceptance criteria:**
- [x] Upload thumbnail → preview updates → modal remains interactive
- [x] Save → reload → uploaded thumbnail is displayed
- [x] Scroll, click, and close all work after thumbnail upload

**Completed:** Subsumed by A-2. The unified modal uses `FileButton` with proper `resetRef` and includes thumbnail in the save payload. The old `EditCampaignModal` that had the focus-trap conflict was deleted.

---

## Track P21-B — Campaign Card Visibility Toggles

**Priority:** 🟡 Medium
**Effort:** Small (3–4 hours)

### Problem

Campaign cards always render all elements (company name, media counts, title, description, access badge, border, thumbnail fade). Admins cannot customize which elements are visible. Setting `cardBorderWidth` to 0 does not fully remove the border because Mantine's `<Card withBorder>` always adds a 1px default border on all sides, and the card has a hardcoded hover border overlay.

### New settings

| Setting (PHP snake_case) | Setting (TS camelCase) | Type | Default | Controls |
|--------------------------|------------------------|------|---------|----------|
| `show_card_company_name` | `showCardCompanyName` | bool | `true` | Company badge (top-left of thumbnail) |
| `show_card_media_counts` | `showCardMediaCounts` | bool | `true` | "🎬 X videos / 🖼️ X images" line |
| `show_card_title` | `showCardTitle` | bool | `true` | Campaign title text |
| `show_card_description` | `showCardDescription` | bool | `true` | Description text |
| `show_card_border` | `showCardBorder` | bool | `true` | All card borders (Mantine + custom) |
| `show_card_access_badge` | `showCardAccessBadge` | bool | `true` | Green "Access" badge (top-right) |
| `show_card_thumbnail_fade` | `showCardThumbnailFade` | bool | `true` | Bottom gradient overlay on thumbnail |

### Implementation

1. **Settings pipeline:** Add 7 settings to PHP `$defaults`, TS `GalleryBehaviorSettings`, and `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`.

2. **CampaignCard.tsx** (`src/components/Gallery/CampaignCard.tsx`):

   Current border handling (~L45–63):
   ```tsx
   <Card padding={0} radius={borderRadius} withBorder
     style={{ borderLeft: `${borderWidth}px solid ${resolvedBorderColor}` }}>
   ```

   Fix:
   ```tsx
   const showBorder = settings?.showCardBorder !== false && borderWidth > 0;
   <Card padding={0} radius={borderRadius} withBorder={showBorder}
     style={showBorder ? { borderLeft: `${borderWidth}px solid ${resolvedBorderColor}` } : undefined}>
   ```

   Wrap each toggleable element in a conditional:
   - Company badge (~L128–133): `{settings?.showCardCompanyName !== false && <Badge ...>}`
   - Access badge (~L121): `{settings?.showCardAccessBadge !== false && <Badge ...>}`
   - Thumbnail fade (~L80–87): `{settings?.showCardThumbnailFade !== false && <Box ...gradient...>}`
   - Title (~L138): `{settings?.showCardTitle !== false && <Text ...>}`
   - Description (~L142): `{settings?.showCardDescription !== false && <Text ...>}`
   - Media counts (~L157–158): `{settings?.showCardMediaCounts !== false && <div ...>}`
   - Hover border overlay (~L192–200): `{showBorder && hasAccess && <div ...>}`

3. **SettingsPanel.tsx:** Add toggles to the "Campaign Cards" tab → "Card Appearance" accordion. Use `Switch` components with labels.

### Files to modify
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — 7 new defaults
- `src/types/index.ts` — 7 new fields + defaults
- `src/components/Gallery/CampaignCard.tsx` — Conditional rendering for each element
- `src/components/Admin/SettingsPanel.tsx` — 7 new Switch controls

### Acceptance criteria
- [x] Each toggle independently hides/shows its element
- [x] `showCardBorder=false` completely removes all borders (no 1px remnant)
- [x] `showCardThumbnailFade=false` removes the gradient overlay
- [x] All toggles default to `true` (no visual change from current behavior)
- [x] Settings persist via Save and apply on reload

**Completed:** commit 98a7ad7 — Added 7 card visibility toggles with PHP defaults, TS types, conditional rendering in CampaignCard, and Switch controls in SettingsPanel.

---

## Track P21-C — Card Aspect Ratio & Max Cards Per Row

**Priority:** 🟡 Medium
**Effort:** Small (2–3 hours)
**Depends on:** P21-B (settings pipeline established)

### Problem

When using auto (responsive) column mode (`cardGridColumns=0`), cards expand freely — on wide screens with few campaigns, cards stretch. There's no way to cap the maximum columns in auto mode or lock cards to an aspect ratio.

### New settings

| Setting (PHP) | Setting (TS) | Type | Default | Notes |
|---------------|--------------|------|---------|-------|
| `card_max_columns` | `cardMaxColumns` | int | `0` | 0 = unlimited. When > 0 and `cardGridColumns=0`, responsive breakpoints cap at this value. Range: 0–8. |
| `card_aspect_ratio` | `cardAspectRatio` | enum | `'auto'` | Options: `'auto'`, `'16:9'`, `'4:3'`, `'1:1'`, `'3:4'`. Applied via CSS `aspect-ratio`. |
| `card_min_height` | `cardMinHeight` | int (px) | `0` | 0 = no minimum. Applied as `min-height` on the card. Range: 0–600. |

### Implementation

1. **CardGallery.tsx** (`src/components/Gallery/CardGallery.tsx` ~L289–294):

   Current:
   ```tsx
   <SimpleGrid
     cols={galleryBehaviorSettings.cardGridColumns > 0
       ? galleryBehaviorSettings.cardGridColumns
       : { base: 1, sm: 2, lg: 3 }}
   >
   ```

   With `cardMaxColumns`:
   ```tsx
   function buildResponsiveCols(max: number) {
     // Generate breakpoint map that caps at max
     const breakpoints = { base: 1, sm: Math.min(2, max), md: Math.min(3, max), lg: Math.min(4, max) };
     // Remove breakpoints that equal the previous (to keep it clean)
     return breakpoints;
   }

   <SimpleGrid
     cols={galleryBehaviorSettings.cardGridColumns > 0
       ? galleryBehaviorSettings.cardGridColumns
       : galleryBehaviorSettings.cardMaxColumns > 0
         ? buildResponsiveCols(galleryBehaviorSettings.cardMaxColumns)
         : { base: 1, sm: 2, lg: 3 }}
   >
   ```

2. **CampaignCard.tsx** — Apply `aspect-ratio` and `min-height` via inline style on the outer `<Card>`:
   ```tsx
   const aspectRatio = settings?.cardAspectRatio !== 'auto' ? settings.cardAspectRatio.replace(':', ' / ') : undefined;
   const minHeight = settings?.cardMinHeight ? `${settings.cardMinHeight}px` : undefined;
   <Card style={{ aspectRatio, minHeight, ...existingStyles }}>
   ```

3. **Settings pipeline + UI controls.**

### Files to modify
- `class-wpsg-settings.php` — 3 new defaults + validation
- `src/types/index.ts` — 3 new fields + defaults
- `src/components/Gallery/CardGallery.tsx` — Responsive column capping logic
- `src/components/Gallery/CampaignCard.tsx` — aspect-ratio + min-height styles
- `src/components/Admin/SettingsPanel.tsx` — 3 new controls (NumberInput, Select, NumberInput)

### Acceptance criteria
- [ ] `cardMaxColumns=3` in auto mode → never more than 3 columns regardless of screen width
- [ ] `cardAspectRatio='16:9'` → cards maintain 16:9 aspect ratio
- [ ] `cardMinHeight=300` → cards are at least 300px tall
- [ ] All defaults (0, 'auto', 0) produce no visual change from current behavior
- [ ] Responsive behavior still works within the max column cap

---

## Track P21-D — Viewer Background & Border Controls

**Priority:** 🟡 Medium
**Effort:** Small (2–3 hours)

### Problem

The `CardGallery` container background is a hardcoded CSS gradient in `CardGallery.module.scss`:
```scss
.gallery {
  background: linear-gradient(135deg, var(--wpsg-color-background) 0%, var(--wpsg-color-surface) 45%, var(--wpsg-color-background) 100%);
}
```

There is no option for transparent background (for embedding in pages with their own background), and the gallery header's sticky border/shadow cannot be removed.

### New settings

| Setting (PHP) | Setting (TS) | Type | Default | Notes |
|---------------|--------------|------|---------|-------|
| `viewer_bg_type` | `viewerBgType` | enum | `'theme'` | `'theme'` (current gradient), `'transparent'`, `'solid'`, `'gradient'` |
| `viewer_bg_color` | `viewerBgColor` | string | `''` | Hex color for solid mode |
| `viewer_bg_gradient` | `viewerBgGradient` | string | `''` | CSS gradient string for gradient mode |
| `show_viewer_border` | `showViewerBorder` | bool | `true` | Controls gallery header border + shadow |

### Implementation

1. **CardGallery.tsx** — Compute `galleryStyle` based on `viewerBgType`:
   ```tsx
   const galleryStyle = useMemo(() => {
     switch (settings.viewerBgType) {
       case 'transparent': return { background: 'transparent' };
       case 'solid': return { background: settings.viewerBgColor || 'transparent' };
       case 'gradient': return { background: settings.viewerBgGradient || undefined };
       default: return {}; // 'theme' — use SCSS default
     }
   }, [settings]);
   // Apply: <div className={styles.gallery} style={galleryStyle}>
   ```

2. **Gallery header** — When `showViewerBorder=false`, strip the sticky header's `border-bottom`, `box-shadow`, and `backdrop-filter`:
   ```tsx
   const headerStyle = !settings.showViewerBorder
     ? { borderBottom: 'none', boxShadow: 'none', backdropFilter: 'none', background: 'transparent' }
     : {};
   ```

3. **Settings pipeline + UI controls.** The `viewerBgColor` uses `ColorInput`, `viewerBgGradient` uses `TextInput` with a description explaining CSS gradient syntax.

### Files to modify
- `class-wpsg-settings.php` — 4 new defaults + validation
- `src/types/index.ts` — 4 new fields + defaults
- `src/components/Gallery/CardGallery.tsx` — Dynamic background + header styles
- `src/components/Admin/SettingsPanel.tsx` — 4 new controls

### Acceptance criteria
- [x] `viewerBgType='transparent'` → gallery container has no background (page background shows through)
- [x] `viewerBgType='solid'` with a color → solid background
- [x] `viewerBgType='gradient'` with a CSS gradient string → custom gradient
- [x] `showViewerBorder=false` → no header border/shadow
- [x] Default `'theme'` produces no visual change

**Completed:** commit 98a7ad7 — Added 4 viewer background settings with PHP defaults, TS types, dynamic background/header styles in CardGallery, and UI controls in SettingsPanel.

---

## Track P21-E — Auth Bar Display Modes

**Priority:** 🟡 Medium
**Effort:** Medium (4–6 hours)

### Problem

The `AuthBar` component (`src/components/Auth/AuthBar.tsx`) is always a sticky full-width nav bar that takes up vertical space. The sign-in prompt (`src/App.tsx` ~L185–197) is an inline `Alert`. There is no way to minimize or reposition the auth UI.

### New settings

| Setting (PHP) | Setting (TS) | Type | Default | Notes |
|---------------|--------------|------|---------|-------|
| `auth_bar_display_mode` | `authBarDisplayMode` | enum | `'floating'` | Options: `'bar'`, `'floating'`, `'draggable'`, `'minimal'`, `'auto-hide'` |
| `auth_bar_drag_margin` | `authBarDragMargin` | int (px) | `16` | Minimum distance from viewport edges for draggable mode. Range: 0–64. |

### Mode specifications

| Mode | Behavior | Visual |
|------|----------|--------|
| `'bar'` | Current sticky full-width nav bar at top. No changes from existing behavior. | Full-width bar with backdrop blur, `min-height: ~48px` |
| `'floating'` | Small circular `ActionIcon` (avatar or user icon) in a fixed position (default: bottom-right, 16px from edges). Click opens a `Popover` dropdown with: "Signed in as {email}", Admin Panel button, Settings button, Sign out button. | ~40px circle, elevated shadow, theme primary color |
| `'draggable'` | Same as `'floating'` but the icon is **click-and-drag repositionable**. User can drag it anywhere within the viewport, constrained by `authBarDragMargin` px from each edge. Position persists in `safeLocalStorage`. Single click (without drag) opens the popover. | Same circle as floating, with a subtle drag handle indicator (3 dots or grip icon) |
| `'minimal'` | Thin inline strip at the top of the gallery. Avatar/icon + truncated email + dropdown `Menu` for actions. Height ~32px. | Single-line strip, minimal padding, same backdrop blur as current bar |
| `'auto-hide'` | Same as `'bar'` but automatically hides on scroll-down and reappears on scroll-up. Uses a scroll direction listener. | Full bar that slides up/down with CSS `transform: translateY(-100%)` transition |

### Implementation — Draggable mode (the novel element)

```tsx
// In AuthBarDraggable.tsx (new)
function AuthBarDraggable({ email, isAdmin, margin, onOpenAdmin, onOpenSettings, onLogout }) {
  const [pos, setPos] = useState(() => {
    const saved = safeLocalStorage.getItem('wpsg-authbar-pos');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 56, y: window.innerHeight - 56 };
  });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const didDragRef = useRef(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const clamp = useCallback((x: number, y: number) => ({
    x: Math.max(margin, Math.min(window.innerWidth - 40 - margin, x)),
    y: Math.max(margin, Math.min(window.innerHeight - 40 - margin, y)),
  }), [margin]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    didDragRef.current = false;
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    didDragRef.current = true;
    const next = clamp(e.clientX - dragStart.x, e.clientY - dragStart.y);
    // Use requestAnimationFrame for smooth dragging
    requestAnimationFrame(() => setPos(next));
  };
  const onPointerUp = () => {
    setDragging(false);
    safeLocalStorage.setItem('wpsg-authbar-pos', JSON.stringify(pos));
    if (!didDragRef.current) setPopoverOpen((o) => !o); // click without drag → toggle popover
  };

  return (
    <Popover opened={popoverOpen} onChange={setPopoverOpen} position="top" withArrow>
      <Popover.Target>
        <ActionIcon
          size={40} radius="xl" variant="filled"
          style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <IconUser size={20} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        {/* Same menu items as floating mode */}
      </Popover.Dropdown>
    </Popover>
  );
}
```

### Implementation — Auto-hide mode

```tsx
// useScrollDirection hook
function useScrollDirection() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > lastY.current && y > 80); // hide on scroll down past 80px
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return hidden;
}
// In AuthBar: style={{ transform: hidden ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 0.3s ease' }}
```

### File structure

- New: `src/components/Auth/AuthBarFloating.tsx` — Shared by floating + draggable modes
- New: `src/components/Auth/AuthBarMinimal.tsx` — Minimal strip mode
- Modify: `src/components/Auth/AuthBar.tsx` — Add auto-hide support, export mode router component
- Modify: `src/App.tsx` — Pass `authBarDisplayMode` + `authBarDragMargin` to AuthBar, apply same mode to sign-in prompt

### Acceptance criteria
- [ ] All 5 modes render correctly and switch via settings
- [ ] Draggable icon constrained to viewport minus margin on all sides
- [ ] Draggable position persists across page loads
- [ ] Click (without drag) opens the popover; drag does not open it
- [ ] Auto-hide smoothly hides on scroll-down, reappears on scroll-up
- [ ] Minimal mode is ≤32px height
- [ ] Sign-in prompt (unauthenticated) adapts to the same display mode (e.g., floating mode → floating sign-in icon)

---

## Track P21-F — CampaignViewer Enhancements

**Priority:** 🟡 Medium
**Effort:** Medium (4–6 hours)
**Depends on:** P21-A (unified modal should be done first so admin button rewiring is clean)

### Problem

The CampaignViewer (`src/components/Campaign/CampaignViewer.tsx`) has no fullscreen option, always shows all sections, has excessive spacing between the stats block and admin buttons, and the admin buttons look like text links rather than proper buttons. The campaign statistics block is visible to all users with no admin-only restriction.

### New settings

| Setting (PHP) | Setting (TS) | Type | Default | Notes |
|---------------|--------------|------|---------|-------|
| `campaign_modal_fullscreen` | `campaignModalFullscreen` | bool | `false` | `true` → `<Modal fullScreen>` |
| `show_campaign_company_name` | `showCampaignCompanyName` | bool | `true` | Company badge on cover image |
| `show_campaign_date` | `showCampaignDate` | bool | `true` | Date line under title. The date is `campaign.createdAt`. |
| `show_campaign_about` | `showCampaignAbout` | bool | `true` | "About this Campaign" heading |
| `show_campaign_description` | `showCampaignDescription` | bool | `true` | Description text |
| `show_campaign_stats` | `showCampaignStats` | bool | `true` | Entire statistics block |
| `campaign_stats_admin_only` | `campaignStatsAdminOnly` | bool | `true` | When true, stats only visible to admins |
| `campaign_open_mode` | `campaignOpenMode` | enum | `'full'` | `'full'` (current) or `'galleries-only'` |

### Implementation

1. **Fullscreen toggle** — `CampaignViewer.tsx` ~L108:
   ```tsx
   <Modal fullScreen={settings.campaignModalFullscreen} size="xl" ...>
   ```

2. **Conditional sections** — Wrap each section in conditionals. The stats block gets a combined check:
   ```tsx
   {settings.showCampaignStats && (!settings.campaignStatsAdminOnly || isAdmin) && (
     <SimpleGrid ...> {/* stats */} </SimpleGrid>
   )}
   ```

3. **Fullscreen stats overlay** — When `campaignModalFullscreen=true` and stats are visible, render them in a positioned overlay at the bottom:
   ```tsx
   {settings.campaignModalFullscreen && showStats && (
     <Box pos="fixed" bottom={0} left={0} right={0}
       style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
       py="sm" px="lg">
       <Group justify="center" gap="xl">
         {/* Stats as inline items instead of SimpleGrid */}
       </Group>
     </Box>
   )}
   ```

4. **Admin buttons** — Replace the current text-style buttons (~L312–327) with proper Mantine `<Button>` components with icons:
   ```tsx
   <Button leftSection={<IconEdit size={16} />} variant="light" size="sm">Edit Campaign</Button>
   <Button leftSection={<IconPhoto size={16} />} variant="light" size="sm">Manage Media</Button>
   <Button leftSection={<IconArchive size={16} />} variant="light" color="red" size="sm">Archive</Button>
   ```
   Reduce the gap between stats and admin buttons by removing excess margins/padding between the sections.

5. **Galleries-only mode** — When `campaignOpenMode='galleries-only'`, skip the cover image header, title, description, stats, and go straight to the media galleries. The modal still has a close button and the admin actions section at the bottom.

### Files to modify
- `class-wpsg-settings.php` — 8 new defaults + validation
- `src/types/index.ts` — 8 new fields + defaults
- `src/components/Campaign/CampaignViewer.tsx` — All conditional rendering + fullscreen overlay + button styling
- `src/components/Admin/SettingsPanel.tsx` — 8 new controls

### Acceptance criteria
- [ ] `campaignModalFullscreen=true` → modal renders fullscreen
- [ ] Each visibility toggle independently hides its section
- [ ] `campaignStatsAdminOnly=true` → non-admin users don't see stats
- [ ] Admin buttons are styled as proper Mantine Buttons with icons
- [ ] Minimal spacing between stats block and admin buttons
- [ ] Fullscreen mode shows stats in a dark overlay at the bottom
- [ ] `campaignOpenMode='galleries-only'` → modal opens directly to galleries

---

## Track P21-G — Gallery Label Editing & Justification

**Priority:** 🟢 Low
**Effort:** Small (2–3 hours)

### Problem

Gallery section labels ("Images (N)", "Videos (N)") are hardcoded in `ImageCarousel.tsx` and `VideoCarousel.tsx`. The icon prefix (`IconPhoto` / `IconPlayerPlay`) — described as a "4 leaf looking icon" — cannot be removed. Labels cannot be customized or justified.

Additionally, the `galleryTitleText` and `gallerySubtitleText` settings exist in `GalleryBehaviorSettings` but are **not wired** to the UI — `CardGallery.tsx` renders hardcoded "Campaign Gallery" and "Browse and access your campaign media" instead.

### New settings

| Setting (PHP) | Setting (TS) | Type | Default | Notes |
|---------------|--------------|------|---------|-------|
| `gallery_image_label` | `galleryImageLabel` | string | `'Images'` | Custom label for image gallery section. Count appended automatically as " (N)". |
| `gallery_video_label` | `galleryVideoLabel` | string | `'Videos'` | Custom label for video gallery section. |
| `gallery_label_justification` | `galleryLabelJustification` | enum | `'left'` | Options: `'left'`, `'center'`, `'right'`. Applied to the gallery section `<Title>`. |
| `show_gallery_label_icon` | `showGalleryLabelIcon` | bool | `false` | When false, the `IconPhoto`/`IconPlayerPlay` prefix is hidden. Default false (remove by default). |

### Implementation

1. **ImageCarousel.tsx** (~L97–100):

   Current:
   ```tsx
   <Title order={3} size="h5">
     <Group gap={8} component="span">
       <IconPhoto size={18} />
       Images ({images.length})
     </Group>
   </Title>
   ```

   After:
   ```tsx
   <Title order={3} size="h5" ta={settings?.galleryLabelJustification || 'left'}>
     <Group gap={8} component="span" justify={settings?.galleryLabelJustification || 'left'}>
       {settings?.showGalleryLabelIcon && <IconPhoto size={18} />}
       {settings?.galleryImageLabel || 'Images'} ({images.length})
     </Group>
   </Title>
   ```

2. **VideoCarousel.tsx** — Same pattern with `galleryVideoLabel` and `IconPlayerPlay`.

3. **All gallery adapters** (compact-grid, justified, masonry, hexagonal, circular, diamond) — These all render `"Gallery (N)"` as their title with `Title order={3} size="h5"`. Update to use the appropriate label setting (image or video label based on context) and justification setting. The adapters receive settings via props — may need to add the label settings to the props they receive from `CampaignViewer.tsx`.

4. **Wire `galleryTitleText` / `gallerySubtitleText`** in `CardGallery.tsx` ~L219–220:

   Current:
   ```tsx
   <Title order={1} size="h3">Campaign Gallery</Title>
   <Text c="dimmed" size="sm">Browse and access your campaign media</Text>
   ```

   After:
   ```tsx
   <Title order={1} size="h3">{galleryBehaviorSettings.galleryTitleText || 'Campaign Gallery'}</Title>
   <Text c="dimmed" size="sm">{galleryBehaviorSettings.gallerySubtitleText || 'Browse and access your campaign media'}</Text>
   ```

### Files to modify
- `class-wpsg-settings.php` — 4 new defaults + validation
- `src/types/index.ts` — 4 new fields + defaults
- `src/components/Campaign/ImageCarousel.tsx` — Dynamic label + justification + conditional icon
- `src/components/Campaign/VideoCarousel.tsx` — Same
- `src/gallery-adapters/compact-grid/CompactGridGallery.tsx` — Label + justification
- `src/gallery-adapters/justified/JustifiedGallery.tsx` — Label + justification
- `src/gallery-adapters/masonry/MasonryGallery.tsx` — Label + justification
- `src/gallery-adapters/hexagonal/HexagonalGallery.tsx` — Label + justification
- `src/gallery-adapters/circular/CircularGallery.tsx` — Label + justification
- `src/gallery-adapters/diamond/DiamondGallery.tsx` — Label + justification
- `src/gallery-adapters/layout-builder/LayoutBuilderGallery.tsx` — Label + justification
- `src/components/Gallery/CardGallery.tsx` — Wire `galleryTitleText` + `gallerySubtitleText`
- `src/components/Admin/SettingsPanel.tsx` — 4 new controls

### Acceptance criteria
- [ ] Custom label text replaces hardcoded "Images" / "Videos" across all adapters
- [ ] Count suffix "(N)" automatically appended to custom labels
- [ ] Justification setting aligns labels left/center/right
- [ ] `showGalleryLabelIcon=false` (default) removes the icon prefix
- [ ] `galleryTitleText` and `gallerySubtitleText` now control the CardGallery header text
- [ ] Empty label settings fall back to defaults ("Images", "Videos", "Campaign Gallery", etc.)

---

## Track P21-H — Settings Tooltips Infrastructure

**Priority:** 🟢 Low
**Effort:** Small (2–3 hours)

### Problem

Settings controls have no hover help text. Users must guess what each setting does. The Advanced tab is particularly opaque with technical settings that need explanations.

### New settings

| Setting (PHP) | Setting (TS) | Type | Default |
|---------------|--------------|------|---------|
| `show_settings_tooltips` | `showSettingsTooltips` | bool | `true` |

### Implementation

1. **Create `src/components/Admin/SettingTooltip.tsx`:**
   ```tsx
   import { Tooltip, ActionIcon } from '@mantine/core';
   import { IconInfoCircle } from '@tabler/icons-react';

   interface SettingTooltipProps {
     label: string;
     tooltip: string;
     enabled: boolean;
   }

   export function SettingTooltip({ label, tooltip, enabled }: SettingTooltipProps) {
     if (!enabled) return <>{label}</>;
     return (
       <Group gap={4} component="span" wrap="nowrap">
         {label}
         <Tooltip label={tooltip} multiline w={280} withArrow position="top">
           <ActionIcon variant="transparent" size="xs" aria-label={tooltip}>
             <IconInfoCircle size={14} />
           </ActionIcon>
         </Tooltip>
       </Group>
     );
   }
   ```

2. **SettingsPanel.tsx** — Replace plain label strings with `<SettingTooltip>` for each control. Start with the Advanced tab (explicitly requested), then backfill other tabs iteratively.

   Example:
   ```tsx
   <Switch
     label={<SettingTooltip
       label="Enable Debug Overlay"
       tooltip="Shows frame rate, render count, and cache hit stats. Only visible to admins."
       enabled={settings.showSettingsTooltips}
     />}
     checked={settings.debugOverlay}
     onChange={(e) => updateSetting('debugOverlay', e.currentTarget.checked)}
   />
   ```

3. **Tooltip text catalog** — Define a `SETTING_TOOLTIPS: Record<string, string>` map in a separate file (`src/data/settingTooltips.ts`) to keep tooltip strings out of the component. This also makes future i18n easier.

### Files to modify
- `class-wpsg-settings.php` — 1 new default
- `src/types/index.ts` — 1 new field + default
- New: `src/components/Admin/SettingTooltip.tsx`
- New: `src/data/settingTooltips.ts` — Tooltip text catalog
- `src/components/Admin/SettingsPanel.tsx` — Replace label strings with `SettingTooltip` wrappers

### Acceptance criteria
- [ ] Tooltip icon appears next to each setting label (when enabled)
- [ ] Hover/focus on icon shows the tooltip text
- [ ] `showSettingsTooltips=false` hides all tooltip icons
- [ ] Advanced tab is fully covered with tooltips
- [ ] Tooltip text catalog is a separate importable file

---

## Track P21-I — Typography System & In-Context Settings Popups

**Priority:** 🟢 Low (foundational)
**Effort:** Large (2–3 days)
**Depends on:** P21-G (gallery labels are the first elements that use typography), P21-B/F (card + viewer toggles establish the settings patterns)

### Problem — Typography

All user-facing text uses Mantine's built-in sizing (`size="sm"`, `size="h5"`, etc.) with no admin-configurable overrides. The theme system controls `fontFamily` and heading sizes globally, but there is no way to:
- Change font size, weight, or color for specific text elements
- Override typography per-element without changing the theme
- Control letter spacing or text transform per context

### Problem — In-Context Settings

Currently all settings are configured in the SettingsPanel modal. For visual settings (backgrounds, typography, spacing), the disconnect between the settings modal and the live UI makes it hard to see the effect of changes. The user requested admin-only floating icons near user-facing elements that open popover panels for live settings editing.

### Typography element inventory

The following 16 unique text element groups need typography controls:

| # | Element ID | Location | Current Style | Example |
|---|-----------|----------|---------------|---------|
| 1 | `viewerTitle` | CardGallery header | `Title order={1} size="h3"` | "Campaign Gallery" |
| 2 | `viewerSubtitle` | CardGallery header | `Text c="dimmed" size="sm"` | "Browse and access…" |
| 3 | `cardTitle` | CampaignCard | `Text fw={600} size="lg" lineClamp={1}` | Campaign name |
| 4 | `cardDescription` | CampaignCard | `Text size="sm" c="dimmed" lineClamp={2}` | Campaign desc |
| 5 | `cardCompanyName` | CampaignCard badge | `Badge` inner text | Company name |
| 6 | `cardMediaCounts` | CampaignCard | `<span>` with SCSS 0.8125rem | "🎬 3 videos" |
| 7 | `campaignTitle` | CampaignViewer overlay | `Title order={2} size="h3"` | Campaign name |
| 8 | `campaignDescription` | CampaignViewer body | `Text c="dimmed" lh={1.6}` | Description |
| 9 | `campaignDate` | CampaignViewer overlay | `Text size="sm" c="dimmed"` | "Created Mar 2026" |
| 10 | `campaignAboutHeading` | CampaignViewer | `Title order={2} size="h4"` | "About this Campaign" |
| 11 | `campaignStatsValue` | CampaignViewer stats | `Text size="xl" fw={700}` | "12" |
| 12 | `campaignStatsLabel` | CampaignViewer stats | `Text size="sm" c="dimmed"` | "Videos" |
| 13 | `galleryLabel` | All gallery adapters | `Title order={3} size="h5"` | "Images (5)" |
| 14 | `mediaCaption` | Carousel / Lightbox | `Text size="sm" c="dimmed"` / `size="lg" fw={600} c="white"` | Image caption |
| 15 | `authBarText` | AuthBar | `Text size="sm"` | "Signed in as…" |
| 16 | `accessBadgeText` | CampaignCard badge | `Badge color="green"` | "Access" |

### Typography override type

```typescript
// src/types/index.ts
interface TypographyOverride {
  fontFamily?: string;
  fontSize?: string;      // e.g., '14px', '0.875rem', 'sm', 'lg'
  fontWeight?: number;    // e.g., 400, 500, 600, 700
  lineHeight?: number;    // e.g., 1.4, 1.6
  letterSpacing?: string; // e.g., '0.02em', 'normal'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color?: string;         // hex color or CSS color
}

// Stored in settings as:
interface GalleryBehaviorSettings {
  // ... existing fields ...
  typographyOverrides: Record<string, TypographyOverride>;
}
```

### Settings storage

Typography overrides are stored as a JSON object in the existing `wpsg_settings` option:

```php
// In WPSG_Settings::$defaults:
'typography_overrides' => '{}',  // JSON string
```

```php
// In sanitize_settings():
if (isset($settings['typography_overrides'])) {
    $decoded = json_decode($settings['typography_overrides'], true);
    if (!is_array($decoded)) $decoded = [];
    // Validate each override: only allowed keys, sanitize values
    $settings['typography_overrides'] = wp_json_encode($decoded);
}
```

On the React side, `mergeSettingsWithDefaults` parses the JSON string into the `Record<string, TypographyOverride>` object.

### Typography application — `useTypographyStyle` hook

```typescript
// src/hooks/useTypographyStyle.ts
import { useMemo, CSSProperties } from 'react';
import { useSettings } from './useSettings'; // or receive settings as param

const EMPTY: TypographyOverride = {};

export function useTypographyStyle(elementId: string, settings: GalleryBehaviorSettings): CSSProperties {
  const override = settings.typographyOverrides?.[elementId] ?? EMPTY;
  return useMemo(() => {
    const style: CSSProperties = {};
    if (override.fontFamily) style.fontFamily = override.fontFamily;
    if (override.fontSize) style.fontSize = override.fontSize;
    if (override.fontWeight) style.fontWeight = override.fontWeight;
    if (override.lineHeight) style.lineHeight = override.lineHeight;
    if (override.letterSpacing) style.letterSpacing = override.letterSpacing;
    if (override.textTransform) style.textTransform = override.textTransform;
    if (override.color) style.color = override.color;
    return style;
  }, [override]);
}
```

Applied in components:
```tsx
// In CampaignCard.tsx:
const titleStyle = useTypographyStyle('cardTitle', settings);
<Text fw={600} size="lg" lineClamp={1} style={titleStyle}>{campaign.title}</Text>
```

The inline `style` from the hook overrides Mantine's defaults via specificity.

### In-context settings popup — `InContextEditor`

This is the admin-only floating icon that opens a popover for live editing of nearby settings.

```typescript
// src/components/shared/InContextEditor.tsx
interface InContextEditorProps {
  /** Which settings group this popup controls */
  settingsGroup: string;
  /** Position relative to parent container */
  position?: 'top-right' | 'top-left' | 'bottom-right';
  children: ReactNode; // The popup content (form fields)
}
```

**Architecture:**

1. **Visibility:** Only renders when `isAdmin` is true. Controlled by a new setting `showInContextEditors` (bool, default `true`).

2. **Anchor:** `position: absolute` relative to the nearest positioned parent. The `position` prop determines placement (default top-right).

3. **Popup:** Mantine `Popover` that opens on click. Contains a compact form with the relevant settings controls for that context.

4. **Save behavior:** Changes are applied immediately (optimistic) via SWR mutate and debounced-saved to the server after 500ms of inactivity. This gives live preview without requiring a separate Save click.

5. **Debounced save:**
   ```typescript
   // src/hooks/useInContextSave.ts
   export function useInContextSave(apiClient: ApiClient) {
     const pendingRef = useRef<Record<string, unknown>>({});
     const timerRef = useRef<ReturnType<typeof setTimeout>>();

     const save = useCallback((key: string, value: unknown) => {
       pendingRef.current[key] = value;
       clearTimeout(timerRef.current);
       timerRef.current = setTimeout(async () => {
         const batch = { ...pendingRef.current };
         pendingRef.current = {};
         await apiClient.updateSettings(batch);
       }, 500);
     }, [apiClient]);

     return save;
   }
   ```

### In-context editor placement plan

| Location | Settings in popup | Icon position |
|----------|-------------------|---------------|
| **CardGallery header** | `viewerBgType`, `viewerBgColor`, `showViewerBorder`, `galleryTitleText`, `gallerySubtitleText`, viewer title/subtitle typography | Top-right of header |
| **CampaignCard** (first card only, as a representative) | `showCardTitle`, `showCardDescription`, `showCardCompanyName`, `showCardMediaCounts`, `showCardBorder`, `showCardAccessBadge`, `showCardThumbnailFade`, `cardAspectRatio`, card title/description typography | Top-right of first card |
| **CampaignViewer header** | `showCampaignCompanyName`, `showCampaignDate`, campaign title/date typography | Top-right of cover image |
| **CampaignViewer body** | `showCampaignAbout`, `showCampaignDescription`, about heading/description typography | Top-right of "About" section |
| **CampaignViewer stats** | `showCampaignStats`, `campaignStatsAdminOnly`, stats value/label typography | Top-right of stats block |
| **Gallery section** (per gallery) | `galleryImageLabel`/`galleryVideoLabel`, `galleryLabelJustification`, `showGalleryLabelIcon`, gallery label typography | Top-right of gallery label |

### Implementation steps

1. **Phase 1: Typography type + hook + storage** (Day 1)
   - Add `TypographyOverride` type to `src/types/index.ts`
   - Add `typographyOverrides` field to `GalleryBehaviorSettings` + default `{}`
   - Add PHP `typography_overrides` default + sanitization in `class-wpsg-settings.php`
   - Create `src/hooks/useTypographyStyle.ts`
   - Wire the hook into 3 pilot elements: `cardTitle`, `galleryLabel`, `viewerTitle`

2. **Phase 2: Typography editor component** (Day 1–2)
   - Create `src/components/shared/TypographyEditor.tsx` — a compact form with: font-family select, font-size input, font-weight select, line-height input, letter-spacing input, text-transform select, color picker
   - This is the reusable form used inside both SettingsPanel (dedicated typography section) and in-context popups

3. **Phase 3: SettingsPanel typography section** (Day 2)
   - Add a new "Typography" tab to SettingsPanel
   - List all 16 element groups with their `TypographyEditor` instances
   - Add "Reset to default" per element and "Reset all" button
   - Add "Apply to group" feature: select a group (e.g., "All card text", "All gallery labels") and apply typography to all elements in that group at once

4. **Phase 4: InContextEditor infrastructure** (Day 2–3)
   - Create `src/components/shared/InContextEditor.tsx`
   - Create `src/hooks/useInContextSave.ts`
   - Add `showInContextEditors` setting (bool, default `true`)

5. **Phase 5: Wire in-context editors** (Day 3)
   - Add `InContextEditor` instances to all 6 locations from the placement plan
   - Each popup includes the relevant toggle settings + `TypographyEditor` for the associated text elements
   - Verify live preview works (changes appear instantly)

### New files
- `src/types/index.ts` — `TypographyOverride` type (added to existing)
- `src/hooks/useTypographyStyle.ts` — Hook for applying overrides as inline styles
- `src/hooks/useInContextSave.ts` — Debounced settings saver
- `src/components/shared/TypographyEditor.tsx` — Reusable typography form
- `src/components/shared/InContextEditor.tsx` — Admin-only floating icon + popover wrapper

### Files to modify
- `class-wpsg-settings.php` — `typography_overrides` default + sanitization + `show_in_context_editors`
- `src/types/index.ts` — `typographyOverrides` + `showInContextEditors` fields
- `src/components/Gallery/CardGallery.tsx` — Typography styles + InContextEditor
- `src/components/Gallery/CampaignCard.tsx` — Typography styles + InContextEditor (first card)
- `src/components/Campaign/CampaignViewer.tsx` — Typography styles + InContextEditors (3 locations)
- `src/components/Campaign/ImageCarousel.tsx` — Typography style for label
- `src/components/Campaign/VideoCarousel.tsx` — Typography style for label
- All 7 gallery adapter files — Typography style for labels
- `src/components/Admin/SettingsPanel.tsx` — New "Typography" tab

### Acceptance criteria
- [ ] Typography overrides for all 16 element groups are configurable via SettingsPanel
- [ ] `useTypographyStyle` hook correctly applies overrides as inline styles
- [ ] Overrides persist to server via `wpsg_settings.typography_overrides`
- [ ] PHP sanitization validates override keys and values
- [ ] In-context editor icons visible only to admins
- [ ] `showInContextEditors=false` hides all in-context icons
- [ ] Clicking in-context icon opens a popover with relevant settings + typography controls
- [ ] Changes from in-context popups apply immediately (live preview)
- [ ] Changes auto-save after 500ms debounce
- [ ] "Reset to default" clears individual overrides
- [ ] "Apply to group" applies typography across related elements
- [ ] Typography tab in SettingsPanel lists all 16 groups with editors

---

## Execution Priority

```
P21-A (bug fixes) ──→ P21-B (card toggles) ──→ P21-C (aspect ratio)
                                               ↗
P21-D (viewer bg) ──────────────────────────────
P21-E (auth bar) ───────────────────────────────
P21-F (viewer enhancements) ────────────────────
P21-G (gallery labels) ─────────────────────────→ P21-I (typography + in-context)
P21-H (tooltips) ───────────────────────────────
```

**Recommended execution order:**

1. **P21-A** — Fix bugs first. The modal unification (A-2) is the largest single task and unblocks clean work in P21-F.
2. **P21-B** — Card visibility toggles establish the settings pattern for all subsequent tracks.
3. **P21-D** — Viewer background (quick win, highly requested).
4. **P21-C** — Card aspect ratio and max columns.
5. **P21-G** — Gallery labels (prerequisite for typography pilot).
6. **P21-F** — CampaignViewer enhancements.
7. **P21-E** — Auth bar modes (self-contained, can be done in parallel with F/G).
8. **P21-H** — Tooltips (iterative, can start anytime after B).
9. **P21-I** — Typography + in-context editors (largest scope, depends on G).

Tracks D, E, F, G, H are independent and can be parallelized.

---

## Testing Strategy

### Unit tests (Vitest)
- `useTypographyStyle` hook: verify CSS property mapping, empty overrides, partial overrides
- `useScrollDirection` hook (auto-hide auth bar): verify direction detection
- `InContextEditor`: verify admin-only rendering, popover toggle
- `SettingTooltip`: verify conditional rendering based on `showSettingsTooltips`

### Component tests (Vitest + React Testing Library)
- `UnifiedCampaignModal`: render with create/edit modes, verify tab presence, field interactions
- `CampaignCard`: verify each visibility toggle hides its element
- `CampaignViewer`: verify fullscreen prop, conditional sections, galleries-only mode
- `AuthBar`: verify all 5 display modes render correctly
- `CardGallery`: verify aspect ratio applied, max columns capped, background styles

### E2E tests (Playwright)
- Settings save → reload → verify persistence (theme, toggles, typography)
- Campaign card visibility: toggle off all elements → verify card renders without them
- Auth bar draggable: drag to new position → reload → verify position persists
- Typography: set custom font size via in-context editor → verify it applies
- Modal unification: open edit from card view and admin panel → verify same fields

### PHP tests (PHPUnit)
- `typography_overrides` sanitization: malicious keys, invalid values, oversized payloads
- New setting defaults and validation for all ~35 new settings

---

## Modified File Inventory

### New files
| File | Track | Purpose |
|------|-------|---------|
| `src/components/shared/UnifiedCampaignModal.tsx` | A-2 | Merged campaign edit modal |
| `src/hooks/useUnifiedCampaignModal.ts` | A-2 | Consolidated campaign edit state/handlers |
| `src/components/Auth/AuthBarFloating.tsx` | E | Floating + draggable auth icon |
| `src/components/Auth/AuthBarMinimal.tsx` | E | Minimal strip auth bar |
| `src/components/Admin/SettingTooltip.tsx` | H | Tooltip wrapper for setting labels |
| `src/data/settingTooltips.ts` | H | Tooltip text catalog |
| `src/hooks/useTypographyStyle.ts` | I | CSS style hook from typography overrides |
| `src/hooks/useInContextSave.ts` | I | Debounced settings save for in-context editors |
| `src/components/shared/TypographyEditor.tsx` | I | Reusable typography form fields |
| `src/components/shared/InContextEditor.tsx` | I | Admin-only floating icon + popover |

### Modified files
| File | Tracks | Changes |
|------|--------|---------|
| `class-wpsg-settings.php` | B, C, D, E, F, G, H, I | ~35 new defaults, validation, typography_overrides sanitization |
| `src/types/index.ts` | B, C, D, E, F, G, H, I | ~35 new fields + defaults, TypographyOverride type |
| `src/components/Admin/SettingsPanel.tsx` | A, B, C, D, E, F, G, H, I | Theme save flow fix, ~35 new controls, Typography tab, tooltip wrappers |
| `src/components/Gallery/CampaignCard.tsx` | B, C, I | Conditional rendering, aspect ratio, typography styles |
| `src/components/Gallery/CardGallery.tsx` | C, D, G, I | Max columns, background, title/subtitle wiring, typography, in-context editors |
| `src/components/Campaign/CampaignViewer.tsx` | A, F, I | Unified modal integration, fullscreen, conditional sections, typography, in-context editors |
| `src/components/Campaign/ImageCarousel.tsx` | G, I | Dynamic labels, justification, icon toggle, typography |
| `src/components/Campaign/VideoCarousel.tsx` | G, I | Same as ImageCarousel |
| `src/components/Auth/AuthBar.tsx` | E | Mode-aware routing, auto-hide support |
| `src/App.tsx` | E | Pass auth bar mode + margin props |
| `src/contexts/ThemeContext.tsx` | A | previewThemeId support, remove localStorage write |
| `src/contexts/themeContextDef.ts` | A | setPreviewTheme in context type |
| `src/components/Admin/ThemeSelector.tsx` | A | Use setPreviewTheme + updateSetting |
| `src/hooks/useAdminCampaignActions.ts` | A | Simplify for unified modal |
| 7× gallery adapter files | G, I | Label, justification, icon toggle, typography |

### Deleted files
| File | Track | Reason |
|------|-------|--------|
| `src/components/Campaign/EditCampaignModal.tsx` | A-2 ✅ | Replaced by UnifiedCampaignModal |
| `src/components/Campaign/EditCampaignModal.test.tsx` | A-2 ✅ | Tests for deleted modal |
| `src/components/Admin/CampaignFormModal.tsx` | A-2 ✅ | Replaced by UnifiedCampaignModal |
| `src/components/Admin/CampaignFormModal.test.tsx` | A-2 ✅ | Tests for deleted modal |
| `src/hooks/useEditCampaignModal.ts` | A-2 ✅ | Replaced by useUnifiedCampaignModal |
