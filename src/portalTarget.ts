/**
 * P77-B prototype: where Mantine portals go under a shadow mount.
 *
 * Mantine's `Portal` appends to `document.body` unless given a `target`, and
 * `theme.components.Portal.defaultProps.target` sets that target for every
 * Drawer, Modal, Menu, Popover and Select dropdown at once. Nested
 * `MantineProvider`s inherit the parent theme, so the target is set once, in
 * `ThemedApp`, and never re-declared: Mantine's theme merge spreads an object
 * it finds on both sides, which would turn the element into a plain object.
 *
 * Three modes, selected by `window.__MULLION_PORTAL_MODE__` or `?portal=`:
 *
 * - `document`: the shipped behaviour. Overlays render under `document.body`,
 *   outside the shadow root, exposed to host CSS and unreachable by our
 *   shadow-root stylesheets (the P77-A contract's boundary).
 * - `shadow`: overlays render in a node inside the gallery's own shadow root.
 *   Every stylesheet and variable in that root reaches them, but they now sit
 *   inside whatever stacking context the host page wraps the gallery in.
 * - `overlay-root`: overlays render in a second shadow root of ours, attached
 *   to a host appended to `document.body`. It escapes the host page's
 *   stacking context like `document` does and is isolated from host CSS like
 *   `shadow` is; the price is a copy of the shadow stylesheet (plus the
 *   builder's document-only sheets) and the theme
 *   variables, which this module keeps in sync.
 *
 * Light mounts (`?shadow=0`, the wp-admin pages) always use `document`.
 */

import { useEffect, useState } from 'react';
import {
  convertCssVariables,
  defaultCssVariablesResolver,
  type MantineTheme,
  type MantineThemeOverride,
} from '@mantine/core';
import { overlayStyles } from './shadowStyles';

export type PortalMode = 'document' | 'shadow' | 'overlay-root';

/**
 * P77-I: the shipped default is `overlay-root`. Portaled chrome renders in a
 * shadow root of ours attached to `document.body`, so host-page CSS cannot
 * reach it and every theme token does. `document` stays reachable by explicit
 * override for support cases and for the light mount, which ignores the mode.
 */
export function resolvePortalMode(): PortalMode {
  const flag = (window as Window & { __MULLION_PORTAL_MODE__?: string }).__MULLION_PORTAL_MODE__;
  // The env fallback lets a dev server run a whole Playwright suite in one
  // mode without touching the specs; it is unset in production builds.
  const raw = flag
    ?? new URLSearchParams(window.location.search).get('portal')
    ?? (import.meta.env.VITE_MULLION_PORTAL_MODE as string | undefined);
  return raw === 'shadow' || raw === 'document' ? raw : 'overlay-root';
}

export interface PortalTarget {
  mode: PortalMode;
  /** The element Mantine portals into. Null means Mantine's default. */
  target: HTMLElement | null;
  /** Present in `overlay-root` mode only. */
  overlay?: {
    host: HTMLElement;
    themeVars: HTMLStyleElement;
    mantineVars: HTMLStyleElement;
  };
}

function createTarget(rootId: string): HTMLElement {
  const target = document.createElement('div');
  target.setAttribute('data-mullion-portal', rootId);
  return target;
}

function createPortalTarget(mode: PortalMode, rootId: string, shadowRootEl?: ShadowRoot): PortalTarget {
  if (mode === 'shadow' && shadowRootEl) {
    return { mode, target: createTarget(rootId) };
  }
  if (mode === 'overlay-root' && shadowRootEl) {
    const host = document.createElement('div');
    host.setAttribute('data-mullion-overlay-root', rootId);
    const shadow = host.attachShadow({ mode: 'open' });
    const base = document.createElement('style');
    base.setAttribute('data-mullion', 'true');
    base.textContent = overlayStyles;
    const themeVars = document.createElement('style');
    themeVars.id = 'mullion-theme-vars';
    const mantineVars = document.createElement('style');
    mantineVars.setAttribute('data-mantine-styles', 'variables');
    const target = createTarget(rootId);
    shadow.append(base, themeVars, mantineVars, target);
    return { mode, target, overlay: { host, themeVars, mantineVars } };
  }
  return { mode: 'document', target: null };
}

/**
 * Creates the portal target once per mount and attaches it to the tree it
 * belongs to. Call above `MantineProvider`, then pass `target` through
 * `withPortalTarget`.
 */
export function usePortalTarget(mode: PortalMode, rootId: string, shadowRootEl?: ShadowRoot): PortalTarget {
  const [portal] = useState(() => createPortalTarget(mode, rootId, shadowRootEl));

  useEffect(() => {
    if (!portal.target) return undefined;
    if (portal.overlay) {
      document.body.appendChild(portal.overlay.host);
      return () => portal.overlay?.host.remove();
    }
    shadowRootEl?.appendChild(portal.target);
    return () => portal.target?.remove();
  }, [portal, shadowRootEl]);

  return portal;
}

/** Adds the Portal default target to a theme override without deep-merging the element. */
export function withPortalTarget(theme: MantineThemeOverride, portal: PortalTarget): MantineThemeOverride {
  if (!portal.target) return theme;
  return {
    ...theme,
    components: {
      ...theme.components,
      Portal: { defaultProps: { target: portal.target } },
    },
  };
}

/** Writes the gallery's theme variables into the overlay root's copy. */
export function syncOverlayThemeVars(portal: PortalTarget, cssVars: string): void {
  if (portal.overlay) portal.overlay.themeVars.textContent = cssVars;
}

/**
 * Writes Mantine's variables and colour-scheme attribute into the overlay
 * root. Mantine keys its scheme-specific rules on the attribute, and the
 * variable sheet uses the same `:host` selector MantineProvider emits.
 */
export function syncOverlayMantineVars(portal: PortalTarget, theme: MantineTheme, colorScheme: 'light' | 'dark'): void {
  if (!portal.overlay) return;
  portal.overlay.host.setAttribute('data-mantine-color-scheme', colorScheme);
  portal.target?.setAttribute('data-mantine-color-scheme', colorScheme);
  portal.overlay.mantineVars.textContent = convertCssVariables(defaultCssVariablesResolver(theme), ':host');
}
