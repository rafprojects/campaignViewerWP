# P25-P Pass 2 — Claude Opus 4.6 — Settings Regrouping Proposal

## Pass Metadata

- Track: P25-P
- Pass: 2 of 3
- Executed by: Claude Opus 4.6
- Date: 2026-04-01
- Focus: task-flow analysis, scanability audit, progressive disclosure strategy, and a concrete regrouping proposal
- Out of scope: side-panel feasibility (Pass 3), direct code changes

## Files Reviewed

- `src/components/Admin/SettingsPanel.tsx`
- `src/components/Settings/GeneralSettingsSection.tsx`
- `src/components/Settings/CampaignCardSettingsSection.tsx`
- `src/components/Settings/MediaDisplaySettingsSection.tsx`
- `src/components/Settings/GalleryLayoutSettingsSection.tsx`
- `src/components/Settings/GalleryAdapterSettingsSection.tsx`
- `src/components/Settings/GalleryPresentationSections.tsx`
- `src/components/Settings/GalleryLayoutDetailSections.tsx`
- `src/components/Settings/CampaignViewerSettingsSection.tsx`
- `src/components/Settings/AdvancedSettingsSection.tsx`
- `src/components/Settings/TypographySettingsSection.tsx`

## Current Surface Inventory

### Control counts by component

| Component | Leaf controls | Accordions | Dividers |
|---|---|---|---|
| GeneralSettingsSection | ~26 | 0 | 6 |
| CampaignCardSettingsSection | ~30 | 2 | 2 |
| MediaDisplaySettingsSection | ~48 | 5 | 5 |
| GalleryAdapterSettingsSection | ~8 + dynamic | 0 | 0 |
| GalleryPresentationSections | ~10 | 2 | 0 |
| GalleryLayoutDetailSections | ~28 | 3 | 3 |
| CampaignViewerSettingsSection | ~28 | 0 | 6 |
| AdvancedSettingsSection | ~58 | 8 | 1 |
| TypographySettingsSection | 16 × editor | 16 | 1 |

Total across all tabs: **~250+ discrete controls**, before counting the responsive config editor modal.

### Current tab structure

| Tab | Scope | Structure |
|---|---|---|
| General | Theme, layout defaults, app container, page header visibility, page background, auth bar, security, developer toggles | Flat with 6 dividers |
| Campaign Cards | Card appearance, card grid & pagination | 2 accordions |
| Media Display | Viewport dimensions, tile appearance, thumbnail strip, transitions, navigation (arrows + dots) | 5 accordions |
| Gallery Layout | Adapter selection, viewport backgrounds, gallery labels, carousel settings, section sizing, adapter sizing | 6 accordions across 3 composed sub-components |
| Campaign Viewer | Open mode, modal appearance, visibility toggles, modal background, cover image, modal controls | Flat with 6 dividers |
| Advanced | Card internals, gallery text, modal/viewer chrome, upload/media, tile/adapter, lightbox, navigation, system, data maintenance | 8 accordions |
| Typography | Font library manager + 16 element overrides | 16 accordions |

## Part 1: Task-Flow Analysis

The strongest way to evaluate a settings IA is to walk through the tasks users actually perform. I identified six primary user workflows and traced the tab hops each one requires.

### Task A: First-time setup

A new user configuring the plugin for the first time needs to:
1. Pick a theme → **General**
2. Set container width and padding → **General**
3. Choose default layout → **General**
4. Customize campaign cards → **Campaign Cards**
5. Open a campaign, configure modal behavior → **Campaign Viewer**
6. Adjust media display preferences → **Media Display**

Assessment: **4 tabs, linear progression. This flow works well.** The tab order in the UI roughly matches the setup order.

### Task B: Customize how a campaign card looks

1. Card shape, borders, shadow, thumbnail → **Campaign Cards > Card Appearance**
2. Card grid columns, gaps, pagination → **Campaign Cards > Card Grid & Pagination**
3. Card opacity, icon sizes, hover timing → **Advanced > Card Appearance**
4. Card title/description font styling → **Typography > Card Title, Card Description**

Assessment: **3 tabs.** The split between Campaign Cards (design controls) and Advanced (opacity/timing internals) is reasonable as a progressive disclosure tier. Typography as a separate font-styling layer is standard. This flow is acceptable.

### Task C: Configure the campaign viewer modal

This is the single most expensive workflow in the current IA:

1. Choose fullscreen vs windowed, set modal sizing → **Campaign Viewer**
2. Set modal appearance, transitions → **Campaign Viewer**
3. Toggle content visibility (about, stats, tags, etc.) → **Campaign Viewer**
4. Toggle gallery label visibility → **Campaign Viewer**
5. Set gallery label text and justification → **Gallery Layout > Gallery Labels**
6. Set gallery section sizing, vertical alignment, max width → **Gallery Layout > Section Sizing**
7. Toggle page-level gallery title/subtitle visibility → **General > Viewer Header Visibility**
8. Edit gallery title/subtitle text → **Advanced > Gallery Text**
9. Edit campaign about heading text → **Advanced > Gallery Text**
10. Set modal background → **Campaign Viewer**
11. Set viewport backgrounds → **Gallery Layout > Viewport Backgrounds**
12. Fine-tune modal close button, mobile breakpoint → **Advanced > Modal / Viewer**
13. Style campaign typography → **Typography**

Assessment: **6 tabs touched for one conceptual object.** This is the worst-performing workflow. A user trying to fully configure the campaign viewer experience must visit every single tab except Campaign Cards. The problem is not the number of tabs — it is that the campaign viewer's concerns are scattered with no obvious trail from one stop to the next.

### Task D: Set up backgrounds

1. Page-level gallery background → **General > Viewer Background**
2. Campaign modal background → **Campaign Viewer > Modal Background (Fullscreen)**
3. Image gallery viewport background → **Gallery Layout > Viewport Backgrounds**
4. Video gallery viewport background → **Gallery Layout > Viewport Backgrounds**
5. Unified gallery viewport background → **Gallery Layout > Viewport Backgrounds**

Assessment: **3 tabs.** All five background configs use nearly identical UI patterns (type picker → color/gradient/image fields), but they live in 3 different tabs with 3 different section names. The user sees nearly identical controls each time and must remember which scope they are in.

### Task E: Fine-tune media gallery behavior

1. Lightbox, animations, viewport sizing, border radius, shadows → **Media Display > Viewport & Layout**
2. Tile gaps, borders, hover effects → **Media Display > Tile Appearance**
3. Thumbnail strip dimensions, scroll behavior → **Media Display > Thumbnail Strip**
4. Transition type, duration, easing → **Media Display > Transitions**
5. Arrows and dots → **Media Display > Navigation**
6. Choose adapters per breakpoint → **Gallery Layout > Gallery Adapters**
7. Section sizing and padding → **Gallery Layout > Section Sizing**
8. Adapter sizing mode → **Gallery Layout > Adapter Sizing**
9. Carousel settings → **Gallery Layout > Carousel Settings**
10. Tile/adapter internal tuning → **Advanced > Tile / Adapter**
11. Lightbox internals → **Advanced > Lightbox**
12. Navigation internals → **Advanced > Navigation**

Assessment: **3 tabs.** But combined these three tabs present ~130 controls with overlapping vocabularies (viewport, tile, adapter, gallery section). The boundary between "Media Display" and "Gallery Layout" is implementation-driven. From the user's perspective, both tabs answer the same question: "how does my gallery media look and behave?"

### Task F: Configure text content and styling

1. Toggle gallery title/subtitle visibility → **General**
2. Toggle campaign about/description/stats visibility → **Campaign Viewer**
3. Edit gallery title/subtitle/about heading text → **Advanced > Gallery Text**
4. Edit gallery label text → **Gallery Layout > Gallery Labels**
5. Style all text elements → **Typography**

Assessment: **5 tabs for one concept.** Visibility, content, and styling for the same text elements are in three different places with no cross-references.

### Task-Flow Summary

| Task | Tabs touched | Verdict |
|---|---|---|
| First-time setup | 4 | Acceptable |
| Card customization | 3 | Acceptable |
| Campaign viewer config | 6 | Severe fragmentation |
| Background setup | 3 | Moderate fragmentation |
| Media gallery tuning | 3 | Moderate (unclear boundary) |
| Text content & styling | 5 | Severe fragmentation |

The two severe cases share a common root cause: controls that belong to the same user-facing concept are distributed by implementation layer (visibility vs. content vs. style vs. internals) rather than by the concept itself.

## Part 2: Scanability Audit

Scanability measures how quickly a user can locate a specific control. Three structural issues reduce scanability in the current layout.

### Issue 1: General tab has no internal grouping mechanism

General is a flat stack of 26 controls organized only by `<Divider>` labels. It contains 6 distinct topic areas (theme, container, header visibility, background, auth bar, security/developer) with no collapse or accordion mechanism. A user looking for the auth bar display mode must scroll past all header visibility and background controls.

Every other multi-topic tab uses accordions. General is the exception.

### Issue 2: Campaign Viewer uses dividers where accordions would help

Campaign Viewer has 28 controls in a flat stack with 6 divider labels. The visibility section alone has 10 switches. When a user opens this tab looking for "modal background", they must scroll past the open mode section, the appearance section, and all 10 visibility switches to reach it.

Contrast with Campaign Cards, which uses 2 accordions and is immediately scannable.

### Issue 3: Advanced accordion labels do not indicate scope

The 8 Advanced accordion titles are:
- Card Appearance
- Gallery Text
- Modal / Viewer
- Upload / Media
- Tile / Adapter
- Lightbox
- Navigation
- System
- Data Maintenance

"Card Appearance" also appears as an accordion title in Campaign Cards. "Navigation" also appears in Media Display. A user scanning accordion titles across tabs encounters the same words in different places with different scopes.

### Issue 4: Gallery Layout is a composed component with no top-level framing

Gallery Layout renders 3 sub-components (`GalleryAdapterSettingsSection`, `GalleryPresentationSections`, `GalleryLayoutDetailSections`) as siblings within a single Accordion. The user sees up to 6 accordion items with no group boundaries between "adapters", "presentation", and "layout details". Nothing in the UI signals where one sub-component's concerns end and another's begin.

### Issue 5: Section Sizing accordion contains modal-prefixed settings

Within Gallery Layout > Section Sizing & Spacing, the settings `modalContentVerticalAlign`, `modalGalleryMaxWidth`, `modalGalleryGap`, and `modalGalleryMargin` use "modal" naming. These are gallery layout properties that happen to live inside the campaign viewer modal, but their placement under "Gallery Layout" tab with "Gallery Spacing" divider label gives no cue that they control in-modal layout. A user looking for "modal gallery max width" would likely search the Campaign Viewer tab first.

## Part 3: Progressive Disclosure Assessment

### Current disclosure model

The existing model has exactly one gate: the `Enable Advanced Settings` toggle in General. It controls whether the entire Advanced tab appears. This is binary: everything behind the gate is either fully visible or fully hidden.

### What is hidden that should not be

Several controls behind the Advanced gate are not "advanced" by any reasonable definition:

| Control | Current location | Why it is not advanced |
|---|---|---|
| Gallery Title text | Advanced > Gallery Text | Basic content string |
| Gallery Subtitle text | Advanced > Gallery Text | Basic content string |
| Campaign About Heading text | Advanced > Gallery Text | Basic content string |
| Upload Max Size (MB) | Advanced > Upload / Media | Admin setup |
| Allowed Upload Types | Advanced > Upload / Media | Admin setup |
| Preserve data on uninstall | Advanced > System | Admin setup |
| Archive Purge Days | Advanced > Data Maintenance | Admin/operational |
| Trash Grace Period | Advanced > Data Maintenance | Admin/operational |
| Analytics Retention | Advanced > Data Maintenance | Admin/operational |

These are standard administrative controls that a non-power-user site owner would reasonably need.

### What is exposed that could benefit from gating

Several controls in the primary tabs are detailed tuning that most users would never change:

| Control | Current location | Why it could be gated |
|---|---|---|
| Cover Mobile/Tablet Ratio sliders | Campaign Viewer | Fine-tuning responsive ratios |
| Description Line Height slider | Campaign Viewer | Typographic detail |
| Hex/Diamond Vertical Overlap Ratio | Advanced > Tile / Adapter | Shape-adapter-specific internal |
| Hex/Diamond Clip Path | Advanced > Tile / Adapter | CSS internals |
| Viewport Height Mobile/Tablet Ratio | Advanced > Navigation | Responsive internals |
| SWR Deduping Interval | Advanced > Upload / Media | Framework internals |
| Notification Dismiss ms | Advanced > Upload / Media | Framework internals |

### Recommended disclosure tiers

Rather than one binary gate, the settings surface should support three conceptual tiers:

1. **Primary** — controls every user needs: theme, layout, visibility toggles, card appearance, campaign viewer setup, background selections, text content strings
2. **Power User** — controls for users who want design precision: tile hover effects, transitions, carousel behavior, adapter sizing, navigation customization, typography overrides
3. **Internal** — controls that are implementation constants or admin operations: opacities, durations in ms, clip paths, overlap ratios, breakpoint strings, cache TTLs, z-indices, data retention policies

The current Advanced tab conflates tiers 2 and 3. A better model would let the Power User tier surface inline within relevant primary tabs (behind expandable sections), and reserve the Internal tier for a true advanced/system area.

## Part 4: Regrouping Proposal

### Proposed tab structure: 6 tabs

The proposal reduces from 7 tabs to 6 by merging Media Display and Gallery Layout into a single tab, while splitting current Advanced content into appropriate homes.

#### Tab 1: Page & Theme

Renamed from "General". Owns everything about the gallery page shell before any campaign is opened.

| Section (accordion) | Controls | Source |
|---|---|---|
| Theme & Layout | Theme selector, default layout, items per page | General (top) |
| Page Container | App max width, container padding, WP full bleed (3 breakpoints) | General > App Container |
| Page Header | Show gallery title/subtitle, gallery title text, gallery subtitle text, show access mode, show filter tabs, show search box | General > Viewer Header Visibility + Advanced > Gallery Text |
| Page Background | Background type, color, gradient, header border | General > Viewer Background |
| Auth Bar | Display mode, drag margin, backdrop blur, mobile breakpoint | General > Auth Bar + Advanced > System (2 auth bar controls) |
| Security & Login | Session idle timeout, min password length, login form max width, expiry warning threshold | General > Security + Advanced > System |

What changes:
- Gallery title/subtitle text strings move from Advanced > Gallery Text into Page Header, next to the visibility toggles that control whether those strings are shown. One concept, one place.
- Two auth bar controls from Advanced > System join the Auth Bar section.
- Security controls from Advanced > System join the existing Security section.
- Developer toggles (Enable Advanced, Show Tooltips) move to the footer of this tab or become a global gear icon, since they are meta-controls about the settings UI itself rather than gallery configuration.

Control count: ~28 across 6 accordions. Comparable to current General but now accordion-organized for scanability.

#### Tab 2: Campaign Cards

Unchanged in scope. Already well-organized.

| Section (accordion) | Controls | Source |
|---|---|---|
| Card Appearance | Border radius, border width, border color mode/color, shadow, thumbnail height/fit, 8 visibility switches | CampaignCardSettingsSection > appearance |
| Card Grid & Pagination | Columns, gaps, max width, justification, aspect ratio, min height, display mode, pagination controls | CampaignCardSettingsSection > grid-pagination |
| Card Internals *(Power User)* | Locked opacity, gradient opacities, icon sizes, badge offset, company badge width, hover transition ms, page transition opacity, auto column breakpoints | Advanced > Card Appearance |

What changes:
- Advanced > Card Appearance moves here as a third accordion explicitly labeled for power users. This keeps card-related tuning consolidated in the card tab rather than requiring Advanced.

Control count: ~40 across 3 accordions.

#### Tab 3: Campaign Viewer

Expanded to own its full vertical slice. Converted from flat dividers to accordions.

| Section (accordion) | Controls | Source |
|---|---|---|
| Open Mode & Sizing | Fullscreen toggle, open mode, fullscreen/modal max width, content max width, inner padding, modal max height | Campaign Viewer > Open Mode |
| Modal Appearance | Cover image height, transition style, transition duration, close button size, close button bg color, mobile breakpoint | Campaign Viewer > Modal Appearance + Advanced > Modal / Viewer |
| Content Visibility | 10 visibility switches (company name, date, about, description, stats, stats admin-only, cover image, tags, admin actions, gallery labels) + campaign about heading text | Campaign Viewer > Visibility + Advanced > Gallery Text |
| Gallery Labels | Image/video gallery label text, label justification, show label icon | Gallery Layout > Gallery Labels |
| Modal Background | Background type, color, gradient | Campaign Viewer > Modal Background |
| Cover Image & Responsive | Cover image height, mobile/tablet ratio sliders, description line height | Campaign Viewer > Cover Image + Modal Controls |

What changes:
- Gallery Labels accordion moves from Gallery Layout to Campaign Viewer. Gallery labels are a campaign viewer feature: they label the galleries within the campaign viewer. The toggle that controls label visibility (`showCampaignGalleryLabels`) already lives in Campaign Viewer. Now the label text, justification, and icon toggle join it.
- Campaign about heading text moves from Advanced > Gallery Text into Content Visibility, next to the `Show About Section` toggle.
- Modal close button bg color and modal mobile breakpoint move from Advanced > Modal / Viewer into Modal Appearance.
- The duplicate `modalContentMaxWidth` in Advanced > Modal / Viewer is eliminated; the control in Open Mode & Sizing is the single owner.
- Flat divider layout is replaced with accordions for consistent scanability.

Control count: ~32 across 6 accordions. Slightly larger than current Campaign Viewer, but better organized with collapse.

#### Tab 4: Gallery & Media

Merges current Media Display and Gallery Layout into one tab. This reflects the user's mental model: all of these controls answer "how does my media gallery look and behave?"

| Section (accordion) | Controls | Source |
|---|---|---|
| Gallery Adapters | Unified mode switch, per-breakpoint adapter selectors, Edit Responsive Config button, inline adapter settings | Gallery Layout > Gallery Adapters |
| Viewport & Layout | Lightbox enable, animations enable, height constraint, manual height, image/video border radius, image/video shadow presets | Media Display > Viewport & Layout |
| Viewport Backgrounds | Image/video/unified gallery backgrounds (type, color, gradient, image URL) | Gallery Layout > Viewport Backgrounds |
| Tile Appearance | Gap x/y, border width/color, hover bounce, hover glow (color, spread) | Media Display > Tile Appearance |
| Thumbnail Strip | Video/image thumb dimensions, gap, wheel scroll, drag scroll, scroll buttons | Media Display > Thumbnail Strip |
| Section Sizing & Layout | Section max/min width, height mode, section/adapter padding, equal height, vertical alignment, gallery max width/gap/margin, adapter sizing mode/dimensions, adapter item gap/justification | Gallery Layout > Section Sizing + Adapter Sizing |
| Carousel | Visible cards, slide gap, loop, drag, autoplay settings, darken/fade effects | Gallery Layout > Carousel Settings |
| Transitions | Fade, transition type, scroll animation style, duration, easing | Media Display > Transitions |
| Navigation | Scroll speed, arrow (position, size, color, bg, border, hover scale, auto-hide), dot navigator (enable, position, size, shape, colors, spacing, active scale) | Media Display > Navigation |

What changes:
- Media Display and Gallery Layout merge because their boundary is artificial. A user configuring gallery media appearance should not have to decide whether a control is about "display" or "layout".
- Section Sizing and Adapter Sizing merge into one accordion because they both answer "how big are the gallery sections?"
- Gallery Labels moves to Campaign Viewer (see Tab 3).
- The combined tab has 9 accordions, which is high. But with accordion collapse, only one section is open at a time, so scanability is controlled by label quality rather than count.

Control count: ~94 across 9 accordions. High, but each accordion is focused.

#### Tab 5: System & Admin

Replaces the current Advanced tab for non-design administrative controls. Only visible when `Enable Advanced Settings` is on.

| Section (accordion) | Controls | Source |
|---|---|---|
| Upload & Media | Upload max size, allowed types, library page size, media list page size, media card heights (4), media list min width, image optimization (6 controls), thumbnail cache TTL | Advanced > Upload / Media |
| Tile & Adapter Internals | Hover overlay opacity, bounce scales, bounce/transition durations, overlap ratios, clip paths, default per row, masonry breakpoints, grid card shadows/scale | Advanced > Tile / Adapter |
| Lightbox Internals | Transition ms, backdrop color, entry scale, video dimensions, media max height, z-index | Advanced > Lightbox |
| Navigation Internals | Max visible dots, arrow edge inset, min hit target, fade/scale durations, viewport height ratios, search input min/max width | Advanced > Navigation |
| Data Maintenance | Archive purge, trash grace period, analytics retention, preserve data on uninstall | Advanced > Data Maintenance + System |
| System | SWR deduping, notification dismiss, admin search debounce | Advanced > System (remainder) |

What changes:
- Tab renamed from "Advanced" to "System & Admin" to accurately describe its contents.
- Card Appearance, Gallery Text, and Modal / Viewer accordions are gone — their contents have been distributed to their conceptual owners (Tabs 1–3).
- What remains is genuinely internal: framework timing constants, shape geometry, upload policies, and data lifecycle.

Control count: ~52 across 6 accordions.

#### Tab 6: Typography

Unchanged. Already well-isolated and clean.

### Tab comparison

| Current | Proposed | Net change |
|---|---|---|
| General (26 controls, flat) | Page & Theme (28 controls, 6 accordions) | Gains accordion structure and text content |
| Campaign Cards (30 controls, 2 accordions) | Campaign Cards (40 controls, 3 accordions) | Gains Card Internals from Advanced |
| Media Display (48 controls, 5 accordions) | *(merged into Gallery & Media)* | — |
| Gallery Layout (46 controls, 6 accordions) | *(merged into Gallery & Media)* | — |
| — | Gallery & Media (94 controls, 9 accordions) | Merged from two tabs |
| Campaign Viewer (28 controls, flat) | Campaign Viewer (32 controls, 6 accordions) | Gains accordion structure and label/text ownership |
| Advanced (58 controls, 8 accordions) | System & Admin (52 controls, 6 accordions) | Loses non-admin controls to their owners |
| Typography (16 editors, 16 accordions) | Typography (unchanged) | — |
| **7 tabs** | **6 tabs** | **−1 tab** |

## Part 5: Migration Checklist

### Settings key relocations

| Setting key | Current tab | Proposed tab | Reason |
|---|---|---|---|
| `galleryTitleText` | Advanced > Gallery Text | Page & Theme > Page Header | Next to `showGalleryTitle` toggle |
| `gallerySubtitleText` | Advanced > Gallery Text | Page & Theme > Page Header | Next to `showGallerySubtitle` toggle |
| `campaignAboutHeadingText` | Advanced > Gallery Text | Campaign Viewer > Content Visibility | Next to `showCampaignAbout` toggle |
| `modalContentMaxWidth` (Advanced copy) | Advanced > Modal / Viewer | **Deleted** (duplicate) | Single owner in Campaign Viewer |
| `modalCloseButtonBgColor` | Advanced > Modal / Viewer | Campaign Viewer > Modal Appearance | Visual chrome, not an internal |
| `modalMobileBreakpoint` | Advanced > Modal / Viewer | Campaign Viewer > Modal Appearance | Modal behavior, not an internal |
| `galleryImageLabel` | Gallery Layout > Gallery Labels | Campaign Viewer > Gallery Labels | Labels are a viewer feature |
| `galleryVideoLabel` | Gallery Layout > Gallery Labels | Campaign Viewer > Gallery Labels | Labels are a viewer feature |
| `galleryLabelJustification` | Gallery Layout > Gallery Labels | Campaign Viewer > Gallery Labels | Labels are a viewer feature |
| `showGalleryLabelIcon` | Gallery Layout > Gallery Labels | Campaign Viewer > Gallery Labels | Labels are a viewer feature |
| `authBarBackdropBlur` | Advanced > System | Page & Theme > Auth Bar | Auth bar visual property |
| `authBarMobileBreakpoint` | Advanced > System | Page & Theme > Auth Bar | Auth bar behavior |
| Card Appearance (8 controls) | Advanced > Card Appearance | Campaign Cards > Card Internals | Card tuning stays with cards |
| `preserveDataOnUninstall` | Advanced > System | System & Admin > Data Maintenance | Admin lifecycle, not visual |

### Controls that stay in place

The majority of controls do not move. The relocated set is ~25 controls out of ~250+, which is a modest migration.

### Component file impact

| Current file | Change |
|---|---|
| `GeneralSettingsSection.tsx` | Rename to `PageThemeSettingsSection.tsx`, add accordion structure, add 3 text inputs and 4 relocated controls |
| `CampaignCardSettingsSection.tsx` | Add Card Internals accordion (content from AdvancedSettingsSection) |
| `MediaDisplaySettingsSection.tsx` | Merge with GalleryLayout components into new `GalleryMediaSettingsSection.tsx` |
| `GalleryLayoutSettingsSection.tsx` | Absorbed into `GalleryMediaSettingsSection.tsx`, remove Gallery Labels |
| `GalleryPresentationSections.tsx` | Absorbed into `GalleryMediaSettingsSection.tsx`, Gallery Labels accordion moves to Campaign Viewer |
| `GalleryLayoutDetailSections.tsx` | Absorbed into `GalleryMediaSettingsSection.tsx` |
| `CampaignViewerSettingsSection.tsx` | Add accordion structure, add Gallery Labels section, add about heading text |
| `AdvancedSettingsSection.tsx` | Rename to `SystemAdminSettingsSection.tsx`, remove Card Appearance/Gallery Text/Modal Viewer sections |
| `TypographySettingsSection.tsx` | No change |
| `SettingsPanel.tsx` | Update tab list (6 tabs), update imports |

## Part 6: Risks and Trade-offs

### Risk 1: Gallery & Media becomes the largest tab

At 94 controls across 9 accordions, this is a dense tab. Mitigations:
- Accordion collapse means only one section is visible at a time.
- The 9 accordion labels scan well because they map to distinct sub-systems (adapters, viewport, backgrounds, tiles, thumbnails, sizing, carousel, transitions, navigation).
- The alternative — keeping two tabs with an unclear boundary — is worse for findability.

### Risk 2: Campaign Viewer grows in scope

Campaign Viewer gains Gallery Labels and a few controls from Advanced. The risk is that it becomes the new dumping ground. Mitigation: the added controls are directly related to the campaign viewer experience. The scope rule is clear: "everything the user sees after opening a campaign."

### Risk 3: Moving controls breaks muscle memory for existing users

Any relocation breaks the expectations of users who have learned the current layout. Mitigation: this is a WordPress admin plugin with a configuration surface, not a high-frequency trading UI. Settings are configured once and rarely revisited. The long-term findability improvement outweighs the one-time relearning cost.

### Risk 4: The responsive config modal relationship

The "Edit Responsive Config" button stays in Gallery & Media > Gallery Adapters. Its relationship to the inline adapter selectors is clearer in the merged tab because both are under the same "Gallery Adapters" accordion rather than being the only thing in a separate tab's first accordion.

## Part 7: Principles Applied

This proposal applies five information architecture principles:

1. **Concept ownership**: Each user concept has one primary home. Gallery labels live in one tab. Background types live in scoped sections with explicit scope names. Text content lives next to visibility toggles.

2. **Task-flow locality**: controls touched in sequence during a single user task are co-located. The campaign viewer configuration workflow drops from 6 tabs to 2 (Campaign Viewer + Typography).

3. **Consistent structure**: all tabs use accordion sections. No more flat-with-dividers tabs that behave differently from accordion-organized tabs.

4. **Scope-explicit labeling**: the proposal renames "General" to "Page & Theme" and "Advanced" to "System & Admin" to communicate their actual scope rather than relying on vague generality.

5. **Progressive disclosure by intent**: the three tiers (primary → power user → internal) align with user intent rather than implementation layer. Power user controls surface inline within relevant tabs. Internal controls are isolated in System & Admin.

## Handoff To Pass 3

Pass 3 should evaluate whether a side-panel architecture (persistent, always-visible settings surface) would improve or worsen the structural model proposed here. Key questions for Pass 3:

1. Does an always-visible side panel reduce the tab-hop cost enough to weaken the case for regrouping, or is regrouping still needed regardless of container shape?
2. How does an always-visible panel interact with the campaign viewer modal, which itself sits at z-index 450? Would the panel need to share space with an open modal, or would it overlay?
3. What is the minimum viable panel width for this control density? The current modal is `size="lg"` (~900px). A side panel narrower than ~400px would require significant control layout changes (especially the breakpoint adapter grid).
4. Could a hybrid model work: side panel for the merged Gallery & Media and Campaign Viewer tabs (the densest workflow areas), with a modal retained for Page & Theme and System & Admin (infrequent configuration)?
