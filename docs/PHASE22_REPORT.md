# Phase 22 — Layout Fixes, Theme Contrast & WCAG AA Compliance
**Status:** Complete ✅
**Version:** v0.20.0
**Created:** March 19, 2026
**Last updated:** March 19, 2026

### Tracks

| Track | Description | Status | Effort |
|-------|-------------|--------|--------|
| P22-A | CardGallery cardMaxWidth layout fix | Complete ✅ | Medium (3–4 hours) |
| P22-B | Company logo auto-detection | Complete ✅ | Small (1–2 hours) |
| P22-C | CampaignViewer IIFE refactor | Complete ✅ | Medium (2–3 hours) |
| P22-D | Replace getEffectiveColumns with useMediaQuery | Complete ✅ | Small (1–2 hours) |
| P22-E | Gallery overlay contrast hardening | Complete ✅ | Medium (2–3 hours) |
| P22-F | Theme contrast fixes (textMuted2 & dimmed audit) | Complete ✅ | Medium (3–4 hours) |
| P22-G | WCAG AA compliance fixes | Complete ✅ | Medium (3–4 hours) |
| P22-H | Light theme additions | Complete ✅ | Small (2–3 hours) |
| P22-I | Draggable auth bar position fix | Complete ✅ | Small (1–2 hours) |

---

## Table of Contents

- [Rationale](#rationale)
- [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
- [Track P22-A — CardGallery cardMaxWidth Layout Fix](#track-p22-a--cardgallery-cardmaxwidth-layout-fix)
- [Track P22-B — Company Logo Auto-Detection](#track-p22-b--company-logo-auto-detection)
- [Track P22-C — CampaignViewer IIFE Refactor](#track-p22-c--campaignviewer-iife-refactor)
- [Track P22-D — Replace getEffectiveColumns with useMediaQuery](#track-p22-d--replace-geteffectivecolumns-with-usemediaquery)
- [Track P22-E — Gallery Overlay Contrast Hardening](#track-p22-e--gallery-overlay-contrast-hardening)
- [Track P22-F — Theme Contrast Fixes](#track-p22-f--theme-contrast-fixes)
- [Track P22-G — WCAG AA Compliance Fixes](#track-p22-g--wcag-aa-compliance-fixes)
- [Track P22-H — Light Theme Additions](#track-p22-h--light-theme-additions)
- [Track P22-I — Draggable Auth Bar Position Fix](#track-p22-i--draggable-auth-bar-position-fix)
- [Execution Priority](#execution-priority)
- [Testing Strategy](#testing-strategy)
- [Modified File Inventory](#modified-file-inventory)

---

## Rationale

Phase 21 completed major UX features (card toggles, viewer enhancements, typography system, in-context settings). A post-deployment review identified a critical layout bug in CardGallery's `cardMaxWidth` implementation, several company logo rendering issues, maintainability concerns in CampaignViewer, and a broad set of WCAG AA compliance gaps across the theme system, gallery overlays, and admin panel components.

The common thread: visual polish and accessibility. The `cardMaxWidth` wrapper breaks Mantine's SimpleGrid in ways that produce inconsistent card sizing, lost vertical gaps, and uncentered partial rows. The theme system has contrast ratio failures in secondary/tertiary text colors. Gallery adapter overlays hardcode colors that fail on light-content images. The admin panel has focus indicator removal and low-opacity icons that block keyboard navigation. A persistent draggable auth bar positioning bug (first identified in P21-J but never root-caused) is also resolved. These are all addressed systematically across 9 tracks.

---

## Key Decisions (Pre-Resolved)

| # | Decision | Resolution |
|---|----------|------------|
| A | Company logo rendering | **Auto-detect**: if `logo` string looks like a URL → render as `<Image>`, otherwise render as text/emoji. Supports both production URLs and mock emoji data. |
| B | IIFE refactor scope | **Refactor now** into local named components (`UnifiedGallerySection`, `VideoGallerySection`, `ImageGallerySection`). Same file, not exported. |
| C | getEffectiveColumns approach | **Replace with `useMediaQuery`** from Mantine. Derived const, not state. SSR-safe. |
| D | Accessibility scope | **All identified fixes** included: close button contrast, stats section role, empty media messaging, Load More aria-label, focus indicators, icon opacity. |
| E | Card minimum width (flex mode) | **No minimum** — let CSS handle natural sizing. Flex items use `flex: 0 1 <cardMaxWidth>px`. |
| F | Gallery overlay strategy | **Smart contrast overlays**: increase backdrop opacity to 0.7+ (from 0.65). Industry-standard dark-over-image approach, guaranteed WCAG AA. |
| G | textMuted2 contrast | **Lighten** to reach ≥4.5:1 ratio across all 15 themes. Target ~#7d8fa8 or equivalent per theme. |
| H | Focus indicator fix | **Replace** `outline: 'none'` in AdminPanel with a custom `focus-visible` ring styled to theme variables. |
| I | Low-opacity icons | **Increase to 0.5 minimum** (from 0.3). Meets WCAG 3:1 for UI components. |
| J | Dimmed text audit | **Full audit** of all 20+ `c="dimmed"` instances against their backgrounds; fix any that fail 4.5:1. |
| K | user-select:none | **Remove from text content** (slot indices, labels). Keep on drag handles only. |
| L | Light theme coverage | **Add 1–2 light themes** this phase. Theme authoring is well-documented; quick to do. |
| M | Draggable auth bar fix approach | **useEffect deferred init**: useState starts null, useEffect computes default on mount, immediately saves to localStorage. Return null briefly before effect fires. |
| N | Draggable auth bar resize handling | **Re-clamp on resize**: add a resize listener that re-clamps saved position when window shrinks, preventing icon from going off-screen. |

---

## Track P22-A — CardGallery cardMaxWidth Layout Fix

**Priority:** 🔴 High — root cause of sizing/spacing/centering bugs
**Effort:** Medium (3–4 hours)
**Depends on:** None

### Problem

When `galleryBehaviorSettings.cardMaxWidth > 0`, CardGallery wraps each `CampaignCard` in a bare `<div style={{ maxWidth }}>` inside Mantine's `SimpleGrid` (`src/components/Gallery/CardGallery.tsx` ~L403–405):

```tsx
return galleryBehaviorSettings.cardMaxWidth > 0
  ? <div key={campaign.id} style={{ maxWidth: galleryBehaviorSettings.cardMaxWidth }}>{cardEl}</div>
  : cardEl;
```

This breaks SimpleGrid in four ways:
1. **Vertical spacing** now applies to wrapper divs, not cards → lost or inconsistent vertical gaps
2. **Column distribution** treats wrappers as grid items → stretches columns instead of respecting max-width; partial rows distribute fully (ugly side gaps instead of centered)
3. **Card internals break** — the extra wrapper interferes with the Card's flex column, `aspectRatio`, `minHeight`, and Image `fit="cover"` height. Some cards fall back to intrinsic image dimensions (smaller than expected), others stretch
4. **`cardAspectRatio`/`cardMinHeight` cannot enforce sizing** because the grid no longer controls the direct child

### Fix

**Step 1: Add `maxWidth` prop to CampaignCard**

In `src/components/Gallery/CampaignCard.tsx`:
- Add `maxWidth?: number` to `CampaignCardProps` interface (~L12)
- Apply to root `UnstyledButton` inline styles (~L56):
  ```
  maxWidth: maxWidth ? `${maxWidth}px` : undefined
  width: '100%'    // critical — card fills its allocated space in all modes
  ```

**Step 2: Conditional flex/SimpleGrid layout in CardGallery**

In `src/components/Gallery/CardGallery.tsx`, replace the `visibleCampaigns.map` block (~L387–410) with:

When `cardMaxWidth > 0`:
- Render a `<Box>` with `display: flex`, `flexWrap: wrap`, `justifyContent: 'center'`
- Gap: `${cardGapV}px ${cardGapH}px`
- Each flex child: `<CampaignCard maxWidth={cardMaxWidth} .../>` — no wrapper div
- Flex items use natural sizing — card self-constrains via its own `maxWidth` style
- `width: '100%'` on the Box so it fills the container

When `cardMaxWidth <= 0` (or 0):
- Keep existing `<SimpleGrid>` unchanged (same responsive cols, spacing, verticalSpacing)
- No `maxWidth` prop passed to cards

**Step 3: Preserve pagination slide wrapper**

The `slideStyle` wrapper (`<div style={slideStyle}>`) must wrap BOTH the flex Box and SimpleGrid variants. Currently at ~L387–389. Ensure it remains the parent of whichever layout mode is active.

### Files to modify
- `src/components/Gallery/CampaignCard.tsx` — Props interface + root inline styles
- `src/components/Gallery/CardGallery.tsx` — Conditional layout (~L387–410), remove wrapper div ternary

### Acceptance criteria
- [ ] With `cardMaxWidth=300`: cards capped at 300px, vertical gaps consistent (cardGapV), partial rows centered
- [ ] With `cardMaxWidth=0`: SimpleGrid behavior identical to pre-fix (responsive columns, even spacing)
- [ ] `cardAspectRatio` and `cardMinHeight` work correctly in both modes
- [ ] Paginated mode with `cardMaxWidth > 0` still has slide transitions
- [ ] Cards have `width: 100%` in all modes (fill flex/grid cell)
- [ ] No extra wrapper divs around cards

---

## Track P22-B — Company Logo Auto-Detection

**Priority:** 🟡 Medium
**Effort:** Small (1–2 hours)
**Depends on:** None (parallel with P22-A)

### Problem

`campaign.company.logo` is typed as `string` (in `src/types/index.ts` Company interface). Both CampaignCard (~L189) and CampaignViewer (~L257) render it as `<span>{campaign.company.logo}</span>`.

Mock data uses emojis (`'🏃'`, `'⚽'`, `'🍎'`, etc. in `src/data/mockData.ts`), but production data will use image URLs. Current rendering displays URLs as literal text strings.

### Fix

**Create `src/components/shared/CompanyLogo.tsx`:**

Small component (~20 lines):
- Props: `logo: string`, `name: string`, `size?: number` (default 20)
- Detection: if `logo` starts with `http://`, `https://`, `/`, or `data:` → render Mantine `<Image>` with `src={logo}`, `alt={name}`, `w={size}`, `h={size}`, `fit="contain"`
- Otherwise → render `<span>{logo}</span>` (preserves current emoji behavior)

**Update consumers:**
- `src/components/Gallery/CampaignCard.tsx` ~L189: Replace `<span>{campaign.company.logo}</span>` with `<CompanyLogo logo={campaign.company.logo} name={campaign.company.name} />`
- `src/components/Campaign/CampaignViewer.tsx` ~L257: Same replacement, with `size={24}` (viewer uses larger badges)

### Files to modify
- New: `src/components/shared/CompanyLogo.tsx`
- `src/components/Gallery/CampaignCard.tsx` — Import + replace logo span
- `src/components/Campaign/CampaignViewer.tsx` — Import + replace logo span

### Acceptance criteria
- [ ] Emoji logos render as text (unchanged from current behavior)
- [ ] URL logos render as images with proper alt text
- [ ] `data:` URI logos render as images
- [ ] Missing/empty logo string renders nothing (no broken image icon)
- [ ] Logo fits within Badge without overflow

---

## Track P22-C — CampaignViewer IIFE Refactor

**Priority:** 🟢 Low — maintainability, not a bug
**Effort:** Medium (2–3 hours)
**Depends on:** None (parallel with P22-A, P22-B)

### Problem

CampaignViewer (~L288–347) uses three nested IIFEs to render gallery sections:
1. Unified gallery IIFE (~L298–315): merges videos+images, resolves adapter, applies background
2. Video gallery IIFE (~L316–332): resolves video adapter, applies video-specific settings
3. Image gallery IIFE (~L333–347): resolves image adapter, applies image-specific settings

Each IIFE captures settings, resolves the adapter ID, handles the `layout-builder` special case, and wraps with optional background. The pattern is functional but hard to read and maintain.

### Fix

Extract into three local (non-exported) components in the same file:

**`UnifiedGallerySection`** — Props: `campaign`, `settings`, `isAdmin`
- Merges videos + images, sorts by order
- Resolves effective adapter ID (campaign override or unified setting)
- Handles layout-builder special case
- Renders with optional background wrapper

**`VideoGallerySection`** — Props: `videos`, `settings`, `breakpoint`, `isAdmin`, `layoutTemplateId?`
- Resolves video adapter ID (`campaign.videoAdapterId || resolveAdapterId(s, 'video', breakpoint)`)
- Classic → `VideoCarousel`, layout-builder → `LayoutBuilderGallery`, others → `renderAdapter()`
- Video-specific settings merge: `{ ...s, tileSize: s.videoTileSize ?? s.tileSize }`

**`ImageGallerySection`** — Props: `images`, `settings`, `breakpoint`, `isAdmin`, `layoutTemplateId?`
- Same pattern as video but for images

Replace the three IIFEs with:
```
{unifiedGalleryEnabled
  ? <UnifiedGallerySection campaign={campaign} settings={s} isAdmin={isAdmin} />
  : <>
      <VideoGallerySection videos={campaign.videos} settings={s} breakpoint={breakpoint} isAdmin={isAdmin} layoutTemplateId={campaign.layoutTemplateId} />
      <ImageGallerySection images={campaign.images} settings={s} breakpoint={breakpoint} isAdmin={isAdmin} layoutTemplateId={campaign.layoutTemplateId} />
    </>
}
```

### Files to modify
- `src/components/Campaign/CampaignViewer.tsx` — Extract 3 local components, replace IIFEs (~L288–347)

### Acceptance criteria
- [ ] All gallery rendering behavior is identical before and after refactor
- [ ] Unified mode, video-only, image-only, and mixed modes all render correctly
- [ ] Background wrapping (videoBgType, imageBgType, unifiedBgType) still applies
- [ ] Layout-builder adapter special case still works
- [ ] No new exports added — components are local to the file

---

## Track P22-D — Replace getEffectiveColumns with useMediaQuery

**Priority:** 🟢 Low — works currently, just not idiomatic
**Effort:** Small (1–2 hours)
**Depends on:** P22-A (layout changes in same file)

### Problem

`getEffectiveColumns` in `src/components/Gallery/CardGallery.tsx` (~L75–88) uses raw `window.innerWidth` in a `useCallback`:

```tsx
const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
let auto = 1;
if (w >= 1200) auto = 3;
else if (w >= 768) auto = 2;
```

A separate `useEffect` (~L90–97) attaches a resize event listener to update the derived `effectiveColumns` state. This works but:
- Not SSR-safe (direct `window` access in render-path callback)
- Manual resize listener when Mantine's `useMediaQuery` handles this idiomatically
- State-based when it could be a derived const

### Fix

1. **Remove** `getEffectiveColumns` useCallback (~L75–88)
2. **Remove** resize listener useEffect (~L90–97)
3. **Add** two Mantine `useMediaQuery` hooks:
   ```
   const isLg = useMediaQuery('(min-width: 75em)');   // ≥1200px → 3 cols
   const isSm = useMediaQuery('(min-width: 48em)');   // ≥768px → 2 cols
   ```
4. **Derive** column count as a const:
   ```
   const autoColumns = isLg ? 3 : isSm ? 2 : 1;
   const cols = galleryBehaviorSettings.cardGridColumns > 0
     ? galleryBehaviorSettings.cardGridColumns
     : autoColumns;
   const effectiveColumns = galleryBehaviorSettings.cardMaxColumns > 0
     ? Math.min(cols, galleryBehaviorSettings.cardMaxColumns)
     : cols;
   ```
5. **Remove** `effectiveColumns` from state — it's now a derived const used directly

### Files to modify
- `src/components/Gallery/CardGallery.tsx` — Remove callback + effect, add useMediaQuery, derive const

### Acceptance criteria
- [ ] Column count matches current breakpoints: 1 (<768px), 2 (768–1199px), 3 (≥1200px)
- [ ] `cardGridColumns` and `cardMaxColumns` clamping behavior unchanged
- [ ] Paginated mode correctly uses derived column count for items-per-page calculation
- [ ] No `window.innerWidth` references remain in the component
- [ ] SSR-safe (useMediaQuery returns false during SSR)

---

## Track P22-E — Gallery Overlay Contrast Hardening

**Priority:** 🔴 High — WCAG AA compliance
**Effort:** Medium (2–3 hours)
**Depends on:** None (parallel with all)

### Problem

All gallery adapters hardcode white icons and text on `rgba(0,0,0,0.65)` semi-transparent overlays:

| File | Lines | Hardcoded values |
|------|-------|------------------|
| `src/gallery-adapters/justified/JustifiedGallery.tsx` | ~132–144 | `color: 'white'`, `background: 'rgba(0,0,0,0.65)'` |
| `src/gallery-adapters/compact-grid/CompactGridGallery.tsx` | ~165 | Same pattern |
| `src/gallery-adapters/masonry/MasonryGallery.tsx` | ~146 | Same pattern |
| `src/gallery-adapters/hexagonal/HexagonalGallery.tsx` | ~143 | Same pattern |
| `src/gallery-adapters/circular/CircularGallery.tsx` | ~103 | Same pattern |

On very light images, `rgba(0,0,0,0.65)` may not provide sufficient backdrop for white text to meet WCAG AA 4.5:1 contrast. The worst case is a white image underneath, yielding white-on-partially-transparent-black which may dip below AA.

Additionally, `filter: 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))'` helps icon visibility but is not a substitute for contrast compliance.

### Fix

**Increase overlay backdrop opacity to 0.7** across all adapters:
- `rgba(0,0,0,0.65)` → `rgba(0,0,0,0.7)` for hover overlays
- This guarantees ≥4.5:1 contrast for white text on any underlying image (worst case: white image → white text on `rgba(0,0,0,0.7)` = ~4.8:1 ✅)
- Keep `color: 'white'` (not theme-aware — overlays sit on images, not theme surfaces)
- Keep `drop-shadow` for additional readability

**Extract shared overlay constants** to `src/gallery-adapters/_shared/overlayStyles.ts`:
```
export const OVERLAY_BG = 'rgba(0,0,0,0.7)';
export const OVERLAY_TEXT = '#ffffff';
export const OVERLAY_SHADOW = 'drop-shadow(0 1px 6px rgba(0,0,0,0.9))';
```

This DRYs up the repeated values and makes future adjustments single-point-of-change.

### Files to modify
- New: `src/gallery-adapters/_shared/overlayStyles.ts`
- `src/gallery-adapters/justified/JustifiedGallery.tsx`
- `src/gallery-adapters/compact-grid/CompactGridGallery.tsx`
- `src/gallery-adapters/masonry/MasonryGallery.tsx`
- `src/gallery-adapters/hexagonal/HexagonalGallery.tsx`
- `src/gallery-adapters/circular/CircularGallery.tsx`

### Acceptance criteria
- [ ] All gallery adapter overlays use `rgba(0,0,0,0.7)` background
- [ ] White text on overlay meets WCAG AA 4.5:1 contrast on any image
- [ ] All adapters import from shared `overlayStyles.ts` (no more inline magic values)
- [ ] Visual appearance nearly identical (slightly darker overlay, barely noticeable)
- [ ] Drop-shadow still present for additional readability

---

## Track P22-F — Theme Contrast Fixes

**Priority:** 🔴 High — WCAG AA compliance
**Effort:** Medium (3–4 hours)
**Depends on:** None

### Problem — textMuted2 contrast

`textMuted2` in default-dark theme is `#64748b` on surface `#1e293b`, yielding ~3.2:1 contrast ratio. This **fails WCAG AA** for normal text (requires 4.5:1). The color is used for tertiary information across the application.

Same issue likely exists in other dark themes using similar tones.

### Problem — dimmed text audit

Mantine's `c="dimmed"` uses the framework's internal dimmed color, which varies by color scheme. Found 20+ instances across gallery and admin components. Some may fail AA contrast depending on the surface they sit on.

**Known instances requiring audit:**

| File | Line(s) | Context |
|------|---------|---------|
| `src/components/shared/GradientEditor.tsx` | 26 | Label in gradient editor |
| `src/components/shared/UnifiedCampaignModal.tsx` | 393, 409 | Media attachment area |
| `src/components/Admin/MediaCard.tsx` | 93 | Media metadata |
| `src/components/Admin/ThemeSelector.tsx` | 53, 140 | Theme description |
| `src/components/Admin/ArchiveCompanyModal.tsx` | 57 | Campaign list |
| `src/components/Admin/MediaTab.tsx` | 642, 723 | URL and count text |
| `src/components/Admin/SettingsPanel.tsx` | 1116, 1134, 1857, 2169 | Settings descriptions |
| `src/components/Admin/QuickAddUserModal.tsx` | 125 | Help text |
| `src/components/Admin/MediaLightboxModal.tsx` | 92 | Image counter |
| `src/components/Admin/LayoutTemplateList.tsx` | 333, 334, 395, 548 | Template metadata |
| `src/components/Admin/CampaignImportModal.tsx` | 80 | Import instructions |
| `src/components/Gallery/RequestAccessForm.tsx` | 52 | Form description |

### Fix — textMuted2

For each of the 15 theme definitions in `src/themes/definitions/`:
1. Check `textMuted2` value against `surface` value for contrast ratio
2. If < 4.5:1, lighten (dark themes) or darken (light themes) the `textMuted2` value
3. Target: ≥4.5:1 contrast on the theme's `surface` color
4. For default-dark: `#64748b` → approximately `#8494a7` (exact value TBD via contrast calculation)

### Fix — dimmed text

1. Mantine's `dimmed` color maps to `--mantine-color-dimmed` which is `colors.dark[2]` in dark mode. Each theme may override `dark` tuple via `deriveDarkTuple()` in `src/themes/colorGen.ts`
2. For each theme: calculate actual dimmed value → check against the theme's surface
3. If dimmed fails contrast on a theme:
   - Override `--mantine-color-dimmed` in the theme's component overrides (`src/themes/adapter.ts`)
   - OR adjust the theme's dark tuple so `dark[2]` meets AA
4. Document which themes pass/fail and the specific adjustments made

### Files to modify
- `src/themes/definitions/*.json` — Adjust `textMuted2` values per theme
- `src/themes/adapter.ts` — Potentially override dimmed color per theme
- `src/themes/colorGen.ts` — Potentially adjust dark tuple derivation thresholds

### Acceptance criteria
- [ ] All 15 themes: `textMuted2` on `surface` ≥ 4.5:1 contrast ratio
- [ ] All 15 themes: Mantine dimmed color on `surface` ≥ 4.5:1 contrast ratio
- [ ] Visual difference is minimal — colors slightly lighter/darker, not dramatically changed
- [ ] High-contrast theme still meets its AAA (≥7:1) target
- [ ] Color generation in `colorGen.ts` still produces perceptually uniform scales

---

## Track P22-G — WCAG AA Compliance Fixes

**Priority:** 🔴 High — accessibility compliance
**Effort:** Medium (3–4 hours)
**Depends on:** None (parallel with all)

### G-1. AdminPanel focus indicator removal

**Problem:** `src/components/Admin/AdminPanel.tsx` line ~182 sets `outline: 'none'` on an element, removing the default browser focus indicator. This violates WCAG 2.4.7 ("Focus Visible").

**Fix:** Replace `outline: 'none'` with a custom `focus-visible` ring:
```
outline: 'none'
→
'&:focus-visible': { boxShadow: '0 0 0 2px var(--mantine-color-blue-5)' }
```
Or apply via the component's `styles` prop / SCSS module.

**File:** `src/components/Admin/AdminPanel.tsx` ~L182

---

### G-2. CampaignViewer close button contrast

**Problem:** Modal close button uses `rgba(0,0,0,0.45)` background with white icon (`src/components/Campaign/CampaignViewer.tsx` ~L194). On light cover images, the 45% black background may not provide sufficient contrast.

**Fix:** Increase to `rgba(0,0,0,0.65)`. White icon on `rgba(0,0,0,0.65)` achieves ≥4.5:1 even on pure white backgrounds.

**File:** `src/components/Campaign/CampaignViewer.tsx` ~L194

---

### G-3. BuilderHistoryPanel icon opacity

**Problem:** Undo/redo/trash icons in `src/components/Admin/LayoutBuilder/BuilderHistoryPanel.tsx` use `opacity: 0.3` (lines ~36, ~146). WCAG 1.4.11 requires UI components to have ≥3:1 contrast. At 0.3 opacity, icons may fail this requirement.

**Fix:** Increase opacity minimum to `0.5` for all interactive icons. This ensures ≥3:1 for UI components.

**File:** `src/components/Admin/LayoutBuilder/BuilderHistoryPanel.tsx` ~L36, ~L146

---

### G-4. Stats section semantic role

**Problem:** CampaignViewer stats grid (~L371) has `aria-labelledby` but lacks `role="region"`, so screen readers don't announce it as a landmark.

**Fix:** Add `role="region"` to the stats grid container.

**File:** `src/components/Campaign/CampaignViewer.tsx` ~L371

---

### G-5. Empty media messaging

**Problem:** When a campaign has zero videos and zero images, the gallery section IIFEs return `null` silently. No visual or screen-reader indication that media is absent.

**Fix:** After the gallery sections block (~L348), add:
```
{campaign.videos.length === 0 && campaign.images.length === 0 && (
  <Text c="dimmed" ta="center" py="xl">No media available for this campaign.</Text>
)}
```

**File:** `src/components/Campaign/CampaignViewer.tsx` ~L348

---

### G-6. Load More button aria-label

**Problem:** Load More button in CardGallery (~L445) has text content but no explicit `aria-label` describing the action in full context.

**Fix:** Add `aria-label={`Load ${remaining} more campaigns`}` where `remaining = filteredCampaigns.length - visibleCount`.

**File:** `src/components/Gallery/CardGallery.tsx` ~L445

---

### G-7. LayoutBuilder user-select:none on text content

**Problem:** `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` (~L682, L732, L788, L836, L858) applies `userSelect: 'none'` to text content including slot indices and labels. This may prevent assistive technology from reading/selecting these elements.

**Fix:** Remove `userSelect: 'none'` from text content elements (slot indices, labels, info text). Keep it only on drag handle elements where accidental text selection during drag operations is a legitimate concern.

**File:** `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` — multiple lines

---

### G-8. LayoutSlot mask layer opacity

**Problem:** `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` ~L175 applies `opacity: 0.4` on a mask layer. If this overlays text content, the resulting contrast may fail WCAG AA.

**Fix:** Evaluate whether the mask overlays text. If yes, increase opacity to 0.6 minimum or use a semi-transparent background approach that doesn't affect child text opacity.

**File:** `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` ~L175

---

### Files to modify
- `src/components/Admin/AdminPanel.tsx` — G-1 (focus indicator)
- `src/components/Campaign/CampaignViewer.tsx` — G-2, G-4, G-5 (close button, stats role, empty media)
- `src/components/Admin/LayoutBuilder/BuilderHistoryPanel.tsx` — G-3 (icon opacity)
- `src/components/Gallery/CardGallery.tsx` — G-6 (Load More aria-label)
- `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` — G-7, G-8 (user-select, mask opacity)

### Acceptance criteria
- [ ] G-1: AdminPanel has visible focus ring on keyboard navigation (focus-visible, not focus)
- [ ] G-2: Close button contrast ≥4.5:1 on white backgrounds
- [ ] G-3: All interactive icons ≥0.5 opacity
- [ ] G-4: Stats section announced as landmark by screen readers
- [ ] G-5: "No media available" message shown for empty campaigns
- [ ] G-6: Screen reader announces full context on Load More button
- [ ] G-7: Slot text content is selectable; drag handles remain non-selectable
- [ ] G-8: Mask layer doesn't cause contrast failure on overlaid text

---

## Track P22-H — Light Theme Additions

**Priority:** 🟢 Low — UX enhancement
**Effort:** Small (2–3 hours)
**Depends on:** P22-F (contrast fixes establish the AA baseline for new themes)

### Problem

Only 3 of 15 themes are light (default-light, material-light, solarized-light). Many users prefer light themes, and the current selection is limited.

### Fix

Add 2 new light themes following the established theme authoring pipeline:

**Theme 1: `github-light`**
- Inspired by GitHub's light design language
- Background: `#ffffff`, Surface: `#f6f8fa`, Text: `#1f2328`
- Primary: `#0969da` (GitHub blue)
- Clean, professional, high-contrast

**Theme 2: `catppuccin-latte`**
- Companion to existing `catppuccin-mocha` dark theme
- Background: `#eff1f5`, Surface: `#e6e9ef`, Text: `#4c4f69`
- Primary: `#1e66f5` (Catppuccin blue)
- Warm pastel light theme

For each:
1. Create JSON definition in `src/themes/definitions/` following `_base.json` structure
2. Define all required color properties: background, surface (1/2/3), text, textMuted, textMuted2, primary, success, warning, error, info
3. Ensure all text colors on their surfaces meet WCAG AA (≥4.5:1)
4. Register in `src/themes/index.ts` bundle

### Files to modify
- New: `src/themes/definitions/github-light.json`
- New: `src/themes/definitions/catppuccin-latte.json`
- `src/themes/index.ts` — Register new themes

### Acceptance criteria
- [ ] Both themes appear in ThemeSelector
- [ ] All text/surface contrast ratios ≥ 4.5:1 (WCAG AA)
- [ ] Color scale generation produces valid 10-step scales
- [ ] Components render correctly (cards, viewer, admin panel)
- [ ] CSS variables injected properly in both normal DOM and Shadow DOM

---

## Track P22-I — Draggable Auth Bar Position Fix

**Priority:** 🔴 High — persistent user-facing bug, previously attempted in P21-J (1B) but not root-caused
**Effort:** Small (1–2 hours)
**Depends on:** None (parallel with all)

### Problem

The draggable auth bar (`src/components/Auth/AuthBarFloating.tsx`) renders in the top-left corner (~16, 16) on every fresh page load instead of the intended bottom-right default. Previous fix attempts in P21-J/1B did not resolve the issue.

**Root cause:** The `useState` initializer (line ~43–50) computes the default position using `window.innerWidth` / `window.innerHeight`:

```tsx
const [pos, setPos] = useState<{ x: number; y: number }>(() => {
  if (!draggable) return { x: 0, y: 0 };
  const saved = readSavedPos();
  return saved ?? {
    x: Math.max(margin, (typeof window !== 'undefined' ? window.innerWidth : 800) - ICON_SIZE - margin),
    y: Math.max(margin, (typeof window !== 'undefined' ? window.innerHeight : 600) - ICON_SIZE - margin),
  };
});
```

React runs the `useState` initializer during the first render pass. At this point:
1. In SSR contexts, `typeof window === 'undefined'` → falls back to `800`/`600`, placing the icon at bottom-right of an 800×600 phantom viewport — wrong on any real screen
2. Even in client-only mode, `window.innerWidth`/`innerHeight` may report stale or incorrect values before the first paint (especially in WordPress embed iframes, shadow DOM contexts, or when the component mounts before layout settles)
3. The position is **never recalculated after mount** when no saved value exists — it stays wherever the initializer put it

The saved position is only written after the user actually *drags* the icon. On fresh loads with no prior drag → no save → always falls back to the (potentially wrong) initializer value.

### Fix

**Step 1: Defer default position to useEffect**

Replace the `useState` initializer with null-start + browser-side useEffect:

```tsx
// Read saved position (works in SSR — just null)
const saved = readSavedPos();

// Start with saved position or null (unknown until effect)
const [pos, setPos] = useState<{ x: number; y: number } | null>(saved);
const posRef = useRef(pos);

// Compute default position *only in browser*, after mount
useEffect(() => {
  if (pos !== null) return; // already have a saved position
  const defaultPos = {
    x: Math.max(margin, window.innerWidth - ICON_SIZE - margin),
    y: Math.max(margin, window.innerHeight - ICON_SIZE - margin),
  };
  setPos(defaultPos);
  posRef.current = defaultPos;
  // Save immediately so next page load uses this value
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(defaultPos));
}, [margin]);
```

**Step 2: Guard render for null position**

Add early return when position hasn't been computed yet:
```tsx
if (!draggable || pos === null) {
  return null; // invisible for 1 frame until effect fires
}
```

This prevents a flash-of-wrong-position. The icon appears only once its coordinates are known.

**Step 3: Add window resize re-clamping**

Currently, if the user drags the icon to (1800, 900), then resizes the browser to 1200×800, the icon goes off-screen. Add a resize listener:

```tsx
useEffect(() => {
  if (!draggable) return;
  const handleResize = () => {
    setPos((prev) => {
      if (!prev) return prev;
      const clamped = clamp(prev.x, prev.y);
      if (clamped.x !== prev.x || clamped.y !== prev.y) {
        posRef.current = clamped;
        safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(clamped));
        return clamped;
      }
      return prev;
    });
  };
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, [draggable, clamp]);
```

**Step 4: Update type annotations**

The `pos` state type changes from `{ x: number; y: number }` to `{ x: number; y: number } | null`. Update `onPointerDown` and `buttonStyle` logic to account for this (they are already guarded by the early return in Step 2, so this is just type-level cleanup).

### Files to modify
- `src/components/Auth/AuthBarFloating.tsx` — Steps 1–4 (position init, null guard, resize handler, types)

### Acceptance criteria
- [ ] Fresh load (no localStorage): icon appears at bottom-right corner with correct margin
- [ ] Subsequent loads: icon appears at last-dragged position (from localStorage)
- [ ] Incognito mode / cleared storage: icon appears at bottom-right (not top-left)
- [ ] Window resize: icon re-clamps to viewport bounds (never goes off-screen)
- [ ] Drag → save → reload → icon at saved position
- [ ] Non-draggable mode (`draggable=false`): unaffected, still fixed at `right:24, bottom:24`
- [ ] No visible position flash on initial load (icon hidden until position computed)

---

## Execution Priority

| Order | Track(s) | Justification |
|-------|----------|---------------|
| 1 | P22-A, P22-I | Root cause of active layout bugs + persistent auth bar position bug (parallel) |
| 2 | P22-E, P22-G | WCAG AA compliance — overlay contrast and focus/a11y fixes (parallel) |
| 3 | P22-F | Theme contrast fixes — requires per-theme audit with contrast calculations |
| 4 | P22-B | Logo rendering — small, self-contained, no dependencies |
| 5 | P22-C, P22-D | Refactoring — maintainability improvements (parallel, in same files as earlier tracks) |
| 6 | P22-H | Light themes — builds on contrast baseline from P22-F |

---

## Testing Strategy

### Automated
- **Unit tests:** Run full suite (`npx vitest run`) — all existing tests must pass
- **E2E smoke:** `npx playwright test e2e/smoke.spec.ts`
- **Type check:** `npx tsc --noEmit`

### Visual Verification
- **P22-A:** Test with `cardMaxWidth` set to 200, 300, 400, and 0. Verify spacing, centering, and aspect ratio in each case. Test with 1, 2, 3, 5, and 7 campaigns to verify partial-row centering.
- **P22-B:** Verify logo rendering with mock emoji data and a test URL string
- **P22-E:** Verify overlay appearance on light images, dark images, and mixed-content galleries
- **P22-F:** For each of the 15 themes, check textMuted2 text is readable on surface backgrounds
- **P22-G:** Keyboard-only navigation through admin panel; screen reader announcement of stats section and empty media
- **P22-H:** Apply new themes, verify all component rendering
- **P22-I:** Fresh load (no localStorage) — icon at bottom-right. Resize window smaller — icon re-clamps. Drag + reload — position persists.

### Contrast Auditing
- Use browser DevTools Accessibility panel or axe DevTools extension
- Check computed contrast ratios for textMuted, textMuted2, and dimmed colors per theme
- Target: all text ≥ 4.5:1 on normal text, ≥ 3:1 on large text (18pt+) and UI components

---

## Modified File Inventory

| File | Tracks | Changes |
|------|--------|---------|
| `src/components/Gallery/CampaignCard.tsx` | A, B | maxWidth prop, width:100%, logo component |
| `src/components/Gallery/CardGallery.tsx` | A, D, G | Conditional flex/grid, useMediaQuery, Load More a11y |
| `src/components/Campaign/CampaignViewer.tsx` | B, C, G | Logo component, IIFE refactor, close button, stats role, empty media |
| `src/components/Admin/AdminPanel.tsx` | G | Focus indicator fix |
| `src/components/Admin/LayoutBuilder/BuilderHistoryPanel.tsx` | G | Icon opacity |
| `src/components/Admin/LayoutBuilder/LayoutSlotComponent.tsx` | G | user-select, mask opacity |
| `src/gallery-adapters/justified/JustifiedGallery.tsx` | E | Overlay constants |
| `src/gallery-adapters/compact-grid/CompactGridGallery.tsx` | E | Overlay constants |
| `src/gallery-adapters/masonry/MasonryGallery.tsx` | E | Overlay constants |
| `src/gallery-adapters/hexagonal/HexagonalGallery.tsx` | E | Overlay constants |
| `src/gallery-adapters/circular/CircularGallery.tsx` | E | Overlay constants |
| `src/themes/definitions/*.json` | F | textMuted2 contrast adjustments |
| `src/themes/adapter.ts` | F | Dimmed color overrides |
| `src/themes/index.ts` | H | Register new themes |
| New: `src/components/shared/CompanyLogo.tsx` | B | Logo auto-detection component |
| New: `src/gallery-adapters/_shared/overlayStyles.ts` | E | Shared overlay constants |
| New: `src/themes/definitions/github-light.json` | H | GitHub Light theme |
| New: `src/themes/definitions/catppuccin-latte.json` | H | Catppuccin Latte theme |
| `src/components/Auth/AuthBarFloating.tsx` | I | Deferred position init, null guard, resize re-clamping |
| `src/gallery-adapters/diamond/DiamondGallery.tsx` | E | Overlay constants (discovered during implementation) |

---

## Implementation Summary

All 9 tracks implemented and verified.

### Key Decisions During Implementation

- **G-1 (AdminPanel focus):** Skipped — element uses `tabIndex={-1}` (programmatic focus only, not tab-reachable), so `outline: none` is acceptable per WCAG 2.4.7.
- **P22-E scope expansion:** Diamond adapter (`DiamondGallery.tsx`) was discovered to also use hardcoded overlay colors and was added to the scope (6 adapters total, not 5 as originally planned).
- **P22-F textMuted2 values:** Computed minimum-change compliant hex values that preserve each theme's color hue while achieving ≥4.5:1 contrast ratio against both `surface` and `background` colors. High-contrast theme was already compliant and left unchanged.
- **P22-H theme contrast:** New themes (`github-light`, `catppuccin-latte`) were created with WCAG-compliant `textMuted2` values from the start.

### Tests
- All unit tests pass (`npm run test:silent`)
- Production build succeeds (`npm run build:wp`)
- Type check passes (`tsc -b`)
