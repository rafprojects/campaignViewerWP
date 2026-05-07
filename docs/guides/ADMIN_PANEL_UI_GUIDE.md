# Admin Panel UI Developer Guide (Mantine)

This guide explains the Admin Panel UI structure, the Mantine components in use, and how to customize layout, spacing, borders, and overall visual style.

## Where the Admin Panel lives
- Primary component: `AdminPanel` in [src/components/Admin/AdminPanel.tsx](../src/components/Admin/AdminPanel.tsx)
- Mantine providers: [src/main.tsx](../src/main.tsx)
- Shadow DOM styles injection: [src/shadowStyles.ts](../src/shadowStyles.ts)

## Structure overview (layout and control map)
The admin UI is a single component composed of Mantine primitives. The layout flows like this:

1. **Root container** — `Card`
   - Controls the overall panel surface, border, and radius.
   - Main props used: `withBorder`, `radius`, `shadow`, `p`.

2. **Header bar** — `Group`
   - Contains back button, panel title, and “New Campaign” button.
   - Props: `justify="space-between"` to spread items, `gap` for spacing.

3. **Tabs** — `Tabs` + `Tabs.List` + `Tabs.Tab`
   - Controls the four sections: Campaigns, Media, Access, Audit.
   - `Tabs.Panel` contains each section body.

4. **Tables** — `Table` + `Table.Thead` + `Table.Tbody` + `Table.Tr` + `Table.Th` + `Table.Td`
   - Used for Campaigns, Media, Access, and Audit lists.
   - Wrapped in `ScrollArea` for overflow handling.

5. **Forms** — `TextInput`, `Textarea`, `Select`, `Button`
   - Create/edit Campaign form in a `Card` with a `Stack`.

6. **Modal** — `Modal`
   - Archive confirmation dialog.

## Component breakdown (what each controls)

### `Card`
- **Purpose:** panel surface and section cards.
- **Controls:** border, radius, padding, shadow.
- **Adjustments:**
  - Increase padding: `p="lg"`
  - Rounder corners: `radius="lg"`
  - Stronger shadow: `shadow="md"`

### `Group`
- **Purpose:** horizontal layout and spacing for header/actions.
- **Controls:** spacing and alignment.
- **Adjustments:**
  - Spacing: `gap="sm" | "md" | "lg"`
  - Alignment: `justify="space-between"`, `justify="flex-end"`, `wrap="nowrap"`

### `Stack`
- **Purpose:** vertical spacing (form layout).
- **Controls:** vertical gaps.
- **Adjustments:**
  - `gap="sm"` to tighten; `gap="lg"` to loosen.

### `Tabs`
- **Purpose:** section navigation.
- **Controls:** panel visibility and tab labels.
- **Adjustments:**
  - To change sizes, apply `size` or use `classNames`/`styles`.
  - Add new sections by creating a new `Tabs.Tab` + `Tabs.Panel`.

### `Table`
- **Purpose:** structured list displays.
- **Controls:** row density, headings, cell layout.
- **Adjustments:**
  - Row density: `verticalSpacing="xs" | "sm" | "md"`
  - Add hover: `highlightOnHover`
  - Zebra rows: `striped`
  - Borders: `withBorder`, `withColumnBorders`

### `Text`, `Badge`
- **Purpose:** typography and status chips.
- **Controls:** color, weight, size, variant.
- **Adjustments:**
  - `Text`: `fw={700}`, `size="xs"`, `c="dimmed"`
  - `Badge`: `variant="light"`, `color="teal" | "gray" | "yellow"`

### `TextInput`, `Textarea`, `Select`
- **Purpose:** form fields and filters.
- **Controls:** width, labels, placeholder, validation UI.
- **Adjustments:**
  - Width: use `w`, `miw`, `maw`, or `Group grow`
  - Labels: `label="..."`
  - Add spacing with `mt` / `mb`

### `Button`
- **Purpose:** actions (create, edit, archive).
- **Controls:** size, color, variant, icons.
- **Adjustments:**
  - `variant="outline" | "filled" | "default"`
  - `size="xs" | "sm" | "md"`
  - `leftSection={<IconPlus size={14} />}`

### `Modal`
- **Purpose:** confirmations and dialogs.
- **Controls:** open/close state, size, and layout.
- **Adjustments:**
  - Width: `size="sm" | "md" | "lg"`
  - Body layout: use `Stack` or `Group`

## How to modify spacing, borders, and size

### Spacing
- **Horizontal:** `Group gap="sm"` or `gap="lg"`
- **Vertical:** `Stack gap="sm"` or `gap="lg"`
- **Manual:** `mt`, `mb`, `my`, `mx`, `p`, `px`, `py`

### Borders
- Cards: `withBorder`, `radius`
- Tables: `withBorder`, `withColumnBorders`
- Badges: `variant="light"` or `variant="filled"`

### Size
- Inputs: `w`, `miw`, `maw` to control field width
- Tables: wrap in `ScrollArea` and set `mah` to constrain height
- Buttons: `size="xs" | "sm" | "md"`

## Theme overrides (global look & feel)

### MantineProvider theme
You can set global theme values in [src/main.tsx](../src/main.tsx):

```tsx
<MantineProvider
  theme={{
    fontFamily: 'Inter, system-ui, sans-serif',
    primaryColor: 'indigo',
    defaultRadius: 'md',
    spacing: { xs: 8, sm: 12, md: 16, lg: 20 },
  }}
>
```

Useful theme keys:
- `primaryColor`: affects button/link accents
- `defaultRadius`: rounding for inputs, cards, badges
- `spacing`: overall spacing scale
- `fontFamily`: typography across all components

### Sample theme mapping to existing tokens

If you want Mantine to follow the existing `--color-*` tokens, you can map them using CSS variables:

```tsx
<MantineProvider
  theme={{
    colors: {
      brand: [
        'var(--color-bg)',
        'var(--color-surface)',
        'var(--color-surface-2)',
        'var(--color-surface-3)',
        'var(--color-border)',
        'var(--color-muted-2)',
        'var(--color-muted)',
        'var(--color-accent)',
        '#60a5fa',
        '#93c5fd',
      ],
    },
    primaryColor: 'brand',
    fontFamily: 'Inter, system-ui, sans-serif',
    defaultRadius: 'md',
  }}
>
```

If you prefer, you can keep Mantine defaults and only override specific components via `components` in the theme.

### Shadow DOM note

If Shadow DOM is enabled, Mantine styles are injected via [src/shadowStyles.ts](../src/shadowStyles.ts). Any global overrides should also be included there if they rely on CSS variables or resets.

## Component‑level overrides (localized styling)

Mantine supports scoped styling on components:

- **`styles` prop** for inline style objects
- **`classNames` prop** to attach CSS class selectors

Example:

```tsx
<Button
  classNames={{ root: 'admin-primary-button' }}
  styles={{ root: { borderRadius: 999 } }}
>
  Save
</Button>
```

If you prefer SCSS modules, add a module and map it via `classNames`.

## Common customization recipes

### Make the panel wider

- Adjust container width in the parent component that renders `AdminPanel` (usually in `App.tsx` layout), or add `w="100%"` to the root `Card` and wrap it in a wider container.

### Add extra spacing between sections

- Increase `mb` and `mt` on `Card`, `Tabs.Panel`, or `Stack`.

### Add borders to tables

- Add `withBorder` or `withColumnBorders` on `Table`.

### Add a “pill” tab style

- Use `classNames` on `Tabs` and `Tabs.Tab` to add rounded borders and background color.

---

If you want a branded theme (colors, gradients, typography), I can add a Mantine `theme` object that aligns with your current `--color-*` tokens and apply it across the Admin Panel.
