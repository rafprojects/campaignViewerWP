# Mantine Main UI Assessment & Migration Plan

This document assesses the current (non‑admin) UI and outlines the steps required to migrate it to Mantine styling. It is a planning/tracking guide; implementation can be scheduled later.

## Scope (main UI)
- Gallery listing and filters
- Campaign cards grid
- Campaign viewer modal + media carousels
- Auth/login UI
- Global layout, banners, and containers

## Current UI components and styling

### Core entry and layout
- **App shell & state**: [src/App.tsx](../src/App.tsx)
  - Orchestrates auth, loads campaigns, toggles admin panel.
  - Uses `wp-super-gallery__container` and other global layout classes from [src/styles/global.scss](../src/styles/global.scss).

### Gallery listing
- **Gallery container + filters**: `CardGallery` in [src/components/Gallery/CardGallery.tsx](../src/components/Gallery/CardGallery.tsx)
  - Uses SCSS module styles in `CardGallery.module.scss`.
  - Filter buttons and access mode toggles are styled via custom classes.
  - Animations: `framer-motion` layout animation and `AnimatePresence`.

### Campaign cards
- **Card tiles**: `CampaignCard` in [src/components/Gallery/CampaignCard.tsx](../src/components/Gallery/CampaignCard.tsx)
  - Uses SCSS module `CampaignCard.module.scss`.
  - Brand badge, access badge, overlays, and hover animation are custom styles.

### Campaign viewer modal
- **Viewer**: `CampaignViewer` in [src/components/Campaign/CampaignViewer.tsx](../src/components/Campaign/CampaignViewer.tsx)
  - Uses SCSS module `CampaignViewer.module.scss`.
  - Animated modal with overlay/backdrop from `framer-motion`.

### Media carousels
- **Video carousel**: `VideoCarousel` in [src/components/Campaign/VideoCarousel.tsx](../src/components/Campaign/VideoCarousel.tsx)
- **Image carousel**: `ImageCarousel` in [src/components/Campaign/ImageCarousel.tsx](../src/components/Campaign/ImageCarousel.tsx)
  - Both are SCSS modules with lucide icons and custom controls.

### Auth UI
- **Login**: `LoginForm` in [src/components/Auth/LoginForm.tsx](../src/components/Auth/LoginForm.tsx)
  - SCSS module `LoginForm.module.scss`.

### Global styles & tokens
- **Globals**: [src/styles/global.scss](../src/styles/global.scss)
- **Tokens**: [src/styles/_tokens.scss](../src/styles/_tokens.scss)
- Shadow DOM style injection for non-admin UI: [src/shadowStyles.ts](../src/shadowStyles.ts)

## Mantine migration considerations

1. **Shadow DOM**
   - Mantine styles must be injected into Shadow DOM (already done for admin). Main UI migration must preserve this.
   - If components move to Mantine, keep `shadowStyles.ts` updated with any additional Mantine style packages.

2. **Framer Motion compatibility**
   - Existing animations use `motion.div` wrappers. Mantine components can be wrapped in `motion` if needed.
   - Ensure animated elements keep `className` and `style` compatibility (Mantine components support `classNames` and `styles`).

3. **SCSS module parity**
   - Current visual style relies on custom SCSS (gradients, overlays, badges, hover effects).
   - A direct Mantine migration requires either: 
     - Recreating effects with Mantine tokens + `classNames/styles`, or
     - Keeping SCSS for highly custom sections and migrating only form controls/tables.

4. **Design tokens**
   - Existing CSS variables (`--color-*`) can map to Mantine theme colors, but Mantine expects a 10‑step palette.

## Proposed migration steps (tracking)

### Phase A — Inventory and theme alignment
- [ ] Document exact visual requirements for the gallery and viewer (screenshots). 
- [ ] Create a Mantine theme that maps to existing `--color-*` tokens.
- [ ] Decide which SCSS modules remain as custom overrides vs. full Mantine replacement.

### Phase B — Gallery header and filters
- [ ] Replace filter buttons with `SegmentedControl` or `Tabs` (Mantine).
- [ ] Replace access mode toggle buttons with `SegmentedControl`.
- [ ] Port header layout to `Group`, `Stack`, `Container`.

### Phase C — Campaign grid and cards
- [ ] Rebuild `CampaignCard` using `Card`, `Badge`, `Image`, `Group`.
- [ ] Preserve lock overlay and hover scaling via `styles` or SCSS overrides.
- [ ] Replace badges with Mantine `Badge` (custom colors for brand/access).

### Phase D — Campaign viewer modal
- [ ] Replace `CampaignViewer` shell with `Modal` or `Drawer`.
- [ ] Preserve `framer-motion` animations if desired (or use Mantine transitions).
- [ ] Convert stats grid to `SimpleGrid` + `Card`.

### Phase E — Carousels
- [ ] Decide whether to keep custom `VideoCarousel`/`ImageCarousel` or replace with Mantine `Carousel` (requires `@mantine/carousel`).
- [ ] If using Mantine Carousel, migrate controls/icons and thumbnails.

### Phase F — Auth UI
- [ ] Migrate `LoginForm` to Mantine `TextInput`, `PasswordInput`, `Button`, `Paper`.

### Phase G — Clean-up and consistency
- [ ] Remove unused SCSS modules that have Mantine equivalents.
- [ ] Ensure Shadow DOM styles include any new Mantine packages.
- [ ] Run build + visual QA.

## Suggested Mantine components for main UI
- Layout: `Container`, `Stack`, `Group`, `Box`, `Paper`, `Card`
- Navigation: `Tabs`, `SegmentedControl`
- Media: `Image`, optional `Carousel` (`@mantine/carousel`)
- Badges: `Badge`, `ThemeIcon`
- Modal: `Modal` or `Drawer`
- Typography: `Title`, `Text`

## Recommendation
Start with **Phase B (header/filters)** and **Phase F (login)** to validate theme consistency without replacing complex visuals. Then move to cards and viewer once the theme looks correct.

