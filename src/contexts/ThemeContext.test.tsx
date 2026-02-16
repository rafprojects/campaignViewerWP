import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeContext';
import { useTheme } from '../hooks/useTheme';
import { DEFAULT_THEME_ID, getAllThemeMeta } from '../themes/index';

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
});
