import { useEffect } from 'react';
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
  // P76-F: this used to assert the provider was a literal passthrough (no
  // sentinel in the DOM). It now always renders the provider and changes only
  // its inputs, so the structural assertion is gone — replaced by the property
  // that actually matters and that the old test never checked: in follow mode
  // the chrome resolves to the *gallery* theme, not the brand theme.
  it('follows the gallery theme when applyThemeEverywhere is true', () => {
    // github-light is light; the brand theme is dark, so colorScheme
    // discriminates between "followed the gallery" and "fell back to brand".
    const galleryPrimary = getTheme('github-light').mantine.colors?.primary?.[5] ?? '';
    const brandPrimary = getTheme(BRAND_THEME_ID).mantine.colors?.primary?.[5] ?? '';
    expect(galleryPrimary).not.toBe(brandPrimary);

    render(
      <ThemeProvider forcedThemeId="github-light">
        <AdminChromeProvider applyThemeEverywhere>
          <PrimarySwatch />
          <span data-testid="child">ok</span>
        </AdminChromeProvider>
      </ThemeProvider>,
    );

    expect(screen.getByTestId('child')).toHaveTextContent('ok');
    expect(screen.getByTestId('primary-swatch').textContent).toBe(galleryPrimary);
    expect(document.querySelector(`.${ADMIN_CHROME_CLASS}`)?.getAttribute(
      'data-mantine-color-scheme',
    )).toBe('light');
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

  // P76-F: SettingsPanel reads applyThemeEverywhere off the *live draft*, so
  // flipping the Switch re-renders this provider mid-session. When the two
  // states were structurally different trees (passthrough vs. wrapped), React
  // saw different element types at each position and unmounted the whole
  // Drawer subtree — dropping keyboard focus from the Switch the user had
  // just operated. This asserts the subtree survives the flip.
  describe('toggling applyThemeEverywhere', () => {
    function MountCounter({ onMount }: { onMount: () => void }) {
      useEffect(() => {
        onMount();
      }, [onMount]);
      return <span data-testid="counter">mounted</span>;
    }

    function renderFlip(from: boolean, to: boolean) {
      let mounts = 0;
      const onMount = () => {
        mounts += 1;
      };
      const tree = (flag: boolean) => (
        <ThemeProvider forcedThemeId="tokyo-night">
          <AdminChromeProvider applyThemeEverywhere={flag}>
            <MountCounter onMount={onMount} />
          </AdminChromeProvider>
        </ThemeProvider>
      );
      const { rerender } = render(tree(from));
      expect(mounts).toBe(1);
      rerender(tree(to));
      return mounts;
    }

    it('does not remount children when the flag goes on', () => {
      expect(renderFlip(false, true)).toBe(1);
    });

    it('does not remount children when the flag goes off', () => {
      expect(renderFlip(true, false)).toBe(1);
    });

    // The remount assertions above are the mechanism; this is the symptom the
    // track exists to fix. A user tabs to the Switch, presses space, and the
    // control they are operating must not be torn out from under them.
    it.each([
      ['on', false, true],
      ['off', true, false],
    ])('keeps focus on the toggled control when the flag goes %s', (_label, from, to) => {
      const tree = (flag: boolean) => (
        <ThemeProvider forcedThemeId="tokyo-night">
          <AdminChromeProvider applyThemeEverywhere={flag}>
            <button type="button" data-testid="switch">
              Apply theme everywhere
            </button>
          </AdminChromeProvider>
        </ThemeProvider>
      );

      const { rerender } = render(tree(from));
      const control = screen.getByTestId('switch');
      control.focus();
      expect(document.activeElement).toBe(control);

      rerender(tree(to));

      expect(screen.getByTestId('switch')).toBe(control);
      expect(document.activeElement).toBe(control);
    });
  });
});
