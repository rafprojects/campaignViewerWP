import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';
import { DEFAULT_THEME_ID, getAllThemeMeta } from '@/themes/index';

const { setPreviewThemeSpy } = vi.hoisted(() => ({
  setPreviewThemeSpy: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');

  return {
    ...actual,
    Select: ({
      label,
      description,
      value,
      onChange,
      data,
    }: {
      label?: ReactNode;
      description?: ReactNode;
      value?: string | null;
      onChange?: (nextValue: string | null) => void;
      data: Array<{ value: string; label: string }>;
    }) => (
      <label>
        {label ? <span>{label}</span> : null}
        {description ? <span>{description}</span> : null}
        <select
          aria-label={typeof label === 'string' ? label : 'Theme'}
          value={value ?? ''}
          onChange={(event) => onChange?.(event.currentTarget.value || null)}
        >
          {data.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
    ),
  };
});

vi.mock('@/hooks/useTheme', async () => {
  const themes = await vi.importActual<typeof import('@/themes/index')>('@/themes/index');

  return {
    useTheme: () => ({
      themeId: themes.DEFAULT_THEME_ID,
      availableThemes: themes.getAllThemeMeta(),
      setPreviewTheme: setPreviewThemeSpy,
      setTheme: vi.fn(),
      colorScheme: 'dark' as const,
      cssVars: '',
      mantineTheme: {},
    }),
  };
});

import { ThemeSelector } from './ThemeSelector';

const allThemes = getAllThemeMeta();
const alternateTheme = allThemes.find((theme) => theme.id !== DEFAULT_THEME_ID)!;

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>{children}</MantineProvider>
  );
}

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    setPreviewThemeSpy.mockReset();
  });

  it('renders a Select with default label', () => {
    render(<ThemeSelector />, { wrapper });

    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(
      screen.getByText('Choose a color theme. Preview applies instantly; saved when you click Save.'),
    ).toBeInTheDocument();
  });

  it('renders with custom label and description', () => {
    render(<ThemeSelector label="Color" description="Pick one" />, { wrapper });

    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('uses the context theme when no controlled value is provided', () => {
    render(<ThemeSelector />, { wrapper });

    expect(screen.getByRole('combobox')).toHaveValue(DEFAULT_THEME_ID);
  });

  it('prefers the controlled settings value over the theme context value', () => {
    render(<ThemeSelector value={alternateTheme.id} />, { wrapper });

    expect(screen.getByRole('combobox')).toHaveValue(alternateTheme.id);
  });

  it('applies live preview and reports the selected theme to settings state', () => {
    const onThemeChange = vi.fn();

    render(<ThemeSelector onThemeChange={onThemeChange} />, { wrapper });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: alternateTheme.id },
    });

    expect(setPreviewThemeSpy).toHaveBeenCalledWith(alternateTheme.id);
    expect(onThemeChange).toHaveBeenCalledWith(alternateTheme.id);
    expect(screen.getByRole('combobox')).toHaveValue(alternateTheme.id);
  });
});
