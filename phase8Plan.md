Summary & Plan for Phase 8 Items
Item 1: Compact Grid Justification Bug — Simple fix, can implement now
Root cause: The CSS grid uses repeat(auto-fill, minmax(min(...), 1fr)). The 1fr max means columns always expand to fill all available space — there's zero leftover space — so justify-content has nothing to work with.

Fix options:

#	Approach	Effect
A	Change 1fr → ${cardWidth}px (fixed max)	Columns stay at their natural size; justify-content works because there's leftover space. Items won't stretch to fill the row.
B	Switch from justify-content → justify-items	Keeps flexible 1fr columns but centers items within their cells. Grid still fills the container, but content inside cells obeys justification.
C	Use auto-fit + fixed max + justify-content	Similar to A but collapses empty tracks, so items cluster together per justification.
My recommendation: Option A — change the column max from 1fr to the cardWidth value. This gives the most intuitive justification behavior: when there are, say, 3 items in a 5-column-width container, justification determines where those 3 items sit. auto-fill still handles responsive column count. Which do you prefer?

Item 2: Hide Gallery Section Label — Simple fix, can implement now
The setting showCampaignGalleryLabels and its toggle in SettingsPanel already exist but are only wired to the MediaCarouselAdapter. The 7 other adapters (compact-grid, masonry, justified, hexagonal, circular, diamond, layout-builder) render labels unconditionally.

Fix: Wrap the <Title> block in each of the 7 adapters with {settings.showCampaignGalleryLabels !== false && ( ... )}, matching the pattern MediaCarouselAdapter already uses. No new settings or UI needed.

Item 3: Carousel Adapter Enhancements — Needs planning
The current MediaCarouselAdapter is a custom implementation (no external library). It supports arrow nav, swipe, dot navigator, and fade/slide transitions, but it shows one slide at a time and has no autoplay/drag/edge effects.

Here are the Elementor-style features mapped to implementation decisions:

Feature	Decision Needed
\# of cards showing	New setting carouselVisibleCards: number (default 1). Requires reworking the transform logic from single-slide to multi-slide viewport.
Autoplay	carouselAutoplay: boolean, carouselAutoplaySpeed: number (ms, default 3000), carouselAutoplayDirection: 'ltr' | 'rtl' (default 'ltr'), carouselAutoplayPauseOnHover: boolean (default true). Interval-based with cleanup.
Click & drag / Touch & drag	A useSwipe hook already exists. Needs enhancement: track drag delta for smooth continuous dragging (like Embla) vs. the current binary swipe detection. New setting carouselDragEnabled: boolean (default true).
Unfocused card darkening	carouselDarkenUnfocused: boolean, carouselDarkenOpacity: number (0-1, default 0.5). Applied as overlay or opacity on non-center slides. Only relevant when carouselVisibleCards > 1.
Edge fade effect	carouselEdgeFade: boolean (default false). CSS mask-image: linear-gradient(...) on the carousel viewport to fade edges.
Key architecture decision:

#	Option	Tradeoffs
A	Keep custom implementation, add features incrementally	Full control, no new dependencies. More code to maintain. Risk of reinventing complex wheel (especially drag physics).
B	Migrate to Embla Carousel	Mature library, handles multi-slide, drag physics, autoplay (via plugins), RTL, responsive. ~7KB gzipped. Would require rewriting the adapter but gains a lot "for free".
C	Hybrid: keep custom for single-slide, use Embla for multi-slide mode	More complexity but less risk to existing behavior.
My recommendation: Option B (Embla) — the feature set you're describing is essentially what Embla does out of the box with its plugin system (embla-carousel-autoplay, embla-carousel-auto-scroll). The custom drag physics and multi-slide viewport are particularly hard to get right. What's your preference?

Item 4: New Gallery Adapter Ideas — Brainstorm
Beyond the 8 adapters you already have (compact-grid, masonry, justified, hexagonal, circular, diamond, layout-builder, carousel), here are ideas that fit the gallery domain:

Adapter	Description	Complexity
Marquee / Ticker	Continuous horizontal (or vertical) auto-scrolling strip of thumbnails. Click pauses and opens item. Great for "featured" or "latest" strips.	Medium
Mosaic / Pinterest	Irregular tile sizes (large hero + small grid) based on aspect ratios or media importance. Similar to Google Photos layout.	Medium-High
Filmstrip	Horizontal scrollable single-row with fixed-height thumbnails. Like a film negative strip. Optional fixed preview pane above.	Medium
Stacked / Deck	Cards stacked on top of each other with slight offset. Swipe/click to move top card to back (Tinder-like). Good for mobile previews.	Medium
Coverflow / 3D	CSS 3D perspective carousel where side items are rotated/scaled. Classic Apple-style effect.	Medium
Waterfall	Vertical masonry variant where items drop in sequence with staggered animation.	Low (masonry variant)
Timeline	Chronological layout with items on alternating sides of a center line. Good for event/campaign galleries.	Medium
Isotope / Filterable Grid	Grid with animated filtering/sorting transitions. Items shuffle with smooth FLIP animations.	Medium-High
Spotlight / Hero	Large featured item with smaller thumbnails below/beside. Clicking a thumbnail promotes it to hero position.	Low-Medium