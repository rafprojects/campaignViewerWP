# Theme System Assessment (Mantine)

This document evaluates the feasibility of a theme system that allows admins to switch the visual style of the **main UI** and the **Admin Panel** (e.g., “Darcula”). It also outlines a configuration approach and a staged plan for implementation.

## Goals
- Allow admins to select a prebuilt theme from WordPress settings.
- Apply the selected theme to both main UI and admin panel consistently.
- Avoid per‑screen manual styling updates when switching themes.

## Feasibility Summary
**Feasible.** Mantine already supports global theming through `MantineProvider`, which can be driven by a dynamic theme object. With Shadow DOM support already in place, we can inject theme variables and swap them at runtime.

## Proposed Configuration Approaches

### Option A — Theme JSON + Mantine theme adapter (recommended)
- Store themes as JSON (name, palette, radii, typography, spacing, shadows).
- At runtime, load the selected theme and adapt it to a Mantine `theme` object.
- Apply to `MantineProvider` in [src/main.tsx](../src/main.tsx).

**Pros:**
- Simple to author new themes.
- Clear separation between UI design and code.
- Works for both main UI and admin panel.

**Cons:**
- Requires validation to ensure palettes and scales are complete.

### Option B — CSS variables + Mantine “token bridge”
- Use CSS variables (`--color-*`, `--radius-*`) as the source of truth.
- Mantine theme references `var(--token)` values.
- Theme switching is just swapping a CSS variable set.

**Pros:**
- Works well with existing tokens.
- CSS variables naturally compatible with Shadow DOM.

**Cons:**
- Mantine expects 10‑step color arrays; mapping must be consistent.

### Option C — Hybrid (JSON -> CSS variables -> Mantine)
- Parse JSON, generate CSS variable sets, then bind Mantine to them.
- Best of both worlds if we want external theme packs.

**Pros:**
- External theme packs are easy to distribute.
- Maintains compatibility with existing token usage.

**Cons:**
- Slightly more complexity at runtime.

## Where the theme should apply
- **Main UI:** Gallery header, cards, viewer, carousels, login.
- **Admin Panel:** Tabs, tables, forms, modals, badges.
- **Global:** Typography, background, surface, borders, muted text.

## WordPress integration (future)
Once WP integration is ready, expose a setting:
- Theme selector dropdown in plugin settings
- Store the selection in WP options
- Inject selection into the SPA via the existing config injection mechanism

## Implementation Plan (Final Phase)

### Phase 7 — Theme System (new final phase)
1. **Define theme schema**
   - JSON structure: `name`, `palette`, `radius`, `spacing`, `shadows`, `typography`.
2. **Create theme loader**
   - Read theme selection from injected WP config.
3. **Theme adapter**
   - Convert theme JSON to Mantine theme (or CSS variables + Mantine binding).
4. **Apply to MantineProvider**
   - Update [src/main.tsx](../src/main.tsx) to load and apply selected theme.
5. **Shadow DOM support**
   - Ensure CSS variable sets apply inside shadow root.
6. **Validation and fallback**
   - If theme is missing or invalid, fall back to default theme.

## Recommendation
Proceed with **Option A (Theme JSON + adapter)** for clarity and portability. If we want full CSS variable compatibility for legacy SCSS, adopt **Option C**.

## Open Questions
- Do we want to allow custom theme uploads (JSON) in WP settings?
- Should themes be packaged in the plugin, or stored in WP database?
- Do we support per‑company themes or global only?

