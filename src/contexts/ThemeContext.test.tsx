import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from '../hooks/useTheme';
import { DEFAULT_THEME_ID, getAllThemeMeta, getTheme } from '../themes/index';

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

function forcedWrapper(themeId: string) {
  return ({ children }: { children: ReactNode }) => (
    <ThemeProvider forcedThemeId={themeId}>{children}</ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset any window globals
    delete (window as unknown as Record<string, unknown>).__wpsgThemeId;
    delete (window as unknown as Record<string, unknown>).__WPSG_CONFIG__;
    document.head.querySelectorAll('style[id^="wpsg-theme-vars-"]').forEach((node) => node.remove());
  });

  it('provides default theme when no preference is set', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe(DEFAULT_THEME_ID);
    expect(result.current.mantineTheme).toBeDefined();
    expect(result.current.availableThemes.length).toBeGreaterThan(0);
    expect(result.current.cssVars).toBeTruthy();
  });

  it('provides all available themes from the registry', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    const allMeta = getAllThemeMeta();
    expect(result.current.availableThemes).toEqual(allMeta);
  });

  it('switches theme via setTheme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    // Pick a non-default theme
    const otherTheme = result.current.availableThemes.find(
      (t) => t.id !== DEFAULT_THEME_ID,
    );
    expect(otherTheme).toBeDefined();

    act(() => {
      result.current.setTheme(otherTheme!.id);
    });

    expect(result.current.themeId).toBe(otherTheme!.id);
  });

  it('falls back to default for invalid theme ID', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme('totally-invalid-theme-id');
    });

    expect(result.current.themeId).toBe(DEFAULT_THEME_ID);
  });

  it('persists theme choice to localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    const otherTheme = result.current.availableThemes.find(
      (t) => t.id !== DEFAULT_THEME_ID,
    );
    expect(otherTheme).toBeDefined();

    act(() => {
      result.current.setTheme(otherTheme!.id);
    });

    expect(localStorage.getItem('wpsg-theme-id')).toBe(otherTheme!.id);
  });

  it('restores theme from localStorage on mount', () => {
    const allMeta = getAllThemeMeta();
    const otherTheme = allMeta.find((t) => t.id !== DEFAULT_THEME_ID);
    expect(otherTheme).toBeDefined();

    localStorage.setItem('wpsg-theme-id', otherTheme!.id);

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe(otherTheme!.id);
  });

  it('respects forcedThemeId prop', () => {
    const allMeta = getAllThemeMeta();
    const otherTheme = allMeta.find((t) => t.id !== DEFAULT_THEME_ID);
    expect(otherTheme).toBeDefined();

    const { result } = renderHook(() => useTheme(), {
      wrapper: forcedWrapper(otherTheme!.id),
    });

    expect(result.current.themeId).toBe(otherTheme!.id);
  });

  it('reads WP global __wpsgThemeId', () => {
    const allMeta = getAllThemeMeta();
    const otherTheme = allMeta.find((t) => t.id !== DEFAULT_THEME_ID);
    expect(otherTheme).toBeDefined();

    (window as unknown as Record<string, unknown>).__wpsgThemeId = otherTheme!.id;

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe(otherTheme!.id);
  });

  it('reads WP __WPSG_CONFIG__.theme', () => {
    const allMeta = getAllThemeMeta();
    const otherTheme = allMeta.find((t) => t.id !== DEFAULT_THEME_ID);
    expect(otherTheme).toBeDefined();

    (window as unknown as Record<string, unknown>).__WPSG_CONFIG__ = { theme: otherTheme!.id };

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.themeId).toBe(otherTheme!.id);
  });

  it('provides a valid colorScheme', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(['light', 'dark']).toContain(result.current.colorScheme);
  });

  it('does not persist when allowPersistence is false', () => {
    const noPersistWrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider allowPersistence={false}>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper: noPersistWrapper });

    const otherTheme = result.current.availableThemes.find(
      (t) => t.id !== DEFAULT_THEME_ID,
    );
    expect(otherTheme).toBeDefined();

    act(() => {
      result.current.setTheme(otherTheme!.id);
    });

    expect(result.current.themeId).toBe(otherTheme!.id);
    // Should NOT have persisted
    expect(localStorage.getItem('wpsg-theme-id')).toBeNull();
  });

  it('updates scoped document CSS variables when previewing a theme in non-shadow mode', () => {
    const host = document.createElement('div');
    host.dataset.wpsgThemeScope = 'test-scope';
    document.body.appendChild(host);

    const scopedWrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider
        hostElement={host}
        themeScopeSelector='[data-wpsg-theme-scope="test-scope"]'
      >
        {children}
      </ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper: scopedWrapper });
    const otherTheme = result.current.availableThemes.find((theme) => theme.id !== DEFAULT_THEME_ID);
    expect(otherTheme).toBeDefined();

    const initialStyle = document.head.querySelector('#wpsg-theme-vars-test-scope') as HTMLStyleElement | null;
    expect(initialStyle).toBeTruthy();
    expect(initialStyle?.textContent).toContain('[data-wpsg-theme-scope="test-scope"]');

    act(() => {
      result.current.setPreviewTheme(otherTheme!.id);
    });

    const updatedStyle = document.head.querySelector('#wpsg-theme-vars-test-scope') as HTMLStyleElement | null;
    expect(updatedStyle).toBeTruthy();
    expect(result.current.themeId).toBe(otherTheme!.id);
    expect(updatedStyle?.textContent).toBe(
      getTheme(otherTheme!.id).cssVars.replace(/:host/g, '[data-wpsg-theme-scope="test-scope"]'),
    );

    host.remove();
    updatedStyle?.remove();
  });

  it('removes scoped document CSS variables on unmount', () => {
    const host = document.createElement('div');
    host.dataset.wpsgThemeScope = 'cleanup-scope';
    document.body.appendChild(host);

    const scopedWrapper = ({ children }: { children: ReactNode }) => (
      <ThemeProvider
        hostElement={host}
        themeScopeSelector='[data-wpsg-theme-scope="cleanup-scope"]'
      >
        {children}
      </ThemeProvider>
    );

    const { unmount } = renderHook(() => useTheme(), { wrapper: scopedWrapper });

    expect(document.head.querySelector('#wpsg-theme-vars-cleanup-scope')).toBeTruthy();

    unmount();

    expect(document.head.querySelector('#wpsg-theme-vars-cleanup-scope')).toBeNull();
    host.remove();
  });
});
