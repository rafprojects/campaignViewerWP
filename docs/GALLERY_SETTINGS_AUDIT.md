# Gallery Settings Audit

> **Generated:** Phase 20 · Production Readiness  
> **Settings Type:** `GalleryBehaviorSettings` in `src/types/index.ts`  
> **Default Values:** `DEFAULT_GALLERY_BEHAVIOR_SETTINGS`

This document is the authoritative reference for every configurable gallery
setting. Settings are persisted as a single JSON object via the
`wpsg_gallery_settings` WP option (REST endpoint: `PUT /wp-json/wpsg/v1/settings`).

---

## Table of Contents

- [Gallery Settings Audit](#gallery-settings-audit)
  - [Table of Contents](#table-of-contents)
  - [1. General / Core Viewport](#1-general--core-viewport)
  - [2. Scroll \& Transition Animation](#2-scroll--transition-animation)
  - [3. Thumbnail Strip (P12-A/B)](#3-thumbnail-strip-p12-ab)
  - [4. Gallery Adapter / Selection (P12-C)](#4-gallery-adapter--selection-p12-c)
  - [5. Tile Appearance](#5-tile-appearance)
  - [6. Navigation Overlay Arrows (P12-H)](#6-navigation-overlay-arrows-p12-h)
  - [7. Dot Navigator (P12-I)](#7-dot-navigator-p12-i)
  - [8. Shadow \& Depth (P12-J)](#8-shadow--depth-p12-j)
  - [9. Viewport Backgrounds](#9-viewport-backgrounds)
  - [10. Campaign Cards (P13-A)](#10-campaign-cards-p13-a)
  - [11. Card Pagination (P13-F)](#11-card-pagination-p13-f)
  - [12. Header Visibility \& App Layout (P13-E)](#12-header-visibility--app-layout-p13-e)
  - [13. Thumbnail Cache \& Optimization (P14)](#13-thumbnail-cache--optimization-p14)
  - [14. Advanced Settings Toggle](#14-advanced-settings-toggle)
  - [15. Card Appearance – Advanced (P14-B)](#15-card-appearance--advanced-p14-b)
  - [16. Gallery Text – Advanced (P14-B)](#16-gallery-text--advanced-p14-b)
  - [17. Modal / Viewer – Advanced (P14-B)](#17-modal--viewer--advanced-p14-b)
  - [18. Upload / Media – Advanced (P14-B)](#18-upload--media--advanced-p14-b)
  - [19. Tile / Adapter – Advanced (P14-B)](#19-tile--adapter--advanced-p14-b)
  - [20. Lightbox – Advanced (P14-B)](#20-lightbox--advanced-p14-b)
  - [21. Navigation – Advanced (P14-B)](#21-navigation--advanced-p14-b)
  - [22. System – Advanced (P14-B)](#22-system--advanced-p14-b)
  - [23. Session / Idle Timeout (P20-K)](#23-session--idle-timeout-p20-k)
  - [24. Per-Breakpoint Gallery Selection (P15-A)](#24-per-breakpoint-gallery-selection-p15-a)
  - [Related Types \& Enums](#related-types--enums)
  - [Breakpoint Thresholds](#breakpoint-thresholds)
  - [Layout Template Settings](#layout-template-settings)
  - [Addendum: Gallery Adapter Assignment — Complete Reference](#addendum-gallery-adapter-assignment--complete-reference)
    - [A-1. Where Gallery Settings Live](#a-1-where-gallery-settings-live)
    - [A-2. The Three Resolution Layers (Highest → Lowest Priority)](#a-2-the-three-resolution-layers-highest--lowest-priority)
    - [A-3. Unified vs. Per-Type Rendering](#a-3-unified-vs-per-type-rendering)
    - [A-4. The `gallerySelectionMode` Toggle](#a-4-the-galleryselectionmode-toggle)
    - [A-5. Layout Builder Special Handling](#a-5-layout-builder-special-handling)
    - [A-6. Breakpoint Detection](#a-6-breakpoint-detection)
    - [A-7. Per-Campaign vs. Per-Settings — What Overrides What](#a-7-per-campaign-vs-per-settings--what-overrides-what)
    - [A-8. Available Adapter IDs](#a-8-available-adapter-ids)
    - [A-9. Settings Panel UI Behaviour Summary](#a-9-settings-panel-ui-behaviour-summary)

---

## 1. General / Core Viewport

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `imageViewportHeight` | `number` | `420` | Height in px for the image viewport area. |
| `videoViewportHeight` | `number` | `420` | Height in px for the video viewport/player area. |
| `imageBorderRadius` | `number` | `8` | Border radius in px for images in the viewport. |
| `videoBorderRadius` | `number` | `8` | Border radius in px for videos in the viewport. |
| `transitionFadeEnabled` | `boolean` | `true` | Whether cross-fade transitions are enabled when switching media. |

---

## 2. Scroll & Transition Animation

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `thumbnailScrollSpeed` | `number` | `1` | Speed multiplier for thumbnail strip scrolling. |
| `scrollAnimationStyle` | `ScrollAnimationStyle` | `'smooth'` | Smooth or instant scroll. |
| `scrollAnimationDurationMs` | `number` | `350` | Duration in ms for scroll animations. |
| `scrollAnimationEasing` | `ScrollAnimationEasing` | `'ease'` | CSS timing function for scroll. |
| `scrollTransitionType` | `ScrollTransitionType` | `'slide-fade'` | Transition type when switching between items. |

---

## 3. Thumbnail Strip (P12-A/B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `videoThumbnailWidth` | `number` | `60` | Width in px of video thumbnails. |
| `videoThumbnailHeight` | `number` | `45` | Height in px of video thumbnails. |
| `imageThumbnailWidth` | `number` | `60` | Width in px of image thumbnails. |
| `imageThumbnailHeight` | `number` | `60` | Height in px of image thumbnails. |
| `thumbnailGap` | `number` | `6` | Gap in px between thumbnails. |
| `thumbnailWheelScrollEnabled` | `boolean` | `true` | Allow mouse-wheel scrolling on thumbnail strip. |
| `thumbnailDragScrollEnabled` | `boolean` | `true` | Allow click-drag scrolling on thumbnail strip. |
| `thumbnailScrollButtonsVisible` | `boolean` | `false` | Show left/right scroll buttons on strip. |

---

## 4. Gallery Adapter / Selection (P12-C)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `imageGalleryAdapterId` | `string` | `'classic'` | Adapter ID for images (e.g. `classic`, `compact-grid`, `justified`, `masonry`, `hexagonal`, `circular`, `diamond`, `layout-builder`). |
| `videoGalleryAdapterId` | `string` | `'classic'` | Adapter ID for videos. |
| `unifiedGalleryEnabled` | `boolean` | `false` | Combine images and videos in a single gallery. |
| `unifiedGalleryAdapterId` | `string` | `'compact-grid'` | Adapter used in unified mode. |
| `gridCardWidth` | `number` | `160` | Card width in px for compact-grid adapter. |
| `gridCardHeight` | `number` | `224` | Card height in px for compact-grid adapter. |
| `mosaicTargetRowHeight` | `number` | `200` | Target row height in px for justified adapter. |

---

## 5. Tile Appearance

Shared by masonry, justified, hexagonal, circular, and diamond adapters.

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `tileSize` | `number` | `150` | Fixed tile size in px for shape adapters. |
| `tileGapX` | `number` | `8` | Horizontal gap between tiles. |
| `tileGapY` | `number` | `8` | Vertical gap between tiles. |
| `tileBorderWidth` | `number` | `0` | Border width on tiles (0 = none). |
| `tileBorderColor` | `string` | `'#ffffff'` | CSS color for tile borders. |
| `tileGlowEnabled` | `boolean` | `false` | Enable hover glow (drop-shadow) on tiles. |
| `tileGlowColor` | `string` | `'#7c9ef8'` | CSS color of the glow. |
| `tileGlowSpread` | `number` | `12` | Spread radius in px of the glow. |
| `tileHoverBounce` | `boolean` | `true` | Scale-up bounce effect on tile hover. |
| `masonryColumns` | `number` | `0` | Column count for masonry (0 = auto). |

---

## 6. Navigation Overlay Arrows (P12-H)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `navArrowPosition` | `NavArrowPosition` | `'center'` | Vertical position of nav arrows. |
| `navArrowSize` | `number` | `36` | Icon size in px. |
| `navArrowColor` | `string` | `'#ffffff'` | Arrow icon color. |
| `navArrowBgColor` | `string` | `'rgba(0,0,0,0.45)'` | Button background color. |
| `navArrowBorderWidth` | `number` | `0` | Button border width. |
| `navArrowHoverScale` | `number` | `1.1` | Scale on arrow hover. |
| `navArrowAutoHideMs` | `number` | `0` | Auto-hide delay (0 = always visible). |

---

## 7. Dot Navigator (P12-I)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `dotNavEnabled` | `boolean` | `true` | Show dot indicators. |
| `dotNavPosition` | `DotNavPosition` | `'below'` | Position relative to viewport. |
| `dotNavSize` | `number` | `10` | Dot size in px. |
| `dotNavActiveColor` | `string` | `'var(--wpsg-color-primary)'` | Active dot color. |
| `dotNavInactiveColor` | `string` | `'rgba(128,128,128,0.4)'` | Inactive dot color. |
| `dotNavShape` | `DotNavShape` | `'circle'` | Dot shape. |
| `dotNavSpacing` | `number` | `6` | Gap between dots. |
| `dotNavActiveScale` | `number` | `1.3` | Scale of the active dot. |

---

## 8. Shadow & Depth (P12-J)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `imageShadowPreset` | `ShadowPreset` | `'subtle'` | Box-shadow preset for images. |
| `videoShadowPreset` | `ShadowPreset` | `'subtle'` | Box-shadow preset for videos. |
| `imageShadowCustom` | `string` | `'0 2px 8px rgba(0,0,0,0.15)'` | Custom shadow CSS (when preset = `custom`). |
| `videoShadowCustom` | `string` | `'0 2px 8px rgba(0,0,0,0.15)'` | Custom shadow CSS (when preset = `custom`). |

---

## 9. Viewport Backgrounds

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `imageBgType` | `ViewportBgType` | `'none'` | Background type for image viewport. |
| `imageBgColor` | `string` | `'#1a1a2e'` | Solid color. |
| `imageBgGradient` | `string` | `'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)'` | CSS gradient. |
| `imageBgImageUrl` | `string` | `''` | Background image URL. |
| `videoBgType` | `ViewportBgType` | `'none'` | Background type for video viewport. |
| `videoBgColor` | `string` | `'#0d0d0d'` | Solid color. |
| `videoBgGradient` | `string` | `'linear-gradient(135deg, #0d0d0d 0%, #1a1a2e 100%)'` | CSS gradient. |
| `videoBgImageUrl` | `string` | `''` | Background image URL. |
| `unifiedBgType` | `ViewportBgType` | `'none'` | Background type for unified viewport. |
| `unifiedBgColor` | `string` | `'#1a1a2e'` | Solid color. |
| `unifiedBgGradient` | `string` | `'linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)'` | CSS gradient. |
| `unifiedBgImageUrl` | `string` | `''` | Background image URL. |

---

## 10. Campaign Cards (P13-A)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cardBorderRadius` | `number` | `8` | Card border radius in px. |
| `cardBorderWidth` | `number` | `4` | Card border width in px. |
| `cardBorderMode` | `'single' \| 'auto' \| 'individual'` | `'auto'` | Border color mode. |
| `cardBorderColor` | `string` | `'#228be6'` | Border color (single mode). |
| `cardShadowPreset` | `string` | `'subtle'` | Card shadow preset. |
| `cardThumbnailHeight` | `number` | `200` | Thumbnail area height in px. |
| `cardThumbnailFit` | `string` | `'cover'` | CSS object-fit for card thumbnails. |
| `cardGridColumns` | `number` | `0` | Grid column count (0 = auto). |
| `cardGap` | `number` | `16` | Gap between cards in px. |
| `modalCoverHeight` | `number` | `240` | Modal cover image height in px. |
| `modalTransition` | `string` | `'pop'` | Modal open/close transition style. |
| `modalTransitionDuration` | `number` | `300` | Transition duration in ms. |
| `modalMaxHeight` | `number` | `90` | Max modal height as vh %. |

---

## 11. Card Pagination (P13-F)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cardDisplayMode` | `'show-all' \| 'load-more' \| 'paginated'` | `'load-more'` | Card gallery pagination mode. |
| `cardRowsPerPage` | `number` | `3` | Rows visible per page. |
| `cardPageDotNav` | `boolean` | `false` | Show page dot navigation. |
| `cardPageTransitionMs` | `number` | `300` | Page transition duration in ms. |

---

## 12. Header Visibility & App Layout (P13-E)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `showGalleryTitle` | `boolean` | `true` | Show gallery title heading. |
| `showGallerySubtitle` | `boolean` | `true` | Show gallery subtitle. |
| `showAccessMode` | `boolean` | `true` | Show access mode indicator. |
| `showFilterTabs` | `boolean` | `true` | Show All/Video/Image filter tabs. |
| `showSearchBox` | `boolean` | `true` | Show search input. |
| `appMaxWidth` | `number` | `1200` | App container max width (0 = full width). |
| `appPadding` | `number` | `16` | Horizontal padding in px. |
| `wpFullBleedDesktop` | `boolean` | `false` | Break out of WP container at ≥1024px. |
| `wpFullBleedTablet` | `boolean` | `false` | Break out at 768–1023px. |
| `wpFullBleedMobile` | `boolean` | `false` | Break out at <768px. |
| `imageTileSize` | `number` | `150` | Per-gallery tile size for images. |
| `videoTileSize` | `number` | `150` | Per-gallery tile size for videos. |

---

## 13. Thumbnail Cache & Optimization (P14)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `thumbnailCacheTtl` | `number` | `86400` | Cache TTL in seconds (24h). |
| `optimizeOnUpload` | `boolean` | `false` | Auto-optimize images on upload. |
| `optimizeMaxWidth` | `number` | `1920` | Max optimization width. |
| `optimizeMaxHeight` | `number` | `1920` | Max optimization height. |
| `optimizeQuality` | `number` | `82` | JPEG/WebP quality (0–100). |
| `optimizeWebpEnabled` | `boolean` | `false` | Convert to WebP on upload. |

---

## 14. Advanced Settings Toggle

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `advancedSettingsEnabled` | `boolean` | `false` | Show advanced settings panels in admin. |

---

## 15. Card Appearance – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `cardLockedOpacity` | `number` | `0.5` | Opacity of locked cards. |
| `cardGradientStartOpacity` | `number` | `0.0` | Start opacity of card thumbnail gradient. |
| `cardGradientEndOpacity` | `number` | `0.85` | End opacity of card thumbnail gradient. |
| `cardLockIconSize` | `number` | `32` | Lock icon size in px. |
| `cardAccessIconSize` | `number` | `14` | Access badge icon size in px. |
| `cardBadgeOffsetY` | `number` | `8` | Vertical badge offset in px. |
| `cardCompanyBadgeMaxWidth` | `number` | `160` | Max width of company logo badge. |
| `cardThumbnailHoverTransitionMs` | `number` | `300` | Thumbnail hover transition in ms. |

---

## 16. Gallery Text – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `galleryTitleText` | `string` | `'Gallery'` | Gallery heading text. |
| `gallerySubtitleText` | `string` | `''` | Gallery subtitle (empty = hidden). |
| `campaignAboutHeadingText` | `string` | `'About'` | Campaign description heading. |

---

## 17. Modal / Viewer – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `modalCoverMobileRatio` | `number` | `0.6` | Cover height multiplier on mobile. |
| `modalCoverTabletRatio` | `number` | `0.75` | Cover height multiplier on tablet. |
| `modalCloseButtonSize` | `number` | `36` | Close button size in px. |
| `modalCloseButtonBgColor` | `string` | `'rgba(0,0,0,0.5)'` | Close button background. |
| `modalContentMaxWidth` | `number` | `900` | Content max width in modal. |
| `campaignDescriptionLineHeight` | `number` | `1.6` | CSS line-height for descriptions. |
| `modalMobileBreakpoint` | `number` | `768` | Mobile breakpoint for modal layout. |
| `cardPageTransitionOpacity` | `number` | `0.3` | Page transition fade opacity. |

---

## 18. Upload / Media – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `uploadMaxSizeMb` | `number` | `50` | Max file upload size in MB. |
| `uploadAllowedTypes` | `string` | `'image/*,video/*'` | Allowed MIME patterns. |
| `libraryPageSize` | `number` | `20` | Items per page in media library. |
| `mediaListPageSize` | `number` | `50` | Items per page in media list. |
| `mediaCompactCardHeight` | `number` | `100` | Compact card height in px. |
| `mediaSmallCardHeight` | `number` | `80` | Small card height in px. |
| `mediaMediumCardHeight` | `number` | `240` | Medium card height in px. |
| `mediaLargeCardHeight` | `number` | `340` | Large card height in px. |
| `mediaListMinWidth` | `number` | `600` | Threshold for compact media list. |
| `swrDedupingIntervalMs` | `number` | `5000` | SWR deduping interval. |
| `notificationDismissMs` | `number` | `4000` | Toast auto-dismiss delay. |

---

## 19. Tile / Adapter – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `tileHoverOverlayOpacity` | `number` | `0.6` | Hover overlay opacity on tiles. |
| `tileBounceScaleHover` | `number` | `1.08` | CSS scale on tile hover. |
| `tileBounceScaleActive` | `number` | `1.02` | CSS scale on tile click. |
| `tileBounceDurationMs` | `number` | `300` | Bounce animation duration. |
| `tileBaseTransitionDurationMs` | `number` | `250` | Base CSS transition duration. |
| `hexVerticalOverlapRatio` | `number` | `0.25` | Hex row overlap ratio. |
| `diamondVerticalOverlapRatio` | `number` | `0.45` | Diamond row overlap ratio. |
| `hexClipPath` | `string` | `'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'` | Hex clip-path. |
| `diamondClipPath` | `string` | `'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'` | Diamond clip-path. |
| `tileDefaultPerRow` | `number` | `5` | Default tiles per row. |
| `photoNormalizeHeight` | `number` | `300` | Normalized photo height for justified layout. |
| `masonryAutoColumnBreakpoints` | `string` | `'480:2,768:3,1024:4,1280:5'` | Masonry responsive breakpoints. |
| `gridCardHoverShadow` | `string` | `'0 4px 12px rgba(0,0,0,0.3)'` | Grid card hover shadow. |
| `gridCardDefaultShadow` | `string` | `'0 2px 8px rgba(0,0,0,0.15)'` | Grid card default shadow. |
| `gridCardHoverScale` | `number` | `1.02` | Grid card hover scale. |
| `tileTransitionDurationMs` | `number` | `200` | Tile transition duration. |

---

## 20. Lightbox – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `lightboxTransitionMs` | `number` | `250` | Open/close transition in ms. |
| `lightboxBackdropColor` | `string` | `'rgba(0,0,0,0.92)'` | Backdrop color. |
| `lightboxEntryScale` | `number` | `0.92` | Entry animation start scale. |
| `lightboxVideoMaxWidth` | `number` | `900` | Max video width in lightbox. |
| `lightboxVideoHeight` | `number` | `506` | Video height in lightbox. |
| `lightboxMediaMaxHeight` | `string` | `'85vh'` | Max media height CSS value. |
| `lightboxZIndex` | `number` | `1000` | Lightbox z-index. |

---

## 21. Navigation – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `dotNavMaxVisibleDots` | `number` | `7` | Max visible dots before truncation. |
| `navArrowEdgeInset` | `number` | `8` | Arrow inset from viewport edge. |
| `navArrowMinHitTarget` | `number` | `44` | Min arrow hit-target size (a11y). |
| `navArrowFadeDurationMs` | `number` | `200` | Arrow fade-in/out duration. |
| `navArrowScaleTransitionMs` | `number` | `150` | Arrow hover-scale transition. |
| `viewportHeightMobileRatio` | `number` | `0.65` | Viewport height multiplier on mobile. |
| `viewportHeightTabletRatio` | `number` | `0.8` | Viewport height multiplier on tablet. |
| `searchInputMinWidth` | `number` | `200` | Search input min width. |
| `searchInputMaxWidth` | `number` | `280` | Search input max width. |

---

## 22. System – Advanced (P14-B)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `expiryWarningThresholdMs` | `number` | `300000` | Token expiry warning threshold (5 min). |
| `adminSearchDebounceMs` | `number` | `300` | Admin search debounce delay. |
| `loginMinPasswordLength` | `number` | `1` | Login form min password length. |
| `loginFormMaxWidth` | `number` | `400` | Login form max width. |
| `authBarBackdropBlur` | `number` | `8` | Auth bar backdrop blur in px. |
| `authBarMobileBreakpoint` | `number` | `768` | Auth bar mobile breakpoint. |
| `cardAutoColumnsBreakpoints` | `string` | `'480:1,768:2,1024:3,1280:4'` | Card grid responsive breakpoints. |

---

## 23. Session / Idle Timeout (P20-K)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sessionIdleTimeoutMinutes` | `number` | `0` | Idle timeout in minutes (0 = disabled). |

---

## 24. Per-Breakpoint Gallery Selection (P15-A)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `gallerySelectionMode` | `'unified' \| 'per-breakpoint'` | `'unified'` | Global or per-breakpoint adapter. |
| `desktopImageAdapterId` | `string` | `'classic'` | Desktop image adapter. |
| `desktopVideoAdapterId` | `string` | `'classic'` | Desktop video adapter. |
| `tabletImageAdapterId` | `string` | `'classic'` | Tablet image adapter. |
| `tabletVideoAdapterId` | `string` | `'classic'` | Tablet video adapter. |
| `mobileImageAdapterId` | `string` | `'classic'` | Mobile image adapter. |
| `mobileVideoAdapterId` | `string` | `'classic'` | Mobile video adapter. |
| `layoutBuilderScope` | `'full' \| 'viewport'` | `'full'` | Layout builder replaces full gallery or viewport only. |

**Note:** `layout-builder` is disabled on mobile at runtime — `resolveAdapterId()`
falls back to the unified adapter or `'classic'` when the breakpoint is `'mobile'`.

---

## Related Types & Enums

| Type | Values | Used by |
|------|--------|---------|
| `ScrollAnimationStyle` | `'smooth' \| 'instant'` | `scrollAnimationStyle` |
| `ScrollAnimationEasing` | `'ease' \| 'linear' \| 'ease-in' \| 'ease-out' \| 'ease-in-out'` | `scrollAnimationEasing` |
| `ScrollTransitionType` | `'fade' \| 'slide' \| 'slide-fade'` | `scrollTransitionType` |
| `NavArrowPosition` | `'top' \| 'center' \| 'bottom'` | `navArrowPosition` |
| `DotNavPosition` | `'below' \| 'overlay-bottom' \| 'overlay-top'` | `dotNavPosition` |
| `DotNavShape` | `'circle' \| 'pill' \| 'square'` | `dotNavShape` |
| `ShadowPreset` | `'none' \| 'subtle' \| 'medium' \| 'strong' \| 'custom'` | `imageShadowPreset`, `videoShadowPreset` |
| `ViewportBgType` | `'none' \| 'solid' \| 'gradient' \| 'image'` | `imageBgType`, `videoBgType`, `unifiedBgType` |
| `Breakpoint` | `'desktop' \| 'tablet' \| 'mobile'` | `useBreakpoint`, `resolveAdapterId` |

---

## Breakpoint Thresholds

| Breakpoint | Condition | Mantine token | Fallback |
|------------|-----------|---------------|----------|
| `mobile` | `width < sm` | `48em` | 768px |
| `tablet` | `sm ≤ width < lg` | `75em` | 1200px |
| `desktop` | `width ≥ lg` | — | — |

Breakpoints are based on **container width** (ResizeObserver) not viewport.

---

## Layout Template Settings

These are per-template, stored in `wpsg_layout_templates` option (not in `GalleryBehaviorSettings`):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `canvasAspectRatio` | `number` | `16/9` | Width-to-height ratio. |
| `canvasMinWidth` | `number` | `320` | Minimum render width in px. |
| `canvasMaxWidth` | `number` | `0` | Maximum render width (0 = fill container). |
| `canvasHeightMode` | `'aspect-ratio' \| 'fixed-vh'` | `'aspect-ratio'` | How canvas height is determined. |
| `canvasHeightVh` | `number` | `50` | Viewport-height percentage when mode is `fixed-vh`. |

Slot positions are stored as percentages (0–100) of the canvas dimensions.

---

## Addendum: Gallery Adapter Assignment — Complete Reference

This section explains, end-to-end, how the system decides which gallery adapter
renders for a given campaign, media type, and screen size. It covers the three
layers of configuration, the precedence rules between them, and the safety
guards that prevent unsupported combinations.

### A-1. Where Gallery Settings Live

| Store | WP option / meta | Scope | Managed via |
|-------|------------------|-------|-------------|
| **Global gallery settings** | `wpsg_gallery_settings` (single JSON object) | Site-wide | Admin → Settings Panel |
| **Per-campaign overrides** | `wpsg_campaign` post meta on the campaign CPT | Individual campaign | Admin → Campaign Form Modal ("Layout Template" + future per-campaign adapter dropdowns) |
| **Layout templates** | `wpsg_layout_templates` (single JSON object containing all templates) | Site-wide (templates are shared) | Admin → Layout Builder |

All three are persisted via the WP REST API and sanitised server-side in
`class-wpsg-settings.php` and `class-wpsg-layout-templates.php`.

### A-2. The Three Resolution Layers (Highest → Lowest Priority)

When the `CampaignViewer` component renders a campaign, the adapter is resolved
through three layers. The first non-empty value wins:

**Layer 1 — Per-Campaign Override** (highest priority)

Each campaign object may carry optional `imageAdapterId` and `videoAdapterId`
fields. When set, these override everything else. The campaign's
`layoutTemplateId` tells the Layout Builder adapter which template to render.

In unified gallery mode, the campaign-level `imageAdapterId` doubles as the
unified adapter (since unified merges both media types).

**Layer 2 — Per-Breakpoint Settings** (active when `gallerySelectionMode === 'per-breakpoint'`)

When the admin chooses "Per Breakpoint" mode in Settings → Media Gallery, six
individual adapter fields become active:

| Field | Breakpoint | Media |
|-------|-----------|-------|
| `desktopImageAdapterId` | Desktop (≥ 1200 px) | Images |
| `desktopVideoAdapterId` | Desktop | Videos |
| `tabletImageAdapterId` | Tablet (768–1199 px) | Images |
| `tabletVideoAdapterId` | Tablet | Videos |
| `mobileImageAdapterId` | Mobile (< 768 px) | Images |
| `mobileVideoAdapterId` | Mobile | Videos |

The `resolveAdapterId()` function constructs a dynamic key from the breakpoint
and media type (e.g. `tabletVideoAdapterId`) and reads the value from settings.
If that per-breakpoint field is empty or falsy, it falls back to Layer 3.

**Layer 3 — Unified Settings** (fallback / default)

Two global adapter fields serve as the baseline:

| Field | Media | Default |
|-------|-------|---------|
| `imageGalleryAdapterId` | Images | `'classic'` |
| `videoGalleryAdapterId` | Videos | `'classic'` |

In unified gallery mode (`unifiedGalleryEnabled: true`), these are ignored in
favour of `unifiedGalleryAdapterId` (default `'compact-grid'`).

### A-3. Unified vs. Per-Type Rendering

| `unifiedGalleryEnabled` | Behaviour |
|--------------------------|-----------|
| `true` | Images and videos are merged into a single sorted array. One adapter renders everything. The adapter is chosen from `unifiedGalleryAdapterId` (or the campaign-level `imageAdapterId` override). |
| `false` (default) | Videos and images are rendered separately in two independent adapter instances. Each resolves its own adapter via the layer stack above. |

### A-4. The `gallerySelectionMode` Toggle

This is the master switch that controls whether Layer 2 (per-breakpoint) is
consulted at all.

| Mode | Behaviour |
|------|-----------|
| `'unified'` | Resolution skips Layer 2 entirely and falls straight to Layer 3 (the two global adapter fields). All breakpoints get the same adapter. |
| `'per-breakpoint'` | Resolution reads the six per-breakpoint fields. Each breakpoint × media-type combination can have a different adapter. Empty per-breakpoint fields fall back to the unified (Layer 3) value. |

### A-5. Layout Builder Special Handling

Layout Builder (`'layout-builder'`) is a non-standard adapter with additional
constraints and behaviours:

**Auto-switch to Per-Breakpoint**

When a user selects "Layout Builder" from a **unified-mode** dropdown in the
Settings Panel, the UI automatically:

1. Switches `gallerySelectionMode` to `'per-breakpoint'`.
2. Sets desktop + tablet adapters to `'layout-builder'`.
3. Sets the mobile adapter to whatever the previous adapter was (or `'classic'`).

This prevents Layout Builder from being silently applied on mobile where it is
not supported.

**Mobile Disabled (UI)**

In per-breakpoint mode, the Layout Builder option on the mobile row is rendered
as a greyed-out disabled item labelled "Layout Builder (desktop/tablet only)".
The admin cannot select it.

**Mobile Guard (Runtime)**

Even if settings data somehow ends up with `mobileImageAdapterId: 'layout-builder'`
(e.g. direct DB edit, old data migration), `resolveAdapterId()` contains a hard
guard:

```
if resolved_id is 'layout-builder' AND breakpoint is 'mobile':
  fall back to the unified adapter for that media type
  if that is also 'layout-builder', fall back to 'classic'
```

This ensures Layout Builder can never render on mobile.

**Layout Builder Scope**

The `layoutBuilderScope` setting (`'full'` or `'viewport'`) controls whether
Layout Builder replaces the entire gallery chrome (header, thumbnails, etc.) or
only the main viewport area. Default is `'full'`.

**Template Binding**

Layout Builder requires a `layoutTemplateId` on the campaign. When that field
is empty, the adapter receives no template and falls into a loading/empty state.
Template IDs are assigned per-campaign in the Campaign Form Modal.

### A-6. Breakpoint Detection

Breakpoints are determined by **container width**, not viewport width. This is
important for embedded galleries that may sit in a narrow sidebar.

The `useBreakpoint(containerRef)` hook uses a `ResizeObserver` on the gallery
container element. Thresholds are pulled from the Mantine theme:

| Breakpoint | Container Width | Mantine Token |
|------------|----------------|---------------|
| `mobile` | < 768 px | `theme.breakpoints.sm` (48em) |
| `tablet` | 768 – 1199 px | between `sm` and `lg` |
| `desktop` | ≥ 1200 px | `theme.breakpoints.lg` (75em) |

If Mantine breakpoints are unavailable (e.g. rendering outside a theme
provider), the hook falls back to hardcoded values of 768 / 1200 px.

The breakpoint value re-evaluates on every container resize (debounced by the
browser's `ResizeObserver` frame cycle). This means a user dragging the browser
window can see the gallery adapter swap live.

### A-7. Per-Campaign vs. Per-Settings — What Overrides What

Here is the full precedence chain for "which adapter renders for campaign X,
media type Y, at breakpoint Z":

```
1.  campaign.imageAdapterId  (or videoAdapterId)        — per-campaign override
      ↓ (if empty)
2.  settings[breakpoint + mediaType + 'AdapterId']      — per-breakpoint setting
      ↓ (if gallerySelectionMode != 'per-breakpoint', or field empty)
3.  settings.imageGalleryAdapterId (or video…)          — unified global setting
      ↓ (if unifiedGalleryEnabled)
3b. settings.unifiedGalleryAdapterId                    — unified mode override
      ↓ (after resolution)
4.  Mobile layout-builder guard                         — forces fallback
```

**Key scenarios:**

| Scenario | Result |
|----------|--------|
| Campaign has `imageAdapterId: 'masonry'`, settings say `'classic'` | Masonry wins (Layer 1). |
| Campaign has no adapter override, settings are per-breakpoint with desktop = `'layout-builder'`, viewed on tablet | Tablet's per-breakpoint adapter is used. If the tablet field is empty, falls back to the unified `imageGalleryAdapterId`. |
| Per-breakpoint mode, mobile = `'layout-builder'` (shouldn't happen) | Runtime guard converts to unified adapter or `'classic'`. |
| Unified gallery mode enabled, `unifiedGalleryAdapterId: 'justified'` | Everything renders through Justified adapter, one combined media list. |
| Per-breakpoint with only desktop set, tablet + mobile empty | Tablet and mobile fall back to the unified (Layer 3) adapter. |

### A-8. Available Adapter IDs

All adapter IDs are validated server-side against an allow-list:

| ID | Adapter | Notes |
|----|---------|-------|
| `classic` | Image/Video Carousel | Default. Two separate carousels. |
| `compact-grid` | Compact Grid | Card-based grid with hover. |
| `mosaic` | Mosaic / Tiles | Fixed-size tiles. |
| `justified` | Justified (Flickr-style) | Rows with equal height, variable width. |
| `masonry` | Masonry | Pinterest-style columns. |
| `hexagonal` | Hexagonal Grid | Hex clip-path tiles. |
| `circular` | Circular Grid | Circle clip-path tiles. |
| `diamond` | Diamond Grid | Diamond clip-path tiles. |
| `layout-builder` | Layout Builder | Freeform positioned slots. Desktop/tablet only. |

### A-9. Settings Panel UI Behaviour Summary

| Action | UI Response |
|--------|-------------|
| Toggle "Unified / Per Breakpoint" | Shows either 2 dropdowns (unified) or a 3×2 grid (per-breakpoint). |
| Select Layout Builder in unified mode | Auto-switches to per-breakpoint. Sets desktop + tablet to layout-builder, mobile to previous adapter. |
| Select Layout Builder on mobile row | Blocked — option is disabled in the dropdown. |
| Change `gallerySelectionMode` back to unified when per-breakpoint values exist | Per-breakpoint values are preserved in settings (not cleared), but Layer 2 is skipped at render time. Switching back to per-breakpoint restores them. |
| Set `unifiedGalleryEnabled` to true | Adapter selection still applies; the difference is media merging, not adapter resolution. |
