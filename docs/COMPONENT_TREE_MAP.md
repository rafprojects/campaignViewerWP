# CampaignViewer Component Tree Map

A reference map of major component nesting from App entry point through campaign viewing.

---

## Full Tree

```
App
├── AuthProvider / WpJwtProvider (context wrappers)
├── CampaignContextProvider
├── AuthBar (top-right auth controls)
├── LoginForm (modal sign-in)
│
├── CardGallery ─────────────────────────── responsive grid of campaign cards
│   ├── CampaignCard (× N, one per campaign)
│   │   ├── CompanyLogo (company badge)
│   │   └── RequestAccessForm (overlay on locked cards)
│   │
│   └── CampaignViewer [LAZY, Modal] ───── opens on card click
│       ├── Cover Image + overlay gradient
│       ├── CompanyLogo
│       ├── About Section (description text)
│       ├── Campaign Stats (Paper cards in SimpleGrid)
│       ├── InContextEditor (admin floating gear)
│       ├── TypographyEditor (live typography overrides)
│       │
│       ├── ─── IF unifiedGalleryEnabled ───
│       │   └── UnifiedGallerySection (all media mixed)
│       │       └── [Adapter] OR [VideoCarousel + ImageCarousel interleaved]
│       │
│       ├── ─── ELSE (per-type sections) ───
│       │   ├── VideoGallerySection
│       │   │   └── [Adapter] OR VideoCarousel
│       │   └── ImageGallerySection
│       │       └── [Adapter] OR ImageCarousel
│       │
│       ├── VideoCarousel
│       │   ├── OverlayArrows (prev/next)
│       │   ├── DotNavigator (pagination dots)
│       │   └── Lightbox [LAZY]
│       │       ├── KeyboardHintOverlay
│       │       └── Portal (z-index bypass)
│       │
│       ├── ImageCarousel
│       │   ├── OverlayArrows
│       │   ├── DotNavigator
│       │   └── Lightbox [LAZY]
│       │       ├── KeyboardHintOverlay
│       │       └── Portal
│       │
│       └── Gallery Adapters [LAZY, one selected per section]
│           ├── CompactGridGallery ─── CSS auto-fill grid
│           │   ├── LazyImage (× N)
│           │   └── Lightbox
│           ├── JustifiedGallery ──── Flickr-style justified rows
│           │   ├── LazyImage (× N)
│           │   └── Lightbox
│           ├── MasonryGallery ────── Pinterest-style columns
│           │   ├── LazyImage (× N)
│           │   └── Lightbox
│           ├── HexagonalGallery ──── hex clip-path tiles
│           │   ├── LazyImage (× N)
│           │   └── Lightbox
│           ├── CircularGallery ───── circular clip-path tiles
│           │   ├── LazyImage (× N)
│           │   └── Lightbox
│           ├── DiamondGallery ────── diamond clip-path tiles
│           │   ├── LazyImage (× N)
│           │   └── Lightbox
│           └── LayoutBuilderGallery ── absolute-positioned slots
│               ├── GallerySlotView (× N, per slot)
│               │   └── TiltWrapper (3D mouse-reactive)
│               └── Lightbox
│
├── UnifiedCampaignModal (create/edit campaign form)
│   └── MediaLibraryPicker
├── ArchiveCampaignModal
├── AddExternalMediaModal
│
├── AdminPanel [LAZY]
│   └── LayoutBuilderModal
│       ├── BuilderDockContext (shared builder state)
│       ├── LayoutCanvas (interactive editor)
│       │   ├── LayoutSlotComponent (draggable via react-rnd)
│       │   └── SmartGuides (snap indicators)
│       ├── LayoutBuilderLayersPanel
│       ├── LayoutBuilderMediaPanel
│       ├── LayoutBuilderCanvasPanel
│       ├── LayoutBuilderPropertiesPanel
│       └── BuilderHistoryPanel
│
└── SettingsPanel [LAZY]
```

---

## Key Conditional Branches

| Condition | Setting / Trigger | Effect |
|---|---|---|
| **Unified vs Per-Type galleries** | `unifiedGalleryEnabled` | Single mixed media stream vs separate Image/Video sections |
| **Galleries-Only mode** | `campaignOpenMode === 'galleries-only'` | Hides cover, about, stats — shows only galleries |
| **Fullscreen modal** | `campaignModalFullscreen` or mobile viewport | Modal becomes full-screen |
| **Carousel vs Adapter** | Adapter ID (`'classic'` = carousel) | VideoCarousel/ImageCarousel vs grid adapter |
| **Card display mode** | `cardDisplayMode` (`load-more` / `show-all` / `paginated`) | How cards paginate in CardGallery |
| **Access control** | `accessMode` (`lock` / `hide`) | Locked = show disabled card + RequestAccessForm; Hidden = omit card |

---

## Flow Summary

1. **App** wraps everything in Auth + Campaign context providers
2. **CardGallery** renders a responsive grid of **CampaignCard** components
3. Clicking a card opens **CampaignViewer** (lazy-loaded modal)
4. CampaignViewer renders a cover section, then one or more **gallery sections**
5. Each gallery section either uses a **Carousel** (Image/Video) or a **Gallery Adapter**
6. Gallery Adapters are lazy-loaded layout strategies (grid, masonry, justified, hex, etc.)
7. Both carousels and adapters integrate with **Lightbox** for full-screen media viewing
