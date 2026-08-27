# Styles

This folder contains the global SCSS used across the app.

- global.scss: global reset, base styles, and the one structural `--z-header`
  custom property.
- builder.css / wpAdminFormReset.css: Layout Builder shell and wp-admin form
  overrides.

Design tokens are **not** defined here. Colors, radii, shadows, and fonts are
`--mullion-*` custom properties emitted at runtime by the theme engine
(`src/theme/`); read those directly. The old `_tokens.scss` alias bridge was
deleted in P76-E.
