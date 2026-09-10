/**
 * P75-D: admin chrome theme resolution.
 *
 * Settings Panel and Layout Builder chrome lock to the Mullion brand palette
 * (`DEFAULT_THEME_ID` / `default-dark`) unless `applyThemeEverywhere` is on.
 * The public gallery theme is resolved separately via ThemeProvider / useTheme().
 */

import type { CSSProperties } from 'react';
import {
  DEFAULT_THEME,
  defaultCssVariablesResolver,
  mergeMantineTheme,
} from '@mantine/core';

import { DEFAULT_THEME_ID, getTheme, type ThemeEntry } from './index';

/** CSS class that scopes nested Mantine CSS variables to admin chrome surfaces. */
export const ADMIN_CHROME_CLASS = 'mullion-admin-chrome';

/** Mullion brand theme used for locked admin chrome. */
export const BRAND_THEME_ID = DEFAULT_THEME_ID;

export function resolveChromeThemeId(
  applyThemeEverywhere: boolean,
  galleryThemeId: string,
): string {
  return applyThemeEverywhere ? galleryThemeId : BRAND_THEME_ID;
}

export function resolveChromeTheme(
  applyThemeEverywhere: boolean,
  galleryThemeId: string,
): ThemeEntry {
  return getTheme(resolveChromeThemeId(applyThemeEverywhere, galleryThemeId));
}

/** Drawer/Modal classNames that receive the nested chrome CSS variables. */
export function adminChromeClassNames(
  applyThemeEverywhere: boolean,
): { inner?: string; content?: string } {
  if (applyThemeEverywhere) {
    return {};
  }
  return { inner: ADMIN_CHROME_CLASS, content: ADMIN_CHROME_CLASS };
}

/**
 * Drawer/Modal attributes that let the nested chrome CSS variables actually
 * resolve on the parts `adminChromeClassNames()` labels.
 *
 * P76-D: Mantine does not emit its colour variables under the bare
 * `cssVariablesSelector`. It emits three rules — `.mullion-admin-chrome` for
 * the static set (z-index, scale, cursor), and
 * `.mullion-admin-chrome[data-mantine-color-scheme="dark"|"light"]` for every
 * colour. P75-D put the class on `inner`/`content` but nothing put the
 * attribute there, so those parts matched only the static rule and each colour
 * variable fell through to the gallery root by inheritance — the chrome was
 * labelled as brand-scoped while resolving gallery values. Confirmed against a
 * rendered browser in both mount modes, then confirmed fixed by adding exactly
 * this attribute; see the P76-D notes in docs/PHASE76_REPORT.md.
 *
 * P76-H follow-up: this now applies in **both** modes, carrying whichever
 * scheme the chrome resolves to. It originally returned `{}` in follow mode on
 * the same "it inherits the gallery root" reasoning that proved wrong for the
 * inline variables — and the cost was larger than a few tokens. Mantine keys
 * its per-variant input rules on this attribute:
 *
 *   [data-mantine-color-scheme='dark'] .…[data-variant='default'] { --input-bd: … }
 *
 * With no ancestor carrying it, `--input-bd` is never defined, Mantine's own
 * `border: 1px solid var(--input-bd)` collapses to nothing, and every text
 * input and select in follow mode renders with **no border at all** — measured
 * `0px none` against lock mode's `1px solid`. That is also why the resting
 * outline appeared to be unpainted product-wide: every measurement had been
 * taken in follow mode.
 */
export function adminChromeAttributes(
  applyThemeEverywhere: boolean,
  galleryThemeId: string,
): { inner: Record<string, string>; content: Record<string, string> } {
  const attrs = {
    'data-mantine-color-scheme': resolveChromeTheme(applyThemeEverywhere, galleryThemeId).meta
      .colorScheme,
  };
  return { inner: attrs, content: attrs };
}

/**
 * Inline CSS custom properties for the parts `adminChromeClassNames()` labels.
 *
 * P76-H: `adminChromeAttributes()` makes Mantine's scoped variable *rules*
 * match, which is enough in a light-DOM mount. It is not enough in a shadow
 * mount — the shipped default — because those rules render in a `<style>`
 * inside the shadow root while `Drawer`/`Modal` portal to `document.body`
 * (Mantine `Portal`, `reuseTargetNode` default true). A `<style>` in a shadow
 * root only styles that shadow tree, so the rules and the elements they target
 * end up in different trees. Inline styles have no such problem: they travel
 * with the element wherever it is portaled, so this one mechanism covers both
 * mount modes.
 *
 * Mantine's variable generation is public API — `defaultCssVariablesResolver`
 * returns `{ variables, dark, light }` — so nothing is reproduced here. The
 * resolver wants a fully resolved `MantineTheme` rather than the override we
 * pass around, hence the `mergeMantineTheme` call.
 *
 * Unlike `adminChromeClassNames()` / `adminChromeAttributes()`, this returns a
 * value in **both** modes, and that asymmetry is the point. Those two return
 * `{}` in follow mode because the chrome is meant to inherit the gallery root —
 * which it does in a light-DOM mount, and cannot in a shadow mount, for exactly
 * the reason above: the gallery's own variables are injected at `:host` inside
 * the shadow root, and the portaled chrome is outside it. Verified in a browser
 * (2026-08-27): follow mode in a shadow mount rendered `Cancel` and `Save
 * Changes` with no button surface at all. So follow mode is handed the gallery
 * theme's variables inline — the same values inheritance would have supplied
 * had the boundary not been in the way.
 */
const chromeVarCache = new Map<string, CSSProperties>();

function chromeVars(themeId: string): CSSProperties {
  const cached = chromeVarCache.get(themeId);
  if (cached) return cached;

  const entry = getTheme(themeId);
  const resolved = mergeMantineTheme(DEFAULT_THEME, entry.mantine);
  const { variables, dark, light } = defaultCssVariablesResolver(resolved);
  // The nested provider runs `forceColorScheme`, so exactly one of the two
  // scheme blocks can ever apply — pick it here rather than emitting both and
  // letting the later key win by accident.
  const scheme = entry.meta.colorScheme === 'dark' ? dark : light;

  // P76-I-2: the focus ring resolves its colour from
  // `--mullion-color-primary-stroke`. That variable is injected onto the
  // gallery root by ThemeContext, but portaled admin chrome escapes the
  // gallery root entirely — so it has to travel with the chrome's own
  // variable block or the ring silently falls back inside every Drawer,
  // Modal and Menu. `defaultCssVariablesResolver` only emits `--mantine-*`,
  // so it is added here explicitly.
  const colors = (entry.mantine.other as { colors?: { primaryStroke?: string; focusHalo?: string } } | undefined)
    ?.colors;
  const stroke = colors?.primaryStroke;
  // P77-F: the halo travels the same way, for the same reason.
  const halo = colors?.focusHalo;

  const vars = {
    ...variables,
    ...scheme,
    ...(stroke ? { '--mullion-color-primary-stroke': stroke } : {}),
    ...(halo ? { '--mullion-color-focus-halo': halo } : {}),
  } as CSSProperties;

  chromeVarCache.set(themeId, vars);
  return vars;
}

export function adminChromeStyles(
  applyThemeEverywhere: boolean,
  galleryThemeId: string,
): { inner: CSSProperties; content: CSSProperties } {
  const vars = chromeVars(resolveChromeThemeId(applyThemeEverywhere, galleryThemeId));
  return { inner: vars, content: vars };
}
