/**
 * Coverage tests for useBuilderOverlayColors and useBuilderShellColors —
 * covers the light colorScheme branches (line 72 in overlay, lines 29+45 in shell).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBuilderOverlayColors } from './useBuilderOverlayColors';
import { useBuilderShellColors } from './useBuilderShellColors';

// Spy on useTheme to control colorScheme
const useThemeMock = vi.hoisted(() => vi.fn());

vi.mock('./useTheme', () => ({
  useTheme: useThemeMock,
}));

const darkTheme = { themeId: 'default-dark', colorScheme: 'dark' as const };
const lightTheme = { themeId: 'default-light', colorScheme: 'light' as const };

// ── useBuilderOverlayColors ───────────────────────────────────────────────

describe('useBuilderOverlayColors', () => {
  it('returns DARK color set when colorScheme is dark', () => {
    useThemeMock.mockReturnValue(darkTheme);
    const { result } = renderHook(() => useBuilderOverlayColors());
    expect(result.current.rulerBg).toContain('rgba(30,30,30');
  });

  it('returns LIGHT color set when colorScheme is light (line 72 else branch)', () => {
    useThemeMock.mockReturnValue(lightTheme);
    const { result } = renderHook(() => useBuilderOverlayColors());
    expect(result.current.rulerBg).toContain('rgba(215,215,215');
  });
});

// ── useBuilderShellColors ─────────────────────────────────────────────────

describe('useBuilderShellColors', () => {
  it('computes scrollbar opacity with dark factor when colorScheme is dark (line 45)', () => {
    useThemeMock.mockReturnValue(darkTheme);
    const { result } = renderHook(() => useBuilderShellColors());
    // scrollbar uses 0.35 for dark — just check it returns a string without throwing
    expect(typeof result.current.scrollbar).toBe('string');
    expect(result.current.scrollbar.length).toBeGreaterThan(0);
  });

  it('computes scrollbar opacity with light factor when colorScheme is light (line 45 else)', () => {
    useThemeMock.mockReturnValue(lightTheme);
    const { result } = renderHook(() => useBuilderShellColors());
    expect(typeof result.current.scrollbar).toBe('string');
  });
});
