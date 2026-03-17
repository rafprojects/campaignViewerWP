import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  it('returns fallback defaults when used outside ThemeProvider', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useTheme());

    expect(result.current.themeId).toBe('default-dark');
    expect(result.current.colorScheme).toBeDefined();
    expect(result.current.availableThemes.length).toBeGreaterThan(0);
    expect(typeof result.current.setTheme).toBe('function');
    expect(typeof result.current.setPreviewTheme).toBe('function');

    spy.mockRestore();
  });
});
