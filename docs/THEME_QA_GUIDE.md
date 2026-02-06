# Theme System QA Guide

Manual QA checklist for the WP Super Gallery theme system. Work through each section with every theme to confirm full coverage.

---

## Setup

1. Start the dev server: `npm run dev`
2. Open the app in a browser
3. Log in with admin credentials
4. Open the **Settings** panel → confirm the **ThemeSelector** dropdown is visible

---

## 1. Theme Switching (All Themes)

Repeat for each theme in the selector dropdown.

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 1.1 | Select a theme from the dropdown | UI updates **instantly** — no flash, no page reload | |
| 1.2 | Check the body/page background | Matches the theme's `background` color | |
| 1.3 | Check card surfaces | Campaign cards and admin panels use the theme's `surface` color | |
| 1.4 | Check primary accent | Buttons, links, active tabs, badges use the theme's `primary` color | |
| 1.5 | Check text readability | Primary text is legible against surface; muted text is visibly dimmer but still readable | |
| 1.6 | Check borders | Card borders, input borders, table dividers use the theme's `border` color | |
| 1.7 | Refresh the page | Same theme persists (loaded from `localStorage`) | |
| 1.8 | Switch to a different theme, then back | No visual artifacts or stale colors | |

**Theme IDs to test:** `default-dark`, `default-light`, `material-dark`, `material-light`, `darcula`, `nord`, `solarized-dark`, `solarized-light`, `high-contrast`, `catppuccin-mocha`, `tokyo-night`, `gruvbox-dark`, `cyberpunk`, `synthwave`

---

## 2. View Coverage

For each theme, navigate through **every view** and confirm colors are themed (no hardcoded white-on-white or invisible elements).

### 2.1 Gallery View (Main Page)

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.1.1 | Campaign cards render | Card backgrounds, text, borders all themed | |
| 2.1.2 | Card hover state | Shadow/border changes visible, appropriate for the theme | |
| 2.1.3 | Company tab bar | Active tab highlighted with primary color; inactive tabs use muted color | |
| 2.1.4 | Access mode segmented control | Lock/Hide labels and indicator use themed colors | |
| 2.1.5 | Lock overlay on cards | Semi-transparent overlay visible with lock icon | |
| 2.1.6 | Media stat pills on cards | Pills use themed surface color with appropriate contrast | |
| 2.1.7 | Header background gradient | Uses themed surface colors, not hardcoded | |

### 2.2 Campaign Viewer (Click a Card)

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.2.1 | Cover image overlay gradient | Gradient uses themed colors | |
| 2.2.2 | Campaign title and description | Text colors match theme | |
| 2.2.3 | Stat numbers (media count, etc.) | Use primary color, not hardcoded blue | |
| 2.2.4 | Back button | Themed appropriately | |
| 2.2.5 | Admin section (if visible) | Background and borders themed | |

### 2.3 Image Carousel / Lightbox

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.3.1 | Thumbnail strip | Selected thumbnail border uses `--wpsg-color-primary` | |
| 2.3.2 | Open lightbox | Dark overlay (`rgba(0,0,0,0.95)`) is intentionally fixed — should always be very dark | |
| 2.3.3 | Lightbox navigation arrows | Visible and functional | |
| 2.3.4 | Close lightbox | Returns to themed view cleanly | |

### 2.4 Video Carousel

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.4.1 | Video thumbnail borders | Selected border uses primary color | |
| 2.4.2 | Play button overlay | Visible against all themes | |

### 2.5 Login Form

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.5.1 | Login form card | Surface background, border themed | |
| 2.5.2 | Input fields | Background, border, placeholder text all themed | |
| 2.5.3 | Submit button | Uses primary color | |
| 2.5.4 | Error messages | Use error color, not hardcoded red | |

### 2.6 Admin Panel

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.6.1 | Admin panel card | Surface background, border themed | |
| 2.6.2 | Tab bar (Campaigns / Media / Companies) | Active tab uses primary; hover states visible | |
| 2.6.3 | Campaign table rows | Alternating/hover backgrounds themed | |
| 2.6.4 | Action buttons (Edit, Archive, Delete) | Colors appropriate — delete uses error color | |
| 2.6.5 | Badge colors (Active, Archived, Draft) | Themed, not hardcoded | |
| 2.6.6 | Company row highlight | Uses primary with very low opacity | |
| 2.6.7 | Settings panel | All form controls themed (Select, TextInput, Checkbox, Switch) | |
| 2.6.8 | Theme selector | Swatches display correct colors for each theme option | |

### 2.7 Modals

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.7.1 | Edit campaign modal | Surface background, header border, close button themed | |
| 2.7.2 | Archive confirmation modal | Same | |
| 2.7.3 | Add media modal | Inputs and buttons themed | |
| 2.7.4 | Modal overlay | Semi-transparent themed background overlay | |

### 2.8 Notifications / Toasts

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 2.8.1 | Success notification | Uses success color accent | |
| 2.8.2 | Error notification | Uses error color accent | |
| 2.8.3 | Notification background | Uses themed surface, not default white | |

---

## 3. Light Theme Specific

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 3.1 | Switch to `default-light` | Background is light, text is dark — fully inverted from dark themes | |
| 3.2 | Check all surface layers | surface < surface2 < surface3 in lightness (subtle layering) | |
| 3.3 | Borders visible | Borders should be darker than surfaces in light themes | |
| 3.4 | Muted text legible | `textMuted` and `textMuted2` still readable on light backgrounds | |
| 3.5 | Switch to `material-light` | Different palette but same light-mode structural behavior | |
| 3.6 | Switch to `solarized-light` | Warm cream background tones, not white | |

---

## 4. High Contrast Theme (WCAG AAA)

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 4.1 | Switch to `high-contrast` | Background is pure black (`#000000`) | |
| 4.2 | Body text | Pure white (`#ffffff`) on black — maximum contrast | |
| 4.3 | Muted text | `#e0e0e0` (textMuted) — still very readable, contrast ≥ 7:1 | |
| 4.4 | Secondary muted text | `#b0b0b0` (textMuted2) — still readable, contrast ≥ 4.5:1 | |
| 4.5 | Border color | White borders — clearly visible | |
| 4.6 | Primary accent | Bright blue (`#6ec1ff`) — high contrast against black | |
| 4.7 | Success/Warning/Error colors | All brighter than standard themes for visibility | |
| 4.8 | All interactive elements | Buttons, links, inputs clearly distinguishable | |
| 4.9 | **Contrast check (DevTools)** | Open browser DevTools → Accessibility tab → verify text contrast ratios ≥ 7:1 for normal text, ≥ 4.5:1 for large text | |

---

## 5. Theme Persistence

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 5.1 | Select `nord` theme | Theme applied | |
| 5.2 | Check `localStorage` | Key `wpsg-theme-id` exists with value `nord` | |
| 5.3 | Hard refresh (Ctrl+Shift+R) | Nord theme loads immediately — no flash of default theme | |
| 5.4 | Open a new tab to same URL | Nord theme loads | |
| 5.5 | Clear localStorage and refresh | Falls back to `default-dark` | |
| 5.6 | Delete only the `wpsg-theme-id` key and refresh | Falls back to `default-dark` | |

---

## 6. WordPress Config Injection

*(Requires WordPress environment with the plugin active)*

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 6.1 | WP Admin → Settings → Theme dropdown | Shows all 14 themes in grouped categories | |
| 6.2 | Select `material-dark` and save | Settings saved successfully | |
| 6.3 | Visit front-end with `[super-gallery]` shortcode | Gallery loads with `material-dark` theme | |
| 6.4 | View page source | `window.__wpsgThemeId = "material-dark"` present in config script | |
| 6.5 | View page source | `window.__WPSG_CONFIG__` contains `"theme":"material-dark"` and `"allowUserThemeOverride":true` | |
| 6.6 | Check "Allow User Theme Override" checkbox | Default: checked | |
| 6.7 | User changes theme via UI | Theme persists in localStorage, overriding WP default | |
| 6.8 | **Uncheck** "Allow User Theme Override" and save | Setting saved | |
| 6.9 | Visit front-end | Gallery uses admin-selected theme; ThemeSelector still visible but localStorage not persisted | |
| 6.10 | Refresh after user attempted override | Admin theme is restored (localStorage ignored) | |

---

## 7. Shadow DOM Embedding

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 7.1 | Load app with `?shadow=1` (or default) | App renders inside Shadow DOM | |
| 7.2 | Inspect DOM | `<div>` host has `shadowRoot` attached | |
| 7.3 | Check shadow root styles | `<style id="wpsg-theme-vars">` present inside shadow root with `:host { --wpsg-* }` variables | |
| 7.4 | Switch themes inside Shadow DOM | CSS variables in shadow root update | |
| 7.5 | Check Mantine variables | `--mantine-color-*` variables scoped to shadow root, not `:root` | |
| 7.6 | Host page styles | Confirm host page CSS does **not** leak into the gallery | |
| 7.7 | Modals and tooltips | Render inside shadow root, not document body | |
| 7.8 | Load with `?shadow=0` | App renders directly in DOM (no shadow root) | |
| 7.9 | Theme still works in non-shadow mode | CSS vars injected on `:root` instead | |

---

## 8. Performance

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 8.1 | Open DevTools → Performance tab | Ready to record | |
| 8.2 | Record while switching themes 5 times rapidly | Each switch completes in <16ms (no dropped frames) | |
| 8.3 | Check console at startup | `[WPSG Theme] Registry initialized: 14/14 themes in Xms` — should be <50ms | |
| 8.4 | Memory tab: take heap snapshot | No leaked DOM nodes after 10 theme switches | |
| 8.5 | Network tab while switching | **Zero** network requests — all themes pre-computed at startup | |
| 8.6 | Lighthouse performance score | No regression from theme system (bundle ~13KB chroma.js addition) | |

---

## 9. Error Handling

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 9.1 | Set `localStorage` `wpsg-theme-id` to `"bogus-theme"` | Falls back to `default-dark` gracefully | |
| 9.2 | Set `localStorage` `wpsg-theme-id` to empty string | Falls back to `default-dark` | |
| 9.3 | In dev mode, check console for fallback warning | `[WPSG Theme] Theme "bogus-theme" not found, falling back to "default-dark"` | |
| 9.4 | Corrupt a theme JSON and rebuild | Build succeeds; invalid theme skipped with console warning; all other themes work | |

---

## 10. CSS Variable Completeness

Use DevTools to verify CSS variables are present and correct.

| # | Test | Expected | ✅ |
|---|------|----------|----|
| 10.1 | Inspect `:root` (or `:host` in Shadow DOM) | `--wpsg-color-background` matches theme | |
| 10.2 | Check `--wpsg-color-primary` | Matches the primary accent of the active theme | |
| 10.3 | Check `--wpsg-color-text` | Matches the primary text color | |
| 10.4 | Check `--wpsg-spacing-*` variables | All 5 present (xs through xl) | |
| 10.5 | Check `--wpsg-radius-*` variables | All 5 present | |
| 10.6 | Check `--wpsg-shadow-*` variables | All 5 present | |
| 10.7 | Check `--wpsg-font-family` | Matches the theme's font stack | |
| 10.8 | Check `--wpsg-color-primary-0` through `--wpsg-color-primary-9` | All 10 shade variants present | |
| 10.9 | Switch theme, re-inspect | All variables update to new theme values | |

---

## 11. Cross-Browser Spot Check

| # | Browser | Test | ✅ |
|---|---------|------|----|
| 11.1 | Chrome (latest) | Full run of sections 1-3 | |
| 11.2 | Firefox (latest) | Theme switching + Shadow DOM | |
| 11.3 | Safari (latest) | Theme switching + `color-mix()` support (Safari 16.4+) | |
| 11.4 | Edge (latest) | Theme switching + Shadow DOM | |
| 11.5 | Mobile Chrome | Theme switching + responsive layout | |
| 11.6 | Mobile Safari | Theme switching + responsive layout | |

---

## Quick Regression Command

```bash
# Run all automated theme tests
npx vitest run src/themes/__tests__/

# Run full test suite
npx vitest run

# Type check
npx tsc --noEmit

# Production build
npx vite build
```

---

## Sign-Off

| Theme | Gallery | Viewer | Admin | Login | Modals | Lightbox | Tester | Date |
|-------|---------|--------|-------|-------|--------|----------|--------|------|
| default-dark | | | | | | | | |
| default-light | | | | | | | | |
| material-dark | | | | | | | | |
| material-light | | | | | | | | |
| darcula | | | | | | | | |
| nord | | | | | | | | |
| solarized-dark | | | | | | | | |
| solarized-light | | | | | | | | |
| high-contrast | | | | | | | | |
| catppuccin-mocha | | | | | | | | |
| tokyo-night | | | | | | | | |
| gruvbox-dark | | | | | | | | |
| cyberpunk | | | | | | | | |
| synthwave | | | | | | | | |
