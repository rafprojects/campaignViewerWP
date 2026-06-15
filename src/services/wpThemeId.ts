/**
 * WordPress theme-id injection glue.
 *
 * The single place that reads the WP-injected initial-theme hints. Passed to
 * `<ThemeProvider resolveWpThemeIds={...}>` so the theme context itself stays
 * free of any direct `window.__WPSG_*` / `data-wpsg-theme` coupling and can be
 * extracted/published without dragging WordPress along.
 *
 * [P51-D] Decoupling: lifted out of `ThemeContext.resolveInitialThemeId` per
 * spike playbook §3/§6.
 *
 * Returns candidate theme IDs in priority order. The theme context picks the
 * first candidate that resolves to a registered theme, so an invalid earlier
 * hint still falls through to a valid later one (e.g. a stale `__wpsgThemeId`
 * falls through to `__WPSG_CONFIG__.theme`).
 */
export function resolveWpThemeIds(): Array<string | null | undefined> {
  const candidates: Array<string | null | undefined> = [];

  // 1. Per-instance global + DOM data-attribute (set by PHP on the embed container).
  if (typeof window !== 'undefined') {
    candidates.push(window.__wpsgThemeId);
  }
  if (typeof document !== 'undefined') {
    candidates.push(document.querySelector('[data-wpsg-theme]')?.getAttribute('data-wpsg-theme'));
  }

  // 2. __WPSG_CONFIG__.theme (set by the WP embed shortcode).
  if (typeof window !== 'undefined') {
    candidates.push(window.__WPSG_CONFIG__?.theme);
  }

  return candidates;
}
