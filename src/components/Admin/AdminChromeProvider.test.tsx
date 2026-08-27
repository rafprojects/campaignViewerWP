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

  // P75 review: Mantine stamps `data-mantine-color-scheme` on getRootElement().
  // A document-level querySelector cannot see the scope sentinel from inside a
  // shadow root, so it used to fall back to document.body and write the
  // attribute onto the host wp-admin page.
  it('never writes the color-scheme attribute onto document.body from a shadow root', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadow.appendChild(container);

    render(
      <ThemeProvider forcedThemeId="tokyo-night">
        <AdminChromeProvider applyThemeEverywhere={false}>
          <span>ok</span>
        </AdminChromeProvider>
      </ThemeProvider>,
      { container },
    );

    expect(document.body.hasAttribute('data-mantine-color-scheme')).toBe(false);
    const sentinel = shadow.querySelector(`.${ADMIN_CHROME_CLASS}`);
    expect(sentinel).not.toBeNull();
    expect(sentinel?.getAttribute('data-mantine-color-scheme')).toBe(
      getTheme(BRAND_THEME_ID).meta.colorScheme,
    );
  });
});
