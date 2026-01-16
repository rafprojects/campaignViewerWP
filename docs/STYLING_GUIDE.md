# Styling Guide for SPA + WordPress Widget

This guide covers styling practices to ensure the gallery works well both as a standalone SPA and when embedded as a WordPress widget.

## 1) Scope styles to a root container

**Why:** WordPress themes and plugins frequently apply global CSS that can collide with app styles.
**Recommendation:** Wrap the app in a single root class and scope all global rules beneath it.
**Implementation:** Use a root class like `.wp-super-gallery` and keep global styles limited to that subtree.
**Benefit:** Significantly reduces unexpected overrides and improves portability across sites.

## 2) Avoid global resets in widget mode

**Why:** Global resets can alter the host page’s typography, spacing, and component styles.
**Recommendation:** Apply reset-like rules only inside the gallery root container.
**Implementation:** Move `* { box-sizing: border-box; }`, default fonts, and base typography into `.wp-super-gallery` selectors.
**Benefit:** The widget does not affect the rest of the WordPress site.

## 3) Use CSS variables for theming

**Why:** Theme customization is common in WordPress and should be safe and predictable.
**Recommendation:** Expose colors, spacing, radii, and typography as CSS variables.
**Implementation:** Define variables in `:root` (or `.wp-super-gallery`) and allow overrides via inline styles or WP settings.
**Benefit:** Enables brand theming without rebuilding the app.

## 4) Prefix class names and keep CSS Modules

**Why:** Global class names can collide in WordPress, and CSS Modules reduce those risks.
**Recommendation:** Keep CSS Modules for components and avoid global class names.
**Implementation:** Continue using `.module.scss` files and import them into components.
**Benefit:** Stronger encapsulation, fewer collisions.

## 5) Establish a z-index scale

**Why:** WordPress admin bars and modal layers can overlap your UI.
**Recommendation:** Use a small, documented z-index scale.
**Implementation:** Add tokens like `--z-base`, `--z-overlay`, `--z-modal` and use them consistently.
**Benefit:** Predictable layering across WP and SPA contexts.

## 6) Responsive layout constraints

**Why:** Widgets might appear in narrow columns or sections.
**Recommendation:** Use max-widths and fluid padding at the root level.
**Implementation:** Centralize container sizing in a single wrapper class.
**Benefit:** Consistent layout at different embed widths.

## 7) Consider Shadow DOM for isolation (optional)

**Why:** Some WordPress sites use aggressive CSS that still leaks in.
**Recommendation:** Use Shadow DOM if you need near-total isolation.
**Implementation:** Render the app into a Shadow Root when embedded.
**Benefit:** Strong style isolation, fewer CSS conflicts.
**Tradeoff:** Slightly more complex integration and theming.

## 8) Optional iframe embedding (maximum isolation)

**Why:** Some sites are too unpredictable for CSS isolation.
**Recommendation:** Offer an iframe embed mode.
**Implementation:** Serve the SPA on its own URL and embed via iframe.
**Benefit:** Complete isolation from WordPress CSS.
**Tradeoff:** Slightly more integration work and cross-window communication if needed.

---

## Current Implementation Notes

- Root scoping is enabled via `.wp-super-gallery` wrapper.
- Global styles are applied only inside this wrapper.
- CSS Modules are used for all components.

Document updated: January 15, 2026.
