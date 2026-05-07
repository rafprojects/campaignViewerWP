# P25-P Pass 1 - GPT-5.4 - Settings Redundancy Audit

## Pass Metadata

- Track: P25-P
- Pass: 1 of 3
- Executed by: GPT-5.4
- Date: 2026-04-01
- Focus: redundancy, overlap, and scope-confusion audit across the current Settings surface
- Out of scope: final regrouping proposal, side-panel implementation design, and direct code changes

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

## Current Surface Map

The current modal exposes seven top-level tabs when Advanced is enabled:

1. General
2. Campaign Cards
3. Media Display
4. Gallery Layout
5. Campaign Viewer
6. Advanced
7. Typography

The largest overlap pressure points are not the tab count alone. They come from the same user mental model being split across multiple tabs:

- page-shell viewer settings in `General`
- campaign modal settings in `Campaign Viewer`
- media viewport settings in `Media Display`
- gallery-section and adapter composition settings in `Gallery Layout`
- fine-grained overrides and system knobs in `Advanced`

That means a user who thinks in terms like "background", "viewer", "labels", "width", or "navigation" has to infer scope before they can even choose the right tab.

## Confirmed Direct Duplication

### 1. `modalContentMaxWidth` is exposed twice

This is the clearest true duplicate in the current surface.

- `CampaignViewerSettingsSection` exposes `Content Max Width (px)` as a primary viewer control.
- `AdvancedSettingsSection` exposes the same setting key, `modalContentMaxWidth`, again under `Modal / Viewer`.

This is not just similar wording. It is the same underlying setting surfaced in two places.

### 2. Several literal labels repeat with different scopes

The audit of literal `label="..."` strings shows these repeated user-facing labels:

- `Background Type`
- `Background Color`
- `Border Width (px)`
- `Border Color`
- `Dot Navigator`
- `Autoplay`

These are not always duplicate keys, but they are duplicate labels. The current UI relies on surrounding section context to disambiguate them.

## Redundancy And Overlap Findings

### Finding 1. "Viewer" is overloaded across three different scopes

The current UI uses the language of "viewer" for at least three different things:

- the gallery page shell in `General`
- the campaign modal in `Campaign Viewer`
- the gallery media viewports and sections in `Media Display` and `Gallery Layout`

Examples:

- `General` owns `Viewer Header Visibility` and `Viewer Background`.
- `Campaign Viewer` owns modal open mode, modal sizing, modal visibility, and modal background.
- `Gallery Layout` owns gallery section sizing, vertical alignment, gallery max width, and gallery spacing.

The result is not only breadth. It is scope ambiguity. A user looking for "viewer background" or "viewer sizing" has to guess whether the product means page shell, modal shell, or media section.

### Finding 2. Background treatment is fragmented across three tabs

Background configuration currently lives in three places:

- `General`: page-level gallery container background (`viewerBgType`, `viewerBgColor`, `viewerBgGradient`)
- `Campaign Viewer`: fullscreen modal background (`modalBgType`, `modalBgColor`, `modalBgGradient`)
- `Gallery Layout`: image/video/unified viewport backgrounds (`imageBgType`, `videoBgType`, `unifiedBgType`, etc.)

These are legitimate different scopes, but they are presented with nearly identical labels and very similar interaction patterns. This creates redundancy in the user's mental model even when the underlying keys differ.

The upcoming `blur` work in P25-R will increase this pressure unless the scopes are renamed more explicitly.

### Finding 3. Gallery label controls are split between visibility and styling tabs

The control that turns gallery labels on or off lives in `Campaign Viewer` (`showCampaignGalleryLabels`), while the controls that edit label text and styling live in `Gallery Layout` (`galleryImageLabel`, `galleryVideoLabel`, `galleryLabelJustification`, `showGalleryLabelIcon`).

That means one concept, gallery labels, is split between:

- whether labels are shown
- what the labels say
- how the labels look

This is not fatal, but it is a classic IA smell. Users who want to configure labels must visit two tabs that do not read as related at first glance.

### Finding 4. Text visibility, text content, and text styling are split across three tabs

Text-related settings are currently divided across:

- `General`: visibility of gallery title and subtitle
- `Campaign Viewer`: visibility of campaign description, tags, stats, and about section
- `Advanced`: actual string content such as `galleryTitleText`, `gallerySubtitleText`, and `campaignAboutHeadingText`
- `Typography`: font-level overrides for those same content areas

This creates a multi-tab dependency chain:

1. decide if the text is visible
2. edit what the text says
3. edit how the text looks

That split may be technically clean, but it is not scan-friendly for a human settings flow.

### Finding 5. Campaign card controls are split into "basic appearance" and "advanced appearance" without a strong boundary

`Campaign Cards` owns the user-facing card appearance settings, while `Advanced > Card Appearance` owns card opacity, badge offsets, hover timing, auto-column breakpoints, and related internals.

This is a valid two-tier model in principle, but the boundary is not obvious enough yet:

- both sections use card-appearance language
- both change visible card presentation
- some Advanced controls feel like hidden implementation constants, while others feel like legitimate design controls

The result is that "Card Appearance" exists twice, but the user has to infer which version is safe to use and which version is tuning internals.

### Finding 6. Media behavior is split between `Media Display`, `Gallery Layout`, and `Advanced`

A user trying to control how gallery media behaves must currently look across:

- `Media Display`: lightbox enablement, animations, viewport dimensions, thumbnail strip, transitions, navigation
- `Gallery Layout`: adapter sizing, carousel behavior, section sizing, vertical alignment
- `Advanced`: tile/adapter internals, lightbox internals, navigation internals, viewport ratios

This is the heaviest overlap cluster in the product. Even when the keys are distinct, the tabs are all talking about rendering, motion, layout, and navigation.

The current separation appears implementation-driven rather than task-driven.

### Finding 7. Responsive config has two competing entry surfaces

`Gallery Layout` exposes:

- inline quick breakpoint selectors
- a full `Edit Responsive Config` modal entry point

That is intentionally useful, but it also introduces a two-surface model for the same conceptual area. Users can do some layout work inline and deeper layout work in the nested editor, which risks a "which one is authoritative?" feeling even if the data model is correct.

This is not a bug. It is an IA pressure point.

### Finding 8. The Advanced tab mixes product-facing tuning with system/admin controls

`Advanced` currently includes:

- card rendering internals
- gallery text content
- modal/viewer internals
- upload/media admin behavior
- lightbox internals
- navigation internals
- system settings
- data-maintenance settings

That is too many conceptual layers for one tab. It reduces the meaning of "Advanced" to "everything that did not fit elsewhere."

This is less about duplicate keys and more about redundancy of purpose. The tab is acting as both:

- a power-user visual tuning area
- an admin/system configuration area

Those are different jobs.

## Pass 1 Conclusions

### Strongest confirmed issues

1. `modalContentMaxWidth` is a real duplicate and should have a single owner.
2. Scope naming is the main structural problem. "Viewer", "background", "layout", and "navigation" all span multiple tabs with weak scope cues.
3. Gallery labels and text controls are fragmented across visibility, content, and styling tabs.
4. `Advanced` is currently overloaded and needs a stricter definition before the overall IA can feel coherent.

### What does not look like a problem yet

1. Separate `Campaign Cards` and `Campaign Viewer` tabs still make sense as top-level concepts.
2. `Typography` as a dedicated tab still makes sense, but it should be treated as a styling layer that depends on clearer content ownership elsewhere.
3. The responsive config modal remains valuable, but its relationship to the inline Gallery Layout surface needs a clearer rule.

## Pass 1 Recommendations For Pass 2

Pass 2 should build on this audit with a concrete regrouping proposal, using these rules:

1. One user concept should have one primary owner tab.
2. Repeated treatments should be scope-prefixed in the label itself, not only by surrounding section headings.
3. Visibility, content, and appearance for the same concept should be grouped more tightly.
4. `Advanced` should be narrowed to true expert or internal tuning, not general product configuration.
5. Inline responsive quick controls and the responsive config modal should be presented as a clear tiered workflow, not parallel destinations.

## Suggested Starting Questions For Pass 2

1. Should page-shell controls be renamed from "Viewer" to "Gallery Page" or equivalent to separate them from campaign modal controls?
2. Should gallery label visibility, label text, and label style live together under one gallery-label cluster?
3. Which current `Advanced` groups should be promoted into primary tabs, and which should move behind a more explicitly technical surface?
4. Should `Gallery Layout` own all section sizing, viewport background, and adapter composition work while `Media Display` narrows to viewport behavior only?

## Handoff To Pass 3

Pass 3 should not revisit redundancy discovery unless new evidence appears. It should assume this audit is correct enough to evaluate whether a side-panel architecture would improve or worsen the identified overlap clusters.