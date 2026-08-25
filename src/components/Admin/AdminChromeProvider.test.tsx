import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { useMantineTheme } from '@mantine/core';

import { AdminChromeProvider } from './AdminChromeProvider';
import { ADMIN_CHROME_CLASS, BRAND_THEME_ID } from '@/themes/chromeTheme';
import { getTheme } from '@/themes/index';
import { ThemeProvider } from '@/contexts/ThemeContext';

function PrimarySwatch() {
  const theme = useMantineTheme();
  return <span data-testid="primary-swatch">{theme.colors.primary?.[5] ?? ''}</span>;
}

describe('AdminChromeProvider', () => {
  it('is a passthrough when applyThemeEverywhere is true', () => {
    render(
      <ThemeProvider forcedThemeId="tokyo-night">
        <AdminChromeProvider applyThemeEverywhere>
          <span data-testid="child">ok</span>
        </AdminChromeProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('ok');
    expect(document.querySelector(`.${ADMIN_CHROME_CLASS}`)).toBeNull();
  });

  it('scopes locked chrome to the Mullion brand palette', () => {
    const brandPrimary = getTheme(BRAND_THEME_ID).mantine.colors?.primary?.[5] ?? '';

    render(
      <ThemeProvider forcedThemeId="tokyo-night">
        <AdminChromeProvider applyThemeEverywhere={false}>
          <PrimarySwatch />
        </AdminChromeProvider>
      </ThemeProvider>,
    );

    expect(document.querySelector(`.${ADMIN_CHROME_CLASS}`)).not.toBeNull();
    expect(screen.getByTestId('primary-swatch').textContent).toBe(brandPrimary);
  });
});
