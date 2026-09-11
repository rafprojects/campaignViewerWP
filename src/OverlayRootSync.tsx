import { useEffect } from 'react';
import { useMantineTheme } from '@mantine/core';
import { syncOverlayMantineVars, syncOverlayThemeVars, type PortalTarget } from './portalTarget';

/**
 * P77-B prototype: keeps the overlay root's copies of the theme variables
 * current. Renders nothing; must sit inside the `MantineProvider` whose theme
 * it mirrors. No-op unless the portal mode is `overlay-root`.
 */
export function OverlayRootSync({
  portal,
  cssVars,
  colorScheme,
}: {
  portal: PortalTarget;
  cssVars: string;
  colorScheme: 'light' | 'dark';
}) {
  const theme = useMantineTheme();

  useEffect(() => {
    syncOverlayThemeVars(portal, cssVars);
  }, [portal, cssVars]);

  useEffect(() => {
    syncOverlayMantineVars(portal, theme, colorScheme);
  }, [portal, theme, colorScheme]);

  return null;
}
