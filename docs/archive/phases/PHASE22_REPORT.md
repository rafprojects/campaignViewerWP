# Phase 22 — Layout Fixes, Theme Contrast & WCAG AA Compliance
**Status:** In Progress 🚧 (P22-A–J complete, K implemented, L1–L6 complete, M partially implemented, N complete, O in progress)
**Version:** v0.21.0
**Created:** March 19, 2026
**Last updated:** March 22, 2026

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
| P22-J | CardGallery column & gap QA fix | Complete ✅ | Small (~30 min) |
| P22-K1 | Gallery full-width in fullscreen/galleries-only | Complete ✅ | Small (30 min) |
| P22-K2 | modalMaxWidth setting for default modal | Complete ✅ | Small (1–2 hours) |
| P22-K3 | Fullscreen modal background settings | Complete ✅ | Low–Medium (2–3 hours) |
| P22-K4 | Mirror card distribution to CompactGrid adapter | Complete ✅ | Medium (2–3 hours) |
| P22-K5 | Move admin actions into AuthBar | Complete ✅ | Medium (3–4 hours) |
| P22-L1 | Font loading resilience & error handling | Complete ✅ | Small (1–2 hours) |
| P22-L2 | Grouped font picker + expanded Google Fonts list | Complete ✅ | Medium (2–3 hours) |
| P22-L3 | Font fallback chain picker | Complete ✅ | Medium (2–3 hours) |
| P22-L4 | PHP server-side Google Fonts enqueueing | Complete ✅ | Small (1–2 hours) |
| P22-L5 | Custom font upload infrastructure (PHP) | Complete ✅ | Medium (3–4 hours) |
| P22-L6 | Custom font upload UI + font picker integration | Complete ✅ | Medium (3–4 hours) |
| P22-L7 | Font system end-to-end manual QA | Planned 📋 | Small (1–2 hours) |
| P22-M1 | Gallery responsive height fix | Complete ✅ | Small (1–2 hours) |
| P22-M2 | Gallery height constraint control | In Progress 🚧 | Medium (3–4 hours) |
| P22-M3 | Viewport backgrounds: transparent option | Planned 📋 | Small (<1 hour) |
| P22-M4 | Campaign Viewer settings → own tab | Planned 📋 | Small (1–2 hours) |
| P22-M5 | Galleries-only conditional disabling | Planned 📋 | Small (~1 hour) |
| P22-M6 | Advanced settings audit & reorganization | Planned 📋 | Small (1–2 hours) |
| P22-M7 | Justified gallery oversizing fix | Complete ✅ | Small (<1 hour) |
| P22-M8 | Google Font URL specification fix | Complete ✅ | Medium (2–3 hours) |
| P22-N | Fullscreen gallery sizing semantics & width propagation | Complete ✅ | Medium (2–4 hours) |
| P22-O | Responsive layout controls & breakpoint-aware settings | In Progress 🚧 | Medium-Large (4–8 hours) |

---

## Table of Contents

- [Phase 22 — Layout Fixes, Theme Contrast \& WCAG AA Compliance](#phase-22--layout-fixes-theme-contrast--wcag-aa-compliance)
    - [Tracks](#tracks)
  - [Table of Contents](#table-of-contents)
  - [Rationale](#rationale)
  - [Key Decisions (Pre-Resolved)](#key-decisions-pre-resolved)
  - [Track P22-A — CardGallery cardMaxWidth Layout Fix](#track-p22-a--cardgallery-cardmaxwidth-layout-fix)
    - [Problem](#problem)
    - [Fix](#fix)
    - [Files to modify](#files-to-modify)
    - [Acceptance criteria](#acceptance-criteria)
  - [Track P22-B — Company Logo Auto-Detection](#track-p22-b--company-logo-auto-detection)
    - [Problem](#problem-1)
    - [Fix](#fix-1)
    - [Files to modify](#files-to-modify-1)
    - [Acceptance criteria](#acceptance-criteria-1)
  - [Track P22-C — CampaignViewer IIFE Refactor](#track-p22-c--campaignviewer-iife-refactor)
    - [Problem](#problem-2)
    - [Fix](#fix-2)
    - [Files to modify](#files-to-modify-2)
    - [Acceptance criteria](#acceptance-criteria-2)
  - [Track P22-D — Replace getEffectiveColumns with useMediaQuery](#track-p22-d--replace-geteffectivecolumns-with-usemediaquery)
    - [Problem](#problem-3)
    - [Fix](#fix-3)
    - [Files to modify](#files-to-modify-3)
    - [Acceptance criteria](#acceptance-criteria-3)
  - [Track P22-E — Gallery Overlay Contrast Hardening](#track-p22-e--gallery-overlay-contrast-hardening)
    - [Problem](#problem-4)
    - [Fix](#fix-4)
    - [Files to modify](#files-to-modify-4)
    - [Acceptance criteria](#acceptance-criteria-4)
  - [Track P22-F — Theme Contrast Fixes](#track-p22-f--theme-contrast-fixes)
    - [Problem — textMuted2 contrast](#problem--textmuted2-contrast)
    - [Problem — dimmed text audit](#problem--dimmed-text-audit)
    - [Fix — textMuted2](#fix--textmuted2)
    - [Fix — dimmed text](#fix--dimmed-text)
    - [Files to modify](#files-to-modify-5)
    - [Acceptance criteria](#acceptance-criteria-5)
  - [Track P22-G — WCAG AA Compliance Fixes](#track-p22-g--wcag-aa-compliance-fixes)
    - [G-1. AdminPanel focus indicator removal](#g-1-adminpanel-focus-indicator-removal)
    - [G-2. CampaignViewer close button contrast](#g-2-campaignviewer-close-button-contrast)
    - [G-3. BuilderHistoryPanel icon opacity](#g-3-builderhistorypanel-icon-opacity)
    - [G-4. Stats section semantic role](#g-4-stats-section-semantic-role)
    - [G-5. Empty media messaging](#g-5-empty-media-messaging)
    - [G-6. Load More button aria-label](#g-6-load-more-button-aria-label)
    - [G-7. LayoutBuilder user-select:none on text content](#g-7-layoutbuilder-user-selectnone-on-text-content)
    - [G-8. LayoutSlot mask layer opacity](#g-8-layoutslot-mask-layer-opacity)
    - [Files to modify](#files-to-modify-6)
    - [Acceptance criteria](#acceptance-criteria-6)
  - [Track P22-H — Light Theme Additions](#track-p22-h--light-theme-additions)
    - [Problem](#problem-5)
    - [Fix](#fix-5)
    - [Files to modify](#files-to-modify-7)
    - [Acceptance criteria](#acceptance-criteria-7)
  - [Track P22-I — Draggable Auth Bar Position Fix](#track-p22-i--draggable-auth-bar-position-fix)
    - [Problem](#problem-6)
    - [Fix](#fix-6)
    - [Files to modify](#files-to-modify-8)
    - [Acceptance criteria](#acceptance-criteria-8)
  - [Execution Priority](#execution-priority)
  - [Testing Strategy](#testing-strategy)
    - [Automated](#automated)
    - [Visual Verification](#visual-verification)
    - [Contrast Auditing](#contrast-auditing)
  - [Modified File Inventory](#modified-file-inventory)
  - [Implementation Summary](#implementation-summary)
    - [Key Decisions During Implementation](#key-decisions-during-implementation)
    - [Tests](#tests)
  - [Track P22-J — CardGallery Column \& Gap QA Fix](#track-p22-j--cardgallery-column--gap-qa-fix)
    - [Problem](#problem-7)
    - [Fix](#fix-7)
    - [Decisions](#decisions)
    - [Files to modify](#files-to-modify-9)
    - [Acceptance Criteria](#acceptance-criteria-9)
  - [Track P22-K1 — Gallery Full-Width in Fullscreen/Galleries-Only](#track-p22-k1--gallery-full-width-in-fullscreengalleries-only)
    - [Problem](#problem-8)
    - [Current State](#current-state)
    - [Fix](#fix-8)
    - [Files to modify](#files-to-modify-10)
    - [Acceptance Criteria](#acceptance-criteria-10)
  - [Track P22-K2 — modalMaxWidth Setting](#track-p22-k2--modalmaxwidth-setting)
    - [Problem](#problem-9)
    - [Current State](#current-state-1)
    - [Fix](#fix-9)
    - [Settings Pipeline](#settings-pipeline)
    - [Files to modify](#files-to-modify-11)
    - [Acceptance Criteria](#acceptance-criteria-11)
  - [Track P22-K3 — Fullscreen Modal Background](#track-p22-k3--fullscreen-modal-background)
    - [Problem](#problem-10)
    - [Current State](#current-state-2)
    - [Fix](#fix-10)
    - [Settings Pipeline](#settings-pipeline-1)
    - [Files to modify](#files-to-modify-12)
    - [Acceptance Criteria](#acceptance-criteria-12)
  - [Track P22-K4 — CompactGrid Distribution Mirroring](#track-p22-k4--compactgrid-distribution-mirroring)
    - [Problem](#problem-11)
    - [Current State](#current-state-3)
    - [Fix](#fix-11)
    - [Settings Pipeline](#settings-pipeline-2)
    - [Files to modify](#files-to-modify-13)
    - [Acceptance Criteria](#acceptance-criteria-13)
  - [Track P22-K5 — Admin Actions → AuthBar](#track-p22-k5--admin-actions--authbar)
    - [Problem](#problem-12)
    - [Current State](#current-state-4)
    - [Fix](#fix-12)
    - [Files to modify](#files-to-modify-14)
    - [Acceptance Criteria](#acceptance-criteria-14)
  - [Adapter Distribution Feasibility Assessment](#adapter-distribution-feasibility-assessment)
    - [Unified Strategy](#unified-strategy)
    - [Summary Table](#summary-table)
    - [Detailed Notes](#detailed-notes)
  - [Track P22-L1 — Font Loading Resilience](#track-p22-l1--font-loading-resilience)
    - [Problem](#problem-13)
    - [Fix](#fix-13)
    - [Files to modify](#files-to-modify-15)
    - [Acceptance Criteria](#acceptance-criteria-15)
    - [Implementation Result](#implementation-result)
  - [Track P22-L2 — Grouped Font Picker + Expanded Google Fonts](#track-p22-l2--grouped-font-picker--expanded-google-fonts)
    - [Problem](#problem-14)
    - [Fix](#fix-14)
    - [Files to modify](#files-to-modify-16)
    - [Acceptance Criteria](#acceptance-criteria-16)
    - [Implementation Result](#implementation-result-1)
  - [Track P22-L3 — Font Fallback Chain Picker](#track-p22-l3--font-fallback-chain-picker)
    - [Problem](#problem-15)
    - [Current State](#current-state-5)
    - [Fix](#fix-15)
    - [Files to modify](#files-to-modify-17)
    - [Acceptance Criteria](#acceptance-criteria-17)
    - [Implementation Result](#implementation-result-2)
  - [Track P22-L4 — PHP Server-Side Google Fonts Enqueueing](#track-p22-l4--php-server-side-google-fonts-enqueueing)
    - [Problem](#problem-16)
    - [Current State](#current-state-6)
    - [Fix](#fix-16)
    - [Files to modify](#files-to-modify-18)
    - [Acceptance Criteria](#acceptance-criteria-18)
    - [Implementation Result](#implementation-result-3)
  - [Track P22-L5 — Custom Font Upload Infrastructure (PHP)](#track-p22-l5--custom-font-upload-infrastructure-php)
    - [Problem](#problem-17)
    - [Architecture Decision](#architecture-decision)
    - [Fix](#fix-17)
    - [Files to modify](#files-to-modify-19)
    - [Acceptance Criteria](#acceptance-criteria-19)
    - [Implementation Result](#implementation-result-4)
  - [Track P22-L6 — Custom Font Upload UI](#track-p22-l6--custom-font-upload-ui)
    - [Problem](#problem-18)
    - [Fix](#fix-18)
    - [Files to modify](#files-to-modify-20)
    - [Acceptance Criteria](#acceptance-criteria-20)
    - [Implementation Result](#implementation-result-5)
  - [Track P22-L7 — Font System End-to-End QA](#track-p22-l7--font-system-end-to-end-qa)
    - [Purpose](#purpose)
    - [QA Scenarios](#qa-scenarios)
    - [Acceptance Criteria](#acceptance-criteria-21)
  - [Track P22-M — QA Fixes, Gallery Responsiveness \& Settings Reorg](#track-p22-m--qa-fixes-gallery-responsiveness--settings-reorg)
    - [Key Decisions (M-Track)](#key-decisions-m-track)
    - [Execution Order](#execution-order)
  - [Track P22-M1 — Gallery Responsive Height Fix](#track-p22-m1--gallery-responsive-height-fix)
    - [Original Problem](#original-problem)
    - [Current State](#current-state-7)
    - [Fix (Implemented)](#fix-implemented)
    - [Files to modify](#files-to-modify-21)
    - [Acceptance Criteria](#acceptance-criteria-22)
    - [Implementation Result](#implementation-result-6)
  - [Track P22-M2 — Gallery Height Constraint Control](#track-p22-m2--gallery-height-constraint-control)
    - [Problem](#problem-19)
    - [Current State](#current-state-8)
    - [Fix](#fix-19)
    - [Settings Pipeline](#settings-pipeline-3)
    - [Files to modify](#files-to-modify-22)
    - [Acceptance Criteria](#acceptance-criteria-23)
  - [Track P22-M3 — Viewport Backgrounds: Transparent Option](#track-p22-m3--viewport-backgrounds-transparent-option)
    - [Problem](#problem-20)
    - [Fix](#fix-20)
    - [Files to modify](#files-to-modify-23)
    - [Acceptance Criteria](#acceptance-criteria-24)
  - [Track P22-M4 — Campaign Viewer Settings → Own Tab](#track-p22-m4--campaign-viewer-settings--own-tab)
    - [Problem](#problem-21)
    - [Current State](#current-state-9)
    - [Fix](#fix-21)
    - [Files to modify](#files-to-modify-24)
    - [Acceptance Criteria](#acceptance-criteria-25)
  - [Track P22-M5 — Galleries-Only Conditional Disabling](#track-p22-m5--galleries-only-conditional-disabling)
    - [Problem](#problem-22)
    - [Current State](#current-state-10)
    - [Fix](#fix-22)
    - [Files to modify](#files-to-modify-25)
    - [Acceptance Criteria](#acceptance-criteria-26)
  - [Track P22-M6 — Advanced Settings Audit \& Reorganization](#track-p22-m6--advanced-settings-audit--reorganization)
    - [Problem](#problem-23)
    - [Current State](#current-state-11)
    - [Fix](#fix-23)
    - [Files to modify](#files-to-modify-26)
    - [Acceptance Criteria](#acceptance-criteria-27)
  - [Track P22-M7 — Justified Gallery Oversizing Fix](#track-p22-m7--justified-gallery-oversizing-fix)
    - [Original Problem](#original-problem-1)
    - [Current State](#current-state-12)
    - [Fix (Implemented)](#fix-implemented-1)
    - [Files to modify](#files-to-modify-27)
    - [Acceptance Criteria](#acceptance-criteria-28)
    - [Implementation Result](#implementation-result-7)
  - [Track P22-M8 — Google Font URL Specification Fix](#track-p22-m8--google-font-url-specification-fix)
    - [Problem](#problem-24)
    - [Fix (Implemented)](#fix-implemented-2)
    - [Files modified](#files-modified)
    - [Acceptance Criteria](#acceptance-criteria-29)
  - [Track P22-N — Fullscreen Gallery Sizing Semantics \& Width Propagation](#track-p22-n--fullscreen-gallery-sizing-semantics--width-propagation)
    - [Problem](#problem-25)
    - [Current State](#current-state-13)
    - [Fix](#fix-24)
    - [Files to modify](#files-to-modify-28)
    - [Acceptance Criteria](#acceptance-criteria-30)
    - [Decisions](#decisions-1)
  - [Track P22-O — Responsive Layout Controls \& Breakpoint-Aware Settings](#track-p22-o--responsive-layout-controls--breakpoint-aware-settings)
    - [Problem](#problem-26)
    - [Current State](#current-state-14)
    - [Fix](#fix-25)
    - [Files to modify](#files-to-modify-29)
    - [Acceptance Criteria](#acceptance-criteria-31)
    - [Decisions](#decisions-2)

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
| O | Gallery full-width mode | **Fullscreen/galleries-only only**: remove inner padding on content Box when `useFullscreen \|\| galleriesOnly`. Default modal keeps responsive padding (`base: md, md: xl`). |
| P | Admin actions location | **AuthBar only**: use a `CampaignContext` to share active campaign + callbacks between CampaignViewer and AuthBarFloating. Remove admin actions section from CampaignViewer. |
| Q | Mirror distribution scope | **CompactGrid now** using existing `cardMaxColumns`/`cardGridColumns` (no new setting). Other adapters assessed for future — see feasibility section. |
| R | modalMaxWidth default | **1200** (matches current Mantine `xl`). Value 0 also accepted as Mantine `xl`. Range: 0–3000. |
| S | Fullscreen bg options | **Match viewerBgType** (theme/transparent/solid/gradient). No image option. Named `modalBg*` (shorter, since bg only applies in fullscreen). |
| T | Gallery height responsiveness | **Replace `window.innerWidth` snap** with container-aware `useBreakpoint` hook. Height recalculates on container resize, not just on mount. |
| U | Gallery layout mode | **New `gallerySizingMode` dropdown** with Auto (content-driven) and Manual (explicit px dimensions). Auto uses content-driven height for image galleries, 16:9 aspect for video. |
| V | Manual mode width semantics | **px maxWidth** (0 = 100% full width). Consistent with existing `appMaxWidth` and `modalMaxWidth` patterns. |
| W | Unified gallery + Manual mode | **One set of controls** when unified is enabled (single container), two sets when separate. |
| X | Viewport bg transparent | **Rename label** from "None" to "Transparent" and apply `{ background: 'transparent' }` in `resolveViewportBg()`. |
| Y | Campaign Viewer settings tab | **Own top-level tab** in SettingsPanel alongside General, Cards, Media Gallery, Typography, Advanced. |
| Z | Galleries-only disabling | **Disable + dim** irrelevant toggles with `opacity: 0.4` + `pointerEvents: 'none'` + `disabled` prop when `campaignOpenMode === 'galleries-only'`. |
| AA | Justified singleRowMaxHeight | **Cap at `targetRowHeight * 1.5`** (from `* 2`). Simple, no separate setting. |

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
| 7 | P22-J | QA fix for P22-A flex layout — depends on P22-A committed |
| 8 | P22-K1, P22-K2, P22-K3 | Modal enhancements — settings + CampaignViewer changes (parallel) |
| 9 | P22-K4 | CompactGrid distribution — reuses maxCols pattern from P22-J |
| 10 | P22-K5 | Admin actions → AuthBar — state lifting, do last to avoid merge conflicts |

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
- **P22-J:** Test `cardMaxWidth=300` with `cardGridColumns=3` (3 per row), `cardMaxColumns=2` (max 2), and both 0 (default 4). Verify `cardGapH>48` works.
- **P22-K1:** Fullscreen/galleries-only mode — galleries extend to full content width. Default modal — retains padding.
- **P22-K2:** `modalMaxWidth=800` constrains default modal. Value 0 = Mantine xl. Fullscreen unaffected.
- **P22-K3:** Set fullscreen bg to solid/gradient — verify it renders. Default modal unaffected. Independent from viewerBgType.
- **P22-K4:** `gridMaxColumns=3` — CompactGrid shows max 3 tiles per row, centered. Value 0 = auto (current behavior).
- **P22-K5:** Open campaign + admin — AuthBar shows action buttons. Close campaign — buttons disappear. Non-admin — never shows.

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
| `src/components/Auth/AuthBarFloating.tsx` | I, K5 | Deferred position init, null guard, resize re-clamping; consume CampaignContext for campaign action buttons |
| `src/gallery-adapters/diamond/DiamondGallery.tsx` | E | Overlay constants (discovered during implementation) |
| `src/App.tsx` | K5 | Wrap with CampaignContextProvider, wire action callbacks |
| `src/components/Auth/AuthBar.tsx` | K5 | No longer needed for K5 (context replaces prop threading) |
| New: `src/contexts/CampaignContext.tsx` | K5 | CampaignContext definition + provider |
| `src/components/Campaign/CampaignViewer.tsx` | B, C, G, K1, K2, K3, K5 | Logo, IIFE refactor, a11y, gallery full-width, modal size, fullscreen bg, remove admin actions |
| `src/components/Admin/SettingsPanel.tsx` | K2, K3 | modalMaxWidth, fullscreen bg controls |
| `src/types/index.ts` | K2, K3 | modalMaxWidth, modalBg* settings |
| `src/gallery-adapters/compact-grid/CompactGridGallery.tsx` | E, K4 | Overlay constants; maxWidth column wrapper (reuses existing settings) |
| `src/components/Gallery/CardGallery.tsx` | A, D, G, J, K5 | Layout fix, useMediaQuery, a11y, QA fix, remove admin callback pass-through |
| `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` | K2, K3 | PHP defaults + validation for modalMaxWidth and modalBg* |

---

## Implementation Summary

Tracks P22-A through P22-I implemented, verified, and committed (v0.21.0). Track P22-J (QA fix) committed. Tracks P22-K1 through P22-K5 are planned — CampaignViewer modal enhancements.

### Key Decisions During Implementation

- **G-1 (AdminPanel focus):** Skipped — element uses `tabIndex={-1}` (programmatic focus only, not tab-reachable), so `outline: none` is acceptable per WCAG 2.4.7.
- **P22-E scope expansion:** Diamond adapter (`DiamondGallery.tsx`) was discovered to also use hardcoded overlay colors and was added to the scope (6 adapters total, not 5 as originally planned).
- **P22-F textMuted2 values:** Computed minimum-change compliant hex values that preserve each theme's color hue while achieving ≥4.5:1 contrast ratio against both `surface` and `background` colors. High-contrast theme was already compliant and left unchanged.
- **P22-H theme contrast:** New themes (`github-light`, `catppuccin-latte`) were created with WCAG-compliant `textMuted2` values from the start.

### Tests
- All unit tests pass (`npm run test:silent`)
- Production build succeeds (`npm run build:wp`)
- Type check passes (`tsc -b`)

---

## Track P22-J — CardGallery Column & Gap QA Fix

**Priority:** 🔴 High — user-reported broken settings
**Effort:** Small (~30 min)
**Depends on:** P22-A (already committed)

### Problem

QA testing revealed two bugs in the P22-A flex layout implementation:

1. **Flex branch ignores `cardGridColumns` / `cardMaxColumns`**: The flex wrapper has no `maxWidth` constraint. Cards wrap freely based on container width alone — column settings do nothing. Horizontal gap also appears capped because unconstrained rows fill the full width.
2. **SimpleGrid branch ignores `effectiveColumns`**: The SimpleGrid duplicates column logic inline instead of using the `effectiveColumns` value already computed via `useMediaQuery`.

**Note:** A `galleryPaddingH` setting was initially considered (J-3) but dropped after QA review confirmed that the existing `appPadding` setting already applies `paddingInline` on the gallery container (CardGallery L208), making a second padding control redundant.

### Fix

**J-1. Constrain flex branch with column-aware maxWidth**

Add a `maxCols` useMemo (only used by flex branch):
- `cardGridColumns > 0` → use `cardGridColumns`
- else `cardMaxColumns > 0` → use `cardMaxColumns`
- else fallback to **4**

Compute `rowMaxWidth = maxCols * cardMaxWidth + (maxCols - 1) * cardGapH`.
Apply `maxWidth: rowMaxWidth`, `marginInline: 'auto'` to the flex `<Box>` to center the constrained row.

**J-2. SimpleGrid uses effectiveColumns**

Replace inline column logic with `cols={effectiveColumns}` (the existing responsive+clamped value computed at L85-95 via `useMediaQuery`).

### Decisions
- Default column cap when both `cardGridColumns` and `cardMaxColumns` are 0: **4 columns** (flex branch only)
- SimpleGrid branch: **use `effectiveColumns`** (single source of truth)
- `galleryPaddingH`: **Dropped** — `appPadding` already handles this via `paddingInline` on the gallery container

### Files to modify
- `src/components/Gallery/CardGallery.tsx` — J-1 (maxCols useMemo + flex maxWidth), J-2 (SimpleGrid cols)

### Acceptance Criteria
- With `cardMaxWidth=300`, `cardGridColumns=3`: exactly 3 cards per row, centered
- With `cardMaxWidth=300`, `cardMaxColumns=2`: max 2 cards per row
- With `cardMaxWidth=0`: SimpleGrid uses `effectiveColumns` correctly
- `cardGapH` values >48 work correctly in both modes
- No regression in pagination slide transitions

---

## Track P22-K1 — Gallery Full-Width in Fullscreen/Galleries-Only

**Priority:** 🟢 Low — UX polish
**Effort:** Small (30 min)
**Depends on:** None

### Problem

The gallery sections inside the CampaignViewer modal have inner padding (`p={{ base: 'md', md: 'xl' }}`) that prevents galleries from expanding to the full modal width when in fullscreen or galleries-only mode. This wastes horizontal space, especially on wide screens where galleries should spread out.

### Current State

The content `Box` at CampaignViewer.tsx L340 applies:
```
p={{ base: 'md', md: 'xl' }}
style={{ maxWidth: s.fullscreenContentMaxWidth > 0 ? px : '64rem', marginLeft: 'auto', marginRight: 'auto' }}
```

The padding always applies regardless of display mode.

### Fix

Make padding conditional on display mode:
```
p={galleriesOnly || useFullscreen ? 0 : { base: 'md', md: 'xl' }}
```

This removes inner padding in fullscreen and galleries-only modes, allowing galleries to expand edge-to-edge within the centered content area. Default modal retains responsive padding.

### Files to modify
- `src/components/Campaign/CampaignViewer.tsx` — content Box padding (L340)

### Acceptance Criteria
- Fullscreen mode: galleries extend to full content width (no inner padding)
- Galleries-only mode: same behavior
- Default modal: retains existing responsive padding (`base: md, md: xl`)

---

## Track P22-K2 — modalMaxWidth Setting

**Priority:** 🟡 Medium — controllability
**Effort:** Small (1–2 hours)
**Depends on:** None

### Problem

The campaign modal's default width is hardcoded to Mantine's `size="xl"` (~1200px). Admins cannot control the modal width for different content layouts. When `fullscreenContentMaxWidth` controls the gallery area in fullscreen mode, there's no equivalent for the default (non-fullscreen) modal.

### Current State

CampaignViewer.tsx L221:
```tsx
<Modal size="xl" ... fullScreen={useFullscreen}>
```
- Fullscreen mode: `fullScreen={true}` fills viewport, `fullscreenContentMaxWidth` constrains content area
- Default mode: fixed at Mantine `xl` with no admin control

### Fix

**New setting:** `modalMaxWidth: number` (default 1200 = matches current Mantine `xl`)

Type definition in `GalleryBehaviorSettings`:
```
modalMaxWidth: number;  // 0 = Mantine xl, >0 = fixed px (default 1200)
```

Modal size prop becomes:
```tsx
size={useFullscreen ? '100%' : (s.modalMaxWidth > 0 ? `${s.modalMaxWidth}px` : 'xl')}
```

SettingsPanel: `NumberInput` (min 0, max 3000, step 50, placeholder "0 = Mantine default").

### Settings Pipeline
- **TS type:** `GalleryBehaviorSettings.modalMaxWidth: number`
- **TS default:** `modalMaxWidth: 1200`
- **PHP default:** `'modal_max_width' => 1200`
- **PHP validation:** `'modal_max_width' => [0, 3000]`

### Files to modify
- `src/types/index.ts` — interface + defaults
- `src/components/Campaign/CampaignViewer.tsx` — Modal `size` prop
- `src/components/Admin/SettingsPanel.tsx` — NumberInput control
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — PHP default + range

### Acceptance Criteria
- `modalMaxWidth=0`: Modal renders at Mantine `xl` (fallback behavior)
- `modalMaxWidth=1200`: Same as current behavior (explicit default)
- `modalMaxWidth=800`: Default modal constrained to 800px
- `modalMaxWidth=1600`: Default modal widens to 1600px
- Fullscreen mode unaffected by `modalMaxWidth` (uses `fullscreenContentMaxWidth`)
- Modal content never bleeds off-screen on small devices (Mantine's built-in responsive clamping)

---

## Track P22-K3 — Fullscreen Modal Background

**Priority:** 🟡 Medium — visual customization
**Effort:** Low–Medium (2–3 hours)
**Depends on:** K-2 (settings pipeline established)

### Problem

When the campaign modal is in fullscreen mode, the background is always the default theme background. Admins want to set a custom background (e.g., dark solid/gradient) for the fullscreen modal independently from the main gallery container background (`viewerBgType`).

### Current State

The existing `viewerBgType` / `viewerBgColor` / `viewerBgGradient` settings control the **outer gallery container** background (applied in CardGallery.tsx `galleryStyle` useMemo). There is no separate background control for the fullscreen campaign modal.

### Fix

**New settings** (mirror `viewerBgType` options with independent values, shorter names since bg only applies in fullscreen):
```
modalBgType: 'theme' | 'transparent' | 'solid' | 'gradient'
modalBgColor: string
modalBgGradient: GradientOptions
```

Implementation in CampaignViewer.tsx:
```tsx
const modalBgStyle = useMemo<React.CSSProperties | undefined>(() => {
  if (!useFullscreen) return undefined;
  switch (s.modalBgType) {
    case 'transparent': return { background: 'transparent' };
    case 'solid': return { background: s.modalBgColor || 'transparent' };
    case 'gradient': return { background: buildGradientCss(s.modalBgGradient) || undefined };
    default: return undefined; // 'theme' — use Mantine default
  }
}, [useFullscreen, s.modalBgType, s.modalBgColor, s.modalBgGradient]);
```

Apply as a wrapper `<Box style={modalBgStyle}>` inside the Modal, wrapping cover + content sections. Only active when `useFullscreen` is true.

SettingsPanel: Clone the existing `viewerBgType` control pattern (Select + conditional ColorInput + GradientEditor) under a "Fullscreen Background" sub-heading in the Campaign Viewer section.

### Settings Pipeline
- **TS type:** `modalBgType`, `modalBgColor`, `modalBgGradient`
- **TS defaults:** `'theme'`, `''`, `{}`
- **PHP defaults:** `'modal_bg_type' => 'theme'`, `'modal_bg_color' => ''`, `'modal_bg_gradient' => '{}'`

### Files to modify
- `src/types/index.ts` — 3 new settings in interface + defaults
- `src/components/Campaign/CampaignViewer.tsx` — `modalBgStyle` useMemo + wrapper Box
- `src/components/Admin/SettingsPanel.tsx` — fullscreen bg controls (Select + ColorInput + GradientEditor)
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — PHP defaults

### Acceptance Criteria
- `modalFullscreenBgType='theme'`: fullscreen modal uses default theme bg (current behavior)
- `modalFullscreenBgType='solid'` + color: fullscreen modal gets solid color bg
- `modalFullscreenBgType='gradient'` + stops: fullscreen modal gets gradient bg
- Default (non-fullscreen) modal: completely unaffected by these settings
- `viewerBgType` and `modalBgType` are independent (changing one doesn't affect the other)

---

## Track P22-K4 — CompactGrid Distribution Mirroring

**Priority:** 🟡 Medium — visual consistency
**Effort:** Medium (2–3 hours)
**Depends on:** P22-J (maxCols pattern established)

### Problem

The outer card gallery (CardGallery.tsx) now correctly constrains cards per row via `maxCols` (from P22-J). However, when opening a campaign and viewing galleries inside the modal, the inner gallery adapters (especially CompactGrid) have no equivalent column constraint. This means the outer grid might show 3 cards per row, but the inner gallery could show 5+ tiles per row when the modal is wide, creating visual inconsistency.

### Current State

CompactGridGallery.tsx uses CSS grid with responsive auto-fill:
```tsx
gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardWidth}px, calc(50% - ${gap / 2}px)), 1fr))`
```

Cards expand to fill the full container width with no column cap. The `gridCardWidth` (default 160px) and `gridCardHeight` (default 224px) settings control tile dimensions, but not column count.

### Fix

Reuse the existing `cardMaxColumns` / `cardGridColumns` settings (no new setting). This keeps the admin UI consistent — the same column cap that controls campaign cards per row also controls gallery tiles per row inside the modal.

Compute `maxCols` in CompactGridGallery using the same pattern as CardGallery:

```tsx
const maxCols = settings.cardGridColumns > 0
  ? settings.cardGridColumns
  : settings.cardMaxColumns > 0
    ? settings.cardMaxColumns
    : 5; // reasonable default for compact grid tiles (smaller than campaign cards)

const rowMaxWidth = maxCols * cardWidth + (maxCols - 1) * gap;

<Box style={{ maxWidth: rowMaxWidth, marginInline: 'auto' }}>
  <Box style={{ display: 'grid', gridTemplateColumns: ... }}>
    {/* tiles */}
  </Box>
</Box>
```

The fallback is 5 (vs 4 for the outer card grid) because compact grid tiles are smaller (~160px vs ~300px campaign cards), so 5 per row is a reasonable density.

### Settings Pipeline

No new settings required — reuses existing `cardGridColumns` and `cardMaxColumns`.

### Files to modify
- `src/gallery-adapters/compact-grid/CompactGridGallery.tsx` — outer Box wrapper with maxWidth

### Acceptance Criteria
- `cardGridColumns=3`: CompactGrid shows at most 3 tiles per row, centered
- `cardMaxColumns=4`: CompactGrid caps at 4 tiles per row
- Both settings unset (0): CompactGrid defaults to 5 tiles max per row
- Works correctly inside both default and fullscreen modals
- Responsive: grid still wraps to fewer columns on narrow screens
- The existing `minmax(min(...), 1fr)` formula continues to work within the constrained width

---

## Track P22-K5 — Admin Actions → AuthBar

**Priority:** 🟡 Medium — UX improvement
**Effort:** Medium (3–4 hours)
**Depends on:** K-1 (CampaignViewer touched, do after to avoid conflicts)

### Problem

The "Admin Actions" section (Edit Campaign, Manage Media, Archive) appears at the bottom of the CampaignViewer modal, taking up vertical space inside the scrollable content area. Users must scroll past all galleries and stats to reach these actions. Moving them into the AuthBar floating menu provides quicker access and a cleaner modal layout.

### Current State

**Admin actions in CampaignViewer.tsx (L391-415):**
- Guarded by `isAdmin && s.showCampaignAdminActions !== false`
- Three buttons: Edit (`onEditCampaign`), Manage Media (`onAddExternalMedia`), Archive (`onArchiveCampaign`)
- Callbacks passed through: App.tsx → CardGallery → CampaignViewer

**AuthBarFloating.tsx (L165-200):**
- Mantine `Popover` with admin buttons (Admin Panel, Settings, Sign Out)
- No campaign-awareness — purely auth/admin navigation
- Props: `email`, `isAdmin`, `onOpenAdminPanel`, `onOpenSettings`, `onLogout`

**Component hierarchy:**
```
App.tsx
├── AuthBar → AuthBarFloating (L193-207)
└── CardGallery (L267-277)
    └── CampaignViewer (selectedCampaign state lives here)
```

Both branches share App.tsx as the common ancestor. Campaign context does not currently flow to AuthBar.

### Fix

**Step 1: Create `CampaignContext`**

Create a new context (`src/contexts/CampaignContext.tsx`) that holds the currently open campaign and its action callbacks:

```tsx
interface CampaignContextValue {
  activeCampaign: Campaign | null;
  setActiveCampaign: (campaign: Campaign | null) => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onArchiveCampaign?: (campaign: Campaign) => void;
  onAddExternalMedia?: (campaign: Campaign) => void;
}
```

Provide the context in App.tsx, wrapping both AuthBar and CardGallery. This avoids prop-drilling through the entire component tree and is cleaner long-term than lifting state + threading props.

**Step 2: Provide context in App.tsx**

Wire the existing `editModal.openForEdit`, `archiveModal.handleArchiveCampaign`, `externalMediaModal.handleAddExternalMedia` callbacks into the context provider. The `activeCampaign` state is set by CampaignViewer when a campaign opens and cleared when it closes.

**Step 3: Consume context in AuthBarFloating**

In AuthBarFloating, use `useCampaignContext()` to access `activeCampaign` and action callbacks. When `activeCampaign` is set and user is admin, show a divider + 3 campaign action buttons in the Popover:
- Edit Campaign (IconEdit)
- Manage Media (IconPhoto)
- Archive (IconArchive, red)

These appear only when a campaign modal is open and disappear automatically when it closes.

**Step 4: Consume context in CampaignViewer/CardGallery**

CampaignViewer calls `setActiveCampaign(campaign)` on open and `setActiveCampaign(null)` on close. Remove the `<Paper>` admin actions section and the `showCampaignAdminActions` guard. Clean up the `onEditCampaign`, `onArchiveCampaign`, `onAddExternalMedia` props from CampaignViewerProps (they now flow through context).

### Files to modify
- New: `src/contexts/CampaignContext.tsx` — context definition + provider
- `src/App.tsx` — wrap with CampaignContextProvider, wire callbacks
- `src/components/Auth/AuthBarFloating.tsx` — consume context, conditional campaign buttons
- `src/components/Campaign/CampaignViewer.tsx` — consume context (setActiveCampaign), remove admin actions section
- `src/components/Gallery/CardGallery.tsx` — remove onEdit/onArchive/onAddExternalMedia prop pass-through (now via context)

### Acceptance Criteria
- When campaign modal is open + user is admin: AuthBar shows Edit, Manage Media, Archive buttons
- Clicking Edit/Manage Media/Archive triggers the same modal hooks as before
- When campaign modal is closed: campaign actions disappear from AuthBar
- Non-admin users: never see campaign action buttons
- The CampaignViewer modal no longer has the admin actions section
- All existing AuthBar functionality (Admin Panel, Settings, Sign Out) unaffected

---

## Adapter Distribution Feasibility Assessment

Assessment of applying column-aware `maxWidth` constraints (mirroring the CardGallery flex pattern from P22-J) to each gallery adapter. CompactGrid is implemented in K-4 using existing `cardMaxColumns`/`cardGridColumns`; others are documented here for future phases.

### Unified Strategy

1. Compute `maxCols` once in CampaignViewer (or pass down from existing settings)
2. Pass it as a prop to every gallery section/adapter
3. Wrap each adapter's root content in a centered `maxWidth` box when `maxCols > 0`
4. For library-based adapters (Masonry, Justified), the outer constraint is usually sufficient

This gives consistent visual density across the entire product.

### Summary Table

| Adapter | Difficulty | Layout Engine | Approach | Key Risk |
|---------|-----------|---------------|----------|----------|
| **CompactGrid** | Easy | CSS grid `auto-fill` + `minmax()` | Outer Box `maxWidth` wrapper (reuse `cardMaxColumns`) | Validate `minmax()` at tight widths |
| **Hexagonal** | Easy | ResizeObserver + manual row calc | `Math.min(maxCols, computed)` clamp + outer maxWidth box | None — no library deps |
| **Diamond** | Easy | Same as Hexagonal | Identical pattern to Hexagonal | None — same code |
| **Circular** | Trivial | Simple flex-wrap, no ResizeObserver | Outer Box `maxWidth` wrapper (no ResizeObserver needed) | None — simplest adapter |
| **Masonry** | Moderate | `react-photo-album` MasonryPhotoAlbum | Clamp columns function: `() => Math.min(maxCols, responsiveCalc())` + outer box | Test ResizeObserver interaction |
| **Justified** | Moderate | `react-photo-album` RowsPhotoAlbum (row-packing) | Outer maxWidth box only (no column concept — row packing adapts automatically) | May look slightly different — acceptable |

### Detailed Notes

**Hexagonal / Diamond / Circular (Easy–Trivial):**
These adapters use manual tile layout (ResizeObserver + row splitting for hex/diamond, pure flex-wrap for circular). Adding a `maxCols` clamp is a 5–10 line change per adapter: compute `maxWidth = maxCols × tileSize + (maxCols - 1) × gap`, wrap in outer Box. The `tilesPerRow` calculation already exists and can simply be clamped with `Math.min(maxCols, ...)`. No third-party library involved. **Recommendation: include in next phase with near-zero risk.**

**Masonry (Moderate):**
Uses `react-photo-album` which manages column layout internally. Already has a `masonryColumns` pin setting that works. To add a cap: clamp the responsive columns function like `(containerWidth) => Math.min(maxCols, computeResponsive(containerWidth))` + wrap component in outer Box with `maxWidth`. Risk: the library's internal ResizeObserver measures the outer container — an external `maxWidth` wrapper should work but needs testing to verify the library re-renders correctly when the container width changes externally. **Recommendation: feasible with integration testing.**

**Justified (Moderate):**
Uses `react-photo-album` RowsPhotoAlbum which packs images into rows that fill the full container width while preserving aspect ratios. There is no "column" concept — the algorithm determines how many images fit per row based on target row height and aspect ratios. An outer `maxWidth` wrapper narrows the packing area, and the row packing algorithm will adapt automatically. The result may look slightly different from other adapters (rows may redistribute), but this is acceptable and visually consistent. **Recommendation: outer maxWidth box is sufficient; no column cap needed. Feasible with visual testing.**

---

## Track P22-L1 — Font Loading Resilience

**Priority:** 🔴 High — fixes active bug (MIME mismatch causing font failures on WP hosts)
**Effort:** Small (1–2 hours)
**Depends on:** None

### Problem

`loadGoogleFont()` in `src/utils/loadGoogleFont.ts` injects `<link>` elements into `document.head` pointing at `fonts.googleapis.com`. On WordPress hosts with security plugins (Wordfence, Sucuri, Cloudflare), ModSecurity, or strict CSP/CORS headers, the Google Fonts CSS response can be blocked or return an HTML error page — causing the browser error:

> The resource from "https://fonts.googleapis.com/css2?family=Lato:..." was blocked due to MIME type ("text/html") mismatch (X-Content-Type-Options: nosniff).

Current issues:
1. No `crossOrigin` attribute on the injected `<link>` element
2. No `onerror` callback — failures are silent (text renders in browser default font with no warning)
3. No retry or fallback mechanism
4. `loadGoogleFontsFromOverrides()` is only called in `CardGallery.tsx` — CampaignViewer never preloads fonts, causing flash-of-unstyled-text

### Fix

**Step 1: Harden `loadGoogleFont()`**

Update `src/utils/loadGoogleFont.ts`:
- Add `link.crossOrigin = 'anonymous'` (required by some hosts for CORS)
- Add `link.onerror` handler that logs a visible `console.warn` with the font name and a suggestion to use system fonts or custom upload
- Remove the font from the `loaded` Set on error so retry is possible on next page navigation
- Add `link.onload` for debug-level logging

**Step 2: Add font preloading to CampaignViewer**

Call `loadGoogleFontsFromOverrides()` in CampaignViewer's render path (useEffect on settings change), same pattern as CardGallery.tsx line 53–55. This prevents flash-of-unstyled-text when the viewer opens.

**Step 3: Export a `fontLoadFailed` observable**

Add a module-level `Set<string>` tracking fonts that failed to load. Export `getFailedFonts(): ReadonlySet<string>`. This will be consumed by L-3 (fallback chain) to show warnings in the UI.

### Files to modify
- `src/utils/loadGoogleFont.ts` — onerror, crossOrigin, failed set, onload debug
- `src/components/Campaign/CampaignViewer.tsx` — add loadGoogleFontsFromOverrides useEffect

### Acceptance Criteria
- [x] `crossOrigin="anonymous"` present on all injected `<link>` elements
- [x] When Google Fonts CDN is blocked: `console.warn` appears with font name
- [x] CampaignViewer preloads Google Fonts from typography overrides on open
- [x] `getFailedFonts()` correctly tracks fonts that failed to load
- [x] Fonts that loaded successfully are not re-requested (dedup still works)

### Implementation Result

**Commit:** `9c5d2f2` (with L-2)
- `loadGoogleFont.ts`: Added `crossOrigin = 'anonymous'`, `onerror` handler with `console.warn`, module-level `failed` Set, exported `getFailedFonts()`
- `CampaignViewer.tsx`: Added `loadGoogleFontsFromOverrides` useEffect on settings change

---

## Track P22-L2 — Grouped Font Picker + Expanded Google Fonts

**Priority:** 🟡 Medium — UX improvement
**Effort:** Medium (2–3 hours)
**Depends on:** L-1 (uses GOOGLE_FONT_NAMES for CDN detection)

### Problem

The current font picker in TypographyEditor is a flat dropdown of 14 options (10 Google + 3 system + 1 default). This is limiting for designers and mixes Google CDN-dependent fonts with always-available system fonts, giving no visual indication of which fonts require an external load.

### Fix

**Step 1: Expand GOOGLE_FONT_NAMES to ~40 popular fonts**

Curate a list of the most popular Google Fonts covering sans-serif, serif, display, handwriting, and monospace categories. Examples: Nunito, Source Sans 3, PT Sans, Noto Sans, Work Sans, Quicksand, Barlow, Cabin, DM Sans, Fira Sans, Karla, Mulish, Rubik, Ubuntu, Josefin Sans, Libre Baskerville, Crimson Text, EB Garamond, Bitter, Cormorant Garamond, Dancing Script, Pacifico, Lobster, Caveat, Satisfy, Fira Code, JetBrains Mono, Source Code Pro, etc.

**Step 2: Define grouped font data**

Restructure `FONT_FAMILIES` into Mantine's grouped Select format:

```
data={[
  { group: 'Recently Used', items: recentFontItems },
  { group: 'System Fonts', items: SYSTEM_FONT_OPTIONS },
  { group: 'Google Fonts', items: GOOGLE_FONT_OPTIONS },
  { group: 'Custom Fonts', items: customFontItems },  // empty until L-6
]}
```

System fonts (always available, no CDN): System UI, Georgia, Times New Roman, Courier New, Monospace, Arial, Helvetica, Verdana, Trebuchet MS, Tahoma.

**Step 3: Recently Used via localStorage**

- On font selection, push the font name to a `wpsg-recent-fonts` localStorage key (max 8, deduplicated, most-recent-first)
- Read on component mount via a small `useRecentFonts()` hook
- No DB round-trip — purely per-browser state

**Step 4: Update TypographyEditor props**

Add optional `customFonts?: Array<{ name: string; family: string }>` prop to receive custom uploaded fonts (empty until L-6). The font picker will show these in the "Custom Fonts" group.

### Files to modify
- `src/components/shared/TypographyEditor.tsx` — grouped Select data, expanded GOOGLE_FONT_NAMES, SYSTEM_FONT_OPTIONS, customFonts prop
- New: `src/hooks/useRecentFonts.ts` — localStorage-backed recent fonts hook
- `src/utils/loadGoogleFont.ts` — expanded GOOGLE_FONT_NAMES set (or move to shared data file)

### Acceptance Criteria
- [x] Font picker shows 4 groups: Recently Used, System Fonts, Google Fonts, Custom Fonts
- [x] ~40 Google Fonts available in the Google Fonts group
- [x] System Fonts group contains ~10 always-available fonts
- [x] Recently Used group shows last 8 selected fonts (persisted across page loads via localStorage)
- [x] Selecting a Google Font triggers `loadGoogleFont()` as before
- [x] Selecting a System Font does NOT trigger any CDN request
- [x] Custom Fonts group is empty (populated later by L-6)
- [x] Searchable — typing a font name filters across all groups

### Implementation Result

**Commit:** `9c5d2f2`
- Expanded `GOOGLE_FONT_NAMES` (10→44 fonts) and `FONT_FAMILIES` (flat array→grouped format)
- Added `SYSTEM_FONT_OPTIONS` (10 system fonts) and `GOOGLE_FONT_OPTIONS` (44 Google fonts)
- `useMemo`-based `fontFamilyData` groups: Recently Used / Custom / System / Google
- Created `useRecentFonts` hook with `useSyncExternalStore` + localStorage

---

## Track P22-L3 — Font Fallback Chain Picker

**Priority:** 🟡 Medium — designer UX for resilience
**Effort:** Medium (2–3 hours)
**Depends on:** L-2 (uses grouped font data)

### Problem

When a Google Font fails to load (blocked CDN, network issue, strict CSP), the browser falls back to the generic family keyword (`sans-serif`, `serif`). This can produce a dramatically different look from what the designer intended. Designers need the ability to choose an explicit fallback chain: primary → fallback 1 → fallback 2 → terminal system font.

### Current State

The `fontFamily` value in `TypographyOverride` is a raw CSS string like `"Lato, sans-serif"`. The fallback after the comma is just a generic keyword — not a specific font the designer chose.

### Fix

**Step 1: Add fallback UI below the primary font picker**

When a font is selected, show a "Fallback Fonts" section with:
- Slot 1: Primary font (the current selection — read-only, shows the label)
- Slot 2: First fallback — a smaller Select pre-populated with best-match suggestions (system fonts that are visually similar to the primary). Optional, clearable.
- Slot 3: Second fallback — another Select, narrower list. Optional, clearable.
- Terminal: Always-appended `system-ui, sans-serif` (or `serif` / `monospace` based on primary font category). Not editable — shown as a label.

**Step 2: Build the CSS fontFamily string**

Combine selections into a single `fontFamily` value:
```
"Lato, 'Open Sans', system-ui, sans-serif"
```
Where "Lato" is primary (Google), "Open Sans" is fallback 1 (loaded or system), and `system-ui, sans-serif` is the terminal.

**Step 3: Auto-suggest fallbacks**

Create a small mapping of font → suggested fallbacks based on visual similarity:
- Lato → ["Open Sans", "Helvetica", "Arial"]
- Playfair Display → ["Georgia", "Times New Roman"]
- Fira Code → ["Courier New", "monospace"]
- etc.

These are suggestions only — the designer can override with any font from the full list.

**Step 4: Detect and warn on failed fonts**

If the primary font is in `getFailedFonts()` (from L-1), show a warning badge next to it: "⚠ This font failed to load — the first available fallback will be used."

### Files to modify
- `src/components/shared/TypographyEditor.tsx` — fallback chain UI section below primary picker
- New: `src/data/fontFallbackMap.ts` — visual similarity suggestions per font
- `src/utils/loadGoogleFont.ts` — consume `getFailedFonts()` for warning display

### Acceptance Criteria
- [x] When a primary font is selected, fallback section appears with 2 optional fallback slots
- [x] Terminal fallback (`system-ui, sans-serif`) always appended automatically based on font category
- [x] Selecting fallbacks updates the stored `fontFamily` CSS string correctly
- [x] Clearing all fallbacks preserves the primary + terminal only
- [x] Auto-suggest populates fallback 1 with a visually similar font (editable)
- [x] Failed fonts show an inline warning badge

### Implementation Result

**Commit:** `68f0095`
- Created `src/data/fontFallbackMap.ts` with `FONT_FALLBACK_MAP` (visual similarity) and `getTerminalFamily()`
- Added `fontFallback1`/`fontFallback2` to `TypographyOverride` interface
- Updated `useTypographyStyle.ts` to build combined CSS `fontFamily` string
- Fallback chain UI: two Selects + terminal label + failed font warning Badge
- Auto-populates fallback 1 from map on primary selection
- Fixed batching issue: single `onChange(clean({...}))` call
- [ ] Existing typography overrides with old-format `fontFamily` values continue to work (backward compatible — the first segment is still the primary font)

---

## Track P22-L4 — PHP Server-Side Google Fonts Enqueueing

**Priority:** 🟡 Medium — most robust WP-friendly fix for blocked CDN requests
**Effort:** Small (1–2 hours)
**Depends on:** None (can parallel with L-1/L-2/L-3)

### Problem

Client-side font injection via `<link>` in `document.head` is blocked by some WordPress security configurations. The most WordPress-native solution is to enqueue Google Fonts server-side via `wp_enqueue_style()`, which runs through WordPress's standard asset pipeline and is respected by caching plugins, CDN proxies, and security configurations.

### Current State

- `class-wpsg-settings.php` stores `typography_overrides` as a JSON string
- No PHP code currently enqueues external font stylesheets
- `class-wpsg-rest.php` handles the embed rendering endpoint

### Fix

**Step 1: Extract Google Font names from settings on the PHP side**

In `class-wpsg-settings.php`, add a static method `extract_google_font_families($settings): array` that:
1. Decodes `typography_overrides` JSON
2. Iterates all entries, extracts `fontFamily` values
3. Parses out the first font name from each CSS `fontFamily` string
4. Cross-references against a PHP-side `GOOGLE_FONT_NAMES` constant (same 40 fonts as L-2)
5. Returns deduplicated array of Google Font family names

**Step 2: Enqueue in the embed/shortcode render path**

In `class-wpsg-embed.php` (or wherever the shortcode/embed HTML is generated), call the extraction method and enqueue:

```php
$families = WPSG_Settings::extract_google_font_families($settings);
if (!empty($families)) {
    $url = 'https://fonts.googleapis.com/css2?' 
         . implode('&', array_map(fn($f) => 'family=' . urlencode($f) . ':ital,wght@0,100..900;1,100..900', $families))
         . '&display=swap';
    wp_enqueue_style('wpsg-google-fonts', $url, [], null);
}
```

WordPress handles the rest — caching plugins, CDN rewrites, and security plugin allowlists all respect `wp_enqueue_style`.

**Step 3: Client-side can skip fonts already enqueued server-side**

`loadGoogleFont()` already deduplicates via its `loaded` Set. If the server-side enqueue works, the font is already available when React mounts — the client-side call becomes a no-op (dedup fires because the font renders immediately). No changes needed on the TS side.

### Files to modify
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — `extract_google_font_families()` method + `GOOGLE_FONT_NAMES` constant
- `wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php` (or equivalent) — `wp_enqueue_style` call in render path

### Acceptance Criteria
- [x] Google Fonts CSS is enqueued via `wp_enqueue_style` when typography overrides reference Google Fonts
- [x] Fonts load even when client-side JavaScript injection is blocked
- [x] No duplicate font requests (server enqueue + client-side dedup)
- [x] Empty typography overrides = no font enqueue (no unnecessary requests)
- [x] Fonts not in the Google Fonts list are ignored (no arbitrary URL injection)

### Implementation Result

**Commit:** `20372f1` (with L-5/L-6)
- Added `GOOGLE_FONT_NAMES` constant (44 fonts) to `class-wpsg-settings.php`
- Added `extract_google_font_families()` static method
- Added `wp_enqueue_style('wpsg-google-fonts', ...)` in `class-wpsg-embed.php::render_shortcode()`
- Google Fonts CSS2 API with `ital,wght@0,100..900;1,100..900` and `display=swap`
- Added `fontFallback1`/`fontFallback2` to `$allowed_props` in sanitize_settings

---

## Track P22-L5 — Custom Font Upload Infrastructure (PHP)

**Priority:** 🟢 Medium — forward-looking capability
**Effort:** Medium (3–4 hours)
**Depends on:** None (can parallel with L-1 through L-4)

### Problem

Designers need to use brand-specific or licensed fonts that aren't available on Google Fonts. Currently there is no way to upload custom font files and use them in typography overrides.

### Architecture Decision

Follow the existing `class-wpsg-overlay-library.php` pattern, which already handles custom file uploads to `wp-content/uploads/wpsg-overlays/` with proper MIME validation, path traversal protection, and admin-only access.

### Fix

**Step 1: Create `class-wpsg-font-library.php`**

New PHP class modeled on `class-wpsg-overlay-library.php`:

- Upload directory: `wp-content/uploads/wpsg-fonts/`
- Allowed MIME types: `woff2` (`font/woff2`), `woff` (`font/woff`), `ttf` (`font/ttf`), `otf` (`font/opentype`)
- Max file size: 2 MB per font file (configurable via filter)
- Storage metadata: option `wpsg_font_library` — JSON array of `{ id, name, filename, url, format, uploadedAt }`
- Auto-generate `.htaccess` in `wpsg-fonts/` with correct `Content-Type` headers for font MIME types

**Step 2: Register REST endpoints**

Following the existing `/admin/overlay-library` pattern:

| Endpoint | Method | Handler | Purpose |
|----------|--------|---------|---------|
| `/admin/font-library` | GET | `list_fonts()` | List all uploaded custom fonts |
| `/admin/font-library` | POST | `upload_font()` | Upload a new font file |
| `/admin/font-library/{id}` | DELETE | `delete_font()` | Remove a font file + metadata |

All endpoints require `manage_wpsg` capability (admin-only).

**Step 3: Generate `@font-face` CSS**

Add a method `generate_font_face_css(): string` that produces `@font-face` rules for all uploaded fonts:

```css
@font-face {
  font-family: 'BrandFont';
  src: url('/wp-content/uploads/wpsg-fonts/brandfont.woff2') format('woff2');
  font-display: swap;
}
```

This CSS is either:
- Enqueued via `wp_enqueue_style` as inline CSS (server-side, L-4 pattern), OR
- Returned via a REST endpoint and injected client-side into `document.head` (similar to current Google Fonts approach but with local URLs — no CORS/CDN issues)

**Step 4: Security hardening**

- MIME type validation via `wp_check_filetype_and_ext()` before `wp_handle_upload()`
- Path traversal protection: `realpath()` check against upload basedir (same as overlay library)
- Filename sanitization via `sanitize_file_name()`
- No PHP execution in uploads dir (`.htaccess` with `php_flag engine off`)
- Rate limiting via existing `rate_limit_admin()` pattern

### Files to modify
- New: `wp-plugin/wp-super-gallery/includes/class-wpsg-font-library.php` — upload, list, delete, @font-face generation
- `wp-plugin/wp-super-gallery/includes/class-wpsg-rest.php` — register font-library REST routes
- `wp-plugin/wp-super-gallery/wp-super-gallery.php` — require new class file

### Acceptance Criteria
- [x] `POST /wp-super-gallery/v1/admin/font-library` accepts .woff2/.woff/.ttf/.otf files (admin-only)
- [x] Uploaded fonts stored in `wp-content/uploads/wpsg-fonts/`
- [x] `GET /wp-super-gallery/v1/admin/font-library` returns list of uploaded fonts with URLs
- [x] `DELETE /wp-super-gallery/v1/admin/font-library/{id}` removes file + metadata
- [x] `.htaccess` in `wpsg-fonts/` sets correct Content-Type headers
- [x] MIME validation rejects non-font files (e.g., .php, .svg, .js)
- [x] Path traversal attempts are blocked
- [x] `@font-face` CSS generated correctly for all uploaded fonts

### Implementation Result

**Commit:** `20372f1` (with L-4/L-6)
- Created `class-wpsg-font-library.php` modeled on overlay library pattern
- Upload: `wp_handle_upload()`, MIME validation, format detection, max 2MB
- Storage: `wpsg_font_library` option with id, name, filename, url, format, uploadedAt
- `generate_font_face_css()` produces `@font-face` rules with `font-display: swap`
- `ensure_htaccess()` with PHP execution disabled, CORS headers, MIME corrections
- REST routes registered in `class-wpsg-rest.php`, required in main plugin file

---

## Track P22-L6 — Custom Font Upload UI

**Priority:** 🟢 Medium — completes the custom font workflow
**Effort:** Medium (3–4 hours)
**Depends on:** L-5 (PHP endpoints), L-2 (grouped font picker)

### Problem

With L-5 providing the backend, designers need a UI to upload fonts and see them in the font picker.

### Fix

**Step 1: Font Management section in SettingsPanel**

Add a "Custom Fonts" section in AdminPanel/SettingsPanel (under Typography or as a new tab):
- Upload button (drag-and-drop or click) with accepted file types (`.woff2, .woff, .ttf, .otf`)
- Progress indicator during upload
- List of uploaded fonts with name, format badge, and delete button
- Upload calls `POST /admin/font-library`; list calls `GET /admin/font-library`

**Step 2: Inject `@font-face` rules on load**

When the app initializes (or when SettingsPanel mounts), fetch the font library and inject `@font-face` CSS into `document.head`. This makes custom fonts available to the browser's font registry — same mechanism as Google Fonts but with local URLs.

Create a utility `loadCustomFonts(fonts: FontLibraryEntry[])` in `src/utils/loadGoogleFont.ts` (or a new `loadCustomFont.ts`) that:
1. Creates a `<style>` element with `@font-face` rules for each font
2. Appends to `document.head` (idempotent — check before re-injecting)

**Step 3: Wire into TypographyEditor**

Pass the font library list to TypographyEditor via the new `customFonts` prop (from L-2). Custom fonts appear in the "Custom Fonts" group of the font picker. Selecting a custom font does NOT call `loadGoogleFont()` — the `@font-face` injection from Step 2 handles loading.

**Step 4: Wire into fallback chain (L-3)**

Custom fonts are available in the fallback picker's font list alongside system and Google fonts. A designer could set: Primary = "BrandSans" (custom upload) → Fallback 1 = "Inter" (Google) → Terminal = `system-ui, sans-serif`.

### Files to modify
- `src/components/Admin/SettingsPanel.tsx` — font management UI section
- `src/components/shared/TypographyEditor.tsx` — consume `customFonts` prop
- New: `src/utils/loadCustomFonts.ts` — @font-face injection utility
- `src/services/apiClient.ts` (or equivalent) — font library API calls

### Acceptance Criteria
- [x] Upload .woff2/.woff/.ttf/.otf files via SettingsPanel UI
- [x] Uploaded fonts listed with name, format, delete button
- [x] Delete removes file from server and refreshes list
- [x] Custom fonts appear in "Custom Fonts" group of the font picker
- [x] Selecting a custom font applies it correctly (via @font-face injection)
- [x] Custom fonts available as fallback options in L-3 fallback chain picker
- [x] Non-admin users cannot see or access the upload UI

### Implementation Result

**Commit:** `20372f1` (with L-4/L-5)
- Created `FontLibraryManager.tsx` with FileButton upload, font list, format badges, delete
- Created `loadCustomFonts.ts` utility for `@font-face` injection via `<style>` element
- Wired into SettingsPanel: `customFonts` state, `FontLibraryManager` in Typography tab
- `customFonts` prop passed to all 16 TypographyEditor instances
- Custom fonts appear in grouped font picker via `customFonts` prop

---

## Track P22-L7 — Font System End-to-End QA

**Priority:** 🟢 Low — validation track
**Effort:** Small (1–2 hours)
**Depends on:** L-1 through L-6 (all must be complete)

### Purpose

Manual end-to-end QA of the complete font system to verify all tracks work together. This is a testing-only track — no code changes.

### QA Scenarios

**Scenario 1: Google Fonts — Happy Path**
1. Open TypographyEditor for any element (e.g., Campaign Title)
2. Select a Google Font (e.g., "Playfair Display") from the Google Fonts group
3. Verify font renders correctly in the preview and in the actual CampaignViewer
4. Reload page — verify font persists and renders without flash

**Scenario 2: Google Fonts — CDN Blocked**
1. Block `fonts.googleapis.com` via browser DevTools network blocking
2. Select a Google Font
3. Verify `console.warn` appears with the font name
4. Verify the fallback chain renders the next available font
5. Verify the ⚠ warning badge appears next to the primary font in the picker
6. Unblock the CDN — verify font loads on next interaction

**Scenario 3: Custom Font Upload**
1. Upload a .woff2 file via SettingsPanel
2. Verify it appears in the Custom Fonts group within the font picker
3. Select it as a primary font for Campaign Title
4. Verify it renders correctly in CampaignViewer
5. Set a fallback (e.g., "Georgia") via the fallback chain picker
6. Delete the custom font from SettingsPanel
7. Verify the fallback font is now used

**Scenario 4: Fallback Chain**
1. Set primary = "Lato" (Google), fallback 1 = "Georgia" (system), terminal = system-ui
2. Block Google Fonts CDN
3. Verify Georgia renders (not generic sans-serif)
4. Clear fallback 1
5. Verify system-ui renders

**Scenario 5: Recently Used**
1. Select 3 different fonts across different elements
2. Open a new TypographyEditor — verify "Recently Used" group shows the 3 fonts
3. Clear localStorage — verify "Recently Used" is empty
4. Select 10 fonts — verify only the most recent 8 appear

**Scenario 6: Server-Side Enqueueing**
1. View page source of the embedded gallery (non-admin, frontend)
2. Verify `<link>` tag for Google Fonts is present in the HTML `<head>` (from `wp_enqueue_style`)
3. Verify fonts render on first paint without JavaScript (SSR path)

**Scenario 7: Cross-Browser**
1. Repeat scenarios 1, 3, 4 in Chrome, Firefox, and Safari
2. Verify Shadow DOM does not block font rendering in any browser

### Acceptance Criteria
- [ ] All 7 scenarios pass
- [ ] No console errors (only expected warnings for blocked CDN test)
- [ ] No visual flash-of-unstyled-text in normal operation
- [ ] Font picker is searchable and groups are correctly categorized

---

## Track P22-M — QA Fixes, Gallery Responsiveness & Settings Reorg

QA testing revealed a cluster of related issues around gallery responsiveness, settings organization, and gallery adapter sizing. These are grouped as Track M with 8 sub-tracks. M1, M7, and M8 are already reflected in the current codebase; the remaining M tracks are planning items.

### Key Decisions (M-Track)

| # | Decision | Resolution |
|---|----------|------------|
| T | Gallery height responsiveness | **Replace `window.innerWidth` snap** with container-aware `useBreakpoint` hook. Height recalculates on container resize, not just on mount. |
| U | Gallery layout mode | **New `gallerySizingMode` control** with No restraint, Restrain to view, and Manual height entry. The viewport-constrained path now needs a second pass to derive an effective width cap from the same viewport budget so wide desktop fullscreen mode actually changes size. |
| V | Manual mode width semantics | **px maxWidth** (0 = 100% full width). Consistent with existing `appMaxWidth` and `modalMaxWidth` patterns. |
| W | Unified gallery + Manual mode | **One set of controls** when unified is enabled (single container), two sets when separate. |
| X | Viewport bg transparent | **Rename label** from "None" to "Transparent" and apply explicit `{ background: 'transparent' }` in `resolveViewportBg()`. |
| Y | Campaign Viewer settings tab | **Own top-level tab** in SettingsPanel alongside General, Cards, Media Gallery, Typography, Advanced. |
| Z | Galleries-only disabling | **Disable + dim** irrelevant toggles with `opacity: 0.4` + `pointerEvents: 'none'` + `disabled` prop when `campaignOpenMode === 'galleries-only'`. |
| AA | Justified singleRowMaxHeight | **Cap at `targetRowHeight * 1.5`** (from `* 2`). Simple, no separate setting. |

### Execution Order

```
Phase 1:             M3 (transparent bg)
Phase 2:             M4 (Campaign Viewer tab)
Phase 3:             M5 (galleries-only disabling) — depends on M4
Phase 4:             M2 (height constraint control) — depends on M1
Phase 5:             M6 (advanced audit) — depends on M2 + M4
Phase 6:             O1/O2 (responsive layout controls rollout) — depends on M2 follow-up
```

---

## Track P22-M1 — Gallery Responsive Height Fix

**Status:** Complete ✅
**Priority:** 🔴 High — galleries don't respond to container/window resize
**Effort:** Small (1–2 hours)
**Depends on:** None

### Original Problem

Both `ImageCarousel` and `VideoCarousel` compute their responsive height inside a `useMemo` that reads `window.innerWidth` once on mount:

```tsx
// ImageCarousel.tsx ~L65–68
const standardViewerHeight = useMemo(() => {
  const base = Math.max(180, Math.min(900, settings.imageViewportHeight));
  const w = typeof window !== 'undefined' ? window.innerWidth : 1024;
  return w < 576 ? `${Math.round(base * 0.55)}px`
       : w < 768 ? `${Math.round(base * 0.75)}px`
       : `${base}px`;
}, [settings.imageViewportHeight]);
```

The dependency array includes **only** the height setting — `window.innerWidth` is captured once and never recalculated. Window resizes (orientation change, drag-to-resize, WP column layout changes) have no effect. Meanwhile, the existing `useBreakpoint` hook uses `ResizeObserver` on the actual container and updates on resize — but is never consulted for height scaling.

Additionally, `window.innerWidth` is incorrect for WordPress embeds where the gallery might be in a sidebar or narrow column — the container width can be much less than the viewport width.

### Current State

- `ImageCarousel.tsx` accepts `breakpoint` and derives its height multiplier from `'mobile' | 'tablet' | 'desktop'`
- `VideoCarousel.tsx` uses the same breakpoint-driven height calculation
- `CampaignViewer.tsx` already threads `breakpoint` into the classic image/video carousel path through the local gallery section components

### Fix (Implemented)

**Step 1: Accept `breakpoint` prop in both carousel components**

Both `ImageCarousel` and `VideoCarousel` should accept a `breakpoint: Breakpoint` prop (already passed from `CampaignViewer` to gallery sections — just needs threading through to the carousel components).

**Step 2: Replace `window.innerWidth` with breakpoint-derived multiplier**

```tsx
const heightMultiplier = breakpoint === 'mobile' ? 0.55
                       : breakpoint === 'tablet' ? 0.75
                       : 1.0;

const standardViewerHeight = useMemo(() => {
  const base = Math.max(180, Math.min(900, settings.imageViewportHeight));
  return `${Math.round(base * heightMultiplier)}px`;
}, [settings.imageViewportHeight, heightMultiplier]);
```

This is now container-aware (ResizeObserver-backed), SSR-safe, and recalculates when the container resizes.

### Files to modify
- `src/components/Campaign/ImageCarousel.tsx` — Props interface + height calculation (~L65–68)
- `src/components/Campaign/VideoCarousel.tsx` — Same pattern (~L55–58)
- `src/components/Campaign/CampaignViewer.tsx` — Thread `breakpoint` prop to carousel components (if not already passed)

### Acceptance Criteria
- [x] Resize browser window from desktop → mobile: gallery height animates/updates without page reload
- [x] WordPress narrow-column embed (<576px container): carousel uses mobile height (0.55× multiplier)
- [x] Orientation change on tablet: height updates from 0.75× ↔ 1.0× based on resulting container width
- [x] No `window.innerWidth` references remain in ImageCarousel or VideoCarousel
- [x] Existing responsive behavior (mobile=55%, tablet=75%, desktop=100%) preserved with identical breakpoints

### Implementation Result

The current carousel path already matches the intended M1 fix. `ImageCarousel.tsx` and `VideoCarousel.tsx` both accept the resolved `breakpoint` and derive their height multiplier from it, removing the old `window.innerWidth` dependency and making the classic carousel height responsive to the observed container breakpoint.

---

## Track P22-M2 — Gallery Height Constraint Control

**Status:** In Progress 🚧
**Priority:** 🟡 Medium — responsiveness feature
**Effort:** Medium (3–4 hours)
**Depends on:** M1 (responsive height fix must land first)

### Problem

Classic gallery sizing needs a clearer height policy. Allowing galleries to scale freely can produce fullscreen overbleed, but a fixed pixel height is too rigid for large screens and responsive layouts. The UI needs an explicit constraint control that supports three practical modes: unrestricted sizing, viewport-constrained sizing, and manual CSS height entry.

### Current State

- Classic galleries support responsive aspect-ratio sizing in auto mode
- A viewport-constrained mode can cap classic gallery height to the visible screen while preserving aspect ratio
- Manual mode can use a CSS height string instead of a fixed numeric px-only input
- Adapter-driven galleries are still outside this control for now
- Desktop fullscreen QA shows the current viewport mode does not produce a meaningful visual restraint yet because the height cap is too loose and does not derive an effective width cap from the same viewport budget

**Implementation progress:**
- The classic carousel path now supports three height-constraint behaviors: no restraint, viewport restraint, and manual CSS height
- The Media Gallery settings UI exposes the new control and a manual text input when needed
- Adapter-driven galleries remain a separate follow-up if equivalent constraint modes are needed there
- The viewport-constrained path is being refined so it constrains the effective frame width from the same viewport-height budget instead of only applying `max-height`

### Fix

**Setting:** `gallerySizingMode: 'auto' | 'viewport' | 'manual'` (default `'auto'`)

**Supporting field:** `galleryManualHeight: string` (default `'420px'`)

**No restraint:**
- **Image galleries**: Height is content-driven with a `3 / 2` aspect ratio for the classic carousel
- **Video galleries**: Height is content-driven with a `16 / 9` aspect ratio for the classic carousel
- This is the current full-bleed behavior and can overrun the viewport on very large screens

**Restrain to view:**
- Keeps the same responsive aspect-ratio sizing but applies a viewport-based `max-height`
- Intended for fullscreen campaigns where classic galleries should stay within the visible screen instead of bleeding past it
- Follow-up implementation derives a matching effective `max-width` from the same viewport budget so wide desktop layouts visibly shrink instead of remaining full-width

**Manual:**
- Reveals a single text input for CSS height values such as `420px`, `32em`, `75vh`, or `90%`
- Classic gallery frames use that exact height value
- Invalid values fall back to the existing computed height path

**UI layout in Media Gallery tab:**

```
┌─────────────────────────────────────────────┐
│ Height Constraint                           │
│ ┌─────────────────────────────────────────┐ │
│ │ Restrain to view               ▼        │ │
│ └─────────────────────────────────────────┘ │
│ Keep classic galleries within the visible   │
│ screen while preserving their aspect ratio. │
│                                             │
│ (Manual selected → reveals controls below)  │
│                                             │
│ Manual Gallery Height [ 420px ]             │
└─────────────────────────────────────────────┘
```

**Integration with carousel components:**

- `ImageCarousel`: `auto` uses `aspectRatio: '3 / 2'`, `viewport` adds a viewport-based `maxHeight`, and `manual` uses `galleryManualHeight`
- `VideoCarousel`: same pattern with `aspectRatio: '16 / 9'`
- `CampaignViewer.tsx`: width propagation from P22-N remains in place and combines with the new height constraint modes

**Layout Builder exception:** The Layout Builder adapter always uses its own canvas sizing model (`canvasHeightMode`) regardless of `gallerySizingMode`. This is already self-contained.

### Settings Pipeline
- **TS type:** `GalleryBehaviorSettings.gallerySizingMode: 'auto' | 'viewport' | 'manual'`
- **TS defaults:** `gallerySizingMode: 'auto'`, `galleryManualHeight: '420px'`
- **PHP defaults:** `'gallery_sizing_mode' => 'auto'`, `'gallery_manual_height' => '420px'`
- **PHP validation:** `'gallery_sizing_mode'` in `['auto', 'viewport', 'manual']`, `gallery_manual_height` sanitized to numeric CSS units only

### Files to modify
- `src/types/index.ts` — expand `gallerySizingMode`, add `galleryManualHeight`
- `src/components/Admin/SettingsPanel.tsx` — replace the old fixed-height UI with the three-option constraint control + manual text entry
- `src/components/Campaign/ImageCarousel.tsx` — implement no-restraint, viewport-constrained, and manual-height behavior
- `src/components/Campaign/VideoCarousel.tsx` — same for video
- `src/services/apiClient.ts` — add settings response fields
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — PHP defaults, valid options, and manual height sanitization

### Acceptance Criteria
- [ ] No restraint: classic image gallery fills width with responsive `3 / 2` sizing and may overflow the viewport
- [ ] No restraint: classic video gallery fills width with responsive `16 / 9` sizing and may overflow the viewport
- [ ] Restrain to view: classic galleries remain within the visible screen height while preserving aspect ratio
- [ ] Manual: entering `420px`, `32em`, `75vh`, or `90%` applies that height to the classic gallery frame
- [ ] Invalid manual height values fall back safely to the existing computed height path
- [ ] Layout Builder and adapter-driven galleries remain unaffected by this control in the current phase
- [ ] Restrain to view measurably reduces classic gallery size on wide desktop fullscreen layouts instead of appearing identical to no-restraint mode

---

## Track P22-M3 — Viewport Backgrounds: Transparent Option

**Priority:** 🟢 Low — cosmetic label fix + minor behavior improvement
**Effort:** Small (<1 hour)
**Depends on:** None

### Problem

The video/image/unified gallery section backgrounds use `ViewportBgType = 'none' | 'solid' | 'gradient' | 'image'`. The `'none'` option is labeled "None" in the dropdown and applies an empty style object `{}` in `resolveViewportBg()`:

```tsx
// CampaignViewer.tsx ~L46–52
function resolveViewportBg(type, color, gradient, imageUrl) {
  if (type === 'solid') return { background: color };
  if (type === 'gradient') return { background: gradient };
  if (type === 'image') return { backgroundImage: `url(${imageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  return {}; // 'none' — empty, no override
}
```

**Two issues:**
1. **Label is confusing**: "None" doesn't communicate that the background will be transparent. Users expect "None" to mean "no background styling applied" but may not realize inherited backgrounds or theme defaults will leak through.
2. **No explicit transparent override**: Returning `{}` means any parent CSS `background` property is inherited. If the modal or a parent container sets a background, it bleeds into the gallery section. An explicit `background: 'transparent'` would override inheritance.

### Fix

**Step 1: Rename the dropdown label**

In `SettingsPanel.tsx`, change the `'none'` option in all three viewport background Select components (image, video, unified):

```diff
- { value: 'none', label: 'None' },
+ { value: 'none', label: 'Transparent' },
```

**Step 2: Apply explicit transparent background**

In `CampaignViewer.tsx`, update `resolveViewportBg()`:

```diff
- return {}; // 'none'
+ return { background: 'transparent' }; // explicit override — prevents inheritance
```

No type changes needed — `ViewportBgType` already includes `'none'`.

### Files to modify
- `src/components/Admin/SettingsPanel.tsx` — Three Select `data` arrays (image bg, video bg, unified bg) — rename label
- `src/components/Campaign/CampaignViewer.tsx` — `resolveViewportBg()` return value for `'none'`

### Acceptance Criteria
- [ ] All three background dropdowns show "Transparent" instead of "None"
- [ ] Setting background to "Transparent" applies `background: transparent` (visible in DevTools)
- [ ] Parent container backgrounds do not leak through when "Transparent" is selected
- [ ] Solid, Gradient, and Image options continue to work identically
- [ ] PHP settings remain unchanged (stores/validates `'none'` value — only the UI label changed)

---

## Track P22-M4 — Campaign Viewer Settings → Own Tab

**Priority:** 🟡 Medium — settings discoverability
**Effort:** Small (1–2 hours)
**Depends on:** None

### Problem

The General tab in SettingsPanel contains a "Campaign Viewer" divider section (~14 settings) that are exclusively CampaignViewer-specific. These include:

| Setting | Control |
|---------|---------|
| Campaign Open Mode | Select (`'full'` / `'galleries-only'`) |
| Fullscreen Campaign Modal | Switch |
| Show Company Name | Switch |
| Show Date | Switch |
| Show About Section | Switch |
| Show Description | Switch |
| Show Cover Image | Switch |
| Show Tags | Switch |
| Show Admin Actions | Switch |
| Show Gallery Labels | Switch |
| Show Campaign Stats | Switch |
| Stats Admin-Only | Switch |
| Fullscreen Content Max Width | NumberInput |
| Modal Max Width | NumberInput |

These don't belong in General because:
1. They don't affect the main gallery listing — only the campaign detail viewer
2. They clutter General, making it harder to find global settings like theme, layout, and container sizing
3. Users looking for "campaign viewer" settings wouldn't think to look in "General"

### Current State

The General tab layout in `SettingsPanel.tsx` is structured with divider-separated groups:
1. Theme + Layout + Container sizing
2. Header Visibility
3. Viewer Background
4. Auth Bar
5. **Campaign Viewer** ← this section moves out

### Fix

**Step 1: Add new tab**

Add `"viewer"` to the Tabs component:
```tsx
<Tabs.List>
  <Tabs.Tab value="general">General</Tabs.Tab>
  <Tabs.Tab value="cards">Campaign Cards</Tabs.Tab>
  <Tabs.Tab value="media">Media Gallery</Tabs.Tab>
  <Tabs.Tab value="viewer">Campaign Viewer</Tabs.Tab>  {/* NEW */}
  <Tabs.Tab value="typography">Typography</Tabs.Tab>
  {advancedSettingsEnabled && <Tabs.Tab value="advanced">Advanced</Tabs.Tab>}
</Tabs.List>
```

**Step 2: Move the Campaign Viewer section**

Cut the entire "Campaign Viewer" divider section from General tab (the `<Divider label="Campaign Viewer" .../>` through the last setting before the next divider or closing `</Stack>`) and paste into a new `<Tabs.Panel value="viewer">`.

**Step 3: Organize the new tab**

Layout for the Campaign Viewer tab:

```
┌─────────────────────────────────────────────┐
│ ── Open Mode ──────────────────────────     │
│ Campaign Open Mode    [Full ▼]              │
│ Fullscreen Campaign Modal  [toggle]         │
│ Modal Max Width (px)  [1200]                │
│ Fullscreen Content Max Width (px) [0]       │
│                                             │
│ ── Visibility ─────────────────────────     │
│ Show Company Name    [toggle]               │
│ Show Date            [toggle]               │
│ Show About Section   [toggle]               │
│ Show Description     [toggle]               │
│ Show Cover Image     [toggle]               │
│ Show Tags            [toggle]               │
│ Show Gallery Labels  [toggle]               │
│ Show Admin Actions   [toggle]               │
│ Show Campaign Stats  [toggle]               │
│ Stats Admin-Only     [toggle]               │
└─────────────────────────────────────────────┘
```

**Step 4: Clean up General tab**

After removal, the General tab becomes a clean global-settings page:
- Theme selector
- Default layout dropdown
- Items per page
- Container sizing (appMaxWidth, appPadding)
- WP Full Bleed toggles
- Header visibility (gallery title, subtitle, access mode, filter tabs, search box)
- Viewer Background
- Auth Bar

### Files to modify
- `src/components/Admin/SettingsPanel.tsx` — Tab list, new panel, move Campaign Viewer controls

### Acceptance Criteria
- [ ] "Campaign Viewer" tab appears in the tab bar between "Media Gallery" and "Typography"
- [ ] All 14 Campaign Viewer settings render and function in the new tab
- [ ] General tab no longer contains any Campaign Viewer settings
- [ ] Settings persistence is unaffected — same keys, same defaults, same PHP pipeline
- [ ] Tab switching preserves unsaved changes (existing behavior)
- [ ] Responsive tab bar wraps on mobile without clipping

---

## Track P22-M5 — Galleries-Only Conditional Disabling

**Priority:** 🟡 Medium — UX clarity
**Effort:** Small (~1 hour)
**Depends on:** M4 (settings must be in Campaign Viewer tab)

### Problem

When `campaignOpenMode === 'galleries-only'`, the viewer skips the cover image header, about section, stats block, and all campaign metadata — going straight to galleries. However, all the visibility toggles for those sections remain fully interactive in the settings panel. Toggling them has no visible effect, which is confusing.

### Current State

CampaignViewer rendering gates (`CampaignViewer.tsx`):
```tsx
const galleriesOnly = s.campaignOpenMode === 'galleries-only';

// Cover image — skipped when galleriesOnly
{!galleriesOnly && s.showCampaignCoverImage && (
  <Box pos="relative" h={...}> ... </Box>
)}

// About section — skipped when galleriesOnly
{!galleriesOnly && s.showCampaignAbout && (
  <Box> ... </Box>
)}

// Stats — skipped when galleriesOnly
{!galleriesOnly && s.showCampaignStats && (
  <Box role="region"> ... </Box>
)}
```

### Fix

In the Campaign Viewer tab (from M4), wrap the affected settings in a conditional disabled state:

```tsx
const isGalleriesOnly = settings.campaignOpenMode === 'galleries-only';

<Box
  style={{
    opacity: isGalleriesOnly ? 0.4 : 1,
    pointerEvents: isGalleriesOnly ? 'none' : 'auto',
    transition: 'opacity 200ms ease',
  }}
>
  {isGalleriesOnly && (
    <Text size="xs" c="dimmed" mb="xs">
      These settings apply only when Campaign Open Mode is "Full".
    </Text>
  )}
  <Switch label="Show Company Name" disabled={isGalleriesOnly} ... />
  <Switch label="Show Date" disabled={isGalleriesOnly} ... />
  <Switch label="Show About Section" disabled={isGalleriesOnly} ... />
  <Switch label="Show Description" disabled={isGalleriesOnly} ... />
  <Switch label="Show Cover Image" disabled={isGalleriesOnly} ... />
  <Switch label="Show Tags" disabled={isGalleriesOnly} ... />
  <Switch label="Show Campaign Stats" disabled={isGalleriesOnly} ... />
  <Switch label="Stats Admin-Only" disabled={isGalleriesOnly} ... />
  <NumberInput label="Fullscreen Content Max Width" disabled={isGalleriesOnly} ... />
</Box>
```

**Settings that remain always active** (relevant in both modes):
- Campaign Open Mode (the mode selector itself)
- Fullscreen Campaign Modal
- Modal Max Width
- Show Gallery Labels (labels appear above gallery sections)
- Show Admin Actions (visible in galleries-only mode via AuthBar)

### Files to modify
- `src/components/Admin/SettingsPanel.tsx` — Campaign Viewer tab: conditional disabled wrapper

### Acceptance Criteria
- [ ] Selecting "Galleries Only" immediately dims the affected toggles (smooth 200ms transition)
- [ ] Dimmed controls are non-interactive (`pointerEvents: none` + `disabled` prop)
- [ ] Helper text appears explaining the disabled state
- [ ] Switching back to "Full" immediately re-enables all controls
- [ ] Campaign Open Mode, Fullscreen toggle, Modal Max Width, Gallery Labels, and Admin Actions remain interactive in both modes
- [ ] Underlying setting values are preserved when toggling between modes (not reset)

---

## Track P22-M6 — Advanced Settings Audit & Reorganization

**Priority:** 🟢 Low — post-reorg cleanup
**Effort:** Small (1–2 hours)
**Depends on:** M2 (layout mode), M4 (Campaign Viewer tab)

### Problem

After introducing the layout mode dropdown (M2) and the Campaign Viewer tab (M4), several Advanced Settings need reassignment or gating:

1. **`photoNormalizeHeight`** and **`mosaicTargetRowHeight`** — buried in Advanced → Tile/Adapter but directly affect gallery appearance visible to all users. Should be surfaced.
2. **Cover mobile/tablet ratios** — relate to campaign cover image display, not general advanced tuning. Belong in Campaign Viewer tab.
3. **Content max width, gallery section gaps/margins** — these overlap with the new Manual layout mode's width controls. Need clarification on when each applies.
4. **`photoNormalizeHeight`** bug discovered during research — setting exists in UI but is completely ignored by `JustifiedGallery.tsx` (uses hardcoded 400 instead). Fixed in M7.

### Current State

Advanced → Modal/Viewer accordion:
- `coverMobileRatio`, `coverTabletRatio` — campaign cover image aspect ratios per breakpoint
- `closeButtonSize` — close button in campaign modal
- `fullscreenContentMaxWidth` — already in Campaign Viewer (General tab); duplicated?
- `campaignDescriptionLineHeight` — campaign viewer text formatting
- `mobileBreakpoint` — when to switch mobile layouts
- `modalGalleryGap`, `modalGalleryMargin` — spacing around gallery sections in the modal

Advanced → Tile/Adapter accordion:
- `photoNormalizeHeight` — justified gallery normalization (100–800, default 300)
- `mosaicTargetRowHeight` — justified gallery target row height
- Various hover, bounce, transition settings (fine where they are)

### Fix

**Step 1: Move cover settings to Campaign Viewer tab**

Move from Advanced → Modal/Viewer to Campaign Viewer tab:
- `coverMobileRatio` → Campaign Viewer tab, under a "Cover Image" sub-section
- `coverTabletRatio` → same
- `campaignDescriptionLineHeight` → Campaign Viewer tab, under "Text Formatting"
- `closeButtonSize` → Campaign Viewer tab, under "Modal Controls"

**Step 2: Surface gallery layout settings in Media Gallery tab**

Move from Advanced → Tile/Adapter to Media Gallery tab:
- `photoNormalizeHeight` → Media Gallery tab, under "Justified Gallery" sub-section
- `mosaicTargetRowHeight` → same sub-section

These are user-facing gallery appearance controls, not advanced tuning.

**Step 3: Clarify gallery spacing vs Manual mode width**

- `modalGalleryGap` — vertical gap between video/image gallery sections (Stack gap) → stays in Advanced (fine-tuning)
- `modalGalleryMargin` — horizontal padding around gallery container → stays in Advanced but add tooltip clarifying this is additional padding beyond Manual mode width constraints
- `modalGalleryMaxWidth` — if it exists, reconcile with `imageViewportWidth`/`videoViewportWidth` from M2

**Step 4: Remove duplicate `fullscreenContentMaxWidth`**

Check if `fullscreenContentMaxWidth` appears in both General and Advanced. If duplicated, remove from Advanced (canonical location is Campaign Viewer tab after M4).

### Files to modify
- `src/components/Admin/SettingsPanel.tsx` — Move controls between tabs/accordions
- `src/data/settingTooltips.ts` — Update/add tooltips for relocated settings

### Acceptance Criteria
- [ ] `photoNormalizeHeight` and `mosaicTargetRowHeight` are in the Media Gallery tab (not Advanced)
- [ ] Cover ratios and description line height are in the Campaign Viewer tab (not Advanced)
- [ ] No duplicate settings across tabs
- [ ] Advanced tab remains clean: only tuning values that most users shouldn't need to touch
- [ ] All relocated settings continue to save/load correctly via the same PHP pipeline
- [ ] Tooltips reflect the new context (e.g., "Controls image normalization in the justified gallery layout")

---

## Track P22-M7 — Justified Gallery Oversizing Fix

**Status:** Complete ✅
**Priority:** 🔴 High — gallery images are excessively large
**Effort:** Small (<1 hour)
**Depends on:** None

### Original Problem

`JustifiedGallery.tsx` computes photo dimensions for `react-photo-album`'s row-packing algorithm using a hardcoded `NORMALIZE_HEIGHT = 400`:

```tsx
// JustifiedGallery.tsx ~L60
const NORMALIZE_HEIGHT = 400;
const photos: RpaPhoto[] = enriched.map((item) => {
  const ratio = item.width / item.height;
  return {
    src: item.thumbnail || item.url,
    width: Math.round(NORMALIZE_HEIGHT * ratio),
    height: NORMALIZE_HEIGHT,
    ...
  };
});
```

**Issue 1: Settings disconnect** — `settings.photoNormalizeHeight` (default 300, range 100–800) is exposed in the Advanced UI as "Photo Normalize Height (px)" with a tooltip "Target height (px) for normalizing photo aspect ratios in the justified gallery." But the code completely ignores it and uses hardcoded 400. Users can adjust this setting all day with zero effect.

**Issue 2: Oversized rows** — The row constraint `singleRowMaxHeight: targetRowHeight * 2` (with default `targetRowHeight = 200`) allows rows up to 400px tall. Combined with the inflated normalize height of 400 (vs the intended 300), the row-packing algorithm produces rows that are far too tall, especially when there are few images or wide aspect ratios. A single wide image can fill an entire row at nearly 400px height.

### Current State

- `normalizeHeight = settings.photoNormalizeHeight ?? 300`
- `settings.mosaicTargetRowHeight` still controls the target row height
- `singleRowMaxHeight = Math.round(targetRowHeight * 1.5)`
- The exposed Advanced setting now affects the justified layout as intended

### Fix (Implemented)


**Step 1: Use the setting**

```diff
- const NORMALIZE_HEIGHT = 400;
+ const normalizeHeight = settings.photoNormalizeHeight ?? 300;
```

Replace all references to `NORMALIZE_HEIGHT` with `normalizeHeight`.

**Step 2: Tighten row height cap**

```diff
- rowConstraints={{ singleRowMaxHeight: targetRowHeight * 2 }}
+ rowConstraints={{ singleRowMaxHeight: Math.round(targetRowHeight * 1.5) }}
```

At default `targetRowHeight = 200`:
- Before: max row height = 400px (often hit with wide images)
- After: max row height = 300px (more balanced, still allows layout flexibility)

**Combined effect:**
- Normalize height: 400 → 300 (33% reduction in input dimensions to the packing algorithm)
- Max row height: 400px → 300px (25% reduction in worst-case row height)
- Images that previously filled a row at 400px height will now be constrained to ~300px — still prominent but not dominating the viewport

### Files to modify
- `src/gallery-adapters/justified/JustifiedGallery.tsx` — Replace `NORMALIZE_HEIGHT`, update `rowConstraints`

### Acceptance Criteria
- [x] Hardcoded `NORMALIZE_HEIGHT` is removed — uses `settings.photoNormalizeHeight`
- [x] Default behavior (300 normalize, 200 target row): justified gallery rows are visibly smaller than before
- [x] Changing `photoNormalizeHeight` in Advanced settings actually affects justified layout
- [x] Wide aspect ratio images (4:1, 3:1) no longer produce 400px-tall rows — capped at ~300px
- [x] Narrow images and mixed-ratio rows still produce aesthetically balanced justified layouts
- [x] `singleRowMaxHeight` is `targetRowHeight * 1.5` (300px at default)

### Implementation Result

The current `JustifiedGallery.tsx` implementation already reflects this fix. The adapter now uses `settings.photoNormalizeHeight ?? 300` instead of a hardcoded normalization height, and the row cap is tightened to `Math.round(targetRowHeight * 1.5)`.

---

## Track P22-M8 — Google Font URL Specification Fix

**Priority:** 🔴 High — fonts failing to load (HTTP 400 errors)
**Effort:** Medium (2–3 hours)
**Status:** Complete ✅ (committed as `57c81cb`)

### Problem

The universal URL template `:ital,wght@0,100..900;1,100..900` in `loadGoogleFont.ts` produces HTTP 400 errors for many Google Fonts. Different fonts require different CSS API v2 axis specifications:
- **Full-range variable fonts**: `ital,wght@0,100..900;1,100..900` (only ~6 fonts)
- **Restricted-range variable**: varying ranges like `ital,wght@0,300..800;1,300..800`
- **No-italic variable**: `wght@200..700` (no italic axis)
- **Static fonts** (Lato, Poppins, etc.): discrete weight values like `ital,wght@0,100;0,300;0,400;...`
- **Single-weight fonts** (Pacifico, Lobster, Satisfy): no axis specification needed

### Fix (Implemented)

1. **All 39 Google Fonts** in the app's font list were individually tested against the CSS API v2
2. A `GOOGLE_FONT_SPECS` map was created with verified per-font axis specifications in both:
   - `src/utils/loadGoogleFont.ts` (TypeScript, for admin preview)
   - `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` (PHP, for server-side `wp_enqueue_style`)
3. `loadGoogleFont()` was updated to look up per-font specs instead of the universal template
4. `class-wpsg-embed.php` server-side enqueue was updated to use `WPSG_Settings::GOOGLE_FONT_SPECS`

### Files modified
- `src/utils/loadGoogleFont.ts` — `GOOGLE_FONT_SPECS` map + `loadGoogleFont()` refactor
- `src/components/shared/TypographyEditor.tsx` — Console logging for fallback auto-selection (already existed)
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — `GOOGLE_FONT_SPECS` PHP constant
- `wp-plugin/wp-super-gallery/includes/class-wpsg-embed.php` — Server-side enqueue updated

### Acceptance Criteria
- [x] All 39 Google Fonts load without HTTP 400 errors
- [x] TypeScript compiles cleanly
- [x] All 1055 tests pass
- [x] Vite build succeeds
- [x] Committed as `57c81cb` on `feat/phase22-ux-fixes`

---

## Track P22-N — Fullscreen Gallery Sizing Semantics & Width Propagation

**Priority:** 🔴 High — fullscreen galleries do not honor the intended width settings contract
**Effort:** Medium (2–4 hours)
**Depends on:** None

### Problem

Fullscreen modal sizing still behaves inconsistently with the settings UI. The Campaign Viewer settings describe `fullscreenContentMaxWidth = 0` as full responsive width and `modalGalleryMaxWidth = 0` as full responsive width, but the fullscreen content wrapper in `CampaignViewer.tsx` still falls back to a static `64rem` max width. This means fullscreen mode can remain visibly clamped even when the admin has selected unconstrained sizing.

There is also a secondary container-contract issue inside the media section. The modal gallery wrapper, its inner `Stack`, and the local gallery section components do not consistently establish `width: '100%'` at the same points where they apply max-width constraints. That makes the current layout harder to reason about and leaves classic image/video carousels especially prone to looking artificially constrained.

This is separate from the already-implemented responsive height work in M1 and from the justified-gallery tuning in M7. The issue here is the fullscreen width contract and its propagation through `CampaignViewer`.

### Current State

- `CampaignViewer` fullscreen content wrapper falls back to a fixed `64rem` width when `fullscreenContentMaxWidth` is `0`
- The media gallery wrapper applies `modalGalleryMaxWidth`, but its descendants do not consistently declare `width: '100%'` where width inheritance is expected
- `ImageCarousel` and `VideoCarousel` still use fixed-height frames, which can exaggerate the appearance of width clamping on large screens even after the height logic itself is responsive
- `CompactGridGallery` already computes its own centered grid max width, while `JustifiedGallery` and `MasonryGallery` are more directly parent-width-driven

### Fix

**Phase N1: Restore correct fullscreen width semantics**
- Update `CampaignViewer` so `fullscreenContentMaxWidth = 0` means truly full responsive width in fullscreen mode
- Preserve the current non-fullscreen modal width behavior separately through `modalMaxWidth`

**Phase N2: Tighten width propagation through the media container chain**
- Add explicit `width: '100%'` where the fullscreen content wrapper, media wrapper, and inner `Stack` are expected to constrain descendants
- Thread `modalGalleryMaxWidth` through the local gallery section components so section wrappers participate in the same width contract

**Phase N3: Apply the same contract to classic carousels**
- Extend `ImageCarousel` and `VideoCarousel` to accept a width constraint from `CampaignViewer`
- Ensure their outer `Stack` and primary viewer/player frames use `width: '100%'` and honor an optional max-width value

**Phase N4: Adapter audit only if necessary after N1–N3**
- Verify `CompactGridGallery`, `JustifiedGallery`, `MasonryGallery`, and `LayoutBuilderGallery` after the wrapper fix lands
- Only add adapter-specific max-width handling if QA still reproduces incorrect fullscreen sizing

### Files to modify

- `src/components/Campaign/CampaignViewer.tsx` — fullscreen content semantics, media wrapper width contract, local gallery sections
- `src/components/Campaign/ImageCarousel.tsx` — classic image carousel width handling
- `src/components/Campaign/VideoCarousel.tsx` — classic video carousel width handling
- `src/gallery-adapters/compact-grid/CompactGridGallery.tsx` — verify whether existing `gridMaxWidth` logic is sufficient after container fixes
- `src/gallery-adapters/justified/JustifiedGallery.tsx` — verify parent-width behavior after container fixes
- `src/gallery-adapters/masonry/MasonryGallery.tsx` — verify parent-width behavior after container fixes
- `src/components/Admin/SettingsPanel.tsx` — descriptions already define the intended semantics; verify no copy changes are needed beyond consistency

### Acceptance Criteria

- [ ] `fullscreenContentMaxWidth = 0` produces true fullscreen responsive width with no fallback `64rem` clamp
- [ ] `fullscreenContentMaxWidth > 0` still produces a centered constrained content area in fullscreen mode
- [ ] `modalGalleryMaxWidth` is honored consistently by the gallery section path in fullscreen mode
- [ ] Classic image and video carousels fill the intended container width and no longer appear constrained by an unintentional wrapper cap
- [ ] At least one adapter-driven gallery is visually verified after the core fix to determine whether adapter-specific follow-up is required

### Decisions

- This track is intentionally separate from M1 and M7 because it addresses fullscreen width semantics, not height responsiveness or justified-row sizing
- The first implementation pass is limited to `CampaignViewer`, its local section wrappers, and the classic carousels
- Adapter-specific changes are follow-up work only if the core wrapper fix proves insufficient

---

## Track P22-O — Responsive Layout Controls & Breakpoint-Aware Settings

**Status:** In Progress 🚧
**Priority:** 🟡 Medium-High — needed for consistent designer control across desktop, tablet, and mobile
**Effort:** Medium-Large (4–8 hours)
**Depends on:** M2 follow-up for classic viewport restraint

### Problem

The repo already has responsive behavior and one production per-breakpoint settings pattern, but layout-oriented controls are still modeled and surfaced inconsistently. Some settings are global, some are split into one-off mobile/tablet fields, and some use explicit desktop/tablet/mobile grids. That makes responsive layout tuning harder than it needs to be and prevents designers from adjusting viewer and gallery behavior with the same confidence they get from Elementor-style responsive controls.

At the same time, the current classic gallery viewport restraint issue shows that desktop, tablet, and mobile should not necessarily share identical layout assumptions. The system needs a reusable breakpoint-aware model before more layout settings are expanded.

### Current State

- `useBreakpoint()` already provides container-aware `desktop | tablet | mobile` labels in runtime code
- Per-breakpoint gallery adapter selection already ships through `gallerySelectionMode` plus six adapter fields and `resolveAdapterId()`
- Several layout-related settings remain one-off or global, including classic gallery sizing, viewport heights, and viewer width constraints
- `SettingsPanel` does not yet have a reusable responsive-control shell; the existing per-breakpoint adapter UI is a dedicated 3x2 grid

### Fix

**Phase O1: Add responsive layout groundwork**
- Introduce a shared breakpoint-value resolver utility for layout settings
- Use the utility immediately in classic carousel viewport restraint logic so desktop, tablet, and mobile can apply different viewport budgets through a single resolution path

**Phase O2: Establish the inheritance model**
- Use desktop as the base value
- Allow tablet overrides that fall back to desktop
- Allow mobile overrides that fall back to tablet and then desktop
- Keep storage flat in the existing settings pipeline instead of introducing nested JSON blobs

**Phase O3: Build a reusable settings-shell pattern**
- Add an Elementor-inspired responsive selector control for eligible settings in `SettingsPanel`
- Show inherited vs overridden state clearly
- Provide a reset-to-inherit path for tablet/mobile overrides

**Phase O4: Roll out layout-oriented settings first**
- Limit the first rollout to Media Gallery and Campaign Viewer settings such as classic gallery height behavior, viewport heights, and viewer width constraints
- Leave broader migration of existing breakpoint-specific controls out of scope until the new pattern proves itself

### Files to modify

- `src/utils/resolveBreakpointValue.ts` — shared breakpoint-aware value resolution for future responsive layout settings
- `src/hooks/useBreakpoint.ts` — existing runtime breakpoint source used by responsive resolution
- `src/components/Campaign/ImageCarousel.tsx` — consume the shared resolver for viewport-constrained sizing behavior
- `src/components/Campaign/VideoCarousel.tsx` — same as `ImageCarousel`
- `src/components/Campaign/CampaignViewer.tsx` — future consumer for breakpoint-aware viewer sizing settings
- `src/components/Admin/SettingsPanel.tsx` — future home for the responsive control shell in Media Gallery and Campaign Viewer settings
- `src/types/index.ts` — future flat per-breakpoint layout fields and defaults
- `src/services/apiClient.ts` — future API typing for responsive layout fields
- `wp-plugin/wp-super-gallery/includes/class-wpsg-settings.php` — future defaults and sanitization for responsive layout overrides

### Acceptance Criteria

- [ ] A shared breakpoint-value resolver exists and is covered by unit tests
- [ ] Classic carousel viewport restraint uses the shared resolver and applies meaningfully different viewport budgets across desktop, tablet, and mobile
- [ ] The first responsive layout implementation keeps backward compatibility for installations with only base values set
- [ ] The next rollout target is clearly limited to Media Gallery and Campaign Viewer layout controls
- [ ] The responsive-control UI shell is tracked separately from the broader settings migration work

### Decisions

- This track is the implementation umbrella for responsive layout controls, but the first rollout remains intentionally narrow
- The repo will keep its existing three breakpoint buckets for now instead of coupling this work to custom breakpoint editing
- Responsive settings will use flat per-breakpoint fields plus shared resolution logic, not nested responsive objects
- The UI direction is Elementor-inspired but Mantine-native: a compact device selector with explicit inherited/override state instead of a full settings-wide rewrite in one pass
