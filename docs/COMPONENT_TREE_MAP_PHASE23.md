# Phase 23 Component Tree Map

An up-to-date reference map of the major component nesting after the Phase 23 settings, gallery-config, and campaign-parity refactor.

This supplements the older COMPONENT_TREE_MAP.md. The older map still captures the original viewer flow, but it predates the shared gallery resolver/render-plan layers, the extracted settings sections, and the expanded admin modal ecosystem.

---

## Scope

This map focuses on:

1. App entry and top-level lazy branches
2. campaign gallery browsing and viewer flow
3. campaign edit and gallery-override flow
4. admin panel structure
5. settings panel structure
6. layout-builder shell

---

## Full Tree

```text
App
|-- AuthProvider / WpJwtProvider
|-- CampaignContextProvider
|-- AuthBar
|-- LoginForm [Modal]
|
|-- CardGallery
|   |-- InContextEditor
|   |-- TypographyEditor
|   |-- CampaignCard (x N)
|   |   |-- CompanyLogo
|   |   `-- RequestAccessForm [locked-card overlay]
|   `-- CampaignViewer [lazy modal]
|       |-- cover / title / metadata shell
|       |-- InContextEditor
|       |-- TypographyEditor
|       |-- about section
|       |-- access notice
|       |-- gallery shell layout resolver
|       |   |
|       |   |-- UnifiedGallerySection
|       |   |   `-- GallerySectionWrapper
|       |   |       `-- CampaignGalleryAdapterRenderer
|       |   |           `-- active adapter from adapterRegistry
|       |   |
|       |   `-- PerTypeGallerySection
|       |       |-- GallerySectionWrapper [video]
|       |       |   `-- CampaignGalleryAdapterRenderer
|       |       `-- GallerySectionWrapper [image]
|       |           `-- CampaignGalleryAdapterRenderer
|       |
|       |-- stats section
|       `-- active gallery adapters
|           |-- MediaCarouselAdapter
|           |   |-- ImageCarousel
|           |   |   |-- OverlayArrows
|           |   |   |-- DotNavigator
|           |   |   `-- Lightbox [lazy]
|           |   |       `-- KeyboardHintOverlay
|           |   `-- VideoCarousel
|           |       |-- OverlayArrows
|           |       |-- DotNavigator
|           |       `-- Lightbox [lazy]
|           |           `-- KeyboardHintOverlay
|           |-- CompactGridGallery
|           |-- JustifiedGallery
|           |-- MasonryGallery
|           |-- CircularGallery
|           |-- DiamondGallery
|           |-- HexagonalGallery
|           `-- LayoutBuilderGallery
|               |-- GallerySlotView (x N)
|               |   `-- TiltWrapper
|               `-- Lightbox [lazy]
|
|-- UnifiedCampaignModal
|   |-- details tab
|   |-- media tab
|   |   `-- MediaLibraryPicker
|   |-- settings tab
|   |   `-- GalleryConfigEditorModal [lazy]
|   `-- ConfirmModal
|-- ArchiveCampaignModal
|-- AddExternalMediaModal
|
|-- SettingsPanel [lazy]
|   |-- GeneralSettingsSection
|   |-- CampaignCardSettingsSection
|   |-- MediaDisplaySettingsSection
|   |-- GalleryLayoutSettingsSection
|   |-- CampaignViewerSettingsSection
|   |-- AdvancedSettingsSection [conditional]
|   |-- TypographySettingsSection
|   `-- GalleryConfigEditorModal [lazy]
|
`-- AdminPanel [lazy]
    |-- CampaignsTab
    |   `-- BulkActionsBar [conditional]
    |-- MediaTab [lazy]
    |-- LayoutTemplateList
    |   |-- LayoutBuilderModal [lazy]
    |   |   |-- BuilderDockContext
    |   |   |-- LayoutCanvas
    |   |   |   |-- LayoutSlotComponent (x N)
    |   |   |   `-- SmartGuides
    |   |   |-- LayoutBuilderLayersPanel
    |   |   |-- LayoutBuilderMediaPanel
    |   |   |-- LayoutBuilderCanvasPanel
    |   |   |-- LayoutBuilderPropertiesPanel
    |   |   |   |-- SlotPropertiesPanel
    |   |   |   |-- GraphicLayerPropertiesPanel
    |   |   |   |-- BackgroundPropertiesPanel
    |   |   |   `-- MaskPropertiesPanel
    |   |   `-- BuilderHistoryPanel
    |   `-- PresetGalleryModal [lazy]
    |-- AccessTab
    |-- AuditTab
    |-- AnalyticsDashboard [lazy]
    |-- UnifiedCampaignModal
    |-- CampaignDuplicateModal [lazy]
    |-- CampaignImportModal [lazy]
    |-- KeyboardShortcutsModal [lazy]
    |-- AdminCampaignArchiveModal [lazy]
    |-- AdminCampaignRestoreModal [lazy]
    |-- ArchiveCompanyModal [lazy]
    `-- QuickAddUserModal [lazy]
```

---

## Key Branches

### Viewer flow

The biggest structural change since the older map is the viewer render path:

1. CampaignViewer no longer drops directly into separate image/video carousel or adapter branches.
2. It now routes through UnifiedGallerySection or PerTypeGallerySection.
3. Those sections route through GallerySectionWrapper.
4. GallerySectionWrapper delegates final adapter selection to CampaignGalleryAdapterRenderer.
5. The adapter renderer resolves the active implementation from the shared adapter registry.

That layering is what keeps the runtime aligned with the shared editor and resolver instead of scattering render-time decisions across multiple branches.

### Settings flow

SettingsPanel is now a shell plus extracted sections:

1. GeneralSettingsSection
2. CampaignCardSettingsSection
3. MediaDisplaySettingsSection
4. GalleryLayoutSettingsSection
5. CampaignViewerSettingsSection
6. AdvancedSettingsSection
7. TypographySettingsSection

The responsive gallery-config editor is now a separate lazy-loaded subsystem opened from the layout/settings surfaces rather than inline inside SettingsPanel.

### Campaign edit flow

UnifiedCampaignModal now has a deeper settings branch than the older maps showed:

1. quick gallery mode and adapter overrides stay visible inline
2. shared responsive campaign gallery editing happens in GalleryConfigEditorModal
3. clear/reset flows live alongside inherited-versus-overridden state messaging

### Admin flow

AdminPanel is now broader than the older map:

1. campaigns
2. media
3. layouts
4. access
5. audit
6. analytics

It also owns a larger lazy modal ecosystem around duplicate/import/archive/restore/access management and layout-builder support.

---

## Material Differences From The Older Map

1. CampaignViewer now uses UnifiedGallerySection and PerTypeGallerySection instead of separate top-level VideoGallerySection and ImageGallerySection branches.
2. GallerySectionWrapper is now part of the live render path and owns container measurement and wrapper styling concerns.
3. CampaignGalleryAdapterRenderer and the shared adapter registry are now the real adapter-selection boundary.
4. SettingsPanel is no longer just a single lazy modal shell; it now delegates almost all tab bodies to extracted Settings section modules.
5. AdminPanel now includes a fuller modal and tab ecosystem than the older map documents.
6. LayoutBuilderPropertiesPanel now branches into multiple focused property editors instead of one undifferentiated properties block.

---

## Source Files

Primary files reflected in this map:

1. src/App.tsx
2. src/components/CampaignGallery/CardGallery.tsx
3. src/components/CardViewer/CampaignViewer.tsx
4. src/components/CardViewer/UnifiedGallerySection.tsx
5. src/components/CardViewer/PerTypeGallerySection.tsx
6. src/components/CardViewer/GallerySectionWrapper.tsx
7. src/components/CardViewer/CampaignGalleryAdapterRenderer.tsx
8. src/components/Campaign/UnifiedCampaignModal.tsx
9. src/components/Admin/AdminPanel.tsx
10. src/components/Admin/SettingsPanel.tsx
11. src/components/Settings/*.tsx
12. src/components/Admin/LayoutBuilder/*.tsx