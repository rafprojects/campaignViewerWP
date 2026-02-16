# Theme Authoring Guide

Create custom themes for WP Super Gallery by writing a JSON file that specifies colors, and optionally typography, spacing, and component overrides. The theme engine handles everything else — shade generation, Mantine integration, CSS variable injection, and Shadow DOM support.

---

## Quick Start

1. **Copy** an existing theme as a starting point:

   ```bash
   cp src/themes/definitions/default-dark.json src/themes/definitions/my-brand.json
   ```

2. **Edit** the JSON — at minimum change `id`, `name`, and colors.

3. **Register** the theme in `src/themes/index.ts`:

   ```typescript
   import myBrandDef from './definitions/my-brand.json';

   // In the bundled array inside initializeRegistry():
   const bundled: ThemeExtension[] = [
     // ... existing themes ...
     myBrandDef as unknown as ThemeExtension,
   ];
   ```

4. **Build & test** — the theme appears automatically in the ThemeSelector dropdown.

---

## JSON Schema

Every theme JSON is merged onto `_base.json` defaults at startup. You only need to provide the fields you want to override.

### Required Fields

| Field         | Type                 | Description                                             |
|---------------|----------------------|---------------------------------------------------------|
| `id`          | `string`             | Unique kebab-case identifier (e.g. `"my-brand-dark"`)   |
| `name`        | `string`             | Human-readable display name                              |
| `colorScheme` | `"light"` \| `"dark"` | Base scheme — drives Mantine's `forceColorScheme`       |
| `colors`      | `object`             | Color palette (see below)                                |

### Optional Fields (inherited from `_base.json`)

| Field         | Type     | Description                          |
|---------------|----------|--------------------------------------|
| `typography`  | `object` | Font families, sizes, headings       |
| `spacing`     | `object` | xs/sm/md/lg/xl spacing scale         |
| `radius`      | `object` | xs/sm/md/lg/xl border-radius scale   |
| `shadows`     | `object` | xs/sm/md/lg/xl shadow definitions    |
| `breakpoints` | `object` | xs/sm/md/lg/xl responsive breakpoints|
| `components`  | `object` | Per-component Mantine style overrides|

---

## Color Palette Reference

The `colors` object is the most important part of a theme. All fields accept CSS color strings (hex, rgb, hsl).

### Surface & Background

```json
{
  "background": "#0f172a",
  "surface":    "#1e293b",
  "surface2":   "#334155",
  "surface3":   "#475569"
}
```

| Token       | Usage                                              |
|-------------|-----------------------------------------------------|
| `background`| Page/body background                                |
| `surface`   | Cards, panels, modals                               |
| `surface2`  | Elevated surfaces, hover states                     |
| `surface3`  | Highest elevation surfaces, active states            |

### Text Hierarchy

```json
{
  "text":       "#ffffff",
  "textMuted":  "#94a3b8",
  "textMuted2": "#64748b"
}
```

| Token       | Usage                                              |
|-------------|-----------------------------------------------------|
| `text`      | Primary body text                                   |
| `textMuted` | Secondary text, labels, descriptions                |
| `textMuted2`| Tertiary text, placeholders, timestamps              |

### Border

```json
{
  "border": "#334155"
}
```

### Primary Color

The primary color can be specified in two ways:

**Simple string** — the engine generates a 10-step shade array automatically:

```json
{
  "primary": "#3b82f6"
}
```

**Object with shade hint** — explicitly signal that shades should be generated:

```json
{
  "primary": { "base": "#3b82f6", "shades": 10 }
}
```

Both forms produce the same result. The shade array is generated using `chroma.js` in LAB color space for perceptual uniformity.

### Primary Shade Index

```json
{
  "primaryShade": { "light": 6, "dark": 5 }
}
```

Mantine uses this to pick the "active" shade index from the 10-step array. Typically `5` for dark themes (a brighter shade) and `6` for light themes (a darker shade).

### Semantic Status Colors

```json
{
  "success": "#22c55e",
  "warning": "#f59e0b",
  "error":   "#ef4444",
  "info":    "#3b82f6"
}
```

### Optional Accent Colors

```json
{
  "accent":       "#3b82f6",
  "accentGreen":  "#22c55e",
  "accentPurple": "#a855f7"
}
```

These fall back to `primary`, `success`, and `#a855f7` respectively if omitted.

### Custom Dark Tuple

Mantine's component system uses a `dark[0-9]` color array internally. By default, the engine derives this automatically from your `text`, `surface`, and `background` colors. You can override it for fine-tuned control:

```json
{
  "dark": [
    "#C1C2C5", "#A6A7AB", "#909296", "#5C5F66",
    "#373A40", "#2C2E33", "#25262B", "#1A1B1E",
    "#141517", "#101113"
  ]
}
```

Must be exactly 10 entries.

---

## Complete Example

```json
{
  "_comment": "My Brand Dark — custom corporate theme",
  "id": "my-brand-dark",
  "name": "My Brand Dark",
  "colorScheme": "dark",
  "colors": {
    "background": "#0a0e1a",
    "surface":    "#141a2e",
    "surface2":   "#1e2642",
    "surface3":   "#283256",

    "text":       "#f0f0f5",
    "textMuted":  "#8890a8",
    "textMuted2": "#5c6480",

    "border":     "#1e2642",

    "primary":      "#6366f1",
    "primaryShade": { "light": 6, "dark": 5 },

    "success": "#10b981",
    "warning": "#f59e0b",
    "error":   "#f43f5e",
    "info":    "#6366f1",

    "accent":       "#6366f1",
    "accentGreen":  "#10b981",
    "accentPurple": "#8b5cf6"
  }
}
```

---

## Validation

All themes are validated at registration time. The validator checks:

- `id`, `name`, `colorScheme` are present and valid
- All required color fields are parseable CSS colors (via `chroma.js`)
- `primaryShade.light` and `primaryShade.dark` are integers 0–9
- Size scales (spacing, radius, etc.) have all 5 keys: `xs`, `sm`, `md`, `lg`, `xl`
- Typography section has valid font families and heading sizes

Invalid themes are **skipped** with a console warning in development mode. The gallery will continue to work with all other valid themes.

To test your theme manually:

```typescript
import { validateTheme } from './themes/validation';
import myTheme from './themes/definitions/my-brand.json';
import base from './themes/definitions/_base.json';

// Deep-merge with base, then validate
const merged = deepMerge(base, myTheme);
validateTheme(merged); // throws with detailed messages if invalid
```

---

## Runtime Theme Registration

Themes can also be registered at runtime (e.g., from WordPress admin settings):

```typescript
import { registerCustomTheme } from './themes';
import type { ThemeExtension } from './themes/types';

const customTheme: ThemeExtension = {
  id: 'custom-from-api',
  name: 'Custom From API',
  colorScheme: 'dark',
  colors: { /* ... */ },
};

const success = registerCustomTheme(customTheme);
// success === true if valid and registered
```

---

## WordPress Integration

When deployed as a WordPress plugin, the active theme is controlled by:

1. **WP Admin Settings** → Super Gallery → Settings → Theme dropdown
2. **Allow User Theme Override** checkbox — when enabled, visitors can switch themes via the gallery UI and their preference is saved to localStorage
3. **Shortcode** — the `[super-gallery]` shortcode injects the selected theme ID into `window.__wpsgThemeId`

### Theme Resolution Priority

1. `window.__wpsgThemeId` (set by WP embed shortcode)
2. `window.__WPSG_CONFIG__.theme` (same embed, alternative path)
3. `[data-wpsg-theme]` HTML attribute
4. `localStorage` (if user override is allowed)
5. `default-dark` fallback

---

## WCAG Accessibility Guidelines

When creating themes, ensure sufficient contrast ratios:

| Level   | Normal Text | Large Text |
|---------|------------|------------|
| AA      | 4.5:1      | 3:1        |
| AAA     | 7:1        | 4.5:1      |

Use `chroma.js` to check contrast:

```typescript
import chroma from 'chroma-js';
const ratio = chroma.contrast('#ffffff', '#0f172a'); // → 16.75
```

The `high-contrast` bundled theme targets WCAG AAA compliance.

---

## Architecture Overview

```
Theme JSON → deepMerge(_base.json) → validate → resolveColors (chroma.js)
                                                        ↓
                               MantineThemeOverride ← adaptTheme ← auto-generate component overrides
                                                        ↓
                               CSS Variables ← generateCssVariables
                                                        ↓
                               Registry Map (O(1) lookup at runtime)
```

All processing happens **once at startup**. Theme switching at runtime is a simple Map lookup + React state update — target <16ms.

---

## Files Reference

| File | Purpose |
|------|---------|
| `src/themes/types.ts` | TypeScript interfaces |
| `src/themes/validation.ts` | Schema validation |
| `src/themes/colorGen.ts` | chroma.js shade generation |
| `src/themes/adapter.ts` | JSON → MantineThemeOverride |
| `src/themes/cssVariables.ts` | `--wpsg-*` CSS variable generation |
| `src/themes/index.ts` | Registry, public API |
| `src/themes/definitions/_base.json` | Shared defaults |
| `src/themes/definitions/*.json` | Individual theme definitions |
| `src/contexts/ThemeContext.tsx` | React provider, persistence |
| `src/contexts/themeContextDef.ts` | Context type definition |
| `src/hooks/useTheme.ts` | Consumer hook |
| `src/components/Admin/ThemeSelector.tsx` | UI picker component |
